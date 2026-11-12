//! Extraction sûre d'une archive ZIP : toute entrée qui sortirait du dossier cible fait refuser l'archive
//! entière (rien n'est ignoré en silence), les liens symboliques sont refusés, la taille est bornée.

use crate::catalog::normalize_relative_path;
use crate::error::{Error, Result};
use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

pub const MAX_ENTRIES: usize = 200_000;
pub const MAX_TOTAL_BYTES: u64 = 16 * 1024 * 1024 * 1024;

/// Contrôle un nom d'entrée et renvoie le chemin relatif sûr (`None` pour la racine).
pub fn safe_entry_path(name: &str) -> Result<Option<PathBuf>> {
    let unsafe_ = |why: &str| Error::UnsafeArchive(format!("l'entrée « {name} » {why}"));
    if name.starts_with('/') || name.starts_with('\\') {
        return Err(unsafe_("est un chemin absolu"));
    }
    if name.len() >= 2 && name.as_bytes()[1] == b':' {
        return Err(unsafe_("désigne un lecteur Windows"));
    }
    for comp in name.split(['/', '\\']) {
        if comp == ".." {
            return Err(unsafe_("sort du dossier d'installation (« .. »)"));
        }
        if comp.contains(':') || comp.contains('\0') {
            return Err(unsafe_("contient un caractère interdit"));
        }
    }
    match normalize_relative_path(name) {
        Ok(rel) => Ok(Some(rel.split('/').collect())),
        Err(_) => Ok(None), // entrée « ./ » ou vide : la racine
    }
}

/// Extrait `zip_path` dans `dest` (qui doit être vide ou inexistant).
pub fn extract_zip(zip_path: &Path, dest: &Path, mut on_progress: impl FnMut(u64, u64)) -> Result<()> {
    let file = std::fs::File::open(zip_path)?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|e| Error::BadArchive(format!("ce n'est pas un ZIP valide ({e})")))?;
    if zip.len() > MAX_ENTRIES {
        return Err(Error::UnsafeArchive(format!("plus de {MAX_ENTRIES} fichiers")));
    }
    // Premier passage : contrôle de tous les noms avant d'écrire quoi que ce soit.
    let mut declared: u64 = 0;
    for i in 0..zip.len() {
        let entry = zip
            .by_index_raw(i)
            .map_err(|e| Error::BadArchive(format!("entrée n°{i} illisible ({e})")))?;
        safe_entry_path(entry.name())?;
        if entry.is_symlink() {
            return Err(Error::UnsafeArchive(format!(
                "l'entrée « {} » est un lien symbolique",
                entry.name()
            )));
        }
        declared = declared.saturating_add(entry.size());
    }
    if declared > MAX_TOTAL_BYTES {
        return Err(Error::UnsafeArchive("taille décompressée excessive".into()));
    }

    std::fs::create_dir_all(dest)?;
    let mut written: u64 = 0;
    let mut buf = vec![0u8; 1 << 16];
    for i in 0..zip.len() {
        let mut entry = zip
            .by_index(i)
            .map_err(|e| Error::BadArchive(format!("entrée n°{i} illisible ({e})")))?;
        let Some(rel) = safe_entry_path(entry.name())? else { continue };
        let out = dest.join(&rel);
        if entry.is_dir() {
            std::fs::create_dir_all(&out)?;
            continue;
        }
        if let Some(parent) = out.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut f = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&out)
            .map_err(|e| {
                if e.kind() == std::io::ErrorKind::AlreadyExists {
                    Error::UnsafeArchive(format!("l'entrée « {} » apparaît deux fois", entry.name()))
                } else {
                    e.into()
                }
            })?;
        loop {
            let n = entry
                .read(&mut buf)
                .map_err(|e| Error::BadArchive(format!("« {} » est corrompu ({e})", entry.name())))?;
            if n == 0 {
                break;
            }
            written += n as u64;
            if written > MAX_TOTAL_BYTES || written > declared.saturating_add(1) {
                return Err(Error::UnsafeArchive(
                    "le contenu dépasse la taille annoncée par l'archive".into(),
                ));
            }
            f.write_all(&buf[..n])?;
        }
        f.sync_all()?;
        #[cfg(unix)]
        if let Some(mode) = entry.unix_mode() {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&out, std::fs::Permissions::from_mode(mode & 0o755));
        }
        on_progress(written, declared);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    fn make_zip(path: &Path, entries: &[(&str, &[u8])]) {
        let f = std::fs::File::create(path).unwrap();
        let mut w = zip::ZipWriter::new(f);
        for (name, data) in entries {
            w.start_file(*name, SimpleFileOptions::default()).unwrap();
            w.write_all(data).unwrap();
        }
        w.finish().unwrap();
    }

    #[test]
    fn extrait_une_archive_saine() {
        let t = tempfile::tempdir().unwrap();
        let z = t.path().join("a.zip");
        make_zip(&z, &[("bin/app", b"x"), ("lisez-moi.txt", b"y")]);
        extract_zip(&z, &t.path().join("out"), |_, _| {}).unwrap();
        assert!(t.path().join("out/bin/app").is_file());
    }

    #[test]
    fn refuse_les_chemins_qui_sortent() {
        for bad in ["../evil.txt", "a/../../evil.txt", "/etc/evil", "C:/evil.txt", "..\\evil.txt", "a/b:c"] {
            let t = tempfile::tempdir().unwrap();
            let z = t.path().join("a.zip");
            make_zip(&z, &[("ok.txt", b"1"), (bad, b"2")]);
            let out = t.path().join("out");
            let r = extract_zip(&z, &out, |_, _| {});
            assert!(matches!(r, Err(Error::UnsafeArchive(_))), "{bad}: {r:?}");
            assert!(!out.exists(), "rien ne doit être écrit pour {bad}");
            assert!(!t.path().join("evil.txt").exists());
        }
    }

    #[test]
    fn refuse_un_fichier_qui_n_est_pas_un_zip() {
        let t = tempfile::tempdir().unwrap();
        let z = t.path().join("a.zip");
        std::fs::write(&z, b"pas un zip").unwrap();
        assert!(matches!(
            extract_zip(&z, &t.path().join("o"), |_, _| {}),
            Err(Error::BadArchive(_))
        ));
    }
}
