//! Sauvegardes datées des données d'une application (`data/<id>/`).
//!
//! ```text
//! backups/<id>/<AAAAMMJJ-HHMMSSmmm-xxxx>/
//!   backup.json   description (version, date, raison, taille) écrite en dernier
//!   data/         copie exacte du dossier de données
//! ```
//!
//! Une sauvegarde est préparée dans un dossier `.tmp-…` puis renommée : un dossier sans `backup.json`
//! n'est jamais proposé à la restauration et est supprimé au prochain nettoyage.

use crate::error::{Error, Result};
use crate::state::Paths;
use crate::util;
use serde::{Deserialize, Serialize};
use std::path::Path;

const META: &str = "backup.json";

/// Sauvegardes automatiques gardées par application ; les sauvegardes manuelles ne sont jamais supprimées seules.
pub const KEEP_AUTOMATIC: usize = 5;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub id: String,
    pub app_id: String,
    /// Version active au moment de la sauvegarde.
    pub version: Option<String>,
    pub created_at: String,
    /// "manual", "update" (avant une mise à jour), "restore" (avant une restauration), "rollback" (avant un retour)
    pub reason: String,
    pub size: u64,
    pub files: u64,
}

impl BackupInfo {
    pub fn automatic(&self) -> bool {
        self.reason != "manual"
    }
}

/// Identifiant de sauvegarde sûr (jamais de séparateur ni de « .. »).
pub fn is_valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

/// Nombre de fichiers et taille d'un dossier (les liens symboliques sont ignorés).
pub fn dir_stats(dir: &Path) -> (u64, u64) {
    let mut files = 0;
    let mut size = 0;
    let Ok(rd) = std::fs::read_dir(dir) else { return (0, 0) };
    for e in rd.flatten() {
        let Ok(m) = std::fs::symlink_metadata(e.path()) else { continue };
        if m.is_dir() {
            let (f, s) = dir_stats(&e.path());
            files += f;
            size += s;
        } else if m.is_file() {
            files += 1;
            size += m.len();
        }
    }
    (files, size)
}

/// Copie récursive. Les liens symboliques sont ignorés : une sauvegarde ne doit rien suivre hors du dossier.
pub fn copy_dir(src: &Path, dst: &Path) -> Result<()> {
    std::fs::create_dir_all(dst)?;
    for e in std::fs::read_dir(src)? {
        let e = e?;
        let m = std::fs::symlink_metadata(e.path())?;
        let to = dst.join(e.file_name());
        if m.is_dir() {
            copy_dir(&e.path(), &to)?;
        } else if m.is_file() {
            std::fs::copy(e.path(), &to).map_err(|err| {
                Error::Io(format!("{} n'a pas pu être copié ({err})", e.path().display()))
            })?;
        }
    }
    Ok(())
}

pub fn has_data(paths: &Paths, app_id: &str) -> bool {
    std::fs::read_dir(paths.data_dir(app_id)).is_ok_and(|mut rd| rd.next().is_some())
}

fn stamp() -> String {
    // Millisecondes comprises : l'ordre alphabétique des identifiants est l'ordre chronologique.
    let f = time::macros::format_description!("[year][month][day]-[hour][minute][second][subsecond digits:3]");
    time::OffsetDateTime::now_utc().format(&f).unwrap_or_default()
}

/// Copie `data/<id>/` dans une nouvelle sauvegarde.
pub fn create(paths: &Paths, app_id: &str, version: Option<String>, reason: &str) -> Result<BackupInfo> {
    let src = paths.data_dir(app_id);
    if !has_data(paths, app_id) {
        return Err(Error::Other("Cette application n'a encore aucune donnée à sauvegarder.".into()));
    }
    let root = paths.backups_dir(app_id);
    std::fs::create_dir_all(&root)?;
    let id = format!("{}-{}", stamp(), util::random_hex(2));
    let tmp = root.join(format!(".tmp-{id}"));
    let result = (|| {
        copy_dir(&src, &tmp.join("data"))?;
        let (files, size) = dir_stats(&tmp.join("data"));
        let info = BackupInfo {
            id: id.clone(),
            app_id: app_id.to_string(),
            version,
            created_at: util::now_rfc3339(),
            reason: reason.to_string(),
            size,
            files,
        };
        let json = serde_json::to_vec_pretty(&info).map_err(|e| Error::Other(e.to_string()))?;
        util::write_atomic(&tmp.join(META), &json)?;
        std::fs::rename(&tmp, root.join(&id))?;
        Ok(info)
    })();
    if result.is_err() {
        util::remove_dir_quiet(&tmp);
    }
    result
}

/// Sauvegardes complètes, la plus récente d'abord.
pub fn list(paths: &Paths, app_id: &str) -> Vec<BackupInfo> {
    let Ok(rd) = std::fs::read_dir(paths.backups_dir(app_id)) else { return Vec::new() };
    let mut out: Vec<BackupInfo> = rd
        .flatten()
        .filter(|e| is_valid_id(&e.file_name().to_string_lossy()))
        .filter_map(|e| std::fs::read(e.path().join(META)).ok())
        .filter_map(|b| serde_json::from_slice::<BackupInfo>(&b).ok())
        .filter(|b| b.app_id == app_id && is_valid_id(&b.id))
        .collect();
    out.sort_by(|a, b| b.id.cmp(&a.id));
    out
}

/// Garde les `keep` sauvegardes automatiques les plus récentes et supprime les préparations abandonnées.
pub fn prune(paths: &Paths, app_id: &str, keep: usize) {
    for b in list(paths, app_id).into_iter().filter(BackupInfo::automatic).skip(keep) {
        util::remove_dir_quiet(&paths.backups_dir(app_id).join(&b.id));
    }
    if let Ok(rd) = std::fs::read_dir(paths.backups_dir(app_id)) {
        for e in rd.flatten() {
            if e.file_name().to_string_lossy().starts_with(".tmp-") {
                util::remove_dir_quiet(&e.path());
            }
        }
    }
}

pub fn find(paths: &Paths, app_id: &str, backup_id: &str) -> Result<BackupInfo> {
    if !is_valid_id(backup_id) {
        return Err(Error::Other(format!("sauvegarde « {backup_id} » invalide")));
    }
    list(paths, app_id)
        .into_iter()
        .find(|b| b.id == backup_id)
        .ok_or_else(|| Error::Other("Cette sauvegarde n'existe plus.".into()))
}

pub fn delete(paths: &Paths, app_id: &str, backup_id: &str) -> Result<()> {
    let b = find(paths, app_id, backup_id)?;
    std::fs::remove_dir_all(paths.backups_dir(app_id).join(b.id))?;
    Ok(())
}

/// Remplace `data/<id>/` par le contenu de la sauvegarde. La copie est préparée à côté, puis échangée par
/// renommage : en cas d'échec, les données en place ne sont pas touchées.
pub fn restore(paths: &Paths, app_id: &str, backup_id: &str) -> Result<()> {
    let b = find(paths, app_id, backup_id)?;
    replace_data(paths, app_id, &paths.backups_dir(app_id).join(&b.id).join("data"))
}

/// Remplace `data/<id>/` par une copie de `src` (préparée à côté, puis échange de dossiers).
pub fn replace_data(paths: &Paths, app_id: &str, src: &Path) -> Result<()> {
    let data = paths.data_dir(app_id);
    let nonce = util::random_hex(4);
    let parent = data.parent().expect("data/<id> a un parent");
    std::fs::create_dir_all(parent)?;
    let fresh = parent.join(format!("{app_id}.restauration-{nonce}"));
    if let Err(e) = copy_dir(src, &fresh) {
        util::remove_dir_quiet(&fresh);
        return Err(e);
    }
    let old = parent.join(format!("{app_id}.ancien-{nonce}"));
    if data.exists() {
        if let Err(e) = std::fs::rename(&data, &old) {
            util::remove_dir_quiet(&fresh);
            return Err(Error::Io(format!(
                "les données actuelles sont en cours d'utilisation ({e}). Fermez l'application puis réessayez."
            )));
        }
    }
    if let Err(e) = std::fs::rename(&fresh, &data) {
        let _ = std::fs::rename(&old, &data);
        util::remove_dir_quiet(&fresh);
        return Err(e.into());
    }
    util::remove_dir_quiet(&old);
    Ok(())
}
