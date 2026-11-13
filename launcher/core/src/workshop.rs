//! Atelier de publication : analyse le ZIP d'une application avant de le publier. Structure, fiche
//! `rayans-launcher.json`, exécutable, entrées dangereuses, puis comparaison avec la version installée
//! (fichiers ajoutés, retirés, qui ont beaucoup grossi).

use crate::archive::safe_entry_path;
use crate::catalog::{is_valid_id, normalize_relative_path};
use crate::error::{Error, Result};
use crate::local::MANIFEST_NAME;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::io::Read;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct WorkshopManifest {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub release_notes: String,
    pub executable: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Check {
    /// "ok", "warn", "error"
    pub level: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    pub path: String,
    pub before: Option<u64>,
    pub after: Option<u64>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Comparison {
    pub version: String,
    pub files_before: u64,
    pub bytes_before: u64,
    pub added: Vec<FileChange>,
    pub removed: Vec<FileChange>,
    /// Fichiers qui ont grossi de plus de moitié (et d'au moins 100 Ko).
    pub grown: Vec<FileChange>,
    pub changed: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkshopReport {
    pub zip_name: String,
    pub zip_bytes: u64,
    pub files: u64,
    pub unpacked_bytes: u64,
    pub manifest: WorkshopManifest,
    pub has_manifest: bool,
    pub executables: Vec<String>,
    /// Les 8 plus gros fichiers.
    pub largest: Vec<FileChange>,
    pub checks: Vec<Check>,
    pub comparison: Option<Comparison>,
    /// Plus aucune erreur : le ZIP peut être publié.
    pub ready: bool,
}

fn check(level: &str, text: impl Into<String>) -> Check {
    Check { level: level.into(), text: text.into() }
}

/// Fichiers d'un dossier installé (chemins relatifs en « / »), sans le marqueur de version.
pub fn dir_listing(dir: &Path) -> BTreeMap<String, u64> {
    fn walk(base: &Path, dir: &Path, out: &mut BTreeMap<String, u64>) {
        let Ok(rd) = std::fs::read_dir(dir) else { return };
        for e in rd.flatten() {
            let Ok(m) = std::fs::symlink_metadata(e.path()) else { continue };
            if m.is_dir() {
                walk(base, &e.path(), out);
            } else if m.is_file() {
                let rel = e.path().strip_prefix(base).map(|r| r.to_string_lossy().replace('\\', "/")).unwrap_or_default();
                if !rel.starts_with(".hangar-") {
                    out.insert(rel, m.len());
                }
            }
        }
    }
    let mut out = BTreeMap::new();
    walk(dir, dir, &mut out);
    out
}

/// `previous` : version installée de la même application (version, dossier), pour la comparaison.
pub fn analyze(zip_path: &Path, previous: impl FnOnce(&str) -> Option<(String, std::path::PathBuf)>) -> Result<WorkshopReport> {
    let zip_bytes = std::fs::metadata(zip_path)?.len();
    let file = std::fs::File::open(zip_path)?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|e| Error::BadArchive(format!("ce n'est pas un ZIP valide ({e})")))?;
    let mut checks = Vec::new();
    let mut files: BTreeMap<String, u64> = BTreeMap::new();
    let mut manifest_text = None;
    let mut unsafe_entries = Vec::new();
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| Error::BadArchive(format!("entrée n°{i} illisible ({e})")))?;
        let raw = entry.name().to_string();
        if let Err(e) = safe_entry_path(&raw) {
            unsafe_entries.push(e.to_string());
            continue;
        }
        if entry.is_dir() {
            continue;
        }
        let Ok(name) = normalize_relative_path(&raw) else { continue };
        if name == MANIFEST_NAME && entry.size() <= 64 * 1024 {
            let mut s = String::new();
            entry.read_to_string(&mut s)?;
            manifest_text = Some(s.trim_start_matches('\u{feff}').to_string());
        }
        if files.insert(name.clone(), entry.size()).is_some() {
            checks.push(check("error", format!("« {name} » est présent deux fois.")));
        }
    }
    for u in unsafe_entries.iter().take(3) {
        checks.push(check("error", format!("{u} : le launcher refusera l'archive entière.")));
    }

    let mut has_manifest = false;
    let mut manifest = WorkshopManifest::default();
    match manifest_text.map(|t| serde_json::from_str::<serde_json::Value>(&t)) {
        None => checks.push(check(
            "warn",
            format!("Pas de fiche {MANIFEST_NAME} à la racine : la CI ne pourra pas publier ce ZIP. Préparez-la ci-dessous."),
        )),
        Some(Err(e)) => checks.push(check("error", format!("{MANIFEST_NAME} est mal formé ({e})."))),
        Some(Ok(v)) => {
            has_manifest = true;
            let s = |k: &str| v.get(k).and_then(|x| x.as_str()).unwrap_or_default().to_string();
            manifest = WorkshopManifest {
                id: s("id"),
                name: s("name"),
                description: s("description"),
                version: s("version"),
                release_notes: s("releaseNotes"),
                executable: s("executable"),
            };
            let missing: Vec<&str> = [
                ("id", &manifest.id),
                ("name", &manifest.name),
                ("description", &manifest.description),
                ("version", &manifest.version),
                ("releaseNotes", &manifest.release_notes),
                ("executable", &manifest.executable),
            ]
            .iter()
            .filter(|(_, v)| v.trim().is_empty())
            .map(|(k, _)| *k)
            .collect();
            if missing.is_empty() {
                checks.push(check("ok", "Fiche complète."));
            } else {
                checks.push(check("error", format!("Champs manquants dans la fiche : {}.", missing.join(", "))));
            }
        }
    }
    let mut executables: Vec<String> =
        files.keys().filter(|f| f.to_ascii_lowercase().ends_with(".exe")).cloned().collect();
    executables.sort_by_key(|e| (e.matches('/').count(), e.len()));
    if manifest.executable.is_empty() {
        manifest.executable = executables.first().cloned().unwrap_or_default();
    }
    // L'exécutable désigné par la fiche suffit (un programme sans extension sur Linux, par exemple) ;
    // sans fiche, il faut au moins un .exe à proposer.
    if manifest.executable.is_empty() {
        checks.push(check("error", "Aucun fichier .exe dans le ZIP."));
    } else {
        match normalize_relative_path(&manifest.executable) {
            Ok(exe) if files.contains_key(&exe) => checks.push(check("ok", format!("Exécutable « {exe} » présent."))),
            _ => checks.push(check("error", format!("L'exécutable « {} » n'est pas dans le ZIP.", manifest.executable))),
        }
    }
    if !manifest.id.is_empty() && !is_valid_id(&manifest.id) {
        checks.push(check("error", format!("Identifiant « {} » invalide (minuscules, chiffres et tirets).", manifest.id)));
    }
    let new_version = semver::Version::parse(&manifest.version);
    if !manifest.version.is_empty() && new_version.is_err() {
        checks.push(check("error", format!("Version « {} » invalide (attendu : 1.2.3).", manifest.version)));
    }
    let unpacked: u64 = files.values().sum();

    let comparison = previous(&manifest.id).map(|(v, dir)| {
        let before = dir_listing(&dir);
        if let (Ok(old), Ok(new)) = (semver::Version::parse(&v), &new_version) {
            if new <= &old {
                checks.push(check("error", format!("La version {new} n'est pas plus récente que la {old} installée.")));
            } else {
                checks.push(check("ok", format!("Version {new} plus récente que la {old} installée.")));
            }
        }
        let mut c = Comparison {
            version: v,
            files_before: before.len() as u64,
            bytes_before: before.values().sum(),
            added: Vec::new(),
            removed: Vec::new(),
            grown: Vec::new(),
            changed: 0,
        };
        for (p, s) in &files {
            if p == MANIFEST_NAME {
                continue;
            }
            match before.get(p) {
                None => c.added.push(FileChange { path: p.clone(), before: None, after: Some(*s) }),
                Some(b) if b != s => {
                    c.changed += 1;
                    if *s > b + b / 2 && s - b >= 100 * 1024 {
                        c.grown.push(FileChange { path: p.clone(), before: Some(*b), after: Some(*s) });
                    }
                }
                _ => {}
            }
        }
        for (p, b) in &before {
            if !files.contains_key(p) && p != MANIFEST_NAME {
                c.removed.push(FileChange { path: p.clone(), before: Some(*b), after: None });
            }
        }
        if !c.removed.is_empty() {
            checks.push(check("warn", format!("{} fichier(s) de la version installée manquent dans ce ZIP : oubli ?", c.removed.len())));
        }
        if c.bytes_before > 0 && unpacked > c.bytes_before + c.bytes_before / 4 {
            checks.push(check(
                "warn",
                format!("Le paquet grossit de {} % par rapport à la version installée.", (unpacked - c.bytes_before) * 100 / c.bytes_before),
            ));
        }
        c
    });

    let mut largest: Vec<FileChange> =
        files.iter().map(|(p, s)| FileChange { path: p.clone(), before: None, after: Some(*s) }).collect();
    largest.sort_by(|a, b| b.after.cmp(&a.after));
    largest.truncate(8);
    let ready = !checks.iter().any(|c| c.level == "error") && has_manifest;
    Ok(WorkshopReport {
        zip_name: zip_path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
        zip_bytes,
        files: files.len() as u64,
        unpacked_bytes: unpacked,
        manifest,
        has_manifest,
        executables,
        largest,
        checks,
        comparison,
        ready,
    })
}
