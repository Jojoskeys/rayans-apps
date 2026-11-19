import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Annonce, Reglages } from "../src/types.ts";
import { classer } from "../src/classement.ts";
import { correspond, estExclue, lirePrix, mediane } from "../src/texte.ts";
import { lireCsv, versAnnonce } from "../src/import.ts";
import { chercherEbay } from "../src/ebay.ts";
import { calculerDistances, Geocodeur, kmEntre } from "../src/distance.ts";
import { pageHtml } from "../src/affichage.ts";

const base: Omit<Reglages, "recherches"> = { domiciles: [], distanceMaxKm: 30, ecartMin: 0.25, fraisRevente: 0.1, nombre: 10 };
let n = 0;
const annonce = (titre: string, prix: number, autre: Partial<Annonce> = {}): Annonce => ({
  site: "test", titre, prix, port: 5, lien: `https://exemple.invalid/${++n}`, livrable: true, remiseEnMain: false, ...autre,
});

test("texte : prix à la française, mots entiers, exclusions", () => {
  assert.equal(lirePrix("1 299,90 €"), 1299.9);
  assert.equal(lirePrix("45.5"), 45.5);
  assert.equal(lirePrix("gratuit"), null);
  assert.ok(correspond("Écran DELL 27\" 4K", "ecran 27 4k"));
  assert.ok(!correspond("Écran 24 pouces", "ecran 27"));
  assert.ok(estExclue("Switch OLED HS pour pièces"));
  assert.ok(!estExclue("Switch OLED chaussures")); // « hs » seulement en mot entier
  assert.ok(estExclue("Doudoune style North Face"));
  assert.equal(mediane([3, 1, 2]), 2);
  assert.equal(mediane([1, 2, 3, 4]), 2.5);
});

test("classement : prix du réglage, port compté, tri par écart", () => {
  const reglages: Reglages = { ...base, recherches: [{ nom: "Écran", mots: "ecran 4k", categorie: "electronique", prixHabituel: 200 }] };
  const offres = classer(
    [annonce("Ecran 4K A", 150), annonce("Ecran 4K B", 95), annonce("Ecran 4K C", 60, { port: null, livrable: false, remiseEnMain: true })],
    reglages,
  );
  // A : 155 € total = −22,5 %, sous le seuil → absent
  // C est moins cher mais son lieu est inconnu (« à vérifier ») : B passe devant
  assert.deepEqual(offres.map((o) => o.titre), ["Ecran 4K B", "Ecran 4K C"]);
  assert.equal(offres[0].total, 100);
  assert.equal(offres[0].ecart, 100);
  assert.equal(offres[0].gainRevente, 80); // 200 × 0,9 − 100
  assert.equal(offres[1].total, 60); // pas de port en main propre
});

test("classement : médiane si pas de prix habituel, et seulement avec assez d'annonces", () => {
  const r = { nom: "Nuptse", mots: "nuptse", categorie: "vetements" as const };
  const prix = [100, 110, 120, 130, 140, 50];
  const offres = classer(prix.map((p) => annonce(`Nuptse ${p}`, p, { port: 0 })), { ...base, recherches: [r] });
  assert.equal(offres.length, 1);
  assert.equal(offres[0].prixHabituel, 115);
  assert.match(offres[0].originePrix, /médiane de 6/);
  // 4 annonces seulement : pas de comparaison fiable
  assert.equal(classer(prix.slice(2).map((p) => annonce(`Nuptse ${p}`, p)), { ...base, recherches: [r] }).length, 0);
});

test("classement : main propre trop loin écartée, livrable gardée, doublons et prix très bas signalés", () => {
  const reglages: Reglages = { ...base, recherches: [{ nom: "Switch", mots: "switch", categorie: "electronique", prixHabituel: 250 }] };
  const loin = annonce("Switch loin", 100, { livrable: false, remiseEnMain: true, port: null, distanceKm: 80 });
  const livrable = annonce("Switch livrable", 100, { distanceKm: 500 });
  const louche = annonce("Switch louche", 20);
  const offres = classer([loin, livrable, { ...livrable }, louche], reglages);
  assert.deepEqual(offres.map((o) => o.titre).sort(), ["Switch livrable", "Switch louche"]);
  const l = offres.find((o) => o.titre === "Switch louche")!;
  assert.equal(l.surete, "méfiance");
  assert.equal(l.choix, false); // jamais mis en avant
  assert.equal(offres[0].titre, "Switch livrable"); // le prix suspect ne passe pas devant
});

test("import : CSV avec ; et guillemets, colonnes au choix", () => {
  const lignes = lireCsv('site;titre;prix;port;lien;codePostal\nVinted;"Veste ""Patagonia"" M";45,50;4,8;https://exemple.invalid/v;1000\n');
  const a = versAnnonce(lignes[0], "fichier");
  assert.equal(a?.titre, 'Veste "Patagonia" M');
  assert.equal(a?.prix, 45.5);
  assert.equal(a?.codePostal, "01000");
  assert.equal(a?.livrable, true);
  assert.equal(versAnnonce({ title: "x", price: 3, url: "u" }, "f")?.site, "f");
  assert.equal(versAnnonce({ titre: "sans prix", lien: "u" }, "f"), null);
});

test("eBay : la réponse de l'API devient des annonces", async () => {
  let demande: { url: string; headers: Record<string, string> } | undefined;
  const fauxFetch = (async (url: string, init: { headers: Record<string, string> }) => {
    demande = { url, headers: init.headers };
    return new Response(JSON.stringify({
      itemSummaries: [
        { title: "Ecran 4K", price: { value: "120.00", currency: "EUR" }, itemWebUrl: "https://www.ebay.fr/itm/1",
          condition: "Occasion", itemLocation: { postalCode: "69001", country: "FR" },
          shippingOptions: [{ shippingCostType: "FIXED", shippingCost: { value: "9.90", currency: "EUR" } }] },
        { title: "En dollars", price: { value: "1", currency: "USD" }, itemWebUrl: "https://www.ebay.fr/itm/2" },
      ],
    }));
  }) as unknown as typeof fetch;
  const r = { nom: "Écran", mots: "ecran 4k", categorie: "electronique" as const, prixMax: 200 };
  const res = await chercherEbay(r, "jeton", "75001", fauxFetch);
  assert.equal(res.length, 1);
  assert.deepEqual([res[0].prix, res[0].port, res[0].codePostal, res[0].livrable], [120, 9.9, "69001", true]);
  assert.equal(demande?.headers["X-EBAY-C-MARKETPLACE-ID"], "EBAY_FR");
  assert.match(decodeURIComponent(demande!.url), /itemLocationCountry:FR.*price:\[\.\.200\]/);
});

test("distance : calcul et codes postaux masqués", async () => {
  assert.ok(Math.abs(kmEntre({ lat: 48.8566, lon: 2.3522 }, { lat: 45.764, lon: 4.8357 }) - 392) < 5);
  const centres: Record<string, number[]> = { "75001": [2.34, 48.86], "69001": [4.83, 45.77] };
  const fauxFetch = (async (url: string) => {
    const cp = new URL(url).searchParams.get("codePostal")!;
    return new Response(JSON.stringify(centres[cp] ? [{ centre: { coordinates: centres[cp] } }] : []));
  }) as unknown as typeof fetch;
  const geo = new Geocodeur(join(mkdtempSync(join(tmpdir(), "ba-")), "cache.json"), fauxFetch);
  const liste = [annonce("a", 1, { codePostal: "69001" }), annonce("b", 1, { codePostal: "75***" }), annonce("c", 1, { codePostal: "75001" })];
  await calculerDistances(liste, [{ nom: "Paris", codePostal: "75001" }, { nom: "Lyon", codePostal: "69001" }], geo);
  assert.deepEqual([liste[0].distanceKm, liste[0].procheDe], [0, "Lyon"]); // le départ le plus proche
  assert.equal(liste[1].distanceKm, null);
  assert.deepEqual([liste[2].distanceKm, liste[2].procheDe], [0, "Paris"]);
});

test("page HTML : textes des annonces échappés", () => {
  const reglages: Reglages = { ...base, recherches: [{ nom: "X", mots: "ecran", categorie: "electronique", prixHabituel: 100 }] };
  const html = pageHtml(classer([annonce("Ecran <script>", 10, { port: 0 })], reglages), new Date());
  assert.ok(html.includes("Ecran &lt;script&gt;"));
  assert.ok(!html.includes("Ecran <script>"));
});

test("analyse : zone de retrait, protection, vendeur, mes choix", () => {
  const reglages: Reglages = { ...base, recherches: [{ nom: "Écran", mots: "ecran", categorie: "electronique", prixHabituel: 300 }] };
  const offres = classer(
    [
      annonce("Ecran proche", 120, { livrable: false, remiseEnMain: true, port: null, distanceKm: 12, procheDe: "Ville A", photo: "https://exemple.invalid/p.jpg" }),
      annonce("Ecran eBay", 150, { site: "eBay", distanceKm: 400, vendeur: { notePct: 99.5, avis: 300 } }),
      annonce("Ecran vendeur douteux", 150, { site: "eBay", distanceKm: 400, vendeur: { notePct: 80, avis: 40 } }),
      annonce("Ecran Facebook loin", 150, { site: "Facebook", distanceKm: 400 }),
      annonce("Ecran sans lieu", 150, { livrable: false, remiseEnMain: true, port: null }),
    ],
    reglages,
  );
  const par = (t: string) => offres.find((o) => o.titre === t)!;
  assert.equal(offres[0].titre, "Ecran proche"); // dans la zone : passe devant
  assert.equal(par("Ecran proche").surete, "sûr");
  assert.equal(par("Ecran proche").total, 120);
  assert.ok(par("Ecran proche").raisons.some((r) => r.includes("12 km de Ville A")));
  assert.equal(par("Ecran eBay").surete, "sûr");
  assert.ok(par("Ecran eBay").raisons.some((r) => r.includes("Garantie client eBay")));
  assert.equal(par("Ecran vendeur douteux").surete, "méfiance");
  assert.equal(par("Ecran Facebook loin").surete, "méfiance");
  assert.equal(par("Ecran sans lieu").surete, "à vérifier");
  assert.deepEqual(offres.filter((o) => o.choix).map((o) => o.titre).sort(), ["Ecran eBay", "Ecran proche", "Ecran sans lieu"]);
  const html = pageHtml(offres, new Date());
  assert.ok(html.includes('src="https://exemple.invalid/p.jpg"'));
  assert.ok(html.includes("Mes choix"));
});

test("photo : eBay et import, seulement en https", () => {
  assert.equal(versAnnonce({ titre: "a", prix: 1, lien: "u", image: "https://x.invalid/a.jpg" }, "f")?.photo, "https://x.invalid/a.jpg");
  assert.equal(versAnnonce({ titre: "a", prix: 1, lien: "u", photo: "javascript:alert(1)" }, "f")?.photo, undefined);
});
