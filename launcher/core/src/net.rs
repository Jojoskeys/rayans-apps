//! Accès réseau : client HTTP (redirections vers http:// refusées en distribution), lecture file:// en
//! mode développement, téléchargement en flux avec calcul de l'empreinte au fil de l'eau.

use crate::catalog::TrustPolicy;
use crate::error::{Error, Result};
use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use std::path::Path;
use std::time::Duration;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use url::Url;

pub fn client(policy: &TrustPolicy) -> reqwest::Client {
    let https_only = !policy.is_dev();
    let redirect = reqwest::redirect::Policy::custom(move |attempt| {
        if attempt.previous().len() >= 5 {
            attempt.error("trop de redirections")
        } else if https_only && attempt.url().scheme() != "https" {
            attempt.error("redirection vers une adresse non HTTPS refusée")
        } else {
            attempt.follow()
        }
    });
    reqwest::Client::builder()
        .user_agent(concat!("RayansLauncher/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(15))
        .read_timeout(Duration::from_secs(60))
        .redirect(redirect)
        .https_only(https_only)
        .build()
        .expect("client HTTP")
}

fn net_err(e: reqwest::Error) -> Error {
    let mut msg = e.to_string();
    let mut src = std::error::Error::source(&e);
    while let Some(s) = src {
        msg.push_str(" : ");
        msg.push_str(&s.to_string());
        src = s.source();
    }
    Error::Network(msg)
}

/// Lit une ressource entière (catalogue, signature, image). `Ok(None)` si elle n'existe pas (404).
pub async fn fetch_bytes(
    http: &reqwest::Client,
    url: &Url,
    max: usize,
) -> Result<Option<Vec<u8>>> {
    if url.scheme() == "file" {
        let path = url
            .to_file_path()
            .map_err(|_| Error::InvalidCatalog(format!("chemin local invalide : {url}")))?;
        return match tokio::fs::read(&path).await {
            Ok(b) if b.len() <= max => Ok(Some(b)),
            Ok(_) => Err(Error::Other(format!("{url} est trop volumineux"))),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(Error::Network(format!("{} : {e}", path.display()))),
        };
    }
    let resp = http.get(url.clone()).send().await.map_err(net_err)?;
    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !resp.status().is_success() {
        return Err(Error::HttpStatus {
            status: resp.status().as_u16(),
            url: url.to_string(),
        });
    }
    let mut out = Vec::new();
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(net_err)?;
        if out.len() + chunk.len() > max {
            return Err(Error::Other(format!("{url} est trop volumineux")));
        }
        out.extend_from_slice(&chunk);
    }
    Ok(Some(out))
}

/// Télécharge vers `dest` et renvoie l'empreinte SHA-256 du fichier complet.
///
/// Reprise : si `dest` contient déjà le début du fichier (téléchargement annulé ou coupé), seule la suite est
/// demandée (en-tête Range). Un serveur qui ne sait pas reprendre renvoie tout : on repart de zéro.
/// `cancel` arrête le téléchargement entre deux blocs : le début reste sur le disque pour une reprise.
pub async fn download_to(
    http: &reqwest::Client,
    url: &Url,
    dest: &Path,
    expected_size: Option<u64>,
    cancel: &AtomicBool,
    mut on_progress: impl FnMut(u64, Option<u64>),
) -> Result<String> {
    let mut hasher = Sha256::new();
    let mut received: u64 = 0;
    if url.scheme() == "file" {
        let path = url
            .to_file_path()
            .map_err(|_| Error::Network(format!("chemin local invalide : {url}")))?;
        let mut src = tokio::fs::File::open(&path)
            .await
            .map_err(|e| Error::Network(format!("{} : {e}", path.display())))?;
        let total = src.metadata().await.ok().map(|m| m.len());
        let mut file = tokio::fs::File::create(dest).await?;
        let mut buf = vec![0u8; 1 << 20];
        loop {
            if cancel.load(Ordering::Relaxed) {
                return Err(Error::Cancelled);
            }
            let n = src.read(&mut buf).await.map_err(|e| Error::Network(format!("{} : {e}", path.display())))?;
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
            file.write_all(&buf[..n]).await?;
            received += n as u64;
            on_progress(received, total);
        }
        file.sync_all().await?;
        return Ok(hex::encode(hasher.finalize()));
    }

    let already = tokio::fs::metadata(dest).await.map(|m| m.len()).unwrap_or(0);
    let mut req = http.get(url.clone());
    if already > 0 {
        req = req.header(reqwest::header::RANGE, format!("bytes={already}-"));
    }
    let resp = req.send().await.map_err(net_err)?;
    let status = resp.status();
    let resuming = already > 0 && status == reqwest::StatusCode::PARTIAL_CONTENT;
    if status == reqwest::StatusCode::RANGE_NOT_SATISFIABLE {
        // Le morceau gardé ne correspond plus : on le jette et on recommence au prochain essai.
        let _ = tokio::fs::remove_file(dest).await;
        return Err(Error::Network("reprise impossible, le téléchargement repartira de zéro".into()));
    }
    if !status.is_success() {
        return Err(Error::HttpStatus { status: status.as_u16(), url: url.to_string() });
    }
    let mut file = if resuming {
        // L'empreinte couvre tout le fichier : on relit d'abord le début déjà reçu.
        let mut f = tokio::fs::File::open(dest).await?;
        let mut buf = vec![0u8; 1 << 20];
        loop {
            let n = f.read(&mut buf).await?;
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
        }
        received = already;
        tokio::fs::OpenOptions::new().append(true).open(dest).await?
    } else {
        tokio::fs::File::create(dest).await?
    };
    let announced = resp.content_length().map(|l| l + received);
    let total = announced.or(expected_size);
    on_progress(received, total);
    let mut stream = resp.bytes_stream();
    let result: Result<()> = async {
        while let Some(chunk) = stream.next().await {
            if cancel.load(Ordering::Relaxed) {
                return Err(Error::Cancelled);
            }
            let chunk = chunk.map_err(net_err)?;
            hasher.update(&chunk);
            file.write_all(&chunk).await?;
            received += chunk.len() as u64;
            on_progress(received, total);
        }
        Ok(())
    }
    .await;
    // Ce qui est reçu reste sur le disque, même en cas d'annulation ou de coupure.
    file.flush().await?;
    result?;
    if let Some(t) = resp_len_mismatch(announced, received) {
        return Err(Error::Network(t));
    }
    file.sync_all().await?;
    Ok(hex::encode(hasher.finalize()))
}

fn resp_len_mismatch(total: Option<u64>, received: u64) -> Option<String> {
    match total {
        Some(t) if t != received => Some(format!(
            "téléchargement interrompu ({received} octets reçus sur {t})"
        )),
        _ => None,
    }
}
