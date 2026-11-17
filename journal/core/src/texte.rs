//! Texte : mots pour la recherche (sans accents ni majuscules) et masquage des secrets dans le journal.

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use unicode_normalization::char::is_combining_mark;
use unicode_normalization::UnicodeNormalization;

/// Minuscules, sans accents.
pub fn normaliser(s: &str) -> String {
    s.nfd().filter(|c| !is_combining_mark(*c)).flat_map(char::to_lowercase).collect()
}

/// Mots d'un texte normalisé : suites de lettres et chiffres ; chaque emoji ou symbole compte comme un mot.
pub fn mots(s: &str) -> Vec<String> {
    let n = normaliser(s);
    let mut out = Vec::new();
    let mut cur = String::new();
    for c in n.chars() {
        if c.is_alphanumeric() {
            cur.push(c);
        } else {
            if !cur.is_empty() {
                out.push(std::mem::take(&mut cur));
            }
            let symbole = !c.is_whitespace() && !c.is_ascii_punctuation() && !c.is_control() && !is_ponctuation(c);
            if symbole && !matches!(c, '\u{200d}' | '\u{fe0f}' | '\u{200e}' | '\u{200f}') {
                out.push(c.to_string());
            }
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

fn is_ponctuation(c: char) -> bool {
    matches!(c, '«' | '»' | '…' | '’' | '‘' | '“' | '”' | '–' | '—' | '\u{a0}' | '\u{202f}' | '•' | '·' | '¿' | '¡')
}

pub const PREFIXE_MAX: usize = 20;

/// Termes indexés pour un mot : ses préfixes de 3 à 20 caractères (le mot entier s'il est plus court).
pub fn termes_index(mot: &str) -> Vec<String> {
    let c: Vec<char> = mot.chars().collect();
    if c.len() < 3 {
        return vec![mot.to_string()];
    }
    (3..=c.len().min(PREFIXE_MAX)).map(|n| c[..n].iter().collect()).collect()
}

/// Terme cherché pour un mot de la requête.
pub fn terme_requete(mot: &str) -> String {
    mot.chars().take(PREFIXE_MAX).collect()
}

/// Vrai si chaque mot de la requête commence un mot du texte (vérification après déchiffrement).
pub fn correspond(texte: &str, requete: &str) -> bool {
    let m = mots(texte);
    mots(requete).iter().all(|q| m.iter().any(|w| w.starts_with(q.as_str())))
}

// ---------------------------------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct ReglesSecrets {
    /// Programmes dont on ne garde que le nom (jamais le titre de fenêtre).
    pub applis_exclues: Vec<String>,
    /// Mots qui font masquer tout le titre.
    pub mots_sensibles: Vec<String>,
    /// Modèles de noms de fichiers masqués (`*` et `?`).
    pub fichiers_sensibles: Vec<String>,
    /// « complet » ou « appli » (seulement le nom du programme pour toutes les fenêtres).
    pub titres: String,
}

impl Default for ReglesSecrets {
    fn default() -> Self {
        let v = |l: &[&str]| l.iter().map(|s| s.to_string()).collect();
        ReglesSecrets {
            applis_exclues: v(&[
                "keepass.exe", "keepassxc.exe", "1password.exe", "bitwarden.exe", "dashlane.exe", "lastpass.exe",
                "nordpass.exe", "proton pass.exe", "authy desktop.exe", "credentialuibroker.exe", "logonui.exe",
                "consent.exe", "lockapp.exe",
            ]),
            mots_sensibles: v(&[
                "mot de passe", "password", "passcode", "code de vérification", "verification code",
                "code de sécurité", "security code", "otp", "2fa", "double authentification", "two-factor",
                "authenticator", "inprivate", "navigation privée", "fenêtre privée", "incognito",
                "private browsing", "seed phrase", "phrase de récupération", "clé privée", "private key",
            ]),
            fichiers_sensibles: v(&[
                "*.kdbx", "*.kdb", "*.pem", "*.key", "*.pfx", "*.p12", "*.ppk", "id_rsa*", "id_ed25519*",
                "id_ecdsa*", ".env", "*.env", ".env.*", "*credentials*", "*secret*", "*.gpg", "*.asc",
                "wallet.dat", "*.keystore", "*.jks",
            ]),
            titres: "complet".into(),
        }
    }
}

pub const TITRE_MASQUE: &str = "[titre masqué]";
pub const FICHIER_MASQUE: &str = "[fichier sensible]";

fn re_codes() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    // 6 à 8 chiffres isolés (codes à usage unique), éventuellement coupés « 123 456 ».
    R.get_or_init(|| Regex::new(r"(?:^|[^\d])(\d{3}[ \-]?\d{3}|\d{6,8})(?:[^\d]|$)").unwrap())
}

fn re_jetons() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    // Longues suites sans espace qui ressemblent à une clé ou un jeton (au moins 24 caractères, chiffres et lettres mêlés).
    R.get_or_init(|| Regex::new(r"[A-Za-z0-9_\-+/=]{24,}").unwrap())
}

impl ReglesSecrets {
    pub fn appli_exclue(&self, appli: &str) -> bool {
        let a = appli.to_lowercase();
        self.applis_exclues.iter().any(|x| x.to_lowercase() == a)
    }

    /// Titre de fenêtre tel qu'il sera enregistré, ou `None` si rien ne doit être gardé du titre.
    pub fn filtrer_titre(&self, appli: &str, titre: &str) -> Option<String> {
        if titre.trim().is_empty() {
            return Some(String::new());
        }
        if self.titres == "appli" || self.appli_exclue(appli) {
            return None;
        }
        let n = normaliser(titre);
        if self.mots_sensibles.iter().any(|m| contient_mot(&n, &normaliser(m))) {
            return None;
        }
        let mut t = re_jetons()
            .replace_all(titre, |c: &regex::Captures| {
                let s = &c[0];
                let chiffres = s.chars().any(|c| c.is_ascii_digit());
                let lettres = s.chars().any(|c| c.is_ascii_alphabetic());
                if chiffres && lettres { "[jeton masqué]".to_string() } else { s.to_string() }
            })
            .into_owned();
        // Codes à 6-8 chiffres : remplacés en gardant ce qui les entoure.
        loop {
            let Some(m) = re_codes().captures(&t).and_then(|c| c.get(1)) else { break };
            t.replace_range(m.range(), "••••••");
        }
        Some(t)
    }

    pub fn fichier_sensible(&self, nom: &str) -> bool {
        let n = nom.to_lowercase();
        self.fichiers_sensibles.iter().any(|m| joker(&m.to_lowercase(), &n))
    }

    /// Chemin tel qu'il sera enregistré : le nom d'un fichier sensible est remplacé, le dossier est gardé.
    /// Un dossier sensible (ex. « secrets ») masque aussi tout ce qu'il contient.
    pub fn filtrer_chemin(&self, chemin: &str) -> String {
        let mut out = String::new();
        for part in chemin.split_inclusive(['\\', '/']) {
            let p = part.trim_end_matches(['\\', '/']);
            if !p.is_empty() && !p.ends_with(':') && self.fichier_sensible(p) {
                out.push_str(FICHIER_MASQUE);
                return out;
            }
            out.push_str(part);
        }
        out
    }
}

fn contient_mot(texte: &str, mot: &str) -> bool {
    let mut debut = 0;
    while let Some(i) = texte[debut..].find(mot) {
        let a = debut + i;
        let b = a + mot.len();
        let avant = texte[..a].chars().next_back().is_none_or(|c| !c.is_alphanumeric());
        let apres = texte[b..].chars().next().is_none_or(|c| !c.is_alphanumeric());
        if avant && apres {
            return true;
        }
        debut = a + mot.len().max(1);
    }
    false
}

/// `*` = n'importe quelle suite, `?` = un caractère.
pub fn joker(modele: &str, nom: &str) -> bool {
    let m: Vec<char> = modele.chars().collect();
    let n: Vec<char> = nom.chars().collect();
    let (mut i, mut j, mut etoile, mut reprise) = (0, 0, None::<usize>, 0);
    while j < n.len() {
        if i < m.len() && (m[i] == '?' || m[i] == n[j]) {
            i += 1;
            j += 1;
        } else if i < m.len() && m[i] == '*' {
            etoile = Some(i);
            reprise = j;
            i += 1;
        } else if let Some(e) = etoile {
            i = e + 1;
            reprise += 1;
            j = reprise;
        } else {
            return false;
        }
    }
    while i < m.len() && m[i] == '*' {
        i += 1;
    }
    i == m.len()
}
