// Test de lancement : démarre l'exécutable avec un dossier de données temporaire et attend que
// l'interface signale qu'elle est affichée (commande frontend_ready → fichier « ok »), puis l'app se ferme.
// L'application n'analyse ni ne déplace rien au démarrage : aucun vrai dossier n'est touché.
// Usage : node scripts/smoke.mjs [chemin de l'exe]
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const exe = resolve(process.argv[2] ?? "target/release/Rayans Rangement.exe");
if (!existsSync(exe)) {
  console.error(`Exécutable introuvable : ${exe}`);
  process.exit(1);
}
const dir = mkdtempSync(join(tmpdir(), "rangement-smoke-"));
const okFile = join(dir, "ok.txt");
const child = spawn(exe, [], {
  env: { ...process.env, RANGEMENT_DATA_DIR: join(dir, "donnees"), RANGEMENT_SMOKE_FILE: okFile },
  stdio: "inherit",
});
let exited = null;
child.on("exit", (code) => (exited = code));

const deadline = Date.now() + 120_000;
while (Date.now() < deadline) {
  if (existsSync(okFile)) break;
  if (exited !== null) break;
  await new Promise((r) => setTimeout(r, 500));
}
const ok = existsSync(okFile) && readFileSync(okFile, "utf8").startsWith("ok");
if (ok) {
  // L'application se ferme seule après le signal.
  const end = Date.now() + 15_000;
  while (exited === null && Date.now() < end) await new Promise((r) => setTimeout(r, 250));
}
if (exited === null) child.kill();
try {
  rmSync(dir, { recursive: true, force: true });
} catch {}
if (!ok) {
  console.error(`Échec : l'interface ne s'est pas affichée (code de sortie ${exited}).`);
  process.exit(1);
}
console.log(`Lancement réussi : interface affichée, fermeture avec le code ${exited}.`);
