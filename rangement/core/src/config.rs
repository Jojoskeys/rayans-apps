//! Réglages : dossiers surveillés, règles, doublons, mode automatique.

use crate::error::{Error, Result};
use serde::{Deserialize, Serialize};
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Config {
    /// Dossiers dont les fichiers (premier niveau seulement) sont rangés.
    pub watched: Vec<PathBuf>,
    /// Règles, dans l'ordre : la première qui correspond l'emporte.
    pub rules: Vec<Rule>,
    /// Détecter les doublons (contenu identique) et les mettre en quarantaine.
    pub duplicates: bool,
    /// Dossier de quarantaine des doublons (jamais de suppression).
    pub quarantine_dir: PathBuf,
    /// Les fichiers modifiés depuis moins de N minutes sont laissés en place (téléchargement en cours…).
    pub ignore_recent_minutes: u32,
    pub auto: AutoConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct AutoConfig {
    /// Désactivé par défaut. Même activé, le mode automatique ne fait que *préparer* un aperçu :
    /// rien n'est déplacé sans validation.
    pub enabled: bool,
    pub mode: AutoMode,
    pub interval_minutes: u32,
}

impl Default for AutoConfig {
    fn default() -> Self {
        AutoConfig { enabled: false, mode: AutoMode::Surveillance, interval_minutes: 60 }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AutoMode {
    /// Dès que des fichiers apparaissent (après un temps de calme).
    Surveillance,
    /// À intervalle régulier.
    Intervalle,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Rule {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    /// Extensions sans point (« pdf », « jpg »…), sans tenir compte des majuscules. Vide = toutes.
    pub extensions: Vec<String>,
    /// Modèle de nom avec * et ?, plusieurs modèles séparés par « ; ». Vide = tous les noms.
    pub name_pattern: String,
    /// Seulement les fichiers modifiés il y a plus de N jours.
    pub older_than_days: Option<u32>,
    /// Taille minimale / maximale en octets.
    pub min_size: Option<u64>,
    pub max_size: Option<u64>,
    /// Dossiers surveillés où la règle s'applique. Vide = tous.
    pub folders: Vec<PathBuf>,
    /// Dossier de destination : relatif au dossier surveillé (« Images ») ou absolu.
    /// Jetons possibles : {annee}, {mois}.
    pub target: String,
}

impl Default for Rule {
    fn default() -> Self {
        Rule {
            id: String::new(),
            name: String::new(),
            enabled: true,
            extensions: Vec::new(),
            name_pattern: String::new(),
            older_than_days: None,
            min_size: None,
            max_size: None,
            folders: Vec::new(),
            target: String::new(),
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Config {
            watched: Vec::new(),
            rules: default_rules(None),
            duplicates: true,
            quarantine_dir: PathBuf::new(),
            ignore_recent_minutes: 2,
            auto: AutoConfig::default(),
        }
    }
}

impl Config {
    /// Réglages du premier démarrage : Téléchargements et Bureau, rangement en sous-dossiers sur place.
    pub fn first_run(downloads: Option<PathBuf>, desktop: Option<PathBuf>, quarantine_dir: PathBuf) -> Config {
        let rules = default_rules(downloads.as_deref());
        Config {
            watched: downloads.into_iter().chain(desktop).collect(),
            rules,
            quarantine_dir,
            ..Config::default()
        }
    }

    /// Vérifie les réglages avant toute analyse. Le message est destiné à l'utilisateur.
    pub fn validate(&self) -> Result<()> {
        let bad = |m: String| Err(Error::Invalid(m));
        for w in &self.watched {
            if !w.is_absolute() {
                return bad(format!("Le dossier surveillé « {} » doit être un chemin complet.", w.display()));
            }
        }
        if self.duplicates && !self.quarantine_dir.is_absolute() {
            return bad("Choisissez un dossier de quarantaine pour les doublons (chemin complet).".into());
        }
        for r in self.rules.iter().filter(|r| r.enabled) {
            let label = if r.name.trim().is_empty() { "sans nom" } else { r.name.trim() };
            if r.target.trim().is_empty() {
                return bad(format!("La règle « {label} » n'a pas de dossier de destination."));
            }
            if Path::new(r.target.trim()).components().any(|c| matches!(c, Component::ParentDir)) {
                return bad(format!("La destination de la règle « {label} » ne doit pas contenir « .. »."));
            }
            let has_condition = r.extensions.iter().any(|e| !e.trim().is_empty())
                || !r.name_pattern.trim().is_empty()
                || r.older_than_days.is_some()
                || r.min_size.is_some()
                || r.max_size.is_some();
            if !has_condition {
                return bad(format!(
                    "La règle « {label} » n'a aucune condition : elle rangerait tous les fichiers. Ajoutez une extension, un nom, un âge ou une taille."
                ));
            }
            if let (Some(a), Some(b)) = (r.min_size, r.max_size) {
                if a > b {
                    return bad(format!("La règle « {label} » a une taille minimale supérieure à la taille maximale."));
                }
            }
        }
        Ok(())
    }
}

fn rule(id: &str, name: &str, exts: &[&str], target: &str) -> Rule {
    Rule {
        id: id.into(),
        name: name.into(),
        extensions: exts.iter().map(|s| s.to_string()).collect(),
        target: target.into(),
        ..Rule::default()
    }
}

/// Règles proposées au premier démarrage (sous-dossiers du dossier surveillé).
/// Les installateurs ne sont rangés que dans Téléchargements : sur le Bureau, un .exe est souvent un
/// programme portable qu'il ne faut pas déplacer.
pub fn default_rules(downloads: Option<&Path>) -> Vec<Rule> {
    let mut installers = rule("installateurs", "Installateurs", &["exe", "msi", "msix", "appx"], "Installateurs");
    installers.folders = downloads.map(|d| vec![d.to_path_buf()]).unwrap_or_default();
    installers.enabled = downloads.is_some();
    vec![
        rule("images", "Images", &["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif", "svg", "tif", "tiff", "avif"], "Images"),
        rule(
            "documents",
            "Documents",
            &["pdf", "doc", "docx", "odt", "rtf", "txt", "md", "xls", "xlsx", "ods", "csv", "ppt", "pptx", "odp", "epub"],
            "Documents",
        ),
        rule("videos", "Vidéos", &["mp4", "mkv", "avi", "mov", "wmv", "webm", "m4v"], "Vidéos"),
        rule("musique", "Musique", &["mp3", "wav", "flac", "aac", "ogg", "m4a", "wma", "opus"], "Musique"),
        rule("archives", "Archives", &["zip", "rar", "7z", "tar", "gz", "bz2", "xz"], "Archives"),
        installers,
    ]
}
