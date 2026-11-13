//! Historique : installations, mises à jour, retours, lancements (avec code de sortie et durée), sauvegardes
//! et erreurs. Une ligne JSON par événement dans `history.jsonl`, les plus anciennes au-delà de `MAX` sont retirées.

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::Path;

const MAX: usize = 3000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEvent {
    pub at: String,
    pub app_id: Option<String>,
    /// install, update, rollback, uninstall, launch, exit, error, backup, restore, auto-update, clean, import
    pub kind: String,
    #[serde(default)]
    pub version: Option<String>,
    /// Version quittée (mise à jour, retour).
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub detail: Option<String>,
    #[serde(default)]
    pub code: Option<i32>,
    /// Durée d'exécution en secondes (événement « exit »).
    #[serde(default)]
    pub seconds: Option<u64>,
}

impl HistoryEvent {
    pub fn new(kind: &str, app_id: Option<&str>) -> Self {
        Self {
            at: crate::util::now_rfc3339(),
            app_id: app_id.map(str::to_string),
            kind: kind.into(),
            version: None,
            from: None,
            detail: None,
            code: None,
            seconds: None,
        }
    }
    pub fn version(mut self, v: impl ToString) -> Self {
        self.version = Some(v.to_string());
        self
    }
    pub fn from(mut self, v: impl ToString) -> Self {
        self.from = Some(v.to_string());
        self
    }
    pub fn detail(mut self, d: impl Into<String>) -> Self {
        self.detail = Some(d.into());
        self
    }
}

pub fn append(path: &Path, e: &HistoryEvent) {
    let Ok(line) = serde_json::to_string(e) else { return };
    if let Some(d) = path.parent() {
        let _ = std::fs::create_dir_all(d);
    }
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "{line}");
    }
}

/// Tous les événements, du plus ancien au plus récent (lignes illisibles ignorées).
pub fn read_all(path: &Path) -> Vec<HistoryEvent> {
    std::fs::read_to_string(path)
        .unwrap_or_default()
        .lines()
        .filter_map(|l| serde_json::from_str(l).ok())
        .collect()
}

/// Les plus récents d'abord, éventuellement pour une seule application.
pub fn list(path: &Path, app_id: Option<&str>, limit: usize) -> Vec<HistoryEvent> {
    let mut all = read_all(path);
    all.reverse();
    all.into_iter().filter(|e| app_id.is_none_or(|a| e.app_id.as_deref() == Some(a))).take(limit).collect()
}

/// Garde les `MAX` derniers événements (au démarrage).
pub fn trim(path: &Path) {
    let all = read_all(path);
    if all.len() <= MAX {
        return;
    }
    let text: String = all[all.len() - MAX..]
        .iter()
        .filter_map(|e| serde_json::to_string(e).ok())
        .map(|l| l + "\n")
        .collect();
    let _ = crate::util::write_atomic(path, text.as_bytes());
}
