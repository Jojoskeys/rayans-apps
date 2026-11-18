// Vidéos du Studio à valider depuis le téléphone. Claude dépose dans un dossier du PC, pour chaque vidéo :
//   <id>.mp4           la vidéo (version légère, lisible sur l'iPhone)
//   <id>.json          { titre, texte, note?, version, envoye }
// Rayan la regarde dans la tuile Studio de Rayan's Mobile et répond « OK » ou ce qu'il faut corriger :
//   <id>.retours.json  [{ version, verdict, commentaire, at }, …]   (lu ensuite par Claude)
import fs from "node:fs";
import path from "node:path";

export const ID_VALIDE = /^[a-z0-9][a-z0-9-]{0,79}$/;
export const COMMENTAIRE_MAX = 4000;

export type Verdict = "ok" | "corriger";
export interface Retour { version: number; verdict: Verdict; commentaire: string; at: number }
export interface VideoAValider {
  id: string; titre: string; texte: string; note: string; version: number; envoye: number; taille: number; retours: Retour[];
}

const lireJson = <T>(p: string, defaut: T): T => { try { return JSON.parse(fs.readFileSync(p, "utf8")) as T; } catch { return defaut; } };

/** Vidéos présentes (avec leur .mp4), les plus récentes d'abord. */
export function lister(dossier: string): VideoAValider[] {
  if (!fs.existsSync(dossier)) return [];
  const videos: VideoAValider[] = [];
  for (const f of fs.readdirSync(dossier)) {
    const m = f.match(/^(.+)\.mp4$/);
    if (!m || !ID_VALIDE.test(m[1])) continue;
    const id = m[1];
    const meta = lireJson<Record<string, unknown>>(path.join(dossier, `${id}.json`), {});
    let taille = 0, modifie = 0;
    try { const st = fs.statSync(path.join(dossier, f)); taille = st.size; modifie = st.mtimeMs; } catch { continue; }
    const retours = lireJson<Retour[]>(path.join(dossier, `${id}.retours.json`), []);
    videos.push({
      id,
      titre: typeof meta.titre === "string" && meta.titre ? meta.titre : id,
      texte: typeof meta.texte === "string" ? meta.texte : "",
      note: typeof meta.note === "string" ? meta.note : "",
      version: Number.isInteger(meta.version) ? (meta.version as number) : 1,
      envoye: typeof meta.envoye === "number" ? meta.envoye : modifie,
      taille,
      retours: Array.isArray(retours) ? retours : [],
    });
  }
  return videos.sort((a, b) => b.envoye - a.envoye);
}

/** Chemin de la vidéo `id`, ou null si l'identifiant est invalide ou la vidéo absente. */
export function cheminVideo(dossier: string, id: string): string | null {
  if (!ID_VALIDE.test(id)) return null;
  const p = path.join(dossier, `${id}.mp4`);
  return fs.existsSync(p) ? p : null;
}

export class ErreurRetour extends Error { code: number; constructor(code: number, m: string) { super(m); this.code = code; } }

/** Enregistre la réponse de Rayan pour la version qu'il a regardée. */
export function ajouterRetour(dossier: string, id: string, version: number, verdict: string, commentaire: string, at = Date.now()): Retour {
  const v = lister(dossier).find((x) => x.id === id);
  if (!ID_VALIDE.test(id) || !v) throw new ErreurRetour(404, "vidéo introuvable (elle a peut-être été retirée)");
  if (verdict !== "ok" && verdict !== "corriger") throw new ErreurRetour(400, "réponse inconnue");
  const c = String(commentaire ?? "").trim().slice(0, COMMENTAIRE_MAX);
  if (verdict === "corriger" && !c) throw new ErreurRetour(400, "écris ce qu'il faut corriger");
  if (version !== v.version) throw new ErreurRetour(409, "une nouvelle version est arrivée entre-temps : regarde-la avant de répondre");
  const r: Retour = { version, verdict, commentaire: c, at };
  const p = path.join(dossier, `${id}.retours.json`), tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify([...v.retours, r], null, 2), "utf8");
  fs.renameSync(tmp, p);
  return r;
}
