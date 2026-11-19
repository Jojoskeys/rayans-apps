export type Mot = { debut: number; fin: number; texte: string };

export type Verset = {
  arabe: string[];
  fr: string;
  ref: string;
  sourate: string;
  recitateur?: string;
  minutage: [number, number, number][]; // [index du mot, frame début, frame fin]
  parties?: { num: number; de: number; a: number; fr: string }[] | null; // suite de versets : un à la fois
};

export type Segment = {
  type: "narration" | "verset";
  scene: string;
  ref?: string | null;
  debut: number;
  fin: number;
  mots?: Mot[];
  verset?: Verset;
  titre?: { frame: number; texte: string };
  visuel?: Visuel;
};

/** Décor générique : tout vient du script (voir generique.tsx). */
export type Visuel = {
  icones?: { nom: string; mot?: string; texte?: string }[];
  chiffre?: { texte: string; mot?: string; sous?: string };
  barres?: { texte: string; valeur: number; mot?: string; rouge?: boolean }[];
  pastilles?: { texte: string; mot?: string; rouge?: boolean }[];
  perso?: { nb?: number; jaunes?: number; mot?: string; bulle?: string; icone?: string };
  annee?: string;
};

export type Cue = { frame: number; type: string; icone?: string | null };

export type Timeline = {
  slug: string;
  style: "ayati" | "psycho";
  fps: number;
  duree: number;
  marque?: string | null;
  segments: Segment[];
  cues: Cue[];
  audio: string;
  brouillon?: boolean;
  accroche?: string | null;
};

/** Un « plan » = segments consécutifs qui partagent le même décor. */
export type Plan = { scene: string; debut: number; fin: number; segments: Segment[]; mots: Mot[] };

export type SceneProps = { plan: Plan; style: Timeline["style"] };
