// Mesures pour les objectifs du jour, tirées des fichiers des autres apps (lus seulement) :
//   Révision : journal des révisions (`reviews[].ts`) → cartes révisées par journée.
//   Chrono   : plages de temps (`entries[].start/end`) → minutes par journée.
//   Journal  : `resume-quotidien.json` (temps de jeu, dernière activité par journée, de 4 h à 4 h).
//   Sport    : `sport.json` d'Aujourd'hui (séance faite, jours de repos, pompes et tractions des séances).
// Fonctions pures : le contenu des fichiers est passé en paramètre.

import type { SourceCount } from "./counts.ts";
import { journee, type Mesures } from "./objectifs.ts";
import { nettoyerSport, resumeSport } from "./sport.ts";

export function revisionParJour(raw: unknown): Record<string, number> | undefined {
  const reviews = (raw as { reviews?: { ts?: number }[] })?.reviews;
  if (!Array.isArray(reviews)) return undefined;
  const out: Record<string, number> = {};
  for (const r of reviews) if (typeof r?.ts === "number") out[journee(r.ts)] = (out[journee(r.ts)] ?? 0) + 1;
  return out;
}

export function chronoParJour(raw: unknown): Record<string, number> | undefined {
  const entries = (raw as { entries?: { start?: number; end?: number }[] })?.entries;
  if (!Array.isArray(entries)) return undefined;
  const out: Record<string, number> = {};
  for (const e of entries) {
    if (typeof e?.start !== "number" || typeof e?.end !== "number" || e.end <= e.start) continue;
    const j = journee(e.start);
    out[j] = (out[j] ?? 0) + (e.end - e.start) / 60_000;
  }
  return out;
}

interface JourneeJournal { jour: string; ecranMs: number; jeuxMs: number; derniereMs?: number | null }

/** Temps de jeu et dernière activité (minutes depuis minuit du jour, + 1440 après minuit). */
export function journalParJour(raw: unknown): { jeuxMin?: Record<string, number>; coucherMin?: Record<string, number> } {
  const jours = (raw as { jours?: JourneeJournal[] })?.jours;
  if (!Array.isArray(jours)) return {};
  const jeuxMin: Record<string, number> = {};
  const coucherMin: Record<string, number> = {};
  for (const j of jours) {
    if (!j || typeof j.jour !== "string" || !(j.ecranMs > 0)) continue; // journée non suivie : ni 0 ni valeur
    jeuxMin[j.jour] = (j.jeuxMs ?? 0) / 60_000;
    if (typeof j.derniereMs === "number") {
      const [a, m, d] = j.jour.split("-").map(Number);
      coucherMin[j.jour] = Math.round((j.derniereMs - new Date(a, m - 1, d).getTime()) / 60_000);
    }
  }
  return { jeuxMin, coucherMin };
}

export function mesures(p: { revision?: unknown; chrono?: unknown; journal?: unknown; sport?: unknown; counts: SourceCount[] }): Mesures {
  const reste = (id: SourceCount["id"]) => {
    const c = p.counts.find((x) => x.id === id);
    return c && !c.missing && c.total !== null ? c.total : undefined;
  };
  const j = journalParJour(p.journal);
  return {
    revisionCartes: revisionParJour(p.revision),
    revisionRestantes: reste("revision"),
    chronoMin: chronoParJour(p.chrono),
    jeuxMin: j.jeuxMin,
    coucherMin: j.coucherMin,
    hifzRestantes: reste("hifz"),
    ouverturesRestantes: reste("ouvertures"),
    ...resumeSport(nettoyerSport(p.sport)),
  };
}
