// Plan de repas de la semaine : quatre cases par jour (petit-déjeuner, déjeuner, collation, dîner), remplies avec
// les recettes de Rayan, variées d'un jour à l'autre, protéines d'abord aux repas principaux.
import { aPreparerAvance, etiquettes, petitDej } from "./lecture.ts";
import { REPAS, type Case, type Jour, type Plan, type Recette, type Repas } from "./types.ts";

export const NOMS_REPAS: Record<Repas, string> = { petitDej: "Petit-déjeuner", dejeuner: "Déjeuner", collation: "Collation", diner: "Dîner" };
export const NOMS_JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/** Lundi de la semaine d'une date, au format AAAA-MM-JJ (heure locale). */
export function lundiDe(d: Date): string {
  const l = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return `${l.getFullYear()}-${String(l.getMonth() + 1).padStart(2, "0")}-${String(l.getDate()).padStart(2, "0")}`;
}

/** Date du jour n (0 = lundi) d'un plan. */
export function dateDuJour(debut: string, n: number): Date {
  const [a, m, j] = debut.split("-").map(Number);
  return new Date(a, m - 1, j + n);
}

/** Recettes possibles pour une case. */
export function candidats(recettes: Recette[], repas: Repas): Recette[] {
  if (repas === "collation") return recettes.filter((r) => etiquettes(r).collation);
  if (repas === "petitDej") {
    const p = recettes.filter(petitDej);
    return p.length ? p : recettes.filter((r) => etiquettes(r).collation);
  }
  // Repas principaux : pas les petits-déjeuners sucrés (smoothie bowl, overnight oats…).
  return recettes.filter((r) => etiquettes(r).repas && !(petitDej(r) && etiquettes(r).collation));
}

/** Petit générateur pseudo-aléatoire reproductible (même graine, même plan). */
function hasard(graine: number) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const libre = (): Case => ({ id: null, fixe: false });
const idsDuJour = (j: Jour | undefined) => (j ? REPAS.map((r) => j[r].id).filter((x): x is string => !!x) : []);

/**
 * Plan de la semaine. Les cases « fixe » du plan précédent (choisies par Rayan) sont gardées si leur recette existe
 * encore ; les autres sont tirées : pas la même recette la veille ou le lendemain si possible, jamais deux fois le même
 * jour, les moins utilisées d'abord, et les recettes riches en protéines d'abord au déjeuner et au dîner.
 */
export function genererPlan(recettes: Recette[], opts: { debut: string; graine?: number; precedent?: Plan | null }): Plan {
  const alea = hasard(opts.graine ?? Date.now());
  const existe = new Set(recettes.map((r) => r.id));
  const jours: Jour[] = Array.from({ length: 7 }, (_, n) => {
    const avant = opts.precedent?.jours[n];
    const j = {} as Jour;
    for (const repas of REPAS) {
      const c = avant?.[repas];
      j[repas] = c?.fixe && (c.id === null || existe.has(c.id)) ? { ...c } : libre();
    }
    return j;
  });
  const usages = new Map<string, number>();
  for (const j of jours) for (const id of idsDuJour(j)) usages.set(id, (usages.get(id) ?? 0) + 1);
  const proteines = new Map(recettes.map((r) => [r.id, etiquettes(r).proteines]));
  const parRepas = Object.fromEntries(REPAS.map((r) => [r, candidats(recettes, r)])) as Record<Repas, Recette[]>;

  for (let n = 0; n < 7; n++) {
    for (const repas of REPAS) {
      const c = jours[n][repas];
      if (c.fixe) continue;
      const voisins = new Set([...idsDuJour(jours[n - 1]), ...idsDuJour(jours[n + 1])]);
      const aujourdhui = new Set(idsDuJour(jours[n]));
      let meilleur: Recette | null = null, score = Infinity;
      for (const r of parRepas[repas]) {
        if (aujourdhui.has(r.id)) continue;
        let s = alea() + (usages.get(r.id) ?? 0) * 2;
        if (voisins.has(r.id)) s += 20;
        if ((repas === "dejeuner" || repas === "diner") && proteines.get(r.id)) s -= 8;
        if (s < score) { score = s; meilleur = r; }
      }
      if (meilleur) {
        jours[n][repas] = { id: meilleur.id, fixe: false };
        usages.set(meilleur.id, (usages.get(meilleur.id) ?? 0) + 1);
      }
    }
  }
  return { debut: opts.debut, jours };
}

/** Change une case : elle devient « fixe » (gardée quand on régénère). id null = libre. */
export function changerCase(plan: Plan, jour: number, repas: Repas, id: string | null): Plan {
  if (jour < 0 || jour > 6) return plan;
  return { ...plan, jours: plan.jours.map((j, n) => (n === jour ? { ...j, [repas]: { id, fixe: true } } : j)) };
}

/** Recettes d'un jour (dans l'ordre des repas, cases libres sautées). */
export function recettesDuJour(plan: Plan, parId: Map<string, Recette>, jour: number): { repas: Repas; recette: Recette }[] {
  const j = plan.jours[jour];
  if (!j) return [];
  return REPAS.flatMap((repas) => {
    const r = j[repas].id ? parId.get(j[repas].id!) : undefined;
    return r ? [{ repas, recette: r }] : [];
  });
}

/** Toutes les recettes de la semaine, une fois par case (une recette prévue deux fois compte deux fois). */
export function recettesDeLaSemaine(plan: Plan, parId: Map<string, Recette>): Recette[] {
  return plan.jours.flatMap((_, n) => recettesDuJour(plan, parId, n).map((x) => x.recette));
}

export interface Preparation {
  recette: Recette;
  repas: Repas;
  /** « aujourdhui » : pour un repas du jour ; « ce-soir » : à préparer ce soir pour demain ; « des-que-possible » :
   *  recette à préparer en avance prévue lundi (la veille est dans la semaine précédente). */
  quand: "aujourdhui" | "ce-soir" | "des-que-possible";
}

/** Ce que Rayan prépare un jour donné : les repas du jour, et ce soir ce qui doit reposer pour demain. */
export function preparationsDuJour(plan: Plan, parId: Map<string, Recette>, jour: number): Preparation[] {
  const sortie: Preparation[] = [];
  const vus = new Set<string>();
  const ajouter = (p: Preparation) => {
    const k = `${p.recette.id}|${p.quand}`;
    if (!vus.has(k)) { vus.add(k); sortie.push(p); }
  };
  for (const { repas, recette } of recettesDuJour(plan, parId, jour)) {
    if (!aPreparerAvance(recette)) ajouter({ recette, repas, quand: "aujourdhui" });
    else if (jour === 0) ajouter({ recette, repas, quand: "des-que-possible" });
  }
  if (jour < 6) {
    for (const { repas, recette } of recettesDuJour(plan, parId, jour + 1)) {
      if (aPreparerAvance(recette)) ajouter({ recette, repas, quand: "ce-soir" });
    }
  }
  return sortie;
}

export interface Total { kcal: number; proteines: number; renseignees: number; recettes: number }

/** Total approximatif du jour, seulement avec les valeurs données par les fiches. null si aucune n'en donne. */
export function totalDuJour(plan: Plan, parId: Map<string, Recette>, jour: number): Total | null {
  const l = recettesDuJour(plan, parId, jour);
  const avec = l.filter((x) => x.recette.kcal !== undefined || x.recette.proteines !== undefined);
  if (!avec.length) return null;
  return {
    kcal: avec.reduce((t, x) => t + (x.recette.kcal ?? 0), 0),
    proteines: avec.reduce((t, x) => t + (x.recette.proteines ?? 0), 0),
    renseignees: avec.length,
    recettes: l.length,
  };
}

/** Plan relu sur le disque, réparé au besoin ; null s'il est inutilisable. */
export function normaliserPlan(v: unknown): Plan | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Record<string, unknown>;
  if (typeof p.debut !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(p.debut) || !Array.isArray(p.jours)) return null;
  const jours: Jour[] = Array.from({ length: 7 }, (_, n) => {
    const src = (p.jours as unknown[])[n] as Record<string, unknown> | undefined;
    const j = {} as Jour;
    for (const repas of REPAS) {
      const c = src?.[repas] as Record<string, unknown> | undefined;
      j[repas] = { id: typeof c?.id === "string" && c.id ? c.id : null, fixe: c?.fixe === true };
    }
    return j;
  });
  return { debut: p.debut, jours };
}
