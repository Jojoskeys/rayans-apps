//! Catalogue local (un fichier `catalog.json` sur le disque) : création au premier démarrage, ajout d'une
//! application à partir d'un ZIP, et dossier « À ajouter » importé automatiquement.
//!
//! Disposition du dossier du catalogue :
//!   catalog.json          le catalogue lu par le launcher (adresse file://)
//!   zips/<id>-<version>.zip
//!   images/<id>-icon.svg, images/<id>-image.svg   (créées si l'application n'en a pas)
//!   À ajouter/            tout ZIP déposé ici est ajouté au prochain démarrage ou à la prochaine actualisation

use crate::catalog::{self, is_valid_id, normalize_relative_path, TrustPolicy};
use crate::error::{Error, Result};
use crate::util;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::io::Read;
use std::path::{Path, PathBuf};
use url::Url;

/// Fichier facultatif à la racine d'un ZIP qui décrit l'application (écrit par la CI d'Analyse Échecs).
pub const MANIFEST_NAME: &str = "rayans-launcher.json";
pub const DROP_DIR: &str = "À ajouter";
const MAX_MANIFEST_BYTES: u64 = 64 * 1024;

/// Ce que le launcher propose d'écrire au catalogue pour un ZIP. L'utilisateur peut tout modifier.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ZipEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub release_notes: String,
    pub executable: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ZipProposal {
    pub entry: ZipEntry,
    /// Exécutables trouvés dans le ZIP (le premier est proposé).
    pub executables: Vec<String>,
    /// « manifeste » (fichier rayans-launcher.json), « modèle » (application connue) ou « deviné ».
    pub source: String,
    /// Version déjà présente au catalogue pour cet identifiant.
    pub existing_version: Option<String>,
    /// Tous les champs sont remplis : un import sans question est possible.
    pub complete: bool,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct Manifest {
    id: Option<String>,
    name: Option<String>,
    description: Option<String>,
    version: Option<String>,
    release_notes: Option<String>,
    executable: Option<String>,
}

// ----- Création --------------------------------------------------------------------------------

/// Crée le dossier et un catalogue vide s'ils n'existent pas. Renvoie le chemin de `catalog.json`.
pub fn ensure_local_catalog(dir: &Path) -> Result<PathBuf> {
    std::fs::create_dir_all(dir.join(DROP_DIR))?;
    let path = dir.join("catalog.json");
    if !path.exists() {
        let doc = json!({ "schemaVersion": 1, "title": "Mes applications", "apps": [] });
        util::write_atomic(&path, (serde_json::to_string_pretty(&doc).unwrap() + "\n").as_bytes())?;
    }
    Ok(path)
}

/// Chemin du fichier si l'adresse du catalogue est locale (file://).
pub fn catalog_file(url: &str) -> Option<PathBuf> {
    let u = Url::parse(url).ok()?;
    (u.scheme() == "file").then(|| u.to_file_path().ok()).flatten()
}

pub fn file_url(path: &Path) -> Result<String> {
    Url::from_file_path(path)
        .map(|u| u.to_string())
        .map_err(|_| Error::Other(format!("chemin non absolu : {}", path.display())))
}

// ----- Lecture d'un ZIP ------------------------------------------------------------------------

struct ZipInfo {
    executables: Vec<String>,
    inner_zips: Vec<String>,
    manifest: Option<Manifest>,
}

fn read_zip(path: &Path) -> Result<ZipInfo> {
    let file = std::fs::File::open(path)?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|e| Error::BadArchive(format!("« {} » n'est pas un ZIP valide ({e})", path.display())))?;
    let mut executables = Vec::new();
    let mut inner_zips = Vec::new();
    let mut manifest = None;
    for i in 0..zip.len() {
        let mut entry = zip
            .by_index(i)
            .map_err(|e| Error::BadArchive(format!("entrée n°{i} illisible ({e})")))?;
        if entry.is_dir() {
            continue;
        }
        let Ok(name) = normalize_relative_path(entry.name()) else { continue };
        let lower = name.to_ascii_lowercase();
        if name == MANIFEST_NAME && entry.size() <= MAX_MANIFEST_BYTES {
            let mut s = String::new();
            entry.read_to_string(&mut s)?;
            let s = s.trim_start_matches('\u{feff}');
            manifest = Some(serde_json::from_str(s).map_err(|e| {
                Error::BadArchive(format!("{MANIFEST_NAME} mal formé ({e})"))
            })?);
        } else if (lower.ends_with(".exe") || (!cfg!(windows) && entry.unix_mode().is_some_and(|m| m & 0o111 != 0)))
            && !is_helper_exe(&lower)
        {
            executables.push(name);
        } else if lower.ends_with(".zip") {
            inner_zips.push(name);
        }
    }
    // Les exécutables les moins profonds d'abord : l'application est en général à la racine.
    executables.sort_by_key(|e| (e.matches('/').count(), e.len()));
    Ok(ZipInfo { executables, inner_zips, manifest })
}

/// Programmes annexes qu'on ne propose jamais comme exécutable principal.
fn is_helper_exe(lower: &str) -> bool {
    let file = lower.rsplit('/').next().unwrap_or(lower);
    file.starts_with("unins")
        || file.contains("crashpad")
        || file.contains("elevate")
        || file == "stockfish.exe"
        || lower.starts_with("resources/")
        || lower.contains("/resources/")
}

/// Un ZIP de « téléchargement d'artefact » GitHub contient le vrai ZIP : on l'extrait à côté.
/// Renvoie le ZIP à utiliser (l'original, ou une copie temporaire du ZIP intérieur).
fn unwrap_zip(path: &Path, tmp_dir: &Path) -> Result<(PathBuf, ZipInfo, bool)> {
    let info = read_zip(path)?;
    if !info.executables.is_empty() || info.inner_zips.len() != 1 {
        return Ok((path.to_path_buf(), info, false));
    }
    let inner_name = info.inner_zips[0].clone();
    let file = std::fs::File::open(path)?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| Error::BadArchive(e.to_string()))?;
    let mut entry = zip.by_name(&inner_name).map_err(|e| Error::BadArchive(e.to_string()))?;
    std::fs::create_dir_all(tmp_dir)?;
    let base = inner_name.rsplit('/').next().unwrap_or(&inner_name);
    let out = tmp_dir.join(format!(".{}-{base}", util::random_hex(6)));
    let mut f = std::fs::File::create(&out)?;
    std::io::copy(&mut entry, &mut f)?;
    drop(f);
    let inner = read_zip(&out)?;
    Ok((out, inner, true))
}

/// Applications connues, reconnues même sans manifeste (anciens ZIP de la CI).
fn preset(file_name: &str, executables: &[String]) -> Option<ZipEntry> {
    let lower = file_name.to_ascii_lowercase();
    let chess = lower.starts_with("analyse-echecs") || executables.iter().any(|e| e == "Analyse Echecs.exe");
    if !chess {
        return None;
    }
    Some(ZipEntry {
        id: "analyse-echecs".into(),
        name: "Rayan's Échecs".into(),
        description: "Analyse de parties d'échecs avec un moteur intégré.".into(),
        version: version_in_name(file_name).unwrap_or_default(),
        release_notes: String::new(),
        executable: if executables.iter().any(|e| e == "Analyse Echecs.exe") {
            "Analyse Echecs.exe".into()
        } else {
            executables.first().cloned().unwrap_or_default()
        },
    })
}

/// Cherche « 1.2.3 » dans un nom de fichier.
fn version_in_name(name: &str) -> Option<String> {
    let b = name.as_bytes();
    for start in 0..b.len() {
        if !b[start].is_ascii_digit() || (start > 0 && (b[start - 1].is_ascii_digit() || b[start - 1] == b'.')) {
            continue;
        }
        let mut end = start;
        while end < b.len() && (b[end].is_ascii_digit() || b[end] == b'.') {
            end += 1;
        }
        let cand = name[start..end].trim_end_matches('.');
        if let Ok(v) = semver::Version::parse(cand) {
            return Some(v.to_string());
        }
    }
    None
}

fn slug(s: &str) -> String {
    let mut out = String::new();
    for c in s.chars() {
        let c = match c {
            'à' | 'â' | 'ä' | 'À' | 'Â' => 'a',
            'é' | 'è' | 'ê' | 'ë' | 'É' | 'È' => 'e',
            'î' | 'ï' => 'i',
            'ô' | 'ö' => 'o',
            'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            c => c.to_ascii_lowercase(),
        };
        if c.is_ascii_lowercase() || c.is_ascii_digit() {
            out.push(c);
        } else if !out.ends_with('-') && !out.is_empty() {
            out.push('-');
        }
    }
    let out = out.trim_end_matches('-').chars().take(64).collect::<String>();
    if out.len() < 2 { format!("app-{out}") } else { out }
}

fn title_from(file_stem: &str) -> String {
    let words: Vec<&str> = file_stem
        .split(['-', '_', ' ', '.'])
        .filter(|w| !w.is_empty() && !w.chars().next().unwrap().is_ascii_digit())
        .filter(|w| !matches!(w.to_ascii_lowercase().as_str(), "windows" | "win" | "x64" | "x86" | "win64" | "portable" | "setup"))
        .collect();
    if words.is_empty() { file_stem.to_string() } else { words.join(" ") }
}

/// Examine un ZIP et propose une entrée de catalogue.
pub fn inspect_zip(zip_path: &Path, catalog_path: &Path) -> Result<ZipProposal> {
    let tmp = catalog_path.parent().unwrap_or(Path::new(".")).join("zips");
    let (used, info, temp) = unwrap_zip(zip_path, &tmp)?;
    let file_name = zip_path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    let shown_name = if temp {
        used.file_name().unwrap().to_string_lossy().split_once('-').map(|x| x.1.to_string()).unwrap_or_default()
    } else {
        file_name.clone()
    };
    let result = propose(&shown_name, &info, catalog_path);
    if temp {
        let _ = std::fs::remove_file(&used);
    }
    result
}

fn propose(file_name: &str, info: &ZipInfo, catalog_path: &Path) -> Result<ZipProposal> {
    if info.executables.is_empty() {
        return Err(Error::MissingExecutable(format!(
            "aucun fichier .exe dans « {file_name} »"
        )));
    }
    let stem = file_name.trim_end_matches(".zip").trim_end_matches(".ZIP");
    let (mut entry, source) = if let Some(m) = &info.manifest {
        let e = ZipEntry {
            id: m.id.clone().unwrap_or_default(),
            name: m.name.clone().unwrap_or_default(),
            description: m.description.clone().unwrap_or_default(),
            version: m.version.clone().unwrap_or_default(),
            release_notes: m.release_notes.clone().unwrap_or_default(),
            executable: m.executable.clone().unwrap_or_default(),
        };
        (e, "manifeste")
    } else if let Some(e) = preset(file_name, &info.executables) {
        (e, "modèle")
    } else {
        let name = title_from(stem);
        let e = ZipEntry {
            id: slug(&name),
            name,
            description: String::new(),
            version: version_in_name(file_name).unwrap_or_default(),
            release_notes: String::new(),
            executable: info.executables[0].clone(),
        };
        (e, "deviné")
    };
    if entry.executable.is_empty() {
        entry.executable = info.executables[0].clone();
    }
    // Ce que le catalogue sait déjà de cette application complète la proposition.
    let existing = existing_app(catalog_path, &entry.id);
    let mut existing_version = None;
    if let Some(app) = &existing {
        existing_version = app.get("version").and_then(Value::as_str).map(str::to_string);
        for (field, key) in [("name", &mut entry.name), ("description", &mut entry.description)] {
            // Le nom et la description déjà choisis au catalogue gardent la priorité.
            {
                if let Some(v) = app.get(field).and_then(Value::as_str) {
                    *key = v.to_string();
                }
            }
        }
    }
    if entry.release_notes.is_empty() && !entry.version.is_empty() {
        entry.release_notes = format!("Version {}.", entry.version);
    }
    if entry.description.is_empty() && source == "deviné" {
        entry.description = format!("{}, ajoutée depuis un ZIP.", entry.name);
    }
    let complete = validate_entry(&entry, &info.executables).is_ok()
        && existing_version.as_deref() != Some(entry.version.as_str());
    Ok(ZipProposal {
        entry,
        executables: info.executables.clone(),
        source: source.into(),
        existing_version,
        complete,
    })
}

fn existing_app(catalog_path: &Path, id: &str) -> Option<Value> {
    let doc: Value = serde_json::from_str(read_text(catalog_path).ok()?.as_str()).ok()?;
    doc.get("apps")?
        .as_array()?
        .iter()
        .find(|a| a.get("id").and_then(Value::as_str) == Some(id))
        .cloned()
}

fn read_text(p: &Path) -> Result<String> {
    let bytes = std::fs::read(p)?;
    let bytes = bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(&bytes);
    String::from_utf8(bytes.to_vec()).map_err(|_| Error::InvalidCatalog("le fichier n'est pas en UTF-8".into()))
}

fn validate_entry(e: &ZipEntry, executables: &[String]) -> Result<()> {
    let bad = |m: String| Err(Error::Other(m));
    if !is_valid_id(&e.id) {
        return bad(format!(
            "identifiant « {} » invalide : 2 à 64 caractères a-z, 0-9, « - » ou « _ »",
            e.id
        ));
    }
    for (v, what) in [(&e.name, "le nom"), (&e.description, "la description"), (&e.release_notes, "les notes de version")] {
        if v.trim().is_empty() {
            return bad(format!("{what} est vide"));
        }
    }
    if semver::Version::parse(e.version.trim()).is_err() {
        return bad(format!("version « {} » invalide : format attendu 1.2.3", e.version));
    }
    if !executables.iter().any(|x| x == &e.executable) {
        return bad(format!("« {} » n'est pas dans le ZIP", e.executable));
    }
    Ok(())
}

// ----- Écriture ----------------------------------------------------------------------------------

/// Copie le ZIP dans `zips/`, crée des images si besoin et écrit l'entrée dans `catalog.json`.
/// Le catalogue n'est remplacé que si le résultat est valide. Renvoie l'identifiant ajouté.
pub fn add_zip(catalog_path: &Path, zip_path: &Path, entry: &ZipEntry) -> Result<String> {
    let dir = catalog_path
        .parent()
        .ok_or_else(|| Error::Other("dossier du catalogue introuvable".into()))?
        .to_path_buf();
    if dir.join("catalog.json.sig").exists() || catalog_path.with_extension("json.sig").exists() {
        return Err(Error::Signature(
            "ce catalogue est signé : un ajout ici casserait la signature. Utilisez « hangar-tools publish » puis re-signez".into(),
        ));
    }
    let zips = dir.join("zips");
    let (used, info, temp) = unwrap_zip(zip_path, &zips)?;
    let cleanup = |r: Result<String>| {
        if temp {
            let _ = std::fs::remove_file(&used);
        }
        r
    };
    let mut e = entry.clone();
    e.version = e.version.trim().to_string();
    e.id = e.id.trim().to_string();
    if let Err(err) = validate_entry(&e, &info.executables) {
        return cleanup(Err(err));
    }
    let version = semver::Version::parse(&e.version).unwrap();
    cleanup(write_entry(catalog_path, &dir, &used, &e, &version))
}

fn write_entry(catalog_path: &Path, dir: &Path, zip: &Path, e: &ZipEntry, version: &semver::Version) -> Result<String> {
    let text = read_text(catalog_path)?;
    let mut doc: Value = serde_json::from_str(&text)
        .map_err(|err| Error::InvalidCatalog(format!("JSON mal formé ({err})")))?;
    let apps = doc
        .get_mut("apps")
        .and_then(Value::as_array_mut)
        .ok_or_else(|| Error::InvalidCatalog("le catalogue n'a pas de tableau « apps »".into()))?;
    let idx = apps.iter().position(|a| a.get("id").and_then(Value::as_str) == Some(e.id.as_str()));
    if let Some(i) = idx {
        if let Some(old) = apps[i].get("version").and_then(Value::as_str).and_then(|v| semver::Version::parse(v).ok()) {
            if &old >= version {
                return Err(Error::Other(format!(
                    "le catalogue contient déjà « {} » en version {old} : choisissez une version plus grande que {old}",
                    e.id
                )));
            }
        }
    }

    let sha = util::sha256_file(zip)?;
    let size = std::fs::metadata(zip)?.len();
    let zips = dir.join("zips");
    std::fs::create_dir_all(&zips)?;
    let zip_name = format!("{}-{}.zip", e.id, version);
    let dest = zips.join(&zip_name);
    let tmp = zips.join(format!(".{}.tmp", util::random_hex(6)));
    std::fs::copy(zip, &tmp)?;
    std::fs::rename(&tmp, &dest)?;

    let entry = match idx {
        Some(i) => apps[i].as_object_mut().unwrap(),
        None => {
            apps.push(Value::Object(Map::new()));
            apps.last_mut().unwrap().as_object_mut().unwrap()
        }
    };
    entry.insert("id".into(), json!(e.id));
    entry.insert("name".into(), json!(e.name.trim()));
    entry.insert("description".into(), json!(e.description.trim()));
    for (key, kind) in [("icon", "icon"), ("image", "image")] {
        let has = entry.get(key).and_then(Value::as_str).is_some_and(|s| !s.trim().is_empty());
        if !has {
            entry.insert(key.into(), json!(write_placeholder(dir, &e.id, &e.name, kind)?));
        }
    }
    entry.insert("version".into(), json!(version.to_string()));
    entry.insert("releaseNotes".into(), json!(e.release_notes.trim()));
    entry.insert("releaseDate".into(), json!(util::now_rfc3339()[..10].to_string()));
    entry.insert("downloadUrl".into(), json!(format!("zips/{zip_name}")));
    entry.insert("sha256".into(), json!(sha));
    entry.insert("size".into(), json!(size));
    entry.insert("executable".into(), json!(e.executable));

    let out = serde_json::to_string_pretty(&doc).unwrap() + "\n";
    // Contrôle avec les règles du launcher avant de remplacer le fichier.
    let base = Url::from_file_path(catalog_path)
        .map_err(|_| Error::Other("chemin du catalogue non absolu".into()))?;
    catalog::parse_and_validate(out.as_bytes(), &base, &TrustPolicy::Development { public_key: None })?;
    util::write_atomic(catalog_path, out.as_bytes())?;
    // Anciennes versions du même ZIP : inutiles une fois le catalogue à jour.
    if let Ok(rd) = std::fs::read_dir(&zips) {
        for f in rd.flatten() {
            let n = f.file_name().to_string_lossy().to_string();
            if n != zip_name && n.starts_with(&format!("{}-", e.id)) && n.ends_with(".zip")
                && version_in_name(&n[e.id.len()..]).is_some()
            {
                let _ = std::fs::remove_file(f.path());
            }
        }
    }
    Ok(e.id.clone())
}

/// Image simple (initiale sur fond graphite et ambre) pour une application sans visuel.
fn write_placeholder(dir: &Path, id: &str, name: &str, kind: &str) -> Result<String> {
    let images = dir.join("images");
    std::fs::create_dir_all(&images)?;
    let initial: String = name.trim().chars().find(|c| c.is_alphanumeric()).map(|c| c.to_uppercase().collect()).unwrap_or_else(|| "?".into());
    let initial = initial.replace('&', "&amp;").replace('<', "&lt;");
    let svg = if kind == "icon" {
        format!(r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#2a2d33"/><text x="64" y="86" font-family="Segoe UI, Arial, sans-serif" font-size="64" font-weight="700" text-anchor="middle" fill="#f0a63c">{initial}</text></svg>"##)
    } else {
        format!(r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><rect width="640" height="360" fill="#1f2126"/><circle cx="520" cy="80" r="160" fill="#2a2d33"/><text x="320" y="225" font-family="Segoe UI, Arial, sans-serif" font-size="150" font-weight="700" text-anchor="middle" fill="#f0a63c">{initial}</text></svg>"##)
    };
    let file = format!("{id}-{kind}.svg");
    util::write_atomic(&images.join(&file), svg.as_bytes())?;
    Ok(format!("images/{file}"))
}

// ----- Dossier « À ajouter » -----------------------------------------------------------------------

/// Ajoute chaque ZIP du dossier « À ajouter » qui se décrit entièrement (manifeste ou application connue).
/// Un ZIP ajouté est supprimé du dossier ; un ZIP refusé reste et le message explique pourquoi.
pub fn import_drop_folder(catalog_path: &Path) -> Vec<String> {
    let Some(dir) = catalog_path.parent() else { return vec![] };
    let drop = dir.join(DROP_DIR);
    // Catalogue local créé à la main (ex. C:\MesApps) : le dossier apparaît à la première actualisation.
    let _ = std::fs::create_dir_all(&drop);
    let Ok(rd) = std::fs::read_dir(&drop) else { return vec![] };
    let mut files: Vec<PathBuf> = rd
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.is_file() && p.extension().is_some_and(|x| x.eq_ignore_ascii_case("zip")))
        .collect();
    files.sort();
    let mut messages = Vec::new();
    for f in files {
        let name = f.file_name().unwrap().to_string_lossy().to_string();
        let r = inspect_zip(&f, catalog_path).and_then(|p| {
            if p.existing_version.as_deref() == Some(p.entry.version.as_str()) {
                return Ok(None); // déjà au catalogue : rien à faire
            }
            if !p.complete {
                return Err(Error::Other(
                    "informations incomplètes : utilisez le bouton « Ajouter un ZIP »".into(),
                ));
            }
            add_zip(catalog_path, &f, &p.entry).map(|id| Some((id, p.entry.version)))
        });
        match r {
            Ok(Some((id, v))) => {
                let _ = std::fs::remove_file(&f);
                messages.push(format!("{name} ajouté au catalogue ({id} {v})."));
            }
            Ok(None) => {
                let _ = std::fs::remove_file(&f);
            }
            Err(e) => messages.push(format!("{name} non ajouté : {e}")),
        }
    }
    messages
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn make_zip(path: &Path, files: &[(&str, &[u8])]) {
        let f = std::fs::File::create(path).unwrap();
        let mut z = zip::ZipWriter::new(f);
        let o = zip::write::SimpleFileOptions::default();
        for (n, b) in files {
            z.start_file(*n, o).unwrap();
            z.write_all(b).unwrap();
        }
        z.finish().unwrap();
    }

    #[test]
    fn version_dans_un_nom() {
        assert_eq!(version_in_name("Analyse-Echecs-1.0.0-Windows-x64.zip").as_deref(), Some("1.0.0"));
        assert_eq!(version_in_name("app-v2.3.10.zip").as_deref(), Some("2.3.10"));
        assert_eq!(version_in_name("app.zip"), None);
    }

    #[test]
    fn ajout_puis_mise_a_jour_et_depot() {
        let d = tempfile::tempdir().unwrap();
        let cat = ensure_local_catalog(&d.path().join("Rayan's Launcher")).unwrap();
        let src = d.path().join("Mon-Outil-1.2.0-Windows-x64.zip");
        make_zip(&src, &[("Mon Outil.exe", b"MZ1"), ("resources/aide.exe", b"MZ"), ("lisezmoi.txt", b"x")]);
        let p = inspect_zip(&src, &cat).unwrap();
        assert_eq!(p.source, "deviné");
        assert_eq!(p.entry.id, "mon-outil");
        assert_eq!(p.entry.version, "1.2.0");
        assert_eq!(p.executables, vec!["Mon Outil.exe".to_string()]);
        assert!(p.complete);
        add_zip(&cat, &src, &p.entry).unwrap();
        let base = Url::from_file_path(&cat).unwrap();
        let policy = TrustPolicy::Development { public_key: None };
        let c = catalog::parse_and_validate(&std::fs::read(&cat).unwrap(), &base, &policy).unwrap();
        assert_eq!(c.apps[0].version.to_string(), "1.2.0");
        assert_eq!(c.apps[0].sha256, util::sha256_file(&src).unwrap());
        // Même version : refusée.
        assert!(add_zip(&cat, &src, &p.entry).is_err());

        // ZIP d'artefact GitHub (ZIP dans un ZIP) avec manifeste, déposé dans « À ajouter ».
        let inner = d.path().join("inner.zip");
        let manifest = br#"{"id":"mon-outil","version":"1.3.0","releaseNotes":"CI 7.","executable":"Mon Outil.exe"}"#;
        make_zip(&inner, &[("Mon Outil.exe", b"MZ2"), (MANIFEST_NAME, manifest)]);
        let outer = cat.parent().unwrap().join(DROP_DIR).join("artefact.zip");
        make_zip(&outer, &[("Mon-Outil-1.3.0.zip", &std::fs::read(&inner).unwrap())]);
        let msgs = import_drop_folder(&cat);
        assert_eq!(msgs.len(), 1, "{msgs:?}");
        assert!(!outer.exists());
        let c = catalog::parse_and_validate(&std::fs::read(&cat).unwrap(), &base, &policy).unwrap();
        assert_eq!(c.apps.len(), 1);
        assert_eq!(c.apps[0].version.to_string(), "1.3.0");
        assert_eq!(c.apps[0].name, "Mon Outil");
        assert_eq!(c.apps[0].release_notes, "CI 7.");
        let zips: Vec<_> = std::fs::read_dir(cat.parent().unwrap().join("zips")).unwrap().flatten().collect();
        assert_eq!(zips.len(), 1, "ancienne version et fichiers temporaires supprimés");
    }

    #[test]
    fn modele_analyse_echecs() {
        let d = tempfile::tempdir().unwrap();
        let cat = ensure_local_catalog(d.path()).unwrap();
        let src = d.path().join("Analyse-Echecs-1.0.0-Windows-x64.zip");
        make_zip(&src, &[("Analyse Echecs.exe", b"MZ"), ("resources/stockfish/stockfish.exe", b"MZ")]);
        let p = inspect_zip(&src, &cat).unwrap();
        assert_eq!(p.source, "modèle");
        assert_eq!(p.entry.id, "analyse-echecs");
        assert_eq!(p.entry.executable, "Analyse Echecs.exe");
        assert!(p.complete);
    }
}
