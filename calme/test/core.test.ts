import { describe, expect, it } from "vitest";
import { FICHES, NUMEROS, QUIZ, source, SOURCES } from "../src/core/contenu";
import { besoinAide, FAMILLES, phraseEcart, QUESTIONS_REEVAL } from "../src/core/emotions";
import { dayKey, emptyDb, fusionner, fusionnerTexte, parseDb, type Entree, type Respiration } from "../src/core/model";
import { apresRespiration, dureeProposee, niveauDepart, niveauSuivant, phraseNiveau, resultatRespiration } from "../src/core/niveaux";
import { comparer, QUESTIONS, testAFaire } from "../src/core/questionnaire";
import { dureeRelaxation, momentRelax, ZONES } from "../src/core/relaxation";
import { dureeCycle, instant, parMinute, rythme, RYTHMES } from "../src/core/respiration";
import { makeRng, shuffle } from "../src/core/rng";
import { motDuJour, planSeance } from "../src/core/seance";
import { ecartMoyen, emotionsFrequentes, joursActifs, ressentis, serie } from "../src/core/stats";
import { ajouterJours, joursEntre } from "../src/core/temps";

const JOUR = 86400_000;
const resp = (id: string, x: Partial<Respiration> = {}): Respiration => ({
  id, at: 1, jour: "2026-11-21", rythme: "six", dureeMin: 3, secondes: 180, terminee: true, ...x,
});
const entree = (id: string, x: Partial<Entree> = {}): Entree => ({
  id, at: 1, jour: "2026-11-21", famille: "colere", nuance: "", intensite: 6, situation: "", pensee: "", reponses: {},
  equilibree: "", apres: null, ideesNoires: false, maj: 1, ...x,
});

describe("respiration", () => {
  it("rythmes : 6/min pour 5-5 et 4-6, soupir autour de 6", () => {
    expect(dureeCycle(rythme("six"))).toBe(10);
    expect(parMinute(rythme("six"))).toBe(6);
    expect(parMinute(rythme("quatre-six"))).toBe(6);
    expect(rythme("soupir").phases.map((p) => p.type)).toEqual(["inspire", "inspire2", "expire"]);
    expect(RYTHMES).toHaveLength(3);
  });
  it("instant : phase, secondes restantes et taille du cercle", () => {
    const r = rythme("quatre-six");
    expect(instant(r, 0).phase.type).toBe("inspire");
    expect(instant(r, 0).taille).toBeCloseTo(0);
    expect(instant(r, 2).taille).toBeCloseTo(0.5);
    expect(instant(r, 3.9).reste).toBe(1);
    const e = instant(r, 4.5);
    expect(e.phase.type).toBe("expire");
    expect(e.reste).toBe(6);
    expect(instant(r, 22).cycle).toBe(2);
    expect(instant(r, 22).phase.type).toBe("inspire");
    const s = instant(rythme("soupir"), 3);
    expect(s.phase.type).toBe("inspire2");
    expect(s.taille).toBeGreaterThan(0.8);
  });
});

describe("niveau de la respiration (seule difficulté adaptative)", () => {
  it("2 séances terminées → durée plus longue ; abandon → plus courte ; bornes", () => {
    let n = niveauDepart("respiration");
    expect(dureeProposee(n)).toBe(3);
    n = niveauSuivant("respiration", n, true, 1);
    expect(dureeProposee(n)).toBe(3);
    n = niveauSuivant("respiration", n, true, 2);
    expect(dureeProposee(n)).toBe(5);
    n = niveauSuivant("respiration", n, false, 3);
    expect(dureeProposee(n)).toBe(3);
    n = niveauSuivant("respiration", n, false, 4);
    n = niveauSuivant("respiration", n, false, 5);
    expect(dureeProposee(n)).toBe(2);
    for (let i = 0; i < 20; i++) n = niveauSuivant("respiration", n, true, 6 + i);
    expect(dureeProposee(n)).toBe(10);
  });
  it("séance plus courte que proposé terminée : rien ne change", () => {
    const n = niveauDepart("respiration");
    expect(resultatRespiration(n, 2, true)).toBe("neutre");
    expect(resultatRespiration(n, 5, true)).toBe("reussite");
    expect(resultatRespiration(n, 5, false)).toBe("echec");
    expect(apresRespiration(n, 2, true, 9)).toBe(n);
    const a = apresRespiration(apresRespiration(n, 3, true, 1), 3, true, 2);
    expect(phraseNiveau(n, a)).toContain("5 min");
    expect(phraseNiveau(n, apresRespiration(n, 3, false, 1))).toContain("2 min");
  });
});

describe("nommer et réévaluer", () => {
  it("roue de mots, questions de réévaluation", () => {
    expect(FAMILLES.length).toBeGreaterThanOrEqual(8);
    for (const id of ["colere", "peur", "tristesse", "honte", "frustration", "inquietude", "fatigue"]) expect(FAMILLES.some((f) => f.id === id)).toBe(true);
    for (const f of FAMILLES) expect(f.nuances.length).toBeGreaterThanOrEqual(3);
    expect(QUESTIONS_REEVAL.map((q) => q.id)).toEqual(["pour", "contre", "ami", "unAn", "controle"]);
  });
  it("page d'aide affichée si intensité ≥ 9 ou idées noires", () => {
    expect(besoinAide(8, false)).toBe(false);
    expect(besoinAide(9, false)).toBe(true);
    expect(besoinAide(2, true)).toBe(true);
    expect(phraseEcart(8, 5)).toContain("8 à 5");
    expect(phraseEcart(5, 5)).toContain("pas un échec");
  });
});

describe("séance du jour", () => {
  it("respiration → nommer OU gratitude en alternance → fin", () => {
    expect(planSeance(10, 0).map((e) => e.type)).toEqual(["respiration", "nommer", "fin"]);
    expect(planSeance(10, 1).map((e) => e.type)).toEqual(["respiration", "gratitude", "fin"]);
    expect(planSeance(20, 0).map((e) => e.type)).toEqual(["respiration", "nommer", "relaxation", "fin"]);
    for (const d of [5, 10, 15, 20] as const) {
      const p = planSeance(d, 0);
      expect(p.reduce((t, e) => t + e.min, 0)).toBe(d);
      expect(p[0].min).toBeGreaterThanOrEqual(2);
      expect(p[0].min).toBeLessThanOrEqual(5);
    }
    expect(motDuJour("2026-11-21")).toBe(motDuJour("2026-11-21"));
  });
  it("relaxation : environ 5 minutes, zones dans l'ordre", () => {
    expect(dureeRelaxation()).toBeGreaterThanOrEqual(240);
    expect(dureeRelaxation()).toBeLessThanOrEqual(330);
    expect(momentRelax(0).type).toBe("intro");
    expect(momentRelax(21)).toMatchObject({ type: "contracte", zone: 0 });
    expect(momentRelax(27)).toMatchObject({ type: "relache", zone: 0 });
    expect(momentRelax(dureeRelaxation())).toEqual({ type: "fin" });
    expect(ZONES.length).toBe(10);
  });
});

describe("questionnaire de la semaine", () => {
  it("à faire au départ puis tous les 7 jours", () => {
    expect(testAFaire([], 0)).toBe(true);
    const t = { id: "a", at: 0, type: "depart" as const, reponses: [5, 5, 5, 5, 5] };
    expect(testAFaire([t], 6 * JOUR)).toBe(false);
    expect(testAFaire([t], 7 * JOUR)).toBe(true);
  });
  it("compare en tenant compte du sens de chaque question", () => {
    const a = { id: "a", at: 0, type: "depart" as const, reponses: [8, 4, 3, 7, 3] };
    const b = { id: "b", at: 1, type: "suivi" as const, reponses: [5, 4, 6, 8, 3] };
    const c = comparer(a, b);
    expect(c.map((x) => x.sens)).toEqual(["mieux", "pareil", "mieux", "moins", "pareil"]);
    expect(QUESTIONS).toHaveLength(5);
  });
});

describe("progrès", () => {
  it("série de jours, ressenti avant/après, émotions fréquentes", () => {
    const db = emptyDb();
    db.respirations.push(resp("1", { jour: "2026-11-19", avant: 4, apres: 7, at: 1 }), resp("2", { jour: "2026-11-20", avant: 5, apres: 6, at: 2 }), resp("3", { jour: "2026-11-21" }));
    db.entrees.push(entree("a"), entree("b"), entree("c", { famille: "peur" }), entree("d", { famille: "honte", supprime: true }));
    const j = joursActifs(db);
    expect(serie(j, "2026-11-21")).toBe(3);
    expect(serie(j, "2026-11-22")).toBe(3);
    expect(serie(j, "2026-11-23")).toBe(0);
    expect(ressentis(db)).toHaveLength(2);
    expect(ecartMoyen(ressentis(db))).toBe(2);
    expect(ecartMoyen([])).toBeNull();
    expect(emotionsFrequentes(db).map((e) => [e.id, e.fois])).toEqual([["colere", 2], ["peur", 1]]);
  });
  it("jours", () => {
    expect(ajouterJours("2026-02-28", 1)).toBe("2026-03-01");
    expect(joursEntre("2026-11-01", "2026-11-21")).toBe(20);
    expect(dayKey(new Date(2026, 10, 21, 3, 0).getTime(), 4)).toBe("2026-11-20");
  });
});

describe("contenu", () => {
  it("fiches demandées, quiz, sources et numéros d'aide", () => {
    for (const id of ["respiration", "nommer", "reevaluer", "gratitude", "examen", "pleine-conscience", "colere", "aide"]) expect(FICHES.some((f) => f.id === id)).toBe(true);
    expect(QUIZ.length).toBeGreaterThanOrEqual(8);
    for (const q of QUIZ) expect(FICHES.some((f) => f.id === q.fiche)).toBe(true);
    for (const f of FICHES) for (const s of f.sources) expect(SOURCES.some((x) => x.id === s)).toBe(true);
    expect(source("inconnue").texte).toBe("inconnue");
    expect(NUMEROS.map((n) => n.tel)).toEqual(["3114", "15", "112", "0972394050"]);
  });
  it("hasard reproductible", () => {
    expect(shuffle(makeRng(7), [1, 2, 3, 4, 5])).toEqual(shuffle(makeRng(7), [1, 2, 3, 4, 5]));
  });
});

describe("données et fusion", () => {
  it("fichier vide, relecture, refus d'un autre format", () => {
    const db = emptyDb();
    expect(parseDb(JSON.stringify(db))).toEqual(db);
    expect(() => parseDb(JSON.stringify({ format: "rayans-sommeil" }))).toThrow();
    const abime = parseDb(JSON.stringify({ format: "rayans-calme", respirations: [{ id: "x", avant: 42, rythme: "?" }], reglages: { dureeSeance: 7 } }));
    expect(abime.respirations[0]).toMatchObject({ avant: 10, rythme: "six" });
    expect(abime.reglages.dureeSeance).toBe(10);
  });
  it("union des respirations et des tests, le plus récent gagne pour le journal et les réglages", () => {
    const a = emptyDb();
    const b = emptyDb();
    a.respirations.push(resp("1", { at: 1 }), resp("2", { at: 2 }));
    b.respirations.push(resp("2", { at: 2 }), resp("3", { at: 3 }));
    a.tests.push({ id: "t1", at: 1, type: "depart", reponses: [1, 1, 1, 1, 1] });
    b.tests.push({ id: "t2", at: 2, type: "suivi", reponses: [2, 2, 2, 2, 2] });
    a.entrees.push(entree("e", { pensee: "ancienne", maj: 1 }));
    b.entrees.push(entree("e", { pensee: "nouvelle", maj: 5 }));
    b.gratitudes.push({ id: "g", at: 1, jour: "2026-11-21", choses: [{ quoi: "x", pourquoi: "" }], maj: 3, supprime: true });
    a.gratitudes.push({ id: "g", at: 1, jour: "2026-11-21", choses: [{ quoi: "x", pourquoi: "" }], maj: 1 });
    a.reglages = { ...a.reglages, dureeSeance: 15, maj: 10 };
    b.reglages = { ...b.reglages, dureeSeance: 5, maj: 3 };
    b.niveaux.respiration = { niveau: 3, serie: 0, meilleur: 3, maj: 9 };
    const f = fusionner(a, b);
    expect(f.respirations.map((r) => r.id)).toEqual(["1", "2", "3"]);
    expect(f.tests.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(f.entrees).toHaveLength(1);
    expect(f.entrees[0].pensee).toBe("nouvelle");
    expect(f.gratitudes[0].supprime).toBe(true);
    expect(f.reglages.dureeSeance).toBe(15);
    expect(f.niveaux.respiration.niveau).toBe(3);
  });
  it("fusion texte : null d'un côté, texte illisible ignoré", () => {
    const a = emptyDb();
    a.respirations.push(resp("1"));
    const t = JSON.stringify(a);
    expect(parseDb(fusionnerTexte(t, null)!).respirations).toHaveLength(1);
    expect(parseDb(fusionnerTexte(null, t)!).respirations).toHaveLength(1);
    expect(fusionnerTexte(null, null)).toBeNull();
    expect(parseDb(fusionnerTexte("{abîmé", t)!).respirations).toHaveLength(1);
    const b = emptyDb();
    b.entrees.push(entree("x"));
    const f = parseDb(fusionnerTexte(t, JSON.stringify(b))!);
    expect(f.respirations).toHaveLength(1);
    expect(f.entrees).toHaveLength(1);
  });
});
