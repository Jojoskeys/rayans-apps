// Jours (AAAA-MM-JJ) : petites fonctions sans dépendance.

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

export const estJour = (k: string) => /^\d{4}-\d\d-\d\d$/.test(k);

/** « 2:05 » à partir de secondes. */
export function fmtSecondes(s: number): string {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}
