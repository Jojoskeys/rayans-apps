//! Export et migration : un seul ZIP avec les réglages, le profil (logiciels perso, espaces, règles de mise
//! à jour), les préférences d'affichage, la liste des applications installées et, au choix, leurs données.
//!
//! ```text
//! rayans-launcher-profil.json
//! data/<id>/...        données des applications choisies
//! ```

use crate::archive;
use crate::error::{Error, Result};
use crate::profile::Profile;
use crate::state::Paths;
use crate::util;
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::Path;

pub const MANIFEST: &str = "rayans-launcher-profil.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExportedApp {
    pub id: String,
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExportManifest {
    pub format: u32,
    pub exported_at: String,
    pub catalog_url: Option<String>,
    /// Préférences d'affichage de l'interface (thème, disposition…), telles quelles.
    #[serde(default)]
    pub prefs: Option<serde_json::Value>,
    pub profile: Profile,
    pub apps: Vec<ExportedApp>,
    /// Applications dont les données sont dans le ZIP.
    pub data: Vec<String>,
}

fn add_dir<W: Write + std::io::Seek>(zip: &mut zip::ZipWriter<W>, base: &Path, dir: &Path, prefix: &str) -> Result<()> {
    let opts = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .large_file(true);
    for e in std::fs::read_dir(dir)? {
        let e = e?;
        let m = std::fs::symlink_metadata(e.path())?;
        let rel = e.path().strip_prefix(base).map(|r| r.to_string_lossy().replace('\\', "/")).unwrap_or_default();
        if m.is_dir() {
            add_dir(zip, base, &e.path(), prefix)?;
        } else if m.is_file() {
            zip.start_file(format!("{prefix}{rel}"), opts).map_err(|e| Error::Io(e.to_string()))?;
            let mut f = std::fs::File::open(e.path())
                .map_err(|err| Error::Io(format!("{} illisible ({err})", e.path().display())))?;
            std::io::copy(&mut f, zip)?;
        }
    }
    Ok(())
}

/// Écrit le ZIP d'export (fichier temporaire puis renommage). Renvoie sa taille.
pub fn write(dest: &Path, manifest: &ExportManifest, paths: &Paths) -> Result<u64> {
    let tmp = dest.with_extension(format!("tmp-{}", util::random_hex(3)));
    let result = (|| {
        let mut zip = zip::ZipWriter::new(std::fs::File::create(&tmp)?);
        let opts = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        zip.start_file(MANIFEST, opts).map_err(|e| Error::Io(e.to_string()))?;
        zip.write_all(&serde_json::to_vec_pretty(manifest).map_err(|e| Error::Other(e.to_string()))?)?;
        for id in &manifest.data {
            let d = paths.data_dir(id);
            if d.is_dir() {
                add_dir(&mut zip, &d, &d, &format!("data/{id}/"))?;
            }
        }
        zip.finish().map_err(|e| Error::Io(e.to_string()))?;
        std::fs::rename(&tmp, dest)?;
        Ok(std::fs::metadata(dest)?.len())
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&tmp);
    }
    result
}

pub fn read_manifest(zip_path: &Path) -> Result<ExportManifest> {
    let f = std::fs::File::open(zip_path)?;
    let mut zip = zip::ZipArchive::new(f).map_err(|e| Error::BadArchive(format!("ce n'est pas un ZIP valide ({e})")))?;
    let entry = zip
        .by_name(MANIFEST)
        .map_err(|_| Error::BadArchive(format!("ce ZIP n'est pas un profil Rayan's Launcher ({MANIFEST} absent)")))?;
    let m: ExportManifest = serde_json::from_reader(entry)
        .map_err(|e| Error::BadArchive(format!("{MANIFEST} est illisible ({e})")))?;
    if m.format != 1 {
        return Err(Error::BadArchive(format!("format de profil {} inconnu : mettez le launcher à jour", m.format)));
    }
    crate::profile::validate(&m.profile)?;
    for id in m.data.iter().chain(m.apps.iter().map(|a| &a.id)) {
        if !crate::catalog::is_valid_id(id) {
            return Err(Error::BadArchive(format!("identifiant « {id} » invalide dans le profil")));
        }
    }
    Ok(m)
}

/// Extraction sûre de tout le ZIP (contrôles habituels : chemins, liens, taille).
pub fn extract(zip_path: &Path, dest: &Path) -> Result<()> {
    archive::extract_zip(zip_path, dest, |_, _| {})
}
