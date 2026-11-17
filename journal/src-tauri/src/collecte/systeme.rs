//! Démarrages, arrêts, veille et réveil, lus dans le journal « Système » de Windows (lisible sans droits
//! d'administrateur). L'heure est celle que Windows a enregistrée : exacte, même si l'application ne
//! tournait pas. Seuls les événements postérieurs à l'activation de la collecte sont repris.

use super::Ctx;
use journal_core::archive::ContenuEvenement;
use journal_core::temps::Horodatage;
use journal_core::NouvelEvenement;

pub const DEPUIS: &str = "collecte_depuis_ms";

/// (fournisseur, identifiant) → (action, libellé)
const SUIVIS: &[(&str, u32, &str, &str)] = &[
    ("Microsoft-Windows-Kernel-General", 12, "demarrage", "Démarrage de Windows"),
    ("Microsoft-Windows-Kernel-General", 13, "arret", "Arrêt de Windows"),
    ("Microsoft-Windows-Kernel-Power", 41, "arret_inattendu", "Redémarrage après un arrêt non prévu (coupure, blocage)"),
    ("Microsoft-Windows-Kernel-Power", 42, "veille", "Mise en veille"),
    ("Microsoft-Windows-Kernel-Power", 107, "reveil", "Sortie de veille"),
    ("Microsoft-Windows-Power-Troubleshooter", 1, "reveil", "Sortie de veille"),
    ("EventLog", 6008, "arret_inattendu", "L'arrêt précédent n'était pas prévu"),
];

struct Brut {
    fournisseur: String,
    id: u32,
    quand: String,
    numero: String,
}

fn attribut(xml: &str, balise: &str, attr: &str) -> Option<String> {
    let i = xml.find(&format!("<{balise} "))?;
    let fin = i + xml[i..].find('>')?;
    let morceau = &xml[i..fin];
    let j = morceau.find(&format!("{attr}='")).map(|j| (j, '\'')).or_else(|| morceau.find(&format!("{attr}=\"")).map(|j| (j, '"')))?;
    let debut = j.0 + attr.len() + 2;
    let k = morceau[debut..].find(j.1)?;
    Some(morceau[debut..debut + k].to_string())
}

fn texte(xml: &str, balise: &str) -> Option<String> {
    let i = xml.find(&format!("<{balise}"))?;
    let d = i + xml[i..].find('>')? + 1;
    let f = d + xml[d..].find(&format!("</{balise}>"))?;
    Some(xml[d..f].to_string())
}

fn analyser(xml: &str) -> Vec<Brut> {
    xml.split("<Event ")
        .skip(1)
        .filter_map(|e| {
            Some(Brut {
                fournisseur: attribut(e, "Provider", "Name")?,
                id: texte(e, "EventID")?.trim().parse().ok()?,
                quand: attribut(e, "TimeCreated", "SystemTime")?,
                numero: texte(e, "EventRecordID")?,
            })
        })
        .collect()
}

#[cfg(windows)]
fn lire_journal() -> Option<String> {
    use std::os::windows::process::CommandExt;
    let requete = "*[System[(EventID=1 or EventID=12 or EventID=13 or EventID=41 or EventID=42 or EventID=107 or EventID=6008)]]";
    let out = std::process::Command::new("wevtutil")
        .args(["qe", "System", &format!("/q:{requete}"), "/rd:true", "/c:400", "/f:xml"])
        .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
        .output()
        .ok()?;
    out.status.success().then(|| String::from_utf8_lossy(&out.stdout).into_owned())
}

#[cfg(not(windows))]
fn lire_journal() -> Option<String> {
    None
}

pub fn rattraper(ctx: &Ctx) {
    if !ctx.suivre("session") {
        return;
    }
    let depuis = ctx.avec_archive(|a| a.reglage(DEPUIS).ok().flatten()).flatten().and_then(|s| s.parse::<i64>().ok()).unwrap_or(i64::MAX);
    let Some(xml) = lire_journal() else { return };
    let detection = Horodatage::maintenant();
    for b in analyser(&xml) {
        let Some((_, _, action, libelle)) = SUIVIS.iter().find(|(f, id, _, _)| *f == b.fournisseur && *id == b.id) else { continue };
        let Ok(t) = chrono::DateTime::parse_from_rfc3339(&b.quand) else { continue };
        let ms = t.timestamp_millis();
        if ms < depuis || super::pendant_une_pause(ctx, ms) {
            continue;
        }
        ctx.envoyer(NouvelEvenement {
            categorie: "session".into(),
            action: action.to_string(),
            evenement: Some(Horodatage::en_local(ms, "exacte (journal Windows)")),
            detection: detection.clone(),
            partiel: false,
            contenu: ContenuEvenement {
                sujet: libelle.to_string(),
                detail: Some(format!("Journal Système, événement {} n° {}", b.id, b.numero)),
                ..Default::default()
            },
            unique: Some(format!("System:{}", b.numero)),
        });
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn lit_le_xml_de_wevtutil() {
        let xml = "<Event xmlns='http://schemas.microsoft.com/win/2004/08/events/event'><System><Provider Name='Microsoft-Windows-Kernel-Power' Guid='{x}'/><EventID>42</EventID><TimeCreated SystemTime='2026-11-17T07:12:03.4567890Z'/><EventRecordID>98765</EventRecordID></System></Event>";
        let v = super::analyser(xml);
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].fournisseur, "Microsoft-Windows-Kernel-Power");
        assert_eq!(v[0].id, 42);
        assert_eq!(v[0].numero, "98765");
        assert!(chrono::DateTime::parse_from_rfc3339(&v[0].quand).is_ok());
    }
}
