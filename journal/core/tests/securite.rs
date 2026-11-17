//! Évaluation de la confiance des programmes, avec des cas fictifs.

use journal_core::securite::*;
use journal_core::Archive;

fn dossiers() -> Dossiers {
    Dossiers {
        windows: r"c:\windows\".into(),
        programmes: vec![r"c:\program files\".into(), r"c:\program files (x86)\".into()],
        temporaires: vec![r"c:\users\lea\appdata\local\temp\".into()],
        profil: r"c:\users\lea\".into(),
    }
}

fn signe(par: &str) -> Signature {
    Signature { statut: "Valid".into(), genre: "Authenticode".into(), sujet: format!("CN={par}, O={par}, C=US") }
}

fn faits(chemin: &str, signature: Signature) -> Faits {
    Faits { chemin: chemin.into(), nom: chemin.rsplit('\\').next().unwrap().into(), signature, ..Default::default() }
}

#[test]
fn programme_signe_installe_fiable() {
    let a = evaluer(&faits(r"C:\Program Files\LGHUB\lghub.exe", signe("Logitech Inc")), &dossiers(), 1);
    assert_eq!(a.niveau, Niveau::Fiable);
    assert_eq!(a.editeur.as_deref(), Some("Logitech Inc"));
    let mut f = faits(r"C:\Users\lea\AppData\Local\Discord\app-1.0\Discord.exe", signe("Discord Inc."));
    f.demarrage = vec!["Registre Run : Discord".into()];
    assert_eq!(evaluer(&f, &dossiers(), 1).niveau, Niveau::Fiable);
}

#[test]
fn fichier_windows_signe_par_catalogue() {
    let s = Signature { statut: "Valid".into(), genre: "Catalog".into(), sujet: "CN=Microsoft Windows, O=Microsoft Corporation".into() };
    let a = evaluer(&faits(r"C:\Windows\System32\svchost.exe", s), &dossiers(), 1);
    assert_eq!(a.niveau, Niveau::Fiable);
    assert!(a.raisons[0].texte.contains("catalogue"));
}

#[test]
fn imitation_de_nom_windows() {
    let a = evaluer(&faits(r"C:\Users\lea\AppData\Roaming\svchost.exe", Signature { statut: "NotSigned".into(), ..Default::default() }), &dossiers(), 1);
    assert_eq!(a.niveau, Niveau::Suspect);
    assert_eq!(a.raisons[0].gravite, Gravite::Critique);
    let a = evaluer(&faits(r"C:\Users\lea\AppData\Roaming\scvhost.exe", signe("Inconnu SARL")), &dossiers(), 1);
    assert_eq!(a.niveau, Niveau::Suspect, "{:?}", a.raisons);
    // Un vrai programme au nom proche, signé par Microsoft, n'est pas une imitation.
    let a = evaluer(&faits(r"C:\Program Files\Microsoft\conhosts.exe", signe("Microsoft Corporation")), &dossiers(), 1);
    assert_eq!(a.niveau, Niveau::Fiable);
}

#[test]
fn non_signe_et_emplacements() {
    let ns = || Signature { statut: "NotSigned".into(), ..Default::default() };
    // Non signé, installé normalement : à vérifier.
    assert_eq!(evaluer(&faits(r"C:\Program Files\Outil\outil.exe", ns()), &dossiers(), 1).niveau, Niveau::AVerifier);
    // Non signé, lancé depuis Temp : suspect.
    assert_eq!(evaluer(&faits(r"C:\Users\lea\AppData\Local\Temp\x1\run.exe", ns()), &dossiers(), 1).niveau, Niveau::Suspect);
    // Non signé, téléchargé d'Internet, depuis Téléchargements : suspect, avec le site d'origine.
    let mut f = faits(r"C:\Users\lea\Downloads\cheat-roblox.exe", ns());
    f.origine = Some(lire_zone_identifier("[ZoneTransfer]\r\nZoneId=3\r\nReferrerUrl=https://exemple.test/\r\nHostUrl=https://exemple.test/cheat.exe\r\n"));
    let a = evaluer(&f, &dossiers(), 1);
    assert_eq!(a.niveau, Niveau::Suspect);
    assert!(a.raisons.iter().any(|r| r.texte.contains("https://exemple.test/cheat.exe")));
    // Signé et téléchargé : simple information.
    let mut f = faits(r"C:\Users\lea\Downloads\SteamSetup.exe", signe("Valve Corp."));
    f.origine = Some(Origine { zone: Some(3), hote: Some("https://cdn.exemple.test/SteamSetup.exe".into()), referent: None });
    assert_eq!(evaluer(&f, &dossiers(), 1).niveau, Niveau::Fiable);
    // Non signé lancé au démarrage : deux avertissements → suspect.
    let mut f = faits(r"C:\Users\lea\AppData\Roaming\maj\maj.exe", ns());
    f.demarrage = vec!["Tâche planifiée : \\MiseAJour".into()];
    assert_eq!(evaluer(&f, &dossiers(), 1).niveau, Niveau::Suspect);
}

#[test]
fn signature_alteree_ou_detection_defender() {
    let s = Signature { statut: "HashMismatch".into(), genre: "Authenticode".into(), sujet: "CN=Valve Corp.".into() };
    assert_eq!(evaluer(&faits(r"C:\Program Files (x86)\Steam\steam.exe", s), &dossiers(), 1).niveau, Niveau::Suspect);
    let mut f = faits(r"C:\Program Files\Jeu\jeu.exe", signe("Studio"));
    f.defender = vec!["PUADlManager:Win32/OfferCore (gravité faible)".into()];
    assert_eq!(evaluer(&f, &dossiers(), 1).niveau, Niveau::Suspect);
}

#[test]
fn application_du_store() {
    let f = faits(r"C:\Program Files\WindowsApps\Microsoft.Widgets_1.0_x64__8wekyb3d8bbwe\WidgetService.exe", Signature { statut: "NotSigned".into(), ..Default::default() });
    let a = evaluer(&f, &dossiers(), 1);
    assert_eq!(a.niveau, Niveau::Fiable, "{:?}", a.raisons);
}

#[test]
fn fichier_remplace_par_une_mise_a_jour() {
    let mut f = faits(r"C:\Program Files\Google\Chrome\Application\old_chrome.exe", Signature::default());
    f.introuvable = true;
    let a = evaluer(&f, &dossiers(), 1);
    assert_eq!(a.niveau, Niveau::Inconnu);
    assert!(a.raisons.iter().any(|r| r.texte.contains("introuvable")), "{:?}", a.raisons);
}

#[test]
fn mes_applications_de_confiance() {
    let ns = || Signature { statut: "NotSigned".into(), ..Default::default() };
    // Installée par Rayan's Launcher, empreinte identique, lancée au démarrage : fiable.
    let mut f = faits(r"C:\Users\lea\AppData\Local\fr.rayan.launcher\apps\rayans-journal\versions\1.0.101-dfdda20a\Rayans Journal.exe", ns());
    f.demarrage = vec!["Registre utilisateur Run : Rayans Journal".into()];
    f.confiance = Some("Installé par Rayan's Launcher (empreinte vérifiée).".into());
    let a = evaluer(&f, &dossiers(), 1);
    assert_eq!(a.niveau, Niveau::Fiable, "{:?}", a.raisons);
    assert!(a.raisons.iter().all(|r| r.gravite == Gravite::Info));
    // Compilation de développement sur le Bureau, dossier marqué comme sûr : fiable.
    let mut f = faits(r"C:\Users\lea\Desktop\rayans-apps\journal\target\debug\journal_lib-41e3.exe", ns());
    f.confiance = Some("Dans un dossier marqué comme sûr par toi.".into());
    assert_eq!(evaluer(&f, &dossiers(), 1).niveau, Niveau::Fiable);
    // La confiance ne cache jamais Defender, une imitation ni une modification après installation.
    let mut f = faits(r"C:\Users\lea\Desktop\rayans-apps\svchost.exe", ns());
    f.confiance = Some("Dans un dossier marqué comme sûr par toi.".into());
    assert_eq!(evaluer(&f, &dossiers(), 1).niveau, Niveau::Suspect);
    let mut f = faits(r"C:\Users\lea\Desktop\rayans-apps\outil.exe", ns());
    f.confiance = Some("Dans un dossier marqué comme sûr par toi.".into());
    f.defender = vec!["Trojan:Win32/Exemple".into()];
    assert_eq!(evaluer(&f, &dossiers(), 1).niveau, Niveau::Suspect);
    let mut f = faits(r"C:\Users\lea\AppData\Local\fr.rayan.launcher\apps\x\versions\1\x.exe", ns());
    f.altere_depuis_installation = true;
    assert_eq!(evaluer(&f, &dossiers(), 1).niveau, Niveau::Suspect);
}

#[test]
fn signature_illisible() {
    let a = evaluer(&faits(r"C:\Program Files\Protege\p.exe", Signature::default()), &dossiers(), 1);
    assert_eq!(a.niveau, Niveau::Inconnu);
}

#[test]
fn lignes_de_demarrage() {
    assert_eq!(executable_de(r#""C:\Program Files\LGHUB\system_tray\lghub_system_tray.exe" --minimized"#).as_deref(), Some(r"C:\Program Files\LGHUB\system_tray\lghub_system_tray.exe"));
    assert_eq!(executable_de(r"C:\Riot Games\Riot Client\RiotClientServices.exe --launch-background-mode").as_deref(), Some(r"C:\Riot Games\Riot Client\RiotClientServices.exe"));
    std::env::set_var("RJ_TEST_DOSSIER", r"C:\Users\lea\AppData\Local");
    assert_eq!(executable_de(r"%RJ_TEST_DOSSIER%\Microsoft\OneDrive\OneDriveStandaloneUpdater.exe").as_deref(), Some(r"C:\Users\lea\AppData\Local\Microsoft\OneDrive\OneDriveStandaloneUpdater.exe"));
    assert_eq!(distance("scvhost.exe", "svchost.exe"), 1);
    assert_eq!(distance("svch0st.exe", "svchost.exe"), 1);
}

#[test]
fn inventaire_des_programmes_dans_l_archive() {
    let dir = tempfile::tempdir().unwrap();
    let a = Archive::ouvrir(dir.path(), &[3u8; 32]).unwrap();
    let an = evaluer(&faits(r"C:\Program Files\LGHUB\lghub.exe", signe("Logitech Inc")), &dossiers(), 1000);
    assert!(a.programme(&an.chemin).unwrap().is_none());
    a.enregistrer_programme(&an, "123|456", 1000).unwrap();
    a.enregistrer_programme(&an, "123|456", 5000).unwrap();
    let p = a.programme(r"c:\program files\lghub\LGHUB.EXE").unwrap().unwrap();
    assert_eq!((p.premiere_vue_ms, p.derniere_vue_ms, p.empreinte_fichier.as_str()), (1000, 5000, "123|456"));
    let l = a.programmes().unwrap();
    assert_eq!(l.len(), 1);
    assert_eq!(l[0].analyse.niveau, Niveau::Fiable);
    a.point_de_controle().unwrap();
    let base = std::fs::read(a.chemin_base()).unwrap();
    // Oublié : retiré de la liste, réanalysé s'il réapparaît.
    let oublie = Archive::ouvrir(dir.path(), &[3u8; 32]).unwrap();
    oublie.oublier_programme(r"C:\PROGRAM FILES\LGHUB\lghub.exe").unwrap();
    assert!(oublie.programmes().unwrap().is_empty());
    assert!(!base.windows(5).any(|w| w == b"LGHUB"), "chemin en clair dans la base");
}
