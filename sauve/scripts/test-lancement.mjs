// Test de lancement : démarre l'application avec --test-lancement=<rapport> et vérifie le rapport.
//   node scripts/test-lancement.mjs                       application non empaquetée (electron .)
//   node scripts/test-lancement.mjs "dist/win-unpacked/Rayans Sauve.exe"   paquet construit, lancé comme un double-clic
// L'application clique dans sa propre interface (voir src/main/launch-test.ts), écrit le rapport et se ferme.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const target = process.argv[2] ? resolve(process.argv[2]) : null;
const report = join(tmpdir(), `rayans-sauve-lancement-${Date.now()}.json`);
const arg = `--test-lancement=${report}`;
const t0 = Date.now();

if (!target) {
  const electron = createRequire(import.meta.url)("electron");
  spawnSync(electron, [".", arg], { stdio: "inherit", timeout: 120_000 });
} else if (process.platform === "win32") {
  // « start /wait » passe par ShellExecute, comme un double-clic dans l'Explorateur.
  spawnSync("cmd.exe", ["/c", "start", '""', "/wait", target, arg], { stdio: "inherit", timeout: 120_000 });
} else {
  spawnSync(target, ["--no-sandbox", arg], { stdio: "inherit", timeout: 120_000 });
}

for (let i = 0; i < 30 && !existsSync(report); i++) await new Promise((r) => setTimeout(r, 1000));
if (!existsSync(report)) {
  console.error("Aucun rapport : l'application ne s'est pas lancée correctement.");
  process.exit(1);
}
const r = JSON.parse(readFileSync(report, "utf8"));
r.duree_s = Math.round((Date.now() - t0) / 1000);
r.cible = target ?? "electron .";
console.log(JSON.stringify(r, null, 2));
const ok = r.ok && r.uiLoaded && (!target || r.packaged);
console.log(ok ? "Test de lancement réussi." : "Test de lancement ÉCHOUÉ.");
process.exit(ok ? 0 : 1);
