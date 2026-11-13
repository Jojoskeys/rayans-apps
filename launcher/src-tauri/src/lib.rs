//! Couche Tauri : expose le coeur (`hangar-core`) à l'interface. Toutes les opérations système
//! (réseau, disque, processus) restent en Rust.

use hangar_core::{catalog, local, Core, Event, Snapshot, TrustPolicy, LAUNCHER_ID};
mod shortcut;

use std::sync::Arc;
use tauri::{Emitter, Manager, State};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
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
async fn refresh_catalog(app: tauri::AppHandle, core: State<'_, CoreState>) -> CmdResult<()> {
    let r = core.refresh_catalog().await.map_err(|e| e.info());
    run_auto_updates(&app);
    r
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
    /// Raccourci global de la palette, s'il a pu être enregistré auprès du système.
    palette_shortcut: Option<String>,
    /// Choix enregistré : `auto`, `off` ou l'identifiant d'un raccourci proposé.
    palette_choice: String,
    /// Raccourcis essayés sans succès, déjà pris par un autre logiciel.
    palette_taken: Vec<String>,
    palette_options: Vec<ShortcutOption>,
}

#[derive(serde::Serialize)]
struct ShortcutOption {
    id: &'static str,
    label: &'static str,
}

#[tauri::command]
fn features(palette: State<PaletteState>) -> Features {
    let p = palette.0.lock().unwrap();
    Features {
        shortcuts: cfg!(windows),
        palette_shortcut: p.active.map(|i| PALETTE_SHORTCUTS[i].1.to_string()),
        palette_choice: p.choice.clone(),
        palette_taken: p.taken.clone(),
        palette_options: PALETTE_SHORTCUTS.iter().map(|(id, label, _, _)| ShortcutOption { id, label }).collect(),
    }
}

// ----- Palette de commandes globale -------------------------------------------------------------

/// Raccourcis proposés pour la palette, dans l'ordre d'essai du mode automatique : si une combinaison
/// est déjà prise par un autre logiciel (assistant, overlay…), la suivante est essayée.
const PALETTE_SHORTCUTS: [(&str, &str, Modifiers, Code); 4] = [
    ("ctrl-alt-space", "Ctrl + Alt + Espace", Modifiers::CONTROL.union(Modifiers::ALT), Code::Space),
    ("ctrl-shift-space", "Ctrl + Maj + Espace", Modifiers::CONTROL.union(Modifiers::SHIFT), Code::Space),
    ("ctrl-alt-l", "Ctrl + Alt + L", Modifiers::CONTROL.union(Modifiers::ALT), Code::KeyL),
    ("ctrl-shift-alt-space", "Ctrl + Maj + Alt + Espace", Modifiers::CONTROL.union(Modifiers::SHIFT).union(Modifiers::ALT), Code::Space),
];

#[derive(Default)]
struct PaletteInner {
    choice: String,
    /// Indice dans `PALETTE_SHORTCUTS` du raccourci enregistré.
    active: Option<usize>,
    taken: Vec<String>,
}

struct PaletteState(std::sync::Mutex<PaletteInner>, std::path::PathBuf);

fn palette_choice_file(root: &std::path::Path) -> std::path::PathBuf {
    root.join("palette-shortcut.txt")
}

/// Enregistre le raccourci demandé (ou le premier libre en mode `auto`) à la place de l'actuel.
fn apply_palette_choice(app: &tauri::AppHandle, inner: &mut PaletteInner, choice: &str) -> Result<(), String> {
    let gs = app.global_shortcut();
    if let Some(i) = inner.active.take() {
        let (_, _, m, c) = PALETTE_SHORTCUTS[i];
        let _ = gs.unregister(Shortcut::new(Some(m), c));
    }
    inner.taken.clear();
    let candidates: Vec<usize> = match choice {
        "off" => vec![],
        "auto" => (0..PALETTE_SHORTCUTS.len()).collect(),
        id => match PALETTE_SHORTCUTS.iter().position(|s| s.0 == id) {
            Some(i) => vec![i],
            None => return Err(format!("raccourci inconnu : {id}")),
        },
    };
    for i in candidates {
        let (_, label, m, c) = PALETTE_SHORTCUTS[i];
        match gs.register(Shortcut::new(Some(m), c)) {
            Ok(()) => {
                inner.active = Some(i);
                break;
            }
            Err(e) => {
                eprintln!("raccourci global {label} indisponible : {e}");
                inner.taken.push(label.to_string());
            }
        }
    }
    inner.choice = choice.to_string();
    if choice != "off" && inner.active.is_none() {
        return Err(if choice == "auto" {
            "Aucun des raccourcis proposés n'est libre : ils sont tous pris par d'autres logiciels.".into()
        } else {
            format!("{} est déjà pris par un autre logiciel. Choisissez-en un autre.", inner.taken.join(", "))
        });
    }
    Ok(())
}

#[tauri::command]
fn set_palette_shortcut(app: tauri::AppHandle, palette: State<PaletteState>, choice: String) -> CmdResult<Features> {
    {
        let mut p = palette.0.lock().unwrap();
        let previous = p.choice.clone();
        if let Err(e) = apply_palette_choice(&app, &mut p, &choice) {
            // Combinaison prise : le raccourci précédent reste en place.
            let _ = apply_palette_choice(&app, &mut p, &previous);
            return Err(other(e));
        }
        let _ = std::fs::write(&palette.1, &choice);
    }
    Ok(features(palette))
}

/// Ramène la fenêtre au premier plan et ouvre la palette.
fn show_palette(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
    let _ = app.emit("hangar://palette", ());
}

/// Après un lancement depuis la palette globale : la fenêtre se range pour laisser la place à l'application.
#[tauri::command]
fn minimize_window(window: tauri::WebviewWindow) {
    let _ = window.minimize();
}

// ----- Sauvegardes et versions ------------------------------------------------------------------

#[tauri::command]
fn list_backups(core: State<CoreState>, id: String) -> Vec<hangar_core::BackupInfo> {
    core.list_backups(&id)
}

#[tauri::command]
fn backup_app(core: State<CoreState>, id: String) -> CmdResult<hangar_core::BackupInfo> {
    core.backup(&id).map_err(|e| e.info())
}

#[tauri::command]
fn restore_backup(core: State<CoreState>, id: String, backup_id: String) -> CmdResult<()> {
    core.restore_backup(&id, &backup_id).map_err(|e| e.info())
}

#[tauri::command]
fn delete_backup(core: State<CoreState>, id: String, backup_id: String) -> CmdResult<()> {
    core.delete_backup(&id, &backup_id).map_err(|e| e.info())
}

#[tauri::command]
fn rollback(core: State<CoreState>, id: String, restore: Option<String>) -> CmdResult<()> {
    core.rollback(&id, restore.as_deref()).map_err(|e| e.info())
}

#[tauri::command]
fn set_hold(core: State<CoreState>, id: String, hold: bool) -> CmdResult<()> {
    core.set_hold(&id, hold).map_err(|e| e.info())
}

/// Ouvre dans l'Explorateur le dossier des sauvegardes d'une application.
#[tauri::command]
fn open_backups_folder(app: tauri::AppHandle, core: State<CoreState>, id: String) -> CmdResult<()> {
    if !catalog::is_valid_id(&id) {
        return Err(other("application inconnue"));
    }
    let dir = core.paths().backups_dir(&id);
    std::fs::create_dir_all(&dir).map_err(|e| other(e.to_string()))?;
    app.opener()
        .open_path(dir.to_string_lossy(), None::<&str>)
        .map_err(|e| other(format!("ouverture du dossier impossible ({e})")))
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


// ----- Historique et diagnostic -----------------------------------------------------------------

#[tauri::command]
fn get_history(core: State<CoreState>, app_id: Option<String>, limit: Option<usize>) -> Vec<hangar_core::HistoryEvent> {
    core.history(app_id.as_deref(), limit.unwrap_or(400))
}

// ----- Profil : logiciels perso, espaces de travail, règles de mise à jour ----------------------

#[tauri::command]
fn save_profile(app: tauri::AppHandle, core: State<CoreState>, profile: hangar_core::Profile) -> CmdResult<()> {
    core.save_profile(profile).map_err(|e| e.info())?;
    // Une règle passée en « automatique » s'applique tout de suite.
    run_auto_updates(&app);
    Ok(())
}

/// Découpe les arguments d'un logiciel perso (guillemets doubles pour les espaces).
fn split_args(s: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut quoted = false;
    for c in s.chars() {
        match c {
            '"' => quoted = !quoted,
            c if c.is_whitespace() && !quoted => {
                if !cur.is_empty() {
                    out.push(std::mem::take(&mut cur));
                }
            }
            c => cur.push(c),
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

fn open_kind(app: &tauri::AppHandle, kind: &str, target: &str, args: &str) -> Result<(), String> {
    match kind {
        "web" | "url" => {
            let u = url::Url::parse(target).map_err(|_| format!("adresse invalide « {target} »"))?;
            if !matches!(u.scheme(), "http" | "https") {
                return Err("seules les adresses http:// et https:// sont ouvertes".into());
            }
            app.opener().open_url(u.as_str(), None::<&str>).map_err(|e| e.to_string())
        }
        "folder" => {
            if !std::path::Path::new(target).is_dir() {
                return Err(format!("dossier introuvable : {target}"));
            }
            app.opener().open_path(target, None::<&str>).map_err(|e| e.to_string())
        }
        "program" => {
            let p = std::path::Path::new(target);
            if !p.exists() {
                return Err(format!("introuvable : {target} (déplacé ou désinstallé ?)"));
            }
            // Un .exe est lancé directement ; un raccourci (.lnk) ou un script passe par l'association Windows.
            if p.extension().is_some_and(|x| x.eq_ignore_ascii_case("exe")) {
                std::process::Command::new(p)
                    .args(split_args(args))
                    .current_dir(p.parent().unwrap_or(std::path::Path::new(".")))
                    .spawn()
                    .map(|_| ())
                    .map_err(|e| e.to_string())
            } else {
                app.opener().open_path(target, None::<&str>).map_err(|e| e.to_string())
            }
        }
        k => Err(format!("type inconnu « {k} »")),
    }
}

#[tauri::command]
fn launch_personal(app: tauri::AppHandle, core: State<CoreState>, id: String) -> CmdResult<()> {
    let p = core.profile().personal.into_iter().find(|p| p.id == id).ok_or_else(|| other("logiciel introuvable"))?;
    match open_kind(&app, &p.kind, &p.target, &p.args) {
        Ok(()) => {
            core.record(hangar_core::HistoryEvent::new("launch", Some(&id)).detail(p.name));
            Ok(())
        }
        Err(e) => {
            core.record(hangar_core::HistoryEvent::new("error", Some(&id)).detail(format!("{} : {e}", p.name)));
            Err(other(format!("{} ne s'est pas ouvert : {e}", p.name)))
        }
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceResult {
    opened: usize,
    failures: Vec<String>,
}

/// Ouvre tout un espace de travail : applications, logiciels perso, dossiers et adresses.
/// Une application déjà ouverte n'est pas comptée comme un échec.
#[tauri::command]
fn launch_workspace(app: tauri::AppHandle, core: State<CoreState>, id: String) -> CmdResult<WorkspaceResult> {
    let profile = core.profile();
    let w = profile.workspaces.iter().find(|w| w.id == id).ok_or_else(|| other("espace de travail introuvable"))?;
    let mut res = WorkspaceResult { opened: 0, failures: Vec::new() };
    for item in &w.items {
        let r = match item.kind.as_str() {
            "app" => match core.launch(&item.target) {
                Ok(_) | Err(hangar_core::Error::Running) => Ok(()),
                Err(e) => Err(format!("{} : {e}", core.installed_name(&item.target).unwrap_or(item.target.clone()))),
            },
            "personal" => match profile.personal.iter().find(|p| p.id == item.target) {
                Some(p) => open_kind(&app, &p.kind, &p.target, &p.args).map_err(|e| format!("{} : {e}", p.name)),
                None => Err("logiciel perso supprimé".into()),
            },
            k => open_kind(&app, k, &item.target, ""),
        };
        match r {
            Ok(()) => res.opened += 1,
            Err(e) => res.failures.push(e),
        }
    }
    let ev = hangar_core::HistoryEvent::new("workspace", None).detail(format!(
        "espace « {} » : {} ouvert(s){}",
        w.name,
        res.opened,
        if res.failures.is_empty() { String::new() } else { format!(", échecs : {}", res.failures.join(" ; ")) }
    ));
    core.record(ev);
    Ok(res)
}

#[tauri::command]
fn open_target(app: tauri::AppHandle, kind: String, target: String) -> CmdResult<()> {
    open_kind(&app, &kind, &target, "").map_err(other)
}

// ----- Mises à jour automatiques ----------------------------------------------------------------

/// Installe les mises à jour des applications en règle « automatique » qui sont fermées.
fn run_auto_updates(app: &tauri::AppHandle) {
    let Some(core) = app.try_state::<CoreState>() else { return };
    for id in core.auto_update_targets() {
        core.mark_auto(&id);
        let core = Arc::clone(&core);
        tauri::async_runtime::spawn(async move {
            let _ = core.install(&id).await;
        });
    }
}

// ----- Centre de stockage -----------------------------------------------------------------------

#[tauri::command]
fn storage_report(core: State<CoreState>) -> hangar_core::StorageReport {
    core.storage_report()
}

#[tauri::command]
fn clean_storage(core: State<CoreState>, id: String, kinds: Vec<String>) -> CmdResult<u64> {
    core.clean(&id, &kinds).map_err(|e| e.info())
}

#[tauri::command]
fn open_path(app: tauri::AppHandle, core: State<CoreState>, path: String) -> CmdResult<()> {
    // Seulement les dossiers du launcher (le centre de stockage montre leurs chemins).
    let p = std::path::PathBuf::from(&path);
    if !p.starts_with(&core.paths().root) {
        return Err(other("dossier hors du launcher"));
    }
    let dir = if p.is_dir() { p } else { p.parent().map(|x| x.to_path_buf()).unwrap_or(p) };
    app.opener().open_path(dir.to_string_lossy(), None::<&str>).map_err(|e| other(e.to_string()))
}

// ----- Atelier de publication -------------------------------------------------------------------

#[tauri::command]
fn workshop_analyze(core: State<CoreState>, path: String) -> CmdResult<hangar_core::workshop::WorkshopReport> {
    core.workshop_analyze(std::path::Path::new(&path)).map_err(|e| e.info())
}

// ----- Export et migration ----------------------------------------------------------------------

#[tauri::command]
fn export_profile(core: State<CoreState>, path: String, prefs: Option<serde_json::Value>, data: Vec<String>) -> CmdResult<u64> {
    core.export_profile(std::path::Path::new(&path), prefs, &data).map_err(|e| e.info())
}

#[tauri::command]
fn read_import(core: State<CoreState>, path: String) -> CmdResult<hangar_core::transfer::ExportManifest> {
    core.read_import(std::path::Path::new(&path)).map_err(|e| e.info())
}

#[tauri::command]
async fn import_profile(
    core: State<'_, CoreState>,
    path: String,
    options: hangar_core::ImportOptions,
) -> CmdResult<hangar_core::ImportResult> {
    let res = core.import_profile(std::path::Path::new(&path), &options).await.map_err(|e| e.info())?;
    for id in res.to_install.clone() {
        let core = Arc::clone(&core);
        tauri::async_runtime::spawn(async move {
            let _ = core.install(&id).await;
        });
    }
    Ok(res)
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
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        show_palette(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            let key = catalog::parse_public_key(PUBLIC_KEY).expect("catalog-public-key.txt invalide");
            let policy = if DEV_MODE {
                TrustPolicy::Development { public_key: key }
            } else {
                TrustPolicy::Distributed { public_key: key }
            };
            let root: std::path::PathBuf = match std::env::var_os("HANGAR_HOME") {
                Some(p) => p.into(),
                None => app.path().app_local_data_dir()?,
            };
            // Raccourci global de la palette, depuis n'importe quelle application (choix dans les
            // paramètres, par défaut le premier libre). Ctrl + K reste disponible dans le launcher.
            let choice_file = palette_choice_file(&root);
            let choice = std::fs::read_to_string(&choice_file)
                .map(|s| s.trim().to_string())
                .ok()
                .filter(|s| s == "auto" || s == "off" || PALETTE_SHORTCUTS.iter().any(|p| p.0 == s))
                .unwrap_or_else(|| "auto".into());
            let mut inner = PaletteInner::default();
            let _ = apply_palette_choice(app.handle(), &mut inner, &choice);
            app.manage(PaletteState(std::sync::Mutex::new(inner), choice_file));
            let handle = app.handle().clone();
            let core = Core::open(
                root,
                policy,
                default_catalog_url(),
                Box::new(move |ev| {
                    // Une application en règle « automatique » se met à jour dès qu'elle est fermée.
                    if matches!(ev, Event::Exited { .. }) {
                        let h = handle.clone();
                        tauri::async_runtime::spawn(async move { run_auto_updates(&h) });
                    }
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
            // Actualisation du catalogue au démarrage (le dernier catalogue valide est déjà chargé), puis
            // toutes les heures, chacune suivie des mises à jour automatiques.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    let _ = core.refresh_catalog().await;
                    run_auto_updates(&handle);
                    tokio::time::sleep(std::time::Duration::from_secs(3600)).await;
                }
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
            get_image,
            minimize_window,
            set_palette_shortcut,
            list_backups,
            backup_app,
            restore_backup,
            delete_backup,
            rollback,
            set_hold,
            open_backups_folder,
            get_history,
            save_profile,
            launch_personal,
            launch_workspace,
            open_target,
            storage_report,
            clean_storage,
            open_path,
            workshop_analyze,
            export_profile,
            read_import,
            import_profile
        ])
        .run(tauri::generate_context!())
        .expect("erreur au démarrage de Rayan's Launcher");
}
