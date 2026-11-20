// « Où l'acheter pas cher » : 2 ou 3 magasins conseillés par type de produit. Ce sont des habitudes générales en
// France, pas des prix : les prix et les promotions changent selon la ville et la semaine.
import { detailArticle, rayon, type Article, type GroupeRayon } from "./courses.ts";

export const MAGASINS = [
  "Lidl", "Aldi", "Leclerc", "Marché", "Grand Frais", "Boucherie halal", "Rayon halal (Leclerc, Carrefour, Auchan)",
  "Épicerie orientale", "Site de nutrition sportive (en promo)", "Decathlon",
] as const;

export interface Conseil {
  type: string;
  magasins: string[];
  /** Conseil prudent, en une phrase. */
  note: string;
}

const T = {
  feculents: { type: "Féculents et céréales", magasins: ["Lidl", "Aldi", "Leclerc"], note: "En général moins cher en marque du magasin ou en grand paquet." },
  conserves: { type: "Conserves et légumes secs", magasins: ["Lidl", "Aldi", "Leclerc"], note: "Les marques du magasin sont en général les moins chères." },
  laitier: { type: "Produits laitiers", magasins: ["Lidl", "Aldi", "Leclerc"], note: "Compare le prix au kilo, surtout pour le skyr et le fromage blanc." },
  oeufs: { type: "Œufs", magasins: ["Lidl", "Aldi", "Marché"], note: "Les boîtes de 12 ou plus reviennent en général moins cher à l'œuf." },
  legumes: { type: "Fruits et légumes", magasins: ["Marché", "Grand Frais", "Lidl"], note: "En général moins cher en saison ; en fin de marché, il y a souvent des lots." },
  viande: { type: "Viande et poulet halal", magasins: ["Boucherie halal", "Rayon halal (Leclerc, Carrefour, Auchan)", "Lidl"], note: "Vérifie toujours le label halal ; Lidl n'en a que pour certains produits." },
  poisson: { type: "Poisson", magasins: ["Lidl", "Aldi", "Grand Frais"], note: "Le surgelé est en général moins cher que le frais." },
  epices: { type: "Épices", magasins: ["Épicerie orientale", "Grand Frais", "Lidl"], note: "En épicerie orientale, les grands sachets reviennent en général moins cher." },
  proteines: { type: "Whey et protéines", magasins: ["Site de nutrition sportive (en promo)", "Decathlon"], note: "Attends une promotion et vérifie qu'il n'y a pas de gélatine." },
  sucre: { type: "Épicerie sucrée", magasins: ["Lidl", "Aldi", "Leclerc"], note: "Vérifie la gélatine dans les biscuits et bonbons." },
  autre: { type: "Autres produits", magasins: ["Lidl", "Leclerc"], note: "Compare le prix au kilo." },
} satisfies Record<string, Conseil>;

const MOTIFS: [Conseil, string[]][] = [
  [T.feculents, ["riz", "pate", "semoule", "quinoa", "flocon", "avoine", "farine", "pain", "tortilla", "wrap", "galette", "boulgour", "maizena", "fecule", "muesli", "granola"]],
  [T.conserves, ["thon", "sardine", "mai", "haricot", "lentille", "pois chiche", "conserve", "tomate concassee", "coulis", "concentre", "lait de coco", "bouillon"]],
  [T.laitier, ["lait", "yaourt", "skyr", "fromage", "cottage", "mozzarella", "feta", "beurre", "creme", "emmental", "parmesan", "ricotta", "mascarpone", "cheddar", "kiri"]],
  [T.oeufs, ["oeuf", "blanc d'oeuf"]],
  [T.viande, ["poulet", "dinde", "boeuf", "steak", "viande", "hache", "merguez", "kefta", "agneau", "veau", "escalope", "saucisse", "cordon"]],
  [T.poisson, ["saumon", "cabillaud", "poisson", "crevette", "colin", "merlu"]],
  [T.epices, ["epice", "cumin", "paprika", "curry", "cannelle", "ras el hanout", "curcuma", "gingembre en poudre", "piment", "herbes de provence", "poivre", "sel"]],
  [T.proteines, ["whey", "proteine", "caseine", "isolat"]],
  [T.sucre, ["chocolat", "cacao", "biscuit", "speculoo", "sucre", "edulcorant", "erythritol", "stevia", "miel", "sirop", "confiture", "pate a tartiner", "beurre de cacahuete", "arome", "vanille", "levure", "noix", "amande", "noisette", "coco", "chia", "graine", "bonbon"]],
];

/** Conseils pour un produit (clé d'ingrédient). Le motif le plus précis gagne ; sinon d'après le rayon. */
export function conseil(cle: string): Conseil {
  let meilleur: Conseil | null = null, longueur = 0;
  const mots = ` ${cle} `;
  for (const [c, motifs] of MOTIFS) {
    for (const m of motifs) {
      if (m.length > longueur && mots.includes(` ${m}`)) { meilleur = c; longueur = m.length; }
    }
  }
  if (meilleur) return meilleur;
  return rayon(cle) === "Fruits et légumes" ? T.legumes : T.autre;
}

/** Magasin retenu pour un produit : le choix de Rayan, sinon le premier conseillé. */
export function magasinDe(cle: string, choix: Record<string, string>): string {
  return choix[cle] || conseil(cle).magasins[0];
}

export interface GroupeMagasin { magasin: string; articles: Article[] }

/** La liste regroupée par magasin (dans l'ordre de MAGASINS, puis les magasins ajoutés par Rayan). */
export function parMagasin(groupes: GroupeRayon[], choix: Record<string, string>): GroupeMagasin[] {
  const m = new Map<string, Article[]>();
  for (const g of groupes) for (const a of g.articles) {
    const nom = magasinDe(a.cle, choix);
    m.set(nom, [...(m.get(nom) ?? []), a]);
  }
  const ordre = (s: string) => { const i = (MAGASINS as readonly string[]).indexOf(s); return i < 0 ? 99 : i; };
  return [...m.entries()]
    .sort(([x], [y]) => ordre(x) - ordre(y) || x.localeCompare(y, "fr"))
    .map(([magasin, articles]) => ({ magasin, articles: articles.sort((x, y) => x.nom.localeCompare(y.nom, "fr")) }));
}

/** Texte à copier, regroupé par magasin : « À Lidl : … ». */
export function texteParMagasin(titre: string, groupes: GroupeMagasin[]): string {
  const blocs = groupes.map((g) => [`${a(g.magasin)} :`, ...g.articles.map((x) => {
    const d = detailArticle(x);
    return `- ${x.nom}${d ? ` : ${d}` : ""}`;
  })].join("\n"));
  return [titre, ...blocs, "Les prix varient selon les magasins et les semaines."].join("\n\n") + "\n";
}

/** « À Lidl », « Au marché », « À la boucherie halal », « Sur un site de nutrition sportive (en promo) ». */
export function a(magasin: string): string {
  const s = magasin.toLowerCase();
  if (s === "marché") return "Au marché";
  if (s.startsWith("site ")) return `Sur un ${magasin.charAt(0).toLowerCase()}${magasin.slice(1)}`;
  if (s.startsWith("rayon ")) return `Au ${magasin.charAt(0).toLowerCase()}${magasin.slice(1)}`;
  if (s.startsWith("boucherie") || s.startsWith("épicerie")) return `À la ${magasin.charAt(0).toLowerCase()}${magasin.slice(1)}`;
  return `À ${magasin}`;
}
