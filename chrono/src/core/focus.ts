// Aides à la concentration de Rayan's Chrono (sur le PC) : écran de pause plein écran, barre du temps de travail
// du jour en haut de l'écran, et réduction des fenêtres qui distraient pendant le travail.
// Fonctions pures : l'heure et les données sont passées en paramètre.
import { liveEntry } from "./engine.ts";
import { startOfDay, summarize } from "./summary.ts";
import type { AppData } from "./types.ts";

/** Report de la pause (« encore 5 min ») : une seule fois par pause. */
export const REPORT_MS = 5 * 60_000;

export interface Report {
  /** Début (endsAt) de la pause pour laquelle le report a été utilisé. */
  pause: number;
  /** Jusqu'à quand l'écran de pause est caché. */
  jusqua: number;
}

export interface EtatFocus {
  /** Afficher l'écran de pause plein écran maintenant. */
  ecranPause: boolean;
  /** Le report de 5 minutes est encore possible pour cette pause. */
  reportPossible: boolean;
  barre: boolean;
  /** Part de l'objectif du jour déjà faite, entre 0 et 1. */
  ratio: number;
  /** Bloquer les distractions maintenant (phase de travail en marche). */
  bloquer: boolean;
}

/** Temps de travail du jour (ms), segment en cours compris. */
export function travailDuJour(d: AppData, now: number): number {
  const live = liveEntry(d, now);
  const from = startOfDay(now);
  return summarize(d, from, from + 86_400_000 + 3_600_000, live ? [live] : []).ms;
}

export function etatFocus(d: AppData, now: number, report: Report | null): EtatFocus {
  const s = d.settings, t = d.timer;
  const enPause = t.mode === "pomodoro" && t.status === "marche" && (t.phase === "pause" || t.phase === "longue");
  const reportCettePause = report !== null && t.endsAt !== null && report.pause === t.endsAt;
  const travail = t.status === "marche" && (t.mode === "chrono" || t.phase === "travail");
  return {
    ecranPause: s.pauseForcee && enPause && !(reportCettePause && now < report.jusqua),
    reportPossible: !reportCettePause,
    barre: s.barreTemps,
    ratio: s.barreTemps ? Math.min(1, travailDuJour(d, now) / (s.objectifMin * 60_000)) : 0,
    bloquer: s.bloquer && travail && s.motsBloques.length > 0,
  };
}

const plier = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Le mot bloqué trouvé dans le titre de la fenêtre, ou null. Les fenêtres de Rayan's Chrono ne sont jamais bloquées. */
export function motTrouve(titre: string, mots: string[]): string | null {
  const t = plier(titre);
  if (!t || t.includes("rayan's chrono")) return null;
  return mots.find((m) => t.includes(plier(m))) ?? null;
}
