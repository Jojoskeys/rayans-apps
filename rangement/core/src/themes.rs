//! Classement par thème, 100 % local : mots-clés cherchés dans le nom du fichier, puis (pour un PDF dont
//! le nom ne suffit pas) dans le texte de la première page. Comparaison sans accents ni majuscules.
//!
//! Un mot-clé correspond au début d'un mot du nom : « facture » trouve « Factures_2026.pdf », « rib » trouve
//! « RIB-banque.pdf » mais pas « tribunal.pdf ». Un mot-clé de plusieurs mots (« fiche de paie ») doit
//! apparaître dans cet ordre.

use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Duration;

/// Nom du dossier quand aucun thème ne correspond.
pub const OTHER: &str = "Autres";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Theme {
    pub name: String,
    pub keywords: Vec<String>,
}

impl Default for Theme {
    fn default() -> Self {
        Theme { name: String::new(), keywords: Vec::new() }
    }
}

fn theme(name: &str, keywords: &[&str]) -> Theme {
    Theme { name: name.into(), keywords: keywords.iter().map(|s| s.to_string()).collect() }
}

pub fn default_themes() -> Vec<Theme> {
    vec![
        theme("Factures", &["facture", "invoice", "devis", "receipt", "bon de commande", "commande"]),
        theme("Banque", &["releve", "rib", "iban", "banque", "bancaire", "virement", "pret immobilier", "credit immobilier", "bank statement"]),
        theme("Impôts", &["impot", "imposition", "fiscal", "taxe fonciere", "taxe d habitation", "urssaf", "declaration de revenus"]),
        theme(
            "Travail",
            &["contrat", "fiche de paie", "bulletin de paie", "bulletin de salaire", "salaire", "cv", "curriculum", "lettre de motivation", "attestation employeur", "france travail", "pole emploi"],
        ),
        theme(
            "Cours - École",
            &["cours", "td", "tp", "examen", "devoir", "exercice", "lecon", "chapitre", "bulletin scolaire", "bac", "brevet", "partiel", "universite", "lycee", "college", "emploi du temps"],
        ),
        theme("Santé", &["ordonnance", "mutuelle", "medecin", "medical", "sante", "vaccin", "ameli", "cpam", "hopital", "radiographie", "analyses de sang", "carte vitale"]),
        theme("Logement", &["bail", "quittance", "loyer", "etat des lieux", "assurance habitation", "electricite", "edf", "engie", "caf", "logement"]),
        theme(
            "Identité",
            &["passeport", "passport", "carte d identite", "carte identite", "cni", "permis", "titre de sejour", "acte de naissance", "livret de famille", "justificatif de domicile"],
        ),
        theme("Voyages", &["billet", "reservation", "booking", "boarding", "carte d embarquement", "embarquement", "hotel", "airbnb", "sncf", "itineraire", "e ticket"]),
    ]
}

/// Minuscules, sans accents, et tout ce qui n'est ni lettre ni chiffre devient une séparation.
/// Lettres et chiffres collés sont séparés (« facture2026 » → « facture 2026 »).
pub fn tokens(text: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut cur = String::new();
    let mut cur_digit = false;
    for ch in text.chars() {
        for c in fold(ch).chars() {
            if c.is_ascii_alphanumeric() {
                let digit = c.is_ascii_digit();
                if !cur.is_empty() && digit != cur_digit {
                    out.push(std::mem::take(&mut cur));
                }
                cur_digit = digit;
                cur.push(c);
            } else if !cur.is_empty() {
                out.push(std::mem::take(&mut cur));
            }
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

/// Une lettre sans accent, en minuscule (les lettres non latines deviennent des séparations).
fn fold(c: char) -> String {
    let lower: String = c.to_lowercase().collect();
    lower
        .chars()
        .map(|c| match c {
            'à' | 'á' | 'â' | 'ã' | 'ä' | 'å' => "a".to_string(),
            'ç' => "c".into(),
            'è' | 'é' | 'ê' | 'ë' => "e".into(),
            'ì' | 'í' | 'î' | 'ï' => "i".into(),
            'ñ' => "n".into(),
            'ò' | 'ó' | 'ô' | 'õ' | 'ö' => "o".into(),
            'ù' | 'ú' | 'û' | 'ü' => "u".into(),
            'ý' | 'ÿ' => "y".into(),
            'œ' => "oe".into(),
            'æ' => "ae".into(),
            c if c.is_ascii() => c.to_string(),
            _ => " ".into(),
        })
        .collect()
}

/// Le mot-clé (déjà découpé) apparaît-il dans les mots du texte ?
fn contains_keyword(words: &[String], kw: &[String]) -> bool {
    if kw.is_empty() || kw.len() > words.len() {
        return false;
    }
    (0..=words.len() - kw.len()).any(|i| {
        kw.iter().enumerate().all(|(j, k)| {
            let w = &words[i + j];
            // Dernier mot du mot-clé : début de mot (pluriels, suffixes) ; mots précédents : identiques.
            if j + 1 == kw.len() {
                w.starts_with(k.as_str())
            } else {
                w == k
            }
        })
    })
}

#[derive(Debug, Clone, PartialEq)]
pub struct ThemeMatch {
    pub theme: String,
    /// Mot-clé trouvé (tel qu'écrit dans le thème).
    pub keyword: String,
    pub source: MatchSource,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MatchSource {
    Name,
    PdfText,
}

impl ThemeMatch {
    pub fn explain(&self) -> String {
        match self.source {
            MatchSource::Name => format!("mot « {} » dans le nom", self.keyword),
            MatchSource::PdfText => format!("mot « {} » dans la 1re page", self.keyword),
        }
    }
}

/// Meilleur thème pour un texte : le plus de mots-clés différents trouvés, puis l'ordre de la liste.
pub fn best_theme(themes: &[Theme], text: &str, source: MatchSource) -> Option<ThemeMatch> {
    let words = tokens(text);
    let mut best: Option<(usize, ThemeMatch)> = None;
    for t in themes {
        if t.name.trim().is_empty() {
            continue;
        }
        let found: Vec<&String> = t.keywords.iter().filter(|k| contains_keyword(&words, &tokens(k))).collect();
        if let Some(first) = found.first() {
            if best.as_ref().map(|(n, _)| found.len() > *n).unwrap_or(true) {
                best = Some((
                    found.len(),
                    ThemeMatch { theme: t.name.trim().to_string(), keyword: first.trim().to_string(), source },
                ));
            }
        }
    }
    best.map(|(_, m)| m)
}

/// Thème d'un fichier : d'abord le nom, puis la 1re page si c'est un PDF et que la lecture est permise.
pub fn classify(themes: &[Theme], path: &Path, file_name: &str, read_pdf: bool) -> Option<ThemeMatch> {
    let stem = match file_name.rfind('.') {
        Some(i) if i > 0 => &file_name[..i],
        _ => file_name,
    };
    if let Some(m) = best_theme(themes, stem, MatchSource::Name) {
        return Some(m);
    }
    if read_pdf && file_name.to_lowercase().ends_with(".pdf") {
        if let Some(text) = pdf_first_page_text(path) {
            return best_theme(themes, &text, MatchSource::PdfText);
        }
    }
    None
}

/// Nom de dossier sûr pour un thème (caractères interdits par Windows retirés).
pub fn folder_name(theme: &str) -> String {
    let cleaned: String = theme
        .chars()
        .map(|c| if "<>:\"/\\|?*".contains(c) || c.is_control() { ' ' } else { c })
        .collect();
    let cleaned = cleaned.trim().trim_end_matches('.').trim().to_string();
    if cleaned.is_empty() {
        OTHER.to_string()
    } else {
        cleaned
    }
}

const MAX_PDF_BYTES: u64 = 40 * 1024 * 1024;
const MAX_TEXT_CHARS: usize = 8000;

/// Texte de la première page d'un PDF, lu localement. `None` si illisible, chiffré, trop gros, scanné
/// (pas de texte) ou trop long à lire. Ne modifie jamais le fichier (lecture seule).
pub fn pdf_first_page_text(path: &Path) -> Option<String> {
    if std::fs::metadata(path).ok()?.len() > MAX_PDF_BYTES {
        return None;
    }
    let path = path.to_path_buf();
    let (tx, rx) = std::sync::mpsc::channel();
    // Fil séparé : un PDF mal formé ne bloque pas l'analyse (abandon après 4 s) et une panique y reste.
    std::thread::spawn(move || {
        let text = std::panic::catch_unwind(|| {
            let bytes = std::fs::read(&path).ok()?;
            let doc = lopdf::Document::load_mem(&bytes).ok()?;
            let first = *doc.get_pages().keys().next()?;
            doc.extract_text(&[first]).ok()
        })
        .ok()
        .flatten();
        let _ = tx.send(text);
    });
    let text = rx.recv_timeout(Duration::from_secs(4)).ok().flatten()?;
    let text: String = text.chars().take(MAX_TEXT_CHARS).collect();
    if text.trim().is_empty() {
        None
    } else {
        Some(text)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decoupage_sans_accents() {
        assert_eq!(tokens("Relevé_Bancaire-Mars2026.PDF"), vec!["releve", "bancaire", "mars", "2026", "pdf"]);
        assert_eq!(tokens("Avis d’impôt 2025"), vec!["avis", "d", "impot", "2025"]);
        assert_eq!(tokens("ŒUVRE"), vec!["oeuvre"]);
    }

    #[test]
    fn mot_cle_en_debut_de_mot() {
        let t = default_themes();
        let m = |s: &str| best_theme(&t, s, MatchSource::Name).map(|m| m.theme);
        assert_eq!(m("Factures_EDF_2026").as_deref(), Some("Factures"));
        assert_eq!(m("RIB-Boursorama").as_deref(), Some("Banque"));
        assert_eq!(m("tribunal"), None, "« rib » ne doit pas trouver « tribunal »");
        assert_eq!(m("Fiche-de-paie_octobre").as_deref(), Some("Travail"));
        assert_eq!(m("fiche horaire"), None, "mot-clé de plusieurs mots : tous les mots");
        assert_eq!(m("ORDONNANCE dr martin").as_deref(), Some("Santé"));
        assert_eq!(m("Avis d'impôt 2025").as_deref(), Some("Impôts"));
        assert_eq!(m("passeport-scan").as_deref(), Some("Identité"));
        assert_eq!(m("Billet_Paris_Lyon").as_deref(), Some("Voyages"));
        assert_eq!(m("IMG_2034"), None);
    }

    #[test]
    fn le_plus_de_mots_cles_l_emporte() {
        let t = default_themes();
        // « contrat » (Travail) contre « bail » + « loyer » (Logement).
        let m = best_theme(&t, "contrat de bail loyer", MatchSource::Name).unwrap();
        assert_eq!(m.theme, "Logement");
        // Égalité : l'ordre de la liste décide (Factures avant Logement).
        let m = best_theme(&t, "facture edf", MatchSource::Name).unwrap();
        assert_eq!(m.theme, "Factures");
    }

    #[test]
    fn noms_de_dossier() {
        assert_eq!(folder_name("Cours / École"), "Cours   École");
        assert_eq!(folder_name("  ...  "), OTHER);
        assert_eq!(folder_name("Impôts."), "Impôts");
    }
}
