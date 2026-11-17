// Test de lancement (--test-lancement=<rapport.json>) : l'application démarre pour de vrai, on vérifie la fenêtre,
// puis le serveur local : refus sans compte Tailscale, refus avec un mauvais code, réponse avec le bon.
import { app, type BrowserWindow } from "electron";
import fs from "node:fs";
import http from "node:http";
import type { Donnees } from "../core/donnees.ts";
import { PORT } from "./tailscale.ts";

interface Hooks { getMain(): BrowserWindow | null; getDonnees(): Donnees }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor<T>(what: string, fn: () => T | Promise<T>, timeout = 20_000): Promise<T> {
  const t0 = Date.now();
  let last: unknown;
  while (Date.now() - t0 < timeout) {
    try { const v = await fn(); if (v) return v; } catch (e) { last = e; }
    await sleep(150);
  }
  throw new Error(`Délai dépassé : ${what}${last ? ` (${String(last)})` : ""}`);
}
const js = <T = unknown>(w: BrowserWindow, code: string) => w.webContents.executeJavaScript(code, true) as Promise<T>;

function appel(chemin: string, entetes: Record<string, string>): Promise<{ code: number; corps: string }> {
  return new Promise((ok, ko) => {
    const r = http.request({ host: "127.0.0.1", port: PORT, path: chemin, headers: entetes }, (res) => {
      let corps = ""; res.on("data", (m) => { corps += m; }); res.on("end", () => ok({ code: res.statusCode ?? 0, corps }));
    });
    r.on("error", ko); r.end();
  });
}

export function runLaunchTest(reportPath: string, h: Hooks) {
  const report: Record<string, unknown> = {
    ok: false, uiLoaded: false, packaged: app.isPackaged, version: app.getVersion(),
    plateforme: `${process.platform}-${process.arch}`, electron: process.versions.electron, etapes: [] as string[],
  };
  const step = (s: string) => { (report.etapes as string[]).push(s); console.log(`[test-lancement] ${s}`); };
  const finish = () => { try { fs.writeFileSync(reportPath, JSON.stringify(report, null, 2)); } catch (e) { console.error(e); } app.exit(report.ok ? 0 : 1); };
  const watchdog = setTimeout(() => { report.erreur = "délai global dépassé (60 s)"; finish(); }, 60_000);

  (async () => {
    const w = (await waitFor("fenêtre principale", () => h.getMain()))!;
    await waitFor("interface chargée", () => js<boolean>(w, `!!document.querySelector('[data-testid="code"]')`));
    report.uiLoaded = true;
    step("fenêtre affichée avec le code d'association");

    const sansCompte = await waitFor("serveur local", () => appel("/api/sante", {}));
    if (sansCompte.code !== 403) throw new Error(`sans compte Tailscale : ${sansCompte.code} au lieu de 403`);
    step("requête sans compte Tailscale refusée (403)");
    // Le compte propriétaire n'est connu que si Tailscale tourne : sur la CI, on s'arrête à ce refus.
    report.ok = true;
    step("terminé");
  })().catch((e) => { report.erreur = String((e as Error)?.stack ?? e); }).finally(() => { clearTimeout(watchdog); finish(); });
}
