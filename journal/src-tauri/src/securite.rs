//! Vérification de confiance des programmes, sur le PC uniquement (rien n'est envoyé en ligne) :
//! - chaque nouveau programme vu par le suivi est analysé (signature, emplacement, origine Internet, nom,
//!   démarrage automatique, détections Defender) ; le résultat est gardé et réutilisé tant que le fichier
//!   ne change pas (7 jours au plus) ;
//! - les entrées de démarrage automatique (registre Run, dossier Démarrage, tâches planifiées) sont relues
//!   toutes les 5 minutes : un ajout est noté et analysé ;
//! - les nouvelles détections de Microsoft Defender sont reprises dans le journal.
//! Un programme suspect déclenche une notification.
//!
//! Les informations Windows sont lues par un petit script PowerShell (signature Authenticode et catalogues,
//! registre, tâches planifiées, journal de Defender), échangé en base64 pour ne jamais abîmer les accents.

use crate::collecte::{evenement, Ctx};
use base64::Engine;
use journal_core::securite::{evaluer, executable_de, lire_zone_identifier, Analyse, Dossiers, Faits, Niveau, Signature};
use journal_core::temps::{maintenant_ms, Horodatage};
use journal_core::NouvelEvenement;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::sync::mpsc::{channel, Receiver, RecvTimeoutError, Sender};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, UNIX_EPOCH};
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

const SCRIPT: &str = r#"
$ErrorActionPreference = 'SilentlyContinue'
$entree = [Console]::In.ReadToEnd().Trim()
$arg = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($entree)) | ConvertFrom-Json
$r = @()
if ($arg.mode -eq 'signatures') {
  foreach ($p in $arg.chemins) {
    $s = Get-AuthenticodeSignature -LiteralPath $p
    $r += [pscustomobject]@{ chemin = $p; statut = [string]$s.Status; genre = [string]$s.SignatureType; sujet = [string]$s.SignerCertificate.Subject }
  }
}
if ($arg.mode -eq 'demarrage') {
  foreach ($k in 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run') {
    $i = Get-Item -LiteralPath $k
    if ($i) { foreach ($n in $i.GetValueNames()) { if ($n) { $r += [pscustomobject]@{ source = ('Registre ' + $(if ($k -like 'HKCU*') { 'utilisateur' } else { 'ordinateur' }) + ' ' + (Split-Path $k -Leaf)); nom = $n; commande = [string]$i.GetValue($n, $null, 'DoNotExpandEnvironmentNames') } } } }
  }
  $sh = New-Object -ComObject WScript.Shell
  foreach ($d in [Environment]::GetFolderPath('Startup'), [Environment]::GetFolderPath('CommonStartup')) {
    if ($d) { Get-ChildItem -LiteralPath $d -File | ForEach-Object {
      $c = '"' + $_.FullName + '"'
      if ($_.Extension -eq '.lnk') { $l = $sh.CreateShortcut($_.FullName); $c = '"' + $l.TargetPath + '" ' + $l.Arguments }
      $r += [pscustomobject]@{ source = 'Dossier Démarrage'; nom = $_.Name; commande = $c } } }
  }
  Get-ScheduledTask | Where-Object { $_.State -ne 'Disabled' -and $_.TaskPath -notlike '\Microsoft\*' } | ForEach-Object {
    $t = $_
    foreach ($a in $t.Actions) { if ($a.Execute) { $r += [pscustomobject]@{ source = 'Tâche planifiée'; nom = ($t.TaskPath + $t.TaskName); commande = ('"' + $a.Execute + '" ' + $a.Arguments) } } }
  }
}
if ($arg.mode -eq 'defender') {
  $debut = [DateTimeOffset]::FromUnixTimeMilliseconds([int64]$arg.depuis).LocalDateTime
  $ev = Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-Windows Defender/Operational'; Id = 1116, 1117; StartTime = $debut } -MaxEvents 300
  foreach ($e in $ev) {
    $x = [xml]$e.ToXml(); $d = @{}
    foreach ($n in $x.Event.EventData.Data) { $d[$n.Name] = $n.'#text' }
    $r += [pscustomobject]@{ id = $e.Id; numero = $e.RecordId; quand = $e.TimeCreated.ToUniversalTime().ToString('o'); menace = $d['Threat Name']; gravite = $d['Severity Name']; categorie = $d['Category Name']; chemin = $d['Path']; action = $d['Action Name'] }
  }
}
$json = ConvertTo-Json -InputObject @($r) -Depth 4 -Compress
[Console]::Out.Write([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json)))
"#;

/// Lance le script PowerShell avec `parametres` et renvoie la liste JSON produite.
#[cfg(windows)]
pub fn powershell(parametres: Value) -> Option<Vec<Value>> {
    use std::io::Write;
    use std::os::windows::process::CommandExt;
    let b64 = base64::engine::general_purpose::STANDARD;
    let encode: Vec<u8> = SCRIPT.encode_utf16().flat_map(|u| u.to_le_bytes()).collect();
    let exe = std::env::var("SystemRoot").map(|s| format!(r"{s}\System32\WindowsPowerShell\v1.0\powershell.exe")).unwrap_or_else(|_| "powershell".into());
    let mut enfant = std::process::Command::new(exe)
        .args(["-NoProfile", "-NonInteractive", "-EncodedCommand", &b64.encode(encode)])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .creation_flags(0x0800_0000)
        .spawn()
        .ok()?;
    enfant.stdin.take()?.write_all(b64.encode(parametres.to_string()).as_bytes()).ok()?;
    let sortie = enfant.wait_with_output().ok()?;
    let octets = b64.decode(String::from_utf8_lossy(&sortie.stdout).trim()).ok()?;
    match serde_json::from_slice::<Value>(&octets).ok()? {
        Value::Array(a) => Some(a),
        Value::Null => Some(vec![]),
        v => Some(vec![v]),
    }
}

#[cfg(not(windows))]
pub fn powershell(_: Value) -> Option<Vec<Value>> {
    None
}

fn texte(v: &Value, k: &str) -> String {
    match v.get(k) {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Null) | None => String::new(),
        Some(x) => x.to_string(),
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntreeDemarrage {
    pub source: String,
    pub nom: String,
    pub commande: String,
    pub executable: Option<String>,
}

impl EntreeDemarrage {
    fn libelle(&self) -> String {
        format!("{} : {}", self.source, self.nom)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Detection {
    pub numero: String,
    pub quand_ms: i64,
    pub menace: String,
    pub gravite: String,
    pub categorie: String,
    pub chemins: Vec<String>,
    pub action: String,
    pub id: u32,
}

pub fn lire_demarrage() -> Option<Vec<EntreeDemarrage>> {
    let l = powershell(json!({ "mode": "demarrage" }))?;
    Some(
        l.iter()
            .map(|v| {
                let commande = texte(v, "commande");
                EntreeDemarrage { source: texte(v, "source"), nom: texte(v, "nom"), executable: executable_de(&commande), commande }
            })
            .collect(),
    )
}

pub fn lire_defender(depuis_ms: i64) -> Option<Vec<Detection>> {
    let l = powershell(json!({ "mode": "defender", "depuis": depuis_ms }))?;
    Some(
        l.iter()
            .filter_map(|v| {
                let quand = chrono::DateTime::parse_from_rfc3339(&texte(v, "quand")).ok()?.timestamp_millis();
                let chemins = texte(v, "chemin")
                    .split(';')
                    .map(|c| c.trim().trim_start_matches("file:_").trim_start_matches("process:_pid:").to_string())
                    .filter(|c| !c.is_empty())
                    .collect();
                Some(Detection {
                    numero: texte(v, "numero"),
                    quand_ms: quand,
                    menace: texte(v, "menace"),
                    gravite: texte(v, "gravite"),
                    categorie: texte(v, "categorie"),
                    chemins,
                    action: texte(v, "action"),
                    id: v.get("id").and_then(Value::as_u64).unwrap_or(0) as u32,
                })
            })
            .collect(),
    )
}

fn signatures(chemins: &[String]) -> HashMap<String, Signature> {
    let mut out = HashMap::new();
    for lot in chemins.chunks(40) {
        if let Some(l) = powershell(json!({ "mode": "signatures", "chemins": lot })) {
            for v in l {
                out.insert(
                    texte(&v, "chemin").to_lowercase(),
                    Signature { statut: texte(&v, "statut"), genre: texte(&v, "genre"), sujet: texte(&v, "sujet") },
                );
            }
        }
    }
    out
}

fn empreinte_fichier(chemin: &str) -> String {
    std::fs::metadata(chemin)
        .map(|m| {
            let t = m.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_millis()).unwrap_or(0);
            format!("{}|{t}", m.len())
        })
        .unwrap_or_default()
}

fn origine(chemin: &str) -> Option<journal_core::securite::Origine> {
    std::fs::read_to_string(format!("{chemin}:Zone.Identifier")).ok().map(|t| lire_zone_identifier(&t))
}

// ---------------------------------------------------------------------------------------------------
// Travailleur
// ---------------------------------------------------------------------------------------------------

enum Demande {
    Programme { chemin: String, nom: String },
    Forcer(String),
}

static FILE: OnceLock<Mutex<Sender<Demande>>> = OnceLock::new();
/// Dernier état connu (pour l'interface) : entrées de démarrage et détections Defender récentes.
static DEMARRAGE: Mutex<Vec<EntreeDemarrage>> = Mutex::new(Vec::new());
static DETECTIONS: Mutex<Vec<Detection>> = Mutex::new(Vec::new());

/// Appelé par le suivi des programmes pour chaque programme vu.
pub fn signaler_programme(chemin: &str, nom: &str) {
    if let Some(f) = FILE.get() {
        let _ = f.lock().unwrap().send(Demande::Programme { chemin: chemin.into(), nom: nom.into() });
    }
}

/// Nouvelle analyse demandée depuis l'interface (ignore le résultat gardé).
pub fn reanalyser(chemin: &str) {
    if let Some(f) = FILE.get() {
        let _ = f.lock().unwrap().send(Demande::Forcer(chemin.into()));
    }
}

pub fn entrees_demarrage() -> Vec<EntreeDemarrage> {
    DEMARRAGE.lock().unwrap().clone()
}

pub fn detections() -> Vec<Detection> {
    DETECTIONS.lock().unwrap().clone()
}

const FICHIER_DEMARRAGE: &str = "demarrage.rjf";
const DEFENDER_VU: &str = "defender_dernier_ms";
const SEPT_JOURS: i64 = 7 * 86_400_000;

pub fn demarrer(ctx: Ctx, app: AppHandle) {
    let (tx, rx) = channel();
    let _ = FILE.set(Mutex::new(tx));
    std::thread::spawn(move || boucle(ctx, app, rx));
}

fn notifier(app: &AppHandle, titre: &str, corps: &str) {
    let _ = app.notification().builder().title(titre).body(corps).show();
}

fn boucle(ctx: Ctx, app: AppHandle, rx: Receiver<Demande>) {
    let dossiers = Dossiers::du_systeme();
    let mut inventaire_initial = ctx.avec_archive(|a| a.nombre_programmes().unwrap_or(0) == 0).unwrap_or(true);
    let mut prochain_tour = 0i64;
    loop {
        // Regroupe les demandes arrivées dans les 2 secondes (le premier relevé en envoie des dizaines).
        let mut demandes: Vec<Demande> = Vec::new();
        match rx.recv_timeout(Duration::from_secs(30)) {
            Ok(d) => {
                demandes.push(d);
                while let Ok(d) = rx.recv_timeout(Duration::from_secs(2)) {
                    demandes.push(d);
                    if demandes.len() > 400 {
                        break;
                    }
                }
            }
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => return,
        }
        if !ctx.suivre("securite") {
            continue;
        }
        if maintenant_ms() >= prochain_tour {
            prochain_tour = maintenant_ms() + 5 * 60_000;
            verifier_demarrage(&ctx, &app, &dossiers);
            verifier_defender(&ctx, &app);
        }
        if !demandes.is_empty() {
            analyser(&ctx, &app, &dossiers, demandes, inventaire_initial);
            inventaire_initial = false;
        }
    }
}

fn analyser(ctx: &Ctx, app: &AppHandle, d: &Dossiers, demandes: Vec<Demande>, initial: bool) {
    let maintenant = maintenant_ms();
    let mut a_faire: Vec<(String, String, Option<Niveau>)> = Vec::new();
    let mut vus = HashSet::new();
    for dem in demandes {
        let (chemin, nom, forcer) = match dem {
            Demande::Programme { chemin, nom } => (chemin, nom, false),
            Demande::Forcer(chemin) => {
                let nom = chemin.rsplit('\\').next().unwrap_or(&chemin).to_string();
                (chemin, nom, true)
            }
        };
        if !vus.insert(chemin.to_lowercase()) {
            continue;
        }
        let ancien = ctx.avec_archive(|a| a.programme(&chemin).ok().flatten()).flatten();
        let empreinte = empreinte_fichier(&chemin);
        match &ancien {
            Some(p) if !forcer && p.empreinte_fichier == empreinte && maintenant - p.analyse.analyse_ms < SEPT_JOURS => {
                ctx.avec_archive(|a| a.programme_vu(&chemin, maintenant));
            }
            _ => a_faire.push((chemin, nom, ancien.map(|p| p.analyse.niveau))),
        }
    }
    if a_faire.is_empty() {
        return;
    }
    let chemins: Vec<String> = a_faire.iter().map(|x| x.0.clone()).collect();
    let sigs = signatures(&chemins);
    let demarrage = entrees_demarrage();
    let detections = detections();
    let (mut n_suspects, mut n_verifier) = (0, 0);
    let installes = installes_par_le_launcher();
    let regles = ctx.reglages.read().unwrap().confiance.clone();
    for (chemin, nom, ancien) in a_faire {
        let bas = chemin.to_lowercase();
        let (confiance, altere) = confiance_de(&chemin, &installes, &regles);
        let faits = Faits {
            confiance,
            altere_depuis_installation: altere,
            chemin: chemin.clone(),
            nom: nom.clone(),
            signature: sigs.get(&bas).cloned().unwrap_or_default(),
            origine: origine(&chemin),
            introuvable: !std::path::Path::new(&chemin).exists(),
            demarrage: demarrage.iter().filter(|e| e.executable.as_ref().is_some_and(|x| x.to_lowercase() == bas)).map(|e| e.libelle()).collect(),
            defender: detections
                .iter()
                .filter(|x| x.chemins.iter().any(|c| c.to_lowercase() == bas))
                .map(|x| format!("{} ({}, {})", x.menace, x.gravite, x.action))
                .collect(),
        };
        let an = evaluer(&faits, d, maintenant);
        ctx.avec_archive(|a| a.enregistrer_programme(&an, &empreinte_fichier(&chemin), maintenant));
        match an.niveau {
            Niveau::Suspect => n_suspects += 1,
            Niveau::AVerifier => n_verifier += 1,
            _ => {}
        }
        if initial {
            continue;
        }
        let change = ancien.is_some_and(|n| n != an.niveau);
        if ancien.is_none() || change {
            ctx.envoyer(evenement_analyse(&an, if ancien.is_none() { "nouveau_programme" } else { "niveau_change" }));
        }
        if an.niveau == Niveau::Suspect && ancien != Some(Niveau::Suspect) {
            let raison = an.raisons.first().map(|r| r.texte.clone()).unwrap_or_default();
            notifier(app, &format!("Programme suspect : {}", an.nom), &raison);
        }
    }
    if initial {
        let total = chemins.len();
        let mut e = evenement("securite", "inventaire", format!("Premier inventaire : {total} programmes analysés"), None);
        e.contenu.detail = Some(format!("{n_suspects} suspect(s), {n_verifier} à vérifier. Détail dans la page Sécurité."));
        ctx.envoyer(e);
        if n_suspects > 0 {
            notifier(app, "Rayan’s Journal — sécurité", &format!("{n_suspects} programme(s) suspect(s) trouvé(s). Ouvre la page Sécurité pour voir pourquoi."));
        }
    }
}

fn evenement_analyse(an: &Analyse, action: &str) -> NouvelEvenement {
    let mut e = evenement("securite", action, format!("{} : {}", an.nom, an.niveau.libelle()), Some(an.nom.clone()));
    e.contenu.chemin = Some(an.chemin.clone());
    e.contenu.detail = Some(an.raisons.iter().map(|r| r.texte.as_str()).collect::<Vec<_>>().join(" "));
    e
}

fn verifier_demarrage(ctx: &Ctx, app: &AppHandle, d: &Dossiers) {
    let Some(actuel) = lire_demarrage() else { return };
    *DEMARRAGE.lock().unwrap() = actuel.clone();
    let precedent: Option<Vec<EntreeDemarrage>> = ctx
        .avec_archive(|a| a.lire_prive(FICHIER_DEMARRAGE).ok().flatten())
        .flatten()
        .and_then(|b| serde_json::from_slice(&b).ok());
    ctx.avec_archive(|a| a.ecrire_prive(FICHIER_DEMARRAGE, &serde_json::to_vec(&actuel).unwrap()));
    let Some(precedent) = precedent else { return };
    let avant: HashSet<&EntreeDemarrage> = precedent.iter().collect();
    let apres: HashSet<&EntreeDemarrage> = actuel.iter().collect();
    let mut nouveaux = Vec::new();
    for e in actuel.iter().filter(|e| !avant.contains(e)) {
        let mut ev = evenement("securite", "demarrage_ajoute", format!("Ajouté au démarrage : {}", e.nom), None);
        ev.contenu.chemin = e.executable.clone();
        ev.contenu.detail = Some(format!("{} — commande : {}", e.source, e.commande));
        ctx.envoyer(ev);
        if let Some(x) = &e.executable {
            nouveaux.push(Demande::Forcer(x.clone()));
        }
    }
    for e in precedent.iter().filter(|e| !apres.contains(e)) {
        let mut ev = evenement("securite", "demarrage_retire", format!("Retiré du démarrage : {}", e.nom), None);
        ev.contenu.chemin = e.executable.clone();
        ev.contenu.detail = Some(e.source.clone());
        ctx.envoyer(ev);
    }
    if !nouveaux.is_empty() {
        analyser(ctx, app, d, nouveaux, false);
    }
}

fn verifier_defender(ctx: &Ctx, app: &AppHandle) {
    // L'historique des 90 derniers jours sert à l'analyse et à la page Sécurité.
    let Some(liste) = lire_defender(maintenant_ms() - 90 * 86_400_000) else { return };
    *DETECTIONS.lock().unwrap() = liste.clone();
    // Dans le journal : seulement les détections postérieures à l'activation de la collecte.
    let depuis = ctx
        .avec_archive(|a| a.reglage(crate::collecte::systeme::DEPUIS).ok().flatten())
        .flatten()
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(i64::MAX);
    let deja = ctx.avec_archive(|a| a.reglage(DEFENDER_VU).ok().flatten()).flatten().and_then(|s| s.parse::<i64>().ok()).unwrap_or(0);
    let mut max = deja;
    for x in liste.iter().filter(|x| x.quand_ms >= depuis && !crate::collecte::pendant_une_pause(ctx, x.quand_ms)) {
        let action = if x.id == 1116 { "defender_detection" } else { "defender_action" };
        let mut e = evenement("securite", action, format!("Defender : {}", x.menace), None);
        e.evenement = Some(Horodatage::en_local(x.quand_ms, "exacte (journal de Defender)"));
        e.contenu.chemin = x.chemins.first().cloned();
        e.contenu.detail = Some(format!("{} · gravité {} · {}", x.categorie, x.gravite, x.action));
        e.unique = Some(format!("Defender:{}", x.numero));
        ctx.envoyer(e);
        if x.quand_ms > deja && x.id == 1116 {
            notifier(app, "Microsoft Defender a détecté une menace", &format!("{} ({})", x.menace, x.chemins.first().cloned().unwrap_or_default()));
        }
        max = max.max(x.quand_ms);
    }
    if max > deja {
        ctx.avec_archive(|a| a.definir_reglage(DEFENDER_VU, &max.to_string()));
    }
}

// ---------------------------------------------------------------------------------------------------
// Programmes de confiance : apps installées par Rayan's Launcher, règles de l'utilisateur
// ---------------------------------------------------------------------------------------------------

/// Exécutable installé par Rayan's Launcher : chemin attendu (en minuscules) → (nom de l'app, version,
/// SHA-256 de l'exécutable vérifié par le launcher à l'installation, d'après le catalogue signé).
pub fn installes_par_le_launcher() -> HashMap<String, (String, String, String)> {
    let mut out = HashMap::new();
    let Some(base) = dirs::data_local_dir().map(|d| d.join("fr.rayan.launcher")) else { return out };
    let Ok(t) = std::fs::read(base.join("installed.json")) else { return out };
    let Ok(v) = serde_json::from_slice::<Value>(&t) else { return out };
    // `apps` est un objet { id: app } (ou une liste dans d'anciens formats).
    let apps: Vec<&Value> = match v.get("apps") {
        Some(Value::Object(o)) => o.values().collect(),
        Some(Value::Array(a)) => a.iter().collect(),
        _ => vec![],
    };
    for app in apps {
        let id = texte(app, "id");
        let nom = texte(app, "name");
        for cle in ["current", "previous", "pending"] {
            let Some(c) = app.get(cle).filter(|c| c.is_object()) else { continue };
            let (dir, exe, sha) = (texte(c, "dir"), texte(c, "executable"), texte(c, "executableSha256"));
            if id.is_empty() || dir.is_empty() || exe.is_empty() || sha.is_empty() {
                continue;
            }
            let chemin = base.join("apps").join(&id).join("versions").join(&dir).join(exe.replace('/', "\\"));
            out.insert(chemin.to_string_lossy().to_lowercase(), (nom.clone(), texte(c, "version"), sha.to_lowercase()));
        }
    }
    out
}

fn sha256_fichier(chemin: &str) -> Option<String> {
    use sha2::{Digest, Sha256};
    use std::io::Read;
    let mut f = std::fs::File::open(chemin).ok()?;
    let mut h = Sha256::new();
    let mut buf = vec![0u8; 1 << 16];
    loop {
        let n = f.read(&mut buf).ok()?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    Some(hex::encode(h.finalize()))
}

/// Une règle de confiance couvre ce chemin : chemin exact, ou dossier (terminé par `\`) qui le contient.
pub fn regle_couvre(regle: &str, chemin: &str) -> bool {
    let r = regle.to_lowercase();
    let c = chemin.to_lowercase();
    if r.ends_with('\\') {
        c.starts_with(&r)
    } else {
        c == r
    }
}

/// (raison de confiance, fichier du launcher modifié depuis son installation ?)
pub fn confiance_de(chemin: &str, installes: &HashMap<String, (String, String, String)>, regles: &[String]) -> (Option<String>, bool) {
    if let Some((nom, version, sha)) = installes.get(&chemin.to_lowercase()) {
        return match sha256_fichier(chemin) {
            Some(s) if s == *sha => (
                Some(format!(
                    "{nom} {version}, installé par Rayan's Launcher depuis ton catalogue signé : fichier identique à celui publié (empreinte SHA-256 vérifiée)."
                )),
                false,
            ),
            Some(_) => (None, true),
            None => (None, false),
        };
    }
    if let Some(r) = regles.iter().find(|r| regle_couvre(r, chemin)) {
        let quoi = if r.ends_with('\\') { format!("dans le dossier {r}, marqué comme sûr par toi") } else { "marqué comme sûr par toi".into() };
        return (Some(format!("Programme de confiance : {quoi}.")), false);
    }
    (None, false)
}

/// Verdict tiré du texte de MpCmdRun : son code de sortie (2) est le même pour « menace trouvée » et pour
/// « analyse impossible », il ne suffit pas.
pub fn verdict_defender(sortie: &str) -> Result<bool, String> {
    let bas = sortie.to_lowercase();
    if bas.contains("found no threats") {
        return Ok(false);
    }
    if let Some(i) = bas.find("failed with hr = ") {
        let code: String = bas[i + 17..].chars().take_while(|c| c.is_ascii_hexdigit() || *c == 'x').collect();
        let pourquoi = match code.as_str() {
            "0x80070002" | "0x80070003" | "0x80508023" => "le fichier n'existe plus à cet emplacement (remplacé par une mise à jour ou supprimé)",
            "0x80070005" => "accès refusé au fichier",
            "0x80070020" => "le fichier est verrouillé par un autre programme",
            _ => "erreur de Microsoft Defender",
        };
        return Err(format!("Analyse impossible : {pourquoi} (code {code})."));
    }
    let menaces = bas
        .split("found ")
        .skip(1)
        .filter_map(|s| s.split_whitespace().next()?.parse::<u32>().ok())
        .sum::<u32>();
    if menaces > 0 || bas.contains("threat                  :") {
        return Ok(true);
    }
    Err(format!("Résultat de Microsoft Defender non reconnu : {}", sortie.trim()))
}

/// Analyse d'un fichier par Microsoft Defender (MpCmdRun). Renvoie (menace trouvée ?, sortie).
#[cfg(windows)]
pub fn analyse_defender(chemin: &str) -> Result<(bool, String), String> {
    use std::os::windows::process::CommandExt;
    if !std::path::Path::new(chemin).exists() {
        return Err(
            "Ce fichier n'existe plus à cet emplacement : il a été remplacé par une mise à jour pendant qu'il tournait (comme old_chrome.exe) ou supprimé. Rien à analyser."
                .into(),
        );
    }
    let pf = std::env::var("ProgramFiles").unwrap_or_else(|_| r"C:\Program Files".into());
    let o = std::process::Command::new(format!(r"{pf}\Windows Defender\MpCmdRun.exe"))
        .args(["-Scan", "-ScanType", "3", "-File", chemin])
        .creation_flags(0x0800_0000)
        .output()
        .map_err(|e| format!("Microsoft Defender indisponible : {e}"))?;
    let sortie = String::from_utf8_lossy(&o.stdout).trim().to_string();
    verdict_defender(&sortie).map(|m| (m, sortie))
}

#[cfg(not(windows))]
pub fn analyse_defender(_: &str) -> Result<(bool, String), String> {
    Err("Windows uniquement".into())
}

#[cfg(all(test, windows))]
mod tests {
    #[test]
    fn script_powershell_signature_et_demarrage() {
        let exe = std::env::var("SystemRoot").unwrap() + r"\System32\cmd.exe";
        let s = super::signatures(&[exe.clone()]);
        let sig = s.get(&exe.to_lowercase()).expect("signature lue");
        assert_eq!(sig.statut, "Valid", "{sig:?}");
        assert!(sig.editeur().unwrap().starts_with("Microsoft"));
        assert!(super::lire_demarrage().is_some());
        assert!(super::lire_defender(0).is_some());
    }
}

#[cfg(all(test, windows))]
mod essai_reel {
    /// `cargo test -p rayans-journal essai_sur_ce_pc -- --ignored --nocapture` : évalue les programmes en cours.
    #[test]
    #[ignore]
    fn essai_sur_ce_pc() {
        use journal_core::securite::*;
        let d = Dossiers::du_systeme();
        let mut chemins: Vec<(String, String)> = crate::collecte::processus::win::processus_de_la_session()
            .into_iter()
            .filter_map(|(pid, n)| crate::collecte::processus::win::infos(pid, &n).chemin.map(|c| (c, n)))
            .collect();
        chemins.sort();
        chemins.dedup_by(|a, b| a.0.eq_ignore_ascii_case(&b.0));
        let sigs = super::signatures(&chemins.iter().map(|c| c.0.clone()).collect::<Vec<_>>());
        let dem = super::lire_demarrage().unwrap_or_default();
        let det = super::lire_defender(0).unwrap_or_default();
        let installes = super::installes_par_le_launcher();
        println!("{} exécutables installés par Rayan's Launcher", installes.len());
        let mut compte = std::collections::BTreeMap::new();
        for (c, n) in &chemins {
            let bas = c.to_lowercase();
            let f = Faits {
                chemin: c.clone(),
                nom: c.rsplit(['\\', '/']).next().unwrap_or(n).to_string(),
                signature: sigs.get(&bas).cloned().unwrap_or_default(),
                origine: super::origine(c),
                introuvable: !std::path::Path::new(c).exists(),
                confiance: {
                    let (c2, _) = super::confiance_de(c, &installes, &[]);
                    c2
                },
                altere_depuis_installation: super::confiance_de(c, &installes, &[]).1,
                demarrage: dem.iter().filter(|e| e.executable.as_ref().is_some_and(|x| x.to_lowercase() == bas)).map(|e| e.libelle()).collect(),
                defender: det.iter().filter(|x| x.chemins.iter().any(|p| p.to_lowercase() == bas)).map(|x| x.menace.clone()).collect(),
            };
            let a = evaluer(&f, &d, 0);
            *compte.entry(a.niveau.libelle()).or_insert(0) += 1;
            if a.niveau != Niveau::Fiable {
                println!("[{}] {} — {}", a.niveau.libelle(), c, a.raisons.iter().filter(|r| r.gravite != Gravite::Info).map(|r| r.texte.as_str()).collect::<Vec<_>>().join(" | "));
            }
        }
        println!("{compte:?} ; {} entrées de démarrage ; {} détections Defender", dem.len(), det.len());
    }
}

#[cfg(test)]
mod verdict {
    use super::verdict_defender;

    #[test]
    fn lit_le_vrai_verdict_de_defender() {
        assert_eq!(verdict_defender("Scan starting...\nScan finished.\nScanning C:/x/a.exe found no threats."), Ok(false));
        let e = verdict_defender("Scan starting...\nCmdTool: Failed with hr = 0x80070002. Check C:/Temp/MpCmdRun.log").unwrap_err();
        assert!(e.contains("n'existe plus"), "{e}");
        assert!(verdict_defender("CmdTool: Failed with hr = 0x80508023.").unwrap_err().contains("n'existe plus"));
        assert_eq!(verdict_defender("Scan finished.\nScanning C:/x/eicar.com found 1 threats.\nThreat                  : Virus:DOS/EICAR_Test_File"), Ok(true));
        assert!(verdict_defender("quelque chose d'inattendu").is_err());
    }
}

#[cfg(all(test, windows))]
mod launcher_reel {
    /// Chaque app installée par Rayan's Launcher sur ce PC est reconnue, empreinte comprise.
    #[test]
    fn apps_du_launcher_reconnues() {
        let installes = super::installes_par_le_launcher();
        let base = dirs::data_local_dir().unwrap().join("fr.rayan.launcher").join("installed.json");
        if base.exists() {
            assert!(!installes.is_empty(), "installed.json présent mais aucune app lue");
        }
        for (chemin, (nom, _, _)) in &installes {
            if !std::path::Path::new(chemin).exists() {
                continue;
            }
            let (c, altere) = super::confiance_de(chemin, &installes, &[]);
            assert!(!altere, "{nom} : empreinte différente");
            assert!(c.is_some_and(|t| t.contains("empreinte SHA-256 vérifiée")), "{nom} non reconnu");
        }
        assert!(super::regle_couvre(r"C:\Users\x\Desktop\rayans-apps\", r"C:\Users\X\Desktop\rayans-apps\journal\target\a.exe"));
        assert!(!super::regle_couvre(r"C:\Users\x\Desktop\rayans-apps\", r"C:\Users\x\Desktop\rayans-apps-faux\a.exe"));
        assert!(super::regle_couvre(r"C:\outils\a.exe", r"c:\OUTILS\A.EXE"));
    }
}
