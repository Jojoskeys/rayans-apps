// Chiffrement de bout en bout des données synchronisées : tout est chiffré sur l'appareil (iPhone ou PC) avant
// l'envoi, GitHub ne voit que du contenu illisible. Clé dérivée d'une phrase secrète que Rayan tape sur chaque
// appareil (PBKDF2-SHA256, 600 000 itérations), chiffrement AES-256-GCM (confidentialité + détection de toute
// modification). Le fichier cle.json du dépôt ne contient que le sel et une valeur de contrôle chiffrée, qui permet
// de vérifier la phrase sans la stocker. Code commun à la web app (WebCrypto) et au PC (Node, même API).

const te = new TextEncoder();
const td = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;
export const ITERATIONS = 600_000;
const CHECK = "rayans-donnees : phrase correcte";

export function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Clé brute (32 octets) dérivée de la phrase secrète. */
export async function deriveKey(passphrase: string, salt: Uint8Array, iterations = ITERATIONS): Promise<Uint8Array> {
  const base = await subtle().importKey("raw", te.encode(passphrase.normalize("NFC")) as BufferSource, "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await subtle().deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, base, 256));
}
const aes = (raw: Uint8Array) => subtle().importKey("raw", raw as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);

/** Enveloppe chiffrée (texte JSON) d'un contenu. */
export async function encrypt(raw: Uint8Array, text: string): Promise<string> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv }, await aes(raw), te.encode(text) as BufferSource));
  return JSON.stringify({ "rayans-chiffre": 1, alg: "AES-256-GCM", iv: b64(iv), data: b64(data) });
}

export const isEncrypted = (text: string) => text.startsWith('{"rayans-chiffre"');

/** Contenu en clair d'une enveloppe ; erreur si la clé est fausse ou le contenu modifié. */
export async function decrypt(raw: Uint8Array, envelope: string): Promise<string> {
  const e = JSON.parse(envelope);
  if (e["rayans-chiffre"] !== 1) throw new Error("format chiffré inconnu");
  try {
    return td.decode(await subtle().decrypt({ name: "AES-GCM", iv: unb64(e.iv) as BufferSource }, await aes(raw), unb64(e.data) as BufferSource));
  } catch {
    throw new Error("déchiffrement impossible : phrase secrète différente, ou fichier modifié");
  }
}

/** Nouveau fichier cle.json (premier appareil configuré) et la clé correspondante. */
export async function createKeyFile(passphrase: string): Promise<{ file: string; raw: Uint8Array }> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const raw = await deriveKey(passphrase, salt);
  const file = JSON.stringify({ "rayans-cle": 1, kdf: "PBKDF2-SHA256", iterations: ITERATIONS, salt: b64(salt), controle: await encrypt(raw, CHECK) }, null, 1);
  return { file, raw };
}

/** Clé à partir du cle.json existant ; erreur si la phrase n'est pas la bonne. */
export async function openKeyFile(passphrase: string, file: string): Promise<Uint8Array> {
  const k = JSON.parse(file);
  const raw = await deriveKey(passphrase, unb64(k.salt), k.iterations ?? ITERATIONS);
  let ok = false;
  try { ok = (await decrypt(raw, k.controle)) === CHECK; } catch { ok = false; }
  if (!ok) throw new Error("phrase secrète incorrecte (ce n'est pas celle choisie sur le premier appareil)");
  return raw;
}
