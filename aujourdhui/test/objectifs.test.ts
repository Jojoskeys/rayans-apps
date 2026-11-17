import { test } from "node:test";
import assert from "node:assert/strict";
import { avancement, candidats, changer, choisir, cocher, journee, mediane, nettoyerObjectifs, notificationsDues, OBJECTIFS_VIDES, preparer, reglerObjectifs, serie, type Mesures, type ObjectifsData } from "../src/core/objectifs.ts";

// Mardi 17 novembre 2026.
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime();
const semaine = (valeurs: number[]) => Object.fromEntries(valeurs.map((v, i) => [`2026-11-${String(10 + i).padStart(2, "0")}`, v]));
// Habitudes : 20 cartes, 40 min de Chrono, 90 min de jeux, dernière activité vers 0 h 30.
const habitudes = (): Mesures => ({
  revisionCartes: semaine([20, 20, 0, 20, 18, 22, 20]),
  revisionRestantes: 60,
  chronoMin: semaine([40, 40, 40, 30, 50, 40, 40]),
  jeuxMin: semaine([90, 90, 100, 80, 90, 90, 90]),
  coucherMin: semaine([1470, 1470, 1470, 1470, 1470, 1470, 1470]),
});

test("journée de 4 h à 4 h et médiane des 7 jours précédents", () => {
  assert.equal(journee(at(17, 3, 59)), "2026-11-16");
  assert.equal(journee(at(17, 4)), "2026-11-17");
  assert.equal(mediane(semaine([1, 2, 3, 100, 5, 6, 7]), "2026-11-17"), 5);
  assert.equal(mediane(semaine([0, 0, 10, 20, 0, 0, 30]), "2026-11-17", true), 20);
  assert.equal(mediane(undefined, "2026-11-17"), null);
});

test("cibles un peu au-dessus de l'habitude, plus douces après un échec", () => {
  const c = candidats(OBJECTIFS_VIDES, habitudes(), "2026-11-17");
  const par = (id: string) => c.find((x) => x.id === id)!;
  assert.equal(par("revision").mesure!.cible, 22); // médiane 20 (zéros ignorés) × 1,1
  assert.equal(par("chrono").mesure!.cible, 45); // 40 × 1,1 arrondi à 5
  assert.equal(par("jeux").mesure!.cible, 80); // 90 × 0,9
  assert.equal(par("coucher").mesure!.cible, 1455); // 0 h 30 − 15 min
  assert.match(par("coucher").titre, /0 h 15/);
  // Hier : révision manquée → cible réduite ; marche manquée → version facile.
  const hier: ObjectifsData = { ...OBJECTIFS_VIDES, jours: { "2026-11-16": [
    { ...par("revision"), fait: false, resultat: "manque" },
    { id: "marche", domaine: "sante", titre: "Marcher 15 minutes", detail: "", mesure: null, facile: false, fait: false, resultat: "manque" },
  ] } };
  const c2 = candidats(hier, habitudes(), "2026-11-17");
  assert.equal(c2.find((x) => x.id === "revision")!.mesure!.cible, 16); // 20 × 0,8
  assert.equal(c2.find((x) => x.id === "marche")!.titre, "Marcher 10 minutes");
});

test("pas d'objectif inutile", () => {
  const m = habitudes();
  m.jeuxMin = semaine([10, 0, 20, 0, 5, 0, 0]); // déjà peu de jeux
  m.coucherMin = semaine([1350, 1380, 1350, 1360, 1370, 1350, 1360]); // couché avant 23 h 30
  m.revisionRestantes = 4; // seulement 4 cartes possibles aujourd'hui
  const c = candidats(OBJECTIFS_VIDES, m, "2026-11-17");
  assert.ok(!c.some((x) => x.id === "jeux" || x.id === "coucher"));
  assert.equal(c.find((x) => x.id === "revision")!.mesure!.cible, 4);
  // Sans données Hifz, pas d'objectif Hifz.
  assert.ok(!c.some((x) => x.id === "hifz"));
  assert.ok(candidats(OBJECTIFS_VIDES, { ...m, hifzRestantes: 2 }, "2026-11-17").some((x) => x.id === "hifz"));
});

test("3 objectifs de domaines différents, stables dans la journée, qui changent d'un jour à l'autre", () => {
  const a = choisir(OBJECTIFS_VIDES, habitudes(), "2026-11-17");
  assert.equal(a.length, 3);
  assert.equal(new Set(a.map((o) => o.domaine)).size, 3);
  assert.deepEqual(choisir(OBJECTIFS_VIDES, habitudes(), "2026-11-17"), a);
  const jours = ["2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21"].map((j) => choisir(OBJECTIFS_VIDES, habitudes(), j).map((o) => o.id).join());
  assert.ok(new Set(jours).size > 1);
  // Un seul domaine choisi : 3 objectifs de ce domaine.
  const sante = reglerObjectifs(OBJECTIFS_VIDES, { domaines: ["sante"] });
  assert.ok(choisir(sante, habitudes(), "2026-11-17").every((o) => o.domaine === "sante"));
  assert.throws(() => reglerObjectifs(OBJECTIFS_VIDES, { domaines: [] }));
});

test("avancement mesuré : cartes, jeux, coucher", () => {
  const m = habitudes();
  const c = candidats(OBJECTIFS_VIDES, m, "2026-11-17");
  const o = (id: string) => ({ ...c.find((x) => x.id === id)!, fait: false });
  m.revisionCartes!["2026-11-17"] = 10;
  assert.deepEqual(avancement(o("revision"), m, "2026-11-17", false), { valeur: 10, etat: "en-cours", texte: "10 / 22 cartes" });
  m.revisionCartes!["2026-11-17"] = 25;
  assert.equal(avancement(o("revision"), m, "2026-11-17", false).etat, "atteint");
  m.jeuxMin!["2026-11-17"] = 50;
  assert.equal(avancement(o("jeux"), m, "2026-11-17", false).etat, "en-cours");
  assert.equal(avancement(o("jeux"), m, "2026-11-17", true).etat, "atteint");
  m.jeuxMin!["2026-11-17"] = 95;
  assert.equal(avancement(o("jeux"), m, "2026-11-17", false).etat, "manque");
  m.coucherMin!["2026-11-17"] = 1440; // minuit pile
  assert.equal(avancement(o("coucher"), m, "2026-11-17", true).etat, "atteint");
  m.coucherMin!["2026-11-17"] = 1500; // 1 h
  assert.equal(avancement(o("coucher"), m, "2026-11-17", true).etat, "manque");
});

test("préparer, cocher, changer, résultats et série", () => {
  const m: Mesures = {};
  let d = reglerObjectifs(OBJECTIFS_VIDES, { domaines: ["sante", "foi"], nombre: 2 });
  d = preparer(d, m, at(16, 9));
  for (const o of d.jours["2026-11-16"]) d = cocher(d, o.id, at(16, 20));
  d = preparer(d, m, at(17, 9));
  assert.ok(d.jours["2026-11-16"].every((o) => o.resultat === "atteint"));
  assert.equal(d.jours["2026-11-17"].length, 2);
  assert.equal(serie(d, m, at(17, 9)), 1);
  const premier = d.jours["2026-11-17"][0];
  const change = changer(d, m, premier.id, at(17, 10));
  assert.notEqual(change.jours["2026-11-17"][0].id, premier.id);
  assert.equal(change.jours["2026-11-17"][0].domaine, premier.domaine);
  for (const o of d.jours["2026-11-17"]) d = cocher(d, o.id, at(17, 21));
  assert.equal(serie(d, m, at(17, 21)), 2);
  // Données relues depuis le fichier.
  assert.deepEqual(nettoyerObjectifs(JSON.parse(JSON.stringify(d))), d);
  // Jour suivant sans rien cocher : la série retombe à 0 le surlendemain.
  d = preparer(d, m, at(18, 9));
  d = preparer(d, m, at(19, 9));
  assert.equal(serie(d, m, at(19, 9)), 0);
});

test("notifications du matin et du soir, une fois chacune", () => {
  let d = preparer(OBJECTIFS_VIDES, {}, at(17, 7));
  assert.equal(notificationsDues(d, {}, at(17, 7, 30), 19, 0).messages.length, 0);
  const matin = notificationsDues(d, {}, at(17, 8, 5), 19, 0);
  assert.equal(matin.messages[0].titre, "Tes objectifs du jour");
  d = matin.data;
  assert.equal(notificationsDues(d, {}, at(17, 9), 19, 0).messages.length, 0);
  const soir = notificationsDues(d, {}, at(17, 19, 2), 19, 0);
  assert.match(soir.messages[0].titre, /Encore 3 objectifs/);
  assert.equal(notificationsDues(soir.data, {}, at(17, 20), 19, 0).messages.length, 0);
});
