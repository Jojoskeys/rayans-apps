process.env.TZ = "Europe/Paris";
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyserReponse, choisirEssentiel, construirePrompt, editionSimple, estPromo, extraitChapo, imageArticle, lireRss, motsCles, noter, preparerEdition, recents, recopie, regrouper, rubriqueArticle, sujetAvis, SYSTEME, type Article, type Flux } from "../src/actu.ts";
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

// Les formats d'image vus dans les vrais flux (Le Monde, Ars Technica, France 24, Numerama, BBC) et un article sponsorisé.
const rssImages = `<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
 <item><title>Une IA pour les chercheurs</title><link>https://lm.fr/1</link><pubDate>Fri, 20 Nov 2026 06:00:00 +0100</pubDate>
  <media:content url="https://img.lm.fr/petite.jpg" medium="image" width="300"/><media:content url="https://img.lm.fr/grande.jpg" medium="image" width="1200"/>
  <media:content url="https://vid.lm.fr/v.mp4" medium="video" width="1920"/></item>
 <item><title>Fusée réutilisable</title><link>https://ars.com/2</link><pubDate>Fri, 20 Nov 2026 06:10:00 +0100</pubDate>
  <media:thumbnail url="https://cdn.ars.com/t.jpg?w=500&amp;h=500"/></item>
 <item><title>Sommet à Bruxelles</title><link>https://f24.fr/3</link><pubDate>Fri, 20 Nov 2026 06:20:00 +0100</pubDate>
  <enclosure url="https://s.f24.fr/a.mp3" type="audio/mpeg"/><enclosure url="https://s.f24.fr/i.jpeg" type="image/jpeg"/></item>
 <item><title>Nouveau smartphone</title><link>https://num.com/4</link><pubDate>Fri, 20 Nov 2026 06:30:00 +0100</pubDate>
  <description>&lt;img width="1200" src="https://img.num.com/p.jpg" /&gt;&lt;p&gt;Le téléphone sort.&lt;/p&gt;</description></item>
 <item><title>Image non chiffrée</title><link>https://bbc.co.uk/5</link><pubDate>Fri, 20 Nov 2026 06:40:00 +0100</pubDate>
  <media:thumbnail url="http://ichef.bbc.co.uk/x.jpg"/></item>
 <item><title>Gérez vos mots de passe</title><link>https://bc.com/6</link><pubDate>Fri, 20 Nov 2026 06:50:00 +0100</pubDate><dc:creator>Sponsored by Acme</dc:creator></item>
</channel></rss>`;

// Atom (The Verge, Les Numériques) : lien en attribut, date « published », résumé, image dans le contenu.
const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><title>The Verge</title><link rel="self" href="https://www.theverge.com/rss"/>
 <entry><title type="html"><![CDATA[Signal is blocking AI assistants]]></title>
  <link rel="alternate" type="text/html" href="https://www.theverge.com/news/1" /><id>https://www.theverge.com/?p=1</id>
  <updated>2026-11-20T06:04:34-05:00</updated><published>2026-11-20T06:02:13-05:00</published>
  <summary type="html"><![CDATA[Signal now blocks screenshots. The change targets assistants.]]></summary>
  <content type="html"><![CDATA[<figure><img alt="x" src="https://platform.theverge.com/i.jpg?quality=90&amp;w=1200" /></figure><p>Long article.</p>]]></content></entry>
</feed>`;

const art = (media: string, titre: string, h: number, o: Partial<Article> = {}): Article => ({ media, titre, chapo: "", lien: `https://${media.replace(/\W/g, "")}.exemple/${encodeURIComponent(titre)}`, publie: at(20, h), ...o });
const tech = (media: string, titre: string, h = 7, o: Partial<Article> = {}) => art(media, titre, h, { rubrique: "tech", langue: "fr", poids: 2, ...o });
const geo = (media: string, titre: string, h = 7, o: Partial<Article> = {}) => art(media, titre, h, { rubrique: "geo", langue: "fr", poids: 2, ...o });
const cyber = (media: string, titre: string, h = 7, o: Partial<Article> = {}) => art(media, titre, h, { rubrique: "cyber", langue: "en", poids: 2, ...o });

test("RSS : titre (CDATA, entités en chiffres), chapô sans balises, lien, date ; entrées sans lien ignorées", () => {
  const a = lireRss(rss, "Le Monde");
  assert.equal(a.length, 3);
  assert.deepEqual(a[0], { media: "Le Monde", titre: "Sommet de Berlin : les alliés de l'Ukraine promettent leur aide", chapo: "Les membres de la coalition se sont engagés à maintenir leur soutien.", lien: "https://exemple.fr/a1", publie: Date.parse("2026-11-20T04:30:15Z") });
  assert.equal(a[1].titre, "Le président Bukele candidat à un troisième mandat");
  assert.equal(a[1].chapo, "Un changement de la Constitution l'an passé.");
});

test("RSS : image du flux (media:content la plus large, miniature, enclosure image, <img> du chapô), https seulement ; sponsorisé écarté", () => {
  const f: Flux = { media: "Le Monde", url: "https://lm.fr/rss", rubrique: "tech", langue: "fr", poids: 3 };
  const a = lireRss(rssImages, "Le Monde", f);
  assert.deepEqual(a.map((x) => x.image), ["https://img.lm.fr/grande.jpg", "https://cdn.ars.com/t.jpg?w=500&h=500", "https://s.f24.fr/i.jpeg", "https://img.num.com/p.jpg", undefined]);
  assert.equal(a[3].chapo, "Le téléphone sort.");
  assert.ok(!a.some((x) => x.titre.includes("mots de passe")));
  assert.deepEqual([a[0].rubrique, a[0].langue, a[0].poids], ["tech", "fr", 3]);
  assert.equal(imageArticle("<item><title>x</title></item>"), "");
  assert.equal(lireRss(rss, "HN", { sansChapo: true })[0].chapo, "");
});

test("Atom : lien en attribut, date de publication, résumé (pas le contenu entier), image du contenu", () => {
  const [a] = lireRss(atom, "The Verge");
  assert.equal(a.titre, "Signal is blocking AI assistants");
  assert.equal(a.lien, "https://www.theverge.com/news/1");
  assert.equal(a.publie, Date.parse("2026-11-20T11:02:13Z"));
  assert.equal(a.chapo, "Signal now blocks screenshots. The change targets assistants.");
  assert.equal(a.image, "https://platform.theverge.com/i.jpg?quality=90&w=1200");
});

test("filtre 24 h : l'article d'avant-hier est écarté, les doublons de lien aussi, le plus récent d'abord", () => {
  const a = lireRss(rss, "Le Monde");
  const r = recents([...a, { ...a[1], lien: "https://exemple.fr/a2" }], at(20, 8));
  assert.deepEqual(r.map((x) => x.lien), ["https://exemple.fr/a2#xtor=RSS", "https://exemple.fr/a1"]);
  assert.equal(recents(a, at(22, 8)).length, 0);
});

test("mots clés : minuscules, sans accents, sans mots vides ni nombres, pluriel retiré, quelques mots anglais en français", () => {
  assert.deepEqual([...motsCles("Le président Macron à Bruxelles avec les Européens en 2026")], ["macron", "bruxelle", "europeen"]);
  assert.deepEqual([...motsCles("Russian missile hits Poland")], ["russe", "missile", "hits", "pologne"]);
  assert.deepEqual([...motsCles("Des missiles russes en Pologne")], ["missile", "russe", "pologne"]);
});

test("regroupement : même sujet chez plusieurs médias (y compris en anglais), ces sujets d'abord ; mots trop courants insuffisants", () => {
  const g = regrouper([
    art("Le Monde", "Séisme au Japon : des milliers d'évacués", 7),
    art("BBC News", "Rohingya genocide ruling by UN court", 6),
    art("franceinfo", "Japon : le séisme fait des milliers d'évacués à Hokkaido", 5),
    art("BBC News", "Russian missile hits Poland", 5),
    art("Le Monde", "Chute de missiles russes en Pologne", 4),
  ]);
  assert.equal(g.length, 3);
  assert.deepEqual(g[0].map((a) => a.media), ["Le Monde", "franceinfo"]);
  assert.deepEqual(g[1].map((a) => a.media), ["BBC News", "Le Monde"]);
  // « critical » et « flaw(s) » sont partout dans la cybersécurité : deux failles différentes restent séparées.
  assert.equal(regrouper([cyber("A", "ASUS fixes critical flaw in Control Center"), cyber("B", "SonicWall critical flaws won't get patches")]).length, 2);
  // Deux titres différents sur le même sujet : réunis par le début du chapô.
  const c = "Microsoft présente baseline protection qui réunit huit protections en un seul résultat.";
  assert.equal(regrouper([tech("Next", "Ce que la future Baseline de Windows signifie", 7, { chapo: c }), tech("Korben", "Windows va noter votre PC", 6, { chapo: c })]).length, 1);
});

test("rubriques : celle du flux, sauf cybersécurité (partout) et tech dans un flux de géopolitique ; promos, sport et directs écartés", () => {
  assert.equal(rubriqueArticle(tech("Next", "Une cyberattaque paralyse un hôpital")), "cyber");
  assert.equal(rubriqueArticle(tech("Next", "Rançongiciel : la mairie touchée")), "cyber");
  assert.equal(rubriqueArticle(geo("Le Monde", "Nvidia et les puces : Pékin riposte")), "tech");
  assert.equal(rubriqueArticle(geo("BBC News", "AI rules agreed in Brussels", 7, { langue: "en" })), "tech");
  assert.equal(rubriqueArticle(geo("Le Monde", "J'ai vu la guerre au Soudan")), "geo");
  assert.equal(rubriqueArticle(art("Le Monde", "Sans rubrique", 7)), "geo");
  for (const t of ["Bon plan : le Galaxy S26 à -30 %", "Black Friday : les meilleures offres", "Ligue des nations : la France affrontera l'Espagne", "EN DIRECT, guerre en Ukraine", "Science has a home here—please help keep it that way"]) assert.equal(estPromo(t), true, t);
  assert.equal(estPromo("Windows 11 va noter la sécurité de votre PC"), false);
});

test("CERT-FR : les avis du jour rassemblés en un seul sujet (logiciels concernés, liens)", () => {
  const avis = ["Multiples vulnérabilités dans Moodle (20 novembre 2026)", "Vulnérabilité dans les produits Palo Alto Networks (20 novembre 2026)", "Multiples vulnérabilités dans Moodle (19 novembre 2026)", "Multiples vulnérabilités dans le noyau Linux de SUSE (20 novembre 2026)"]
    .map((t, i) => art("CERT-FR", t, 7 - i, { rubrique: "cyber", agrege: true }));
  const s = sujetAvis(avis)!;
  assert.equal(s.titre, "CERT-FR : 4 avis de sécurité en 24 h");
  assert.equal(s.resume, "Logiciels concernés : Moodle, Palo Alto Networks et noyau Linux de SUSE. Si tu en utilises un, installe la mise à jour de l'éditeur.");
  assert.equal(s.rubrique, "cyber");
  assert.equal(s.sources.length, 4);
  assert.equal(sujetAvis([]), null);
});

test("essentiel : les plus repris, au moins un sujet d'informatique, 2 de géopolitique au plus", () => {
  const g = noter(regrouper([
    ...["Le Monde", "BBC News", "France 24", "Al Jazeera"].map((m) => geo(m, "Missiles russes en Pologne : Varsovie réagit")),
    ...["Le Monde", "France 24", "BBC News"].map((m) => geo(m, "Génocide des Rohingya : la Birmanie condamnée")),
    ...["Le Monde", "Courrier international", "France 24"].map((m) => geo(m, "Accord Royaume-Uni Union européenne signé")),
    ...["Next", "Numerama"].map((m) => tech(m, "Signal bloque les captures d'écran")),
  ]));
  const e = choisirEssentiel(g);
  assert.equal(e.length, 3);
  assert.equal(e.filter((x) => x.rubrique === "geo").length, 2);
  assert.ok(e.some((x) => x.rubrique === "tech"));
});

test("édition gratuite : rubriques dans l'ordre, quotas, titre en français, chapô, image, avis du CERT-FR, en bref sans résumé, promos écartées", () => {
  const arts = [
    tech("Next", "Anthropic entre en bourse : l'action grimpe", 7, { poids: 3, chapo: "L'action a gagné 17 % lors de la première séance. Les marchés restent prudents. Suite.", image: "https://img/next.jpg" }),
    tech("TechCrunch", "Anthropic bourse debut: shares jump", 6, { langue: "en", poids: 3 }),
    tech("01net", "Anthropic : entrée en bourse historique", 5, { poids: 1 }),
    ...Array.from({ length: 12 }, (_, i) => tech(i % 2 ? "Ars Technica" : "Korben", ["Linux 7 sort", "Rust gagne Debian", "Nouvelle puce Apple M6", "Python 4 annoncé", "Firefox change de moteur", "PostgreSQL 19 publié", "Wayland partout", "Qualcomm Snapdragon X3", "GitHub Copilot hors ligne", "Raspberry Pi 6", "Ubuntu 27.04 bêta", "SQLite fête ses 26 ans"][i], 5)),
    tech("Frandroid", "Bon plan : la Pixel Watch à -40 %", 7),
    cyber("BleepingComputer", "Ransomware gang hits hospital chain", 6),
    cyber("Zataz", "Fuite de données chez un opérateur", 6, { langue: "fr" }),
    art("CERT-FR", "Multiples vulnérabilités dans Moodle (20 novembre 2026)", 6, { rubrique: "cyber", agrege: true }),
    ...["Le Monde", "BBC News", "France 24"].map((m, i) => geo(m, "Missiles russes en Pologne : Varsovie réagit", 7 - i, { langue: i === 1 ? "en" : "fr" })),
    ...["Sommet du G20 au Brésil", "Élections au Chili", "Accord sur le climat à la COP", "Crise politique au Japon", "Tensions en mer de Chine", "Sanctions contre l'Iran"].map((t) => geo("Courrier international", t, 4)),
  ];
  const e = editionSimple(recents(arts, at(20, 8)), at(20, 8));
  assert.equal(e.mode, "simple");
  assert.equal(e.jour, "2026-11-20");
  const r = (x: string) => e.sujets.filter((s) => s.rubrique === x);
  assert.deepEqual(e.sujets.map((s) => s.rubrique).filter((x, i, t) => t.indexOf(x) === i), ["essentiel", "tech", "cyber", "geo", "bref"]);
  assert.equal(r("essentiel").length, 3);
  const ess = r("essentiel")[0];
  assert.equal(ess.titre, "Anthropic entre en bourse : l'action grimpe"); // en français, du meilleur média
  assert.equal(ess.resume, "L'action a gagné 17 % lors de la première séance. Les marchés restent prudents.");
  assert.equal(ess.image, "https://img/next.jpg");
  assert.deepEqual(ess.sources.map((s) => s.media), ["Next", "01net", "TechCrunch"]);
  assert.equal(r("tech").length, 8);
  assert.ok(r("cyber").some((s) => s.titre.startsWith("CERT-FR : 1 avis")));
  assert.equal(r("geo").length, 5);
  assert.ok(r("bref").length > 0 && r("bref").every((s) => s.resume === ""));
  assert.ok(!e.sujets.some((s) => s.titre.includes("Bon plan")));
  assert.equal(r("essentiel")[1].uneSource, false);
});

test("extrait du chapô : deux phrases, coupé proprement", () => {
  assert.equal(extraitChapo("Un séisme a frappé le nord du pays. Les secours sont sur place. Bilan à venir."), "Un séisme a frappé le nord du pays. Les secours sont sur place.");
  assert.equal(extraitChapo("  Une   phrase sans point final  "), "Une phrase sans point final");
  const long = extraitChapo(`${"mot ".repeat(100)}fin.`);
  assert.ok(long.length <= 280 && long.endsWith("…") && !long.includes("mo…"));
});

test("prompt : sujets candidats numérotés (rubrique, médias, titres, chapô) ; consignes en français, sans recopie ni invention", () => {
  const p = construirePrompt([tech("Next", "Linux 7 : sortie officielle", 7, { chapo: "Chapô A" }), tech("Korben", "Sortie de Linux 7", 6), geo("BBC News", "Title B", 6), tech("Frandroid", "Bon plan : promo", 6)]);
  assert.equal(p.user, "Sujets candidats :\n1. [tech] Next : Linux 7 : sortie officielle | Korben : Sortie de Linux 7 — Chapô A\n2. [geo] BBC News : Title B");
  assert.equal(p.liste.length, 2);
  assert.equal(p.system, SYSTEME);
  for (const re of [/« essentiel »/, /6 à 10 « tech »/, /2 à 5 « cyber »/, /4 à 6 « geo »/, /2 à 3 phrases/, /pourquoi/, /Ne recopie jamais/, /N'ajoute aucun fait/, /intro/]) assert.match(p.system, re);
  assert.equal(construirePrompt(Array.from({ length: 150 }, (_, i) => tech("Next", `Sujet${i} unique${i}`, 7))).liste.length, 90);
});

test("réponse de l'IA : rubriques, pourquoi, intro, sources par numéro, ordre du sommaire, quotas, texte autour ignoré", () => {
  const liste = [[tech("Next", "Anthropic en bourse", 7, { image: "https://img/a.jpg" }), tech("01net", "Anthropic : bourse", 7)], [geo("BBC News", "Rohingya ruling", 6)], [cyber("BleepingComputer", "VMware zero-day", 6)], [tech("Ars Technica", "PostgreSQL 19", 5)]];
  const json = { intro: "Une journée marquée par l'IA et la justice internationale.", sujets: [
    { rubrique: "geo", titre: "La justice de l'ONU condamne la Birmanie", resume: "La cour a rendu sa décision. Elle concerne la minorité rohingya.", pourquoi: "Une décision historique.", articles: [2] },
    { rubrique: "essentiel", titre: "Anthropic fait son entrée en bourse", resume: "Le créateur de Claude est coté. L'action a progressé.", pourquoi: "Un test pour le secteur de l'IA.", articles: [1, 99] },
    { rubrique: "bizarre", titre: "Faille VMware exploitée", resume: "Une faille est corrigée.", pourquoi: "Mise à jour urgente.", articles: [3] },
    { rubrique: "bref", titre: "PostgreSQL 19 est sorti", resume: "Ignoré.", pourquoi: "Ignoré.", articles: [4] },
    { rubrique: "tech", titre: "Doublon du sujet 1", resume: "x", articles: [1] },
    { rubrique: "tech", titre: "Sujet sans article", resume: "Rien.", articles: [42] },
  ] };
  const e = analyserReponse({ stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }, { type: "text", text: "Voici :\n" + JSON.stringify(json) }] }, liste, at(20, 7));
  assert.equal(e.mode, "claude");
  assert.equal(e.intro, json.intro);
  assert.deepEqual(e.sujets.map((s) => s.rubrique), ["essentiel", "cyber", "geo", "bref"]);
  const [a, v, g, b] = e.sujets;
  assert.deepEqual(a.sources.map((s) => s.lien), [liste[0][0].lien, liste[0][1].lien]);
  assert.equal(a.pourquoi, "Un test pour le secteur de l'IA.");
  assert.equal(a.image, "https://img/a.jpg");
  assert.equal(v.titre, "Faille VMware exploitée"); // rubrique inconnue : celle des articles
  assert.equal(g.uneSource, true);
  assert.equal(b.resume, "");
  assert.equal(b.pourquoi, undefined);
  const trop = { sujets: Array.from({ length: 6 }, (_, i) => ({ rubrique: "essentiel", titre: `S${i}`, resume: "", articles: [i + 1] })) };
  const six = Array.from({ length: 6 }, (_, i) => [tech("Next", `T${i}`, 7)]);
  assert.equal(analyserReponse({ content: [{ type: "text", text: JSON.stringify(trop) }] }, six, at(20, 7)).sujets.length, 3);
  assert.throws(() => analyserReponse({ stop_reason: "refusal", content: [] }, liste, at(20, 7)), /refusé/);
  assert.throws(() => analyserReponse({ content: [{ type: "text", text: "pas de JSON" }] }, liste, at(20, 7)), /JSON/);
  assert.throws(() => analyserReponse({ content: [{ type: "text", text: "{\"sujets\":[]}" }] }, liste, at(20, 7)), /aucun sujet/);
});

test("anti-recopie : résumé, « pourquoi » ou intro qui reprennent 8 mots de suite d'un chapô sont écartés", () => {
  const a = [art("Le Monde", "Berlin", 7, { chapo: "Les membres de la coalition des volontaires réunis jeudi en Allemagne se sont engagés à honorer l'aide promise" })];
  assert.equal(recopie("Les membres de la coalition des volontaires réunis jeudi en Allemagne ont parlé.", a), true);
  assert.equal(recopie("Les pays qui soutiennent Kiev ont promis de continuer leur aide l'an prochain.", a), false);
  const copie = "Les membres de la coalition des volontaires réunis jeudi en Allemagne se sont engagés.";
  const e = analyserReponse({ content: [{ type: "text", text: JSON.stringify({ intro: copie, sujets: [{ rubrique: "geo", titre: "Berlin", resume: copie, pourquoi: copie, articles: [1] }] }) }] }, [a], at(20, 7));
  assert.equal(e.sujets[0].resume, "");
  assert.equal(e.sujets[0].pourquoi, undefined);
  assert.equal(e.intro, undefined);
});

test("repli : un flux en panne n'empêche rien ; l'IA en erreur → édition gratuite ; rien de récent → null", async () => {
  const xml = (titre: string) => `<rss><channel><item><title>${titre}</title><link>https://x.fr/${encodeURIComponent(titre)}</link><pubDate>${new Date(at(20, 6)).toUTCString()}</pubDate></item></channel></rss>`;
  const vrai = globalThis.fetch;
  const appels: string[] = [];
  globalThis.fetch = (async (url: string) => {
    appels.push(String(url));
    if (String(url).includes("panne")) throw new Error("réseau coupé");
    if (String(url).includes("/v1/messages")) return new Response("{}", { status: 529 });
    return new Response(xml(String(url).includes("tech") ? "Linux 7 sort enfin" : "Sommet à Bruxelles"), { status: 200 });
  }) as typeof fetch;
  try {
    const flux: Flux[] = [
      { media: "Next", url: "https://tech.fr/rss", rubrique: "tech", langue: "fr", poids: 3 },
      { media: "Le Monde", url: "https://geo.fr/rss", rubrique: "geo", langue: "fr", poids: 3 },
      { media: "Panne", url: "https://panne.fr/rss", rubrique: "geo", langue: "fr", poids: 1 },
    ];
    const log: string[] = [];
    const e = await preparerEdition(at(20, 7), { cle: "cle-de-test", log: (m) => log.push(m), flux, api: "https://api.test" });
    assert.equal(e?.mode, "simple");
    assert.deepEqual(e?.sujets.map((s) => s.titre).sort(), ["Linux 7 sort enfin", "Sommet à Bruxelles"]);
    assert.ok(log.some((m) => m.includes("indisponible")) && log.some((m) => m.includes("édition gratuite")));
    assert.ok(appels.includes("https://api.test/v1/messages"));
    assert.equal(await preparerEdition(at(23, 7), { log: () => {}, flux }), null);
  } finally { globalThis.fetch = vrai; }
});

test("notification « Ton monde ce matin » : titres de l'essentiel, une fois par jour, dès 6 h 40 ; ancienne édition : nombre de sujets ; réglable", () => {
  const sujet = (t: string, rubrique?: "essentiel" | "tech") => ({ titre: t, resume: "", sources: [{ media: "Le Monde", lien: "https://lm", titre: t }], uneSource: true, ...(rubrique ? { rubrique } : {}) });
  const actu = { jour: "2026-11-20", genere: at(20, 6, 40), mode: "simple" as const, sujets: [sujet("Anthropic en bourse", "essentiel"), sujet("Missiles en Pologne", "essentiel"), sujet("Rohingya", "essentiel"), sujet("Linux 7", "tech")] };
  const base = { prefs: DEFAULT_PREFS, newChanges: [], actu };
  assert.equal(plan({ ...base, now: at(20, 6, 20), state: EMPTY_STATE }).messages.length, 0);
  const a = plan({ ...base, now: at(20, 6, 45), state: EMPTY_STATE });
  assert.deepEqual(a.messages, [{ title: "Ton monde ce matin", body: "Anthropic en bourse · Missiles en Pologne · Rohingya", url: "./actu/", tag: "actu" }]);
  assert.equal(plan({ ...base, now: at(20, 7, 5), state: a.state }).messages.length, 0);
  const ancienne = { ...actu, sujets: ["Japon", "ONU", "Berlin", "Climat"].map((t) => sujet(t)) };
  assert.equal(plan({ ...base, actu: ancienne, now: at(20, 6, 45), state: EMPTY_STATE }).messages[0].body, "4 sujets : Japon · ONU · Berlin…");
  assert.equal(plan({ ...base, now: at(21, 6, 45), state: EMPTY_STATE }).messages.length, 0); // édition d'hier : rien
  assert.equal(plan({ ...base, prefs: { ...DEFAULT_PREFS, actu: false }, now: at(20, 6, 45), state: EMPTY_STATE }).messages.length, 0);
  assert.equal(plan({ ...base, prefs: { ...DEFAULT_PREFS, heureMatin: 8 }, now: at(20, 6, 45), state: EMPTY_STATE }).messages.length, 0);
});
