//! Telegram Desktop : Paramètres → Avancé → Exporter les données Telegram, format « JSON lisible par une
//! machine » (`result.json`), ou export d'une seule discussion.
//!
//! Chaque message a un identifiant stable, l'heure en UTC (`date_unixtime`) et l'heure locale de l'export
//! (`date`), ce qui donne le décalage exact. Un message modifié n'y figure que dans sa dernière version, avec
//! l'heure de modification (`edited_unixtime`). Les messages supprimés n'y figurent pas.

use super::{ConvImport, Lot, MsgImport, Paquet, PieceImport};
use crate::error::{Erreur, Resultat};
use crate::temps::{precision, Horodatage};
use chrono::NaiveDateTime;
use serde_json::Value;

fn horodatage(unix: Option<&Value>, local: Option<&Value>) -> Option<Horodatage> {
    let secondes: i64 = match unix? {
        Value::String(s) => s.parse().ok()?,
        Value::Number(n) => n.as_i64()?,
        _ => return None,
    };
    let mut h = Horodatage::utc(secondes * 1000, precision::SECONDE);
    if let Some(l) = local.and_then(Value::as_str).and_then(|s| NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S").ok()) {
        let d = ((l.and_utc().timestamp() - secondes) / 60) as i32;
        h.decalage_min = d;
        h.fuseau = format!("décalage de l'export (UTC{}{:02}:{:02})", if d < 0 { '-' } else { '+' }, d.abs() / 60, d.abs() % 60);
    }
    Some(h)
}

/// Texte exact : chaîne, ou liste de morceaux (texte simple et entités mises en forme).
fn texte(v: Option<&Value>) -> String {
    match v {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Array(a)) => a
            .iter()
            .map(|p| match p {
                Value::String(s) => s.clone(),
                Value::Object(o) => o.get("text").and_then(Value::as_str).unwrap_or("").to_string(),
                _ => String::new(),
            })
            .collect(),
        _ => String::new(),
    }
}

fn conversation(p: &dyn Paquet, base: &str, c: &Value) -> ConvImport {
    let nom = c.get("name").and_then(Value::as_str).unwrap_or("(sans nom)").to_string();
    let id = c.get("id").map(|v| v.to_string()).unwrap_or_else(|| nom.clone());
    let mut messages = Vec::new();
    for m in c.get("messages").and_then(Value::as_array).into_iter().flatten() {
        let Some(envoi) = horodatage(m.get("date_unixtime"), m.get("date")) else { continue };
        let service = m.get("type").and_then(Value::as_str) == Some("service");
        let auteur = if service {
            m.get("actor").and_then(Value::as_str).map(String::from)
        } else {
            m.get("from").and_then(Value::as_str).map(String::from)
        };
        let mut t = texte(m.get("text"));
        let mut details = Vec::new();
        if service {
            if let Some(a) = m.get("action").and_then(Value::as_str) {
                details.push(format!("action du service : {a}"));
            }
        }
        if let Some(r) = m.get("reactions").and_then(Value::as_array) {
            for x in r {
                let e = x.get("emoji").and_then(Value::as_str).unwrap_or("?");
                let n = x.get("count").and_then(Value::as_i64).unwrap_or(1);
                details.push(format!("réaction {e} ×{n}"));
            }
        }
        if let Some(f) = m.get("forwarded_from").and_then(Value::as_str) {
            details.push(format!("transféré de {f}"));
        }
        if let Some(r) = m.get("reply_to_message_id") {
            details.push(format!("réponse au message {r}"));
        }
        let mut pieces = Vec::new();
        for champ in ["photo", "file", "thumbnail"] {
            if champ == "thumbnail" && !pieces.is_empty() {
                break;
            }
            if let Some(chemin) = m.get(champ).and_then(Value::as_str) {
                let nom = m.get("file_name").and_then(Value::as_str).unwrap_or(chemin).to_string();
                if chemin.starts_with("(File not included") || chemin.starts_with("(File exceeds") {
                    pieces.push(PieceImport { nom, chemin: None, note: Some(format!("non incluse dans l'export : {chemin}")) });
                } else {
                    let trouve = super::paquet::resoudre(p, base, chemin);
                    let note = trouve.is_none().then(|| "fichier absent du dossier d'export".to_string());
                    pieces.push(PieceImport { nom, chemin: trouve, note });
                }
            }
        }
        if t.is_empty() {
            if let Some(s) = m.get("sticker_emoji").and_then(Value::as_str) {
                details.push(format!("autocollant {s}"));
            }
        }
        if let Some(poll) = m.get("poll") {
            if let Some(q) = poll.get("question").and_then(Value::as_str) {
                details.push(format!("sondage : {q}"));
            }
        }
        if let Some(contact) = m.get("contact_information") {
            details.push(format!("contact partagé : {contact}"));
        }
        if let Some(loc) = m.get("location_information") {
            details.push(format!("position partagée : {loc}"));
        }
        t = t.replace("\r\n", "\n");
        messages.push(MsgImport {
            cle: m.get("id").map(|v| v.to_string()).unwrap_or_default(),
            auteur,
            envoi,
            texte: t,
            modifie: horodatage(m.get("edited_unixtime"), m.get("edited")),
            marque_modifie: m.get("edited").is_some(),
            suppression_mentionnee: false,
            pieces,
            details,
        });
    }
    ConvImport { cle: format!("id:{id}"), nom, messages }
}

pub fn lire(p: &dyn Paquet) -> Resultat<Lot> {
    let mut lot = Lot { appli: "telegram".into(), sources: vec![], conversations: vec![], avertissements: vec![] };
    for f in p.noms().into_iter().filter(|n| n.ends_with("result.json")) {
        let v: Value = serde_json::from_slice(&p.lire(&f)?)?;
        lot.sources.push(f.clone());
        if let Some(liste) = v.pointer("/chats/list").and_then(Value::as_array) {
            for c in liste {
                lot.conversations.push(conversation(p, &f, c));
            }
            for c in v.pointer("/left_chats/list").and_then(Value::as_array).into_iter().flatten() {
                lot.conversations.push(conversation(p, &f, c));
            }
        } else if v.get("messages").is_some() {
            lot.conversations.push(conversation(p, &f, &v));
        }
    }
    if lot.conversations.is_empty() {
        return Err(Erreur::Format("result.json ne contient aucune discussion (export Telegram au format JSON ?)".into()));
    }
    lot.avertissements
        .push("Telegram : seule la dernière version d'un message modifié est exportée ; les messages supprimés n'y figurent pas.".into());
    Ok(lot)
}
