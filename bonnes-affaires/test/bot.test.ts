import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Reglages } from "../src/types.ts";
import { lireFluxDealabs, type BonPlan } from "../src/dealabs.ts";
import { carteBonPlan, DejaVus, estDingue, motifBonPlan } from "../src/bot.ts";
import { flammes, grandePhoto, styleDe } from "../src/style.ts";
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

test("bot : carte Discord d'un bon plan, au style de la boutique", () => {
  const [a] = lireFluxDealabs(FLUX);
  const c = carteBonPlan(a, "Switch OLED");
  assert.equal(c.url, "https://www.dealabs.com/bons-plans/a-1");
  assert.equal(c.author?.name, "🟠  AMAZON");
  assert.equal(c.color, 0xff9900);
  const valeurs = Object.fromEntries((c.fields ?? []).map((f) => [f.name, f.value]));
  assert.match(valeurs["💶 Prix"], /1\s199,99 €/);
  assert.match(valeurs["🏷️ Avant"], /~~2\s399,98 €~~/);
  assert.equal(valeurs["📉 Réduction"], "**−50 %**");
  assert.equal(valeurs["🗳️ Votes"], "🔥🔥 512°");
  assert.match(c.description!, /Ma recherche · \*\*Switch OLED/);
  assert.equal(c.image?.url, "https://exemple.invalid/a.jpg");
  const d = carteBonPlan(a, "grosse promo", true);
  assert.match(d.title, /^🚨 /);
  assert.match(d.description!, /DINGUERIE/);
  assert.equal(carteBonPlan(plan("x".repeat(400)), "grosse promo").title.length, 256);
});

test("style : boutiques reconnues, inconnues, flammes et grande photo", () => {
  assert.equal(styleDe("Privé by Zalando").nom, "Privé by Zalando");
  assert.equal(styleDe("Amazon.fr").nom, "Amazon");
  assert.equal(styleDe("Cdiscount").emoji, "🔵");
  assert.equal(styleDe("Boutique du coin").nom, "Boutique du coin");
  assert.equal(styleDe(undefined).nom, "Bon plan");
  assert.equal(flammes(1200), "🔥🔥🔥 1200°");
  assert.equal(flammes(-5), "🧊 -5°");
  assert.equal(grandePhoto("https://x.invalid/re/150x150/qt/55/a.jpg"), "https://x.invalid/re/768x768/qt/55/a.jpg");
});

test("bot : dinguerie = 1000° ou −70 % déjà validé, et toujours envoyée", () => {
  const r = reglages({ discord: { webhook: "", grossesPromos: false } });
  assert.equal(estDingue(plan("Aspirateur", { degres: 1000 }), r), true);
  assert.equal(estDingue(plan("Aspirateur", { degres: 150, reduction: 0.75 }), r), true);
  assert.equal(estDingue(plan("Aspirateur", { degres: 20, reduction: 0.9 }), r), false, "pas encore validée");
  assert.equal(estDingue(plan("Aspirateur", { degres: 999 }), r), false);
  assert.equal(motifBonPlan(plan("Aspirateur", { degres: 1500 }), r), "grosse promo", "même sans les grosses promos");
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
  const envois: { embeds: Carte[]; allowed_mentions: { parse: string[] } }[] = [];
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
  await envoyerDiscord("https://discord.com/api/webhooks/1/a", cartes, "@everyone dans un texte", faux);
  assert.deepEqual(envois.map((e) => e.embeds.length), [10, 2]);
  assert.deepEqual(envois.map((e) => e.allowed_mentions.parse), [[], []], "pas de tag sans le demander");
  await envoyerDiscord("https://discord.com/api/webhooks/1/a", [cartes[0]], "@everyone 🚨", faux, true);
  assert.deepEqual(envois.at(-1)!.allowed_mentions.parse, ["everyone"]);
});
