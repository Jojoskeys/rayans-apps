import { describe, expect, it } from "vitest";
import { alerteSomnolence, bilanAFaire, phraseComparaison, QUESTIONS, ressenti } from "../src/core/bilan";
import { FICHES, QUIZ, source, SOURCES } from "../src/core/contenu";
import { conseilNuit, fajrDu, paramsDepuisPriere, paramsFajr, VILLES } from "../src/core/horaires";
import { emptyDb, fusionner, fusionnerTexte, parseDb, type Nuit, type Reglages } from "../src/core/model";
import { habitudeCoucher, majObjectif, nuitsTenues, phraseObjectif } from "../src/core/objectif";
import { dureeNuit, latenceNuit, serie, tendances } from "../src/core/stats";
import { ajouterJours, dayKey, fmtDuree, heureDuSoir, joursEntre, minutesDuSoir, versHeure, versMinutes } from "../src/core/temps";

const MIN = 60_000;
const nuit = (id: string, coucher: string, lever: string, x: Partial<Nuit> = {}): Nuit => ({
  id, coucher, endormi: coucher, reveils: 0, lever, energie: 3, sieste: 0, cafeine: false, ecran: false, maj: 1, ...x,
});
const reglages = (r: Partial<Reglages> = {}): Reglages => ({ ...emptyDb().reglages, ...r });

describe("heures", () => {
  it("convertit dans les deux sens et compare autour de minuit", () => {
    expect(versMinutes("23:05")).toBe(1385);
    expect(versMinutes("7:5")).toBeNull();
    expect(versMinutes("25:00")).toBeNull();
    expect(versHeure(-30)).toBe("23:30");
    expect(minutesDuSoir("23:30")! < minutesDuSoir("00:30")!).toBe(true);
    expect(heureDuSoir(minutesDuSoir("01:15")!)).toBe("01:15");
    expect(fmtDuree(450)).toBe("7 h 30");
    expect(fmtDuree(45)).toBe("45 min");
  });
  it("jours : ajout, écart, changement de jour à 4 h", () => {
    expect(ajouterJours("2026-02-28", 1)).toBe("2026-03-01");
    expect(ajouterJours("2026-01-01", -1)).toBe("2025-12-31");
    expect(joursEntre("2026-11-01", "2026-11-21")).toBe(20);
    expect(dayKey(new Date(2026, 10, 22, 2).getTime(), 4)).toBe("2026-11-21");
    expect(dayKey(new Date(2026, 10, 22, 8).getTime(), 4)).toBe("2026-11-22");
  });
});

describe("heure de coucher conseillée", () => {
  const p = paramsFajr(reglages(), null);
  it("Paris par défaut, méthode UOIF", () => {
    expect(p.origine).toBe("defaut");
    expect(p.calc.method).toBe("uoif");
    expect(VILLES.length).toBeGreaterThan(20);
  });
  it("coucher = Fajr du lendemain − 7 h 30 − 15 min, lever à Fajr", () => {
    const c = conseilNuit(p.calc, reglages(), "2026-11-21");
    const fajr = fajrDu(p.calc, "2026-11-22");
    expect(c.fajr).toBe(fajr);
    expect(c.lever).toBe(fajr);
    expect(c.fajr - c.coucher).toBe((450 + 15) * MIN);
    expect(c.coucher - c.debutRoutine).toBe(45 * MIN);
    expect(c.coucher - c.dernierCafe).toBe(6 * 60 * MIN);
    expect(c.partie2).toBe(0);
    // Fin novembre à Paris, Fajr (12°) est vers 7 h : coucher vers 23 h 15.
    const h = new Date(fajr).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
    expect(h >= "06:30" && h <= "07:30").toBe(true);
  });
  it("la durée et le temps d'endormissement se règlent", () => {
    const c = conseilNuit(p.calc, reglages({ dureeMin: 540, latenceMin: 30 }), "2026-11-21");
    expect(c.fajr - c.coucher).toBe((540 + 30) * MIN);
  });
  it("je me recouche après Fajr : 2ᵉ partie pour compléter la durée", () => {
    const r = reglages({ recoucher: true, coucherSouhaite: "23:30", pauseFajrMin: 20, latenceMin: 15, dureeMin: 450 });
    const c = conseilNuit(p.calc, r, "2026-06-20");
    expect(new Date(c.coucher).getHours()).toBe(23);
    expect(c.partie1 + c.partie2).toBe(450);
    expect(c.partie2).toBeGreaterThan(0);
    expect(c.reprise).toBe(c.fajr + 20 * MIN);
    expect(c.lever).toBe(c.reprise! + (15 + c.partie2) * MIN);
  });
  it("lit les réglages de Rayan's Prière, et tolère leur absence", () => {
    const texte = JSON.stringify({ version: 1, settings: { place: { name: "Lyon", lat: 45.764, lng: 4.8357, tz: "Europe/Paris" }, method: "mwl", offsets: { fajr: 5 } } });
    const pr = paramsDepuisPriere(texte)!;
    expect(pr.lieu).toBe("Lyon");
    expect(pr.calc.method).toBe("mwl");
    expect(pr.calc.offsets?.fajr).toBe(5);
    expect(paramsFajr(reglages(), pr).origine).toBe("priere");
    expect(paramsFajr(reglages({ source: "perso" }), pr).origine).toBe("defaut");
    expect(paramsDepuisPriere(null)).toBeNull();
    expect(paramsDepuisPriere("{pas du json")).toBeNull();
    expect(paramsDepuisPriere(JSON.stringify({ settings: { place: null } }))).toBeNull();
  });
});

describe("objectif de la semaine", () => {
  const cible = minutesDuSoir("22:30")!;
  it("commence à l'habitude (arrondie au quart d'heure), jamais avant l'heure conseillée", () => {
    const nuits = [nuit("2026-11-19", "00:10", "07:30"), nuit("2026-11-20", "00:20", "07:30"), nuit("2026-11-21", "00:05", "07:30")];
    expect(habitudeCoucher(nuits, "2026-11-21")).toBe(minutesDuSoir("00:10"));
    const o = majObjectif(emptyDb().objectif, nuits, "2026-11-21", cible, 5);
    expect(heureDuSoir(o.heure)).toBe("00:15");
    expect(o.debut).toBe("2026-11-21");
    const vide = emptyDb().objectif;
    expect(majObjectif(vide, nuits.slice(0, 2), "2026-11-21", cible, 5)).toBe(vide);
    const tot = nuits.map((n) => ({ ...n, coucher: "22:00" }));
    expect(majObjectif(vide, tot, "2026-11-21", cible, 5).heure).toBe(cible);
  });
  it("5 nuits sur 7 tenues → 15 min plus tôt ; sinon on garde le palier", () => {
    const o0 = { debut: "2026-11-01", heure: minutesDuSoir("00:00")!, historique: [], maj: 1 };
    const tenue = ["01", "02", "03", "04", "05"].map((d) => nuit(`2026-11-${d}`, "23:55", "07:00"));
    expect(nuitsTenues(tenue, "2026-11-01", o0.heure)).toBe(5);
    const o1 = majObjectif(o0, tenue, "2026-11-08", cible, 2);
    expect(heureDuSoir(o1.heure)).toBe("23:45");
    expect(o1.debut).toBe("2026-11-08");
    expect(o1.historique).toEqual([{ debut: "2026-11-01", heure: o0.heure, tenues: 5 }]);
    expect(phraseObjectif(o1, cible)).toContain("nouveau palier");
    const pasTenue = tenue.slice(0, 4);
    const o2 = majObjectif(o0, pasTenue, "2026-11-08", cible, 2);
    expect(o2.heure).toBe(o0.heure);
    expect(phraseObjectif(o2, cible)).toContain("même palier");
  });
  it("ne descend pas sous l'heure conseillée, et ne change rien en cours de semaine", () => {
    const o0 = { debut: "2026-11-01", heure: cible + 5, historique: [], maj: 1 };
    const tout = ["01", "02", "03", "04", "05", "06", "07"].map((d) => nuit(`2026-11-${d}`, "22:00", "06:00"));
    expect(majObjectif(o0, tout, "2026-11-08", cible, 2).heure).toBe(cible);
    expect(majObjectif(o0, tout, "2026-11-05", cible, 2)).toBe(o0);
  });
});

describe("tendances", () => {
  it("durée, latence, régularité du lever, série", () => {
    const n = nuit("2026-11-21", "23:30", "07:00", { endormi: "23:50" });
    expect(dureeNuit(n)).toBe(430);
    expect(latenceNuit(n)).toBe(20);
    const nuits = [
      nuit("2026-11-17", "23:00", "07:00"), nuit("2026-11-18", "23:00", "07:10"), nuit("2026-11-19", "23:00", "06:50"),
      nuit("2026-11-20", "23:00", "09:30"), n,
    ];
    const t = tendances(nuits, "2026-11-21");
    expect(t.nuits).toBe(5);
    expect(t.regulieres).toBe(4);
    expect(t.leverHabituel).toBe(420);
    expect(t.ecartLever).toBeGreaterThan(30);
    expect(serie(nuits, "2026-11-21")).toBe(5);
    expect(serie(nuits, "2026-11-22")).toBe(5);
    expect(serie(nuits, "2026-11-23")).toBe(0);
  });
});

describe("bilan de la semaine", () => {
  it("compare sans noter, signale la somnolence, propose un bilan par semaine", () => {
    const a = { id: "a", at: 0, reponses: [3, 3, 0, 3, 0, 3] };
    const b = { id: "b", at: 7 * 86400_000, reponses: [0, 0, 3, 0, 3, 0] };
    expect(ressenti(a)).toBe(0);
    expect(ressenti(b)).toBe(QUESTIONS.length * 3);
    expect(phraseComparaison(a, b)).toContain("meilleur");
    expect(alerteSomnolence(a)).toBe(true);
    expect(alerteSomnolence(b)).toBe(false);
    expect(bilanAFaire([], 0)).toBe(true);
    expect(bilanAFaire([b], b.at + 86400_000)).toBe(false);
    expect(bilanAFaire([b], b.at + 7 * 86400_000)).toBe(true);
  });
});

describe("contenu", () => {
  it("fiches demandées, quiz d'au moins 8 questions, sources connues", () => {
    for (const id of ["cycles", "lumiere", "cafeine", "siestes", "regularite", "fajr", "medecin"]) expect(FICHES.some((f) => f.id === id)).toBe(true);
    expect(QUIZ.length).toBeGreaterThanOrEqual(8);
    for (const q of QUIZ) expect(FICHES.some((f) => f.id === q.fiche)).toBe(true);
    for (const f of FICHES) for (const s of f.sources) expect(SOURCES.some((x) => x.id === s)).toBe(true);
    expect(source("drake2013").lien).toContain("PMC3805807");
    expect(SOURCES.every((s) => !s.lien?.includes("biologyinsights"))).toBe(true);
  });
});

describe("données", () => {
  it("relit ce qu'on a écrit, et refuse un autre fichier", () => {
    const db = emptyDb();
    db.nuits.push(nuit("2026-11-21", "23:10", "06:45"));
    expect(parseDb(JSON.stringify(db))).toEqual(db);
    expect(() => parseDb('{"format":"autre"}')).toThrow();
  });
  it("fusion PC + iPhone : union des bilans, la version la plus récente gagne", () => {
    const a = emptyDb();
    const b = emptyDb();
    a.bilans.push({ id: "1", at: 1, reponses: [0, 0, 0, 0, 0, 0] });
    b.bilans.push({ id: "2", at: 2, reponses: [1, 1, 1, 1, 1, 1] });
    a.nuits.push(nuit("2026-11-21", "23:00", "07:00", { maj: 1 }), nuit("2026-11-20", "22:00", "06:00", { maj: 1 }));
    b.nuits.push(nuit("2026-11-21", "00:30", "08:00", { maj: 5 }));
    a.reglages = { ...a.reglages, dureeMin: 480, maj: 10 };
    b.reglages = { ...b.reglages, dureeMin: 420, maj: 3 };
    a.routineFaite["2026-11-21"] = { ids: ["wudu"], maj: 1 };
    b.routineFaite["2026-11-21"] = { ids: ["wudu", "dhikr"], maj: 2 };
    const f = fusionner(a, b);
    expect(f.bilans.map((x) => x.id)).toEqual(["1", "2"]);
    expect(f.nuits.map((n) => n.id)).toEqual(["2026-11-20", "2026-11-21"]);
    expect(f.nuits[1].coucher).toBe("00:30");
    expect(f.reglages.dureeMin).toBe(480);
    expect(f.routineFaite["2026-11-21"].ids).toEqual(["wudu", "dhikr"]);
  });
  it("fusion texte : null d'un côté, texte illisible ignoré", () => {
    const a = emptyDb();
    a.nuits.push(nuit("2026-11-21", "23:00", "07:00"));
    const t = JSON.stringify(a);
    expect(parseDb(fusionnerTexte(t, null)!).nuits).toHaveLength(1);
    expect(parseDb(fusionnerTexte(null, t)!).nuits).toHaveLength(1);
    expect(fusionnerTexte(null, null)).toBeNull();
    expect(parseDb(fusionnerTexte("{abîmé", t)!).nuits).toHaveLength(1);
    const b = emptyDb();
    b.bilans.push({ id: "x", at: 1, reponses: [] });
    const f = parseDb(fusionnerTexte(t, JSON.stringify(b))!);
    expect(f.nuits).toHaveLength(1);
    expect(f.bilans).toHaveLength(1);
  });
});
