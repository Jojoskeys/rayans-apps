//! Couche Tauri : expose le coeur (`hangar-core`) à l'interface. Toutes les opérations système
//! (réseau, disque, processus) restent en Rust.

use hangar_core::{catalog, local, Core, Event, Snapshot, TrustPolicy};
use std::sync::Arc;
use tauri::{Emitter, Manager, State};

const PUBLIC_KEY: &str = include_str!("../catalog-public-key.txt");

/// Mode développement : binaire de debug (`npm run dev`) ou compilé avec `--features dev-mode`.
const DEV_MODE: bool = cfg!(debug_assertions) || cfg!(feature = "dev-mode");

/// Adresse imposée à la compilation, ou serveur de démonstration pour `npm run dev` et les tests d'interface.
/// L'installateur « développement » n'en a pas : il crée un catalogue local au premier démarrage.
fn default_catalog_url() -> Option<String> {
    option_env!("HANGAR_DEFAULT_CATALOG_URL")
        .map(str::to_string)
        .or_else(|| cfg!(debug_assertions).then(|| "http://127.0.0.1:8787/catalog.json".to_string()))
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
fn uninstall(core: State<CoreState>, id: String, remove_data: bool) -> CmdResult<()> {
    core.uninstall(&id, remove_data).map_err(|e| e.info())
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
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
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
            get_image
        ])
        .run(tauri::generate_context!())
        .expect("erreur au démarrage de Rayan's Launcher");
}
