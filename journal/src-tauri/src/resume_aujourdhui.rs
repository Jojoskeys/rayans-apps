//! Écrit `resume-quotidien.json` (dossier de données du Journal) pour Rayan's Aujourd'hui : les 14 dernières
//! journées (de 4 h à 4 h), avec temps d'écran, temps de jeu, première et dernière activité. Rien d'autre :
//! ni titre de fenêtre, ni nom de programme, ni chemin. Désactivable dans les réglages (le fichier est alors
//! supprimé).

use crate::collecte::Ctx;
use chrono::{Duration, Local, NaiveTime, TimeZone};
use journal_core::resume::{noms_de_jeux, resumer, Resume};
use journal_core::temps::maintenant_ms;

pub const FICHIER: &str = "resume-quotidien.json";
const JOURS: i64 = 14;

/// Débuts des `JOURS` dernières journées (4 h locale), du plus ancien au plus récent.
fn debuts(maintenant: i64) -> Vec<(String, i64)> {
    let n = Local.timestamp_millis_opt(maintenant).single().unwrap_or_else(Local::now);
    // Avant 4 h, on est encore dans la journée de la veille.
    let aujourdhui = (n - Duration::hours(4)).date_naive();
    (0..JOURS)
        .rev()
        .filter_map(|i| {
            let d = aujourdhui - Duration::days(i);
            let t = Local.from_local_datetime(&d.and_time(NaiveTime::from_hms_opt(4, 0, 0)?)).earliest()?;
            Some((d.format("%Y-%m-%d").to_string(), t.timestamp_millis()))
        })
        .collect()
}

pub fn ecrire(ctx: &Ctx) {
    let chemin = ctx.dossier.join(FICHIER);
    let (partager, actif) = {
        let r = ctx.reglages.read().unwrap();
        (r.partager_resume, r.collecte_active)
    };
    if !partager {
        let _ = std::fs::remove_file(&chemin);
        return;
    }
    if !actif {
        return;
    }
    let maintenant = maintenant_ms();
    let d = debuts(maintenant);
    let Some(premier) = d.first().map(|x| x.1) else { return };
    let Some(ev) = ctx
        .avec_archive(|a| a.evenements_periode(premier - 86_400_000, maintenant, &["fenetre", "session", "collecte", "application"]).ok())
        .flatten()
    else {
        return;
    };
    let jeux = noms_de_jeux(&ev);
    let r = Resume { version: 1, genere_ms: maintenant, jours: resumer(&ev, &jeux, &d, maintenant) };
    let tmp = chemin.with_extension("json.tmp");
    if std::fs::write(&tmp, serde_json::to_vec_pretty(&r).unwrap()).is_ok() {
        let _ = std::fs::rename(&tmp, &chemin);
    }
}
