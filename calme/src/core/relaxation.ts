// Relaxation musculaire guidée (contraction puis relâchement), environ 5 minutes. Pratique de confort.

export interface Zone { nom: string; consigne: string }

export const ZONES: Zone[] = [
  { nom: "Mains", consigne: "Serre les poings." },
  { nom: "Avant-bras et bras", consigne: "Plie les bras et serre les biceps, sans forcer." },
  { nom: "Épaules", consigne: "Monte doucement les épaules vers les oreilles." },
  { nom: "Front", consigne: "Lève les sourcils, plisse le front." },
  { nom: "Yeux et joues", consigne: "Ferme fort les yeux, plisse le nez." },
  { nom: "Mâchoire", consigne: "Serre légèrement les dents." },
  { nom: "Ventre", consigne: "Rentre et durcis le ventre." },
  { nom: "Dos", consigne: "Rapproche un peu les omoplates." },
  { nom: "Cuisses", consigne: "Serre les cuisses l'une contre l'autre." },
  { nom: "Pieds et mollets", consigne: "Tire les orteils vers toi." },
];

export const CONTRACTE_S = 5;
export const RELACHE_S = 20;
export const INTRO_S = 20;

export type MomentRelax =
  | { type: "intro"; reste: number }
  | { type: "contracte" | "relache"; zone: number; reste: number }
  | { type: "fin" };

export const dureeRelaxation = (): number => INTRO_S + ZONES.length * (CONTRACTE_S + RELACHE_S);

/** Où on en est après `t` secondes. */
export function momentRelax(t: number): MomentRelax {
  if (t < INTRO_S) return { type: "intro", reste: Math.ceil(INTRO_S - t) };
  const u = t - INTRO_S;
  const bloc = CONTRACTE_S + RELACHE_S;
  const zone = Math.floor(u / bloc);
  if (zone >= ZONES.length) return { type: "fin" };
  const dans = u - zone * bloc;
  return dans < CONTRACTE_S
    ? { type: "contracte", zone, reste: Math.ceil(CONTRACTE_S - dans) }
    : { type: "relache", zone, reste: Math.ceil(bloc - dans) };
}
