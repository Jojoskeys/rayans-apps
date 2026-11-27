// Mécanique des exercices : pages, vitesse, questions, résumé, plan, survol et lecture mot à mot (RSVP).
import { pick, shuffle, type Rng } from "./rng.ts";
import type { Idee, Question, Texte } from "./types.ts";

// ----- Lecture paginée (pas de défilement : Delgado et al. 2018) --------------------------------------------
export interface Bloc { sorte: "titre" | "para"; texte: string }
export type PageTexte = Bloc[];

const nbMots = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** Découpe le texte en pages d'environ `motsParPage` mots, sans couper un paragraphe. */
export function paginer(t: Texte, motsParPage = 170): PageTexte[] {
  const pages: PageTexte[] = [];
  let page: PageTexte = [];
  let mots = 0;
  for (const p of t.parties)
    p.paragraphes.forEach((para, i) => {
      const n = nbMots(para);
      if (page.length > 0 && mots + n > motsParPage) {
        pages.push(page);
        page = [];
        mots = 0;
      }
      if (i === 0) page.push({ sorte: "titre", texte: p.titre });
      page.push({ sorte: "para", texte: para });
      mots += n;
    });
  if (page.length) pages.push(page);
  return pages;
}

/** Mots par minute. */
export function motsParMinute(mots: number, ms: number): number {
  return ms <= 0 ? 0 : Math.round(mots / (ms / 60_000));
}

/** Score efficace = mots par minute × part comprise (0 à 1) : les « mots compris par minute ». */
export const scoreEfficace = (mpm: number, comprehension: number): number => Math.round(mpm * comprehension);

/** En dessous de 70 % de compréhension, la vitesse ne veut plus dire grand-chose. */
export const SEUIL_ALERTE = 0.7;
export const tropVite = (comprehension: number): boolean => comprehension < SEUIL_ALERTE;

/** Repère de Brysbaert (2019) : adultes, lecture silencieuse, non-fiction, en anglais. Pas une norme. */
export const REPERE_MPM = 238;

// ----- Questions --------------------------------------------------------------------------------------------
export interface QuestionAffichee { q: string; choix: string[]; bonne: number; sorte: Question["sorte"]; explication: string }

/** Mélange les choix (la bonne réponse est écrite en premier dans les données). */
export function preparerQuestion(q: Question, rng: Rng): QuestionAffichee {
  const ordre = shuffle(rng, q.choix.map((_, i) => i));
  return { q: q.q, choix: ordre.map((i) => q.choix[i]), bonne: ordre.indexOf(0), sorte: q.sorte, explication: q.explication };
}

export const preparerQuestions = (t: Texte, rng: Rng): QuestionAffichee[] => t.questions.map((q) => preparerQuestion(q, rng));

export function corriger(qs: QuestionAffichee[], reponses: (number | null)[]): { bonnes: number; total: number; part: number } {
  const bonnes = qs.filter((q, i) => reponses[i] === q.bonne).length;
  return { bonnes, total: qs.length, part: qs.length ? bonnes / qs.length : 0 };
}

// ----- Résumé de mémoire ------------------------------------------------------------------------------------
export function sansAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function decouperMots(s: string): string[] {
  return sansAccents(s).split(/[^\p{L}\p{N},]+/u).map((w) => w.replace(/^,+|,+$/g, "")).filter(Boolean);
}

/** Nombre de phrases (terminées ou non par un point). */
export function compterPhrases(s: string): number {
  return s.split(/[.!?…]+/).filter((p) => /\p{L}/u.test(p)).length;
}

/**
 * Pré-cochage simple : une idée est repérée si au moins 2 de ses débuts de mots (1 s'il n'y en a qu'un) apparaissent
 * dans le résumé, ou un seul s'il est long et donc précis (6 lettres ou plus, ex. « gestionnair »).
 * Ce n'est qu'une aide : c'est toi qui confirmes.
 */
export const MOT_PRECIS = 6;

export function detecterIdees(resume: string, idees: Idee[]): boolean[] {
  const mots = decouperMots(resume);
  return idees.map((idee) => {
    const trouves = idee.mots.map(sansAccents).filter((kk) => mots.some((m) => m.startsWith(kk)));
    return trouves.length >= Math.min(2, idee.mots.length) || trouves.some((kk) => kk.length >= MOT_PRECIS);
  });
}

// ----- Repérer le plan --------------------------------------------------------------------------------------
export interface ExercicePlan {
  /** Indices des parties, dans l'ordre mélangé où les titres sont proposés. */
  titres: number[];
  /** Extraits de paragraphes à rattacher à leur partie. */
  extraits: { texte: string; partie: number }[];
}

export function extrait(p: string, mots = 24): string {
  const w = p.split(/\s+/);
  return w.length <= mots ? p : `${w.slice(0, mots).join(" ")}…`;
}

export function exercicePlan(t: Texte, rng: Rng, nbExtraits = 4): ExercicePlan {
  let titres = shuffle(rng, t.parties.map((_, i) => i));
  if (titres.every((x, i) => x === i) && titres.length > 1) titres = [...titres.slice(1), titres[0]];
  // Un paragraphe (pas le premier si possible) de parties différentes.
  const parties = shuffle(rng, t.parties.map((_, i) => i)).slice(0, Math.min(nbExtraits, t.parties.length));
  const extraits = parties.map((i) => {
    const ps = t.parties[i].paragraphes;
    return { texte: extrait(ps.length > 1 ? pick(rng, ps) : ps[0]), partie: i };
  });
  return { titres, extraits };
}

/** Score du plan : chaque titre à la bonne place et chaque extrait bien rattaché compte un point. */
export function scorePlan(ex: ExercicePlan, ordre: number[], rattaches: (number | null)[]): { points: number; max: number; part: number } {
  const ordreOk = ordre.filter((p, i) => p === i).length;
  const rattOk = ex.extraits.filter((e, i) => rattaches[i] === e.partie).length;
  const max = ex.titres.length + ex.extraits.length;
  return { points: ordreOk + rattOk, max, part: max ? (ordreOk + rattOk) / max : 0 };
}

// ----- Survol (écrémage) ------------------------------------------------------------------------------------
export const SURVOL_SECONDES = 60;

export function contenuSurvol(t: Texte): { intro: string; titres: string[]; conclusion: string } {
  const paras = t.parties.flatMap((p) => p.paragraphes);
  return { intro: paras[0], titres: t.parties.map((p) => p.titre), conclusion: paras[paras.length - 1] };
}

/** Trois questions générales : le sujet, une partie du plan, une idée clé ; les autres choix viennent d'autres textes. */
export function questionsSurvol(t: Texte, autres: Texte[], rng: Rng): Question[] {
  const leurres = shuffle(rng, autres.filter((a) => a.id !== t.id)).slice(0, 3);
  return [
    { q: "De quoi parle ce texte ?", choix: [t.sujet, ...leurres.map((a) => a.sujet)], sorte: "litterale", explication: `Le sujet : ${t.sujet}` },
    { q: "Lequel de ces titres est une partie du texte ?", choix: [pick(rng, t.parties).titre, ...leurres.map((a) => pick(rng, a.parties).titre)], sorte: "litterale", explication: `Les parties : ${t.parties.map((p) => p.titre).join(" · ")}.` },
    { q: "Quelle idée appartient à ce texte ?", choix: [pick(rng, t.idees).texte, ...leurres.map((a) => pick(rng, a.idees).texte)], sorte: "inference", explication: "L'introduction, les titres et la conclusion suffisent souvent à deviner les idées principales." },
  ];
}

// ----- Lecture mot à mot (RSVP) -----------------------------------------------------------------------------
/** Paliers de vitesse, en mots par minute : chaque essai passe au palier suivant. */
export const PALIERS_RSVP = [300, 450, 600, 800, 1000];

export const motsRsvp = (t: Texte): string[] => t.parties.flatMap((p) => p.paragraphes).join(" ").split(/\s+/).filter(Boolean);

/** Délai d'affichage d'un mot (ms) à une vitesse donnée. Les 10 premiers mots sont un peu plus lents pour démarrer. */
export function delaiMot(mpm: number, index: number): number {
  const base = 60_000 / mpm;
  return index < 10 ? base * (1.5 - index * 0.05) : base;
}

/** Palier du prochain essai RSVP, d'après le nombre d'essais déjà faits. */
export const palierSuivant = (essais: number): number => PALIERS_RSVP[essais % PALIERS_RSVP.length];
