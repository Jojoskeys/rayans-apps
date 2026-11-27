import { describe, expect, it } from "vitest";
import { Chess, type Square } from "chess.js";
import { CONTENU_OK } from "./aide";
import { decrire, ecrirePlacement, lirePlacement, VALEUR } from "../src/core/echiquier";
import { apresEssai, debutJourDans, ETAPES_JOURS, serieTactiques, tactiquesDues } from "../src/core/espacement";
import { emptyDb, fusionner, fusionnerTexte, parseDb, type Db } from "../src/core/model";
import { EXOS, nextLevel, startLevel } from "../src/core/niveaux";
import { choisirPosition, FINALES, noterReconstruction, PARAMS_MEMOIRE, PARTIES, positionsMemoire } from "../src/core/positions";
import { makeRng } from "../src/core/rng";
import { etapeFaite, seanceDuJour, serieJours } from "../src/core/seance";
import { jouerCoup, TACTIQUES, type Tactique } from "../src/core/tactiques";
import { construireQuestion, corriger, positionAuHasard, questionAuHasard } from "../src/core/vision";

const JOUR = 86400_000;
const T0 = new Date(2026, 10, 20, 12, 0, 0).getTime();

describe("échiquier", () => {
  it("lit et réécrit la partie « pièces » d'un FEN", () => {
    const fen = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR";
    expect(ecrirePlacement(lirePlacement(fen))).toBe(fen);
    expect(lirePlacement(fen).h5).toEqual({ color: "w", type: "q" });
  });
  it("décrit une position en texte, en français", () => {
    const d = decrire("6k1/1b3r2/8/8/8/2N2Q2/PP6/6K1 w - - 0 1");
    expect(d.blancs).toBe("Rg1, Df3, Cc3, pions a2, b2");
    expect(d.noirs).toBe("Rg8, Tf7, Fb7");
  });
});

describe("mémoire de position", () => {
  it("toutes les parties sont légales coup par coup (chess.js)", () => {
    for (const p of PARTIES) {
      const c = new Chess();
      for (const san of p.coups.split(" ")) expect(() => c.move(san), `${p.id} : ${san}`).not.toThrow();
    }
  });
  it("les parties célèbres finissent bien par un mat", () => {
    for (const id of ["opera", "immortelle", "toujours-jeune", "legal"]) {
      const c = new Chess();
      for (const san of PARTIES.find((p) => p.id === id)!.coups.split(" ")) c.move(san);
      expect(c.isCheckmate(), id).toBe(true);
    }
  });
  it("les finales sont des positions légales", () => {
    for (const f of FINALES) expect(() => new Chess(f.fen), f.id).not.toThrow();
  });
  it("chaque niveau a plusieurs positions possibles", () => {
    const toutes = positionsMemoire();
    expect(new Set(toutes.map((p) => p.id)).size).toBe(toutes.length);
    PARAMS_MEMOIRE.forEach((p, i) => {
      const n = toutes.filter((x) => x.pieces >= p.min && x.pieces <= p.max).length;
      expect(n, `niveau ${i + 1}`).toBeGreaterThanOrEqual(4);
    });
    const rng = makeRng(1);
    for (let niv = 1; niv <= 10; niv++) {
      const pos = choisirPosition(niv, rng);
      expect(pos.pieces).toBeGreaterThanOrEqual(PARAMS_MEMOIRE[niv - 1].min);
    }
  });
  it("évite les positions vues récemment", () => {
    const rng = makeRng(2);
    const a = choisirPosition(1, rng);
    for (let i = 0; i < 20; i++) expect(choisirPosition(1, rng, [a.id]).id).not.toBe(a.id);
  });
  it("note la reconstruction pièce par pièce", () => {
    const fen = "4k3/8/4K3/4P3/8/8/8/8 w - - 0 1";
    const parfait = noterReconstruction(fen, lirePlacement(fen), false);
    expect(parfait).toMatchObject({ total: 3, justes: 3, fausses: 0, part: 1, reussi: true });
    const pose = lirePlacement("4k3/8/3K4/4P3/8/8/8/8");
    const r = noterReconstruction(fen, pose, false);
    expect(r).toMatchObject({ total: 3, justes: 2, fausses: 1, oubliees: 1, reussi: false });
    expect(r.cases.d6).toBe("fausse");
    expect(r.cases.e6).toBe("oubliee");
    expect(r.part).toBeCloseTo(1 / 3);
  });
  it("pions donnés : seules les pièces comptent", () => {
    const fen = "4k3/8/4K3/4P3/8/8/8/8 w - - 0 1";
    const r = noterReconstruction(fen, lirePlacement("4k3/8/4K3/4P3/8/8/8/8"), true);
    expect(r.total).toBe(2);
    expect(r.justes).toBe(2);
  });
});

describe("vision sans échiquier", () => {
  it("les positions tirées sont légales, sans échec, avec le bon nombre de pièces", () => {
    const rng = makeRng(7);
    for (let i = 0; i < 300; i++) {
      const n = 4 + (i % 9);
      const fen = positionAuHasard(rng, n);
      const c = new Chess(fen);
      expect(c.inCheck()).toBe(false);
      expect(Object.keys(lirePlacement(fen)).length).toBe(n);
    }
  });
  it("les bonnes réponses sont celles de chess.js", () => {
    const rng = makeRng(11);
    for (let i = 0; i < 300; i++) {
      const q = questionAuHasard(rng, 1 + (i % 10));
      const c = new Chess(q.fen);
      if (q.type === "case") {
        expect(corriger(q, q.oui!)).toBe(true);
        expect(corriger(q, !q.oui)).toBe(false);
      } else {
        for (const sq of q.bonnes) expect(q.options.map((o) => o.sq)).toContain(sq);
        expect(corriger(q, [...q.bonnes].reverse())).toBe(true);
        expect(corriger(q, [...q.bonnes, "z9"])).toBe(false);
        if (q.type === "attaquees") for (const o of q.options) expect(q.bonnes.includes(o.sq)).toBe(c.isAttacked(o.sq as Square, c.get(o.sq as Square)!.color === "w" ? "b" : "w"));
      }
    }
  });
  it("exemple : qui défend quoi", () => {
    // Blancs : Rg1, Df3, Cc3 ; Noirs : Rg8, Fb7, Tf8.
    const fen = "5rk1/1b6/8/8/8/2N2Q2/8/6K1 w - - 0 1";
    let q = null;
    for (let s = 0; !q || q.enonce.indexOf("Df3") < 0 && q.enonce.indexOf("dame f3") < 0; s++) q = construireQuestion(makeRng(s), fen, "defenseurs");
    expect(q.bonnes).toEqual([]); // Personne ne défend la dame f3.
    const a = construireQuestion(makeRng(3), fen, "attaquees")!;
    const c = new Chess(fen);
    expect(a.bonnes).toEqual(a.options.map((o) => o.sq).filter((sq) => c.isAttacked(sq as Square, c.get(sq as Square)!.color === "w" ? "b" : "w")));
  });
});

// ----- Vérification des tactiques par chess.js ----------------------------------------------------------------
const pos = (sq: string) => [sq.charCodeAt(0) - 97, Number(sq[1]) - 1];
const sansSigne = (s: string) => s.replace(/[+#]/g, "");

function verifierTheme(t: Tactique, san: string): void {
  const c = new Chess(t.fen);
  const moi = c.turn();
  const lui = moi === "w" ? "b" : "w";
  const avant = new Chess(t.fen);
  const m = c.move(san);
  const valeurCible = (sq: string) => VALEUR[c.get(sq as Square)!.type];
  const prenables = () => c.moves({ verbose: true }).filter((x) => x.to === m.to);
  switch (t.theme) {
    case "mat1":
      expect(c.isCheckmate(), `${t.id} ${san}`).toBe(true);
      break;
    case "fourchette": {
      const cibles = Object.entries(lirePlacement(c.fen())).filter(([sq, p]) => p.color === lui && c.attackers(sq as Square, moi).includes(m.to)).map(([sq]) => sq);
      expect(cibles.filter((sq) => valeurCible(sq) >= 3).length, `${t.id} : deux cibles`).toBeGreaterThanOrEqual(2);
      expect(prenables(), `${t.id} : la pièce ne doit pas pouvoir être prise`).toEqual([]);
      break;
    }
    case "clouage": {
      const roi = Object.entries(lirePlacement(c.fen())).find(([, p]) => p.color === lui && p.type === "k")![0];
      const [kx, ky] = pos(roi);
      const [tx, ty] = pos(m.to);
      const dx = Math.sign(tx - kx), dy = Math.sign(ty - ky);
      expect(tx - kx === 0 || ty - ky === 0 || Math.abs(tx - kx) === Math.abs(ty - ky), `${t.id} : sur une ligne`).toBe(true);
      const entre: string[] = [];
      for (let x = kx + dx, y = ky + dy; x !== tx || y !== ty; x += dx, y += dy) {
        const sq = `${String.fromCharCode(97 + x)}${y + 1}`;
        if (c.get(sq as Square)) entre.push(sq);
      }
      expect(entre.length, `${t.id} : une seule pièce clouée`).toBe(1);
      const cloue = entre[0];
      expect(c.get(cloue as Square)!.color).toBe(lui);
      for (const x of c.moves({ verbose: true }).filter((x) => x.from === cloue)) {
        const [ax, ay] = pos(x.to);
        expect((ax - kx) * dy - (ay - ky) * dx, `${t.id} : la pièce clouée sort de la ligne`).toBe(0);
      }
      // La pièce qui cloue est à l'abri, ou défendue.
      if (prenables().length) expect(c.attackers(m.to as Square, moi).length).toBeGreaterThan(0);
      break;
    }
    case "prise":
      expect(m.captured, `${t.id} : c'est une prise`).toBeTruthy();
      expect(avant.attackers(m.to as Square, lui), `${t.id} : la pièce prise ne doit pas être défendue`).toEqual([]);
      break;
    case "decouverte": {
      expect(c.inCheck()).toBe(true);
      const roi = Object.entries(lirePlacement(c.fen())).find(([, p]) => p.color === lui && p.type === "k")![0];
      expect(c.attackers(roi as Square, moi).includes(m.to), `${t.id} : l'échec vient d'une autre pièce`).toBe(false);
      const dame = Object.entries(lirePlacement(c.fen())).find(([, p]) => p.color === lui && p.type === "q")![0];
      expect(c.attackers(dame as Square, moi)).toContain(m.to);
      break;
    }
  }
}

describe("tactiques (vérifiées par chess.js)", () => {
  it("ids uniques, positions légales, solutions légales", () => {
    expect(new Set(TACTIQUES.map((t) => t.id)).size).toBe(TACTIQUES.length);
    for (const t of TACTIQUES) {
      const c = new Chess(t.fen);
      expect(c.isGameOver(), t.id).toBe(false);
      for (const s of t.solutions) expect(() => new Chess(t.fen).move(s), `${t.id} : ${s}`).not.toThrow();
    }
  });
  it("chaque solution réalise bien le thème annoncé", () => {
    for (const t of TACTIQUES) for (const s of t.solutions) verifierTheme(t, s);
  });
  it("les solutions sont acceptées et les mauvais coups refusés", () => {
    for (const t of TACTIQUES) {
      const c = new Chess(t.fen);
      for (const m of c.moves({ verbose: true })) {
        const r = jouerCoup(t, m.from, m.to, m.promotion ?? "q")!;
        const attendu = t.theme === "mat1" ? m.san.endsWith("#") : t.solutions.includes(sansSigne(m.san));
        expect(r.bon, `${t.id} : ${m.san}`).toBe(attendu);
      }
      expect(jouerCoup(t, "a1", "a1")).toBeNull();
    }
  });
  it("hors mat en 1, il n'y a pas de mat caché plus simple", () => {
    for (const t of TACTIQUES.filter((x) => x.theme !== "mat1")) {
      const c = new Chess(t.fen);
      expect(c.moves().filter((s) => s.endsWith("#")), t.id).toEqual([]);
    }
  });
  it("plusieurs tactiques par thème et par niveau", () => {
    for (const th of ["mat1", "fourchette", "clouage", "prise"]) expect(TACTIQUES.filter((t) => t.theme === th).length).toBeGreaterThanOrEqual(4);
    for (const n of [1, 2, 3]) expect(TACTIQUES.filter((t) => t.niveau === n).length).toBeGreaterThanOrEqual(4);
  });
});

describe("révision espacée", () => {
  it("J+1, puis J+3, J+7… ; un échec ramène à J+1", () => {
    let c = apresEssai(undefined, true, T0, 4);
    expect(c.etape).toBe(1);
    expect(c.due).toBe(debutJourDans(T0, 3, 4));
    c = apresEssai(c, true, T0 + 3 * JOUR, 4);
    expect(c.due).toBe(debutJourDans(T0 + 3 * JOUR, 7, 4));
    c = apresEssai(c, false, T0 + 10 * JOUR, 4);
    expect(c).toMatchObject({ etape: 0, essais: 3, reussites: 2 });
    expect(c.due).toBe(debutJourDans(T0 + 10 * JOUR, 1, 4));
    expect(apresEssai(undefined, false, T0, 4).due).toBe(debutJourDans(T0, 1, 4));
  });
  it("acquise après la dernière étape", () => {
    let c = apresEssai(undefined, true, T0, 4);
    for (let i = 0; i < ETAPES_JOURS.length; i++) c = apresEssai(c, true, T0, 4);
    expect(c.due).toBeNull();
  });
  it("la séance prend les révisions dues d'abord, puis des neuves", () => {
    const db = emptyDb();
    db.cartes["prise-dame"] = apresEssai(undefined, false, T0, 4);
    expect(tactiquesDues(db, T0)).toEqual([]);
    const demain = T0 + JOUR;
    expect(tactiquesDues(db, demain).map((t) => t.id)).toEqual(["prise-dame"]);
    const serie = serieTactiques(db, demain, makeRng(1), 6);
    expect(serie[0].id).toBe("prise-dame");
    expect(serie.length).toBe(6);
    expect(new Set(serie.map((t) => t.id)).size).toBe(6);
    expect(serie.slice(1).every((t) => t.niveau === 1)).toBe(true);
  });
});

describe("niveaux", () => {
  it("2 réussites → plus dur, 1 échec → plus facile, dans les bornes", () => {
    let l = startLevel("memoire");
    l = nextLevel("memoire", l, true, 1);
    expect(l.level).toBe(1);
    l = nextLevel("memoire", l, true, 2);
    expect(l.level).toBe(2);
    l = nextLevel("memoire", l, false, 3);
    expect(l.level).toBe(1);
    l = nextLevel("memoire", l, false, 4);
    expect(l.level).toBe(1);
    expect(l.best).toBe(1);
    expect(l.maj).toBe(4);
    for (const e of EXOS) expect(e.depart).toBeGreaterThanOrEqual(e.min);
  });
});

describe("séance du jour", () => {
  it("trois étapes, finie quand tout est fait, série de jours", () => {
    let db = emptyDb();
    expect(seanceDuJour(db, T0).etapes.map((e) => e.id)).toEqual(["memoire", "vision", "tactiques"]);
    db = etapeFaite(db, "memoire", T0);
    db = etapeFaite(db, "vision", T0);
    expect(seanceDuJour(db, T0).finie).toBe(false);
    db = etapeFaite(db, "tactiques", T0);
    expect(seanceDuJour(db, T0).finie).toBe(true);
    expect(serieJours(db, T0)).toBe(1);
    for (const e of ["memoire", "vision", "tactiques"] as const) db = etapeFaite(db, e, T0 + JOUR);
    expect(serieJours(db, T0 + JOUR)).toBe(2);
    expect(serieJours(db, T0 + 3 * JOUR)).toBe(0);
  });
});

describe("données et fusion PC ↔ iPhone", () => {
  const avec = (f: (d: Db) => void): Db => { const d = emptyDb(); f(d); return d; };
  it("relit ce qu'il écrit, refuse un autre fichier", () => {
    const d = avec((x) => { x.resultats.push({ id: "r1", exo: "vision", at: 5, niveau: 2, score: 1, max: 1, reussi: true, ref: "case" }); });
    expect(parseDb(JSON.stringify(d))).toEqual(d);
    expect(() => parseDb('{"format":"rayans-focus"}')).toThrow();
    expect(parseDb('{"format":"rayans-echecs-vision","niveaux":{"memoire":{"level":99}}}').niveaux.memoire.level).toBe(10);
  });
  it("rien n'est perdu : union des résultats, le plus récent pour niveaux, cartes et réglages", () => {
    const pc = avec((x) => {
      x.resultats.push({ id: "a", exo: "memoire", at: 1, niveau: 1, score: 3, max: 3, reussi: true });
      x.niveaux.memoire = { level: 3, streak: 0, best: 3, maj: 10 };
      x.cartes.t1 = { etape: 2, due: 100, essais: 2, reussites: 2, maj: 50 };
      x.cartes.t2 = { etape: 1, due: 100, essais: 1, reussites: 1, maj: 5 };
      x.seances["2026-11-20"] = { etapes: ["memoire"] };
      x.quiz.push({ id: "q", at: 3, justes: 8, total: 10 });
    });
    const tel = avec((x) => {
      x.resultats.push({ id: "b", exo: "tactiques", at: 2, niveau: 1, score: 1, max: 1, reussi: true, ref: "t3" });
      x.niveaux.memoire = { level: 2, streak: 1, best: 2, maj: 5 };
      x.niveaux.vision = { level: 4, streak: 0, best: 4, maj: 20 };
      x.cartes.t1 = { etape: 0, due: 30, essais: 3, reussites: 2, maj: 40 };
      x.cartes.t3 = { etape: 1, due: 90, essais: 1, reussites: 1, maj: 7 };
      x.seances["2026-11-20"] = { etapes: ["vision", "tactiques"], fin: 99 };
      x.reglages = { ...x.reglages, sons: false, maj: 8 };
    });
    const f = fusionner(pc, tel);
    expect(f.resultats.map((r) => r.id)).toEqual(["a", "b"]);
    expect(f.niveaux.memoire.level).toBe(3);
    expect(f.niveaux.vision.level).toBe(4);
    expect(f.cartes.t1.etape).toBe(2);
    expect(Object.keys(f.cartes).sort()).toEqual(["t1", "t2", "t3"]);
    expect(f.seances["2026-11-20"]).toEqual({ etapes: ["memoire", "vision", "tactiques"], fin: 99 });
    expect(f.reglages.sons).toBe(false);
    expect(f.quiz.length).toBe(1);
    expect(fusionner(tel, pc)).toEqual({ ...f, seances: { "2026-11-20": { etapes: ["vision", "tactiques", "memoire"], fin: 99 } } });
  });
  it("fusion au format texte", () => {
    const a = JSON.stringify(emptyDb());
    expect(fusionnerTexte(null, a)).toBe(a);
    expect(fusionnerTexte(a, null)).toBe(a);
    expect(fusionnerTexte("illisible", a)).toBe(a);
    expect(fusionnerTexte(a, "illisible")).toBe(a);
    const b = JSON.stringify(avec((x) => { x.quiz.push({ id: "z", at: 1, justes: 1, total: 1 }); }));
    expect(parseDb(fusionnerTexte(a, b)!).quiz.length).toBe(1);
  });
});

describe("contenu", () => {
  it("fiches, quiz et sources cohérents", () => expect(CONTENU_OK()).toBe(true));
});
