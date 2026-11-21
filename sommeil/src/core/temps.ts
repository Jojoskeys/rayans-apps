// Heures « HH:MM », minutes et jours (AAAA-MM-JJ) : petites fonctions sans dépendance.

/** « 23:05 » → 1385 minutes depuis minuit ; null si l'heure est invalide. */
export function versMinutes(h: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(h.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

/** 1385 → « 23:05 » (accepte les valeurs hors de 0–1439, ramenées sur 24 h). */
export function versHeure(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** L'origine des « minutes du soir » : 18 h. Ainsi 23:30 (330) vient avant 00:30 (390) et 07:00 (780). */
export const ORIGINE_SOIR = 18 * 60;

/** Heure « HH:MM » → minutes depuis 18 h (0 à 1439). Pratique pour comparer et moyenner autour de minuit. */
export function minutesDuSoir(h: string): number | null {
  const m = versMinutes(h);
  return m === null ? null : (m - ORIGINE_SOIR + 1440) % 1440;
}

/** Inverse de minutesDuSoir. */
export const heureDuSoir = (soir: number): string => versHeure(soir + ORIGINE_SOIR);

/** Arrondi au quart d'heure supérieur (ou inférieur). */
export const quartSup = (min: number) => Math.ceil(min / 15) * 15;
export const quartInf = (min: number) => Math.floor(min / 15) * 15;

/** Le jour (AAAA-MM-JJ, heure locale) d'un horodatage, sachant que la journée commence à `heureJour`. */
export function dayKey(ts: number, heureJour = 4): string {
  const d = new Date(ts - heureJour * 3600_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const utc = (k: string) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));

/** Nombre de jours entiers entre deux jours (AAAA-MM-JJ). */
export const joursEntre = (a: string, b: string): number => Math.round((utc(b) - utc(a)) / 86400_000);

/** Le jour `n` jours après `k`. */
export function ajouterJours(k: string, n: number): string {
  const d = new Date(utc(k) + n * 86400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** [année, mois 1-12, jour] d'un jour AAAA-MM-JJ. */
export const partiesJour = (k: string): [number, number, number] => [+k.slice(0, 4), +k.slice(5, 7), +k.slice(8, 10)];

export const estJour = (k: string) => /^\d{4}-\d\d-\d\d$/.test(k);

/** « 7 h 30 » à partir de minutes. */
export function fmtDuree(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}
