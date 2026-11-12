//! Coeur de Rayan's Rangement.
//!
//! Principes de sécurité, valables pour tout le code de ce crate :
//! - rien n'est jamais supprimé : les doublons vont dans un dossier de quarantaine ;
//! - rien n'est jamais écrasé : si la destination existe, le fichier est renommé « nom (2).ext » ;
//! - un fichier en cours d'utilisation, modifié depuis l'aperçu ou trop récent est laissé en place ;
//! - chaque déplacement est inscrit au journal *avant* d'être fait, puis confirmé : tout peut être annulé.

pub mod config;
pub mod engine;
mod error;
pub mod fsops;
pub mod journal;
pub mod plan;
pub mod rules;
pub mod scan;

pub use config::{AutoConfig, AutoMode, Config, Rule};
pub use engine::{apply_plan, undo, ApplyReport, UndoReport};
pub use error::{Error, Result};
pub use journal::{BatchView, Journal, OpState, OpView};
pub use plan::{build_plan, OpKind, Plan, PlanItem, SkipItem};
