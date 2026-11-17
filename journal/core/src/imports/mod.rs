//! Lecture des exports officiels. Chaque lecteur produit un [`Lot`] : conversations, messages avec leur
//! horodatage d'origine, pièces jointes (lues à la demande dans le paquet) et fichiers sources bruts.
//! Le texte n'est jamais retouché : seuls les marqueurs ajoutés par l'application à l'export
//! (« <Ce message a été modifié> »…) sont retirés du texte et notés à part.

pub mod discord;
pub mod meta;
pub mod paquet;
pub mod telegram;
pub mod whatsapp;

use crate::error::{Erreur, Resultat};
use crate::temps::{Fuseau, Horodatage};
pub use paquet::Paquet;
use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct Lot {
    pub appli: String,
    /// Fichiers texte de l'export (chiffrés tels quels dans l'archive) : chemin dans le paquet.
    pub sources: Vec<String>,
    pub conversations: Vec<ConvImport>,
    pub avertissements: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct ConvImport {
    /// Identité stable de la conversation dans l'application (id Telegram, id de salon Discord…).
    pub cle: String,
    pub nom: String,
    pub messages: Vec<MsgImport>,
}

#[derive(Debug, Clone)]
pub struct MsgImport {
    /// Identité du message dans la conversation (id d'origine, ou auteur + heure + rang si l'export n'en a pas).
    pub cle: String,
    pub auteur: Option<String>,
    pub envoi: Horodatage,
    pub texte: String,
    /// Heure de la dernière modification quand l'export la donne.
    pub modifie: Option<Horodatage>,
    /// L'export signale une modification sans en donner l'heure.
    pub marque_modifie: bool,
    /// L'export remplace le message par une mention de suppression (« Ce message a été supprimé »).
    pub suppression_mentionnee: bool,
    pub pieces: Vec<PieceImport>,
    /// Réactions, liens partagés… (ni texte du message, ni pièce jointe).
    pub details: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct PieceImport {
    pub nom: String,
    /// Chemin du fichier dans le paquet, s'il y est.
    pub chemin: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Format {
    Whatsapp,
    Telegram,
    Discord,
    Meta,
}

pub fn detecter(p: &dyn Paquet) -> Option<Format> {
    let noms = p.noms();
    if noms.iter().any(|n| n.ends_with("result.json")) {
        return Some(Format::Telegram);
    }
    if noms.iter().any(|n| meta::est_fil(n)) {
        return Some(Format::Meta);
    }
    if noms.iter().any(|n| discord::est_salon(n)) {
        return Some(Format::Discord);
    }
    for n in noms.iter().filter(|n| n.to_lowercase().ends_with(".txt")) {
        if let Ok(b) = p.lire(n) {
            if whatsapp::ressemble(&String::from_utf8_lossy(&b[..b.len().min(4096)])) {
                return Some(Format::Whatsapp);
            }
        }
    }
    None
}

/// Lit un export (dossier, .zip, .txt ou .json) et produit le lot à archiver.
pub fn lire(p: &dyn Paquet, nom_paquet: &str, fuseau: &dyn Fuseau) -> Resultat<Lot> {
    match detecter(p) {
        Some(Format::Whatsapp) => whatsapp::lire(p, nom_paquet, fuseau),
        Some(Format::Telegram) => telegram::lire(p),
        Some(Format::Discord) => discord::lire(p),
        Some(Format::Meta) => meta::lire(p, nom_paquet),
        None => Err(Erreur::Format(
            "Export non reconnu. Formats acceptés : discussion WhatsApp exportée (.zip ou .txt), export JSON de \
             Telegram Desktop (result.json), paquet de données Discord (package.zip), téléchargement de vos \
             informations Instagram ou Facebook/Messenger au format JSON."
                .into(),
        )),
    }
}

/// Donne une clé unique aux messages sans identifiant : auteur, instant et rang parmi les messages
/// du même auteur au même instant (deux messages envoyés dans la même minute restent distincts).
pub(crate) fn cles_par_rang(messages: &mut [MsgImport]) {
    let mut vus: HashMap<(Option<String>, i64), u32> = HashMap::new();
    for m in messages.iter_mut() {
        let n = vus.entry((m.auteur.clone(), m.envoi.utc_ms)).or_insert(0);
        m.cle = format!("{}|{}|{}", m.auteur.as_deref().unwrap_or(""), m.envoi.utc_ms, n);
        *n += 1;
    }
}
