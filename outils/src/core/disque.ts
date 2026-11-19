// « Où est passé mon disque ? » : taille de chaque dossier, pour voir ce qui prend de la place.
// Le parcours du disque est fait par le processus principal (main/disque.ts) ; ici, la partie pure.

export interface Dossier {
  nom: string;
  chemin: string;
  /** Octets, sous-dossiers compris. */
  taille: number;
  fichiers: number;
  /** Les plus gros sous-dossiers seulement (voir elaguer). */
  enfants: Dossier[];
  /** Octets des fichiers posés directement dans ce dossier. */
  ici: number;
}

/** Garde, à chaque niveau, les `max` plus gros sous-dossiers (au-delà, ils comptent dans la taille sans être listés). */
export function elaguer(d: Dossier, max = 30, profondeur = 6): Dossier {
  const enfants = profondeur <= 0 ? [] : [...d.enfants]
    .filter((e) => e.taille > 0)
    .sort((a, b) => b.taille - a.taille)
    .slice(0, max)
    .map((e) => elaguer(e, max, profondeur - 1));
  return { ...d, enfants };
}

/** Additionne les tailles d'un arbre dont seuls `ici` et `fichiers` sont remplis (de bas en haut). */
export function totaliser(d: Dossier): Dossier {
  const enfants = d.enfants.map(totaliser);
  return {
    ...d, enfants,
    taille: d.ici + enfants.reduce((n, e) => n + e.taille, 0),
    fichiers: d.fichiers + enfants.reduce((n, e) => n + e.fichiers, 0),
  };
}

/** Dossiers à ne pas parcourir : système, corbeille, caches de développement énormes et sans intérêt ici. */
export const IGNORES = /^(\$recycle\.bin|system volume information|\$windows\.~bt|\$winreagent|config\.msi)$/i;

/** Part de la taille du parent, en pourcentage arrondi. */
export const part = (enfant: number, parent: number) => (parent > 0 ? Math.round((enfant / parent) * 100) : 0);
