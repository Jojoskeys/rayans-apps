// Rayan's Favoris (tuile Favoris de Rayan's Mobile) : un lien TikTok ou Instagram, ou une vidéo, envoyé depuis
// l'iPhone est posé dans <Documents>\Rayan's Favoris\a-deposer. L'app Python favoris/ le lit au prochain passage,
// puis Claude l'analyse (/favoris). Ici on ne télécharge ni n'exécute rien : on dépose, et on lit le résumé.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const TAILLE_MAX = 500 * 1024 * 1024;
export const VIDEOS: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/x-m4v": "m4v", "video/webm": "webm" };

export class ErreurFavori extends Error { code: number; constructor(code: number, message: string) { super(message); this.code = code; } }

/** Seulement les liens TikTok et Instagram, rien d'autre. */
export function lienValide(lien: string): boolean {
  let u: URL;
  try { u = new URL(lien.trim()); } catch { return false; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const h = u.hostname.toLowerCase();
  return /(^|\.)tiktok\.com$|(^|\.)tiktokv\.com$|(^|\.)instagram\.com$/.test(h);
}

export function deposerLien(dossier: string, lien: string, note: string): string {
  if (!lienValide(lien)) throw new ErreurFavori(400, "ce n'est pas un lien TikTok ou Instagram");
  const dir = path.join(dossier, "a-deposer");
  fs.mkdirSync(dir, { recursive: true });
  const id = randomUUID();
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify({ lien: lien.trim(), note: note.slice(0, 500), envoye: Date.now() }), "utf8");
  return id;
}

export interface Resume {
  compte: Record<string, number>;
  recents: { titre: string; categorie: string; verdict: string; etat: string; resume: string; lien: string }[];
  enAttente: number;
}

/** Un aperçu pour l'iPhone : combien de vidéos par état, les dernières analysées. */
export function resume(dossier: string): Resume {
  const compte: Record<string, number> = {};
  let videos: { id: string; etat: string; titre?: string; lien?: string; modifie_le?: number; ajoute_le: number }[] = [];
  try { videos = JSON.parse(fs.readFileSync(path.join(dossier, "favoris.json"), "utf8")); } catch { /* pas encore de liste */ }
  for (const v of videos) compte[v.etat] = (compte[v.etat] ?? 0) + 1;
  let enAttente = 0;
  try { enAttente = fs.readdirSync(path.join(dossier, "a-deposer")).filter((f) => /\.(json|txt|mp4|mov|m4v|webm)$/i.test(f)).length; } catch { /* vide */ }
  const recents = videos
    .filter((v) => ["analysee", "validee", "appliquee"].includes(v.etat))
    .sort((a, b) => (b.modifie_le ?? b.ajoute_le) - (a.modifie_le ?? a.ajoute_le))
    .slice(0, 15)
    .map((v) => {
      let f: { categorie?: string; resume?: string; securite?: { verdict?: string } } = {};
      try { f = JSON.parse(fs.readFileSync(path.join(dossier, "fiches", `${v.id}.json`), "utf8")); } catch { /* sans fiche */ }
      return { titre: (v.titre || f.resume || v.id).slice(0, 100), categorie: f.categorie ?? "", verdict: f.securite?.verdict ?? "", etat: v.etat, resume: (f.resume ?? "").slice(0, 300), lien: v.lien ?? "" };
    });
  return { compte, recents, enAttente };
}
