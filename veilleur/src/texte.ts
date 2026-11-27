// Petits outils de texte partagés (flux RSS de « Ton monde ce matin »).

/** Entités XML et HTML courantes → caractères (aussi celles en chiffres, « &#233; » ou « &#xE9; »). */
export const entites = (s: string) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
