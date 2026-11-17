//! Collecte du journal d'activité. Chaque capteur envoie ses événements à un seul « écrivain » qui les
//! inscrit dans l'archive, sauf si la collecte est désactivée, en pause, ou si la catégorie est décochée.
//! Les événements de la catégorie « collecte » (pause, reprise, trou dans le suivi) sont toujours inscrits :
//! ils expliquent les périodes sans données.

pub mod fenetres;
pub mod fichiers;
pub mod processus;
pub mod systeme;

use crate::reglages::Reglages;
use journal_core::archive::ContenuEvenement;
use journal_core::temps::{maintenant_ms, precision, Horodatage};
use journal_core::{Archive, NouvelEvenement};
use std::path::PathBuf;
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex, RwLock};
use std::time::Duration;

pub struct Contexte {
    pub archive: Mutex<Option<Archive>>,
    pub erreur_archive: Option<String>,
    pub reglages: RwLock<Reglages>,
    pub dossier: PathBuf,
    tx: Mutex<Sender<NouvelEvenement>>,
    pub fichiers: fichiers::Surveillance,
}

pub type Ctx = Arc<Contexte>;

impl Contexte {
    pub fn nouveau(dossier: PathBuf, archive: Result<Archive, String>, reglages: Reglages) -> (Ctx, Receiver<NouvelEvenement>) {
        let (tx, rx) = channel();
        let (archive, erreur) = match archive {
            Ok(a) => (Some(a), None),
            Err(e) => (None, Some(e)),
        };
        let ctx = Arc::new(Contexte {
            archive: Mutex::new(archive),
            erreur_archive: erreur,
            reglages: RwLock::new(reglages),
            dossier,
            tx: Mutex::new(tx),
            fichiers: fichiers::Surveillance::default(),
        });
        (ctx, rx)
    }

    pub fn envoyer(&self, e: NouvelEvenement) {
        let _ = self.tx.lock().unwrap().send(e);
    }

    /// Vrai si la catégorie doit être suivie maintenant (accord donné, pas de pause, catégorie cochée).
    pub fn suivre(&self, categorie: &str) -> bool {
        let r = self.reglages.read().unwrap();
        r.collecte_active && !r.en_pause(maintenant_ms()) && r.categorie_active(categorie)
    }

    pub fn avec_archive<T>(&self, f: impl FnOnce(&Archive) -> T) -> Option<T> {
        self.archive.lock().unwrap().as_ref().map(f)
    }

    /// Événement de la catégorie « collecte » (toujours inscrit).
    pub fn note_collecte(&self, action: &str, sujet: &str, note: Option<String>, partiel: bool) {
        let maintenant = Horodatage::maintenant();
        self.envoyer(NouvelEvenement {
            categorie: "collecte".into(),
            action: action.into(),
            evenement: Some(maintenant.clone()),
            detection: maintenant,
            partiel,
            contenu: ContenuEvenement { sujet: sujet.into(), note, ..Default::default() },
            unique: None,
        });
    }
}

pub fn evenement(categorie: &str, action: &str, sujet: String, appli: Option<String>) -> NouvelEvenement {
    let maintenant = Horodatage::maintenant();
    NouvelEvenement {
        categorie: categorie.into(),
        action: action.into(),
        evenement: Some(maintenant.clone()),
        detection: maintenant,
        partiel: false,
        contenu: ContenuEvenement { sujet, appli, ..Default::default() },
        unique: None,
    }
}

/// Notifications Windows (branchées par la couche Tauri au démarrage).
pub static NOTIFIER: std::sync::OnceLock<Box<dyn Fn(&str, &str) + Send + Sync>> = std::sync::OnceLock::new();

pub fn notifier(titre: &str, corps: &str) {
    if let Some(n) = NOTIFIER.get() {
        n(titre, corps);
    }
}

/// Signes qu'une personne utilise le PC.
fn utilisation(e: &NouvelEvenement) -> bool {
    matches!(
        (e.categorie.as_str(), e.action.as_str()),
        ("session", "deverrouillage" | "ouverture_session" | "actif") | ("fenetre", "premier_plan")
    )
}

fn verifier_absence(ctx: &Ctx, e: &NouvelEvenement, derniere_alerte: &mut i64) {
    if !utilisation(e) {
        return;
    }
    let h = e.evenement.as_ref().unwrap_or(&e.detection);
    let heure = (((h.utc_ms + h.decalage_min as i64 * 60_000).rem_euclid(86_400_000)) / 3_600_000) as u32;
    let (surveiller, absent) = {
        let r = ctx.reglages.read().unwrap();
        (r.surveiller_absence(heure), r.absent_depuis_ms.is_some())
    };
    if !surveiller || h.utc_ms - *derniere_alerte < 30 * 60_000 {
        return;
    }
    *derniere_alerte = h.utc_ms;
    let pourquoi = if absent { "pendant ton absence" } else { "pendant les heures calmes" };
    let quoi = match (e.categorie.as_str(), e.action.as_str()) {
        ("fenetre", _) => format!("fenêtre « {} »", e.contenu.sujet),
        (_, "deverrouillage") => "session déverrouillée".into(),
        (_, "ouverture_session") => "ouverture de session".into(),
        _ => "clavier ou souris utilisé".into(),
    };
    let mut alerte = evenement("securite", "activite_absence", format!("PC utilisé {pourquoi}"), e.contenu.appli.clone());
    alerte.evenement = Some(h.clone());
    alerte.contenu.detail = Some(quoi.clone());
    ctx.avec_archive(|a| a.ajouter_evenement(&alerte));
    notifier("Rayan’s Journal — PC utilisé", &format!("{} ({quoi}) à {}.", pourquoi[..1].to_uppercase() + &pourquoi[1..], &h.lisible()[11..16]));
}

fn ecrivain(ctx: Ctx, rx: Receiver<NouvelEvenement>) {
    let mut derniere_alerte = 0i64;
    for e in rx {
        if e.categorie != "collecte" && !ctx.suivre(&e.categorie) {
            continue;
        }
        verifier_absence(&ctx, &e, &mut derniere_alerte);
        ctx.avec_archive(|a| {
            if let Err(err) = a.ajouter_evenement(&e) {
                eprintln!("événement non inscrit : {err}");
            }
        });
    }
}

const DERNIERE_ACTIVITE: &str = "derniere_activite_ms";

/// Démarre l'écrivain, les capteurs et l'entretien (activité, conservation, rattrapages).
pub fn demarrer(ctx: Ctx, rx: Receiver<NouvelEvenement>) {
    {
        let c = ctx.clone();
        std::thread::spawn(move || ecrivain(c, rx));
    }
    let fin_precedente = {
        let r = ctx.reglages.read().unwrap();
        let actif = r.collecte_active && !r.en_pause(maintenant_ms());
        drop(r);
        if actif {
            ctx.avec_archive(|a| a.reglage(DERNIERE_ACTIVITE).ok().flatten()).flatten().and_then(|s| s.parse::<i64>().ok())
        } else {
            None
        }
    };
    signaler_trou(&ctx);
    processus::demarrer(ctx.clone(), fin_precedente);
    fenetres::demarrer(ctx.clone());
    fichiers::reconfigurer(&ctx, true);
    let c = ctx.clone();
    std::thread::spawn(move || {
        let mut tour: u64 = 0;
        loop {
            let actif = {
                let r = c.reglages.read().unwrap();
                r.collecte_active && !r.en_pause(maintenant_ms())
            };
            if actif {
                c.avec_archive(|a| a.definir_reglage(DERNIERE_ACTIVITE, &maintenant_ms().to_string()));
                fichiers::enregistrer_etat(&c);
                if tour % 2 == 0 {
                    systeme::rattraper(&c);
                }
            }
            if tour % 360 == 0 {
                appliquer_conservation(&c);
            }
            // Fin d'une pause minutée : on le note une fois.
            let fin_pause = {
                let r = c.reglages.read().unwrap();
                r.pause_jusqua_ms.is_some_and(|p| p != i64::MAX && maintenant_ms() >= p)
            };
            if fin_pause {
                reprendre(&c, "fin de la pause minutée");
            }
            tour += 1;
            std::thread::sleep(Duration::from_secs(60));
        }
    });
}

/// Au démarrage : si le suivi était actif, la période depuis la dernière activité n'a pas été suivie.
fn signaler_trou(ctx: &Ctx) {
    let (actif, pause) = {
        let r = ctx.reglages.read().unwrap();
        (r.collecte_active, r.en_pause(maintenant_ms()))
    };
    if !actif {
        return;
    }
    let derniere = ctx.avec_archive(|a| a.reglage(DERNIERE_ACTIVITE).ok().flatten()).flatten().and_then(|s| s.parse::<i64>().ok());
    if let Some(d) = derniere {
        let de = Horodatage::en_local(d, precision::MINUTE).lisible();
        let a = Horodatage::maintenant().lisible();
        ctx.note_collecte(
            "reprise",
            "Suivi relancé avec l'application",
            Some(format!(
                "Suivi partiel entre {de} et {a} (application fermée, PC éteint ou en veille) : les applications \
                 et fenêtres de cette période ne sont pas connues. Les démarrages, arrêts et mises en veille sont \
                 repris du journal Windows, et les fichiers modifiés pendant ce temps sont rattrapés{}.",
                if pause { " ; collecte toujours en pause" } else { "" }
            )),
            true,
        );
    }
    if !pause {
        systeme::rattraper(ctx);
    }
}

pub fn appliquer_conservation(ctx: &Ctx) {
    let (j, m) = {
        let r = ctx.reglages.read().unwrap();
        (r.conservation_journal_jours, r.conservation_messages_jours)
    };
    let jour = 86_400_000i64;
    ctx.avec_archive(|a| {
        if j > 0 {
            let _ = a.purger_evenements(maintenant_ms() - j as i64 * jour);
        }
        if m > 0 {
            let _ = a.purger_messages(maintenant_ms() - m as i64 * jour);
        }
    });
}

pub fn mettre_en_pause(ctx: &Ctx, minutes: Option<u32>) {
    let jusqua = minutes.map(|m| maintenant_ms() + m as i64 * 60_000).unwrap_or(i64::MAX);
    {
        let mut r = ctx.reglages.write().unwrap();
        r.pause_jusqua_ms = Some(jusqua);
        let _ = r.enregistrer(&ctx.dossier);
    }
    fichiers::enregistrer_etat(ctx);
    noter_pause(ctx, Some(maintenant_ms()), None);
    ctx.note_collecte(
        "pause",
        "Collecte mise en pause",
        Some(match minutes {
            Some(m) => format!("Pause de {m} min : rien n'est enregistré jusqu'à {}.", Horodatage::en_local(jusqua, precision::MINUTE).lisible()),
            None => "Pause jusqu'à reprise manuelle : rien n'est enregistré pendant ce temps.".into(),
        }),
        false,
    );
}

pub fn reprendre(ctx: &Ctx, raison: &str) {
    {
        let mut r = ctx.reglages.write().unwrap();
        if r.pause_jusqua_ms.is_none() {
            return;
        }
        r.pause_jusqua_ms = None;
        let _ = r.enregistrer(&ctx.dossier);
    }
    noter_pause(ctx, None, Some(maintenant_ms()));
    ctx.note_collecte("reprise", "Collecte reprise", Some(format!("Reprise ({raison}).")), false);
    // Les fichiers changés pendant la pause ne sont pas signalés : on relit seulement leur état.
    fichiers::reconfigurer(ctx, false);
}

const PAUSES: &str = "pauses";

/// Périodes de pause (début, fin) : le rattrapage du journal Windows les saute.
fn noter_pause(ctx: &Ctx, debut: Option<i64>, fin: Option<i64>) {
    ctx.avec_archive(|a| {
        let mut v: Vec<(i64, i64)> = a.reglage(PAUSES).ok().flatten().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
        if let Some(d) = debut {
            v.push((d, i64::MAX));
        }
        if let (Some(f), Some(last)) = (fin, v.last_mut()) {
            if last.1 == i64::MAX {
                last.1 = f;
            }
        }
        let _ = a.definir_reglage(PAUSES, &serde_json::to_string(&v).unwrap());
    });
}

pub fn pendant_une_pause(ctx: &Ctx, ms: i64) -> bool {
    let v: Vec<(i64, i64)> = ctx
        .avec_archive(|a| a.reglage(PAUSES).ok().flatten())
        .flatten()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    v.iter().any(|(d, f)| ms >= *d && ms < *f)
}
