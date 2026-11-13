// Recherche du meilleur JPEG sous une taille cible : d'abord la qualité (90 → 50) à pleine taille, puis on réduit
// les dimensions par paliers. L'encodeur est fourni par l'appelant (Electron en vrai, une fonction dans les tests).

export type Encode = (scale: number, quality: number) => Promise<number> | number;

export interface Choice { scale: number; quality: number; bytes: number; ok: boolean }

const QUALITIES = [90, 82, 74, 66, 58, 50];
const SCALES = [1, 0.85, 0.7, 0.6, 0.5, 0.42, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1];

/**
 * Plus grande image (puis meilleure qualité) qui tient sous targetBytes ; sinon la plus petite essayée (ok = false).
 * maxScale plafonne la taille de départ (ex. pour ne pas dépasser 4000 px de côté).
 */
export async function findSetting(targetBytes: number, encode: Encode, maxScale = 1): Promise<Choice> {
  let smallest: Choice | null = null;
  for (const s of SCALES) {
    const scale = s * maxScale;
    // Qualité : recherche dichotomique dans la liste (la taille décroît avec la qualité).
    let lo = 0, hi = QUALITIES.length - 1, best: Choice | null = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const bytes = await encode(scale, QUALITIES[mid]);
      const c = { scale, quality: QUALITIES[mid], bytes, ok: bytes <= targetBytes };
      if (!smallest || bytes < smallest.bytes) smallest = c;
      if (c.ok) { best = c; hi = mid - 1; } else lo = mid + 1;
    }
    if (best) return best;
  }
  return smallest!;
}

/** Facteur pour que le plus grand côté ne dépasse pas maxSide pixels. */
export const fitScale = (w: number, h: number, maxSide: number) => Math.min(1, maxSide / Math.max(w, h));
