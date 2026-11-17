//! L'archive : une base SQLite dont tous les contenus sont chiffrés (voir [`crate::crypto`]).
//!
//! En clair dans la base : les instants (pour chercher par date), la catégorie et l'action d'un événement,
//! le nom du service d'une conversation (« whatsapp »…) et l'état d'un message. Tout le reste (textes,
//! auteurs, noms de conversations, titres de fenêtres, chemins) est chiffré ; la recherche par mot passe
//! par des empreintes HMAC des préfixes de mots.
//!
//! L'archive n'efface jamais un message à cause d'un nouvel import : une modification ajoute une version,
//! une suppression signalée ou une absence change l'état du message et garde tout le texte déjà archivé.
//! Seule la durée de conservation choisie, ou une suppression demandée, retire des données.

use crate::crypto::Cles;
use crate::error::{Erreur, Resultat};
use crate::imports::{Lot, Paquet};
use crate::temps::Horodatage;
use crate::texte::{correspond, mots, terme_requete, termes_index};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeSet, HashMap, HashSet};
use std::path::{Path, PathBuf};

const GENRE_EVENEMENT: i64 = 0;
const GENRE_MESSAGE: i64 = 1;

pub mod etat {
    pub const PRESENT: &str = "present";
    pub const SUPPRESSION_SIGNALEE: &str = "suppression_signalee";
    pub const ABSENT: &str = "absent_constate";
}

pub mod statut {
    pub const ORIGINAL: &str = "originale";
    pub const MODIFIEE: &str = "modifiee";
    pub const MODIFIEE_AVANT: &str = "modifiee_avant_archivage";
    pub const MENTION_SUPPRESSION: &str = "mention_suppression";
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct ContenuEvenement {
    /// Ce qui est concerné : nom de l'application, titre de fenêtre filtré, chemin…
    pub sujet: String,
    pub appli: Option<String>,
    pub chemin: Option<String>,
    pub ancien_chemin: Option<String>,
    pub detail: Option<String>,
    /// Pourquoi le suivi est partiel ou l'heure approximative.
    pub note: Option<String>,
}

#[derive(Clone, Debug)]
pub struct NouvelEvenement {
    pub categorie: String,
    pub action: String,
    /// Heure réelle de l'événement ; `None` si elle est inconnue (ex. suppression pendant l'arrêt de l'app).
    pub evenement: Option<Horodatage>,
    pub detection: Horodatage,
    pub partiel: bool,
    pub contenu: ContenuEvenement,
    /// Identifiant pour ne pas enregistrer deux fois le même événement (ex. numéro d'enregistrement Windows).
    pub unique: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Evenement {
    pub id: i64,
    pub categorie: String,
    pub action: String,
    pub evenement: Option<Horodatage>,
    pub detection: Horodatage,
    pub partiel: bool,
    pub contenu: ContenuEvenement,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Filtre {
    pub du_ms: Option<i64>,
    pub au_ms: Option<i64>,
    pub mots: String,
    pub categorie: Option<String>,
    /// Événements : catégories à ne pas montrer (ex. « composant »), sauf si `categorie` les demande.
    pub exclure_categories: Vec<String>,
    /// Événements : programme (« chrome.exe ») ; messages : service (« whatsapp »).
    pub appli: Option<String>,
    pub conversation: Option<i64>,
    pub limite: Option<u32>,
    /// Pagination : résultats strictement plus anciens que cet identifiant.
    pub avant_id: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationVue {
    pub id: i64,
    pub appli: String,
    pub nom: String,
    pub messages: i64,
    pub premier_ms: Option<i64>,
    pub dernier_ms: Option<i64>,
    pub supprimes: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionVue {
    pub texte: String,
    pub statut: String,
    pub modifie: Option<Horodatage>,
    pub archive_ms: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PieceVue {
    pub id: i64,
    pub nom: String,
    pub taille: Option<i64>,
    pub disponible: bool,
    pub note: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageVue {
    pub id: i64,
    pub conversation: i64,
    pub conversation_nom: String,
    pub appli: String,
    pub auteur: Option<String>,
    pub envoi: Horodatage,
    pub archive_ms: i64,
    pub etat: String,
    pub etat_ms: Option<i64>,
    pub etat_note: Option<String>,
    /// De la plus ancienne à la plus récente.
    pub versions: Vec<VersionVue>,
    pub pieces: Vec<PieceVue>,
    pub details: Vec<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RapportImport {
    pub appli: String,
    pub conversations: usize,
    pub messages_lus: usize,
    pub nouveaux: usize,
    pub inchanges: usize,
    pub nouvelles_versions: usize,
    pub suppressions_signalees: usize,
    pub absences_constatees: usize,
    pub reapparus: usize,
    pub pieces_archivees: usize,
    pub pieces_manquantes: usize,
    pub avertissements: Vec<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Statistiques {
    pub evenements: i64,
    pub conversations: i64,
    pub messages: i64,
    pub premier_evenement_ms: Option<i64>,
    pub taille_octets: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgrammeVue {
    pub analyse: crate::securite::Analyse,
    /// Taille et date du fichier lors de l'analyse : une mise à jour du programme relance l'analyse.
    pub empreinte_fichier: String,
    pub premiere_vue_ms: i64,
    pub derniere_vue_ms: i64,
}

#[derive(Serialize, Deserialize)]
struct ProgrammeScelle {
    analyse: crate::securite::Analyse,
    empreinte_fichier: String,
}

pub struct Archive {
    db: Connection,
    cles: Cles,
    dossier: PathBuf,
}

const SCHEMA: &str = r#"
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA secure_delete = ON;
CREATE TABLE IF NOT EXISTS reglages (cle TEXT PRIMARY KEY, valeur TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS evenements (
  id INTEGER PRIMARY KEY,
  categorie TEXT NOT NULL,
  action TEXT NOT NULL,
  evt_ms INTEGER, evt_decalage INTEGER, evt_fuseau TEXT, evt_precision TEXT,
  det_ms INTEGER NOT NULL, det_decalage INTEGER NOT NULL, det_fuseau TEXT NOT NULL,
  partiel INTEGER NOT NULL DEFAULT 0,
  appli BLOB,
  unique_ BLOB UNIQUE,
  contenu BLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS evenements_quand ON evenements (COALESCE(evt_ms, det_ms));
CREATE INDEX IF NOT EXISTS evenements_appli ON evenements (appli);
CREATE TABLE IF NOT EXISTS termes (etiquette BLOB NOT NULL, genre INTEGER NOT NULL, ref INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS termes_etiquette ON termes (etiquette, genre);
CREATE INDEX IF NOT EXISTS termes_ref ON termes (genre, ref);
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY, appli TEXT NOT NULL, empreinte BLOB NOT NULL UNIQUE, nom BLOB NOT NULL,
  taille INTEGER NOT NULL, importe_ms INTEGER NOT NULL, fichier TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY, appli TEXT NOT NULL, cle BLOB NOT NULL, nom BLOB NOT NULL,
  premier_import_ms INTEGER NOT NULL, dernier_import_ms INTEGER NOT NULL, UNIQUE (appli, cle)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  conversation INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  cle BLOB NOT NULL,
  ordre INTEGER NOT NULL,
  envoi_ms INTEGER NOT NULL, envoi_decalage INTEGER NOT NULL, envoi_fuseau TEXT NOT NULL, envoi_precision TEXT NOT NULL,
  archive_ms INTEGER NOT NULL,
  auteur BLOB,
  details BLOB,
  etat TEXT NOT NULL, etat_ms INTEGER, etat_note TEXT,
  UNIQUE (conversation, cle)
);
CREATE INDEX IF NOT EXISTS messages_envoi ON messages (conversation, envoi_ms, ordre);
CREATE TABLE IF NOT EXISTS versions (
  id INTEGER PRIMARY KEY,
  message INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  texte BLOB NOT NULL, empreinte BLOB NOT NULL, statut TEXT NOT NULL,
  modif_ms INTEGER, modif_decalage INTEGER, modif_fuseau TEXT, modif_precision TEXT,
  archive_ms INTEGER NOT NULL, source INTEGER REFERENCES sources(id)
);
CREATE INDEX IF NOT EXISTS versions_message ON versions (message);
CREATE TABLE IF NOT EXISTS pieces (
  id INTEGER PRIMARY KEY,
  message INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  nom BLOB NOT NULL, fichier TEXT, taille INTEGER, note TEXT, empreinte BLOB
);
CREATE INDEX IF NOT EXISTS pieces_message ON pieces (message);
CREATE TABLE IF NOT EXISTS programmes (
  cle BLOB PRIMARY KEY, niveau TEXT NOT NULL, premiere_vue_ms INTEGER NOT NULL, derniere_vue_ms INTEGER NOT NULL,
  contenu BLOB NOT NULL
);
"#;

fn h_depuis(ms: Option<i64>, dec: Option<i64>, fuseau: Option<String>, prec: Option<String>) -> Option<Horodatage> {
    Some(Horodatage {
        utc_ms: ms?,
        decalage_min: dec.unwrap_or(0) as i32,
        fuseau: fuseau.unwrap_or_default(),
        precision: prec.unwrap_or_default(),
    })
}

impl Archive {
    /// Ouvre (ou crée) l'archive dans `dossier` avec la clé maîtresse donnée.
    pub fn ouvrir(dossier: &Path, maitre: &[u8; 32]) -> Resultat<Self> {
        std::fs::create_dir_all(dossier)?;
        let db = Connection::open(dossier.join("archive.sqlite"))?;
        db.execute_batch(SCHEMA)?;
        let a = Archive { db, cles: Cles::depuis_maitre(maitre), dossier: dossier.to_path_buf() };
        a.verifier_cle()?;
        Ok(a)
    }

    /// Une valeur témoin chiffrée détecte tout de suite une mauvaise clé (au lieu d'archiver avec une autre).
    fn verifier_cle(&self) -> Resultat<()> {
        let temoin: Option<String> =
            self.db.query_row("SELECT valeur FROM reglages WHERE cle = 'temoin'", [], |r| r.get(0)).optional()?;
        match temoin {
            Some(t) => {
                let b = hex::decode(t).map_err(|_| Erreur::Chiffrement("témoin illisible".into()))?;
                if self.cles.ouvrir(&b)? != b"rayans-journal" {
                    return Err(Erreur::Chiffrement("clé de l'archive incorrecte".into()));
                }
            }
            None => {
                let t = hex::encode(self.cles.sceller(b"rayans-journal"));
                self.db.execute("INSERT INTO reglages (cle, valeur) VALUES ('temoin', ?1)", [t])?;
            }
        }
        Ok(())
    }

    pub fn dossier(&self) -> &Path {
        &self.dossier
    }

    pub fn reglage(&self, cle: &str) -> Resultat<Option<String>> {
        Ok(self.db.query_row("SELECT valeur FROM reglages WHERE cle = ?1", [cle], |r| r.get(0)).optional()?)
    }

    pub fn definir_reglage(&self, cle: &str, valeur: &str) -> Resultat<()> {
        self.db.execute(
            "INSERT INTO reglages (cle, valeur) VALUES (?1, ?2) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur",
            params![cle, valeur],
        )?;
        Ok(())
    }

    fn indexer(&self, genre: i64, reference: i64, texte: &str) -> Resultat<()> {
        let mut termes = BTreeSet::new();
        for m in mots(texte) {
            for t in termes_index(&m) {
                termes.insert(t);
            }
        }
        let mut st = self.db.prepare_cached("INSERT INTO termes (etiquette, genre, ref) VALUES (?1, ?2, ?3)")?;
        for t in termes {
            st.execute(params![self.cles.etiquette("mot", &t), genre, reference])?;
        }
        Ok(())
    }

    /// Références dont le texte indexé contient tous les mots de la requête (`None` = pas de mot cherché).
    fn candidats(&self, genre: i64, requete: &str) -> Resultat<Option<HashSet<i64>>> {
        let q = mots(requete);
        if q.is_empty() {
            return Ok(None);
        }
        let mut st = self.db.prepare_cached("SELECT ref FROM termes WHERE etiquette = ?1 AND genre = ?2")?;
        let mut ensemble: Option<HashSet<i64>> = None;
        for m in q {
            let e = self.cles.etiquette("mot", &terme_requete(&m));
            let refs: HashSet<i64> = st.query_map(params![e, genre], |r| r.get(0))?.collect::<Result<_, _>>()?;
            ensemble = Some(match ensemble {
                None => refs,
                Some(s) => s.intersection(&refs).copied().collect(),
            });
        }
        Ok(ensemble)
    }

    // -------------------------------------------------------------------------------------------
    // Journal d'activité
    // -------------------------------------------------------------------------------------------

    /// Enregistre un événement. Renvoie `None` s'il était déjà enregistré (même identifiant unique).
    pub fn ajouter_evenement(&self, e: &NouvelEvenement) -> Resultat<Option<i64>> {
        let unique = e.unique.as_ref().map(|u| self.cles.etiquette("unique", u));
        if let Some(u) = &unique {
            let deja: Option<i64> =
                self.db.query_row("SELECT id FROM evenements WHERE unique_ = ?1", [u], |r| r.get(0)).optional()?;
            if deja.is_some() {
                return Ok(None);
            }
        }
        let contenu = serde_json::to_vec(&e.contenu)?;
        let appli = e.contenu.appli.as_ref().map(|a| self.cles.etiquette("appli", &a.to_lowercase()));
        let ev = e.evenement.as_ref();
        self.db.execute(
            "INSERT INTO evenements (categorie, action, evt_ms, evt_decalage, evt_fuseau, evt_precision,
               det_ms, det_decalage, det_fuseau, partiel, appli, unique_, contenu)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                e.categorie,
                e.action,
                ev.map(|h| h.utc_ms),
                ev.map(|h| h.decalage_min),
                ev.map(|h| h.fuseau.clone()),
                ev.map(|h| h.precision.clone()),
                e.detection.utc_ms,
                e.detection.decalage_min,
                e.detection.fuseau,
                e.partiel,
                appli,
                unique,
                self.cles.sceller(&contenu),
            ],
        )?;
        let id = self.db.last_insert_rowid();
        let c = &e.contenu;
        let texte = [
            Some(e.categorie.as_str()),
            Some(e.action.as_str()),
            Some(c.sujet.as_str()),
            c.appli.as_deref(),
            c.chemin.as_deref(),
            c.ancien_chemin.as_deref(),
            c.detail.as_deref(),
        ]
        .iter()
        .flatten()
        .copied()
        .collect::<Vec<_>>()
        .join(" ");
        self.indexer(GENRE_EVENEMENT, id, &texte)?;
        Ok(Some(id))
    }

    fn lire_evenement(&self, r: &rusqlite::Row) -> rusqlite::Result<(Evenement, Vec<u8>)> {
        Ok((
            Evenement {
                id: r.get(0)?,
                categorie: r.get(1)?,
                action: r.get(2)?,
                evenement: h_depuis(r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?),
                detection: Horodatage {
                    utc_ms: r.get(7)?,
                    decalage_min: r.get(8)?,
                    fuseau: r.get(9)?,
                    precision: crate::temps::precision::MILLISECONDE.into(),
                },
                partiel: r.get(10)?,
                contenu: ContenuEvenement::default(),
            },
            r.get(11)?,
        ))
    }

    pub fn chercher_evenements(&self, f: &Filtre) -> Resultat<Vec<Evenement>> {
        let cand = self.candidats(GENRE_EVENEMENT, &f.mots)?;
        let limite = f.limite.unwrap_or(200).min(5000) as usize;
        let mut sql = String::from(
            "SELECT id, categorie, action, evt_ms, evt_decalage, evt_fuseau, evt_precision, det_ms, det_decalage,
                    det_fuseau, partiel, contenu FROM evenements WHERE 1=1",
        );
        let mut p: Vec<rusqlite::types::Value> = Vec::new();
        if let Some(d) = f.du_ms {
            sql.push_str(" AND COALESCE(evt_ms, det_ms) >= ?");
            p.push(d.into());
        }
        if let Some(a) = f.au_ms {
            sql.push_str(" AND COALESCE(evt_ms, det_ms) < ?");
            p.push(a.into());
        }
        if let Some(c) = f.categorie.as_ref().filter(|c| !c.is_empty()) {
            sql.push_str(" AND categorie = ?");
            p.push(c.clone().into());
        }
        for x in &f.exclure_categories {
            if f.categorie.as_deref() != Some(x.as_str()) {
                sql.push_str(" AND categorie != ?");
                p.push(x.clone().into());
            }
        }
        if let Some(a) = f.appli.as_ref().filter(|a| !a.is_empty()) {
            sql.push_str(" AND appli = ?");
            p.push(self.cles.etiquette("appli", &a.to_lowercase()).into());
        }
        if let Some(a) = f.avant_id {
            sql.push_str(" AND id < ?");
            p.push(a.into());
        }
        sql.push_str(" ORDER BY COALESCE(evt_ms, det_ms) DESC, id DESC");
        let mut st = self.db.prepare(&sql)?;
        let mut lignes = st.query(rusqlite::params_from_iter(p))?;
        let mut out = Vec::new();
        while let Some(r) = lignes.next()? {
            let id: i64 = r.get(0)?;
            if cand.as_ref().is_some_and(|c| !c.contains(&id)) {
                continue;
            }
            let (mut e, scelle) = self.lire_evenement(r)?;
            e.contenu = serde_json::from_slice(&self.cles.ouvrir(&scelle)?)?;
            if !f.mots.trim().is_empty() {
                let c = &e.contenu;
                let tout = format!(
                    "{} {} {} {} {} {} {}",
                    e.categorie,
                    e.action,
                    c.sujet,
                    c.appli.as_deref().unwrap_or(""),
                    c.chemin.as_deref().unwrap_or(""),
                    c.ancien_chemin.as_deref().unwrap_or(""),
                    c.detail.as_deref().unwrap_or("")
                );
                if !correspond(&tout, &f.mots) {
                    continue;
                }
            }
            out.push(e);
            if out.len() >= limite {
                break;
            }
        }
        Ok(out)
    }

    /// Tous les événements des catégories données entre `du` et `au`, du plus ancien au plus récent
    /// (calculs de temps d'écran, historique des fichiers).
    pub fn evenements_periode(&self, du: i64, au: i64, categories: &[&str]) -> Resultat<Vec<Evenement>> {
        let marques = categories.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT id, categorie, action, evt_ms, evt_decalage, evt_fuseau, evt_precision, det_ms, det_decalage,
                    det_fuseau, partiel, contenu FROM evenements
             WHERE COALESCE(evt_ms, det_ms) >= ? AND COALESCE(evt_ms, det_ms) < ? AND categorie IN ({marques})
             ORDER BY COALESCE(evt_ms, det_ms), id"
        );
        let mut p: Vec<rusqlite::types::Value> = vec![du.into(), au.into()];
        p.extend(categories.iter().map(|c| rusqlite::types::Value::from(c.to_string())));
        let mut st = self.db.prepare(&sql)?;
        let mut lignes = st.query(rusqlite::params_from_iter(p))?;
        let mut out = Vec::new();
        while let Some(r) = lignes.next()? {
            let (mut e, scelle) = self.lire_evenement(r)?;
            e.contenu = serde_json::from_slice(&self.cles.ouvrir(&scelle)?)?;
            out.push(e);
        }
        Ok(out)
    }

    // -------------------------------------------------------------------------------------------
    // Conversations
    // -------------------------------------------------------------------------------------------

    fn archiver_fichier(&self, sous_dossier: &str, contenu: &[u8]) -> Resultat<(Vec<u8>, String)> {
        let sha = hex::encode(Sha256::digest(contenu));
        let etiquette = self.cles.etiquette("fichier", &sha);
        let nom = format!("{sous_dossier}/{}.rjf", hex::encode(&etiquette));
        let chemin = self.dossier.join(&nom);
        if !chemin.exists() {
            self.cles.sceller_fichier(contenu, &chemin)?;
        }
        Ok((etiquette, nom))
    }

    /// Archive un lot lu dans un export. Les fichiers sources et les pièces jointes sont lus dans `paquet`.
    pub fn importer(&mut self, lot: &Lot, paquet: &dyn Paquet, nom_paquet: &str, maintenant_ms: i64) -> Resultat<RapportImport> {
        let mut rapport = RapportImport {
            appli: lot.appli.clone(),
            conversations: lot.conversations.len(),
            avertissements: lot.avertissements.clone(),
            ..Default::default()
        };
        // Fichiers bruts (avant la transaction : ils ne dépendent pas de la base).
        let mut sources = Vec::new();
        for s in &lot.sources {
            let octets = paquet.lire(s)?;
            let (empreinte, fichier) = self.archiver_fichier("sources", &octets)?;
            sources.push((s.clone(), octets.len(), empreinte, fichier));
        }
        let mut pieces_fichiers: HashMap<String, (Vec<u8>, String, i64)> = HashMap::new();
        for c in &lot.conversations {
            for m in &c.messages {
                for p in &m.pieces {
                    if let Some(ch) = &p.chemin {
                        if !pieces_fichiers.contains_key(ch) {
                            match paquet.lire(ch) {
                                Ok(o) => {
                                    let (e, f) = self.archiver_fichier("pieces", &o)?;
                                    pieces_fichiers.insert(ch.clone(), (e, f, o.len() as i64));
                                }
                                Err(_) => rapport.avertissements.push(format!("Pièce jointe illisible : {ch}")),
                            }
                        }
                    }
                }
            }
        }
        let cles = &self.cles;
        let tx = self.db.transaction()?;
        let mut source_id = None;
        for (nom, taille, empreinte, fichier) in &sources {
            let existant: Option<i64> =
                tx.query_row("SELECT id FROM sources WHERE empreinte = ?1", [empreinte], |r| r.get(0)).optional()?;
            let id = match existant {
                Some(id) => id,
                None => {
                    tx.execute(
                        "INSERT INTO sources (appli, empreinte, nom, taille, importe_ms, fichier) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                        params![lot.appli, empreinte, cles.sceller_texte(&format!("{nom_paquet} › {nom}")), *taille as i64, maintenant_ms, fichier],
                    )?;
                    tx.last_insert_rowid()
                }
            };
            source_id.get_or_insert(id);
        }
        let quand = Horodatage::en_local(maintenant_ms, crate::temps::precision::MILLISECONDE).lisible();
        let mut a_indexer: Vec<(i64, String)> = Vec::new();
        for conv in &lot.conversations {
            let cle_conv = cles.etiquette("conversation", &conv.cle);
            let conv_id: i64 = match tx
                .query_row("SELECT id FROM conversations WHERE appli = ?1 AND cle = ?2", params![lot.appli, cle_conv], |r| r.get(0))
                .optional()?
            {
                Some(id) => {
                    tx.execute(
                        "UPDATE conversations SET nom = ?1, dernier_import_ms = ?2 WHERE id = ?3",
                        params![cles.sceller_texte(&conv.nom), maintenant_ms, id],
                    )?;
                    id
                }
                None => {
                    tx.execute(
                        "INSERT INTO conversations (appli, cle, nom, premier_import_ms, dernier_import_ms) VALUES (?1, ?2, ?3, ?4, ?4)",
                        params![lot.appli, cle_conv, cles.sceller_texte(&conv.nom), maintenant_ms],
                    )?;
                    tx.last_insert_rowid()
                }
            };
            let mut vus: HashSet<Vec<u8>> = HashSet::new();
            for (ordre, m) in conv.messages.iter().enumerate() {
                rapport.messages_lus += 1;
                let cle_msg = cles.etiquette("message", &m.cle);
                vus.insert(cle_msg.clone());
                let empreinte = cles.etiquette("texte", &m.texte);
                let existant: Option<(i64, String)> = tx
                    .query_row(
                        "SELECT id, etat FROM messages WHERE conversation = ?1 AND cle = ?2",
                        params![conv_id, cle_msg],
                        |r| Ok((r.get(0)?, r.get(1)?)),
                    )
                    .optional()?;
                let modif = m.modifie.as_ref();
                let inserer_version = |tx: &rusqlite::Transaction, msg: i64, st: &str| -> rusqlite::Result<()> {
                    tx.execute(
                        "INSERT INTO versions (message, texte, empreinte, statut, modif_ms, modif_decalage, modif_fuseau, modif_precision, archive_ms, source)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                        params![
                            msg,
                            cles.sceller_texte(&m.texte),
                            empreinte,
                            st,
                            modif.map(|h| h.utc_ms),
                            modif.map(|h| h.decalage_min),
                            modif.map(|h| h.fuseau.clone()),
                            modif.map(|h| h.precision.clone()),
                            maintenant_ms,
                            source_id
                        ],
                    )?;
                    Ok(())
                };
                match existant {
                    None => {
                        let (etat, note) = if m.suppression_mentionnee {
                            rapport.suppressions_signalees += 1;
                            (
                                etat::SUPPRESSION_SIGNALEE,
                                Some("Déjà supprimé lors du premier archivage : le texte d'origine n'est pas disponible.".to_string()),
                            )
                        } else {
                            (etat::PRESENT, None)
                        };
                        let details = (!m.details.is_empty()).then(|| cles.sceller(&serde_json::to_vec(&m.details).unwrap()));
                        tx.execute(
                            "INSERT INTO messages (conversation, cle, ordre, envoi_ms, envoi_decalage, envoi_fuseau, envoi_precision, archive_ms, auteur, details, etat, etat_ms, etat_note)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                            params![
                                conv_id,
                                cle_msg,
                                ordre as i64,
                                m.envoi.utc_ms,
                                m.envoi.decalage_min,
                                m.envoi.fuseau,
                                m.envoi.precision,
                                maintenant_ms,
                                m.auteur.as_ref().map(|a| cles.sceller_texte(a)),
                                details,
                                etat,
                                note.as_ref().map(|_| maintenant_ms),
                                note
                            ],
                        )?;
                        let id = tx.last_insert_rowid();
                        let st = if m.suppression_mentionnee {
                            statut::MENTION_SUPPRESSION
                        } else if m.marque_modifie || m.modifie.is_some() {
                            statut::MODIFIEE_AVANT
                        } else {
                            statut::ORIGINAL
                        };
                        inserer_version(&tx, id, st)?;
                        for p in &m.pieces {
                            let f = p.chemin.as_ref().and_then(|c| pieces_fichiers.get(c));
                            if f.is_some() {
                                rapport.pieces_archivees += 1;
                            } else {
                                rapport.pieces_manquantes += 1;
                            }
                            tx.execute(
                                "INSERT INTO pieces (message, nom, fichier, taille, note, empreinte) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                                params![id, cles.sceller_texte(&p.nom), f.map(|x| x.1.clone()), f.map(|x| x.2), p.note, f.map(|x| x.0.clone())],
                            )?;
                        }
                        a_indexer.push((id, format!("{} {}", m.auteur.as_deref().unwrap_or(""), m.texte)));
                        rapport.nouveaux += 1;
                    }
                    Some((id, etat_actuel)) => {
                        let derniere: Vec<u8> = tx.query_row(
                            "SELECT empreinte FROM versions WHERE message = ?1 ORDER BY id DESC LIMIT 1",
                            [id],
                            |r| r.get(0),
                        )?;
                        if etat_actuel == etat::ABSENT && !m.suppression_mentionnee {
                            tx.execute(
                                "UPDATE messages SET etat = ?1, etat_ms = ?2, etat_note = ?3 WHERE id = ?4",
                                params![etat::PRESENT, maintenant_ms, format!("De nouveau présent dans l'export importé le {quand}."), id],
                            )?;
                            rapport.reapparus += 1;
                        }
                        if m.suppression_mentionnee {
                            if etat_actuel != etat::SUPPRESSION_SIGNALEE {
                                tx.execute(
                                    "UPDATE messages SET etat = ?1, etat_ms = ?2, etat_note = ?3 WHERE id = ?4",
                                    params![
                                        etat::SUPPRESSION_SIGNALEE,
                                        maintenant_ms,
                                        format!("L'application indique que ce message a été supprimé (constaté à l'import du {quand}). Le texte archivé avant la suppression est conservé."),
                                        id
                                    ],
                                )?;
                                rapport.suppressions_signalees += 1;
                            }
                            if derniere != empreinte {
                                inserer_version(&tx, id, statut::MENTION_SUPPRESSION)?;
                            }
                        } else if derniere != empreinte {
                            inserer_version(&tx, id, statut::MODIFIEE)?;
                            a_indexer.push((id, m.texte.clone()));
                            rapport.nouvelles_versions += 1;
                        } else {
                            rapport.inchanges += 1;
                        }
                    }
                }
            }
            // Messages archivés, dans la période couverte par cet export, qui n'y figurent plus.
            if let (Some(min), Some(max)) =
                (conv.messages.iter().map(|m| m.envoi.utc_ms).min(), conv.messages.iter().map(|m| m.envoi.utc_ms).max())
            {
                let absents: Vec<(i64, Vec<u8>)> = {
                    let mut st = tx.prepare(
                        "SELECT id, cle FROM messages WHERE conversation = ?1 AND etat = ?2 AND envoi_ms BETWEEN ?3 AND ?4",
                    )?;
                    let r = st.query_map(params![conv_id, etat::PRESENT, min, max], |r| Ok((r.get(0)?, r.get(1)?)))?;
                    r.collect::<Result<Vec<_>, _>>()?.into_iter().filter(|(_, c)| !vus.contains(c)).collect()
                };
                for (id, _) in absents {
                    tx.execute(
                        "UPDATE messages SET etat = ?1, etat_ms = ?2, etat_note = ?3 WHERE id = ?4",
                        params![
                            etat::ABSENT,
                            maintenant_ms,
                            format!("Absent de l'export importé le {quand} (supprimé, ou exporté autrement). Le texte archivé est conservé ; l'application n'a pas signalé de suppression."),
                            id
                        ],
                    )?;
                    rapport.absences_constatees += 1;
                }
            }
        }
        tx.commit()?;
        for (id, t) in a_indexer {
            self.indexer(GENRE_MESSAGE, id, &t)?;
        }
        Ok(rapport)
    }

    pub fn conversations(&self, appli: Option<&str>) -> Resultat<Vec<ConversationVue>> {
        let mut st = self.db.prepare(
            "SELECT c.id, c.appli, c.nom, COUNT(m.id), MIN(m.envoi_ms), MAX(m.envoi_ms),
                    SUM(CASE WHEN m.etat != 'present' THEN 1 ELSE 0 END)
             FROM conversations c LEFT JOIN messages m ON m.conversation = c.id
             WHERE (?1 IS NULL OR c.appli = ?1) GROUP BY c.id",
        )?;
        let lignes = st.query_map([appli], |r| {
            Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, Vec<u8>>(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get::<_, Option<i64>>(6)?))
        })?;
        let mut out = Vec::new();
        for l in lignes {
            let (id, appli, nom, n, a, b, s) = l?;
            out.push(ConversationVue {
                id,
                appli,
                nom: self.cles.ouvrir_texte(&nom)?,
                messages: n,
                premier_ms: a,
                dernier_ms: b,
                supprimes: s.unwrap_or(0),
            });
        }
        out.sort_by(|a, b| b.dernier_ms.cmp(&a.dernier_ms));
        Ok(out)
    }

    fn vue_message(&self, id: i64) -> Resultat<MessageVue> {
        let (conv, cnom, appli, auteur, envoi, archive_ms, etat, etat_ms, etat_note, details) = self.db.query_row(
            "SELECT m.conversation, c.nom, c.appli, m.auteur, m.envoi_ms, m.envoi_decalage, m.envoi_fuseau, m.envoi_precision,
                    m.archive_ms, m.etat, m.etat_ms, m.etat_note, m.details
             FROM messages m JOIN conversations c ON c.id = m.conversation WHERE m.id = ?1",
            [id],
            |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, Vec<u8>>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, Option<Vec<u8>>>(3)?,
                    Horodatage { utc_ms: r.get(4)?, decalage_min: r.get(5)?, fuseau: r.get(6)?, precision: r.get(7)? },
                    r.get::<_, i64>(8)?,
                    r.get::<_, String>(9)?,
                    r.get::<_, Option<i64>>(10)?,
                    r.get::<_, Option<String>>(11)?,
                    r.get::<_, Option<Vec<u8>>>(12)?,
                ))
            },
        )?;
        let mut st = self.db.prepare_cached(
            "SELECT texte, statut, modif_ms, modif_decalage, modif_fuseau, modif_precision, archive_ms FROM versions WHERE message = ?1 ORDER BY id",
        )?;
        let versions = st
            .query_map([id], |r| {
                Ok((r.get::<_, Vec<u8>>(0)?, r.get::<_, String>(1)?, h_depuis(r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?), r.get::<_, i64>(6)?))
            })?
            .collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .map(|(t, s, h, a)| Ok(VersionVue { texte: self.cles.ouvrir_texte(&t)?, statut: s, modifie: h, archive_ms: a }))
            .collect::<Resultat<Vec<_>>>()?;
        let mut st = self.db.prepare_cached("SELECT id, nom, fichier, taille, note FROM pieces WHERE message = ?1 ORDER BY id")?;
        let pieces = st
            .query_map([id], |r| {
                Ok((r.get::<_, i64>(0)?, r.get::<_, Vec<u8>>(1)?, r.get::<_, Option<String>>(2)?, r.get::<_, Option<i64>>(3)?, r.get::<_, Option<String>>(4)?))
            })?
            .collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .map(|(pid, n, f, t, note)| {
                Ok(PieceVue { id: pid, nom: self.cles.ouvrir_texte(&n)?, taille: t, disponible: f.is_some_and(|f| self.dossier.join(f).exists()), note })
            })
            .collect::<Resultat<Vec<_>>>()?;
        Ok(MessageVue {
            id,
            conversation: conv,
            conversation_nom: self.cles.ouvrir_texte(&cnom)?,
            appli,
            auteur: auteur.map(|a| self.cles.ouvrir_texte(&a)).transpose()?,
            envoi,
            archive_ms,
            etat,
            etat_ms,
            etat_note,
            versions,
            pieces,
            details: match details {
                Some(d) => serde_json::from_slice(&self.cles.ouvrir(&d)?)?,
                None => vec![],
            },
        })
    }

    /// Messages filtrés par date, service, conversation et mots. Avec une conversation et sans mot :
    /// ordre chronologique ; sinon : du plus récent au plus ancien.
    pub fn chercher_messages(&self, f: &Filtre) -> Resultat<Vec<MessageVue>> {
        let cand = self.candidats(GENRE_MESSAGE, &f.mots)?;
        let limite = f.limite.unwrap_or(200).min(5000) as usize;
        let chrono = f.conversation.is_some() && f.mots.trim().is_empty();
        let mut sql = String::from("SELECT m.id FROM messages m JOIN conversations c ON c.id = m.conversation WHERE 1=1");
        let mut p: Vec<rusqlite::types::Value> = Vec::new();
        if let Some(d) = f.du_ms {
            sql.push_str(" AND m.envoi_ms >= ?");
            p.push(d.into());
        }
        if let Some(a) = f.au_ms {
            sql.push_str(" AND m.envoi_ms < ?");
            p.push(a.into());
        }
        if let Some(a) = f.appli.as_ref().filter(|a| !a.is_empty()) {
            sql.push_str(" AND c.appli = ?");
            p.push(a.clone().into());
        }
        if let Some(c) = f.conversation {
            sql.push_str(" AND m.conversation = ?");
            p.push(c.into());
        }
        if let Some(e) = f.categorie.as_ref().filter(|c| !c.is_empty()) {
            // Pour les messages, « catégorie » filtre l'état (present, suppression_signalee, absent_constate, modifie).
            if e == "modifie" {
                sql.push_str(" AND EXISTS (SELECT 1 FROM versions v WHERE v.message = m.id AND v.statut IN ('modifiee', 'modifiee_avant_archivage'))");
            } else if e == "supprime" {
                sql.push_str(" AND m.etat != 'present'");
            } else {
                sql.push_str(" AND m.etat = ?");
                p.push(e.clone().into());
            }
        }
        if chrono {
            if let Some(a) = f.avant_id {
                sql.push_str(" AND m.id > ?");
                p.push(a.into());
            }
            sql.push_str(" ORDER BY m.envoi_ms, m.ordre, m.id");
        } else {
            if let Some(a) = f.avant_id {
                sql.push_str(" AND m.id < ?");
                p.push(a.into());
            }
            sql.push_str(" ORDER BY m.envoi_ms DESC, m.id DESC");
        }
        let ids: Vec<i64> = {
            let mut st = self.db.prepare(&sql)?;
            let r = st.query_map(rusqlite::params_from_iter(p), |r| r.get(0))?;
            r.collect::<Result<_, _>>()?
        };
        let mut out = Vec::new();
        for id in ids {
            if cand.as_ref().is_some_and(|c| !c.contains(&id)) {
                continue;
            }
            let v = self.vue_message(id)?;
            if !f.mots.trim().is_empty() {
                let tout = format!(
                    "{} {}",
                    v.auteur.as_deref().unwrap_or(""),
                    v.versions.iter().map(|x| x.texte.as_str()).collect::<Vec<_>>().join(" ")
                );
                if !correspond(&tout, &f.mots) {
                    continue;
                }
            }
            out.push(v);
            if out.len() >= limite {
                break;
            }
        }
        Ok(out)
    }

    /// Contenu déchiffré d'une pièce jointe archivée.
    pub fn piece(&self, id: i64) -> Resultat<(String, Vec<u8>)> {
        let (nom, fichier): (Vec<u8>, Option<String>) =
            self.db.query_row("SELECT nom, fichier FROM pieces WHERE id = ?1", [id], |r| Ok((r.get(0)?, r.get(1)?)))?;
        let fichier = fichier.ok_or_else(|| Erreur::Format("Cette pièce jointe n'était pas dans l'export.".into()))?;
        Ok((self.cles.ouvrir_texte(&nom)?, self.cles.ouvrir_fichier(&self.dossier.join(fichier))?))
    }

    // -------------------------------------------------------------------------------------------
    // Conservation, suppression, export
    // -------------------------------------------------------------------------------------------

    /// Supprime les événements plus anciens que `avant_ms` (heure de l'événement, ou de détection).
    pub fn purger_evenements(&self, avant_ms: i64) -> Resultat<usize> {
        self.db.execute(
            "DELETE FROM termes WHERE genre = ?1 AND ref IN (SELECT id FROM evenements WHERE COALESCE(evt_ms, det_ms) < ?2)",
            params![GENRE_EVENEMENT, avant_ms],
        )?;
        Ok(self.db.execute("DELETE FROM evenements WHERE COALESCE(evt_ms, det_ms) < ?1", [avant_ms])?)
    }

    /// Supprime les messages envoyés avant `avant_ms`, puis les fichiers chiffrés devenus inutiles.
    pub fn purger_messages(&self, avant_ms: i64) -> Resultat<usize> {
        self.db.execute(
            "DELETE FROM termes WHERE genre = ?1 AND ref IN (SELECT id FROM messages WHERE envoi_ms < ?2)",
            params![GENRE_MESSAGE, avant_ms],
        )?;
        let n = self.db.execute("DELETE FROM messages WHERE envoi_ms < ?1", [avant_ms])?;
        self.nettoyer_fichiers()?;
        Ok(n)
    }

    /// Supprime une conversation entière de l'archive (messages, versions, pièces).
    pub fn supprimer_conversation(&self, id: i64) -> Resultat<()> {
        self.db.execute(
            "DELETE FROM termes WHERE genre = ?1 AND ref IN (SELECT id FROM messages WHERE conversation = ?2)",
            params![GENRE_MESSAGE, id],
        )?;
        self.db.execute("DELETE FROM conversations WHERE id = ?1", [id])?;
        self.nettoyer_fichiers()
    }

    fn nettoyer_fichiers(&self) -> Resultat<()> {
        let utilises: HashSet<String> = {
            let mut st = self.db.prepare("SELECT fichier FROM pieces WHERE fichier IS NOT NULL UNION SELECT fichier FROM sources")?;
            let r = st.query_map([], |r| r.get::<_, String>(0))?;
            r.collect::<Result<_, _>>()?
        };
        let dossier = self.dossier.join("pieces");
        if let Ok(rd) = std::fs::read_dir(&dossier) {
            for e in rd.flatten() {
                let rel = format!("pieces/{}", e.file_name().to_string_lossy());
                if !utilises.contains(&rel) {
                    let _ = std::fs::remove_file(e.path());
                }
            }
        }
        Ok(())
    }

    pub fn statistiques(&self) -> Resultat<Statistiques> {
        let q = |sql: &str| -> Resultat<i64> { Ok(self.db.query_row(sql, [], |r| r.get(0))?) };
        let mut taille = 0u64;
        for d in [self.dossier.clone(), self.dossier.join("pieces"), self.dossier.join("sources")] {
            if let Ok(rd) = std::fs::read_dir(d) {
                for e in rd.flatten() {
                    if let Ok(m) = e.metadata() {
                        if m.is_file() {
                            taille += m.len();
                        }
                    }
                }
            }
        }
        Ok(Statistiques {
            evenements: q("SELECT COUNT(*) FROM evenements")?,
            conversations: q("SELECT COUNT(*) FROM conversations")?,
            messages: q("SELECT COUNT(*) FROM messages")?,
            premier_evenement_ms: self.db.query_row("SELECT MIN(COALESCE(evt_ms, det_ms)) FROM evenements", [], |r| r.get(0))?,
            taille_octets: taille,
        })
    }

    /// Export lisible (non chiffré) : un fichier JSON Lines et une page HTML, pour le filtre donné.
    /// `quoi` : « evenements » ou « messages ». Renvoie les chemins écrits.
    pub fn exporter(&self, quoi: &str, f: &Filtre, dossier: &Path, maintenant_ms: i64) -> Resultat<Vec<PathBuf>> {
        std::fs::create_dir_all(dossier)?;
        let stamp = Horodatage::en_local(maintenant_ms, "").lisible()[..19].replace([':', ' '], "-");
        let mut f = f.clone();
        f.limite = Some(u32::MAX);
        let (jsonl, html) = if quoi == "evenements" {
            let ev = self.chercher_evenements(&f)?;
            let jsonl: String = ev.iter().map(|e| serde_json::to_string(e).unwrap() + "\n").collect();
            let mut h = String::from("<tr><th>Heure de l'événement</th><th>Précision</th><th>Heure de détection</th><th>Type</th><th>Concerné</th><th>Note</th></tr>");
            for e in ev.iter().rev() {
                h.push_str(&format!(
                    "<tr{}><td>{}</td><td>{}</td><td>{}</td><td>{} · {}</td><td>{}</td><td>{}</td></tr>",
                    if e.partiel { " class=p" } else { "" },
                    e.evenement.as_ref().map(|h| h.lisible()).unwrap_or_else(|| "inconnue".into()),
                    esc(e.evenement.as_ref().map(|h| h.precision.as_str()).unwrap_or("")),
                    e.detection.lisible(),
                    esc(&e.categorie),
                    esc(&e.action),
                    esc(&[Some(e.contenu.sujet.as_str()), e.contenu.chemin.as_deref(), e.contenu.ancien_chemin.as_deref().map(|_| "")].iter().flatten().filter(|s| !s.is_empty()).copied().collect::<Vec<_>>().join(" — ")),
                    esc(e.contenu.note.as_deref().unwrap_or("")),
                ));
            }
            (jsonl, h)
        } else {
            let mut ms = self.chercher_messages(&f)?;
            ms.sort_by_key(|m| (m.conversation, m.envoi.utc_ms, m.id));
            let jsonl: String = ms.iter().map(|m| serde_json::to_string(m).unwrap() + "\n").collect();
            let mut h = String::from("<tr><th>Conversation</th><th>Envoyé</th><th>Auteur</th><th>Texte (toutes les versions)</th><th>État</th><th>Archivé</th></tr>");
            for m in &ms {
                let versions: String = m
                    .versions
                    .iter()
                    .map(|v| format!("<div class=v><span class=s>{}</span><pre>{}</pre></div>", esc(&v.statut), esc(&v.texte)))
                    .collect();
                h.push_str(&format!(
                    "<tr><td>{} · {}</td><td>{}<br><small>{}</small></td><td>{}</td><td>{}{}</td><td>{}<br><small>{}</small></td><td>{}</td></tr>",
                    esc(&m.appli),
                    esc(&m.conversation_nom),
                    m.envoi.lisible(),
                    esc(&m.envoi.precision),
                    esc(m.auteur.as_deref().unwrap_or("(système)")),
                    versions,
                    m.pieces.iter().map(|p| format!("<div>📎 {}</div>", esc(&p.nom))).collect::<String>(),
                    esc(&m.etat),
                    esc(m.etat_note.as_deref().unwrap_or("")),
                    Horodatage::en_local(m.archive_ms, "").lisible(),
                ));
            }
            (jsonl, h)
        };
        let base = dossier.join(format!("rayans-journal-{quoi}-{stamp}"));
        let p1 = base.with_extension("jsonl");
        let p2 = base.with_extension("html");
        std::fs::write(&p1, jsonl)?;
        std::fs::write(
            &p2,
            format!(
                "<!doctype html><meta charset=utf-8><title>Rayan's Journal — {quoi}</title><style>body{{font:14px system-ui;margin:24px}}table{{border-collapse:collapse;width:100%}}td,th{{border:1px solid #ccc;padding:6px;vertical-align:top;text-align:left}}pre{{white-space:pre-wrap;margin:0;font:inherit}}.s{{font-size:11px;color:#666}}.p{{background:#fff6dd}}</style><h1>Rayan's Journal — {quoi}</h1><p>Export du {}. Fichier non chiffré : à conserver en lieu sûr.</p><table>{html}</table>",
                Horodatage::en_local(maintenant_ms, "").lisible()
            ),
        )?;
        Ok(vec![p1, p2])
    }

    // -------------------------------------------------------------------------------------------
    // Programmes vus et leur analyse de confiance
    // -------------------------------------------------------------------------------------------

    fn cle_programme(&self, chemin: &str) -> Vec<u8> {
        self.cles.etiquette("programme", &chemin.to_lowercase())
    }

    pub fn programme(&self, chemin: &str) -> Resultat<Option<ProgrammeVue>> {
        let l: Option<(Vec<u8>, i64, i64)> = self
            .db
            .query_row(
                "SELECT contenu, premiere_vue_ms, derniere_vue_ms FROM programmes WHERE cle = ?1",
                [self.cle_programme(chemin)],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .optional()?;
        l.map(|(c, p, d)| self.vue_programme(&c, p, d)).transpose()
    }

    fn vue_programme(&self, contenu: &[u8], premiere: i64, derniere: i64) -> Resultat<ProgrammeVue> {
        let s: ProgrammeScelle = serde_json::from_slice(&self.cles.ouvrir(contenu)?)?;
        Ok(ProgrammeVue { analyse: s.analyse, empreinte_fichier: s.empreinte_fichier, premiere_vue_ms: premiere, derniere_vue_ms: derniere })
    }

    /// Enregistre (ou remplace) l'analyse d'un programme ; la date de première apparition est conservée.
    pub fn enregistrer_programme(&self, a: &crate::securite::Analyse, empreinte_fichier: &str, maintenant_ms: i64) -> Resultat<()> {
        let s = ProgrammeScelle { analyse: a.clone(), empreinte_fichier: empreinte_fichier.into() };
        self.db.execute(
            "INSERT INTO programmes (cle, niveau, premiere_vue_ms, derniere_vue_ms, contenu) VALUES (?1, ?2, ?3, ?3, ?4)
             ON CONFLICT(cle) DO UPDATE SET niveau = excluded.niveau, derniere_vue_ms = excluded.derniere_vue_ms, contenu = excluded.contenu",
            params![self.cle_programme(&a.chemin), a.niveau.code(), maintenant_ms, self.cles.sceller(&serde_json::to_vec(&s)?)],
        )?;
        Ok(())
    }

    pub fn programme_vu(&self, chemin: &str, maintenant_ms: i64) -> Resultat<()> {
        self.db.execute("UPDATE programmes SET derniere_vue_ms = ?1 WHERE cle = ?2", params![maintenant_ms, self.cle_programme(chemin)])?;
        Ok(())
    }

    pub fn nombre_programmes(&self) -> Resultat<i64> {
        Ok(self.db.query_row("SELECT COUNT(*) FROM programmes", [], |r| r.get(0))?)
    }

    /// Tous les programmes analysés, les plus inquiétants d'abord.
    pub fn programmes(&self) -> Resultat<Vec<ProgrammeVue>> {
        let mut st = self.db.prepare(
            "SELECT contenu, premiere_vue_ms, derniere_vue_ms FROM programmes
             ORDER BY CASE niveau WHEN 'suspect' THEN 0 WHEN 'a_verifier' THEN 1 WHEN 'inconnu' THEN 2 ELSE 3 END, derniere_vue_ms DESC",
        )?;
        let l = st.query_map([], |r| Ok((r.get::<_, Vec<u8>>(0)?, r.get(1)?, r.get(2)?)))?.collect::<Result<Vec<_>, _>>()?;
        l.into_iter().map(|(c, p, d)| self.vue_programme(&c, p, d)).collect()
    }

    /// Fichier interne chiffré (ex. état des dossiers surveillés pour le rattrapage au démarrage).
    pub fn ecrire_prive(&self, nom: &str, contenu: &[u8]) -> Resultat<()> {
        self.cles.sceller_fichier(contenu, &self.dossier.join(nom))
    }

    pub fn lire_prive(&self, nom: &str) -> Resultat<Option<Vec<u8>>> {
        let p = self.dossier.join(nom);
        if !p.exists() {
            return Ok(None);
        }
        Ok(Some(self.cles.ouvrir_fichier(&p)?))
    }

    /// Lecture brute du fichier de base (tests : vérifier qu'aucun texte n'y est en clair).
    pub fn chemin_base(&self) -> PathBuf {
        self.dossier.join("archive.sqlite")
    }

    pub fn point_de_controle(&self) -> Resultat<()> {
        self.db.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;
        Ok(())
    }
}

fn esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}
