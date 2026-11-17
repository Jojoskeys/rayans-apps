// Lancé par configurer.ps1 avec l'Electron d'Aujourd'hui (seul capable de rouvrir la clé protégée par Windows).
// Met en place le veilleur dans le dépôt privé des données, sans jamais afficher de secret :
//   - secret RAYANS_CLE (clé de chiffrement, déchiffrée de synchro.json) ;
//   - secrets VAPID_PUBLIC / VAPID_PRIVATE (clés d'envoi des notifications, créées une seule fois) ;
//   - vapid-public.json (clé publique, lue par le téléphone pour s'abonner) ;
//   - .github/workflows/veilleur.yml, puis un premier passage.
const { app, safeStorage } = require("electron");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const say = (m) => process.stdout.write(m + "\n");
const fail = (m) => { process.stderr.write("✗ " + m + "\n"); app.exit(1); };

// Copie de « Local State » seulement : on n'ouvre pas le dossier de l'app (qui peut être en cours d'exécution).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rayans-cle-"));
fs.copyFileSync(path.join(process.env.APPDATA, "Rayans Aujourdhui", "Local State"), path.join(tmp, "Local State"));
app.setPath("userData", tmp);

function gh(args, input) {
  const r = spawnSync("gh", args, { input, encoding: "utf8", windowsHide: true });
  return { ok: r.status === 0, out: r.stdout ?? "", err: (r.stderr ?? "").trim() };
}
function putFile(repo, file, content, message) {
  const cur = gh(["api", `repos/${repo}/contents/${file}`, "--jq", ".sha"]);
  const body = JSON.stringify({ message, content: Buffer.from(content).toString("base64"), ...(cur.ok ? { sha: cur.out.trim() } : {}) });
  const r = gh(["api", "-X", "PUT", `repos/${repo}/contents/${file}`, "--input", "-"], body);
  if (!r.ok) throw new Error(`écriture de ${file} refusée : ${r.err.slice(0, 200)}`);
}

app.whenReady().then(() => {
  try {
    const cfgPath = path.join(process.env.LOCALAPPDATA, "fr.rayan.launcher", "data", "rayans-aujourdhui", "synchro.json");
    if (!fs.existsSync(cfgPath)) return fail("synchro pas encore configurée dans Rayan's Aujourd'hui (onglet Synchro).");
    const c = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    const key = c.enc ? safeStorage.decryptString(Buffer.from(c.key, "base64")) : c.key;
    const repo = c.repo;
    if (!repo || !key) return fail("synchro.json incomplet.");
    say(`Dépôt des données : ${repo}`);
    if (process.argv.includes("--essai")) { say(Buffer.from(key, "base64").length === 32 ? "✓ clé de chiffrement lisible (32 octets)" : "✗ clé illisible"); return app.exit(0); }

    const set = (name, value) => { const r = gh(["secret", "set", name, "--repo", repo], value); if (!r.ok) throw new Error(`secret ${name} : ${r.err.slice(0, 200)}`); say(`✓ secret ${name}`); };
    set("RAYANS_CLE", key);

    // Clés VAPID : gardées si déjà en place (les changer désabonnerait le téléphone), sauf --nouvelles-cles.
    const exists = gh(["api", `repos/${repo}/contents/vapid-public.json`, "--jq", ".sha"]).ok;
    if (!exists || process.argv.includes("--nouvelles-cles")) {
      const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
      const pub = publicKey.export({ format: "jwk" }); const priv = privateKey.export({ format: "jwk" });
      const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, "base64url"), Buffer.from(pub.y, "base64url")]).toString("base64url");
      set("VAPID_PUBLIC", raw);
      set("VAPID_PRIVATE", priv.d);
      putFile(repo, "vapid-public.json", JSON.stringify({ publicKey: raw }), "vapid-public : clé publique des notifications");
      say("✓ vapid-public.json");
    } else say("✓ clés de notification déjà en place (gardées)");

    putFile(repo, ".github/workflows/veilleur.yml", fs.readFileSync(path.join(__dirname, "..", "modele", "veilleur.yml"), "utf8"), "Veilleur : emploi du temps et notifications");
    say("✓ workflow veilleur.yml installé");
    const run = gh(["workflow", "run", "veilleur.yml", "--repo", repo]);
    say(run.ok ? "✓ premier passage lancé" : "(premier passage : il démarrera de lui-même dans les 20 minutes)");
    app.exit(0);
  } catch (e) { fail(String(e.message ?? e)); }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
