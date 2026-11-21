import { describe, expect, it } from "vitest";
import { ASTUCES, exercicesAstuce } from "../src/core/astuces";
import { DEFIS, meilleurScore, questionDefi, questionsTest, scoreDefi, STRUCTURE_TEST, testPropose } from "../src/core/defis";
import { apresReponse, debutJourDans, enQuestion, faitsDus, planifierReposer, REPOSER_APRES, tirerReposer, type AReposer } from "../src/core/espacement";
import { appliquerReponse, astucesVues, choisirType, prochaineQuestion, questionEstimation, typesActifs } from "../src/core/entrainement";
import { FICHES, MYTHES } from "../src/core/fiches";
import { arrondiRapide, ecartPourcent, estimationOk, genererQuestion, guideEstimation } from "../src/core/generateur";
import { dayKey, emptyDb, fusionner, fusionnerTexte, parseDb, type Db, type Resultat } from "../src/core/model";
import { nextLevel, startLevel, TYPES } from "../src/core/niveaux";
import { fmt, lireSaisie, morceaux, type Question } from "../src/core/question";
import { makeRng } from "../src/core/rng";
import { astuceDuJour, marquerEtape, planSeance, seanceDuJour, serie } from "../src/core/seance";
import { comparerTests } from "../src/core/stats";

const JOUR = 86400_000;
const T0 = new Date(2026, 10, 21, 12).getTime();

/** Le vrai résultat d'une question, recalculé à partir de ses nombres. */
function calcul(q: Question): number {
  switch (q.op) {
    case "+": return q.a + q.b;
    case "−": return q.a - q.b;
    case "×": return q.a * q.b;
    case "÷": return q.a / q.b;
    case "%": return (q.a * q.b) / 100;
  }
}

function verifier(q: Question) {
  expect(q.reponse, q.texte).toBe(calcul(q));
  expect(Number.isInteger(q.reponse), q.texte).toBe(true);
  expect(q.reponse, q.texte).toBeGreaterThanOrEqual(0);
  expect(q.etapes.length, q.texte).toBeGreaterThan(0);
  expect(q.etapes[q.etapes.length - 1], q.texte).toContain(fmt(q.reponse));
}

const res = (r: Partial<Resultat> & Pick<Resultat, "id" | "sorte">): Resultat => ({ ref: "", at: T0, bonnes: 8, total: 10, tempsMoyenMs: 4000, ...r });

describe("niveaux en escalier", () => {
  it("2 réussites → +1, 1 échec → −1, dans les bornes", () => {
    let l = startLevel("addition");
    l = nextLevel("addition", l, true, 1);
    expect(l.niveau).toBe(1);
    l = nextLevel("addition", l, true, 2);
    expect(l.niveau).toBe(2);
    expect(l.record).toBe(1);
    expect(l.maj).toBe(2);
    l = nextLevel("addition", l, false, 3);
    expect(l.niveau).toBe(1);
    for (let i = 0; i < 5; i++) l = nextLevel("addition", l, false, 4);
    expect(l.niveau).toBe(1);
    for (let i = 0; i < 30; i++) l = nextLevel("addition", l, true, 5);
    expect(l.niveau).toBe(5);
  });
  it("chaque type a un départ dans ses bornes et un palier par niveau", () => {
    for (const t of TYPES) {
      expect(t.depart >= t.min && t.depart <= t.max).toBe(true);
      expect(t.paliers).toHaveLength(t.max - t.min + 1);
    }
  });
});

describe("générateur d'opérations", () => {
  it("toutes les questions de tous les niveaux sont justes, entières, avec une décomposition", () => {
    const rng = makeRng(1);
    for (const t of TYPES)
      for (let n = t.min; n <= t.max; n++)
        for (let i = 0; i < 200; i++) verifier(genererQuestion(t.id, n, rng, ASTUCES.map((a) => a.id)));
  });
  it("même graine → mêmes questions", () => {
    const a = Array.from({ length: 20 }, ((r) => () => genererQuestion("mult2", 3, r).texte)(makeRng(42)));
    const b = Array.from({ length: 20 }, ((r) => () => genererQuestion("mult2", 3, r).texte)(makeRng(42)));
    expect(a).toEqual(b);
  });
  it("les niveaux montent bien en difficulté (taille des nombres)", () => {
    const rng = makeRng(3);
    const moy = (n: number) => { let s = 0; for (let i = 0; i < 100; i++) s += genererQuestion("addition", n, rng).reponse; return s / 100; };
    expect(moy(1)).toBeLessThan(moy(3));
    expect(moy(3)).toBeLessThan(moy(5));
  });
  it("décompositions lisibles", () => {
    expect(genererQuestion("mult1", 2, makeRng(5)).etapes[0]).toMatch(/×.*\+/);
    expect(morceaux(347)).toEqual([300, 40, 7]);
    expect(morceaux(305)).toEqual([300, 5]);
    expect(fmt(1225)).toBe("1225");
    expect(fmt(12345)).toBe("12 345");
  });
  it("lecture de la saisie", () => {
    expect(lireSaisie("1 225")).toBe(1225);
    expect(lireSaisie("")).toBeNull();
    expect(lireSaisie("12a")).toBeNull();
  });
});

describe("astuces", () => {
  it("10 astuces complètes", () => {
    expect(ASTUCES).toHaveLength(10);
    for (const a of ASTUCES) {
      expect(a.etapes.length).toBeGreaterThan(1);
      expect(a.exemple.images.length).toBeGreaterThan(2);
      expect(a.pourquoi.length).toBeGreaterThan(20);
    }
  });
  it("10 exercices dédiés, tous différents, justes, du plus facile au plus dur", () => {
    for (const a of ASTUCES) {
      const ex = exercicesAstuce(a.id, 9);
      expect(ex).toHaveLength(10);
      expect(new Set(ex.map((q) => q.texte)).size).toBe(10);
      ex.forEach((q) => { verifier(q); expect(q.astuce).toBe(a.id); });
      expect(ex[0].niveau).toBe(1);
      expect(ex[9].niveau).toBe(3);
    }
  });
  it("exemples des fiches : les règles donnent les bons résultats", () => {
    const rng = makeRng(11);
    for (let i = 0; i < 300; i++) for (const a of ASTUCES) for (const n of [1, 2, 3]) verifier(a.gen(rng, n));
  });
});

describe("estimation", () => {
  it("acceptée à 10 % près", () => {
    expect(estimationOk(300, 282)).toBe(true);
    expect(estimationOk(310, 282)).toBe(true);
    expect(estimationOk(320, 282)).toBe(false);
    expect(estimationOk(0, 0)).toBe(true);
    expect(ecartPourcent(300, 250)).toBe(20);
  });
  it("arrondi rapide et guide", () => {
    expect(arrondiRapide(47)).toBe(50);
    expect(arrondiRapide(368)).toBe(370);
    expect(arrondiRapide(7)).toBe(7);
    const q = genererQuestion("mult1", 2, makeRng(2));
    expect(guideEstimation(q)).toContain("≈");
  });
  it("le mode Estimer d'abord pose des calculs assez gros", () => {
    const db = emptyDb();
    const rng = makeRng(4);
    const deja: Question[] = [];
    for (let i = 0; i < 40; i++) {
      const q = questionEstimation(db, deja, rng);
      verifier(q);
      if (q.type === "addition" || q.type === "soustraction") expect(q.niveau).toBeGreaterThanOrEqual(4);
      deja.push(q);
    }
  });
});

describe("entraînement adaptatif mélangé", () => {
  it("jamais deux fois de suite le même type (entrelacement)", () => {
    const db = emptyDb();
    const rng = makeRng(8);
    const deja: Question[] = [];
    for (let i = 0; i < 60; i++) deja.push(prochaineQuestion(db, deja, T0, rng));
    for (let i = 1; i < deja.length; i++) expect(deja[i].type).not.toBe(deja[i - 1].type);
    expect(new Set(deja.map((q) => q.type)).size).toBeGreaterThanOrEqual(4);
  });
  it("choisirType évite les deux derniers", () => {
    const rng = makeRng(1);
    for (let i = 0; i < 50; i++) expect(["mult1", "pourcentages"]).toContain(choisirType(["addition", "tables", "mult1", "pourcentages"], ["addition", "tables"], rng));
  });
  it("× 2 chiffres et astuces débloqués au bon moment", () => {
    let db = emptyDb();
    expect(typesActifs(db)).not.toContain("mult2");
    expect(typesActifs(db)).not.toContain("astuces");
    db = { ...db, niveaux: { ...db.niveaux, mult1: { ...db.niveaux.mult1, niveau: 3 } }, resultats: [res({ id: "a", sorte: "astuce", ref: "x11" })] };
    expect(typesActifs(db)).toContain("mult2");
    expect(typesActifs(db)).toContain("astuces");
    expect(astucesVues(db)).toEqual(["x11"]);
  });
  it("une réponse fait évoluer le niveau de son type seulement", () => {
    let db = emptyDb();
    const q = genererQuestion("tables", 1, makeRng(1));
    db = appliquerReponse(db, q, true, T0);
    db = appliquerReponse(db, q, true, T0 + 1);
    expect(db.niveaux.tables.niveau).toBe(2);
    expect(db.niveaux.addition.niveau).toBe(1);
    db = appliquerReponse(db, q, false, T0 + 2);
    expect(db.niveaux.tables.niveau).toBe(1);
    expect(db.revoir).toHaveLength(1);
  });
  it("un calcul raté un autre jour revient dans l'entraînement", () => {
    let db = emptyDb();
    const q = genererQuestion("mult1", 2, makeRng(6));
    db = appliquerReponse(db, q, false, T0);
    const demain = T0 + JOUR;
    const rng = makeRng(2);
    const deja: Question[] = [];
    for (let i = 0; i < 8; i++) deja.push(prochaineQuestion(db, deja, demain, rng));
    const r = deja.find((x) => x.texte === q.texte);
    expect(r?.revision).toBe(true);
    // Une révision réussie ne change pas le niveau, mais avance la révision.
    const avant = db.niveaux.mult1;
    db = appliquerReponse(db, r!, true, demain);
    expect(db.niveaux.mult1).toEqual(avant);
    expect(db.revoir[0].etape).toBe(1);
  });
});

describe("révision espacée des calculs ratés", () => {
  const q = genererQuestion("tables", 3, makeRng(1));
  it("raté → demain ; juste en révision → J+3 puis J+7 puis fini ; raté → retour à demain", () => {
    let r = apresReponse([], q, false, T0, 4);
    expect(r[0].due).toBe(debutJourDans(T0, 1, 4));
    // Juste le jour même (reposé dans la série) : rien ne change.
    expect(apresReponse(r, q, true, T0 + 1000, 4)).toEqual(r);
    const db = { ...emptyDb(), revoir: r };
    expect(faitsDus(db, T0)).toHaveLength(0);
    expect(faitsDus(db, T0 + JOUR)).toHaveLength(1);
    const rev = enQuestion(r[0]);
    r = apresReponse(r, rev, true, T0 + JOUR, 4);
    expect(r[0].etape).toBe(1);
    expect(r[0].due).toBe(debutJourDans(T0 + JOUR, 3, 4));
    r = apresReponse(r, rev, false, T0 + 4 * JOUR, 4);
    expect(r[0].etape).toBe(0);
    expect(r[0].rates).toBe(2);
    for (let i = 0; i < 3; i++) r = apresReponse(r, rev, true, T0 + (30 + i * 10) * JOUR, 4);
    expect(r[0].fini).toBe(true);
    expect(faitsDus({ ...emptyDb(), revoir: r }, T0 + 400 * JOUR)).toHaveLength(0);
  });
  it("dans la même série, une question ratée revient après 3 autres", () => {
    let file: AReposer[] = planifierReposer([], q);
    const sorties: (Question | null)[] = [];
    for (let i = 0; i < REPOSER_APRES; i++) {
      const t = tirerReposer(file);
      sorties.push(t.q);
      file = t.file;
    }
    expect(sorties.slice(0, REPOSER_APRES - 1)).toEqual([null, null]);
    expect(sorties[REPOSER_APRES - 1]?.texte).toBe(q.texte);
    expect(file).toHaveLength(0);
  });
});

describe("défis et tests", () => {
  it("scores et meilleurs scores", () => {
    expect(DEFIS.map((d) => d.id)).toEqual(["60s", "2min", "20q"]);
    expect(scoreDefi("60s", 12, 14, 60000)).toBe(12);
    expect(scoreDefi("20q", 18, 20, 95400)).toBe(95 + 10);
    const db = { ...emptyDb(), resultats: [res({ id: "1", sorte: "defi", ref: "20q", score: 120 }), res({ id: "2", sorte: "defi", ref: "20q", score: 99 }), res({ id: "3", sorte: "defi", ref: "60s", score: 9 }), res({ id: "4", sorte: "defi", ref: "60s", score: 14 })] };
    expect(meilleurScore(db, "20q")).toBe(99);
    expect(meilleurScore(db, "60s")).toBe(14);
    expect(meilleurScore(db, "2min")).toBeNull();
  });
  it("questions de défi mélangées et justes", () => {
    const rng = makeRng(5);
    let p: Question | undefined;
    for (let i = 0; i < 50; i++) {
      const q = questionDefi(rng, p);
      verifier(q);
      if (p) expect(q.type).not.toBe(p.type);
      p = q;
    }
  });
  it("test : 20 calculs, même structure à chaque fois, reproductibles", () => {
    expect(STRUCTURE_TEST).toHaveLength(20);
    const t0 = questionsTest(0);
    expect(t0).toHaveLength(20);
    t0.forEach(verifier);
    expect(questionsTest(0).map((q) => q.texte)).toEqual(t0.map((q) => q.texte));
    const cle = (qs: Question[]) => qs.map((q) => `${q.type}-${q.niveau}`).sort();
    expect(cle(questionsTest(3))).toEqual(cle(t0));
  });
  it("test proposé : départ, puis suivi après 7 jours", () => {
    let db = emptyDb();
    expect(testPropose(db, T0)?.numero).toBe(0);
    db = { ...db, resultats: [res({ id: "t", sorte: "test", ref: "0", at: T0, bonnes: 14, total: 20, tempsMoyenMs: 6000 })] };
    expect(testPropose(db, T0 + 3 * JOUR)).toBeNull();
    expect(testPropose(db, T0 + 7 * JOUR)?.numero).toBe(1);
    db = { ...db, resultats: [...db.resultats, res({ id: "t2", sorte: "test", ref: "1", at: T0 + 7 * JOUR, bonnes: 17, total: 20, tempsMoyenMs: 4500 })] };
    const c = comparerTests(db);
    expect(c[1].diffJustesse).toBe(15);
    expect(c[1].diffTempsS).toBe(-1.5);
  });
});

describe("séance du jour", () => {
  it("le plan suit la durée", () => {
    for (const m of [5, 10, 15, 20]) {
      const p = planSeance(m);
      expect(p.map((e) => e.id)).toEqual(["astuce", "entrainement", "defi"]);
      expect(p.filter((e) => !e.facultatif).reduce((a, e) => a + e.minutes, 0) + (m > 5 ? 1 : 0)).toBe(m);
    }
  });
  it("astuce du jour : nouvelle dans l'ordre, puis la moins réussie", () => {
    let db = emptyDb();
    expect(astuceDuJour(db, T0)).toBe("x11");
    db = { ...db, resultats: [res({ id: "1", sorte: "astuce", ref: "x11", at: T0 - 2 * JOUR })] };
    expect(astuceDuJour(db, T0)).toBe("carre5");
    expect(seanceDuJour(db, T0).nouvelle).toBe(true);
    const toutes = ASTUCES.map((a, i) => res({ id: a.id, sorte: "astuce", ref: a.id, at: T0 - 10 * JOUR + i, bonnes: a.id === "x9" ? 4 : 9 }));
    expect(astuceDuJour({ ...emptyDb(), resultats: toutes }, T0)).toBe("x9");
    // Faite aujourd'hui : on garde la même toute la journée.
    const auj = [...toutes, res({ id: "z", sorte: "astuce", ref: "div5", at: T0 })];
    expect(astuceDuJour({ ...emptyDb(), resultats: auj }, T0 + 3600_000)).toBe("div5");
  });
  it("séance finie sans le défi facultatif, et série de jours", () => {
    let db = emptyDb();
    db = marquerEtape(db, "astuce", T0 - JOUR);
    db = marquerEtape(db, "entrainement", T0 - JOUR);
    expect(db.jours[dayKey(T0 - JOUR)].fin).toBeDefined();
    expect(serie(db, T0)).toBe(1);
    db = marquerEtape(db, "astuce", T0);
    expect(seanceDuJour(db, T0).finie).toBe(false);
    db = marquerEtape(db, "entrainement", T0);
    expect(seanceDuJour(db, T0).finie).toBe(true);
    expect(serie(db, T0)).toBe(2);
    expect(serie(db, T0 + 3 * JOUR)).toBe(0);
  });
});

describe("contenu", () => {
  it("6 fiches avec statut et sources, au moins 8 mythes expliqués", () => {
    expect(FICHES).toHaveLength(6);
    for (const f of FICHES) {
      expect(f.points.length).toBeGreaterThan(0);
      expect(f.sources.length).toBeGreaterThan(0);
    }
    expect(MYTHES.length).toBeGreaterThanOrEqual(8);
    for (const m of MYTHES) expect(m.explication.length).toBeGreaterThan(30);
  });
});

describe("données et fusion", () => {
  it("emptyDb / parseDb aller-retour, valeurs par défaut", () => {
    const db = emptyDb();
    expect(db.format).toBe("rayans-calcul");
    expect(db.version).toBe(1);
    expect(db.reglages.minutes).toBe(10);
    expect(db.reglages.chrono).toBe(false);
    expect(parseDb(JSON.stringify(db))).toEqual(db);
    expect(() => parseDb(JSON.stringify({ format: "autre" }))).toThrow();
    const abime = parseDb(JSON.stringify({ format: "rayans-calcul", reglages: { minutes: 7 }, niveaux: { tables: { niveau: 99 } } }));
    expect(abime.reglages.minutes).toBe(10);
    expect(abime.niveaux.tables.niveau).toBe(4);
  });
  it("union des résultats et des séances, sans doublon", () => {
    const a: Db = { ...emptyDb(), resultats: [res({ id: "1", sorte: "entrainement" }), res({ id: "2", sorte: "test", at: T0 + 5 })], jours: { "2026-11-20": { etapes: ["astuce"] } } };
    const b: Db = { ...emptyDb(), resultats: [res({ id: "2", sorte: "test", at: T0 + 5 }), res({ id: "3", sorte: "defi", at: T0 - 5 })], jours: { "2026-11-20": { etapes: ["entrainement"], fin: 9 } } };
    const f = fusionner(a, b);
    expect(f.resultats.map((r) => r.id)).toEqual(["3", "1", "2"]);
    expect(f.jours["2026-11-20"]).toEqual({ etapes: ["astuce", "entrainement"], fin: 9 });
  });
  it("le plus récent gagne (niveaux, réglages, calculs à revoir)", () => {
    const q = genererQuestion("tables", 2, makeRng(1));
    const a: Db = emptyDb();
    a.niveaux.tables = { niveau: 3, suite: 0, record: 3, maj: 200 };
    a.reglages = { ...a.reglages, minutes: 20, maj: 100 };
    a.revoir = apresReponse([], q, false, 1000, 4);
    const b: Db = emptyDb();
    b.niveaux.tables = { niveau: 2, suite: 1, record: 2, maj: 100 };
    b.reglages = { ...b.reglages, minutes: 5, maj: 300 };
    b.revoir = apresReponse(a.revoir, enQuestion(a.revoir[0]), true, a.revoir[0].due + 10, 4);
    const f = fusionner(a, b);
    expect(f.niveaux.tables.niveau).toBe(3);
    expect(f.reglages.minutes).toBe(5);
    expect(f.revoir).toHaveLength(1);
    expect(f.revoir[0].etape).toBe(1);
    expect(fusionner(b, a)).toEqual({ ...f, resultats: f.resultats });
  });
  it("fusionnerTexte : null d'un côté, illisible, et fusion", () => {
    const a = JSON.stringify({ ...emptyDb(), resultats: [res({ id: "1", sorte: "quiz" })] });
    const b = JSON.stringify({ ...emptyDb(), resultats: [res({ id: "2", sorte: "quiz" })] });
    expect(fusionnerTexte(null, null)).toBeNull();
    expect(fusionnerTexte(a, null)).toBe(a);
    expect(fusionnerTexte(null, b)).toBe(b);
    expect(fusionnerTexte("pas du json", b)).toBe(b);
    const f = parseDb(fusionnerTexte(a, b)!);
    expect(f.resultats.map((r) => r.id).sort()).toEqual(["1", "2"]);
  });
});
