// La séance du jour : 1 astuce (nouvelle ou à revoir), un entraînement mélangé, puis un défi court facultatif.
import { ASTUCES } from "./astuces.ts";
import { dayKey, type Db } from "./model.ts";
import type { AstuceId } from "./question.ts";

export type EtapeId = "astuce" | "entrainement" | "defi";

export interface Etape {
  id: EtapeId;
  titre: string;
  minutes: number;
  facultatif?: boolean;
}

/** Le découpage de la séance selon sa durée. */
export function planSeance(minutes: number): Etape[] {
  const astuce = minutes <= 5 ? 2 : minutes >= 20 ? 4 : 3;
  const defi = minutes <= 5 ? 0 : 1;
  const etapes: Etape[] = [
    { id: "astuce", titre: "L'astuce du jour", minutes: astuce },
    { id: "entrainement", titre: "Entraînement mélangé", minutes: minutes - astuce - defi },
  ];
  etapes.push({ id: "defi", titre: "Défi de 60 secondes (facultatif)", minutes: 1, facultatif: true });
  return etapes;
}

/**
 * L'astuce du jour : celle déjà faite aujourd'hui, sinon la première jamais vue (dans l'ordre), sinon celle
 * qui a le moins bien marché la dernière fois (à égalité : la plus ancienne).
 */
export function astuceDuJour(db: Db, now: number): AstuceId {
  const jour = dayKey(now, db.reglages.heureJour);
  const res = db.resultats.filter((r) => r.sorte === "astuce");
  const aujourdhui = res.filter((r) => dayKey(r.at, db.reglages.heureJour) === jour);
  if (aujourdhui.length) return aujourdhui[0].ref as AstuceId;
  const derniere = new Map<string, { part: number; at: number }>();
  for (const r of res) derniere.set(r.ref, { part: r.total ? r.bonnes / r.total : 0, at: r.at });
  const nouvelle = ASTUCES.find((a) => !derniere.has(a.id));
  if (nouvelle) return nouvelle.id;
  return [...ASTUCES].sort((a, b) => {
    const x = derniere.get(a.id)!, y = derniere.get(b.id)!;
    return x.part - y.part || x.at - y.at;
  })[0].id;
}

export interface SeanceDuJour {
  jour: string;
  etapes: Etape[];
  faites: string[];
  /** Astuce et entraînement faits (le défi est facultatif). */
  finie: boolean;
  astuce: AstuceId;
  /** Cette astuce est-elle nouvelle pour Rayan ? */
  nouvelle: boolean;
}

export function seanceDuJour(db: Db, now: number): SeanceDuJour {
  const jour = dayKey(now, db.reglages.heureJour);
  const faites = db.jours[jour]?.etapes ?? [];
  const etapes = planSeance(db.reglages.minutes);
  const astuce = astuceDuJour(db, now);
  const avant = db.resultats.filter((r) => r.sorte === "astuce" && r.ref === astuce && dayKey(r.at, db.reglages.heureJour) !== jour);
  return {
    jour, etapes, faites, astuce, nouvelle: avant.length === 0,
    finie: etapes.filter((e) => !e.facultatif).every((e) => faites.includes(e.id)),
  };
}

/** Marque une étape de la séance du jour comme faite (et la séance comme finie si tout est fait). */
export function marquerEtape(db: Db, etape: EtapeId, now: number): Db {
  const jour = dayKey(now, db.reglages.heureJour);
  const j = db.jours[jour] ?? { etapes: [] };
  if (j.etapes.includes(etape)) return db;
  const etapes = [...j.etapes, etape];
  const obligatoires = planSeance(db.reglages.minutes).filter((e) => !e.facultatif).map((e) => e.id);
  const fin = j.fin ?? (obligatoires.every((e) => etapes.includes(e)) ? now : undefined);
  return { ...db, jours: { ...db.jours, [jour]: { etapes, ...(fin !== undefined ? { fin } : {}) } } };
}

/** Jours d'affilée avec une séance finie (aujourd'hui compte s'il est fait, sinon on part d'hier). */
export function serie(db: Db, now: number): number {
  const auj = dayKey(now, db.reglages.heureJour);
  const finis = new Set(Object.entries(db.jours).filter(([, v]) => v.fin !== undefined).map(([k]) => k));
  let n = 0;
  let k = finis.has(auj) ? auj : dayKey(now - 86400_000, db.reglages.heureJour);
  while (finis.has(k)) {
    n++;
    const d = new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) - 86400_000);
    k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  return n;
}

export const nbSeancesFinies = (db: Db): number => Object.values(db.jours).filter((j) => j.fin !== undefined).length;

