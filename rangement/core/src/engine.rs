//! Application d'un aperçu validé et annulation depuis l'historique.

use crate::error::{Error, Result};
use crate::fsops::{free_destination, hash_file, is_in_use, millis, move_no_replace, MoveError};
use crate::journal::{now_label, Journal, OpState, Record};
use crate::plan::{random_id, OpKind, Plan};
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Moved {
    pub id: u32,
    pub source: PathBuf,
    pub destination: PathBuf,
    /// Renommé au moment d'appliquer (un fichier du même nom est apparu depuis l'aperçu).
    pub renamed: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Failed {
    pub id: u32,
    pub path: PathBuf,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ApplyReport {
    /// Identifiant du lot dans l'historique (absent si rien n'a été déplacé).
    pub batch: Option<String>,
    pub moved: Vec<Moved>,
    pub failed: Vec<Failed>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct UndoReport {
    pub restored: Vec<Moved>,
    pub failed: Vec<Failed>,
}

/// Déplace `from` vers `desired` (ou un nom libre à côté), en inscrivant l'intention puis la réussite.
fn journaled_move(
    journal: &Journal,
    from: &Path,
    desired: &Path,
    intent: impl Fn(&Path) -> Record,
    done: impl Fn(&Path) -> Record,
) -> std::result::Result<(PathBuf, bool), String> {
    let dir = desired.parent().ok_or("destination invalide")?.to_path_buf();
    let name = desired.file_name().ok_or("destination invalide")?.to_string_lossy().to_string();
    for _ in 0..20 {
        let (to, renamed) = free_destination(&dir, &name, &HashSet::new());
        journal.append(&intent(&to)).map_err(|e| format!("journal impossible à écrire, rien n'a été déplacé ({e})"))?;
        match move_no_replace(from, &to) {
            Ok(()) => {
                // Le fichier est déplacé : une erreur d'écriture ici est rattrapée à la relecture du journal.
                let _ = journal.append(&done(&to));
                return Ok((to, renamed));
            }
            Err(MoveError::Exists) => continue, // apparu entre-temps : on prend le nom libre suivant
            Err(e) => return Err(e.message()),
        }
    }
    Err("aucun nom libre trouvé pour la destination".into())
}

/// Applique les éléments `selected` (identifiants) d'un aperçu. Chaque fichier est revérifié juste avant :
/// toujours là, inchangé depuis l'aperçu, pas en cours d'utilisation ; pour un doublon, l'original est
/// toujours là et toujours identique.
pub fn apply_plan(plan: &Plan, selected: &[u32], journal: &Journal, origin: &str) -> Result<ApplyReport> {
    let wanted: HashSet<u32> = selected.iter().copied().collect();
    let mut report = ApplyReport::default();
    let batch = random_id();
    let mut batch_written = false;
    for it in plan.items.iter().filter(|i| wanted.contains(&i.id)) {
        let fail = |reason: String| Failed { id: it.id, path: it.source.clone(), reason };
        let meta = match it.source.symlink_metadata() {
            Ok(m) if m.is_file() => m,
            _ => {
                report.failed.push(fail("fichier introuvable (déplacé ou supprimé depuis l'aperçu)".into()));
                continue;
            }
        };
        let modified = meta.modified().map(millis).unwrap_or(0);
        if meta.len() != it.size || modified != it.modified_ms {
            report.failed.push(fail("fichier modifié depuis l'aperçu : relancez l'analyse".into()));
            continue;
        }
        if is_in_use(&it.source) {
            report.failed.push(fail("fichier en cours d'utilisation par un autre programme".into()));
            continue;
        }
        if it.kind == OpKind::Doublon {
            let original = it.duplicate_of.as_deref().unwrap_or(Path::new(""));
            let same = matches!((hash_file(original), hash_file(&it.source)), (Ok(a), Ok(b)) if a == b);
            if !same {
                report.failed.push(fail("l'original a disparu ou changé : doublon non confirmé, fichier laissé en place".into()));
                continue;
            }
        }
        if !batch_written {
            journal.append(&Record::Batch { id: batch.clone(), date: now_label(), origin: origin.to_string() })?;
            batch_written = true;
        }
        let result = journaled_move(
            journal,
            &it.source,
            &it.destination,
            |to| Record::Intent {
                batch: batch.clone(),
                op: it.id,
                kind: it.kind,
                from: it.source.clone(),
                to: to.to_path_buf(),
                reason: it.reason.clone(),
            },
            |to| Record::Done { batch: batch.clone(), op: it.id, to: to.to_path_buf() },
        );
        match result {
            Ok((to, renamed)) => report.moved.push(Moved {
                id: it.id,
                source: it.source.clone(),
                destination: to,
                renamed,
            }),
            Err(reason) => report.failed.push(fail(reason)),
        }
    }
    if !report.moved.is_empty() {
        report.batch = Some(batch);
    }
    Ok(report)
}

/// Annule un lot entier (`ops` = None) ou certaines opérations, dans l'ordre inverse.
/// Le fichier retourne à son emplacement d'origine ; si la place est prise, il est renommé à côté.
pub fn undo(journal: &Journal, batch_id: &str, ops: Option<&[u32]>) -> Result<UndoReport> {
    let batches = journal.batches()?;
    let batch = batches
        .iter()
        .find(|b| b.id == batch_id)
        .ok_or_else(|| Error::Invalid("Ce rangement n'existe pas dans l'historique.".into()))?;
    let mut report = UndoReport::default();
    for op in batch.ops.iter().rev() {
        if ops.is_some_and(|ids| !ids.contains(&op.op)) || op.state == OpState::Annule {
            continue;
        }
        let fail = |reason: String| Failed { id: op.op, path: op.to.clone(), reason };
        if op.to.symlink_metadata().is_err() {
            report.failed.push(fail(format!(
                "le fichier n'est plus dans « {} » (déplacé ou supprimé depuis) : rien n'a été fait",
                op.to.display()
            )));
            continue;
        }
        if is_in_use(&op.to) {
            report.failed.push(fail("fichier en cours d'utilisation par un autre programme".into()));
            continue;
        }
        let result = journaled_move(
            journal,
            &op.to,
            &op.from,
            |to| Record::UndoIntent { batch: batch.id.clone(), op: op.op, to: to.to_path_buf() },
            |to| Record::Undone { batch: batch.id.clone(), op: op.op, to: to.to_path_buf() },
        );
        match result {
            Ok((to, renamed)) => report.restored.push(Moved { id: op.op, source: op.to.clone(), destination: to, renamed }),
            Err(reason) => report.failed.push(fail(reason)),
        }
    }
    Ok(report)
}
