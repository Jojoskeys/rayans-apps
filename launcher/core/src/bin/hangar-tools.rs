//! Outils de publication Hangar : clés, empreintes, ZIP, édition et signature du catalogue, et une
//! petite interface en ligne de commande du launcher (utile pour les tests de bout en bout).

use base64::Engine;
use ed25519_dalek::{Signer, SigningKey};
use hangar_core::{catalog, util, Core, TrustPolicy};
use serde_json::{json, Map, Value};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

const AIDE: &str = "hangar-tools : outils de publication du launcher Hangar

CLÉS ET SIGNATURE
  keygen --private <fichier> --public <fichier>
      Crée une paire de clés Ed25519. Gardez la clé privée hors du dépôt.
  sign --key <clé-privée> <catalog.json>
      Écrit <catalog.json>.sig (signature des octets exacts du fichier).
  verify --public <clé-publique> <catalog.json>

CATALOGUE
  hash <fichier>                      Empreinte SHA-256.
  pack <dossier> <archive.zip>        Crée un ZIP du contenu du dossier (ordre stable).
  validate <catalog.json> [--base-url <url>] [--strict]
      Contrôle le catalogue (--strict : règles de distribution, https obligatoire).
  publish --catalog <catalog.json> --id <id> --version <x.y.z> --zip <archive.zip>
          --notes <texte> [--download-url <url>] [--executable <chemin>]
          [--name <nom>] [--description <texte>] [--icon <url>] [--image <url>] [--date <AAAA-MM-JJ>]
      Ajoute l'application ou remplace sa version : sha256 et size sont calculés depuis le ZIP.
      Sans --download-url, l'adresse vaut « zips/<nom du ZIP> » (relative au catalogue).

LAUNCHER EN LIGNE DE COMMANDE (même coeur que l'application)
  cli --home <dossier> [--catalog <url>] [--dev] [--public <clé>] <commande>
      refresh | list | install <id> | launch <id> [--wait] | uninstall <id> [--data]
";

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run(args) {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("erreur : {e}");
            ExitCode::FAILURE
        }
    }
}

struct Args {
    pos: Vec<String>,
    opts: Vec<(String, Option<String>)>,
}

impl Args {
    fn parse(v: Vec<String>, flags: &[&str]) -> Args {
        let mut pos = Vec::new();
        let mut opts = Vec::new();
        let mut it = v.into_iter();
        while let Some(a) = it.next() {
            if let Some(name) = a.strip_prefix("--") {
                if flags.contains(&name) {
                    opts.push((name.to_string(), None));
                } else {
                    opts.push((name.to_string(), it.next()));
                }
            } else {
                pos.push(a);
            }
        }
        Args { pos, opts }
    }
    fn get(&self, k: &str) -> Option<String> {
        self.opts.iter().find(|(n, _)| n == k).and_then(|(_, v)| v.clone())
    }
    fn need(&self, k: &str) -> Result<String, String> {
        self.get(k).ok_or_else(|| format!("option --{k} manquante"))
    }
    fn flag(&self, k: &str) -> bool {
        self.opts.iter().any(|(n, _)| n == k)
    }
    fn pos(&self, i: usize, what: &str) -> Result<String, String> {
        self.pos.get(i).cloned().ok_or_else(|| format!("{what} manquant"))
    }
}

fn run(mut args: Vec<String>) -> Result<(), String> {
    if args.is_empty() {
        print!("{AIDE}");
        return Ok(());
    }
    let cmd = args.remove(0);
    let e = |e: hangar_core::Error| e.to_string();
    match cmd.as_str() {
        "keygen" => {
            let a = Args::parse(args, &[]);
            let (private, public) = (PathBuf::from(a.need("private")?), PathBuf::from(a.need("public")?));
            if private.exists() {
                return Err(format!("{} existe déjà, rien n'est écrasé", private.display()));
            }
            let mut seed = [0u8; 32];
            getrandom::fill(&mut seed).map_err(|e| e.to_string())?;
            let sk = SigningKey::from_bytes(&seed);
            let b64 = base64::engine::general_purpose::STANDARD;
            if let Some(d) = private.parent() {
                std::fs::create_dir_all(d).map_err(|e| e.to_string())?;
            }
            write_private(&private, &format!("{}\n", b64.encode(seed)))?;
            let pubtxt = format!(
                "# Clé publique Ed25519 du catalogue Hangar (base64). Générée par hangar-tools keygen.\n{}\n",
                b64.encode(sk.verifying_key().to_bytes())
            );
            std::fs::write(&public, pubtxt).map_err(|e| e.to_string())?;
            println!("Clé privée : {} (à garder secrète, hors du dépôt)", private.display());
            println!("Clé publique : {}", public.display());
        }
        "sign" => {
            let a = Args::parse(args, &[]);
            let sk = read_private(Path::new(&a.need("key")?))?;
            let file = PathBuf::from(a.pos(0, "catalogue")?);
            let data = std::fs::read(&file).map_err(|e| e.to_string())?;
            let sig = base64::engine::general_purpose::STANDARD.encode(sk.sign(&data).to_bytes());
            let out = PathBuf::from(format!("{}.sig", file.display()));
            std::fs::write(&out, format!("{sig}\n")).map_err(|e| e.to_string())?;
            println!("Signature écrite : {}", out.display());
        }
        "verify" => {
            let a = Args::parse(args, &[]);
            let key = catalog::parse_public_key(&read(&a.need("public")?)?)
                .map_err(e)?
                .ok_or("clé publique vide")?;
            let file = a.pos(0, "catalogue")?;
            let data = std::fs::read(&file).map_err(|e| e.to_string())?;
            let sig = read(&format!("{file}.sig"))?;
            catalog::verify_signature(&key, &data, &sig).map_err(e)?;
            println!("Signature valide.");
        }
        "hash" => {
            let a = Args::parse(args, &[]);
            println!("{}", util::sha256_file(Path::new(&a.pos(0, "fichier")?)).map_err(e)?);
        }
        "pack" => {
            let a = Args::parse(args, &[]);
            let (dir, out) = (a.pos(0, "dossier")?, a.pos(1, "archive")?);
            pack(Path::new(&dir), Path::new(&out))?;
            println!("{out}\nsha256 {}", util::sha256_file(Path::new(&out)).map_err(e)?);
        }
        "validate" => {
            let a = Args::parse(args, &["strict"]);
            let file = PathBuf::from(a.pos(0, "catalogue")?);
            let data = std::fs::read(&file).map_err(|e| e.to_string())?;
            let base = match a.get("base-url") {
                Some(u) => url::Url::parse(&u).map_err(|e| e.to_string())?,
                None => url::Url::from_file_path(std::fs::canonicalize(&file).map_err(|e| e.to_string())?)
                    .map_err(|_| "chemin invalide")?,
            };
            let policy = if a.flag("strict") {
                TrustPolicy::Distributed { public_key: None }
            } else {
                TrustPolicy::Development { public_key: None }
            };
            let c = catalog::parse_and_validate(&data, &base, &policy).map_err(e)?;
            println!("Catalogue valide : {} application(s).", c.apps.len());
            for app in c.apps {
                println!("  {} {} -> {}", app.id, app.version, app.download_url);
            }
        }
        "publish" => publish(Args::parse(args, &[]))?,
        "cli" => return cli(Args::parse(args, &["dev", "wait", "data"])),
        "-h" | "--help" | "aide" => print!("{AIDE}"),
        other => return Err(format!("commande inconnue « {other} » (lancez sans argument pour l'aide)")),
    }
    Ok(())
}

fn read(p: &str) -> Result<String, String> {
    std::fs::read_to_string(p).map_err(|e| format!("{p} : {e}"))
}

fn write_private(p: &Path, s: &str) -> Result<(), String> {
    let mut o = std::fs::OpenOptions::new();
    o.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        o.mode(0o600);
    }
    let mut f = o.open(p).map_err(|e| e.to_string())?;
    f.write_all(s.as_bytes()).map_err(|e| e.to_string())
}

fn read_private(p: &Path) -> Result<SigningKey, String> {
    let txt = std::fs::read_to_string(p).map_err(|e| format!("{} : {e}", p.display()))?;
    let raw = base64::engine::general_purpose::STANDARD
        .decode(txt.trim())
        .map_err(|_| "clé privée illisible")?;
    let seed: [u8; 32] = raw.try_into().map_err(|_| "la clé privée doit faire 32 octets")?;
    Ok(SigningKey::from_bytes(&seed))
}

fn pack(dir: &Path, out: &Path) -> Result<(), String> {
    use zip::write::SimpleFileOptions;
    let mut files = Vec::new();
    collect(dir, dir, &mut files)?;
    files.sort();
    if let Some(d) = out.parent() {
        std::fs::create_dir_all(d).map_err(|e| e.to_string())?;
    }
    let f = std::fs::File::create(out).map_err(|e| e.to_string())?;
    let mut w = zip::ZipWriter::new(f);
    for rel in files {
        let full = dir.join(&rel);
        let mut opts = SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .last_modified_time(zip::DateTime::default());
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&full).map_err(|e| e.to_string())?.permissions().mode();
            opts = opts.unix_permissions(mode & 0o755);
        }
        w.start_file(rel.replace('\\', "/"), opts).map_err(|e| e.to_string())?;
        w.write_all(&std::fs::read(&full).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    }
    w.finish().map_err(|e| e.to_string())?;
    Ok(())
}

fn collect(root: &Path, dir: &Path, out: &mut Vec<String>) -> Result<(), String> {
    for e in std::fs::read_dir(dir).map_err(|e| format!("{} : {e}", dir.display()))? {
        let e = e.map_err(|e| e.to_string())?;
        let p = e.path();
        if p.is_dir() {
            collect(root, &p, out)?;
        } else {
            out.push(p.strip_prefix(root).unwrap().to_string_lossy().replace('\\', "/"));
        }
    }
    Ok(())
}

fn publish(a: Args) -> Result<(), String> {
    let cat_path = PathBuf::from(a.need("catalog")?);
    let id = a.need("id")?;
    if !catalog::is_valid_id(&id) {
        return Err(format!("id « {id} » invalide"));
    }
    let version = a.need("version")?;
    semver::Version::parse(&version).map_err(|e| format!("version « {version} » invalide ({e})"))?;
    let zip = PathBuf::from(a.need("zip")?);
    let sha = util::sha256_file(&zip).map_err(|e| e.to_string())?;
    let size = std::fs::metadata(&zip).map_err(|e| e.to_string())?.len();
    let download = a.get("download-url").unwrap_or_else(|| {
        format!("zips/{}", zip.file_name().unwrap().to_string_lossy())
    });

    let mut doc: Value = if cat_path.exists() {
        serde_json::from_str(&read(&cat_path.to_string_lossy())?).map_err(|e| e.to_string())?
    } else {
        json!({ "schemaVersion": 1, "title": "Mes applications", "apps": [] })
    };
    let apps = doc
        .get_mut("apps")
        .and_then(Value::as_array_mut)
        .ok_or("le catalogue n'a pas de tableau « apps »")?;
    let idx = apps.iter().position(|x| x.get("id").and_then(Value::as_str) == Some(id.as_str()));
    let entry = match idx {
        Some(i) => apps[i].as_object_mut().unwrap(),
        None => {
            let mut m = Map::new();
            m.insert("id".into(), json!(id));
            for k in ["name", "description", "icon", "image", "executable"] {
                m.insert(k.into(), json!(a.need(k).map_err(|e| format!("nouvelle application : {e}"))?));
            }
            apps.push(Value::Object(m));
            apps.last_mut().unwrap().as_object_mut().unwrap()
        }
    };
    for k in ["name", "description", "icon", "image", "executable"] {
        if let Some(v) = a.get(k) {
            entry.insert(k.into(), json!(v));
        }
    }
    entry.insert("version".into(), json!(version));
    entry.insert("releaseNotes".into(), json!(a.need("notes")?));
    if let Some(d) = a.get("date") {
        entry.insert("releaseDate".into(), json!(d));
    }
    entry.insert("downloadUrl".into(), json!(download));
    entry.insert("sha256".into(), json!(sha));
    entry.insert("size".into(), json!(size));
    let text = serde_json::to_string_pretty(&doc).map_err(|e| e.to_string())? + "\n";
    std::fs::write(&cat_path, text).map_err(|e| e.to_string())?;
    println!("{id} {version} publié dans {} (sha256 {sha}).", cat_path.display());
    println!("Pensez à re-signer : hangar-tools sign --key <clé-privée> {}", cat_path.display());
    Ok(())
}

fn cli(a: Args) -> Result<(), String> {
    let home = PathBuf::from(a.need("home")?);
    let key = match a.get("public") {
        Some(p) => catalog::parse_public_key(&read(&p)?).map_err(|e| e.to_string())?,
        None => None,
    };
    let policy = if a.flag("dev") {
        TrustPolicy::Development { public_key: key }
    } else {
        TrustPolicy::Distributed { public_key: key }
    };
    let core = Core::open(&home, policy, None, Box::new(|_| {})).map_err(|e| e.to_string())?;
    if let Some(u) = a.get("catalog") {
        core.set_catalog_url(&u).map_err(|e| e.to_string())?;
    }
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    let cmd = a.pos(0, "commande")?;
    let show = |core: &Core| {
        let s = core.snapshot();
        let c = &s.catalog;
        println!(
            "catalogue : {} ({}{}){}",
            c.status,
            c.trust.as_deref().unwrap_or("-"),
            if c.from_cache { ", cache hors ligne" } else { "" },
            c.error.as_ref().map(|e| format!(" — erreur : {}", e.message)).unwrap_or_default()
        );
        for app in s.apps {
            println!(
                "{} | installée {} | disponible {} | mise à jour {} | en attente {}",
                app.id,
                app.installed_version.as_deref().unwrap_or("-"),
                app.available_version.as_deref().unwrap_or("-"),
                if app.update_available { "oui" } else { "non" },
                app.pending_version.as_deref().unwrap_or("-")
            );
        }
    };
    match cmd.as_str() {
        "refresh" => {
            let r = rt.block_on(core.refresh_catalog());
            show(&core);
            r.map_err(|e| e.to_string())?;
        }
        "list" => show(&core),
        "install" => {
            let id = a.pos(1, "id")?;
            rt.block_on(core.refresh_catalog()).ok();
            let o = rt.block_on(core.install(&id)).map_err(|e| e.to_string())?;
            println!("{id} : {o:?}");
            show(&core);
        }
        "launch" => {
            let id = a.pos(1, "id")?;
            let pid = core.launch(&id).map_err(|e| e.to_string())?;
            println!("{id} lancée (pid {pid})");
            if a.flag("wait") {
                while core.is_running(&id) {
                    std::thread::sleep(std::time::Duration::from_millis(50));
                }
            }
        }
        "uninstall" => {
            let id = a.pos(1, "id")?;
            core.uninstall(&id, a.flag("data")).map_err(|e| e.to_string())?;
            println!("{id} désinstallée");
        }
        other => return Err(format!("commande cli inconnue « {other} »")),
    }
    Ok(())
}
