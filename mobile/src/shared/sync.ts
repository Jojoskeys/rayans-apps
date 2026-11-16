// Synchronisation des données par un dépôt GitHub privé (un fichier JSON par app : revision.json, hifz.json…).
// Les données vivent d'abord sur l'appareil (localStorage) : l'app marche hors ligne, et la synchro se fait à
// l'ouverture (on récupère et fusionne) et après chaque changement (on envoie, quelques secondes plus tard).
// Le jeton d'accès est saisi par Rayan sur chaque appareil et n'est envoyé qu'à api.github.com.
// Chiffrement de bout en bout (e2e.ts) : tout est chiffré ici avant l'envoi, avec une clé tirée de la phrase secrète ;
// rien n'est jamais envoyé en clair, et sans clé la synchro ne démarre pas.

import { b64, createKeyFile, decrypt, encrypt, isEncrypted, openKeyFile, unb64 } from "./e2e.ts";
import { mergeText } from "./merge.ts";

export interface SyncConfig {
  /** « propriétaire/dépôt », par ex. Jojoskeys/rayans-donnees. */
  repo: string;
  token: string;
  /** Clé de chiffrement (base64), tirée de la phrase secrète. */
  key: string;
}

export interface SyncStatus {
  configured: boolean;
  state: "inactif" | "en-cours" | "a-jour" | "hors-ligne" | "erreur";
  message: string;
  lastSync: number;
}

const K = {
  cfg: "rm:cfg",
  data: (app: string) => `rm:data:${app}`,
  base: (app: string) => `rm:base:${app}`,
  sha: (app: string) => `rm:sha:${app}`,
  dirty: (app: string) => `rm:dirty:${app}`,
  last: "rm:last",
};
const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* stockage plein ou interdit */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* */ } },
};

export function getConfig(): SyncConfig | null {
  try { const c = JSON.parse(ls.get(K.cfg) ?? "null"); return c && c.repo && c.token && c.key ? c : null; } catch { return null; }
}
export function setConfig(c: SyncConfig | null) {
  if (c) ls.set(K.cfg, JSON.stringify({ repo: c.repo.trim(), token: c.token.trim(), key: c.key }));
  else ls.del(K.cfg);
}

let status: SyncStatus = { configured: !!getConfig(), state: "inactif", message: "", lastSync: Number(ls.get(K.last) ?? 0) };
const listeners = new Set<(s: SyncStatus) => void>();
function setStatus(p: Partial<SyncStatus>) {
  status = { ...status, ...p, configured: !!getConfig() };
  for (const l of listeners) l(status);
}
export const onStatus = (cb: (s: SyncStatus) => void) => { listeners.add(cb); cb(status); return () => { listeners.delete(cb); }; };

// ----- Accès à GitHub -----------------------------------------------------------------------------

/** Adresse de l'API (remplaçable seulement pour les tests locaux, par un faux GitHub). */
const API = () => (location.hostname === "localhost" && ls.get("rm:test-api")) || "https://api.github.com";

const dec = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
const enc = (s: string) => { const b = new TextEncoder().encode(s); let bin = ""; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(bin); };

type Access = Pick<SyncConfig, "repo" | "token">;
async function gh(cfg: Access, path: string, init: RequestInit = {}, accept = "application/vnd.github+json") {
  const res = await fetch(`${API()}/repos/${cfg.repo}/contents/${path}`, {
    ...init,
    cache: "no-store",
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: accept, "X-GitHub-Api-Version": "2022-11-28", ...(init.headers ?? {}) },
  });
  return res;
}

/** Fichier distant déchiffré : texte, version (sha), et s'il était encore en clair (ancien format). */
async function pull(cfg: SyncConfig, app: string): Promise<{ text: string; sha: string; plain: boolean } | null> {
  const r = await pullRaw(cfg, app);
  if (!r) return null;
  if (isEncrypted(r.text)) return { text: await decrypt(unb64(cfg.key), r.text), sha: r.sha, plain: false };
  return { ...r, plain: true };
}

/** Fichier distant tel quel (chiffré), ou null s'il n'existe pas encore. */
async function pullRaw(cfg: Access, app: string): Promise<{ text: string; sha: string } | null> {
  const meta = await gh(cfg, `${app}.json`);
  if (meta.status === 404) return null;
  if (meta.status === 401 || meta.status === 403) throw new Error("jeton refusé par GitHub (vérifie qu'il donne accès en lecture et écriture au dépôt)");
  if (!meta.ok) throw new Error(`GitHub répond ${meta.status}`);
  const j = await meta.json();
  if (j.encoding === "base64" && j.content) return { text: dec(j.content), sha: j.sha };
  // Au-delà de 1 Mo, GitHub ne renvoie pas le contenu dans la réponse JSON : on le demande en brut.
  const raw = await gh(cfg, `${app}.json`, {}, "application/vnd.github.raw+json");
  if (!raw.ok) throw new Error(`GitHub répond ${raw.status}`);
  return { text: await raw.text(), sha: j.sha };
}

async function push(cfg: SyncConfig, app: string, text: string, sha: string | null): Promise<string> {
  return pushRaw(cfg, app, await encrypt(unb64(cfg.key), text), sha);
}
async function pushRaw(cfg: Access, app: string, content: string, sha: string | null): Promise<string> {
  const res = await gh(cfg, `${app}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: `${app} : synchro ${new Date().toISOString()}`, content: enc(content), ...(sha ? { sha } : {}) }),
  });
  if (res.status === 409 || res.status === 422) throw new Conflict();
  if (!res.ok) throw new Error(`GitHub répond ${res.status} à l'envoi`);
  return (await res.json()).content.sha;
}
class Conflict extends Error {}

/** Vérifie le jeton et l'accès au dépôt. */
export async function testConfig(cfg: Access): Promise<string> {
  const res = await fetch(`${API()}/repos/${cfg.repo}`, { headers: { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json" }, cache: "no-store" });
  if (res.status === 404) throw new Error("dépôt introuvable (nom faux, ou jeton sans accès à ce dépôt)");
  if (res.status === 401) throw new Error("jeton invalide ou expiré");
  if (!res.ok) throw new Error(`GitHub répond ${res.status}`);
  const j = await res.json();
  if (!j.private) throw new Error("ce dépôt est public : tes données seraient visibles par tout le monde. Rends-le privé.");
  if (j.permissions && !j.permissions.push) throw new Error("le jeton ne permet pas d'écrire dans ce dépôt");
  return `Dépôt privé ${j.full_name} accessible`;
}

/**
 * Clé de chiffrement à partir de la phrase secrète. Premier appareil : crée cle.json (sel + valeur de contrôle,
 * jamais la phrase). Appareils suivants : vérifie la phrase avec ce fichier. Renvoie la clé (base64).
 */
export async function setupKey(cfg: Access, passphrase: string): Promise<{ key: string; created: boolean }> {
  if (passphrase.trim().length < 12) throw new Error("phrase secrète trop courte (12 caractères au moins ; plusieurs mots, c'est mieux)");
  const existing = await pullRaw(cfg, "cle");
  if (existing) return { key: b64(await openKeyFile(passphrase, existing.text)), created: false };
  const { file, raw } = await createKeyFile(passphrase);
  await pushRaw(cfg, "cle", file, null);
  return { key: b64(raw), created: true };
}

// ----- Magasin local + synchro ----------------------------------------------------------------------

/**
 * Synchronise une app : récupère la version distante, fusionne avec la locale (à partir de la base commune),
 * enregistre, puis envoie si besoin. Renvoie le texte local à jour.
 */
export async function syncApp(app: string): Promise<string | null> {
  const cfg = getConfig();
  const local = ls.get(K.data(app));
  if (!cfg) return local;
  if (!navigator.onLine) { setStatus({ state: "hors-ligne", message: "Hors ligne : les changements seront envoyés plus tard." }); return local; }
  setStatus({ state: "en-cours", message: "Synchronisation…" });
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const remote = await pull(cfg, app);
      const base = ls.get(K.base(app));
      const cur = ls.get(K.data(app));
      const merged = mergeText(app, base, cur, remote?.text ?? null);
      if (merged === null) { setStatus({ state: "a-jour", message: "Rien à synchroniser.", lastSync: Date.now() }); return null; }
      if (merged !== cur) ls.set(K.data(app), merged);
      if (remote && !remote.plain && merged === remote.text) {
        ls.set(K.base(app), merged); ls.set(K.sha(app), remote.sha); ls.del(K.dirty(app));
      } else {
        try {
          const sha = await push(cfg, app, merged, remote?.sha ?? null);
          ls.set(K.base(app), merged); ls.set(K.sha(app), sha); ls.del(K.dirty(app));
        } catch (e) {
          if (e instanceof Conflict) continue; // quelqu'un a écrit entre-temps : on recommence
          throw e;
        }
      }
      const now = Date.now();
      ls.set(K.last, String(now));
      setStatus({ state: "a-jour", message: "À jour.", lastSync: now });
      return ls.get(K.data(app));
    }
    throw new Error("trop de conflits successifs, réessaie dans un instant");
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    setStatus({ state: /fetch|network/i.test(msg) ? "hors-ligne" : "erreur", message: /fetch|network/i.test(msg) ? "Hors ligne : les changements seront envoyés plus tard." : `Synchro impossible : ${msg}` });
    return ls.get(K.data(app));
  }
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Magasin utilisé par les apps (remplace le fichier local du PC). */
export const store = {
  /** Lecture au démarrage : synchro d'abord (4 s au plus), sinon la copie locale. */
  async load(app: string): Promise<string | null> {
    const local = ls.get(K.data(app));
    if (!getConfig()) return local;
    const t = new Promise<string | null>((r) => setTimeout(() => r(ls.get(K.data(app))), 4000));
    return Promise.race([syncApp(app), t]);
  },
  /** Écriture : immédiate sur l'appareil, envoi groupé 3 s plus tard. */
  save(app: string, text: string) {
    ls.set(K.data(app), text);
    ls.set(K.dirty(app), "1");
    clearTimeout(timers.get(app));
    timers.set(app, setTimeout(() => void syncApp(app), 3000));
  },
  isDirty: (app: string) => ls.get(K.dirty(app)) === "1",
};

/** Envoie ce qui reste quand l'app passe en arrière-plan ou revient en ligne. */
export function installAutoSync(apps: string[]) {
  const flush = () => { for (const a of apps) if (store.isDirty(a)) void syncApp(a); };
  addEventListener("online", flush);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
}

declare global { interface Window { rayansStore?: typeof store } }
if (typeof window !== "undefined") window.rayansStore = store;
