// Bilan quotidien et adhkar :
//   - le matin, à Fajr (Sobh) : adhkar as-sabâh, puis « comment je me sens aujourd'hui » ;
//   - entre Asr et Maghrib : adhkar al-masâ' (rappel avant Maghrib, et un dernier juste avant s'ils ne sont pas faits) ;
//   - le soir (17 h 30 par défaut) : comment s'est passée la journée, comment je me sens, ce que je veux faire demain.
// Ce qui est noté pour demain devient, le lendemain, une liste à cocher.
// Fonctions pures : l'heure, les heures de prière et les données sont passées en paramètre.

import { todayISO } from "./counts.ts";
import { citationsDuJour, formater } from "./citations.ts";

export interface EntreeMatin { humeur: number; ressenti: string; at: number }
export interface EntreeSoir { humeur: number; journee: string; ressenti: string; at: number }
export interface APrevoir { id: string; texte: string; fait: boolean }

export interface JourBilan {
  matin?: EntreeMatin;
  soir?: EntreeSoir;
  /** Ce qui est prévu pour ce jour-là (noté la veille au soir). */
  prevu?: APrevoir[];
  adhkar?: { sabah?: number; masa?: number };
}

export interface ReglagesBilan {
  actif: boolean;
  /** Bilan du soir (heure locale). */
  soirH: number;
  soirM: number;
  adhkar: boolean;
  /** Minutes après Fajr pour le rappel du matin. */
  apresFajr: number;
  /** Minutes avant Maghrib pour le rappel des adhkar du soir. */
  avantMaghrib: number;
  /** Heure du rappel du matin si les heures de prière sont inconnues. */
  matinSecoursH: number;
  /** Citation du jour le matin et à midi. */
  citations: boolean;
  citationMatinH: number;
  citationMatinM: number;
  citationMidiH: number;
  citationMidiM: number;
}

export interface BilanData {
  /** Jour civil « AAAA-MM-JJ » → bilan. Gardé 365 jours. */
  jours: Record<string, JourBilan>;
  envoyes: string[];
  reglages: ReglagesBilan;
}

export const REGLAGES_BILAN: ReglagesBilan = { actif: true, soirH: 17, soirM: 30, adhkar: true, apresFajr: 10, avantMaghrib: 40, matinSecoursH: 7, citations: true, citationMatinH: 8, citationMatinM: 0, citationMidiH: 12, citationMidiM: 30 };
export const BILAN_VIDE: BilanData = { jours: {}, envoyes: [], reglages: { ...REGLAGES_BILAN } };
export const HUMEURS = ["😞", "🙁", "😐", "🙂", "😄"];

/** Heures de prière du jour (instants en ms), d'après Rayan's Prière ; null si inconnues. */
export interface Prieres { fajr: number; lever: number; asr: number; maghrib: number }

const GARDER = 365;
const H = 3_600_000;
const M = 60_000;

function veille(jour: string): string {
  const [a, m, j] = jour.split("-").map(Number);
  return todayISO(new Date(a, m - 1, j - 1, 12).getTime());
}
function lendemain(jour: string): string {
  const [a, m, j] = jour.split("-").map(Number);
  return todayISO(new Date(a, m - 1, j + 1, 12).getTime());
}
const heure = (ms: number) => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", " h ");
const borner = (n: unknown, min: number, max: number, d: number) => (typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : d);
const nettoyerTexte = (t: unknown, max = 4000) => (typeof t === "string" ? t.slice(0, max) : "");

function majJour(d: BilanData, jour: string, f: (j: JourBilan) => JourBilan): BilanData {
  const limite = todayISO(new Date(jour).getTime() - GARDER * 86_400_000);
  const jours: Record<string, JourBilan> = {};
  for (const [k, v] of Object.entries(d.jours)) if (k >= limite) jours[k] = v;
  jours[jour] = f(jours[jour] ?? {});
  return { ...d, jours };
}

export function noterMatin(d: BilanData, now: number, humeur: number, ressenti: string): BilanData {
  if (!(humeur >= 1 && humeur <= 5)) throw new Error("Choisis comment tu te sens.");
  return majJour(d, todayISO(now), (j) => ({ ...j, matin: { humeur, ressenti: nettoyerTexte(ressenti), at: now } }));
}

/** Bilan du soir ; `demain` devient la liste prévue pour le lendemain (remplace celle déjà notée ce soir). */
export function noterSoir(d: BilanData, now: number, humeur: number, journee: string, ressenti: string, demain: string[]): BilanData {
  if (!(humeur >= 1 && humeur <= 5)) throw new Error("Choisis comment tu te sens.");
  const jour = todayISO(now);
  let next = majJour(d, jour, (j) => ({ ...j, soir: { humeur, journee: nettoyerTexte(journee), ressenti: nettoyerTexte(ressenti), at: now } }));
  const lignes = demain.map((t) => t.trim()).filter(Boolean).slice(0, 20);
  const demainJour = lendemain(jour);
  next = majJour(next, demainJour, (j) => {
    const anciens = new Map((j.prevu ?? []).map((p) => [p.texte, p]));
    return { ...j, prevu: lignes.map((t, i) => anciens.get(t) ?? { id: `${demainJour}-${i}-${t.length}`, texte: t.slice(0, 300), fait: false }) };
  });
  return next;
}

export function cocherPrevu(d: BilanData, now: number, id: string): BilanData {
  return majJour(d, todayISO(now), (j) => ({ ...j, prevu: (j.prevu ?? []).map((p) => (p.id === id ? { ...p, fait: !p.fait } : p)) }));
}

export function cocherAdhkar(d: BilanData, now: number, quand: "sabah" | "masa"): BilanData {
  return majJour(d, todayISO(now), (j) => {
    const a = { ...(j.adhkar ?? {}) };
    if (a[quand]) delete a[quand];
    else a[quand] = now;
    return { ...j, adhkar: a };
  });
}

export function reglerBilan(d: BilanData, r: Partial<ReglagesBilan>): BilanData {
  const c = { ...d.reglages, ...r };
  return {
    ...d,
    reglages: {
      actif: !!c.actif,
      soirH: borner(c.soirH, 0, 23, REGLAGES_BILAN.soirH),
      soirM: borner(c.soirM, 0, 59, REGLAGES_BILAN.soirM),
      adhkar: !!c.adhkar,
      apresFajr: borner(c.apresFajr, 0, 90, REGLAGES_BILAN.apresFajr),
      avantMaghrib: borner(c.avantMaghrib, 5, 180, REGLAGES_BILAN.avantMaghrib),
      matinSecoursH: borner(c.matinSecoursH, 4, 11, REGLAGES_BILAN.matinSecoursH),
      citations: c.citations !== false,
      citationMatinH: borner(c.citationMatinH, 4, 11, REGLAGES_BILAN.citationMatinH),
      citationMatinM: borner(c.citationMatinM, 0, 59, REGLAGES_BILAN.citationMatinM),
      citationMidiH: borner(c.citationMidiH, 11, 15, REGLAGES_BILAN.citationMidiH),
      citationMidiM: borner(c.citationMidiM, 0, 59, REGLAGES_BILAN.citationMidiM),
    },
  };
}

export function nettoyerBilan(raw: unknown): BilanData {
  const r = (raw ?? {}) as Partial<BilanData>;
  const jours: Record<string, JourBilan> = {};
  if (r.jours && typeof r.jours === "object") {
    for (const [k, v] of Object.entries(r.jours)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== "object") continue;
      const j: JourBilan = {};
      if (v.matin && typeof v.matin.humeur === "number") j.matin = { humeur: v.matin.humeur, ressenti: nettoyerTexte(v.matin.ressenti), at: Number(v.matin.at) || 0 };
      if (v.soir && typeof v.soir.humeur === "number") j.soir = { humeur: v.soir.humeur, journee: nettoyerTexte(v.soir.journee), ressenti: nettoyerTexte(v.soir.ressenti), at: Number(v.soir.at) || 0 };
      if (Array.isArray(v.prevu)) j.prevu = v.prevu.filter((p) => p && typeof p.id === "string" && typeof p.texte === "string").map((p) => ({ id: p.id, texte: p.texte, fait: !!p.fait }));
      if (v.adhkar && typeof v.adhkar === "object") j.adhkar = { ...(typeof v.adhkar.sabah === "number" ? { sabah: v.adhkar.sabah } : {}), ...(typeof v.adhkar.masa === "number" ? { masa: v.adhkar.masa } : {}) };
      jours[k] = j;
    }
  }
  return reglerBilan({ jours, envoyes: Array.isArray(r.envoyes) ? r.envoyes.filter((x) => typeof x === "string") : [], reglages: { ...REGLAGES_BILAN } }, r.reglages ?? {});
}

// ----- Moments de la journée --------------------------------------------------------------------------

export interface Moments {
  /** Rappel du matin (adhkar as-sabâh + ressenti). */
  matin: number;
  /** Rappel des adhkar du soir, et dernier rappel juste avant Maghrib ; null sans heures de prière. */
  masa: number | null;
  masaDernier: number | null;
  /** Fin de la période des adhkar du matin (lever du soleil) et du soir (Maghrib). */
  finSabah: number | null;
  debutMasa: number | null;
  finMasa: number | null;
  soir: number;
}

export function moments(d: BilanData, now: number, p: Prieres | null): Moments {
  const n = new Date(now);
  const a = (h: number, m = 0) => new Date(n.getFullYear(), n.getMonth(), n.getDate(), h, m).getTime();
  const r = d.reglages;
  const masa = p ? Math.max(p.asr + 5 * M, p.maghrib - r.avantMaghrib * M) : null;
  return {
    matin: p ? p.fajr + r.apresFajr * M : a(r.matinSecoursH),
    masa,
    masaDernier: p ? p.maghrib - 10 * M : null,
    finSabah: p ? p.lever : null,
    debutMasa: p ? p.asr : null,
    finMasa: p ? p.maghrib : null,
    soir: a(r.soirH, r.soirM),
  };
}

/** Ce que la vue du jour doit proposer de remplir maintenant. */
export function aRemplir(d: BilanData, now: number, p: Prieres | null): { matin: boolean; soir: boolean } {
  if (!d.reglages.actif) return { matin: false, soir: false };
  const j = d.jours[todayISO(now)] ?? {};
  const m = moments(d, now, p);
  const midi = new Date(now);
  midi.setHours(13, 0, 0, 0);
  return {
    matin: !j.matin && now >= m.matin - 30 * M && now < midi.getTime(),
    soir: !j.soir && now >= m.soir - 60 * M,
  };
}

// ----- Notifications ----------------------------------------------------------------------------------

export interface Message { titre: string; corps: string }

/**
 * Notifications à envoyer maintenant (chacune une fois par jour, et seulement si son moment est passé depuis
 * moins de 3 h : un PC allumé tard ne reçoit pas le rappel du matin à 22 h).
 */
export function notificationsBilan(d: BilanData, now: number, p: Prieres | null): { data: BilanData; messages: Message[] } {
  if (!d.reglages.actif && !d.reglages.adhkar && !d.reglages.citations) return { data: d, messages: [] };
  const jour = todayISO(now);
  const j = d.jours[jour] ?? {};
  const m = moments(d, now, p);
  const envoyes = new Set(d.envoyes);
  const messages: Message[] = [];
  const du = (cle: string, at: number | null, fin = 3 * H) => at !== null && now >= at && now < at + fin && !envoyes.has(`${jour}|${cle}`);
  const marquer = (cle: string) => envoyes.add(`${jour}|${cle}`);

  // Matin, après Fajr : adhkar as-sabâh, puis ressenti du jour (et ce qui a été prévu hier soir).
  if (du("matin", m.matin)) {
    marquer("matin");
    const lignes: string[] = [];
    if (d.reglages.adhkar && !j.adhkar?.sabah) lignes.push(`Adhkar as-sabâh${m.finSabah ? ` (avant le lever du soleil, ${heure(m.finSabah)})` : ""}.`);
    if (d.reglages.actif && !j.matin) lignes.push("Comment tu te sens aujourd'hui ? Écris-le dans Rayan's Aujourd'hui.");
    const prevu = (j.prevu ?? []).filter((x) => !x.fait);
    if (d.reglages.actif && prevu.length) lignes.push(`Prévu hier soir : ${prevu.map((x) => x.texte).join(" · ")}`);
    if (lignes.length) messages.push({ titre: "Bonjour : début de journée", corps: lignes.join("\n") });
  }
  // Adhkar al-masâ', entre Asr et Maghrib.
  if (d.reglages.adhkar && m.masa !== null && m.finMasa !== null) {
    if (du("masa", m.masa, Math.max(0, m.finMasa - m.masa)) && !j.adhkar?.masa) {
      marquer("masa");
      messages.push({ titre: "Adhkar al-masâ'", corps: `Entre Asr et Maghrib : Maghrib à ${heure(m.finMasa)}.` });
    } else if (du("masa-dernier", m.masaDernier, 10 * M) && !j.adhkar?.masa) {
      marquer("masa-dernier");
      messages.push({ titre: "Adhkar al-masâ' : dernier rappel", corps: `Maghrib dans 10 minutes (${heure(m.finMasa)}).` });
    }
  }
  // Citations du jour : le matin pour bien commencer, à midi pour garder le cap.
  if (d.reglages.citations) {
    const n = new Date(now);
    const a = (h: number, mi: number) => new Date(n.getFullYear(), n.getMonth(), n.getDate(), h, mi).getTime();
    const c = citationsDuJour(jour);
    if (du("citation-matin", a(d.reglages.citationMatinH, d.reglages.citationMatinM))) {
      marquer("citation-matin");
      messages.push({ titre: "Citation du jour ☀️", corps: formater(c.matin) });
    }
    if (du("citation-midi", a(d.reglages.citationMidiH, d.reglages.citationMidiM))) {
      marquer("citation-midi");
      messages.push({ titre: "Pour bien continuer la journée", corps: formater(c.midi) });
    }
  }
  // Soir : bilan de la journée et ce qu'il y a à faire demain.
  if (d.reglages.actif && du("soir", m.soir) && !j.soir) {
    marquer("soir");
    messages.push({ titre: "Bilan du soir", corps: "Comment s'est passée ta journée ? Comment tu te sens ? Note ce que tu veux faire demain." });
  }
  const data = envoyes.size !== d.envoyes.length ? { ...d, envoyes: [...envoyes].filter((e) => e.slice(0, 10) >= veille(veille(jour))) } : d;
  return { data, messages };
}
