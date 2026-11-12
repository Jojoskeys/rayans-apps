//! Journal des opérations (`journal.jsonl`, une ligne JSON par événement, jamais réécrit).
//!
//! Chaque déplacement est inscrit en deux temps : « intention » *avant* de toucher au fichier, puis
//! « fait » une fois le déplacement réussi. Si l'application s'arrête entre les deux, la lecture du
//! journal regarde le disque pour savoir où se trouve le fichier : rien n'est perdu de vue.

use crate::error::Result;
use crate::plan::OpKind;
use serde::{Deserialize, Serialize};
use std::io::{BufRead, Write};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "t", rename_all = "kebab-case")]
pub enum Record {
    Batch { id: String, date: String, origin: String },
    Intent { batch: String, op: u32, kind: OpKind, from: PathBuf, to: PathBuf, reason: String },
    Done { batch: String, op: u32, to: PathBuf },
    UndoIntent { batch: String, op: u32, to: PathBuf },
    Undone { batch: String, op: u32, to: PathBuf },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum OpState {
    /// Déplacé ; peut être annulé.
    Fait,
    /// Remis à sa place d'origine.
    Annule,
    /// Interruption pendant l'opération et disque ambigu : à vérifier (l'annulation reste possible).
    Incertain,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OpView {
    pub op: u32,
    pub kind: OpKind,
    pub reason: String,
    pub from: PathBuf,
    pub to: PathBuf,
    pub state: OpState,
    /// Où le fichier a été remis lors de l'annulation (peut différer de `from` si la place était prise).
    pub restored_to: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BatchView {
    pub id: String,
    pub date: String,
    /// « manuel » ou « automatique ».
    pub origin: String,
    pub ops: Vec<OpView>,
}

pub struct Journal {
    path: PathBuf,
}

enum Pending {
    Move,
    Done,
    Undo(PathBuf),
    Undone(PathBuf),
}

fn exists(p: &Path) -> bool {
    p.symlink_metadata().is_ok()
}

impl Journal {
    pub fn open(path: impl Into<PathBuf>) -> Journal {
        Journal { path: path.into() }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Ajoute un événement et force l'écriture sur le disque.
    pub fn append(&self, r: &Record) -> Result<()> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut f = std::fs::OpenOptions::new().create(true).append(true).open(&self.path)?;
        let mut line = serde_json::to_string(r)?;
        line.push('\n');
        f.write_all(line.as_bytes())?;
        f.sync_data()?;
        Ok(())
    }

    pub fn records(&self) -> Result<Vec<Record>> {
        let f = match std::fs::File::open(&self.path) {
            Ok(f) => f,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(e) => return Err(e.into()),
        };
        // Une ligne illisible (coupure pendant l'écriture) est ignorée, pas le reste du journal.
        Ok(std::io::BufReader::new(f)
            .lines()
            .map_while(|l| l.ok())
            .filter_map(|l| serde_json::from_str::<Record>(l.trim()).ok())
            .collect())
    }

    /// Historique, du plus récent au plus ancien.
    pub fn batches(&self) -> Result<Vec<BatchView>> {
        let mut batches: Vec<(BatchView, Vec<Pending>)> = Vec::new();
        let find = |batches: &mut Vec<(BatchView, Vec<Pending>)>, id: &str, op: u32| -> Option<(usize, usize)> {
            let b = batches.iter().position(|(b, _)| b.id == id)?;
            let o = batches[b].0.ops.iter().position(|o| o.op == op)?;
            Some((b, o))
        };
        for r in self.records()? {
            match r {
                Record::Batch { id, date, origin } => {
                    if !batches.iter().any(|(b, _)| b.id == id) {
                        batches.push((BatchView { id, date, origin, ops: Vec::new() }, Vec::new()));
                    }
                }
                Record::Intent { batch, op, kind, from, to, reason } => {
                    if let Some((b, o)) = find(&mut batches, &batch, op) {
                        // Nouvelle tentative avec un autre nom (la destination était prise entre-temps).
                        batches[b].0.ops[o].to = to;
                        batches[b].1[o] = Pending::Move;
                    } else if let Some(b) = batches.iter().position(|(v, _)| v.id == batch) {
                        batches[b].0.ops.push(OpView {
                            op,
                            kind,
                            reason,
                            from,
                            to,
                            state: OpState::Incertain,
                            restored_to: None,
                        });
                        batches[b].1.push(Pending::Move);
                    }
                }
                Record::Done { batch, op, to } => {
                    if let Some((b, o)) = find(&mut batches, &batch, op) {
                        batches[b].0.ops[o].to = to;
                        batches[b].1[o] = Pending::Done;
                    }
                }
                Record::UndoIntent { batch, op, to } => {
                    if let Some((b, o)) = find(&mut batches, &batch, op) {
                        batches[b].1[o] = Pending::Undo(to);
                    }
                }
                Record::Undone { batch, op, to } => {
                    if let Some((b, o)) = find(&mut batches, &batch, op) {
                        batches[b].1[o] = Pending::Undone(to);
                    }
                }
            }
        }
        let mut out = Vec::new();
        for (mut view, pending) in batches {
            let mut ops = Vec::new();
            for (mut op, p) in view.ops.drain(..).zip(pending) {
                match p {
                    Pending::Done => op.state = OpState::Fait,
                    Pending::Undone(to) => {
                        op.state = OpState::Annule;
                        op.restored_to = Some(to);
                    }
                    Pending::Move => {
                        // Intention sans confirmation : on regarde où est le fichier.
                        match (exists(&op.from), exists(&op.to)) {
                            (false, true) => op.state = OpState::Fait,
                            (true, false) => continue, // le déplacement n'a pas eu lieu
                            _ => op.state = OpState::Incertain,
                        }
                    }
                    Pending::Undo(target) => match (exists(&op.to), exists(&target)) {
                        (false, true) => {
                            op.state = OpState::Annule;
                            op.restored_to = Some(target);
                        }
                        (true, false) => op.state = OpState::Fait,
                        _ => op.state = OpState::Incertain,
                    },
                }
                ops.push(op);
            }
            if !ops.is_empty() {
                view.ops = ops;
                out.push(view);
            }
        }
        out.reverse();
        Ok(out)
    }
}

pub fn now_label() -> String {
    let utc = time::OffsetDateTime::now_utc();
    let local = time::UtcOffset::current_local_offset().map(|o| utc.to_offset(o)).unwrap_or(utc);
    let fmt = time::macros::format_description!("[year]-[month]-[day] [hour]:[minute]:[second]");
    local.format(&fmt).unwrap_or_default()
}
