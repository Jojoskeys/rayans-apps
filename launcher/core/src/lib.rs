//! Coeur du launcher Rayan's Launcher. Aucune dépendance à l'interface : la couche Tauri et l'outil en ligne de
//! commande l'utilisent tous les deux, et les tests de bout en bout le pilotent directement.

pub mod archive;
pub mod backup;
pub mod catalog;
pub mod error;
pub mod history;
pub mod local;
pub mod net;
pub mod profile;
pub mod state;
pub mod transfer;
pub mod util;
pub mod workshop;

pub use backup::BackupInfo;
pub use history::HistoryEvent;
pub use profile::{PersonalApp, Profile, UpdateRules, Workspace, WorkspaceItem};
pub use catalog::{Catalog, CatalogApp, TrustPolicy};
pub use error::{Error, ErrorInfo, Result};

use base64::Engine;
use serde::Serialize;
use state::*;
use std::collections::{HashMap, HashSet};
use std::fs::{File, OpenOptions};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant};
use url::Url;

const MAX_CATALOG_BYTES: usize = 8 * 1024 * 1024;
const MAX_IMAGE_BYTES: usize = 6 * 1024 * 1024;
const VERSION_MARKER: &str = ".hangar-version.json";

/// Entrée du catalogue réservée au launcher lui-même : son ZIP contient l'installateur de la nouvelle version.
/// Elle n'apparaît pas dans la liste des applications ; la couche Tauri l'utilise pour se mettre à jour.
pub const LAUNCHER_ID: &str = "rayans-launcher";

// ---------------------------------------------------------------------------------------------
// Vue exposée à l'interface

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TaskView {
    /// "install" ou "update"
    pub kind: String,
    /// "downloading", "verifying", "extracting", "finalizing"
    pub phase: String,
    pub received: u64,
    pub total: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppView {
    pub id: String,
    pub name: String,
    pub description: String,
    pub release_notes: String,
    pub release_date: Option<String>,
    pub size: Option<u64>,
    pub available_version: Option<String>,
    pub installed_version: Option<String>,
    pub installed_release_notes: Option<String>,
    pub pending_version: Option<String>,
    pub in_catalog: bool,
    pub update_available: bool,
    pub running: bool,
    pub task: Option<TaskView>,
    /// Octets déjà reçus d'un téléchargement annulé ou coupé (reprise possible).
    pub partial_bytes: Option<u64>,
    pub last_error: Option<ErrorInfo>,
    pub data_dir: String,
    /// Version précédente gardée sur le disque (retour possible).
    pub previous_version: Option<String>,
    /// Versions du catalogue ignorées jusqu'à celle-ci incluse.
    pub held_version: Option<String>,
    pub backup_count: usize,
    pub last_backup_at: Option<String>,
    /// Règle de mise à jour effective : "ask" ou "auto".
    pub update_rule: String,
    /// La règle vient d'une exception propre à l'application.
    pub update_rule_custom: bool,
    /// Code de sortie du dernier lancement (None : jamais lancée, ou arrêtée sans code).
    pub last_exit_code: Option<i32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogView {
    /// "none" (jamais chargé), "ready"
    pub status: String,
    pub title: Option<String>,
    pub source_url: Option<String>,
    pub fetched_at: Option<String>,
    pub from_cache: bool,
    /// "signed", "unsigned"
    pub trust: Option<String>,
    pub refreshing: bool,
    pub error: Option<ErrorInfo>,
    pub warning: Option<String>,
    pub app_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub mode: String,
    pub public_key_configured: bool,
    pub catalog_url: Option<String>,
    pub data_root: String,
    pub catalog: CatalogView,
    pub apps: Vec<AppView>,
    /// Chemin du catalogue local modifiable (mode développement et adresse file://), sinon `None`.
    pub local_catalog_path: Option<String>,
    /// Résultat du dernier import du dossier « À ajouter ».
    pub notices: Vec<String>,
    pub profile: Profile,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Event {
    Changed,
    Progress { app_id: String, task: TaskView },
    Exited { app_id: String, code: Option<i32> },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum InstallOutcome {
    /// La nouvelle version est active.
    Activated,
    /// L'application est ouverte : la version est prête et sera activée à sa fermeture.
    Pending,
}

// ---------------------------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageItem {
    /// version-active, version-previous, version-pending, data, backups-auto, backups-manual, partial
    pub kind: String,
    pub label: String,
    pub bytes: u64,
    pub files: u64,
    pub removable: bool,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStorage {
    pub id: String,
    pub name: String,
    pub total: u64,
    pub reclaimable: u64,
    pub items: Vec<StorageItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageReport {
    pub apps: Vec<AppStorage>,
    /// Visuels du catalogue en cache.
    pub images: u64,
    pub total: u64,
    pub reclaimable: u64,
    pub root: String,
}

#[derive(Debug, Clone, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImportOptions {
    /// Adresse du catalogue.
    pub settings: bool,
    /// Logiciels perso, espaces de travail, règles de mise à jour.
    pub profile: bool,
    /// Applications dont les données doivent être restaurées.
    pub data: Vec<String>,
    pub install_missing: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    /// Préférences d'affichage à appliquer par l'interface.
    pub prefs: Option<serde_json::Value>,
    pub to_install: Vec<String>,
    pub restored: Vec<String>,
    pub messages: Vec<String>,
}

struct LoadedCatalog {
    catalog: Catalog,
    source_url: String,
    fetched_at: String,
    from_cache: bool,
    signed: bool,
    warning: Option<String>,
}

#[derive(Default)]
struct Inner {
    settings: Settings,
    installed: Installed,
    catalog: Option<LoadedCatalog>,
    catalog_error: Option<ErrorInfo>,
    refreshing: bool,
    tasks: HashMap<String, TaskView>,
    errors: HashMap<String, ErrorInfo>,
    /// Applications lancées par ce launcher (pid, 0 pendant la préparation du lancement).
    running: HashMap<String, u32>,
    notices: Vec<String>,
    /// Drapeau d'annulation des téléchargements en cours.
    cancels: HashMap<String, Arc<AtomicBool>>,
    profile: Profile,
    launched_at: HashMap<String, Instant>,
    last_exit: HashMap<String, Option<i32>>,
    /// Installations lancées par la règle « automatique » (notées comme telles dans l'historique).
    auto: HashSet<String>,
}

pub type Listener = Box<dyn Fn(Event) + Send + Sync>;

pub struct Core {
    paths: Paths,
    policy: TrustPolicy,
    http: reqwest::Client,
    inner: Mutex<Inner>,
    listener: Listener,
}

/// Verrou exclusif inter-processus sur une application (libéré automatiquement, même après un plantage).
struct AppLock(#[allow(dead_code)] File);

impl AppLock {
    fn acquire(path: &Path) -> Result<AppLock> {
        if let Some(d) = path.parent() {
            std::fs::create_dir_all(d)?;
        }
        let f = OpenOptions::new().create(true).truncate(false).write(true).open(path)?;
        match f.try_lock() {
            Ok(()) => Ok(AppLock(f)),
            Err(std::fs::TryLockError::WouldBlock) => Err(Error::Busy),
            Err(std::fs::TryLockError::Error(e)) => Err(e.into()),
        }
    }
}

/// Supprime un fichier ou un dossier temporaire à la sortie de portée, sauf si on le « garde ».
struct Cleanup(Option<PathBuf>);
impl Cleanup {
    fn keep(&mut self) {
        self.0 = None;
    }
}
impl Drop for Cleanup {
    fn drop(&mut self) {
        if let Some(p) = self.0.take() {
            if p.is_dir() {
                util::remove_dir_quiet(&p);
            } else {
                let _ = std::fs::remove_file(&p);
            }
        }
    }
}

impl Core {
    /// Ouvre (ou crée) l'état local. `default_catalog_url` est utilisée tant qu'aucune adresse n'a été réglée.
    pub fn open(
        root: impl Into<PathBuf>,
        policy: TrustPolicy,
        default_catalog_url: Option<String>,
        listener: Listener,
    ) -> Result<Arc<Core>> {
        let paths = Paths::new(root);
        std::fs::create_dir_all(&paths.root)?;
        let mut settings: Settings = load_json(&paths.settings())?;
        // En distribution, une adresse non HTTPS (catalogue local d'un ancien installateur de test) serait
        // refusée à chaque actualisation : l'adresse par défaut la remplace.
        let unusable = !policy.is_dev()
            && settings.catalog_url.as_deref().is_some_and(|u| !u.starts_with("https://"));
        if settings.catalog_url.is_none() || unusable {
            settings.catalog_url = default_catalog_url.filter(|u| !u.trim().is_empty());
        }
        let installed: Installed = load_json(&paths.installed())?;
        // Profil illisible (modifié à la main, disque plein…) : il est mis de côté plutôt qu'écrasé à la
        // prochaine sauvegarde, pour que les logiciels perso et les espaces restent récupérables.
        let profile: Profile = match load_json(&paths.profile()) {
            Ok(p) => p,
            Err(e) => {
                let f = time::macros::format_description!("[year][month][day]-[hour][minute][second]");
                let stamp = time::OffsetDateTime::now_utc().format(&f).unwrap_or_default();
                let kept = paths.root.join(format!("profile.illisible-{stamp}.json"));
                let _ = std::fs::rename(paths.profile(), &kept);
                history::append(
                    &paths.history(),
                    &HistoryEvent::new("error", None)
                        .detail(format!("{e} ; copie gardée dans {}", kept.display())),
                );
                Profile::default()
            }
        };
        history::trim(&paths.history());
        let mut last_exit = HashMap::new();
        for e in history::read_all(&paths.history()).into_iter().filter(|e| e.kind == "exit") {
            if let Some(id) = e.app_id {
                last_exit.insert(id, e.code);
            }
        }
        let core = Arc::new(Core {
            http: net::client(&policy),
            paths,
            policy,
            inner: Mutex::new(Inner {
                settings,
                installed,
                profile,
                last_exit,
                ..Default::default()
            }),
            listener,
        });
        core.activate_all_pending()?;
        core.cleanup_orphans();
        core.load_cached_catalog();
        Ok(core)
    }

    pub fn paths(&self) -> &Paths {
        &self.paths
    }

    fn lock(&self) -> MutexGuard<'_, Inner> {
        self.inner.lock().unwrap_or_else(|p| p.into_inner())
    }

    fn emit(&self, e: Event) {
        (self.listener)(e)
    }

    fn save_installed(&self, inner: &Inner) -> Result<()> {
        save_json(&self.paths.installed(), &inner.installed)
    }

    // ----- Démarrage ---------------------------------------------------------------------------

    fn activate_all_pending(&self) -> Result<()> {
        let mut inner = self.lock();
        let ids: Vec<String> = inner
            .installed
            .apps
            .iter()
            .filter(|(_, a)| a.pending.is_some())
            .map(|(k, _)| k.clone())
            .collect();
        for id in ids {
            self.activate_pending_locked(&mut inner, &id)?;
        }
        Ok(())
    }

    /// Supprime les restes d'opérations interrompues (préparations, téléchargements, anciennes versions).
    fn cleanup_orphans(&self) {
        let inner = self.lock();
        // Restaurations interrompues : la copie préparée ou l'ancien dossier restent à côté de data/<id>.
        if let Ok(rd) = std::fs::read_dir(self.paths.root.join("data")) {
            for e in rd.flatten() {
                let n = e.file_name().to_string_lossy().to_string();
                if n.contains(".restauration-") || n.contains(".ancien-") {
                    util::remove_dir_quiet(&e.path());
                }
            }
        }
        for id in inner.installed.apps.keys() {
            backup::prune(&self.paths, id, backup::KEEP_AUTOMATIC);
        }
        // Les téléchargements partiels (.part) sont gardés pour une reprise ; le reste est supprimé.
        if let Ok(rd) = std::fs::read_dir(self.paths.downloads()) {
            for e in rd.flatten() {
                if !e.file_name().to_string_lossy().ends_with(".part") {
                    let _ = std::fs::remove_file(e.path());
                    util::remove_dir_quiet(&e.path());
                }
            }
        }
        let Ok(rd) = std::fs::read_dir(self.paths.root.join("apps")) else { return };
        for entry in rd.flatten() {
            let id = entry.file_name().to_string_lossy().to_string();
            let Some(app) = inner.installed.apps.get(&id) else {
                util::remove_dir_quiet(&entry.path());
                continue;
            };
            if let Ok(rd) = std::fs::read_dir(entry.path()) {
                for e in rd.flatten() {
                    if e.file_name().to_string_lossy().starts_with("staging-") {
                        util::remove_dir_quiet(&e.path());
                    }
                }
            }
            let keep: Vec<&str> = std::iter::once(app.current.dir.as_str())
                .chain(app.pending.as_ref().map(|p| p.dir.as_str()))
                .chain(app.previous.as_ref().map(|p| p.dir.as_str()))
                .collect();
            if let Ok(rd) = std::fs::read_dir(self.paths.versions_dir(&id)) {
                for e in rd.flatten() {
                    if !keep.contains(&e.file_name().to_string_lossy().as_ref()) {
                        util::remove_dir_quiet(&e.path());
                    }
                }
            }
        }
    }

    fn load_cached_catalog(&self) {
        let Ok(bytes) = std::fs::read(self.paths.catalog_cache()) else { return };
        let Ok(cache) = serde_json::from_slice::<CatalogCache>(&bytes) else { return };
        let mut inner = self.lock();
        if inner.settings.catalog_url.as_deref() != Some(cache.source_url.as_str()) {
            return; // l'adresse a changé : ce cache ne correspond plus
        }
        let Ok(url) = Url::parse(&cache.source_url) else { return };
        if let Ok((signed, warning)) = self.check_trust(cache.catalog_text.as_bytes(), cache.signature.as_deref()) {
            if let Ok(catalog) =
                catalog::parse_and_validate(cache.catalog_text.as_bytes(), &url, &self.policy)
            {
                inner.catalog = Some(LoadedCatalog {
                    catalog,
                    source_url: cache.source_url,
                    fetched_at: cache.fetched_at,
                    from_cache: true,
                    signed,
                    warning,
                });
            }
        }
    }

    // ----- Catalogue ---------------------------------------------------------------------------

    /// Applique la politique de signature. Renvoie (signé, avertissement éventuel).
    fn check_trust(&self, bytes: &[u8], sig: Option<&str>) -> Result<(bool, Option<String>)> {
        match (&self.policy, self.policy.public_key(), sig) {
            (_, Some(key), Some(sig)) => {
                catalog::verify_signature(key, bytes, sig)?;
                Ok((true, None))
            }
            (TrustPolicy::Distributed { .. }, None, _) => Err(Error::Signature(
                "aucune clé publique n'est intégrée à ce launcher (voir launcher/src-tauri/catalog-public-key.txt)".into(),
            )),
            (TrustPolicy::Distributed { .. }, Some(_), None) => Err(Error::Signature(
                "le fichier de signature (adresse du catalogue + « .sig ») est introuvable".into(),
            )),
            (TrustPolicy::Development { .. }, None, Some(_)) => Ok((
                false,
                Some("Signature présente mais non vérifiée : aucune clé publique intégrée.".into()),
            )),
            (TrustPolicy::Development { .. }, _, None) => Ok((
                false,
                Some("Mode développement : catalogue non signé accepté.".into()),
            )),
        }
    }

    pub fn has_catalog_url(&self) -> bool {
        self.lock().settings.catalog_url.is_some()
    }

    /// Fichier du catalogue si le launcher peut le modifier : mode développement et adresse file://.
    pub fn local_catalog_path(&self) -> Option<PathBuf> {
        if !self.policy.is_dev() {
            return None;
        }
        let url = self.lock().settings.catalog_url.clone()?;
        local::catalog_file(&url)
    }

    fn need_local_catalog(&self) -> Result<PathBuf> {
        self.local_catalog_path().ok_or_else(|| {
            Error::Other(
                "l'ajout de ZIP ne fonctionne qu'avec un catalogue local (adresse file://) en mode développement".into(),
            )
        })
    }

    pub fn inspect_zip(&self, zip: &Path) -> Result<local::ZipProposal> {
        local::inspect_zip(zip, &self.need_local_catalog()?)
    }

    /// Ajoute un ZIP au catalogue local puis relit le catalogue.
    pub async fn add_zip(&self, zip: &Path, entry: &local::ZipEntry) -> Result<String> {
        let cat = self.need_local_catalog()?;
        let id = local::add_zip(&cat, zip, entry)?;
        self.refresh_catalog().await?;
        Ok(id)
    }

    pub fn set_catalog_url(&self, url: &str) -> Result<()> {
        let url = url.trim();
        let parsed = Url::parse(url)
            .map_err(|e| Error::InsecureUrl(format!("« {url} » n'est pas une adresse valide ({e})")))?;
        self.policy.check_url(&parsed, "l'adresse du catalogue")?;
        {
            let mut inner = self.lock();
            if inner.settings.catalog_url.as_deref() != Some(parsed.as_str()) {
                inner.settings.catalog_url = Some(parsed.to_string());
                inner.catalog = None;
                inner.catalog_error = None;
                save_json(&self.paths.settings(), &inner.settings)?;
            }
        }
        self.emit(Event::Changed);
        Ok(())
    }

    /// Télécharge, vérifie et adopte le catalogue. En cas d'échec, le dernier catalogue valide reste en place.
    pub async fn refresh_catalog(&self) -> Result<()> {
        let url_s = {
            let mut inner = self.lock();
            if inner.refreshing {
                return Ok(());
            }
            inner.refreshing = true;
            inner.settings.catalog_url.clone()
        };
        self.emit(Event::Changed);
        if let Some(cat) = self.local_catalog_path() {
            let msgs = local::import_drop_folder(&cat);
            if !msgs.is_empty() {
                self.lock().notices = msgs;
            }
        }
        let result = self.refresh_inner(url_s).await;
        {
            let mut inner = self.lock();
            inner.refreshing = false;
            inner.catalog_error = result.as_ref().err().map(Error::info);
        }
        self.emit(Event::Changed);
        if result.is_ok() {
            self.refresh_images().await;
            self.emit(Event::Changed);
        }
        result
    }

    async fn refresh_inner(&self, url_s: Option<String>) -> Result<()> {
        let url_s = url_s.ok_or_else(|| {
            Error::Other("Aucune adresse de catalogue n'est configurée. Renseignez-la dans les paramètres.".into())
        })?;
        let url = Url::parse(&url_s).map_err(|e| Error::InsecureUrl(format!("{url_s} ({e})")))?;
        self.policy.check_url(&url, "l'adresse du catalogue")?;
        let bytes = net::fetch_bytes(&self.http, &url, MAX_CATALOG_BYTES)
            .await?
            .ok_or_else(|| Error::HttpStatus { status: 404, url: url.to_string() })?;
        let sig = match net::fetch_bytes(&self.http, &catalog::signature_url(&url), 4096).await {
            Ok(s) => s.map(|b| String::from_utf8_lossy(&b).to_string()),
            Err(e) if self.policy.is_dev() => {
                let _ = e;
                None
            }
            Err(e) => return Err(e),
        };
        let (signed, warning) = self.check_trust(&bytes, sig.as_deref())?;
        let catalog = catalog::parse_and_validate(&bytes, &url, &self.policy)?;
        let text = String::from_utf8(bytes)
            .map_err(|_| Error::InvalidCatalog("le fichier n'est pas en UTF-8".into()))?;
        let fetched_at = util::now_rfc3339();
        save_json(
            &self.paths.catalog_cache(),
            &CatalogCache {
                source_url: url_s.clone(),
                fetched_at: fetched_at.clone(),
                catalog_text: text,
                signature: sig,
            },
        )?;
        let mut inner = self.lock();
        if inner.settings.catalog_url.as_deref() == Some(url_s.as_str()) {
            inner.catalog = Some(LoadedCatalog {
                catalog,
                source_url: url_s,
                fetched_at,
                from_cache: false,
                signed,
                warning,
            });
        }
        Ok(())
    }

    async fn refresh_images(&self) {
        let list: Vec<(String, String, String)> = {
            let inner = self.lock();
            let Some(c) = &inner.catalog else { return };
            c.catalog
                .apps
                .iter()
                .flat_map(|a| {
                    [
                        (a.id.clone(), "icon".to_string(), a.icon_url.clone()),
                        (a.id.clone(), "image".to_string(), a.image_url.clone()),
                    ]
                })
                .collect()
        };
        let _ = std::fs::create_dir_all(self.paths.images());
        for (id, kind, url) in list {
            let Ok(u) = Url::parse(&url) else { continue };
            if let Ok(Some(bytes)) = net::fetch_bytes(&self.http, &u, MAX_IMAGE_BYTES).await {
                if sniff_mime(&bytes).is_some() {
                    let _ = util::write_atomic(&self.paths.images().join(format!("{id}-{kind}")), &bytes);
                }
            }
        }
    }

    /// Visuel en cache sous forme d'URL `data:` (disponible hors ligne).
    pub fn image_data_url(&self, id: &str, kind: &str) -> Option<String> {
        if !catalog::is_valid_id(id) || !matches!(kind, "icon" | "image") {
            return None;
        }
        let bytes = std::fs::read(self.paths.images().join(format!("{id}-{kind}"))).ok()?;
        let mime = sniff_mime(&bytes)?;
        Some(format!(
            "data:{mime};base64,{}",
            base64::engine::general_purpose::STANDARD.encode(bytes)
        ))
    }

    // ----- Vue ---------------------------------------------------------------------------------

    pub fn snapshot(&self) -> Snapshot {
        let inner = self.lock();
        let mut apps = Vec::new();
        let view = |id: &str, ca: Option<&CatalogApp>, ia: Option<&InstalledApp>| -> AppView {
            let installed_v = ia.map(|a| &a.current.version);
            let backups = backup::list(&self.paths, id);
            AppView {
                id: id.to_string(),
                name: ca.map(|a| a.name.clone()).or(ia.map(|a| a.name.clone())).unwrap_or_default(),
                description: ca
                    .map(|a| a.description.clone())
                    .or(ia.map(|a| a.description.clone()))
                    .unwrap_or_default(),
                release_notes: ca
                    .map(|a| a.release_notes.clone())
                    .or(ia.map(|a| a.release_notes.clone()))
                    .unwrap_or_default(),
                release_date: ca.and_then(|a| a.release_date.clone()),
                size: ca.and_then(|a| a.size),
                available_version: ca.map(|a| a.version.to_string()),
                installed_version: installed_v.map(|v| v.to_string()),
                installed_release_notes: ia.map(|a| a.release_notes.clone()),
                pending_version: ia.and_then(|a| a.pending.as_ref()).map(|p| p.version.to_string()),
                in_catalog: ca.is_some(),
                update_available: match (ca, ia) {
                    (Some(c), Some(i)) => {
                        c.version > i.current.version
                            && i.pending.as_ref().is_none_or(|p| c.version > p.version)
                            && i.held_version.as_ref().is_none_or(|h| c.version > *h)
                    }
                    _ => false,
                },
                running: inner.running.contains_key(id),
                task: inner.tasks.get(id).cloned(),
                partial_bytes: if inner.tasks.contains_key(id) {
                    None
                } else {
                    ca.and_then(|a| std::fs::metadata(self.partial_path(a)).ok()).map(|m| m.len()).filter(|n| *n > 0)
                },
                last_error: inner.errors.get(id).cloned(),
                data_dir: self.paths.data_dir(id).display().to_string(),
                previous_version: ia.and_then(|a| a.previous.as_ref()).map(|p| p.version.to_string()),
                held_version: ia.and_then(|a| a.held_version.as_ref()).map(|v| v.to_string()),
                backup_count: backups.len(),
                last_backup_at: backups.first().map(|b| b.created_at.clone()),
                update_rule: inner.profile.updates.rule_for(id).to_string(),
                update_rule_custom: inner.profile.updates.per_app.contains_key(id),
                last_exit_code: inner.last_exit.get(id).copied().flatten(),
            }
        };
        if let Some(c) = &inner.catalog {
            for ca in c.catalog.apps.iter().filter(|a| a.id != LAUNCHER_ID) {
                apps.push(view(&ca.id, Some(ca), inner.installed.apps.get(&ca.id)));
            }
        }
        for (id, ia) in &inner.installed.apps {
            if id != LAUNCHER_ID && !apps.iter().any(|a| &a.id == id) {
                apps.push(view(id, None, Some(ia)));
            }
        }
        let catalog = CatalogView {
            status: if inner.catalog.is_some() { "ready" } else { "none" }.into(),
            title: inner.catalog.as_ref().and_then(|c| c.catalog.title.clone()),
            source_url: inner.catalog.as_ref().map(|c| c.source_url.clone()),
            fetched_at: inner.catalog.as_ref().map(|c| c.fetched_at.clone()),
            from_cache: inner.catalog.as_ref().is_some_and(|c| c.from_cache),
            trust: inner
                .catalog
                .as_ref()
                .map(|c| if c.signed { "signed" } else { "unsigned" }.into()),
            refreshing: inner.refreshing,
            error: inner.catalog_error.clone(),
            warning: inner.catalog.as_ref().and_then(|c| c.warning.clone()),
            app_count: inner
                .catalog
                .as_ref()
                .map_or(0, |c| c.catalog.apps.iter().filter(|a| a.id != LAUNCHER_ID).count()),
        };
        Snapshot {
            mode: if self.policy.is_dev() { "development" } else { "distributed" }.into(),
            public_key_configured: self.policy.public_key().is_some(),
            catalog_url: inner.settings.catalog_url.clone(),
            data_root: self.paths.root.display().to_string(),
            catalog,
            apps,
            local_catalog_path: if self.policy.is_dev() {
                inner.settings.catalog_url.as_deref().and_then(local::catalog_file).map(|p| p.display().to_string())
            } else {
                None
            },
            notices: inner.notices.clone(),
            profile: inner.profile.clone(),
        }
    }

    /// Version proposée par le catalogue chargé pour `id` (sert à la mise à jour du launcher lui-même).
    pub fn catalog_version(&self, id: &str) -> Option<semver::Version> {
        self.lock().catalog.as_ref()?.catalog.get(id).map(|a| a.version.clone())
    }

    pub fn clear_notices(&self) {
        self.lock().notices.clear();
        self.emit(Event::Changed);
    }

    pub fn clear_error(&self, id: &str) {
        self.lock().errors.remove(id);
        self.emit(Event::Changed);
    }

    // ----- Installation et mise à jour ---------------------------------------------------------

    /// Installe la version du catalogue, ou met à jour. La version en place n'est jamais touchée
    /// tant que la nouvelle n'est pas complète et vérifiée.
    pub async fn install(self: &Arc<Self>, id: &str) -> Result<InstallOutcome> {
        let (app, kind, from, auto) = {
            let mut inner = self.lock();
            let from = inner.installed.apps.get(id).map(|a| a.current.version.to_string());
            let auto = inner.auto.remove(id);
            let app = inner
                .catalog
                .as_ref()
                .and_then(|c| c.catalog.get(id).cloned())
                .ok_or_else(|| Error::UnknownApp(id.to_string()))?;
            if inner.tasks.contains_key(id) {
                return Err(Error::Busy);
            }
            let kind = if inner.installed.apps.contains_key(id) { "update" } else { "install" };
            inner.errors.remove(id);
            inner.cancels.insert(id.to_string(), Arc::new(AtomicBool::new(false)));
            inner.tasks.insert(
                id.to_string(),
                TaskView { kind: kind.into(), phase: "downloading".into(), received: 0, total: app.size },
            );
            (app, kind, from, auto)
        };
        self.emit(Event::Changed);
        let result = match AppLock::acquire(&self.paths.root.join("locks").join(format!("{id}.lock"))) {
            Ok(_lock) => self.install_locked(&app, kind).await,
            Err(e) => Err(e),
        };
        {
            let mut inner = self.lock();
            inner.tasks.remove(id);
            inner.cancels.remove(id);
            match &result {
                Err(Error::Cancelled) | Ok(_) => {}
                Err(e) => {
                    inner.errors.insert(id.to_string(), e.info());
                }
            }
        }
        if id != LAUNCHER_ID {
            let ev = match &result {
                Ok(outcome) => {
                    let mut ev = HistoryEvent::new(if auto { "auto-update" } else { kind }, Some(id)).version(&app.version);
                    if let Some(f) = &from {
                        ev = ev.from(f);
                    }
                    if *outcome == InstallOutcome::Pending {
                        ev = ev.detail("prête, activée à la fermeture de l'application");
                    }
                    Some(ev)
                }
                Err(Error::Cancelled) => None,
                Err(e) => Some(
                    HistoryEvent::new("error", Some(id))
                        .version(&app.version)
                        .detail(format!("{} : {e}", if kind == "update" { "mise à jour" } else { "installation" })),
                ),
            };
            if let Some(ev) = ev {
                self.record(ev);
            }
        }
        self.emit(Event::Changed);
        result
    }

    /// Fichier du téléchargement en cours ou interrompu : un par application et par contenu attendu.
    fn partial_path(&self, app: &CatalogApp) -> PathBuf {
        self.paths.downloads().join(format!("{}-{}.part", app.id, &app.sha256[..16]))
    }

    /// Arrête le téléchargement en cours. Ce qui est déjà reçu est gardé pour une reprise.
    pub fn cancel_download(&self, id: &str) -> bool {
        let inner = self.lock();
        let downloading = inner.tasks.get(id).is_some_and(|t| t.phase == "downloading");
        if let (true, Some(flag)) = (downloading, inner.cancels.get(id)) {
            flag.store(true, Ordering::Relaxed);
            return true;
        }
        false
    }

    /// Supprime le début de téléchargement gardé pour une application.
    pub fn discard_download(&self, id: &str) {
        if self.lock().tasks.contains_key(id) {
            return;
        }
        self.remove_partials(id, None);
        self.emit(Event::Changed);
    }

    fn remove_partials(&self, id: &str, keep: Option<&Path>) {
        let Ok(rd) = std::fs::read_dir(self.paths.downloads()) else { return };
        let prefix = format!("{id}-");
        for e in rd.flatten() {
            let n = e.file_name().to_string_lossy().to_string();
            if n.starts_with(&prefix) && n.ends_with(".part") && Some(e.path().as_path()) != keep {
                let _ = std::fs::remove_file(e.path());
            }
        }
    }

    fn set_phase(&self, id: &str, phase: &str, received: u64, total: Option<u64>) {
        let task = {
            let mut inner = self.lock();
            let Some(t) = inner.tasks.get_mut(id) else { return };
            t.phase = phase.into();
            t.received = received;
            t.total = total;
            t.clone()
        };
        self.emit(Event::Progress { app_id: id.to_string(), task });
    }

    async fn install_locked(self: &Arc<Self>, app: &CatalogApp, _kind: &str) -> Result<InstallOutcome> {
        let id = app.id.clone();
        let nonce = util::random_hex(4);
        let url = Url::parse(&app.download_url)
            .map_err(|e| Error::InvalidCatalog(format!("downloadUrl invalide ({e})")))?;
        self.policy.check_url(&url, "le téléchargement")?;

        // 1. Téléchargement dans un dossier temporaire, empreinte calculée au fil de l'eau.
        tokio::fs::create_dir_all(self.paths.downloads()).await?;
        let zip_path = self.partial_path(app);
        self.remove_partials(&id, Some(&zip_path)); // débuts d'anciennes versions
        let cancel = self.lock().cancels.get(&id).cloned().unwrap_or_default();
        let mut last = Instant::now() - Duration::from_secs(1);
        let downloaded = net::download_to(&self.http, &url, &zip_path, app.size, &cancel, |rec, tot| {
            if last.elapsed() >= Duration::from_millis(80) {
                last = Instant::now();
                self.set_phase(&id, "downloading", rec, tot);
            }
        })
        .await;
        let actual = match downloaded {
            Ok(h) => h,
            // Annulation ou coupure : le début reste pour la reprise.
            Err(e @ (Error::Cancelled | Error::Network(_))) => return Err(e),
            Err(e) => {
                let _ = std::fs::remove_file(&zip_path);
                return Err(e);
            }
        };
        let _zip_guard = Cleanup(Some(zip_path.clone()));

        // 2. Vérification de l'empreinte.
        self.set_phase(&id, "verifying", 0, None);
        if actual != app.sha256 {
            return Err(Error::Integrity { expected: short_hash(&app.sha256), actual: short_hash(&actual) });
        }

        // 3. Extraction dans un dossier de préparation séparé.
        let staging = self.paths.app_dir(&id).join(format!("staging-{nonce}"));
        let mut staging_guard = Cleanup(Some(staging.clone()));
        self.set_phase(&id, "extracting", 0, None);
        {
            let core = Arc::clone(self);
            let (zp, st, id2) = (zip_path.clone(), staging.clone(), id.clone());
            tokio::task::spawn_blocking(move || {
                let mut last = Instant::now();
                archive::extract_zip(&zp, &st, |w, t| {
                    if last.elapsed() >= Duration::from_millis(80) {
                        last = Instant::now();
                        core.set_phase(&id2, "extracting", w, Some(t));
                    }
                })
            })
            .await
            .map_err(|e| Error::Other(e.to_string()))??;
        }

        // 4. Contrôle de complétude : l'exécutable attendu est là, dans le dossier, et c'est un fichier.
        self.set_phase(&id, "finalizing", 0, None);
        let exe_sha = verify_executable(&staging, &app.executable)?;
        let marker = serde_json::json!({
            "id": id, "version": app.version.to_string(), "executable": app.executable,
            "executableSha256": exe_sha, "archiveSha256": app.sha256,
        });
        util::write_atomic(&staging.join(VERSION_MARKER), marker.to_string().as_bytes())?;

        // 5. La version préparée devient un dossier de version (renommage atomique sur le même disque).
        let dir_name = format!("{}-{nonce}", app.version);
        let version_dir = self.paths.versions_dir(&id).join(&dir_name);
        std::fs::create_dir_all(self.paths.versions_dir(&id))?;
        std::fs::rename(&staging, &version_dir)?;
        staging_guard.keep();
        let mut version_guard = Cleanup(Some(version_dir.clone()));

        // 6. Mise à jour : les données sont sauvegardées avant que la nouvelle version puisse les modifier.
        let before = self.lock().installed.apps.get(&id).map(|a| a.current.version.to_string());
        if let Some(v) = before.filter(|_| id != LAUNCHER_ID && backup::has_data(&self.paths, &id)) {
            backup::create(&self.paths, &id, Some(v), "update").map_err(|e| {
                Error::Io(format!("la sauvegarde des données avant la mise à jour a échoué, rien n'a été changé ({e})"))
            })?;
            backup::prune(&self.paths, &id, backup::KEEP_AUTOMATIC);
        }

        // 7. Activation (ou report si l'application est ouverte), enregistrée de façon atomique.
        let new = InstalledVersion {
            version: app.version.clone(),
            dir: dir_name,
            executable: app.executable.clone(),
            executable_sha256: exe_sha,
            archive_sha256: app.sha256.clone(),
            installed_at: util::now_rfc3339(),
        };
        let mut inner = self.lock();
        let running = inner.running.contains_key(&id);
        let mut to_delete = Vec::new();
        let outcome;
        let previous = inner.installed.apps.get(&id).cloned();
        match inner.installed.apps.get_mut(&id) {
            Some(existing) => {
                if running {
                    if let Some(old) = existing.pending.replace(new) {
                        to_delete.push(old.dir);
                    }
                    outcome = InstallOutcome::Pending;
                } else {
                    // L'ancienne version active devient la version de secours ; la précédente part.
                    let old = std::mem::replace(&mut existing.current, new);
                    if let Some(p) = existing.previous.replace(old) {
                        to_delete.push(p.dir);
                    }
                    if let Some(p) = existing.pending.take() {
                        to_delete.push(p.dir);
                    }
                    existing.held_version = None;
                    outcome = InstallOutcome::Activated;
                }
                existing.name = app.name.clone();
                existing.description = app.description.clone();
                if outcome == InstallOutcome::Activated {
                    existing.release_notes = app.release_notes.clone();
                }
            }
            None => {
                inner.installed.apps.insert(
                    id.clone(),
                    InstalledApp {
                        id: id.clone(),
                        name: app.name.clone(),
                        description: app.description.clone(),
                        release_notes: app.release_notes.clone(),
                        current: new,
                        pending: None,
                        previous: None,
                        held_version: None,
                    },
                );
                outcome = InstallOutcome::Activated;
            }
        }
        if let Err(e) = self.save_installed(&inner) {
            // Rien n'est activé : on revient à l'état précédent en mémoire.
            match previous {
                Some(p) => inner.installed.apps.insert(id.clone(), p),
                None => inner.installed.apps.remove(&id),
            };
            return Err(e);
        }
        version_guard.keep();
        drop(inner);
        for d in to_delete {
            util::remove_dir_quiet(&self.paths.versions_dir(&id).join(d));
        }
        Ok(outcome)
    }

    fn activate_pending_locked(&self, inner: &mut Inner, id: &str) -> Result<bool> {
        let Some(app) = inner.installed.apps.get_mut(id) else { return Ok(false) };
        let Some(pending) = app.pending.take() else { return Ok(false) };
        let saved = app.clone();
        let old = std::mem::replace(&mut app.current, pending);
        let dropped = app.previous.replace(old);
        app.held_version = None;
        if let Some(c) = inner.catalog.as_ref().and_then(|c| c.catalog.get(id)) {
            if c.version == app.current.version {
                app.release_notes = c.release_notes.clone();
            }
        }
        if let Err(e) = self.save_installed(inner) {
            inner.installed.apps.insert(id.to_string(), saved);
            return Err(e);
        }
        if let Some(d) = dropped {
            util::remove_dir_quiet(&self.paths.versions_dir(id).join(d.dir));
        }
        Ok(true)
    }

    // ----- Lancement ---------------------------------------------------------------------------

    /// Lance l'exécutable de la version active, directement (jamais via un shell), après avoir revérifié
    /// qu'il est dans son dossier de version et qu'il n'a pas été modifié depuis l'installation.
    pub fn launch(self: &Arc<Self>, id: &str) -> Result<u32> {
        let (dir, ver) = {
            let mut inner = self.lock();
            let app = inner.installed.apps.get(id).ok_or(Error::NotInstalled)?.clone();
            if inner.running.contains_key(id) {
                return Err(Error::Running);
            }
            inner.running.insert(id.to_string(), 0);
            (self.paths.versions_dir(id).join(&app.current.dir), app.current)
        };
        let result = self.spawn_checked(id, &dir, &ver);
        match &result {
            Ok(_) => self.record(HistoryEvent::new("launch", Some(id)).version(&ver.version)),
            Err(e) => {
                {
                    let mut inner = self.lock();
                    inner.running.remove(id);
                    inner.errors.insert(id.to_string(), e.info());
                }
                self.record(HistoryEvent::new("error", Some(id)).version(&ver.version).detail(format!("lancement : {e}")));
            }
        }
        self.emit(Event::Changed);
        result
    }

    /// Dossier de la version active et chemin de son exécutable.
    pub fn installed_paths(&self, id: &str) -> Result<(PathBuf, PathBuf)> {
        let inner = self.lock();
        let app = inner.installed.apps.get(id).ok_or(Error::NotInstalled)?;
        let dir = self.paths.versions_dir(id).join(&app.current.dir);
        let exe = dir.join(&app.current.executable);
        Ok((dir, exe))
    }

    /// Nom affiché d'une application installée.
    pub fn installed_name(&self, id: &str) -> Option<String> {
        self.lock().installed.apps.get(id).map(|a| a.name.clone())
    }

    /// Dossier de données de l'application (créé s'il n'existe pas encore).
    pub fn data_dir(&self, id: &str) -> Result<PathBuf> {
        let d = self.paths.data_dir(id);
        std::fs::create_dir_all(&d)?;
        Ok(d)
    }

    fn spawn_checked(self: &Arc<Self>, id: &str, dir: &Path, ver: &InstalledVersion) -> Result<u32> {
        let sha = verify_executable(dir, &ver.executable)
            .map_err(|e| Error::Launch(format!("installation incomplète ({e})")))?;
        if sha != ver.executable_sha256 {
            return Err(Error::TamperedExecutable);
        }
        let exe = dir.join(&ver.executable);
        let data = self.paths.data_dir(id);
        std::fs::create_dir_all(&data)?;
        let mut child = std::process::Command::new(&exe)
            .current_dir(dir)
            .env("HANGAR_APP_ID", id)
            .env("HANGAR_APP_VERSION", ver.version.to_string())
            .env("HANGAR_APP_DATA", &data)
            .stdin(std::process::Stdio::null())
            .spawn()
            .map_err(|e| Error::Launch(e.to_string()))?;
        let pid = child.id();
        {
            let mut inner = self.lock();
            inner.running.insert(id.to_string(), pid);
            inner.launched_at.insert(id.to_string(), Instant::now());
        }
        let core = Arc::clone(self);
        let id = id.to_string();
        std::thread::spawn(move || {
            let code = child.wait().ok().and_then(|s| s.code());
            core.on_exit(&id, code);
        });
        Ok(pid)
    }

    fn on_exit(&self, id: &str, code: Option<i32>) {
        let (seconds, version) = {
            let mut inner = self.lock();
            inner.running.remove(id);
            inner.last_exit.insert(id.to_string(), code);
            let seconds = inner.launched_at.remove(id).map(|t| t.elapsed().as_secs());
            let version = inner.installed.apps.get(id).map(|a| a.current.version.to_string());
            if let Err(e) = self.activate_pending_locked(&mut inner, id) {
                inner.errors.insert(id.to_string(), e.info());
            }
            (seconds, version)
        };
        let mut ev = HistoryEvent::new("exit", Some(id));
        ev.version = version;
        ev.code = code;
        ev.seconds = seconds;
        self.record(ev);
        self.emit(Event::Exited { app_id: id.to_string(), code });
        self.emit(Event::Changed);
    }

    pub fn is_running(&self, id: &str) -> bool {
        self.lock().running.contains_key(id)
    }

    // ----- Désinstallation ---------------------------------------------------------------------

    pub fn uninstall(&self, id: &str, remove_data: bool) -> Result<()> {
        let _lock = AppLock::acquire(&self.paths.root.join("locks").join(format!("{id}.lock")))?;
        {
            let mut inner = self.lock();
            if inner.tasks.contains_key(id) {
                return Err(Error::Busy);
            }
            if inner.running.contains_key(id) {
                return Err(Error::Running);
            }
            let removed = inner.installed.apps.remove(id).ok_or(Error::NotInstalled)?;
            if let Err(e) = self.save_installed(&inner) {
                inner.installed.apps.insert(id.to_string(), removed);
                return Err(e);
            }
            inner.errors.remove(id);
            let ev = HistoryEvent::new("uninstall", Some(id)).version(&removed.current.version);
            drop(inner);
            self.record(if remove_data { ev.detail("données supprimées") } else { ev.detail("données conservées") });
        }
        util::remove_dir_quiet(&self.paths.app_dir(id));
        if remove_data {
            util::remove_dir_quiet(&self.paths.data_dir(id));
            util::remove_dir_quiet(&self.paths.backups_dir(id));
        }
        self.emit(Event::Changed);
        Ok(())
    }

    // ----- Sauvegardes des données -------------------------------------------------------------

    fn app_lock(&self, id: &str) -> Result<AppLock> {
        if !catalog::is_valid_id(id) {
            return Err(Error::UnknownApp(id.to_string()));
        }
        AppLock::acquire(&self.paths.root.join("locks").join(format!("{id}.lock")))
    }

    /// Refuse pendant une installation ou tant que l'application est ouverte.
    fn ensure_idle(&self, id: &str) -> Result<()> {
        let inner = self.lock();
        if inner.tasks.contains_key(id) {
            return Err(Error::Busy);
        }
        if inner.running.contains_key(id) {
            return Err(Error::Running);
        }
        Ok(())
    }

    fn current_version(&self, id: &str) -> Option<String> {
        self.lock().installed.apps.get(id).map(|a| a.current.version.to_string())
    }

    /// Sauvegarde manuelle de `data/<id>/` (possible même application ouverte).
    pub fn backup(&self, id: &str) -> Result<BackupInfo> {
        let _lock = self.app_lock(id)?;
        let b = backup::create(&self.paths, id, self.current_version(id), "manual")?;
        self.record(HistoryEvent::new("backup", Some(id)).detail(format!("sauvegarde manuelle ({} fichiers)", b.files)));
        self.emit(Event::Changed);
        Ok(b)
    }

    pub fn list_backups(&self, id: &str) -> Vec<BackupInfo> {
        if !catalog::is_valid_id(id) {
            return Vec::new();
        }
        backup::list(&self.paths, id)
    }

    pub fn delete_backup(&self, id: &str, backup_id: &str) -> Result<()> {
        let _lock = self.app_lock(id)?;
        backup::delete(&self.paths, id, backup_id)?;
        self.emit(Event::Changed);
        Ok(())
    }

    /// Remet les données d'une sauvegarde. Les données actuelles sont d'abord sauvegardées à leur tour.
    pub fn restore_backup(&self, id: &str, backup_id: &str) -> Result<()> {
        let _lock = self.app_lock(id)?;
        self.ensure_idle(id)?;
        let b = backup::find(&self.paths, id, backup_id)?;
        self.restore_locked(id, backup_id, "restore")?;
        self.record(HistoryEvent::new("restore", Some(id)).detail(format!("données du {}", b.created_at)));
        self.emit(Event::Changed);
        Ok(())
    }

    fn restore_locked(&self, id: &str, backup_id: &str, reason: &str) -> Result<()> {
        backup::find(&self.paths, id, backup_id)?;
        if backup::has_data(&self.paths, id) {
            backup::create(&self.paths, id, self.current_version(id), reason)?;
        }
        backup::restore(&self.paths, id, backup_id)?;
        backup::prune(&self.paths, id, backup::KEEP_AUTOMATIC);
        Ok(())
    }

    // ----- Retour à la version précédente ------------------------------------------------------

    /// Réactive la version précédente. La version quittée reste gardée (on peut y revenir) et elle est
    /// ignorée par les mises à jour jusqu'à la publication d'une version plus récente.
    /// `restore` : sauvegarde de données à remettre en même temps (celle faite avant la mise à jour).
    pub fn rollback(&self, id: &str, restore: Option<&str>) -> Result<()> {
        let _lock = self.app_lock(id)?;
        self.ensure_idle(id)?;
        if let Some(b) = restore {
            backup::find(&self.paths, id, b)?;
        }
        {
            let mut inner = self.lock();
            let app = inner.installed.apps.get(id).ok_or(Error::NotInstalled)?.clone();
            let prev = app
                .previous
                .clone()
                .ok_or_else(|| Error::Other("Aucune version précédente n'est gardée pour cette application.".into()))?;
            let sha = verify_executable(&self.paths.versions_dir(id).join(&prev.dir), &prev.executable)
                .map_err(|e| Error::Other(format!("la version {} gardée est incomplète ({e})", prev.version)))?;
            if sha != prev.executable_sha256 {
                return Err(Error::TamperedExecutable);
            }
            let notes = inner
                .catalog
                .as_ref()
                .and_then(|c| c.catalog.get(id))
                .filter(|c| c.version == prev.version)
                .map(|c| c.release_notes.clone());
            let entry = inner.installed.apps.get_mut(id).expect("présente");
            let (to, from) = (prev.version.clone(), entry.current.version.clone());
            let left = std::mem::replace(&mut entry.current, prev);
            entry.held_version = Some(left.version.clone());
            entry.previous = Some(left);
            if let Some(n) = notes {
                entry.release_notes = n;
            }
            if let Err(e) = self.save_installed(&inner) {
                inner.installed.apps.insert(id.to_string(), app);
                return Err(e);
            }
            inner.errors.remove(id);
            drop(inner);
            let ev = HistoryEvent::new("rollback", Some(id)).version(to).from(from);
            self.record(if restore.is_some() { ev.detail("avec les données d'avant la mise à jour") } else { ev });
        }
        let result = match restore {
            Some(b) => self.restore_locked(id, b, "rollback"),
            None => Ok(()),
        };
        self.emit(Event::Changed);
        result
    }

    /// Ignore (ou plus) les versions du catalogue jusqu'à celle proposée actuellement.
    pub fn set_hold(&self, id: &str, hold: bool) -> Result<()> {
        {
            let mut inner = self.lock();
            let target = inner.catalog.as_ref().and_then(|c| c.catalog.get(id)).map(|c| c.version.clone());
            let app = inner.installed.apps.get_mut(id).ok_or(Error::NotInstalled)?;
            let saved = app.held_version.clone();
            app.held_version = if hold { Some(target.unwrap_or_else(|| app.current.version.clone())) } else { None };
            if let Err(e) = self.save_installed(&inner) {
                inner.installed.apps.get_mut(id).expect("présente").held_version = saved;
                return Err(e);
            }
        }
        self.emit(Event::Changed);
        Ok(())
    }

    // ----- Historique --------------------------------------------------------------------------

    pub fn record(&self, e: HistoryEvent) {
        history::append(&self.paths.history(), &e);
    }

    pub fn history(&self, app_id: Option<&str>, limit: usize) -> Vec<HistoryEvent> {
        history::list(&self.paths.history(), app_id, limit.min(5000))
    }

    // ----- Profil : logiciels perso, espaces de travail, règles de mise à jour -----------------

    pub fn profile(&self) -> Profile {
        self.lock().profile.clone()
    }

    pub fn save_profile(&self, p: Profile) -> Result<()> {
        profile::validate(&p)?;
        {
            let mut inner = self.lock();
            save_json(&self.paths.profile(), &p)?;
            inner.profile = p;
        }
        self.emit(Event::Changed);
        Ok(())
    }

    /// Note que la prochaine installation de `id` est une mise à jour automatique.
    pub fn mark_auto(&self, id: &str) {
        self.lock().auto.insert(id.to_string());
    }

    /// Applications à mettre à jour seules : règle « auto », pas de pause, application fermée et inactive.
    pub fn auto_update_targets(&self) -> Vec<String> {
        let rules = self.lock().profile.updates.clone();
        if rules.paused {
            return Vec::new();
        }
        self.snapshot()
            .apps
            .into_iter()
            .filter(|a| a.update_available && !a.running && a.task.is_none() && a.partial_bytes.is_none())
            .filter(|a| rules.rule_for(&a.id) == "auto")
            .map(|a| a.id)
            .collect()
    }

    // ----- Centre de stockage ------------------------------------------------------------------

    pub fn storage_report(&self) -> StorageReport {
        let (installed, catalog_ids): (Vec<InstalledApp>, Vec<(String, String)>) = {
            let inner = self.lock();
            (
                inner.installed.apps.values().cloned().collect(),
                inner
                    .catalog
                    .as_ref()
                    .map(|c| c.catalog.apps.iter().map(|a| (a.id.clone(), a.name.clone())).collect())
                    .unwrap_or_default(),
            )
        };
        let mut ids: Vec<(String, String)> = installed.iter().map(|a| (a.id.clone(), a.name.clone())).collect();
        // Données ou sauvegardes d'applications désinstallées : elles occupent aussi de la place.
        for dir in [self.paths.root.join("data"), self.paths.root.join("backups")] {
            if let Ok(rd) = std::fs::read_dir(dir) {
                for e in rd.flatten() {
                    let id = e.file_name().to_string_lossy().to_string();
                    if catalog::is_valid_id(&id) && !ids.iter().any(|(i, _)| i == &id) {
                        let name = catalog_ids.iter().find(|(i, _)| i == &id).map(|x| x.1.clone()).unwrap_or(id.clone());
                        ids.push((id, name));
                    }
                }
            }
        }
        let item = |kind: &str, label: String, path: PathBuf, removable: bool| {
            let (files, bytes) = if path.is_dir() {
                backup::dir_stats(&path)
            } else {
                (1, std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0))
            };
            StorageItem { kind: kind.into(), label, bytes, files, removable, path: path.display().to_string() }
        };
        let mut apps = Vec::new();
        for (id, name) in ids {
            let mut items = Vec::new();
            if let Some(a) = installed.iter().find(|a| a.id == id) {
                let vd = self.paths.versions_dir(&id);
                items.push(item("version-active", format!("Version active {}", a.current.version), vd.join(&a.current.dir), false));
                if let Some(p) = &a.previous {
                    items.push(item("version-previous", format!("Version précédente {} (retour possible)", p.version), vd.join(&p.dir), true));
                }
                if let Some(p) = &a.pending {
                    items.push(item("version-pending", format!("Version {} en attente", p.version), vd.join(&p.dir), false));
                }
            }
            if self.paths.data_dir(&id).is_dir() {
                items.push(item("data", "Données de l'application".into(), self.paths.data_dir(&id), false));
            }
            let list = backup::list(&self.paths, &id);
            let (auto, manual): (Vec<_>, Vec<_>) = list.iter().partition(|b| b.automatic());
            for (kind, group, label) in [("backups-auto", auto, "Sauvegardes automatiques"), ("backups-manual", manual, "Sauvegardes manuelles")] {
                if !group.is_empty() {
                    let bytes: u64 = group.iter().map(|b| b.size).sum();
                    let files: u64 = group.iter().map(|b| b.files).sum();
                    items.push(StorageItem {
                        kind: kind.into(),
                        label: format!("{label} ({})", group.len()),
                        bytes,
                        files,
                        removable: true,
                        path: self.paths.backups_dir(&id).display().to_string(),
                    });
                }
            }
            if let Ok(rd) = std::fs::read_dir(self.paths.downloads()) {
                let prefix = format!("{id}-");
                for e in rd.flatten() {
                    let n = e.file_name().to_string_lossy().to_string();
                    if n.starts_with(&prefix) && n.ends_with(".part") {
                        items.push(item("partial", "Téléchargement interrompu".into(), e.path(), true));
                    }
                }
            }
            let total = items.iter().map(|i| i.bytes).sum();
            let reclaimable = items.iter().filter(|i| i.removable).map(|i| i.bytes).sum();
            if total > 0 {
                apps.push(AppStorage { id, name, total, reclaimable, items });
            }
        }
        apps.sort_by(|a, b| b.total.cmp(&a.total));
        let images = backup::dir_stats(&self.paths.images()).1;
        let total = apps.iter().map(|a| a.total).sum::<u64>() + images;
        let reclaimable = apps.iter().map(|a| a.reclaimable).sum();
        StorageReport { apps, images, total, reclaimable, root: self.paths.root.display().to_string() }
    }

    /// Supprime ce qui est demandé pour une application : "version-previous", "backups-auto",
    /// "backups-manual", "partial". Renvoie l'espace libéré.
    pub fn clean(&self, id: &str, kinds: &[String]) -> Result<u64> {
        let _lock = self.app_lock(id)?;
        if self.lock().tasks.contains_key(id) {
            return Err(Error::Busy);
        }
        let before = self.storage_report().apps.into_iter().find(|a| a.id == id);
        let mut freed = 0;
        let mut done = Vec::new();
        for k in kinds {
            let size = before.as_ref().map_or(0, |a| a.items.iter().filter(|i| &i.kind == k).map(|i| i.bytes).sum());
            match k.as_str() {
                "version-previous" => {
                    let mut inner = self.lock();
                    let Some(app) = inner.installed.apps.get_mut(id) else { continue };
                    let Some(prev) = app.previous.take() else { continue };
                    if let Err(e) = self.save_installed(&inner) {
                        inner.installed.apps.get_mut(id).expect("présente").previous = Some(prev);
                        return Err(e);
                    }
                    drop(inner);
                    util::remove_dir_quiet(&self.paths.versions_dir(id).join(prev.dir));
                    done.push(format!("version {}", prev.version));
                }
                "backups-auto" | "backups-manual" => {
                    let auto = k == "backups-auto";
                    for b in backup::list(&self.paths, id).into_iter().filter(|b| b.automatic() == auto) {
                        backup::delete(&self.paths, id, &b.id)?;
                    }
                    done.push(if auto { "sauvegardes automatiques" } else { "sauvegardes manuelles" }.to_string());
                }
                "partial" => {
                    self.remove_partials(id, None);
                    done.push("téléchargement interrompu".into());
                }
                other => return Err(Error::Other(format!("élément « {other} » non supprimable"))),
            }
            freed += size;
        }
        if !done.is_empty() {
            self.record(HistoryEvent::new("clean", Some(id)).detail(format!("{} supprimé(s), {} octets libérés", done.join(", "), freed)));
        }
        self.emit(Event::Changed);
        Ok(freed)
    }

    // ----- Atelier de publication --------------------------------------------------------------

    pub fn workshop_analyze(&self, zip: &Path) -> Result<workshop::WorkshopReport> {
        workshop::analyze(zip, |id| {
            let inner = self.lock();
            let a = inner.installed.apps.get(id)?;
            Some((a.current.version.to_string(), self.paths.versions_dir(id).join(&a.current.dir)))
        })
    }

    // ----- Export et migration -----------------------------------------------------------------

    pub fn export_profile(&self, dest: &Path, prefs: Option<serde_json::Value>, data: &[String]) -> Result<u64> {
        let (manifest, ids) = {
            let inner = self.lock();
            let apps: Vec<transfer::ExportedApp> = inner
                .installed
                .apps
                .values()
                .filter(|a| a.id != LAUNCHER_ID)
                .map(|a| transfer::ExportedApp { id: a.id.clone(), name: a.name.clone(), version: a.current.version.to_string() })
                .collect();
            let m = transfer::ExportManifest {
                format: 1,
                exported_at: util::now_rfc3339(),
                catalog_url: inner.settings.catalog_url.clone(),
                prefs,
                profile: inner.profile.clone(),
                apps,
                data: Vec::new(),
            };
            (m, data.to_vec())
        };
        let mut manifest = manifest;
        for id in ids {
            if !catalog::is_valid_id(&id) {
                return Err(Error::UnknownApp(id));
            }
            if backup::has_data(&self.paths, &id) {
                manifest.data.push(id);
            }
        }
        let size = transfer::write(dest, &manifest, &self.paths)?;
        self.record(HistoryEvent::new("export", None).detail(format!(
            "profil exporté ({} applications, données de {})",
            manifest.apps.len(),
            manifest.data.len()
        )));
        Ok(size)
    }

    pub fn read_import(&self, zip: &Path) -> Result<transfer::ExportManifest> {
        transfer::read_manifest(zip)
    }

    /// Applique un profil exporté. Les applications à installer sont renvoyées : la couche Tauri les lance.
    pub async fn import_profile(&self, zip: &Path, opts: &ImportOptions) -> Result<ImportResult> {
        let m = transfer::read_manifest(zip)?;
        let mut messages = Vec::new();
        let mut restored = Vec::new();
        // Données d'abord : c'est la seule étape qui peut échouer pour de bon (application ouverte).
        let wanted: Vec<&String> = m.data.iter().filter(|id| opts.data.contains(id)).collect();
        if !wanted.is_empty() {
            for id in &wanted {
                if self.is_running(id) {
                    return Err(Error::Other(format!("{id} est ouverte : fermez-la avant d'importer ses données.")));
                }
            }
            let tmp = self.paths.root.join(format!("import-{}", util::random_hex(4)));
            let _guard = Cleanup(Some(tmp.clone()));
            transfer::extract(zip, &tmp)?;
            for id in wanted {
                let _lock = self.app_lock(id)?;
                let src = tmp.join("data").join(id);
                if !src.is_dir() {
                    continue;
                }
                if backup::has_data(&self.paths, id) {
                    backup::create(&self.paths, id, self.current_version(id), "restore")?;
                }
                backup::replace_data(&self.paths, id, &src)?;
                restored.push(id.clone());
            }
            messages.push(format!("Données restaurées : {} (les données présentes ont été sauvegardées avant).", restored.join(", ")));
        }
        if opts.profile {
            let mut p = self.profile();
            for a in &m.profile.personal {
                p.personal.retain(|x| x.id != a.id);
                p.personal.push(a.clone());
            }
            for w in &m.profile.workspaces {
                p.workspaces.retain(|x| x.id != w.id);
                p.workspaces.push(w.clone());
            }
            p.updates = m.profile.updates.clone();
            self.save_profile(p)?;
            messages.push(format!(
                "Profil importé : {} logiciel(s) perso, {} espace(s) de travail, règles de mise à jour.",
                m.profile.personal.len(),
                m.profile.workspaces.len()
            ));
        }
        if opts.settings {
            if let Some(url) = &m.catalog_url {
                if self.lock().settings.catalog_url.as_deref() != Some(url.as_str()) {
                    match self.set_catalog_url(url) {
                        Ok(()) => messages.push(format!("Adresse du catalogue : {url}")),
                        Err(e) => messages.push(format!("Adresse du catalogue non reprise : {e}")),
                    }
                }
            }
            if let Err(e) = self.refresh_catalog().await {
                messages.push(format!("Catalogue non actualisé : {e}"));
            }
        }
        let mut to_install = Vec::new();
        if opts.install_missing {
            let snap = self.snapshot();
            for a in &m.apps {
                match snap.apps.iter().find(|x| x.id == a.id) {
                    Some(x) if x.installed_version.is_none() && x.in_catalog => to_install.push(a.id.clone()),
                    None => messages.push(format!("{} n'est pas dans le catalogue actuel : non installée.", a.name)),
                    _ => {}
                }
            }
            if !to_install.is_empty() {
                messages.push(format!("{} application(s) en cours d'installation.", to_install.len()));
            }
        }
        self.record(HistoryEvent::new("import", None).detail(messages.join(" ")));
        self.emit(Event::Changed);
        Ok(ImportResult { prefs: m.prefs, to_install, restored, messages })
    }
}


/// Vérifie que l'exécutable existe, est un fichier, et reste dans `dir` une fois les liens résolus.
/// Renvoie son empreinte SHA-256.
pub fn verify_executable(dir: &Path, rel: &str) -> Result<String> {
    let rel = catalog::normalize_relative_path(rel).map_err(Error::UnsafeArchive)?;
    let exe = dir.join(&rel);
    let meta = std::fs::symlink_metadata(&exe).map_err(|_| Error::MissingExecutable(rel.clone()))?;
    if !meta.is_file() {
        return Err(Error::MissingExecutable(rel));
    }
    let canon_dir = std::fs::canonicalize(dir)?;
    let canon_exe = std::fs::canonicalize(&exe)?;
    if !canon_exe.starts_with(&canon_dir) {
        return Err(Error::UnsafeArchive("l'exécutable sort du dossier d'installation".into()));
    }
    util::sha256_file(&exe)
}

fn sniff_mime(b: &[u8]) -> Option<&'static str> {
    if b.starts_with(b"\x89PNG") {
        Some("image/png")
    } else if b.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg")
    } else if b.starts_with(b"GIF8") {
        Some("image/gif")
    } else if b.len() > 12 && &b[0..4] == b"RIFF" && &b[8..12] == b"WEBP" {
        Some("image/webp")
    } else {
        let head = String::from_utf8_lossy(&b[..b.len().min(512)]).to_ascii_lowercase();
        (head.trim_start().starts_with('<') && head.contains("<svg")).then_some("image/svg+xml")
    }
}

fn short_hash(h: &str) -> String {
    format!("{}…", &h[..h.len().min(16)])
}
