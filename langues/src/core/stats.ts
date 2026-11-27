// Progrès par langue : mots vus et sus, révisions, justesse, tons, série de jours.
import { estSu } from "./espacement.ts";
import type { Langue } from "./langues.ts";
import { ajouterJours, dayKey, type Db } from "./model.ts";
import type { ExoId } from "./niveaux.ts";

export interface Progres {
  vus: number;
  sus: number;
  revisions: number;
  /** Part des rappels justes (0 à 1), null sans révision. */
  justesse: number | null;
  /** Part des tons reconnus (chinois), null sans manche. */
  tons: number | null;
  serie: number;
}

export function part(score: number, max: number): number | null {
  return max > 0 ? score / max : null;
}

export function progres(db: Db, langue: Langue, now: number): Progres {
  const cartes = db.cartes.filter((c) => c.langue === langue);
  const justes = cartes.reduce((s, c) => s + c.justes, 0);
  const fautes = cartes.reduce((s, c) => s + c.fautes, 0);
  const tons = db.resultats.filter((r) => r.langue === langue && r.exo === "tons").slice(-10);
  return {
    vus: cartes.length,
    sus: cartes.filter(estSu).length,
    revisions: justes + fautes,
    justesse: part(justes, justes + fautes),
    tons: part(tons.reduce((s, r) => s + r.score, 0), tons.reduce((s, r) => s + r.max, 0)),
    serie: serie(db, langue, now),
  };
}

/** Jours d'affilée avec au moins une manche (aujourd'hui compte s'il est commencé, sinon on part d'hier). */
export function serie(db: Db, langue: Langue, now: number): number {
  const h = db.reglages.heureJour;
  const jours = new Set(db.resultats.filter((r) => r.langue === langue).map((r) => dayKey(r.at, h)));
  for (const k of Object.keys(db.seances)) if (k.startsWith(`${langue}:`) && db.seances[k].etapes.length) jours.add(k.slice(3));
  let j = dayKey(now, h);
  if (!jours.has(j)) j = ajouterJours(j, -1);
  let n = 0;
  while (jours.has(j)) { n++; j = ajouterJours(j, -1); }
  return n;
}

/** Justesse d'un exercice par jour, sur les `jours` derniers jours où il a été fait. */
export function courbe(db: Db, langue: Langue, exo: ExoId, jours = 20): number[] {
  const h = db.reglages.heureJour;
  const m = new Map<string, { s: number; t: number }>();
  for (const r of db.resultats) {
    if (r.langue !== langue || r.exo !== exo || r.max <= 0) continue;
    const k = dayKey(r.at, h);
    const v = m.get(k) ?? { s: 0, t: 0 };
    v.s += r.score; v.t += r.max;
    m.set(k, v);
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-jours).map(([, v]) => Math.round((v.s / v.t) * 100));
}

/** Phrase qui compare deux tests (sans jugement). */
export function comparerTests(a: { mots: number; motsMax: number; phrases: number; phrasesMax: number }, b: typeof a): string {
  const pa = part(a.mots + a.phrases, a.motsMax + a.phrasesMax) ?? 0;
  const pb = part(b.mots + b.phrases, b.motsMax + b.phrasesMax) ?? 0;
  const d = Math.round((pb - pa) * 100);
  if (Math.abs(d) < 5) return "À peu près pareil que le test précédent.";
  return d > 0 ? `${d} points de mieux que le test précédent.` : `${-d} points de moins que le test précédent (normal si de nouveaux mots sont entrés dans le tirage).`;
}
