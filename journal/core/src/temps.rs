//! Horodatages : un instant UTC à la milliseconde, le décalage local à cet instant, le nom du fuseau et la
//! précision réelle de la mesure. L'heure d'un événement et l'heure de sa détection sont toujours deux
//! horodatages distincts.

use chrono::{DateTime, Local, LocalResult, NaiveDateTime, Offset, TimeZone, Utc};
use serde::{Deserialize, Serialize};

pub mod precision {
    pub const MILLISECONDE: &str = "exacte (milliseconde)";
    pub const SECONDE: &str = "à la seconde";
    pub const MINUTE: &str = "à la minute";
    pub const INCONNUE: &str = "inconnue";
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Horodatage {
    pub utc_ms: i64,
    /// Décalage par rapport à UTC en minutes, à cet instant (ex. 60 en hiver à Paris, 120 en été).
    pub decalage_min: i32,
    /// Fuseau IANA (ex. « Europe/Paris »), suivi de « (déduit) » quand la source ne le donnait pas.
    pub fuseau: String,
    pub precision: String,
}

impl Horodatage {
    pub fn utc(utc_ms: i64, precision: &str) -> Self {
        Horodatage { utc_ms, decalage_min: 0, fuseau: "UTC".into(), precision: precision.into() }
    }

    /// Même instant, exprimé dans le fuseau local du PC.
    pub fn en_local(utc_ms: i64, precision: &str) -> Self {
        let dt = Utc.timestamp_millis_opt(utc_ms).single().unwrap_or_default();
        let decalage = Local.offset_from_utc_datetime(&dt.naive_utc()).fix().local_minus_utc() / 60;
        Horodatage { utc_ms, decalage_min: decalage, fuseau: fuseau_local(), precision: precision.into() }
    }

    pub fn maintenant() -> Self {
        Self::en_local(Utc::now().timestamp_millis(), precision::MILLISECONDE)
    }

    /// Heure locale lisible : « 2026-11-17 14:03:22.123 +01:00 ».
    pub fn lisible(&self) -> String {
        let dt = DateTime::from_timestamp_millis(self.utc_ms + self.decalage_min as i64 * 60_000)
            .unwrap_or_default()
            .naive_utc();
        let s = if self.decalage_min < 0 { '-' } else { '+' };
        let d = self.decalage_min.abs();
        format!("{} {}{:02}:{:02}", dt.format("%Y-%m-%d %H:%M:%S%.3f"), s, d / 60, d % 60)
    }
}

pub fn maintenant_ms() -> i64 {
    Utc::now().timestamp_millis()
}

pub fn fuseau_local() -> String {
    iana_time_zone::get_timezone().unwrap_or_else(|_| "heure locale".into())
}

/// Convertit une heure locale sans fuseau (WhatsApp, export Telegram « date ») en instant UTC.
pub trait Fuseau {
    /// (instant UTC en ms, décalage en minutes, ambigu ?)
    fn resoudre(&self, local: NaiveDateTime) -> (i64, i32, bool);
    fn nom(&self) -> String;
}

/// Le fuseau du PC (règles d'heure d'été comprises).
pub struct FuseauLocal;

impl Fuseau for FuseauLocal {
    fn resoudre(&self, local: NaiveDateTime) -> (i64, i32, bool) {
        match Local.from_local_datetime(&local) {
            LocalResult::Single(dt) => (dt.timestamp_millis(), dt.offset().local_minus_utc() / 60, false),
            // Heure répétée au passage à l'heure d'hiver : on garde la première, signalée comme ambiguë.
            LocalResult::Ambiguous(a, _) => (a.timestamp_millis(), a.offset().local_minus_utc() / 60, true),
            // Heure qui n'existe pas (passage à l'heure d'été) : décalage d'avant le changement.
            LocalResult::None => {
                let avant = local - chrono::Duration::hours(1);
                let (ms, d, _) = self.resoudre(avant);
                (ms + 3_600_000, d, true)
            }
        }
    }
    fn nom(&self) -> String {
        fuseau_local()
    }
}

/// Décalage fixe (tests, ou export dont on connaît le décalage).
pub struct FuseauFixe {
    pub decalage_min: i32,
    pub nom: String,
}

impl Fuseau for FuseauFixe {
    fn resoudre(&self, local: NaiveDateTime) -> (i64, i32, bool) {
        (local.and_utc().timestamp_millis() - self.decalage_min as i64 * 60_000, self.decalage_min, false)
    }
    fn nom(&self) -> String {
        self.nom.clone()
    }
}

/// Heure locale sans fuseau → horodatage, avec le fuseau marqué « déduit ».
pub fn depuis_local(f: &dyn Fuseau, local: NaiveDateTime, precision: &str) -> Horodatage {
    let (utc_ms, decalage_min, ambigu) = f.resoudre(local);
    let mut fuseau = format!("{} (déduit)", f.nom());
    if ambigu {
        fuseau.push_str(", heure ambiguë au changement d'heure");
    }
    Horodatage { utc_ms, decalage_min, fuseau, precision: precision.into() }
}
