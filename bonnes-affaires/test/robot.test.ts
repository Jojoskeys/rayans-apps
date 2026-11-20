import { test } from "node:test";
import assert from "node:assert/strict";
import type { Annonce, Recherche } from "../src/types.ts";
import { Blocage, chercherLeboncoin, chercherVinted, dureePause, estLaNuit, lireLeboncoin, lireVinted, passageRobot, type EtatRobot } from "../src/robot.ts";

const r: Recherche = { nom: "Switch OLED", mots: "switch oled", categorie: "electronique" };

// Morceau de page Vinted : les données sont intégrées à la page, guillemets échappés.
const item = (id: number, titre: string, prix: string, total: string) =>
  `\\"productItem\\":{\\"id\\":${id},\\"title\\":\\"${titre}\\",\\"url\\":\\"/items/${id}-x\\",\\"price\\":{\\"amount\\":\\"${prix}\\",\\"currencyCode\\":\\"EUR\\"},\\"totalItemPrice\\":{\\"amount\\":\\"${total}\\",\\"currencyCode\\":\\"EUR\\"},\\"thumbnailUrl\\":\\"https://images1.vinted.net/t/a/310x430/p.webp\\",\\"photos\\":[{\\"url\\":\\"https://images1.vinted.net/t/a/f800/p.webp\\"}],\\"itemBox\\":{\\"firstLine\\":\\"Nintendo\\",\\"secondLine\\":\\"Tr\\u00e8s bon \\u00e9tat\\"}}`;
const PAGE_VINTED = `<html>catalog ${item(1, "Switch OLED blanche", "150.00", "158.20")} ${item(1, "Switch OLED blanche", "150.00", "158.20")} ${item(2, "Switch OLED rouge", "0.00", "0.00")}</html>`;

const PAGE_LBC = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
  props: { pageProps: { searchData: { ads: [
    { list_id: 9, subject: "Switch OLED", price: [180], url: "https://www.leboncoin.fr/ad/consoles/9", ad_type: "offer",
      location: { zipcode: "35000", city: "Rennes", lat: 48.1, lng: -1.68 }, images: { urls: ["https://img.leboncoin.fr/a.jpg"] },
      attributes: [{ key: "condition", value: "tresbonetat", value_label: "Très bon état" }, { key: "shipping_type", value: "face_to_face" }] },
    { list_id: 10, subject: "Cherche Switch OLED", price: [100], url: "https://www.leboncoin.fr/ad/consoles/10", ad_type: "demand" },
  ] } } },
})}</script></html>`;

test("Vinted : annonces lues (prix protection comprise, état, grande photo), doublons et prix nuls écartés", () => {
  const a = lireVinted(PAGE_VINTED, r);
  assert.equal(a.length, 1);
  assert.equal(a[0].titre, "Switch OLED blanche");
  assert.equal(a[0].prix, 158.2);
  assert.equal(a[0].lien, "https://www.vinted.fr/items/1-x");
  assert.equal(a[0].etat, "Très bon état");
  assert.equal(a[0].photo, "https://images1.vinted.net/t/a/f800/p.webp");
  assert.equal(a[0].livrable, true);
});

test("Leboncoin : offres lues avec lieu et état, demandes écartées", () => {
  const a = lireLeboncoin(PAGE_LBC, r);
  assert.equal(a.length, 1);
  assert.equal(a[0].prix, 180);
  assert.equal(a[0].codePostal, "35000");
  assert.equal(a[0].lat, 48.1);
  assert.equal(a[0].livrable, false);
  assert.equal(a[0].etat, "Très bon état");
  assert.throws(() => lireLeboncoin("<html>rien</html>", r), Blocage);
});

const reponse = (corps: string, status = 200) => (async () => new Response(corps, { status })) as typeof fetch;

test("robot : une page de vérification ou un refus devient un blocage, jamais contourné", async () => {
  await assert.rejects(chercherVinted(r, reponse("<script src='https://geo.captcha-delivery.com/c.js'>", 200)), Blocage);
  await assert.rejects(chercherVinted(r, reponse("", 429)), Blocage);
  await assert.rejects(chercherLeboncoin(r, reponse("x", 403)), Blocage);
  // Le simple script Cloudflare d'une page normale ne compte pas comme une vérification.
  const normale = `<script src="/cdn-cgi/challenge-platform/x.js"></script>${PAGE_VINTED}`;
  assert.equal((await chercherVinted(r, reponse(normale))).length, 1);
});

test("robot : pauses de plus en plus longues, nuit", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => dureePause(n) / 3600000), [6, 12, 24, 48, 48]);
  const a = (h: number) => new Date(2026, 10, 20, h, 30);
  assert.equal(estLaNuit(a(3), 1, 7), true);
  assert.equal(estLaNuit(a(7), 1, 7), false);
  assert.equal(estLaNuit(a(0), 23, 6), true);
  assert.equal(estLaNuit(a(12), 23, 6), false);
});

test("robot : une recherche par site et par passage, à tour de rôle ; pause après blocage puis reprise", async () => {
  const recherches: Recherche[] = ["a", "b", "c"].map((nom) => ({ nom, mots: nom, categorie: "autre" }));
  const demandees: string[] = [];
  let bloque = false;
  const annonce = (x: Recherche): Annonce => ({ site: "Vinted", titre: x.mots, prix: 10, port: null, lien: x.nom, livrable: true, remiseEnMain: false });
  const chercheurs = {
    Vinted: async (x: Recherche) => {
      demandees.push(x.nom);
      if (bloque) throw new Blocage("Vinted demande une vérification (403)");
      return [annonce(x)];
    },
  };
  const etat: EtatRobot = { sites: {}, amorces: [] };
  const midi = new Date(2026, 10, 20, 12, 0);
  const o = { sites: ["Vinted" as const], nuitDebut: 1, nuitFin: 7, chercheurs };

  let res = await passageRobot(recherches, etat, { ...o, maintenant: midi });
  assert.deepEqual(res.lues, ["Vinted|a"]);
  await passageRobot(recherches, etat, { ...o, maintenant: midi });
  assert.deepEqual(demandees, ["a", "b"]);

  bloque = true;
  res = await passageRobot(recherches, etat, { ...o, maintenant: midi });
  assert.match(res.messages[0], /pause 6 h/);
  // Pendant la pause : aucune requête.
  await passageRobot(recherches, etat, { ...o, maintenant: new Date(midi.getTime() + 3600000) });
  assert.equal(demandees.length, 3);

  bloque = false;
  res = await passageRobot(recherches, etat, { ...o, maintenant: new Date(midi.getTime() + 7 * 3600000) });
  assert.match(res.messages[0], /reprend/);
  assert.equal(etat.sites.Vinted?.blocages, 0);

  // La nuit : rien.
  const avant = demandees.length;
  await passageRobot(recherches, etat, { ...o, maintenant: new Date(2026, 10, 21, 3, 0) });
  assert.equal(demandees.length, avant);
});

test("robot : plusieurs recherches par passage, arrêt du site dès un blocage", async () => {
  const recherches: Recherche[] = ["a", "b", "c"].map((nom) => ({ nom, mots: nom, categorie: "autre" }));
  const demandees: string[] = [];
  const chercheurs = {
    Vinted: async (x: Recherche) => {
      demandees.push(x.nom);
      if (x.nom === "c") throw new Blocage("Vinted demande une vérification (403)");
      return [];
    },
  };
  const etat: EtatRobot = { sites: {}, amorces: [] };
  const o = { sites: ["Vinted" as const], nuitDebut: 1, nuitFin: 7, parPassage: 2, ecartMs: 0, chercheurs, maintenant: new Date(2026, 10, 20, 12, 0) };
  const res = await passageRobot(recherches, etat, o);
  assert.deepEqual(res.lues, ["Vinted|a", "Vinted|b"]);
  await passageRobot(recherches, etat, o);
  assert.deepEqual(demandees, ["a", "b", "c"], "après le blocage sur c, plus aucune page");
  assert.ok(etat.sites.Vinted?.pauseJusqua);
});
