// Lecture du dossier de Rayan's Favoris sur le disque (recettes.md, fiches\*.json, favoris.json pour les liens).
// Rien n'est jamais écrit dans ce dossier. Sans dépendance à Electron, pour être testé avec node --test.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fusionner, lireFiche, lireRecettesMd } from "../core/lecture.ts";
import type { Recette } from "../core/types.ts";

/** Dossier de Rayan's Favoris : FAVORIS_DOSSIER, sinon « Rayan's Favoris » dans le dossier Documents donné. */
export function dossierFavoris(documents = path.join(os.homedir(), "Documents"), env = process.env): string {
  return env.FAVORIS_DOSSIER?.trim() || path.join(documents, "Rayan's Favoris");
}

export interface Lecture {
  recettes: Recette[];
  trouve: boolean;
  /** Fichiers illisibles (sautés), pour le signaler sans bloquer. */
  illisibles: string[];
}

function lireTexte(f: string): string | null {
  try { return fs.readFileSync(f, "utf8").replace(/^﻿/, ""); } catch { return null; }
}

/** Liens des vidéos, d'après la liste de Rayan's Favoris (favoris.json : [{ id, lien, … }]). */
function liens(dossier: string): Map<string, string> {
  const m = new Map<string, string>();
  const t = lireTexte(path.join(dossier, "favoris.json"));
  if (!t) return m;
  try {
    const l = JSON.parse(t);
    if (Array.isArray(l)) for (const v of l) if (v && typeof v.id === "string" && typeof v.lien === "string") m.set(v.id, v.lien);
  } catch { /* liste en cours d'écriture : les liens sont alors déduits des identifiants */ }
  return m;
}

export function lireFavoris(dossier: string): Lecture {
  if (!fs.existsSync(dossier)) return { recettes: [], trouve: false, illisibles: [] };
  const illisibles: string[] = [];
  const l = liens(dossier);
  const md = lireRecettesMd(lireTexte(path.join(dossier, "recettes.md")) ?? "")
    .map((r) => (l.has(r.id) ? { ...r, lien: l.get(r.id) } : r));
  const fiches: Recette[] = [];
  const dirFiches = path.join(dossier, "fiches");
  let noms: string[] = [];
  try { noms = fs.readdirSync(dirFiches).filter((n) => n.toLowerCase().endsWith(".json")).sort(); } catch { /* pas encore de fiches */ }
  for (const n of noms) {
    const t = lireTexte(path.join(dirFiches, n));
    if (t === null) { illisibles.push(n); continue; }
    try {
      const f = JSON.parse(t);
      const r = lireFiche(f, typeof f?.id === "string" ? l.get(f.id) : undefined);
      if (r) fiches.push(r);
    } catch {
      illisibles.push(n);
    }
  }
  return { recettes: fusionner(md, fiches), trouve: true, illisibles };
}
