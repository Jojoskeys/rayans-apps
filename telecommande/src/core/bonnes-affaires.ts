// Rayan's Bonnes Affaires (tuile « Bonnes affaires » de Rayan's Mobile) : l'app bonnes-affaires/ dépose son
// classement dans <Documents>\Rayan's Bonnes Affaires\offres.json ; ici on le relit et on le nettoie pour
// l'iPhone. Lecture seule : rien n'est lancé, acheté ni envoyé.
import fs from "node:fs";
import path from "node:path";

export type Surete = "sûr" | "à vérifier" | "méfiance";

export interface OffreTuile {
  titre: string;
  site: string;
  recherche: string;
  lien: string;
  photo: string | null;
  total: number;
  prixHabituel: number;
  ecartPct: number;
  gainRevente: number;
  distanceKm: number | null;
  procheDe: string;
  dansZone: boolean;
  livrable: boolean;
  port: number | null;
  surete: Surete;
  raisons: string[];
  choix: boolean;
  /** Offre exceptionnelle et sûre : notification sur l'iPhone. */
  pepite: boolean;
  /** Hors de la zone de retrait habituelle, mais l'affaire vaut le trajet. */
  loin: boolean;
}

export interface Classement {
  majLe: number | null;
  demo: boolean;
  offres: OffreTuile[];
}

const SURETES: Surete[] = ["sûr", "à vérifier", "méfiance"];
const MAX = 40;

/** Seulement des adresses web https, pour qu'un fichier abîmé ne puisse rien ouvrir d'autre sur l'iPhone. */
export function https(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

const texte = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const nombre = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function lire(dossier: string): Classement {
  let brut: { majLe?: unknown; demo?: unknown; offres?: unknown } = {};
  try {
    brut = JSON.parse(fs.readFileSync(path.join(dossier, "offres.json"), "utf8"));
  } catch {
    return { majLe: null, demo: false, offres: [] }; // pas encore lancé sur le PC
  }
  const offres: OffreTuile[] = [];
  for (const o of Array.isArray(brut.offres) ? brut.offres.slice(0, MAX) : []) {
    if (!o || typeof o !== "object") continue;
    const lien = https(o.lien);
    const total = nombre(o.total);
    const prixHabituel = nombre(o.prixHabituel);
    if (!lien || total == null || prixHabituel == null) continue;
    offres.push({
      titre: texte(o.titre, 200),
      site: texte(o.site, 40),
      recherche: texte(o.recherche, 80),
      lien,
      photo: https(o.photo),
      total,
      prixHabituel,
      ecartPct: nombre(o.ecartPct) ?? 0,
      gainRevente: nombre(o.gainRevente) ?? 0,
      distanceKm: nombre(o.distanceKm),
      procheDe: texte(o.procheDe, 60),
      dansZone: o.dansZone === true,
      livrable: o.livrable === true,
      port: nombre(o.port),
      surete: SURETES.includes(o.surete) ? o.surete : "à vérifier",
      raisons: Array.isArray(o.raisons) ? o.raisons.slice(0, 8).map((r: unknown) => texte(r, 200)).filter(Boolean) : [],
      choix: o.choix === true,
      pepite: o.pepite === true,
      loin: o.loin === true,
    });
  }
  return { majLe: nombre(brut.majLe), demo: brut.demo === true, offres };
}

// ----- Notifications des pépites -----

/** Liens déjà signalés gardés en mémoire (les plus récents), pour ne jamais prévenir deux fois. */
export const MEMOIRE = 1000;
/** Au-delà, une seule notification qui les résume, pour ne pas inonder le téléphone. */
export const MAX_PAR_PASSAGE = 3;

/** Pépites pas encore signalées, et la mémoire mise à jour. */
export function nouvellesPepites(c: Classement, deja: string[]): { nouvelles: OffreTuile[]; deja: string[] } {
  if (c.demo) return { nouvelles: [], deja }; // jamais de notification pour des données d'exemple
  const vus = new Set(deja);
  const nouvelles = c.offres.filter((o) => o.pepite && !vus.has(o.lien));
  return { nouvelles, deja: [...deja, ...nouvelles.map((o) => o.lien)].slice(-MEMOIRE) };
}

const euros = (n: number) => `${Math.round(n)} €`;

/** Ce qui s'affiche sur l'iPhone : une notification par pépite, ou un résumé s'il y en a beaucoup d'un coup. */
export function messages(nouvelles: OffreTuile[]): { titre: string; texte: string; tag: string }[] {
  if (nouvelles.length > MAX_PAR_PASSAGE) {
    const m = nouvelles[0];
    return [{
      titre: `💎 ${nouvelles.length} nouvelles pépites`,
      texte: `Dont ${m.titre} à ${euros(m.total)} (−${Math.round(m.ecartPct * 100)} %). Ouvre Bonnes affaires.`.slice(0, 200),
      tag: "bonnes-affaires",
    }];
  }
  return nouvelles.map((o) => ({
    titre: `💎 ${o.titre}`.slice(0, 80),
    texte: [
      `${euros(o.total)} au lieu de ~${euros(o.prixHabituel)} (−${Math.round(o.ecartPct * 100)} %)`,
      o.distanceKm != null ? `${o.distanceKm} km${o.procheDe ? ` de ${o.procheDe}` : ""}${o.loin ? " (plus loin, mais ça vaut le trajet)" : ""}` : o.livrable ? "livrable" : "",
      o.site,
    ].filter(Boolean).join(" · ").slice(0, 200),
    tag: `ba-${o.lien.slice(-40)}`,
  }));
}
