//! Tests du moteur sur des dossiers temporaires UNIQUEMENT (jamais les vrais Téléchargements ou Bureau).
//! Chaque test crée son propre bac à sable avec `tempfile` et vérifie qu'il est bien sous le dossier temporaire.

use rangement_core::config::Config;
use rangement_core::fsops::{move_no_replace, MoveError};
use rangement_core::journal::Record;
use rangement_core::rules::FileFacts;
use rangement_core::{apply_plan, build_plan, undo, Journal, OpKind, OpState, Plan, Rule};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

const DAY: u64 = 86_400;

struct Bac {
    _tmp: tempfile::TempDir,
    dl: PathBuf,
    bureau: PathBuf,
    quarantaine: PathBuf,
    root: PathBuf,
    journal: Journal,
}

fn bac() -> Bac {
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path().to_path_buf();
    let temp_root = std::env::temp_dir().canonicalize().unwrap();
    assert!(root.canonicalize().unwrap().starts_with(&temp_root), "les tests doivent rester dans le dossier temporaire");
    let dl = root.join("Téléchargements");
    let bureau = root.join("Bureau");
    std::fs::create_dir_all(&dl).unwrap();
    std::fs::create_dir_all(&bureau).unwrap();
    Bac {
        dl,
        bureau,
        quarantaine: root.join("Quarantaine"),
        journal: Journal::open(root.join("donnees").join("journal.jsonl")),
        root,
        _tmp: tmp,
    }
}

impl Bac {
    fn cfg(&self) -> Config {
        Config::first_run(Some(self.dl.clone()), Some(self.bureau.clone()), self.quarantaine.clone())
    }
}

/// Crée un fichier daté de `age_days` jours.
fn file(dir: &Path, name: &str, content: &str, age_days: u64) -> PathBuf {
    let p = dir.join(name);
    std::fs::create_dir_all(dir).unwrap();
    std::fs::write(&p, content).unwrap();
    let t = SystemTime::now() - Duration::from_secs(age_days * DAY + 3600);
    std::fs::File::options().write(true).open(&p).unwrap().set_modified(t).unwrap();
    p
}

fn read(p: &Path) -> String {
    std::fs::read_to_string(p).unwrap()
}

/// Tous les contenus de fichiers sous `root` (hors journal) : prouve que rien n'est perdu ni écrasé.
fn contents(root: &Path) -> Vec<String> {
    fn walk(dir: &Path, out: &mut Vec<String>) {
        for e in std::fs::read_dir(dir).unwrap().flatten() {
            let p = e.path();
            if p.is_dir() {
                if p.file_name().unwrap() != "donnees" {
                    walk(&p, out);
                }
            } else {
                out.push(std::fs::read_to_string(&p).unwrap());
            }
        }
    }
    let mut v = Vec::new();
    walk(root, &mut v);
    v.sort();
    v
}

fn all_ids(plan: &Plan) -> Vec<u32> {
    plan.items.iter().map(|i| i.id).collect()
}

fn item<'a>(plan: &'a Plan, source: &Path) -> &'a rangement_core::PlanItem {
    plan.items.iter().find(|i| i.source == source).unwrap_or_else(|| panic!("{} absent de l'aperçu", source.display()))
}

fn now() -> SystemTime {
    SystemTime::now()
}

// ----- Moteur de règles -------------------------------------------------------------------------

#[test]
fn regles_conditions_combinees() {
    let dl = PathBuf::from(if cfg!(windows) { r"C:\T" } else { "/t" });
    let ancien = now() - Duration::from_secs(40 * DAY);
    let mut r = Rule {
        name: "Vieilles factures".into(),
        extensions: vec![".PDF".into(), "docx".into()],
        name_pattern: "facture*; *invoice*".into(),
        older_than_days: Some(30),
        min_size: Some(10),
        max_size: Some(1000),
        target: "Factures".into(),
        ..Rule::default()
    };
    let f = |name: &str, size: u64, t: SystemTime| FileFacts::new(name, size, t);
    assert!(r.matches(&f("Facture-mars.pdf", 100, ancien), &dl, now()));
    assert!(r.matches(&f("my-INVOICE.docx", 100, ancien), &dl, now()));
    assert!(!r.matches(&f("Facture-mars.jpg", 100, ancien), &dl, now()), "extension");
    assert!(!r.matches(&f("devis.pdf", 100, ancien), &dl, now()), "nom");
    assert!(!r.matches(&f("Facture.pdf", 100, now()), &dl, now()), "âge");
    assert!(!r.matches(&f("Facture.pdf", 5, ancien), &dl, now()), "taille min");
    assert!(!r.matches(&f("Facture.pdf", 5000, ancien), &dl, now()), "taille max");
    // Date dans le futur : jamais « plus vieux que ».
    assert!(!r.matches(&f("Facture.pdf", 100, now() + Duration::from_secs(99 * DAY)), &dl, now()));
    r.folders = vec![PathBuf::from(if cfg!(windows) { r"c:\t\" } else { "/t/" })];
    assert!(r.matches(&f("Facture.pdf", 100, ancien), &dl, now()), "même dossier, casse et barre finale ignorées");
    r.folders = vec![PathBuf::from("/ailleurs")];
    assert!(!r.matches(&f("Facture.pdf", 100, ancien), &dl, now()), "dossier hors de portée");
    r.folders.clear();
    r.enabled = false;
    assert!(!r.matches(&f("Facture.pdf", 100, ancien), &dl, now()), "règle désactivée");
}

#[test]
fn regles_la_premiere_l_emporte() {
    let b = bac();
    let mut cfg = b.cfg();
    cfg.rules.insert(
        0,
        Rule { id: "cap".into(), name: "Captures".into(), name_pattern: "capture*".into(), target: "Captures".into(), ..Rule::default() },
    );
    let cap = file(&b.dl, "Capture 2026.png", "c", 1);
    let img = file(&b.dl, "vacances.png", "v", 1);
    let plan = build_plan(&cfg, now()).unwrap();
    assert_eq!(item(&plan, &cap).destination, b.dl.join("Captures").join("Capture 2026.png"));
    assert_eq!(item(&plan, &img).destination, b.dl.join("Images").join("Autres").join("vacances.png"));
}

#[test]
fn reglages_invalides_refuses() {
    let b = bac();
    let mut cfg = b.cfg();
    cfg.rules.push(Rule { name: "Tout".into(), target: "Tout".into(), ..Rule::default() });
    assert!(build_plan(&cfg, now()).unwrap_err().to_string().contains("aucune condition"));
    let mut cfg = b.cfg();
    cfg.rules[0].target = r"..\ailleurs".into();
    assert!(build_plan(&cfg, now()).is_err());
    let mut cfg = b.cfg();
    cfg.quarantine_dir = PathBuf::new();
    assert!(build_plan(&cfg, now()).is_err(), "doublons activés sans quarantaine");
}

#[test]
fn mode_automatique_desactive_par_defaut() {
    let b = bac();
    assert!(!Config::default().auto.enabled);
    assert!(!b.cfg().auto.enabled);
    assert_eq!(b.cfg().watched, vec![b.dl.clone(), b.bureau.clone()]);
}

#[test]
fn jetons_annee_mois() {
    let b = bac();
    let mut cfg = b.cfg();
    cfg.rules[0].target = "Documents/{annee}/{mois}".into();
    let p = file(&b.dl, "a.pdf", "a", 3);
    let plan = build_plan(&cfg, now()).unwrap();
    let dest = &item(&plan, &p).destination;
    let rel = dest.strip_prefix(b.dl.join("Documents")).unwrap();
    let parts: Vec<String> = rel.iter().map(|s| s.to_string_lossy().to_string()).collect();
    assert_eq!(parts.len(), 3);
    assert_eq!(parts[0].len(), 4);
    assert_eq!(parts[1].len(), 2);
}

// ----- Aperçu ----------------------------------------------------------------------------------

#[test]
fn apercu_sans_effet_et_regles_par_defaut() {
    let b = bac();
    let photo = file(&b.dl, "photo.JPG", "photo", 1);
    let rapport = file(&b.dl, "rapport.pdf", "rapport", 1);
    let setup = file(&b.dl, "setup.exe", "setup", 1);
    let sans_ext = file(&b.dl, "notes", "notes", 1);
    let outil = file(&b.bureau, "outil.exe", "outil", 1);
    let image = file(&b.bureau, "image.png", "image", 1);
    let rangé = file(&b.dl.join("Images"), "deja.png", "deja", 1);
    let avant = contents(&b.root);

    let plan = build_plan(&b.cfg(), now()).unwrap();
    assert_eq!(item(&plan, &photo).destination, b.dl.join("Images").join("Autres").join("photo.JPG"));
    assert_eq!(item(&plan, &rapport).destination, b.dl.join("Documents").join("PDF").join("Autres").join("rapport.pdf"));
    assert_eq!(item(&plan, &setup).destination, b.dl.join("Installateurs").join("Autres").join("setup.exe"));
    assert_eq!(item(&plan, &image).destination, b.bureau.join("Images").join("Autres").join("image.png"));
    assert!(plan.items.iter().all(|i| i.source != outil), "un .exe du Bureau n'est pas rangé");
    assert_eq!(item(&plan, &sans_ext).destination, b.dl.join("Autres fichiers").join("Autres").join("notes"));
    assert!(plan.items.iter().all(|i| i.source != rangé), "les sous-dossiers ne sont pas parcourus");
    assert!(plan.items.iter().all(|i| i.kind == OpKind::Ranger && !i.renamed));
    // L'aperçu ne touche à rien.
    assert_eq!(contents(&b.root), avant);
    assert!(photo.exists() && !b.dl.join("Images").join("Autres").join("photo.JPG").exists());
}

#[test]
fn apercu_ignore_recents_temporaires_et_dossiers() {
    let b = bac();
    let recent = file(&b.dl, "tout-neuf.pdf", "n", 0);
    std::fs::File::options().write(true).open(&recent).unwrap().set_modified(now()).unwrap();
    file(&b.dl, "film.mp4.crdownload", "x", 1);
    file(&b.dl, "gros.zip.part", "x", 1);
    file(&b.dl, "~$lettre.docx", "x", 1);
    file(&b.dl, "desktop.ini", "x", 1);
    std::fs::create_dir_all(b.dl.join("Un dossier.pdf")).unwrap();
    let plan = build_plan(&b.cfg(), now()).unwrap();
    assert!(plan.items.is_empty(), "{:?}", plan.items);
    assert_eq!(plan.skipped.len(), 1);
    assert_eq!(plan.skipped[0].path, recent);
    assert!(plan.skipped[0].reason.contains("moins de 2 min"));
}

#[test]
fn dossier_surveille_introuvable_signale() {
    let b = bac();
    let mut cfg = b.cfg();
    cfg.watched.push(b.root.join("nexiste-pas"));
    let plan = build_plan(&cfg, now()).unwrap();
    assert!(plan.skipped.iter().any(|s| s.path == b.root.join("nexiste-pas")));
}

// ----- Conflits : jamais d'écrasement ------------------------------------------------------------

#[test]
fn conflit_a_l_apercu_renomme() {
    let b = bac();
    file(&b.dl.join("Images").join("Autres"), "photo.jpg", "ancienne", 5);
    file(&b.dl.join("Images").join("Autres"), "photo (2).jpg", "ancienne 2", 5);
    let p = file(&b.dl, "photo.jpg", "nouvelle", 1);
    let plan = build_plan(&b.cfg(), now()).unwrap();
    let it = item(&plan, &p);
    assert_eq!(it.destination, b.dl.join("Images").join("Autres").join("photo (3).jpg"));
    assert!(it.renamed);
}

#[test]
fn deux_fichiers_meme_destination_dans_le_meme_apercu() {
    let b = bac();
    let mut cfg = b.cfg();
    let commun = b.root.join("Tout");
    for r in &mut cfg.rules {
        r.target = commun.to_string_lossy().to_string();
    }
    let a = file(&b.dl, "doc.pdf", "un", 1);
    let c = file(&b.bureau, "doc.pdf", "deux", 1);
    let plan = build_plan(&cfg, now()).unwrap();
    let mut dests = vec![item(&plan, &a).destination.clone(), item(&plan, &c).destination.clone()];
    dests.sort();
    assert_eq!(dests, vec![commun.join("doc (2).pdf"), commun.join("doc.pdf")]);
    let avant = contents(&b.root);
    let r = apply_plan(&plan, &all_ids(&plan), &b.journal, "manuel").unwrap();
    assert_eq!(r.moved.len(), 2);
    assert_eq!(contents(&b.root), avant);
}

#[test]
fn conflit_apparu_apres_l_apercu_renomme_sans_ecraser() {
    let b = bac();
    let p = file(&b.dl, "photo.jpg", "à ranger", 1);
    let plan = build_plan(&b.cfg(), now()).unwrap();
    // Un autre fichier du même nom apparaît entre l'aperçu et la validation.
    let intrus = file(&b.dl.join("Images").join("Autres"), "photo.jpg", "intrus", 1);
    let r = apply_plan(&plan, &all_ids(&plan), &b.journal, "manuel").unwrap();
    assert_eq!(r.moved.len(), 1);
    assert!(r.moved[0].renamed);
    assert_eq!(r.moved[0].destination, b.dl.join("Images").join("Autres").join("photo (2).jpg"));
    assert_eq!(read(&intrus), "intrus", "le fichier existant n'est pas écrasé");
    assert_eq!(read(&b.dl.join("Images").join("Autres").join("photo (2).jpg")), "à ranger");
    assert!(!p.exists());
}

#[test]
fn deplacement_bas_niveau_refuse_d_ecraser() {
    let b = bac();
    let a = file(&b.dl, "a.txt", "A", 1);
    let c = file(&b.dl, "c.txt", "C", 1);
    assert!(matches!(move_no_replace(&a, &c), Err(MoveError::Exists)));
    assert_eq!(read(&a), "A");
    assert_eq!(read(&c), "C");
    assert!(matches!(move_no_replace(&b.dl.join("absent"), &b.dl.join("x")), Err(MoveError::NotFound)));
}

// ----- Application -----------------------------------------------------------------------------

#[test]
fn seuls_les_elements_coches_sont_deplaces() {
    let b = bac();
    let a = file(&b.dl, "a.pdf", "a", 1);
    let c = file(&b.dl, "c.png", "c", 1);
    let plan = build_plan(&b.cfg(), now()).unwrap();
    let r = apply_plan(&plan, &[item(&plan, &a).id], &b.journal, "manuel").unwrap();
    assert_eq!(r.moved.len(), 1);
    assert!(!a.exists() && c.exists());
}

#[test]
fn fichier_modifie_ou_disparu_depuis_l_apercu() {
    let b = bac();
    let modifie = file(&b.dl, "modifie.pdf", "v1", 1);
    let disparu = file(&b.dl, "disparu.pdf", "x", 1);
    let plan = build_plan(&b.cfg(), now()).unwrap();
    std::fs::write(&modifie, "version 2 plus longue").unwrap();
    std::fs::rename(&disparu, b.root.join("ailleurs.pdf")).unwrap();
    let r = apply_plan(&plan, &all_ids(&plan), &b.journal, "manuel").unwrap();
    assert!(r.moved.is_empty());
    assert_eq!(r.failed.len(), 2);
    assert!(r.batch.is_none());
    assert!(modifie.exists());
    assert!(b.journal.batches().unwrap().is_empty(), "rien au journal si rien n'a bougé");
}

#[cfg(windows)]
#[test]
fn fichier_en_cours_d_utilisation_laisse_en_place() {
    use std::os::windows::fs::OpenOptionsExt;
    let b = bac();
    let ouvert = file(&b.dl, "ouvert.docx", "o", 1);
    let libre = file(&b.dl, "libre.docx", "l", 1);
    {
        let _verrou = std::fs::OpenOptions::new().read(true).share_mode(0).open(&ouvert).unwrap();
        let plan = build_plan(&b.cfg(), now()).unwrap();
        assert!(plan.items.iter().all(|i| i.source != ouvert));
        assert!(plan.skipped.iter().any(|s| s.path == ouvert && s.reason.contains("utilisation")));
        assert!(plan.items.iter().any(|i| i.source == libre));
    }
    // Ouvert entre l'aperçu et la validation.
    let plan = build_plan(&b.cfg(), now()).unwrap();
    let _verrou = std::fs::OpenOptions::new().read(true).share_mode(0).open(&ouvert).unwrap();
    let r = apply_plan(&plan, &all_ids(&plan), &b.journal, "manuel").unwrap();
    assert!(r.failed.iter().any(|f| f.path == ouvert && f.reason.contains("utilisation")));
    assert!(ouvert.exists());
    assert!(!libre.exists());
}

// ----- Doublons ----------------------------------------------------------------------------------

#[test]
fn doublons_en_quarantaine_jamais_supprimes() {
    let b = bac();
    let original = file(&b.dl, "contrat.pdf", "même contenu", 10);
    let copie = file(&b.dl, "contrat (1).pdf", "même contenu", 2);
    let copie_bureau = file(&b.bureau, "contrat.pdf", "même contenu", 1);
    let meme_taille = file(&b.dl, "autre.pdf", "MÊME CONTENU", 1);
    let vide1 = file(&b.dl, "vide1.txt", "", 1);
    let _vide2 = file(&b.dl, "vide2.txt", "", 1);
    let avant = contents(&b.root);

    let plan = build_plan(&b.cfg(), now()).unwrap();
    let doublons: Vec<_> = plan.items.iter().filter(|i| i.kind == OpKind::Doublon).collect();
    assert_eq!(doublons.len(), 2, "{doublons:?}");
    assert!(doublons.iter().all(|d| d.duplicate_of.as_deref() == Some(original.as_path())));
    assert!(doublons.iter().all(|d| d.destination.starts_with(&b.quarantaine)));
    assert!(plan.items.iter().all(|i| i.source != meme_taille || i.kind == OpKind::Ranger));
    assert!(plan.items.iter().all(|i| i.source != vide1 || i.kind == OpKind::Ranger), "fichiers vides ≠ doublons");
    // Les deux copies portent le même nom en quarantaine : la seconde est renommée.
    let noms: Vec<String> = doublons.iter().map(|d| d.destination.file_name().unwrap().to_string_lossy().to_string()).collect();
    assert!(noms.contains(&"contrat (1).pdf".to_string()) && noms.contains(&"contrat.pdf".to_string()));

    let r = apply_plan(&plan, &all_ids(&plan), &b.journal, "manuel").unwrap();
    assert!(r.failed.is_empty(), "{:?}", r.failed);
    assert!(!copie.exists() && !copie_bureau.exists());
    assert_eq!(read(&b.dl.join("Documents").join("PDF").join("Travail").join("contrat.pdf")), "même contenu", "l'original est rangé normalement");
    assert_eq!(contents(&b.root), avant, "aucun fichier perdu");

    let u = undo(&b.journal, r.batch.as_deref().unwrap(), None).unwrap();
    assert!(u.failed.is_empty(), "{:?}", u.failed);
    assert_eq!(read(&copie), "même contenu");
    assert_eq!(read(&copie_bureau), "même contenu");
    assert_eq!(read(&original), "même contenu");
    assert_eq!(contents(&b.root), avant);
}

#[test]
fn doublon_non_confirme_si_l_original_change() {
    let b = bac();
    let mut cfg = b.cfg();
    cfg.rules.clear();
    let original = file(&b.dl, "a.bin", "xyz", 5);
    let copie = file(&b.dl, "b.bin", "xyz", 1);
    let plan = build_plan(&cfg, now()).unwrap();
    assert_eq!(plan.items.len(), 1);
    std::fs::write(&original, "abc").unwrap();
    let r = apply_plan(&plan, &all_ids(&plan), &b.journal, "manuel").unwrap();
    assert!(r.moved.is_empty());
    assert!(r.failed[0].reason.contains("doublon non confirmé"));
    assert!(copie.exists());
}

#[test]
fn doublons_desactives() {
    let b = bac();
    let mut cfg = b.cfg();
    cfg.duplicates = false;
    file(&b.dl, "a.pdf", "x", 5);
    file(&b.dl, "b.pdf", "x", 1);
    let plan = build_plan(&cfg, now()).unwrap();
    assert!(plan.items.iter().all(|i| i.kind == OpKind::Ranger));
}

// ----- Annulation ------------------------------------------------------------------------------

#[test]
fn annuler_un_rangement_complet() {
    let b = bac();
    let fichiers = [
        file(&b.dl, "a.pdf", "a", 1),
        file(&b.dl, "b.png", "b", 1),
        file(&b.dl, "c.zip", "c", 1),
        file(&b.bureau, "d.mp3", "d", 1),
    ];
    let avant = contents(&b.root);
    let plan = build_plan(&b.cfg(), now()).unwrap();
    let r = apply_plan(&plan, &all_ids(&plan), &b.journal, "manuel").unwrap();
    assert_eq!(r.moved.len(), 4);
    assert!(fichiers.iter().all(|f| !f.exists()));

    let hist = b.journal.batches().unwrap();
    assert_eq!(hist.len(), 1);
    assert_eq!(hist[0].origin, "manuel");
    assert!(hist[0].ops.iter().all(|o| o.state == OpState::Fait));

    let u = undo(&b.journal, &hist[0].id, None).unwrap();
    assert_eq!(u.restored.len(), 4);
    assert!(fichiers.iter().all(|f| f.exists()));
    assert_eq!(contents(&b.root), avant);
    let hist = b.journal.batches().unwrap();
    assert!(hist[0].ops.iter().all(|o| o.state == OpState::Annule));

    // Annuler deux fois ne fait rien de plus.
    let u2 = undo(&b.journal, &hist[0].id, None).unwrap();
    assert!(u2.restored.is_empty() && u2.failed.is_empty());
    assert_eq!(contents(&b.root), avant);
}

#[test]
fn annuler_une_seule_operation() {
    let b = bac();
    let a = file(&b.dl, "a.pdf", "a", 1);
    let c = file(&b.dl, "c.png", "c", 1);
    let plan = build_plan(&b.cfg(), now()).unwrap();
    let r = apply_plan(&plan, &all_ids(&plan), &b.journal, "manuel").unwrap();
    let id_a = item(&plan, &a).id;
    undo(&b.journal, r.batch.as_deref().unwrap(), Some(&[id_a])).unwrap();
    assert!(a.exists() && !c.exists());
    let ops = &b.journal.batches().unwrap()[0].ops;
    assert_eq!(ops.iter().find(|o| o.op == id_a).unwrap().state, OpState::Annule);
    assert_eq!(ops.iter().find(|o| o.op != id_a).unwrap().state, OpState::Fait);
}

#[test]
fn annuler_quand_la_place_d_origine_est_prise() {
    let b = bac();
    let a = file(&b.dl, "a.pdf", "rangé", 1);
    let plan = build_plan(&b.cfg(), now()).unwrap();
    let r = apply_plan(&plan, &all_ids(&plan), &b.journal, "manuel").unwrap();
    let nouveau = file(&b.dl, "a.pdf", "nouveau venu", 0);
    let u = undo(&b.journal, r.batch.as_deref().unwrap(), None).unwrap();
    assert_eq!(u.restored.len(), 1);
    assert!(u.restored[0].renamed);
    assert_eq!(u.restored[0].destination, b.dl.join("a (2).pdf"));
    assert_eq!(read(&nouveau), "nouveau venu");
    assert_eq!(read(&b.dl.join("a (2).pdf")), "rangé");
    let op = &b.journal.batches().unwrap()[0].ops[0];
    assert_eq!(op.restored_to.as_deref(), Some(b.dl.join("a (2).pdf").as_path()));
    assert!(a.exists());
}

#[test]
fn annuler_quand_le_fichier_range_a_disparu() {
    let b = bac();
    file(&b.dl, "a.pdf", "a", 1);
    let plan = build_plan(&b.cfg(), now()).unwrap();
    let r = apply_plan(&plan, &all_ids(&plan), &b.journal, "manuel").unwrap();
    std::fs::rename(&r.moved[0].destination, b.root.join("deplace-par-moi.pdf")).unwrap();
    let avant = contents(&b.root);
    let u = undo(&b.journal, r.batch.as_deref().unwrap(), None).unwrap();
    assert!(u.restored.is_empty());
    assert_eq!(u.failed.len(), 1);
    assert!(u.failed[0].reason.contains("n'est plus"));
    assert_eq!(contents(&b.root), avant);
}

#[test]
fn annulation_d_un_lot_inconnu() {
    let b = bac();
    assert!(undo(&b.journal, "inexistant", None).is_err());
}

#[test]
fn historique_du_plus_recent_au_plus_ancien() {
    let b = bac();
    file(&b.dl, "a.pdf", "a", 1);
    let p1 = build_plan(&b.cfg(), now()).unwrap();
    let r1 = apply_plan(&p1, &all_ids(&p1), &b.journal, "manuel").unwrap();
    file(&b.dl, "b.png", "b", 1);
    let p2 = build_plan(&b.cfg(), now()).unwrap();
    let r2 = apply_plan(&p2, &all_ids(&p2), &b.journal, "automatique").unwrap();
    let hist = b.journal.batches().unwrap();
    assert_eq!(hist.len(), 2);
    assert_eq!(Some(hist[0].id.clone()), r2.batch);
    assert_eq!(Some(hist[1].id.clone()), r1.batch);
    assert_eq!(hist[0].origin, "automatique");
}

// ----- Journal : reprise après une coupure ------------------------------------------------------

#[test]
fn journal_reprise_apres_coupure() {
    let b = bac();
    let deplace = file(&b.dl, "deplace.pdf", "d", 1);
    let reste = file(&b.dl, "reste.pdf", "r", 1);
    let dest_deplace = b.dl.join("Documents").join("deplace.pdf");
    let dest_reste = b.dl.join("Documents").join("reste.pdf");
    let j = &b.journal;
    j.append(&Record::Batch { id: "lot".into(), date: "2026-11-12 10:00:00".into(), origin: "manuel".into() }).unwrap();
    // Intention inscrite, déplacement fait, mais coupure avant « fait ».
    j.append(&Record::Intent { batch: "lot".into(), op: 1, kind: OpKind::Ranger, from: deplace.clone(), to: dest_deplace.clone(), reason: "r".into() }).unwrap();
    move_no_replace(&deplace, &dest_deplace).unwrap();
    // Intention inscrite, coupure avant le déplacement.
    j.append(&Record::Intent { batch: "lot".into(), op: 2, kind: OpKind::Ranger, from: reste.clone(), to: dest_reste.clone(), reason: "r".into() }).unwrap();
    // Ligne à moitié écrite.
    let mut f = std::fs::OpenOptions::new().append(true).open(j.path()).unwrap();
    std::io::Write::write_all(&mut f, b"{\"t\":\"done\",\"batch\":\"lo").unwrap();
    drop(f);

    let hist = j.batches().unwrap();
    assert_eq!(hist.len(), 1);
    assert_eq!(hist[0].ops.len(), 1, "l'opération jamais faite n'apparaît pas");
    assert_eq!(hist[0].ops[0].state, OpState::Fait);
    let u = undo(j, "lot", None).unwrap();
    assert_eq!(u.restored.len(), 1);
    assert!(deplace.exists() && reste.exists());
}

// ----- Garantie générale -----------------------------------------------------------------------

#[test]
fn aucun_fichier_perdu_sur_un_gros_rangement() {
    let b = bac();
    let mut cfg = b.cfg();
    cfg.rules[1].target = "Documents/{annee}".into();
    for i in 0..60 {
        let ext = ["pdf", "png", "zip", "mp3", "txt", "xyz"][i % 6];
        let contenu = if i % 7 == 0 { "doublon".to_string() } else { format!("fichier {i}") };
        file(if i % 2 == 0 { &b.dl } else { &b.bureau }, &format!("f{}.{ext}", i % 10), &contenu, (i % 5) as u64 + 1);
    }
    // Des fichiers déjà présents aux destinations pour forcer des renommages.
    file(&b.dl.join("Images"), "f1.png", "existant", 9);
    file(&b.bureau.join("Archives"), "f2.zip", "existant", 9);
    let avant = contents(&b.root);
    let plan = build_plan(&cfg, now()).unwrap();
    assert!(plan.items.len() > 10);
    let r = apply_plan(&plan, &all_ids(&plan), &b.journal, "manuel").unwrap();
    assert!(r.failed.is_empty(), "{:?}", r.failed);
    assert_eq!(contents(&b.root), avant);
    let u = undo(&b.journal, r.batch.as_deref().unwrap(), None).unwrap();
    assert!(u.failed.is_empty(), "{:?}", u.failed);
    assert_eq!(contents(&b.root), avant);
    // Après annulation, plus aucun fichier dans les sous-dossiers créés (hors ceux qui existaient).
    assert!(!b.quarantaine.exists() || std::fs::read_dir(b.quarantaine.read_dir().unwrap().next().unwrap().unwrap().path()).unwrap().next().is_none());
}

// ----- Thèmes ------------------------------------------------------------------------------------

/// Crée un vrai PDF d'une page contenant `text` (pour tester la lecture de la 1re page).
fn pdf(dir: &Path, name: &str, text: &str) -> PathBuf {
    use lopdf::content::{Content, Operation};
    use lopdf::{dictionary, Document, Object, Stream};
    let mut doc = Document::with_version("1.5");
    let pages_id = doc.new_object_id();
    let font_id = doc.add_object(dictionary! { "Type" => "Font", "Subtype" => "Type1", "BaseFont" => "Helvetica" });
    let resources_id = doc.add_object(dictionary! { "Font" => dictionary! { "F1" => font_id } });
    let content = Content {
        operations: vec![
            Operation::new("BT", vec![]),
            Operation::new("Tf", vec!["F1".into(), 18.into()]),
            Operation::new("Td", vec![72.into(), 700.into()]),
            Operation::new("Tj", vec![Object::string_literal(text)]),
            Operation::new("ET", vec![]),
        ],
    };
    let content_id = doc.add_object(Stream::new(dictionary! {}, content.encode().unwrap()));
    let page_id = doc.add_object(dictionary! { "Type" => "Page", "Parent" => pages_id, "Contents" => content_id });
    let pages = dictionary! {
        "Type" => "Pages", "Kids" => vec![page_id.into()], "Count" => 1,
        "Resources" => resources_id, "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
    };
    doc.objects.insert(pages_id, Object::Dictionary(pages));
    let catalog_id = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
    doc.trailer.set("Root", catalog_id);
    std::fs::create_dir_all(dir).unwrap();
    let p = dir.join(name);
    doc.save(&p).unwrap();
    let t = SystemTime::now() - Duration::from_secs(DAY);
    std::fs::File::options().write(true).open(&p).unwrap().set_modified(t).unwrap();
    p
}

#[test]
fn themes_d_apres_le_nom_pour_tous_les_types() {
    let b = bac();
    let cas = [
        (file(&b.dl, "Facture_EDF_mars.pdf", "1", 1), b.dl.join("Documents").join("PDF").join("Factures"), "facture"),
        (file(&b.dl, "Relevé bancaire octobre.pdf", "2", 1), b.dl.join("Documents").join("PDF").join("Banque"), "releve"),
        (file(&b.dl, "AVIS D'IMPÔT 2025.pdf", "3", 1), b.dl.join("Documents").join("PDF").join("Impôts"), "impot"),
        (file(&b.dl, "RIB.docx", "4", 1), b.dl.join("Documents").join("Word").join("Banque"), "rib"),
        (file(&b.dl, "bulletin-de-paie-oct.xlsx", "5", 1), b.dl.join("Documents").join("Excel").join("Travail"), "bulletin de paie"),
        (file(&b.dl, "Ordonnance dr Martin.jpg", "6", 1), b.dl.join("Images").join("Santé"), "ordonnance"),
        (file(&b.dl, "passeport scans.zip", "7", 1), b.dl.join("Archives").join("Identité"), "passeport"),
        (file(&b.dl, "quittance_loyer.txt", "8", 1), b.dl.join("Documents").join("Texte").join("Logement"), "quittance"),
        (file(&b.dl, "Billet-SNCF.pptx", "9", 1), b.dl.join("Documents").join("PowerPoint").join("Voyages"), "billet"),
    ];
    let inconnu = file(&b.dl, "truc sans theme.pdf", "10", 1);
    let plan = build_plan(&b.cfg(), now()).unwrap();
    for (src, dir, mot) in &cas {
        let it = item(&plan, src);
        assert_eq!(it.destination, dir.join(src.file_name().unwrap()), "{}", src.display());
        assert_eq!(it.theme.as_deref(), Some(dir.file_name().unwrap().to_str().unwrap()));
        let pourquoi = it.theme_reason.as_deref().unwrap();
        assert!(pourquoi.contains(mot) && pourquoi.contains("dans le nom"), "{pourquoi}");
    }
    let it = item(&plan, &inconnu);
    assert_eq!(it.destination, b.dl.join("Documents").join("PDF").join("Autres").join("truc sans theme.pdf"));
    assert_eq!(it.theme.as_deref(), Some("Autres"));
    assert!(it.theme_reason.as_deref().unwrap().contains("aucun mot-clé"));

    // Application puis annulation à travers les sous-dossiers de thème : rien de perdu.
    let avant = contents(&b.root);
    let r = apply_plan(&plan, &all_ids(&plan), &b.journal, "manuel").unwrap();
    assert!(r.failed.is_empty(), "{:?}", r.failed);
    assert_eq!(contents(&b.root), avant);
    undo(&b.journal, r.batch.as_deref().unwrap(), None).unwrap();
    assert!(cas.iter().all(|(src, _, _)| src.exists()));
    assert_eq!(contents(&b.root), avant);
}

#[test]
fn themes_personnalises_et_ordre() {
    let b = bac();
    let mut cfg = b.cfg();
    cfg.themes.insert(
        0,
        rangement_core::config::Theme { name: "Voiture".into(), keywords: vec!["carte grise".into(), "assurance auto".into()] },
    );
    let p = file(&b.dl, "Carte-Grise.pdf", "cg", 1);
    let plan = build_plan(&cfg, now()).unwrap();
    assert_eq!(item(&plan, &p).destination, b.dl.join("Documents").join("PDF").join("Voiture").join("Carte-Grise.pdf"));

    // Thème sans mot-clé ou en double : refusé.
    cfg.themes[0].keywords.clear();
    assert!(build_plan(&cfg, now()).unwrap_err().to_string().contains("aucun mot-clé"));
    cfg.themes[0] = rangement_core::config::Theme { name: "factures".into(), keywords: vec!["x".into()] };
    assert!(build_plan(&cfg, now()).unwrap_err().to_string().contains("deux fois"));
}

#[test]
fn theme_lu_dans_la_premiere_page_du_pdf() {
    let b = bac();
    let scan = pdf(&b.dl, "scan_0042.pdf", "FACTURE numero 2026-118 - Montant total a payer");
    let nom_gagne = pdf(&b.dl, "ordonnance.pdf", "Facture de la pharmacie");
    let sans_mot = pdf(&b.dl, "document.pdf", "Bonjour, voici le compte rendu de la reunion");
    let abime = file(&b.dl, "abime.pdf", "%PDF-1.5 ceci n'est pas un vrai PDF", 1);

    let plan = build_plan(&b.cfg(), now()).unwrap();
    let it = item(&plan, &scan);
    assert_eq!(it.theme.as_deref(), Some("Factures"));
    assert!(it.theme_reason.as_deref().unwrap().contains("1re page"), "{:?}", it.theme_reason);
    assert_eq!(item(&plan, &nom_gagne).theme.as_deref(), Some("Santé"), "le nom passe avant le contenu");
    assert_eq!(item(&plan, &sans_mot).theme.as_deref(), Some("Autres"));
    assert_eq!(item(&plan, &abime).theme.as_deref(), Some("Autres"), "PDF illisible : pas d'erreur, « Autres »");

    // Lecture des PDF désactivée : seul le nom compte.
    let mut cfg = b.cfg();
    cfg.read_pdf_text = false;
    let plan = build_plan(&cfg, now()).unwrap();
    assert_eq!(item(&plan, &scan).theme.as_deref(), Some("Autres"));
    // Lire le PDF ne le modifie pas.
    assert!(scan.exists());
}

#[test]
fn destination_sans_jeton_theme_inchangee() {
    let b = bac();
    let mut cfg = b.cfg();
    cfg.rules[0].target = "Mes PDF".into();
    let p = file(&b.dl, "facture.pdf", "f", 1);
    let plan = build_plan(&cfg, now()).unwrap();
    let it = item(&plan, &p);
    assert_eq!(it.destination, b.dl.join("Mes PDF").join("facture.pdf"));
    assert!(it.theme.is_none());
}