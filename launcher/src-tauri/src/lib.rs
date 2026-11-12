//! Couche Tauri : expose le coeur (`hangar-core`) à l'interface. Toutes les opérations système
//! (réseau, disque, processus) restent en Rust.

use hangar_core::{catalog, Core, Event, Snapshot, TrustPolicy};
use std::sync::Arc;
use tauri::{Emitter, Manager, State};

const PUBLIC_KEY: &str = include_str!("../catalog-public-key.txt");

/// Mode développement : binaire de debug (`npm run dev`) ou compilé avec `--features dev-mode`.
const DEV_MODE: bool = cfg!(debug_assertions) || cfg!(feature = "dev-mode");

fn default_catalog_url() -> Option<String> {
    option_env!("HANGAR_DEFAULT_CATALOG_URL")
        .map(str::to_string)
        .or_else(|| DEV_MODE.then(|| "http://127.0.0.1:8787/catalog.json".to_string()))
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
            get_image
        ])
        .run(tauri::generate_context!())
        .expect("erreur au démarrage de Rayan's Launcher");
}
