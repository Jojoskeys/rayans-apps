// Pinyin : tons (1 à 4, 0 = neutre), place de l'accent, conversion « ni3 hao3 » → « nǐ hǎo », comparaison tolérante.

export type Ton = 0 | 1 | 2 | 3 | 4;

const ACCENTS: Record<string, string> = {
  a: "āáǎà", e: "ēéěè", i: "īíǐì", o: "ōóǒò", u: "ūúǔù", ü: "ǖǘǚǜ",
};
const DE_ACCENT: Record<string, { v: string; t: Ton }> = {};
for (const [v, s] of Object.entries(ACCENTS)) [...s].forEach((c, i) => (DE_ACCENT[c] = { v, t: (i + 1) as Ton }));

/** Ton d'une syllabe écrite avec accent (0 si aucun accent = ton neutre). */
export function tonDe(syllabe: string): Ton {
  for (const c of syllabe) if (DE_ACCENT[c]) return DE_ACCENT[c].t;
  return 0;
}

/** Nombre d'accents de ton dans une syllabe (doit être 0 ou 1). */
export function nbAccents(syllabe: string): number {
  return [...syllabe].filter((c) => DE_ACCENT[c]).length;
}

/** La syllabe sans accent de ton (ü est gardé). */
export function sansTon(syllabe: string): string {
  return [...syllabe].map((c) => DE_ACCENT[c]?.v ?? c).join("");
}

/**
 * Place l'accent du ton selon la règle officielle : sur a ou e s'il y en a un ; sur le o de « ou » ;
 * sinon sur la dernière voyelle (iu → iù, ui → uì).
 */
export function avecTon(base: string, ton: Ton): string {
  const s = base.toLowerCase().replace(/v|u:/g, "ü");
  if (ton === 0) return s;
  let i = s.search(/[ae]/);
  if (i < 0) i = s.indexOf("ou");
  if (i < 0) {
    for (let k = s.length - 1; k >= 0; k--) if ("iouü".includes(s[k])) { i = k; break; }
  }
  if (i < 0) return s;
  return s.slice(0, i) + ACCENTS[s[i]][ton - 1] + s.slice(i + 1);
}

const INITIALES = "(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?";
const FINALES = "(a|o|e|ai|ei|ao|ou|an|en|ang|eng|ong|er|i|ia|ie|iao|iu|ian|in|iang|ing|iong|u|ua|uo|uai|ui|uan|un|uang|ueng|ue|ü|üe|üan|ün)";
const SYLLABE = new RegExp(`^${INITIALES}${FINALES}$`);

/** Vrai si la syllabe (sans ton) a une forme possible en pinyin. */
export function syllabeValide(base: string): boolean {
  return SYLLABE.test(base);
}

/** Syllabes d'un pinyin écrit avec des espaces entre syllabes (« xué sheng » → 2 syllabes). */
export const syllabes = (pinyin: string): string[] => pinyin.trim().split(/\s+/).filter(Boolean);

/** « ni3 hao3 » ou « nǐ hǎo » → forme écrite avec accents (« nǐ hǎo »). Les chiffres 5 et 0 = ton neutre. */
export function chiffresVersAccents(texte: string): string {
  return texte.toLowerCase().replace(/([a-zü:v]+)([0-5])/g, (_, b: string, t: string) => avecTon(b, (Number(t) % 5) as Ton));
}

/**
 * Forme de comparaison : les lettres sans espace ni accent, et la suite des tons non neutres.
 * « nǐ hǎo », « ni3 hao3 » et « ni3hao3 » donnent la même forme ; « xie4 xie » = « xiè xie5 ».
 */
export function formeComparaison(texte: string): { lettres: string; tons: string } {
  const t = chiffresVersAccents(texte.normalize("NFC").replace(/u:|v/g, "ü"));
  let lettres = "";
  let tons = "";
  for (const c of t) {
    if (DE_ACCENT[c]) { lettres += DE_ACCENT[c].v; tons += DE_ACCENT[c].t; }
    else if (/[a-zü]/.test(c)) lettres += c;
  }
  return { lettres: lettres.replace(/ü/g, "u"), tons };
}

export type Verdict = "juste" | "tons" | "faux";

/** Compare une réponse tapée au pinyin attendu : juste, lettres justes mais tons faux, ou faux. */
export function comparerPinyin(attendu: string, reponse: string): Verdict {
  const a = formeComparaison(attendu);
  const r = formeComparaison(reponse);
  if (a.lettres !== r.lettres) return "faux";
  return a.tons === r.tons ? "juste" : "tons";
}

export const NOMS_TONS: Record<Ton, string> = {
  1: "1er ton (haut et plat)", 2: "2e ton (qui monte)", 3: "3e ton (qui descend puis remonte)", 4: "4e ton (qui tombe)", 0: "ton neutre (léger)",
};
