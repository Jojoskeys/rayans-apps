// Veilleur de Rayan's Mobile : lancé toutes les 20 minutes (7 h–22 h) par GitHub Actions dans le dépôt privé des
// données. Il télécharge l'emploi du temps ADE (même PC éteint), repère les changements, puis envoie les
// notifications au téléphone (changements de cours, rappels de Ma journée, résumé du matin, rappel du soir) et
// prépare « Ton monde ce matin », la revue de l'actualité du jour (actu.ts).
// Les données restent chiffrées dans le dépôt : il les déchiffre en mémoire avec la clé rangée dans le secret
// RAYANS_CLE, et réécrit chiffré. Il n'écrit JAMAIS de donnée personnelle dans le journal (dépôt public du code).
//
// Variables : RAYANS_CLE, VAPID_PUBLIC, VAPID_PRIVATE, GITHUB_TOKEN, GITHUB_REPOSITORY ; RAYANS_GH_API pour les tests.
// Facultative (vidéos en ligne) : VIDEOS_COMPTES ; RAYANS_YT pour les tests.
// Facultative (« Ton monde ce matin ») : ANTHROPIC_API_KEY pour les résumés par Claude ; sans elle, édition gratuite.
import webpush from "web-push";
import { decrypt, encrypt, isEncrypted, unb64 } from "../../mobile/src/shared/e2e.ts";
import { mergeText } from "../../mobile/src/shared/merge.ts";
import { parseIcs } from "../../aujourdhui/src/core/ics.ts";
import { applyFetch, prune, sanitizeFac, type FacData } from "../../aujourdhui/src/core/fac.ts";
import { sanitizeRoutine } from "../../aujourdhui/src/core/routine.ts";
import { lireComptes, telechargerFlux, videosEnLigne } from "./videos.ts";
import { DEFAULT_PREFS, EMPTY_STATE, fenetreActu, plan, type Prefs, type VeilleurState } from "./plan.ts";
import { preparerEdition } from "./actu.ts";
import { ajouterEdition, nettoyerActu } from "../../mobile/src/shared/actu.ts";
import { todayISO } from "../../aujourdhui/src/core/counts.ts";

const env = (k: string) => { const v = process.env[k]; if (!v) throw new Error(`variable ${k} manquante`); return v; };
const API = process.env.RAYANS_GH_API || "https://api.github.com";
const REPO = env("GITHUB_REPOSITORY");
const TOKEN = env("GITHUB_TOKEN");
const KEY = unb64(env("RAYANS_CLE"));
const SITE = "https://jojoskeys.github.io/rayans-apps/";
const log = (m: string) => console.log(`[veilleur] ${m}`);

async function gh(path: string, init: RequestInit = {}) {
  return fetch(`${API}/repos/${REPO}/contents/${path}`, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "rayans-veilleur", ...(init.headers ?? {}) } });
}
async function pull(name: string): Promise<{ text: string; sha: string } | null> {
  const r = await gh(`${name}.json`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`lecture de ${name} : GitHub répond ${r.status}`);
  const j = await r.json() as { sha: string; content: string };
  let raw = Buffer.from(j.content ?? "", "base64").toString("utf8");
  if (!raw) { const rr = await gh(`${name}.json`, { headers: { Accept: "application/vnd.github.raw+json" } }); raw = await rr.text(); }
  return { text: isEncrypted(raw) ? await decrypt(KEY, raw) : raw, sha: j.sha };
}
async function pushText(name: string, text: string, sha: string | null): Promise<boolean> {
  const r = await gh(`${name}.json`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: `${name} : veilleur`, content: Buffer.from(await encrypt(KEY, text)).toString("base64"), ...(sha ? { sha } : {}) }) });
  if (r.status === 409 || r.status === 422) return false;
  if (!r.ok) throw new Error(`écriture de ${name} : GitHub répond ${r.status}`);
  return true;
}
/** Écrit `mine` (calculé à partir de `base`) en fusionnant avec ce qu'un appareil aurait envoyé entre-temps. */
async function save(name: string, base: { text: string; sha: string } | null, mine: string) {
  let cur = base;
  for (let i = 0; i < 4; i++) {
    const merged = cur && base && cur.sha !== base.sha ? mergeText(name, base.text, mine, cur.text) ?? mine : mine;
    if (cur && merged === cur.text) return;
    if (await pushText(name, merged, cur?.sha ?? null)) return;
    cur = await pull(name);
  }
  throw new Error(`écriture de ${name} : conflits répétés`);
}
const parse = (t: { text: string } | null) => { try { return t ? JSON.parse(t.text) : undefined; } catch { return undefined; } };

/**
 * Heures de prière du jour, avec le code de Rayan's Prière. Chargé à la demande : si le workflow ne récupère pas
 * encore priere/src/core, le veilleur continue sans (rappel du matin à 7 h, pas de rappel des adhkar du soir).
 */
async function heuresDuJour(priere: unknown, now: number) {
  if (!priere) return null;
  try {
    const { heuresDePriere } = await import("../../aujourdhui/src/core/prieres.ts");
    return heuresDePriere(priere, now);
  } catch {
    log("code de Rayan's Prière absent : rappels sans heures de prière");
    return null;
  }
}

/** Vidéos sorties depuis peu (flux publics YouTube). Sans le secret, ou si YouTube ne répond pas : rien, sans bloquer le reste. */
async function videos(now: number) {
  const out = [];
  for (const c of lireComptes(process.env.VIDEOS_COMPTES ?? "")) {
    try { out.push(...videosEnLigne(c, await telechargerFlux(c.youtube, process.env.RAYANS_YT), now)); }
    catch (e) { log(`flux YouTube indisponible : ${String((e as Error).message).slice(0, 80)}`); }
  }
  return out;
}

async function main() {
  const now = Date.now();
  const [facF, routineF, revF, hifzF, ouvF, notifF, stateF, bilanF, objF, priereF, sportF, actuF] = await Promise.all(["fac", "routine", "revision", "hifz", "ouvertures", "notifications", "veilleur", "bilan", "objectifs", "priere", "sport", "actu"].map(pull));

  // 1. Emploi du temps : téléchargé ici, même PC éteint.
  let fac: FacData | undefined = facF ? sanitizeFac(parse(facF)) : undefined;
  let newChanges: FacData["changes"] = [];
  if (fac?.icsUrl && now - fac.lastFetch > 10 * 60_000) {
    try {
      const res = await fetch(fac.icsUrl, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`ADE répond ${res.status}`);
      const before = new Set(fac.changes.map((c) => `${c.uid}|${c.kind}|${c.after}`));
      fac = prune(applyFetch(fac, parseIcs(await res.text()), now), now);
      newChanges = fac.changes.filter((c) => !before.has(`${c.uid}|${c.kind}|${c.after}`));
      await save("fac", facF, JSON.stringify(fac));
      log(`emploi du temps mis à jour (${newChanges.length} nouveau(x) changement(s))`);
    } catch (e) { log(`ADE indisponible : ${String((e as Error).message).slice(0, 80)}`); }
  }

  // 2. Notifications.
  const notif = (parse(notifF) ?? {}) as { subscriptions?: { endpoint: string; keys: { p256dh: string; auth: string } }[]; prefs?: Partial<Prefs> };
  const prefs: Prefs = { ...DEFAULT_PREFS, ...(notif.prefs ?? {}) };
  const state: VeilleurState = { ...EMPTY_STATE, ...(parse(stateF) ?? {}) };

  // 3. « Ton monde ce matin » : préparé une seule fois par jour, gardé quelques jours (fichier « actu », chiffré).
  let actu = nettoyerActu(parse(actuF));
  let edition = actu.editions.find((e) => e.jour === todayISO(now)) ?? null;
  if (prefs.actu && !edition && fenetreActu(now, prefs)) {
    try {
      edition = await preparerEdition(now, { cle: process.env.ANTHROPIC_API_KEY || undefined, log });
      if (edition) { actu = ajouterEdition(actu, edition); await save("actu", actuF, JSON.stringify(actu)); log(`actualité du jour prête (${edition.sujets.length} sujet(s), ${edition.mode})`); }
    } catch (e) { log(`actualité indisponible : ${String((e as Error).message).slice(0, 80)}`); edition = null; }
  }
  const { messages, state: next } = plan({
    now, prefs, state, fac, newChanges,
    routine: routineF ? sanitizeRoutine(parse(routineF)) : undefined,
    revision: parse(revF), hifz: parse(hifzF), ouvertures: parse(ouvF),
    bilan: parse(bilanF), objectifs: parse(objF), sport: parse(sportF), prieres: await heuresDuJour(parse(priereF), now), priere: parse(priereF),
    videos: prefs.videos ? await videos(now) : [],
    actu: edition,
  });
  const subs = notif.subscriptions ?? [];
  log(`${messages.length} notification(s) à envoyer, ${subs.length} appareil(s)`);
  if (messages.length && subs.length) {
    webpush.setVapidDetails("mailto:noreply@github.com", env("VAPID_PUBLIC"), env("VAPID_PRIVATE"));
    const dead = new Set<string>();
    for (const m of messages) {
      for (const s of subs) {
        try {
          // Requête Web Push préparée (chiffrement du contenu + signature VAPID), envoyée au service d'Apple.
          const req = webpush.generateRequestDetails(s, JSON.stringify({ ...m, url: new URL(m.url, SITE).href }), { TTL: 6 * 3600, urgency: "high" });
          const res = await fetch(req.endpoint, { method: req.method, headers: req.headers as Record<string, string>, body: req.body as Buffer, signal: AbortSignal.timeout(20_000) });
          if (res.status === 404 || res.status === 410) dead.add(s.endpoint);
          else if (!res.ok) log(`envoi refusé (${res.status})`);
        } catch { log("envoi impossible (réseau)"); }
      }
    }
    if (dead.size) { await save("notifications", notifF, JSON.stringify({ ...notif, subscriptions: subs.filter((s) => !dead.has(s.endpoint)) })); log(`${dead.size} appareil(s) désinscrit(s) retiré(s)`); }
  }
  await save("veilleur", stateF, JSON.stringify(next));
}

main().catch((e) => { console.error(`[veilleur] échec : ${String((e as Error).message ?? e).slice(0, 200)}`); process.exit(1); });
