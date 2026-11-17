//! Évaluation de la confiance d'un programme à partir d'indices vérifiables sur le PC : signature
//! numérique, emplacement, origine Internet (marque « Zone.Identifier »), imitation d'un nom de Windows,
//! démarrage automatique, détections de Microsoft Defender.
//!
//! Ce n'est pas un antivirus : le niveau dit s'il y a des raisons de se méfier, et lesquelles. Il ne
//! garantit pas qu'un programme est sain.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Niveau {
    Fiable,
    AVerifier,
    Suspect,
    /// Rien d'inquiétant trouvé, mais la signature n'a pas pu être lue (accès refusé…).
    Inconnu,
}

impl Niveau {
    pub fn code(self) -> &'static str {
        match self {
            Niveau::Fiable => "fiable",
            Niveau::AVerifier => "a_verifier",
            Niveau::Suspect => "suspect",
            Niveau::Inconnu => "inconnu",
        }
    }
    pub fn libelle(self) -> &'static str {
        match self {
            Niveau::Fiable => "fiable",
            Niveau::AVerifier => "à vérifier",
            Niveau::Suspect => "suspect",
            Niveau::Inconnu => "non vérifiable",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Gravite {
    Info,
    Avertissement,
    Critique,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Raison {
    pub gravite: Gravite,
    pub texte: String,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Signature {
    /// Statut renvoyé par Windows : « Valid », « NotSigned », « HashMismatch », « NotTrusted »… ; vide si non lu.
    pub statut: String,
    /// « Authenticode » (signé dans le fichier) ou « Catalog » (catalogue de Windows).
    pub genre: String,
    /// Sujet du certificat (« CN=Microsoft Corporation, O=… »).
    pub sujet: String,
}

impl Signature {
    pub fn valide(&self) -> bool {
        self.statut == "Valid"
    }
    /// Nom lisible de l'éditeur (le « CN » du certificat).
    pub fn editeur(&self) -> Option<String> {
        let cn = self.sujet.split(',').find_map(|p| p.trim().strip_prefix("CN="))?;
        Some(cn.trim_matches('"').to_string()).filter(|s| !s.is_empty())
    }
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Origine {
    /// 3 = Internet, 4 = sites non fiables, 2 = sites de confiance, 1 = intranet, 0 = ordinateur local.
    pub zone: Option<u32>,
    pub hote: Option<String>,
    pub referent: Option<String>,
}

/// Lit le flux « Zone.Identifier » que Windows et les navigateurs ajoutent aux fichiers téléchargés.
pub fn lire_zone_identifier(texte: &str) -> Origine {
    let mut o = Origine::default();
    for l in texte.lines() {
        let l = l.trim();
        if let Some(v) = l.strip_prefix("ZoneId=") {
            o.zone = v.trim().parse().ok();
        } else if let Some(v) = l.strip_prefix("HostUrl=") {
            o.hote = Some(v.trim().to_string()).filter(|s| !s.is_empty() && s != "about:internet");
        } else if let Some(v) = l.strip_prefix("ReferrerUrl=") {
            o.referent = Some(v.trim().to_string()).filter(|s| !s.is_empty());
        }
    }
    o
}

/// Dossiers de référence du PC (en minuscules, terminés par `\`).
#[derive(Clone, Debug, Default)]
pub struct Dossiers {
    pub windows: String,
    pub programmes: Vec<String>,
    pub temporaires: Vec<String>,
    pub profil: String,
}

impl Dossiers {
    pub fn du_systeme() -> Self {
        let v = |k: &str| std::env::var(k).ok().map(|s| norm_dossier(&s));
        Dossiers {
            windows: v("SystemRoot").unwrap_or_else(|| r"c:\windows\".into()),
            programmes: ["ProgramFiles", "ProgramFiles(x86)", "ProgramW6432"].iter().filter_map(|k| v(k)).collect(),
            temporaires: ["TEMP", "TMP"].iter().filter_map(|k| v(k)).collect(),
            profil: v("USERPROFILE").unwrap_or_default(),
        }
    }
}

fn norm_dossier(s: &str) -> String {
    let mut s = s.replace('/', "\\").to_lowercase();
    if !s.ends_with('\\') {
        s.push('\\');
    }
    s
}

#[derive(Clone, Debug, Default)]
pub struct Faits {
    pub chemin: String,
    pub nom: String,
    pub signature: Signature,
    pub origine: Option<Origine>,
    /// Entrées de démarrage automatique qui lancent ce programme (« Registre Run : Discord »…).
    pub demarrage: Vec<String>,
    /// Le fichier n'existe plus à cet emplacement (remplacé par une mise à jour, ex. `old_chrome.exe`,
    /// ou supprimé depuis son lancement) : rien ne peut être vérifié.
    pub introuvable: bool,
    /// Détections de Microsoft Defender visant ce fichier.
    pub defender: Vec<String>,
    /// Programme reconnu comme sûr, et pourquoi (installé par Rayan's Launcher avec la même empreinte que
    /// celle publiée, ou règle de confiance de l'utilisateur). Remplace la signature d'éditeur ; une
    /// détection Defender, une imitation de nom ou une signature altérée restent signalées.
    pub confiance: Option<String>,
    /// Fichier placé par Rayan's Launcher mais différent de celui qu'il a installé.
    pub altere_depuis_installation: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Analyse {
    pub chemin: String,
    pub nom: String,
    pub niveau: Niveau,
    pub raisons: Vec<Raison>,
    pub editeur: Option<String>,
    pub signature: Signature,
    pub origine: Option<Origine>,
    pub demarrage: Vec<String>,
    pub analyse_ms: i64,
}

/// Programmes de Windows souvent imités par les logiciels malveillants.
const NOMS_SYSTEME: &[&str] = &[
    "svchost.exe", "lsass.exe", "csrss.exe", "winlogon.exe", "services.exe", "smss.exe", "wininit.exe",
    "explorer.exe", "taskhostw.exe", "dwm.exe", "conhost.exe", "rundll32.exe", "spoolsv.exe", "sihost.exe",
    "ctfmon.exe", "runtimebroker.exe", "dllhost.exe", "taskmgr.exe", "searchhost.exe", "fontdrvhost.exe",
    "lsm.exe", "regsvr32.exe", "powershell.exe", "cmd.exe", "msiexec.exe", "wmiprvse.exe", "audiodg.exe",
];

/// Distance d'édition : insertion, suppression, substitution et inversion de deux lettres voisines
/// (« scvhost » est à 1 de « svchost »).
pub fn distance(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let mut d = vec![vec![0usize; b.len() + 1]; a.len() + 1];
    for (i, l) in d.iter_mut().enumerate() {
        l[0] = i;
    }
    for j in 0..=b.len() {
        d[0][j] = j;
    }
    for i in 1..=a.len() {
        for j in 1..=b.len() {
            let cout = usize::from(a[i - 1] != b[j - 1]);
            d[i][j] = (d[i - 1][j] + 1).min(d[i][j - 1] + 1).min(d[i - 1][j - 1] + cout);
            if i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1] {
                d[i][j] = d[i][j].min(d[i - 2][j - 2] + 1);
            }
        }
    }
    d[a.len()][b.len()]
}

/// Chemin de l'exécutable lancé par une ligne de commande (« "C:\…\app.exe" --hidden », « %LOCALAPPDATA%\…»).
pub fn executable_de(commande: &str) -> Option<String> {
    let mut c = commande.trim().to_string();
    // Variables d'environnement %NOM%.
    while let Some(i) = c.find('%') {
        let Some(j) = c[i + 1..].find('%').map(|j| i + 1 + j) else { break };
        let nom = &c[i + 1..j];
        match std::env::var(nom) {
            Ok(v) => c.replace_range(i..=j, &v),
            Err(_) => break,
        }
    }
    let c = c.trim();
    let brut = if let Some(r) = c.strip_prefix('"') {
        r.split('"').next().unwrap_or(r).to_string()
    } else {
        let bas = c.to_lowercase();
        match bas.find(".exe") {
            Some(i) => c[..i + 4].to_string(),
            None => c.split_whitespace().next().unwrap_or("").to_string(),
        }
    };
    let brut = brut.trim().to_string();
    (!brut.is_empty()).then_some(brut)
}

pub fn evaluer(f: &Faits, d: &Dossiers, maintenant_ms: i64) -> Analyse {
    let mut r: Vec<Raison> = Vec::new();
    let mut ajouter = |g: Gravite, t: String| r.push(Raison { gravite: g, texte: t });
    let chemin = f.chemin.to_lowercase();
    let nom = f.nom.to_lowercase();
    // Les applications du Microsoft Store sont signées au niveau du paquet (installé dans WindowsApps,
    // dossier protégé), pas fichier par fichier.
    let store = chemin.contains(r"\windowsapps\") &&f.signature.statut == "NotSigned";
    let signe = f.signature.valide() || store || f.confiance.is_some();
    let editeur = f.signature.editeur();
    let dans_windows = chemin.starts_with(&d.windows);
    let microsoft = editeur.as_deref().is_some_and(|e| e.starts_with("Microsoft"));

    if let Some(c) = &f.confiance {
        ajouter(Gravite::Info, format!("{c}"));
    }
    if f.altere_depuis_installation {
        ajouter(
            Gravite::Critique,
            "Différent du fichier installé par Rayan's Launcher (empreinte SHA-256 changée) : modifié après son installation.".into(),
        );
    }

    // Defender.
    for x in &f.defender {
        ajouter(Gravite::Critique, format!("Microsoft Defender a détecté ce fichier : {x}."));
    }

    // Imitation d'un programme de Windows.
    if NOMS_SYSTEME.contains(&nom.as_str()) && !dans_windows {
        ajouter(
            Gravite::Critique,
            format!("Porte le nom d'un programme de Windows ({}) mais ne se trouve pas dans le dossier Windows.", f.nom),
        );
    } else if !microsoft {
        if let Some(s) = NOMS_SYSTEME.iter().find(|s| nom.len() >= 7 && **s != nom && distance(&nom, s) == 1) {
            ajouter(Gravite::Critique, format!("Nom presque identique à « {s} », un programme de Windows : imitation possible."));
        }
    }

    // Signature.
    match f.signature.statut.as_str() {
        "Valid" => {
            let par = editeur.clone().unwrap_or_else(|| "un éditeur".into());
            let cat = if f.signature.genre == "Catalog" { " (catalogue de Windows)" } else { "" };
            ajouter(Gravite::Info, format!("Signé par {par}{cat} : signature vérifiée par Windows."));
        }
        "NotSigned" if f.confiance.is_some() => ajouter(Gravite::Info, "Non signé par un éditeur (remplacé par la confiance ci-dessus).".into()),
        "NotSigned" if store => ajouter(Gravite::Info, "Application du Microsoft Store : paquet signé, installé dans un dossier protégé.".into()),
        "NotSigned" => ajouter(Gravite::Avertissement, "Non signé : l'éditeur ne peut pas être vérifié.".into()),
        "HashMismatch" => ajouter(Gravite::Critique, "Signature invalide : le fichier a été modifié après avoir été signé.".into()),
        "" if f.introuvable => ajouter(
            Gravite::Info,
            "Fichier introuvable à cet emplacement : remplacé par une mise à jour pendant qu'il tournait (comme old_chrome.exe), ou supprimé depuis son lancement. Rien ne peut être vérifié.".into(),
        ),
        "" => ajouter(Gravite::Info, "Signature non lue (fichier inaccessible ou protégé).".into()),
        autre => ajouter(Gravite::Avertissement, format!("Signature non reconnue par Windows ({autre}).")),
    }

    // Emplacement.
    let temporaire = d.temporaires.iter().any(|t| chemin.starts_with(t))
        || chemin.contains(r"\appdata\local\temp\")
        || chemin.starts_with(&format!("{}temp\\", d.windows));
    let profil = |sous: &str| !d.profil.is_empty() && chemin.starts_with(&format!("{}{sous}\\", d.profil));
    let expose = profil("downloads") || profil("desktop") || profil("téléchargements") || chemin.starts_with(r"c:\users\public\");
    if dans_windows {
        if !temporaire {
            ajouter(Gravite::Info, "Dans le dossier de Windows.".into());
        }
    } else if d.programmes.iter().any(|p| chemin.starts_with(p)) || chemin.contains(r"\windowsapps\") {
        ajouter(Gravite::Info, "Installé dans Program Files.".into());
    }
    if temporaire {
        let g = if signe { Gravite::Info } else { Gravite::Avertissement };
        ajouter(g, "Lancé depuis un dossier temporaire (habituel pour un installateur, inhabituel pour un programme installé).".into());
    } else if expose {
        let g = if signe { Gravite::Info } else { Gravite::Avertissement };
        ajouter(g, "Lancé directement depuis Téléchargements, le Bureau ou le dossier Public.".into());
    } else if chemin.contains(r"\appdata\") {
        ajouter(Gravite::Info, "Installé dans ton profil (AppData), comme Discord, Roblox ou Opera.".into());
    }

    // Origine Internet.
    if let Some(o) = &f.origine {
        if matches!(o.zone, Some(3) | Some(4)) {
            let de = o.hote.as_deref().or(o.referent.as_deref()).map(|h| format!(" depuis {h}")).unwrap_or_default();
            let g = if signe { Gravite::Info } else { Gravite::Avertissement };
            ajouter(g, format!("Téléchargé d'Internet{de}."));
        }
    }

    // Démarrage automatique.
    if !f.demarrage.is_empty() {
        let g = if signe { Gravite::Info } else { Gravite::Avertissement };
        ajouter(g, format!("Se lance automatiquement : {}.", f.demarrage.join(" ; ")));
    }

    r.sort_by(|a, b| b.gravite.cmp(&a.gravite));
    let critiques = r.iter().filter(|x| x.gravite == Gravite::Critique).count();
    let avert = r.iter().filter(|x| x.gravite == Gravite::Avertissement).count();
    let niveau = if critiques > 0 || avert >= 2 {
        Niveau::Suspect
    } else if avert == 1 {
        Niveau::AVerifier
    } else if signe {
        Niveau::Fiable
    } else {
        Niveau::Inconnu
    };
    Analyse {
        chemin: f.chemin.clone(),
        nom: f.nom.clone(),
        niveau,
        raisons: r,
        editeur,
        signature: f.signature.clone(),
        origine: f.origine.clone(),
        demarrage: f.demarrage.clone(),
        analyse_ms: maintenant_ms,
    }
}
