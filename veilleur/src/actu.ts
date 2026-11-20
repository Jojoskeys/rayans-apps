// « Ton monde ce matin » : chaque matin, le veilleur lit quelques flux RSS gratuits de grands médias, garde les
// articles des dernières 24 h, puis prépare une petite revue de l'actualité pour la tuile Actu de l'iPhone.
//  - Avec le secret ANTHROPIC_API_KEY : Claude (petit modèle rapide) choisit 5 à 10 sujets et écrit pour chacun deux
//    phrases neutres avec ses propres mots, avec le nom du média et le lien.
//  - Sans clé (ou si l'appel échoue) : repli simple, les titres qui parlent de la même chose sont regroupés (mots
//    communs), 8 sujets au plus, titre + média + lien.
// Jamais le texte des articles : seulement un résumé court et le lien (droit voisin, art. L211-3-1 du CPI).
import { todayISO } from "../../aujourdhui/src/core/counts.ts";
import type { EditionActu, SourceActu, SujetActu } from "../../mobile/src/shared/actu.ts";
import { entites } from "./videos.ts";

export interface Flux { media: string; url: string }
export const FLUX: Flux[] = [
  { media: "Le Monde", url: "https://www.lemonde.fr/rss/une.xml" },
  { media: "franceinfo", url: "https://www.franceinfo.fr/monde.rss" },
  { media: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { media: "Le Monde Sciences", url: "https://www.lemonde.fr/sciences/rss_full.xml" },
];

export interface Article { media: string; titre: string; chapo: string; lien: string; publie: number }

export const FENETRE_ACTU = 24 * 3_600_000;
export const SUJETS_MAX_SIMPLE = 8;
export const MODELE = "claude-haiku-5-5";

const balise = (bloc: string, nom: string) => {
  const v = new RegExp(`<${nom}(?:\\s[^>]*)?>([\\s\\S]*?)</${nom}>`).exec(bloc)?.[1] ?? "";
  return v.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
};
/** Texte lisible : CDATA, entités et balises HTML retirées, espaces resserrés. */
const propre = (s: string) => entites(entites(s).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

/** Flux RSS 2.0 → articles (titre, chapô court, lien, date). Les entrées sans lien ou sans date sont ignorées. */
export function lireRss(xml: string, media: string): Article[] {
  const out: Article[] = [];
  for (const bloc of xml.split(/<item[\s>]/).slice(1)) {
    const item = bloc.split("</item>")[0];
    const titre = propre(balise(item, "title"));
    const lien = propre(balise(item, "link")) || (/<guid[^>]*isPermaLink="true"[^>]*>([^<]+)</.exec(item)?.[1] ?? "").trim();
    const publie = Date.parse(propre(balise(item, "pubDate")) || propre(balise(item, "dc:date")));
    if (!titre || !/^https?:\/\//.test(lien) || !Number.isFinite(publie)) continue;
    out.push({ media, titre: titre.slice(0, 300), chapo: propre(balise(item, "description")).slice(0, 400), lien, publie });
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

const VIDES = new Set(("avec dans pour sans sous entre selon contre depuis apres avant pendant cette celui celle ceux elles leur leurs sont sera etre avoir fait faire plus moins tres tout tous toute toutes quand comme mais donc alors aussi encore deux trois nouveau nouvelle nouvelles premier premiere ministre president direct video photos what with from that this have will after over into about says amid more than they their were been year years first news live").split(" "));
/** Mots qui comptent dans un titre (minuscules, sans accents, 4 lettres au moins, sans les mots vides). */
export function motsCles(titre: string): Set<string> {
  return new Set(titre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((m) => m.length >= 4 && !VIDES.has(m)));
}

/** Regroupe les articles qui partagent au moins deux mots du titre ; les sujets repris par le plus de médias d'abord. */
export function regrouper(articles: Article[]): Article[][] {
  const groupes: { arts: Article[]; mots: Set<string> }[] = [];
  for (const a of articles) {
    const m = motsCles(a.titre);
    const g = groupes.find((x) => [...m].filter((w) => x.mots.has(w)).length >= 2);
    if (g) { g.arts.push(a); for (const w of m) g.mots.add(w); }
    else groupes.push({ arts: [a], mots: m });
  }
  const medias = (g: Article[]) => new Set(g.map((a) => a.media)).size;
  const dernier = (g: Article[]) => Math.max(...g.map((a) => a.publie));
  return groupes.map((g) => g.arts).sort((a, b) => medias(b) - medias(a) || dernier(b) - dernier(a));
}

const sources = (arts: Article[]): SourceActu[] => {
  const vus = new Set<string>();
  // 5 liens au plus par sujet, un par média d'abord.
  const uniques = arts.filter((a) => !vus.has(a.lien) && !!vus.add(a.lien));
  const premiers = uniques.filter((a, i) => uniques.findIndex((x) => x.media === a.media) === i);
  return [...premiers, ...uniques.filter((a) => !premiers.includes(a))].slice(0, 5).map((a) => ({ media: a.media, lien: a.lien, titre: a.titre }));
};
const sujet = (titre: string, resume: string, arts: Article[]): SujetActu => ({ titre, resume, sources: sources(arts), uneSource: new Set(arts.map((a) => a.media)).size === 1 });

/** Les deux premières phrases du chapô, 280 caractères au plus (coupé sur un mot, avec « … »). */
export function extraitChapo(chapo: string): string {
  const t = chapo.replace(/\s+/g, " ").trim();
  const phrases = t.match(/[^.!?…]+[.!?…]+["»”]?/g) ?? [t];
  let out = phrases.slice(0, 2).map((x) => x.trim()).join(" ") || t;
  if (out.length > 280) out = `${out.slice(0, 279).replace(/\s+\S*$/, "")}…`;
  return out;
}

/** Édition sans clé (gratuite) : sujets regroupés par mots communs, titre + médias + liens, 8 au plus. Le résumé est
 *  le début du chapô que le média publie lui-même dans son flux (fait pour les lecteurs de flux) : usage personnel
 *  seulement, jamais republié tel quel sur un compte public. */
export function editionSimple(articles: Article[], now: number): EditionActu {
  const ordre = (a: Article) => { const i = FLUX.findIndex((f) => f.media === a.media); return i < 0 ? FLUX.length : i; };
  const sujets = regrouper(articles).slice(0, SUJETS_MAX_SIMPLE).map((g) => {
    const tries = [...g].sort((a, b) => ordre(a) - ordre(b) || b.publie - a.publie);
    const avecChapo = tries.find((a) => a.chapo.trim());
    return sujet(tries[0].titre, avecChapo ? extraitChapo(avecChapo.chapo) : "", g);
  });
  return { jour: todayISO(now), genere: now, mode: "simple", sujets };
}

export const SYSTEME = [
  "Tu prépares « Ton monde ce matin », une courte revue de l'actualité du monde pour un étudiant, lue sur son téléphone.",
  "On te donne une liste numérotée d'articles parus en 24 h (média, titre, chapô). Choisis les 5 à 10 sujets les plus importants",
  "pour comprendre le monde ce jour-là (international, société, science, économie), en préférant ceux dont parlent plusieurs médias.",
  "Pour chaque sujet : un titre court en français et exactement deux phrases en français, neutres et factuelles, écrites avec tes",
  "propres mots. Ne recopie jamais de phrase ni de morceau de phrase des titres ou des chapôs, pas de citation, pas d'avis, pas",
  "d'adjectif qui juge. N'ajoute aucun fait absent de la liste. Indique les numéros des articles qui traitent du sujet.",
  "Réponds seulement avec ce JSON, sans texte autour : {\"sujets\":[{\"titre\":\"…\",\"resume\":\"…\",\"articles\":[1,4]}]}",
].join(" ");

/** Liste des articles envoyée à Claude (les plus récents d'abord, 80 au plus). */
export function construirePrompt(articles: Article[]): { system: string; user: string; liste: Article[] } {
  const liste = articles.slice(0, 80);
  const user = liste.map((a, i) => `${i + 1}. [${a.media}] ${a.titre}${a.chapo ? ` — ${a.chapo.slice(0, 300)}` : ""}`).join("\n");
  return { system: SYSTEME, user: `Articles :\n${user}`, liste };
}

/** Vrai si le résumé reprend au moins 8 mots de suite d'un titre ou d'un chapô (on n'affiche alors pas ce résumé). */
export function recopie(resume: string, arts: Article[]): boolean {
  const mots = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(Boolean);
  const r = mots(resume);
  const source = arts.map((a) => ` ${mots(`${a.titre} ${a.chapo}`).join(" ")} `).join("|");
  for (let i = 0; i + 8 <= r.length; i++) if (source.includes(` ${r.slice(i, i + 8).join(" ")} `)) return true;
  return false;
}

/** Réponse de l'API Messages → édition. Lève une erreur si la réponse est inutilisable (on passe alors au repli). */
export function analyserReponse(reponse: unknown, liste: Article[], now: number): EditionActu {
  const r = reponse as { stop_reason?: string; content?: { type: string; text?: string }[] };
  if (r?.stop_reason === "refusal") throw new Error("Claude a refusé la demande");
  const txt = (r?.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  const debut = txt.indexOf("{"), fin = txt.lastIndexOf("}");
  if (debut < 0 || fin <= debut) throw new Error("réponse sans JSON");
  const j = JSON.parse(txt.slice(debut, fin + 1)) as { sujets?: { titre?: unknown; resume?: unknown; articles?: unknown }[] };
  const sujets: SujetActu[] = [];
  for (const s of Array.isArray(j.sujets) ? j.sujets : []) {
    const arts = (Array.isArray(s?.articles) ? s.articles : []).map((n) => liste[Number(n) - 1]).filter((a): a is Article => !!a);
    const titre = typeof s?.titre === "string" ? s.titre.trim().slice(0, 200) : "";
    if (!titre || !arts.length) continue;
    const resume = typeof s.resume === "string" ? s.resume.trim().slice(0, 600) : "";
    sujets.push(sujet(titre, recopie(resume, arts) ? "" : resume, arts));
  }
  if (!sujets.length) throw new Error("aucun sujet utilisable");
  return { jour: todayISO(now), genere: now, mode: "claude", sujets: sujets.slice(0, 10) };
}

/** Appel direct de l'API Messages de Claude (fetch, sans dépendance). */
export async function editionClaude(articles: Article[], cle: string, now: number, base = "https://api.anthropic.com"): Promise<EditionActu> {
  const { system, user, liste } = construirePrompt(articles);
  const r = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: { "x-api-key": cle, "anthropic-version": "2026-10-21", "content-type": "application/json" },
    body: JSON.stringify({ model: MODELE, max_tokens: 8000, output_config: { effort: "low" }, system, messages: [{ role: "user", content: user }] }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!r.ok) throw new Error(`l'API Claude répond ${r.status}`);
  return analyserReponse(await r.json(), liste, now);
}

export async function telechargerRss(f: Flux): Promise<Article[]> {
  const r = await fetch(f.url, { headers: { "User-Agent": "rayans-veilleur (lecteur RSS)" }, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`${f.media} répond ${r.status}`);
  return lireRss(await r.text(), f.media);
}

/** Édition du jour : flux lus un par un (un média en panne n'empêche rien), Claude si la clé est là, sinon le repli. */
export async function preparerEdition(now: number, o: { cle?: string; log: (m: string) => void; flux?: Flux[]; api?: string }): Promise<EditionActu | null> {
  const tous: Article[] = [];
  for (const f of o.flux ?? FLUX) {
    try { tous.push(...await telechargerRss(f)); }
    catch (e) { o.log(`flux d'actualité indisponible : ${String((e as Error).message).slice(0, 80)}`); }
  }
  const arts = recents(tous, now);
  if (!arts.length) return null;
  if (o.cle) {
    try { return await editionClaude(arts, o.cle, now, o.api); }
    catch (e) { o.log(`résumé par Claude impossible, édition simple : ${String((e as Error).message).slice(0, 80)}`); }
  }
  return editionSimple(arts, now);
}
