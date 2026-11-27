// Arabe : les 28 lettres et leurs formes, voyelles courtes (harakat), comparaison tolérante d'une réponse tapée.

export interface Lettre {
  /** La lettre isolée. */
  l: string;
  nom: string;
  /** Transcription simple. */
  tr: string;
  /** Comment la prononcer, pour un francophone. */
  son: string;
  /** Faux pour les 6 lettres qui ne s'attachent jamais à la lettre suivante (ا د ذ ر ز و). */
  lie: boolean;
}

export const LETTRES: Lettre[] = [
  { l: "ا", nom: "alif", tr: "ā", son: "« a » long ; sert aussi de support à la hamza", lie: false },
  { l: "ب", nom: "bāʾ", tr: "b", son: "« b » comme dans « bol »", lie: true },
  { l: "ت", nom: "tāʾ", tr: "t", son: "« t » comme dans « tapis »", lie: true },
  { l: "ث", nom: "thāʾ", tr: "th", son: "comme le « th » anglais de « think »", lie: true },
  { l: "ج", nom: "jīm", tr: "j", son: "« dj » comme dans « djinn »", lie: true },
  { l: "ح", nom: "ḥāʾ", tr: "ḥ", son: "« h » soufflé et serré, du fond de la gorge", lie: true },
  { l: "خ", nom: "khāʾ", tr: "kh", son: "comme la « jota » espagnole, un « r » raclé", lie: true },
  { l: "د", nom: "dāl", tr: "d", son: "« d » comme dans « dos »", lie: false },
  { l: "ذ", nom: "dhāl", tr: "dh", son: "comme le « th » anglais de « this »", lie: false },
  { l: "ر", nom: "rāʾ", tr: "r", son: "« r » roulé", lie: false },
  { l: "ز", nom: "zāy", tr: "z", son: "« z » comme dans « zéro »", lie: false },
  { l: "س", nom: "sīn", tr: "s", son: "« s » comme dans « sel »", lie: true },
  { l: "ش", nom: "shīn", tr: "sh", son: "« ch » comme dans « chat »", lie: true },
  { l: "ص", nom: "ṣād", tr: "ṣ", son: "« s » emphatique (bouche plus creuse)", lie: true },
  { l: "ض", nom: "ḍād", tr: "ḍ", son: "« d » emphatique", lie: true },
  { l: "ط", nom: "ṭāʾ", tr: "ṭ", son: "« t » emphatique", lie: true },
  { l: "ظ", nom: "ẓāʾ", tr: "ẓ", son: "« dh » emphatique", lie: true },
  { l: "ع", nom: "ʿayn", tr: "ʿ", son: "son de gorge serré, sans équivalent en français", lie: true },
  { l: "غ", nom: "ghayn", tr: "gh", son: "« r » grasseyé à la française", lie: true },
  { l: "ف", nom: "fāʾ", tr: "f", son: "« f » comme dans « fou »", lie: true },
  { l: "ق", nom: "qāf", tr: "q", son: "« k » prononcé tout au fond de la gorge", lie: true },
  { l: "ك", nom: "kāf", tr: "k", son: "« k » comme dans « kilo »", lie: true },
  { l: "ل", nom: "lām", tr: "l", son: "« l » comme dans « lune »", lie: true },
  { l: "م", nom: "mīm", tr: "m", son: "« m » comme dans « mer »", lie: true },
  { l: "ن", nom: "nūn", tr: "n", son: "« n » comme dans « nez »", lie: true },
  { l: "ه", nom: "hāʾ", tr: "h", son: "« h » expiré, comme en anglais « hello »", lie: true },
  { l: "و", nom: "wāw", tr: "w / ū", son: "« w » ou « ou » long", lie: false },
  { l: "ي", nom: "yāʾ", tr: "y / ī", son: "« y » ou « i » long", lie: true },
];

export type Forme = "isolee" | "debut" | "milieu" | "fin";
export const NOMS_FORMES: Record<Forme, string> = { isolee: "isolée", debut: "au début", milieu: "au milieu", fin: "à la fin" };

const ZWJ = "‍";
/**
 * La lettre dans une position du mot. On utilise le « liant invisible » (ZWJ) pour que la police dessine
 * la vraie forme. Les lettres qui ne s'attachent pas à la suivante n'ont que deux formes (isolée et finale).
 */
export function forme(l: Lettre, f: Forme): string {
  if (f === "isolee") return l.l;
  if (f === "debut") return l.lie ? l.l + ZWJ : l.l;
  if (f === "milieu") return l.lie ? ZWJ + l.l + ZWJ : ZWJ + l.l;
  return ZWJ + l.l;
}

/** Lettres qui ne diffèrent que par leurs points : bonnes pour les exercices difficiles. */
export const FAMILLES_POINTS: string[][] = [["ب", "ت", "ث", "ن", "ي"], ["ج", "ح", "خ"], ["د", "ذ"], ["ر", "ز"], ["س", "ش"], ["ص", "ض"], ["ط", "ظ"], ["ع", "غ"], ["ف", "ق"]];

/** Voyelles courtes et signes : fatha, damma, kasra, tanwin, shadda, sukun, alif suscrit. */
const HARAKAT = /[ً-ْٰ]/g;
export const aDesHarakat = (t: string): boolean => /[ً-ْ]/.test(t);
export const sansHarakat = (t: string): string => t.replace(HARAKAT, "");
export const LETTRES_ARABES = /[ء-ي]/;
export const estArabe = (t: string): boolean => LETTRES_ARABES.test(t);

/** Forme de comparaison en lettres arabes : sans voyelles, hamza et alif unifiés, ة = ه, ى = ي. */
export function normaliserArabe(t: string): string {
  return sansHarakat(t)
    .replace(/ـ/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ؤئ]/g, "ء")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[؟?!.،,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Forme de comparaison d'une transcription : sans accents ni apostrophes, lettres doublées simplifiées. */
export function normaliserTranscription(t: string): string {
  return t
    .toLowerCase()
    .replace(/ʿ|ʾ|'|’|`|‘|-|3|2/g, "")
    .replace(/7/g, "h")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ou/g, "u")
    .replace(/ch/g, "sh")
    .replace(/[^a-z]/g, "")
    .replace(/(sh|kh|gh|th|dh)\1/g, "$1")
    .replace(/(.)\1+/g, "$1");
}

/** Une réponse tapée (en lettres arabes ou en transcription) est-elle juste ? */
export function comparerArabe(attendu: { ecrit: string; tr: string }, reponse: string): boolean {
  const r = reponse.trim();
  if (!r) return false;
  if (estArabe(r)) return normaliserArabe(r) === normaliserArabe(attendu.ecrit);
  return normaliserTranscription(r) === normaliserTranscription(attendu.tr);
}

/** Pour les racines : les lettres de la racine se retrouvent-elles dans le mot ? (hamza et alif maqsura unifiés) */
export function lettresRacine(racine: string): string[] {
  return racine.split(/\s+/).filter(Boolean);
}
export function normaliserPourRacine(t: string): string {
  return sansHarakat(t).replace(/[أإآؤئ]/g, "ء").replace(/ى/g, "ي");
}

/** Clavier arabe à l'écran : les 28 lettres puis les formes utiles. */
export const CLAVIER: string[] = [...LETTRES.map((l) => l.l), "ة", "ى", "ء", "أ", "إ", "آ", "ؤ", "ئ"];
