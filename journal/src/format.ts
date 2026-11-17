import type { Horodatage } from "./api";

const pad = (n: number, l = 2) => String(n).padStart(l, "0");

/** Date et heure dans le décalage enregistré avec l'horodatage (pas celui du PC au moment de l'affichage). */
export function heure(h: Horodatage, ms = false): string {
  const d = new Date(h.utcMs + h.decalageMin * 60_000);
  const base = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  return ms ? `${base}.${pad(d.getUTCMilliseconds(), 3)}` : base;
}

export function jour(h: Horodatage): string {
  const d = new Date(h.utcMs + h.decalageMin * 60_000);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function decalage(h: Horodatage): string {
  const s = h.decalageMin < 0 ? "−" : "+";
  const a = Math.abs(h.decalageMin);
  return `UTC${s}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

export function complet(h: Horodatage): string {
  const d = new Date(h.utcMs + h.decalageMin * 60_000);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${heure(h)} (${decalage(h)})`;
}

/** Instant affiché dans le fuseau actuel du PC. */
export function local(ms: number): string {
  return new Date(ms).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" });
}

export function taille(o: number): string {
  if (o < 1024) return `${o} o`;
  if (o < 1024 ** 2) return `${(o / 1024).toFixed(0)} Ko`;
  if (o < 1024 ** 3) return `${(o / 1024 ** 2).toFixed(1)} Mo`;
  return `${(o / 1024 ** 3).toFixed(2)} Go`;
}

export function pluriel(n: number, mot: string, motPluriel?: string): string {
  return `${n.toLocaleString("fr-FR")} ${n > 1 ? (motPluriel ?? mot + "s") : mot}`;
}

/** Début de la journée locale (ms) pour une valeur de <input type="date">. */
export function debutJour(v: string): number | null {
  if (!v) return null;
  const [a, m, j] = v.split("-").map(Number);
  return new Date(a, m - 1, j).getTime();
}

/** « 2 h 05 », « 12 min », « 40 s ». */
export function duree(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

export function heureLocale(ms: number): string {
  return new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export const APPLIS: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  discord: "Discord",
  instagram: "Instagram",
  messenger: "Messenger",
};

export const CATEGORIES: Record<string, string> = {
  application: "Application",
  composant: "Composant Windows",
  fenetre: "Fenêtre",
  fichier: "Fichier",
  session: "Session",
  securite: "Sécurité",
  collecte: "Collecte",
};

export const ACTIONS: Record<string, string> = {
  ouverture: "ouverte",
  fermeture: "fermée",
  premier_plan: "au premier plan",
  titre: "titre changé",
  creation: "créé",
  creation_dossier: "dossier créé",
  modification: "modifié",
  renommage: "renommé",
  deplacement: "déplacé",
  arrivee: "arrivé",
  apparition: "apparu",
  suppression: "supprimé",
  verrouillage: "verrouillée",
  deverrouillage: "déverrouillée",
  ouverture_session: "ouverte",
  fermeture_session: "fermée",
  demarrage: "démarrage",
  arret: "arrêt",
  arret_inattendu: "arrêt inattendu",
  veille: "mise en veille",
  reveil: "réveil",
  activation: "activée",
  desactivation: "désactivée",
  pause: "pause",
  reprise: "reprise",
  suivi_partiel: "suivi partiel",
  nouveau_programme: "nouveau programme",
  niveau_change: "niveau changé",
  inventaire: "inventaire",
  demarrage_ajoute: "démarrage auto ajouté",
  demarrage_retire: "démarrage auto retiré",
  defender_detection: "détection",
  defender_action: "action de Defender",
  analyse_defender: "analyse",
  activite_absence: "PC utilisé en ton absence",
  inactif: "inactif",
  actif: "de retour",
  absence: "absence",
  retour: "retour",
};
