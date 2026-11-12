//! Couche Tauri de Rayan's Révision : lecture et écriture du fichier de données, des fichiers importés
//! ou exportés, et signal de démarrage pour le test de lancement. Toute la logique (planificateur FSRS,
//! séances, statistiques, import/export) est en TypeScript dans `src/core/`.
//!
//! Données : `%APPDATA%\fr.rayan.revision\revision.json` (ou le dossier `REVISION_DATA_DIR`), avec
//! `revision.bak.json` (version précédente) et une copie par jour dans `sauvegardes\` (14 dernières).

use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const DATA_FILE: &str = "revision.json";
const BACKUP_FILE: &str = "revision.bak.json";
const DAILY_DIR: &str = "sauvegardes";
const DAILY_KEEP: usize = 14;

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = match std::env::var_os("REVISION_DATA_DIR") {
        Some(d) if !d.is_empty() => PathBuf::from(d),
        _ => app.path().app_data_dir().map_err(|e| format!("Dossier de données introuvable : {e}"))?,
    };
    fs::create_dir_all(&dir).map_err(|e| format!("Impossible de créer {} : {e}", dir.display()))?;
    Ok(dir)
}

fn read_opt(path: &Path) -> Result<Option<String>, String> {
    match fs::read_to_string(path) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Lecture de {} impossible : {e}", path.display())),
    }
}

fn is_json(text: &str) -> bool {
    serde_json::from_str::<Value>(text).is_ok()
}

/// Écrit d'abord un fichier temporaire, puis le renomme : une coupure ne laisse jamais un fichier à moitié écrit.
fn write_atomic(path: &Path, text: &str) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, text).map_err(|e| format!("Écriture de {} impossible : {e}", tmp.display()))?;
    fs::rename(&tmp, path).map_err(|e| format!("Enregistrement de {} impossible : {e}", path.display()))
}

#[derive(serde::Serialize)]
struct Loaded {
    main: Option<String>,
    backup: Option<String>,
    dir: String,
}

#[tauri::command]
fn load_db(app: AppHandle) -> Result<Loaded, String> {
    let dir = data_dir(&app)?;
    Ok(Loaded {
        main: read_opt(&dir.join(DATA_FILE))?,
        backup: read_opt(&dir.join(BACKUP_FILE))?,
        dir: dir.display().to_string(),
    })
}

/// Enregistre les données. `day` (AAAA-MM-JJ) : si aucune copie n'existe pour ce jour, on en fait une.
#[tauri::command]
fn save_db(app: AppHandle, text: String, day: Option<String>) -> Result<(), String> {
    if !is_json(&text) {
        return Err("Données invalides : enregistrement refusé.".into());
    }
    let dir = data_dir(&app)?;
    let main = dir.join(DATA_FILE);
    // La version précédente devient la copie de secours, seulement si elle est lisible.
    if let Some(prev) = read_opt(&main)? {
        if is_json(&prev) && prev != text {
            write_atomic(&dir.join(BACKUP_FILE), &prev)?;
        }
    }
    write_atomic(&main, &text)?;
    if let Some(day) = day.filter(|d| d.len() == 10 && d.chars().all(|c| c.is_ascii_digit() || c == '-')) {
        let daily = dir.join(DAILY_DIR);
        let file = daily.join(format!("revision-{day}.json"));
        if !file.exists() {
            fs::create_dir_all(&daily).map_err(|e| format!("Impossible de créer {} : {e}", daily.display()))?;
            write_atomic(&file, &text)?;
            prune_daily(&daily);
        }
    }
    Ok(())
}

fn prune_daily(dir: &Path) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    let mut files: Vec<PathBuf> = entries
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with("revision-") && n.ends_with(".json"))
        })
        .collect();
    files.sort();
    if files.len() > DAILY_KEEP {
        for f in &files[..files.len() - DAILY_KEEP] {
            let _ = fs::remove_file(f);
        }
    }
}

/// Lit un fichier choisi par l'utilisateur dans la boîte de dialogue « Importer ».
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| format!("Lecture de {path} impossible : {e}"))?;
    if bytes.len() > 50 * 1024 * 1024 {
        return Err("Fichier trop volumineux (plus de 50 Mo).".into());
    }
    match String::from_utf8(bytes) {
        Ok(s) => Ok(s),
        // Fichiers enregistrés par Excel en « ANSI » (Windows-1252) : conversion des caractères courants.
        Err(e) => Ok(e.into_bytes().iter().map(|&b| cp1252(b)).collect()),
    }
}

fn cp1252(b: u8) -> char {
    const HIGH: [char; 32] = [
        '€', '\u{81}', '‚', 'ƒ', '„', '…', '†', '‡', 'ˆ', '‰', 'Š', '‹', 'Œ', '\u{8d}', 'Ž', '\u{8f}', '\u{90}', '‘', '’',
        '“', '”', '•', '–', '—', '˜', '™', 'š', '›', 'œ', '\u{9d}', 'ž', 'Ÿ',
    ];
    match b {
        0x80..=0x9f => HIGH[(b - 0x80) as usize],
        _ => b as char,
    }
}

/// Écrit un fichier exporté à l'emplacement choisi dans la boîte de dialogue « Exporter ».
#[tauri::command]
fn write_text_file(path: String, text: String) -> Result<(), String> {
    fs::write(&path, text).map_err(|e| format!("Écriture de {path} impossible : {e}"))
}

/// Test de lancement (CI) : si `REVISION_SMOKE_FILE` est défini, l'interface appelle cette commande une fois
/// chargée ; on écrit son résumé dans ce fichier puis on ferme l'application. Sinon, ne fait rien.
#[tauri::command]
fn smoke_ready(app: AppHandle, summary: String) -> Result<bool, String> {
    let Some(path) = std::env::var_os("REVISION_SMOKE_FILE").filter(|p| !p.is_empty()) else {
        return Ok(false);
    };
    fs::write(&path, summary).map_err(|e| format!("Écriture du résumé de test impossible : {e}"))?;
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(300));
        handle.exit(0);
    });
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![load_db, save_db, read_text_file, write_text_file, smoke_ready])
        .run(tauri::generate_context!())
        .expect("erreur au démarrage de Rayan's Révision");
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
        let dir = std::env::temp_dir().join(format!("revision-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        for d in 1..=20 {
            fs::write(dir.join(format!("revision-2026-01-{d:02}.json")), "{}").unwrap();
        }
        fs::write(dir.join("autre.txt"), "x").unwrap();
        prune_daily(&dir);
        let mut left: Vec<String> = fs::read_dir(&dir).unwrap().map(|e| e.unwrap().file_name().into_string().unwrap()).collect();
        left.sort();
        assert_eq!(left.len(), DAILY_KEEP + 1);
        assert_eq!(left[0], "autre.txt");
        assert_eq!(left[1], "revision-2026-01-07.json");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn ecriture_atomique() {
        let dir = std::env::temp_dir().join(format!("revision-atomic-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let f = dir.join("a.json");
        write_atomic(&f, "{\"v\":1}").unwrap();
        write_atomic(&f, "{\"v\":2}").unwrap();
        assert_eq!(fs::read_to_string(&f).unwrap(), "{\"v\":2}");
        assert!(!dir.join("a.tmp").exists());
        fs::remove_dir_all(&dir).unwrap();
    }
}
