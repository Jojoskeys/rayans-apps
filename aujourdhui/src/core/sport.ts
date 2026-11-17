// Sport : programme de la semaine (4 séances de muscu + 3 courses orientées 5 km), séance du jour détaillée, saisie
// série par série, progression des charges, plan de course et créneau du jour selon l'emploi du temps.
//
// Les charges actuelles ne sont jamais stockées : elles sont recalculées en rejouant le journal des séances depuis
// les charges de départ. Le PC et l'iPhone n'ont qu'à réunir leurs journaux pour avoir les mêmes charges.
// Fonctions pures : la date, le journal et les cours sont passés en paramètre.

import { todayISO } from "./counts.ts";
import { EXERCICES } from "./exercices.ts";

// ----- Prescriptions -----------------------------------------------------------------------------------

/**
 * fixe : séries × reps fixes (4 × 5) → +incrément quand toutes les séries sont réussies.
 * plage : séries × [min, max] → +incrément quand toutes les séries atteignent le max.
 * volume : séries × reps au poids du corps → +1 rep par série quand tout est fait.
 * maintien : séries × secondes → +5 s quand tout est tenu.
 * Deux échecs de suite : on redescend (−5 % de la charge, −1 rep ou −5 s).
 */
export type Mode = "fixe" | "plage" | "volume" | "maintien";

export interface Bloc {
  ex: string;
  series: number;
  mode: Mode;
  /** Reps (fixe, volume), bornes [min, max] (plage) ou secondes (maintien). */
  reps?: number;
  plage?: [number, number];
  /** Repos entre les séries, en secondes. */
  repos: number;
  /** Incrément de charge (kg) ; volume : +1 rep ; maintien : +5 s. */
  increment?: number;
  /** Plafond (secondes pour un maintien, reps pour un volume). */
  plafond?: number;
  note?: string;
}

export type TypeSeance = "upper" | "leg" | "push" | "pull" | "fractionne" | "seuil" | "longue" | "repos";

export const NOMS_SEANCES: Record<TypeSeance, string> = {
  upper: "Haut du corps force (Upper Power)", leg: "Jambes (Leg)", push: "Poussée (Push)", pull: "Tirage (Pull)",
  fractionne: "Course : fractionné (vitesse 5 km)", seuil: "Course : allure seuil", longue: "Course : sortie longue facile", repos: "Repos",
};

/** Lundi → dimanche. */
export const SEMAINE: TypeSeance[] = ["upper", "leg", "fractionne", "push", "pull", "seuil", "longue"];

export const SEANCES: Record<"upper" | "leg" | "push" | "pull", Bloc[]> = {
  upper: [
    { ex: "echauffement-epaule", series: 1, mode: "volume", reps: 1, repos: 60, plafond: 1, note: "Avant tout le reste" },
    { ex: "developpe-couche", series: 4, mode: "fixe", reps: 5, repos: 180, increment: 2.5 },
    { ex: "tractions-lestees", series: 4, mode: "fixe", reps: 5, repos: 180, increment: 2.5 },
    { ex: "rowing-barre", series: 4, mode: "plage", plage: [8, 10], repos: 120, increment: 2.5 },
    { ex: "pompes", series: 2, mode: "volume", reps: 20, repos: 120, increment: 1, plafond: 50, note: "Endurance de poussée" },
    { ex: "planche", series: 3, mode: "maintien", reps: 60, repos: 60, plafond: 120 },
  ],
  leg: [
    { ex: "squat", series: 4, mode: "plage", plage: [6, 8], repos: 180, increment: 2.5 },
    { ex: "sdt-roumain", series: 3, mode: "plage", plage: [8, 10], repos: 150, increment: 2.5 },
    { ex: "fentes", series: 3, mode: "plage", plage: [10, 12], repos: 90, increment: 2 },
    { ex: "mollets", series: 3, mode: "plage", plage: [12, 15], repos: 60, increment: 4 },
    { ex: "pistol-squat", series: 3, mode: "volume", reps: 5, repos: 90, increment: 1, plafond: 10 },
  ],
  push: [
    { ex: "echauffement-epaule", series: 1, mode: "volume", reps: 1, repos: 60, plafond: 1, note: "Avant tout le reste" },
    { ex: "incline-halteres", series: 3, mode: "plage", plage: [8, 12], repos: 120, increment: 2 },
    { ex: "elevations-laterales", series: 3, mode: "plage", plage: [12, 15], repos: 60, increment: 1 },
    { ex: "pompes-volume", series: 4, mode: "volume", reps: 15, repos: 90, increment: 1, plafond: 40, note: "Volume de pompes, 2 reps avant l'échec" },
    { ex: "handstand-mur", series: 5, mode: "maintien", reps: 20, repos: 60, plafond: 60 },
    { ex: "hspu-assiste", series: 3, mode: "volume", reps: 3, repos: 120, increment: 1, plafond: 8 },
  ],
  pull: [
    { ex: "tractions-strictes", series: 5, mode: "volume", reps: 7, repos: 120, increment: 1, plafond: 15, note: "Ton max est 10 : séries de 7, sans aller à l'échec" },
    { ex: "rowing-appuye", series: 3, mode: "plage", plage: [10, 12], repos: 90, increment: 2 },
    { ex: "oiseau", series: 3, mode: "plage", plage: [12, 15], repos: 60, increment: 1 },
    { ex: "front-lever-tuck", series: 5, mode: "maintien", reps: 5, repos: 90, plafond: 20 },
    { ex: "muscle-up-transition", series: 3, mode: "volume", reps: 3, repos: 120, increment: 1, plafond: 6 },
  ],
};

/** Exercice sous un autre nom de bloc (pompes en volume le jeudi = mêmes pompes, progression séparée). */
export const ALIAS: Record<string, string> = { "pompes-volume": "pompes" };

/** Charges de départ (dernières charges notées avec le coach, et cibles « à reprendre »). */
export const DEPART: Record<string, { charge: number; reps: number }> = {
  "echauffement-epaule": { charge: 0, reps: 1 },
  "developpe-couche": { charge: 85, reps: 5 },
  "tractions-lestees": { charge: 15, reps: 5 },
  "rowing-barre": { charge: 80, reps: 8 },
  pompes: { charge: 0, reps: 20 },
  "pompes-volume": { charge: 0, reps: 15 },
  planche: { charge: 0, reps: 60 },
  squat: { charge: 80, reps: 6 },
  "sdt-roumain": { charge: 90, reps: 8 },
  fentes: { charge: 16, reps: 10 },
  mollets: { charge: 48, reps: 12 },
  "pistol-squat": { charge: 0, reps: 5 },
  "incline-halteres": { charge: 26, reps: 8 },
  "elevations-laterales": { charge: 10, reps: 12 },
  "handstand-mur": { charge: 0, reps: 20 },
  "hspu-assiste": { charge: 0, reps: 3 },
  "tractions-strictes": { charge: 0, reps: 7 },
  "rowing-appuye": { charge: 20, reps: 10 },
  oiseau: { charge: 10, reps: 12 },
  "front-lever-tuck": { charge: 0, reps: 5 },
  "muscle-up-transition": { charge: 0, reps: 3 },
};

// ----- Données ---------------------------------------------------------------------------------------------

export interface SerieFaite { charge: number; reps: number }

export interface SeanceFaite {
  id: string;
  /** Jour « AAAA-MM-JJ ». */
  jour: string;
  type: TypeSeance;
  /** Exercices : séries faites (reps = secondes pour un maintien). */
  exercices: { bloc: string; series: SerieFaite[] }[];
  course?: { distanceKm: number; dureeS: number; ressenti: "facile" | "correct" | "dur" };
  note?: string;
  at: number;
}

/** Performance de course (compétition ou test) pour estimer l'allure 5 km. */
export interface Perf { id: string; jour: string | null; distanceKm: number; dureeS: number; titre: string }

/** Correction à la main d'une charge (« le prochain squat à 77,5 kg »). */
export interface Ajustement { id: string; bloc: string; charge?: number; reps?: number; at: number }

export interface SportData {
  /** Lundi de la première semaine du plan (pour les cycles de course). */
  debut: string;
  journal: SeanceFaite[];
  perfs: Perf[];
  ajustements: Ajustement[];
}

export const SPORT_DEPART: SportData = {
  debut: "2026-11-16",
  journal: [],
  perfs: [
    { id: "p-10k-1", jour: null, distanceKm: 10.18, dureeS: 70 * 60, titre: "Premier 10 km (Strava)" },
    { id: "p-10k-paris", jour: "2026-11-15", distanceKm: 10.3, dureeS: 65 * 60 + 49, titre: "10 km de Paris" },
  ],
  ajustements: [],
};

// ----- Progression -------------------------------------------------------------------------------------------

export interface Prescription { charge: number; reps: number; echecs: number }

const arrondi = (x: number, pas: number) => Math.max(0, Math.round(x / pas) * pas);
const blocDe = (id: string): Bloc | undefined => Object.values(SEANCES).flat().find((b) => b.ex === id);

/** Une séance d'un exercice : réussie, ratée, ou entre les deux (on garde la même charge). */
export function verdict(b: Bloc, cible: Prescription, series: SerieFaite[]): "reussi" | "rate" | "tenu" {
  if (!series.length) return "tenu";
  const ok = series.length >= b.series;
  // Charge plus légère que prévu : ça ne compte pas comme une réussite.
  const chargeOk = series.every((s) => s.charge >= cible.charge - 0.01);
  if (b.mode === "plage") {
    const [min, max] = b.plage!;
    if (ok && chargeOk && series.every((s) => s.reps >= max)) return "reussi";
    if (series.some((s) => s.reps < min)) return "rate";
    return "tenu";
  }
  if (ok && chargeOk && series.every((s) => s.reps >= cible.reps)) return "reussi";
  const total = series.reduce((n, s) => n + s.reps, 0);
  return total < cible.reps * b.series * 0.8 ? "rate" : "tenu";
}

function suivante(b: Bloc, p: Prescription, v: "reussi" | "rate" | "tenu"): Prescription {
  if (v === "tenu") return p;
  if (v === "reussi") {
    if (b.mode === "fixe" || b.mode === "plage") return { charge: p.charge + (b.increment ?? 2.5), reps: b.mode === "plage" ? b.plage![0] : p.reps, echecs: 0 };
    if (b.mode === "volume") return { ...p, reps: Math.min(b.plafond ?? 99, p.reps + (b.increment ?? 1)), echecs: 0 };
    return { ...p, reps: Math.min(b.plafond ?? 600, p.reps + 5), echecs: 0 };
  }
  if (p.echecs + 1 < 2) return { ...p, echecs: p.echecs + 1 };
  if (b.mode === "fixe" || b.mode === "plage") return { charge: arrondi(p.charge * 0.95, b.increment ?? 2.5), reps: p.reps, echecs: 0 };
  if (b.mode === "volume") return { ...p, reps: Math.max(1, p.reps - 1), echecs: 0 };
  return { ...p, reps: Math.max(5, p.reps - 5), echecs: 0 };
}

/** Charges actuelles : charges de départ, puis chaque séance et chaque correction, dans l'ordre. */
export function prescriptions(d: SportData): Record<string, Prescription> {
  const out: Record<string, Prescription> = {};
  for (const [id, x] of Object.entries(DEPART)) out[id] = { ...x, echecs: 0 };
  const evts: { at: number; f: () => void }[] = [];
  for (const s of d.journal) {
    evts.push({ at: s.at, f: () => {
      for (const e of s.exercices) {
        const b = blocDe(e.bloc);
        if (!b || !out[e.bloc]) continue;
        out[e.bloc] = suivante(b, out[e.bloc], verdict(b, out[e.bloc], e.series));
      }
    } });
  }
  for (const a of d.ajustements) evts.push({ at: a.at, f: () => { if (out[a.bloc]) out[a.bloc] = { charge: a.charge ?? out[a.bloc].charge, reps: a.reps ?? out[a.bloc].reps, echecs: 0 }; } });
  evts.sort((a, b) => a.at - b.at).forEach((e) => e.f());
  return out;
}

// ----- Course : allures et plan 5 km ------------------------------------------------------------------------

/** Temps estimé sur 5 km à partir d'une perf (formule de Riegel : T2 = T1 × (D2 / D1)^1,06). */
export const riegel = (dureeS: number, distanceKm: number, cibleKm = 5) => dureeS * Math.pow(cibleKm / distanceKm, 1.06);

/** Meilleure estimation du 5 km : la plus rapide parmi les perfs et les tests des 120 derniers jours. */
export function estimation5k(d: SportData, now: number): { secondes: number; source: string } {
  const limite = todayISO(now - 120 * 86_400_000);
  const perfs: { s: number; titre: string }[] = d.perfs.filter((p) => !p.jour || p.jour >= limite).map((p) => ({ s: riegel(p.dureeS, p.distanceKm), titre: p.titre }));
  for (const s of d.journal) if (s.course && s.jour >= limite && s.type === "seuil" && s.course.distanceKm >= 4.9 && s.course.distanceKm <= 5.5) perfs.push({ s: riegel(s.course.dureeS, s.course.distanceKm), titre: `test 5 km du ${s.jour}` });
  const best = perfs.sort((a, b) => a.s - b.s)[0];
  return best ? { secondes: Math.round(best.s), source: best.titre } : { secondes: 32 * 60, source: "valeur de départ" };
}

export const allure = (sParKm: number) => `${Math.floor(sParKm / 60)}:${String(Math.round(sParKm % 60)).padStart(2, "0")}`;
export const duree = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  return h ? `${h} h ${String(m).padStart(2, "0")} min ${String(sec).padStart(2, "0")} s` : `${m} min ${String(sec).padStart(2, "0")} s`;
};

export interface Allures { cinqKm: number; facile: [number, number]; seuil: number; intervalle: number }

export function allures(d: SportData, now: number): Allures {
  const p = estimation5k(d, now).secondes / 5;
  return { cinqKm: p, facile: [p + 60, p + 85], seuil: p + 15, intervalle: p - 10 };
}

export interface PlanCourse { titre: string; etapes: string[]; dureeMin: number; distanceKm?: number; test?: boolean }

/** Semaine du plan (1, 2, 3…) : cycles de 4 semaines, la 4e allégée avec un test 5 km. */
export function semaineDuPlan(d: SportData, jour: string): number {
  const [a, m, j] = d.debut.split("-").map(Number);
  const [b, n, k] = jour.split("-").map(Number);
  const diff = Math.round((Date.UTC(b, n - 1, k) - Date.UTC(a, m - 1, j)) / 86_400_000);
  return Math.max(1, Math.floor(diff / 7) + 1);
}

export function planCourse(type: "fractionne" | "seuil" | "longue", d: SportData, jour: string, now: number): PlanCourse {
  const a = allures(d, now);
  const s = semaineDuPlan(d, jour);
  const cycle = Math.floor((s - 1) / 4); // 0, 1, 2…
  const dansCycle = ((s - 1) % 4) + 1; // 1 à 4
  const fac = `${allure(a.facile[0])} à ${allure(a.facile[1])} /km`;
  const echauf = `Échauffement : 10 min facile (${fac}) + 4 accélérations de 20 s`;
  const retour = "Retour au calme : 5 à 10 min très facile, puis étirements légers";
  if (type === "fractionne") {
    const series = [["6 × 400 m", "8 × 400 m", "5 × 600 m", "4 × 400 m"], ["5 × 800 m", "6 × 800 m", "4 × 1000 m", "4 × 400 m"], ["5 × 1000 m", "6 × 1000 m", "3 × 1600 m", "4 × 400 m"]][Math.min(cycle, 2)][dansCycle - 1];
    return {
      titre: `Fractionné : ${series}`, dureeMin: 50,
      etapes: [echauf, `${series} à ${allure(a.intervalle)} /km (plus vite que ton allure 5 km)`, "Récupération entre chaque : 1 min 30 en trottinant très lentement", retour],
    };
  }
  if (type === "seuil") {
    if (dansCycle === 4) {
      return { titre: "Test 5 km", test: true, dureeMin: 50, distanceKm: 5, etapes: [echauf, `5 km le plus vite possible en restant régulier (objectif : ${allure(a.cinqKm - 5)} /km)`, retour, "Note ta distance et ton temps : les allures se recalent sur ce test"] };
    }
    const bloc = [["3 × 8 min", "3 × 10 min", "2 × 15 min"], ["2 × 15 min", "3 × 12 min", "25 min continues"], ["3 × 12 min", "2 × 18 min", "30 min continues"]][Math.min(cycle, 2)][dansCycle - 1];
    return { titre: `Seuil : ${bloc}`, dureeMin: 55, etapes: [echauf, `${bloc} à ${allure(a.seuil)} /km (« confortablement difficile » : tu peux dire quelques mots)`, "Récupération entre les blocs : 2 min de marche ou trot", retour] };
  }
  const min = dansCycle === 4 ? 35 + cycle * 5 : Math.min(75, 40 + (dansCycle - 1) * 5 + cycle * 5);
  return { titre: `Sortie longue : ${min} min`, dureeMin: min, etapes: [`${min} min à ${fac}, en aisance respiratoire (tu peux parler)`, "Si besoin : 4 min de course / 1 min de marche, comme avant", "Pas de chrono à battre : c'est le volume qui fait progresser le 5 km"] };
}

// ----- Séance du jour --------------------------------------------------------------------------------------------

/** Lundi = 0 … dimanche = 6. */
export const jourSemaine = (jour: string) => { const [a, m, j] = jour.split("-").map(Number); return (new Date(a, m - 1, j).getDay() + 6) % 7; };

export interface SeanceDuJour {
  jour: string;
  type: TypeSeance;
  titre: string;
  blocs: (Bloc & { prescription: Prescription; nom: string })[];
  course?: PlanCourse;
  faite: SeanceFaite | null;
  dureeMin: number;
}

export function seanceDuJour(d: SportData, jour: string, now: number): SeanceDuJour {
  const type = SEMAINE[jourSemaine(jour)];
  const faite = [...d.journal].reverse().find((s) => s.jour === jour && s.type === type) ?? null;
  if (type === "fractionne" || type === "seuil" || type === "longue") {
    const course = planCourse(type, d, jour, now);
    return { jour, type, titre: course.titre, blocs: [], course, faite, dureeMin: course.dureeMin };
  }
  if (type === "repos") return { jour, type, titre: "Repos", blocs: [], faite, dureeMin: 0 };
  // Si la séance du jour est déjà faite, on montre ce qui était prévu (prescriptions d'avant la séance).
  const pres = prescriptions(faite ? { ...d, journal: d.journal.filter((s) => s.at < faite.at) } : d);
  const blocs = SEANCES[type].map((b) => ({ ...b, prescription: pres[b.ex], nom: nomBloc(b.ex) }));
  return { jour, type, titre: NOMS_SEANCES[type], blocs, faite, dureeMin: 75 };
}

export const nomBloc = (id: string) => (ALIAS[id] ? `${EXERCICES[ALIAS[id]].nom} (volume)` : EXERCICES[id]?.nom ?? id);

/** Ajoute une séance faite (remplace celle du même jour et du même type). */
export function enregistrer(d: SportData, s: SeanceFaite): SportData {
  return { ...d, journal: [...d.journal.filter((x) => !(x.jour === s.jour && x.type === s.type) && x.id !== s.id), s].sort((a, b) => a.at - b.at) };
}

export function ajouterPerf(d: SportData, p: Perf): SportData {
  if (!(p.distanceKm > 0) || !(p.dureeS > 0)) throw new Error("distance et temps nécessaires");
  return { ...d, perfs: [...d.perfs.filter((x) => x.id !== p.id), p] };
}

export function ajuster(d: SportData, a: Ajustement): SportData {
  return { ...d, ajustements: [...d.ajustements, a] };
}

// ----- Créneau selon l'emploi du temps ------------------------------------------------------------------------

export interface Occupation { start: number; end: number }

/**
 * Premier créneau libre assez long ce jour-là, en gardant 20 min avant et après chaque cours (trajet, se changer).
 * En semaine à partir de 7 h, le week-end à partir de 9 h 30 ; jusqu'à 21 h 30.
 */
export function creneau(jour: string, dureeMin: number, cours: Occupation[], now?: number): { debut: number; fin: number } | null {
  if (dureeMin <= 0) return null;
  const [a, m, j] = jour.split("-").map(Number);
  const h = (hh: number, mm = 0) => new Date(a, m - 1, j, hh, mm).getTime();
  const weekend = jourSemaine(jour) >= 5;
  let t = weekend ? h(9, 30) : h(7);
  if (now !== undefined && todayISO(now) === jour) t = Math.max(t, Math.ceil(now / (15 * 60_000)) * 15 * 60_000);
  const fin = h(21, 30);
  const marge = 20 * 60_000;
  const occ = cours.filter((c) => c.end > h(0) && c.start < h(24)).map((c) => ({ start: c.start - marge, end: c.end + marge })).sort((x, y) => x.start - y.start);
  for (const c of occ) {
    if (c.start - t >= dureeMin * 60_000) break;
    t = Math.max(t, c.end);
  }
  return t + dureeMin * 60_000 <= fin ? { debut: t, fin: t + dureeMin * 60_000 } : null;
}

export function nettoyerSport(raw: unknown): SportData {
  const r = (raw ?? {}) as Partial<SportData>;
  const arr = <T>(v: unknown, ok: (x: any) => boolean): T[] => (Array.isArray(v) ? v.filter(ok) : []);
  return {
    debut: typeof r.debut === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.debut) ? r.debut : SPORT_DEPART.debut,
    journal: arr<SeanceFaite>(r.journal, (x) => x && typeof x.id === "string" && typeof x.jour === "string" && Array.isArray(x.exercices)).sort((a, b) => a.at - b.at),
    perfs: Array.isArray(r.perfs) ? arr<Perf>(r.perfs, (x) => x && typeof x.id === "string" && x.distanceKm > 0 && x.dureeS > 0) : SPORT_DEPART.perfs,
    ajustements: arr<Ajustement>(r.ajustements, (x) => x && typeof x.id === "string" && typeof x.bloc === "string"),
  };
}

/** Ligne pour le rappel du matin : « Sport : Poussée (Push) à 18 h 40 ». */
export function ligneSport(d: SportData, jour: string, cours: Occupation[], now: number): string | null {
  const s = seanceDuJour(d, jour, now);
  if (s.type === "repos" || s.faite) return null;
  const c = creneau(jour, s.dureeMin, cours);
  const hm = (ms: number) => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", " h ");
  return `Sport : ${s.titre}${c ? ` à ${hm(c.debut)}` : " (pas de créneau libre aujourd'hui)"}`;
}
