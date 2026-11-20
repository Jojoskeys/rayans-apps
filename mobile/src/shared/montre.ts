// Tuile Montre : ce que Rayan's Montre (garmin/montre) a envoyé au PC, lu à travers Rayan's Télécommande
// (GET /api/montre). Mêmes formes que telecommande/src/core/montre.ts.

export interface JourMontre {
  date: string;
  eau: number;
  seances: number;
  humeurs: number[];
  humeur: number | null;
  pas: number | null;
  distance: number | null;
  calories: number | null;
  coeur: number | null;
}
export interface VueMontre { aujourdhui: JourMontre; jours: JourMontre[]; derniereReception: number | null }

export const HUMEURS = ["😞", "🙁", "😐", "🙂", "😄"];

/** « 8 421 » ; inconnu : « — » (rien n'est inventé). */
export const nombre = (n: number | null) => (n === null ? "—" : n.toLocaleString("fr-FR").replace(/ | /g, " "));

/** Distance en mètres : « 850 m », « 6,2 km ». */
export const distance = (m: number | null) => (m === null ? "—" : m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);

export const humeur = (h: number | null) => (h === null ? "—" : `${HUMEURS[h - 1] ?? ""} ${h}/5`);

/** Initiale du jour de la semaine (« L », « M »…) d'une date « 2026-11-20 ». */
export function initiale(date: string): string {
  const [a, m, j] = date.split("-").map(Number);
  return ["D", "L", "M", "M", "J", "V", "S"][new Date(a, m - 1, j).getDay()];
}

/** Hauteurs des barres (0 à 1) d'une valeur sur les 7 jours ; jour inconnu : null. */
export function barres(jours: JourMontre[], valeur: (j: JourMontre) => number | null): (number | null)[] {
  const v = jours.map(valeur);
  const max = Math.max(0, ...v.filter((x): x is number => x !== null));
  return v.map((x) => (x === null ? null : max > 0 ? x / max : 0));
}

/** « Dernier envoi de la montre : il y a 5 min » ; jamais : un conseil. */
export function dernierEnvoi(at: number | null, maintenant = Date.now()): string {
  if (at === null) return "Rien reçu de la montre pour l'instant : ouvre Rayan's Montre → Tester la connexion.";
  const min = Math.max(0, Math.round((maintenant - at) / 60_000));
  const quand = min < 1 ? "à l'instant" : min < 60 ? `il y a ${min} min` : min < 1440 ? `il y a ${Math.floor(min / 60)} h` : `il y a ${Math.floor(min / 1440)} j`;
  return `Dernier envoi de la montre : ${quand}`;
}
