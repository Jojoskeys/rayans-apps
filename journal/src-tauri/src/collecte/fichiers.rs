//! Fichiers des dossiers choisis : surveillance instantanée par Windows (ReadDirectoryChangesW) pendant que
//! l'application tourne, et rattrapage au démarrage en comparant avec l'état enregistré (chiffré).
//!
//! En direct, l'heure est celle de la détection (moins d'une seconde après). Au rattrapage, une création ou
//! une modification prend l'heure de modification du fichier ; une suppression faite pendant l'arrêt n'a
//! pas d'heure connue : elle est notée avec l'intervalle possible, comme suivi partiel.

use super::{evenement, Ctx};
use journal_core::temps::{maintenant_ms, precision, Horodatage};
use notify::event::{ModifyKind, RenameMode};
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;

const FICHIER_ETAT: &str = "etat-fichiers.rjf";
const LIMITE: usize = 300_000;

#[derive(Default, Serialize, Deserialize)]
struct Etat {
    quand_ms: i64,
    /// chemin → (modification ms, taille)
    fichiers: BTreeMap<String, (i64, u64)>,
    tronque: bool,
    #[serde(skip)]
    modifie: bool,
}

#[derive(Default)]
pub struct Surveillance {
    watcher: Mutex<Option<RecommendedWatcher>>,
    etat: Mutex<Etat>,
}

fn mtime(m: &std::fs::Metadata) -> i64 {
    m.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_millis() as i64).unwrap_or(0)
}

fn parcourir(ctx: &Ctx) -> (BTreeMap<String, (i64, u64)>, bool) {
    let (dossiers, r) = {
        let r = ctx.reglages.read().unwrap();
        (r.dossiers.clone(), r.clone())
    };
    let mut out = BTreeMap::new();
    let mut pile: Vec<PathBuf> = dossiers.into_iter().filter(|d| d.is_dir()).collect();
    while let Some(d) = pile.pop() {
        let Ok(rd) = std::fs::read_dir(&d) else { continue };
        for e in rd.flatten() {
            let p = e.path();
            if r.ignore(&p) || p.starts_with(&ctx.dossier) {
                continue;
            }
            let Ok(m) = e.metadata() else { continue };
            if m.is_dir() {
                pile.push(p);
            } else {
                if out.len() >= LIMITE {
                    return (out, true);
                }
                out.insert(p.to_string_lossy().into_owned(), (mtime(&m), m.len()));
            }
        }
    }
    (out, false)
}

/// Arrête puis relance la surveillance selon les réglages. Avec `signaler`, les différences avec l'état
/// enregistré deviennent des événements (rattrapage) ; sinon l'état est seulement relu.
pub fn reconfigurer(ctx: &Ctx, signaler: bool) {
    let ancien = ctx.fichiers.watcher.lock().unwrap().take();
    drop(ancien);
    if !ctx.suivre("fichier") {
        return;
    }
    let c = ctx.clone();
    std::thread::spawn(move || {
        let (actuel, tronque) = parcourir(&c);
        let maintenant = maintenant_ms();
        if signaler {
            let precedent: Option<Etat> = c
                .avec_archive(|a| a.lire_prive(FICHIER_ETAT).ok().flatten())
                .flatten()
                .and_then(|b| serde_json::from_slice(&b).ok());
            if let Some(p) = precedent {
                comparer(&c, &p, &actuel, maintenant);
            }
        }
        if tronque {
            c.note_collecte(
                "suivi_partiel",
                "Trop de fichiers dans les dossiers surveillés",
                Some(format!("Plus de {LIMITE} fichiers : le rattrapage au démarrage ne couvre pas tout. La surveillance en direct reste complète.")),
                true,
            );
        }
        *c.fichiers.etat.lock().unwrap() = Etat { quand_ms: maintenant, fichiers: actuel, tronque, modifie: true };
        enregistrer_etat(&c);
        demarrer_watcher(&c);
    });
}

fn comparer(ctx: &Ctx, avant: &Etat, apres: &BTreeMap<String, (i64, u64)>, maintenant: i64) {
    let r = ctx.reglages.read().unwrap().secrets.clone();
    let intervalle = format!(
        "entre {} et {}",
        Horodatage::en_local(avant.quand_ms, precision::MINUTE).lisible(),
        Horodatage::en_local(maintenant, precision::MINUTE).lisible()
    );
    let envoyer = |action: &str, chemin: &str, quand: Option<i64>, note: String| {
        let mut e = evenement("fichier", action, String::new(), None);
        let filtre = r.filtrer_chemin(chemin);
        e.contenu.sujet = filtre.rsplit('\\').next().unwrap_or(&filtre).to_string();
        e.contenu.chemin = Some(filtre);
        e.contenu.note = Some(note);
        match quand {
            Some(ms) => e.evenement = Some(Horodatage::en_local(ms, "exacte (heure de modification du fichier)")),
            None => {
                e.evenement = None;
                e.partiel = true;
            }
        }
        ctx.envoyer(e);
    };
    for (chemin, (m, t)) in apres {
        match avant.fichiers.get(chemin) {
            None if *m > avant.quand_ms => {
                envoyer("creation", chemin, Some(*m), "Constaté au démarrage : créé pendant que le suivi était arrêté.".into())
            }
            None => envoyer(
                "apparition",
                chemin,
                None,
                format!("Constaté au démarrage : présent alors qu'il ne l'était pas ({intervalle}) ; copié ou déplacé ici avec une date plus ancienne."),
            ),
            Some((m0, t0)) if (m0, t0) != (m, t) && *m > avant.quand_ms => {
                envoyer("modification", chemin, Some(*m), "Constaté au démarrage : modifié pendant que le suivi était arrêté.".into())
            }
            _ => {}
        }
    }
    if !avant.tronque {
        for chemin in avant.fichiers.keys().filter(|c| !apres.contains_key(*c)) {
            envoyer(
                "suppression",
                chemin,
                None,
                format!("Constaté au démarrage : supprimé, renommé ou déplacé {intervalle}. Heure réelle inconnue."),
            );
        }
    }
}

pub fn enregistrer_etat(ctx: &Ctx) {
    let json = {
        let mut e = ctx.fichiers.etat.lock().unwrap();
        if !e.modifie {
            return;
        }
        e.modifie = false;
        e.quand_ms = maintenant_ms();
        serde_json::to_vec(&*e).unwrap()
    };
    ctx.avec_archive(|a| a.ecrire_prive(FICHIER_ETAT, &json));
}

fn noter(ctx: &Ctx, chemin: &Path, present: bool) {
    let mut e = ctx.fichiers.etat.lock().unwrap();
    let cle = chemin.to_string_lossy().into_owned();
    if present {
        if let Ok(m) = std::fs::metadata(chemin) {
            if m.is_file() {
                e.fichiers.insert(cle, (mtime(&m), m.len()));
            }
        }
    } else {
        e.fichiers.remove(&cle);
    }
    e.modifie = true;
}

fn demarrer_watcher(ctx: &Ctx) {
    let c = ctx.clone();
    let mut renommage: Option<PathBuf> = None;
    let mut derniers: HashMap<PathBuf, i64> = HashMap::new();
    let gestion = move |res: notify::Result<notify::Event>| {
        let Ok(ev) = res else {
            c.note_collecte("suivi_partiel", "Erreur de surveillance des fichiers", Some("Des changements ont pu être manqués.".into()), true);
            return;
        };
        if ev.need_rescan() {
            c.note_collecte(
                "suivi_partiel",
                "Trop de changements de fichiers à la fois",
                Some("Windows a perdu une partie des notifications : certains changements de fichiers manquent dans cet intervalle.".into()),
                true,
            );
            return;
        }
        let r = c.reglages.read().unwrap().clone();
        let garder = |p: &Path| !r.ignore(p) && !p.starts_with(&c.dossier);
        let maintenant = maintenant_ms();
        let envoyer = |action: &str, p: &Path, ancien: Option<&Path>, note: Option<&str>| {
            let filtre = r.secrets.filtrer_chemin(&p.to_string_lossy());
            let mut e = evenement("fichier", action, filtre.rsplit('\\').next().unwrap_or(&filtre).to_string(), None);
            e.evenement = Some(Horodatage::en_local(maintenant, "exacte (à la détection, moins d'une seconde)"));
            e.contenu.chemin = Some(filtre);
            e.contenu.ancien_chemin = ancien.map(|a| r.secrets.filtrer_chemin(&a.to_string_lossy()));
            e.contenu.note = note.map(String::from);
            c.envoyer(e);
        };
        match ev.kind {
            EventKind::Create(_) => {
                for p in ev.paths.iter().filter(|p| garder(p)) {
                    if p.is_dir() {
                        envoyer("creation_dossier", p, None, None);
                    } else {
                        derniers.insert(p.clone(), maintenant);
                        envoyer("creation", p, None, None);
                        noter(&c, p, true);
                    }
                }
            }
            EventKind::Remove(_) => {
                for p in ev.paths.iter().filter(|p| garder(p)) {
                    envoyer("suppression", p, None, Some("Mis à la corbeille, supprimé définitivement ou déplacé hors des dossiers suivis : Windows ne précise pas lequel."));
                    noter(&c, p, false);
                }
            }
            EventKind::Modify(ModifyKind::Name(mode)) => match mode {
                RenameMode::From => renommage = ev.paths.first().cloned(),
                RenameMode::To | RenameMode::Both => {
                    let (de, vers) = if ev.paths.len() >= 2 { (Some(ev.paths[0].clone()), ev.paths[1].clone()) } else { (renommage.take(), ev.paths[0].clone()) };
                    if let Some(de) = de {
                        if garder(&vers) || garder(&de) {
                            let action = if de.parent() == vers.parent() { "renommage" } else { "deplacement" };
                            envoyer(action, &vers, Some(&de), None);
                        }
                        noter(&c, &de, false);
                    } else if garder(&vers) {
                        envoyer("arrivee", &vers, None, Some("Déplacé ici depuis un dossier non suivi."));
                    }
                    noter(&c, &vers, true);
                }
                _ => {}
            },
            EventKind::Modify(_) => {
                for p in ev.paths.iter().filter(|p| garder(p) && p.is_file()) {
                    // Une sauvegarde déclenche plusieurs notifications : une seule par fichier toutes les 3 s.
                    if derniers.get(p).is_some_and(|t| maintenant - t < 3000) {
                        continue;
                    }
                    derniers.insert(p.clone(), maintenant);
                    if derniers.len() > 5000 {
                        derniers.retain(|_, t| maintenant - *t < 3000);
                    }
                    envoyer("modification", p, None, None);
                    noter(&c, p, true);
                }
            }
            _ => {}
        }
    };
    let mut w = match notify::recommended_watcher(gestion) {
        Ok(w) => w,
        Err(e) => {
            ctx.note_collecte("suivi_partiel", "Surveillance des fichiers impossible", Some(e.to_string()), true);
            return;
        }
    };
    let dossiers = ctx.reglages.read().unwrap().dossiers.clone();
    for d in dossiers {
        if let Err(e) = w.watch(&d, RecursiveMode::Recursive) {
            ctx.note_collecte("suivi_partiel", &format!("Dossier non surveillé : {}", d.display()), Some(e.to_string()), true);
        }
    }
    *ctx.fichiers.watcher.lock().unwrap() = Some(w);
}
