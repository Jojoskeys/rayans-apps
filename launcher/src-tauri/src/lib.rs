//! Couche Tauri : expose le coeur (`hangar-core`) à l'interface. Toutes les opérations système
//! (réseau, disque, processus) restent en Rust.

use hangar_core::{catalog, local, Core, Event, Snapshot, TrustPolicy, LAUNCHER_ID};
mod shortcut;

use std::sync::Arc;
use tauri::{Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;

const PUBLIC_KEY: &str = include_str!("../catalog-public-key.txt");

/// Mode développement : binaire de debug (`npm run dev`) ou compilé avec `--features dev-mode`.
const DEV_MODE: bool = cfg!(debug_assertions) || cfg!(feature = "dev-mode");

/// Catalogue signé publié par la CI du dépôt (release GitHub « catalogue »), voir launcher/README.md.
const PUBLISHED_CATALOG_URL: &str =
    "https://github.com/Jojoskeys/rayans-apps/releases/download/catalogue/catalog.json";

/// Adresse imposée à la compilation ; sinon serveur de démonstration pour `npm run dev` et les tests
/// d'interface, et catalogue publié par la CI pour l'installateur de distribution.
/// L'installateur « développement » n'en a pas : il crée un catalogue local au premier démarrage.
fn default_catalog_url() -> Option<String> {
    if let Some(u) = option_env!("HANGAR_DEFAULT_CATALOG_URL") {
        return Some(u.to_string());
    }
    if cfg!(debug_assertions) {
        Some("http://127.0.0.1:8787/catalog.json".to_string())
    } else if DEV_MODE {
        None
    } else {
        Some(PUBLISHED_CATALOG_URL.to_string())
    }
}

/// Premier démarrage sans adresse : crée « Documents\Rayan's Launcher\catalog.json » et l'utilise.
fn create_local_catalog(app: &tauri::App, core: &Core) -> Result<(), Box<dyn std::error::Error>> {
    let docs = app.path().document_dir().or_else(|_| app.path().home_dir().map(|h| h.join("Documents")))?;
    let dir = docs.join("Rayan's Launcher");
    let path = local::ensure_local_catalog(&dir)?;
    core.set_catalog_url(&local::file_url(&path)?)?;
    Ok(())
}

type CoreState = Arc<Core>;
type CmdResult<T> = Result<T, hangar_core::ErrorInfo>;

#[tauri::command]
fn get_snapshot(core: State<CoreState>) -> Snapshot {
    core.snapshot()
}

#[tauri::command]
async fn refresh_catalog(core: State<'_, CoreState>) -> CmdResult<()> {
    core.refresh_catalog().await.map_err(|e| e.info())
}

#[tauri::command]
async fn set_catalog_url(core: State<'_, CoreState>, url: String) -> CmdResult<()> {
    core.set_catalog_url(&url).map_err(|e| e.info())?;
    core.refresh_catalog().await.map_err(|e| e.info())
}

/// Démarre l'installation ou la mise à jour en tâche de fond ; la progression arrive par événements.
#[tauri::command]
fn install(core: State<CoreState>, id: String) {
    let core = Arc::clone(&core);
    tauri::async_runtime::spawn(async move {
        let _ = core.install(&id).await;
    });
}

#[tauri::command]
fn launch(core: State<CoreState>, id: String) -> CmdResult<u32> {
    core.launch(&id).map_err(|e| e.info())
}

#[tauri::command]
fn uninstall(app: tauri::AppHandle, core: State<CoreState>, id: String, remove_data: bool) -> CmdResult<()> {
    let name = core.installed_name(&id);
    core.uninstall(&id, remove_data).map_err(|e| e.info())?;
    // Le raccourci du Bureau créé par le launcher n'a plus de sens.
    if let (Some(name), Ok(desk)) = (name, app.path().desktop_dir()) {
        let _ = std::fs::remove_file(desk.join(shortcut::file_name(&name)));
    }
    Ok(())
}

#[tauri::command]
fn cancel_download(core: State<CoreState>, id: String) -> bool {
    core.cancel_download(&id)
}

#[tauri::command]
fn discard_download(core: State<CoreState>, id: String) {
    core.discard_download(&id)
}

fn other(msg: impl Into<String>) -> hangar_core::ErrorInfo {
    hangar_core::Error::Other(msg.into()).info()
}

/// Ouvre dans l'Explorateur le dossier de la version installée (`which = "install"`) ou des données.
#[tauri::command]
fn open_folder(app: tauri::AppHandle, core: State<CoreState>, id: String, which: String) -> CmdResult<()> {
    let dir = if which == "data" {
        core.data_dir(&id).map_err(|e| e.info())?
    } else {
        core.installed_paths(&id).map_err(|e| e.info())?.0
    };
    app.opener()
        .open_path(dir.to_string_lossy(), None::<&str>)
        .map_err(|e| other(format!("ouverture du dossier impossible ({e})")))
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct Features {
    shortcuts: bool,
}

#[tauri::command]
fn features() -> Features {
    Features { shortcuts: cfg!(windows) }
}

/// Crée (ou remplace) un raccourci sur le Bureau qui lance l'application via Rayan's Launcher.
#[tauri::command]
fn create_shortcut(app: tauri::AppHandle, core: State<CoreState>, id: String) -> CmdResult<String> {
    let (_, exe) = core.installed_paths(&id).map_err(|e| e.info())?;
    let name = core.installed_name(&id).unwrap_or_else(|| id.clone());
    let desk = app.path().desktop_dir().map_err(|e| other(format!("Bureau introuvable ({e})")))?;
    let lnk = desk.join(shortcut::file_name(&name));
    let launcher = std::env::current_exe().map_err(|e| other(e.to_string()))?;
    let ico = shortcut::icon_path(&core.paths().app_dir(&id));
    shortcut::create(&lnk, &launcher, &id, &exe, &ico, &format!("Lancer {name} avec Rayan's Launcher"))
        .map_err(|e| other(format!("raccourci non créé : {e}")))?;
    Ok(lnk.display().to_string())
}

/// Nouvelle version du launcher : entrée `rayans-launcher` du catalogue (publiée par la CI) ou installateur
/// déposé dans « À ajouter » (catalogue local). La plus récente l'emporte.
fn find_launcher_update(app: &tauri::AppHandle, core: &Core) -> Option<local::LauncherUpdate> {
    let current = semver::Version::parse(&app.package_info().version.to_string()).ok()?;
    let dropped = core.local_catalog_path().and_then(|cat| local::find_launcher_update(&cat, &current, DEV_MODE));
    let published = core.catalog_version(LAUNCHER_ID).filter(|v| v > &current).map(|v| local::LauncherUpdate {
        version: v.to_string(),
        file: "catalogue".into(),
        source: Default::default(),
        entry: None,
        from_catalog: true,
    });
    match (dropped, published) {
        (Some(d), Some(p)) => {
            let newer = semver::Version::parse(&p.version).ok() > semver::Version::parse(&d.version).ok();
            Some(if newer { p } else { d })
        }
        (d, p) => d.or(p),
    }
}

#[tauri::command]
fn launcher_update(app: tauri::AppHandle, core: State<CoreState>) -> Option<local::LauncherUpdate> {
    find_launcher_update(&app, &core)
}

/// Lance l'installateur de la nouvelle version puis ferme le launcher (l'installateur le remplace).
/// Depuis le catalogue, l'installateur est d'abord téléchargé et vérifié (SHA-256) comme une application.
#[tauri::command]
async fn apply_launcher_update(app: tauri::AppHandle, core: State<'_, CoreState>) -> CmdResult<()> {
    if !cfg!(windows) {
        return Err(other("la mise à jour du launcher n'est disponible que sous Windows"));
    }
    if core.snapshot().apps.iter().any(|a| a.task.is_some()) {
        return Err(hangar_core::Error::Busy.info());
    }
    let u = find_launcher_update(&app, &core).ok_or_else(|| other("aucune nouvelle version du launcher"))?;
    let dir = std::env::temp_dir().join(format!("rayans-launcher-maj-{}", u.version));
    let setup = if u.from_catalog {
        let core = Arc::clone(&core);
        core.install(LAUNCHER_ID).await.map_err(|e| e.info())?;
        let (_, exe) = core.installed_paths(LAUNCHER_ID).map_err(|e| e.info())?;
        // Copie hors du dossier de version : la prochaine mise à jour pourra le remplacer.
        std::fs::create_dir_all(&dir).map_err(|e| other(e.to_string()))?;
        let out = dir.join(exe.file_name().unwrap_or_default());
        std::fs::copy(&exe, &out).map_err(|e| other(format!("installateur non copié ({e})")))?;
        out
    } else {
        local::take_launcher_setup(&u, &dir).map_err(|e| e.info())?
    };
    std::process::Command::new(&setup)
        .spawn()
        .map_err(|e| other(format!("installateur non lancé ({e})")))?;
    app.exit(0);
    Ok(())
}

/// `--launch <id>` (raccourci du Bureau) : lance l'application installée.
fn launch_from_args(app: &tauri::AppHandle, args: &[String]) {
    let Some(id) = shortcut::launch_arg(args) else { return };
    if let Some(core) = app.try_state::<CoreState>() {
        let _ = core.launch(&id);
    }
}

#[tauri::command]
fn inspect_zip(core: State<CoreState>, path: String) -> CmdResult<local::ZipProposal> {
    core.inspect_zip(std::path::Path::new(&path)).map_err(|e| e.info())
}

#[tauri::command]
async fn add_zip(core: State<'_, CoreState>, path: String, entry: local::ZipEntry) -> CmdResult<String> {
    core.add_zip(std::path::Path::new(&path), &entry).await.map_err(|e| e.info())
}

#[tauri::command]
fn dismiss_notices(core: State<CoreState>) {
    core.clear_notices()
}

#[tauri::command]
fn dismiss_error(core: State<CoreState>, id: String) {
    core.clear_error(&id)
}

#[tauri::command]
fn get_image(core: State<CoreState>, id: String, kind: String) -> Option<String> {
    core.image_data_url(&id, &kind)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Raccourci ouvert alors que le launcher tourne déjà : on lance l'application sans autre fenêtre.
            if shortcut::launch_arg(&args).is_some() {
                launch_from_args(app, &args);
                return;
            }
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let key = catalog::parse_public_key(PUBLIC_KEY).expect("catalog-public-key.txt invalide");
            let policy = if DEV_MODE {
                TrustPolicy::Development { public_key: key }
            } else {
                TrustPolicy::Distributed { public_key: key }
            };
            let root = match std::env::var_os("HANGAR_HOME") {
                Some(p) => p.into(),
                None => app.path().app_local_data_dir()?,
            };
            let handle = app.handle().clone();
            let core = Core::open(
                root,
                policy,
                default_catalog_url(),
                Box::new(move |ev| {
                    let _ = match &ev {
                        Event::Progress { .. } => handle.emit("hangar://progress", &ev),
                        _ => handle.emit("hangar://changed", &ev),
                    };
                }),
            )?;
            if DEV_MODE && !core.has_catalog_url() {
                if let Err(e) = create_local_catalog(app, &core) {
                    eprintln!("catalogue local non créé : {e}");
                }
            }
            app.manage(Arc::clone(&core));
            launch_from_args(app.handle(), &std::env::args().collect::<Vec<_>>());
            // Actualisation du catalogue au démarrage (le dernier catalogue valide est déjà chargé).
            tauri::async_runtime::spawn(async move {
                let _ = core.refresh_catalog().await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            refresh_catalog,
            set_catalog_url,
            install,
            launch,
            uninstall,
            dismiss_error,
            inspect_zip,
            add_zip,
            dismiss_notices,
            cancel_download,
            discard_download,
            open_folder,
            features,
            create_shortcut,
            launcher_update,
            apply_launcher_update,
            get_image
        ])
        .run(tauri::generate_context!())
        .expect("erreur au démarrage de Rayan's Launcher");
}
