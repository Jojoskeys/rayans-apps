// Partage avec le téléphone sur le réseau local : un petit serveur HTTP, ouvert seulement pendant le partage, dont
// l'adresse contient un jeton aléatoire (impossible à deviner). Le téléphone scanne le QR code, télécharge les
// fichiers proposés et peut envoyer les siens (photos…), enregistrés dans Téléchargements\Depuis le téléphone.
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { pickLanAddress, safeFileName } from "../core/network.ts";
import { uniquePath } from "./pdf.ts";

export interface ShareInfo { url: string; files: { name: string; size: number }[]; received: string[]; expiresAt: number; inbox: string }

const MAX_UPLOAD = 4 * 1024 ** 3;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export class ShareServer {
  private server: http.Server | null = null;
  private timer: NodeJS.Timeout | null = null;
  info: ShareInfo | null = null;

  private inbox: string;
  private onChange: () => void;

  constructor(inbox: string, onChange: () => void) {
    this.inbox = inbox;
    this.onChange = onChange;
  }

  get active() { return !!this.server; }

  async start(files: string[], minutes = 15, host?: string): Promise<ShareInfo> {
    await this.stop();
    const ip = host ?? pickLanAddress(Object.entries(os.networkInterfaces()).flatMap(([name, list]) => (list ?? []).map((i) => ({ ...i, name }))));
    if (!ip) throw new Error("Aucun réseau local détecté : connectez l'ordinateur au Wi-Fi (le même que le téléphone).");
    const token = randomBytes(12).toString("base64url");
    const list = files.map((f) => ({ path: f, name: path.basename(f), size: fs.statSync(f).size }));
    const server = http.createServer((req, res) => this.handle(req, res, token, list).catch((e) => {
      if (!res.headersSent) { res.writeHead(500, { "content-type": "text/plain; charset=utf-8" }); res.end(String(e?.message ?? e)); }
    }));
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "0.0.0.0", resolve); });
    const port = (server.address() as { port: number }).port;
    this.server = server;
    this.info = { url: `http://${ip}:${port}/${token}/`, files: list.map(({ name, size }) => ({ name, size })), received: [], expiresAt: Date.now() + minutes * 60_000, inbox: this.inbox };
    this.timer = setTimeout(() => void this.stop(), minutes * 60_000);
    this.onChange();
    return this.info;
  }

  async stop() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const s = this.server;
    this.server = null;
    this.info = null;
    if (s) { s.closeAllConnections(); await new Promise<void>((r) => s.close(() => r())); this.onChange(); }
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse, token: string, list: { path: string; name: string; size: number }[]) {
    const url = new URL(req.url ?? "/", "http://x");
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== token) { res.writeHead(404).end(); return; }
    const route = parts.slice(1).join("/");

    if (req.method === "GET" && route === "") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(page(list.map((f, i) => ({ name: f.name, size: f.size, href: `f/${i}/${encodeURIComponent(f.name)}` }))));
      return;
    }
    const m = route.match(/^f\/(\d+)(\/.*)?$/);
    if (req.method === "GET" && m && list[Number(m[1])]) {
      const f = list[Number(m[1])];
      res.writeHead(200, {
        "content-type": "application/octet-stream", "content-length": f.size,
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      });
      await pipeline(fs.createReadStream(f.path), res);
      return;
    }
    if (req.method === "PUT" && route === "envoi") {
      const len = Number(req.headers["content-length"] ?? 0);
      if (len > MAX_UPLOAD) { res.writeHead(413).end("Fichier trop gros (4 Go maximum)."); return; }
      fs.mkdirSync(this.inbox, { recursive: true });
      const dest = uniquePath(path.join(this.inbox, safeFileName(url.searchParams.get("nom") ?? "")));
      const tmp = `${dest}.partiel`;
      try {
        await pipeline(req, fs.createWriteStream(tmp));
        fs.renameSync(tmp, dest);
      } catch (e) {
        fs.rmSync(tmp, { force: true });
        throw e;
      }
      this.info?.received.push(dest);
      this.onChange();
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end(path.basename(dest));
      return;
    }
    res.writeHead(404).end();
  }
}

function size(n: number) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} Ko` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

/** Page vue sur le téléphone : fichiers à télécharger et bouton pour envoyer les siens. */
function page(files: { name: string; size: number; href: string }[]) {
  const items = files.map((f) => `<li><a href="${esc(f.href)}" download><b>${esc(f.name)}</b><small>${size(f.size)}</small></a></li>`).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rayan's Outils</title><style>
body{font:16px/1.4 system-ui,sans-serif;margin:0;padding:20px;background:#111418;color:#eceff3}
h1{font-size:20px;margin:0 0 16px}h2{font-size:15px;color:#9aa3b2;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.04em}
ul{list-style:none;padding:0;margin:0;display:grid;gap:8px}a{display:flex;justify-content:space-between;gap:12px;padding:14px;border-radius:12px;background:#1d222b;color:inherit;text-decoration:none}
small{color:#9aa3b2;white-space:nowrap}label{display:block;padding:18px;border-radius:12px;background:#4f7ce8;color:#fff;text-align:center;font-weight:600}
input{display:none}#etat{margin-top:12px;color:#9aa3b2}
</style></head><body><h1>Rayan's Outils</h1>
${files.length ? `<h2>À télécharger</h2><ul>${items}</ul>` : ""}
<h2>Envoyer vers l'ordinateur</h2><label>Choisir des photos ou des fichiers<input id="f" type="file" multiple></label><div id="etat"></div>
<script>
const f=document.getElementById("f"),etat=document.getElementById("etat");
f.onchange=async()=>{for(const x of f.files){etat.textContent="Envoi de "+x.name+"…";
const r=await fetch("envoi?nom="+encodeURIComponent(x.name),{method:"PUT",body:x}).catch(()=>null);
etat.textContent=r&&r.ok?"Reçu par l'ordinateur : "+x.name:"Échec de l'envoi de "+x.name;}
f.value="";};
</script></body></html>`;
}
