// Rayan's Montre (garmin/montre) : saisies faites au poignet (verre d'eau, séance faite, humeur 1 à 5) et résumé du
// jour (pas, distance, calories, cœur), envoyés par la montre à travers Garmin Connect sur l'iPhone.
// Rangés dans montre.json, à côté de telecommande.json. Lus par la tuile Montre de Rayan's Mobile et par le bilan
// du soir de Rayan's Aujourd'hui.
// Écriture prudente : relue juste avant, copie .bak, fichier temporaire puis renommage.
import fs from "node:fs";
import path from "node:path";

export class ErreurMontre extends Error { code: number; constructor(code: number, message: string) { super(message); this.code = code; } }

export const TYPES = ["eau", "seance", "humeur"] as const;
export type TypeSaisie = (typeof TYPES)[number];

/** Une saisie de la montre ; `at` en millisecondes. `valeur` : l'humeur (1 à 5). */
export interface Saisie { id: string; type: TypeSaisie; at: number; valeur?: number }
/** Dernier résumé du jour reçu ; distance en mètres. Une valeur inconnue de la montre reste null. */
export interface Resume { at: number; pas: number | null; distance: number | null; calories: number | null; coeur: number | null }
export interface DonneesMontre { saisies: Saisie[]; resumes: Record<string, Resume>; derniereReception: number | null }

export interface JourMontre {
  date: string;
  eau: number;
  seances: number;
  humeurs: number[];
  /** Dernière humeur notée ce jour-là. */
  humeur: number | null;
  pas: number | null;
  distance: number | null;
  calories: number | null;
  coeur: number | null;
}
export interface VueMontre { aujourdhui: JourMontre; jours: JourMontre[]; derniereReception: number | null }

/** Jours gardés dans montre.json. */
export const GARDER_JOURS = 90;
/** Saisies acceptées par envoi (la montre en garde 50 au plus). */
export const MAX_PAR_ENVOI = 100;

export const donneesVides = (): DonneesMontre => ({ saisies: [], resumes: {}, derniereReception: null });

/** Date locale du PC, « 2026-11-20 ». */
export function dateLocale(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const fichierMontre = (dossierDonnees: string) => path.join(dossierDonnees, "montre.json");

const estObjet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const ID = /^[A-Za-z0-9_-]{1,40}$/;

/** Nombre entier entre min et max, sinon null. */
function entier(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  return n >= min && n <= max ? n : null;
}

function saisieValide(x: unknown): Saisie | null {
  if (!estObjet(x) || typeof x.id !== "string" || !ID.test(x.id) || !TYPES.includes(x.type as TypeSaisie)) return null;
  if (typeof x.at !== "number" || !Number.isFinite(x.at) || x.at <= 0) return null;
  const s: Saisie = { id: x.id, type: x.type as TypeSaisie, at: x.at };
  if (s.type === "humeur") {
    const v = entier(x.valeur, 1, 5);
    if (v === null) return null;
    s.valeur = v;
  }
  return s;
}

function resumeValide(x: unknown): Resume | null {
  if (!estObjet(x) || typeof x.at !== "number" || !Number.isFinite(x.at) || x.at <= 0) return null;
  return {
    at: x.at,
    pas: entier(x.pas, 0, 300_000),
    distance: entier(x.distance, 0, 1_000_000),
    calories: entier(x.calories, 0, 30_000),
    coeur: entier(x.coeur, 20, 250),
  };
}

export function normaliser(brut: unknown): DonneesMontre {
  const d = estObjet(brut) ? brut : {};
  const saisies = Array.isArray(d.saisies) ? d.saisies.map(saisieValide).filter((s): s is Saisie => !!s) : [];
  const resumes: Record<string, Resume> = {};
  if (estObjet(d.resumes)) {
    for (const [k, v] of Object.entries(d.resumes)) { const r = resumeValide(v); if (r && /^\d{4}-\d{2}-\d{2}$/.test(k)) resumes[k] = r; }
  }
  const derniereReception = typeof d.derniereReception === "number" && Number.isFinite(d.derniereReception) ? d.derniereReception : null;
  return { saisies, resumes, derniereReception };
}

/** Fichier absent = rien encore ; illisible = la sauvegarde .bak, sinon une erreur (rien n'est écrasé). */
export function lire(fichier: string): DonneesMontre {
  if (!fs.existsSync(fichier)) return donneesVides();
  for (const f of [fichier, `${fichier}.bak`]) {
    try { return normaliser(JSON.parse(fs.readFileSync(f, "utf8"))); } catch { /* suivant */ }
  }
  throw new ErreurMontre(409, "montre.json est illisible : rien n'a été enregistré");
}

function ecrire(fichier: string, d: DonneesMontre) {
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  const tmp = `${fichier}.${process.pid}-${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(d, null, 1));
  try {
    if (fs.existsSync(fichier)) fs.copyFileSync(fichier, `${fichier}.bak`);
    fs.renameSync(tmp, fichier);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
}

/**
 * Vérifie ce qu'envoie la montre : { saisies?: [{ id, type, at (secondes), valeur? }], resume?: { at (secondes),
 * pas, distance (m), calories, coeur } }. Une saisie mal formée ou datée n'importe comment est ignorée (sinon la
 * montre la renverrait sans fin) ; le reste est gardé.
 */
export function demande(b: Record<string, unknown>, maintenant = Date.now()): { saisies: Saisie[]; resume: Resume | null; ignorees: number } {
  const brutes = b.saisies === undefined ? [] : b.saisies;
  if (!Array.isArray(brutes)) throw new ErreurMontre(400, "saisies : une liste est attendue");
  if (brutes.length > MAX_PAR_ENVOI) throw new ErreurMontre(413, "trop de saisies en un envoi");
  const plausible = (ms: number) => ms > maintenant - 400 * 86_400_000 && ms < maintenant + 86_400_000;
  const saisies: Saisie[] = [];
  let ignorees = 0;
  for (const x of brutes) {
    const s = saisieValide(x);
    if (s) s.at = s.at * 1000;
    if (s && plausible(s.at)) saisies.push(s); else ignorees++;
  }
  let resume = b.resume === undefined || b.resume === null ? null : resumeValide(b.resume);
  if (resume) { resume = { ...resume, at: resume.at * 1000 }; if (!plausible(resume.at)) resume = null; }
  return { saisies, resume, ignorees };
}

/** Ajoute ce que la montre a envoyé (une saisie déjà reçue, même id, n'est pas comptée deux fois). */
export function recevoir(fichier: string, q: ReturnType<typeof demande>, maintenant = Date.now()): { ok: true; recues: number; doublons: number; ignorees: number } {
  const d = lire(fichier);
  const connus = new Set(d.saisies.map((s) => s.id));
  const nouvelles = q.saisies.filter((s) => { if (connus.has(s.id)) return false; connus.add(s.id); return true; });
  const doublons = q.saisies.length - nouvelles.length;
  const resumes = { ...d.resumes };
  if (q.resume) {
    const jour = dateLocale(q.resume.at);
    if (!resumes[jour] || resumes[jour].at <= q.resume.at) resumes[jour] = q.resume;
  }
  if (nouvelles.length || q.resume) {
    const limite = dateLocale(maintenant - GARDER_JOURS * 86_400_000);
    ecrire(fichier, {
      saisies: [...d.saisies, ...nouvelles].filter((s) => dateLocale(s.at) >= limite).sort((a, b) => a.at - b.at),
      resumes: Object.fromEntries(Object.entries(resumes).filter(([k]) => k >= limite)),
      derniereReception: maintenant,
    });
  }
  return { ok: true, recues: nouvelles.length, doublons, ignorees: q.ignorees };
}

/** Ce qui s'est passé un jour donné (date locale du PC). */
export function jour(d: DonneesMontre, date: string): JourMontre {
  const s = d.saisies.filter((x) => dateLocale(x.at) === date).sort((a, b) => a.at - b.at);
  const humeurs = s.filter((x) => x.type === "humeur").map((x) => x.valeur!);
  const r = d.resumes[date];
  return {
    date,
    eau: s.filter((x) => x.type === "eau").length,
    seances: s.filter((x) => x.type === "seance").length,
    humeurs,
    humeur: humeurs.length ? humeurs[humeurs.length - 1] : null,
    pas: r?.pas ?? null, distance: r?.distance ?? null, calories: r?.calories ?? null, coeur: r?.coeur ?? null,
  };
}

/** Aujourd'hui et les 7 derniers jours (du plus ancien à aujourd'hui). */
export function vue(d: DonneesMontre, maintenant = Date.now()): VueMontre {
  const midi = new Date(maintenant); midi.setHours(12, 0, 0, 0); // midi : pas de surprise au changement d'heure
  const jours = Array.from({ length: 7 }, (_, i) => { const x = new Date(midi); x.setDate(x.getDate() - (6 - i)); return jour(d, dateLocale(x.getTime())); });
  return { aujourdhui: jours[6], jours, derniereReception: d.derniereReception };
}
