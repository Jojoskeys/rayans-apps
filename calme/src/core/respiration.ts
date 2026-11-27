// Respiration lente guidée : les rythmes, leurs phases, et où l'on en est à un instant donné.

export type RythmeId = "six" | "quatre-six" | "soupir";

export type TypePhase = "inspire" | "inspire2" | "expire";

export interface Phase {
  type: TypePhase;
  /** Durée en secondes. */
  s: number;
  /** Ce qu'on affiche au centre du cercle. */
  texte: string;
  /** Taille du cercle au début et à la fin de la phase (0 = petit, 1 = grand). */
  de: number;
  a: number;
}

export interface Rythme {
  id: RythmeId;
  nom: string;
  court: string;
  explication: string;
  phases: Phase[];
}

export const RYTHMES: Rythme[] = [
  {
    id: "six", nom: "6 respirations par minute", court: "5 s / 5 s",
    explication: "Inspire 5 secondes, expire 5 secondes, tranquillement, par le nez si tu peux. C'est le rythme lent le plus étudié.",
    phases: [
      { type: "inspire", s: 5, texte: "Inspire", de: 0, a: 1 },
      { type: "expire", s: 5, texte: "Expire", de: 1, a: 0 },
    ],
  },
  {
    id: "quatre-six", nom: "4-6", court: "inspire 4 s, expire 6 s",
    explication: "Inspire 4 secondes, expire 6 secondes. L'expiration un peu plus longue que l'inspiration aide beaucoup de gens à se poser.",
    phases: [
      { type: "inspire", s: 4, texte: "Inspire", de: 0, a: 1 },
      { type: "expire", s: 6, texte: "Expire", de: 1, a: 0 },
    ],
  },
  {
    id: "soupir", nom: "Soupir cyclique", court: "2 inspirations, 1 longue expiration",
    explication: "Inspire par le nez, puis prends encore une petite inspiration pour remplir à fond, puis expire longuement par la bouche. Testé dans un seul essai : à essayer pour toi.",
    phases: [
      { type: "inspire", s: 2.5, texte: "Inspire (nez)", de: 0, a: 0.8 },
      { type: "inspire2", s: 1, texte: "Encore un peu", de: 0.8, a: 1 },
      { type: "expire", s: 6.5, texte: "Expire lentement (bouche)", de: 1, a: 0 },
    ],
  },
];

export const rythme = (id: RythmeId): Rythme => RYTHMES.find((r) => r.id === id) ?? RYTHMES[0];

/** Durée d'un cycle complet (secondes). */
export const dureeCycle = (r: Rythme): number => r.phases.reduce((t, p) => t + p.s, 0);

/** Respirations par minute (arrondi à 0,1). */
export const parMinute = (r: Rythme): number => Math.round((600 / dureeCycle(r))) / 10;

export interface Instant {
  /** Numéro du cycle (0, 1, 2…). */
  cycle: number;
  phase: Phase;
  indexPhase: number;
  /** Avancement dans la phase, de 0 à 1. */
  avance: number;
  /** Secondes restantes dans la phase (arrondi supérieur). */
  reste: number;
  /** Taille du cercle, de 0 à 1 (adoucie pour un mouvement naturel). */
  taille: number;
}

const doux = (x: number) => 0.5 - Math.cos(Math.PI * x) / 2;

/** Où en est la respiration après `t` secondes. */
export function instant(r: Rythme, t: number): Instant {
  const c = dureeCycle(r);
  const tt = Math.max(0, t);
  const cycle = Math.floor(tt / c);
  let dans = tt - cycle * c;
  for (let i = 0; i < r.phases.length; i++) {
    const p = r.phases[i];
    if (dans < p.s || i === r.phases.length - 1) {
      const avance = Math.min(1, dans / p.s);
      return { cycle, phase: p, indexPhase: i, avance, reste: Math.max(1, Math.ceil(p.s - dans - 1e-9)), taille: p.de + (p.a - p.de) * doux(avance) };
    }
    dans -= p.s;
  }
  /* inatteignable */
  const p = r.phases[0];
  return { cycle, phase: p, indexPhase: 0, avance: 0, reste: Math.ceil(p.s), taille: p.de };
}

/** Durées proposées (minutes). */
export const DUREES = [2, 3, 5, 10] as const;

/** En dessous de ce temps, un arrêt n'est pas compté (bouton touché par erreur, simple essai). */
export const SEUIL_ABANDON_S = 20;
