// Logique des petites tuiles de Rayan's Mobile : Courses (liste partagée), Mémo (notes rapides, dictées au
// clavier) et Demain (heure de réveil d'après le premier cours et le Fajr). Fonctions pures : l'heure, les
// identifiants et les données sont passés en paramètre.
import { mergeById } from "./merge.ts";

/** Texte sans accents ni majuscules, pour comparer et chercher. */
export const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// ----- Courses ------------------------------------------------------------------------------------------

export interface Article { id: string; nom: string; rayon: string; fait: boolean; maj: number }
export interface CoursesData { articles: Article[] }
export const COURSES_VIDES: CoursesData = { articles: [] };

/** Rayons dans l'ordre d'un magasin, et les mots qui y mènent. */
export const RAYONS: { nom: string; mots: string[] }[] = [
  { nom: "Fruits et légumes", mots: ["pomme", "banane", "orange", "citron", "tomate", "salade", "carotte", "oignon", "ail", "pomme de terre", "patate", "courgette", "poivron", "concombre", "avocat", "fraise", "raisin", "datte", "legume", "fruit", "herbe", "persil", "coriandre", "menthe", "champignon", "epinard", "brocoli"] },
  { nom: "Boulangerie", mots: ["pain", "baguette", "brioche", "croissant", "pain de mie", "galette", "tortilla"] },
  { nom: "Viande et poisson", mots: ["poulet", "boeuf", "viande", "steak", "hache", "agneau", "dinde", "poisson", "saumon", "thon", "crevette", "merguez", "halal"] },
  { nom: "Frais", mots: ["lait", "yaourt", "fromage", "beurre", "creme", "oeuf", "skyr", "fromage blanc", "jambon", "mozzarella", "feta", "kiri"] },
  { nom: "Épicerie", mots: ["riz", "pates", "farine", "sucre", "sel", "huile", "vinaigre", "epice", "cumin", "cafe", "the", "cereale", "flocon", "avoine", "miel", "confiture", "chocolat", "biscuit", "conserve", "lentille", "pois chiche", "haricot", "semoule", "sauce", "ketchup", "mayonnaise", "moutarde", "noix", "amande", "beurre de cacahuete", "whey", "proteine"] },
  { nom: "Surgelés", mots: ["surgele", "glace", "frite", "pizza"] },
  { nom: "Boissons", mots: ["eau", "jus", "soda", "sirop", "boisson", "coca"] },
  { nom: "Hygiène", mots: ["savon", "shampoing", "dentifrice", "brosse a dent", "deodorant", "gel douche", "rasoir", "coton", "mouchoir", "papier toilette", "creme hydratante"] },
  { nom: "Maison", mots: ["lessive", "liquide vaisselle", "eponge", "sac poubelle", "essuie-tout", "javel", "nettoyant", "ampoule", "pile", "aluminium", "film"] },
];
export const AUTRE_RAYON = "Autre";

/** Rayon deviné d'après le nom (le mot le plus long trouvé l'emporte : « pomme de terre » avant « pomme »). */
export function rayonDe(nom: string): string {
  const n = ` ${sansAccents(nom).replace(/[^a-z0-9 -]/g, " ")} `;
  let meilleur = { rayon: AUTRE_RAYON, longueur: 0 };
  for (const r of RAYONS) for (const m of r.mots) {
    const trouve = n.includes(` ${m} `) || n.includes(` ${m}s `) || n.includes(` ${m}x `);
    if (trouve && m.length > meilleur.longueur) meilleur = { rayon: r.nom, longueur: m.length };
  }
  return meilleur.rayon;
}

const ordreRayon = (r: string) => { const i = RAYONS.findIndex((x) => x.nom === r); return i < 0 ? RAYONS.length : i; };

export function nettoyerCourses(raw: unknown): CoursesData {
  const a = (raw as { articles?: unknown })?.articles;
  if (!Array.isArray(a)) return { articles: [] };
  return {
    articles: a.filter((x) => x && typeof x.id === "string" && typeof x.nom === "string" && x.nom.trim()).map((x) => ({
      id: x.id, nom: String(x.nom).slice(0, 120), rayon: typeof x.rayon === "string" && x.rayon ? x.rayon : rayonDe(x.nom),
      fait: x.fait === true, maj: Number.isFinite(x.maj) ? x.maj : 0,
    })),
  };
}

/** Ajoute un article ; s'il est déjà dans la liste (même nom), il est simplement remis « à acheter ». */
export function ajouterArticle(d: CoursesData, nom: string, now: number, id: string): CoursesData {
  const propre = nom.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!propre) return d;
  const cle = sansAccents(propre);
  const existant = d.articles.find((a) => sansAccents(a.nom) === cle);
  if (existant) return { articles: d.articles.map((a) => (a === existant ? { ...a, fait: false, maj: now } : a)) };
  return { articles: [...d.articles, { id, nom: propre, rayon: rayonDe(propre), fait: false, maj: now }] };
}

/** Plusieurs articles d'un coup : une ligne ou une virgule par article (pratique en dictée). */
export function ajouterPlusieurs(d: CoursesData, texte: string, now: number, ids: () => string): CoursesData {
  return texte.split(/[\n,;]+/).reduce((acc, n) => ajouterArticle(acc, n, now, ids()), d);
}

export const cocherArticle = (d: CoursesData, id: string, now: number): CoursesData =>
  ({ articles: d.articles.map((a) => (a.id === id ? { ...a, fait: !a.fait, maj: now } : a)) });
export const changerRayon = (d: CoursesData, id: string, rayon: string, now: number): CoursesData =>
  ({ articles: d.articles.map((a) => (a.id === id ? { ...a, rayon, maj: now } : a)) });
export const retirerArticle = (d: CoursesData, id: string): CoursesData => ({ articles: d.articles.filter((a) => a.id !== id) });
export const retirerFaits = (d: CoursesData): CoursesData => ({ articles: d.articles.filter((a) => !a.fait) });

/** Articles à acheter groupés par rayon (ordre du magasin), puis ceux déjà dans le panier. */
export function parRayon(d: CoursesData): { aAcheter: { rayon: string; articles: Article[] }[]; faits: Article[] } {
  const groupes = new Map<string, Article[]>();
  for (const a of d.articles.filter((x) => !x.fait)) groupes.set(a.rayon, [...(groupes.get(a.rayon) ?? []), a]);
  const aAcheter = [...groupes.entries()].sort((a, b) => ordreRayon(a[0]) - ordreRayon(b[0]))
    .map(([rayon, articles]) => ({ rayon, articles: articles.sort((x, y) => x.nom.localeCompare(y.nom, "fr")) }));
  return { aAcheter, faits: d.articles.filter((x) => x.fait).sort((x, y) => y.maj - x.maj) };
}

export function mergeCourses(base: CoursesData | undefined, local: CoursesData, remote: CoursesData): CoursesData {
  return { articles: mergeById(base?.articles, local.articles ?? [], remote.articles ?? [], (a) => a.id, (a, b) => a.maj > b.maj) };
}

// ----- Mémo ---------------------------------------------------------------------------------------------

export interface Memo { id: string; texte: string; epingle: boolean; cree: number; maj: number }
export interface MemosData { memos: Memo[] }
export const MEMOS_VIDES: MemosData = { memos: [] };
export const MEMO_MAX = 10_000;

export function nettoyerMemos(raw: unknown): MemosData {
  const m = (raw as { memos?: unknown })?.memos;
  if (!Array.isArray(m)) return { memos: [] };
  return {
    memos: m.filter((x) => x && typeof x.id === "string" && typeof x.texte === "string").map((x) => ({
      id: x.id, texte: String(x.texte).slice(0, MEMO_MAX), epingle: x.epingle === true,
      cree: Number.isFinite(x.cree) ? x.cree : 0, maj: Number.isFinite(x.maj) ? x.maj : 0,
    })),
  };
}

/** Mots-dièse du mémo (#fac, #idée…), sans accents, sans doublons. */
export const tagsDe = (texte: string) => [...new Set([...texte.matchAll(/#([\p{L}\p{N}_-]{2,30})/gu)].map((m) => sansAccents(m[1])))];

export function ajouterMemo(d: MemosData, texte: string, now: number, id: string): MemosData {
  const t = texte.trim().slice(0, MEMO_MAX);
  return t ? { memos: [{ id, texte: t, epingle: false, cree: now, maj: now }, ...d.memos] } : d;
}
export const modifierMemo = (d: MemosData, id: string, texte: string, now: number): MemosData =>
  ({ memos: d.memos.map((m) => (m.id === id ? { ...m, texte: texte.trim().slice(0, MEMO_MAX), maj: now } : m)) });
export const epinglerMemo = (d: MemosData, id: string, now: number): MemosData =>
  ({ memos: d.memos.map((m) => (m.id === id ? { ...m, epingle: !m.epingle, maj: now } : m)) });
export const supprimerMemo = (d: MemosData, id: string): MemosData => ({ memos: d.memos.filter((m) => m.id !== id) });

/** Recherche sans accents : tous les mots doivent apparaître (un mot « #tag » cherche ce mot-dièse). Épinglés d'abord. */
export function chercherMemos(d: MemosData, q: string): Memo[] {
  const mots = sansAccents(q).split(/\s+/).filter(Boolean);
  return d.memos
    .filter((m) => { const t = sansAccents(m.texte); const tags = tagsDe(m.texte); return mots.every((w) => (w.startsWith("#") ? tags.includes(w.slice(1)) : t.includes(w))); })
    .sort((a, b) => Number(b.epingle) - Number(a.epingle) || b.cree - a.cree);
}

/** Mots-dièse les plus utilisés, pour les filtres rapides. */
export function tagsFrequents(d: MemosData, n = 8): string[] {
  const c = new Map<string, number>();
  for (const m of d.memos) for (const t of tagsDe(m.texte)) c.set(t, (c.get(t) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map((e) => e[0]);
}

export function mergeMemos(base: MemosData | undefined, local: MemosData, remote: MemosData): MemosData {
  return { memos: mergeById(base?.memos, local.memos ?? [], remote.memos ?? [], (m) => m.id, (a, b) => a.maj > b.maj).sort((a, b) => b.cree - a.cree) };
}

// ----- Demain -------------------------------------------------------------------------------------------

export interface ReglagesDemain {
  /** Minutes pour se lever, se laver, manger. */
  preparation: number;
  /** Minutes de trajet jusqu'à la fac. */
  trajet: number;
  /** Minutes de marge avant le Fajr pour l'alarme de la prière. */
  avantFajr: number;
}
export const REGLAGES_DEMAIN: ReglagesDemain = { preparation: 45, trajet: 30, avantFajr: 10 };

export function nettoyerReglagesDemain(raw: unknown): ReglagesDemain {
  const r = (raw ?? {}) as Partial<ReglagesDemain>;
  const borne = (v: unknown, d: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : d);
  return { preparation: borne(r.preparation, REGLAGES_DEMAIN.preparation, 240), trajet: borne(r.trajet, REGLAGES_DEMAIN.trajet, 240), avantFajr: borne(r.avantFajr, REGLAGES_DEMAIN.avantFajr, 120) };
}

export interface CoursSimple { start: number; end: number; title: string; room: string }
export interface PlanDemain {
  /** Minuit (heure locale) du jour concerné. */
  jour: number;
  /** Avant 4 h du matin, « demain » veut dire la journée qui commence : on n'est pas encore couché. */
  aujourdhui: boolean;
  premier: CoursSimple | null;
  dernier: CoursSimple | null;
  nbCours: number;
  /** Heure du lever conseillée pour le premier cours. */
  reveilCours: number | null;
  fajr: number | null;
  reveilFajr: number | null;
}

/** Minuit local du jour donné décalé de `jours`. */
export const minuit = (t: number, jours = 0) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + jours); return d.getTime(); };

/**
 * Plan du lendemain. `fajrDe(t)` : heure du Fajr pour la journée contenant t (calculée par Rayan's Prière), ou null.
 */
export function planDemain(cours: CoursSimple[], fajrDe: (t: number) => number | null, now: number, r: ReglagesDemain): PlanDemain {
  const aujourdhui = new Date(now).getHours() < 4;
  const jour = minuit(now, aujourdhui ? 0 : 1);
  const fin = minuit(jour, 1);
  const duJour = cours.filter((c) => c.start >= jour && c.start < fin && c.end > c.start).sort((a, b) => a.start - b.start);
  const premier = duJour[0] ?? null;
  const dernier = duJour.length ? duJour.reduce((a, b) => (b.end > a.end ? b : a)) : null;
  const fajr = fajrDe(jour + 12 * 3_600_000);
  return {
    jour, aujourdhui, premier, dernier, nbCours: duJour.length,
    reveilCours: premier ? premier.start - (r.preparation + r.trajet) * 60_000 : null,
    fajr, reveilFajr: fajr !== null ? fajr - r.avantFajr * 60_000 : null,
  };
}
