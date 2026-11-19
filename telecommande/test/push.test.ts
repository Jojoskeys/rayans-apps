import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createECDH, randomBytes } from "node:crypto";
import webpush from "web-push";
import { Push } from "../src/main/push.ts";

test("push : clés VAPID créées une fois, gardées dans push.json, rappels relus", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "push-"));
  const a = new Push(dir, () => {});
  const ecdh = createECDH("prime256v1"); ecdh.generateKeys();
  const abonnement = { endpoint: "https://web.push.apple.com/QAbc", keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") } };
  a.programmer({ abonnement, dansMs: 60_000 });
  const b = new Push(dir, () => {});
  assert.equal(b.cle, a.cle);
  assert.ok(b.prevu(abonnement.endpoint)! > Date.now());
  assert.ok(!fs.readFileSync(path.join(dir, "push.json"), "utf8").includes("BEGIN"));
  b.annuler(abonnement.endpoint);
  assert.equal(new Push(dir, () => {}).prevu(abonnement.endpoint), null);
  // La requête préparée pour Apple est chiffrée et signée.
  const f = JSON.parse(fs.readFileSync(path.join(dir, "push.json"), "utf8"));
  const req = webpush.generateRequestDetails(abonnement, "{}", { vapidDetails: { subject: "https://jojoskeys.github.io", publicKey: f.publicKey, privateKey: f.privateKey } });
  assert.equal(req.headers["Content-Encoding"], "aes128gcm");
  assert.match(String(req.headers.Authorization), /^vapid t=/);
});
