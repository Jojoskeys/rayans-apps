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
    });
  }
  return { majLe: nombre(brut.majLe), demo: brut.demo === true, offres };
}
