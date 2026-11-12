// Crée la paire de clés Ed25519 du catalogue sans Rust : mêmes fichiers et même format que
// « hangar-tools keygen » (graine privée de 32 octets en base64, clé publique de 32 octets en base64).
//   node scripts/keygen.mjs [--private .keys/catalog-private.key] [--public src-tauri/catalog-public-key.txt]
import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const opt = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const privatePath = opt("private", ".keys/catalog-private.key");
const publicPath = opt("public", "src-tauri/catalog-public-key.txt");

if (fs.existsSync(privatePath)) {
  console.error(`erreur : ${privatePath} existe déjà, rien n'est écrasé`);
  process.exit(1);
}
const { privateKey } = generateKeyPairSync("ed25519");
const jwk = privateKey.export({ format: "jwk" });
const b64 = (s) => Buffer.from(s, "base64url").toString("base64");
fs.mkdirSync(path.dirname(path.resolve(privatePath)), { recursive: true });
fs.writeFileSync(privatePath, `${b64(jwk.d)}\n`, { flag: "wx", mode: 0o600 });
fs.writeFileSync(
  publicPath,
  `# Clé publique Ed25519 du catalogue Rayan's Launcher (base64). Générée par scripts/keygen.mjs.\n${b64(jwk.x)}\n`,
);
console.log(`Clé privée : ${privatePath} (à garder secrète, hors du dépôt)`);
console.log(`Clé publique : ${publicPath}`);
