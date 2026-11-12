//! Moteur de règles : une règle correspond si *toutes* ses conditions renseignées sont vraies
//! (extension ET nom ET âge ET taille ET dossier). La première règle active qui correspond l'emporte.

use crate::config::Rule;
use crate::fsops::same_path;
use std::path::Path;
use std::time::{Duration, SystemTime};

/// Ce que le moteur sait d'un fichier.
#[derive(Debug, Clone)]
pub struct FileFacts {
    pub name: String,
    /// Extension en minuscules, sans point (« » s'il n'y en a pas).
    pub ext: String,
    pub size: u64,
    pub modified: SystemTime,
}

impl FileFacts {
    pub fn new(name: &str, size: u64, modified: SystemTime) -> FileFacts {
        FileFacts { name: name.to_string(), ext: extension_of(name), size, modified }
    }
}

pub fn extension_of(name: &str) -> String {
    match name.rfind('.') {
        Some(i) if i > 0 && i + 1 < name.len() => name[i + 1..].to_lowercase(),
        _ => String::new(),
    }
}

fn normalize_ext(e: &str) -> String {
    e.trim().trim_start_matches('.').to_lowercase()
}

const DAY: u64 = 24 * 60 * 60;

impl Rule {
    /// `folder` : dossier surveillé dans lequel se trouve le fichier.
    pub fn matches(&self, f: &FileFacts, folder: &Path, now: SystemTime) -> bool {
        if !self.enabled {
            return false;
        }
        if !self.folders.is_empty() && !self.folders.iter().any(|d| same_path(d, folder)) {
            return false;
        }
        let exts: Vec<String> = self.extensions.iter().map(|e| normalize_ext(e)).filter(|e| !e.is_empty()).collect();
        if !exts.is_empty() && !exts.contains(&f.ext) {
            return false;
        }
        let patterns: Vec<&str> = self.name_pattern.split(';').map(str::trim).filter(|p| !p.is_empty()).collect();
        if !patterns.is_empty() && !patterns.iter().any(|p| glob_match(p, &f.name)) {
            return false;
        }
        if let Some(days) = self.older_than_days {
            // Date dans le futur (horloge décalée) : âge nul, donc jamais « plus vieux que ».
            let age = now.duration_since(f.modified).unwrap_or(Duration::ZERO);
            if age < Duration::from_secs(days as u64 * DAY) {
                return false;
            }
        }
        if self.min_size.is_some_and(|m| f.size < m) {
            return false;
        }
        if self.max_size.is_some_and(|m| f.size > m) {
            return false;
        }
        true
    }
}

pub fn first_match<'a>(rules: &'a [Rule], f: &FileFacts, folder: &Path, now: SystemTime) -> Option<&'a Rule> {
    rules.iter().find(|r| r.matches(f, folder, now))
}

/// Modèle de nom façon Windows : `*` = n'importe quelle suite, `?` = un caractère. Sans tenir compte des majuscules.
pub fn glob_match(pattern: &str, text: &str) -> bool {
    let p: Vec<char> = pattern.to_lowercase().chars().collect();
    let t: Vec<char> = text.to_lowercase().chars().collect();
    let (mut pi, mut ti) = (0usize, 0usize);
    let mut star: Option<usize> = None;
    let mut mark = 0usize;
    while ti < t.len() {
        if pi < p.len() && (p[pi] == '?' || p[pi] == t[ti]) {
            pi += 1;
            ti += 1;
        } else if pi < p.len() && p[pi] == '*' {
            star = Some(pi);
            mark = ti;
            pi += 1;
        } else if let Some(s) = star {
            pi = s + 1;
            mark += 1;
            ti = mark;
        } else {
            return false;
        }
    }
    while pi < p.len() && p[pi] == '*' {
        pi += 1;
    }
    pi == p.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn glob() {
        assert!(glob_match("*.pdf", "Rapport.PDF"));
        assert!(glob_match("facture*", "Facture-2026.pdf"));
        assert!(glob_match("img_????.jpg", "IMG_1234.jpg"));
        assert!(!glob_match("img_????.jpg", "IMG_12345.jpg"));
        assert!(glob_match("*", ""));
        assert!(glob_match("a*b*c", "axxbyyc"));
        assert!(!glob_match("a*b*c", "axxbyy"));
        assert!(glob_match("*capture d*écran*", "Capture d’écran"));
    }

    #[test]
    fn extensions() {
        assert_eq!(extension_of("a.tar.gz"), "gz");
        assert_eq!(extension_of(".gitignore"), "");
        assert_eq!(extension_of("sans"), "");
        assert_eq!(extension_of("fin."), "");
        assert_eq!(extension_of("Photo.JPG"), "jpg");
    }
}
