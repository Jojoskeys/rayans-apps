process.env.TZ = "Europe/Paris";
import { test } from "node:test";
import assert from "node:assert/strict";
import { lireComptes, lireFlux, videosEnLigne, type Compte } from "../src/videos.ts";
import { DEFAULT_PREFS, EMPTY_STATE, plan } from "../src/plan.ts";

const flux = `<?xml version="1.0"?><feed><title>Chaîne</title><published>2026-11-01T00:00:00+00:00</published>
 <entry><yt:videoId>abc_DEF-123</yt:videoId><title>L&#39;armée des éléphants &amp; la Kaaba</title><published>2026-11-19T09:10:15+00:00</published></entry>
 <entry><yt:videoId>vieille0001</yt:videoId><title>Ancienne</title><published>2026-11-17T04:11:40+00:00</published></entry>
</feed>`;
const compte: Compte = { nom: "Ayati", youtube: "UC" + "x".repeat(22), tiktok: "@mon.compte", instagram: "mon.compte" };
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime();

test("flux YouTube : identifiant, titre (entités décodées) et date", () => {
  const v = lireFlux(flux);
  assert.equal(v.length, 2);
  assert.deepEqual(v[0], { id: "abc_DEF-123", titre: "L'armée des éléphants & la Kaaba", publiee: Date.UTC(2026, 10, 19, 9, 10, 15) });
});

test("nouvelle vidéo : une notification avec le lien YouTube puis les comptes TikTok et Instagram", () => {
  const n = videosEnLigne(compte, lireFlux(flux), at(19, 10, 25));
  assert.equal(n.length, 1); // l'ancienne (plus de 12 h) est ignorée
  assert.equal(n[0].key, "video|2026-11-19|abc_DEF-123");
  assert.equal(n[0].m.title, "🎉 Nouvelle vidéo Ayati en ligne");
  assert.match(n[0].m.body, /« L'armée des éléphants & la Kaaba »/);
  const q = new URL(n[0].m.url, "https://exemple.fr/").searchParams;
  assert.equal(q.get("en-ligne"), "L'armée des éléphants & la Kaaba");
  assert.deepEqual(q.getAll("l"), ["youtube~https://www.youtube.com/shorts/abc_DEF-123", "tiktok~https://www.tiktok.com/@mon.compte", "instagram~https://www.instagram.com/mon.compte/"]);
  assert.equal(videosEnLigne({ ...compte, nom: "" }, lireFlux(flux), at(19, 10, 25))[0].m.title, "🎉 Nouvelle vidéo en ligne");
});

test("le veilleur ne l'envoie qu'une fois, et pas si le réglage est coupé", () => {
  const videos = videosEnLigne(compte, lireFlux(flux), at(19, 10, 25));
  const prefs = { ...DEFAULT_PREFS, matin: false };
  const a = plan({ now: at(19, 10, 25), prefs, state: EMPTY_STATE, newChanges: [], videos });
  assert.equal(a.messages.length, 1);
  assert.equal(plan({ now: at(19, 10, 45), prefs, state: a.state, newChanges: [], videos }).messages.length, 0);
  assert.equal(plan({ now: at(19, 10, 25), prefs: { ...prefs, videos: false }, state: EMPTY_STATE, newChanges: [], videos }).messages.length, 0);
});

test("secret des comptes : JSON, chaîne « UC… » obligatoire", () => {
  assert.deepEqual(lireComptes(JSON.stringify([compte, { nom: "Faux", youtube: "pas-une-chaine" }])), [compte]);
  assert.deepEqual(lireComptes("n'importe quoi"), []);
});
