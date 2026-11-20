import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Reglages } from "../src/types.ts";
import { lireFluxDealabs, type BonPlan } from "../src/dealabs.ts";
import { carteBonPlan, DejaVus, motifBonPlan } from "../src/bot.ts";
import { envoyerDiscord, estWebhookDiscord, type Carte } from "../src/discord.ts";

const FLUX = `<?xml version="1.0"?><rss><channel>
<item><category><![CDATA[High-Tech]]></category><pepper:merchant name="Amazon" price="1 199,99€"/>
<media:content medium="image" url="https://exemple.invalid/a.jpg"/>
<title><![CDATA[512° - Console Nintendo Switch OLED &amp; jeu]]></title>
<description><![CDATA[<p>Prix habituel : 2 399,98 €</p>]]></description>
<link>https://www.dealabs.com/bons-plans/a-1</link><pubDate>Fri, 20 Nov 2026 03:33:58 +0100</pubDate>
<guid>https://www.dealabs.com/bons-plans/a-1</guid></item>
<item><title><![CDATA[-25° - Coque iPhone]]></title><guid>https://www.dealabs.com/bons-plans/b-2</guid></item>
</channel></rss>`;

const reglages = (autre: Partial<Reglages> = {}): Reglages => ({
  domiciles: [], distanceMaxKm: 30, distancePepiteKm: 100, ecartPepite: 0.4, gainPepite: 30, ecartMin: 0.25, fraisRevente: 0.1, nombre: 10,
  recherches: [{ nom: "Switch OLED", mots: "switch oled", categorie: "electronique", exclure: ["lot"] }],
  ...autre,
});
const plan = (titre: string, autre: Partial<BonPlan> = {}): BonPlan => ({ site: "Dealabs", titre, lien: "https://exemple.invalid/" + titre, degres: 50, ...autre });

test("Dealabs : température, prix, prix habituel, marchand, photo", () => {
  const [a, b] = lireFluxDealabs(FLUX);
  assert.equal(a.titre, "Console Nintendo Switch OLED & jeu");
  assert.equal(a.degres, 512);
  assert.equal(a.prix, 1199.99);
  assert.equal(a.prixHabituel, 2399.98);
  assert.ok(Math.abs(a.reduction! - 0.5) < 0.001);
  assert.equal(a.marchand, "Amazon");
  assert.equal(a.photo, "https://exemple.invalid/a.jpg");
  assert.equal(a.date?.toISOString(), "2026-11-20T02:33:58.000Z");
  assert.equal(b.degres, -25);
  assert.equal(b.prix, undefined);
});

test("bot : ma recherche, grosse promo, ou rien", () => {
  const r = reglages();
  assert.equal(motifBonPlan(plan("Nintendo Switch OLED blanche"), r), "Switch OLED");
  assert.equal(motifBonPlan(plan("Nintendo Switch OLED", { degres: -10 }), r), undefined, "bon plan froid");
  assert.equal(motifBonPlan(plan("Lot de Switch OLED"), r), undefined, "mot exclu");
  assert.equal(motifBonPlan(plan("Aspirateur"), r), undefined);
  assert.equal(motifBonPlan(plan("Aspirateur", { degres: 300 }), r), "grosse promo");
  assert.equal(motifBonPlan(plan("Aspirateur", { reduction: 0.6 }), r), "grosse promo");
  assert.equal(motifBonPlan(plan("Aspirateur", { reduction: 0.3 }), r), undefined);
  assert.equal(motifBonPlan(plan("Aspirateur", { degres: 900 }), reglages({ discord: { webhook: "", grossesPromos: false } })), undefined);
  assert.equal(motifBonPlan(plan("Aspirateur", { degres: 150 }), reglages({ discord: { webhook: "", degresMin: 100 } })), "grosse promo");
});

test("bot : carte Discord d'un bon plan", () => {
  const [a] = lireFluxDealabs(FLUX);
  const c = carteBonPlan(a, "Switch OLED");
  assert.equal(c.url, "https://www.dealabs.com/bons-plans/a-1");
  assert.match(c.description!, /1\s199,99 €/);
  assert.match(c.description!, /−50 %/);
  assert.match(c.description!, /Ma recherche : Switch OLED/);
  assert.equal(carteBonPlan(plan("x".repeat(400)), "grosse promo").title.length, 256);
});

test("bot : déjà vus retenus et oubliés après 60 jours", () => {
  const fichier = join(mkdtempSync(join(tmpdir(), "bot-")), "vus.json");
  const v = new DejaVus(fichier);
  assert.equal(v.nouveau, true);
  const maintenant = Date.now();
  v.retenir("ancien", maintenant - 61 * 24 * 3600 * 1000);
  v.retenir("recent", maintenant);
  v.enregistrer(maintenant);
  const relu = new DejaVus(fichier);
  assert.equal(relu.nouveau, false);
  assert.equal(relu.a("recent"), true);
  assert.equal(relu.a("ancien"), false);
});

test("Discord : webhook reconnu, paquets de 10 cartes, attente si Discord freine", async () => {
  assert.ok(estWebhookDiscord("https://discord.com/api/webhooks/123/abc-DEF_9"));
  assert.ok(!estWebhookDiscord("https://exemple.invalid/api/webhooks/123/abc"));
  assert.ok(!estWebhookDiscord(""));
  const envois: { embeds: Carte[] }[] = [];
  let freine = true;
  const faux = (async (_url: string, init: RequestInit) => {
    if (freine) {
      freine = false;
      return new Response(JSON.stringify({ retry_after: 0.01 }), { status: 429 });
    }
    envois.push(JSON.parse(String(init.body)));
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  const cartes = Array.from({ length: 12 }, (_, i) => ({ title: `n°${i}` }));
  await envoyerDiscord("https://discord.com/api/webhooks/1/a", cartes, undefined, faux);
  assert.deepEqual(envois.map((e) => e.embeds.length), [10, 2]);
});
