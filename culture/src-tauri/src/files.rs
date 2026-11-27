//! Fonctions de fichiers sans dépendance à Tauri (testées par tests/files.rs, qui n'embarque pas Tauri :
//! un exe de test lié à Tauri ne démarre pas sous Windows sans le manifeste Common-Controls v6).

use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

pub const DAILY_KEEP: usize = 14;
/// Taille maximale du fichier d'actualité (quelques éditions de résumés courts : bien moins de 1 Mo en pratique).
pub const ACTU_MAX: u64 = 5 * 1024 * 1024;

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
                .is_some_and(|n| n.starts_with("culture-") && n.ends_with(".json"))
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

/// Lit le fichier d'actualité (« Ton monde »), en lecture seule. `None` s'il n'existe pas.
/// Refusé s'il est trop gros ou si ce n'est pas du JSON : l'app ne lit jamais autre chose.
pub fn read_actu(path: &Path) -> Result<Option<String>, String> {
    match fs::metadata(path) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(format!("Lecture de {} impossible : {e}", path.display())),
        Ok(m) if !m.is_file() => return Ok(None),
        Ok(m) if m.len() > ACTU_MAX => return Err("Fichier d'actualité trop volumineux (plus de 5 Mo).".into()),
        Ok(_) => {}
    }
    let Some(text) = read_opt(path)? else { return Ok(None) };
    let text = text.trim_start_matches('\u{feff}').to_string();
    if !is_json(&text) {
        return Err(format!("{} n'est pas un fichier d'actualité lisible (JSON attendu).", path.display()));
    }
    Ok(Some(text))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cp1252_accents() {
        let s: String = [0x45u8, 0xe9, 0x80, 0x92].iter().map(|&b| cp1252(b)).collect();
        assert_eq!(s, "Eé€’");
    }

    #[test]
    fn rotation_des_copies_journalieres() {
        let dir = std::env::temp_dir().join(format!("culture-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        for d in 1..=20 {
            fs::write(dir.join(format!("culture-2026-01-{d:02}.json")), "{}").unwrap();
        }
        fs::write(dir.join("autre.txt"), "x").unwrap();
        prune_daily(&dir);
        let mut left: Vec<String> = fs::read_dir(&dir).unwrap().map(|e| e.unwrap().file_name().into_string().unwrap()).collect();
        left.sort();
        assert_eq!(left.len(), DAILY_KEEP + 1);
        assert_eq!(left[0], "autre.txt");
        assert_eq!(left[1], "culture-2026-01-07.json");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn ecriture_atomique() {
        let dir = std::env::temp_dir().join(format!("culture-atomic-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let f = dir.join("a.json");
        write_atomic(&f, "{\"v\":1}").unwrap();
        write_atomic(&f, "{\"v\":2}").unwrap();
        assert_eq!(fs::read_to_string(&f).unwrap(), "{\"v\":2}");
        assert!(!dir.join("a.tmp").exists());
        assert_eq!(read_opt(&f).unwrap().as_deref(), Some("{\"v\":2}"));
        assert_eq!(read_opt(&dir.join("absent.json")).unwrap(), None);
        assert!(is_json("{\"v\":2}"));
        assert!(!is_json("{\"v\":"));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn lecture_du_fichier_actu() {
        let dir = std::env::temp_dir().join(format!("culture-actu-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        // Absent : rien à lire (pas une erreur).
        assert_eq!(read_actu(&dir.join("actu.json")).unwrap(), None);
        // Un dossier n'est pas un fichier.
        assert_eq!(read_actu(&dir).unwrap(), None);
        // JSON valide, avec la marque d'ordre des octets d'un fichier enregistré par le Bloc-notes.
        let f = dir.join("actu.json");
        fs::write(&f, "\u{feff}{\"editions\":[]}").unwrap();
        assert_eq!(read_actu(&f).unwrap().as_deref(), Some("{\"editions\":[]}"));
        // Pas du JSON : refusé.
        fs::write(&f, "<html>").unwrap();
        assert!(read_actu(&f).is_err());
        // Le fichier n'est jamais modifié par la lecture.
        assert_eq!(fs::read_to_string(&f).unwrap(), "<html>");
        fs::remove_dir_all(&dir).unwrap();
    }
}
