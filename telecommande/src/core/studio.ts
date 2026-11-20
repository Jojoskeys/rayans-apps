// Rayan's Studio depuis le téléphone (tuile Studio de Rayan's Mobile). Trois choses, dans <Vidéos>\Rayan's Studio :
//
// 1. Vidéos à valider (dossier « A valider ») — déposées par Claude :
//      <id>.mp4           la vidéo (version légère, lisible sur l'iPhone)
//      <id>.json          { titre, texte, note?, version, envoye }
// 2. Scripts à valider (dossier « Scripts ») — le texte avant la fabrication de la vidéo :
//      <id>.json          { titre, compte, texte, sources[], note?, version, envoye }
//    Pour les deux, la réponse de Rayan (« C'est bon » ou ce qu'il faut corriger) va dans
//      <id>.retours.json  [{ version, verdict, commentaire, at }, …]   (lu ensuite par Claude)
// 3. Boîte à idées (fichier « idees.json ») — les sujets que Rayan note depuis l'iPhone.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const ID_VALIDE = /^[a-z0-9][a-z0-9-]{0,79}$/;
export const COMMENTAIRE_MAX = 4000;
export const IDEE_MAX = 1000;

export type Verdict = "ok" | "corriger";
export interface Retour { version: number; verdict: Verdict; commentaire: string; at: number }
export interface VideoAValider {
  id: string; titre: string; texte: string; note: string; version: number; envoye: number; taille: number; retours: Retour[];
}
export interface ScriptAValider {
  id: string; titre: string; compte: string; texte: string; sources: string[]; note: string; version: number; envoye: number; retours: Retour[];
}
export type Compte = "ayati" | "psycho" | "";
export type StatutIdee = "nouvelle" | "script" | "faite" | "abandonnée";
export interface Idee { id: string; texte: string; compte: Compte; at: number; statut: StatutIdee }

export class ErreurRetour extends Error { code: number; constructor(code: number, m: string) { super(m); this.code = code; } }

const lireJson = <T>(p: string, defaut: T): T => { try { return JSON.parse(fs.readFileSync(p, "utf8")) as T; } catch { return defaut; } };
const ecrireJson = (p: string, v: unknown) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(v, null, 2), "utf8");
  fs.renameSync(tmp, p);
};
const retoursDe = (dossier: string, id: string): Retour[] => {
  const r = lireJson<Retour[]>(path.join(dossier, `${id}.retours.json`), []);
  return Array.isArray(r) ? r : [];
};
const texte = (v: unknown) => (typeof v === "string" ? v : "");

// ------------------------------------------------------------------ vidéos

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
    videos.push({
      id,
      titre: texte(meta.titre) || id,
      texte: texte(meta.texte),
      note: texte(meta.note),
      version: Number.isInteger(meta.version) ? (meta.version as number) : 1,
      envoye: typeof meta.envoye === "number" ? meta.envoye : modifie,
      taille,
      retours: retoursDe(dossier, id),
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

// ------------------------------------------------------------------ stories à poster
// Une story (« <slug>-story-<n> ») validée par « C'est bon » passe dans l'onglet « À poster » : Rayan l'enregistre
// ou la partage depuis l'iPhone en pleine qualité (<id>.hd.mp4, sinon la version légère), puis touche « Postée »
// (<id>.postee.json { at }).

export const ID_STORY = /-story-\d+$/;
export interface StoryAPoster { id: string; titre: string; version: number; envoye: number; validee: number; taille: number }

const cheminHd = (dossier: string, id: string) => {
  const hd = path.join(dossier, `${id}.hd.mp4`);
  return fs.existsSync(hd) ? hd : path.join(dossier, `${id}.mp4`);
};

/** Stories validées (dernière version) et pas encore postées, les plus récentes d'abord. */
export function aPoster(dossier: string): StoryAPoster[] {
  const r: StoryAPoster[] = [];
  for (const v of lister(dossier)) {
    if (!ID_STORY.test(v.id) || fs.existsSync(path.join(dossier, `${v.id}.postee.json`))) continue;
    const rep = [...v.retours].reverse().find((x) => x.version === v.version);
    if (rep?.verdict !== "ok") continue;
    let taille = v.taille;
    try { taille = fs.statSync(cheminHd(dossier, v.id)).size; } catch { /* version légère */ }
    r.push({ id: v.id, titre: v.titre, version: v.version, envoye: v.envoye, validee: rep.at, taille });
  }
  return r;
}

/** Chemin de la story à poster `id` en pleine qualité, ou null. */
export function cheminStory(dossier: string, id: string): string | null {
  if (!ID_VALIDE.test(id) || !ID_STORY.test(id) || !cheminVideo(dossier, id)) return null;
  return cheminHd(dossier, id);
}

/** « Postée » : la story quitte l'onglet À poster (le fichier reste sur le PC). */
export function marquerPostee(dossier: string, id: string, at = Date.now()): void {
  if (!aPoster(dossier).some((s) => s.id === id)) throw new ErreurRetour(404, "story introuvable (déjà postée ?)");
  ecrireJson(path.join(dossier, `${id}.postee.json`), { at });
}

// ------------------------------------------------------------------ scripts

/** Scripts déposés (un .json par script), les plus récents d'abord. */
export function listerScripts(dossier: string): ScriptAValider[] {
  if (!fs.existsSync(dossier)) return [];
  const scripts: ScriptAValider[] = [];
  for (const f of fs.readdirSync(dossier)) {
    const m = f.match(/^(.+)\.json$/);
    if (!m || m[1].endsWith(".retours") || !ID_VALIDE.test(m[1])) continue;
    const id = m[1];
    const meta = lireJson<Record<string, unknown> | null>(path.join(dossier, f), null);
    if (!meta || !texte(meta.texte)) continue;
    scripts.push({
      id,
      titre: texte(meta.titre) || id,
      compte: texte(meta.compte),
      texte: texte(meta.texte),
      sources: Array.isArray(meta.sources) ? meta.sources.filter((s): s is string => typeof s === "string") : [],
      note: texte(meta.note),
      version: Number.isInteger(meta.version) ? (meta.version as number) : 1,
      envoye: typeof meta.envoye === "number" ? meta.envoye : 0,
      retours: retoursDe(dossier, id),
    });
  }
  return scripts.sort((a, b) => b.envoye - a.envoye);
}

// ------------------------------------------------------------------ réponses (vidéos et scripts)

function enregistrerRetour(dossier: string, cible: { id: string; version: number; retours: Retour[] } | undefined, id: string,
  version: number, verdict: string, commentaire: string, at: number): Retour {
  if (!ID_VALIDE.test(id) || !cible) throw new ErreurRetour(404, "introuvable (il a peut-être été retiré)");
  if (verdict !== "ok" && verdict !== "corriger") throw new ErreurRetour(400, "réponse inconnue");
  const c = String(commentaire ?? "").trim().slice(0, COMMENTAIRE_MAX);
  if (verdict === "corriger" && !c) throw new ErreurRetour(400, "écris ce qu'il faut corriger");
  if (version !== cible.version) throw new ErreurRetour(409, "une nouvelle version est arrivée entre-temps : regarde-la avant de répondre");
  const r: Retour = { version, verdict, commentaire: c, at };
  ecrireJson(path.join(dossier, `${id}.retours.json`), [...cible.retours, r]);
  return r;
}

/** Réponse de Rayan sur la version de la vidéo qu'il a regardée. */
export function ajouterRetour(dossier: string, id: string, version: number, verdict: string, commentaire: string, at = Date.now()): Retour {
  return enregistrerRetour(dossier, lister(dossier).find((x) => x.id === id), id, version, verdict, commentaire, at);
}

/** Réponse de Rayan sur la version du script qu'il a lue. */
export function ajouterRetourScript(dossier: string, id: string, version: number, verdict: string, commentaire: string, at = Date.now()): Retour {
  return enregistrerRetour(dossier, listerScripts(dossier).find((x) => x.id === id), id, version, verdict, commentaire, at);
}

// ------------------------------------------------------------------ boîte à idées

const COMPTES: Compte[] = ["ayati", "psycho", ""];
const STATUTS: StatutIdee[] = ["nouvelle", "script", "faite", "abandonnée"];

export function listerIdees(fichier: string): Idee[] {
  const l = lireJson<Idee[]>(fichier, []);
  return (Array.isArray(l) ? l : [])
    .filter((i) => i && typeof i.id === "string" && typeof i.texte === "string")
    .map((i) => ({ ...i, compte: COMPTES.includes(i.compte) ? i.compte : "", statut: STATUTS.includes(i.statut) ? i.statut : "nouvelle" }))
    .sort((a, b) => b.at - a.at);
}

export function ajouterIdee(fichier: string, texteIdee: string, compte: string, at = Date.now()): Idee {
  const t = String(texteIdee ?? "").trim().slice(0, IDEE_MAX);
  if (!t) throw new ErreurRetour(400, "écris ton idée");
  const idee: Idee = { id: randomUUID(), texte: t, compte: COMPTES.includes(compte as Compte) ? (compte as Compte) : "", at, statut: "nouvelle" };
  ecrireJson(fichier, [idee, ...listerIdees(fichier)]);
  return idee;
}

export function supprimerIdee(fichier: string, id: string): void {
  const l = listerIdees(fichier);
  if (!l.some((i) => i.id === id)) throw new ErreurRetour(404, "idée introuvable");
  ecrireJson(fichier, l.filter((i) => i.id !== id));
}
