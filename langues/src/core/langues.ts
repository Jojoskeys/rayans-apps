// Vue commune des deux langues : un mot, une phrase, quelle que soit la langue.
import { MOTS_AR, PHRASES_AR } from "./contenu-ar.ts";
import { MOTS_ZH, PHRASES_ZH } from "./contenu-zh.ts";
import { sansHarakat } from "./arabe.ts";

export type Langue = "zh" | "ar";
export const LANGUES: Langue[] = ["zh", "ar"];
export const NOM_LANGUE: Record<Langue, string> = { zh: "Chinois", ar: "Arabe" };
export const NOM_NATIF: Record<Langue, string> = { zh: "中文", ar: "العربية" };
export const VOIX_LANGUE: Record<Langue, string> = { zh: "zh", ar: "ar" };

export interface Mot {
  /** Identifiant stable : les caractères (chinois) ou le mot avec voyelles (arabe). */
  id: string;
  langue: Langue;
  /** Ce qu'on écrit (caractères, ou arabe avec voyelles). */
  ecrit: string;
  /** Lecture : pinyin (chinois) ou transcription (arabe). */
  lecture: string;
  fr: string;
  theme: string;
  radical?: string;
  racine?: string;
  cle?: string;
}

export interface Phrase {
  id: string;
  langue: Langue;
  mots: string[];
  /** Lecture de chaque mot (chinois) ; en arabe une seule lecture pour toute la phrase. */
  lectures: string[];
  lecture: string;
  fr: string;
  fin: string;
}

const MOTS: Record<Langue, Mot[]> = {
  zh: MOTS_ZH.map((m) => ({ id: m.hz, langue: "zh", ecrit: m.hz, lecture: m.py, fr: m.fr, theme: m.theme, ...(m.radical ? { radical: m.radical } : {}), ...(m.cle ? { cle: m.cle } : {}) })),
  ar: MOTS_AR.map((m) => ({ id: m.ar, langue: "ar", ecrit: m.ar, lecture: m.tr, fr: m.fr, theme: m.theme, ...(m.racine ? { racine: m.racine } : {}), ...(m.cle ? { cle: m.cle } : {}) })),
};

const PHRASES: Record<Langue, Phrase[]> = {
  zh: PHRASES_ZH.map((p, i) => ({ id: `zh-p${i + 1}`, langue: "zh", mots: p.mots, lectures: p.py, lecture: p.py.join(" "), fr: p.fr, fin: p.fin })),
  ar: PHRASES_AR.map((p, i) => ({ id: `ar-p${i + 1}`, langue: "ar", mots: p.mots, lectures: [], lecture: p.tr, fr: p.fr, fin: p.fin })),
};

export const mots = (l: Langue): Mot[] => MOTS[l];
export const phrases = (l: Langue): Phrase[] => PHRASES[l];
const INDEX = new Map<string, Mot>();
for (const l of LANGUES) for (const m of MOTS[l]) INDEX.set(`${l}:${m.id}`, m);
export const motDe = (l: Langue, id: string): Mot | undefined => INDEX.get(`${l}:${id}`);

/** Le mot écrit, avec ou sans voyelles courtes (arabe). */
export const ecrit = (m: { ecrit: string; langue: Langue }, voyelles = true): string => (m.langue === "ar" && !voyelles ? sansHarakat(m.ecrit) : m.ecrit);

/** Texte complet d'une phrase (les mots chinois sont collés, les mots arabes séparés par des espaces). */
export function textePhrase(p: Phrase, voyelles = true): string {
  const t = p.langue === "zh" ? p.mots.join("") : p.mots.join(" ");
  return (p.langue === "ar" && !voyelles ? sansHarakat(t) : t) + p.fin;
}
