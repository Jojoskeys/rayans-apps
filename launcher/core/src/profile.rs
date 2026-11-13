//! Profil de l'utilisateur, indépendant du catalogue : logiciels ajoutés à la main, espaces de travail et
//! règles de mise à jour. Enregistré dans `profile.json`, exporté avec le profil complet.

use crate::error::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Logiciel ajouté à la main : programme Windows, application portable, raccourci web ou dossier.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PersonalApp {
    /// « p-… », distinct des identifiants du catalogue.
    pub id: String,
    pub name: String,
    /// "program" (exécutable ou raccourci), "web" (adresse http/https), "folder"
    pub kind: String,
    /// Chemin ou adresse.
    pub target: String,
    #[serde(default)]
    pub args: String,
    pub added_at: String,
}

/// Un élément d'espace de travail : application du catalogue, logiciel perso, dossier ou adresse web.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceItem {
    /// "app", "personal", "folder", "url"
    pub kind: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    pub name: String,
    /// Couleur d'accent de la tuile (#rrggbb).
    #[serde(default)]
    pub color: String,
    pub items: Vec<WorkspaceItem>,
}

/// "ask" : la mise à jour est proposée ; "auto" : installée seule quand l'application est fermée.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRules {
    pub default_rule: String,
    #[serde(default)]
    pub per_app: BTreeMap<String, String>,
    /// Pause générale : aucune mise à jour automatique.
    #[serde(default)]
    pub paused: bool,
}

impl Default for UpdateRules {
    fn default() -> Self {
        Self { default_rule: "ask".into(), per_app: BTreeMap::new(), paused: false }
    }
}

impl UpdateRules {
    pub fn rule_for(&self, id: &str) -> &str {
        self.per_app.get(id).map(String::as_str).unwrap_or(&self.default_rule)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    #[serde(default)]
    pub personal: Vec<PersonalApp>,
    #[serde(default)]
    pub workspaces: Vec<Workspace>,
    #[serde(default)]
    pub updates: UpdateRules,
}

fn rule_ok(r: &str) -> bool {
    matches!(r, "ask" | "auto")
}

pub fn validate_personal(p: &PersonalApp) -> Result<()> {
    if p.name.trim().is_empty() {
        return Err(Error::Other("Donnez un nom à ce logiciel.".into()));
    }
    let t = p.target.trim();
    match p.kind.as_str() {
        "web" => {
            let u = url::Url::parse(t).map_err(|_| Error::Other(format!("« {t} » n'est pas une adresse web valide.")))?;
            if !matches!(u.scheme(), "http" | "https") {
                return Err(Error::Other("Seules les adresses http:// et https:// sont acceptées.".into()));
            }
        }
        "program" | "folder" => {
            if t.is_empty() || !std::path::Path::new(t).is_absolute() {
                return Err(Error::Other("Choisissez un chemin complet (par exemple C:\\Outils\\outil.exe).".into()));
            }
        }
        k => return Err(Error::Other(format!("type de logiciel inconnu « {k} »"))),
    }
    Ok(())
}

pub fn validate(p: &Profile) -> Result<()> {
    for a in &p.personal {
        validate_personal(a)?;
    }
    for w in &p.workspaces {
        if w.name.trim().is_empty() {
            return Err(Error::Other("Chaque espace de travail doit avoir un nom.".into()));
        }
        for i in &w.items {
            if !matches!(i.kind.as_str(), "app" | "personal" | "folder" | "url") || i.target.trim().is_empty() {
                return Err(Error::Other(format!("élément invalide dans l'espace « {} »", w.name)));
            }
        }
    }
    if !rule_ok(&p.updates.default_rule) || !p.updates.per_app.values().all(|r| rule_ok(r)) {
        return Err(Error::Other("règle de mise à jour inconnue (attendu : ask ou auto)".into()));
    }
    Ok(())
}
