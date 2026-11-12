//! Lecture des dossiers surveillés : fichiers du premier niveau seulement (les sous-dossiers, dont ceux
//! créés par le rangement, ne sont jamais parcourus).

use crate::fsops::path_key;
use crate::rules::FileFacts;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct Candidate {
    pub path: PathBuf,
    /// Dossier surveillé qui contient le fichier.
    pub folder: PathBuf,
    pub facts: FileFacts,
}

/// Fichiers qu'on ne touche jamais, sans même les mentionner : téléchargements en cours, fichiers
/// temporaires ou de verrouillage, fichiers système de l'Explorateur.
pub fn is_ignored_name(name: &str) -> bool {
    let lower = name.to_lowercase();
    const EXACT: [&str; 3] = ["desktop.ini", "thumbs.db", ".ds_store"];
    const SUFFIXES: [&str; 8] = [".crdownload", ".part", ".partial", ".download", ".opdownload", ".tmp", ".temp", ".!ut"];
    EXACT.contains(&lower.as_str()) || lower.starts_with("~$") || SUFFIXES.iter().any(|s| lower.ends_with(s))
}

#[cfg(windows)]
fn is_hidden_or_system(meta: &std::fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const HIDDEN: u32 = 0x2;
    const SYSTEM: u32 = 0x4;
    meta.file_attributes() & (HIDDEN | SYSTEM) != 0
}

#[cfg(not(windows))]
fn is_hidden_or_system(_meta: &std::fs::Metadata) -> bool {
    false
}

pub struct ScanResult {
    pub files: Vec<Candidate>,
    /// Dossiers surveillés introuvables ou illisibles (chemin, raison).
    pub problems: Vec<(PathBuf, String)>,
}

pub fn scan(folders: &[PathBuf]) -> ScanResult {
    let mut files = Vec::new();
    let mut problems = Vec::new();
    let mut seen = HashSet::new();
    for folder in folders {
        if !seen.insert(path_key(folder)) {
            continue;
        }
        let entries = match std::fs::read_dir(folder) {
            Ok(e) => e,
            Err(e) => {
                problems.push((folder.clone(), format!("dossier illisible ou introuvable ({e})")));
                continue;
            }
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(meta) = path.symlink_metadata() else { continue };
            // Ni dossiers, ni liens symboliques, ni fichiers cachés ou système.
            if !meta.file_type().is_file() || is_hidden_or_system(&meta) {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if is_ignored_name(&name) {
                continue;
            }
            let modified = meta.modified().unwrap_or(std::time::UNIX_EPOCH);
            files.push(Candidate { path, folder: folder.clone(), facts: FileFacts::new(&name, meta.len(), modified) });
        }
    }
    files.sort_by(|a, b| path_key(&a.path).cmp(&path_key(&b.path)));
    ScanResult { files, problems }
}

pub fn is_inside(child: &Path, parent: &Path) -> bool {
    let (c, p) = (path_key(child), path_key(parent));
    c == p || c.starts_with(&format!("{p}\\"))
}
