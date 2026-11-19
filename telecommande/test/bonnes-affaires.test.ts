import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { https, lire, MAX_PAR_PASSAGE, messages, nouvellesPepites, type Classement, type OffreTuile } from "../src/core/bonnes-affaires.ts";

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
    livrable: false, port: null, surete: "sûr", raisons: ["+ près"], choix: true, pepite: true, loin: false };
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

const offre = (n: number, pepite: boolean, autre: Partial<OffreTuile> = {}): OffreTuile => ({
  titre: `Switch ${n}`, site: "Leboncoin", recherche: "Switch", lien: `https://x.invalid/${n}`, photo: null, total: 120, prixHabituel: 220,
  ecartPct: 0.45, gainRevente: 70, distanceKm: 12, procheDe: "Ville A", dansZone: true, livrable: false, port: null,
  surete: "sûr", raisons: [], choix: true, pepite, loin: false, ...autre,
});

test("pépites : chacune n'est signalée qu'une fois, jamais pour la démo", () => {
  const c: Classement = { majLe: 1, demo: false, offres: [offre(1, true), offre(2, false), offre(3, true)] };
  const a = nouvellesPepites(c, []);
  assert.deepEqual(a.nouvelles.map((o) => o.titre), ["Switch 1", "Switch 3"]);
  assert.equal(nouvellesPepites(c, a.deja).nouvelles.length, 0);
  assert.equal(nouvellesPepites({ ...c, demo: true }, []).nouvelles.length, 0);
});

test("pépites : une notification chacune, ou un résumé s'il y en a beaucoup", () => {
  const [m] = messages([offre(1, true, { loin: true, distanceKm: 80, dansZone: false })]);
  assert.match(m.titre, /💎 Switch 1/);
  assert.match(m.texte, /120 € au lieu de ~220 € \(−45 %\)/);
  assert.match(m.texte, /80 km de Ville A \(plus loin/);
  const beaucoup = messages(Array.from({ length: MAX_PAR_PASSAGE + 2 }, (_, i) => offre(i, true)));
  assert.equal(beaucoup.length, 1);
  assert.match(beaucoup[0].titre, /5 nouvelles pépites/);
});
