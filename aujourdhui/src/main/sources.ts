// Lecture des fichiers de données de Révision, Hifz et Ouvertures (lecture seule).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { hifzCount, hifzDetail, ouverturesCount, ouverturesDetail, revisionCount, revisionDetail, type SourceCount, type SourceId } from "../core/counts.ts";

const roaming = () => process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");

/** Emplacements des données, comme chaque application les choisit (variables d'environnement comprises). */
export function sourcePaths() {
  return {
    revision: path.join(process.env.REVISION_DATA_DIR || path.join(roaming(), "fr.rayan.revision"), "revision.json"),
    hifz: path.join(process.env.HIFZ_DATA_DIR || path.join(roaming(), "Rayans Hifz"), "hifz-donnees.json"),
    ouvertures: path.join(process.env.RAYANS_OUVERTURES_DATA || path.join(roaming(), "Rayans Ouvertures", "donnees"), "joueurs"),
  };
}

/** Lit un JSON ; s'il est illisible (écriture en cours), essaie la copie de secours de l'application. */
function readJson(file: string, backups: string[] = []): unknown | undefined {
  for (const f of [file, ...backups]) {
    if (!fs.existsSync(f)) continue;
    try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { /* suivant */ }
  }
  if (fs.existsSync(file)) throw new Error("fichier illisible");
  return undefined;
}

function source(id: SourceId, fn: () => { total: number; detail: string } | null): SourceCount {
  try {
    const r = fn();
    if (!r) return { id, total: 0, detail: "Pas encore de données", missing: true, error: null };
    return { id, total: r.total, detail: r.detail, missing: false, error: null };
  } catch (e) {
    return { id, total: null, detail: "Données illisibles", missing: false, error: String((e as Error)?.message ?? e) };
  }
}

export function readCounts(now: number, paths = sourcePaths()): SourceCount[] {
  return [
    source("revision", () => {
      const raw = readJson(paths.revision, [path.join(path.dirname(paths.revision), "revision.bak.json")]);
      if (raw === undefined) return null;
      const c = revisionCount(raw, now);
      return { total: c.total, detail: revisionDetail(c) };
    }),
    source("hifz", () => {
      const raw = readJson(paths.hifz, [`${paths.hifz}.bak`]);
      if (raw === undefined) return null;
      const c = hifzCount(raw, now);
      return { total: c.total, detail: hifzDetail(c) };
    }),
    source("ouvertures", () => {
      if (!fs.existsSync(paths.ouvertures)) return null;
      const files: unknown[] = [];
      for (const d of fs.readdirSync(paths.ouvertures, { withFileTypes: true })) {
        if (!d.isDirectory()) continue;
        const f = path.join(paths.ouvertures, d.name, "exercices.json");
        try { if (fs.existsSync(f)) files.push(JSON.parse(fs.readFileSync(f, "utf8"))); } catch { /* fichier en cours d'écriture : ignoré */ }
      }
      const c = ouverturesCount(files, now);
      return { total: c.total, detail: ouverturesDetail(c) };
    }),
  ];
}
