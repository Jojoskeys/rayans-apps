//! Fonctions de fichiers sans dépendance à Tauri (testées par tests/files.rs, qui n'embarque pas Tauri :
//! un exe de test lié à Tauri ne démarre pas sous Windows sans le manifeste Common-Controls v6).

use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

pub const DAILY_KEEP: usize = 14;

pub fn read_opt(path: &Path) -> Result<Option<String>, String> {
    match fs::read_to_string(path) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Lecture de {} impossible : {e}", path.display())),
    }
}

pub fn is_json(text: &str) -> bool {
    serde_json::from_str::<Value>(text).is_ok()
}

/// Écrit d'abord un fichier temporaire, puis le renomme : une coupure ne laisse jamais un fichier à moitié écrit.
pub fn write_atomic(path: &Path, text: &str) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, text).map_err(|e| format!("Écriture de {} impossible : {e}", tmp.display()))?;
    fs::rename(&tmp, path).map_err(|e| format!("Enregistrement de {} impossible : {e}", path.display()))
}

pub fn prune_daily(dir: &Path) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    let mut files: Vec<PathBuf> = entries
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with("focus-") && n.ends_with(".json"))
        })
        .collect();
    files.sort();
    if files.len() > DAILY_KEEP {
        for f in &files[..files.len() - DAILY_KEEP] {
            let _ = fs::remove_file(f);
        }
    }
}

pub fn cp1252(b: u8) -> char {
    const HIGH: [char; 32] = [
        '€', '\u{81}', '‚', 'ƒ', '„', '…', '†', '‡', 'ˆ', '‰', 'Š', '‹', 'Œ', '\u{8d}', 'Ž', '\u{8f}', '\u{90}', '‘', '’',
        '“', '”', '•', '–', '—', '˜', '™', 'š', '›', 'œ', '\u{9d}', 'ž', 'Ÿ',
    ];
    match b {
        0x80..=0x9f => HIGH[(b - 0x80) as usize],
        _ => b as char,
    }
}

/// Identifiant de Rayan's Chrono dans Rayan's Launcher (voir .github/workflows/chrono.yml).
pub const CHRONO_ID: &str = "rayans-chrono-app";
pub const CHRONO_EXE: &str = "Rayans Chrono.exe";

/// Cherche l'exe de Rayan's Chrono installé par Rayan's Launcher, dont la racine est `root`
/// (`%LOCALAPPDATA%\fr.rayan.launcher`) : d'abord la version active notée dans `installed.json`
/// (`apps/<id>/versions/<dossier>/<exe>`), sinon n'importe quelle version présente sur le disque.
pub fn chrono_exe(root: &Path) -> Option<PathBuf> {
    let versions = root.join("apps").join(CHRONO_ID).join("versions");
    if let Ok(Some(text)) = read_opt(&root.join("installed.json")) {
        if let Ok(v) = serde_json::from_str::<Value>(&text) {
            let cur = &v["apps"][CHRONO_ID]["current"];
            if let (Some(dir), Some(exe)) = (cur["dir"].as_str(), cur["executable"].as_str()) {
                let safe = |s: &str| !s.is_empty() && !s.contains("..") && !s.contains('/') && !s.contains('\\');
                if safe(dir) && safe(exe) {
                    let p = versions.join(dir).join(exe);
                    if p.is_file() {
                        return Some(p);
                    }
                }
            }
        }
    }
    let mut found: Vec<PathBuf> = fs::read_dir(&versions)
        .ok()?
        .filter_map(|e| e.ok().map(|e| e.path().join(CHRONO_EXE)))
        .filter(|p| p.is_file())
        .collect();
    found.sort();
    found.pop()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chrono_trouve_par_le_launcher() {
        let root = std::env::temp_dir().join(format!("focus-chrono-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        assert_eq!(chrono_exe(&root), None);
        let v1 = root.join("apps").join(CHRONO_ID).join("versions").join("1.0.1-1");
        let v2 = root.join("apps").join(CHRONO_ID).join("versions").join("1.0.2-2");
        fs::create_dir_all(&v1).unwrap();
        fs::create_dir_all(&v2).unwrap();
        fs::write(v1.join(CHRONO_EXE), "x").unwrap();
        fs::write(v2.join(CHRONO_EXE), "x").unwrap();
        // Sans installed.json : la dernière version présente.
        assert_eq!(chrono_exe(&root), Some(v2.join(CHRONO_EXE)));
        // Avec installed.json : la version active, même plus ancienne.
        let fiche = format!(r#"{{"apps":{{"{CHRONO_ID}":{{"current":{{"dir":"1.0.1-1","executable":"{CHRONO_EXE}"}}}}}}}}"#);
        fs::write(root.join("installed.json"), fiche).unwrap();
        assert_eq!(chrono_exe(&root), Some(v1.join(CHRONO_EXE)));
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn cp1252_accents() {
        let s: String = [0x45u8, 0xe9, 0x80, 0x92].iter().map(|&b| cp1252(b)).collect();
        assert_eq!(s, "Eé€’");
    }

    #[test]
    fn rotation_des_copies_journalieres() {
        let dir = std::env::temp_dir().join(format!("focus-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        for d in 1..=20 {
            fs::write(dir.join(format!("focus-2026-01-{d:02}.json")), "{}").unwrap();
        }
        fs::write(dir.join("autre.txt"), "x").unwrap();
        prune_daily(&dir);
        let mut left: Vec<String> = fs::read_dir(&dir).unwrap().map(|e| e.unwrap().file_name().into_string().unwrap()).collect();
        left.sort();
        assert_eq!(left.len(), DAILY_KEEP + 1);
        assert_eq!(left[0], "autre.txt");
        assert_eq!(left[1], "focus-2026-01-07.json");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn ecriture_atomique() {
        let dir = std::env::temp_dir().join(format!("focus-atomic-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let f = dir.join("a.json");
        write_atomic(&f, "{\"v\":1}").unwrap();
        write_atomic(&f, "{\"v\":2}").unwrap();
        assert_eq!(fs::read_to_string(&f).unwrap(), "{\"v\":2}");
        assert!(!dir.join("a.tmp").exists());
        // Lecture : contenu présent, fichier absent = None (premier démarrage), JSON valide ou non.
        assert_eq!(read_opt(&f).unwrap().as_deref(), Some("{\"v\":2}"));
        assert_eq!(read_opt(&dir.join("absent.json")).unwrap(), None);
        assert!(is_json("{\"v\":2}"));
        assert!(!is_json("{\"v\":"));
        fs::remove_dir_all(&dir).unwrap();
    }
}
