// Séance du jour, choix des textes (pas de relecture avant 30 jours), tests, série et statistiques.
import { mediane } from "./niveaux.ts";
import { dayKey, joursEntre, type Db, type Resultat } from "./model.ts";
import { makeRng, pick } from "./rng.ts";
import { TESTS, TEXTES, textesDuNiveau } from "./textes.ts";
import type { Niveau, Texte } from "./types.ts";

export type Etape = "lecture" | "resume" | "plan" | "survol";

export const NOM_ETAPE: Record<Etape, string> = {
  lecture: "Avant de lire, lecture chronométrée et questions",
  resume: "Résumé de mémoire",
  plan: "Repérer le plan",
  survol: "Survol en 60 s",
};

export const JOURS_SANS_RELIRE = 30;
const JOUR_MS = 86400_000;

/** Numéro d'un jour (AAAA-MM-JJ), pour alterner plan et survol. */
export const numeroJour = (jour: string): number => joursEntre("2024-01-01", jour);

/** Étapes de la séance selon sa durée ; plan et survol reviennent en alternance certains jours. */
export function etapesDuJour(minutes: number, jour: string): Etape[] {
  const n = numeroJour(jour);
  const alterne: Etape = Math.floor(n / 2) % 2 === 0 ? "plan" : "survol";
  if (minutes <= 5) return ["lecture"];
  if (minutes <= 10) return n % 2 === 0 ? ["lecture", "resume", alterne] : ["lecture", "resume"];
  if (minutes <= 15) return ["lecture", "resume", n % 2 === 0 ? "plan" : "survol"];
  return ["lecture", "resume", "plan", "survol"];
}

/** Graine stable pour un jour : le même jour propose le même texte. */
export function graine(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Dernière fois que chaque texte a été lu (tous exercices confondus). */
export function dernieresLectures(db: Db): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of db.resultats) if ((m.get(r.texteId) ?? 0) < r.at) m.set(r.texteId, r.at);
  return m;
}

/**
 * Choisit un texte d'entraînement du niveau voulu, jamais lu depuis 30 jours si possible (sinon le moins récent).
 * `court` : parmi les textes les plus courts du niveau (séance de 5 minutes).
 */
export function choisirTexte(db: Db, niveau: Niveau, now: number, cle: string, exclure: string[] = [], court = false): Texte {
  const lus = dernieresLectures(db);
  let candidats = textesDuNiveau(niveau).filter((t) => !exclure.includes(t.id));
  if (!candidats.length) candidats = TEXTES.filter((t) => !exclure.includes(t.id));
  if (court) candidats = [...candidats].sort((a, b) => a.mots - b.mots).slice(0, Math.max(2, Math.ceil(candidats.length / 2)));
  const frais = candidats.filter((t) => now - (lus.get(t.id) ?? -Infinity) >= JOURS_SANS_RELIRE * JOUR_MS);
  if (frais.length) return pick(makeRng(graine(cle)), frais);
  return [...candidats].sort((a, b) => (lus.get(a.id) ?? 0) - (lus.get(b.id) ?? 0))[0];
}

export const duJour = (db: Db, r: Resultat, jour: string) => dayKey(r.at, db.reglages.heureJour) === jour;

export interface SeanceDuJour {
  jour: string;
  etapes: Etape[];
  faites: string[];
  texte: Texte;
  texteSurvol: Texte;
}

export function seanceDuJour(db: Db, now: number): SeanceDuJour {
  const jour = dayKey(now, db.reglages.heureJour);
  const etapes = etapesDuJour(db.reglages.minutes, jour);
  const faites = db.seances[jour]?.etapes ?? [];
  const lu = db.resultats.find((r) => r.seance && r.exo === "lecture" && duJour(db, r, jour));
  const texte = (lu && TEXTES.find((t) => t.id === lu.texteId))
    || choisirTexte(db, db.niveaux.lecture.level, now, `${jour}-lecture`, [], db.reglages.minutes <= 5);
  const survole = db.resultats.find((r) => r.seance && r.exo === "survol" && duJour(db, r, jour));
  const texteSurvol = (survole && TEXTES.find((t) => t.id === survole.texteId))
    || choisirTexte(db, db.niveaux.survol.level, now, `${jour}-survol`, [texte.id]);
  return { jour, etapes, faites, texte, texteSurvol };
}

/** Vitesse habituelle : médiane des 10 dernières lectures chronométrées (et tests). */
export function vitesseMediane(db: Db): number | null {
  const v = db.resultats.filter((r) => (r.exo === "lecture" || r.exo === "test") && typeof r.mpm === "number").slice(-10).map((r) => r.mpm!);
  return v.length >= 3 ? mediane(v) : null;
}

/** Jours de suite avec au moins un exercice, jusqu'à aujourd'hui (ou hier si rien encore aujourd'hui). */
export function serie(db: Db, now: number): number {
  const jours = new Set(db.resultats.map((r) => dayKey(r.at, db.reglages.heureJour)));
  let jour = dayKey(now, db.reglages.heureJour);
  if (!jours.has(jour)) jour = dayKey(now - JOUR_MS, db.reglages.heureJour);
  let n = 0;
  while (jours.has(jour)) {
    n++;
    jour = dayKey(new Date(+jour.slice(0, 4), +jour.slice(5, 7) - 1, +jour.slice(8, 10), 12).getTime() - JOUR_MS, 0);
  }
  return n;
}

export const resultatsTests = (db: Db): Resultat[] => db.resultats.filter((r) => r.exo === "test").sort((a, b) => a.at - b.at);

/** Test à proposer : départ s'il n'a jamais été fait, sinon suivi une fois par semaine (textes réservés, en rotation). */
export function testAFaire(db: Db, now: number): { sorte: "depart" | "suivi"; texte: Texte } | null {
  const tests = resultatsTests(db);
  if (!tests.length) return { sorte: "depart", texte: TESTS[0] };
  const dernier = tests[tests.length - 1];
  if (joursEntre(dayKey(dernier.at, db.reglages.heureJour), dayKey(now, db.reglages.heureJour)) < 7) return null;
  return { sorte: "suivi", texte: TESTS[tests.length % TESTS.length] };
}

/** Jours avant le prochain test de suivi (0 = disponible). */
export function joursAvantTest(db: Db, now: number): number {
  const tests = resultatsTests(db);
  if (!tests.length) return 0;
  const d = joursEntre(dayKey(tests[tests.length - 1].at, db.reglages.heureJour), dayKey(now, db.reglages.heureJour));
  return Math.max(0, 7 - d);
}
