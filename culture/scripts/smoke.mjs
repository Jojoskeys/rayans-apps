// Test de lancement : démarre le vrai .exe avec un dossier de données vide, attend que l'interface signale
// qu'elle est prête (commande smoke_ready), puis vérifie le premier démarrage : données vides créées et
// enregistrées sur le disque, et lecture (seule) d'une petite édition d'actualité posée dans le dossier. Usage : node scripts/smoke.mjs "<chemin du .exe>" [délai en secondes]
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

// Petite édition « Ton monde » factice, datée d'aujourd'hui (heure locale, début de journée à 4 h).
const d = new Date(Date.now() - 4 * 3600_000);
const jour = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const src = (media, l) => ({ media, lien: `https://exemple.fr/${l}`, titre: `Article ${l}` });
const actu = { editions: [{ jour, genere: Date.now(), mode: "simple", sujets: [
  { titre: "Sujet tech de test", resume: "Un résumé de test assez long pour faire une question. Deuxième phrase.", rubrique: "tech", uneSource: false, sources: [src("Média A", "a"), src("Média B", "b")] },
  { titre: "Sujet cyber de test", resume: "Une faille de test est corrigée par une mise à jour du jour.", rubrique: "cyber", uneSource: true, sources: [src("Média C", "c")] },
  { titre: "Sujet géopolitique de test", resume: "Une rencontre de test entre deux pays imaginaires a eu lieu.", rubrique: "geo", uneSource: false, sources: [src("Média D", "d"), src("Média A", "e")] },
] }] };
const actuFile = join(dataDir, "actu.json");
writeFileSync(actuFile, JSON.stringify(actu));

const started = Date.now();
const child = spawn(resolve(exe), [], {
  env: { ...process.env, CULTURE_DATA_DIR: dataDir, CULTURE_SMOKE_FILE: report },
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
if (!summary.premierDemarrage) fail("le premier démarrage n'a pas été détecté");
if (summary.banque < 50) fail(`au moins 50 questions de culture générale attendues, ${summary.banque} trouvées`);
if (summary.seance !== 10) fail(`la séance du jour devrait avoir 10 questions, elle en a ${summary.seance}`);

const dbFile = join(dataDir, "culture.json");
if (!existsSync(dbFile)) fail(`données non enregistrées (${dbFile} absent)`);
const db = JSON.parse(readFileSync(dbFile, "utf8"));
if (db.format !== "rayans-culture") fail("fichier de données inattendu");
if (!db.actuJours?.includes(jour)) fail("l'édition d'actualité n'a pas été lue");
if (!db.cartes?.some((c) => c.id.startsWith(`actu:${jour}:`))) fail("aucune question tirée de l'actualité");
if (!db.seances?.[jour]?.ids?.some((id) => id.startsWith("actu:"))) fail("pas de question d'actualité dans la séance du jour");
if (readFileSync(actuFile, "utf8") !== JSON.stringify(actu)) fail("le fichier d'actualité a été modifié");

// L'application se ferme d'elle-même après le signal ; on lui laisse quelques secondes.
const deadline = Date.now() + 15000;
while (exitCode === null && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
if (exitCode === null) fail("l'application ne s'est pas fermée après le test");
if (exitCode !== 0) fail(`code de sortie ${exitCode}`);
console.log("Test de lancement réussi.");
