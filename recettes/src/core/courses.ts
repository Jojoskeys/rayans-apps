// Liste de courses : les ingrédients des recettes cochées, regroupés par produit puis par rayon.
import { sansAccents } from "./lecture.ts";
import type { Recette } from "./types.ts";

const L = "(?![\\p{L}])"; // fin de mot (\b ne connaît pas les lettres accentuées)
const QUANTITE = new RegExp(
  // « 3e ingrédient » n'est pas une quantité ; les tournures de plusieurs mots passent avant « un ».
  `^(?:environ\\s+|~\\s*)?(?:\\d+(?:[.,/]\\d+)?(?:\\s*(?:à|-)\\s*\\d+(?:[.,]\\d+)?)?(?!(?:e|ème|er|re)${L})|[½¼¾]|un peu${L}|peu${L}|un bon${L}|une bonne${L}|un filet${L}|une pincée${L}|une poignée${L}|une?${L}|deux${L}|trois${L}|quatre${L}|cinq${L}|six${L}|quelques${L})\\s*`,
  "iu",
);
const UNITE = new RegExp(
  `^(?:g|gr|grammes?|kg|mg|ml|cl|dl|l|litres?|c\\.?\\s*à\\s*(?:soupe|café|s|c)\\.?|cuill[èe]res?(?:\\s*à\\s*(?:soupe|café))?|cas|cac|càs|càc|tasses?|verres?|bols?|tranches?|pincées?|poignées?|boîtes?|sachets?|gousses?|scoops?|dosettes?|mesures?|pots?|briques?|morceaux?|carrés?)${L}\\.?\\s*`,
  "iu",
);
const DE = /^(?:de\s+|d['’]\s*|du\s+|des\s+)/i;

/** Le produit à acheter, sans quantité ni précision : « 200 g de flocons d'avoine (fins) » → « flocons d'avoine ». */
export function nomIngredient(ligne: string): string {
  let s = ligne.replace(/\([^)]*\)/g, " ").split(/[,;:]/)[0].replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3; i++) {
    const avant = s;
    s = s.replace(QUANTITE, "").replace(UNITE, "").replace(DE, "").trim();
    if (s === avant) break;
  }
  return (s || ligne.trim()).toLowerCase();
}

/** Clé de regroupement : sans accents, sans « s » ou « x » de pluriel. « 2 Œufs » et « 1 oeuf » donnent « oeuf ». */
export function cleIngredient(ligne: string): string {
  return sansAccents(nomIngredient(ligne))
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((m) => (m.length > 3 ? m.replace(/[sx]$/, "") : m))
    .join(" ");
}

export const RAYONS = ["Fruits et légumes", "Viandes, poissons, œufs", "Frais et laitiers", "Épicerie", "Autres"] as const;
export type Rayon = (typeof RAYONS)[number];

const MOTIFS: [Rayon, string[]][] = [
  ["Fruits et légumes", ["banane", "pomme", "poire", "avocat", "oignon", "echalote", "tomate", "citron", "ail", "patate", "pomme de terre", "carotte", "courgette", "poivron", "salade", "laitue", "epinard", "brocoli", "champignon", "fruit", "fraise", "framboise", "myrtille", "mangue", "ananas", "concombre", "aubergine", "persil", "coriandre", "menthe", "basilic", "gingembre", "kiwi", "orange", "datte", "legume", "chou"]],
  ["Viandes, poissons, œufs", ["poulet", "dinde", "boeuf", "steak", "viande", "hache", "thon", "saumon", "poisson", "cabillaud", "oeuf", "blanc d'oeuf", "crevette", "merguez", "kefta", "agneau", "veau", "escalope", "sardine"]],
  ["Frais et laitiers", ["lait", "yaourt", "skyr", "fromage", "cottage", "mozzarella", "feta", "beurre", "creme", "emmental", "parmesan", "ricotta", "mascarpone", "philadelphia", "kiri", "cheddar"]],
  ["Épicerie", ["farine", "sucre", "edulcorant", "whey", "proteine", "flocon", "avoine", "riz", "pate", "chocolat", "cacao", "huile", "sel", "poivre", "epice", "levure", "miel", "sirop", "beurre de cacahuete", "pate a tartiner", "speculoo", "biscuit", "mai", "haricot", "lentille", "pois chiche", "sauce", "mayonnaise", "moutarde", "vinaigre", "cannelle", "vanille", "paprika", "cumin", "curry", "tortilla", "wrap", "pain", "amande", "noix", "noisette", "graine", "chia", "coco", "compote", "confiture", "bouillon", "concentre", "lait de coco", "maizena", "fecule", "semoule", "quinoa", "galette", "erythritol", "stevia", "arome"]],
];

/** Rayon d'un produit : le motif le plus long trouvé (« beurre de cacahuète » va en épicerie, « beurre » au frais). */
export function rayon(cle: string): Rayon {
  let meilleur: Rayon = "Autres", longueur = 0;
  const mots = ` ${cle} `;
  for (const [r, motifs] of MOTIFS) {
    for (const m of motifs) {
      if (m.length > longueur && (mots.includes(` ${m} `) || mots.includes(` ${m}`))) { meilleur = r; longueur = m.length; }
    }
  }
  return meilleur;
}

export interface Article {
  cle: string;
  nom: string;
  /** Chaque ligne d'ingrédient d'origine, avec le titre de sa recette. */
  lignes: { texte: string; recette: string }[];
}
export interface GroupeRayon { rayon: Rayon; articles: Article[] }

/** Les ingrédients des recettes données, regroupés par produit, rangés par rayon puis par ordre alphabétique. */
export function listeCourses(recettes: Recette[]): GroupeRayon[] {
  const articles = new Map<string, Article>();
  for (const r of recettes) {
    for (const texte of r.ingredients) {
      const cle = cleIngredient(texte);
      if (!cle) continue;
      let a = articles.get(cle);
      if (!a) articles.set(cle, (a = { cle, nom: nomIngredient(texte), lignes: [] }));
      a.lignes.push({ texte, recette: r.titre });
    }
  }
  const groupes = new Map<Rayon, Article[]>();
  for (const a of articles.values()) {
    const r = rayon(a.cle);
    groupes.set(r, [...(groupes.get(r) ?? []), a]);
  }
  return RAYONS.filter((r) => groupes.has(r)).map((r) => ({
    rayon: r,
    articles: groupes.get(r)!.sort((x, y) => x.nom.localeCompare(y.nom, "fr")),
  }));
}

/** Détail d'un article : les quantités demandées par chaque recette, quand elles disent plus que le nom. */
export function detailArticle(a: Article): string {
  const utiles = a.lignes.filter((l) => l.texte.trim().toLowerCase() !== a.nom);
  if (!utiles.length) return a.lignes.length > 1 ? `${a.lignes.length} recettes` : "";
  return a.lignes.map((l) => `${l.texte} (${l.recette})`).join(" ; ");
}

/** Texte à copier (pour une note ou un message) : un rayon par paragraphe, un tiret par produit. */
export function texteCourses(groupes: GroupeRayon[], recettes: Recette[]): string {
  const tete = `Liste de courses — ${recettes.map((r) => r.titre).join(", ")}`;
  const blocs = groupes.map((g) => [g.rayon, ...g.articles.map((a) => {
    const d = detailArticle(a);
    return `- ${a.nom}${d ? ` : ${d}` : ""}`;
  })].join("\n"));
  return [tete, ...blocs].join("\n\n") + "\n";
}
