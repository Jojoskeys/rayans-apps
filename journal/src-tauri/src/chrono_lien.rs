//! Lien avec Rayan's Chrono, **en lecture seule** : le fichier `chrono.json` de Chrono n'est jamais
//! modifié (Chrono peut l'écrire au même moment). On y lit les projets et le temps enregistré, pour le
//! comparer au temps mesuré d'après les fenêtres. Le bouton « Démarrer dans Chrono » lance Chrono avec
//! `--projet=<nom>`, l'option qu'il prévoit pour ça.

use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjetChrono {
    pub nom: String,
    pub couleur: String,
    pub archive: bool,
    /// Temps enregistré dans Chrono sur la période demandée.
    pub ms: i64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChronoVue {
    pub fichier: PathBuf,
    pub projets: Vec<ProjetChrono>,
    pub executable: bool,
}

fn candidats() -> Vec<PathBuf> {
    let mut v = Vec::new();
    if let Some(l) = dirs::data_local_dir() {
        v.push(l.join("fr.rayan.launcher").join("data").join("rayans-chrono-app").join("chrono.json"));
    }
    if let Some(r) = dirs::data_dir() {
        v.push(r.join("Rayans Chrono").join("chrono.json"));
    }
    v
}

/// Le `chrono.json` le plus récemment modifié.
pub fn fichier() -> Option<PathBuf> {
    candidats()
        .into_iter()
        .filter_map(|p| std::fs::metadata(&p).and_then(|m| m.modified()).ok().map(|t| (t, p)))
        .max_by_key(|(t, _)| *t)
        .map(|(_, p)| p)
}

/// L'exécutable de Chrono installé par Rayan's Launcher (version la plus récente).
pub fn executable() -> Option<PathBuf> {
    let base = dirs::data_local_dir()?.join("fr.rayan.launcher").join("apps").join("rayans-chrono-app").join("versions");
    std::fs::read_dir(base)
        .ok()?
        .flatten()
        .map(|e| e.path().join("Rayans Chrono.exe"))
        .filter(|p| p.exists())
        .filter_map(|p| std::fs::metadata(&p).and_then(|m| m.modified()).ok().map(|t| (t, p)))
        .max_by_key(|(t, _)| *t)
        .map(|(_, p)| p)
}

pub fn lire(du: i64, au: i64) -> Option<ChronoVue> {
    let f = fichier()?;
    let v: Value = serde_json::from_slice(&std::fs::read(&f).ok()?).ok()?;
    let mut temps: HashMap<String, i64> = HashMap::new();
    for e in v.get("entries").and_then(Value::as_array).into_iter().flatten() {
        let (Some(p), Some(d), Some(fin)) = (
            e.get("projectId").and_then(Value::as_str),
            e.get("start").and_then(Value::as_i64),
            e.get("end").and_then(Value::as_i64),
        ) else {
            continue;
        };
        let c = fin.min(au) - d.max(du);
        if c > 0 {
            *temps.entry(p.to_string()).or_default() += c;
        }
    }
    let projets = v
        .get("projects")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|p| {
            let id = p.get("id").and_then(Value::as_str)?;
            Some(ProjetChrono {
                nom: p.get("name").and_then(Value::as_str)?.to_string(),
                couleur: p.get("color").and_then(Value::as_str).unwrap_or("#ffb23f").to_string(),
                archive: p.get("archived").and_then(Value::as_bool).unwrap_or(false),
                ms: temps.get(id).copied().unwrap_or(0),
            })
        })
        .collect();
    Some(ChronoVue { fichier: f, projets, executable: executable().is_some() })
}

pub fn lancer(projet: &str) -> Result<(), String> {
    let exe = executable().ok_or("Rayan's Chrono n'est pas installé par Rayan's Launcher sur ce PC.")?;
    std::process::Command::new(exe).arg(format!("--projet={projet}")).spawn().map(|_| ()).map_err(|e| e.to_string())
}
