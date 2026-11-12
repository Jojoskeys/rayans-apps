//! Catalogue distant : format JSON, validation stricte et vérification de signature Ed25519.

use crate::error::{Error, Result};
use base64::Engine;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use url::Url;

pub const SCHEMA_VERSION: u32 = 1;
const MAX_APPS: usize = 500;

/// Politique de confiance du launcher.
#[derive(Clone, Debug)]
pub enum TrustPolicy {
    /// Usage distribué : HTTPS obligatoire et catalogue signé par la clé intégrée.
    Distributed { public_key: Option<VerifyingKey> },
    /// Mode développement : http://, https:// et file:// acceptés ; signature vérifiée si un `.sig` existe.
    Development { public_key: Option<VerifyingKey> },
}

impl TrustPolicy {
    pub fn is_dev(&self) -> bool {
        matches!(self, TrustPolicy::Development { .. })
    }
    pub fn public_key(&self) -> Option<&VerifyingKey> {
        match self {
            TrustPolicy::Distributed { public_key } | TrustPolicy::Development { public_key } => {
                public_key.as_ref()
            }
        }
    }
    pub fn check_url(&self, url: &Url, what: &str) -> Result<()> {
        match (self, url.scheme()) {
            (_, "https") => Ok(()),
            (TrustPolicy::Development { .. }, "http" | "file") => Ok(()),
            (TrustPolicy::Distributed { .. }, s) => Err(Error::InsecureUrl(format!(
                "{what} utilise « {s}:// » ({url}). Seul https:// est accepté."
            ))),
            (TrustPolicy::Development { .. }, s) => Err(Error::InsecureUrl(format!(
                "{what} utilise un schéma non pris en charge « {s}:// »."
            ))),
        }
    }
}

/// Lit une clé publique encodée en base64 (32 octets). Les lignes vides ou commençant par `#` sont ignorées.
pub fn parse_public_key(text: &str) -> Result<Option<VerifyingKey>> {
    let line = text
        .lines()
        .map(str::trim)
        .find(|l| !l.is_empty() && !l.starts_with('#'));
    let Some(line) = line else { return Ok(None) };
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(line)
        .map_err(|e| Error::Signature(format!("clé publique illisible ({e})")))?;
    let arr: [u8; 32] = bytes
        .try_into()
        .map_err(|_| Error::Signature("la clé publique doit faire 32 octets".into()))?;
    VerifyingKey::from_bytes(&arr)
        .map(Some)
        .map_err(|e| Error::Signature(format!("clé publique invalide ({e})")))
}

/// Vérifie une signature détachée (base64) des octets exacts du catalogue.
pub fn verify_signature(key: &VerifyingKey, catalog: &[u8], sig_text: &str) -> Result<()> {
    let raw = base64::engine::general_purpose::STANDARD
        .decode(sig_text.trim())
        .map_err(|_| Error::Signature("fichier .sig illisible (base64 attendu)".into()))?;
    let arr: [u8; 64] = raw
        .try_into()
        .map_err(|_| Error::Signature("une signature Ed25519 fait 64 octets".into()))?;
    key.verify(catalog, &Signature::from_bytes(&arr)).map_err(|_| {
        Error::Signature(
            "elle ne correspond pas au contenu du catalogue ou à la clé publique du launcher".into(),
        )
    })
}

/// Adresse de la signature détachée : même URL, chemin suffixé de `.sig`.
pub fn signature_url(catalog_url: &Url) -> Url {
    let mut u = catalog_url.clone();
    let path = format!("{}.sig", u.path());
    u.set_path(&path);
    u
}

// ---------------------------------------------------------------------------------------------
// Format brut (tel que publié)

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawCatalog {
    schema_version: Option<u32>,
    #[serde(default)]
    title: Option<String>,
    apps: Option<Vec<RawApp>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawApp {
    id: Option<String>,
    name: Option<String>,
    description: Option<String>,
    icon: Option<String>,
    image: Option<String>,
    version: Option<String>,
    release_notes: Option<String>,
    #[serde(default)]
    release_date: Option<String>,
    download_url: Option<String>,
    sha256: Option<String>,
    #[serde(default)]
    size: Option<u64>,
    executable: Option<String>,
}

// ---------------------------------------------------------------------------------------------
// Format validé

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CatalogApp {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon_url: String,
    pub image_url: String,
    pub version: semver::Version,
    pub release_notes: String,
    pub release_date: Option<String>,
    pub download_url: String,
    pub sha256: String,
    pub size: Option<u64>,
    /// Chemin relatif normalisé avec des `/`.
    pub executable: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub title: Option<String>,
    pub apps: Vec<CatalogApp>,
}

impl Catalog {
    pub fn get(&self, id: &str) -> Option<&CatalogApp> {
        self.apps.iter().find(|a| a.id == id)
    }
}

pub fn is_valid_id(id: &str) -> bool {
    let b = id.as_bytes();
    (2..=64).contains(&b.len())
        && (b[0].is_ascii_lowercase() || b[0].is_ascii_digit())
        && b.iter()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == b'-' || *c == b'_')
}

/// Normalise un chemin relatif d'exécutable. Refuse tout ce qui pourrait sortir du dossier d'installation.
pub fn normalize_relative_path(p: &str) -> std::result::Result<String, String> {
    if p.is_empty() {
        return Err("chemin vide".into());
    }
    if p.starts_with('/') || p.starts_with('\\') {
        return Err("le chemin doit être relatif".into());
    }
    let mut parts = Vec::new();
    for comp in p.split(['/', '\\']) {
        if comp.is_empty() || comp == "." {
            continue;
        }
        if comp == ".." {
            return Err("« .. » est interdit".into());
        }
        if comp.contains(':') || comp.contains('\0') {
            return Err("caractère interdit (« : »)".into());
        }
        parts.push(comp);
    }
    if parts.is_empty() {
        return Err("chemin vide".into());
    }
    Ok(parts.join("/"))
}

fn req(field: &Option<String>, name: &str, ctx: &str) -> std::result::Result<String, String> {
    match field.as_deref().map(str::trim) {
        Some(v) if !v.is_empty() => Ok(v.to_string()),
        _ => Err(format!("{ctx} : le champ « {name} » est obligatoire")),
    }
}

/// Analyse et valide un catalogue. `base` sert à résoudre les URL relatives (au fichier catalogue).
pub fn parse_and_validate(bytes: &[u8], base: &Url, policy: &TrustPolicy) -> Result<Catalog> {
    // Le Bloc-notes de Windows peut ajouter une marque d'ordre des octets (BOM) en tête de fichier.
    let bytes = bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(bytes);
    let raw: RawCatalog = serde_json::from_slice(bytes)
        .map_err(|e| Error::InvalidCatalog(format!("JSON mal formé ({e})")))?;
    match raw.schema_version {
        Some(SCHEMA_VERSION) => {}
        Some(v) => {
            return Err(Error::InvalidCatalog(format!(
                "schemaVersion {v} non pris en charge (attendu {SCHEMA_VERSION})"
            )))
        }
        None => return Err(Error::InvalidCatalog("champ « schemaVersion » manquant".into())),
    }
    let raw_apps = raw
        .apps
        .ok_or_else(|| Error::InvalidCatalog("champ « apps » manquant".into()))?;
    if raw_apps.len() > MAX_APPS {
        return Err(Error::InvalidCatalog(format!("plus de {MAX_APPS} applications")));
    }
    let mut apps: Vec<CatalogApp> = Vec::with_capacity(raw_apps.len());
    for (i, ra) in raw_apps.iter().enumerate() {
        let app = validate_app(ra, i, base, policy)?;
        if apps.iter().any(|a| a.id == app.id) {
            return Err(Error::InvalidCatalog(format!(
                "l'identifiant « {} » apparaît deux fois",
                app.id
            )));
        }
        apps.push(app);
    }
    Ok(Catalog {
        title: raw.title.filter(|t| !t.trim().is_empty()),
        apps,
    })
}

fn validate_app(ra: &RawApp, i: usize, base: &Url, policy: &TrustPolicy) -> Result<CatalogApp> {
    let inv = Error::InvalidCatalog;
    let pos = format!("application n°{}", i + 1);
    let id = req(&ra.id, "id", &pos).map_err(inv)?;
    if !is_valid_id(&id) {
        return Err(inv(format!(
            "{pos} : id « {id} » invalide (2 à 64 caractères : a-z, 0-9, « - », « _ », commençant par une lettre ou un chiffre)"
        )));
    }
    let ctx = format!("application « {id} »");
    let name = req(&ra.name, "name", &ctx).map_err(inv)?;
    let description = req(&ra.description, "description", &ctx).map_err(inv)?;
    let release_notes = req(&ra.release_notes, "releaseNotes", &ctx).map_err(inv)?;
    let version_s = req(&ra.version, "version", &ctx).map_err(inv)?;
    let version = semver::Version::parse(&version_s).map_err(|e| {
        inv(format!(
            "{ctx} : version « {version_s} » invalide, format attendu MAJEUR.MINEUR.CORRECTIF ({e})"
        ))
    })?;
    let sha = req(&ra.sha256, "sha256", &ctx).map_err(inv)?.to_ascii_lowercase();
    if sha.len() != 64 || !sha.bytes().all(|c| c.is_ascii_hexdigit()) {
        return Err(inv(format!(
            "{ctx} : sha256 doit contenir 64 caractères hexadécimaux"
        )));
    }
    let exe_raw = req(&ra.executable, "executable", &ctx).map_err(inv)?;
    let executable = normalize_relative_path(&exe_raw)
        .map_err(|e| inv(format!("{ctx} : executable « {exe_raw} » refusé ({e})")))?;
    if cfg!(windows) && !executable.to_ascii_lowercase().ends_with(".exe") {
        return Err(inv(format!(
            "{ctx} : executable doit être un fichier .exe (les scripts .bat/.cmd passeraient par un shell)"
        )));
    }
    let resolve = |field: &Option<String>, name: &str| -> Result<String> {
        let s = req(field, name, &ctx).map_err(Error::InvalidCatalog)?;
        let u = base
            .join(&s)
            .map_err(|e| Error::InvalidCatalog(format!("{ctx} : {name} « {s} » n'est pas une URL ({e})")))?;
        policy.check_url(&u, &format!("{ctx} : {name}"))?;
        Ok(u.to_string())
    };
    Ok(CatalogApp {
        icon_url: resolve(&ra.icon, "icon")?,
        image_url: resolve(&ra.image, "image")?,
        download_url: resolve(&ra.download_url, "downloadUrl")?,
        id,
        name,
        description,
        version,
        release_notes,
        release_date: ra.release_date.clone().filter(|d| !d.trim().is_empty()),
        sha256: sha,
        size: ra.size,
        executable,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dev() -> TrustPolicy {
        TrustPolicy::Development { public_key: None }
    }
    fn base() -> Url {
        Url::parse("https://exemple.fr/hangar/catalog.json").unwrap()
    }
    fn exe() -> &'static str {
        if cfg!(windows) { "bin/App.exe" } else { "bin/app" }
    }
    fn app_json(id: &str, extra: &str) -> String {
        format!(
            r#"{{"id":"{id}","name":"N","description":"D","icon":"img/i.png","image":"img/b.png","version":"1.2.3",
            "releaseNotes":"R","downloadUrl":"zips/a.zip","sha256":"{}","executable":"{}"{extra}}}"#,
            "A".repeat(64),
            exe()
        )
    }

    #[test]
    fn valide_et_resout_les_url_relatives() {
        let j = format!(r#"{{"schemaVersion":1,"apps":[{}]}}"#, app_json("demo", ""));
        let c = parse_and_validate(j.as_bytes(), &base(), &dev()).unwrap();
        assert_eq!(c.apps[0].download_url, "https://exemple.fr/hangar/zips/a.zip");
        assert_eq!(c.apps[0].sha256, "a".repeat(64));
    }

    #[test]
    fn refuse_doublons_versions_et_chemins() {
        let j = format!(
            r#"{{"schemaVersion":1,"apps":[{},{}]}}"#,
            app_json("demo", ""),
            app_json("demo", "")
        );
        assert!(parse_and_validate(j.as_bytes(), &base(), &dev()).is_err());
        let j = format!(r#"{{"schemaVersion":1,"apps":[{}]}}"#, app_json("demo", "").replace("1.2.3", "v1"));
        assert!(parse_and_validate(j.as_bytes(), &base(), &dev()).is_err());
        for bad in ["../x.exe", "/abs.exe", "C:/x.exe", "a/../../x.exe"] {
            assert!(normalize_relative_path(bad).is_err(), "{bad}");
        }
        assert_eq!(normalize_relative_path("a\\b/./c.exe").unwrap(), "a/b/c.exe");
    }

    #[test]
    fn accepte_un_fichier_avec_bom() {
        let j = format!("\u{feff}{{\"schemaVersion\":1,\"apps\":[{}]}}", app_json("demo", ""));
        assert_eq!(parse_and_validate(j.as_bytes(), &base(), &dev()).unwrap().apps.len(), 1);
    }

    #[test]
    fn distribue_exige_https() {
        let j = format!(r#"{{"schemaVersion":1,"apps":[{}]}}"#, app_json("demo", ""));
        let http = Url::parse("http://exemple.fr/catalog.json").unwrap();
        let p = TrustPolicy::Distributed { public_key: None };
        assert!(matches!(
            parse_and_validate(j.as_bytes(), &http, &p),
            Err(Error::InsecureUrl(_))
        ));
        assert!(parse_and_validate(j.as_bytes(), &http, &dev()).is_ok());
    }

    #[test]
    fn signature() {
        use ed25519_dalek::{Signer, SigningKey};
        let sk = SigningKey::from_bytes(&[7u8; 32]);
        let data = b"{\"schemaVersion\":1,\"apps\":[]}";
        let sig = base64::engine::general_purpose::STANDARD.encode(sk.sign(data).to_bytes());
        verify_signature(&sk.verifying_key(), data, &sig).unwrap();
        assert!(verify_signature(&sk.verifying_key(), b"autre", &sig).is_err());
        assert_eq!(
            signature_url(&base()).as_str(),
            "https://exemple.fr/hangar/catalog.json.sig"
        );
    }
}
