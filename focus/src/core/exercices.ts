// Les 5 exercices, sans interface : ce qui est tiré au hasard à chaque niveau, et comment on note une manche.
import { pick, randInt, shuffle, type Rng } from "./rng.ts";

export const moyenne = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const arrondi = (x: number | null): number | null => (x === null ? null : Math.round(x));

// ----- 1. Trouver la cible (recherche visuelle) ---------------------------------------------------------------
/** Familles de symboles, de « très différents » (0) à « presque pareils » (4). */
export const FAMILLES_RECHERCHE: { cible: string; leurres: string[] }[][] = [
  [{ cible: "★", leurres: ["●", "■", "▲"] }, { cible: "♥", leurres: ["■", "●", "▲"] }, { cible: "✚", leurres: ["●", "■", "▲"] }],
  [{ cible: "Q", leurres: ["O"] }, { cible: "X", leurres: ["K", "Y"] }, { cible: "R", leurres: ["P", "B"] }],
  [{ cible: "E", leurres: ["F"] }, { cible: "N", leurres: ["M"] }, { cible: "8", leurres: ["3", "6"] }],
  [{ cible: "b", leurres: ["d", "p"] }, { cible: "6", leurres: ["9"] }, { cible: "u", leurres: ["n"] }],
  [{ cible: "◢", leurres: ["◣", "◤", "◥"] }, { cible: "◐", leurres: ["◑", "◒", "◓"] }, { cible: "↖", leurres: ["↗", "↙", "↘"] }],
];

export interface PlanRecherche { nombre: number; famille: number; limiteMs: number; grilles: number }

export function planRecherche(niveau: number): PlanRecherche {
  return {
    nombre: 6 + niveau * 3,
    famille: Math.min(FAMILLES_RECHERCHE.length - 1, Math.floor((niveau - 1) / 2)),
    limiteMs: Math.max(3500, 9000 - (niveau - 1) * 500),
    grilles: 5,
  };
}

export interface Grille { cible: string; symboles: string[]; index: number; colonnes: number; limiteMs: number }

export function grilleRecherche(rng: Rng, niveau: number): Grille {
  const p = planRecherche(niveau);
  const f = pick(rng, FAMILLES_RECHERCHE[p.famille]);
  const index = randInt(rng, 0, p.nombre - 1);
  const symboles = Array.from({ length: p.nombre }, (_, i) => (i === index ? f.cible : pick(rng, f.leurres)));
  return { cible: f.cible, symboles, index, colonnes: Math.ceil(Math.sqrt(p.nombre * 1.4)), limiteMs: p.limiteMs };
}

export interface EssaiSimple { juste: boolean; ms: number | null }

export function noterRecherche(essais: EssaiSimple[]): { justes: number; total: number; ms: number | null; reussi: boolean } {
  const justes = essais.filter((e) => e.juste).length;
  const ms = arrondi(moyenne(essais.filter((e) => e.juste && e.ms !== null).map((e) => e.ms!)));
  return { justes, total: essais.length, ms, reussi: essais.length > 0 && justes >= Math.ceil(essais.length * 0.8) };
}

// ----- Essais « avec ou sans piège » (flèches, couleurs) -----------------------------------------------------
export interface EssaiPiege { congruent: boolean; juste: boolean; ms: number | null }

export interface NoteInterference {
  justes: number;
  total: number;
  /** Temps moyen des réponses justes. */
  ms: number | null;
  msSansPiege: number | null;
  msAvecPiege: number | null;
  /** Temps perdu à cause des pièges (avec − sans), en ms. */
  cout: number | null;
  reussi: boolean;
}

export function noterInterference(essais: EssaiPiege[], seuil = 0.85): NoteInterference {
  const justes = essais.filter((e) => e.juste);
  const temps = (c: boolean) => moyenne(justes.filter((e) => e.congruent === c && e.ms !== null).map((e) => e.ms!));
  const sans = temps(true);
  const avec = temps(false);
  return {
    justes: justes.length,
    total: essais.length,
    ms: arrondi(moyenne(justes.filter((e) => e.ms !== null).map((e) => e.ms!))),
    msSansPiege: arrondi(sans),
    msAvecPiege: arrondi(avec),
    cout: sans !== null && avec !== null ? Math.round(avec - sans) : null,
    reussi: essais.length > 0 && justes.length / essais.length >= seuil,
  };
}

/** Exactement `n × part` essais avec piège, dans le désordre. */
function tirerPieges(rng: Rng, n: number, part: number): boolean[] {
  const k = Math.round(n * part);
  return shuffle(rng, Array.from({ length: n }, (_, i) => i >= k)); // true = congruent (sans piège)
}

// ----- 2. Flèche du milieu (flanker, Eriksen & Eriksen 1974) --------------------------------------------------
export type Sens = "gauche" | "droite";
export interface PlanFlanker { essais: number; limiteMs: number; partPieges: number; flancs: number }

export function planFlanker(niveau: number): PlanFlanker {
  return {
    essais: 20,
    limiteMs: Math.max(700, 2000 - (niveau - 1) * 145),
    partPieges: Math.min(0.7, 0.4 + niveau * 0.03),
    flancs: niveau >= 6 ? 3 : 2,
  };
}

export interface EssaiFlanker { centre: Sens; congruent: boolean; fleches: string }
const FLECHE: Record<Sens, string> = { gauche: "←", droite: "→" };

export function essaisFlanker(rng: Rng, niveau: number, n = planFlanker(niveau).essais): EssaiFlanker[] {
  const p = planFlanker(niveau);
  return tirerPieges(rng, n, p.partPieges).map((congruent) => {
    const centre: Sens = rng() < 0.5 ? "gauche" : "droite";
    const autour = FLECHE[congruent ? centre : centre === "gauche" ? "droite" : "gauche"];
    const cote = Array.from({ length: p.flancs }, () => autour).join(" ");
    return { centre, congruent, fleches: `${cote} ${FLECHE[centre]} ${cote}` };
  });
}

// ----- 3. Couleur du mot (Stroop 1935, revue MacLeod 1991) ----------------------------------------------------
export type CouleurId = "rouge" | "bleu" | "vert" | "jaune";
export const COULEURS: { id: CouleurId; nom: string; hex: string }[] = [
  { id: "rouge", nom: "ROUGE", hex: "#ef5d6c" },
  { id: "bleu", nom: "BLEU", hex: "#4c8de2" },
  { id: "vert", nom: "VERT", hex: "#3fbf7f" },
  { id: "jaune", nom: "JAUNE", hex: "#f2c94c" },
];
const IDS_COULEURS = COULEURS.map((c) => c.id);

export interface PlanStroop { essais: number; limiteMs: number; partPieges: number; melangeBoutons: boolean }

export function planStroop(niveau: number): PlanStroop {
  return {
    essais: 16,
    limiteMs: Math.max(1000, 3000 - (niveau - 1) * 220),
    partPieges: Math.min(0.85, 0.35 + niveau * 0.05),
    melangeBoutons: niveau >= 6,
  };
}

export interface EssaiStroop { mot: CouleurId; encre: CouleurId; congruent: boolean; boutons: CouleurId[] }

export function essaisStroop(rng: Rng, niveau: number): EssaiStroop[] {
  const p = planStroop(niveau);
  return tirerPieges(rng, p.essais, p.partPieges).map((congruent) => {
    const encre = pick(rng, IDS_COULEURS);
    const mot = congruent ? encre : pick(rng, IDS_COULEURS.filter((c) => c !== encre));
    return { mot, encre, congruent, boutons: p.melangeBoutons ? shuffle(rng, IDS_COULEURS) : IDS_COULEURS.slice() };
  });
}

// ----- 4. Rester sur la tâche (attention soutenue, type SART : Robertson et al. 1997) -------------------------
export const CHIFFRE_INTERDIT = 3;
export interface PlanSoutenue { chiffres: number; intervalleMs: number; notifications: number }

export function planSoutenue(niveau: number): PlanSoutenue {
  return {
    chiffres: 30 + (niveau - 1) * 4,
    intervalleMs: Math.max(650, 1250 - (niveau - 1) * 65),
    notifications: niveau >= 4 ? niveau - 2 : 0,
  };
}

/** Fausses notifications, écrites pour l'app (rien de vrai, rien à cliquer). */
export const NOTIFICATIONS = [
  "📩 Nouveau message : « t'es là ? »",
  "🔔 Quelqu'un a aimé ta photo",
  "🎮 Ton énergie est rechargée !",
  "📦 Ton colis arrive aujourd'hui",
  "🔥 Ne casse pas ta série !",
  "📰 À la une : tu ne devineras jamais…",
  "💬 3 nouveaux messages dans le groupe",
  "▶️ Une nouvelle vidéo vient de sortir",
  "🛒 Promo : -50 % seulement aujourd'hui",
  "📅 Rappel : regarde ce que tu as manqué",
];

export interface FluxSoutenue { chiffres: number[]; notifications: { index: number; texte: string }[] }

export function fluxSoutenue(rng: Rng, niveau: number): FluxSoutenue {
  const p = planSoutenue(niveau);
  const chiffres: number[] = [];
  for (let i = 0; i < p.chiffres; i++) {
    const avant = chiffres[i - 1];
    let c: number;
    if (i >= 3 && avant !== CHIFFRE_INTERDIT && rng() < 0.12) c = CHIFFRE_INTERDIT;
    else do c = randInt(rng, 1, 9); while (c === CHIFFRE_INTERDIT || c === avant);
    chiffres.push(c);
  }
  // Au moins deux 3 dans la suite, sinon l'exercice ne mesure rien.
  for (let i = 5; chiffres.filter((c) => c === CHIFFRE_INTERDIT).length < 2 && i < chiffres.length - 1; i += 7)
    if (chiffres[i - 1] !== CHIFFRE_INTERDIT && chiffres[i + 1] !== CHIFFRE_INTERDIT) chiffres[i] = CHIFFRE_INTERDIT;
  const places = shuffle(rng, Array.from({ length: Math.max(0, p.chiffres - 8) }, (_, i) => i + 4)).slice(0, p.notifications).sort((a, b) => a - b);
  const textes = shuffle(rng, NOTIFICATIONS);
  return { chiffres, notifications: places.map((index, k) => ({ index, texte: textes[k % textes.length] })) };
}

export interface NoteSoutenue {
  /** Appuis justes sur les chiffres autorisés. */
  appuisJustes: number;
  appuisTotal: number;
  /** 3 bien retenus (pas d'appui). */
  retenusJustes: number;
  retenusTotal: number;
  notificationsCliquees: number;
  score: number;
  max: number;
  reussi: boolean;
}

export function noterSoutenue(chiffres: number[], appuis: boolean[], notificationsCliquees = 0): NoteSoutenue {
  let appuisJustes = 0, appuisTotal = 0, retenusJustes = 0, retenusTotal = 0;
  chiffres.forEach((c, i) => {
    if (c === CHIFFRE_INTERDIT) { retenusTotal++; if (!appuis[i]) retenusJustes++; }
    else { appuisTotal++; if (appuis[i]) appuisJustes++; }
  });
  const reussi =
    notificationsCliquees === 0 && appuisTotal > 0 && appuisJustes / appuisTotal >= 0.9 && (retenusTotal === 0 || retenusJustes / retenusTotal >= 0.75);
  return { appuisJustes, appuisTotal, retenusJustes, retenusTotal, notificationsCliquees, score: appuisJustes + retenusJustes, max: chiffres.length, reussi };
}

// ----- 5. Coût du changement (changement de tâche, Monsell 2003) ----------------------------------------------
export type Regle = "parite" | "taille";
export const REGLES: Record<Regle, { question: string; gauche: string; droite: string; couleur: string }> = {
  parite: { question: "Pair ou impair ?", gauche: "Impair", droite: "Pair", couleur: "#3FB7D9" },
  taille: { question: "Plus petit ou plus grand que 5 ?", gauche: "Plus petit", droite: "Plus grand", couleur: "#f0a843" },
};
const CHIFFRES_CHANGEMENT = [1, 2, 3, 4, 6, 7, 8, 9];

export interface PlanChangement { parBlocSimple: number; melanges: number; limiteMs: number }

export function planChangement(niveau: number): PlanChangement {
  return { parBlocSimple: 10, melanges: 16 + (niveau - 1) * 2, limiteMs: Math.max(1200, 3000 - (niveau - 1) * 250) };
}

export interface EssaiChangement { bloc: "simple" | "melange"; regle: Regle; chiffre: number; changement: boolean }

export function bonneReponse(regle: Regle, chiffre: number): Sens {
  if (regle === "parite") return chiffre % 2 === 0 ? "droite" : "gauche";
  return chiffre < 5 ? "gauche" : "droite";
}

/** Bloc « pair/impair » seul, bloc « plus petit/plus grand » seul, puis bloc mélangé (une fois sur deux, la règle change). */
export function essaisChangement(rng: Rng, niveau: number): EssaiChangement[] {
  const p = planChangement(niveau);
  const out: EssaiChangement[] = [];
  const tirer = () => pick(rng, CHIFFRES_CHANGEMENT);
  for (const regle of ["parite", "taille"] as Regle[])
    for (let i = 0; i < p.parBlocSimple; i++) out.push({ bloc: "simple", regle, chiffre: tirer(), changement: false });
  // Mélangé : exactement la moitié des essais (après le premier) changent de règle.
  const changements = shuffle(rng, Array.from({ length: p.melanges - 1 }, (_, i) => i < Math.floor((p.melanges - 1) / 2)));
  let regle: Regle = rng() < 0.5 ? "parite" : "taille";
  out.push({ bloc: "melange", regle, chiffre: tirer(), changement: false });
  for (const ch of changements) {
    if (ch) regle = regle === "parite" ? "taille" : "parite";
    out.push({ bloc: "melange", regle, chiffre: tirer(), changement: ch });
  }
  return out;
}

export interface NoteChangement {
  /** Temps moyen dans les blocs à une seule règle. */
  msSimple: number | null;
  /** Bloc mélangé, quand la règle reste la même. */
  msRepetition: number | null;
  /** Bloc mélangé, juste après un changement de règle. */
  msChangement: number | null;
  /** Temps perdu à chaque changement (changement − répétition). */
  coutChangement: number | null;
  /** Temps perdu juste parce que deux règles sont « en route » (répétition mélangée − bloc simple). */
  coutMelange: number | null;
  justesSimple: number;
  totalSimple: number;
  justesMelange: number;
  totalMelange: number;
  /** Erreurs juste après un changement / en répétition, en part (0 à 1). */
  erreursChangement: number | null;
  erreursRepetition: number | null;
  /** Temps total perdu par les changements de ce bloc (ms). */
  tempsPerdu: number | null;
  reussi: boolean;
}

export function noterChangement(essais: (EssaiChangement & EssaiSimple)[]): NoteChangement {
  const t = (f: (e: EssaiChangement) => boolean) => moyenne(essais.filter((e) => f(e) && e.juste && e.ms !== null).map((e) => e.ms!));
  const simple = t((e) => e.bloc === "simple");
  const rep = t((e) => e.bloc === "melange" && !e.changement);
  const ch = t((e) => e.bloc === "melange" && e.changement);
  const mel = essais.filter((e) => e.bloc === "melange");
  const sim = essais.filter((e) => e.bloc === "simple");
  const tauxErreurs = (xs: EssaiSimple[]) => (xs.length ? xs.filter((e) => !e.juste).length / xs.length : null);
  const nbCh = mel.filter((e) => e.changement).length;
  const cout = rep !== null && ch !== null ? Math.round(ch - rep) : null;
  const justesMelange = mel.filter((e) => e.juste).length;
  return {
    msSimple: arrondi(simple), msRepetition: arrondi(rep), msChangement: arrondi(ch),
    coutChangement: cout,
    coutMelange: simple !== null && rep !== null ? Math.round(rep - simple) : null,
    justesSimple: sim.filter((e) => e.juste).length, totalSimple: sim.length,
    justesMelange, totalMelange: mel.length,
    erreursChangement: tauxErreurs(mel.filter((e) => e.changement)),
    erreursRepetition: tauxErreurs(mel.filter((e) => !e.changement)),
    tempsPerdu: cout !== null ? Math.max(0, cout) * nbCh : null,
    reussi: mel.length > 0 && justesMelange / mel.length >= 0.85,
  };
}

// ----- Tests de départ et de suivi : mêmes conditions à chaque fois -----------------------------------------
/** Niveau fixe et durée fixe : seule façon de comparer honnêtement d'une semaine à l'autre. */
export const TEST = { niveauRecherche: 5, niveauFlanker: 4, secondes: 60, joursEntreTests: 7 };
