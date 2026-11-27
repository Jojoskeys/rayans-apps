import { describe, expect, it } from "vitest";
import { comparerArabe, forme, LETTRES, normaliserArabe, sansHarakat } from "../src/core/arabe";
import { apresRappel, cartesDues, debutJourDans, estSu, ETAPES_JOURS, nouveauxAujourdhui, nouvelleCarte } from "../src/core/espacement";
import { ecrit, motDe, mots, phrases, textePhrase } from "../src/core/langues";
import { dayKey, emptyDb, fusionner, fusionnerTexte, lundiDe, parseDb, type Db } from "../src/core/model";
import { nextLevel, paramsCartes, paramsTons, startLevel } from "../src/core/niveaux";
import { avecTon, chiffresVersAccents, comparerPinyin, tonDe } from "../src/core/pinyin";
import { makeRng } from "../src/core/rng";
import { choixPour, itemsDictee, itemsLettres, itemsTons, melanger, phrasesPourOrdre, planSeance, tirageTest } from "../src/core/seance";
import { comparerTests, progres, serie } from "../src/core/stats";

const JOUR = 86400_000;
const T0 = new Date(2026, 10, 23, 12, 0, 0).getTime(); // lundi 23 novembre 2026, midi

describe("pinyin", () => {
  it("place l'accent selon la règle", () => {
    expect(avecTon("hao", 3)).toBe("hǎo");
    expect(avecTon("xie", 4)).toBe("xiè");
    expect(avecTon("gou", 3)).toBe("gǒu");
    expect(avecTon("liu", 4)).toBe("liù");
    expect(avecTon("gui", 4)).toBe("guì");
    expect(avecTon("nv", 3)).toBe("nǚ");
    expect(avecTon("ma", 0)).toBe("ma");
  });
  it("convertit les chiffres et compare avec tolérance", () => {
    expect(chiffresVersAccents("ni3 hao3")).toBe("nǐ hǎo");
    expect(comparerPinyin("nǐ hǎo", "ni3 hao3")).toBe("juste");
    expect(comparerPinyin("nǐ hǎo", "ni3hao3")).toBe("juste");
    expect(comparerPinyin("nǐ hǎo", "Nǐhǎo")).toBe("juste");
    expect(comparerPinyin("xiè xie", "xie4 xie5")).toBe("juste");
    expect(comparerPinyin("xiè xie", "xie4 xie")).toBe("juste");
    expect(comparerPinyin("nǚ ér", "nv3 er2")).toBe("juste");
    expect(comparerPinyin("nǐ hǎo", "ni2 hao3")).toBe("tons");
    expect(comparerPinyin("nǐ hǎo", "ni hao")).toBe("tons");
    expect(comparerPinyin("nǐ hǎo", "ni3 ha3")).toBe("faux");
    expect(tonDe("mà")).toBe(4);
  });
});

describe("arabe", () => {
  it("formes des lettres et voyelles", () => {
    const ba = LETTRES[1];
    expect(forme(ba, "isolee")).toBe("ب");
    expect(forme(ba, "debut")).toBe("ب‍");
    expect(forme(LETTRES[7], "debut")).toBe("د"); // dāl ne s'attache pas à la suivante
    expect(sansHarakat("كِتَاب")).toBe("كتاب");
    expect(normaliserArabe("مَدْرَسَة")).toBe(normaliserArabe("مدرسه"));
  });
  it("accepte la réponse en lettres arabes ou en transcription", () => {
    const m = { ecrit: "كِتَاب", tr: "kitāb" };
    expect(comparerArabe(m, "كتاب")).toBe(true);
    expect(comparerArabe(m, "kitab")).toBe(true);
    expect(comparerArabe(m, "Kitāb")).toBe(true);
    expect(comparerArabe(m, "kalb")).toBe(false);
    expect(comparerArabe({ ecrit: "شُكْرًا", tr: "shukran" }, "choukran")).toBe(true);
    expect(comparerArabe({ ecrit: "عَفْوًا", tr: "ʿafwan" }, "3afwan")).toBe(true);
    expect(comparerArabe(m, "")).toBe(false);
  });
});

describe("révisions espacées", () => {
  it("intervalles qui s'allongent, une erreur ramène à demain", () => {
    let c = nouvelleCarte("zh", "你好", T0, 4);
    expect(c.due).toBe(debutJourDans(T0, 1, 4));
    let t = c.due;
    for (let i = 0; i < ETAPES_JOURS.length - 1; i++) {
      c = apresRappel(c, true, t, 4);
      expect(Math.round((c.due - debutJourDans(t, 0, 4)) / JOUR)).toBe(ETAPES_JOURS[i + 1]);
      t = c.due;
    }
    expect(estSu(c)).toBe(true);
    c = apresRappel(c, true, t, 4);
    expect(Math.round((c.due - debutJourDans(t, 0, 4)) / JOUR)).toBe(120);
    c = apresRappel(c, false, t, 4);
    expect(c.etape).toBe(0);
    expect(Math.round((c.due - debutJourDans(t, 0, 4)) / JOUR)).toBe(1);
    expect(c.fautes).toBe(1);
  });
  it("cartes dues par langue et nouveaux mots du jour", () => {
    const a = nouvelleCarte("zh", "你好", T0, 4);
    const b = nouvelleCarte("ar", "شُكْرًا", T0, 4);
    expect(cartesDues([a, b], "zh", T0)).toHaveLength(0);
    expect(cartesDues([a, b], "zh", T0 + 2 * JOUR)).toEqual([a]);
    expect(nouveauxAujourdhui([a, b], "ar", T0, 4)).toBe(1);
  });
});

describe("niveaux", () => {
  it("2 réussites → +1, 1 échec → −1, bornes", () => {
    let l = startLevel("cartes");
    l = nextLevel("cartes", l, true, 1);
    expect(l.level).toBe(1);
    l = nextLevel("cartes", l, true, 2);
    expect(l.level).toBe(2);
    l = nextLevel("cartes", l, false, 3);
    expect(l.level).toBe(1);
    l = nextLevel("cartes", l, false, 4);
    expect(l.level).toBe(1);
    for (let i = 0; i < 30; i++) l = nextLevel("cartes", l, true, 5 + i);
    expect(l.level).toBe(6);
    expect(paramsCartes(1).choix).toBe(3);
    expect(paramsCartes(6).choix).toBe(6);
    expect(paramsTons(1).choix).toBe(2);
    expect(paramsTons(3).choix).toBe(4);
  });
});

describe("exercices", () => {
  it("choix : la bonne réponse + des leurres au sens différent", () => {
    const m = motDe("zh", "茶")!;
    const c = choixPour(makeRng(1), m, 4);
    expect(c).toHaveLength(4);
    expect(c.filter((x) => x.id === m.id)).toHaveLength(1);
    expect(new Set(c.map((x) => x.fr)).size).toBe(4);
  });
  it("phrases à remettre dans l'ordre : longueur selon le niveau, jamais déjà en ordre", () => {
    const rng = makeRng(3);
    for (const p of phrasesPourOrdre(rng, "ar", 1, 10)) expect(p.mots.length).toBeLessThanOrEqual(3);
    const p = phrases("zh")[0];
    for (let i = 0; i < 20; i++) expect(melanger(makeRng(i), p.mots).join()).not.toBe(p.mots.join());
  });
  it("dictée, tons et lettres", () => {
    const d = itemsDictee(makeRng(2), "zh", 1, 5);
    expect(d).toHaveLength(5);
    for (const x of d) expect(x.lecture.split(" ")).toHaveLength(1);
    const da = itemsDictee(makeRng(2), "ar", 5, 3);
    expect(da).toHaveLength(3);
    const t = itemsTons(makeRng(4), 1, 8);
    for (const x of t) { expect(x.choix).toHaveLength(2); expect(x.choix).toContain(x.ton); }
    const l = itemsLettres(makeRng(5), 6, 6);
    for (const x of l) { expect(x.choix).toHaveLength(6); expect(x.choix).toContain(x.lettre); }
  });
  it("affichage : arabe sans voyelles, phrase complète", () => {
    const m = mots("ar").find((x) => x.lecture === "kitāb")!;
    expect(ecrit(m, false)).toBe("كتاب");
    expect(textePhrase(phrases("zh")[0])).toBe("我是学生。");
  });
});

describe("séance et tests", () => {
  it("plan de la séance : révisions, nouveaux mots, production, oreille", () => {
    const db = emptyDb();
    const plan = planSeance(db, "zh", T0);
    expect(plan.map((e) => e.id)).toEqual(["revisions", "nouveaux", "production", "oreille"]);
    expect(plan[0].n).toBe(0);
    expect(plan[1].n).toBe(8);
    expect(plan[3].titre).toBe("Tons à l'oreille");
    expect(planSeance(db, "ar", T0)[3].titre).toBe("Lettres arabes");
    // La production alterne d'un jour à l'autre.
    expect(planSeance(db, "zh", T0)[2].sorte).not.toBe(planSeance(db, "zh", T0 + JOUR)[2].sorte);
    // La limite de nouveaux mots par jour est respectée.
    const db2: Db = { ...db, cartes: mots("zh").slice(0, 5).map((m) => nouvelleCarte("zh", m.id, T0, 4)) };
    expect(planSeance(db2, "zh", T0)[1].n).toBe(3);
  });
  it("test de la semaine : 20 mots + 5 phrases, même tirage toute la semaine", () => {
    const db = emptyDb();
    db.cartes = mots("ar").slice(0, 40).map((m) => nouvelleCarte("ar", m.id, T0 - 10 * JOUR, 4));
    const a = tirageTest(db, "ar", T0);
    const b = tirageTest(db, "ar", T0 + 3 * JOUR);
    expect(a.mots).toHaveLength(20);
    expect(a.phrases).toHaveLength(5);
    expect(a.mots.map((m) => m.id)).toEqual(b.mots.map((m) => m.id));
    expect(a.sorte).toBe("depart");
    const vus = new Set(db.cartes.map((c) => c.mot));
    for (const m of a.mots) expect(vus.has(m.id)).toBe(true);
    expect(tirageTest(emptyDb(), "zh", T0).mots).toHaveLength(20);
    expect(lundiDe("2026-11-29")).toBe("2026-11-23");
    expect(comparerTests({ mots: 10, motsMax: 20, phrases: 2, phrasesMax: 5 }, { mots: 15, motsMax: 20, phrases: 4, phrasesMax: 5 })).toContain("mieux");
  });
  it("progrès séparés par langue et série de jours", () => {
    const db = emptyDb();
    db.cartes = [apresRappel(nouvelleCarte("zh", "你好", T0, 4), true, T0, 4), nouvelleCarte("ar", "شُكْرًا", T0, 4)];
    db.resultats = [0, 1, 2].map((i) => ({ id: `r${i}`, langue: "zh" as const, exo: "tons" as const, at: T0 - i * JOUR, niveau: 1, score: 8, max: 10 }));
    const p = progres(db, "zh", T0);
    expect(p.vus).toBe(1);
    expect(p.justesse).toBe(1);
    expect(p.tons).toBeCloseTo(0.8);
    expect(p.serie).toBe(3);
    expect(progres(db, "ar", T0).revisions).toBe(0);
    expect(serie(db, "ar", T0)).toBe(0);
  });
});

describe("données et fusion", () => {
  it("lit, complète et refuse un autre fichier", () => {
    const d = parseDb(JSON.stringify({ format: "rayans-langues", reglages: { minutes: 7, langue: "ar" } }));
    expect(d.reglages.minutes).toBe(10);
    expect(d.reglages.langue).toBe("ar");
    expect(d.niveaux.zh.tons.level).toBe(1);
    expect(() => parseDb(JSON.stringify({ format: "rayans-memoire" }))).toThrow();
    expect(dayKey(new Date(2026, 10, 23, 3, 0).getTime(), 4)).toBe("2026-11-22");
  });
  it("union des résultats, plus récent gagne pour les cartes et les réglages", () => {
    const a = emptyDb();
    const b = emptyDb();
    a.resultats = [{ id: "x", langue: "zh", exo: "cartes", at: 1, niveau: 1, score: 1, max: 1 }];
    b.resultats = [{ id: "y", langue: "ar", exo: "ordre", at: 2, niveau: 1, score: 1, max: 1 }, { id: "x", langue: "zh", exo: "cartes", at: 1, niveau: 1, score: 1, max: 1 }];
    const c1 = nouvelleCarte("zh", "你好", 10, 4);
    a.cartes = [c1];
    b.cartes = [{ ...c1, etape: 3, maj: 20 }, nouvelleCarte("ar", "شُكْرًا", 5, 4)];
    a.reglages = { ...a.reglages, minutes: 20, maj: 50 };
    b.reglages = { ...b.reglages, minutes: 5, maj: 40 };
    a.seances["zh:2026-11-23"] = { etapes: ["revisions"] };
    b.seances["zh:2026-11-23"] = { etapes: ["nouveaux", "revisions"] };
    a.niveaux.zh.tons = { level: 4, streak: 0, best: 4, maj: 9 };
    const f = fusionner(a, b);
    expect(f.resultats.map((r) => r.id)).toEqual(["x", "y"]);
    expect(f.cartes).toHaveLength(2);
    expect(f.cartes.find((c) => c.id === "zh:你好")!.etape).toBe(3);
    expect(f.reglages.minutes).toBe(20);
    expect(f.seances["zh:2026-11-23"].etapes.sort()).toEqual(["nouveaux", "revisions"]);
    expect(f.niveaux.zh.tons.level).toBe(4);
  });
  it("fusion en texte : un côté vide ou illisible", () => {
    const a = emptyDb();
    a.reglages.langue = "zh";
    const t = JSON.stringify(a);
    expect(parseDb(fusionnerTexte(t, null)!).reglages.langue).toBe("zh");
    expect(parseDb(fusionnerTexte(null, t)!).reglages.langue).toBe("zh");
    expect(fusionnerTexte(null, null)).toBeNull();
    expect(parseDb(fusionnerTexte("pas du json", t)!).reglages.langue).toBe("zh");
  });
});
