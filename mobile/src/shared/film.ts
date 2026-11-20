// Film de l'Arène (tuile Arène) : une vraie évolution exportée par arene/publier.py (film.json). Chaque génération :
// [id, id du parent (-1 au début), type de règle (0-3), rendement sur l'entraînement, survit à la sélection],
// rangés du mieux noté au moins bien noté (la note tient compte du risque et du nombre d'ordres, pas que du gain).
// Ici : lecture prudente du fichier et petits calculs purs pour l'animation (positions, tailles, naissances).

export type Agent = [id: number, parent: number, type: number, rendement: number, survit: boolean];
export interface Film {
  nom: string; entrainement: string; test: string; types: string[];
  generations: Agent[][];
  champion: { regle: string; entrainement: number; ordres: number; id: number; parent: number; type: number };
  examen: { dates: string[]; champion: number[]; ag: number[] };
}

const nombres = (x: unknown): x is number[] => Array.isArray(x) && x.every((v) => typeof v === "number" && Number.isFinite(v));

export function nettoyerFilm(x: unknown): Film | null {
  const f = x as Partial<Film> | null;
  if (!f || !Array.isArray(f.generations) || !f.generations.length || !f.champion || !f.examen) return null;
  const gens = f.generations.map((g) => (Array.isArray(g) ? g.filter((a): a is Agent =>
    Array.isArray(a) && a.length === 5 && Number.isInteger(a[0]) && Number.isInteger(a[1]) && Number.isInteger(a[2]) && a[2] >= 0 && a[2] < 4
    && typeof a[3] === "number" && Number.isFinite(a[3]) && typeof a[4] === "boolean") : []));
  if (gens.some((g) => !g.length)) return null;
  const e = f.examen;
  if (!Array.isArray(e.dates) || !nombres(e.champion) || !nombres(e.ag) || e.champion.length !== e.dates.length || e.ag.length !== e.dates.length || !e.dates.length) return null;
  return {
    nom: String(f.nom ?? ""), entrainement: String(f.entrainement ?? ""), test: String(f.test ?? ""),
    types: Array.isArray(f.types) && f.types.length === 4 ? f.types.map(String) : ["Type 1", "Type 2", "Type 3", "Type 4"],
    generations: gens,
    champion: { regle: String(f.champion.regle ?? ""), entrainement: Number(f.champion.entrainement) || 0, ordres: Number(f.champion.ordres) || 0,
      id: Number.isInteger(f.champion.id) ? f.champion.id : -1, parent: Number.isInteger(f.champion.parent) ? f.champion.parent : -1,
      type: Number.isInteger(f.champion.type) && f.champion.type >= 0 && f.champion.type < 4 ? f.champion.type : 0 },
    examen: { dates: e.dates.map(String), champion: e.champion, ag: e.ag },
  };
}

/** Nombre pseudo-aléatoire stable dans [0, 1) pour un id et un canal (même agent = même allure à chaque fois). */
export function hasard(id: number, canal: number): number {
  let h = (id * 374761393 + canal * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Position d'un agent qui se promène dans l'arène [marge, L-marge] × [haut, H-marge] au temps t (secondes). */
export function position(id: number, t: number, L: number, H: number, marge: number, haut: number): { x: number; y: number } {
  const cx = marge + (L - 2 * marge) * (0.12 + 0.76 * hasard(id, 1));
  const cy = haut + (H - haut - marge) * (0.12 + 0.76 * hasard(id, 2));
  const ax = (L - 2 * marge) * 0.1, ay = (H - haut - marge) * 0.1;
  const v1 = 0.35 + hasard(id, 3) * 0.6, v2 = 0.3 + hasard(id, 4) * 0.6, p = hasard(id, 5) * 6.283;
  return {
    x: Math.min(L - marge, Math.max(marge, cx + ax * Math.sin(t * v1 + p) + ax * 0.5 * Math.sin(t * v2 * 1.7 + p * 2))),
    y: Math.min(H - marge, Math.max(haut, cy + ay * Math.cos(t * v2 + p) + ay * 0.5 * Math.sin(t * v1 * 1.3 + p))),
  };
}

/** Rang de chaque agent dans sa génération selon son rendement : 0 = le moins bon, 1 = le meilleur. */
export function rangs(gen: Agent[]): Map<number, number> {
  const tries = [...gen].sort((a, b) => a[3] - b[3]);
  return new Map(tries.map((a, i) => [a[0], tries.length > 1 ? i / (tries.length - 1) : 1]));
}

/** Enfants nés pendant la génération g (présents dans g+1 mais pas dans g), avec leur parent. */
export function naissances(gens: Agent[][], g: number): { id: number; parent: number; type: number }[] {
  if (g + 1 >= gens.length) return [];
  const avant = new Set(gens[g].map((a) => a[0]));
  return gens[g + 1].filter((a) => !avant.has(a[0])).map((a) => ({ id: a[0], parent: a[1], type: a[2] }));
}

export const meilleur = (gen: Agent[]): Agent => gen.reduce((m, a) => (a[3] > m[3] ? a : m), gen[0]);
/** Le mieux noté de la génération (celui que la sélection préfère) : le premier de la liste. */
export const enTete = (gen: Agent[]): Agent => gen[0];

/** Où apparaît la championne dans la dernière génération filmée : elle-même, ou le survivant dont elle est l'enfant. */
export function placeChampion(f: Film): { id: number; ne: boolean } {
  const derniere = f.generations[f.generations.length - 1];
  if (derniere.some((a) => a[0] === f.champion.id)) return { id: f.champion.id, ne: false };
  if (derniere.some((a) => a[0] === f.champion.parent)) return { id: f.champion.parent, ne: true };
  return { id: enTete(derniere)[0], ne: false };
}
