// Petit serveur statique pour essayer dist/ en local (même chemin qu'en ligne : /rayans-apps/).
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const port = Number(process.env.PORT ?? 4173);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ttf": "font/ttf", ".mp3": "audio/mpeg" };

// Faux GitHub (tests locaux uniquement) : /faux-github/repos/<dépôt>/contents/<fichier>, avec sha et conflits 409.
const fake = new Map();
let pushes = 0;
const sha = (t) => createHash("sha1").update(t).digest("hex");
async function fakeGithub(req, res, p) {
  const send = (code, body) => { res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,PUT,OPTIONS" }); res.end(JSON.stringify(body)); };
  if (req.method === "OPTIONS") return send(204, {});
  const m = p.match(/^\/faux-github\/repos\/([^/]+\/[^/]+)(?:\/contents\/(.+))?$/);
  if (!m) return send(404, {});
  if (!m[2]) return send(200, { full_name: m[1], private: true, permissions: { push: true } });
  const key = m[2];
  if (req.method === "GET") { const f = fake.get(key); return f ? send(200, { sha: f.sha, encoding: "base64", content: Buffer.from(f.text).toString("base64") }) : send(404, { message: "Not Found" }); }
  if (req.method === "PUT") {
    let body = ""; for await (const c of req) body += c;
    const j = JSON.parse(body); const cur = fake.get(key);
    if ((cur?.sha ?? null) !== (j.sha ?? null)) return send(409, { message: "conflict" });
    const text = Buffer.from(j.content, "base64").toString("utf8");
    fake.set(key, { text, sha: sha(text) });
    return send(200, { content: { sha: sha(text) } });
  }
  return send(405, {});
}

createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.startsWith("/faux-github/")) return fakeGithub(req, res, p);
  // Lecture / écriture directe d'un fichier du faux dépôt pour simuler l'autre appareil.
  if (p.startsWith("/faux-depot/")) {
    const key = p.slice("/faux-depot/".length);
    if (req.method === "PUT") { let b = ""; for await (const c of req) b += c; fake.set(key, { text: b, sha: sha(b) }); res.writeHead(200); return res.end("ok"); }
    const f = fake.get(key); res.writeHead(f ? 200 : 404, { "Content-Type": "application/json" }); return res.end(f?.text ?? "");
  }
  // Faux service de notifications (tests du veilleur) : compte les envois reçus.
  if (p === "/faux-push") {
    if (req.method === "POST") { for await (const _ of req) { /* contenu chiffré, ignoré */ } pushes++; res.writeHead(201); return res.end(); }
    res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ recus: pushes }));
  }
  if (p === "/" ) { res.writeHead(302, { Location: "/rayans-apps/" }); return res.end(); }
  if (!p.startsWith("/rayans-apps/")) { res.writeHead(404); return res.end(); }
  p = normalize(p.slice("/rayans-apps".length));
  let f = join(dist, p);
  if (!f.startsWith(dist)) { res.writeHead(403); return res.end(); }
  try { if ((await stat(f)).isDirectory()) f = join(f, "index.html"); res.writeHead(200, { "Content-Type": TYPES[extname(f)] ?? "application/octet-stream", "Cache-Control": "no-store" }); res.end(await readFile(f)); }
  catch { res.writeHead(404); res.end("introuvable"); }
}).listen(port, "127.0.0.1", () => console.log(`Rayan's Mobile : http://127.0.0.1:${port}/rayans-apps/`));
