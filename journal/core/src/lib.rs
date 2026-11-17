//! Cœur de Rayan's Journal.
//!
//! - [`crypto`] : clé de l'archive (protégée par le compte Windows), chiffrement de chaque contenu et
//!   empreintes de recherche, pour qu'aucun texte ne soit écrit en clair sur le disque.
//! - [`temps`] : horodatages (instant UTC, décalage, fuseau, précision).
//! - [`texte`] : normalisation pour la recherche et masquage des secrets.
//! - [`archive`] : la base (événements du journal, conversations, versions, pièces jointes).
//! - [`imports`] : lecture des exports officiels (WhatsApp, Telegram, Discord, Instagram, Messenger).

pub mod archive;
pub mod crypto;
pub mod error;
pub mod imports;
pub mod rapport;
pub mod securite;
pub mod temps;
pub mod texte;

pub use archive::{Archive, Evenement, Filtre, NouvelEvenement};
pub use error::{Erreur, Resultat};
pub use temps::Horodatage;
