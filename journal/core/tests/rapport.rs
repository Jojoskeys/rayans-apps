//! Temps d'écran, instant donné, projets et historique des fichiers, sur une journée fictive.

use journal_core::archive::ContenuEvenement;
use journal_core::rapport::*;
use journal_core::temps::Horodatage;
use journal_core::Evenement;

const H: i64 = 3_600_000;
const M: i64 = 60_000;
// 17/11/2026 00:00 à Paris (UTC+1) = 16/11/2026 23:00 UTC.
const JOUR: i64 = 1_794_870_000_000;

fn ev(id: i64, t: i64, cat: &str, action: &str, sujet: &str, appli: Option<&str>) -> Evenement {
    let h = Horodatage { utc_ms: t, decalage_min: 60, fuseau: "Europe/Paris".into(), precision: "exacte".into() };
    Evenement {
        id,
        categorie: cat.into(),
        action: action.into(),
        evenement: Some(h.clone()),
        detection: h,
        partiel: false,
        contenu: ContenuEvenement { sujet: sujet.into(), appli: appli.map(String::from), ..Default::default() },
    }
}

fn fen(id: i64, t: i64, titre: &str, appli: &str) -> Evenement {
    ev(id, t, "fenetre", "premier_plan", titre, Some(appli))
}

fn journee() -> Vec<Evenement> {
    vec![
        // La veille au soir : Chrome resté au premier plan, puis verrouillage.
        fen(1, JOUR - 2 * H, "YouTube - Google Chrome", "chrome.exe"),
        ev(2, JOUR - H, "session", "verrouillage", "Session verrouillée", None),
        // 9:00 déverrouillage, Word jusqu'à 10:30 (titre change à 9:30).
        ev(3, JOUR + 9 * H, "session", "deverrouillage", "", None),
        fen(4, JOUR + 9 * H, "Mémoire de stage.docx - Word", "WINWORD.EXE"),
        ev(5, JOUR + 9 * H + 30 * M, "fenetre", "titre", "Mémoire de stage.docx - Word (enregistré)", Some("WINWORD.EXE")),
        // 10:30 Roblox jusqu'à 11:00, puis inactif 11:00-11:20 (sans changer de fenêtre).
        fen(6, JOUR + 10 * H + 30 * M, "Roblox", "RobloxPlayerBeta.exe"),
        ev(7, JOUR + 11 * H, "session", "inactif", "", None),
        ev(8, JOUR + 11 * H + 20 * M, "session", "actif", "", None),
        // 11:40 pause de la collecte jusqu'à 12:00.
        ev(9, JOUR + 11 * H + 40 * M, "collecte", "pause", "", None),
        ev(10, JOUR + 12 * H, "collecte", "reprise", "Collecte reprise", None),
        // 12:30 appli du Store (passe par ApplicationFrameHost).
        fen(11, JOUR + 12 * H + 30 * M, "Calculatrice", "ApplicationFrameHost.exe"),
        // 12:40 : le PC s'éteint sans prévenir ; l'app se relance à 18:00 (trou signalé).
        {
            let mut e = ev(12, JOUR + 18 * H, "collecte", "reprise", "Suivi relancé avec l'application", None);
            e.contenu.note = Some("Suivi partiel entre … et …".into());
            e
        },
        fen(13, JOUR + 18 * H, "Projet échecs - Visual Studio Code", "Code.exe"),
        ev(14, JOUR + 18 * H + 45 * M, "session", "veille", "Mise en veille", None),
    ]
}

#[test]
fn temps_d_ecran_d_une_journee() {
    let jours = [JOUR];
    let regles = vec![
        RegleProjet { projet: "Mémoire".into(), mots: vec!["memoire".into()] },
        RegleProjet { projet: "Échecs".into(), mots: vec!["echecs".into()] },
    ];
    let r = rapport(&journee(), JOUR, JOUR + 24 * H, &jours, &regles);
    let d = |nom: &str| r.par_appli.iter().find(|x| x.nom == nom).map(|x| x.ms).unwrap_or(0);
    assert_eq!(d("WINWORD.EXE"), 90 * M);
    // Roblox : 10:30-11:00, 11:20-11:40, puis 12:00-12:30 après la pause (inactivité et pause exclues).
    assert_eq!(d("RobloxPlayerBeta.exe"), 80 * M);
    // Calculatrice : pas plus de 5 min comptées avant le trou (arrêt brutal).
    assert_eq!(d("Calculatrice"), PLAFOND_REPRISE_MS);
    assert_eq!(d("Code.exe"), 45 * M);
    // Chrome de la veille : verrouillé avant minuit, rien compté aujourd'hui.
    assert_eq!(d("chrome.exe"), 0);
    assert_eq!(r.actif_ms, r.par_appli.iter().map(|x| x.ms).sum::<i64>());
    assert_eq!(r.premiere_ms, Some(JOUR + 9 * H));
    assert_eq!(r.par_jour, vec![r.actif_ms]);
    // Par heure (heure de Paris) : 9h = 60 min de Word.
    assert_eq!(r.par_heure[9], 60 * M);
    assert_eq!(r.par_heure[10], 30 * M + 30 * M);
    // Projets d'après les titres.
    let p = |nom: &str| r.par_projet.iter().find(|x| x.nom == nom).map(|x| x.ms).unwrap_or(0);
    assert_eq!(p("Mémoire"), 90 * M);
    assert_eq!(p("Échecs"), 45 * M);
    // Par fenêtre : les deux titres de Word sont distincts.
    assert!(r.par_fenetre.iter().any(|f| f.nom == "WINWORD.EXE — Mémoire de stage.docx - Word" && f.ms == 30 * M));
}

#[test]
fn roblox_apres_la_pause() {
    let r = rapport(&journee(), JOUR + 12 * H, JOUR + 12 * H + 30 * M, &[], &[]);
    assert_eq!(r.par_appli, vec![Duree { nom: "RobloxPlayerBeta.exe".into(), ms: 30 * M }]);
}

#[test]
fn que_faisais_je_a_une_heure_precise() {
    let s = a_l_instant(&journee(), JOUR + 9 * H + 15 * M).unwrap();
    assert_eq!(s.appli, "WINWORD.EXE");
    assert_eq!((s.debut_ms, s.fin_ms), (JOUR + 9 * H, JOUR + 9 * H + 30 * M));
    assert!(a_l_instant(&journee(), JOUR + 11 * H + 10 * M).is_none(), "inactif à 11:10");
    assert!(a_l_instant(&journee(), JOUR + 3 * H).is_none(), "verrouillé la nuit");
}

#[test]
fn historique_d_un_fichier_telecharge_renomme_deplace() {
    let f = |id: i64, t: i64, action: &str, chemin: &str, ancien: Option<&str>| {
        let mut e = ev(id, t, "fichier", action, chemin.rsplit('\\').next().unwrap(), None);
        e.contenu.chemin = Some(chemin.into());
        e.contenu.ancien_chemin = ancien.map(String::from);
        e
    };
    let evs = vec![
        f(1, JOUR + H, "creation", r"C:\Users\lea\Downloads\facture_8841.pdf", None),
        f(2, JOUR + 2 * H, "renommage", r"C:\Users\lea\Downloads\Facture EDF novembre.pdf", Some(r"C:\Users\lea\Downloads\facture_8841.pdf")),
        f(3, JOUR + 3 * H, "deplacement", r"C:\Users\lea\Documents\Factures\Facture EDF novembre.pdf", Some(r"C:\Users\lea\Downloads\Facture EDF novembre.pdf")),
        f(4, JOUR + 4 * H, "modification", r"C:\Users\lea\Documents\notes.txt", None),
        f(5, JOUR + 5 * H, "suppression", r"C:\Users\lea\Documents\notes.txt", None),
    ];
    let h = historiques_fichiers(&evs, r"c:\users\lea\downloads\");
    assert_eq!(h.len(), 2);
    let facture = h.iter().find(|x| x.chemin.ends_with("Facture EDF novembre.pdf")).unwrap();
    assert_eq!(facture.chemins.len(), 3);
    assert!(facture.telecharge && facture.renomme && !facture.supprime);
    assert_eq!(facture.evenements.len(), 3);
    // On le retrouve par son nom d'origine.
    assert_eq!(filtrer_fichiers(h.clone(), "facture_8841", "").len(), 1);
    assert_eq!(filtrer_fichiers(h.clone(), "", "telecharge").len(), 1);
    let s = filtrer_fichiers(h, "", "supprime");
    assert_eq!(s.len(), 1);
    assert!(s[0].chemin.ends_with("notes.txt"));
}
