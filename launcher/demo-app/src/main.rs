//! Horloge Démo : petite application distribuée par Hangar pour tester le parcours complet.
//! La version affichée vient de la compilation (variable DEMO_VERSION), ce qui produit deux binaires
//! réellement différents pour la v1 et la v2.
//!
//! Elle utilise le dossier de données fourni par le launcher (HANGAR_APP_DATA), séparé des fichiers de
//! version : le compteur de lancements survit donc aux mises à jour.
#![cfg_attr(windows, windows_subsystem = "windows")]

use std::io::Write;

const VERSION: &str = match option_env!("DEMO_VERSION") {
    Some(v) => v,
    None => "0.0.0-dev",
};

fn main() {
    let data = std::env::var_os("HANGAR_APP_DATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| std::env::temp_dir().join("horloge-demo"));
    let _ = std::fs::create_dir_all(&data);
    let counter = data.join("lancements.txt");
    let n: u64 = std::fs::read_to_string(&counter)
        .ok()
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(0)
        + 1;
    let _ = std::fs::write(&counter, n.to_string());
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let (h, m, s) = ((secs / 3600) % 24, (secs / 60) % 60, secs % 60);
    let novelty = if VERSION.starts_with("2.") {
        "\nNouveau en v2 : l'heure UTC est affichée avec les secondes."
    } else {
        ""
    };
    let msg = format!(
        "Horloge Démo v{VERSION}\nHeure UTC : {h:02}:{m:02}{}\nLancement n°{n} (compteur conservé dans {})\nDossier de la version : {}{novelty}",
        if VERSION.starts_with("2.") { format!(":{s:02}") } else { String::new() },
        data.display(),
        std::env::current_dir().map(|d| d.display().to_string()).unwrap_or_default(),
    );
    // Trace lisible par les tests de bout en bout.
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(data.join("journal.txt")) {
        let _ = writeln!(f, "version={VERSION} lancement={n}");
    }
    show(&msg);
    // Crochet de test : rester ouverte tant que <données>/garder-ouvert existe (60 s au plus).
    let hold = data.join("garder-ouvert");
    for _ in 0..600 {
        if !hold.exists() {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
}

#[cfg(windows)]
fn show(msg: &str) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONINFORMATION, MB_OK};
    let wide = |s: &str| s.encode_utf16().chain(std::iter::once(0)).collect::<Vec<u16>>();
    if std::env::var_os("DEMO_NO_WINDOW").is_some() {
        // Mode test automatisé : pas de fenêtre bloquante.
        let secs: u64 = std::env::var("DEMO_SECONDS").ok().and_then(|s| s.parse().ok()).unwrap_or(3);
        std::thread::sleep(std::time::Duration::from_secs(secs));
        return;
    }
    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            wide(msg).as_ptr(),
            wide("Horloge Démo").as_ptr(),
            MB_OK | MB_ICONINFORMATION,
        );
    }
}

#[cfg(not(windows))]
fn show(msg: &str) {
    println!("{msg}");
    // Reste ouverte quelques secondes pour simuler une application en cours d'utilisation.
    let secs: u64 = std::env::var("DEMO_SECONDS").ok().and_then(|s| s.parse().ok()).unwrap_or(3);
    std::thread::sleep(std::time::Duration::from_secs(secs));
}
