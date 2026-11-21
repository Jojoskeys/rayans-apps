import { describe, expect, it } from "vitest";
import { compterRetrouves, decouperSaisie, MAJOR_MOTS, MOTS_CONCRETS, memeMot, normaliser } from "../src/core/contenu";
import { apresRappel, ETAPES_JOURS, listesDues, premiereRevision } from "../src/core/espacement";
import { blocs, chiffresJustes, fluxNBack, jeuKim, jeuPaires, nbackReussi, noterNBack, suiteChiffres } from "../src/core/jeux";
import { dayKey, emptyDb, fusionner, parseDb, type Liste } from "../src/core/model";
import { GAMES, nextLevel, startLevel } from "../src/core/niveaux";
import { JOURS_TEST, seanceDuJour, serie, testDuJour } from "../src/core/programme";
import { makeRng } from "../src/core/rng";
import { svgVisage, traitMarquant, traits } from "../src/core/visage";

const JOUR = 86400_000;
const T0 = new Date(2026, 10, 21, 12).getTime();

describe("niveaux en escalier", () => {
  it("2 réussites → plus dur, 1 échec → plus facile, bornés", () => {
    let l = startLevel("chiffres");
    l = nextLevel("chiffres", l, true, 1);
    expect(l.level).toBe(5);
    l = nextLevel("chiffres", l, true, 2);
    expect(l.level).toBe(6);
    expect(l.best).toBe(5);
    l = nextLevel("chiffres", l, false, 3);
    expect(l.level).toBe(5);
    for (let i = 0; i < 10; i++) l = nextLevel("chiffres", l, false, 4);
    expect(l.level).toBe(3);
  });
  it("le grand nombre avance de 2 en 2", () => {
    let l = startLevel("nombres");
    l = nextLevel("nombres", nextLevel("nombres", l, true, 1), true, 2);
    expect(l.level).toBe(8);
  });
  it("chaque jeu a un départ dans ses bornes", () => {
    for (const g of GAMES) expect(g.depart >= g.min && g.depart <= g.max).toBe(true);
  });
});

describe("contenu", () => {
  it("100 mots Major, tous différents", () => {
    expect(MAJOR_MOTS).toHaveLength(100);
    expect(new Set(MAJOR_MOTS).size).toBe(100);
  });
  it("mots concrets sans doublon", () => expect(new Set(MOTS_CONCRETS).size).toBe(MOTS_CONCRETS.length));
  it("compare les réponses sans accents, au pluriel, avec une faute", () => {
    expect(normaliser("  Éléphant ")).toBe("elephant");
    expect(memeMot("éléphant", "elephants")).toBe(true);
    expect(memeMot("guitare", "guittare")).toBe(true);
    expect(memeMot("sac", "sec")).toBe(false);
  });
  it("compte chaque mot une seule fois", () => {
    const r = compterRetrouves(["pomme", "vélo", "lion"], decouperSaisie("velo, pomme pomme\ntigre"));
    expect(r.trouves.sort()).toEqual(["pomme", "vélo"]);
    expect(r.manques).toEqual(["lion"]);
    expect(r.intrus).toEqual(["pomme", "tigre"]);
  });
});

describe("jeux", () => {
  it("chiffres sans répétition côte à côte", () => {
    const s = suiteChiffres(makeRng(1), 50);
    expect(s).toHaveLength(50);
    for (let i = 1; i < s.length; i++) expect(s[i]).not.toBe(s[i - 1]);
  });
  it("n-back : les cibles sont bien des répétitions, et la correction compte juste", () => {
    const n = 2;
    const { lettres, cibles } = fluxNBack(makeRng(7), n);
    cibles.forEach((c, i) => {
      if (i >= n) expect(lettres[i] === lettres[i - n]).toBe(c);
      else expect(c).toBe(false);
    });
    const parfait = noterNBack(cibles, cibles, n);
    expect(parfait.justes).toBe(parfait.total);
    expect(nbackReussi(parfait)).toBe(true);
    expect(nbackReussi(noterNBack(cibles, cibles.map(() => false), n))).toBe(false);
  });
  it("paires : chaque objet deux fois", () => {
    const p = jeuPaires(makeRng(3), 6);
    expect(p).toHaveLength(12);
    expect(new Set(p).size).toBe(6);
  });
  it("objet disparu : il est parmi les choix, sans doublon", () => {
    const k = jeuKim(makeRng(5), 8);
    expect(k.objets).toContain(k.disparu);
    expect(k.choix).toContain(k.disparu);
    expect(new Set(k.choix).size).toBe(k.choix.length);
  });
  it("grand nombre : blocs et chiffres justes jusqu'à la première erreur", () => {
    expect(blocs("061234")).toEqual(["06", "12", "34"]);
    expect(chiffresJustes("061234", "06 12 99")).toBe(4);
  });
});

describe("visages", () => {
  it("même graine → même visage, et un trait marquant", () => {
    expect(svgVisage(traits(42))).toBe(svgVisage(traits(42)));
    expect(svgVisage(traits(42)).startsWith("<svg")).toBe(true);
    expect(traitMarquant(traits(42)).length).toBeGreaterThan(3);
  });
});

const liste = (over: Partial<Liste> = {}): Liste => ({
  id: "l1", titre: "t", sorte: "exercice", palaisId: null, elements: ["a"], images: [""], createdAt: T0, updatedAt: T0,
  ...premiereRevision(T0, 4), rappels: [], ...over,
});

describe("espacement", () => {
  it("première révision demain, puis J+3 si bien retrouvée, retour au début si mal", () => {
    const l = liste();
    expect(dayKey(l.due!, 4)).toBe(dayKey(T0 + JOUR, 4));
    expect(listesDues([l], T0)).toHaveLength(0);
    expect(listesDues([l], T0 + JOUR)).toHaveLength(1);
    const ok = apresRappel(l, 1, T0 + JOUR, 4);
    expect(ok.etape).toBe(1);
    expect(dayKey(ok.due!, 4)).toBe(dayKey(T0 + JOUR + ETAPES_JOURS[1] * JOUR, 4));
    const ko = apresRappel(ok, 0.3, T0 + 4 * JOUR, 4);
    expect(ko.etape).toBe(0);
    let fin = l;
    for (let i = 0; i < ETAPES_JOURS.length; i++) fin = apresRappel(fin, 1, T0, 4);
    expect(fin.due).toBeNull();
  });
});

describe("programme", () => {
  const avecTest = () => {
    const db = emptyDb();
    db.debutProgramme = T0;
    db.resultats.push({ id: "r", jeu: "test-mots", at: T0, niveau: 20, score: 9, max: 20, reussi: true, detail: JOURS_TEST[0].nom });
    return db;
  };
  it("premier jour : test de départ ; puis plus de test avant la fin des 6 semaines", () => {
    expect(testDuJour(emptyDb(), T0)?.nom).toBe(JOURS_TEST[0].nom);
    const db = avecTest();
    expect(testDuJour(db, T0 + 3 * JOUR)).toBeNull();
    expect(testDuJour(db, T0 + 41 * JOUR)?.nom).toBe(JOURS_TEST[1].nom);
  });
  it("séance de 15 min : échauffement, révisions, technique, bilan ; semaine 4 = Major", () => {
    const db = avecTest();
    const s = seanceDuJour(db, T0 + 2 * JOUR);
    expect(s.etapes.map((e) => e.id)).toEqual(["echauffement", "revisions", "technique", "bilan"]);
    expect(s.etapes.reduce((a, e) => a + e.minutes, 0)).toBe(15);
    expect(s.semaine?.numero).toBe(1);
    expect(seanceDuJour(db, T0 + 22 * JOUR).technique.startsWith("major")).toBe(true);
    expect(seanceDuJour(db, T0 + 60 * JOUR).semaine).toBeNull();
  });
  it("série de jours d'affilée", () => {
    const db = emptyDb();
    for (const d of [0, 1, 2]) db.seances[dayKey(T0 - d * JOUR)] = { etapes: [], fin: T0 };
    db.seances[dayKey(T0 - 4 * JOUR)] = { etapes: [], fin: T0 };
    expect(serie(db, T0)).toBe(3);
    expect(serie(db, T0 + JOUR)).toBe(3);
    expect(serie(db, T0 + 2 * JOUR)).toBe(0);
  });
});

describe("données", () => {
  it("relit ce qu'on a écrit, et refuse un autre fichier", () => {
    const db = emptyDb();
    db.palais.push({ id: "p", nom: "Maison", lieux: [{ id: "a", nom: "Porte" }], createdAt: 1, updatedAt: 1 });
    expect(parseDb(JSON.stringify(db))).toEqual(db);
    expect(() => parseDb('{"format":"autre"}')).toThrow();
  });
  it("fusion PC + iPhone : rien n'est perdu, la version la plus récente gagne", () => {
    const a = emptyDb();
    const b = emptyDb();
    a.resultats.push({ id: "1", jeu: "corsi", at: 1, niveau: 4, score: 1, max: 1, reussi: true });
    b.resultats.push({ id: "2", jeu: "mots", at: 2, niveau: 8, score: 6, max: 8, reussi: false });
    a.palais.push({ id: "p", nom: "Ancien", lieux: [], createdAt: 1, updatedAt: 1 });
    b.palais.push({ id: "p", nom: "Nouveau", lieux: [], createdAt: 1, updatedAt: 5 });
    a.seances["2026-11-21"] = { etapes: ["echauffement"] };
    b.seances["2026-11-21"] = { etapes: ["revisions"], fin: 9 };
    b.niveaux.corsi = { level: 7, streak: 0, best: 7, updatedAt: 10 };
    const f = fusionner(a, b);
    expect(f.resultats.map((r) => r.id)).toEqual(["1", "2"]);
    expect(f.palais[0].nom).toBe("Nouveau");
    expect(f.seances["2026-11-21"].etapes.sort()).toEqual(["echauffement", "revisions"]);
    expect(f.niveaux.corsi.level).toBe(7);
  });
});
