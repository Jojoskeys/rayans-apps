//! Chiffrement de l'archive.
//!
//! Une clé maîtresse de 32 octets, tirée au hasard à la première ouverture, est protégée par DPAPI
//! (`CryptProtectData`, portée « utilisateur ») : seul ton compte Windows peut la relire, sans mot de passe
//! à saisir. Deux clés en dérivent :
//! - une clé XChaCha20-Poly1305 qui chiffre chaque contenu (texte, auteur, chemin, titre…) avec un nonce
//!   aléatoire de 24 octets : un contenu modifié ou corrompu est refusé à la lecture ;
//! - une clé HMAC-SHA-256 qui calcule les « étiquettes » de recherche : la base ne contient que des
//!   empreintes des mots, jamais les mots eux-mêmes.
//!
//! Les fichiers (sources brutes, pièces jointes) sont chiffrés par blocs de 1 Mio (format `RJF1`) : chaque
//! bloc a son propre nonce et le dernier est marqué, ce qui détecte un fichier tronqué.

use crate::error::{Erreur, Resultat};
use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::io::{Read, Write};
use std::path::Path;

type HmacSha256 = Hmac<Sha256>;

const ENTETE_FICHIER: &[u8; 4] = b"RJF1";
const BLOC: usize = 1 << 20;

pub struct Cles {
    chiffre: XChaCha20Poly1305,
    index: [u8; 32],
}

fn derive(maitre: &[u8; 32], usage: &str) -> [u8; 32] {
    let mut mac = <HmacSha256 as Mac>::new_from_slice(maitre).expect("clé HMAC");
    mac.update(b"rayans-journal/");
    mac.update(usage.as_bytes());
    mac.finalize().into_bytes().into()
}

pub fn aleatoire<const N: usize>() -> [u8; N] {
    let mut b = [0u8; N];
    getrandom::fill(&mut b).expect("générateur aléatoire du système");
    b
}

impl Cles {
    pub fn depuis_maitre(maitre: &[u8; 32]) -> Self {
        let k = derive(maitre, "chiffrement");
        Cles { chiffre: XChaCha20Poly1305::new((&k).into()), index: derive(maitre, "index") }
    }

    /// Chiffre `clair` : renvoie nonce (24 octets) || texte chiffré || étiquette (16 octets).
    pub fn sceller(&self, clair: &[u8]) -> Vec<u8> {
        let nonce: [u8; 24] = aleatoire();
        let ct = self.chiffre.encrypt(XNonce::from_slice(&nonce), clair).expect("chiffrement");
        let mut out = Vec::with_capacity(24 + ct.len());
        out.extend_from_slice(&nonce);
        out.extend_from_slice(&ct);
        out
    }

    pub fn sceller_texte(&self, t: &str) -> Vec<u8> {
        self.sceller(t.as_bytes())
    }

    pub fn ouvrir(&self, scelle: &[u8]) -> Resultat<Vec<u8>> {
        if scelle.len() < 24 + 16 {
            return Err(Erreur::Chiffrement("contenu chiffré trop court".into()));
        }
        self.chiffre
            .decrypt(XNonce::from_slice(&scelle[..24]), &scelle[24..])
            .map_err(|_| Erreur::Chiffrement("contenu illisible (clé différente ou données abîmées)".into()))
    }

    pub fn ouvrir_texte(&self, scelle: &[u8]) -> Resultat<String> {
        String::from_utf8(self.ouvrir(scelle)?).map_err(|_| Erreur::Chiffrement("texte non UTF-8".into()))
    }

    /// Empreinte de recherche (16 octets) d'une valeur dans un domaine (« mot », « appli », « conv »…).
    pub fn etiquette(&self, domaine: &str, valeur: &str) -> Vec<u8> {
        let mut mac = <HmacSha256 as Mac>::new_from_slice(&self.index).expect("clé HMAC");
        mac.update(domaine.as_bytes());
        mac.update(&[0]);
        mac.update(valeur.as_bytes());
        mac.finalize().into_bytes()[..16].to_vec()
    }

    /// Chiffre un flux par blocs. Renvoie le nombre d'octets en clair.
    pub fn sceller_flux(&self, src: &mut impl Read, dst: &mut impl Write) -> Resultat<u64> {
        let prefixe: [u8; 16] = aleatoire();
        dst.write_all(ENTETE_FICHIER)?;
        dst.write_all(&prefixe)?;
        let mut total = 0u64;
        let mut compteur = 0u64;
        let mut courant = lire_bloc(src)?;
        loop {
            let suivant = if courant.len() == BLOC { lire_bloc(src)? } else { Vec::new() };
            let dernier = suivant.is_empty();
            let nonce = nonce_bloc(&prefixe, compteur);
            let ct = self
                .chiffre
                .encrypt(XNonce::from_slice(&nonce), Payload { msg: &courant, aad: &[dernier as u8] })
                .expect("chiffrement");
            dst.write_all(&(ct.len() as u32).to_le_bytes())?;
            dst.write_all(&ct)?;
            total += courant.len() as u64;
            compteur += 1;
            if dernier {
                break;
            }
            courant = suivant;
        }
        Ok(total)
    }

    pub fn ouvrir_flux(&self, src: &mut impl Read, dst: &mut impl Write) -> Resultat<u64> {
        let mut entete = [0u8; 20];
        src.read_exact(&mut entete)?;
        if &entete[..4] != ENTETE_FICHIER {
            return Err(Erreur::Chiffrement("fichier chiffré inconnu".into()));
        }
        let prefixe: [u8; 16] = entete[4..].try_into().unwrap();
        let mut compteur = 0u64;
        let mut total = 0u64;
        loop {
            let mut l = [0u8; 4];
            if src.read_exact(&mut l).is_err() {
                return Err(Erreur::Chiffrement("fichier chiffré tronqué".into()));
            }
            let mut ct = vec![0u8; u32::from_le_bytes(l) as usize];
            src.read_exact(&mut ct)?;
            let nonce = nonce_bloc(&prefixe, compteur);
            let mut fini = false;
            let clair = match self.chiffre.decrypt(XNonce::from_slice(&nonce), Payload { msg: &ct, aad: &[0] }) {
                Ok(c) => c,
                Err(_) => {
                    fini = true;
                    self.chiffre
                        .decrypt(XNonce::from_slice(&nonce), Payload { msg: &ct, aad: &[1] })
                        .map_err(|_| Erreur::Chiffrement("bloc chiffré illisible".into()))?
                }
            };
            dst.write_all(&clair)?;
            total += clair.len() as u64;
            compteur += 1;
            if fini {
                return Ok(total);
            }
        }
    }

    pub fn sceller_fichier(&self, clair: &[u8], dest: &Path) -> Resultat<()> {
        if let Some(p) = dest.parent() {
            std::fs::create_dir_all(p)?;
        }
        let tmp = dest.with_extension("tmp");
        {
            let mut f = std::io::BufWriter::new(std::fs::File::create(&tmp)?);
            self.sceller_flux(&mut &clair[..], &mut f)?;
            f.flush()?;
        }
        std::fs::rename(&tmp, dest)?;
        Ok(())
    }

    pub fn ouvrir_fichier(&self, chemin: &Path) -> Resultat<Vec<u8>> {
        let mut f = std::io::BufReader::new(std::fs::File::open(chemin)?);
        let mut out = Vec::new();
        self.ouvrir_flux(&mut f, &mut out)?;
        Ok(out)
    }
}

fn nonce_bloc(prefixe: &[u8; 16], compteur: u64) -> [u8; 24] {
    let mut n = [0u8; 24];
    n[..16].copy_from_slice(prefixe);
    n[16..].copy_from_slice(&compteur.to_le_bytes());
    n
}

fn lire_bloc(src: &mut impl Read) -> Resultat<Vec<u8>> {
    let mut buf = vec![0u8; BLOC];
    let mut n = 0;
    while n < BLOC {
        let r = src.read(&mut buf[n..])?;
        if r == 0 {
            break;
        }
        n += r;
    }
    buf.truncate(n);
    Ok(buf)
}

/// Charge la clé maîtresse protégée par DPAPI, ou en crée une. Le fichier `cle.dpapi` ne sert qu'à ce
/// compte Windows sur ce PC : une sauvegarde de l'archive doit être restaurée sur la même session,
/// ou exportée au format lisible.
pub fn charger_ou_creer_cle(dossier: &Path) -> Resultat<[u8; 32]> {
    let chemin = dossier.join("cle.dpapi");
    if chemin.exists() {
        let protege = std::fs::read(&chemin)?;
        let clair = dpapi::deproteger(&protege)?;
        return clair
            .try_into()
            .map_err(|_| Erreur::Chiffrement("cle.dpapi n'a pas la bonne taille".into()));
    }
    std::fs::create_dir_all(dossier)?;
    let cle: [u8; 32] = aleatoire();
    let protege = dpapi::proteger(&cle)?;
    let tmp = chemin.with_extension("tmp");
    std::fs::write(&tmp, protege)?;
    std::fs::rename(&tmp, &chemin)?;
    Ok(cle)
}

#[cfg(windows)]
mod dpapi {
    use crate::error::{Erreur, Resultat};
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    const ENTROPIE: &[u8] = b"Rayan's Journal";

    fn blob(d: &[u8]) -> CRYPT_INTEGER_BLOB {
        CRYPT_INTEGER_BLOB { cbData: d.len() as u32, pbData: d.as_ptr() as *mut u8 }
    }

    unsafe fn prendre(b: CRYPT_INTEGER_BLOB) -> Vec<u8> {
        let v = std::slice::from_raw_parts(b.pbData, b.cbData as usize).to_vec();
        LocalFree(b.pbData as _);
        v
    }

    pub fn proteger(d: &[u8]) -> Resultat<Vec<u8>> {
        let entree = blob(d);
        let entropie = blob(ENTROPIE);
        let mut sortie = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
        let ok = unsafe {
            CryptProtectData(&entree, std::ptr::null(), &entropie, std::ptr::null(), std::ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut sortie)
        };
        if ok == 0 {
            return Err(Erreur::Chiffrement("Windows a refusé de protéger la clé (DPAPI)".into()));
        }
        Ok(unsafe { prendre(sortie) })
    }

    pub fn deproteger(d: &[u8]) -> Resultat<Vec<u8>> {
        let entree = blob(d);
        let entropie = blob(ENTROPIE);
        let mut sortie = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
        let ok = unsafe {
            CryptUnprotectData(&entree, std::ptr::null_mut(), &entropie, std::ptr::null(), std::ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut sortie)
        };
        if ok == 0 {
            return Err(Erreur::Chiffrement(
                "la clé de l'archive ne peut être relue que par le compte Windows qui l'a créée".into(),
            ));
        }
        Ok(unsafe { prendre(sortie) })
    }
}

#[cfg(not(windows))]
mod dpapi {
    use crate::error::{Erreur, Resultat};
    pub fn proteger(_: &[u8]) -> Resultat<Vec<u8>> {
        Err(Erreur::Chiffrement("protection de clé disponible seulement sous Windows".into()))
    }
    pub fn deproteger(_: &[u8]) -> Resultat<Vec<u8>> {
        Err(Erreur::Chiffrement("protection de clé disponible seulement sous Windows".into()))
    }
}
