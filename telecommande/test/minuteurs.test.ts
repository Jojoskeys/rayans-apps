import { test } from "node:test";
import assert from "node:assert/strict";
import { abonnementValide, annuler, echus, ErreurRappel, normaliserRappels, programmer } from "../src/core/minuteurs.ts";

const ab = (n = 1) => ({ endpoint: `https://web.push.apple.com/QAbc${n}`, keys: { p256dh: "BAbcdefghijklmnop_-", auth: "abcdefghijkl" } });

test("minuteurs : programmer remplace le rappel du même appareil", () => {
  let l = programmer([], { abonnement: ab(1), dansMs: 25 * 60_000, titre: "Travail terminé" }, 1000);
  l = programmer(l, { abonnement: ab(2), dansMs: 5000 }, 1000);
  l = programmer(l, { abonnement: ab(1), dansMs: 60_000 }, 2000);
  assert.equal(l.length, 2);
  const r1 = l.find((r) => r.abonnement.endpoint === ab(1).endpoint)!;
  assert.equal(r1.fin, 62_000);
  assert.equal(r1.titre, "Rayan's Chrono");
  assert.equal(annuler(l, ab(2).endpoint).length, 1);
});

test("minuteurs : seuls les services de notification connus sont acceptés", () => {
  assert.throws(() => abonnementValide({ ...ab(), endpoint: "https://exemple.com/x" }), ErreurRappel);
  assert.throws(() => abonnementValide({ ...ab(), endpoint: "http://web.push.apple.com/x" }), ErreurRappel);
  assert.throws(() => abonnementValide({ ...ab(), endpoint: "https://web.push.apple.com.pirate.fr/x" }), ErreurRappel);
  assert.throws(() => abonnementValide({ endpoint: ab().endpoint, keys: { p256dh: "x", auth: "y" } }), ErreurRappel);
  assert.equal(abonnementValide({ ...ab(), endpoint: "https://fcm.googleapis.com/fcm/send/abc" }).endpoint, "https://fcm.googleapis.com/fcm/send/abc");
});

test("minuteurs : durée refusée si négative, absente ou plus de 24 h", () => {
  for (const dansMs of [-1, "abc", undefined, 25 * 3600_000]) assert.throws(() => programmer([], { abonnement: ab(), dansMs }, 0), ErreurRappel);
});

test("minuteurs : échéances, et rappels trop anciens abandonnés (PC éteint)", () => {
  const l = [
    ...programmer([], { abonnement: ab(1), dansMs: 1000 }, 0),
    ...programmer([], { abonnement: ab(2), dansMs: 5000 }, 0),
    ...programmer([], { abonnement: ab(3), dansMs: 0 }, -20 * 60_000),
  ];
  const { aEnvoyer, restants } = echus(l, 2000);
  assert.deepEqual(aEnvoyer.map((r) => r.abonnement.endpoint), [ab(1).endpoint]);
  assert.deepEqual(restants.map((r) => r.abonnement.endpoint), [ab(2).endpoint]);
});

test("minuteurs : relecture du fichier, entrées abîmées ignorées", () => {
  const l = programmer([], { abonnement: ab(), dansMs: 1000 }, 0);
  assert.deepEqual(normaliserRappels(JSON.parse(JSON.stringify([...l, { fin: 3 }, null]))), l);
  assert.deepEqual(normaliserRappels("x"), []);
});
