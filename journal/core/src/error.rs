use thiserror::Error;

#[derive(Debug, Error)]
pub enum Erreur {
    #[error("base de données : {0}")]
    Base(#[from] rusqlite::Error),
    #[error("fichier : {0}")]
    Fichier(#[from] std::io::Error),
    #[error("lecture JSON : {0}")]
    Json(#[from] serde_json::Error),
    #[error("archive ZIP : {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("chiffrement : {0}")]
    Chiffrement(String),
    #[error("{0}")]
    Format(String),
}

pub type Resultat<T> = Result<T, Erreur>;
