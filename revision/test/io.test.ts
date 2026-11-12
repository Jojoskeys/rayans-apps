import { describe, expect, it } from "vitest";
import { checkCloze, checkTyped, clozeFull, clozeGapCount, normalize, parseCloze } from "../src/core/answer";
import { addDecks, addRows, detectSeparator, exportCsv, exportJson, importCsv, importJson, parseCsv, parseDb } from "../src/core/io";
import { emptyDb } from "../src/core/model";
import { sampleDb } from "../src/core/sample";
import { recordAnswer } from "../src/core/session";

const T0 = new Date(2026, 0, 10, 9).getTime();

describe("correction des réponses tapées", () => {
  it("ignore majuscules, accents, espaces et ponctuation finale (comme quiz-revision)", () => {
    expect(normalize("  Élève  ÉTÉ. ")).toBe("eleve ete");
    expect(checkTyped("NEW", "new").ok).toBe(true);
    expect(checkTyped("git   push", "git push").ok).toBe(true);
    expect(checkTyped("Ete!", "Été").ok).toBe(true);
    expect(checkTyped("l’arbre", "l'arbre").ok).toBe(true);
  });

  it("accepte les variantes séparées par « | »", () => {
    expect(checkTyped("quatre", "4|quatre")).toMatchObject({ ok: true, expected: "quatre" });
    expect(checkTyped("5", "4|quatre")).toMatchObject({ ok: false, expected: "4" });
  });

  it("tolère une faute de frappe à partir de 5 caractères, pas en dessous", () => {
    expect(checkTyped("photosynthese", "photosynthèse")).toMatchObject({ ok: true, typo: false });
    expect(checkTyped("photosintèse", "photosynthèse").ok).toBe(false);
    expect(checkTyped("photosynthse", "photosynthèse")).toMatchObject({ ok: true, typo: true });
    expect(checkTyped("nex", "new").ok).toBe(false);
    expect(checkTyped("", "new").ok).toBe(false);
  });

  it("textes à trous : syntaxes {{x}}, {{x::indice}} et Anki {{c1::x}}", () => {
    const t = "La {{c1::Seine}} traverse {{Paris::capitale}}.";
    expect(clozeGapCount(t)).toBe(2);
    expect(parseCloze(t)).toEqual([
      { text: "La " }, { gap: 0, answer: "Seine", hint: "" }, { text: " traverse " }, { gap: 1, answer: "Paris", hint: "capitale" }, { text: "." },
    ]);
    expect(clozeFull(t)).toBe("La Seine traverse Paris.");
    expect(checkCloze(t, ["seine", "PARIS"]).ok).toBe(true);
    expect(checkCloze(t, ["seine", "Lyon"]).ok).toBe(false);
    expect(clozeGapCount("Pas de trou {{}} ici")).toBe(0);
  });
});

describe("CSV", () => {
  it("lit le fichier questions.txt de quiz-revision (question;réponse, sans en-tête)", () => {
    const text = "Quel mot-clé Java crée un objet ?;new\nCombien d'octets occupe un int en Java ?;4\nQuelle commande Git envoie les commits vers GitHub ?;git push";
    const r = importCsv(text);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(3);
    expect(r.rows[2]).toMatchObject({ kind: "basic", question: "Quelle commande Git envoie les commits vers GitHub ?", answer: "git push" });
  });

  it("détecte le séparateur et gère guillemets, retours à la ligne et BOM", () => {
    expect(detectSeparator("a,b,c\n")).toBe(",");
    expect(detectSeparator("a\tb\n")).toBe("\t");
    expect(detectSeparator('"a;b",c\n')).toBe(",");
    const rows = parseCsv('﻿question,reponse\n"Une ""citation"", ici","ligne 1\nligne 2"\r\n\n x , y ');
    expect(rows.map((r) => r.cells)).toEqual([["question", "reponse"], ['Une "citation", ici', "ligne 1\nligne 2"], [" x ", " y "]]);
    expect(rows.map((r) => r.line)).toEqual([1, 2, 5]);
  });

  it("avec en-tête : types, choix de QCM, trous, paquets, et erreurs avec numéro de ligne", () => {
    const text = [
      "Type;Question;Réponse;Choix;Explication;Paquet",
      "qr;Capitale de l'Italie ?;Rome;;;Géographie",
      "qcm;2 + 2 ?;4;3 | 4 | 5;;Maths",
      "trous;Le {{Rhône}} passe à Lyon.;;;;Géographie",
      ";Sans type avec {{trou}};;;;",
      "qcm;QCM sans bonne réponse ?;;a | b;;",
      "xyz;Type inconnu;a;;;",
      ";Question sans réponse;;;;",
    ].join("\n");
    const r = importCsv(text);
    expect(r.rows.map((x) => x.kind)).toEqual(["basic", "mcq", "cloze", "cloze"]);
    expect(r.rows[1]).toMatchObject({ answer: "4", choices: ["3", "4", "5"], deck: "Maths" });
    expect(r.errors.map((e) => e.line)).toEqual([6, 7, 8]);
    expect(r.errors[1].message).toContain("inconnu");
  });

  it("QCM dont la bonne réponse n'est pas dans les choix : elle y est ajoutée", () => {
    const r = importCsv("type;question;reponse;choix\nqcm;Couleur du ciel ?;bleu;rouge|vert");
    expect(r.rows[0].choices).toEqual(["bleu", "rouge", "vert"]);
  });

  it("aller-retour export → import sans perte", () => {
    const db = sampleDb(T0);
    db.cards[0].question = 'Avec ; point-virgule, "guillemets"\net retour à la ligne';
    const csv = exportCsv(db);
    expect(csv.startsWith("﻿type;question;reponse;choix;explication;paquet")).toBe(true);
    const back = importCsv(csv);
    expect(back.errors).toEqual([]);
    expect(back.rows.map(({ kind, question, answer, choices, explanation, deck }) => ({ kind, question, answer, choices, explanation, deck }))).toEqual(
      db.cards.map((c) => ({ kind: c.kind, question: c.question, answer: c.answer, choices: c.choices, explanation: c.explanation, deck: "Exemple : Java et Git" })),
    );
  });

  it("ajout des lignes : paquet cible, paquets nommés créés ou réutilisés", () => {
    const db = sampleDb(T0);
    const target = db.decks[0].id;
    const r = importCsv("type;question;reponse;paquet\nqr;a;b;\nqr;c;d;Nouveau\nqr;e;f;exemple : java et git");
    const out = addRows(db, r.rows, { deckId: target, fallbackName: "Import" }, T0);
    expect(out.added).toBe(3);
    expect(out.decksCreated).toBe(1);
    expect(out.db.decks.map((d) => d.name)).toEqual(["Exemple : Java et Git", "Nouveau"]);
    expect(out.db.cards.filter((c) => c.deckId === target)).toHaveLength(7);
    const noTarget = addRows(emptyDb(), r.rows.slice(0, 1), { fallbackName: "questions" }, T0);
    expect(noTarget.db.decks[0].name).toBe("questions");
  });
});

describe("JSON", () => {
  it("sauvegarde complète : aller-retour identique (progression, journal, réglages)", () => {
    let db = sampleDb(T0);
    db = recordAnswer(db, db.cards[0].id, 4, T0);
    db.settings.retention = 0.85;
    const text = exportJson(db, undefined, T0);
    expect(parseDb(text)).toEqual(db);
    const imp = importJson(text);
    expect(imp.isBackup).toBe(true);
    expect(imp.decks[0].cards).toHaveLength(5);
  });

  it("export d'un paquet puis import : nouveaux identifiants, nom unique, progression gardée ou non", () => {
    let db = sampleDb(T0);
    db = recordAnswer(db, db.cards[0].id, 4, T0);
    const text = exportJson(db, [db.decks[0].id], T0);
    const imp = importJson(text);
    expect(imp.isBackup).toBe(false);
    const kept = addDecks(db, imp.decks, true, T0).db;
    expect(kept.decks.map((d) => d.name)).toEqual(["Exemple : Java et Git", "Exemple : Java et Git (2)"]);
    expect(new Set(kept.cards.map((c) => c.id)).size).toBe(10);
    expect(kept.cards[5].sched.state).toBe("review");
    const fresh = addDecks(db, imp.decks, false, T0).db;
    expect(fresh.cards[5].sched.state).toBe("new");
  });

  it("liste simple d'objets JSON (champs en français ou en anglais)", () => {
    const imp = importJson(JSON.stringify([
      { question: "Q1", réponse: "R1" },
      { question: "Q2", answer: "B", choices: ["A", "B"] },
      { question: "Q3" },
      "pas un objet",
    ]));
    expect(imp.rows.map((r) => r.kind)).toEqual(["basic", "mcq"]);
    expect(imp.errors.map((e) => e.line)).toEqual([3, 4]);
  });

  it("refuse les fichiers invalides avec un message en français", () => {
    expect(() => importJson("{pas du json")).toThrow(/JSON valide/);
    expect(() => importJson('{"a":1}')).toThrow(/non reconnu/);
    expect(() => parseDb('{"format":"autre"}')).toThrow(/sauvegarde/);
  });

  it("nettoie les données douteuses (cartes orphelines, valeurs hors bornes)", () => {
    const db = parseDb(JSON.stringify({
      format: "rayans-revision", version: 1,
      settings: { retention: 2, dayStartHour: 99, learningSteps: ["x"] },
      decks: [{ id: "d1", name: "A", newPerDay: -5 }, { id: "d2" }],
      cards: [
        { id: "c1", deckId: "d1", kind: "basic", question: "q", answer: "a", sched: { state: "review", difficulty: 50, stability: -1, due: 5 } },
        { id: "c2", deckId: "inconnu", kind: "basic", question: "q", answer: "a" },
        { id: "c3", deckId: "d1", kind: "mcq", question: "q", answer: "", choices: [] },
      ],
      reviews: [{ cardId: "c1", ts: 1, grade: 7 }, { cardId: "c1", ts: 2, grade: 3 }],
    }));
    expect(db.settings).toMatchObject({ retention: 0.97, dayStartHour: 23, learningSteps: [1, 10] });
    expect(db.decks).toHaveLength(1);
    expect(db.decks[0].newPerDay).toBe(0);
    expect(db.cards.map((c) => c.id)).toEqual(["c1"]);
    expect(db.cards[0].sched).toMatchObject({ difficulty: 10, stability: 0.1 });
    expect(db.reviews).toHaveLength(1);
  });
});
