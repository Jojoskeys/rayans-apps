//! Parcours complets sur le vrai coeur, avec un serveur HTTP local et le vrai binaire de démonstration.
//! Prérequis : `cargo build -p hangar-demo` (fait par `npm test`).

use base64::Engine;
use ed25519_dalek::{Signer, SigningKey};
use hangar_core::{Core, Error, InstallOutcome, TrustPolicy};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Once};
use std::time::Duration;

const EXE: &str = if cfg!(windows) { "RayansChrono.exe" } else { "RayansChrono" };

fn demo_bin() -> PathBuf {
    let p = Path::new(env!("CARGO_MANIFEST_DIR")).join("../target/debug").join(EXE);
    assert!(p.exists(), "lancez d'abord `cargo build -p hangar-demo` ({})", p.display());
    p
}

fn env_once() {
    static O: Once = Once::new();
    O.call_once(|| {
        // Applications de test : pas de fenêtre, ouvertes 1 s.
        std::env::set_var("DEMO_NO_WINDOW", "1");
        std::env::set_var("DEMO_SECONDS", "1");
    });
}

/// Serveur de fichiers minimal. `online=false` simule une coupure réseau (connexion refermée).
struct Server {
    base: String,
    online: Arc<AtomicBool>,
    /// Envoi lent (64 Ko toutes les 20 ms) pour pouvoir annuler en plein téléchargement.
    slow: Arc<AtomicBool>,
    /// Nombre de requêtes de reprise (en-tête Range) servies.
    ranges: Arc<std::sync::atomic::AtomicUsize>,
}

fn serve(dir: PathBuf) -> Server {
    let l = TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://{}", l.local_addr().unwrap());
    let online = Arc::new(AtomicBool::new(true));
    let on = online.clone();
    let slow = Arc::new(AtomicBool::new(false));
    let ranges = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let (sl, rg) = (slow.clone(), ranges.clone());
    std::thread::spawn(move || {
        for s in l.incoming().flatten() {
            if !on.load(Ordering::SeqCst) {
                drop(s);
                continue;
            }
            let dir = dir.clone();
            let (sl, rg) = (sl.clone(), rg.clone());
            std::thread::spawn(move || {
                let mut r = BufReader::new(s.try_clone().unwrap());
                let mut line = String::new();
                r.read_line(&mut line).ok();
                let mut from: Option<usize> = None;
                loop {
                    let mut h = String::new();
                    if r.read_line(&mut h).unwrap_or(0) <= 2 {
                        break;
                    }
                    if let Some(v) = h.to_ascii_lowercase().strip_prefix("range: bytes=") {
                        from = v.trim().trim_end_matches('-').parse().ok();
                    }
                }
                let path = line.split_whitespace().nth(1).unwrap_or("/").trim_start_matches('/');
                let mut s = s;
                match std::fs::read(dir.join(path)) {
                    Ok(b) => {
                        let start = from.filter(|f| *f < b.len()).unwrap_or(0);
                        if start > 0 {
                            rg.fetch_add(1, Ordering::SeqCst);
                            let _ = write!(s, "HTTP/1.1 206 Partial Content\r\nContent-Range: bytes {start}-{}/{}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", b.len() - 1, b.len(), b.len() - start);
                        } else {
                            let _ = write!(s, "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", b.len());
                        }
                        for c in b[start..].chunks(64 * 1024) {
                            if s.write_all(c).is_err() {
                                break;
                            }
                            if sl.load(Ordering::SeqCst) {
                                std::thread::sleep(Duration::from_millis(20));
                            }
                        }
                    }
                    Err(_) => {
                        let _ = write!(s, "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
                    }
                }
            });
        }
    });
    Server { base, online, slow, ranges }
}

struct Site {
    _tmp: tempfile::TempDir,
    pub dir: PathBuf,
    pub home: PathBuf,
    pub server: Server,
}

fn site() -> Site {
    env_once();
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("site");
    std::fs::create_dir_all(dir.join("zips")).unwrap();
    std::fs::write(dir.join("icon.png"), b"\x89PNG\r\n\x1a\nfaux").unwrap();
    let server = serve(dir.clone());
    Site { home: tmp.path().join("home"), dir, server, _tmp: tmp }
}

fn zip_with(path: &Path, files: &[(&str, Vec<u8>)]) -> String {
    let f = std::fs::File::create(path).unwrap();
    let mut w = zip::ZipWriter::new(f);
    for (n, d) in files {
        let o = zip::write::SimpleFileOptions::default().unix_permissions(0o755);
        w.start_file(*n, o).unwrap();
        w.write_all(d).unwrap();
    }
    w.finish().unwrap();
    hangar_core::util::sha256_file(path).unwrap()
}

fn demo_zip(site: &Site, name: &str) -> String {
    let bin = std::fs::read(demo_bin()).unwrap();
    zip_with(&site.dir.join("zips").join(name), &[(&format!("bin/{EXE}"), bin), ("LISEZMOI.txt", b"demo".to_vec())])
}

/// ZIP de démo alourdi de 4 Mo peu compressibles : en envoi lent, le téléchargement dure plus d'une seconde,
/// ce qui laisse le temps de l'annuler sur toutes les machines.
fn big_demo_zip(site: &Site, name: &str) -> String {
    let bin = std::fs::read(demo_bin()).unwrap();
    let mut x: u64 = 0x9E37_79B9_7F4A_7C15 ^ name.len() as u64;
    let pad: Vec<u8> = (0..4 * 1024 * 1024)
        .map(|_| {
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
            x as u8
        })
        .collect();
    zip_with(&site.dir.join("zips").join(name), &[(&format!("bin/{EXE}"), bin), ("pad.bin", pad)])
}

fn entry(id: &str, version: &str, zip: &str, sha: &str) -> String {
    format!(
        r#"{{"id":"{id}","name":"Horloge {id}","description":"Démo","icon":"icon.png","image":"icon.png",
        "version":"{version}","releaseNotes":"Notes {version}","downloadUrl":"zips/{zip}","sha256":"{sha}",
        "executable":"bin/{EXE}"}}"#
    )
}

fn write_catalog(site: &Site, entries: &[String], key: Option<&SigningKey>) {
    let text = format!(r#"{{"schemaVersion":1,"title":"Test","apps":[{}]}}"#, entries.join(","));
    std::fs::write(site.dir.join("catalog.json"), &text).unwrap();
    let sig = site.dir.join("catalog.json.sig");
    match key {
        Some(k) => std::fs::write(
            sig,
            base64::engine::general_purpose::STANDARD.encode(k.sign(text.as_bytes()).to_bytes()),
        )
        .unwrap(),
        None => {
            let _ = std::fs::remove_file(sig);
        }
    }
}

fn open(site: &Site, policy: TrustPolicy) -> Arc<Core> {
    let core = Core::open(&site.home, policy, None, Box::new(|_| {})).unwrap();
    core.set_catalog_url(&format!("{}/catalog.json", site.server.base)).unwrap();
    core
}

fn dev() -> TrustPolicy {
    TrustPolicy::Development { public_key: None }
}

fn wait_exit(core: &Core, id: &str) {
    for _ in 0..200 {
        if !core.is_running(id) {
            return;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    panic!("l'application ne s'est pas fermée");
}

fn journal(core: &Core, id: &str) -> String {
    std::fs::read_to_string(core.paths().data_dir(id).join("journal.txt")).unwrap_or_default()
}

#[tokio::test(flavor = "multi_thread")]
async fn parcours_installation_mise_a_jour_echec_hors_ligne() {
    let s = site();
    let sha1 = demo_zip(&s, "v1.zip");
    write_catalog(&s, &[], None);
    let core = open(&s, dev());

    // Catalogue vide.
    core.refresh_catalog().await.unwrap();
    assert_eq!(core.snapshot().apps.len(), 0);

    // 1. Ajouter une entrée au catalogue : elle apparaît après actualisation, sans rien reconstruire.
    write_catalog(&s, &[entry("horloge", "1.0.0", "v1.zip", &sha1)], None);
    core.refresh_catalog().await.unwrap();
    let snap = core.snapshot();
    assert_eq!(snap.apps[0].id, "horloge");
    assert!(core.image_data_url("horloge", "icon").unwrap().starts_with("data:image/png"));

    // 2. Installer et lancer la v1.
    assert_eq!(core.install("horloge").await.unwrap(), InstallOutcome::Activated);
    core.launch("horloge").unwrap();
    wait_exit(&core, "horloge");
    assert!(journal(&core, "horloge").contains("lancement=1"));

    // 3. Publier la v2 : mise à jour détectée, la v1 reste lançable avant la mise à jour.
    let sha2 = demo_zip(&s, "v2.zip");
    write_catalog(&s, &[entry("horloge", "2.0.0", "v2.zip", &sha2)], None);
    core.refresh_catalog().await.unwrap();
    let a = &core.snapshot().apps[0];
    assert!(a.update_available);
    assert_eq!(a.installed_version.as_deref(), Some("1.0.0"));
    assert_eq!(core.install("horloge").await.unwrap(), InstallOutcome::Activated);
    assert_eq!(core.snapshot().apps[0].installed_version.as_deref(), Some("2.0.0"));
    core.launch("horloge").unwrap();
    wait_exit(&core, "horloge");
    // Données utilisateur conservées d'une version à l'autre.
    assert!(journal(&core, "horloge").contains("lancement=2"));

    // 4. ZIP corrompu publié en 2.1.0 : refusé, la 2.0.0 reste installée et lançable.
    let mut bad = std::fs::read(s.dir.join("zips/v2.zip")).unwrap();
    let mid = bad.len() / 2;
    bad[mid] ^= 0xFF;
    std::fs::write(s.dir.join("zips/v21.zip"), &bad).unwrap();
    write_catalog(&s, &[entry("horloge", "2.1.0", "v21.zip", &sha2)], None);
    core.refresh_catalog().await.unwrap();
    let err = core.install("horloge").await.unwrap_err();
    assert!(matches!(err, Error::Integrity { .. }), "{err:?}");
    let a = &core.snapshot().apps[0];
    assert_eq!(a.installed_version.as_deref(), Some("2.0.0"));
    assert_eq!(a.last_error.as_ref().unwrap().code, "integrity");
    core.launch("horloge").unwrap();
    wait_exit(&core, "horloge");
    assert!(journal(&core, "horloge").contains("lancement=3"));
    // Aucun reste de préparation ou de téléchargement.
    let leftovers: Vec<_> = std::fs::read_dir(core.paths().app_dir("horloge"))
        .unwrap()
        .flatten()
        .filter(|e| e.file_name().to_string_lossy().starts_with("staging-"))
        .collect();
    assert!(leftovers.is_empty());

    // Le même ZIP corrompu annoncé avec sa vraie empreinte : l'archive elle-même est refusée.
    let sha_bad = hangar_core::util::sha256_file(&s.dir.join("zips/v21.zip")).unwrap();
    write_catalog(&s, &[entry("horloge", "2.1.0", "v21.zip", &sha_bad)], None);
    core.refresh_catalog().await.unwrap();
    let err = core.install("horloge").await.unwrap_err();
    assert!(matches!(err, Error::BadArchive(_) | Error::UnsafeArchive(_)), "{err:?}");
    assert_eq!(core.snapshot().apps[0].installed_version.as_deref(), Some("2.0.0"));

    // 5. Redémarrage du launcher sans connexion : dernier catalogue valide et lancement.
    drop(core);
    s.server.online.store(false, Ordering::SeqCst);
    let core = Core::open(&s.home, dev(), None, Box::new(|_| {})).unwrap();
    assert!(core.refresh_catalog().await.is_err());
    let snap = core.snapshot();
    assert!(snap.catalog.from_cache);
    assert_eq!(snap.catalog.error.as_ref().unwrap().code, "network");
    assert_eq!(snap.apps[0].installed_version.as_deref(), Some("2.0.0"));
    assert!(core.image_data_url("horloge", "icon").is_some());
    core.launch("horloge").unwrap();
    wait_exit(&core, "horloge");
    assert!(journal(&core, "horloge").contains("lancement=4"));

    // Désinstallation : fichiers de version supprimés, données conservées.
    core.uninstall("horloge", false).unwrap();
    assert!(!core.paths().app_dir("horloge").exists());
    assert!(core.paths().data_dir("horloge").join("lancements.txt").exists());
}

#[tokio::test(flavor = "multi_thread")]
async fn mise_a_jour_reportee_tant_que_l_application_est_ouverte() {
    let s = site();
    let sha1 = demo_zip(&s, "v1.zip");
    write_catalog(&s, &[entry("horloge", "1.0.0", "v1.zip", &sha1)], None);
    let core = open(&s, dev());
    core.refresh_catalog().await.unwrap();
    core.install("horloge").await.unwrap();

    // L'application reste ouverte tant que ce fichier existe (crochet de test de la démo).
    let hold = core.paths().data_dir("horloge").join("garder-ouvert");
    std::fs::create_dir_all(hold.parent().unwrap()).unwrap();
    std::fs::write(&hold, b"").unwrap();
    core.launch("horloge").unwrap();
    assert!(matches!(core.launch("horloge"), Err(Error::Running)));
    let sha2 = demo_zip(&s, "v2.zip");
    write_catalog(&s, &[entry("horloge", "2.0.0", "v2.zip", &sha2)], None);
    core.refresh_catalog().await.unwrap();
    assert_eq!(core.install("horloge").await.unwrap(), InstallOutcome::Pending);
    let a = &core.snapshot().apps[0];
    assert_eq!(a.installed_version.as_deref(), Some("1.0.0"));
    assert_eq!(a.pending_version.as_deref(), Some("2.0.0"));
    assert!(!a.update_available);
    assert!(matches!(core.uninstall("horloge", false), Err(Error::Running)));
    assert!(core.is_running("horloge"));
    std::fs::remove_file(&hold).unwrap();
    wait_exit(&core, "horloge");
    let a = &core.snapshot().apps[0];
    assert_eq!(a.installed_version.as_deref(), Some("2.0.0"));
    assert_eq!(a.pending_version, None);
    // Seule la version active reste sur le disque.
    assert_eq!(std::fs::read_dir(core.paths().versions_dir("horloge")).unwrap().count(), 1);
}

#[tokio::test(flavor = "multi_thread")]
async fn deux_installations_concurrentes_sont_refusees() {
    let s = site();
    let sha1 = demo_zip(&s, "v1.zip");
    write_catalog(&s, &[entry("horloge", "1.0.0", "v1.zip", &sha1)], None);
    let core = open(&s, dev());
    core.refresh_catalog().await.unwrap();
    let (a, b) = tokio::join!(core.install("horloge"), core.install("horloge"));
    let results = [a.is_ok(), b.is_ok()];
    assert_eq!(results.iter().filter(|x| **x).count(), 1, "{a:?} {b:?}");
    assert!(matches!(a.err().or(b.err()), Some(Error::Busy)));

    // Un autre processus (même dossier) ne peut pas non plus installer en parallèle.
    let core2 = Core::open(&s.home, dev(), None, Box::new(|_| {})).unwrap();
    core2.refresh_catalog().await.unwrap();
    let lock = std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(false)
        .open(s.home.join("locks/horloge.lock"))
        .unwrap();
    lock.lock().unwrap();
    assert!(matches!(core2.install("horloge").await, Err(Error::Busy)));
}

#[tokio::test(flavor = "multi_thread")]
async fn archive_malveillante_et_executable_absent() {
    let s = site();
    let sha_ok = demo_zip(&s, "v1.zip");
    let sha_evil = zip_with(
        &s.dir.join("zips/evil.zip"),
        &[(&format!("bin/{EXE}"), b"x".to_vec()), ("../../evil.txt", b"x".to_vec())],
    );
    let sha_noexe = zip_with(&s.dir.join("zips/noexe.zip"), &[("autre.txt", b"x".to_vec())]);
    write_catalog(
        &s,
        &[
            entry("evil", "1.0.0", "evil.zip", &sha_evil),
            entry("noexe", "1.0.0", "noexe.zip", &sha_noexe),
            entry("ok", "1.0.0", "v1.zip", &sha_ok),
        ],
        None,
    );
    let core = open(&s, dev());
    core.refresh_catalog().await.unwrap();
    assert!(matches!(core.install("evil").await, Err(Error::UnsafeArchive(_))));
    assert!(!s.home.join("evil.txt").exists() && !s.home.join("apps/evil.txt").exists());
    assert!(matches!(core.install("noexe").await, Err(Error::MissingExecutable(_))));
    assert_eq!(core.snapshot().apps.iter().filter(|a| a.installed_version.is_some()).count(), 0);

    // Exécutable modifié après installation : le lancement est refusé.
    core.install("ok").await.unwrap();
    let dir = std::fs::read_dir(core.paths().versions_dir("ok")).unwrap().next().unwrap().unwrap().path();
    std::fs::write(dir.join("bin").join(EXE), b"remplace").unwrap();
    assert!(matches!(core.launch("ok"), Err(Error::TamperedExecutable)));
}

#[tokio::test(flavor = "multi_thread")]
async fn signature_exigee_en_distribution() {
    let s = site();
    let sk = SigningKey::from_bytes(&[42u8; 32]);
    let other = SigningKey::from_bytes(&[43u8; 32]);
    let sha = demo_zip(&s, "v1.zip");
    let e = entry("horloge", "1.0.0", "v1.zip", &sha);

    // Sans clé intégrée, même un catalogue https serait refusé ; ici http est déjà refusé.
    let core = Core::open(&s.home, TrustPolicy::Distributed { public_key: Some(sk.verifying_key()) }, None, Box::new(|_| {})).unwrap();
    let err = core.set_catalog_url(&format!("{}/catalog.json", s.server.base)).unwrap_err();
    assert!(matches!(err, Error::InsecureUrl(_)));
    drop(core);

    // Le mode développement vérifie quand même une signature présente.
    let dev_key = TrustPolicy::Development { public_key: Some(sk.verifying_key()) };
    write_catalog(&s, std::slice::from_ref(&e), Some(&other));
    let core = open(&s, dev_key.clone());
    assert!(matches!(core.refresh_catalog().await, Err(Error::Signature(_))));
    assert_eq!(core.snapshot().catalog.status, "none");

    write_catalog(&s, std::slice::from_ref(&e), Some(&sk));
    core.refresh_catalog().await.unwrap();
    assert_eq!(core.snapshot().catalog.trust.as_deref(), Some("signed"));

    // Catalogue modifié après signature : refusé, le dernier catalogue valide reste en place.
    let text = std::fs::read_to_string(s.dir.join("catalog.json")).unwrap().replace("Démo", "Piégé");
    std::fs::write(s.dir.join("catalog.json"), text).unwrap();
    assert!(matches!(core.refresh_catalog().await, Err(Error::Signature(_))));
    let snap = core.snapshot();
    assert_eq!(snap.apps[0].description, "Démo");
    assert_eq!(snap.catalog.error.as_ref().unwrap().code, "signature");

    // Catalogue invalide : refusé avec un message précis, l'ancien reste utilisé.
    std::fs::write(s.dir.join("catalog.json"), r#"{"schemaVersion":1,"apps":[{"id":"xy"}]}"#).unwrap();
    std::fs::remove_file(s.dir.join("catalog.json.sig")).unwrap();
    let core = open(&s, dev());
    let err = core.refresh_catalog().await.unwrap_err();
    assert!(err.to_string().contains("name"), "{err}");
}

#[tokio::test(flavor = "multi_thread")]
async fn telechargement_annule_puis_repris() {
    let site = site();
    let sha = big_demo_zip(&site, "dl-1.0.0.zip");
    write_catalog(&site, &[entry("dl", "1.0.0", "dl-1.0.0.zip", &sha)], None);
    let core = open(&site, dev());
    core.refresh_catalog().await.unwrap();
    site.server.slow.store(true, Ordering::SeqCst);

    // 1. Annulation en plein téléchargement : pas d'erreur affichée, début gardé.
    let c2 = Arc::clone(&core);
    let job = tokio::spawn(async move { c2.install("dl").await });
    let mut cancelled = false;
    for _ in 0..200 {
        tokio::time::sleep(Duration::from_millis(10)).await;
        let got = core.snapshot().apps[0].task.as_ref().map_or(0, |t| t.received);
        if got > 0 && core.cancel_download("dl") {
            cancelled = true;
            break;
        }
    }
    assert!(cancelled, "le téléchargement aurait dû être annulable");
    assert!(matches!(job.await.unwrap(), Err(hangar_core::Error::Cancelled)));
    let app = core.snapshot().apps.into_iter().find(|a| a.id == "dl").unwrap();
    assert!(app.last_error.is_none(), "une annulation n'est pas une erreur");
    assert!(app.installed_version.is_none());
    let part = app.partial_bytes.expect("début de téléchargement gardé");
    assert!(part > 0);

    // 2. Reprise (même après redémarrage du launcher) : seule la suite est demandée, empreinte correcte.
    drop(core);
    let core = open(&site, dev());
    assert_eq!(core.snapshot().apps.iter().find(|a| a.id == "dl").unwrap().partial_bytes, Some(part));
    site.server.slow.store(false, Ordering::SeqCst);
    core.install("dl").await.unwrap();
    assert_eq!(site.server.ranges.load(Ordering::SeqCst), 1, "reprise par en-tête Range");
    let app = core.snapshot().apps.into_iter().find(|a| a.id == "dl").unwrap();
    assert_eq!(app.installed_version.as_deref(), Some("1.0.0"));
    assert_eq!(app.partial_bytes, None, "fichier partiel supprimé après installation");

    // 3. « Abandonner » supprime le début gardé.
    let sha2 = big_demo_zip(&site, "dl-2.0.0.zip");
    write_catalog(&site, &[entry("dl", "2.0.0", "dl-2.0.0.zip", &sha2)], None);
    core.refresh_catalog().await.unwrap();
    site.server.slow.store(true, Ordering::SeqCst);
    let c2 = Arc::clone(&core);
    let job = tokio::spawn(async move { c2.install("dl").await });
    for _ in 0..200 {
        tokio::time::sleep(Duration::from_millis(10)).await;
        if core.snapshot().apps[0].task.as_ref().is_some_and(|t| t.received > 0) && core.cancel_download("dl") {
            break;
        }
    }
    let _ = job.await;
    assert!(core.snapshot().apps[0].partial_bytes.is_some());
    core.discard_download("dl");
    assert!(core.snapshot().apps[0].partial_bytes.is_none());
    assert_eq!(core.snapshot().apps[0].installed_version.as_deref(), Some("1.0.0"), "version en place intacte");
}

/// L'entrée « rayans-launcher » du catalogue publié par la CI : invisible dans la liste, mais téléchargée,
/// vérifiée et extraite comme une application pour que le launcher récupère son propre installateur.
#[tokio::test(flavor = "multi_thread")]
async fn entree_du_launcher_lui_meme() {
    let s = site();
    let sha_app = demo_zip(&s, "app.zip");
    let setup = s.dir.join("zips").join("launcher.zip");
    let sha_l = zip_with(&setup, &[("Rayans-Launcher-setup.exe", b"MZ setup".to_vec())]);
    let launcher = format!(
        r#"{{"id":"{id}","name":"Rayan's Launcher","description":"Le launcher","icon":"icon.png","image":"icon.png",
        "version":"0.1.300","releaseNotes":"Nouveau","downloadUrl":"zips/launcher.zip","sha256":"{sha_l}",
        "executable":"Rayans-Launcher-setup.exe"}}"#,
        id = hangar_core::LAUNCHER_ID
    );
    write_catalog(&s, &[entry("horloge", "1.0.0", "app.zip", &sha_app), launcher], None);
    let core = open(&s, dev());
    core.refresh_catalog().await.unwrap();
    let snap = core.snapshot();
    assert_eq!(snap.apps.len(), 1, "le launcher n'est pas une application du catalogue");
    assert_eq!(snap.catalog.app_count, 1);
    assert_eq!(core.catalog_version(hangar_core::LAUNCHER_ID).unwrap().to_string(), "0.1.300");

    assert_eq!(core.install(hangar_core::LAUNCHER_ID).await.unwrap(), InstallOutcome::Activated);
    let (_, exe) = core.installed_paths(hangar_core::LAUNCHER_ID).unwrap();
    assert_eq!(std::fs::read(&exe).unwrap(), b"MZ setup");
    assert_eq!(core.snapshot().apps.len(), 1, "toujours invisible une fois téléchargé");
}

/// Un installateur de distribution qui hérite de l'adresse file:// d'un installateur de test prend
/// l'adresse par défaut (sinon chaque actualisation serait refusée).
#[test]
fn adresse_locale_remplacee_en_distribution() {
    let tmp = tempfile::tempdir().unwrap();
    let home = tmp.path().join("home");
    let dev_core = Core::open(&home, dev(), None, Box::new(|_| {})).unwrap();
    dev_core.set_catalog_url("file:///C:/Users/x/Documents/catalog.json").unwrap();
    drop(dev_core);
    let defaut = "https://exemple.fr/catalog.json".to_string();
    let sk = SigningKey::from_bytes(&[3u8; 32]);
    let policy = TrustPolicy::Distributed { public_key: Some(sk.verifying_key()) };
    let core = Core::open(&home, policy, Some(defaut.clone()), Box::new(|_| {})).unwrap();
    assert_eq!(core.snapshot().catalog_url, Some(defaut));
    // En développement, l'adresse locale est conservée.
    let core = Core::open(&home, dev(), Some("https://autre.fr/c.json".into()), Box::new(|_| {})).unwrap();
    assert!(core.snapshot().catalog_url.unwrap().starts_with("file:"));
}
