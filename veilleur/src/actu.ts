// « Ton monde ce matin » : chaque matin, le veilleur lit une vingtaine de flux RSS/Atom gratuits (surtout informatique,
// IA et cybersécurité, puis géopolitique), garde les articles des dernières 24 h et prépare une revue en rubriques pour
// la tuile Actu de l'iPhone : « L'essentiel » (les 3 sujets les plus repris), « Informatique & IA », « Cybersécurité »,
// « Géopolitique », « En bref ». Les titres qui parlent de la même chose sont regroupés (mots communs) ; l'image que le
// flux fournit est gardée (miniature, lien vers l'article).
//  - Avec le secret ANTHROPIC_API_KEY (payant) : Claude (petit modèle) choisit et range les sujets, écrit pour chacun un
//    titre clair, 2-3 phrases avec ses propres mots et « pourquoi c'est important », plus une courte intro.
//  - Sans clé (cas normal, gratuit) : édition automatique, titre + début du chapô du média + liens, rubriques et images.
//    GitHub Models (IA gratuite depuis GitHub Actions) a fermé le 30 juillet 2026 : il n'y a plus d'IA gratuite fiable.
// Jamais le texte des articles : seulement un résumé court et le lien (droit voisin, art. L211-3-1 du CPI). Les bons
// plans et promotions sont écartés. Les avis de sécurité du CERT-FR sont rassemblés en un seul sujet.
import { todayISO } from "../../aujourdhui/src/core/counts.ts";
import { RUBRIQUES, type EditionActu, type RubriqueActu, type SourceActu, type SujetActu } from "../../mobile/src/shared/actu.ts";
import { entites } from "./texte.ts";

export type Rubrique = "tech" | "cyber" | "geo";
export interface Flux {
  media: string; url: string; rubrique: Rubrique; langue: "fr" | "en";
  /** Qualité du média (1 à 3) : départage les sujets et choisit le titre affiché. */
  poids: number;
  /** Le chapô du flux n'est pas un texte (Hacker News : points et liens). */
  sansChapo?: boolean;
  /** Beaucoup d'entrées techniques semblables (avis du CERT-FR) : rassemblées en un seul sujet. */
  agreger?: boolean;
}
// Tous vérifiés le 20 novembre 2026 (ils répondent et publient chaque jour).
export const FLUX: Flux[] = [
  { media: "Next", url: "https://next.ink/feed/", rubrique: "tech", langue: "fr", poids: 3 },
  { media: "Le Monde", url: "https://www.lemonde.fr/pixels/rss_full.xml", rubrique: "tech", langue: "fr", poids: 3 },
  { media: "Le Monde", url: "https://www.lemonde.fr/intelligence-artificielle/rss_full.xml", rubrique: "tech", langue: "fr", poids: 3 },
  { media: "Numerama", url: "https://www.numerama.com/tech/feed/", rubrique: "tech", langue: "fr", poids: 2 },
  { media: "01net", url: "https://www.01net.com/actualites/feed/", rubrique: "tech", langue: "fr", poids: 1 },
  { media: "Frandroid", url: "https://www.frandroid.com/feed", rubrique: "tech", langue: "fr", poids: 1 },
  { media: "Korben", url: "https://korben.info/feed", rubrique: "tech", langue: "fr", poids: 2 },
  { media: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", rubrique: "tech", langue: "en", poids: 3 },
  { media: "The Verge", url: "https://www.theverge.com/rss/index.xml", rubrique: "tech", langue: "en", poids: 2 },
  { media: "TechCrunch", url: "https://techcrunch.com/feed/", rubrique: "tech", langue: "en", poids: 2 },
  { media: "MIT Technology Review", url: "https://www.technologyreview.com/feed/", rubrique: "tech", langue: "en", poids: 3 },
  { media: "Hacker News", url: "https://hnrss.org/frontpage?points=150", rubrique: "tech", langue: "en", poids: 2, sansChapo: true },
  { media: "CERT-FR", url: "https://www.cert.ssi.gouv.fr/alerte/feed/", rubrique: "cyber", langue: "fr", poids: 3 },
  { media: "CERT-FR", url: "https://www.cert.ssi.gouv.fr/avis/feed/", rubrique: "cyber", langue: "fr", poids: 3, agreger: true },
  { media: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/", rubrique: "cyber", langue: "en", poids: 3 },
  { media: "Zataz", url: "https://www.zataz.com/feed/", rubrique: "cyber", langue: "fr", poids: 2 },
  { media: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews", rubrique: "cyber", langue: "en", poids: 2 },
  { media: "Le Monde", url: "https://www.lemonde.fr/international/rss_full.xml", rubrique: "geo", langue: "fr", poids: 3 },
  { media: "France 24", url: "https://www.france24.com/fr/monde/rss", rubrique: "geo", langue: "fr", poids: 2 },
  { media: "Courrier international", url: "https://www.courrierinternational.com/feed/all/rss.xml", rubrique: "geo", langue: "fr", poids: 2 },
  { media: "Le Grand Continent", url: "https://legrandcontinent.eu/fr/feed/", rubrique: "geo", langue: "fr", poids: 3 },
  { media: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml", rubrique: "geo", langue: "en", poids: 2 },
  { media: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", rubrique: "geo", langue: "en", poids: 2 },
];

export interface Article {
  media: string; titre: string; chapo: string; lien: string; publie: number;
  rubrique?: Rubrique; langue?: "fr" | "en"; poids?: number; image?: string; agrege?: boolean;
}

export const FENETRE_ACTU = 24 * 3_600_000;
/** Nombre de sujets par rubrique dans l'édition gratuite. */
export const QUOTAS = { essentiel: 3, tech: 8, cyber: 4, geo: 5, bref: 8 } as const;
/** Plafonds pour l'édition IA. */
export const QUOTAS_IA = { essentiel: 3, tech: 10, cyber: 5, geo: 6, bref: 8 } as const;
export const MODELE = "claude-haiku-5-5";

const balise = (bloc: string, nom: string) => {
  const v = new RegExp(`<${nom}(?:\\s[^>]*)?>([\\s\\S]*?)</${nom}>`).exec(bloc)?.[1] ?? "";
  return v.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
};
/** Texte lisible : CDATA, entités et balises HTML retirées, espaces resserrés. */
const propre = (s: string) => entites(entites(s).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const attr = (tag: string, nom: string) => entites(new RegExp(`\\s${nom}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag)?.[1] ?? "").trim();
const httpsSeul = (u: string) => (/^https:\/\/[^\s"'<>]+$/i.test(u) ? u : "");

/** Image fournie par le flux pour un article : media:content (la plus large), media:thumbnail, enclosure image, ou
 *  la première <img> du résumé. Seulement en https (la tuile est servie en https). */
export function imageArticle(item: string): string {
  const contenus = [...item.matchAll(/<media:content\b[^>]*>/gi)].map((m) => m[0])
    .filter((t) => { const med = attr(t, "medium"), ty = attr(t, "type"); return med ? med === "image" : ty ? ty.startsWith("image/") : /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(attr(t, "url")); })
    .sort((a, b) => (Number(attr(b, "width")) || 0) - (Number(attr(a, "width")) || 0));
  const candidats = [
    ...contenus.map((t) => attr(t, "url")),
    ...[...item.matchAll(/<media:thumbnail\b[^>]*>/gi)].map((m) => attr(m[0], "url")),
    ...[...item.matchAll(/<enclosure\b[^>]*>/gi)].filter((m) => attr(m[0], "type").startsWith("image/")).map((m) => attr(m[0], "url")),
    ...[...entites(item).matchAll(/<img\b[^>]*>/gi)].map((m) => attr(m[0], "src")),
  ];
  return candidats.map(httpsSeul).find(Boolean) ?? "";
}

/** Flux RSS 2.0 ou Atom → articles (titre, chapô court, lien, date, image). Les entrées sans lien ou sans date sont ignorées. */
export function lireRss(xml: string, media: string, f?: Partial<Flux>): Article[] {
  const out: Article[] = [];
  const atom = !/<item[\s>]/.test(xml);
  for (const bloc of xml.split(atom ? /<entry[\s>]/ : /<item[\s>]/).slice(1)) {
    const item = bloc.split(atom ? "</entry>" : "</item>")[0];
    const titre = propre(balise(item, "title"));
    const lienAtom = [...item.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).find((t) => !/rel=/.test(t) || /rel=["']alternate["']/.test(t));
    const lien = propre(balise(item, "link")) || (lienAtom ? attr(lienAtom, "href") : "") || (/<guid[^>]*isPermaLink="true"[^>]*>([^<]+)</.exec(item)?.[1] ?? "").trim();
    const publie = Date.parse(propre(balise(item, "pubDate")) || propre(balise(item, "dc:date")) || propre(balise(item, "published")) || propre(balise(item, "updated")));
    if (!titre || !/^https?:\/\//.test(lien) || !Number.isFinite(publie)) continue;
    // Contenus sponsorisés (publicité déguisée) : écartés.
    const auteur = [balise(item, "dc:creator"), balise(item, "author"), ...[...item.matchAll(/<category\b[^>]*>([\s\S]*?)<\/category>/g)].map((m) => m[1])].join(" ");
    if (/sponsor|publi-?r[ée]dactionnel|brandvoice|contenu partenaire/i.test(auteur)) continue;
    const chapo = f?.sansChapo ? "" : propre(balise(item, "description") || balise(item, "summary")).slice(0, 400);
    const a: Article = { media, titre: titre.slice(0, 300), chapo, lien, publie };
    const image = imageArticle(item);
    if (image) a.image = image;
    if (f?.rubrique) Object.assign(a, { rubrique: f.rubrique, langue: f.langue, poids: f.poids });
    if (f?.agreger) a.agrege = true;
    out.push(a);
  }
  return out;
}

/** Articles parus dans les dernières 24 h (une petite avance d'horloge est tolérée), sans doublon de lien, du plus récent au plus ancien. */
export function recents(articles: Article[], now: number): Article[] {
  const vus = new Set<string>();
  return articles.filter((a) => a.publie <= now + 10 * 60_000 && a.publie >= now - FENETRE_ACTU)
    .sort((a, b) => b.publie - a.publie)
    .filter((a) => { const k = a.lien.split("#")[0]; if (vus.has(k)) return false; vus.add(k); return true; });
}

const sansAccents = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const VIDES = new Set(("avec dans pour sans sous entre selon contre depuis apres avant pendant cette celui celle ceux elles leur leurs sont sera etre avoir fait faire plus moins tres tout tous toute toutes quand comme mais donc alors aussi encore deux trois nouveau nouvelle nouvelles premier premiere ministre president direct video photos pourquoi comment voici enfin veut peut faut jour jours mois semaine heure heures annee what with from that this have will after over into about says amid more than they their were been year years first news live just your best here could would should when where which while does make makes made lundi mardi mercredi jeudi vendredi samedi dimanche janvier fevrier mars avril juin juillet aout septembre octobre novembre decembre monday tuesday wednesday thursday friday saturday sunday january february march april june july august september october november december selon aussi notamment ainsi cela elle etait sont leurs entre plusieurs dont avait apres group company companies people votre vous notre nous bientot toujours jamais quoi rien chez vers ceci week semaine prochain prochaine dernier derniere fois avoir peut-etre need know still now mise mises place grand grande grands grandes warn warns warned say said report reports")
  .split(" "));
// Quelques mots anglais courants ramenés au français, pour reconnaître le même sujet dans les deux langues.
const EN_FR: Record<string, string> = {
  poland: "pologne", polish: "pologne", russia: "russie", russian: "russe", china: "chine", chinese: "chinois", myanmar: "birmanie",
  germany: "allemagne", german: "allemand", spain: "espagne", spanish: "espagnol", britain: "royaume", british: "britannique", italy: "italie",
  europe: "europe", european: "europeen", europeenne: "europeen", japan: "japon", india: "inde", turkey: "turquie", syria: "syrie", lebanon: "liban",
  israeli: "israel", iranian: "iran", ukrainian: "ukraine", venezuelan: "venezuela", brazil: "bresil", mexico: "mexique", africa: "afrique",
  african: "afrique", missile: "missile", genocide: "genocide", court: "cour", election: "election", elections: "election", ceasefire: "cessez",
  summit: "sommet", sanctions: "sanction", tariffs: "droits", agent: "agent", agents: "agent", screen: "ecran", screenshots: "captures",
};
const racine = (m: string) => { const w = EN_FR[m] ?? m; return EN_FR[w.replace(/s$/, "")] ?? (w.length > 4 ? w.replace(/s$/, "") : w); };
const FAIBLES = new Set(("critical critique critiques flaw flaws faille failles patch patches correctif correctifs security securite hacker hackers pirate pirates exploit exploited exploits "
  + "vulnerability vulnerabilities vulnerabilite vulnerabilites update updates attack attacks attaque attaques data donnees user users utilisateur utilisateurs device devices "
  + "windows microsoft google apple meta amazon openai trump musk elon iphone android chine chinois etats unis europe europeen union commission france francais russie russe ukraine "
  + "israel gaza iran guerre monde mondial world government gouvernement pays country state").split(" ").map(racine));
/** Mots qui comptent dans un titre (minuscules, sans accents, 4 lettres au moins, sans les mots vides ni les nombres ;
 *  quelques mots anglais ramenés au français, pluriel en -s retiré). */
export function motsCles(titre: string): Set<string> {
  return new Set(sansAccents(titre).split(/[^a-z0-9]+/).filter((m) => m.length >= 4 && !VIDES.has(m) && !/^\d+$/.test(m))
    .map(racine));
}

/** Regroupe les articles dont le titre partage au moins deux mots avec un article du groupe, ou un mot du titre et
 *  cinq du titre et du début du chapô (même sujet dit autrement) ; les sujets repris par le plus de médias d'abord. */
export function regrouper(articles: Article[]): Article[][] {
  const groupes: { arts: Article[]; mots: { t: Set<string>; c: Set<string> }[] }[] = [];
  // Un mot très courant dans l'actu tech ou internationale (« critical », « windows », « russie ») compte pour moitié.
  const communs = (a: Set<string>, b: Set<string>) => { let n = 0; for (const w of a) if (b.has(w)) n += FAIBLES.has(w) ? 0.5 : 1; return n; };
  for (const a of articles) {
    const m = { t: motsCles(a.titre), c: motsCles(`${a.titre} ${extraitChapo(a.chapo)}`) };
    // Un article qui rejoint plusieurs groupes les réunit.
    const proches = groupes.filter((x) => x.mots.some((s) => { const t = communs(m.t, s.t); return t >= 2 || (t >= 0.5 && communs(m.c, s.c) >= 4.5); }));
    const g = proches[0] ?? { arts: [], mots: [] };
    if (!proches.length) groupes.push(g);
    for (const autre of proches.slice(1)) { g.arts.push(...autre.arts); g.mots.push(...autre.mots); groupes.splice(groupes.indexOf(autre), 1); }
    g.arts.push(a); g.mots.push(m);
  }
  const medias = (g: Article[]) => new Set(g.map((a) => a.media)).size;
  const dernier = (g: Article[]) => Math.max(...g.map((a) => a.publie));
  return groupes.map((g) => g.arts).sort((a, b) => medias(b) - medias(a) || dernier(b) - dernier(a));
}

const CYBER = /\b(cyber\w*|ransomware\w*|rancongiciel\w*|vulnerabilit\w*|faille\w*|piratage\w*|pirate[sr]?|hack\w*|malware\w*|logiciels? malveillants?|phishing|hameconnage|fuites? de donnees|data breach\w*|breach\w*|zero[- ]day|cve-\d+|ddos|botnet\w*|spyware|logiciels? espions?|backdoor|porte derobee|infostealer\w*|stealer\w*)\b/;
const TECH = /\b(intelligence artificielle|artificial intelligence|ia|openai|chatgpt|anthropic|gemini|deepseek|mistral ai|nvidia|semi-?conducteurs?|semiconductors?|puces?|chips?|tsmc|huawei|tiktok|microsoft|google|apple|starlink|spacex|algorithm\w*|numerique)\b/;
const PROMO = /(bons? plans?|code promo|\bpromos?\b|promotion|black friday|cyber monday|soldes|prix (casse|choc|fou|bas|mini)|meilleur prix|baisse de prix|chute de prix|vente flash|french days|prime day|\bdeals?\b|coupon|reduction|-\s?\d+ ?%|\d+ ?% de remise|moitie prix|offre (speciale|limitee)|\bsale\b|\bdiscount|please help|support us|abonnez-vous)/;

const HORS = /\b(football|ligue des nations|ligue des champions|coupe du monde|mondial de|rugby|tennis|basket\w*|nba|formule 1|jeux olympiques|matchs?|premier league|champions league|nations league|world cup|quarter-?finals?|semi-?finals?|olympics?|grand prix|horoscope|meteo)\b/;

/** Bon plan, promotion, réduction, sport, météo ou page « en direct » : écarté de la revue. */
export const estPromo = (titre: string) => { const t = sansAccents(titre); return PROMO.test(t) || HORS.test(t) || /^\s*(en direct|live)\b/.test(t); };

/** Rubrique d'un article : celle de son flux, sauf un sujet de cybersécurité (partout) ou un sujet tech dans un flux
 *  de géopolitique (IA, puces, grandes entreprises du numérique). */
export function rubriqueArticle(a: Article): Rubrique {
  const t = sansAccents(a.titre);
  if (CYBER.test(t)) return "cyber";
  const r = a.rubrique ?? "geo";
  return r === "geo" && (TECH.test(t) || (a.langue === "en" && /\bai\b/.test(t))) ? "tech" : r;
}

export interface Groupe { arts: Article[]; rubrique: Rubrique; medias: number; score: number; dernier: number }
const ORDRE_R: Rubrique[] = ["cyber", "tech", "geo"];
/** Groupes notés : 10 points par média qui en parle, + qualité du meilleur média, + 2 pour l'informatique et la
 *  cybersécurité (la priorité de la revue). Les mieux notés d'abord. */
export function noter(groupes: Article[][]): Groupe[] {
  return groupes.map((arts) => {
    const votes = new Map<Rubrique, number>();
    for (const a of arts) { const r = rubriqueArticle(a); votes.set(r, (votes.get(r) ?? 0) + 1); }
    const rubrique = [...votes].sort((a, b) => b[1] - a[1] || ORDRE_R.indexOf(a[0]) - ORDRE_R.indexOf(b[0]))[0][0];
    const medias = new Set(arts.map((a) => a.media)).size;
    const score = medias * 10 + Math.max(...arts.map((a) => a.poids ?? 1)) + (rubrique === "geo" ? 0 : 2);
    return { arts, rubrique, medias, score, dernier: Math.max(...arts.map((a) => a.publie)) };
  }).sort((a, b) => b.score - a.score || b.dernier - a.dernier);
}

/** Un lien par média (l'article préféré de chaque média), 4 médias au plus. */
const sources = (arts: Article[], max = 4): SourceActu[] => {
  const tries = preferes(arts);
  return tries.filter((a, i) => tries.findIndex((x) => x.media === a.media) === i).slice(0, max)
    .map((a) => ({ media: a.media, lien: a.lien, titre: a.titre.slice(0, 200) }));
};
/** Les articles d'un sujet dans l'ordre de préférence : en français, du meilleur média, du plus récent. */
const preferes = (arts: Article[]) => [...arts].sort((a, b) => Number(b.langue !== "en") - Number(a.langue !== "en") || (b.poids ?? 1) - (a.poids ?? 1) || b.publie - a.publie);
const sujet = (titre: string, resume: string, arts: Article[], o: { rubrique?: RubriqueActu; pourquoi?: string } = {}): SujetActu => {
  const s: SujetActu = { titre, resume, sources: sources(arts, o.rubrique === "bref" ? 2 : 4), uneSource: new Set(arts.map((a) => a.media)).size === 1 };
  if (o.rubrique) s.rubrique = o.rubrique;
  if (o.pourquoi) s.pourquoi = o.pourquoi;
  const image = preferes(arts).find((a) => a.image)?.image;
  if (image) s.image = image;
  return s;
};

/** Les deux premières phrases du chapô, 280 caractères au plus (coupé sur un mot, avec « … »). */
export function extraitChapo(chapo: string): string {
  const t = chapo.replace(/\s+/g, " ").trim();
  const phrases = t.match(/[^.!?…]+[.!?…]+["»”]?/g) ?? [t];
  let out = phrases.slice(0, 2).map((x) => x.trim()).join(" ") || t;
  if (out.length > 280) out = `${out.slice(0, 279).replace(/\s+\S*$/, "")}…`;
  return out;
}

const listeEt = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} et ${xs.at(-1)}`);
/** Avis de sécurité du CERT-FR des dernières 24 h → un seul sujet : les logiciels concernés, les liens. */
export function sujetAvis(avis: Article[]): SujetActu | null {
  if (!avis.length) return null;
  const produits = [...new Set(avis.map((a) => /\bdans (?:les produits |le produit |les |la |le )?(.+?)(?:\s*\([^)]*\d{4}\))?\s*$/i.exec(a.titre)?.[1]?.trim() ?? "").filter(Boolean))];
  const liste = produits.length > 6 ? `${produits.slice(0, 6).join(", ")} et ${produits.length - 6} autre${produits.length > 7 ? "s" : ""}` : listeEt(produits);
  const n = avis.length;
  const s = sujet(`CERT-FR : ${n} avis de sécurité en 24 h`, produits.length ? `Logiciels concernés : ${liste}. Si tu en utilises un, installe la mise à jour de l'éditeur.` : "", avis, { rubrique: "cyber" });
  // Ici, plusieurs liens du même média : les 4 avis les plus récents.
  s.sources = avis.slice(0, 4).map((a) => ({ media: a.media, lien: a.lien, titre: a.titre.slice(0, 200) }));
  return s;
}

/** Choisit l'essentiel parmi les groupes notés : les plus repris (2 médias au moins), 2 sujets de géopolitique au
 *  plus et au moins un d'informatique ou de cybersécurité. */
export function choisirEssentiel(groupes: Groupe[], n: number = QUOTAS.essentiel): Groupe[] {
  const ess: Groupe[] = [];
  for (const g of groupes) {
    if (ess.length >= n) break;
    if (g.medias < 2 || (g.rubrique === "geo" && ess.filter((x) => x.rubrique === "geo").length >= n - 1)) continue;
    ess.push(g);
  }
  if (n > 0 && !ess.some((g) => g.rubrique !== "geo")) {
    const t = groupes.find((g) => g.rubrique !== "geo");
    if (t) { if (ess.length >= n) ess.pop(); ess.push(t); }
  }
  for (const g of groupes) { if (ess.length >= n) break; if (!ess.includes(g)) ess.push(g); }
  return ess.sort((a, b) => b.score - a.score || b.dernier - a.dernier);
}

/** Articles utiles : sans promotions, sans les avis rassemblés à part. */
const utiles = (articles: Article[]) => articles.filter((a) => !a.agrege && !estPromo(a.titre));

/** Édition gratuite (sans IA) : rubriques, sujets regroupés par mots communs, titre en français de préférence, début
 *  du chapô que le média publie lui-même dans son flux (usage personnel seulement, jamais republié), image, liens. */
export function editionSimple(articles: Article[], now: number): EditionActu {
  const groupes = noter(regrouper(utiles(articles)));
  const pris = new Set<Groupe>();
  const vers = (gs: Groupe[], rubrique: RubriqueActu) => gs.map((g) => {
    pris.add(g);
    const tries = preferes(g.arts);
    const avecChapo = rubrique === "bref" ? undefined : tries.find((a) => a.chapo.trim());
    return sujet(tries[0].titre, avecChapo ? extraitChapo(avecChapo.chapo) : "", g.arts, { rubrique });
  });
  const prendre = (r: Rubrique | null, n: number) => groupes.filter((g) => !pris.has(g) && (!r || g.rubrique === r)).slice(0, n);
  const essentiel = vers(choisirEssentiel(groupes), "essentiel");
  const tech = vers(prendre("tech", QUOTAS.tech), "tech");
  const avis = sujetAvis(articles.filter((a) => a.agrege));
  const cyber = vers(prendre("cyber", QUOTAS.cyber), "cyber");
  const geo = vers(prendre("geo", QUOTAS.geo), "geo");
  const bref = vers(prendre(null, QUOTAS.bref), "bref");
  return { jour: todayISO(now), genere: now, mode: "simple", sujets: [...essentiel, ...tech, ...cyber, ...(avis ? [avis] : []), ...geo, ...bref] };
}

export const SYSTEME = [
  "Tu rédiges « Ton monde ce matin », la revue de presse du matin d'un étudiant passionné d'informatique, lue sur son iPhone.",
  "On te donne une liste numérotée de sujets candidats parus en 24 h : chaque sujet regroupe un ou plusieurs articles (rubrique proposée, média, titre, début du chapô).",
  "Choisis et range les sujets : 3 « essentiel » (les plus importants et les plus repris du jour, dont au moins un d'informatique ou de cybersécurité),",
  "6 à 10 « tech » (nouveautés tech, IA, logiciels, matériel, développement), 2 à 5 « cyber » (cybersécurité), 4 à 6 « geo » (géopolitique, relations internationales),",
  "et jusqu'à 8 « bref » (titres seulement). Écarte les bons plans, promotions et tests d'achat.",
  "Pour chaque sujet sauf « bref » : un titre clair en français (12 mots au plus), un résumé de 2 à 3 phrases en français écrit avec tes propres mots,",
  "et « pourquoi » : une phrase qui dit pourquoi c'est important. Pour « bref » : seulement un titre clair en français.",
  "Ne recopie jamais de phrase ni de morceau de phrase des titres ou des chapôs ; traduis ce qui est en anglais. Neutre et factuel : pas d'avis, pas de citation.",
  "N'ajoute aucun fait, chiffre, nom ou date absent de la liste ; « pourquoi » explique la portée sans rien inventer. Ajoute « intro » : une à deux phrases qui présentent l'essentiel du jour.",
  "Indique les numéros des sujets candidats utilisés. Réponds seulement avec ce JSON, sans texte autour :",
  "{\"intro\":\"…\",\"sujets\":[{\"rubrique\":\"essentiel\",\"titre\":\"…\",\"resume\":\"…\",\"pourquoi\":\"…\",\"articles\":[1,4]}]}",
].join(" ");

const NOM_R: Record<Rubrique, string> = { tech: "tech", cyber: "cyber", geo: "geo" };
/** Sujets candidats envoyés à l'IA (les mieux notés d'abord, 90 au plus ; 3 titres et un chapô par sujet). */
export function construirePrompt(articles: Article[]): { system: string; user: string; liste: Article[][] } {
  const groupes = noter(regrouper(utiles(articles))).slice(0, 90);
  const user = groupes.map((g, i) => {
    const tries = preferes(g.arts);
    const titres = tries.slice(0, 3).map((a) => `${a.media} : ${a.titre}`).join(" | ");
    const chapo = tries.find((a) => a.chapo)?.chapo.slice(0, 260) ?? "";
    return `${i + 1}. [${NOM_R[g.rubrique]}] ${titres}${chapo ? ` — ${chapo}` : ""}`;
  }).join("\n");
  return { system: SYSTEME, user: `Sujets candidats :\n${user}`, liste: groupes.map((g) => g.arts) };
}

/** Vrai si le texte reprend au moins 8 mots de suite d'un titre ou d'un chapô (on ne l'affiche alors pas). */
export function recopie(resume: string, arts: Article[]): boolean {
  const mots = (s: string) => sansAccents(s).split(/[^a-z0-9]+/).filter(Boolean);
  const r = mots(resume);
  const source = arts.map((a) => ` ${mots(`${a.titre} ${a.chapo}`).join(" ")} `).join("|");
  for (let i = 0; i + 8 <= r.length; i++) if (source.includes(` ${r.slice(i, i + 8).join(" ")} `)) return true;
  return false;
}

const ORDRE: RubriqueActu[] = RUBRIQUES.map((r) => r.id);
/** Réponse de l'API Messages → édition. Lève une erreur si la réponse est inutilisable (on passe alors au repli).
 *  `liste` : les sujets candidats (numérotés à partir de 1). */
export function analyserReponse(reponse: unknown, liste: Article[][], now: number): EditionActu {
  const r = reponse as { stop_reason?: string; content?: { type: string; text?: string }[] };
  if (r?.stop_reason === "refusal") throw new Error("Claude a refusé la demande");
  const txt = (r?.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  const debut = txt.indexOf("{"), fin = txt.lastIndexOf("}");
  if (debut < 0 || fin <= debut) throw new Error("réponse sans JSON");
  const j = JSON.parse(txt.slice(debut, fin + 1)) as { intro?: unknown; sujets?: { rubrique?: unknown; titre?: unknown; resume?: unknown; pourquoi?: unknown; articles?: unknown }[] };
  const sujets: SujetActu[] = [];
  const compte = new Map<RubriqueActu, number>();
  const tous: Article[] = [];
  const dejaPris = new Set<number>();
  for (const s of Array.isArray(j.sujets) ? j.sujets : []) {
    const nums = (Array.isArray(s?.articles) ? s.articles : []).map(Number).filter((n) => liste[n - 1] && !dejaPris.has(n));
    const arts = nums.flatMap((n) => liste[n - 1]);
    const titre = typeof s?.titre === "string" ? s.titre.trim().slice(0, 200) : "";
    if (!titre || !arts.length) continue;
    const rubrique: RubriqueActu = ORDRE.includes(s.rubrique as RubriqueActu) ? s.rubrique as RubriqueActu : noter([arts])[0].rubrique;
    if ((compte.get(rubrique) ?? 0) >= QUOTAS_IA[rubrique]) continue;
    compte.set(rubrique, (compte.get(rubrique) ?? 0) + 1);
    nums.forEach((n) => dejaPris.add(n));
    tous.push(...arts);
    const net = (v: unknown, max: number) => { const t = typeof v === "string" ? v.trim().slice(0, max) : ""; return t && !recopie(t, arts) ? t : ""; };
    const bref = rubrique === "bref";
    sujets.push(sujet(titre, bref ? "" : net(s.resume, 600), arts, { rubrique, pourquoi: bref ? "" : net(s.pourquoi, 300) }));
  }
  if (!sujets.length) throw new Error("aucun sujet utilisable");
  sujets.sort((a, b) => ORDRE.indexOf(a.rubrique!) - ORDRE.indexOf(b.rubrique!));
  const e: EditionActu = { jour: todayISO(now), genere: now, mode: "claude", sujets };
  const intro = typeof j.intro === "string" ? j.intro.trim().slice(0, 400) : "";
  if (intro && !recopie(intro, tous)) e.intro = intro;
  return e;
}

/** Ajoute le sujet des avis du CERT-FR à la fin de la cybersécurité. */
function avecAvis(e: EditionActu, avis: SujetActu | null): EditionActu {
  if (!avis) return e;
  const i = e.sujets.findIndex((s) => ORDRE.indexOf(s.rubrique ?? "bref") > ORDRE.indexOf("cyber"));
  const sujets = [...e.sujets];
  sujets.splice(i < 0 ? sujets.length : i, 0, avis);
  return { ...e, sujets };
}

/** Appel direct de l'API Messages de Claude (fetch, sans dépendance). */
export async function editionClaude(articles: Article[], cle: string, now: number, base = "https://api.anthropic.com"): Promise<EditionActu> {
  const { system, user, liste } = construirePrompt(articles);
  const r = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: { "x-api-key": cle, "anthropic-version": "2026-10-21", "content-type": "application/json" },
    body: JSON.stringify({ model: MODELE, max_tokens: 12000, output_config: { effort: "low" }, system, messages: [{ role: "user", content: user }] }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!r.ok) throw new Error(`l'API Claude répond ${r.status}`);
  return avecAvis(analyserReponse(await r.json(), liste, now), sujetAvis(articles.filter((a) => a.agrege)));
}

export async function telechargerRss(f: Flux): Promise<Article[]> {
  const r = await fetch(f.url, { headers: { "User-Agent": "rayans-veilleur (lecteur RSS)" }, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`${f.media} répond ${r.status}`);
  return lireRss(await r.text(), f.media, f);
}

/** Édition du jour : flux lus en même temps (un média en panne n'empêche rien), Claude si la clé est là, sinon
 *  l'édition gratuite. */
export async function preparerEdition(now: number, o: { cle?: string; log: (m: string) => void; flux?: Flux[]; api?: string }): Promise<EditionActu | null> {
  const lus = await Promise.allSettled((o.flux ?? FLUX).map(telechargerRss));
  const tous: Article[] = [];
  for (const l of lus) {
    if (l.status === "fulfilled") tous.push(...l.value);
    else o.log(`flux d'actualité indisponible : ${String((l.reason as Error)?.message).slice(0, 80)}`);
  }
  const arts = recents(tous, now);
  if (!arts.length) return null;
  if (o.cle) {
    try { return await editionClaude(arts, o.cle, now, o.api); }
    catch (e) { o.log(`résumé par Claude impossible, édition gratuite : ${String((e as Error).message).slice(0, 80)}`); }
  }
  return editionSimple(arts, now);
}
