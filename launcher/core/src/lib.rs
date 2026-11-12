//! Coeur du launcher Rayan's Launcher. Aucune dépendance à l'interface : la couche Tauri et l'outil en ligne de
//! commande l'utilisent tous les deux, et les tests de bout en bout le pilotent directement.

pub mod archive;
pub mod catalog;
pub mod error;
pub mod local;
pub mod net;
pub mod state;
pub mod util;

pub use catalog::{Catalog, CatalogApp, TrustPolicy};
pub use error::{Error, ErrorInfo, Result};

use base64::Engine;
use serde::Serialize;
use state::*;
use std::collections::HashMap;
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
        let core = Arc::new(Core {
            http: net::client(&policy),
            paths,
            policy,
            inner: Mutex::new(Inner {
                settings,
                installed,
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
        let (app, kind) = {
            let mut inner = self.lock();
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
            (app, kind)
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

        // 6. Activation (ou report si l'application est ouverte), enregistrée de façon atomique.
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
                    let old = std::mem::replace(&mut existing.current, new);
                    to_delete.push(old.dir);
                    if let Some(p) = existing.pending.take() {
                        to_delete.push(p.dir);
                    }
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
        let backup = app.clone();
        let old = std::mem::replace(&mut app.current, pending);
        if let Some(c) = inner.catalog.as_ref().and_then(|c| c.catalog.get(id)) {
            if c.version == app.current.version {
                app.release_notes = c.release_notes.clone();
            }
        }
        if let Err(e) = self.save_installed(inner) {
            inner.installed.apps.insert(id.to_string(), backup);
            return Err(e);
        }
        util::remove_dir_quiet(&self.paths.versions_dir(id).join(old.dir));
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
            Ok(_) => {}
            Err(e) => {
                let mut inner = self.lock();
                inner.running.remove(id);
                inner.errors.insert(id.to_string(), e.info());
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
        self.lock().running.insert(id.to_string(), pid);
        let core = Arc::clone(self);
        let id = id.to_string();
        std::thread::spawn(move || {
            let code = child.wait().ok().and_then(|s| s.code());
            core.on_exit(&id, code);
        });
        Ok(pid)
    }

    fn on_exit(&self, id: &str, code: Option<i32>) {
        {
            let mut inner = self.lock();
            inner.running.remove(id);
            if let Err(e) = self.activate_pending_locked(&mut inner, id) {
                inner.errors.insert(id.to_string(), e.info());
            }
        }
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
        }
        util::remove_dir_quiet(&self.paths.app_dir(id));
        if remove_data {
            util::remove_dir_quiet(&self.paths.data_dir(id));
        }
        self.emit(Event::Changed);
        Ok(())
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
