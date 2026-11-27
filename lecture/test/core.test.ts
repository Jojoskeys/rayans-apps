import { describe, expect, it } from "vitest";
import { FICHES, QUIZ, source, SOURCES } from "../src/core/contenu";
import {
  compterPhrases, contenuSurvol, corriger, delaiMot, detecterIdees, exercicePlan, motsParMinute, paginer, palierSuivant,
  preparerQuestion, questionsSurvol, scoreEfficace, scorePlan, tropVite,
} from "../src/core/lecture";
import { dayKey, emptyDb, fusionner, fusionnerTexte, parseDb, type Db, type Resultat } from "../src/core/model";
import { issueLecture, issueScore, mediane, nextLevel, startLevel } from "../src/core/niveaux";
import { makeRng } from "../src/core/rng";
import { choisirTexte, etapesDuJour, joursAvantTest, seanceDuJour, serie, testAFaire, vitesseMediane } from "../src/core/seance";
import { compterMots, TESTS, TEXTES, texteParId } from "../src/core/textes";

const JOUR = 86400_000;
const NOW = new Date(2026, 10, 21, 15).getTime();
const res = (x: Partial<Resultat> & { id: string }): Resultat => ({ exo: "lecture", texteId: "abeilles", niveau: 1, at: NOW, bonnes: 6, total: 7, part: 6 / 7, ...x });

describe("textes", () => {
  it("au moins 24 textes d'entraînement, 3 niveaux, identifiants uniques", () => {
    expect(TEXTES.length).toBeGreaterThanOrEqual(24);
    for (const n of [1, 2, 3]) expect(TEXTES.filter((t) => t.niveau === n).length).toBeGreaterThanOrEqual(6);
    const ids = [...TEXTES, ...TESTS].map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("chaque texte : 250 à 900 mots, plan, 6 à 8 questions à 4 choix, 4 à 6 idées clés", () => {
    for (const t of [...TEXTES, ...TESTS]) {
      expect(t.mots, t.id).toBeGreaterThanOrEqual(250);
      expect(t.mots, t.id).toBeLessThanOrEqual(900);
      expect(t.parties.length, t.id).toBeGreaterThanOrEqual(3);
      expect(t.questions.length, t.id).toBeGreaterThanOrEqual(6);
      expect(t.questions.length, t.id).toBeLessThanOrEqual(8);
      for (const q of t.questions) {
        expect(q.choix.length, q.q).toBe(4);
        expect(new Set(q.choix).size, q.q).toBe(4);
        expect(q.explication.length, q.q).toBeGreaterThan(5);
      }
      expect(t.questions.some((q) => q.sorte === "inference"), t.id).toBe(true);
      expect(t.questions.some((q) => q.sorte === "litterale"), t.id).toBe(true);
      expect(t.idees.length, t.id).toBeGreaterThanOrEqual(4);
      expect(t.idees.length, t.id).toBeLessThanOrEqual(6);
      expect(t.sujet && t.curiosite, t.id).toBeTruthy();
    }
  });
  it("les niveaux se distinguent par la longueur", () => {
    const moy = (n: number) => { const l = TEXTES.filter((t) => t.niveau === n); return l.reduce((s, t) => s + t.mots, 0) / l.length; };
    expect(moy(1)).toBeLessThan(moy(2));
    expect(moy(2)).toBeLessThan(moy(3));
  });
  it("les textes de test sont comparables (même niveau, longueurs à ±15 %)", () => {
    expect(TESTS.length).toBeGreaterThanOrEqual(4);
    const moy = TESTS.reduce((s, t) => s + t.mots, 0) / TESTS.length;
    for (const t of TESTS) {
      expect(t.niveau).toBe(TESTS[0].niveau);
      expect(Math.abs(t.mots - moy) / moy, t.id).toBeLessThan(0.15);
      expect(t.test).toBe(true);
      expect(TEXTES.some((x) => x.id === t.id)).toBe(false);
    }
  });
  it("le résumé idéal (les idées clés elles-mêmes) est repéré par les mots-clés", () => {
    const rates = [...TEXTES, ...TESTS].flatMap((t) => t.idees.filter((i) => !detecterIdees(i.texte, [i])[0]).map((i) => `${t.id} : ${i.texte}`));
    expect(rates).toEqual([]);
  });
  it("compte les mots sans la ponctuation isolée", () => {
    expect(compterMots("Bonjour , le monde ! 42 fois")).toBe(5);
    expect(texteParId("abeilles")?.titre).toBe("La danse des abeilles");
    expect(texteParId("test-zero")?.test).toBe(true);
  });
});

describe("lecture", () => {
  it("pagine sans couper de paragraphe et sans rien perdre", () => {
    const t = texteParId("monnaie")!;
    const pages = paginer(t, 170);
    expect(pages.length).toBeGreaterThan(1);
    const paras = pages.flat().filter((b) => b.sorte === "para").map((b) => b.texte);
    expect(paras).toEqual(t.parties.flatMap((p) => p.paragraphes));
    expect(pages.flat().filter((b) => b.sorte === "titre").length).toBe(t.parties.length);
  });
  it("vitesse, score efficace et alerte", () => {
    expect(motsParMinute(300, 60_000)).toBe(300);
    expect(motsParMinute(300, 90_000)).toBe(200);
    expect(motsParMinute(300, 0)).toBe(0);
    expect(scoreEfficace(250, 0.8)).toBe(200);
    expect(tropVite(0.69)).toBe(true);
    expect(tropVite(0.7)).toBe(false);
  });
  it("mélange les choix en gardant la bonne réponse", () => {
    const q = texteParId("abeilles")!.questions[0];
    for (let s = 0; s < 20; s++) {
      const a = preparerQuestion(q, makeRng(s));
      expect(a.choix[a.bonne]).toBe(q.choix[0]);
      expect([...a.choix].sort()).toEqual([...q.choix].sort());
    }
    const qs = [preparerQuestion(q, makeRng(1)), preparerQuestion(q, makeRng(2))];
    expect(corriger(qs, [qs[0].bonne, null])).toEqual({ bonnes: 1, total: 2, part: 0.5 });
  });
  it("pré-coche les idées présentes dans un résumé, sans accents ni majuscules", () => {
    const t = texteParId("abeilles")!;
    const d = detecterIdees("L'abeille donne la DIRECTION par l'angle avec le Soleil. La durée indique la distance.", t.idees);
    expect(d).toEqual([false, true, true, false, false]);
    expect(detecterIdees("", t.idees).every((x) => !x)).toBe(true);
    // Un seul mot-clé suffit s'il est long (précis) : « gestionnaire » ; un mot court seul (« long ») ne suffit pas.
    const mdp = texteParId("mot-de-passe")!;
    const r = detecterIdees("Il faut un mot de passe long. Un gestionnaire aide.", mdp.idees);
    expect(r[mdp.idees.findIndex((i) => i.mots.includes("gestionnair"))]).toBe(true);
    expect(r[mdp.idees.findIndex((i) => i.mots.includes("longueur"))]).toBe(false);
    expect(compterPhrases("Une phrase. Deux ! Trois… quatre")).toBe(4);
    expect(compterPhrases("  ")).toBe(0);
  });
  it("plan : titres mélangés, extraits de parties différentes, score", () => {
    const t = texteParId("internet")!;
    const ex = exercicePlan(t, makeRng(3));
    expect([...ex.titres].sort()).toEqual(t.parties.map((_, i) => i));
    expect(ex.titres.every((x, i) => x === i)).toBe(false);
    expect(new Set(ex.extraits.map((e) => e.partie)).size).toBe(ex.extraits.length);
    const parfait = scorePlan(ex, t.parties.map((_, i) => i), ex.extraits.map((e) => e.partie));
    expect(parfait.part).toBe(1);
    expect(scorePlan(ex, [], []).points).toBe(0);
  });
  it("survol : contenu et 3 questions dont la bonne réponse vient du texte", () => {
    const t = texteParId("coraux")!;
    const c = contenuSurvol(t);
    expect(c.titres).toHaveLength(t.parties.length);
    expect(c.intro).toBe(t.parties[0].paragraphes[0]);
    const qs = questionsSurvol(t, TEXTES, makeRng(5));
    expect(qs).toHaveLength(3);
    expect(qs[0].choix[0]).toBe(t.sujet);
    expect(t.parties.map((p) => p.titre)).toContain(qs[1].choix[0]);
    for (const q of qs) expect(new Set(q.choix).size).toBe(4);
  });
  it("RSVP : paliers croissants et délai par mot", () => {
    expect(palierSuivant(0)).toBe(300);
    expect(palierSuivant(1)).toBeGreaterThan(palierSuivant(0));
    expect(palierSuivant(5)).toBe(300);
    expect(delaiMot(600, 50)).toBe(100);
    expect(delaiMot(600, 0)).toBeGreaterThan(100);
  });
});

describe("niveaux", () => {
  it("2 réussites de suite → +1, 1 échec → −1, bornes 1 à 3", () => {
    let l = startLevel();
    l = nextLevel(l, "reussi", 1);
    expect(l.level).toBe(1);
    l = nextLevel(l, "reussi", 2);
    expect(l.level).toBe(2);
    l = nextLevel(l, "reussi", 3);
    l = nextLevel(l, "neutre", 4);
    l = nextLevel(l, "reussi", 5);
    expect(l.level).toBe(2);
    l = nextLevel(l, "reussi", 6);
    expect(l.level).toBe(3);
    l = nextLevel(nextLevel(l, "reussi", 7), "reussi", 8);
    expect(l.level).toBe(3);
    l = nextLevel(l, "echec", 9);
    expect(l.level).toBe(2);
    expect(nextLevel(nextLevel(l, "echec", 10), "echec", 11).level).toBe(1);
  });
  it("lecture réussie = compréhension ≥ 80 % et vitesse ≥ médiane ; ratée < 60 %", () => {
    expect(issueLecture(0.85, 200, 220)).toBe("neutre");
    expect(issueLecture(0.85, 230, 220)).toBe("reussi");
    expect(issueLecture(0.8, 100, null)).toBe("reussi");
    expect(issueLecture(0.59, 400, 220)).toBe("echec");
    expect(issueLecture(0.7, 400, 220)).toBe("neutre");
    expect(issueScore(0.8)).toBe("reussi");
    expect(issueScore(0.5)).toBe("echec");
    expect(mediane([3, 1, 2])).toBe(2);
    expect(mediane([4, 1, 2, 3])).toBe(2.5);
    expect(mediane([])).toBeNull();
  });
});

describe("séance", () => {
  it("étapes selon la durée, avec plan et survol en alternance", () => {
    expect(etapesDuJour(5, "2026-11-21")).toEqual(["lecture"]);
    const dix = ["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"].map((j) => etapesDuJour(10, j));
    expect(dix.every((e) => e[0] === "lecture" && e[1] === "resume")).toBe(true);
    expect(dix.some((e) => e.length === 2)).toBe(true);
    expect(dix.some((e) => e.includes("plan"))).toBe(true);
    expect(dix.some((e) => e.includes("survol"))).toBe(true);
    expect(etapesDuJour(20, "2026-11-21")).toEqual(["lecture", "resume", "plan", "survol"]);
  });
  it("propose un texte du bon niveau, pas relu avant 30 jours, stable dans la journée", () => {
    const db = emptyDb();
    const a = choisirTexte(db, 2, NOW, "j1");
    expect(a.niveau).toBe(2);
    expect(choisirTexte(db, 2, NOW, "j1").id).toBe(a.id);
    // Tous les textes du niveau 1 sauf un lus il y a 10 jours : c'est le seul proposé.
    const n1 = TEXTES.filter((t) => t.niveau === 1);
    db.resultats = n1.slice(1).map((t, i) => res({ id: `r${i}`, texteId: t.id, at: NOW - 10 * JOUR }));
    for (const cle of ["a", "b", "c"]) expect(choisirTexte(db, 1, NOW, cle).id).toBe(n1[0].id);
    // Tous lus : le moins récent.
    db.resultats.push(res({ id: "x", texteId: n1[0].id, at: NOW - 20 * JOUR }));
    expect(choisirTexte(db, 1, NOW, "a").id).toBe(n1[0].id);
    // Après 30 jours, de nouveau disponibles.
    expect(choisirTexte(db, 1, NOW + 25 * JOUR, "a").niveau).toBe(1);
  });
  it("garde le texte lu dans la séance du jour, et un autre texte pour le survol", () => {
    const db = emptyDb();
    const s = seanceDuJour(db, NOW);
    expect(s.texteSurvol.id).not.toBe(s.texte.id);
    db.resultats.push(res({ id: "s", texteId: "volcans", seance: true }));
    expect(seanceDuJour(db, NOW).texte.id).toBe("volcans");
  });
  it("tests : départ, puis suivi chaque semaine sur des textes réservés différents", () => {
    const db = emptyDb();
    expect(testAFaire(db, NOW)).toEqual({ sorte: "depart", texte: TESTS[0] });
    db.resultats.push(res({ id: "t0", exo: "test", test: "depart", texteId: TESTS[0].id, at: NOW, mpm: 200 }));
    expect(testAFaire(db, NOW + 3 * JOUR)).toBeNull();
    expect(joursAvantTest(db, NOW + 3 * JOUR)).toBe(4);
    const t = testAFaire(db, NOW + 7 * JOUR)!;
    expect(t.sorte).toBe("suivi");
    expect(t.texte.id).toBe(TESTS[1].id);
  });
  it("vitesse habituelle et série de jours", () => {
    const db = emptyDb();
    expect(vitesseMediane(db)).toBeNull();
    db.resultats = [180, 220, 260, 300].map((mpm, i) => res({ id: `v${i}`, mpm, at: NOW - (3 - i) * JOUR }));
    expect(vitesseMediane(db)).toBe(240);
    expect(serie(db, NOW)).toBe(4);
    expect(serie(db, NOW + JOUR)).toBe(4);
    expect(serie(db, NOW + 2 * JOUR)).toBe(0);
  });
});

describe("contenu", () => {
  it("fiches demandées, quiz expliqué, sources existantes", () => {
    for (const id of ["lecture-rapide", "vitesse", "survol", "se-tester", "auto-explication", "notes", "ecran-papier", "surlignage"])
      expect(FICHES.some((f) => f.id === id), id).toBe(true);
    expect(QUIZ.length).toBeGreaterThanOrEqual(8);
    for (const q of QUIZ) expect(FICHES.some((f) => f.id === q.fiche), q.fiche).toBe(true);
    for (const f of FICHES) for (const s of f.sources) expect(SOURCES.some((x) => x.id === s), s).toBe(true);
    expect(source("inconnue").texte).toBe("inconnue");
    for (const s of SOURCES) if (s.lien) expect(s.lien.startsWith("https://")).toBe(true);
  });
});

describe("données et fusion", () => {
  it("fichier vide, relecture, refus d'un autre format", () => {
    const db = emptyDb();
    expect(parseDb(JSON.stringify(db))).toEqual(db);
    expect(() => parseDb(JSON.stringify({ format: "rayans-memoire" }))).toThrow();
    const abime = parseDb(JSON.stringify({ format: "rayans-lecture", niveaux: { lecture: { level: 9 } }, reglages: { minutes: 7 }, resultats: [{ id: "a" }, { id: "b", texteId: "x", part: 3 }] }));
    expect(abime.niveaux.lecture.level).toBe(3);
    expect(abime.reglages.minutes).toBe(10);
    expect(abime.resultats).toHaveLength(1);
    expect(abime.resultats[0].part).toBe(1);
    expect(dayKey(new Date(2026, 10, 21, 3).getTime(), 4)).toBe("2026-11-20");
  });
  it("union des résultats, résumés et séances ; le plus récent gagne pour notes, niveaux et réglages", () => {
    const a: Db = emptyDb();
    const b: Db = emptyDb();
    a.resultats = [res({ id: "1", at: 1 }), res({ id: "2", at: 3 })];
    b.resultats = [res({ id: "2", at: 3 }), res({ id: "3", at: 2 })];
    a.resumes = [{ id: "r1", texteId: "abeilles", at: 1, texte: "x", idees: [0], total: 5 }];
    b.resumes = [{ id: "r2", texteId: "volcans", at: 2, texte: "y", idees: [], total: 5 }];
    a.notes = [{ id: "n", texteId: "abeilles", texte: "ancienne", at: 1, maj: 1 }];
    b.notes = [{ id: "n", texteId: "abeilles", texte: "nouvelle", at: 1, maj: 5 }];
    a.seances = { "2026-11-21": { etapes: ["lecture"] } };
    b.seances = { "2026-11-21": { etapes: ["resume"], fin: 9 } };
    a.niveaux.lecture = { level: 2, streak: 0, best: 2, maj: 10 };
    b.niveaux.lecture = { level: 3, streak: 0, best: 3, maj: 5 };
    a.reglages = { ...a.reglages, minutes: 5, maj: 1 };
    b.reglages = { ...b.reglages, minutes: 20, maj: 2 };
    const f = fusionner(a, b);
    expect(f.resultats.map((r) => r.id)).toEqual(["1", "3", "2"]);
    expect(f.resumes).toHaveLength(2);
    expect(f.notes[0].texte).toBe("nouvelle");
    expect(f.seances["2026-11-21"]).toEqual({ etapes: ["lecture", "resume"], fin: 9 });
    expect(f.niveaux.lecture.level).toBe(2);
    expect(f.reglages.minutes).toBe(20);
    expect(fusionner(b, a).notes[0].texte).toBe("nouvelle");
  });
  it("fusion texte : null d'un côté, fichier illisible, deux côtés", () => {
    const a = emptyDb();
    a.resultats = [res({ id: "1" })];
    const ta = JSON.stringify(a);
    expect(fusionnerTexte(null, null)).toBeNull();
    expect(JSON.parse(fusionnerTexte(ta, null)!).resultats).toHaveLength(1);
    expect(JSON.parse(fusionnerTexte(null, ta)!).resultats).toHaveLength(1);
    expect(JSON.parse(fusionnerTexte("pas du json", ta)!).resultats).toHaveLength(1);
    const b = emptyDb();
    b.resultats = [res({ id: "2" })];
    expect(JSON.parse(fusionnerTexte(ta, JSON.stringify(b))!).resultats).toHaveLength(2);
  });
});
