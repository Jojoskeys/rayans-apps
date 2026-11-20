process.env.TZ = "Europe/Paris";
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyserReponse, construirePrompt, editionSimple, lireRss, motsCles, recents, recopie, regrouper, SYSTEME, type Article } from "../src/actu.ts";
import { DEFAULT_PREFS, EMPTY_STATE, plan } from "../src/plan.ts";

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime();

const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Le média</title>
 <item><title><![CDATA[Sommet de Berlin : les alliés de l'Ukraine promettent leur aide]]></title><pubDate>Fri, 20 Nov 2026 05:30:15 +0100</pubDate>
  <description><![CDATA[<p>Les membres de la coalition se sont engagés à <b>maintenir</b> leur soutien.</p>]]></description>
  <guid isPermaLink="true">https://exemple.fr/a1</guid><link>https://exemple.fr/a1</link></item>
 <item><title>Le pr&#xE9;sident Bukele candidat &#224; un troisi&#xE8;me mandat</title><description>Un changement de la Constitution l'an pass&#xE9;.</description>
  <pubDate>Fri, 20 Nov 2026 07:49:49 +0100</pubDate><link>https://exemple.fr/a2#xtor=RSS</link></item>
 <item><title>Article d'avant-hier</title><pubDate>Wed, 18 Nov 2026 07:00:00 +0100</pubDate><link>https://exemple.fr/vieux</link></item>
 <item><title>Sans lien</title><pubDate>Fri, 20 Nov 2026 07:00:00 +0100</pubDate></item>
</channel></rss>`;

const art = (media: string, titre: string, h: number, lien = `https://${media.replace(/\W/g, "")}.exemple/${encodeURIComponent(titre)}`, chapo = ""): Article => ({ media, titre, chapo, lien, publie: at(20, h) });

test("RSS : titre (CDATA, entités en chiffres), chapô sans balises, lien, date ; entrées sans lien ignorées", () => {
  const a = lireRss(rss, "Le Monde");
  assert.equal(a.length, 3);
  assert.deepEqual(a[0], { media: "Le Monde", titre: "Sommet de Berlin : les alliés de l'Ukraine promettent leur aide", chapo: "Les membres de la coalition se sont engagés à maintenir leur soutien.", lien: "https://exemple.fr/a1", publie: Date.parse("2026-11-20T04:30:15Z") });
  assert.equal(a[1].titre, "Le président Bukele candidat à un troisième mandat");
  assert.equal(a[1].chapo, "Un changement de la Constitution l'an passé.");
});

test("filtre 24 h : l'article d'avant-hier est écarté, les doublons de lien aussi, le plus récent d'abord", () => {
  const a = lireRss(rss, "Le Monde");
  const r = recents([...a, { ...a[1], lien: "https://exemple.fr/a2" }], at(20, 8));
  assert.deepEqual(r.map((x) => x.lien), ["https://exemple.fr/a2#xtor=RSS", "https://exemple.fr/a1"]);
  assert.equal(recents(a, at(22, 8)).length, 0);
});

test("mots clés : minuscules, sans accents ni mots vides", () => {
  assert.deepEqual([...motsCles("Le président Macron à Bruxelles avec les Européens")], ["macron", "bruxelles", "europeens"]);
});

test("regroupement : même sujet chez plusieurs médias, ces sujets d'abord", () => {
  const g = regrouper([
    art("Le Monde", "Séisme au Japon : des milliers d'évacués", 7),
    art("BBC News", "Rohingya genocide ruling by UN court", 6),
    art("franceinfo", "Japon : le séisme fait des milliers d'évacués à Hokkaido", 5),
  ]);
  assert.equal(g.length, 2);
  assert.deepEqual(g[0].map((a) => a.media), ["Le Monde", "franceinfo"]);
});

test("repli sans clé : 8 sujets au plus, titre + médias + liens, « une seule source » signalée, pas de résumé", () => {
  const arts = [
    art("BBC News", "Japan earthquake forces thousands to evacuate", 7),
    art("franceinfo", "Séisme au Japon : des milliers d'évacués", 7),
    art("Le Monde", "Séisme au Japon : des milliers d'évacués à Hokkaido", 6),
    ...Array.from({ length: 10 }, (_, i) => art("Le Monde Sciences", ["Les abeilles dansent", "Baleines bleues observées", "Comète visible demain", "Fourmis architectes", "Lichens urbains", "Manchots empereurs menacés", "Orques chasseuses", "Pulsars étranges", "Quasars lointains", "Tardigrades résistants"][i], 5)),
  ];
  const e = editionSimple(recents(arts, at(20, 8)), at(20, 8));
  assert.equal(e.mode, "simple");
  assert.equal(e.jour, "2026-11-20");
  assert.equal(e.sujets.length, 8);
  assert.equal(e.sujets[0].titre, "Séisme au Japon : des milliers d'évacués à Hokkaido"); // le titre du premier média de la liste (Le Monde)
  assert.deepEqual(e.sujets[0].sources.map((s) => s.media).sort(), ["Le Monde", "franceinfo"]);
  assert.equal(e.sujets[0].uneSource, false);
  assert.equal(e.sujets[0].resume, "");
  assert.equal(e.sujets[1].uneSource, true);
});

test("prompt : articles numérotés avec média, titre et chapô ; consignes de résumé sans recopie", () => {
  const p = construirePrompt([art("Le Monde", "Titre A", 7, "https://a", "Chapô A"), art("BBC News", "Title B", 6)]);
  assert.equal(p.user, "Articles :\n1. [Le Monde] Titre A — Chapô A\n2. [BBC News] Title B");
  assert.equal(p.system, SYSTEME);
  assert.match(p.system, /5 à 10 sujets/);
  assert.match(p.system, /deux phrases/);
  assert.match(p.system, /Ne recopie jamais/);
  assert.equal(construirePrompt(Array.from({ length: 120 }, (_, i) => art("Le Monde", `T${i}`, 7))).liste.length, 80);
});

test("réponse de Claude : sujets, sources retrouvées par numéro, une seule source, texte autour ignoré", () => {
  const liste = [art("Le Monde", "Séisme au Japon", 7, "https://lm/1"), art("franceinfo", "Japon : séisme", 7, "https://fi/1"), art("BBC News", "Rohingya ruling", 6, "https://bbc/1")];
  const json = { sujets: [
    { titre: "Fort séisme au Japon", resume: "Un tremblement de terre a frappé le nord du pays. Des milliers d'habitants ont quitté leur logement.", articles: [1, 2] },
    { titre: "Décision de la justice de l'ONU", resume: "La cour a rendu sa décision. Elle concerne la minorité rohingya.", articles: [3, 99] },
    { titre: "Sujet sans article", resume: "Rien.", articles: [42] },
  ] };
  const reponse = { stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }, { type: "text", text: "Voici :\n" + JSON.stringify(json) }] };
  const e = analyserReponse(reponse, liste, at(20, 7));
  assert.equal(e.mode, "claude");
  assert.equal(e.sujets.length, 2);
  assert.deepEqual(e.sujets[0].sources.map((s) => s.lien), ["https://lm/1", "https://fi/1"]);
  assert.equal(e.sujets[0].uneSource, false);
  assert.equal(e.sujets[1].uneSource, true);
  assert.throws(() => analyserReponse({ stop_reason: "refusal", content: [] }, liste, at(20, 7)), /refusé/);
  assert.throws(() => analyserReponse({ content: [{ type: "text", text: "pas de JSON" }] }, liste, at(20, 7)), /JSON/);
  assert.throws(() => analyserReponse({ content: [{ type: "text", text: "{\"sujets\":[]}" }] }, liste, at(20, 7)), /aucun sujet/);
});

test("résumé qui recopie le chapô : écarté (seulement titre + lien)", () => {
  const a = [art("Le Monde", "Berlin", 7, "https://lm/2", "Les membres de la coalition des volontaires réunis jeudi en Allemagne se sont engagés à honorer l'aide promise")];
  assert.equal(recopie("Les membres de la coalition des volontaires réunis jeudi en Allemagne ont parlé.", a), true);
  assert.equal(recopie("Les pays qui soutiennent Kiev ont promis de continuer leur aide l'an prochain.", a), false);
  const e = analyserReponse({ content: [{ type: "text", text: JSON.stringify({ sujets: [{ titre: "Berlin", resume: "Les membres de la coalition des volontaires réunis jeudi en Allemagne se sont engagés.", articles: [1] }] }) }] }, a, at(20, 7));
  assert.equal(e.sujets[0].resume, "");
});

test("notification « Ton monde ce matin » : une fois par jour, dès 6 h 40, ouvre la tuile Actu ; réglable", () => {
  const actu = { jour: "2026-11-20", genere: at(20, 6, 40), mode: "simple" as const, sujets: ["Japon", "ONU", "Berlin", "Climat"].map((t) => ({ titre: t, resume: "", sources: [{ media: "Le Monde", lien: "https://lm", titre: t }], uneSource: true })) };
  const base = { prefs: DEFAULT_PREFS, newChanges: [], actu };
  assert.equal(plan({ ...base, now: at(20, 6, 20), state: EMPTY_STATE }).messages.length, 0);
  const a = plan({ ...base, now: at(20, 6, 45), state: EMPTY_STATE });
  assert.deepEqual(a.messages, [{ title: "Ton monde ce matin", body: "4 sujets : Japon · ONU · Berlin…", url: "./actu/", tag: "actu" }]);
  assert.equal(plan({ ...base, now: at(20, 7, 5), state: a.state }).messages.length, 0);
  assert.equal(plan({ ...base, now: at(21, 6, 45), state: EMPTY_STATE }).messages.length, 0); // édition d'hier : rien
  assert.equal(plan({ ...base, prefs: { ...DEFAULT_PREFS, actu: false }, now: at(20, 6, 45), state: EMPTY_STATE }).messages.length, 0);
  assert.equal(plan({ ...base, prefs: { ...DEFAULT_PREFS, heureMatin: 8 }, now: at(20, 6, 45), state: EMPTY_STATE }).messages.length, 0);
});
