// Ce que le veilleur doit envoyer comme notifications à un instant donné. Fonction pure : données déchiffrées,
// état du veilleur (ce qui a déjà été envoyé) et heure en entrée ; messages et nouvel état en sortie.

import { hifzCount, ouverturesCount, revisionCount, todayISO } from "../../aujourdhui/src/core/counts.ts";
import { isDone, itemsForDay, type RoutineData } from "../../aujourdhui/src/core/routine.ts";
import { displayCourses, type FacData } from "../../aujourdhui/src/core/fac.ts";
import { slot, type CourseChange } from "../../aujourdhui/src/core/ics.ts";
import { nettoyerBilan, notificationsBilan, type Prieres } from "../../aujourdhui/src/core/bilan.ts";
import { journee, nettoyerObjectifs } from "../../aujourdhui/src/core/objectifs.ts";

export interface Prefs {
  cours: boolean; rappels: boolean; matin: boolean; soir: boolean; heureMatin: number; heureSoir: number;
  /** Adhkar après Fajr et entre Asr et Maghrib ; bilan du matin et du soir ; citations du jour. */
  adhkar: boolean; bilan: boolean; citations: boolean;
}
export const DEFAULT_PREFS: Prefs = { cours: true, rappels: true, matin: true, soir: true, heureMatin: 7, heureSoir: 19, adhkar: true, bilan: true, citations: true };

export interface VeilleurState {
  /** Dernier passage (ms). */
  lastRun: number;
  /** Clés déjà notifiées (« matin|2026-11-17 », « rappel|2026-11-17|r1 », « cours|uid|salle|valeur »…). */
  sent: string[];
  /** Rappels du bilan, des adhkar et des citations déjà envoyés au téléphone (« 2026-11-17|matin »…). */
  bilan?: string[];
}
export const EMPTY_STATE: VeilleurState = { lastRun: 0, sent: [], bilan: [] };

export interface Message { title: string; body: string; url: string; tag: string }

export interface Inputs {
  now: number;
  prefs: Prefs;
  state: VeilleurState;
  routine?: RoutineData;
  fac?: FacData;
  /** Changements ADE repérés lors de ce passage. */
  newChanges: CourseChange[];
  revision?: unknown;
  hifz?: unknown;
  ouvertures?: unknown;
  /** Fichiers d'Aujourd'hui (bilan, objectifs), déchiffrés. */
  bilan?: unknown;
  objectifs?: unknown;
  /** Heures de prière du jour (calculées par main.ts avec le code de Rayan's Prière), ou null. */
  prieres?: Prieres | null;
}

const DAY = 86_400_000;
const hm = (t: number) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayStart = (t: number) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const at = (t: number, h: number, m = 0) => dayStart(t) + (h * 60 + m) * 60_000;
const plural = (n: number, s: string) => `${n} ${s}${n > 1 ? "s" : ""}`;

/** Ce qu'il reste à réviser (Révision, Hifz, Ouvertures), comme le compte Aujourd'hui. */
export function leftToReview(i: Pick<Inputs, "now" | "revision" | "hifz" | "ouvertures">): { total: number; text: string } {
  const parts: string[] = [];
  let total = 0;
  const add = (name: string, fn: () => number) => { try { const n = fn(); if (n > 0) { total += n; parts.push(`${name} ${n}`); } } catch { /* données illisibles : ignorées */ } };
  if (i.revision) add("Révision", () => revisionCount(i.revision, i.now).total);
  if (i.hifz) add("Hifz", () => hifzCount(i.hifz, i.now).total);
  if (i.ouvertures) add("Ouvertures", () => ouverturesCount(Object.values(i.ouvertures as object), i.now).total);
  return { total, text: parts.join(" · ") };
}

function changeText(c: CourseChange): string {
  const quand = new Date(c.start).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) + " " + hm(c.start);
  switch (c.kind) {
    case "salle": return `${c.title} (${quand}) : salle ${c.before} → ${c.after}`;
    case "horaire": return `${c.title} : déplacé, avant ${c.before}, maintenant ${c.after}`;
    case "suppression": return `${c.title} (${c.before}) a été retiré de l'emploi du temps`;
    case "ajout": return `Nouveau cours : ${c.title}, ${c.after}`;
  }
}

export function plan(i: Inputs): { messages: Message[]; state: VeilleurState } {
  const { now, prefs } = i;
  const sent = new Set(i.state.sent);
  const out: Message[] = [];
  const day = todayISO(now);
  const once = (key: string, m: Message) => { if (!sent.has(key)) { sent.add(key); out.push(m); } };
  // Premier passage : on ne rattrape pas toute la journée, seulement la dernière demi-heure.
  const since = i.state.lastRun > 0 ? i.state.lastRun : now - 30 * 60_000;

  // 1. Changements de cours (7 prochains jours).
  if (prefs.cours) {
    for (const c of i.newChanges) {
      if (c.start < now - 3_600_000 || c.start > now + 7 * DAY) continue;
      once(`cours|${c.uid}|${c.kind}|${c.after}`, { title: c.kind === "suppression" ? "Cours annulé" : c.kind === "ajout" ? "Cours ajouté" : "Changement de cours", body: changeText(c), url: "./aujourdhui/", tag: `cours-${c.uid}` });
    }
  }

  // 2. Rappels Ma journée : heure passée depuis le dernier passage (ou depuis 2 h au plus), tâche pas cochée.
  if (prefs.rappels && i.routine) {
    for (const it of itemsForDay(i.routine, now)) {
      if (!it.time || isDone(i.routine, it.id, now)) continue;
      const t = at(now, +it.time.slice(0, 2), +it.time.slice(3, 5));
      if (t > now || t < now - 2 * 3_600_000 || t <= since - 60 * 60_000) continue;
      once(`rappel|${day}|${it.id}`, { title: `Rappel : ${it.title}`, body: `Prévu à ${it.time.replace(":", " h ")}. Coche-le dans Aujourd'hui quand c'est fait.`, url: "./aujourdhui/", tag: `rappel-${it.id}` });
    }
  }

  // 3. Résumé du matin.
  if (prefs.matin && now >= at(now, prefs.heureMatin) && now < at(now, prefs.heureMatin + 4)) {
    const lines: string[] = [];
    if (i.fac) {
      const today = displayCourses(i.fac).filter((c) => !c.cancelled && c.start >= dayStart(now) && c.start < dayStart(now) + DAY);
      if (today.length) lines.push(`${plural(today.length, "cours")} : ` + today.slice(0, 4).map((c) => `${hm(c.start)} ${c.title}${c.room ? ` (${c.room.split(" ")[0]})` : ""}`).join(", ") + (today.length > 4 ? "…" : ""));
      else lines.push("Pas de cours aujourd'hui.");
      const soon = i.fac.deadlines.filter((d) => d.at > now && d.at < now + 3 * DAY);
      if (soon.length) lines.push(`Échéances : ${soon.map((d) => `${d.title} (${slot(d.at, d.at).split(" ").slice(0, 3).join(" ")})`).join(", ")}`);
    }
    const left = leftToReview(i);
    if (left.total) lines.push(`À réviser : ${left.text}`);
    if (i.routine) { const n = itemsForDay(i.routine, now).length; if (n) lines.push(`Ma journée : ${plural(n, "tâche")}`); }
    if (lines.length) once(`matin|${day}`, { title: "Ta journée", body: lines.join("\n"), url: "./aujourdhui/", tag: "matin" });
  }

  // 4. Rappel du soir s'il reste des révisions.
  if (prefs.soir && now >= at(now, prefs.heureSoir) && now < at(now, prefs.heureSoir + 3)) {
    const left = leftToReview(i);
    if (left.total > 0) once(`soir|${day}`, { title: "Il reste des révisions", body: left.text, url: "./", tag: "soir" });
  }

  // 5. Bilan, adhkar et citations : mêmes moments et mêmes textes que sur le PC (heures de prière de Rayan's Prière).
  let bilanEnvoyes = i.state.bilan ?? [];
  if (i.bilan !== undefined && (prefs.adhkar || prefs.bilan || prefs.citations)) {
    const b = nettoyerBilan(i.bilan);
    const reglages = { ...b.reglages, actif: b.reglages.actif && prefs.bilan, adhkar: b.reglages.adhkar && prefs.adhkar, citations: b.reglages.citations && prefs.citations };
    const res = notificationsBilan({ ...b, reglages, envoyes: bilanEnvoyes }, now, i.prieres ?? null);
    bilanEnvoyes = res.data.envoyes;
    const obj = i.objectifs ? nettoyerObjectifs(i.objectifs).jours[journee(now)] ?? [] : [];
    for (const m of res.messages) {
      const corps = m.titre.startsWith("Bonjour") && obj.length ? `${m.corps}\nObjectifs : ${obj.map((o) => o.titre).join(" · ")}` : m.corps;
      const tag = m.titre.startsWith("Adhkar") ? "adhkar" : m.titre.startsWith("Bilan") ? "bilan" : m.titre.startsWith("Bonjour") ? "bonjour" : "citation";
      out.push({ title: m.titre, body: corps, url: "./aujourdhui/", tag });
    }
  }

  // On ne garde que les clés des 3 derniers jours.
  const keep = [day, todayISO(now - DAY), todayISO(now - 2 * DAY)];
  const pruned = [...sent].filter((k) => k.startsWith("cours|") || keep.some((d) => k.includes(`|${d}`)));
  return { messages: out, state: { lastRun: now, sent: pruned.slice(-500), bilan: bilanEnvoyes } };
}
