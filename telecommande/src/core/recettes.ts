// Rayan's Recettes sur l'iPhone (tuile Recettes de Rayan's Mobile) : lecture, côté PC, des recettes de Rayan's
// Favoris et des données de l'app Recettes (recettes.json : favoris, plan de la semaine, magasins, articles pris).
// La logique est celle de l'app de bureau (recettes/src/core), réutilisée telle quelle.
// Écriture prudente : relue juste avant, copie .bak, fichier temporaire puis renommage.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detailArticle, listeCourses } from "../../../recettes/src/core/courses.ts";
import { appliquer, donneesVides, normaliser } from "../../../recettes/src/core/donnees.ts";
import { etiquettes, remarques } from "../../../recettes/src/core/lecture.ts";
import { a as chez, conseil, parMagasin } from "../../../recettes/src/core/magasins.ts";
import {
  dateDuJour, lundiDe, NOMS_JOURS, NOMS_REPAS, preparationsDuJour, recettesDeLaSemaine, recettesDuJour, totalDuJour,
} from "../../../recettes/src/core/plan.ts";
import { REPAS, type Action, type Donnees, type Etiquettes, type Recette, type Remarques, type Repas } from "../../../recettes/src/core/types.ts";
import { lireFavoris } from "../../../recettes/src/main/source.ts";

export class ErreurRecettes extends Error { code: number; constructor(code: number, message: string) { super(message); this.code = code; } }

/**
 * recettes.json de l'app de bureau : dans le dossier de données de Rayan's Launcher (data\rayans-recettes), sinon
 * dans %APPDATA%\Rayans Recettes. S'il existe aux deux endroits, le plus récent.
 */
export function fichierRecettes(env: NodeJS.ProcessEnv = process.env): string {
  if (env.RECETTES_DONNEES) return env.RECETTES_DONNEES;
  const racineLauncher = env.HANGAR_HOME
    || (env.HANGAR_APP_DATA ? path.dirname(path.dirname(env.HANGAR_APP_DATA)) : path.join(env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "fr.rayan.launcher"));
  const launcher = path.join(racineLauncher, "data", "rayans-recettes", "recettes.json");
  const seul = path.join(env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Rayans Recettes", "recettes.json");
  const date = (f: string) => { try { return fs.statSync(f).mtimeMs; } catch { return -1; } };
  if (date(launcher) >= 0 || date(seul) >= 0) return date(launcher) >= date(seul) ? launcher : seul;
  return fs.existsSync(path.dirname(launcher)) ? launcher : seul;
}

/** Données de l'app ; fichier absent = données vides ; illisible = la sauvegarde .bak, sinon une erreur (rien n'est écrasé). */
export function lireDonnees(fichier: string): Donnees {
  if (!fs.existsSync(fichier)) return donneesVides();
  for (const f of [fichier, `${fichier}.bak`]) {
    try { return normaliser(JSON.parse(fs.readFileSync(f, "utf8"))); } catch { /* suivant */ }
  }
  throw new ErreurRecettes(409, "recettes.json est illisible : ouvre Rayan's Recettes sur le PC pour le réparer");
}

function ecrire(fichier: string, d: Donnees) {
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

/** Ce que l'iPhone peut demander (rien d'autre n'est accepté). */
export type Demande =
  | { quoi: "faite"; id: string }
  | { quoi: "annulerFaite"; id: string; at: number }
  | { quoi: "favori"; id: string; oui: boolean }
  | { quoi: "achete"; cle: string; oui: boolean }
  | { quoi: "viderAchetes" };

const texte = (v: unknown, max = 300) => {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s || s.length > max) throw new ErreurRecettes(400, "demande incomplète");
  return s;
};

/** Vérifie une demande reçue de l'iPhone. */
export function demande(quoi: string, b: Record<string, unknown>): Demande {
  switch (quoi) {
    case "faite": return { quoi, id: texte(b.id) };
    case "annulerFaite": {
      const at = Number(b.at);
      if (!Number.isFinite(at)) throw new ErreurRecettes(400, "date manquante");
      return { quoi, id: texte(b.id), at };
    }
    case "favori": return { quoi, id: texte(b.id), oui: b.oui === true };
    case "achete": return { quoi, cle: texte(b.cle), oui: b.oui === true };
    case "viderAchetes": return { quoi };
    default: throw new ErreurRecettes(404, "action inconnue");
  }
}

/** Applique une demande : relit recettes.json juste avant d'écrire, pour garder ce que l'app de bureau vient d'écrire. */
export function modifier(fichier: string, q: Demande, maintenant = Date.now()): Donnees {
  const d = lireDonnees(fichier);
  let a: Action | null;
  switch (q.quoi) {
    case "faite": a = { type: "faite", id: q.id, at: maintenant }; break;
    case "annulerFaite": a = { type: "annulerFaite", id: q.id, at: q.at }; break;
    case "favori": a = d.favoris.includes(q.id) === q.oui ? null : { type: "favori", id: q.id }; break;
    case "achete": a = !!d.achetes[q.cle] === q.oui ? null : { type: "achete", cle: q.cle, oui: q.oui, at: maintenant }; break;
    case "viderAchetes": a = Object.keys(d.achetes).length ? { type: "viderAchetes" } : null; break;
  }
  if (!a) return d;
  const n = appliquer(d, a);
  ecrire(fichier, n);
  return n;
}

// ----- Ce que reçoit l'iPhone -------------------------------------------------------------------------

export interface RecetteMobile {
  id: string; titre: string; portions?: string; ingredients: string[]; etapes: string[]; lien?: string; resume?: string;
  kcal?: number; proteines?: number; perso: boolean;
  etiquettes: Etiquettes; remarques: Remarques; favori: boolean; faites: number[];
}
export interface ArticleMobile { cle: string; nom: string; detail: string; conseil: string; note: string; achete: boolean }
export interface GroupeMobile { magasin: string; titre: string; articles: ArticleMobile[] }
export interface JourMobile {
  nom: string; date: string;
  mange: { repas: Repas; nomRepas: string; id: string | null; titre: string | null }[];
  prepare: { id: string; titre: string; nomRepas: string; quand: "aujourdhui" | "ce-soir" | "des-que-possible" }[];
  total: { kcal: number; proteines: number; renseignees: number; recettes: number } | null;
  courses: GroupeMobile[];
}
export interface VueRecettes {
  trouve: boolean;
  recettes: RecetteMobile[];
  plan: { debut: string; semaineEnCours: boolean; aujourdhui: number | null; jours: JourMobile[]; semaine: GroupeMobile[] } | null;
}

function courses(recettes: Recette[], d: Donnees): GroupeMobile[] {
  return parMagasin(listeCourses(recettes), d.magasins).map((g) => ({
    magasin: g.magasin,
    titre: chez(g.magasin),
    articles: g.articles.map((x) => {
      const c = conseil(x.cle);
      return { cle: x.cle, nom: x.nom, detail: detailArticle(x), conseil: c.magasins.join(", "), note: c.note, achete: !!d.achetes[x.cle] };
    }),
  }));
}

/** Tout ce que la tuile affiche, en une seule réponse. */
export function vue(dossierFavoris: string, fichier: string, maintenant = new Date()): VueRecettes {
  const d = lireDonnees(fichier);
  const lecture = lireFavoris(dossierFavoris);
  const toutes = [...d.perso, ...lecture.recettes];
  const parId = new Map(toutes.map((r) => [r.id, r]));
  const recettes: RecetteMobile[] = toutes.map((r) => ({
    id: r.id, titre: r.titre, portions: r.portions, ingredients: r.ingredients, etapes: r.etapes, lien: r.lien, resume: r.resume,
    kcal: r.kcal, proteines: r.proteines, perso: r.origine === "perso",
    etiquettes: etiquettes(r), remarques: remarques(r), favori: d.favoris.includes(r.id), faites: d.faites[r.id] ?? [],
  }));
  let plan: VueRecettes["plan"] = null;
  if (d.plan) {
    const p = d.plan;
    const semaineEnCours = p.debut === lundiDe(maintenant);
    const jours: JourMobile[] = p.jours.map((j, n) => ({
      nom: NOMS_JOURS[n],
      date: dateDuJour(p.debut, n).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }),
      mange: REPAS.map((repas) => {
        const r = j[repas].id ? parId.get(j[repas].id!) : undefined;
        return { repas, nomRepas: NOMS_REPAS[repas], id: r?.id ?? null, titre: r?.titre ?? null };
      }),
      prepare: preparationsDuJour(p, parId, n).map((x) => ({ id: x.recette.id, titre: x.recette.titre, nomRepas: NOMS_REPAS[x.repas], quand: x.quand })),
      total: totalDuJour(p, parId, n),
      courses: courses(recettesDuJour(p, parId, n).map((x) => x.recette), d),
    }));
    plan = { debut: p.debut, semaineEnCours, aujourdhui: semaineEnCours ? (maintenant.getDay() + 6) % 7 : null, jours, semaine: courses(recettesDeLaSemaine(p, parId), d) };
  }
  return { trouve: lecture.trouve, recettes, plan };
}
