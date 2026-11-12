// Prépare et fait évoluer le catalogue local de démonstration (dossier dev-catalog/).
//
//   npm run demo -- init      compile Horloge Démo 1.0.0 et 2.0.0, crée un catalogue vide
//   npm run demo -- add       publie Horloge Démo 1.0.0 (nouvelle entrée du catalogue)
//   npm run demo -- v2        publie la mise à jour 2.0.0
//   npm run demo -- corrupt   publie une 2.1.0 dont le ZIP est corrompu (empreinte de la 2.0.0)
//   npm run demo -- reset     supprime dev-catalog/
//
// Si .keys/catalog-private.key existe, le catalogue est re-signé après chaque modification.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const win = process.platform === "win32";
const EXE = win ? "HorlogeDemo.exe" : "HorlogeDemo";
const OUT = "dev-catalog";
const CATALOG = join(OUT, "catalog.json");
const KEY = join(".keys", "catalog-private.key");
const VERSIONS = ["1.0.0", "2.0.0"];

const run = (cmd, args, env = {}) =>
  execFileSync(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } });
const tools = (...args) => run("cargo", ["run", "-q", "-p", "hangar-core", "--bin", "hangar-tools", "--", ...args]);
const release = (v) => join(OUT, "releases", `horloge-demo-${v}.zip`);

function sign() {
  if (existsSync(KEY)) tools("sign", "--key", KEY, CATALOG);
  else rmSync(`${CATALOG}.sig`, { force: true });
}

function init() {
  mkdirSync(join(OUT, "releases"), { recursive: true });
  mkdirSync(join(OUT, "zips"), { recursive: true });
  mkdirSync(join(OUT, "img"), { recursive: true });
  for (const v of VERSIONS) {
    const target = join("target", `demo-${v}`);
    console.log(`\n== Compilation d'Horloge Démo ${v}`);
    run("cargo", ["build", "--release", "-p", "hangar-demo", "--target-dir", target], { DEMO_VERSION: v });
    const pkg = join(target, "paquet");
    rmSync(pkg, { recursive: true, force: true });
    mkdirSync(pkg, { recursive: true });
    copyFileSync(join(target, "release", EXE), join(pkg, EXE));
    writeFileSync(join(pkg, "LISEZMOI.txt"), `Horloge Démo ${v}\nApplication de démonstration installée par Hangar.\n`);
    tools("pack", pkg, release(v));
  }
  copyFileSync("examples/horloge-demo/icon.svg", join(OUT, "img", "horloge-demo-icon.svg"));
  copyFileSync("examples/horloge-demo/image.svg", join(OUT, "img", "horloge-demo-image.svg"));
  writeFileSync(CATALOG, JSON.stringify({ schemaVersion: 1, title: "Catalogue de démonstration", apps: [] }, null, 2) + "\n");
  sign();
  console.log(`\nCatalogue vide prêt : ${CATALOG}. Étape suivante : npm run demo -- add`);
}

function publish(v, notes, zipSource = release(v), extra = []) {
  const zip = join(OUT, "zips", `horloge-demo-${v}.zip`);
  copyFileSync(zipSource, zip);
  tools(
    "publish", "--catalog", CATALOG, "--id", "horloge-demo", "--version", v, "--zip", zip,
    "--name", "Horloge Démo",
    "--description", "Une petite horloge qui compte ses lancements. Elle sert à tester Hangar de bout en bout.",
    "--icon", "img/horloge-demo-icon.svg", "--image", "img/horloge-demo-image.svg",
    "--executable", EXE, "--notes", notes, "--date", new Date().toISOString().slice(0, 10), ...extra,
  );
}

const step = process.argv[2];
if (step !== "init" && step !== "reset" && !existsSync(CATALOG)) {
  console.error("Lancez d'abord : npm run demo -- init");
  process.exit(1);
}
switch (step) {
  case "init":
    init();
    break;
  case "add":
    publish("1.0.0", "Première version : affiche l'heure UTC et compte les lancements.");
    sign();
    break;
  case "v2":
    publish("2.0.0", "Les secondes sont affichées.\nLe compteur de lancements est conservé pendant la mise à jour (données séparées des fichiers de version).");
    sign();
    break;
  case "corrupt": {
    // Publie la 2.1.0 avec l'empreinte d'un ZIP sain, puis abîme le fichier publié : simule un
    // transfert corrompu ou un fichier remplacé sur le serveur.
    publish("2.1.0", "Version de test : son ZIP publié est corrompu.", release("2.0.0"));
    const zip = join(OUT, "zips", "horloge-demo-2.1.0.zip");
    const data = readFileSync(zip);
    for (let i = Math.floor(data.length / 3); i < data.length / 3 + 64; i++) data[i] ^= 0xff;
    writeFileSync(zip, data);
    sign();
    console.log("ZIP de la 2.1.0 corrompu après calcul de l'empreinte.");
    break;
  }
  case "reset":
    rmSync(OUT, { recursive: true, force: true });
    break;
  default:
    console.error("Étapes : init | add | v2 | corrupt | reset");
    process.exit(1);
}
