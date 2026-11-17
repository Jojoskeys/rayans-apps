//! WhatsApp : « Exporter la discussion » (iPhone : ZIP avec `_chat.txt` ; Android : `.txt`).
//!
//! L'export n'a ni fuseau ni identifiant de message : l'heure est l'heure locale du téléphone (à la seconde
//! sur iPhone, à la minute sur Android) et le fuseau est déduit de celui du PC. Un message modifié n'y
//! figure que dans sa dernière version, suivie de « <Ce message a été modifié> ». Un message « supprimé pour
//! tous » est remplacé par « Ce message a été supprimé » ; un message « supprimé pour moi » disparaît.

use super::{cles_par_rang, ConvImport, Lot, MsgImport, Paquet, PieceImport};
use crate::error::{Erreur, Resultat};
use crate::temps::{depuis_local, precision, Fuseau};
use chrono::NaiveDate;
use regex::Regex;
use std::sync::OnceLock;

fn re_entete() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| {
        Regex::new(
            r"^\u{200e}?(?:\[(?P<a1>\d{1,2})[/.](?P<b1>\d{1,2})[/.](?P<c1>\d{2,4}),?\s(?P<h1>\d{1,2}):(?P<m1>\d{2})(?::(?P<s1>\d{2}))?(?:[\s\u{202f}]?(?P<p1>[AaPp]\.?\s?[Mm]\.?))?\]\s|(?P<a2>\d{1,2})[/.](?P<b2>\d{1,2})[/.](?P<c2>\d{2,4}),?\s(?P<h2>\d{1,2}):(?P<m2>\d{2})(?::(?P<s2>\d{2}))?(?:[\s\u{202f}]?(?P<p2>[AaPp]\.?\s?[Mm]\.?))?\s[-–]\s)",
        )
        .unwrap()
    })
}

fn re_piece() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"\u{200e}?<(?:pièce jointe|piece jointe|attached|fichier joint)\s?:\s?([^>]+)>").unwrap())
}

fn re_piece_android() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"^\u{200e}?(.+?\.[A-Za-z0-9]{2,5}) \((?:fichier joint|file attached)\)").unwrap())
}

const MEDIAS_OMIS: &[&str] = &[
    "<Médias omis>", "<Media omitted>", "image absente", "vidéo absente", "audio omis", "image omitted",
    "video omitted", "audio omitted", "sticker omitted", "autocollant omis", "GIF omis", "GIF omitted",
    "document omitted", "document omis",
];

const MENTIONS_SUPPRESSION: &[&str] = &[
    "Ce message a été supprimé", "Vous avez supprimé ce message", "This message was deleted",
    "You deleted this message", "Message supprimé",
];

const MARQUES_MODIFICATION: &[&str] = &["<Ce message a été modifié>", "<This message was edited>", "<Message modifié>"];

pub fn ressemble(debut: &str) -> bool {
    debut.lines().take(10).filter(|l| re_entete().is_match(l)).count() >= 1
}

struct Brut {
    jour: (u32, u32, i32),
    h: u32,
    m: u32,
    s: Option<u32>,
    pm: Option<bool>,
    reste: String,
}

fn nom_conversation(nom_paquet: &str, fichier: &str) -> String {
    let base = |s: &str| -> String {
        let s = s.rsplit(['/', '\\']).next().unwrap_or(s);
        let s = s.strip_suffix(".zip").or_else(|| s.strip_suffix(".txt")).unwrap_or(s);
        for p in ["WhatsApp Chat - ", "WhatsApp Chat with ", "Discussion WhatsApp avec ", "Discussion WhatsApp - "] {
            if let Some(r) = s.strip_prefix(p) {
                return r.to_string();
            }
        }
        s.to_string()
    };
    let f = fichier.rsplit('/').next().unwrap_or(fichier);
    if f == "_chat.txt" || f.eq_ignore_ascii_case("chat.txt") {
        base(nom_paquet)
    } else {
        base(f)
    }
}

pub fn lire(p: &dyn Paquet, nom_paquet: &str, fuseau: &dyn Fuseau) -> Resultat<Lot> {
    let mut lot = Lot { appli: "whatsapp".into(), sources: vec![], conversations: vec![], avertissements: vec![] };
    let noms = p.noms();
    for fichier in noms.iter().filter(|n| n.to_lowercase().ends_with(".txt")) {
        let octets = p.lire(fichier)?;
        let texte = String::from_utf8(octets).map_err(|_| Erreur::Format(format!("« {fichier} » n'est pas en UTF-8")))?;
        let texte = texte.strip_prefix('\u{feff}').unwrap_or(&texte);
        if !ressemble(texte) {
            continue;
        }
        lot.sources.push(fichier.clone());
        let nom = nom_conversation(nom_paquet, fichier);
        let messages = analyser(texte, fuseau, p, fichier, &mut lot.avertissements);
        lot.conversations.push(ConvImport { cle: format!("nom:{nom}"), nom, messages });
    }
    if lot.conversations.is_empty() {
        return Err(Erreur::Format("Aucune discussion WhatsApp lisible dans cet export.".into()));
    }
    lot.avertissements.push(
        "WhatsApp : heures sans fuseau dans l'export, fuseau déduit de celui du PC. Seule la dernière version \
         d'un message modifié est exportée."
            .into(),
    );
    Ok(lot)
}

fn analyser(texte: &str, fuseau: &dyn Fuseau, p: &dyn Paquet, fichier: &str, avert: &mut Vec<String>) -> Vec<MsgImport> {
    // 1. Découpe en messages : une ligne d'en-tête commence un message, les autres lignes le prolongent.
    let mut bruts: Vec<Brut> = Vec::new();
    let mut lignes: Vec<&str> = texte.split('\n').collect();
    if lignes.last() == Some(&"") {
        lignes.pop();
    }
    for ligne in lignes {
        let ligne = ligne.strip_suffix('\r').unwrap_or(ligne);
        if let Some(c) = re_entete().captures(ligne) {
            let g = |a: &str, b: &str| c.name(a).or_else(|| c.name(b)).map(|m| m.as_str().to_string());
            let n = |a: &str, b: &str| g(a, b).and_then(|s| s.parse::<u32>().ok());
            let annee = n("c1", "c2").unwrap_or(0) as i32;
            bruts.push(Brut {
                jour: (n("a1", "a2").unwrap_or(0), n("b1", "b2").unwrap_or(0), if annee < 100 { 2000 + annee } else { annee }),
                h: n("h1", "h2").unwrap_or(0),
                m: n("m1", "m2").unwrap_or(0),
                s: n("s1", "s2"),
                pm: g("p1", "p2").map(|s| s.to_lowercase().starts_with('p')),
                reste: ligne[c.get(0).unwrap().end()..].to_string(),
            });
        } else if let Some(dernier) = bruts.last_mut() {
            dernier.reste.push('\n');
            dernier.reste.push_str(ligne);
        }
    }
    // 2. Ordre jour/mois : un premier nombre > 12 → jour d'abord ; un second > 12 → mois d'abord.
    let mois_dabord = !bruts.iter().any(|b| b.jour.0 > 12) && bruts.iter().any(|b| b.jour.1 > 12);
    let mut out = Vec::new();
    for b in bruts {
        let (j, mo) = if mois_dabord { (b.jour.1, b.jour.0) } else { (b.jour.0, b.jour.1) };
        let mut h = b.h;
        if let Some(pm) = b.pm {
            h %= 12;
            if pm {
                h += 12;
            }
        }
        let Some(local) = NaiveDate::from_ymd_opt(b.jour.2, mo, j).and_then(|d| d.and_hms_opt(h, b.m, b.s.unwrap_or(0))) else {
            avert.push(format!("Date illisible ignorée dans « {fichier} » : {}/{}/{}", b.jour.0, b.jour.1, b.jour.2));
            continue;
        };
        let prec = if b.s.is_some() { precision::SECONDE } else { precision::MINUTE };
        let envoi = depuis_local(fuseau, local, prec);
        // Auteur : ce qui précède le premier « : » ; sans « : », c'est un message du système.
        let reste = b.reste.trim_start_matches('\u{200e}');
        let (auteur, corps) = match reste.find(": ") {
            Some(i) if !reste[..i].contains('\n') => (Some(reste[..i].to_string()), reste[i + 2..].to_string()),
            _ => (None, reste.to_string()),
        };
        let mut corps = corps.strip_prefix('\u{200e}').map(String::from).unwrap_or(corps);
        let mut m = MsgImport {
            cle: String::new(),
            auteur,
            envoi,
            texte: String::new(),
            modifie: None,
            marque_modifie: false,
            suppression_mentionnee: false,
            pieces: vec![],
            details: vec![],
        };
        for marque in MARQUES_MODIFICATION {
            let t = corps.trim_end().trim_end_matches('\u{200e}');
            if let Some(avant) = t.strip_suffix(marque) {
                corps = avant.trim_end_matches(['\u{200e}', ' ']).to_string();
                m.marque_modifie = true;
                break;
            }
        }
        if let Some(c) = re_piece().captures(&corps) {
            let nom = c[1].trim().to_string();
            let chemin = super::paquet::resoudre(p, fichier, &nom);
            let note = chemin.is_none().then(|| "fichier non inclus dans l'export".to_string());
            m.pieces.push(PieceImport { nom, chemin, note });
            let r = c.get(0).unwrap().range();
            corps.replace_range(r, "");
            corps = corps.trim_start_matches(['\n', '\u{200e}']).to_string();
        } else if let Some(c) = re_piece_android().captures(&corps) {
            let nom = c[1].to_string();
            let chemin = super::paquet::resoudre(p, fichier, &nom);
            let note = chemin.is_none().then(|| "fichier non inclus dans l'export".to_string());
            m.pieces.push(PieceImport { nom, chemin, note });
            let fin = c.get(0).unwrap().end();
            corps = corps[fin..].trim_start_matches('\n').to_string();
        } else if let Some(o) = MEDIAS_OMIS.iter().find(|o| corps.trim().trim_start_matches('\u{200e}') == **o) {
            m.pieces.push(PieceImport { nom: (*o).to_string(), chemin: None, note: Some("média omis par WhatsApp à l'export".into()) });
            corps.clear();
        }
        let net = corps.trim().trim_matches('\u{200e}').trim_end_matches('.');
        if MENTIONS_SUPPRESSION.iter().any(|s| net == *s) {
            m.suppression_mentionnee = true;
        }
        m.texte = corps;
        out.push(m);
    }
    cles_par_rang(&mut out);
    out
}
