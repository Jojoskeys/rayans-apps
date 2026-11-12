//! Erreurs du coeur, chacune avec un code stable (pour l'interface) et un message lisible en français.

use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Le catalogue est injoignable : {0}")]
    Network(String),
    #[error("Le serveur a répondu {status} pour {url}")]
    HttpStatus { status: u16, url: String },
    #[error("Le catalogue est invalide : {0}")]
    InvalidCatalog(String),
    #[error("La signature du catalogue est refusée : {0}")]
    Signature(String),
    #[error("Adresse refusée : {0}")]
    InsecureUrl(String),
    #[error("Le fichier téléchargé ne correspond pas à l'empreinte SHA-256 du catalogue (attendue {expected}, obtenue {actual}). Il est peut-être corrompu ou a été remplacé.")]
    Integrity { expected: String, actual: String },
    #[error("L'archive est refusée : {0}")]
    UnsafeArchive(String),
    #[error("L'archive est illisible : {0}")]
    BadArchive(String),
    #[error("L'exécutable attendu « {0} » est absent de l'archive.")]
    MissingExecutable(String),
    #[error("L'exécutable installé a été modifié depuis l'installation. Réinstallez l'application.")]
    TamperedExecutable,
    #[error("Une installation de cette application est déjà en cours.")]
    Busy,
    #[error("L'application est ouverte. Fermez-la d'abord.")]
    Running,
    #[error("Application inconnue : {0}")]
    UnknownApp(String),
    #[error("Cette application n'est pas installée.")]
    NotInstalled,
    #[error("Le lancement a échoué : {0}")]
    Launch(String),
    #[error("Erreur disque : {0}")]
    Io(String),
    #[error("{0}")]
    Other(String),
}

impl Error {
    pub fn code(&self) -> &'static str {
        match self {
            Error::Network(_) => "network",
            Error::HttpStatus { .. } => "http",
            Error::InvalidCatalog(_) => "invalid_catalog",
            Error::Signature(_) => "signature",
            Error::InsecureUrl(_) => "insecure_url",
            Error::Integrity { .. } => "integrity",
            Error::UnsafeArchive(_) => "unsafe_archive",
            Error::BadArchive(_) => "bad_archive",
            Error::MissingExecutable(_) => "missing_executable",
            Error::TamperedExecutable => "tampered",
            Error::Busy => "busy",
            Error::Running => "running",
            Error::UnknownApp(_) => "unknown_app",
            Error::NotInstalled => "not_installed",
            Error::Launch(_) => "launch",
            Error::Io(_) => "io",
            Error::Other(_) => "other",
        }
    }

    /// Conseil affiché sous le message, pour que l'utilisateur sache quoi faire.
    pub fn hint(&self) -> &'static str {
        match self {
            Error::Network(_) | Error::HttpStatus { .. } => {
                "Vérifiez votre connexion et l'adresse du catalogue dans les paramètres, puis réessayez."
            }
            Error::InvalidCatalog(_) => {
                "Corrigez le fichier catalogue publié. Le dernier catalogue valide reste utilisé en attendant."
            }
            Error::Signature(_) => {
                "Re-signez le catalogue avec la clé privée qui correspond à la clé publique intégrée au launcher."
            }
            Error::InsecureUrl(_) => "En distribution, toutes les adresses doivent être en https://.",
            Error::Integrity { .. } => {
                "Republiez le ZIP ou corrigez son empreinte sha256 dans le catalogue. La version installée reste utilisable."
            }
            Error::UnsafeArchive(_) | Error::BadArchive(_) | Error::MissingExecutable(_) => {
                "Republiez une archive correcte. La version installée reste utilisable."
            }
            Error::TamperedExecutable => "Désinstallez puis réinstallez l'application.",
            Error::Busy => "Attendez la fin de l'opération en cours.",
            Error::Running => "Fermez l'application puis réessayez.",
            Error::Launch(_) => "Réessayez, ou réinstallez l'application si le problème persiste.",
            Error::Io(_) => "Vérifiez l'espace disque et les droits sur le dossier du launcher.",
            _ => "Réessayez.",
        }
    }

    pub fn info(&self) -> ErrorInfo {
        ErrorInfo {
            code: self.code().to_string(),
            message: self.to_string(),
            hint: self.hint().to_string(),
        }
    }
}

impl From<std::io::Error> for Error {
    fn from(e: std::io::Error) -> Self {
        Error::Io(e.to_string())
    }
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ErrorInfo {
    pub code: String,
    pub message: String,
    pub hint: String,
}

pub type Result<T> = std::result::Result<T, Error>;
