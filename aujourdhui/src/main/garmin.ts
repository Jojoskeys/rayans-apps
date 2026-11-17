// Montre Garmin branchée en USB (Windows) : copie les nouvelles activités (GARMIN\Activity\*.fit) et les ajoute
// au journal sport (voir core/garmin.ts). La montre est un appareil MTP, sans lettre de lecteur : on passe par
// l'Explorateur (Shell.Application) dans un PowerShell. Vérifié toutes les 2 minutes, rien ne part sur Internet.
// Fichiers copiés dans <données>/montre/ (sur le PC seulement), liste des fichiers traités dans montre.json.
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { lireFit } from "../core/fit.ts";
import { activiteDepuisFit, importerMontre, type ActiviteMontre } from "../core/garmin.ts";
import { donneesSport, modifierSport } from "./sport.ts";

interface Ctx { dataDir: string; notify: (title: string, body: string) => void }

let ctx: Ctx;
let enCours = false;

// Copie dans $env:DEST les .fit de toute montre Garmin branchée (dossier GARMIN\Activity), datés d'au moins
// $env:DEPUIS (nom AAAA-MM-JJ-…) et pas encore copiés. Écrit le nom de la montre trouvée.
const SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$sh = New-Object -ComObject Shell.Application
$dest = $sh.NameSpace($env:DEST)
foreach ($app in $sh.NameSpace(17).Items()) {
  if (-not $app.IsFolder -or $app.Path -notmatch 'usb#vid_091e') { continue }
  foreach ($stock in $app.GetFolder.Items()) {
    $garmin = $stock.GetFolder.Items() | Where-Object { $_.Name -eq 'GARMIN' } | Select-Object -First 1
    $act = if ($garmin) { $garmin.GetFolder.Items() | Where-Object { $_.Name -eq 'Activity' } | Select-Object -First 1 }
    if (-not $act) { continue }
    Write-Output ('MONTRE ' + $app.Name)
    foreach ($f in $act.GetFolder.Items()) {
      if ($f.Name -like '*.fit' -and $f.Name -ge $env:DEPUIS -and -not (Test-Path (Join-Path $env:DEST $f.Name))) { $dest.CopyHere($f, 0x14) }
    }
  }
}
Start-Sleep -Seconds 2
`;

function lancer(dest: string, depuis: string): Promise<string> {
  return new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(SCRIPT, "utf16le").toString("base64")],
      { env: { ...process.env, DEST: dest, DEPUIS: depuis }, timeout: 90_000, windowsHide: true },
      (_err, stdout) => resolve(String(stdout ?? "")));
  });
}

const fichierEtat = () => path.join(ctx.dataDir, "montre.json");
function traites(): Set<string> {
  try { return new Set((JSON.parse(fs.readFileSync(fichierEtat(), "utf8")).traites ?? []) as string[]); } catch { return new Set(); }
}

/** Lit les .fit copiés et pas encore traités, et les ajoute au journal. Renvoie les lignes ajoutées. */
export function importerDossier(dossier: string): string[] {
  const deja = traites();
  const nouveaux = fs.readdirSync(dossier).filter((f) => f.toLowerCase().endsWith(".fit") && !deja.has(f)).sort();
  if (!nouveaux.length) return [];
  const acts: ActiviteMontre[] = [];
  for (const f of nouveaux) {
    try { const a = activiteDepuisFit(f, lireFit(fs.readFileSync(path.join(dossier, f)))); if (a) acts.push(a); }
    catch (e) { console.error(`montre : ${f} illisible`, e); }
  }
  const { data, ajouts } = importerMontre(donneesSport(), acts);
  if (ajouts.length) modifierSport(data);
  const tmp = `${fichierEtat()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ traites: [...deja, ...nouveaux] }, null, 1));
  fs.renameSync(tmp, fichierEtat());
  return ajouts;
}

async function verifier() {
  if (enCours) return;
  enCours = true;
  try {
    const dossier = path.join(ctx.dataDir, "montre");
    fs.mkdirSync(dossier, { recursive: true });
    const sortie = await lancer(dossier, donneesSport().debut);
    if (!sortie.includes("MONTRE ")) return;
    const ajouts = importerDossier(dossier);
    if (ajouts.length) ctx.notify("Montre : séances ajoutées au sport", ajouts.join("\n"));
  } catch (e) {
    console.error(e);
  } finally {
    enCours = false;
  }
}

export function setupGarmin(c: Ctx) {
  ctx = c;
  if (process.platform !== "win32") return;
  setTimeout(() => void verifier(), 20_000);
  setInterval(() => void verifier(), 120_000);
}
