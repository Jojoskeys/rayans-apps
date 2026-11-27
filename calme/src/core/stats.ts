// Progrès : série de jours, ressenti avant / après les respirations, émotions les plus nommées. Jamais de diagnostic.
import { famille } from "./emotions.ts";
import type { Db } from "./model.ts";
import { ajouterJours } from "./temps.ts";

/** Les jours (AAAA-MM-JJ) où tu as fait au moins une chose dans l'app. */
export function joursActifs(db: Db): Set<string> {
  const s = new Set<string>();
  for (const r of db.respirations) s.add(r.jour);
  for (const a of db.activites) s.add(a.jour);
  for (const e of db.entrees) if (!e.supprime) s.add(e.jour);
  for (const g of db.gratitudes) if (!g.supprime) s.add(g.jour);
  for (const p of db.preparations) if (!p.supprime) s.add(p.jour);
  return s;
}

/** Jours d'affilée jusqu'à aujourd'hui (ou hier, si tu n'as encore rien fait aujourd'hui). */
export function serie(jours: Set<string>, aujourdhui: string): number {
  let j = jours.has(aujourdhui) ? aujourdhui : ajouterJours(aujourdhui, -1);
  let n = 0;
  while (jours.has(j)) { n++; j = ajouterJours(j, -1); }
  return n;
}

/** Respirations notées avant ET après, dans l'ordre. */
export function ressentis(db: Db): { at: number; avant: number; apres: number }[] {
  return db.respirations
    .filter((r) => r.avant !== undefined && r.apres !== undefined)
    .map((r) => ({ at: r.at, avant: r.avant!, apres: r.apres! }))
    .sort((a, b) => a.at - b.at);
}

/** Écart moyen après − avant (null s'il n'y a rien). */
export function ecartMoyen(l: { avant: number; apres: number }[]): number | null {
  if (l.length === 0) return null;
  return Math.round((l.reduce((t, x) => t + x.apres - x.avant, 0) / l.length) * 10) / 10;
}

/** Émotions les plus nommées (familles), de la plus fréquente à la moins fréquente. */
export function emotionsFrequentes(db: Db, n = 5): { id: string; nom: string; icone: string; fois: number }[] {
  const c = new Map<string, number>();
  for (const e of db.entrees) if (!e.supprime && e.famille) c.set(e.famille, (c.get(e.famille) ?? 0) + 1);
  return [...c.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([id, fois]) => ({ id, nom: famille(id)?.nom ?? id, icone: famille(id)?.icone ?? "•", fois }));
}

/** Minutes de respiration faites au total. */
export const minutesRespirees = (db: Db): number => Math.round(db.respirations.reduce((t, r) => t + r.secondes, 0) / 60);
