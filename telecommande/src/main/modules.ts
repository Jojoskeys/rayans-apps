// Modules privés facultatifs : des dossiers locaux (jamais dans le dépôt public) rangés dans
// %APPDATA%\Rayans Telecommande\modules\<nom>\, chacun avec :
//   - serveur.mjs : exporte gerer(outils) → true si la route /api/<nom>/… a été traitée ;
//   - page\ : une page web servie à l'adresse /<nom>/ (même adresse Tailscale que la Télécommande).
// Sans dossier, la Télécommande marche comme avant.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type http from "node:http";

export interface OutilsModule {
  route: string;
  url: URL;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  entetes: Record<string, string>;
  envoyer(code: number, corps: unknown): void;
  lireJson(): Promise<Record<string, unknown>>;
  /** Renvoie une erreur HTTP au téléphone (lève une exception). */
  erreur(code: number, message: string): never;
  journaliser(quoi: string, detail?: string): void;
  alerte(titre: string, texte: string): void;
  /** Dossiers Windows (videos, documents…), comme app.getPath. */
  dossier(nom: "videos" | "documents" | "downloads" | "home"): string;
}
export interface ModulePrive { gerer(o: OutilsModule): Promise<boolean> | boolean }

const NOM = /^[a-z][a-z0-9-]{0,30}$/;

/** Noms des modules installés (sous-dossiers au nom simple). */
export function listerModules(racine: string): string[] {
  try { return fs.readdirSync(racine, { withFileTypes: true }).filter((d) => d.isDirectory() && NOM.test(d.name)).map((d) => d.name).sort(); }
  catch { return []; }
}

const charges = new Map<string, Promise<ModulePrive | null>>();
/** Charge serveur.mjs d'un module (une fois). Absent ou cassé : null. */
export function chargerModule(racine: string, nom: string): Promise<ModulePrive | null> {
  const f = path.join(racine, nom, "serveur.mjs");
  if (!NOM.test(nom) || !fs.existsSync(f)) return Promise.resolve(null);
  if (!charges.has(f)) {
    charges.set(f, import(pathToFileURL(f).href).then((m) => (typeof m.gerer === "function" ? (m as ModulePrive) : null)).catch(() => { charges.delete(f); return null; }));
  }
  return charges.get(f)!;
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".png": "image/png",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ttf": "font/ttf", ".ico": "image/x-icon",
};
export const typeContenu = (f: string) => TYPES[path.extname(f).toLowerCase()] ?? null;

/**
 * Adresse « /<nom>/… » → fichier de <racine>\<nom>\page\…, ou null (module absent, fichier hors du dossier,
 * type non servi). « /<nom>/ » donne index.html.
 */
export function fichierPage(racine: string, chemin: string): string | null {
  let rel: string;
  try { rel = decodeURIComponent(chemin); } catch { return null; }
  const m = /^\/([a-z][a-z0-9-]{0,30})(\/.*)?$/.exec(rel);
  if (!m || m[2] === undefined || rel.includes("\0")) return null;
  const page = path.resolve(racine, m[1], "page");
  const f = path.resolve(page, "." + (m[2].endsWith("/") ? m[2] + "index.html" : m[2]));
  if (!f.startsWith(page + path.sep) || !typeContenu(f)) return null;
  try { return fs.statSync(f).isFile() ? f : null; } catch { return null; }
}
