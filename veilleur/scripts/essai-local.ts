// Essai complet du veilleur sans rien toucher en ligne : faux GitHub et faux service de notifications fournis par
// mobile/scripts/serve.mjs (npm run serve dans mobile/). Données de test chiffrées avec une clé de test.
//   node scripts/essai-local.ts
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import webpush from "web-push";
import { b64, decrypt, encrypt } from "../../mobile/src/shared/e2e.ts";

const BASE = "http://127.0.0.1:4173";
const key = crypto.randomBytes(32);
const put = async (name: string, body: string) => fetch(`${BASE}/faux-depot/${name}`, { method: "PUT", body });
const putEnc = async (name: string, obj: unknown) => put(`${name}.json`, await encrypt(key, JSON.stringify(obj)));
const pushes = async () => ((await (await fetch(`${BASE}/faux-push`)).json()) as { recus: number }).recus;

const now = Date.now();
const d = new Date(now + 86_400_000);
const z = (h: number, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const ics = (room: string) => `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:${z(10, 15)}\r\nDTEND:${z(12, 15)}\r\nSUMMARY:TD Analyse\r\nLOCATION:${room}\r\nDESCRIPTION:\\nL3 INFO-G4\r\nUID:c1\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
const hhmm = (t: number) => new Date(t).toTimeString().slice(0, 5);

// Appareil abonné (clés d'abonnement de test valides).
const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys();
const sub = { endpoint: `${BASE}/faux-push`, keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: crypto.randomBytes(16).toString("base64url") } };

await put("ade.ics", ics("Salle 004"));
await putEnc("fac", { icsUrl: `${BASE}/faux-depot/ade.ics`, groups: [], allowedSenders: [], courses: [{ uid: "c1", start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10, 15).getTime(), end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 15).getTime(), title: "TD Analyse", room: "B12", details: "" }], changes: [], lastFetch: now - 3_600_000, lastError: null, mails: [], overrides: [], deadlines: [], availableGroups: [] });
await putEnc("routine", { items: [{ id: "r1", title: "Tâche de test", time: hhmm(now - 5 * 60_000), days: [0, 1, 2, 3, 4, 5, 6], created: 0 }], done: {}, sent: [] });
await putEnc("notifications", { subscriptions: [sub], prefs: { matin: false, soir: false } });
await putEnc("veilleur", { lastRun: now - 20 * 60_000, sent: [] });

const vapid = webpush.generateVAPIDKeys();
const run = () => execFileSync(process.execPath, ["src/main.ts"], { env: { ...process.env, RAYANS_GH_API: `${BASE}/faux-github`, GITHUB_REPOSITORY: "test/donnees", GITHUB_TOKEN: "faux", RAYANS_CLE: b64(key), VAPID_PUBLIC: vapid.publicKey, VAPID_PRIVATE: vapid.privateKey }, encoding: "utf8" });

const before = await pushes();
console.log(run().trim());
const first = (await pushes()) - before;
const facText = await (await fetch(`${BASE}/faux-depot/fac.json`)).text();
const fac = JSON.parse(await decrypt(key, facText));
console.log(`1er passage : ${first} notification(s) reçue(s) ; fac chiffré : ${facText.startsWith('{"rayans-chiffre"')} ; salle : ${fac.courses[0].room}`);
console.log(run().trim());
console.log(`2e passage : ${(await pushes()) - before - first} notification(s) en plus (attendu : 0)`);
if (first !== 2 || fac.courses[0].room !== "Salle 004") { console.error("ÉCHEC"); process.exit(1); }
console.log("Essai réussi.");
