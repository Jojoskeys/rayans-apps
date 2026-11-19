import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { https, lire } from "../src/core/bonnes-affaires.ts";

const dossier = () => fs.mkdtempSync(path.join(os.tmpdir(), "bonnes-affaires-"));

test("pas encore de classement : réponse vide, pas d'erreur", () => {
  assert.deepEqual(lire(dossier()), { majLe: null, demo: false, offres: [] });
});

test("seules les adresses https passent", () => {
  assert.equal(https("https://www.ebay.fr/itm/1"), "https://www.ebay.fr/itm/1");
  assert.equal(https("javascript:alert(1)"), null);
  assert.equal(https("http://exemple.invalid/"), null);
  assert.equal(https(12), null);
});

test("le classement est relu et nettoyé", () => {
  const d = dossier();
  const ok = { titre: "Ecran", site: "eBay", recherche: "Écran", lien: "https://www.ebay.fr/itm/1", photo: "https://i.ebayimg.com/a.jpg",
    total: 95, prixHabituel: 280, ecartPct: 0.66, gainRevente: 151, distanceKm: 18, procheDe: "Ville A", dansZone: true,
    livrable: false, port: null, surete: "sûr", raisons: ["+ près"], choix: true };
  fs.writeFileSync(path.join(d, "offres.json"), JSON.stringify({ majLe: 1, demo: true, offres: [
    ok,
    { ...ok, lien: "javascript:alert(1)" },        // lien dangereux : écarté
    { ...ok, lien: "https://x.invalid/2", total: "95" }, // prix illisible : écarté
    { ...ok, lien: "https://x.invalid/3", photo: "data:image/png;base64,AA", surete: "inconnu" },
  ] }));
  const r = lire(d);
  assert.equal(r.demo, true);
  assert.equal(r.offres.length, 2);
  assert.deepEqual(r.offres[0], ok);
  assert.equal(r.offres[1].photo, null);
  assert.equal(r.offres[1].surete, "à vérifier");
});

test("fichier abîmé : réponse vide", () => {
  const d = dossier();
  fs.writeFileSync(path.join(d, "offres.json"), "{pas du json");
  assert.equal(lire(d).offres.length, 0);
});
