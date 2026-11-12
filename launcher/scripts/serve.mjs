// Serveur statique minimal pour le catalogue local de développement (aucune dépendance).
//   node scripts/serve.mjs [dossier] [port]     par défaut : dev-catalog 8787
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(process.argv[2] ?? "dev-catalog");
const port = Number(process.argv[3] ?? 8787);
const types = { ".json": "application/json", ".sig": "text/plain", ".zip": "application/zip", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = normalize(join(root, path));
  if (!file.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if (!(await stat(file)).isFile()) throw new Error();
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream", "Content-Length": body.length, "Cache-Control": "no-store" });
    res.end(body);
    console.log(`200 ${path}`);
  } catch {
    res.writeHead(404).end();
    console.log(`404 ${path}`);
  }
}).listen(port, "127.0.0.1", () => console.log(`Catalogue local : http://127.0.0.1:${port}/catalog.json (dossier ${root})`));
