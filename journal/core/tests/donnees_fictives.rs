//! Test de bout en bout avec les exports fictifs de `exemples/` : texte mot pour mot, horodatages
//! (envoi ≠ archivage), recherche, versions d'un message modifié, et conservation d'un message archivé
//! avant sa suppression. Tout se passe dans un dossier temporaire.

use journal_core::archive::{etat, statut, ContenuEvenement, MessageVue};
use journal_core::imports::{self, paquet};
use journal_core::temps::{precision, FuseauFixe, Horodatage};
use journal_core::texte::ReglesSecrets;
use journal_core::{Archive, Filtre, NouvelEvenement};
use std::path::{Path, PathBuf};

const CLE: [u8; 32] = [7u8; 32];
const IMPORT_1: i64 = 1_794_800_000_000; // 16/11/2026
const IMPORT_2: i64 = 1_794_900_000_000; // 17/11/2026, après

fn exemples() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("exemples")
}

fn paris() -> FuseauFixe {
    FuseauFixe { decalage_min: 60, nom: "Europe/Paris".into() }
}

fn importer(a: &mut Archive, rel: &str, quand: i64) -> journal_core::archive::RapportImport {
    let chemin = exemples().join(rel);
    let p = paquet::ouvrir(&chemin).unwrap();
    let nom = chemin.file_name().unwrap().to_string_lossy().into_owned();
    let lot = imports::lire(p.as_ref(), &nom, &paris()).unwrap();
    a.importer(&lot, p.as_ref(), &nom, quand).unwrap()
}

fn messages(a: &Archive, appli: &str) -> Vec<MessageVue> {
    let mut v = a.chercher_messages(&Filtre { appli: Some(appli.into()), ..Default::default() }).unwrap();
    v.sort_by_key(|m| (m.envoi.utc_ms, m.id));
    v
}

fn utc(s: &str) -> i64 {
    chrono::DateTime::parse_from_rfc3339(s).unwrap().timestamp_millis()
}

#[test]
fn whatsapp_mot_pour_mot_horodatage_et_suppression() {
    let dir = tempfile::tempdir().unwrap();
    let mut a = Archive::ouvrir(dir.path(), &CLE).unwrap();

    // --- Premier export ---
    let r = importer(&mut a, "whatsapp/1-premier-export", IMPORT_1);
    assert_eq!(r.nouveaux, 5, "{r:?}");
    let ms = messages(&a, "whatsapp");
    assert_eq!(ms.len(), 5);
    assert_eq!(ms[0].conversation_nom, "Léa Exemple");
    assert_eq!(ms[0].auteur.as_deref(), Some("Léa Exemple"));
    assert_eq!(ms[0].versions[0].texte, "Salut ! Tu viens samedi ? 🎉");
    assert_eq!(ms[1].versions[0].texte, "Oui, bien sûr… « à 20 h » ?");
    // Message sur plusieurs lignes, sauts de ligne et emoji avec sélecteur de variante conservés.
    assert_eq!(ms[2].versions[0].texte, "Parfait 👍\nPense à apporter :\n- le gâteau\n- les bougies 🕯️");
    assert_eq!(ms[3].versions[0].texte, "Désolé, je me suis trompé de discussion 😅  (deux espaces avant la parenthèse)");
    // Emoji composé (famille, 7 points de code avec liaisons) intact.
    assert_eq!(ms[4].versions[0].texte, "Famille 👨\u{200d}👩\u{200d}👧\u{200d}👦 au complet !");

    // Heure d'envoi (heure locale du téléphone à la seconde, fuseau déduit) ≠ heure d'archivage.
    assert_eq!(ms[0].envoi.utc_ms, utc("2026-11-15T08:14:02Z"));
    assert_eq!(ms[0].envoi.decalage_min, 60);
    assert_eq!(ms[0].envoi.precision, precision::SECONDE);
    assert!(ms[0].envoi.fuseau.contains("déduit"));
    assert_eq!(ms[0].archive_ms, IMPORT_1);
    assert_eq!(ms[0].envoi.lisible(), "2026-11-15 09:14:02.000 +01:00");

    // --- Réimport du même export : rien en double ---
    let r = importer(&mut a, "whatsapp/1-premier-export", IMPORT_1 + 1000);
    assert_eq!((r.nouveaux, r.inchanges), (0, 5));

    // --- Export suivant : un message modifié, un supprimé pour tous, un nouveau ---
    let r = importer(&mut a, "whatsapp/2-export-suivant", IMPORT_2);
    assert_eq!((r.nouveaux, r.nouvelles_versions, r.suppressions_signalees), (1, 1, 1), "{r:?}");
    let ms = messages(&a, "whatsapp");
    assert_eq!(ms.len(), 6);

    let modifie = &ms[2];
    assert_eq!(modifie.versions.len(), 2);
    assert_eq!(modifie.versions[0].statut, statut::ORIGINAL);
    assert_eq!(modifie.versions[0].archive_ms, IMPORT_1);
    assert_eq!(modifie.versions[1].statut, statut::MODIFIEE);
    assert_eq!(modifie.versions[1].texte, "Parfait 👍\nPense à apporter :\n- le gâteau\n- les bougies 🕯️\n- des assiettes");
    assert_eq!(modifie.versions[1].archive_ms, IMPORT_2);
    assert_eq!(modifie.envoi.utc_ms, utc("2026-11-15T08:16:10Z"), "l'heure d'envoi ne change pas");

    // Le message supprimé reste lisible tel qu'archivé avant la suppression.
    let supprime = &ms[3];
    assert_eq!(supprime.etat, etat::SUPPRESSION_SIGNALEE);
    assert_eq!(supprime.etat_ms, Some(IMPORT_2));
    assert_eq!(supprime.versions[0].texte, "Désolé, je me suis trompé de discussion 😅  (deux espaces avant la parenthèse)");
    assert_eq!(supprime.versions[0].statut, statut::ORIGINAL);
    assert_eq!(supprime.versions.last().unwrap().statut, statut::MENTION_SUPPRESSION);
    assert!(supprime.etat_note.as_deref().unwrap().contains("conservé"));

    assert_eq!(ms[5].versions[0].texte, "À samedi 😊");
}

#[test]
fn whatsapp_supprime_avant_le_premier_archivage_n_invente_rien() {
    let dir = tempfile::tempdir().unwrap();
    let mut a = Archive::ouvrir(dir.path(), &CLE).unwrap();
    importer(&mut a, "whatsapp/2-export-suivant", IMPORT_2);
    let ms = messages(&a, "whatsapp");
    let s = ms.iter().find(|m| m.etat == etat::SUPPRESSION_SIGNALEE).unwrap();
    assert_eq!(s.versions.len(), 1);
    assert_eq!(s.versions[0].statut, statut::MENTION_SUPPRESSION);
    assert_eq!(s.versions[0].texte, "Ce message a été supprimé.");
    assert!(s.etat_note.as_deref().unwrap().contains("pas disponible"));
    // L'export ne contenait que la version modifiée : signalée comme telle.
    assert!(ms.iter().any(|m| m.versions[0].statut == statut::MODIFIEE_AVANT));
}

#[test]
fn telegram_versions_datees_et_absence() {
    let dir = tempfile::tempdir().unwrap();
    let mut a = Archive::ouvrir(dir.path(), &CLE).unwrap();
    importer(&mut a, "telegram/1-premier-export", IMPORT_1);
    let ms = messages(&a, "telegram");
    assert_eq!(ms.len(), 4);
    assert_eq!(ms[0].envoi.utc_ms, utc("2026-11-14T20:05:09Z"));
    assert_eq!(ms[0].envoi.decalage_min, 60, "décalage tiré de date / date_unixtime");
    assert_eq!(ms[0].versions[0].texte, "Partie à 21 h ? ♟️");
    assert_eq!(ms[1].versions[0].texte, "Oui ! Ouverture italienne cette fois.");

    let r = importer(&mut a, "telegram/2-export-suivant", IMPORT_2);
    assert_eq!((r.nouvelles_versions, r.absences_constatees), (1, 1), "{r:?}");
    let ms = messages(&a, "telegram");
    let m = &ms[1];
    assert_eq!(m.versions.len(), 2);
    assert_eq!(m.versions[1].texte, "Oui ! Ouverture sicilienne cette fois.");
    assert_eq!(m.versions[1].modifie.as_ref().unwrap().utc_ms, utc("2026-11-14T20:08:00Z"));
    // Supprimé côté Telegram : absent du nouvel export, texte conservé.
    let absent = ms.iter().find(|m| m.etat == etat::ABSENT).unwrap();
    assert_eq!(absent.versions[0].texte, "Message que Noé supprimera ensuite.");
    assert!(absent.etat_note.as_deref().unwrap().contains("n'a pas signalé"));
}

#[test]
fn instagram_texte_repare_et_discord() {
    let dir = tempfile::tempdir().unwrap();
    let mut a = Archive::ouvrir(dir.path(), &CLE).unwrap();
    importer(&mut a, "instagram", IMPORT_1);
    let ms = messages(&a, "instagram");
    assert_eq!(ms.len(), 2);
    assert_eq!(ms[0].auteur.as_deref(), Some("Léa Exemple"));
    assert_eq!(ms[0].versions[0].texte, "Très bien, et toi ?");
    assert_eq!(ms[0].details, vec!["réaction ❤️ de Rayan".to_string()]);
    assert_eq!(ms[1].versions[0].texte, "Ça va ? 😀");
    assert_eq!(ms[1].envoi.utc_ms, 1_794_740_400_123);
    assert_eq!(ms[1].envoi.precision, precision::MILLISECONDE);
    assert_eq!(ms[1].conversation_nom, "Léa Exemple");

    importer(&mut a, "discord", IMPORT_1);
    let ms = messages(&a, "discord");
    assert_eq!(ms[0].versions[0].texte, "Bonsoir tout le monde 👋\nPremière ligne\n\nTroisième ligne");
    assert_eq!(ms[0].envoi.utc_ms, utc("2026-11-16T19:45:30Z"));
    assert_eq!(ms[0].conversation_nom, "Serveur exemple › #général");
}

#[test]
fn recherche_par_mot_date_appli_conversation() {
    let dir = tempfile::tempdir().unwrap();
    let mut a = Archive::ouvrir(dir.path(), &CLE).unwrap();
    importer(&mut a, "whatsapp/1-premier-export", IMPORT_1);
    importer(&mut a, "whatsapp/2-export-suivant", IMPORT_2);
    importer(&mut a, "telegram/1-premier-export", IMPORT_1);

    let cherche = |f: Filtre| a.chercher_messages(&f).unwrap();
    // Sans accents ni majuscules, par début de mot.
    let r = cherche(Filtre { mots: "GATEAU".into(), ..Default::default() });
    assert_eq!(r.len(), 1);
    assert!(r[0].versions[0].texte.contains("gâteau"));
    assert_eq!(cherche(Filtre { mots: "fam compl".into(), ..Default::default() }).len(), 1);
    // Recherche dans le texte d'un message supprimé depuis.
    assert_eq!(cherche(Filtre { mots: "trompé discussion".into(), ..Default::default() }).len(), 1);
    // Emoji.
    assert_eq!(cherche(Filtre { mots: "🎉".into(), ..Default::default() }).len(), 1);
    // Par service.
    assert_eq!(cherche(Filtre { mots: "partie".into(), appli: Some("whatsapp".into()), ..Default::default() }).len(), 0);
    assert_eq!(cherche(Filtre { mots: "partie".into(), appli: Some("telegram".into()), ..Default::default() }).len(), 1);
    // Par date : seulement le 16/11 (heure de Paris).
    let r = cherche(Filtre { du_ms: Some(utc("2026-11-15T23:00:00Z")), au_ms: Some(utc("2026-11-16T23:00:00Z")), ..Default::default() });
    assert_eq!(r.len(), 1);
    assert!(r[0].versions[0].texte.starts_with("Famille"));
    // Par conversation, dans l'ordre chronologique.
    let conv = a.conversations(Some("telegram")).unwrap();
    assert_eq!(conv.len(), 1);
    assert_eq!(conv[0].nom, "Club échecs (exemple)");
    let r = cherche(Filtre { conversation: Some(conv[0].id), ..Default::default() });
    assert_eq!(r.len(), 4);
    assert!(r.windows(2).all(|w| w[0].envoi.utc_ms <= w[1].envoi.utc_ms));
    // Filtre « supprimés ».
    let s = cherche(Filtre { categorie: Some("supprime".into()), ..Default::default() });
    assert_eq!(s.len(), 1, "{:#?}", s.iter().map(|m| (&m.etat, &m.versions)).collect::<Vec<_>>());
    assert_eq!(cherche(Filtre { categorie: Some("modifie".into()), ..Default::default() }).len(), 1);
}

#[test]
fn rien_en_clair_sur_le_disque_et_mauvaise_cle_refusee() {
    let dir = tempfile::tempdir().unwrap();
    {
        let mut a = Archive::ouvrir(dir.path(), &CLE).unwrap();
        importer(&mut a, "whatsapp/1-premier-export", IMPORT_1);
        a.ajouter_evenement(&evenement("fenetre", "premier_plan", "Projet secret.docx - Word", Some("WINWORD.EXE"), 1)).unwrap();
        a.point_de_controle().unwrap();
        let base = std::fs::read(a.chemin_base()).unwrap();
        for mot in ["Salut", "gâteau", "Léa", "Famille", "Projet secret", "WINWORD"] {
            assert!(!contient(&base, mot.as_bytes()), "« {mot} » trouvé en clair dans la base");
        }
        // Les sources brutes sont chiffrées et redonnent l'export à l'octet près.
        let src = std::fs::read_dir(dir.path().join("sources")).unwrap().next().unwrap().unwrap().path();
        let chiffre = std::fs::read(&src).unwrap();
        assert!(!contient(&chiffre, "Salut".as_bytes()));
        let original = std::fs::read(exemples().join("whatsapp/1-premier-export/Discussion WhatsApp avec Léa Exemple.txt")).unwrap();
        let cles = journal_core::crypto::Cles::depuis_maitre(&CLE);
        assert_eq!(cles.ouvrir_fichier(&src).unwrap(), original);
    }
    assert!(Archive::ouvrir(dir.path(), &[8u8; 32]).is_err(), "une autre clé doit être refusée");
}

fn contient(h: &[u8], n: &[u8]) -> bool {
    h.windows(n.len()).any(|w| w == n)
}

fn evenement(cat: &str, action: &str, sujet: &str, appli: Option<&str>, ms: i64) -> NouvelEvenement {
    NouvelEvenement {
        categorie: cat.into(),
        action: action.into(),
        evenement: Some(Horodatage::en_local(ms, precision::MILLISECONDE)),
        detection: Horodatage::en_local(ms + 40, precision::MILLISECONDE),
        partiel: false,
        contenu: ContenuEvenement { sujet: sujet.into(), appli: appli.map(String::from), ..Default::default() },
        unique: None,
    }
}

#[test]
fn journal_heures_recherche_conservation() {
    let dir = tempfile::tempdir().unwrap();
    let a = Archive::ouvrir(dir.path(), &CLE).unwrap();
    let t0 = utc("2026-11-10T10:00:00Z");
    a.ajouter_evenement(&evenement("application", "ouverture", "chrome.exe", Some("chrome.exe"), t0)).unwrap();
    a.ajouter_evenement(&evenement("fenetre", "premier_plan", "Mémoire de stage.docx - Word", Some("WINWORD.EXE"), t0 + 60_000)).unwrap();
    // Heure réelle inconnue : suppression constatée au démarrage.
    let mut e = evenement("fichier", "suppression", "notes.txt", None, t0);
    e.evenement = None;
    e.partiel = true;
    e.contenu.chemin = Some(r"C:\Users\x\Documents\notes.txt".into());
    e.contenu.note = Some("supprimé pendant l'arrêt de l'application : heure réelle inconnue".into());
    a.ajouter_evenement(&e).unwrap();
    // Dédoublonnage par identifiant unique (ex. journal Windows).
    let mut v = evenement("session", "reveil", "Sortie de veille", None, t0 + 120_000);
    v.unique = Some("System:1234".into());
    assert!(a.ajouter_evenement(&v).unwrap().is_some());
    assert!(a.ajouter_evenement(&v).unwrap().is_none());

    let r = a.chercher_evenements(&Filtre { mots: "memoire".into(), ..Default::default() }).unwrap();
    assert_eq!(r.len(), 1);
    assert_eq!(r[0].contenu.sujet, "Mémoire de stage.docx - Word");
    assert_eq!(r[0].evenement.as_ref().unwrap().utc_ms, t0 + 60_000);
    assert_eq!(r[0].detection.utc_ms, t0 + 60_040, "heure de détection distincte");
    assert_eq!(a.chercher_evenements(&Filtre { appli: Some("winword.exe".into()), ..Default::default() }).unwrap().len(), 1);
    let s = a.chercher_evenements(&Filtre { categorie: Some("fichier".into()), ..Default::default() }).unwrap();
    assert!(s[0].evenement.is_none() && s[0].partiel);

    // Conservation : tout ce qui précède t0 + 90 s est retiré.
    assert_eq!(a.purger_evenements(t0 + 90_000).unwrap(), 3);
    assert_eq!(a.chercher_evenements(&Filtre::default()).unwrap().len(), 1);
    assert!(a.chercher_evenements(&Filtre { mots: "memoire".into(), ..Default::default() }).unwrap().is_empty());
    // Composants Windows masquables.
    a.ajouter_evenement(&evenement("composant", "ouverture", "RuntimeBroker.exe", Some("RuntimeBroker.exe"), t0 + 200_000)).unwrap();
    let sans = Filtre { exclure_categories: vec!["composant".into()], ..Default::default() };
    assert!(a.chercher_evenements(&sans).unwrap().iter().all(|e| e.categorie != "composant"));
    let seuls = Filtre { categorie: Some("composant".into()), ..sans };
    assert_eq!(a.chercher_evenements(&seuls).unwrap().len(), 1);
}

#[test]
fn export_lisible() {
    let dir = tempfile::tempdir().unwrap();
    let mut a = Archive::ouvrir(dir.path(), &CLE).unwrap();
    importer(&mut a, "whatsapp/1-premier-export", IMPORT_1);
    importer(&mut a, "whatsapp/2-export-suivant", IMPORT_2);
    let sortie = dir.path().join("export");
    let f = a.exporter("messages", &Filtre::default(), &sortie, IMPORT_2).unwrap();
    let jsonl = std::fs::read_to_string(&f[0]).unwrap();
    assert_eq!(jsonl.lines().count(), 6);
    assert!(jsonl.contains("Famille 👨\u{200d}👩\u{200d}👧\u{200d}👦 au complet !"));
    assert!(jsonl.contains("Désolé, je me suis trompé de discussion"));
    let html = std::fs::read_to_string(&f[1]).unwrap();
    assert!(html.contains("« à 20 h »"));
}

#[test]
fn secrets_masques() {
    let r = ReglesSecrets::default();
    assert_eq!(r.filtrer_titre("chrome.exe", "Code de vérification : 482913 - Gmail"), None);
    assert_eq!(r.filtrer_titre("msedge.exe", "Nouvel onglet - [InPrivate] - Microsoft Edge"), None);
    assert_eq!(r.filtrer_titre("KeePassXC.exe", "Base.kdbx - KeePassXC"), None);
    assert_eq!(r.filtrer_titre("notepad.exe", "Facture 2026 n° 482913.txt").as_deref(), Some("Facture 2026 n° ••••••.txt"));
    assert_eq!(
        r.filtrer_titre("code.exe", "config ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4 - VS Code").as_deref(),
        Some("config [jeton masqué] - VS Code")
    );
    assert_eq!(r.filtrer_titre("explorer.exe", "Documents").as_deref(), Some("Documents"));
    assert_eq!(r.filtrer_chemin(r"C:\Users\x\.ssh\id_ed25519"), r"C:\Users\x\.ssh\[fichier sensible]");
    assert_eq!(r.filtrer_chemin(r"C:\Users\x\Documents\Secrets\a.txt"), r"C:\Users\x\Documents\[fichier sensible]");
    assert_eq!(r.filtrer_chemin(r"C:\Users\x\Documents\cours.pdf"), r"C:\Users\x\Documents\cours.pdf");
    let mut seul_nom = ReglesSecrets::default();
    seul_nom.titres = "appli".into();
    assert_eq!(seul_nom.filtrer_titre("notepad.exe", "Liste de courses.txt"), None);
}
