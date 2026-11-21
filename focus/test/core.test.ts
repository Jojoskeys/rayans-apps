import { describe, expect, it } from "vitest";
import { FICHES, QUIZ, source, SOURCES } from "../src/core/contenu";
import {
  bonneReponse, CHIFFRE_INTERDIT, essaisChangement, essaisFlanker, essaisStroop, fluxSoutenue, grilleRecherche, noterChangement,
  noterInterference, noterRecherche, noterSoutenue, planFlanker, planRecherche, planSoutenue,
} from "../src/core/exercices";
import { dayKey, emptyDb, fusionner, fusionnerTexte, parseDb, type Db, type SeanceTravail } from "../src/core/model";
import { EXOS, nextLevel, startLevel } from "../src/core/niveaux";
import { makeRng } from "../src/core/rng";
import { marquerEtape, nbExercices, seanceDuJour, serie, testPropose } from "../src/core/seance";
import { apresSeance, choisirPalier, issueSeance, minutesPause, PALIERS, statsDistractions } from "../src/core/travail";

const JOUR = 86400_000;
const T0 = new Date(2026, 10, 21, 12).getTime();

describe("niveaux en escalier", () => {
  it("2 réussites → +1, 1 échec → −1, bornés", () => {
    let l = startLevel("flanker");
    expect(l.level).toBe(2);
    l = nextLevel("flanker", l, true, 1);
    expect(l.level).toBe(2);
    l = nextLevel("flanker", l, true, 2);
    expect(l.level).toBe(3);
    expect(l.best).toBe(2);
    expect(l.maj).toBe(2);
    l = nextLevel("flanker", l, false, 3);
    expect(l.level).toBe(2);
    for (let i = 0; i < 10; i++) l = nextLevel("flanker", l, false, 4);
    expect(l.level).toBe(1);
    for (let i = 0; i < 40; i++) l = nextLevel("flanker", l, true, 5);
    expect(l.level).toBe(10);
  });
  it("chaque exercice a un départ dans ses bornes", () => {
    for (const g of EXOS) expect(g.depart >= g.min && g.depart <= g.max).toBe(true);
  });
});

describe("trouver la cible", () => {
  it("une seule cible, plus de symboles et moins de temps quand le niveau monte", () => {
    const g = grilleRecherche(makeRng(1), 6);
    expect(g.symboles.filter((s) => s === g.cible)).toHaveLength(1);
    expect(g.symboles[g.index]).toBe(g.cible);
    expect(g.symboles).toHaveLength(planRecherche(6).nombre);
    expect(planRecherche(10).nombre).toBeGreaterThan(planRecherche(2).nombre);
    expect(planRecherche(10).limiteMs).toBeLessThan(planRecherche(2).limiteMs);
    expect(planRecherche(12).famille).toBeGreaterThan(planRecherche(1).famille);
  });
  it("même graine → même grille", () => {
    expect(grilleRecherche(makeRng(9), 4)).toEqual(grilleRecherche(makeRng(9), 4));
  });
  it("réussi avec 4 sur 5", () => {
    const e = (juste: boolean) => ({ juste, ms: 1000 });
    expect(noterRecherche([e(true), e(true), e(true), e(true), e(false)]).reussi).toBe(true);
    expect(noterRecherche([e(true), e(true), e(true), e(false), e(false)]).reussi).toBe(false);
  });
});

describe("flèches et couleurs", () => {
  it("flèche du milieu : le centre est la bonne réponse, les pièges ont des flèches contraires", () => {
    const es = essaisFlanker(makeRng(3), 3);
    expect(es).toHaveLength(planFlanker(3).essais);
    for (const e of es) {
      const f = e.fleches.split(" ");
      expect(f).toHaveLength(5);
      expect(f[2]).toBe(e.centre === "gauche" ? "←" : "→");
      expect(f[0] === f[2]).toBe(e.congruent);
    }
    expect(es.filter((e) => !e.congruent).length).toBe(Math.round(20 * planFlanker(3).partPieges));
    expect(essaisFlanker(makeRng(3), 8)[0].fleches.split(" ")).toHaveLength(7);
  });
  it("couleur du mot : piège = mot et encre différents", () => {
    for (const e of essaisStroop(makeRng(4), 7)) {
      expect(e.mot === e.encre).toBe(e.congruent);
      expect(new Set(e.boutons).size).toBe(4);
    }
  });
  it("le coût des pièges = temps avec piège − temps sans piège (réponses justes seulement)", () => {
    const n = noterInterference([
      { congruent: true, juste: true, ms: 400 },
      { congruent: true, juste: true, ms: 500 },
      { congruent: false, juste: true, ms: 560 },
      { congruent: false, juste: false, ms: 300 },
      { congruent: false, juste: true, ms: null },
    ]);
    expect(n.msSansPiege).toBe(450);
    expect(n.msAvecPiege).toBe(560);
    expect(n.cout).toBe(110);
    expect(n.justes).toBe(4);
    expect(n.reussi).toBe(false);
  });
});

describe("rester sur la tâche", () => {
  it("jamais deux 3 de suite, au moins deux 3, notifications à partir du niveau 4", () => {
    for (let s = 0; s < 20; s++) {
      const f = fluxSoutenue(makeRng(s), 5);
      expect(f.chiffres).toHaveLength(planSoutenue(5).chiffres);
      for (let i = 1; i < f.chiffres.length; i++) expect(f.chiffres[i] === CHIFFRE_INTERDIT && f.chiffres[i - 1] === CHIFFRE_INTERDIT).toBe(false);
      expect(f.chiffres.filter((c) => c === CHIFFRE_INTERDIT).length).toBeGreaterThanOrEqual(2);
      expect(f.notifications).toHaveLength(3);
    }
    expect(fluxSoutenue(makeRng(1), 3).notifications).toHaveLength(0);
  });
  it("note : appuyer pour tous sauf le 3, et ne pas cliquer les notifications", () => {
    const ch = [1, 2, 3, 4, 5, 6, 7, 8, 9, 3];
    const parfait = ch.map((c) => c !== 3);
    expect(noterSoutenue(ch, parfait).reussi).toBe(true);
    expect(noterSoutenue(ch, parfait, 1).reussi).toBe(false);
    expect(noterSoutenue(ch, ch.map(() => true)).retenusJustes).toBe(0);
    expect(noterSoutenue(ch, ch.map(() => true)).reussi).toBe(false);
  });
});

describe("coût du changement", () => {
  it("deux blocs simples puis un bloc mélangé avec moitié de changements", () => {
    const es = essaisChangement(makeRng(2), 1);
    const mel = es.filter((e) => e.bloc === "melange");
    expect(es.filter((e) => e.bloc === "simple")).toHaveLength(20);
    expect(mel).toHaveLength(16);
    expect(mel.filter((e) => e.changement)).toHaveLength(7);
    for (let i = 1; i < mel.length; i++) expect(mel[i].regle !== mel[i - 1].regle).toBe(mel[i].changement);
    expect(es.some((e) => e.chiffre === 5)).toBe(false);
  });
  it("bonnes réponses", () => {
    expect(bonneReponse("parite", 4)).toBe("droite");
    expect(bonneReponse("parite", 7)).toBe("gauche");
    expect(bonneReponse("taille", 2)).toBe("gauche");
    expect(bonneReponse("taille", 8)).toBe("droite");
  });
  it("temps perdu par changement", () => {
    const n = noterChangement([
      { bloc: "simple", regle: "parite", chiffre: 2, changement: false, juste: true, ms: 500 },
      { bloc: "melange", regle: "parite", chiffre: 2, changement: false, juste: true, ms: 600 },
      { bloc: "melange", regle: "taille", chiffre: 2, changement: true, juste: true, ms: 800 },
      { bloc: "melange", regle: "parite", chiffre: 3, changement: true, juste: true, ms: 900 },
    ]);
    expect(n.coutMelange).toBe(100);
    expect(n.coutChangement).toBe(250);
    expect(n.tempsPerdu).toBe(500);
    expect(n.reussi).toBe(true);
  });
});

const seanceT = (over: Partial<SeanceTravail> = {}): SeanceTravail => ({
  id: "s1", debut: T0, fin: T0 + 15 * 60_000, minutes: 15, faites: 15, objectif: "Réviser", intention: "si… alors…",
  issue: "reussie", distractions: 0, auPalier: true, ...over,
});

describe("travail profond", () => {
  it("réussie = terminée avec 2 distractions au plus", () => {
    expect(issueSeance(true, 2)).toBe("reussie");
    expect(issueSeance(true, 3)).toBe("distraite");
    expect(issueSeance(false, 0)).toBe("abandonnee");
  });
  it("2 réussites de suite au palier → palier suivant ; 1 abandon → palier précédent", () => {
    let e = { palier: 0, serie: 0, maj: 0 };
    e = apresSeance(e, 15, "reussie", 1);
    expect(e.palier).toBe(0);
    e = apresSeance(e, 15, "reussie", 2);
    expect(PALIERS[e.palier]).toBe(20);
    e = apresSeance(e, 20, "reussie", 3);
    e = apresSeance(e, 20, "distraite", 4);
    expect(e).toEqual({ palier: 1, serie: 0, maj: 4 });
    e = apresSeance(e, 20, "abandonnee", 5);
    expect(PALIERS[e.palier]).toBe(15);
    e = apresSeance(e, 15, "abandonnee", 6);
    expect(e.palier).toBe(0);
    // Une séance d'une autre durée que le palier ne change rien.
    expect(apresSeance(e, 40, "reussie", 7)).toBe(e);
    expect(PALIERS[choisirPalier(99, 8).palier]).toBe(50);
  });
  it("pause : 3 min après un bloc court, 5 min après 30 min et plus", () => {
    expect(minutesPause(15)).toBe(3);
    expect(minutesPause(30)).toBe(5);
  });
  it("statistiques des distractions par type et par heure", () => {
    const at = (h: number) => new Date(2026, 10, 21, h, 10).getTime();
    const s = statsDistractions([
      { id: "a", at: at(9), type: "telephone" },
      { id: "b", at: at(9), type: "telephone" },
      { id: "c", at: at(15), type: "bruit" },
    ]);
    expect(s.total).toBe(3);
    expect(s.parType.telephone).toBe(2);
    expect(s.principal).toBe("telephone");
    expect(s.heurePire).toBe(9);
    expect(s.parHeure[15]).toBe(1);
    expect(statsDistractions([]).principal).toBeNull();
  });
});

describe("séance du jour et tests", () => {
  it("10 min → 4 exercices, l'ordre tourne d'un jour à l'autre", () => {
    const db = emptyDb();
    const s = seanceDuJour(db, T0);
    expect(s.etapes).toHaveLength(4);
    expect(s.etapes.reduce((a, e) => a + e.minutes, 0)).toBe(10);
    expect(seanceDuJour(db, T0 + JOUR).etapes[0].exo).not.toBe(s.etapes[0].exo);
    expect(nbExercices(5)).toBe(2);
    expect(nbExercices(20)).toBe(5);
  });
  it("la séance est finie quand toutes les étapes sont faites", () => {
    let db = emptyDb();
    for (const e of seanceDuJour(db, T0).etapes) {
      expect(seanceDuJour(db, T0).finie).toBe(false);
      db = marquerEtape(db, e.id, T0);
    }
    expect(seanceDuJour(db, T0).finie).toBe(true);
    expect(db.seances[dayKey(T0)].fin).toBe(T0);
    expect(marquerEtape(db, seanceDuJour(db, T0).etapes[0].id, T0 + 5)).toBe(db);
  });
  it("série de jours d'affilée", () => {
    const db = emptyDb();
    for (const d of [0, 1, 2]) db.seances[dayKey(T0 - d * JOUR)] = { etapes: [], fin: T0 };
    db.seances[dayKey(T0 - 4 * JOUR)] = { etapes: [], fin: T0 };
    expect(serie(db, T0)).toBe(3);
    expect(serie(db, T0 + JOUR)).toBe(3);
    expect(serie(db, T0 + 2 * JOUR)).toBe(0);
  });
  it("test de départ d'abord, puis un test de suivi par semaine", () => {
    const db = emptyDb();
    expect(testPropose(db, T0)).toBe("depart");
    db.tests.push({ id: "t", at: T0, sorte: "depart", recherche: { justes: 10, total: 11, ms: 1500 }, flanker: { justes: 40, total: 42, ms: 520, cout: 60 } });
    expect(testPropose(db, T0 + 3 * JOUR)).toBeNull();
    expect(testPropose(db, T0 + 7 * JOUR)).toBe("suivi");
  });
});

describe("contenu", () => {
  it("chaque fiche et chaque question du quiz citent une source qui existe, avec un lien", () => {
    for (const f of FICHES) for (const s of f.sources) expect(source(s)).toBeTruthy();
    for (const q of QUIZ) expect(source(q.source)).toBeTruthy();
    for (const s of SOURCES) expect(s.lien?.startsWith("https://")).toBe(true);
    expect(QUIZ.length).toBeGreaterThanOrEqual(8);
    expect(new Set(SOURCES.map((s) => s.id)).size).toBe(SOURCES.length);
  });
});

describe("données", () => {
  const exemple = (): Db => {
    const db = emptyDb();
    db.resultats.push({ id: "r1", exo: "stroop", at: 1, niveau: 2, score: 15, max: 16, reussi: true, ms: 700, cout: 80 });
    db.travaux.push(seanceT());
    db.distractions.push({ id: "d1", at: 2, type: "pensee", note: "courses", seanceId: "s1" });
    return db;
  };
  it("relit ce qu'on a écrit, et refuse un autre fichier", () => {
    const db = exemple();
    expect(parseDb(JSON.stringify(db))).toEqual(db);
    expect(() => parseDb('{"format":"autre"}')).toThrow();
  });
  it("fusion PC + iPhone : union par id, le plus récent gagne", () => {
    const a = exemple();
    const b = emptyDb();
    b.resultats.push({ id: "r2", exo: "flanker", at: 3, niveau: 2, score: 18, max: 20, reussi: true });
    b.resultats.push({ ...a.resultats[0] });
    b.distractions.push({ id: "d2", at: 4, type: "telephone" });
    a.seances["2026-11-21"] = { etapes: ["stroop"] };
    b.seances["2026-11-21"] = { etapes: ["flanker"], fin: 9 };
    b.niveaux.flanker = { level: 6, streak: 0, best: 6, maj: 10 };
    a.niveaux.stroop = { level: 4, streak: 1, best: 3, maj: 20 };
    a.travail = { palier: 2, serie: 0, maj: 5 };
    b.travail = { palier: 1, serie: 1, maj: 8 };
    a.reglages = { ...a.reglages, minutes: 20, maj: 1 };
    b.reglages = { ...b.reglages, minutes: 5, maj: 2 };
    const f = fusionner(a, b);
    expect(f.resultats.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(f.distractions.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(f.travaux).toHaveLength(1);
    expect(f.seances["2026-11-21"].etapes.sort()).toEqual(["flanker", "stroop"]);
    expect(f.seances["2026-11-21"].fin).toBe(9);
    expect(f.niveaux.flanker.level).toBe(6);
    expect(f.niveaux.stroop.level).toBe(4);
    expect(f.travail.palier).toBe(1);
    expect(f.reglages.minutes).toBe(5);
  });
  it("fusion au format texte : null d'un côté, fichier illisible, deux versions", () => {
    const a = JSON.stringify(exemple());
    expect(fusionnerTexte(a, null)).toBe(a);
    expect(fusionnerTexte(null, a)).toBe(a);
    expect(fusionnerTexte(null, null)).toBeNull();
    expect(fusionnerTexte("pas du json", a)).toBe(a);
    const b = emptyDb();
    b.tests.push({ id: "t1", at: 5, sorte: "depart", recherche: { justes: 9, total: 10, ms: 1600 }, flanker: { justes: 38, total: 40, ms: 540, cout: null } });
    const f = parseDb(fusionnerTexte(a, JSON.stringify(b))!);
    expect(f.tests).toHaveLength(1);
    expect(f.resultats).toHaveLength(1);
    expect(f.format).toBe("rayans-focus");
  });
});
