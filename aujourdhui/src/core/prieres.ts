// Heures de prière du jour, calculées exactement comme Rayan's Prière (même code : priere/src/core) à partir de
// ses réglages (`priere.json`, seulement lu) : lieu, méthode, école pour Asr, hautes latitudes, décalages.
import { dayAt } from "../../../priere/src/core/schedule.ts";
import { normalizeData } from "../../../priere/src/core/settings.ts";
import type { Prieres } from "./bilan.ts";

export function heuresDePriere(priereJson: unknown, now: number): Prieres | null {
  try {
    const s = normalizeData(priereJson).settings;
    const d = dayAt(s, now);
    if (!d) return null;
    const t = d.times;
    if (![t.fajr, t.lever, t.asr, t.maghrib].every(Number.isFinite)) return null;
    return { fajr: t.fajr, lever: t.lever, asr: t.asr, maghrib: t.maghrib };
  } catch {
    return null;
  }
}
