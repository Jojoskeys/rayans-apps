// Lecture automatique des mails de la fac (boîte Partage, IMAP en lecture seule) : toutes les 15 minutes quand
// l'application tourne, les mails des expéditeurs autorisés (réglages Fac) sont analysés, et les changements de cours
// appliqués directement à l'emploi du temps, avec une notification. Le mot de passe est saisi par Rayan dans la
// fenêtre et chiffré par Windows (safeStorage, lié au compte) ; il n'est jamais affiché ni synchronisé.
import { ipcMain, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";
import { lireMails, tester, type ImapConfig } from "./imap-client.ts";
import { ajouterMailImap, expediteurAutorise } from "./fac.ts";
import type { CourrierView } from "../renderer/api-types.ts";

interface Ctx {
  dataDir: string;
  clock: () => number;
  notify: (title: string, body: string) => void;
  changed: () => void;
}

interface Etat {
  host: string;
  port: number;
  user: string;
  /** Mot de passe chiffré par Windows (base64). */
  secret: string;
  actif: boolean;
  uidValidity: string;
  vus: number[];
  lastCheck: number;
  lastError: string | null;
  derniers: { at: number; sujet: string; appliquees: string[]; aValider: number }[];
}

const DEFAUT: Etat = { host: "partage.univ-rennes.fr", port: 993, user: "", secret: "", actif: false, uidValidity: "", vus: [], lastCheck: 0, lastError: null, derniers: [] };
const INTERVALLE = 15 * 60_000;
/** Premier passage : les mails des 7 derniers jours. */
const RETRO = 7 * 86_400_000;

let ctx: Ctx;
let etat: Etat = { ...DEFAUT };
let enCours = false;
const file = () => path.join(ctx.dataDir, "courrier.json");

function load() {
  try { etat = { ...DEFAUT, ...JSON.parse(fs.readFileSync(file(), "utf8")) }; } catch { etat = { ...DEFAUT }; }
}
function save() {
  fs.mkdirSync(ctx.dataDir, { recursive: true });
  const tmp = `${file()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(etat, null, 1));
  fs.renameSync(tmp, file());
}
function maj(p: Partial<Etat>) {
  etat = { ...etat, ...p };
  try { save(); } catch (e) { console.error(e); }
  ctx.changed();
}

function config(motDePasse?: string): ImapConfig {
  const password = motDePasse ?? (etat.secret && safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(etat.secret, "base64")) : "");
  if (!etat.user || !password) throw new Error("identifiant ou mot de passe manquant");
  return { host: etat.host, port: etat.port, user: etat.user, password };
}

/** Lit les nouveaux mails des expéditeurs autorisés et applique les changements. */
export async function verifierCourrier(force = false) {
  if (!etat.actif || enCours) return;
  const now = ctx.clock();
  if (!force && now - etat.lastCheck < INTERVALLE) return;
  enCours = true;
  try {
    const vus = new Set(etat.vus);
    const depuis = etat.lastCheck ? etat.lastCheck - 86_400_000 : now - RETRO;
    const r = await lireMails(config(), depuis, expediteurAutorise, vus);
    // Boîte réinitialisée côté serveur : les identifiants ne valent plus rien.
    const nouveauxVus = r.uidValidity === etat.uidValidity ? etat.vus : [];
    const derniers = [...etat.derniers];
    for (const m of r.mails) {
      try {
        const res = ajouterMailImap(m.source);
        derniers.unshift({ at: now, sujet: res.sujet, appliquees: res.appliquees.map((p) => p.summary), aValider: res.aValider });
        if (res.appliquees.length) ctx.notify("Emploi du temps mis à jour d'après un mail", res.appliquees.map((p) => p.summary).join("\n"));
        else if (res.aValider) ctx.notify("Mail de la fac à vérifier", `« ${res.sujet} » : ${res.aValider} changement(s) à valider dans Rayan's Aujourd'hui.`);
      } catch (e) { console.error(e); }
    }
    maj({
      uidValidity: r.uidValidity,
      vus: [...nouveauxVus, ...r.mails.map((m) => m.uid)].slice(-1000),
      lastCheck: now, lastError: null, derniers: derniers.slice(0, 20),
    });
  } catch (e) {
    maj({ lastCheck: now, lastError: String((e as Error).message ?? e).slice(0, 200) });
  } finally {
    enCours = false;
  }
}

export function courrierView(): CourrierView {
  return {
    host: etat.host, port: etat.port, user: etat.user, motDePasseEnregistre: !!etat.secret, actif: etat.actif,
    lastCheck: etat.lastCheck, lastError: etat.lastError, enCours, derniers: etat.derniers,
  };
}

export function setupCourrier(c: Ctx) {
  ctx = c;
  load();
  ipcMain.handle("courrier-config", async (_e, p: { host?: string; port?: number; user?: string; motDePasse?: string }) => {
    const host = String(p?.host ?? etat.host).trim();
    const port = Number(p?.port ?? etat.port);
    const user = String(p?.user ?? etat.user).trim();
    if (!/^[a-z0-9.-]+$/i.test(host) || !(port > 0 && port < 65536) || !user) throw new Error("adresse du serveur, port ou identifiant invalide");
    etat = { ...etat, host, port, user };
    const mdp = typeof p?.motDePasse === "string" && p.motDePasse ? p.motDePasse : undefined;
    // On vérifie la connexion avant d'enregistrer quoi que ce soit.
    const n = await tester(config(mdp));
    if (mdp) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows ne peut pas chiffrer le mot de passe sur ce compte");
      etat.secret = safeStorage.encryptString(mdp).toString("base64");
    }
    maj({ actif: true, lastError: null });
    void verifierCourrier(true);
    return { ...courrierView(), messagesDansLaBoite: n };
  });
  ipcMain.handle("courrier-maintenant", async () => { await verifierCourrier(true); return courrierView(); });
  ipcMain.handle("courrier-actif", (_e, actif: boolean) => { maj({ actif: !!actif && !!etat.secret }); return courrierView(); });
  ipcMain.handle("courrier-oublier", () => { maj({ ...DEFAUT }); return courrierView(); });
}
