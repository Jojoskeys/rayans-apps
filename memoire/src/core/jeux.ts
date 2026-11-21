// Tirages et corrections des jeux (sans interface : testés dans test/jeux.test.ts).
import { MOTS_ABSTRAITS, MOTS_CONCRETS, OBJETS, PRENOMS_F, PRENOMS_H } from "./contenu.ts";
import { randInt, sample, shuffle, type Rng } from "./rng.ts";

/** Suite de chiffres sans deux chiffres identiques côte à côte (plus lisible). */
export function suiteChiffres(rng: Rng, n: number): number[] {
  const out: number[] = [];
  while (out.length < n) {
    const c = randInt(rng, 0, 9);
    if (c !== out[out.length - 1]) out.push(c);
  }
  return out;
}

/** Suite de cases (grille de `cases` cases) sans répéter deux fois la même d'affilée. */
export function suiteCases(rng: Rng, n: number, cases = 16): number[] {
  const out: number[] = [];
  while (out.length < n) {
    const c = randInt(rng, 0, cases - 1);
    if (c !== out[out.length - 1]) out.push(c);
  }
  return out;
}

/** Suite de couleurs (4 couleurs) pour le jeu de séquence. */
export const suiteCouleurs = (rng: Rng, n: number): number[] => Array.from({ length: n }, () => randInt(rng, 0, 3));

// ----- N-back -----------------------------------------------------------------------------------------------
const LETTRES = "BCDFGHJKLMNPQRSTVXZ".split("");

/** Flux de lettres pour un n-back : `cibles` lettres identiques à celle d'il y a n, les autres différentes. */
export function fluxNBack(rng: Rng, n: number, longueur = 20 + n, partCibles = 0.3): { lettres: string[]; cibles: boolean[] } {
  const lettres: string[] = [];
  const cibles: boolean[] = [];
  const nbCibles = Math.round((longueur - n) * partCibles);
  const positions = new Set(sample(rng, Array.from({ length: longueur - n }, (_, i) => i + n), nbCibles));
  for (let i = 0; i < longueur; i++) {
    if (positions.has(i)) {
      lettres.push(lettres[i - n]);
      cibles.push(true);
    } else {
      let l: string;
      do l = LETTRES[randInt(rng, 0, LETTRES.length - 1)];
      while (i >= n && l === lettres[i - n]);
      lettres.push(l);
      cibles.push(false);
    }
  }
  return { lettres, cibles };
}

/** Correction d'un n-back : part de bonnes décisions (appui sur une cible, pas d'appui sinon), à partir de la n-ième lettre. */
export function noterNBack(cibles: boolean[], appuis: boolean[], n: number): { justes: number; total: number; touches: number; fausses: number; manquees: number } {
  let justes = 0, touches = 0, fausses = 0, manquees = 0;
  for (let i = n; i < cibles.length; i++) {
    const a = appuis[i] === true;
    if (a === cibles[i]) justes++;
    if (a && cibles[i]) touches++;
    if (a && !cibles[i]) fausses++;
    if (!a && cibles[i]) manquees++;
  }
  return { justes, total: cibles.length - n, touches, fausses, manquees };
}

/** Un n-back est réussi à 80 % de bonnes décisions et au moins la moitié des cibles trouvées. */
export function nbackReussi(r: ReturnType<typeof noterNBack>): boolean {
  const cibles = r.touches + r.manquees;
  return r.justes / r.total >= 0.8 && (cibles === 0 || r.touches / cibles >= 0.5);
}

// ----- Paires, objet disparu ---------------------------------------------------------------------------------
export function jeuPaires(rng: Rng, paires: number): string[] {
  const objets = sample(rng, OBJETS, paires);
  return shuffle(rng, [...objets, ...objets]);
}

/** Paires réussies si on a fini en au plus 2 coups par paire (1 coup par paire = parfait). */
export const pairesReussies = (paires: number, coups: number): boolean => coups <= paires * 2;

export function jeuKim(rng: Rng, n: number): { objets: string[]; disparu: string; choix: string[] } {
  const tous = sample(rng, OBJETS, n + 3);
  const objets = tous.slice(0, n);
  const disparu = objets[randInt(rng, 0, n - 1)];
  // Choix : l'objet disparu, deux qui sont encore là, et un qui n'y a jamais été (pour vérifier qu'on a bien regardé).
  const restants = objets.filter((o) => o !== disparu);
  const choix = shuffle(rng, [disparu, ...sample(rng, restants, Math.min(2, restants.length)), tous[n]]);
  return { objets, disparu, choix };
}

// ----- Mots, visages, nombres ---------------------------------------------------------------------------------
export function listeMots(rng: Rng, n: number, sorte: "concrets" | "abstraits" | "melange" = "concrets"): string[] {
  const source = sorte === "concrets" ? MOTS_CONCRETS : sorte === "abstraits" ? MOTS_ABSTRAITS : [...MOTS_CONCRETS, ...MOTS_ABSTRAITS];
  return sample(rng, source, n);
}

/** Liste de mots réussie à 80 % retrouvés. */
export const motsReussis = (trouves: number, total: number): boolean => trouves >= Math.ceil(total * 0.8);

export interface Personne {
  prenom: string;
  genre: "h" | "f";
  graine: number;
}

export function personnes(rng: Rng, n: number): Personne[] {
  const tous = [...PRENOMS_H.map((p) => ({ prenom: p, genre: "h" as const })), ...PRENOMS_F.map((p) => ({ prenom: p, genre: "f" as const }))];
  return sample(rng, tous, n).map((p) => ({ ...p, graine: randInt(rng, 1, 2 ** 30) }));
}

/** Un grand nombre, affiché par blocs de 2 chiffres. */
export function grandNombre(rng: Rng, chiffres: number): string {
  return Array.from({ length: chiffres }, () => String(randInt(rng, 0, 9))).join("");
}

export const blocs = (nombre: string, taille = 2): string[] => nombre.match(new RegExp(`.{1,${taille}}`, "g")) ?? [];

/** Nombre de chiffres justes depuis le début, avant la première erreur (règle des championnats, simplifiée). */
export function chiffresJustes(attendu: string, reponse: string): number {
  const r = reponse.replace(/\D/g, "");
  let i = 0;
  while (i < attendu.length && r[i] === attendu[i]) i++;
  return i;
}
