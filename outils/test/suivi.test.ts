import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMonths, byName, choreStatus, dueAlerts, emptySuivi, ignoredFile, latest, normalizeSuivi, normalizeUrl, parseBookmark, parseDate,
  purgeBookmarks, reduceSuivi, rollDeadline, sinceText, sortChores, splitNameDate, toIcs, type Deadline,
} from "../src/core/suivi.ts";

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 13, 15, 0).getTime(); // vendredi 13 novembre 2026
const dl = (p: Partial<Deadline>): Deadline => ({ id: "d", name: "Netflix", date: "2026-12-15", cancelBy: null, recurrence: "aucune", amount: "", note: "", notified: [], ...p });

test("dates tapées", () => {
  assert.equal(parseDate("15/12", NOW), "2026-12-15");
  assert.equal(parseDate("15/12/2027", NOW), "2027-12-15");
  assert.equal(parseDate("15-12-27", NOW), "2027-12-15");
  assert.equal(parseDate("2026-12-01", NOW), "2026-12-01");
  assert.equal(parseDate("3/2", NOW), "2027-02-03", "sans année : la prochaine fois");
  assert.equal(parseDate("13/11", NOW), "2026-11-13", "aujourd'hui compris");
  assert.equal(parseDate("15 décembre", NOW), "2026-12-15");
  assert.equal(parseDate("1er janv 2028", NOW), "2028-01-01");
  assert.equal(parseDate("le 2 fev", NOW), "2027-02-02");
  assert.equal(parseDate("demain", NOW), "2026-11-14");
  assert.equal(parseDate("dans 10 jours", NOW), "2026-11-23");
  assert.equal(parseDate("dans 2 semaines", NOW), "2026-11-27");
  assert.equal(parseDate("dans 3 mois", NOW), "2027-02-13");
  assert.equal(parseDate("31/02", NOW), null);
  assert.equal(parseDate("29/02", NOW), null, "2027 n'est pas bissextile");
  assert.equal(parseDate("netflix", NOW), null);
  assert.equal(parseDate("15 ma", NOW), null, "mois ambigu trop court");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-11-30", 3), "2027-02-28");
});

test("« echeance Netflix 15/12 » : nom puis date", () => {
  assert.deepEqual(splitNameDate("Netflix 15/12", NOW), { name: "Netflix", date: "2026-12-15" });
  assert.deepEqual(splitNameDate("Assurance auto 1er mars 2027", NOW), { name: "Assurance auto", date: "2027-03-01" });
  assert.deepEqual(splitNameDate("Impôts dans 10 jours", NOW), { name: "Impôts", date: "2026-11-23" });
  assert.deepEqual(splitNameDate("Contrôle technique", NOW), { name: "Contrôle technique", date: null });
  assert.deepEqual(splitNameDate("15/12", NOW), { name: "15/12", date: null }, "il faut un nom");
});

test("rappels 3 jours avant, une seule fois, résiliation comprise", () => {
  const d = dl({ date: "2026-11-20", cancelBy: "2026-11-16", amount: "13,49 €" });
  let a = dueAlerts([d], NOW);
  assert.deepEqual(a.map((x) => x.key), ["resilier:2026-11-16"]);
  assert.equal(a[0].title, "Résilier Netflix : dans 3 jours");
  assert.match(a[0].body, /13,49 €/);
  a = dueAlerts([{ ...d, notified: ["resilier:2026-11-16"] }], NOW + 4 * DAY);
  assert.deepEqual(a.map((x) => x.key), ["echeance:2026-11-20"]);
  assert.equal(a[0].title, "Netflix : dans 3 jours");
  assert.equal(dueAlerts([dl({ date: "2026-11-30" })], NOW).length, 0, "trop tôt");
  assert.equal(dueAlerts([dl({ date: "2026-11-12" })], NOW).length, 0, "passée");
  assert.equal(dueAlerts([dl({ date: "2026-11-13" })], NOW)[0].title, "Netflix : aujourd'hui");
});

test("abonnements : la date avance après l'échéance, la résiliation suit", () => {
  const d = dl({ date: "2026-10-31", cancelBy: "2026-10-24", recurrence: "mensuelle", notified: ["echeance:2026-10-31"] });
  const r = rollDeadline(d, "2026-11-13");
  assert.equal(r.date, "2026-11-30");
  assert.equal(r.cancelBy, "2026-11-23");
  assert.deepEqual(r.notified, []);
  assert.equal(rollDeadline(dl({ date: "2025-02-28", recurrence: "annuelle" }), "2026-11-13").date, "2027-02-28");
  assert.equal(rollDeadline(dl({ date: "2026-01-31", recurrence: "mensuelle" }), "2026-03-01").date, "2026-03-31", "jour d'origine gardé");
  const once = dl({ date: "2026-10-01" });
  assert.equal(rollDeadline(once, "2026-11-13"), once);
});

test("export .ics", () => {
  const ics = toIcs([dl({ id: "n1", name: "Netflix, Premium; famille", cancelBy: "2026-12-08", recurrence: "mensuelle", amount: "17,99 €", note: "Résilier en ligne" })], NOW);
  const lines = ics.split("\r\n");
  assert.equal(lines[0], "BEGIN:VCALENDAR");
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.equal(lines.filter((l) => l === "BEGIN:VEVENT").length, 2);
  assert.ok(lines.includes("DTSTART;VALUE=DATE:20261215"));
  assert.ok(lines.includes("DTEND;VALUE=DATE:20261216"));
  assert.ok(lines.includes("SUMMARY:Netflix\\, Premium\\; famille"));
  assert.ok(lines.includes("RRULE:FREQ=MONTHLY"));
  assert.ok(lines.includes("TRIGGER:-P3D"));
  assert.ok(lines.includes("UID:n1-resilier@rayans-outils"));
  const enc = new TextEncoder();
  for (const l of lines) assert.ok(enc.encode(l).length <= 75, `ligne trop longue : ${l}`);
  // Les lignes repliées se recollent à l'identique.
  const long = toIcs([dl({ note: "é".repeat(80) })], NOW).replace(/\r\n /g, "");
  assert.ok(long.includes("é".repeat(80)));
});

test("à lire plus tard", () => {
  assert.deepEqual(parseBookmark("exemple.fr/article pour le mémoire"), { url: "https://exemple.fr/article", reason: "le mémoire" });
  assert.deepEqual(parseBookmark("https://www.youtube.com/watch?v=abc conférence"), { url: "https://www.youtube.com/watch?v=abc", reason: "conférence" });
  assert.deepEqual(parseBookmark("pour le mémoire"), { url: null, reason: "pour le mémoire" });
  assert.equal(normalizeUrl("javascript:alert(1)"), null);
  assert.equal(normalizeUrl("bonjour"), null);
  let s = reduceSuivi(emptySuivi(), { type: "bookmark-add", id: "b1", url: "https://a.fr/", reason: "x" }, NOW);
  s = reduceSuivi(s, { type: "bookmark-add", id: "b2", url: "https://a.fr/", reason: "y" }, NOW + DAY);
  assert.equal(s.bookmarks.length, 1, "pas de doublon");
  assert.equal(s.bookmarks[0].reason, "y");
  s = reduceSuivi(s, { type: "bookmark-read", id: "b1", read: true }, NOW + 2 * DAY);
  assert.equal(s.bookmarks[0].readAt, NOW + 2 * DAY);
  assert.equal(purgeBookmarks(s.bookmarks, NOW + 29 * DAY).length, 1);
  assert.equal(purgeBookmarks(s.bookmarks, NOW + 30 * DAY).length, 0);
});

test("entretien", () => {
  let s = reduceSuivi(emptySuivi(), { type: "chore-done", id: "c1", name: "Vidange" }, NOW - 40 * DAY);
  s = reduceSuivi(s, { type: "chore-done", id: "autre", name: "vidange" }, NOW - 35 * DAY);
  assert.equal(s.chores.length, 1);
  assert.equal(s.chores[0].done.length, 2);
  let st = choreStatus(s.chores[0], NOW);
  assert.deepEqual([st.days, st.late], [35, true]);
  assert.equal(sinceText(35), "il y a 35 jours");
  assert.equal(sinceText(400), "il y a 13 mois");
  s = reduceSuivi(s, { type: "chore-save", chore: { id: "c1", name: "Vidange", intervalDays: 365 } }, NOW);
  assert.equal(s.chores[0].done.length, 2, "dates gardées");
  st = choreStatus(s.chores[0], NOW);
  assert.equal(st.late, false);
  s = reduceSuivi(s, { type: "chore-undo", id: "c1" }, NOW);
  assert.equal(choreStatus(s.chores[0], NOW).days, 40);
  s = reduceSuivi(s, { type: "chore-save", chore: { id: "c2", name: "Piles détecteur", intervalDays: 30, done: [NOW - 31 * DAY] } }, NOW);
  assert.deepEqual(sortChores(s.chores, NOW).map((c) => c.id), ["c2", "c1"]);
  assert.equal(choreStatus({ id: "x", name: "x", intervalDays: 10, done: [] }, NOW).days, null);
});

test("textes à coller et recherche par nom", () => {
  const list = [{ id: "1", name: "IBAN", text: "FR76" }, { id: "2", name: "Adresse perso", text: "…" }, { id: "3", name: "Adresse travail", text: "…" }];
  assert.equal(byName(list, "iban")!.id, "1");
  assert.equal(byName(list, "adresse"), null, "ambigu");
  assert.equal(byName(list, "adresse t")!.id, "3");
  assert.equal(byName(list, ""), null);
});

test("normalisation des données", () => {
  const s = normalizeSuivi({
    deadlines: [dl({}), { id: "x", name: "Sans date" }, { ...dl({ id: "y" }), recurrence: "hebdo", cancelBy: "demain" }],
    bookmarks: [{ id: "b", url: "javascript:x", addedAt: 1 }, { id: "c", url: "https://ok.fr", addedAt: 1 }],
    chores: [{ id: "c", name: "Filtre", intervalDays: -3, done: [3, 1, "x"] }],
    snippets: [{ id: "s", name: "", text: "x" }],
  });
  assert.equal(s.deadlines.length, 2);
  assert.equal(s.deadlines[1].recurrence, "aucune");
  assert.equal(s.deadlines[1].cancelBy, null);
  assert.equal(s.bookmarks.length, 1);
  assert.deepEqual([s.chores[0].intervalDays, s.chores[0].done], [30, [1, 3]]);
  assert.equal(s.snippets.length, 0);
  assert.deepEqual(normalizeSuivi("cassé"), emptySuivi());
});

test("fichiers récents", () => {
  const f = (name: string, created: number) => ({ path: name, name, folder: "", created, size: 1 });
  assert.deepEqual(latest([f("a", 1), f("b", 3), f("c", 2)], 2).map((x) => x.name), ["b", "c"]);
  assert.ok(ignoredFile("film.mkv.crdownload") && ignoredFile("~$rapport.docx") && ignoredFile("desktop.ini") && ignoredFile(".cache"));
  assert.ok(!ignoredFile("facture.pdf"));
});
