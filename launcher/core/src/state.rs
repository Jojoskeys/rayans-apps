//! État local persistant : réglages, applications installées, dernier catalogue valide.

use crate::error::Result;
use crate::util::write_atomic;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

/// Arborescence du launcher. Les fichiers de version et les données utilisateur sont séparés :
///
/// ```text
/// <racine>/
///   settings.json          réglages (URL du catalogue)
///   installed.json         versions installées (pointeur vers le dossier actif)
///   catalog-cache.json     dernier catalogue valide (octets exacts + signature)
///   images/<id>-icon|image visuels mis en cache pour l'usage hors ligne
///   downloads/             ZIP en cours de téléchargement
///   apps/<id>/versions/<version>-<n>/   fichiers d'une version (remplaçables)
///   apps/<id>/staging-<n>/              préparation d'une version (jamais lancée)
///   data/<id>/             données utilisateur, conservées entre versions
///   backups/<id>/<n>/      sauvegardes datées des données (backup.json + data/)
///   profile.json           logiciels ajoutés à la main, espaces de travail, règles de mise à jour
///   history.jsonl          historique (installations, lancements, codes de sortie, erreurs…)
/// ```
#[derive(Clone, Debug)]
pub struct Paths {
    pub root: PathBuf,
}

impl Paths {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }
    pub fn settings(&self) -> PathBuf {
        self.root.join("settings.json")
    }
    pub fn installed(&self) -> PathBuf {
        self.root.join("installed.json")
    }
    pub fn catalog_cache(&self) -> PathBuf {
        self.root.join("catalog-cache.json")
    }
    pub fn images(&self) -> PathBuf {
        self.root.join("images")
    }
    pub fn downloads(&self) -> PathBuf {
        self.root.join("downloads")
    }
    pub fn app_dir(&self, id: &str) -> PathBuf {
        self.root.join("apps").join(id)
    }
    pub fn versions_dir(&self, id: &str) -> PathBuf {
        self.app_dir(id).join("versions")
    }
    pub fn lock_file(&self, id: &str) -> PathBuf {
        self.app_dir(id).join(".lock")
    }
    pub fn data_dir(&self, id: &str) -> PathBuf {
        self.root.join("data").join(id)
    }
    pub fn backups_dir(&self, id: &str) -> PathBuf {
        self.root.join("backups").join(id)
    }
    pub fn profile(&self) -> PathBuf {
        self.root.join("profile.json")
    }
    pub fn history(&self) -> PathBuf {
        self.root.join("history.jsonl")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub catalog_url: Option<String>,
}

/// Une version préparée et vérifiée, prête à être activée.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InstalledVersion {
    pub version: semver::Version,
    /// Nom du dossier sous `apps/<id>/versions/`.
    pub dir: String,
    pub executable: String,
    pub executable_sha256: String,
    pub archive_sha256: String,
    pub installed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InstalledApp {
    pub id: String,
    pub name: String,
    pub description: String,
    pub release_notes: String,
    pub current: InstalledVersion,
    /// Mise à jour prête, activée à la fermeture de l'application.
    #[serde(default)]
    pub pending: Option<InstalledVersion>,
    /// Version active juste avant, gardée sur le disque pour pouvoir y revenir.
    #[serde(default)]
    pub previous: Option<InstalledVersion>,
    /// Versions du catalogue ignorées jusqu'à celle-ci incluse (version épinglée le temps d'un correctif).
    #[serde(default)]
    pub held_version: Option<semver::Version>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct Installed {
    pub apps: BTreeMap<String, InstalledApp>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogCache {
    pub source_url: String,
    pub fetched_at: String,
    /// Octets exacts reçus (en UTF-8), pour pouvoir revérifier la signature au chargement.
    pub catalog_text: String,
    pub signature: Option<String>,
}

pub fn load_json<T: DeserializeOwned + Default>(path: &Path) -> Result<T> {
    match std::fs::read(path) {
        Ok(b) => serde_json::from_slice(&b)
            .map_err(|e| crate::Error::Io(format!("{} est illisible ({e})", path.display()))),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(T::default()),
        Err(e) => Err(e.into()),
    }
}

pub fn save_json<T: Serialize>(path: &Path, v: &T) -> Result<()> {
    let data = serde_json::to_vec_pretty(v).map_err(|e| crate::Error::Other(e.to_string()))?;
    write_atomic(path, &data)
}
