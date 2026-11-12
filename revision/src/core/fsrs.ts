/**
 * Planificateur FSRS (Free Spaced Repetition Scheduler, version 4.5, paramètres par défaut publiés),
 * avec des étapes d'apprentissage en minutes comme dans Anki. Fonctions pures, testées dans
 * test/fsrs.test.ts.
 *
 * - Retrievabilité R(t, S) = (1 + F·t/S)^D, avec D = −0,5 et F = 19/81 : R(S, S) = 0,9.
 * - Intervalle pour une rétention visée r : I = S/F · (r^(1/D) − 1) (= S quand r = 0,9).
 * - Première note g : S₀ = w[g−1], D₀ = w4 − (g−3)·w5.
 * - Difficulté : D' = w7·D₀(Facile) + (1 − w7)·(D − w6·(g−3)), bornée entre 1 et 10.
 * - Souvenir (g ≥ 2) : S' = S·(e^w8·(11−D)·S^−w9·(e^(w10·(1−R)) − 1)·pénalité·bonus + 1),
 *   pénalité w15 pour « Difficile », bonus w16 pour « Facile ».
 * - Oubli (g = 1) : S' = w11·D^−w12·((S+1)^w13 − 1)·e^(w14·(1−R)), jamais plus que S.
 * - Pendant l'apprentissage (étapes en minutes), S et D ne changent qu'à la première note.
 */
import { DAY, MINUTE, type Grade, type Sched, type Settings } from "./model";

export const DEFAULT_WEIGHTS = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246,
  1.587, 0.2272, 2.8755,
] as const;

const DECAY = -0.5;
const FACTOR = 19 / 81;
const w = DEFAULT_WEIGHTS;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Probabilité de se souvenir après `elapsedDays` jours pour une stabilité `stability`. */
export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY);
}

/** Intervalle (jours, non arrondi) pour que la retrievabilité tombe à `retention`. */
export function intervalFor(stability: number, retention: number): number {
  return (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
}

export function initStability(g: Grade): number {
  return Math.max(w[g - 1], 0.1);
}

export function initDifficulty(g: Grade): number {
  return clamp(w[4] - (g - 3) * w[5], 1, 10);
}

export function nextDifficulty(d: number, g: Grade): number {
  const next = d - w[6] * (g - 3);
  const meanReverted = w[7] * (w[4] - (4 - 3) * w[5]) + (1 - w[7]) * next;
  return clamp(meanReverted, 1, 10);
}

export function recallStability(d: number, s: number, r: number, g: Grade): number {
  const hardPenalty = g === 2 ? w[15] : 1;
  const easyBonus = g === 4 ? w[16] : 1;
  return s * (Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * hardPenalty * easyBonus + 1);
}

export function forgetStability(d: number, s: number, r: number): number {
  const f = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r));
  return Math.min(Math.max(f, 0.1), s);
}

/** Début (horodatage) de la journée de révision contenant `now` ; une journée commence à `dayStartHour` h. */
export function dayStart(now: number, dayStartHour = 4): number {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), dayStartHour, 0, 0, 0);
  if (start.getTime() > now) start.setDate(start.getDate() - 1);
  return start.getTime();
}

/** Début de la journée de révision suivante. */
export function nextDayStart(now: number, dayStartHour = 4): number {
  const s = new Date(dayStart(now, dayStartHour));
  s.setDate(s.getDate() + 1);
  return s.getTime();
}

/** Début de la journée de révision située `days` jours après celle de `now` (gère les changements d'heure). */
export function dayStartPlus(now: number, days: number, dayStartHour = 4): number {
  const s = new Date(dayStart(now, dayStartHour));
  s.setDate(s.getDate() + days);
  return s.getTime();
}

/** Clé « AAAA-MM-JJ » de la journée de révision contenant `ts`. */
export function dayKey(ts: number, dayStartHour = 4): string {
  const d = new Date(dayStart(ts, dayStartHour));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface Outcome {
  sched: Sched;
  /** Délai avant la prochaine présentation, en jours (fractions de jour pendant l'apprentissage). */
  interval: number;
}

type Params = Pick<Settings, "retention" | "learningSteps" | "relearningSteps" | "maxInterval" | "dayStartHour">;

function reviewInterval(stability: number, p: Params): number {
  return clamp(Math.round(intervalFor(stability, p.retention)), 1, p.maxInterval);
}

function graduate(n: Sched, now: number, p: Params, minDays = 1): Outcome {
  const days = Math.min(p.maxInterval, Math.max(minDays, reviewInterval(n.stability, p)));
  return { sched: { ...n, state: "review", step: 0, interval: days, due: dayStartPlus(now, days, p.dayStartHour) }, interval: days };
}

function inSteps(n: Sched, minutes: number, now: number): Outcome {
  const due = now + Math.round(minutes * MINUTE);
  return { sched: { ...n, interval: 0, due }, interval: minutes / (24 * 60) };
}

/** Étapes d'apprentissage (nouvelle carte) ou de réapprentissage (après un oubli). */
function stepOutcome(n: Sched, g: Grade, now: number, p: Params, steps: number[]): Outcome {
  if (steps.length === 0 || g === 4) return graduate(n, now, p);
  const step = Math.min(n.step, steps.length - 1);
  if (g === 1) return inSteps({ ...n, step: 0 }, steps[0], now);
  if (g === 2) {
    const delay = step === 0 && steps.length > 1 ? (steps[0] + steps[1]) / 2 : step === 0 ? steps[0] * 1.5 : steps[step];
    return inSteps({ ...n, step }, delay, now);
  }
  // Bien : étape suivante, ou fin de l'apprentissage après la dernière étape.
  if (step + 1 < steps.length) return inSteps({ ...n, step: step + 1 }, steps[step + 1], now);
  return graduate(n, now, p);
}

/** Nouvel état après la note `g` donnée à `now`. */
export function schedule(card: Sched, g: Grade, now: number, p: Params): Outcome {
  const n: Sched = { ...card, reps: card.reps + 1, lastReview: now };
  if (card.state === "new") {
    n.stability = initStability(g);
    n.difficulty = initDifficulty(g);
    n.state = "learning";
    n.step = 0;
    return stepOutcome(n, g, now, p, p.learningSteps);
  }
  if (card.state === "learning") return stepOutcome(n, g, now, p, p.learningSteps);
  if (card.state === "relearning") return stepOutcome(n, g, now, p, p.relearningSteps);

  const elapsed = card.lastReview === null ? 0 : Math.max(0, (now - card.lastReview) / DAY);
  const r = retrievability(elapsed, card.stability);
  n.difficulty = nextDifficulty(card.difficulty, g);
  if (g === 1) {
    n.stability = forgetStability(card.difficulty, card.stability, r);
    n.lapses = card.lapses + 1;
    n.state = "relearning";
    n.step = 0;
    if (p.relearningSteps.length === 0) return graduate(n, now, p);
    return inSteps(n, p.relearningSteps[0], now);
  }
  n.stability = recallStability(card.difficulty, card.stability, r, g);
  return graduate(n, now, p);
}

/**
 * Résultat des quatre notes possibles. Pour une carte en révision, les intervalles sont rendus
 * strictement croissants (Difficile ≤ Bien < Facile) pour que les boutons restent lisibles.
 */
export function previewAll(card: Sched, now: number, p: Params): Record<Grade, Outcome> {
  const out = {
    1: schedule(card, 1, now, p),
    2: schedule(card, 2, now, p),
    3: schedule(card, 3, now, p),
    4: schedule(card, 4, now, p),
  } as Record<Grade, Outcome>;
  const fix = (g: Grade, days: number) => {
    const o = out[g];
    if (o.sched.state !== "review" || o.sched.interval === days) return;
    const d = Math.min(p.maxInterval, days);
    out[g] = { sched: { ...o.sched, interval: d, due: dayStartPlus(now, d, p.dayStartHour) }, interval: d };
  };
  if (card.state === "review") {
    const hard = out[2].sched.interval;
    const good = out[3].sched.interval;
    fix(2, Math.min(hard, good));
    fix(3, Math.max(good, out[2].sched.interval + 1));
    fix(4, Math.max(out[4].sched.interval, out[3].sched.interval + 1));
  } else if (out[4].sched.state === "review" && out[3].sched.state === "review") {
    fix(4, Math.max(out[4].sched.interval, out[3].sched.interval + 1));
  }
  return out;
}

/** Applique la note `g` (avec les mêmes corrections d'ordre que les boutons affichés). */
export function answer(card: Sched, g: Grade, now: number, p: Params): Outcome {
  return previewAll(card, now, p)[g];
}

/** Texte court pour un délai : « 1 min », « 10 min », « 3 j », « 2 mois », « 1,5 an ». */
export function formatDelay(ms: number): string {
  const min = Math.max(1, Math.round(ms / MINUTE));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const days = Math.round(ms / DAY);
  if (days < 31) return `${days} j`;
  if (days < 365) return `${Math.round(days / 30.4)} mois`;
  const years = Math.round((days / 365) * 10) / 10;
  return `${String(years).replace(".", ",")} an${years >= 2 ? "s" : ""}`;
}
