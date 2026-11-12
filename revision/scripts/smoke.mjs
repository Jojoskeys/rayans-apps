// Test de lancement : démarre le vrai .exe avec un dossier de données vide, attend que l'interface signale
// qu'elle est prête (commande smoke_ready), puis vérifie le premier démarrage : paquet d'exemple créé et
// enregistré sur le disque. Usage : node scripts/smoke.mjs "<chemin du .exe>" [délai en secondes]
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const exe = process.argv[2];
const timeoutS = Number(process.argv[3] ?? 90);
if (!exe || !existsSync(exe)) {
  console.error(`Exécutable introuvable : ${exe}`);
  process.exit(2);
}

const out = resolve("smoke-output");
rmSync(out, { recursive: true, force: true });
const dataDir = join(out, "donnees");
mkdirSync(dataDir, { recursive: true });
const report = join(out, "pret.json");

const started = Date.now();
const child = spawn(resolve(exe), [], {
  env: { ...process.env, REVISION_DATA_DIR: dataDir, REVISION_SMOKE_FILE: report },
  stdio: "inherit",
});
let exitCode = null;
child.on("exit", (code) => (exitCode = code));

const fail = (msg) => {
  console.error(`ÉCHEC : ${msg}`);
  try { child.kill(); } catch { /* déjà arrêté */ }
  process.exit(1);
};

while (!existsSync(report)) {
  if (exitCode !== null) fail(`l'application s'est fermée (code ${exitCode}) avant d'afficher l'accueil`);
  if (Date.now() - started > timeoutS * 1000) fail(`interface non prête après ${timeoutS} s`);
  await new Promise((r) => setTimeout(r, 250));
}
await new Promise((r) => setTimeout(r, 200));
const summary = JSON.parse(readFileSync(report, "utf8"));
console.log(`Interface prête en ${((Date.now() - started) / 1000).toFixed(1)} s :`, summary);

if (summary.ui !== "ok") fail("résumé inattendu");
if (summary.decks < 1 || summary.cards < 5) fail("paquet d'exemple absent au premier démarrage");
if (summary.due < 5) fail("les cartes d'exemple devraient être proposées aujourd'hui");

const dbFile = join(dataDir, "revision.json");
if (!existsSync(dbFile)) fail(`données non enregistrées (${dbFile} absent)`);
const db = JSON.parse(readFileSync(dbFile, "utf8"));
if (db.format !== "rayans-revision" || db.cards.length !== summary.cards) fail("fichier de données inattendu");

// L'application se ferme d'elle-même après le signal ; on lui laisse quelques secondes.
const deadline = Date.now() + 15000;
while (exitCode === null && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
if (exitCode === null) fail("l'application ne s'est pas fermée après le test");
if (exitCode !== 0) fail(`code de sortie ${exitCode}`);
console.log("Test de lancement réussi.");
