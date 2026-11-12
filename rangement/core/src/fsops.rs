//! Opérations de fichiers « sûres » : déplacement qui n'écrase jamais, test « en cours d'utilisation »,
//! choix d'un nom libre, empreinte du contenu.
//!
//! Attention : `std::fs::rename` remplace la destination sous Windows (MOVEFILE_REPLACE_EXISTING).
//! Il n'est donc jamais utilisé ici ; on appelle MoveFileExW sans ce drapeau.

use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::io::{self, Read};
use std::path::{Path, PathBuf};

#[derive(Debug)]
pub enum MoveError {
    /// La destination existe déjà (rien n'a été fait).
    Exists,
    /// Le fichier est ouvert par un autre programme.
    InUse,
    /// Le fichier source n'existe plus.
    NotFound,
    Other(io::Error),
}

impl MoveError {
    pub fn message(&self) -> String {
        match self {
            MoveError::Exists => "un fichier du même nom existe déjà".into(),
            MoveError::InUse => "fichier en cours d'utilisation par un autre programme".into(),
            MoveError::NotFound => "fichier introuvable (déplacé ou supprimé entre-temps)".into(),
            MoveError::Other(e) => e.to_string(),
        }
    }
}

/// Clé de comparaison d'un chemin (Windows ignore les majuscules).
pub fn path_key(p: &Path) -> String {
    let s = p.to_string_lossy().replace('/', "\\");
    let s = s.trim_end_matches('\\').to_string();
    if cfg!(windows) {
        s.to_lowercase()
    } else {
        s
    }
}

pub fn same_path(a: &Path, b: &Path) -> bool {
    path_key(a) == path_key(b)
}

/// « nom.ext », « nom (2).ext », « nom (3).ext »… : premier nom ni présent sur le disque ni déjà réservé.
pub fn free_destination(dir: &Path, file_name: &str, reserved: &HashSet<String>) -> (PathBuf, bool) {
    let taken = |p: &Path| p.symlink_metadata().is_ok() || reserved.contains(&path_key(p));
    let first = dir.join(file_name);
    if !taken(&first) {
        return (first, false);
    }
    let (stem, ext) = match file_name.rfind('.') {
        Some(i) if i > 0 => (&file_name[..i], &file_name[i..]),
        _ => (file_name, ""),
    };
    for n in 2..100_000u32 {
        let candidate = dir.join(format!("{stem} ({n}){ext}"));
        if !taken(&candidate) {
            return (candidate, true);
        }
    }
    // Pratiquement impossible : on garde un nom unique horodaté.
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    (dir.join(format!("{stem} ({stamp}){ext}")), true)
}

/// Vrai si un autre programme a le fichier ouvert (Windows : ouverture exclusive refusée).
#[cfg(windows)]
pub fn is_in_use(path: &Path) -> bool {
    use std::os::windows::fs::OpenOptionsExt;
    match std::fs::OpenOptions::new().read(true).share_mode(0).open(path) {
        Ok(_) => false,
        Err(e) => matches!(e.raw_os_error(), Some(32) | Some(33)),
    }
}

#[cfg(not(windows))]
pub fn is_in_use(_path: &Path) -> bool {
    false
}

/// Déplace `from` vers `to` sans jamais écraser `to`. Crée le dossier parent si besoin.
/// Entre deux volumes, Windows copie puis retire l'original une fois la copie terminée.
pub fn move_no_replace(from: &Path, to: &Path) -> Result<(), MoveError> {
    if from.symlink_metadata().is_err() {
        return Err(MoveError::NotFound);
    }
    if to.symlink_metadata().is_ok() {
        return Err(MoveError::Exists);
    }
    if let Some(parent) = to.parent() {
        std::fs::create_dir_all(parent).map_err(MoveError::Other)?;
    }
    platform_move(from, to)
}

#[cfg(windows)]
fn platform_move(from: &Path, to: &Path) -> Result<(), MoveError> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{MoveFileExW, MOVEFILE_COPY_ALLOWED, MOVEFILE_WRITE_THROUGH};
    let wide = |p: &Path| -> Vec<u16> { p.as_os_str().encode_wide().chain(std::iter::once(0)).collect() };
    let (f, t) = (wide(from), wide(to));
    // Pas de MOVEFILE_REPLACE_EXISTING : l'appel échoue si la destination existe.
    let ok = unsafe { MoveFileExW(f.as_ptr(), t.as_ptr(), MOVEFILE_COPY_ALLOWED | MOVEFILE_WRITE_THROUGH) };
    if ok != 0 {
        return Ok(());
    }
    let e = io::Error::last_os_error();
    Err(match e.raw_os_error() {
        Some(80) | Some(183) => MoveError::Exists,
        Some(32) | Some(33) => MoveError::InUse,
        Some(2) => MoveError::NotFound,
        _ => MoveError::Other(e),
    })
}

#[cfg(not(windows))]
fn platform_move(from: &Path, to: &Path) -> Result<(), MoveError> {
    // Lien physique (échoue si la destination existe) puis retrait de l'ancien nom.
    match std::fs::hard_link(from, to) {
        Ok(()) => std::fs::remove_file(from).map_err(MoveError::Other),
        Err(e) if e.kind() == io::ErrorKind::AlreadyExists => Err(MoveError::Exists),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Err(MoveError::NotFound),
        Err(e) if e.raw_os_error() == Some(18) => {
            // Autre volume : copie dans un nouveau fichier (création exclusive), vérification, puis retrait.
            let mut src = std::fs::File::open(from).map_err(MoveError::Other)?;
            let mut dst = std::fs::OpenOptions::new().write(true).create_new(true).open(to).map_err(|e| {
                if e.kind() == io::ErrorKind::AlreadyExists {
                    MoveError::Exists
                } else {
                    MoveError::Other(e)
                }
            })?;
            io::copy(&mut src, &mut dst).map_err(MoveError::Other)?;
            dst.sync_all().map_err(MoveError::Other)?;
            if hash_file(from).ok() != hash_file(to).ok() {
                return Err(MoveError::Other(io::Error::other("copie incomplète")));
            }
            std::fs::remove_file(from).map_err(MoveError::Other)
        }
        Err(e) => Err(MoveError::Other(e)),
    }
}

/// Empreinte SHA-256 du contenu.
pub fn hash_file(path: &Path) -> io::Result<String> {
    let mut f = std::fs::File::open(path)?;
    let mut h = Sha256::new();
    let mut buf = vec![0u8; 1 << 16];
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    Ok(hex::encode(h.finalize()))
}

/// Millisecondes depuis 1970 (pour comparer une date de modification avec l'aperçu).
pub fn millis(t: std::time::SystemTime) -> i64 {
    match t.duration_since(std::time::UNIX_EPOCH) {
        Ok(d) => d.as_millis() as i64,
        Err(e) => -(e.duration().as_millis() as i64),
    }
}
