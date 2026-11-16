// Les cours de test sont écrits en heure de Paris (UTC+1 en novembre) : même fuseau partout, CI comprise.
process.env.TZ = "Europe/Paris";

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkIcsUrl, diffCourses, maskUrl, mergeChanges, parseIcs } from "../src/core/ics.ts";
import { analyzeMail, findDays, findRooms, parseMailInput, senderAllowed } from "../src/core/mail.ts";
import { acceptProposal, addMail, applyFetch, displayCourses, EMPTY_FAC, ignoreProposal, prune, removeOverride, resolveConflict, sanitizeFac } from "../src/core/fac.ts";

// Mardi 17 novembre 2026, 10 h 15 heure de Paris = 9 h 15 UTC.
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime();
const NOW = at(17, 8, 2);

const ev = (uid: string, start: string, end: string, summary: string, loc: string, extra = "") =>
  `BEGIN:VEVENT\r\nDTSTAMP:20261117T070000Z\r\nDTSTART:${start}\r\nDTEND:${end}\r\nSUMMARY:${summary}\r\nLOCATION:${loc}\r\nDESCRIPTION:\\n\\nL3 Info TD2\\nDUPONT Marie\\n(Exporté le:17/11/2026 08:02)\\n\r\nUID:${uid}\r\n${extra}END:VEVENT\r\n`;
const cal = (...e: string[]) => `BEGIN:VCALENDAR\r\nMETHOD:REQUEST\r\nPRODID:-//ADE/version 6.0\r\nVERSION:2.0\r\nCALSCALE:GREGORIAN\r\n${e.join("")}END:VCALENDAR\r\n`;

const ANALYSE = (room = "B12") => ev("ADE60-1", "20261117T091500Z", "20261117T111500Z", "TD Analyse", room);
const PROG = ev("ADE60-2", "20261117T130000Z", "20261117T150000Z", "CM Programmation fonctionnelle", "Amphi B (bât. 2)");
const ANGLAIS = ev("ADE60-3", "20261118T080000Z", "20261118T100000Z", "TD Anglais", "Salle 110");

test("ADE : lecture du flux iCalendar", () => {
  const folded = cal(ANALYSE().replace("SUMMARY:TD Analyse", "SUMMARY:TD Ana\r\n lyse"), PROG);
  const c = parseIcs(folded);
  assert.equal(c.length, 2);
  assert.equal(c[0].title, "TD Analyse");
  assert.equal(c[0].start, at(17, 10, 15)); // 9 h 15 UTC = 10 h 15 à Paris en novembre
  assert.equal(c[0].room, "B12");
  assert.equal(c[0].details, "L3 Info TD2\nDUPONT Marie"); // sans « Exporté le »
  assert.throws(() => parseIcs("<html>Connexion</html>"));
});

test("ADE : pas de doublon quand un cours est mis à jour", () => {
  const c = parseIcs(cal(ANALYSE("B12"), ANALYSE("Salle 004").replace("UID:", "SEQUENCE:2\r\nUID:")));
  assert.equal(c.length, 1);
  assert.equal(c[0].room, "Salle 004");
});

test("ADE : changements entre deux téléchargements", () => {
  const before = parseIcs(cal(ANALYSE("B12"), PROG, ANGLAIS));
  const after = parseIcs(cal(ANALYSE("Salle 004"), PROG, ANGLAIS));
  const ch = diffCourses(before, after, NOW);
  assert.deepEqual(ch.map((c) => [c.kind, c.before, c.after]), [["salle", "B12", "Salle 004"]]);
  // Le CM de 14 h n'est plus dans un flux qui commence à 10 h 15 : il est retiré.
  const after2 = parseIcs(cal(ANALYSE("B12"), ANGLAIS));
  assert.equal(diffCourses(before, after2, NOW)[0].kind, "suppression");
  // Premier téléchargement : rien à signaler.
  assert.deepEqual(diffCourses([], after, NOW), []);
  // B12 → 004 puis 004 → B12 : le changement disparaît ; B12 → 004 → 012 : reste « B12 → 012 ».
  const one = mergeChanges([], ch, NOW);
  assert.deepEqual(mergeChanges(one, diffCourses(after, before, NOW).filter((c) => c.kind === "salle"), NOW), []);
  const third = diffCourses(after, parseIcs(cal(ANALYSE("Salle 012"))), NOW).filter((c) => c.kind === "salle");
  assert.deepEqual(mergeChanges(one, third, NOW).map((c) => [c.before, c.after]), [["B12", "Salle 012"]]);
});

test("adresse ADE : https seulement, jamais affichée en entier", () => {
  assert.throws(() => checkIcsUrl("http://planning.univ-rennes1.fr/x"));
  assert.throws(() => checkIcsUrl("bonjour"));
  const u = checkIcsUrl(" https://planning.univ-rennes1.fr/jsp/custom/modules/plannings/bE3p9YAm.shu ");
  assert.equal(maskUrl(u), "planning.univ-rennes1.fr/….shu");
});

const MAIL_TEXTE = `De : Secrétariat L3 Informatique <secretariat-l3info@univ-rennes.fr>
Objet : TD Analyse - changement de salle
Date : 17/11/2026 08:00

Bonjour,

Le TD d'analyse de ce mardi 17 novembre à 10h15 aura lieu en salle 004 du bâtiment 14 au lieu de la salle B12.

Cordialement,
Le secrétariat`;

test("mail collé depuis le webmail", () => {
  const m = parseMailInput(MAIL_TEXTE);
  assert.equal(m.subject, "TD Analyse - changement de salle");
  assert.equal(m.date, at(17, 8, 0));
  assert.match(m.body, /^Bonjour/);
  assert.ok(senderAllowed(m.from, ["@univ-rennes.fr"]));
  assert.ok(senderAllowed(m.from, ["secretariat-l3info@univ-rennes.fr"]));
  assert.ok(!senderAllowed(m.from, ["scolarite@univ-rennes.fr"]));
});

test("fichier .eml (en-têtes encodés, quoted-printable, multipart)", () => {
  const eml = [
    "Return-Path: <x@univ-rennes.fr>", "From: =?utf-8?Q?Secr=C3=A9tariat?= <secretariat-l3info@univ-rennes.fr>",
    "Subject: =?utf-8?B?VEQgQW5hbHlzZSA6IGNoYW5nZW1lbnQgZGUgc2FsbGU=?=", "Date: Tue, 17 Nov 2026 08:00:00 +0100",
    "MIME-Version: 1.0", 'Content-Type: multipart/alternative; boundary="b1"', "", "--b1",
    "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: quoted-printable", "",
    "Le TD aura lieu en salle 004 du b=C3=A2timent 14.", "--b1", "Content-Type: text/html; charset=utf-8", "", "<p>HTML</p>", "--b1--", "",
  ].join("\r\n");
  const m = parseMailInput(eml);
  assert.equal(m.from, "Secrétariat <secretariat-l3info@univ-rennes.fr>");
  assert.equal(m.subject, "TD Analyse : changement de salle");
  assert.equal(m.date, Date.parse("2026-11-17T07:00:00Z"));
  assert.equal(m.body, "Le TD aura lieu en salle 004 du bâtiment 14.");
});

test("dates et salles dans le texte", () => {
  const days = findDays("le mardi 17 novembre, puis le 02/12 et demain", NOW).map((f) => f.day);
  assert.deepEqual(days, [at(17, 0), at(2 + 30, 0) /* 2 décembre */, at(18, 0)]);
  // Un mail de décembre qui parle du 12 janvier : l'année suivante.
  assert.equal(findDays("le 12 janvier", new Date(2026, 11, 15).getTime())[0].day, new Date(2027, 0, 12).getTime());
  assert.deepEqual(findRooms("de la salle B12 vers la salle 004 du bâtiment 14").map((r) => r.room), ["Salle B12", "Salle 004 (bât. 14)"]);
});

test("exemple validé : changement de salle, ADE pas encore à jour", () => {
  let d = applyFetch({ ...EMPTY_FAC, allowedSenders: ["@univ-rennes.fr"] }, parseIcs(cal(ANALYSE("B12"), PROG, ANGLAIS)), NOW);
  const { data, mail } = addMail(d, parseMailInput(MAIL_TEXTE), NOW);
  assert.equal(mail.unknownSender, false);
  assert.match(mail.excerpt, /aura lieu en salle 004/);
  const p = mail.proposals.find((x) => x.kind === "salle")!;
  assert.equal(p.status, "a-valider");
  assert.equal(p.courseUid, "ADE60-1");
  assert.equal(p.before, "B12");
  assert.equal(p.after, "Salle 004 (bât. 14)");
  // Rien ne change avant validation.
  assert.equal(displayCourses(data)[0].room, "B12");
  d = acceptProposal(data, mail.id, p.id);
  const c = displayCourses(d)[0];
  assert.equal(c.room, "Salle 004 (bât. 14)");
  assert.equal(c.corrected, "salle");
  assert.equal(c.ade?.room, "B12");
  // ADE se met à jour avec la même salle (écrite à sa façon) : la correction disparaît d'elle-même.
  const synced = applyFetch(d, parseIcs(cal(ANALYSE("B14-004"), PROG, ANGLAIS)), NOW + 3_600_000);
  assert.equal(synced.overrides.length, 0);
  assert.equal(displayCourses(synced)[0].room, "B14-004");
  // ADE passe à une troisième salle : conflit signalé, Rayan tranche.
  const other = applyFetch(d, parseIcs(cal(ANALYSE("Amphi C"), PROG, ANGLAIS)), NOW + 3_600_000);
  assert.equal(other.overrides[0].conflict, "Amphi C");
  assert.equal(displayCourses(other)[0].room, "Salle 004 (bât. 14)");
  assert.equal(displayCourses(resolveConflict(other, "ADE60-1", "ade"))[0].room, "Amphi C");
  const kept = resolveConflict(other, "ADE60-1", "mail");
  assert.equal(kept.overrides[0].conflict, undefined);
  assert.equal(displayCourses(kept)[0].room, "Salle 004 (bât. 14)");
});

test("exemple validé : ADE déjà à jour", () => {
  const d = applyFetch(EMPTY_FAC, parseIcs(cal(ANALYSE("Salle 004 - Bât 14"), PROG)), NOW);
  const { mail } = addMail(d, parseMailInput(MAIL_TEXTE), NOW);
  assert.equal(mail.unknownSender, true); // liste d'expéditeurs vide
  assert.deepEqual(mail.proposals.map((p) => [p.kind, p.status]), [["salle", "deja-a-jour"]]);
});

test("annulation, report, examen, devoir", () => {
  const d = applyFetch(EMPTY_FAC, parseIcs(cal(ANALYSE(), PROG, ANGLAIS)), NOW);
  const props = (text: string) => addMail(d, parseMailInput(text), NOW).mail.proposals;

  const ann = props("Objet : Programmation fonctionnelle\n\nLe CM de programmation fonctionnelle de cet après-midi n'aura pas lieu.");
  assert.deepEqual(ann.map((p) => [p.kind, p.courseUid]), [["annulation", "ADE60-2"]]);

  const rep = props("Objet : TD Anglais\n\nLe TD d'anglais du mercredi 18 novembre est décalé à 14h.");
  assert.equal(rep[0].kind, "horaire");
  assert.equal(rep[0].newStart, at(18, 14));
  assert.equal(rep[0].newEnd, at(18, 16));

  const exam = props("Objet : Partiel d'analyse\n\nLe partiel d'analyse aura lieu le jeudi 10 décembre à 8h30 en amphi A.");
  const e = exam.find((p) => p.kind === "examen")!;
  assert.equal(e.deadlineAt, new Date(2026, 11, 10, 8, 30).getTime());
  assert.equal(e.deadlineTitle, "Examen : Partiel d'analyse");

  const dev = props("Objet : Projet Programmation fonctionnelle\n\nLe projet est à rendre sur Moodle avant le 4 décembre.");
  const v = dev.find((p) => p.kind === "devoir")!;
  assert.equal(v.deadlineAt, new Date(2026, 11, 4, 23, 59).getTime());

  // Un mail sans rapport ne propose rien.
  assert.deepEqual(props("Objet : Soirée d'intégration\n\nVenez nombreux jeudi soir au foyer !"), []);
});

test("valider, ignorer, annuler une correction ; ménage", () => {
  const d0 = applyFetch(EMPTY_FAC, parseIcs(cal(ANALYSE(), PROG)), NOW);
  const { data, mail } = addMail(d0, parseMailInput("Objet : Programmation fonctionnelle\n\nLe CM de programmation fonctionnelle est annulé aujourd'hui."), NOW);
  const p = mail.proposals[0];
  const ign = ignoreProposal(data, mail.id, p.id);
  assert.equal(ign.mails[0].proposals[0].status, "ignoree");
  const acc = acceptProposal(data, mail.id, p.id);
  assert.equal(displayCourses(acc).find((c) => c.uid === "ADE60-2")!.cancelled, true);
  const back = removeOverride(acc, "ADE60-2");
  assert.equal(displayCourses(back).find((c) => c.uid === "ADE60-2")!.cancelled, undefined);
  assert.equal(back.mails[0].proposals[0].status, "a-valider");
  // 31 jours plus tard, le mail est oublié.
  assert.equal(prune(data, NOW + 31 * 86_400_000).mails.length, 0);
  assert.deepEqual(sanitizeFac({ courses: [{ uid: 1 }], mails: "x" }).courses, []);
});

test("autres tournures de mails", () => {
  const d = applyFetch(EMPTY_FAC, parseIcs(cal(ANALYSE("B12"), PROG, ANGLAIS)), NOW);
  const props = (text: string) => addMail(d, parseMailInput(text), NOW).mail.proposals;
  // « de la salle X vers la salle Y » : la nouvelle salle est la seconde.
  const a = props("Objet : TD Analyse\n\nLe TD d'analyse est déplacé de la salle B12 vers la salle 012 ce mardi.");
  assert.deepEqual(a.map((p) => [p.kind, p.after]), [["salle", "Salle 012"]]);
  // Amphi, avec le cours désigné seulement par son titre.
  const b = props("Objet : CM Programmation fonctionnelle\n\nAttention : cet après-midi le CM aura lieu en amphi C.");
  assert.deepEqual(b.map((p) => [p.kind, p.courseUid, p.after]), [["salle", "ADE60-2", "Amphi C"]]);
  // Mail qui ne cite aucun cours connu : pas de proposition de salle au hasard.
  assert.deepEqual(props("Objet : Réunion d'information\n\nLa réunion aura lieu en salle 201."), []);
  // .eml en HTML seulement.
  const html = ["From: scol@univ-rennes.fr", "Subject: TD Anglais annule", "Content-Type: text/html; charset=utf-8", "", "<p>Le TD d&#39;anglais de demain est <b>annul&eacute;</b>.</p>"].join("\r\n");
  const m = parseMailInput(html);
  assert.equal(m.body, "Le TD d'anglais de demain est annulé.");
  assert.deepEqual(analyzeMail(m, d.courses, NOW).map((p) => [p.kind, p.courseUid]), [["annulation", "ADE60-3"]]);
});
