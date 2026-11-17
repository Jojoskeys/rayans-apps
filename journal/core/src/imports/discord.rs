//! Discord : Paramètres → Données et confidentialité → Demander toutes mes données (`package.zip`).
//!
//! Le paquet ne contient que **tes propres messages** (`messages/c<id>/messages.json`, ou `messages.csv`
//! dans les anciens paquets), avec leur identifiant et leur heure UTC. Les messages des autres personnes n'y
//! sont pas, les modifications ne sont pas datées et les messages supprimés n'y figurent plus.

use super::{ConvImport, Lot, MsgImport, Paquet, PieceImport};
use crate::error::{Erreur, Resultat};
use crate::temps::{precision, Horodatage};
use chrono::{DateTime, NaiveDateTime};
use serde_json::Value;

pub fn est_salon(nom: &str) -> bool {
    let n = nom.to_lowercase();
    let parts: Vec<&str> = n.split('/').collect();
    parts.len() >= 3
        && parts[parts.len() - 3] == "messages"
        && parts[parts.len() - 2].starts_with('c')
        && (parts[parts.len() - 1] == "messages.json" || parts[parts.len() - 1] == "messages.csv")
}

fn heure(s: &str) -> Option<Horodatage> {
    let s = s.trim();
    if let Ok(d) = DateTime::parse_from_rfc3339(s) {
        return Some(Horodatage::en_local(d.timestamp_millis(), precision::MILLISECONDE));
    }
    if let Ok(d) = DateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S%.f%:z") {
        return Some(Horodatage::en_local(d.timestamp_millis(), precision::MILLISECONDE));
    }
    for f in ["%Y-%m-%d %H:%M:%S%.f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S%.f"] {
        if let Ok(d) = NaiveDateTime::parse_from_str(s, f) {
            let p = if s.contains('.') { precision::MILLISECONDE } else { precision::SECONDE };
            return Some(Horodatage::en_local(d.and_utc().timestamp_millis(), p));
        }
    }
    None
}

/// Lecteur CSV minimal (guillemets doublés, sauts de ligne dans les champs).
fn csv(t: &str) -> Vec<Vec<String>> {
    let mut lignes = Vec::new();
    let mut ligne = Vec::new();
    let mut champ = String::new();
    let mut guil = false;
    let mut it = t.chars().peekable();
    while let Some(c) = it.next() {
        match (guil, c) {
            (true, '"') if it.peek() == Some(&'"') => {
                champ.push('"');
                it.next();
            }
            (true, '"') => guil = false,
            (true, c) => champ.push(c),
            (false, '"') => guil = true,
            (false, ',') => ligne.push(std::mem::take(&mut champ)),
            (false, '\r') => {}
            (false, '\n') => {
                ligne.push(std::mem::take(&mut champ));
                lignes.push(std::mem::take(&mut ligne));
            }
            (false, c) => champ.push(c),
        }
    }
    if !champ.is_empty() || !ligne.is_empty() {
        ligne.push(champ);
        lignes.push(ligne);
    }
    lignes
}

fn nom_salon(p: &dyn Paquet, dossier: &str, index: &Value, id: &str) -> String {
    if let Ok(b) = p.lire(&format!("{dossier}channel.json")) {
        if let Ok(c) = serde_json::from_slice::<Value>(&b) {
            let nom = c.get("name").and_then(Value::as_str);
            let serveur = c.pointer("/guild/name").and_then(Value::as_str);
            match (serveur, nom) {
                (Some(s), Some(n)) => return format!("{s} › #{n}"),
                (None, Some(n)) => return n.to_string(),
                _ => {}
            }
        }
    }
    index.get(id).and_then(Value::as_str).map(String::from).unwrap_or_else(|| format!("Salon {id}"))
}

pub fn lire(p: &dyn Paquet) -> Resultat<Lot> {
    let mut lot = Lot { appli: "discord".into(), sources: vec![], conversations: vec![], avertissements: vec![] };
    let noms = p.noms();
    let index: Value = noms
        .iter()
        .find(|n| n.to_lowercase().ends_with("messages/index.json"))
        .and_then(|n| p.lire(n).ok())
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or(Value::Null);
    for f in noms.iter().filter(|n| est_salon(n)) {
        let dossier = &f[..f.rfind('/').unwrap() + 1];
        let id = dossier.trim_end_matches('/').rsplit('/').next().unwrap_or("").trim_start_matches('c').to_string();
        let octets = p.lire(f)?;
        lot.sources.push(f.clone());
        let mut lignes: Vec<(String, String, String, String)> = Vec::new(); // id, heure, contenu, pièces
        if f.to_lowercase().ends_with(".json") {
            let v: Value = serde_json::from_slice(&octets)?;
            for m in v.as_array().into_iter().flatten() {
                let g = |k: &str| match m.get(k) {
                    Some(Value::String(s)) => s.clone(),
                    Some(Value::Null) | None => String::new(),
                    Some(x) => x.to_string(),
                };
                lignes.push((g("ID"), g("Timestamp"), g("Contents"), g("Attachments")));
            }
        } else {
            let t = String::from_utf8_lossy(&octets);
            for l in csv(&t).into_iter().skip(1) {
                if l.len() >= 3 {
                    lignes.push((l[0].clone(), l[1].clone(), l[2].clone(), l.get(3).cloned().unwrap_or_default()));
                }
            }
        }
        let mut messages = Vec::new();
        for (mid, h, contenu, pj) in lignes {
            let Some(envoi) = heure(&h) else {
                lot.avertissements.push(format!("Discord : heure illisible « {h} » ignorée"));
                continue;
            };
            let pieces = pj
                .split_whitespace()
                .map(|u| PieceImport {
                    nom: u.rsplit('/').next().unwrap_or(u).split('?').next().unwrap_or(u).to_string(),
                    chemin: None,
                    note: Some(format!("lien Discord (non téléchargé) : {u}")),
                })
                .collect();
            messages.push(MsgImport {
                cle: mid,
                auteur: Some("moi".into()),
                envoi,
                texte: contenu,
                modifie: None,
                marque_modifie: false,
                suppression_mentionnee: false,
                pieces,
                details: vec![],
            });
        }
        let nom = nom_salon(p, dossier, &index, &id);
        lot.conversations.push(ConvImport { cle: format!("id:{id}"), nom, messages });
    }
    if lot.conversations.is_empty() {
        return Err(Erreur::Format("Aucun salon trouvé dans ce paquet Discord.".into()));
    }
    lot.avertissements.push(
        "Discord : le paquet officiel ne contient que tes propres messages. Les pièces jointes sont des liens \
         qui expirent : elles ne sont pas téléchargées."
            .into(),
    );
    Ok(lot)
}
