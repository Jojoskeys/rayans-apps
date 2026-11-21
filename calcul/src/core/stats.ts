// Petits calculs pour les progrès.
import { ASTUCES } from "./astuces.ts";
import { testsFaits } from "./defis.ts";
import type { Db, Resultat, Sorte } from "./model.ts";
import type { AstuceId } from "./question.ts";

export function historique(db: Db, sorte: Sorte, dernier = 30): Resultat[] {
  return db.resultats.filter((r) => r.sorte === sorte).slice(-dernier);
}

export const justesse = (r: Pick<Resultat, "bonnes" | "total">): number => (r.total ? Math.round((r.bonnes / r.total) * 100) : 0);

/** Chaque test comparé au test de départ : justesse (points de %) et temps moyen (secondes). */
export function comparerTests(db: Db): { r: Resultat; justesse: number; tempsS: number; diffJustesse: number | null; diffTempsS: number | null }[] {
  const t = testsFaits(db);
  const s = (ms: number) => Math.round(ms / 100) / 10;
  return t.map((r, i) => ({
    r,
    justesse: justesse(r),
    tempsS: s(r.tempsMoyenMs),
    diffJustesse: i === 0 ? null : justesse(r) - justesse(t[0]),
    diffTempsS: i === 0 ? null : Math.round((s(r.tempsMoyenMs) - s(t[0].tempsMoyenMs)) * 10) / 10,
  }));
}

/** Le meilleur score (sur 10) obtenu à chaque astuce, null si jamais faite. */
export function meilleursAstuces(db: Db): Record<AstuceId, number | null> {
  const out = {} as Record<AstuceId, number | null>;
  for (const a of ASTUCES) {
    const s = db.resultats.filter((r) => r.sorte === "astuce" && r.ref === a.id).map((r) => r.bonnes);
    out[a.id] = s.length ? Math.max(...s) : null;
  }
  return out;
}
