//! Réglages (fichier `reglages.json`, sans aucun contenu personnel). La collecte est désactivée tant que
//! l'utilisateur ne l'a pas activée lui-même.

use journal_core::texte::ReglesSecrets;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Reglages {
    /// Accord donné pour la collecte du journal d'activité (faux à l'installation).
    pub collecte_active: bool,
    pub applications: bool,
    pub fenetres: bool,
    pub fichiers: bool,
    pub session: bool,
    /// Vérification de confiance des programmes, du démarrage automatique et des détections Defender.
    pub securite: bool,
    pub dossiers: Vec<PathBuf>,
    /// Dossiers ou fichiers ignorés (`*` et `?` acceptés), sur n'importe quelle partie du chemin.
    pub ignores: Vec<String>,
    pub secrets: ReglesSecrets,
    /// 0 = sans limite.
    pub conservation_journal_jours: u32,
    pub conservation_messages_jours: u32,
    pub intervalle_processus_s: u32,
    /// Pause jusqu'à cet instant (ms UTC) ; `i64::MAX` = jusqu'à reprise manuelle.
    pub pause_jusqua_ms: Option<i64>,
    pub raccourci_pause: bool,
    /// Programmes (chemin exact) ou dossiers (terminés par `\`) marqués comme sûrs par l'utilisateur.
    pub confiance: Vec<String>,
    /// Minutes sans clavier ni souris avant de noter « inactif » (le temps d'écran s'arrête).
    pub seuil_inactivite_min: u32,
    /// Alerte si le PC est utilisé pendant les heures calmes.
    pub heures_calmes: bool,
    pub calme_debut_h: u32,
    pub calme_fin_h: u32,
    /// Mode « je m'absente » : toute utilisation du PC est signalée. Instant du départ.
    pub absent_depuis_ms: Option<i64>,
    /// Temps par projet d'après les titres de fenêtres (projets de Rayan's Chrono ou libres).
    pub projets: Vec<journal_core::rapport::RegleProjet>,
}

impl Default for Reglages {
    fn default() -> Self {
        Reglages {
            collecte_active: false,
            applications: true,
            fenetres: true,
            fichiers: true,
            session: true,
            securite: true,
            dossiers: [dirs::desktop_dir(), dirs::document_dir(), dirs::download_dir()].into_iter().flatten().collect(),
            ignores: [
                ".git", "node_modules", "target", "__pycache__", ".venv", "desktop.ini", "Thumbs.db", "~$*", "*.tmp",
                "*.crdownload", "*.part", ".~lock.*",
            ]
            .iter()
            .map(|s| s.to_string())
            .collect(),
            secrets: ReglesSecrets::default(),
            conservation_journal_jours: 90,
            conservation_messages_jours: 0,
            intervalle_processus_s: 2,
            pause_jusqua_ms: None,
            raccourci_pause: true,
            confiance: Vec::new(),
            seuil_inactivite_min: 5,
            heures_calmes: false,
            calme_debut_h: 0,
            calme_fin_h: 7,
            absent_depuis_ms: None,
            projets: Vec::new(),
        }
    }
}

impl Reglages {
    pub fn charger(dossier: &Path) -> Self {
        let chemin = dossier.join("reglages.json");
        if let Ok(t) = std::fs::read_to_string(&chemin) {
            match serde_json::from_str(&t) {
                Ok(r) => return r,
                Err(_) => {
                    let _ = std::fs::copy(&chemin, dossier.join("reglages.illisibles.json"));
                }
            }
        }
        Reglages::default()
    }

    pub fn enregistrer(&self, dossier: &Path) -> Result<(), String> {
        std::fs::create_dir_all(dossier).map_err(|e| e.to_string())?;
        let tmp = dossier.join("reglages.json.tmp");
        std::fs::write(&tmp, serde_json::to_string_pretty(self).unwrap()).map_err(|e| e.to_string())?;
        std::fs::rename(&tmp, dossier.join("reglages.json")).map_err(|e| e.to_string())
    }

    pub fn en_pause(&self, maintenant_ms: i64) -> bool {
        self.pause_jusqua_ms.is_some_and(|p| maintenant_ms < p)
    }

    pub fn categorie_active(&self, categorie: &str) -> bool {
        match categorie {
            "application" | "composant" => self.applications,
            "fenetre" => self.fenetres,
            "fichier" => self.fichiers,
            "session" => self.session,
            "securite" => self.securite,
            _ => true,
        }
    }

    /// Vrai si l'instant tombe dans les heures calmes (heure locale), ou si le mode absence est actif.
    pub fn surveiller_absence(&self, heure_locale: u32) -> bool {
        if self.absent_depuis_ms.is_some() {
            return true;
        }
        if !self.heures_calmes || self.calme_debut_h == self.calme_fin_h {
            return false;
        }
        if self.calme_debut_h < self.calme_fin_h {
            heure_locale >= self.calme_debut_h && heure_locale < self.calme_fin_h
        } else {
            heure_locale >= self.calme_debut_h || heure_locale < self.calme_fin_h
        }
    }

    pub fn ignore(&self, chemin: &Path) -> bool {
        chemin.components().any(|c| {
            let p = c.as_os_str().to_string_lossy().to_lowercase();
            self.ignores.iter().any(|m| journal_core::texte::joker(&m.to_lowercase(), &p))
        })
    }
}
