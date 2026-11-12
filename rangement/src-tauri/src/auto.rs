//! Mode automatique (désactivé par défaut) : surveille les dossiers ou se réveille à intervalle régulier,
//! puis *prépare* un aperçu et prévient l'utilisateur. Il ne déplace jamais rien lui-même.

use crate::{prepare_auto_plan, AppState};
use notify::{EventKind, RecursiveMode, Watcher};
use rangement_core::AutoMode;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

pub struct AutoState {
    /// Dernier changement vu dans un dossier surveillé (mode « surveillance »).
    dirty_since: Arc<Mutex<Option<Instant>>>,
    last_run: Mutex<Option<Instant>>,
    status: Mutex<String>,
}

impl AutoState {
    pub fn new() -> AutoState {
        AutoState {
            dirty_since: Arc::new(Mutex::new(None)),
            last_run: Mutex::new(None),
            status: Mutex::new("Mode automatique désactivé".into()),
        }
    }

    pub fn status(&self) -> String {
        self.status.lock().unwrap().clone()
    }

    /// Les réglages ont changé : nouvelle vérification dès que possible.
    pub fn reconfigure(&self) {
        *self.last_run.lock().unwrap() = None;
    }

    fn set_status(&self, s: String) {
        *self.status.lock().unwrap() = s;
    }
}

fn plural(n: usize) -> &'static str {
    if n > 1 {
        "s"
    } else {
        ""
    }
}

pub fn start(app: AppHandle) {
    std::thread::spawn(move || {
        let mut watcher: Option<(notify::RecommendedWatcher, Vec<PathBuf>)> = None;
        loop {
            std::thread::sleep(Duration::from_secs(2));
            let state = app.state::<AppState>();
            let cfg = state.config.lock().unwrap().clone();
            let auto = &state.auto;
            if !cfg.auto.enabled {
                watcher = None;
                auto.set_status("Mode automatique désactivé".into());
                continue;
            }
            match cfg.auto.mode {
                AutoMode::Surveillance => {
                    if watcher.as_ref().map(|(_, f)| f != &cfg.watched).unwrap_or(true) {
                        watcher = None;
                        let dirty = auto.dirty_since.clone();
                        let made = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
                            if let Ok(ev) = res {
                                if matches!(ev.kind, EventKind::Create(_) | EventKind::Modify(_)) {
                                    *dirty.lock().unwrap() = Some(Instant::now());
                                }
                            }
                        });
                        match made {
                            Ok(mut w) => {
                                let mut ok = 0;
                                for f in &cfg.watched {
                                    if w.watch(f, RecursiveMode::NonRecursive).is_ok() {
                                        ok += 1;
                                    }
                                }
                                auto.set_status(format!("Surveille {ok} dossier{} (aperçu préparé, jamais appliqué seul)", plural(ok)));
                                // Première vérification après le temps de calme.
                                *auto.dirty_since.lock().unwrap() = Some(Instant::now());
                                watcher = Some((w, cfg.watched.clone()));
                            }
                            Err(e) => auto.set_status(format!("Surveillance impossible : {e}")),
                        }
                    }
                    // Attendre que les fichiers ne bougent plus et soient assez anciens pour être rangés.
                    let quiet = Duration::from_secs((cfg.ignore_recent_minutes as u64 * 60 + 5).max(30));
                    let due = {
                        let mut d = auto.dirty_since.lock().unwrap();
                        match *d {
                            Some(t) if t.elapsed() >= quiet => {
                                *d = None;
                                true
                            }
                            _ => false,
                        }
                    };
                    if due {
                        prepare_auto_plan(&app);
                    }
                }
                AutoMode::Intervalle => {
                    watcher = None;
                    let every = Duration::from_secs(cfg.auto.interval_minutes.max(5) as u64 * 60);
                    auto.set_status(format!(
                        "Vérifie toutes les {} min (aperçu préparé, jamais appliqué seul)",
                        cfg.auto.interval_minutes.max(5)
                    ));
                    let due = {
                        let mut last = auto.last_run.lock().unwrap();
                        if last.map(|t| t.elapsed() >= every).unwrap_or(true) {
                            *last = Some(Instant::now());
                            true
                        } else {
                            false
                        }
                    };
                    if due {
                        prepare_auto_plan(&app);
                    }
                }
            }
        }
    });
}
