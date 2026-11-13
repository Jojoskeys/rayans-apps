//! Rayan's Rangement : couche Tauri. Toute la logique de fichiers est dans `rangement-core`.
//!
//! Rien ne bouge sans validation : `analyser` prépare un aperçu, `appliquer` déplace seulement les
//! éléments cochés de cet aperçu. Le mode automatique (désactivé par défaut) ne fait que préparer un
//! aperçu et prévenir l'utilisateur.

use rangement_core::config::{default_rules, Theme};
use rangement_core::themes::default_themes;
use rangement_core::{
    apply_plan, build_plan, undo, ApplyReport, BatchView, Config, Journal, Plan, Rule, UndoReport,
};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

mod auto;

pub struct AppState {
    data_dir: PathBuf,
    config: Mutex<Config>,
    journal: Journal,
    /// Dernier aperçu manuel et dernier aperçu préparé par le mode automatique.
    manual_plan: Mutex<Option<Plan>>,
    auto_plan: Mutex<Option<Plan>>,
    /// Une seule opération de fichiers à la fois (analyse, application, annulation).
    busy: Mutex<()>,
    pub(crate) auto: auto::AutoState,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StateView {
    config: Config,
    data_dir: PathBuf,
    version: String,
    auto_plan: Option<Plan>,
    auto_status: String,
}

fn data_dir() -> PathBuf {
    if let Some(d) = std::env::var_os("RANGEMENT_DATA_DIR") {
        return PathBuf::from(d);
    }
    dirs::data_local_dir().unwrap_or_else(std::env::temp_dir).join("Rayan's Rangement")
}

fn load_config(dir: &Path) -> Config {
    let path = dir.join("config.json");
    if let Ok(text) = std::fs::read_to_string(&path) {
        match serde_json::from_str::<Config>(&text) {
            Ok(c) => return c,
            Err(_) => {
                // Réglages illisibles : on les garde de côté au lieu de les écraser.
                let _ = std::fs::copy(&path, dir.join("config.illisible.json"));
            }
        }
    }
    let quarantine = dirs::document_dir()
        .map(|d| d.join("Rayan's Rangement").join("Quarantaine"))
        .unwrap_or_else(|| dir.join("Quarantaine"));
    Config::first_run(dirs::download_dir(), dirs::desktop_dir(), quarantine)
}

fn save_config_file(dir: &Path, cfg: &Config) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let tmp = dir.join("config.json.tmp");
    let text = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, text).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, dir.join("config.json")).map_err(|e| e.to_string())
}

fn err(e: impl ToString) -> String {
    e.to_string()
}

#[tauri::command]
fn get_state(app: AppHandle, state: State<AppState>) -> StateView {
    StateView {
        config: state.config.lock().unwrap().clone(),
        data_dir: state.data_dir.clone(),
        version: app.package_info().version.to_string(),
        auto_plan: state.auto_plan.lock().unwrap().clone(),
        auto_status: state.auto.status(),
    }
}

#[tauri::command]
fn save_config(config: Config, state: State<AppState>) -> Result<Config, String> {
    config.validate().map_err(err)?;
    for w in &config.watched {
        if !w.is_dir() {
            return Err(format!("Le dossier « {} » n'existe pas.", w.display()));
        }
    }
    save_config_file(&state.data_dir, &config)?;
    *state.config.lock().unwrap() = config.clone();
    state.auto.reconfigure();
    Ok(config)
}

#[tauri::command]
fn rules_by_default() -> Vec<Rule> {
    default_rules(dirs::download_dir().as_deref())
}

#[tauri::command]
fn themes_by_default() -> Vec<Theme> {
    default_themes()
}

#[tauri::command]
async fn analyze(state: State<'_, AppState>) -> Result<Plan, String> {
    let _guard = state.busy.lock().unwrap();
    let cfg = state.config.lock().unwrap().clone();
    let plan = build_plan(&cfg, SystemTime::now()).map_err(err)?;
    *state.manual_plan.lock().unwrap() = Some(plan.clone());
    Ok(plan)
}

#[tauri::command]
async fn apply(plan_id: String, ids: Vec<u32>, state: State<'_, AppState>) -> Result<ApplyReport, String> {
    let _guard = state.busy.lock().unwrap();
    let (plan, origin) = {
        let manual = state.manual_plan.lock().unwrap();
        let auto = state.auto_plan.lock().unwrap();
        match (manual.as_ref(), auto.as_ref()) {
            (Some(p), _) if p.id == plan_id => (p.clone(), "manuel"),
            (_, Some(p)) if p.id == plan_id => (p.clone(), "automatique"),
            _ => return Err("Cet aperçu n'est plus d'actualité : relancez l'analyse.".into()),
        }
    };
    let report = apply_plan(&plan, &ids, &state.journal, origin).map_err(err)?;
    // Un aperçu ne sert qu'une fois.
    if origin == "manuel" {
        *state.manual_plan.lock().unwrap() = None;
    } else {
        *state.auto_plan.lock().unwrap() = None;
    }
    Ok(report)
}

#[tauri::command]
fn dismiss_auto_plan(state: State<AppState>) {
    *state.auto_plan.lock().unwrap() = None;
}

#[tauri::command]
fn history(state: State<AppState>) -> Result<Vec<BatchView>, String> {
    state.journal.batches().map_err(err)
}

#[tauri::command]
async fn undo_batch(batch: String, ops: Option<Vec<u32>>, state: State<'_, AppState>) -> Result<UndoReport, String> {
    let _guard = state.busy.lock().unwrap();
    undo(&state.journal, &batch, ops.as_deref()).map_err(err)
}

#[tauri::command]
fn reveal(path: PathBuf, app: AppHandle) -> Result<(), String> {
    if path.exists() {
        app.opener().reveal_item_in_dir(&path).map_err(err)
    } else if let Some(parent) = path.parent().filter(|p| p.is_dir()) {
        app.opener().open_path(parent.to_string_lossy(), None::<&str>).map_err(err)
    } else {
        Err(format!("« {} » n'existe pas (ou plus).", path.display()))
    }
}

#[tauri::command]
fn open_folder(path: PathBuf, app: AppHandle) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(err)?;
    app.opener().open_path(path.to_string_lossy(), None::<&str>).map_err(err)
}

/// Appelé par l'interface une fois affichée. Sert au test de lancement de la CI
/// (variable RANGEMENT_SMOKE_FILE) : on écrit « ok » puis on ferme.
#[tauri::command]
fn frontend_ready(app: AppHandle) {
    if let Some(file) = std::env::var_os("RANGEMENT_SMOKE_FILE") {
        let _ = std::fs::write(file, format!("ok {}", app.package_info().version));
        let h = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(300));
            h.exit(0);
        });
    }
}

/// Le mode automatique a préparé un aperçu : on le garde et on prévient l'utilisateur.
pub(crate) fn auto_plan_ready(app: &AppHandle, plan: Plan) {
    let state = app.state::<AppState>();
    let count = plan.items.len();
    {
        let mut slot = state.auto_plan.lock().unwrap();
        let same = slot.as_ref().is_some_and(|old| {
            old.items.len() == plan.items.len()
                && old.items.iter().zip(&plan.items).all(|(a, b)| a.source == b.source && a.destination == b.destination)
        });
        *slot = Some(plan);
        if same {
            return; // même proposition qu'avant : pas de nouvelle notification
        }
    }
    let _ = app.emit("plan-automatique", count);
    let _ = app
        .notification()
        .builder()
        .title("Rayan’s Rangement")
        .body(format!(
            "{count} fichier{} à ranger. Ouvrez l’aperçu pour valider : rien n’a été déplacé.",
            if count > 1 { "s" } else { "" }
        ))
        .show();
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.request_user_attention(Some(tauri::UserAttentionType::Informational));
    }
}

pub(crate) fn prepare_auto_plan(app: &AppHandle) {
    let state = app.state::<AppState>();
    let Ok(_guard) = state.busy.try_lock() else { return };
    let cfg = state.config.lock().unwrap().clone();
    if !cfg.auto.enabled {
        return;
    }
    if let Ok(plan) = build_plan(&cfg, SystemTime::now()) {
        if !plan.items.is_empty() {
            drop(_guard);
            auto_plan_ready(app, plan);
        }
    }
}

pub fn run() {
    let dir = data_dir();
    let config = load_config(&dir);
    let journal = Journal::open(dir.join("journal.jsonl"));
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(AppState {
            data_dir: dir,
            config: Mutex::new(config),
            journal,
            manual_plan: Mutex::new(None),
            auto_plan: Mutex::new(None),
            busy: Mutex::new(()),
            auto: auto::AutoState::new(),
        })
        .setup(|app| {
            auto::start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_state,
            save_config,
            rules_by_default,
            themes_by_default,
            analyze,
            apply,
            dismiss_auto_plan,
            history,
            undo_batch,
            reveal,
            open_folder,
            frontend_ready
        ])
        .run(tauri::generate_context!())
        .expect("échec du démarrage de Rayan's Rangement");
}
