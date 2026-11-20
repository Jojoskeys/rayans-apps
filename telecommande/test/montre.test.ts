// Rayan's Montre : saisies de la montre (eau, séance, humeur) et résumé du jour, rangés dans montre.json.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { codeValide } from "../src/core/securite.ts";
import { normaliserDonnees } from "../src/core/donnees.ts";
import { dateLocale, demande, ErreurMontre, fichierMontre, lire, recevoir, vue } from "../src/core/montre.ts";

const fichier = () => fichierMontre(fs.mkdtempSync(path.join(os.tmpdir(), "montre-tc-")));
// Dates locales : le test marche quel que soit le fuseau du PC.
const MAINTENANT = new Date(2026, 10, 20, 21, 0).getTime();
const sec = (j: number, h: number, m = 0) => Math.floor(new Date(2026, 10, j, h, m).getTime() / 1000);

test("saisies et résumé reçus, rangés par jour, aujourd'hui et 7 jours", () => {
  const f = fichier();
  const q = demande({
    saisies: [
      { id: "a1", type: "eau", at: sec(20, 8) },
      { id: "a2", type: "eau", at: sec(20, 12) },
      { id: "a3", type: "humeur", at: sec(20, 13), valeur: 2 },
      { id: "a4", type: "humeur", at: sec(20, 20), valeur: 4 },
      { id: "a5", type: "seance", at: sec(20, 18) },
      { id: "b1", type: "eau", at: sec(18, 9) },
    ],
    resume: { at: sec(20, 20, 30), pas: 8421, distance: 6150, calories: 1890, coeur: 64 },
  }, MAINTENANT);
  assert.equal(q.ignorees, 0);
  assert.deepEqual(recevoir(f, q, MAINTENANT), { ok: true, recues: 6, doublons: 0, ignorees: 0 });
  const v = vue(lire(f), MAINTENANT);
  assert.equal(v.jours.length, 7);
  assert.equal(v.jours[0].date, "2026-11-14");
  assert.equal(v.aujourdhui.date, "2026-11-20");
  assert.deepEqual(v.aujourdhui, { date: "2026-11-20", eau: 2, seances: 1, humeurs: [2, 4], humeur: 4, pas: 8421, distance: 6150, calories: 1890, coeur: 64 });
  assert.equal(v.jours[4].eau, 1);
  assert.equal(v.jours[4].pas, null, "pas de résumé ce jour-là : rien d'inventé");
  assert.equal(v.derniereReception, MAINTENANT);
  assert.ok(fs.existsSync(f));
});

test("un envoi répété (réponse perdue) n'est pas compté deux fois ; le résumé le plus récent gagne", () => {
  const f = fichier();
  const corps = { saisies: [{ id: "x1", type: "eau", at: sec(20, 8) }], resume: { at: sec(20, 9), pas: 100 } };
  recevoir(f, demande(corps, MAINTENANT), MAINTENANT);
  assert.deepEqual(recevoir(f, demande(corps, MAINTENANT), MAINTENANT), { ok: true, recues: 0, doublons: 1, ignorees: 0 });
  recevoir(f, demande({ resume: { at: sec(20, 7), pas: 50 } }, MAINTENANT), MAINTENANT); // plus ancien : ignoré
  let j = vue(lire(f), MAINTENANT).aujourdhui;
  assert.equal(j.eau, 1);
  assert.equal(j.pas, 100);
  recevoir(f, demande({ resume: { at: sec(20, 19), pas: 9000, coeur: 999 } }, MAINTENANT), MAINTENANT);
  j = vue(lire(f), MAINTENANT).aujourdhui;
  assert.equal(j.pas, 9000);
  assert.equal(j.coeur, null, "valeur impossible : laissée vide");
  assert.ok(fs.existsSync(`${f}.bak`), "copie de la version précédente");
});

test("saisies mal formées ignorées, demande impossible refusée, envoi vide (test de connexion) sans écriture", () => {
  const q = demande({ saisies: [
    { id: "ok", type: "humeur", at: sec(20, 8), valeur: 5 },
    { id: "h", type: "humeur", at: sec(20, 8), valeur: 9 },
    { id: "t", type: "biere", at: sec(20, 8) },
    { id: "../x", type: "eau", at: sec(20, 8) },
    { id: "vieux", type: "eau", at: sec(20, 8) - 500 * 86_400 },
    { id: "ms", type: "eau", at: sec(20, 8) * 1000 },
  ] }, MAINTENANT);
  assert.equal(q.saisies.length, 1);
  assert.equal(q.ignorees, 5);
  assert.throws(() => demande({ saisies: "eau" }), ErreurMontre);
  assert.throws(() => demande({ saisies: Array.from({ length: 101 }, (_, i) => ({ id: `i${i}`, type: "eau", at: sec(20, 8) })) }), (e: ErreurMontre) => e.code === 413);
  const f = fichier();
  assert.deepEqual(recevoir(f, demande({}, MAINTENANT), MAINTENANT), { ok: true, recues: 0, doublons: 0, ignorees: 0 });
  assert.equal(fs.existsSync(f), false);
});

test("montre.json abîmé : la sauvegarde sert, sinon erreur et rien n'est écrasé", () => {
  const f = fichier();
  recevoir(f, demande({ saisies: [{ id: "a", type: "eau", at: sec(20, 8) }] }, MAINTENANT), MAINTENANT);
  recevoir(f, demande({ saisies: [{ id: "b", type: "eau", at: sec(20, 9) }] }, MAINTENANT), MAINTENANT);
  fs.writeFileSync(f, "{abîmé");
  assert.equal(vue(lire(f), MAINTENANT).aujourdhui.eau, 1);
  fs.writeFileSync(`${f}.bak`, "{abîmé");
  assert.throws(() => recevoir(f, demande({ saisies: [{ id: "c", type: "eau", at: sec(20, 10) }] }, MAINTENANT), MAINTENANT), (e: ErreurMontre) => e.code === 409);
  assert.equal(fs.readFileSync(f, "utf8"), "{abîmé");
});

test("les vieux jours sont retirés après 90 jours", () => {
  const f = fichier();
  recevoir(f, demande({ saisies: [{ id: "v", type: "eau", at: sec(20, 8) - 100 * 86_400 }, { id: "n", type: "eau", at: sec(20, 8) }] }, MAINTENANT), MAINTENANT);
  assert.deepEqual(lire(f).saisies.map((s) => s.id), ["n"]);
  assert.equal(dateLocale(new Date(2026, 0, 5, 23, 59).getTime()), "2026-01-05");
});

test("code montre : créé à part, différent du code principal, gardé", () => {
  const d = normaliserDonnees(null);
  assert.notEqual(d.codeMontre, d.code);
  assert.ok(codeValide(d.codeMontre, d.codeMontre));
  assert.equal(codeValide(d.codeMontre, d.code), false);
  assert.equal(normaliserDonnees(JSON.parse(JSON.stringify(d))).codeMontre, d.codeMontre);
  const ancien = normaliserDonnees({ code: d.code }); // ancien fichier sans code montre
  assert.equal(ancien.code, d.code);
  assert.ok(ancien.codeMontre.length >= 20);
});
