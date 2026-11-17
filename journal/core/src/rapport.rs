//! Calculs sur le journal : temps d'écran par programme, par fenêtre, par heure et par jour ; périodes
//! d'activité ; ce qui était au premier plan à un instant donné ; temps par projet d'après des mots-clés ;
//! historique des fichiers (en suivant renommages et déplacements).
//!
//! Le temps d'écran est le temps où une fenêtre était au premier plan **et** où le PC était utilisé :
//! verrouillage, veille, arrêt, pause de la collecte et inactivité (aucune action au clavier ou à la souris
//! depuis le seuil choisi) interrompent le décompte.

use crate::archive::Evenement;
use crate::texte::normaliser;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Au-delà, un intervalle qui se termine par un redémarrage du suivi n'est pas compté en entier (le PC a pu
/// s'éteindre sans prévenir).
pub const PLAFOND_REPRISE_MS: i64 = 5 * 60_000;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Segment {
    pub debut_ms: i64,
    pub fin_ms: i64,
    pub appli: String,
    pub titre: String,
    pub decalage_min: i32,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Duree {
    pub nom: String,
    pub ms: i64,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Periode {
    pub debut_ms: i64,
    pub fin_ms: i64,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Rapport {
    pub actif_ms: i64,
    pub premiere_ms: Option<i64>,
    pub derniere_ms: Option<i64>,
    pub par_appli: Vec<Duree>,
    /// « programme — titre », les 30 plus longs.
    pub par_fenetre: Vec<Duree>,
    /// 24 cases, heure locale.
    pub par_heure: Vec<i64>,
    /// Une case par jour demandé.
    pub par_jour: Vec<i64>,
    /// Périodes d'utilisation (coupures de moins de 2 minutes fusionnées).
    pub periodes: Vec<Periode>,
    pub par_projet: Vec<Duree>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct RegleProjet {
    pub projet: String,
    /// Mots cherchés (sans accents ni majuscules) dans le titre de la fenêtre ou le nom du programme.
    pub mots: Vec<String>,
}

/// Nom affiché pour un programme : les applis du Store passent par ApplicationFrameHost, on prend leur titre.
pub fn nom_appli(appli: &str, titre: &str) -> String {
    if appli.eq_ignore_ascii_case("ApplicationFrameHost.exe") && !titre.is_empty() {
        titre.rsplit(" - ").next().unwrap_or(titre).trim().to_string()
    } else {
        appli.to_string()
    }
}

fn quand(e: &Evenement) -> i64 {
    e.evenement.as_ref().unwrap_or(&e.detection).utc_ms
}

/// Découpe le journal en segments d'utilisation (fenêtre au premier plan, PC utilisé). `evenements` peut
/// commencer avant `debut` (pour connaître la fenêtre active au début) ; le résultat est coupé à
/// [`debut`, `fin`).
pub fn segments(evenements: &[Evenement], debut: i64, fin: i64) -> Vec<Segment> {
    let mut ev: Vec<&Evenement> = evenements.iter().collect();
    ev.sort_by_key(|e| (quand(e), e.id));
    let mut out = Vec::new();
    let mut courant: Option<(String, String, i32)> = None;
    let mut actif = false;
    let mut depuis = i64::MIN;
    let fermer = |de: i64, a: i64, c: &Option<(String, String, i32)>, actif: bool, out: &mut Vec<Segment>| {
        if let (true, Some((appli, titre, dec))) = (actif, c) {
            let (d, f) = (de.max(debut), a.min(fin));
            if f > d {
                out.push(Segment { debut_ms: d, fin_ms: f, appli: appli.clone(), titre: titre.clone(), decalage_min: *dec });
            }
        }
    };
    for e in ev {
        let t = quand(e);
        if t >= fin {
            break;
        }
        // Le suivi reprend après un trou (app fermée, PC éteint) : la fin réelle de l'activité précédente est
        // inconnue, on ne compte pas plus de 5 minutes.
        let redemarrage = matches!((e.categorie.as_str(), e.action.as_str()), ("session", "demarrage") | ("session", "arret_inattendu"))
            || (e.categorie == "collecte" && e.action == "reprise" && e.contenu.note.as_deref().is_some_and(|n| n.contains("partiel")));
        let borne = if redemarrage { t.min(depuis.saturating_add(PLAFOND_REPRISE_MS)) } else { t };
        match (e.categorie.as_str(), e.action.as_str()) {
            ("fenetre", "premier_plan") | ("fenetre", "titre") => {
                fermer(depuis, borne, &courant, actif, &mut out);
                let appli = e.contenu.appli.clone().unwrap_or_default();
                let titre = if e.contenu.sujet == appli { String::new() } else { e.contenu.sujet.clone() };
                courant = Some((appli, titre, e.evenement.as_ref().unwrap_or(&e.detection).decalage_min));
                actif = true;
                depuis = t;
            }
            _ if redemarrage => {
                fermer(depuis, borne, &courant, actif, &mut out);
                courant = None;
                actif = false;
                depuis = t;
            }
            ("session", "verrouillage" | "veille" | "arret" | "fermeture_session" | "inactif") | ("collecte", "pause" | "arret" | "desactivation") => {
                fermer(depuis, borne, &courant, actif, &mut out);
                actif = false;
                depuis = t;
            }
            ("collecte", "reprise") => {
                // Fin d'une pause : la fenêtre au premier plan n'a pas changé.
                fermer(depuis, borne, &courant, actif, &mut out);
                actif = true;
                depuis = t;
            }
            ("session", "deverrouillage" | "actif" | "ouverture_session") => {
                fermer(depuis, borne, &courant, actif, &mut out);
                actif = true;
                depuis = t;
            }
            _ => {}
        }
    }
    fermer(depuis, fin, &courant, actif, &mut out);
    out
}

fn heure_locale(ms: i64, dec: i32) -> usize {
    (((ms + dec as i64 * 60_000).rem_euclid(86_400_000)) / 3_600_000) as usize
}

/// `jours` : débuts des jours demandés (ms), dans l'ordre ; chaque jour va jusqu'au début du suivant
/// (le dernier jusqu'à `fin`).
pub fn rapport(evenements: &[Evenement], debut: i64, fin: i64, jours: &[i64], projets: &[RegleProjet]) -> Rapport {
    let segs = segments(evenements, debut, fin);
    let mut r = Rapport { par_heure: vec![0; 24], par_jour: vec![0; jours.len()], ..Default::default() };
    let mut appli: HashMap<String, i64> = HashMap::new();
    let mut fenetre: HashMap<String, i64> = HashMap::new();
    let mut projet: HashMap<String, i64> = HashMap::new();
    let regles: Vec<(String, Vec<String>)> =
        projets.iter().map(|p| (p.projet.clone(), p.mots.iter().map(|m| normaliser(m.trim())).filter(|m| !m.is_empty()).collect())).collect();
    for s in &segs {
        let d = s.fin_ms - s.debut_ms;
        r.actif_ms += d;
        r.premiere_ms = Some(r.premiere_ms.map_or(s.debut_ms, |p| p.min(s.debut_ms)));
        r.derniere_ms = Some(r.derniere_ms.map_or(s.fin_ms, |p| p.max(s.fin_ms)));
        let nom = nom_appli(&s.appli, &s.titre);
        *appli.entry(nom.clone()).or_default() += d;
        let f = if s.titre.is_empty() { nom.clone() } else { format!("{nom} — {}", s.titre) };
        *fenetre.entry(f).or_default() += d;
        // Par heure, en coupant aux changements d'heure.
        let mut t = s.debut_ms;
        while t < s.fin_ms {
            let local = t + s.decalage_min as i64 * 60_000;
            let fin_heure = t + (3_600_000 - local.rem_euclid(3_600_000));
            let f = fin_heure.min(s.fin_ms);
            r.par_heure[heure_locale(t, s.decalage_min)] += f - t;
            t = f;
        }
        for (i, j) in jours.iter().enumerate() {
            let jf = jours.get(i + 1).copied().unwrap_or(fin);
            let chevauche = s.fin_ms.min(jf) - s.debut_ms.max(*j);
            if chevauche > 0 {
                r.par_jour[i] += chevauche;
            }
        }
        let texte = normaliser(&format!("{} {}", s.appli, s.titre));
        if let Some((p, _)) = regles.iter().find(|(_, mots)| mots.iter().any(|m| texte.contains(m.as_str()))) {
            *projet.entry(p.clone()).or_default() += d;
        }
        match r.periodes.last_mut() {
            Some(p) if s.debut_ms - p.fin_ms < 120_000 => p.fin_ms = p.fin_ms.max(s.fin_ms),
            _ => r.periodes.push(Periode { debut_ms: s.debut_ms, fin_ms: s.fin_ms }),
        }
    }
    let trier = |m: HashMap<String, i64>, n: usize| {
        let mut v: Vec<Duree> = m.into_iter().map(|(nom, ms)| Duree { nom, ms }).collect();
        v.sort_by(|a, b| b.ms.cmp(&a.ms).then(a.nom.cmp(&b.nom)));
        v.truncate(n);
        v
    };
    r.par_appli = trier(appli, 50);
    r.par_fenetre = trier(fenetre, 30);
    r.par_projet = trier(projet, 50);
    r
}

/// Ce qui était au premier plan à l'instant `t` (si le PC était utilisé), avec le segment entier.
pub fn a_l_instant(evenements: &[Evenement], t: i64) -> Option<Segment> {
    segments(evenements, i64::MIN / 2, i64::MAX / 2).into_iter().find(|s| s.debut_ms <= t && t < s.fin_ms)
}

// ---------------------------------------------------------------------------------------------------
// Historique des fichiers
// ---------------------------------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HistoriqueFichier {
    /// Dernier chemin connu.
    pub chemin: String,
    /// Chemins successifs (le premier est le chemin d'origine).
    pub chemins: Vec<String>,
    pub evenements: Vec<Evenement>,
    pub supprime: bool,
    pub telecharge: bool,
    pub renomme: bool,
    pub premier_ms: i64,
    pub dernier_ms: i64,
}

/// Regroupe les événements de fichiers par fichier, en suivant les renommages et déplacements.
/// `telechargements` : dossier Téléchargements (en minuscules), pour reconnaître les fichiers téléchargés.
pub fn historiques_fichiers(evenements: &[Evenement], telechargements: &str) -> Vec<HistoriqueFichier> {
    let mut ev: Vec<&Evenement> = evenements.iter().filter(|e| e.categorie == "fichier").collect();
    ev.sort_by_key(|e| (quand(e), e.id));
    let mut tous: Vec<HistoriqueFichier> = Vec::new();
    let mut par_chemin: HashMap<String, usize> = HashMap::new();
    for e in ev {
        let Some(chemin) = e.contenu.chemin.clone() else { continue };
        let cle = chemin.to_lowercase();
        let t = quand(e);
        let idx = match e.contenu.ancien_chemin.as_ref().map(|a| a.to_lowercase()).and_then(|a| par_chemin.remove(&a)) {
            Some(i) => {
                tous[i].chemins.push(chemin.clone());
                tous[i].renomme = true;
                i
            }
            None => match par_chemin.get(&cle) {
                Some(i) if !tous[*i].supprime => *i,
                _ => {
                    tous.push(HistoriqueFichier {
                        chemin: chemin.clone(),
                        chemins: vec![e.contenu.ancien_chemin.clone().unwrap_or_else(|| chemin.clone())],
                        evenements: vec![],
                        supprime: false,
                        telecharge: false,
                        renomme: false,
                        premier_ms: t,
                        dernier_ms: t,
                    });
                    if e.contenu.ancien_chemin.is_some() {
                        tous.last_mut().unwrap().chemins.push(chemin.clone());
                        tous.last_mut().unwrap().renomme = true;
                    }
                    tous.len() - 1
                }
            },
        };
        let h = &mut tous[idx];
        h.chemin = chemin.clone();
        h.dernier_ms = t;
        h.supprime = e.action == "suppression";
        if matches!(e.action.as_str(), "creation" | "arrivee") && !telechargements.is_empty() && cle.starts_with(telechargements) {
            h.telecharge = true;
        }
        h.evenements.push(e.clone());
        par_chemin.insert(cle, idx);
    }
    tous.sort_by(|a, b| b.dernier_ms.cmp(&a.dernier_ms));
    tous
}

/// Filtre : `mots` cherchés dans tous les noms qu'a portés le fichier ; `genre` : « telecharge »,
/// « renomme », « supprime » ou vide.
pub fn filtrer_fichiers(h: Vec<HistoriqueFichier>, mots: &str, genre: &str) -> Vec<HistoriqueFichier> {
    let q: Vec<String> = crate::texte::mots(mots);
    h.into_iter()
        .filter(|f| match genre {
            "telecharge" => f.telecharge,
            "renomme" => f.renomme,
            "supprime" => f.supprime,
            _ => true,
        })
        .filter(|f| {
            let noms = normaliser(&f.chemins.join(" "));
            q.iter().all(|m| noms.contains(m.as_str()))
        })
        .collect()
}
