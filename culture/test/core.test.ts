import { describe, expect, it } from "vitest";
import { empreinte, extrait, lireActu, MAX_PAR_EDITION, questionsDepuisEdition, type EditionActu } from "../src/core/actu";
import { FICHES, QUIZ, source, SOURCES } from "../src/core/contenu";
import { apresReponse, cartesDues, ETAPES_JOURS } from "../src/core/espacement";
import { dayKey, emptyDb, fusionner, fusionnerTexte, parseDb, type Carte } from "../src/core/model";
import { BANQUE, estQuestion } from "../src/core/questions";
import { avecSeance, bilan, choixAffiches, composer, importerActu, importerActuTexte, niveauSuivant, questionDe, rafraichirSeance, repondre, seanceDuJour, serie } from "../src/core/seance";

const T0 = new Date(2026, 10, 27, 9, 0, 0).getTime(); // 27 novembre 2026, 9 h
const JOUR = 86400_000;

// Petite édition factice (même forme que celle du veilleur), avec des titres inventés.
const EDITION: EditionActu = {
  jour: "2026-11-27", genere: T0, mode: "claude", intro: "Une journée calme.",
  sujets: [
    { titre: "Un nouveau modèle d'IA ouvert", resume: "Une entreprise publie un modèle de langage sous licence libre. Il tourne sur un ordinateur portable.", rubrique: "tech", uneSource: false,
      sources: [{ media: "Le Monde", lien: "https://exemple.fr/a", titre: "Un modèle d'IA ouvert débarque" }, { media: "Numerama", lien: "https://exemple.fr/b", titre: "IA : un modèle libre" }] },
    { titre: "Une faille dans un routeur grand public", resume: "Des chercheurs signalent une faille permettant de prendre la main à distance. Un correctif est disponible.", rubrique: "cyber", uneSource: true,
      sources: [{ media: "ZDNet", lien: "https://exemple.fr/c", titre: "Faille critique dans des routeurs" }] },
    { titre: "Sommet sur le climat à Belém", resume: "Les négociateurs se retrouvent pour la dernière semaine du sommet. Les discussions portent sur le financement.", rubrique: "geo", uneSource: false,
      sources: [{ media: "France Info", lien: "https://exemple.fr/d", titre: "Climat : dernière ligne droite" }, { media: "Le Monde", lien: "https://exemple.fr/e", titre: "Sommet climat" }] },
    { titre: "Élections dans un pays voisin", resume: "Le scrutin s'est tenu dans le calme selon les observateurs. Les résultats sont attendus demain.", rubrique: "essentiel", uneSource: false,
      sources: [{ media: "AFP", lien: "https://exemple.fr/f", titre: "Scrutin dans le calme" }, { media: "France Info", lien: "https://exemple.fr/g", titre: "Élections" }] },
    { titre: "Rappel de mises à jour de sécurité", resume: "", rubrique: "bref", uneSource: true,
      sources: [{ media: "Numerama", lien: "https://exemple.fr/h", titre: "Pensez à mettre à jour" }] },
  ],
};

const carte = (p: Partial<Carte> = {}): Carte => ({ id: "f-ocean", etape: 0, due: null, vues: 0, justes: 0, ajoutee: T0, maj: T0, ...p });

describe("banque fixe", () => {
  it("assez de questions, toutes valides, ids uniques, choix différents", () => {
    expect(BANQUE.length).toBeGreaterThanOrEqual(50);
    expect(new Set(BANQUE.map((q) => q.id)).size).toBe(BANQUE.length);
    for (const q of BANQUE) {
      expect(estQuestion(q), q.id).toBe(true);
      expect(new Set(q.choix).size, q.id).toBe(q.choix.length);
      if (q.vf) expect(q.choix).toEqual(["Vrai", "Faux"]);
      else expect(q.choix.length, q.id).toBe(4);
    }
    for (const d of [1, 2, 3]) expect(BANQUE.filter((q) => q.difficulte === d).length).toBeGreaterThanOrEqual(8);
  });
  it("pas de sujet religieux", () => {
    const mots = /\b(dieu|allah|coran|bible|religion|église|mosquée|prophète|pape|vatican)\b/i;
    for (const q of BANQUE) expect(mots.test(`${q.enonce} ${q.choix.join(" ")} ${q.explication}`), q.id).toBe(false);
  });
});

describe("questions d'actu", () => {
  it("lit le fichier « actu » de Rayan's Mobile et une édition seule", () => {
    expect(lireActu(JSON.stringify({ editions: [EDITION, { ...EDITION, jour: "2026-11-26" }] })).map((e) => e.jour)).toEqual(["2026-11-27", "2026-11-26"]);
    expect(lireActu(JSON.stringify(EDITION))).toHaveLength(1);
    expect(lireActu(JSON.stringify({ editions: [] }))).toEqual([]);
    expect(() => lireActu("{\"autre\":1}")).toThrow();
    // Lien non http : source écartée ; sujet sans source : écarté.
    const sale = lireActu(JSON.stringify({ editions: [{ ...EDITION, sujets: [{ titre: "x", resume: "", sources: [{ media: "M", lien: "javascript:alert(1)", titre: "" }] }] }] }));
    expect(sale[0].sujets).toEqual([]);
  });

  it("génère des questions variées, valides et reproductibles", () => {
    const qs = questionsDepuisEdition(EDITION);
    expect(qs.length).toBeGreaterThanOrEqual(4);
    expect(qs.length).toBeLessThanOrEqual(MAX_PAR_EDITION);
    expect(questionsDepuisEdition(EDITION)).toEqual(qs); // même édition → mêmes questions (PC et iPhone)
    const sortes = new Set(qs.map((q) => q.id.split(":")[2]));
    expect(sortes.size).toBeGreaterThanOrEqual(3);
    for (const q of qs) {
      expect(estQuestion(q), q.id).toBe(true);
      expect(q.theme).toBe("actu");
      expect(q.id.startsWith("actu:2026-11-27:")).toBe(true);
      expect(new Set(q.choix).size).toBe(q.choix.length);
      expect(q.enonce.length).toBeLessThan(420);
    }
  });

  it("chaque sorte de question dit vrai", () => {
    const qs = questionsDepuisEdition(EDITION);
    for (const q of qs) {
      const sorte = q.id.split(":")[2];
      const sujet = EDITION.sujets.find((s) => empreinte(s.titre).toString(36) === q.id.split(":")[3])!;
      expect(sujet, q.id).toBeTruthy();
      const bonne = q.choix[q.bonne];
      if (sorte === "media") expect(sujet.sources.map((x) => x.media)).toContain(bonne);
      if (sorte === "resume") expect(bonne).toBe(sujet.titre);
      if (sorte === "une-source") expect(bonne).toBe(sujet.uneSource ? "Vrai" : "Faux");
      if (sorte === "rubrique") expect(["Informatique & IA", "Cybersécurité", "Géopolitique"][["tech", "cyber", "geo"].indexOf(sujet.rubrique!)]).toBe(bonne);
    }
    // Les rubriques « L'essentiel » et « En bref » ne servent jamais de réponse.
    expect(qs.some((q) => q.choix.includes("L'essentiel") || q.choix.includes("En bref"))).toBe(false);
  });

  it("ne recopie qu'une phrase courte du résumé", () => {
    expect(extrait("Première phrase. Deuxième phrase.")).toBe("Première phrase.");
    expect(extrait("a ".repeat(200)).length).toBeLessThanOrEqual(160);
    expect(extrait("")).toBe("");
  });

  it("importe une édition une seule fois et la fait entrer dans la séance", () => {
    const db0 = emptyDb();
    const r = importerActuTexte(db0, JSON.stringify({ editions: [EDITION] }), T0);
    expect(r.ajoutees).toBeGreaterThan(0);
    expect(r.db.actuJours).toEqual(["2026-11-27"]);
    expect(importerActu(r.db, [EDITION], T0 + 1000).db).toBe(r.db);
    // Une édition trop ancienne n'est plus de l'actualité.
    expect(importerActu(db0, [{ ...EDITION, jour: "2026-10-01" }], T0).ajoutees).toBe(0);
    const ids = composer(r.db, T0, 10, "x");
    expect(ids.filter((id) => id.startsWith("actu:")).length).toBe(3);
    expect(ids).toHaveLength(10);
    // Une fois répondue, la question d'actu entre en révision espacée.
    const id = ids.find((x) => x.startsWith("actu:"))!;
    const db2 = repondre(r.db, id, true, T0);
    const c = db2.cartes.find((x) => x.id === id)!;
    expect(c.vues).toBe(1);
    expect(c.due).toBe(new Date(2026, 10, 30, 4).getTime());
  });
});

describe("révision espacée", () => {
  it("bonne réponse → étape suivante, erreur → demain, puis apprise", () => {
    let c = apresReponse(carte(), true, T0, 4);
    expect(c.etape).toBe(1);
    expect(c.due).toBe(new Date(2026, 10, 30, 4).getTime()); // J+3
    c = apresReponse(c, false, T0, 4);
    expect(c.etape).toBe(0);
    expect(c.due).toBe(new Date(2026, 10, 28, 4).getTime()); // J+1
    for (let k = 0; k < ETAPES_JOURS.length; k++) c = apresReponse(c, true, T0, 4);
    expect(c.due).toBeNull();
    expect(c.vues).toBe(2 + ETAPES_JOURS.length);
  });
  it("les cartes dues sont triées et les nouvelles exclues", () => {
    const cs = [carte({ id: "a", vues: 1, due: T0 - 10 }), carte({ id: "b", vues: 1, due: T0 - 100 }), carte({ id: "c", vues: 0, due: null }), carte({ id: "d", vues: 1, due: T0 + JOUR })];
    expect(cartesDues(cs, T0).map((c) => c.id)).toEqual(["b", "a"]);
  });
});

describe("niveau adaptatif", () => {
  it("2 réussites de suite → plus dur, 1 échec → plus facile, bornes 1 à 3", () => {
    let n = emptyDb().niveau;
    n = niveauSuivant(n, true, 1);
    expect(n.level).toBe(1);
    n = niveauSuivant(n, true, 2);
    expect(n.level).toBe(2);
    n = niveauSuivant(niveauSuivant(n, true, 3), true, 4);
    n = niveauSuivant(niveauSuivant(n, true, 5), true, 6);
    expect(n.level).toBe(3);
    expect(n.best).toBe(3);
    n = niveauSuivant(n, false, 7);
    expect(n.level).toBe(2);
    n = niveauSuivant(niveauSuivant(n, false, 8), false, 9);
    expect(n.level).toBe(1);
  });
  it("les nouvelles questions suivent le niveau ; au niveau facile, une mauvaise réponse de moins", () => {
    const db = emptyDb();
    const faciles = composer(db, T0, 10, "g").map((id) => questionDe(db, id)!.difficulte);
    expect(faciles.every((d) => d === 1)).toBe(true);
    const dur = { ...db, niveau: { ...db.niveau, level: 3 } };
    expect(composer(dur, T0, 8, "g").map((id) => questionDe(dur, id)!.difficulte).every((d) => d === 3)).toBe(true);
    const q = BANQUE.find((x) => !x.vf)!;
    const a = choixAffiches(q, 1, 0);
    expect(a.choix).toHaveLength(3);
    expect(a.choix[a.bonne]).toBe(q.choix[q.bonne]);
    const b = choixAffiches(q, 2, 5);
    expect(b.choix).toHaveLength(4);
    expect(b.choix[b.bonne]).toBe(q.choix[q.bonne]);
  });
});

describe("séance du jour", () => {
  it("10 questions par défaut, fixée pour la journée, finie quand tout est répondu", () => {
    let db = avecSeance(emptyDb(), T0);
    const { seance, jour } = seanceDuJour(db, T0);
    expect(seance.ids).toHaveLength(10);
    expect(seanceDuJour(db, T0 + 3600_000).seance.ids).toEqual(seance.ids);
    for (const [k, id] of seance.ids.entries()) db = repondre(db, id, k % 3 !== 0, T0 + k * 1000);
    expect(db.seances[jour].fin).toBeDefined();
    expect(serie(db, T0)).toBe(1);
    expect(serie(db, T0 + JOUR)).toBe(1); // le lendemain, avant la séance, la série tient encore
    expect(serie(db, T0 + 2 * JOUR)).toBe(0);
    const b = bilan(db, T0 + 10_000);
    expect(b.reponses).toBe(10);
    expect(b.justes).toBe(6);
    expect(b.enRevision).toBe(10);
    expect(b.parJour[13].n).toBe(10);
  });
  it("les révisions dues passent avant les nouvelles, en gardant un peu de nouveau", () => {
    let db = emptyDb();
    const ids = BANQUE.slice(0, 12).map((q) => q.id);
    for (const id of ids) db = repondre(db, id, false, T0 - 2 * JOUR);
    const s = composer(db, T0, 10, "z");
    expect(s.filter((id) => ids.includes(id)).length).toBe(7);
    expect(s.filter((id) => !ids.includes(id)).length).toBe(3);
  });
  it("l'actu arrivée plus tard entre dans la séance seulement si elle n'est pas commencée", () => {
    const db = avecSeance(emptyDb(), T0);
    const avec = rafraichirSeance(importerActu(db, [EDITION], T0).db, T0);
    expect(seanceDuJour(avec, T0).seance.ids.filter((id) => id.startsWith("actu:")).length).toBe(3);
    const commencee = repondre(db, seanceDuJour(db, T0).seance.ids[0], true, T0);
    const apres = importerActu(commencee, [EDITION], T0).db;
    expect(rafraichirSeance(apres, T0)).toBe(apres);
  });
  it("la séance bonus évite les questions déjà prises", () => {
    const db = avecSeance(emptyDb(), T0);
    const deja = new Set(seanceDuJour(db, T0).seance.ids);
    const bonus = composer(db, T0, 5, "bonus", deja);
    expect(bonus).toHaveLength(5);
    expect(bonus.some((id) => deja.has(id))).toBe(false);
  });
});

describe("fichier et fusion PC ↔ iPhone", () => {
  it("relit ce qu'il écrit et refuse un autre fichier", () => {
    const db = repondre(avecSeance(importerActu(emptyDb(), [EDITION], T0).db, T0), BANQUE[0].id, true, T0);
    expect(parseDb(JSON.stringify(db))).toEqual(db);
    expect(() => parseDb("{\"format\":\"rayans-focus\"}")).toThrow();
    expect(parseDb("{\"format\":\"rayans-culture\",\"reglages\":{\"questions\":99}}").reglages.questions).toBe(10);
  });
  it("garde les deux côtés : carte la plus récente, réponses, séances, éditions importées", () => {
    const base = avecSeance(emptyDb(), T0);
    const id = seanceDuJour(base, T0).seance.ids[0];
    const id2 = seanceDuJour(base, T0).seance.ids[1];
    const pc = repondre(base, id, true, T0 + 1000);
    const tel = repondre(repondre(importerActu(base, [EDITION], T0).db, id, false, T0 + 5000), id2, true, T0 + 6000);
    const f = fusionner(pc, tel);
    expect(f.cartes.find((c) => c.id === id)!.maj).toBe(T0 + 5000); // la plus récente gagne
    expect(f.reponses).toHaveLength(3);
    expect(f.actuJours).toEqual(["2026-11-27"]);
    expect(f.cartes.filter((c) => c.id.startsWith("actu:")).length).toBeGreaterThan(0);
    expect(f.seances[dayKey(T0)].faites.sort()).toEqual([id, id2].sort());
    expect(f.niveau.maj).toBe(T0 + 6000);
    // Fusion dans les deux sens : même résultat ; fusion avec soi-même : rien ne change.
    expect(fusionner(tel, pc).cartes.find((c) => c.id === id)).toEqual(f.cartes.find((c) => c.id === id));
    expect(JSON.parse(fusionnerTexte(JSON.stringify(f), JSON.stringify(f))!)).toEqual(f);
    expect(fusionnerTexte(null, "x")).toBe("x");
    expect(fusionnerTexte("{abîmé", JSON.stringify(pc))).toBe(JSON.stringify(pc));
  });
});

describe("fiches et quiz", () => {
  it("chaque source citée existe et a un lien", () => {
    for (const f of FICHES) for (const s of f.sources) expect(source(s), `${f.id} → ${s}`).toBeTruthy();
    for (const m of QUIZ) expect(source(m.source), m.affirmation).toBeTruthy();
    for (const s of SOURCES) expect(s.lien).toMatch(/^https:\/\//);
    expect(QUIZ.filter((m) => m.vrai).length).toBeGreaterThanOrEqual(3);
    expect(QUIZ.filter((m) => !m.vrai).length).toBeGreaterThanOrEqual(3);
  });
});
