//! Accès uniforme au contenu d'un export : dossier, ZIP ou fichier seul. Les chemins utilisent `/`.

use crate::error::{Erreur, Resultat};
use std::cell::RefCell;
use std::io::Read;
use std::path::{Path, PathBuf};

pub trait Paquet {
    fn noms(&self) -> Vec<String>;
    fn lire(&self, nom: &str) -> Resultat<Vec<u8>>;
    fn existe(&self, nom: &str) -> bool {
        self.noms().iter().any(|n| n == nom)
    }
}

pub struct Dossier {
    racine: PathBuf,
    noms: Vec<String>,
}

impl Dossier {
    pub fn ouvrir(racine: &Path) -> Resultat<Self> {
        let mut noms = Vec::new();
        let mut pile = vec![racine.to_path_buf()];
        while let Some(d) = pile.pop() {
            for e in std::fs::read_dir(&d)? {
                let e = e?;
                let p = e.path();
                if e.file_type()?.is_dir() {
                    pile.push(p);
                } else if let Ok(rel) = p.strip_prefix(racine) {
                    noms.push(rel.to_string_lossy().replace('\\', "/"));
                }
            }
        }
        noms.sort();
        Ok(Dossier { racine: racine.to_path_buf(), noms })
    }
}

impl Paquet for Dossier {
    fn noms(&self) -> Vec<String> {
        self.noms.clone()
    }
    fn lire(&self, nom: &str) -> Resultat<Vec<u8>> {
        if nom.split('/').any(|p| p == "..") {
            return Err(Erreur::Format("chemin refusé".into()));
        }
        Ok(std::fs::read(self.racine.join(nom))?)
    }
}

pub struct Zip {
    archive: RefCell<zip::ZipArchive<std::fs::File>>,
    noms: Vec<String>,
}

impl Zip {
    pub fn ouvrir(chemin: &Path) -> Resultat<Self> {
        let archive = zip::ZipArchive::new(std::fs::File::open(chemin)?)?;
        let noms = archive.file_names().filter(|n| !n.ends_with('/')).map(String::from).collect();
        Ok(Zip { archive: RefCell::new(archive), noms })
    }
}

impl Paquet for Zip {
    fn noms(&self) -> Vec<String> {
        self.noms.clone()
    }
    fn lire(&self, nom: &str) -> Resultat<Vec<u8>> {
        let mut a = self.archive.borrow_mut();
        let mut f = a.by_name(nom)?;
        let mut v = Vec::with_capacity(f.size() as usize);
        f.read_to_end(&mut v)?;
        Ok(v)
    }
}

/// Un seul fichier (ex. « Discussion WhatsApp avec Léa.txt » ou « result.json »).
pub struct Fichier {
    chemin: PathBuf,
    nom: String,
}

impl Paquet for Fichier {
    fn noms(&self) -> Vec<String> {
        vec![self.nom.clone()]
    }
    fn lire(&self, nom: &str) -> Resultat<Vec<u8>> {
        if nom != self.nom {
            return Err(Erreur::Format(format!("« {nom} » n'est pas dans ce fichier")));
        }
        Ok(std::fs::read(&self.chemin)?)
    }
}

/// Paquet en mémoire (tests, données fictives).
pub struct Memoire(pub Vec<(String, Vec<u8>)>);

impl Paquet for Memoire {
    fn noms(&self) -> Vec<String> {
        self.0.iter().map(|(n, _)| n.clone()).collect()
    }
    fn lire(&self, nom: &str) -> Resultat<Vec<u8>> {
        self.0
            .iter()
            .find(|(n, _)| n == nom)
            .map(|(_, b)| b.clone())
            .ok_or_else(|| Erreur::Format(format!("« {nom} » absent")))
    }
}

pub fn ouvrir(chemin: &Path) -> Resultat<Box<dyn Paquet>> {
    if chemin.is_dir() {
        return Ok(Box::new(Dossier::ouvrir(chemin)?));
    }
    let ext = chemin.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    if ext == "zip" {
        return Ok(Box::new(Zip::ouvrir(chemin)?));
    }
    let nom = chemin.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    Ok(Box::new(Fichier { chemin: chemin.to_path_buf(), nom }))
}

/// Retrouve un fichier du paquet à partir d'un chemin relatif à un autre (ex. « photos/1.jpg » cité par
/// « Export/result.json »), en tolérant les séparateurs Windows.
pub fn resoudre(p: &dyn Paquet, base: &str, relatif: &str) -> Option<String> {
    let rel = relatif.replace('\\', "/");
    let dossier = base.rfind('/').map(|i| &base[..=i]).unwrap_or("");
    let candidat = format!("{dossier}{rel}");
    let noms = p.noms();
    if noms.contains(&candidat) {
        return Some(candidat);
    }
    if noms.contains(&rel) {
        return Some(rel);
    }
    noms.into_iter().find(|n| n.ends_with(&format!("/{rel}")))
}
