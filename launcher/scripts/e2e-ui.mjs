// Parcours de bout en bout sur la VRAIE application Rayan's Launcher, pilotée par WebDriver (tauri-driver).
// Clique sur les boutons comme un utilisateur et contrôle le résultat sur le disque.
//
// Prérequis (Linux) : tauri-driver (cargo install tauri-driver --locked), WebKitWebDriver
// (paquet webkit2gtk-driver), un affichage (xvfb-run), et :
//   npx tauri build --debug --no-bundle
// Puis :   xvfb-run -a npm run e2e:ui
// Sous Windows : tauri-driver + msedgedriver (même version qu'Edge WebView2) ; voir le README.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const win = process.platform === "win32";
const APP = resolve(process.env.HANGAR_E2E_APP ?? join("target", "debug", win ? "hangar.exe" : "hangar"));
const OUT = resolve("e2e-output");
const HOME = mkdtempSync(join(tmpdir(), "hangar-e2e-"));
const DRIVER = "http://127.0.0.1:4444";
const ELEMENT = "element-6066-11e4-a52e-4f735466cecf";
const CARD = `//article[@aria-label="Rayan's Chrono"]`;
const results = [];

if (!existsSync(APP)) throw new Error(`Application introuvable : ${APP} (npx tauri build --debug --no-bundle)`);
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const demo = (step) => execFileSync("node", ["scripts/demo.mjs", step], { stdio: "inherit" });

async function wd(method, path, body, timeout = 60000) {
  const r = await fetch(DRIVER + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} : ${JSON.stringify(j.value ?? j)}`);
  return j.value;
}

let sid;
async function startApp() {
  // Ne réessaie que tant que le pilote n'écoute pas encore : relancer pendant qu'une première
  // fenêtre démarre la ferait fermer par la protection « une seule instance ».
  for (let i = 0; i < 30; i++) {
    try {
      const v = await wd(
        "POST",
        "/session",
        { capabilities: { alwaysMatch: { "tauri:options": { application: APP }, ...(win ? { browserName: "wry" } : {}) } } },
        240000,
      );
      sid = v.sessionId;
      return;
    } catch (e) {
      const refused = e?.cause?.code === "ECONNREFUSED" || String(e).includes("ECONNREFUSED");
      if (!refused || i === 29) throw e;
      await sleep(500);
    }
  }
}
const stopApp = async () => {
  await wd("DELETE", `/session/${sid}`).catch(() => {});
  await sleep(800);
};
const find = async (xpath) => {
  try {
    const v = await wd("POST", `/session/${sid}/element`, { using: "xpath", value: xpath });
    return v[ELEMENT];
  } catch {
    return null;
  }
};
async function waitFor(xpath, what, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const id = await find(xpath);
    if (id) return id;
    await sleep(200);
  }
  await shot(`echec-${what.replace(/\W+/g, "-")}`);
  throw new Error(`Introuvable après ${timeout} ms : ${what} (${xpath})`);
}
async function click(xpath, what) {
  const id = await waitFor(xpath, what);
  await wd("POST", `/session/${sid}/element/${id}/click`, {});
}
async function shot(name) {
  const b64 = await wd("GET", `/session/${sid}/screenshot`);
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(b64, "base64"));
}
const btn = (label, scope = CARD) => `${scope}//button[contains(normalize-space(.), "${label}")]`;
const journal = () => {
  const f = join(HOME, "data", "rayans-chrono", "journal.txt");
  return existsSync(f) ? readFileSync(f, "utf8").trim().split("\n") : [];
};
async function waitLaunch(version, count) {
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    const j = journal();
    if (j.length >= count) {
      const last = j[count - 1];
      if (!last.startsWith(`version=${version} `)) throw new Error(`lancement n°${count} : attendu ${version}, obtenu « ${last} »`);
      return last;
    }
    await sleep(200);
  }
  throw new Error(`le lancement n°${count} (v${version}) n'a pas eu lieu`);
}
async function step(name, f) {
  process.stdout.write(`\n▶ ${name}\n`);
  try {
    await f();
    results.push([name, "OK"]);
    console.log(`  ✔ ${name}`);
  } catch (e) {
    results.push([name, `ÉCHEC : ${e.message}`]);
    console.log(`  ✘ ${e.message}`);
    throw e;
  }
}

// --- Mise en place ----------------------------------------------------------------------------
demo("reset");
demo("init");
const serve = () => spawn("node", ["scripts/serve.mjs", "dev-catalog", "8787"], { stdio: "ignore" });
let server = serve();
// Sous Windows, TAURI_NATIVE_DRIVER désigne msedgedriver.exe (même version que WebView2).
const driverArgs = process.env.TAURI_NATIVE_DRIVER ? ["--native-driver", process.env.TAURI_NATIVE_DRIVER] : [];
const driver = spawn("tauri-driver", driverArgs, {
  stdio: ["ignore", "inherit", "inherit"],
  env: { ...process.env, HANGAR_HOME: HOME, DEMO_NO_WINDOW: "1", DEMO_SECONDS: "2" },
});
await sleep(1500);

try {
  await startApp();

  await step("1. Ajouter une entrée au catalogue sans reconstruire le launcher", async () => {
    await waitFor("//*[contains(., 'Catalogue vide')]", "état « Catalogue vide »");
    await shot("01-catalogue-vide");
    demo("add");
    await click("//header//button[contains(., 'Actualiser')]", "bouton Actualiser");
    await waitFor(btn("Installer"), "carte Rayan's Chrono avec « Installer »");
    await sleep(600);
    await shot("02-nouvelle-application");
  });

  await step("2. Installer et lancer la version 1", async () => {
    await click(btn("Installer"), "Installer");
    await waitFor(btn("Lancer"), "bouton Lancer après installation");
    await shot("03-installee-v1");
    await click(btn("Lancer"), "Lancer");
    await waitFor(btn("En cours d'exécution"), "état en cours d'exécution", 5000);
    await shot("04-v1-en-cours");
    console.log("  journal :", await waitLaunch("1.0.0", 1));
    await waitFor(btn("Lancer"), "retour à Lancer après fermeture");
  });

  await step("3. Publier la v2, détecter la mise à jour et lancer la nouvelle version", async () => {
    demo("v2");
    await click("//header//button[contains(., 'Actualiser')]", "Actualiser");
    await waitFor(btn("Mettre à jour"), "bouton Mettre à jour");
    await waitFor(btn("Lancer la 1.0.0"), "lancement possible de la version installée");
    await shot("05-mise-a-jour-disponible");
    await click(btn("Mettre à jour"), "Mettre à jour");
    await waitFor(`${CARD}//dd[normalize-space(.)='2.0.0' and not(contains(@class,'accent'))]`, "version installée 2.0.0");
    await click(btn("Lancer"), "Lancer");
    console.log("  journal :", await waitLaunch("2.0.0", 2));
    await shot("06-v2-installee");
    await waitFor(btn("Lancer"), "retour à Lancer");
  });

  await step("4. ZIP corrompu : échec expliqué, la version installée reste lançable", async () => {
    demo("corrupt");
    await click("//header//button[contains(., 'Actualiser')]", "Actualiser");
    await click(btn("Mettre à jour"), "Mettre à jour vers 2.1.0");
    await waitFor(`${CARD}//*[contains(@class,'error-box')][contains(., 'empreinte SHA-256')]`, "message d'échec d'empreinte");
    await waitFor(btn("Réessayer"), "action Réessayer");
    await shot("07-zip-corrompu");
    await click(btn("Lancer la 2.0.0"), "Lancer la 2.0.0");
    console.log("  journal :", await waitLaunch("2.0.0", 3));
  });

  await step("5. Redémarrer sans connexion et lancer l'application installée", async () => {
    await sleep(2500); // laisse l'application se fermer
    await stopApp();
    server.kill();
    await sleep(500);
    await startApp();
    await waitFor("//*[contains(@class,'banner')][contains(., 'Hors ligne')]", "bandeau hors ligne", 30000);
    await waitFor(btn("Lancer la 2.0.0"), "Rayan's Chrono lançable hors ligne");
    await shot("08-hors-ligne");
    await click(btn("Lancer la 2.0.0"), "Lancer la 2.0.0 hors ligne");
    console.log("  journal :", await waitLaunch("2.0.0", 4));
  });

  await step("Désinstaller en gardant les données", async () => {
    await sleep(2500);
    await click(`${CARD}`, "ouvrir la fiche");
    await waitFor("//h3[contains(., 'Notes de version')]", "fiche");
    await shot("09-fiche");
    await click("//button[normalize-space(.)='Désinstaller']", "Désinstaller");
    await click("//div[contains(@class,'confirm')]//button[normalize-space(.)='Désinstaller']", "confirmer");
    await waitFor("//*[contains(@class,'toast')][contains(., 'données conservées')]", "confirmation");
    if (existsSync(join(HOME, "apps", "rayans-chrono"))) throw new Error("fichiers de version encore présents");
    if (!existsSync(join(HOME, "data", "rayans-chrono", "lancements.txt"))) throw new Error("données utilisateur supprimées");
  });
} finally {
  await stopApp().catch(() => {});
  driver.kill();
  server.kill();
  console.log("\nRésultats :");
  for (const [n, r] of results) console.log(`  ${r === "OK" ? "✔" : "✘"} ${n}${r === "OK" ? "" : ` — ${r}`}`);
  console.log(`Captures : ${OUT}\nDossier du launcher utilisé : ${HOME}`);
  if (!process.env.HANGAR_E2E_KEEP) rmSync(HOME, { recursive: true, force: true });
}
if (results.some(([, r]) => r !== "OK") || results.length < 6) process.exit(1);
