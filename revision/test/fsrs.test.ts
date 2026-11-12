import { describe, expect, it } from "vitest";
import {
  answer, dayKey, dayStart, forgetStability, formatDelay, initDifficulty, initStability, intervalFor, nextDayStart,
  nextDifficulty, previewAll, recallStability, retrievability, schedule,
} from "../src/core/fsrs";
import { DAY, DEFAULT_SETTINGS, MINUTE, newSched, type Grade, type Sched } from "../src/core/model";

const P = DEFAULT_SETTINGS;
const T0 = new Date(2026, 0, 10, 9, 0, 0).getTime(); // 10 janvier 2026, 9 h

function reviewCard(stability: number, difficulty: number, lastReview: number): Sched {
  return { state: "review", due: lastReview + stability * DAY, stability, difficulty, step: 0, interval: Math.round(stability), reps: 3, lapses: 0, lastReview };
}

describe("formules FSRS", () => {
  it("retrievabilité : 100 % au moment de la révision, 90 % après S jours, décroissante", () => {
    expect(retrievability(0, 5)).toBe(1);
    expect(retrievability(5, 5)).toBeCloseTo(0.9, 10);
    expect(retrievability(10, 5)).toBeLessThan(0.9);
    expect(retrievability(100, 5)).toBeLessThan(retrievability(10, 5));
  });

  it("intervalle : égal à S pour 90 % de rétention, plus court si l'on vise plus haut", () => {
    expect(intervalFor(10, 0.9)).toBeCloseTo(10, 10);
    expect(intervalFor(10, 0.95)).toBeLessThan(10);
    expect(intervalFor(10, 0.8)).toBeGreaterThan(10);
    // Cohérence : la retrievabilité à l'intervalle calculé vaut la rétention visée.
    expect(retrievability(intervalFor(7, 0.85), 7)).toBeCloseTo(0.85, 10);
  });

  it("valeurs initiales = paramètres par défaut de FSRS-4.5", () => {
    expect(initStability(1)).toBeCloseTo(0.4872);
    expect(initStability(3)).toBeCloseTo(3.7145);
    expect(initStability(4)).toBeCloseTo(13.8206);
    expect(initDifficulty(3)).toBeCloseTo(5.1618);
    expect(initDifficulty(1)).toBeCloseTo(5.1618 + 2 * 1.2298);
    expect(initDifficulty(4)).toBeCloseTo(5.1618 - 1.2298);
  });

  it("difficulté : augmente après « À revoir », baisse après « Facile », reste entre 1 et 10", () => {
    expect(nextDifficulty(5, 1)).toBeGreaterThan(5);
    expect(nextDifficulty(5, 4)).toBeLessThan(5);
    expect(nextDifficulty(5, 3)).toBeCloseTo(0.031 * (5.1618 - 1.2298) + 0.969 * 5, 10);
    let d = 5;
    for (let i = 0; i < 100; i++) d = nextDifficulty(d, 1);
    expect(d).toBeLessThanOrEqual(10);
    for (let i = 0; i < 100; i++) d = nextDifficulty(d, 4);
    expect(d).toBeGreaterThanOrEqual(1);
  });

  it("stabilité : Facile > Bien > Difficile > S après un souvenir, et un oubli la réduit", () => {
    const s = 10;
    const d = 5;
    const r = 0.9;
    const hard = recallStability(d, s, r, 2);
    const good = recallStability(d, s, r, 3);
    const easy = recallStability(d, s, r, 4);
    expect(hard).toBeGreaterThan(s);
    expect(good).toBeGreaterThan(hard);
    expect(easy).toBeGreaterThan(good);
    expect(forgetStability(d, s, r)).toBeLessThan(s);
    // Valeur de référence calculée à la main : S·(e^w8·(11−D)·S^−w9·(e^(w10·0,1)−1)+1).
    const expected = 10 * (Math.exp(1.6474) * 6 * Math.pow(10, -0.1367) * (Math.exp(1.0461 * 0.1) - 1) + 1);
    expect(good).toBeCloseTo(expected, 10);
  });

  it("se souvenir d'une carte en retard augmente plus la stabilité", () => {
    expect(recallStability(5, 10, 0.7, 3)).toBeGreaterThan(recallStability(5, 10, 0.9, 3));
  });
});

describe("planification d'une nouvelle carte", () => {
  const card = newSched(T0);

  it("À revoir → 1 min, Difficile → 5,5 min, Bien → 10 min (étapes 1 et 10 min), Facile → révision", () => {
    const p = previewAll(card, T0, P);
    expect(p[1].sched.state).toBe("learning");
    expect(p[1].sched.due - T0).toBe(1 * MINUTE);
    expect(p[2].sched.due - T0).toBe(5.5 * MINUTE);
    expect(p[3].sched.due - T0).toBe(10 * MINUTE);
    expect(p[3].sched.step).toBe(1);
    expect(p[4].sched.state).toBe("review");
    expect(p[4].sched.interval).toBe(14); // round(13,8206)
    expect(p[4].sched.due).toBe(new Date(2026, 0, 24, 4).getTime());
  });

  it("première note : S et D initialisés, compteur de répétitions incrémenté", () => {
    const o = schedule(card, 3, T0, P);
    expect(o.sched.stability).toBeCloseTo(3.7145);
    expect(o.sched.difficulty).toBeCloseTo(5.1618);
    expect(o.sched.reps).toBe(1);
    expect(o.sched.lastReview).toBe(T0);
  });

  it("Bien, Bien → fin de l'apprentissage avec un intervalle de round(S0(Bien)) = 4 jours", () => {
    const a = answer(card, 3, T0, P);
    const b = answer(a.sched, 3, T0 + 10 * MINUTE, P);
    expect(b.sched.state).toBe("review");
    expect(b.sched.interval).toBe(4);
    expect(b.sched.stability).toBeCloseTo(3.7145); // pas de changement pendant les étapes
    expect(dayKey(b.sched.due)).toBe("2026-01-14");
  });

  it("À revoir pendant l'apprentissage → retour à la première étape", () => {
    const a = answer(card, 3, T0, P);
    const b = answer(a.sched, 1, T0 + 10 * MINUTE, P);
    expect(b.sched.state).toBe("learning");
    expect(b.sched.step).toBe(0);
    expect(b.sched.due - (T0 + 10 * MINUTE)).toBe(MINUTE);
  });

  it("sans étapes d'apprentissage, une nouvelle carte passe directement en révision", () => {
    const o = answer(card, 1, T0, { ...P, learningSteps: [] });
    expect(o.sched.state).toBe("review");
    expect(o.sched.interval).toBe(1);
  });
});

describe("planification d'une carte en révision", () => {
  const last = T0 - 10 * DAY;
  const card = reviewCard(10, 5, last);

  it("intervalles strictement croissants Difficile < Bien < Facile, et Bien ≈ nouvelle stabilité", () => {
    const p = previewAll(card, T0, P);
    expect(p[2].sched.interval).toBeLessThan(p[3].sched.interval);
    expect(p[3].sched.interval).toBeLessThan(p[4].sched.interval);
    expect(p[3].sched.interval).toBe(Math.round(p[3].sched.stability));
    for (const g of [2, 3, 4] as Grade[]) {
      expect(p[g].sched.state).toBe("review");
      // Jours calendaires à 4 h (le passage à l'heure d'été est géré).
      expect(p[g].sched.due).toBe(new Date(2026, 0, 10 + p[g].sched.interval, 4).getTime());
    }
  });

  it("oubli : réapprentissage dans 10 min, oublis +1, stabilité réduite ; puis Bien → révision dans ≥ 1 jour", () => {
    const o = answer(card, 1, T0, P);
    expect(o.sched.state).toBe("relearning");
    expect(o.sched.lapses).toBe(1);
    expect(o.sched.due - T0).toBe(10 * MINUTE);
    expect(o.sched.stability).toBeLessThan(10);
    const back = answer(o.sched, 3, T0 + 10 * MINUTE, P);
    expect(back.sched.state).toBe("review");
    expect(back.sched.interval).toBeGreaterThanOrEqual(1);
    expect(back.sched.lapses).toBe(1);
  });

  it("une rétention visée plus haute donne des intervalles plus courts", () => {
    const at90 = answer(card, 3, T0, P).sched.interval;
    const at95 = answer(card, 3, T0, { ...P, retention: 0.95 }).sched.interval;
    expect(at95).toBeLessThan(at90);
  });

  it("l'intervalle maximal est respecté", () => {
    const big = reviewCard(5000, 1, T0 - 5000 * DAY);
    const p = previewAll(big, T0, { ...P, maxInterval: 365 });
    expect(p[4].sched.interval).toBeLessThanOrEqual(365);
    expect(p[3].sched.interval).toBeLessThanOrEqual(365);
  });

  it("des « Bien » successifs font grandir les intervalles", () => {
    let s: Sched = newSched(T0);
    let now = T0;
    const intervals: number[] = [];
    for (let i = 0; i < 8; i++) {
      const o = answer(s, 3, now, P);
      s = o.sched;
      if (s.state === "review") intervals.push(s.interval);
      now = s.due + 9 * 3600_000; // révisé à 13 h le jour prévu
    }
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
    expect(intervals[intervals.length - 1]).toBeGreaterThan(60);
  });
});

describe("journées de révision (début à 4 h)", () => {
  it("à 3 h du matin on est encore dans la journée de la veille", () => {
    const at3 = new Date(2026, 0, 10, 3).getTime();
    expect(dayKey(at3)).toBe("2026-01-09");
    expect(dayStart(at3)).toBe(new Date(2026, 0, 9, 4).getTime());
    expect(nextDayStart(at3)).toBe(new Date(2026, 0, 10, 4).getTime());
    expect(dayKey(new Date(2026, 0, 10, 4).getTime())).toBe("2026-01-10");
  });
});

describe("formatDelay", () => {
  it("affiche minutes, heures, jours, mois et années en français", () => {
    expect(formatDelay(MINUTE)).toBe("1 min");
    expect(formatDelay(10 * MINUTE)).toBe("10 min");
    expect(formatDelay(3 * 3600_000)).toBe("3 h");
    expect(formatDelay(4 * DAY)).toBe("4 j");
    expect(formatDelay(61 * DAY)).toBe("2 mois");
    expect(formatDelay(548 * DAY)).toBe("1,5 an");
    expect(formatDelay(800 * DAY)).toBe("2,2 ans");
  });
});
