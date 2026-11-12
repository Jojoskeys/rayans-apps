//! Aperçu : la liste exacte des déplacements prévus. Rien ne bouge ici ; l'utilisateur valide ensuite
//! tout ou partie de la liste (voir `engine::apply_plan`).

use crate::config::Config;
use crate::error::Result;
use crate::fsops::{free_destination, hash_file, is_in_use, millis, path_key, same_path};
use crate::rules::first_match;
use crate::scan::{is_inside, scan, Candidate};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum OpKind {
    /// Rangement selon une règle.
    Ranger,
    /// Doublon mis en quarantaine.
    Doublon,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlanItem {
    pub id: u32,
    pub kind: OpKind,
    pub source: PathBuf,
    pub destination: PathBuf,
    /// Le nom a été changé pour ne pas écraser un fichier existant.
    pub renamed: bool,
    /// Règle appliquée ou « Doublon de … ».
    pub reason: String,
    pub size: u64,
    /// Date de modification vue lors de l'aperçu (ms) : si elle change, le fichier n'est pas déplacé.
    pub modified_ms: i64,
    /// Pour un doublon : le fichier conservé.
    pub duplicate_of: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SkipItem {
    pub path: PathBuf,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub id: String,
    pub created_ms: i64,
    /// Nombre de fichiers examinés.
    pub scanned: usize,
    pub items: Vec<PlanItem>,
    pub skipped: Vec<SkipItem>,
}

pub(crate) fn random_id() -> String {
    let mut b = [0u8; 6];
    let _ = getrandom::fill(&mut b);
    hex::encode(b)
}

fn date_parts(t: SystemTime) -> (i32, u8, u8) {
    let utc = time::OffsetDateTime::from(t);
    let local = time::UtcOffset::current_local_offset().map(|o| utc.to_offset(o)).unwrap_or(utc);
    (local.year(), local.month() as u8, local.day())
}

/// Dossier de destination d'une règle pour un fichier donné.
pub fn resolve_target(target: &str, folder: &Path, modified: SystemTime) -> PathBuf {
    let (y, m, _) = date_parts(modified);
    let t = target.trim().replace("{annee}", &y.to_string()).replace("{mois}", &format!("{m:02}"));
    let p = PathBuf::from(&t);
    if p.is_absolute() {
        p
    } else {
        folder.join(p)
    }
}

pub fn build_plan(cfg: &Config, now: SystemTime) -> Result<Plan> {
    cfg.validate()?;
    let scanned = scan(&cfg.watched);
    let mut skipped: Vec<SkipItem> =
        scanned.problems.iter().map(|(p, r)| SkipItem { path: p.clone(), reason: r.clone() }).collect();

    // Fichiers trop récents : peut-être en cours de téléchargement ou d'écriture.
    let recent = Duration::from_secs(cfg.ignore_recent_minutes as u64 * 60);
    let mut eligible: Vec<&Candidate> = Vec::new();
    for c in &scanned.files {
        if cfg.duplicates && is_inside(&c.path, &cfg.quarantine_dir) {
            continue;
        }
        let age = now.duration_since(c.facts.modified).unwrap_or(Duration::ZERO);
        if age < recent {
            skipped.push(SkipItem {
                path: c.path.clone(),
                reason: format!("modifié il y a moins de {} min (peut-être encore en cours d'écriture)", cfg.ignore_recent_minutes),
            });
        } else {
            eligible.push(c);
        }
    }

    let mut items: Vec<PlanItem> = Vec::new();
    let mut reserved: HashSet<String> = HashSet::new();
    let mut handled: HashSet<String> = HashSet::new();

    // 1. Doublons : même taille, puis même empreinte. On garde le plus ancien (puis le nom le plus court).
    if cfg.duplicates {
        let (y, m, d) = date_parts(now);
        let qdir = cfg.quarantine_dir.join(format!("{y}-{m:02}-{d:02}"));
        let mut by_size: BTreeMap<u64, Vec<&Candidate>> = BTreeMap::new();
        for c in eligible.iter().filter(|c| c.facts.size > 0) {
            by_size.entry(c.facts.size).or_default().push(c);
        }
        for group in by_size.values().filter(|g| g.len() > 1) {
            let mut by_hash: HashMap<String, Vec<&Candidate>> = HashMap::new();
            for c in group {
                match hash_file(&c.path) {
                    Ok(h) => by_hash.entry(h).or_default().push(c),
                    Err(e) => skipped.push(SkipItem { path: c.path.clone(), reason: format!("illisible ({e})") }),
                }
            }
            let mut sets: Vec<Vec<&Candidate>> = by_hash.into_values().filter(|s| s.len() > 1).collect();
            sets.sort_by_key(|s| path_key(&s[0].path));
            for mut set in sets {
                set.sort_by(|a, b| {
                    a.facts
                        .modified
                        .cmp(&b.facts.modified)
                        .then(a.facts.name.chars().count().cmp(&b.facts.name.chars().count()))
                        .then(path_key(&a.path).cmp(&path_key(&b.path)))
                });
                let keep = set[0];
                for dup in &set[1..] {
                    handled.insert(path_key(&dup.path));
                    let (dest, renamed) = free_destination(&qdir, &dup.facts.name, &reserved);
                    reserved.insert(path_key(&dest));
                    items.push(PlanItem {
                        id: 0,
                        kind: crate::plan::OpKind::Doublon,
                        source: dup.path.clone(),
                        destination: dest,
                        renamed,
                        reason: format!("Doublon de « {} »", keep.path.display()),
                        size: dup.facts.size,
                        modified_ms: millis(dup.facts.modified),
                        duplicate_of: Some(keep.path.clone()),
                    });
                }
            }
        }
    }

    // 2. Règles.
    for c in &eligible {
        if handled.contains(&path_key(&c.path)) {
            continue;
        }
        let Some(rule) = first_match(&cfg.rules, &c.facts, &c.folder, now) else { continue };
        let dir = resolve_target(&rule.target, &c.folder, c.facts.modified);
        if c.path.parent().is_some_and(|p| same_path(p, &dir)) {
            continue; // déjà au bon endroit
        }
        let (dest, renamed) = free_destination(&dir, &c.facts.name, &reserved);
        reserved.insert(path_key(&dest));
        items.push(PlanItem {
            id: 0,
            kind: OpKind::Ranger,
            source: c.path.clone(),
            destination: dest,
            renamed,
            reason: format!("Règle « {} »", rule.name),
            size: c.facts.size,
            modified_ms: millis(c.facts.modified),
            duplicate_of: None,
        });
    }

    // 3. Fichiers ouverts par un autre programme : laissés en place.
    let mut kept = Vec::with_capacity(items.len());
    for it in items {
        if is_in_use(&it.source) {
            skipped.push(SkipItem { path: it.source, reason: "en cours d'utilisation par un autre programme".into() });
        } else {
            kept.push(it);
        }
    }
    for (i, it) in kept.iter_mut().enumerate() {
        it.id = i as u32 + 1;
    }

    Ok(Plan { id: random_id(), created_ms: millis(now), scanned: scanned.files.len(), items: kept, skipped })
}
