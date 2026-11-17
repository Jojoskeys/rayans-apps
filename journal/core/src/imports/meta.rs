//! Instagram et Messenger : Centre de comptes → Vos informations et autorisations → Télécharger vos
//! informations, format **JSON** (`your_instagram_activity/messages/inbox/…/message_1.json`,
//! `your_facebook_activity/messages/inbox/…`).
//!
//! L'heure est en millisecondes UTC. Les textes du JSON de Meta sont mal encodés (chaque octet UTF-8 écrit
//! comme un caractère : « Ã© » au lieu de « é ») : ils sont réparés, et laissés tels quels si la réparation
//! n'est pas certaine. Les messages retirés n'y figurent pas, ou seulement comme mention. Les discussions
//! Messenger chiffrées de bout en bout ne sont pas dans cet export.

use super::{cles_par_rang, ConvImport, Lot, MsgImport, Paquet, PieceImport};
use crate::error::{Erreur, Resultat};
use crate::temps::{precision, Horodatage};
use serde_json::Value;
use std::collections::BTreeMap;

pub fn est_fil(nom: &str) -> bool {
    let n = nom.to_lowercase();
    let f = n.rsplit('/').next().unwrap_or("");
    n.contains("messages/") && f.starts_with("message_") && f.ends_with(".json")
}

/// Répare le texte « latin-1 » de Meta : si chaque caractère tient sur un octet et que ces octets forment
/// de l'UTF-8 valide, c'est la bonne lecture ; sinon le texte est gardé tel quel.
pub fn reparer(s: &str) -> String {
    if s.chars().all(|c| (c as u32) < 0x80) || s.chars().any(|c| (c as u32) > 0xFF) {
        return s.to_string();
    }
    let octets: Vec<u8> = s.chars().map(|c| c as u32 as u8).collect();
    String::from_utf8(octets).unwrap_or_else(|_| s.to_string())
}

fn reparer_tout(v: &mut Value) {
    match v {
        Value::String(s) => *s = reparer(s),
        Value::Array(a) => a.iter_mut().for_each(reparer_tout),
        Value::Object(o) => o.values_mut().for_each(reparer_tout),
        _ => {}
    }
}

const MENTIONS_RETRAIT: &[&str] = &[
    "a retiré un message", "avez retiré un message", "a annulé l'envoi d'un message", "avez annulé l'envoi d'un message",
    "unsent a message", "Ce message a été supprimé", "This message was deleted", "Message supprimé",
];

fn pieces(p: &dyn Paquet, base: &str, m: &Value) -> Vec<PieceImport> {
    let mut out = Vec::new();
    for champ in ["photos", "videos", "audio_files", "files", "gifs"] {
        for x in m.get(champ).and_then(Value::as_array).into_iter().flatten() {
            if let Some(uri) = x.get("uri").and_then(Value::as_str) {
                out.push(piece(p, base, uri));
            }
        }
    }
    if let Some(uri) = m.pointer("/sticker/uri").and_then(Value::as_str) {
        out.push(piece(p, base, uri));
    }
    out
}

fn piece(p: &dyn Paquet, base: &str, uri: &str) -> PieceImport {
    let nom = uri.rsplit('/').next().unwrap_or(uri).to_string();
    // Les chemins de Meta partent de la racine de l'export (« your_instagram_activity/messages/… »).
    let chemin = if p.existe(uri) { Some(uri.to_string()) } else { super::paquet::resoudre(p, base, uri) };
    let note = chemin.is_none().then(|| "fichier absent de l'export".to_string());
    PieceImport { nom, chemin, note }
}

pub fn lire(p: &dyn Paquet, nom_paquet: &str) -> Resultat<Lot> {
    let noms = p.noms();
    let instagram = nom_paquet.to_lowercase().contains("instagram") || noms.iter().any(|n| n.contains("instagram"));
    let appli = if instagram { "instagram" } else { "messenger" };
    let mut lot = Lot { appli: appli.into(), sources: vec![], conversations: vec![], avertissements: vec![] };
    // Un fil peut être découpé en message_1.json, message_2.json…
    let mut fils: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for n in noms.iter().filter(|n| est_fil(n)) {
        let dossier = n[..n.rfind('/').unwrap_or(0)].to_string();
        fils.entry(dossier).or_default().push(n.clone());
    }
    for (dossier, fichiers) in fils {
        let mut titre = None;
        let mut cle = None;
        let mut messages = Vec::new();
        for f in &fichiers {
            let mut v: Value = serde_json::from_slice(&p.lire(f)?)?;
            reparer_tout(&mut v);
            lot.sources.push(f.clone());
            titre = titre.or_else(|| v.get("title").and_then(Value::as_str).map(String::from));
            if titre.as_deref().is_none_or(str::is_empty) {
                let noms: Vec<String> = v
                    .get("participants")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                    .filter_map(|x| x.get("name").and_then(Value::as_str).map(String::from))
                    .collect();
                if !noms.is_empty() {
                    titre = Some(noms.join(", "));
                }
            }
            cle = cle.or_else(|| v.get("thread_path").and_then(Value::as_str).map(String::from));
            for m in v.get("messages").and_then(Value::as_array).into_iter().flatten() {
                let Some(ms) = m.get("timestamp_ms").and_then(Value::as_i64) else { continue };
                let texte = m.get("content").and_then(Value::as_str).unwrap_or("").to_string();
                let mut details = Vec::new();
                for r in m.get("reactions").and_then(Value::as_array).into_iter().flatten() {
                    let e = r.get("reaction").and_then(Value::as_str).unwrap_or("?");
                    let a = r.get("actor").and_then(Value::as_str).unwrap_or("?");
                    details.push(format!("réaction {e} de {a}"));
                }
                if let Some(l) = m.pointer("/share/link").and_then(Value::as_str) {
                    details.push(format!("lien partagé : {l}"));
                }
                if let Some(t) = m.pointer("/share/share_text").and_then(Value::as_str) {
                    details.push(format!("texte du partage : {t}"));
                }
                let retire = m.get("is_unsent").and_then(Value::as_bool) == Some(true)
                    || (!texte.is_empty() && MENTIONS_RETRAIT.iter().any(|x| texte.contains(x)) && texte.chars().count() < 80);
                messages.push(MsgImport {
                    cle: String::new(),
                    auteur: m.get("sender_name").and_then(Value::as_str).map(String::from),
                    envoi: Horodatage::en_local(ms, precision::MILLISECONDE),
                    texte,
                    modifie: None,
                    marque_modifie: m.get("is_edited").and_then(Value::as_bool) == Some(true),
                    suppression_mentionnee: retire,
                    pieces: pieces(p, f, m),
                    details,
                });
            }
        }
        // Meta liste du plus récent au plus ancien : on remet dans l'ordre d'envoi.
        messages.sort_by_key(|m| m.envoi.utc_ms);
        cles_par_rang(&mut messages);
        let cle = cle.unwrap_or_else(|| dossier.rsplit('/').next().unwrap_or(&dossier).to_string());
        lot.conversations.push(ConvImport { cle: format!("fil:{cle}"), nom: titre.unwrap_or(cle), messages });
    }
    if lot.conversations.is_empty() {
        return Err(Erreur::Format("Aucune conversation trouvée dans cet export Meta (format JSON demandé ?).".into()));
    }
    lot.avertissements.push(format!(
        "{} : textes réparés depuis l'encodage de Meta ; messages retirés absents de l'export{}.",
        if instagram { "Instagram" } else { "Messenger" },
        if instagram { "" } else { " ; discussions chiffrées de bout en bout non incluses (Stockage sécurisé des messages)" }
    ));
    Ok(lot)
}
