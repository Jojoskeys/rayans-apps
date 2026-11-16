import { test } from "node:test";
import assert from "node:assert/strict";
import { createKeyFile, decrypt, encrypt, isEncrypted, openKeyFile } from "../src/shared/e2e.ts";

test("chiffrement : aller-retour, rien en clair, contenu modifié refusé", async () => {
  const { file, raw } = await createKeyFile("ma phrase très secrète");
  assert.ok(!file.includes("ma phrase"));
  const text = JSON.stringify({ icsUrl: "https://planning.univ-rennes.fr/x.shu", mails: [{ from: "secretariat@univ-rennes.fr" }] });
  const env = await encrypt(raw, text);
  assert.ok(isEncrypted(env));
  assert.ok(!env.includes("planning") && !env.includes("secretariat"));
  assert.equal(await decrypt(raw, env), text);
  // Deux chiffrements du même contenu diffèrent (vecteur aléatoire).
  assert.notEqual(await encrypt(raw, text), env);
  // Un octet modifié : refus.
  const e = JSON.parse(env);
  const d = Buffer.from(e.data, "base64"); d[0] ^= 1; e.data = d.toString("base64");
  await assert.rejects(decrypt(raw, JSON.stringify(e)), /déchiffrement impossible/);
});

test("phrase secrète : la bonne ouvre la clé (deuxième appareil), une autre est refusée", async () => {
  const { file, raw } = await createKeyFile("cheval batterie agrafe correcte");
  const again = await openKeyFile("cheval batterie agrafe correcte", file);
  assert.deepEqual(again, raw);
  await assert.rejects(openKeyFile("mauvaise phrase", file), /incorrecte/);
});
