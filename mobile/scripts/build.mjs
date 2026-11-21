// Construit Rayan's Mobile dans dist/ : l'accueil, une page par app, le manifeste et le service worker
// (fonctionnement hors ligne). Publié sur GitHub Pages par .github/workflows/mobile.yml.
import { build } from "esbuild";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// Chaque page : point d'entrée, élément racine attendu par l'interface, couleur de la barre d'état.
export const PAGES = [
  { id: "", title: "Rayan's Mobile", entry: "src/hub/main.tsx", root: "racine" },
  { id: "revision", title: "Révision", entry: "src/apps/revision.tsx", root: "root", copy: [{ from: "../revision/public/logo.svg", to: "logo.svg" }] },
  { id: "aujourdhui", title: "Aujourd'hui", entry: "src/apps/aujourdhui.tsx", root: "racine", head: '<link rel="stylesheet" href="styles.css" />', copy: [{ from: "../aujourdhui/src/renderer/styles.css", to: "styles.css" }] },
  { id: "hifz", title: "Hifz", entry: "src/apps/hifz.tsx", root: "root", head: '<link rel="stylesheet" href="styles.css" />', copy: [
    { from: "../coran-memorisation/src/ui/styles.css", to: "styles.css" },
    { from: "../coran-memorisation/fonts/AmiriQuran.ttf", to: "fonts/AmiriQuran.ttf" },
    { from: "../coran-memorisation/data/quran-uthmani.txt", to: "data/quran-uthmani.txt" },
    { from: "../coran-memorisation/data/fr.hamidullah.txt", to: "data/fr.hamidullah.txt" },
  ] },
  { id: "priere", title: "Prière", entry: "src/apps/priere.tsx", root: "racine", head: '<link rel="stylesheet" href="styles.css" />', copy: [{ from: "../priere/src/renderer/styles.css", to: "styles.css" }] },
  { id: "chrono", title: "Chrono", entry: "src/apps/chrono.tsx", root: "racine", head: '<link rel="stylesheet" href="styles.css" />', copy: [{ from: "../chrono/src/renderer/styles.css", to: "styles.css" }] },
  { id: "ouvertures", title: "Ouvertures", entry: "src/apps/ouvertures.ts", bodyFrom: "../echecs-ouvertures/src/ui/index.html",
    head: '<link rel="stylesheet" href="chessground.css" /><link rel="stylesheet" href="styles.css" />',
    concat: [{ to: "chessground.css", from: ["node_modules/chessground/assets/chessground.base.css", "node_modules/chessground/assets/chessground.brown.css", "node_modules/chessground/assets/chessground.cburnett.css"] }],
    copy: [
      { from: "../echecs-ouvertures/src/ui/styles.css", to: "styles.css" },
      { from: "../echecs-ouvertures/data/openings.json", to: "openings.json" },
      // Stockfish en WebAssembly (GPL-3.0), lancé dans un Worker pour analyser les parties sur l'iPhone.
      { from: "node_modules/stockfish/bin/stockfish-19-lite-single.js", to: "stockfish-19-lite-single.js" },
      { from: "node_modules/stockfish/bin/stockfish-19-lite-single.wasm", to: "stockfish-19-lite-single.wasm" },
      { from: "node_modules/stockfish/Copying.txt", to: "stockfish-LICENCE.txt" },
    ] },
  { id: "telecommande", title: "Télécommande", entry: "src/apps/telecommande.tsx", root: "racine" },
  { id: "studio", title: "Studio", entry: "src/apps/studio.tsx", root: "racine" },
  { id: "demain", title: "Demain", entry: "src/apps/demain.tsx", root: "racine" },
  { id: "actu", title: "Ton monde", entry: "src/apps/actu.tsx", root: "racine" },
  // Arène : la vue 3D (three.js) est un morceau à part (splitting), chargé seulement si on l'affiche ; ses modèles
  // viennent de blender/arene/sorties.
  { id: "arene", title: "Arène", entry: "src/apps/arene.tsx", root: "racine", splitting: true,
    copy: ["arene", "couronne", ...["croisement", "rebond", "momentum", "tendance", "acheter-et-garder"].map((f) => `robot-${f}`)]
      .map((m) => ({ from: `../blender/arene/sorties/${m}.glb`, to: `modeles/${m}.glb` })) },
  { id: "courses", title: "Courses", entry: "src/apps/courses.tsx", root: "racine" },
  { id: "memo", title: "Mémo", entry: "src/apps/memo.tsx", root: "racine" },
  { id: "memoire", title: "Mémoire", entry: "src/apps/memoire.tsx", root: "root", copy: [{ from: "../memoire/public/logo.svg", to: "logo.svg" }] },
  { id: "sommeil", title: "Sommeil", entry: "src/apps/sommeil.tsx", root: "root", copy: [{ from: "../sommeil/public/logo.svg", to: "logo.svg" }] },
  { id: "papiers", title: "Papiers", entry: "src/apps/papiers.tsx", root: "racine" },
  { id: "favoris", title: "Favoris", entry: "src/apps/favoris.tsx", root: "racine" },
  { id: "recettes", title: "Recettes", entry: "src/apps/recettes.tsx", root: "racine" },
  { id: "bonnes-affaires", title: "Bonnes affaires", entry: "src/apps/bonnes-affaires.tsx", root: "racine" },
  { id: "montre", title: "Montre", entry: "src/apps/montre.tsx", root: "racine" },
];

const tauriStub = join(root, "src/stubs/tauri.ts");
const BUILD = new Date().toISOString();
for (const p of PAGES) {
  const dir = join(out, p.id);
  mkdirSync(dir, { recursive: true });
  await build({
    entryPoints: { app: join(root, p.entry) },
    outdir: dir,
    bundle: true, minify: true, format: "esm", splitting: !!p.splitting, chunkNames: "morceaux/[name]-[hash]", target: ["safari16"], jsx: "automatic", legalComments: "none",
    loader: { ".png": "dataurl", ".svg": "dataurl", ".json": "json", ".woff2": "file", ".ttf": "file" },
    assetNames: "assets/[name]-[hash]",
    define: { "process.env.NODE_ENV": '"production"', __BUILD__: JSON.stringify(BUILD) },
    nodePaths: [join(root, "node_modules")],
    alias: { "@tauri-apps/api/core": tauriStub, "@tauri-apps/plugin-dialog": tauriStub, ...(p.alias ?? {}) },
    logLevel: "warning",
  });
  const up = p.id ? "../" : "./";
  const css = readdirSync(dir).includes("app.css") ? `<link rel="stylesheet" href="app.css" />` : "";
  writeFileSync(join(dir, "index.html"), `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="${p.id ? p.title : "Rayan"}" />
<meta name="theme-color" content="#111418" />
<link rel="manifest" href="${up}manifest.webmanifest" />
<link rel="apple-touch-icon" href="${up}icon.png" />
<link rel="icon" href="${up}icon.png" />
<title>${p.title}</title>
${css}${p.head ?? ""}
</head>
<body style="background:#111418">
${p.bodyFrom ? readFileSync(join(root, p.bodyFrom), "utf8").replace(/^[\s\S]*<body[^>]*>/, "").replace(/<\/body>[\s\S]*$/, "").replace(/<script[\s\S]*?<\/script>/g, "") : `<div id="${p.root}"></div>`}
<script type="module" src="app.js"></script>
</body>
</html>
`);
  for (const c of p.concat ?? []) writeFileSync(join(dir, c.to), c.from.map((f) => readFileSync(join(root, f), "utf8")).join("\n"));
  for (const f of p.copy ?? []) { mkdirSync(dirname(join(dir, f.to)), { recursive: true }); copyFileSync(join(root, f.from), join(dir, f.to)); }
}

copyFileSync(join(root, "../launcher/assets/hangar-logo.png"), join(out, "icon.png"));
writeFileSync(join(out, "manifest.webmanifest"), JSON.stringify({
  name: "Rayan's Mobile", short_name: "Rayan", lang: "fr", start_url: "./", scope: "./", display: "standalone",
  background_color: "#111418", theme_color: "#111418",
  icons: [{ src: "icon.png", sizes: "1024x1024", type: "image/png", purpose: "any" }],
}, null, 1));

// Service à part pour les notifications de fin de minuteur de Rayan's Chrono, envoyées par le PC (Rayan's
// Télécommande, avec sa propre clé). Sa portée (chrono/push/) ne contient aucune page : il ne fait que les afficher.
writeFileSync(join(out, "chrono", "sw-push.js"), `// Rayan's Chrono : notifications de fin de minuteur envoyées par le PC.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let m = { title: "Rayan's Chrono", body: "Le minuteur est terminé.", url: "../", tag: "chrono" };
  try { m = { ...m, ...e.data.json() }; } catch { if (e.data) m.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(m.title, { body: m.body, tag: m.tag, data: { url: m.url }, icon: "../icon.png", badge: "../icon.png", requireInteraction: true }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.location.href).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => { for (const c of cs) if ("focus" in c) { c.navigate(url).catch(() => {}); return c.focus(); } return self.clients.openWindow(url); }));
});
`);

// Même service, pour les notifications de pépites de Rayan's Bonnes Affaires (portée bonnes-affaires/push/).
writeFileSync(join(out, "bonnes-affaires", "sw-push.js"), `// Rayan's Bonnes Affaires : notifications des pépites envoyées par le PC.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let m = { title: "Rayan's Bonnes Affaires", body: "Nouvelle pépite !", url: "../", tag: "bonnes-affaires" };
  try { m = { ...m, ...e.data.json() }; } catch { if (e.data) m.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(m.title, { body: m.body, tag: m.tag, data: { url: m.url }, icon: "../icon.png", badge: "../icon.png" }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "../", self.location.href).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => { for (const c of cs) if ("focus" in c) { c.navigate(url).catch(() => {}); return c.focus(); } return self.clients.openWindow(url); }));
});
`);

// Rayan's Arène : prix et rapports publiés par arene/publier.py (lancé par mobile.yml avant la construction).
// Absents en local ou sans réseau : la tuile l'indique.
const publieArene = join(root, "../arene/publie");
if (existsSync(publieArene)) cpSync(publieArene, join(out, "arene"), { recursive: true });

// Service worker : liste de tous les fichiers, mise en cache à l'installation (fichier par fichier : un échec
// n'empêche pas l'installation, sinon iOS n'active jamais le service et les notifications ne marchent pas), réseau d'abord pour les pages.
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else files.push(relative(out, p).replaceAll("\\", "/")); } };
walk(out);
const hash = createHash("sha256");
for (const f of files.sort()) hash.update(f);
const version = hash.digest("hex").slice(0, 12) + "-" + Date.now().toString(36);
writeFileSync(join(out, "sw.js"), `// Rayan's Mobile, version ${version}
const CACHE = "rayans-mobile-${version}";
const FILES = ${JSON.stringify(["./", ...files.map((f) => "./" + f.replace(/index\.html$/, ""))])};
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(FILES.map((f) => c.add(new Request(f, { cache: "reload" }))))).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// Notifications envoyées par le veilleur (GitHub Actions) : affichage, et ouverture de l'app au toucher.
self.addEventListener("push", (e) => {
  let m = { title: "Rayan", body: "", url: "./", tag: undefined };
  try { m = { ...m, ...e.data.json() }; } catch { if (e.data) m.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(m.title, { body: m.body, tag: m.tag, data: { url: m.url }, icon: "icon.png", badge: "icon.png" }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => { for (const c of cs) if ("focus" in c) { c.navigate(url); return c.focus(); } return self.clients.openWindow(url); }));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return; // GitHub, ADE… : jamais mis en cache
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  } else {
    e.respondWith(caches.match(e.request).then((m) => m || fetch(e.request)));
  }
});
`);
console.log(`Rayan's Mobile construit dans dist/ (${PAGES.length} pages, ${files.length} fichiers, version ${version})`);
