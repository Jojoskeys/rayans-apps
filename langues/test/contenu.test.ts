import { describe, expect, it } from "vitest";
import { aDesHarakat, estArabe, LETTRES, lettresRacine, normaliserPourRacine, sansHarakat } from "../src/core/arabe";
import { FICHES, QUIZ, source, SOURCES } from "../src/core/contenu";
import { MOTS_AR, PHRASES_AR } from "../src/core/contenu-ar";
import { MOTS_ZH, PHRASES_ZH, RADICAUX, SYLLABES_TONS } from "../src/core/contenu-zh";
import { avecTon, nbAccents, sansTon, syllabeValide, syllabes, tonDe } from "../src/core/pinyin";

const HANZI = /^[一-鿿]+$/;
const LATIN = /[A-Za-z]/;
const ARABE_SEUL = /^[ء-ْٰ\s]+$/;

function verifierPinyin(py: string, nbCaracteres: number, ou: string) {
  const s = syllabes(py);
  expect(s.length, `${ou} : une syllabe par caractère`).toBe(nbCaracteres);
  for (const x of s) {
    expect(x, `${ou} : minuscules`).toBe(x.toLowerCase());
    expect(nbAccents(x), `${ou} : « ${x} » au plus un ton`).toBeLessThanOrEqual(1);
    expect(syllabeValide(sansTon(x)), `${ou} : « ${x} » syllabe possible`).toBe(true);
    // L'accent est bien placé (règle a/e, puis o de « ou », puis dernière voyelle).
    expect(avecTon(sansTon(x), tonDe(x)), `${ou} : accent de « ${x} » bien placé`).toBe(x);
  }
}

describe("contenu chinois", () => {
  it("environ 300 mots, sans doublon, caractères simplifiés et pinyin justes", () => {
    expect(MOTS_ZH.length).toBeGreaterThanOrEqual(280);
    expect(new Set(MOTS_ZH.map((m) => m.hz)).size).toBe(MOTS_ZH.length);
    for (const m of MOTS_ZH) {
      expect(m.hz, m.hz).toMatch(HANZI);
      expect(m.fr.trim(), m.hz).not.toBe("");
      expect(m.theme.trim(), m.hz).not.toBe("");
      verifierPinyin(m.py, [...m.hz].length, m.hz);
    }
  });
  it("pas de caractère traditionnel courant", () => {
    const traditionnels = "們個這說學東車電話謝見對們買賣門語國書飛機時間點開還過來會爲頭";
    for (const m of MOTS_ZH) for (const c of m.hz) expect(traditionnels.includes(c), `${m.hz}`).toBe(false);
  });
  it("chaque radical indiqué existe et sert au moins une fois", () => {
    const connus = new Set(RADICAUX.map((r) => r.r));
    for (const m of MOTS_ZH.filter((x) => x.radical)) expect(connus.has(m.radical!), `${m.hz} : radical ${m.radical}`).toBe(true);
    for (const r of RADICAUX) expect(MOTS_ZH.filter((m) => m.radical === r.r).length, `radical ${r.r} utilisé`).toBeGreaterThan(0);
  });
  it("environ 80 phrases, découpées en mots, pinyin mot par mot", () => {
    expect(PHRASES_ZH.length).toBeGreaterThanOrEqual(78);
    expect(new Set(PHRASES_ZH.map((p) => p.mots.join(""))).size).toBe(PHRASES_ZH.length);
    for (const p of PHRASES_ZH) {
      const ou = p.mots.join("");
      expect(p.mots.length, ou).toBe(p.py.length);
      expect(p.mots.length, ou).toBeGreaterThanOrEqual(2);
      expect(["。", "？", "！"]).toContain(p.fin);
      p.mots.forEach((w, i) => {
        expect(w, ou).toMatch(HANZI);
        verifierPinyin(p.py[i], [...w].length, `${ou} / ${w}`);
      });
    }
  });
  it("un mot de la liste garde le même pinyin dans les phrases (hors 一, 不 et tons neutres)", () => {
    const index = new Map(MOTS_ZH.map((m) => [m.hz, m.py]));
    for (const p of PHRASES_ZH)
      p.mots.forEach((w, i) => {
        const py = index.get(w);
        if (!py || /[一不]/.test(w) || w === "个") return;
        expect(p.py[i], `${w} dans ${p.mots.join("")}`).toBe(py);
      });
  });
  it("syllabes pour les tons : un caractère, un ton marqué, sans 一 ni 不", () => {
    expect(SYLLABES_TONS.length).toBeGreaterThanOrEqual(50);
    expect(new Set(SYLLABES_TONS.map((s) => s.hz)).size).toBe(SYLLABES_TONS.length);
    for (const s of SYLLABES_TONS) {
      expect([...s.hz].length).toBe(1);
      expect(tonDe(s.py), s.hz).toBeGreaterThan(0);
      verifierPinyin(s.py, 1, s.hz);
      expect("一不").not.toContain(s.hz);
    }
    for (const t of [1, 2, 3, 4]) expect(SYLLABES_TONS.filter((s) => tonDe(s.py) === t).length).toBeGreaterThanOrEqual(10);
  });
});

describe("contenu arabe", () => {
  it("les 28 lettres, sans doublon", () => {
    expect(LETTRES.length).toBe(28);
    expect(new Set(LETTRES.map((l) => l.l)).size).toBe(28);
    expect(LETTRES.filter((l) => !l.lie).map((l) => l.l).join("")).toBe("ادذرزو");
  });
  it("environ 300 mots, sans doublon, en lettres arabes avec voyelles", () => {
    expect(MOTS_AR.length).toBeGreaterThanOrEqual(280);
    expect(new Set(MOTS_AR.map((m) => m.ar)).size).toBe(MOTS_AR.length);
    for (const m of MOTS_AR) {
      expect(m.ar, m.tr).toMatch(ARABE_SEUL);
      expect(aDesHarakat(m.ar), `${m.tr} : voyelles`).toBe(true);
      expect(LATIN.test(m.tr) || /[ʾʿ]/.test(m.tr), m.ar).toBe(true);
      expect(estArabe(m.tr), m.ar).toBe(false);
      expect(m.fr.trim(), m.ar).not.toBe("");
      // Pas deux voyelles courtes de suite sur la même lettre (sauf shadda + voyelle).
      expect(/[ً-ِْ][ً-ِْ]/.test(m.ar), `${m.tr} : voyelles doublées`).toBe(false);
    }
  });
  it("racines : 3 lettres arabes, dont au moins 2 se retrouvent dans le mot", () => {
    for (const m of MOTS_AR.filter((x) => x.racine)) {
      const r = lettresRacine(m.racine!);
      expect(r.length, m.tr).toBe(3);
      const mot = normaliserPourRacine(m.ar);
      expect(r.filter((x) => mot.includes(x === "ى" ? "ي" : x)).length, `${m.tr} / ${m.racine}`).toBeGreaterThanOrEqual(2);
    }
    // Au moins une famille de mots bien fournie (ك ت ب : livre, bureau, écrivain…).
    expect(MOTS_AR.filter((m) => m.racine === "ك ت ب").length).toBeGreaterThanOrEqual(4);
  });
  it("environ 80 phrases, chacune en lettres arabes avec voyelles", () => {
    expect(PHRASES_AR.length).toBeGreaterThanOrEqual(78);
    expect(new Set(PHRASES_AR.map((p) => sansHarakat(p.mots.join(" ")))).size).toBe(PHRASES_AR.length);
    for (const p of PHRASES_AR) {
      const t = p.mots.join(" ");
      expect(p.mots.length, t).toBeGreaterThanOrEqual(2);
      for (const w of p.mots) {
        expect(estArabe(w), t).toBe(true);
        expect(w, t).toMatch(ARABE_SEUL);
        expect(aDesHarakat(w), `${w} dans ${t}`).toBe(true);
      }
      expect(LATIN.test(p.tr), t).toBe(true);
      expect([".", "؟", "!"]).toContain(p.fin);
    }
  });
  it("aucun mot ni phrase ne contient le nom d'une sourate ni le mot « verset »", () => {
    const interdit = /آيَة|آية|سُورَة|سورة|قُرْآن|قرآن/;
    for (const m of MOTS_AR) expect(interdit.test(m.ar)).toBe(false);
    for (const p of PHRASES_AR) expect(interdit.test(p.mots.join(" "))).toBe(false);
  });
});

describe("fiches, quiz et sources", () => {
  it("les 10 fiches demandées, chaque source existe", () => {
    expect(FICHES.map((f) => f.id)).toEqual(["espacement", "test", "mot-cle", "tons", "radicaux", "arabe", "produire", "age", "styles", "sommeil"]);
    const ids = new Set(SOURCES.map((s) => s.id));
    for (const f of FICHES) {
      expect(f.principes.length).toBeGreaterThan(0);
      for (const s of f.sources) expect(ids.has(s), s).toBe(true);
    }
    expect(source("inconnue").texte).toBe("inconnue");
  });
  it("le quiz renvoie vers des fiches existantes et mélange vrai et faux", () => {
    const fiches = new Set(FICHES.map((f) => f.id));
    for (const q of QUIZ) expect(fiches.has(q.fiche), q.fiche).toBe(true);
    expect(QUIZ.some((q) => q.vrai)).toBe(true);
    expect(QUIZ.some((q) => !q.vrai)).toBe(true);
  });
  it("les liens sont des DOI (vérifiés)", () => {
    for (const s of SOURCES.filter((x) => x.lien)) expect(s.lien).toMatch(/^https:\/\/doi\.org\/10\./);
  });
});
