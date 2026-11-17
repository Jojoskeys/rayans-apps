//! Résumé quotidien partagé avec Rayan's Aujourd'hui (objectifs du jour) : par journée (de 4 h à 4 h),
//! temps d'écran, temps de jeu, première et dernière activité. Aucun titre, chemin ni nom de programme :
//! seulement des durées et des heures, écrites en clair dans `resume-quotidien.json` pour qu'une autre app
//! puisse les lire sans la clé de l'archive.

use crate::archive::Evenement;
use crate::rapport::{nom_appli, segments};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Journee {
    /// « AAAA-MM-JJ » du jour où la journée commence (à 4 h).
    pub jour: String,
    pub ecran_ms: i64,
    pub jeux_ms: i64,
    pub premiere_ms: Option<i64>,
    pub derniere_ms: Option<i64>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Resume {
    pub version: u32,
    pub genere_ms: i64,
    /// Du plus ancien au plus récent ; la dernière est la journée en cours.
    pub jours: Vec<Journee>,
}

/// Dossiers où s'installent les jeux (les lanceurs eux-mêmes, Steam ou Epic, n'en font pas partie).
const DOSSIERS_JEUX: &[&str] = &[
    r"\steamapps\common\", r"\epic games\", r"\riot games\league of legends\", r"\riot games\valorant\", r"\roblox\versions\",
    r"\minecraft", r"\lunar client\", r"\ea games\", r"\ubisoft game launcher\games\", r"\battle.net\", r"\xboxgames\",
    r"\gog galaxy\games\", r"\bluestacks", r"\paladium",
];

const NOMS_JEUX: &[&str] = &[
    "robloxplayerbeta.exe", "minecraft.exe", "javaw.exe", "lunar client.exe", "league of legends.exe", "valorant.exe",
    "valorant-win64-shipping.exe", "fortniteclient-win64-shipping.exe", "rocketleague.exe", "cs2.exe", "gta5.exe",
    "overwatch.exe", "hd-player.exe",
];

/// Programmes à compter comme jeux : liste connue, plus tout exécutable vu lancé depuis un dossier de jeux.
pub fn noms_de_jeux(evenements: &[Evenement]) -> HashSet<String> {
    let mut s: HashSet<String> = NOMS_JEUX.iter().map(|x| x.to_string()).collect();
    for e in evenements.iter().filter(|e| e.categorie == "application") {
        let (Some(c), Some(a)) = (e.contenu.chemin.as_deref(), e.contenu.appli.as_deref()) else { continue };
        let c = c.to_lowercase();
        if DOSSIERS_JEUX.iter().any(|d| c.contains(d)) && !c.contains("launcher") && !c.contains("crashhandler") {
            s.insert(a.to_lowercase());
        }
    }
    s
}

/// `debuts` : débuts des journées (4 h locale), du plus ancien au plus récent ; la dernière va jusqu'à `fin`.
pub fn resumer(evenements: &[Evenement], jeux: &HashSet<String>, debuts: &[(String, i64)], fin: i64) -> Vec<Journee> {
    let mut out = Vec::new();
    for (i, (jour, d)) in debuts.iter().enumerate() {
        let f = debuts.get(i + 1).map(|x| x.1).unwrap_or(fin);
        let mut j = Journee { jour: jour.clone(), ..Default::default() };
        for s in segments(evenements, *d, f) {
            let duree = s.fin_ms - s.debut_ms;
            j.ecran_ms += duree;
            if jeux.contains(&s.appli.to_lowercase()) || jeux.contains(&nom_appli(&s.appli, &s.titre).to_lowercase()) {
                j.jeux_ms += duree;
            }
            j.premiere_ms = Some(j.premiere_ms.map_or(s.debut_ms, |p| p.min(s.debut_ms)));
            j.derniere_ms = Some(j.derniere_ms.map_or(s.fin_ms, |p| p.max(s.fin_ms)));
        }
        out.push(j);
    }
    out
}
