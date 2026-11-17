//! Rayan's Journal : couche Tauri. L'archive et les imports sont dans `journal-core`, les capteurs Windows
//! dans `collecte/`.
//!
//! Rien n'est collecté avant que l'utilisateur active la collecte dans l'application. La fermeture de la
//! fenêtre la cache dans la zone de notification tant que la collecte est active ; « Quitter » arrête tout.

mod chrono_lien;
mod collecte;
mod reglages;
mod securite;

use collecte::{Contexte, Ctx};
use journal_core::archive::{ConversationVue, MessageVue, RapportImport, Statistiques};
use journal_core::temps::{maintenant_ms, FuseauLocal};
use journal_core::{crypto, imports, Archive, Evenement, Filtre};
use reglages::Reglages;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, State, WindowEvent, Wry};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

pub struct AppState {
    ctx: Ctx,
    menu_pause: Mutex<Option<MenuItem<Wry>>>,
    menu_absence: Mutex<Option<MenuItem<Wry>>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EtatVue {
    reglages: Reglages,
    version: String,
    dossier: PathBuf,
    statistiques: Option<Statistiques>,
    erreur_archive: Option<String>,
    en_pause: bool,
    demarrage_auto: bool,
    raccourci: &'static str,
}

const RACCOURCI: &str = "Ctrl+Alt+J";

fn dossier_donnees() -> PathBuf {
    if let Some(d) = std::env::var_os("JOURNAL_DATA_DIR") {
        return PathBuf::from(d);
    }
    dirs::data_local_dir().unwrap_or_else(std::env::temp_dir).join("Rayan's Journal")
}

fn err(e: impl ToString) -> String {
    e.to_string()
}

fn avec<T>(ctx: &Ctx, f: impl FnOnce(&Archive) -> journal_core::Resultat<T>) -> Result<T, String> {
    match ctx.archive.lock().unwrap().as_ref() {
        Some(a) => f(a).map_err(err),
        None => Err(ctx.erreur_archive.clone().unwrap_or_else(|| "Archive indisponible.".into())),
    }
}

// ---------------------------------------------------------------------------------------------------
// Démarrage automatique (clé « Run » de l'utilisateur, aucune autre modification du système)
// ---------------------------------------------------------------------------------------------------

const CLE_RUN: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
const NOM_RUN: &str = "Rayans Journal";

#[cfg(windows)]
fn reg(args: &[&str]) -> bool {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("reg")
        .args(args)
        .creation_flags(0x0800_0000)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[cfg(not(windows))]
fn reg(_: &[&str]) -> bool {
    false
}

fn demarrage_auto_actif() -> bool {
    reg(&["query", CLE_RUN, "/v", NOM_RUN])
}

// ---------------------------------------------------------------------------------------------------
// Commandes
// ---------------------------------------------------------------------------------------------------

fn vue(app: &AppHandle, ctx: &Ctx) -> EtatVue {
    let reglages = ctx.reglages.read().unwrap().clone();
    EtatVue {
        en_pause: reglages.en_pause(maintenant_ms()),
        reglages,
        version: app.package_info().version.to_string(),
        dossier: ctx.dossier.clone(),
        statistiques: ctx.avec_archive(|a| a.statistiques().ok()).flatten(),
        erreur_archive: ctx.erreur_archive.clone(),
        demarrage_auto: demarrage_auto_actif(),
        raccourci: RACCOURCI,
    }
}

#[tauri::command]
fn etat(app: AppHandle, state: State<AppState>) -> EtatVue {
    vue(&app, &state.ctx)
}

#[tauri::command]
fn enregistrer_reglages(nouveaux: Reglages, app: AppHandle, state: State<AppState>) -> Result<EtatVue, String> {
    for d in &nouveaux.dossiers {
        if !d.is_dir() {
            return Err(format!("Le dossier « {} » n'existe pas.", d.display()));
        }
    }
    let ctx = &state.ctx;
    let relancer_fichiers = {
        let mut r = ctx.reglages.write().unwrap();
        let mut n = nouveaux;
        // L'accord et la pause ne changent que par leurs propres commandes.
        n.collecte_active = r.collecte_active;
        n.pause_jusqua_ms = r.pause_jusqua_ms;
        n.confiance = r.confiance.clone();
        n.absent_depuis_ms = r.absent_depuis_ms;
        let relancer = n.dossiers != r.dossiers || n.ignores != r.ignores || n.fichiers != r.fichiers;
        n.enregistrer(&ctx.dossier)?;
        *r = n;
        relancer
    };
    if relancer_fichiers {
        collecte::fichiers::reconfigurer(ctx, false);
    }
    raccourci(&app);
    Ok(vue(&app, ctx))
}

#[tauri::command]
fn activer_collecte(actif: bool, app: AppHandle, state: State<AppState>) -> Result<EtatVue, String> {
    let ctx = &state.ctx;
    if actif {
        avec(ctx, |a| {
            if a.reglage(collecte::systeme::DEPUIS)?.is_none() {
                a.definir_reglage(collecte::systeme::DEPUIS, &maintenant_ms().to_string())?;
            }
            Ok(())
        })?;
    }
    {
        let mut r = ctx.reglages.write().unwrap();
        r.collecte_active = actif;
        if !actif {
            r.pause_jusqua_ms = None;
        }
        r.enregistrer(&ctx.dossier)?;
    }
    ctx.note_collecte(
        if actif { "activation" } else { "desactivation" },
        if actif { "Collecte activée" } else { "Collecte désactivée" },
        None,
        false,
    );
    collecte::fichiers::reconfigurer(ctx, false);
    if actif {
        collecte::systeme::rattraper(ctx);
    }
    rafraichir_tray(&app);
    Ok(vue(&app, ctx))
}

#[tauri::command]
fn pause(minutes: Option<u32>, app: AppHandle, state: State<AppState>) -> EtatVue {
    collecte::mettre_en_pause(&state.ctx, minutes);
    rafraichir_tray(&app);
    vue(&app, &state.ctx)
}

#[tauri::command]
fn reprendre(app: AppHandle, state: State<AppState>) -> EtatVue {
    collecte::reprendre(&state.ctx, "demandée dans l'application");
    rafraichir_tray(&app);
    vue(&app, &state.ctx)
}

#[tauri::command]
fn evenements(filtre: Filtre, state: State<AppState>) -> Result<Vec<Evenement>, String> {
    avec(&state.ctx, |a| a.chercher_evenements(&filtre))
}

#[tauri::command]
fn messages(filtre: Filtre, state: State<AppState>) -> Result<Vec<MessageVue>, String> {
    avec(&state.ctx, |a| a.chercher_messages(&filtre))
}

#[tauri::command]
fn conversations(appli: Option<String>, state: State<AppState>) -> Result<Vec<ConversationVue>, String> {
    avec(&state.ctx, |a| a.conversations(appli.as_deref()))
}

#[tauri::command]
async fn importer(chemin: PathBuf, state: State<'_, AppState>) -> Result<RapportImport, String> {
    let ctx = state.ctx.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let p = imports::paquet::ouvrir(&chemin).map_err(err)?;
        let nom = chemin.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        let lot = imports::lire(p.as_ref(), &nom, &FuseauLocal).map_err(err)?;
        let mut garde = ctx.archive.lock().unwrap();
        let a = garde.as_mut().ok_or_else(|| ctx.erreur_archive.clone().unwrap_or_default())?;
        a.importer(&lot, p.as_ref(), &nom, maintenant_ms()).map_err(err)
    })
    .await
    .map_err(err)?
}

#[tauri::command]
fn enregistrer_piece(id: i64, chemin: PathBuf, state: State<AppState>) -> Result<(), String> {
    let (_, octets) = avec(&state.ctx, |a| a.piece(id))?;
    std::fs::write(&chemin, octets).map_err(err)
}

#[tauri::command]
fn nom_piece(id: i64, state: State<AppState>) -> Result<String, String> {
    avec(&state.ctx, |a| a.piece(id).map(|p| p.0))
}

#[tauri::command]
async fn exporter(quoi: String, filtre: Filtre, dossier: PathBuf, app: AppHandle, state: State<'_, AppState>) -> Result<Vec<PathBuf>, String> {
    let fichiers = avec(&state.ctx, |a| a.exporter(&quoi, &filtre, &dossier, maintenant_ms()))?;
    if let Some(f) = fichiers.last() {
        let _ = app.opener().reveal_item_in_dir(f);
    }
    Ok(fichiers)
}

#[tauri::command]
fn supprimer_conversation(id: i64, state: State<AppState>) -> Result<(), String> {
    avec(&state.ctx, |a| a.supprimer_conversation(id))
}

#[tauri::command]
fn appliquer_conservation(app: AppHandle, state: State<AppState>) -> EtatVue {
    collecte::appliquer_conservation(&state.ctx);
    vue(&app, &state.ctx)
}

#[tauri::command]
fn demarrage_auto(actif: bool, app: AppHandle, state: State<AppState>) -> Result<EtatVue, String> {
    let ok = if actif {
        let exe = std::env::current_exe().map_err(err)?;
        let valeur = format!("\"{}\" --arriere-plan", exe.display());
        reg(&["add", CLE_RUN, "/v", NOM_RUN, "/t", "REG_SZ", "/d", &valeur, "/f"])
    } else {
        !demarrage_auto_actif() || reg(&["delete", CLE_RUN, "/v", NOM_RUN, "/f"])
    };
    if !ok {
        return Err("Windows a refusé de modifier le démarrage automatique.".into());
    }
    Ok(vue(&app, &state.ctx))
}

#[tauri::command]
fn ouvrir_dossier(chemin: PathBuf, app: AppHandle) -> Result<(), String> {
    app.opener().open_path(chemin.to_string_lossy(), None::<&str>).map_err(err)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SecuriteVue {
    programmes: Vec<journal_core::archive::ProgrammeVue>,
    demarrage: Vec<securite::EntreeDemarrage>,
    detections: Vec<securite::Detection>,
}

#[tauri::command]
fn securite_etat(state: State<AppState>) -> Result<SecuriteVue, String> {
    Ok(SecuriteVue {
        programmes: avec(&state.ctx, |a| a.programmes())?,
        demarrage: securite::entrees_demarrage(),
        detections: securite::detections(),
    })
}

#[tauri::command]
fn reanalyser(chemin: String) {
    securite::reanalyser(&chemin);
}

#[tauri::command]
async fn analyser_defender(chemin: String, state: State<'_, AppState>) -> Result<(bool, String), String> {
    let ctx = state.ctx.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let r = securite::analyse_defender(&chemin);
        if let Ok((menace, _)) = &r {
            let nom = chemin.rsplit(['\\', '/']).next().unwrap_or(&chemin).to_string();
            let mut e = collecte::evenement(
                "securite",
                "analyse_defender",
                format!("Analyse Defender de {nom} : {}", if *menace { "menace trouvée" } else { "aucune menace" }),
                Some(nom),
            );
            e.contenu.chemin = Some(chemin.clone());
            ctx.envoyer(e);
            securite::reanalyser(&chemin);
        }
        r
    })
    .await
    .map_err(err)?
}

#[tauri::command]
fn montrer_fichier(chemin: PathBuf, app: AppHandle) -> Result<(), String> {
    app.opener().reveal_item_in_dir(&chemin).map_err(err)
}

/// Ajoute (ou retire) une règle de confiance, puis refait l'analyse des programmes concernés.
fn changer_confiance(app: &AppHandle, ctx: &Ctx, ajouter: Option<String>, retirer: Option<String>) -> Result<EtatVue, String> {
    let concernee = ajouter.clone().or(retirer.clone()).unwrap_or_default();
    {
        let mut r = ctx.reglages.write().unwrap();
        if let Some(a) = &ajouter {
            if !r.confiance.iter().any(|x| x.eq_ignore_ascii_case(a)) {
                r.confiance.push(a.clone());
            }
        }
        if let Some(x) = &retirer {
            r.confiance.retain(|y| !y.eq_ignore_ascii_case(x));
        }
        r.enregistrer(&ctx.dossier)?;
    }
    for p in avec(ctx, |a| a.programmes())? {
        if securite::regle_couvre(&concernee, &p.analyse.chemin) {
            securite::reanalyser(&p.analyse.chemin);
        }
    }
    Ok(vue(app, ctx))
}

/// `dossier` : faire confiance à tout un dossier (ex. tes projets) plutôt qu'à ce seul fichier.
#[tauri::command]
fn faire_confiance(chemin: String, dossier: Option<String>, app: AppHandle, state: State<AppState>) -> Result<EtatVue, String> {
    let regle = match dossier {
        Some(d) => {
            let d = d.trim_end_matches(['\\', '/']).to_string() + "\\";
            if !securite::regle_couvre(&d, &chemin) {
                return Err("Ce dossier ne contient pas le programme.".into());
            }
            d
        }
        None => chemin,
    };
    changer_confiance(&app, &state.ctx, Some(regle), None)
}

#[tauri::command]
fn retirer_confiance(regle: String, app: AppHandle, state: State<AppState>) -> Result<EtatVue, String> {
    changer_confiance(&app, &state.ctx, None, Some(regle))
}

// ---------------------------------------------------------------------------------------------------
// Mes journées, fichiers, absence, Chrono
// ---------------------------------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RapportVue {
    rapport: journal_core::rapport::Rapport,
    chrono: Option<chrono_lien::ChronoVue>,
    fichiers_touches: usize,
}

const CATEGORIES_ECRAN: &[&str] = &["fenetre", "session", "collecte"];

#[tauri::command]
async fn rapport(du: i64, au: i64, jours: Vec<i64>, state: State<'_, AppState>) -> Result<RapportVue, String> {
    let ctx = state.ctx.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let projets = ctx.reglages.read().unwrap().projets.clone();
        // On remonte de 24 h pour connaître la fenêtre active au début de la période.
        let ev = avec(&ctx, |a| a.evenements_periode(du - 86_400_000, au, CATEGORIES_ECRAN))?;
        let fichiers = avec(&ctx, |a| a.evenements_periode(du, au, &["fichier"]))?;
        let mut chemins: Vec<&str> = fichiers.iter().filter_map(|e| e.contenu.chemin.as_deref()).collect();
        chemins.sort_unstable();
        chemins.dedup();
        Ok(RapportVue {
            rapport: journal_core::rapport::rapport(&ev, du, au, &jours, &projets),
            chrono: chrono_lien::lire(du, au),
            fichiers_touches: chemins.len(),
        })
    })
    .await
    .map_err(err)?
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InstantVue {
    segment: Option<journal_core::rapport::Segment>,
    autour: Vec<Evenement>,
}

#[tauri::command]
fn a_l_instant(t: i64, state: State<AppState>) -> Result<InstantVue, String> {
    let ev = avec(&state.ctx, |a| a.evenements_periode(t - 86_400_000, t + 60_000, CATEGORIES_ECRAN))?;
    let autour = avec(&state.ctx, |a| {
        a.evenements_periode(t - 15 * 60_000, t + 15 * 60_000, &["application", "fenetre", "fichier", "session", "securite"])
    })?;
    Ok(InstantVue { segment: journal_core::rapport::a_l_instant(&ev, t), autour })
}

#[tauri::command]
async fn fichiers(mots: String, genre: String, du: i64, au: i64, state: State<'_, AppState>) -> Result<Vec<journal_core::rapport::HistoriqueFichier>, String> {
    let ctx = state.ctx.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let ev = avec(&ctx, |a| a.evenements_periode(du, au, &["fichier"]))?;
        let dl = dirs::download_dir().map(|d| d.to_string_lossy().to_lowercase() + "\\").unwrap_or_default();
        let mut h = journal_core::rapport::filtrer_fichiers(journal_core::rapport::historiques_fichiers(&ev, &dl), &mots, &genre);
        h.truncate(300);
        Ok(h)
    })
    .await
    .map_err(err)?
}

#[tauri::command]
fn chrono_projets() -> Vec<String> {
    chrono_lien::lire(0, 0).map(|c| c.projets.into_iter().filter(|p| !p.archive).map(|p| p.nom).collect()).unwrap_or_default()
}

#[tauri::command]
fn chrono_lancer(projet: String) -> Result<(), String> {
    chrono_lien::lancer(&projet)
}

#[tauri::command]
fn absence(actif: bool, app: AppHandle, state: State<AppState>) -> EtatVue {
    basculer_absence(&app, &state.ctx, actif);
    vue(&app, &state.ctx)
}

fn basculer_absence(app: &AppHandle, ctx: &Ctx, actif: bool) {
    let depuis = {
        let mut r = ctx.reglages.write().unwrap();
        let avant = r.absent_depuis_ms;
        r.absent_depuis_ms = if actif { Some(avant.unwrap_or_else(maintenant_ms)) } else { None };
        let _ = r.enregistrer(&ctx.dossier);
        avant
    };
    if actif && depuis.is_none() {
        ctx.note_collecte("absence", "Je m'absente : toute utilisation du PC sera signalée", None, false);
    } else if !actif {
        if let Some(d) = depuis {
            let n = ctx
                .avec_archive(|a| {
                    a.chercher_evenements(&Filtre { du_ms: Some(d), categorie: Some("securite".into()), limite: Some(5000), ..Default::default() })
                        .map(|v| v.iter().filter(|e| e.action == "activite_absence").count())
                        .unwrap_or(0)
                })
                .unwrap_or(0);
            ctx.note_collecte(
                "retour",
                "De retour",
                Some(if n == 0 { "Aucune utilisation du PC pendant l'absence.".into() } else { format!("{n} alerte(s) d'utilisation pendant l'absence : voir le journal.") }),
                false,
            );
        }
    }
    rafraichir_tray(app);
}

/// Appelé par l'interface une fois affichée. Sert au test de lancement de la CI (JOURNAL_SMOKE_FILE).
#[tauri::command]
fn frontend_ready(app: AppHandle) {
    if let Some(file) = std::env::var_os("JOURNAL_SMOKE_FILE") {
        let _ = std::fs::write(file, format!("ok {}", app.package_info().version));
        let h = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(300));
            h.exit(0);
        });
    }
}

// ---------------------------------------------------------------------------------------------------
// Zone de notification, raccourci de pause, fenêtre
// ---------------------------------------------------------------------------------------------------

fn montrer(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn rafraichir_tray(app: &AppHandle) {
    let state = app.state::<AppState>();
    let r = state.ctx.reglages.read().unwrap().clone();
    let en_pause = r.en_pause(maintenant_ms());
    if let Some(item) = state.menu_pause.lock().unwrap().as_ref() {
        let _ = item.set_text(if en_pause { format!("Reprendre la collecte ({RACCOURCI})") } else { format!("Mettre en pause ({RACCOURCI})") });
        let _ = item.set_enabled(r.collecte_active);
    }
    if let Some(item) = state.menu_absence.lock().unwrap().as_ref() {
        let _ = item.set_text(if r.absent_depuis_ms.is_some() { "Je suis de retour" } else { "Je m’absente (signaler toute utilisation)" });
        let _ = item.set_enabled(r.collecte_active);
    }
    if let Some(t) = app.tray_by_id("principal") {
        let etat = if !r.collecte_active {
            "collecte désactivée"
        } else if en_pause {
            "en pause"
        } else {
            "collecte active"
        };
        let _ = t.set_tooltip(Some(format!("Rayan’s Journal — {etat}")));
    }
}

fn basculer_pause(app: &AppHandle) {
    let state = app.state::<AppState>();
    let (actif, en_pause) = {
        let r = state.ctx.reglages.read().unwrap();
        (r.collecte_active, r.en_pause(maintenant_ms()))
    };
    if !actif {
        return;
    }
    if en_pause {
        collecte::reprendre(&state.ctx, "raccourci ou zone de notification");
    } else {
        collecte::mettre_en_pause(&state.ctx, None);
    }
    rafraichir_tray(app);
    let _ = app
        .notification()
        .builder()
        .title("Rayan’s Journal")
        .body(if en_pause { "Collecte reprise." } else { "Collecte en pause : rien n’est enregistré." })
        .show();
}

fn raccourci(app: &AppHandle) {
    let gs = app.global_shortcut();
    let s = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyJ);
    let voulu = app.state::<AppState>().ctx.reglages.read().unwrap().raccourci_pause;
    let present = gs.is_registered(s);
    if voulu && !present {
        if let Err(e) = gs.register(s) {
            eprintln!("raccourci {RACCOURCI} indisponible : {e}");
        }
    } else if !voulu && present {
        let _ = gs.unregister(s);
    }
}

fn quitter(app: &AppHandle) {
    let state = app.state::<AppState>();
    if state.ctx.reglages.read().unwrap().collecte_active {
        collecte::fichiers::enregistrer_etat(&state.ctx);
        state.ctx.note_collecte("arret", "Application quittée : suivi arrêté", None, false);
        std::thread::sleep(Duration::from_millis(400));
    }
    app.exit(0);
}

fn creer_tray(app: &AppHandle) -> tauri::Result<()> {
    let ouvrir = MenuItem::with_id(app, "ouvrir", "Ouvrir Rayan’s Journal", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause", format!("Mettre en pause ({RACCOURCI})"), true, None::<&str>)?;
    let heure = MenuItem::with_id(app, "pause1h", "Pause d’une heure", true, None::<&str>)?;
    let absent = MenuItem::with_id(app, "absence", "Je m’absente (signaler toute utilisation)", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let fin = MenuItem::with_id(app, "quitter", "Quitter (arrête la collecte)", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&ouvrir, &pause, &heure, &absent, &sep, &fin])?;
    *app.state::<AppState>().menu_absence.lock().unwrap() = Some(absent);
    *app.state::<AppState>().menu_pause.lock().unwrap() = Some(pause);
    TrayIconBuilder::with_id("principal")
        .icon(app.default_window_icon().cloned().expect("icône"))
        .tooltip("Rayan’s Journal")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, e| match e.id.as_ref() {
            "ouvrir" => montrer(app),
            "pause" => basculer_pause(app),
            "pause1h" => {
                let state = app.state::<AppState>();
                if state.ctx.reglages.read().unwrap().collecte_active {
                    collecte::mettre_en_pause(&state.ctx, Some(60));
                    rafraichir_tray(app);
                }
            }
            "absence" => {
                let ctx = app.state::<AppState>().ctx.clone();
                let actif = ctx.reglages.read().unwrap().absent_depuis_ms.is_some();
                basculer_absence(app, &ctx, !actif);
            }
            "quitter" => quitter(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, e| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e {
                montrer(tray.app_handle());
            }
        })
        .build(app)?;
    rafraichir_tray(app);
    Ok(())
}

pub fn run() {
    let dossier = dossier_donnees();
    let reglages = Reglages::charger(&dossier);
    let archive = crypto::charger_ou_creer_cle(&dossier)
        .and_then(|cle| Archive::ouvrir(&dossier, &cle))
        .map_err(|e| format!("Archive impossible à ouvrir : {e}"));
    let (ctx, rx) = Contexte::nouveau(dossier, archive, reglages);
    let arriere_plan = std::env::args().any(|a| a == "--arriere-plan");
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| montrer(app)))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _s, e| {
                    if e.state() == ShortcutState::Pressed {
                        basculer_pause(app);
                    }
                })
                .build(),
        )
        .manage(AppState { ctx: ctx.clone(), menu_pause: Mutex::new(None), menu_absence: Mutex::new(None) })
        .setup(move |app| {
            let h = app.handle().clone();
            let _ = collecte::NOTIFIER.set(Box::new(move |titre: &str, corps: &str| {
                let _ = h.notification().builder().title(titre).body(corps).show();
            }));
            securite::demarrer(ctx.clone(), app.handle().clone());
            collecte::demarrer(ctx.clone(), rx);
            creer_tray(app.handle())?;
            raccourci(app.handle());
            if !arriere_plan {
                montrer(app.handle());
            }
            Ok(())
        })
        .on_window_event(|w, e| {
            if let WindowEvent::CloseRequested { api, .. } = e {
                let actif = w.app_handle().state::<AppState>().ctx.reglages.read().unwrap().collecte_active;
                if actif {
                    // La collecte continue : la fenêtre se range dans la zone de notification.
                    api.prevent_close();
                    let _ = w.hide();
                } else {
                    quitter(w.app_handle());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            etat,
            enregistrer_reglages,
            activer_collecte,
            pause,
            reprendre,
            evenements,
            messages,
            conversations,
            importer,
            enregistrer_piece,
            nom_piece,
            exporter,
            supprimer_conversation,
            appliquer_conservation,
            demarrage_auto,
            ouvrir_dossier,
            securite_etat,
            reanalyser,
            analyser_defender,
            montrer_fichier,
            faire_confiance,
            retirer_confiance,
            rapport,
            a_l_instant,
            fichiers,
            chrono_projets,
            chrono_lancer,
            absence,
            frontend_ready
        ])
        .run(tauri::generate_context!())
        .expect("échec du démarrage de Rayan's Journal");
}
