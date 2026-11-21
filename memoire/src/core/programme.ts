// Programme de 6 semaines (inspiré de Dresler et al. 2017, Neuron) et séance guidée du jour.
// Séance de 15 min : échauffement (2) → révisions espacées (3) → technique du jour (6) → pause calme (1)
// → rappel sans aide (2) → bilan (1). En 5 min : échauffement court + révisions ; en 30 min : tout, en plus long.
import { dayKey, joursEntre, type Db } from "./model.ts";
import { listesDues } from "./espacement.ts";
import type { GameId } from "./niveaux.ts";

export type TechniqueId =
  | "palais-concrets"
  | "palais-abstraits"
  | "histoire"
  | "visages"
  | "crochets"
  | "major-apprendre"
  | "major-nombre"
  | "mot-cle"
  | "championnat";

export interface Technique {
  id: TechniqueId;
  titre: string;
  resume: string;
  /** Nombre d'éléments à retenir pour une séance de 15 min. */
  taille: number;
}

export const TECHNIQUES: Record<TechniqueId, Technique> = {
  "palais-concrets": { id: "palais-concrets", titre: "Palais : mots concrets", resume: "Ranger une liste de mots faciles à imaginer dans ton palais.", taille: 10 },
  "palais-abstraits": { id: "palais-abstraits", titre: "Palais : mots abstraits", resume: "Transformer des idées (liberté, justice…) en images, puis les ranger dans ton palais.", taille: 10 },
  histoire: { id: "histoire", titre: "Histoire en chaîne", resume: "Relier les mots dans une histoire folle où chaque mot fait quelque chose au suivant.", taille: 10 },
  visages: { id: "visages", titre: "Noms et visages", resume: "Trouver un trait du visage, transformer le prénom en image, les relier.", taille: 6 },
  crochets: { id: "crochets", titre: "Mots-crochets", resume: "Accrocher chaque élément à un nombre de 1 à 10 qui rime avec un objet.", taille: 10 },
  "major-apprendre": { id: "major-apprendre", titre: "Système Major", resume: "Apprendre les mots des nombres 00 à 99 (chiffres → sons → mots).", taille: 10 },
  "major-nombre": { id: "major-nombre", titre: "Grand nombre dans le palais", resume: "Transformer un long nombre en images avec le Major et les poser dans ton palais.", taille: 20 },
  "mot-cle": { id: "mot-cle", titre: "Vocabulaire : mot-clé", resume: "Retenir des mots anglais grâce à un mot français qui sonne pareil.", taille: 6 },
  championnat: { id: "championnat", titre: "Mini-championnat", resume: "Mots, nombre et visages, chronométrés : le bilan des 6 semaines.", taille: 20 },
};

export interface Semaine {
  numero: number;
  titre: string;
  objectif: string;
  /** Techniques de la semaine, qui alternent d'un jour à l'autre. */
  techniques: TechniqueId[];
}

export const SEMAINES: Semaine[] = [
  { numero: 1, titre: "Ton premier palais", objectif: "Construire un palais de 10 lieux chez toi et y ranger des listes de 10 mots concrets.", techniques: ["palais-concrets", "palais-concrets", "crochets"] },
  { numero: 2, titre: "Plus long, et en histoires", objectif: "Agrandir le palais à 20 lieux, listes de 15 mots, et découvrir l'histoire en chaîne.", techniques: ["palais-concrets", "histoire"] },
  { numero: 3, titre: "L'abstrait et les visages", objectif: "Transformer des idées en images et retenir des prénoms.", techniques: ["palais-abstraits", "visages"] },
  { numero: 4, titre: "Les chiffres (Major 00-49)", objectif: "Apprendre la moitié du système Major et retenir des nombres par blocs de 2.", techniques: ["major-apprendre", "major-nombre"] },
  { numero: 5, titre: "Major complet et vocabulaire", objectif: "Finir le Major jusqu'à 99 et apprendre du vocabulaire avec la méthode du mot-clé.", techniques: ["major-apprendre", "mot-cle", "major-nombre"] },
  { numero: 6, titre: "Mini-championnat", objectif: "Tout mélanger, en temps limité, et comparer avec ton test du premier jour.", techniques: ["championnat", "palais-abstraits", "visages"] },
];

/** Après les 6 semaines : entretien, on fait tourner toutes les techniques. */
const ENTRETIEN: TechniqueId[] = ["palais-abstraits", "major-nombre", "visages", "histoire", "mot-cle", "palais-concrets"];

/** Jeux d'échauffement, en rotation. */
const ECHAUFFEMENTS: GameId[] = ["chiffres", "corsi", "nback", "chiffres-envers", "simon", "kim"];

/** Jours de test (depuis le début du programme) : départ, fin des 6 semaines, +1 mois, +4 mois (comme Dresler). */
export const JOURS_TEST = [
  { jour: 0, nom: "Test de départ" },
  { jour: 41, nom: "Test de fin de programme" },
  { jour: 72, nom: "Retest à 1 mois" },
  { jour: 162, nom: "Retest à 4 mois" },
];

export type EtapeId = "test" | "echauffement" | "revisions" | "technique" | "bilan";

export interface Etape {
  id: EtapeId;
  titre: string;
  minutes: number;
}

export interface SeanceDuJour {
  jour: string;
  /** Jour du programme (0 = premier jour), null si pas commencé. */
  jourProgramme: number | null;
  semaine: Semaine | null;
  etapes: Etape[];
  echauffement: GameId;
  technique: TechniqueId;
  test: { nom: string } | null;
  revisions: number;
  faites: string[];
  finie: boolean;
}

export function jourDuProgramme(db: Db, now: number): number | null {
  if (db.debutProgramme === null) return null;
  return Math.max(0, joursEntre(dayKey(db.debutProgramme, db.reglages.heureJour), dayKey(now, db.reglages.heureJour)));
}

export function semaineDe(jour: number | null): Semaine | null {
  if (jour === null) return SEMAINES[0];
  const n = Math.floor(jour / 7);
  return n < SEMAINES.length ? SEMAINES[n] : null;
}

/** Le test prévu aujourd'hui (ou en retard de moins de 7 jours et pas encore fait). */
export function testDuJour(db: Db, now: number): { nom: string; jour: number } | null {
  const j = jourDuProgramme(db, now);
  if (j === null) return { nom: JOURS_TEST[0].nom, jour: 0 };
  for (const t of JOURS_TEST) {
    if (j < t.jour || j > t.jour + 6) continue;
    const fait = db.resultats.some((r) => r.jeu === "test-mots" && r.detail === t.nom);
    if (!fait) return { nom: t.nom, jour: t.jour };
  }
  return null;
}

export function seanceDuJour(db: Db, now: number): SeanceDuJour {
  const jour = dayKey(now, db.reglages.heureJour);
  const jp = jourDuProgramme(db, now);
  const semaine = semaineDe(jp);
  const idx = jp ?? 0;
  const techniques = semaine ? semaine.techniques : ENTRETIEN;
  const technique = techniques[idx % techniques.length];
  const echauffement = ECHAUFFEMENTS[idx % ECHAUFFEMENTS.length];
  // Un test fait aujourd'hui reste dans la séance du jour (coché).
  const testFait = db.resultats.find((r) => r.jeu === "test-mots" && dayKey(r.at, db.reglages.heureJour) === jour);
  const test = testDuJour(db, now) ?? (testFait ? { nom: testFait.detail ?? "Test", jour: 0 } : null);
  const revisions = listesDues(db.listes, now).length;
  const m = db.reglages.minutes;
  const etapes: Etape[] = [];
  if (test) etapes.push({ id: "test", titre: test.nom, minutes: 5 });
  etapes.push({ id: "echauffement", titre: "Échauffement", minutes: m === 5 ? 1 : m === 30 ? 4 : 2 });
  etapes.push({ id: "revisions", titre: "Révisions espacées", minutes: m === 5 ? 3 : m === 30 ? 6 : 3 });
  // En 5 minutes, la technique n'est faite que s'il n'y a rien à réviser.
  if (m !== 5 || revisions === 0) etapes.push({ id: "technique", titre: TECHNIQUES[technique].titre, minutes: m === 5 ? 3 : m === 30 ? 16 : 9 });
  etapes.push({ id: "bilan", titre: "Bilan", minutes: 1 });
  const s = db.seances[jour];
  const faites = s?.etapes ?? [];
  return {
    jour, jourProgramme: jp, semaine, etapes, echauffement, technique,
    test: test ? { nom: test.nom } : null, revisions, faites,
    finie: etapes.every((e) => faites.includes(e.id)),
  };
}

/** Taille d'exercice selon la durée choisie et la semaine (les listes s'allongent avec le programme). */
export function tailleTechnique(t: TechniqueId, db: Db, now: number): number {
  const base = TECHNIQUES[t].taille;
  const jp = jourDuProgramme(db, now) ?? 0;
  const bonus = t.startsWith("palais") || t === "histoire" ? Math.min(10, Math.floor(jp / 7) * 3) : 0;
  const facteur = db.reglages.minutes === 5 ? 0.6 : db.reglages.minutes === 30 ? 1.6 : 1;
  return Math.max(4, Math.round((base + bonus) * facteur));
}

/** Série de jours d'affilée avec une séance terminée (aujourd'hui compte s'il est fini, sinon on part d'hier). */
export function serie(db: Db, now: number): number {
  const fini = new Set(Object.entries(db.seances).filter(([, s]) => s.fin !== undefined).map(([k]) => k));
  let n = 0;
  let t = now;
  if (!fini.has(dayKey(t, db.reglages.heureJour))) t -= 86400_000;
  while (fini.has(dayKey(t, db.reglages.heureJour))) {
    n++;
    t -= 86400_000;
  }
  return n;
}
