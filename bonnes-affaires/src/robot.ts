// Robot prudent Vinted et Leboncoin, choisi par Rayan en connaissant le risque : ces sites interdisent les robots
// et peuvent bloquer un temps la connexion de la box (pages « vérifie que tu es humain » sur le Wi-Fi).
// Règles de prudence :
//   - sans compte, sans cookie : il lit la page de recherche publique, comme un navigateur ;
//   - peu de recherches par site et par passage (parPassage, 1 par défaut), chacune à son tour, quelques
//     secondes d'écart entre deux pages ;
//   - rien la nuit (de nuitDebut à nuitFin) ;
//   - aucune ruse : dès qu'un site demande une vérification ou refuse, pause automatique (6 h, puis 12 h,
//     24 h, 48 h au plus), signalée sur Discord ; le compteur repart à zéro après un passage réussi.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Annonce, Recherche } from "./types.ts";

export type SiteRobot = "Vinted" | "Leboncoin";

const NAVIGATEUR = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "fr-FR,fr;q=0.9",
};

/** Le site a demandé une vérification ou refusé : on s'arrête, on ne force pas. */
export class Blocage extends Error {}

function verifierPage(site: SiteRobot, statut: number, html: string) {
  // Pages de vérification (DataDome, Cloudflare). Le simple script Cloudflare présent sur toute page ne compte pas.
  if (statut === 403 || statut === 429 || /captcha-delivery\.com|geo\.captcha|<title>Just a moment|cf-chl-/i.test(html)) {
    throw new Blocage(`${site} demande une vérification (${statut})`);
  }
  if (statut >= 400) throw new Error(`${site} : page indisponible (${statut})`);
}

// ---------- Vinted ----------

/** Lit les annonces d'une page de recherche Vinted (données intégrées à la page). */
export function lireVinted(html: string, r: Recherche): Annonce[] {
  const s = html.replace(/\\"/g, '"');
  const morceaux = s.split('"productItem":{"id":').slice(1);
  const vues = new Set<string>();
  return morceaux.flatMap((m) => {
    const id = m.match(/^(\d+)/)?.[1];
    const titre = m.match(/"title":"((?:[^"\\]|\\.)*)"/)?.[1];
    const url = m.match(/"url":"(\/items\/[^"]+)"/)?.[1];
    // Prix payé par l'acheteur : protection acheteur comprise (le port s'ajoute, selon le point relais).
    const total = Number(m.match(/"totalItemPrice":\{"amount":"([\d.]+)"/)?.[1] ?? m.match(/"price":\{"amount":"([\d.]+)"/)?.[1]);
    if (!id || !titre || !url || !(total > 0) || vues.has(id)) return [];
    vues.add(id);
    const photo = m.match(/"photos":\[\{"url":"(https:[^"]+)"/)?.[1] ?? m.match(/"thumbnailUrl":"(https:[^"]+)"/)?.[1];
    const etat = m.match(/"secondLine":"([^"]*)"/)?.[1];
    return [{
      site: "Vinted",
      titre: decoderJson(titre),
      prix: total,
      port: null,
      lien: `https://www.vinted.fr${url}`,
      recherche: r.nom,
      etat: etat && !etat.startsWith("$") ? decoderJson(etat) : undefined,
      photo,
      livrable: true,
      remiseEnMain: false,
    }];
  });
}

function decoderJson(t: string): string {
  try {
    return JSON.parse(`"${t}"`);
  } catch {
    return t;
  }
}

export async function chercherVinted(r: Recherche, chercher: typeof fetch = fetch): Promise<Annonce[]> {
  const url = `https://www.vinted.fr/catalog?search_text=${encodeURIComponent(r.mots)}&order=newest_first${r.prixMax ? `&price_to=${r.prixMax}` : ""}`;
  const rep = await chercher(url, { headers: NAVIGATEUR });
  const html = await rep.text();
  verifierPage("Vinted", rep.status, html);
  if (!html.includes("productItem") && !/catalog/i.test(html)) throw new Blocage("Vinted : page inattendue (vérification ?)");
  return lireVinted(html, r);
}

// ---------- Leboncoin ----------

interface AnnonceLbc {
  list_id: number;
  subject: string;
  price?: number[];
  url: string;
  ad_type?: string;
  location?: { zipcode?: string; city?: string; lat?: number; lng?: number };
  images?: { urls?: string[]; urls_large?: string[] };
  attributes?: { key: string; value: string; value_label?: string }[];
  owner?: { type?: string };
}

/** Lit les annonces d'une page de recherche Leboncoin (données intégrées à la page). */
export function lireLeboncoin(html: string, r: Recherche): Annonce[] {
  const brut = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!brut) throw new Blocage("Leboncoin : page sans annonces (vérification ?)");
  const ads: AnnonceLbc[] = JSON.parse(brut).props?.pageProps?.searchData?.ads ?? [];
  return ads.flatMap((a) => {
    const prix = a.price?.[0];
    if (a.ad_type && a.ad_type !== "offer") return [];
    if (!prix || prix <= 0) return [];
    const attr = (k: string) => a.attributes?.find((x) => x.key === k);
    const envoi = attr("shipping_type");
    const livrable = attr("shippable")?.value === "true" || Boolean(envoi && envoi.value !== "face_to_face");
    return [{
      site: "Leboncoin",
      titre: a.subject,
      prix,
      port: null,
      lien: a.url,
      recherche: r.nom,
      etat: attr("condition")?.value_label,
      photo: a.images?.urls_large?.[0] ?? a.images?.urls?.[0],
      codePostal: a.location?.zipcode,
      ville: a.location?.city,
      lat: a.location?.lat,
      lon: a.location?.lng,
      livrable,
      remiseEnMain: true,
    }];
  });
}

export async function chercherLeboncoin(r: Recherche, chercher: typeof fetch = fetch): Promise<Annonce[]> {
  const url = `https://www.leboncoin.fr/recherche?text=${encodeURIComponent(r.mots)}&sort=time&order=desc${r.prixMax ? `&price=min-${r.prixMax}` : ""}`;
  const rep = await chercher(url, { headers: NAVIGATEUR });
  const html = await rep.text();
  verifierPage("Leboncoin", rep.status, html);
  return lireLeboncoin(html, r);
}

// ---------- Mémoire du robot : rotation, pauses, recherches déjà amorcées ----------

interface EtatSite {
  curseur: number;
  pauseJusqua?: number;
  blocages: number;
}

export interface EtatRobot {
  sites: Partial<Record<SiteRobot, EtatSite>>;
  /** « site|recherche » déjà vus une fois : leur premier passage est retenu sans envoi (pas d'inondation). */
  amorces: string[];
}

export function chargerEtat(fichier: string): EtatRobot {
  if (!existsSync(fichier)) return { sites: {}, amorces: [] };
  return { sites: {}, amorces: [], ...JSON.parse(readFileSync(fichier, "utf8")) };
}

export function enregistrerEtat(fichier: string, etat: EtatRobot) {
  mkdirSync(dirname(fichier), { recursive: true });
  writeFileSync(fichier, JSON.stringify(etat, null, 1));
}

const HEURE = 3600 * 1000;

/** Durée de pause après le n-ième blocage d'affilée : 6 h, 12 h, 24 h, puis 48 h. */
export function dureePause(blocages: number): number {
  return Math.min(6 * 2 ** (blocages - 1), 48) * HEURE;
}

export function estLaNuit(quand: Date, debut: number, fin: number): boolean {
  const h = quand.getHours();
  return debut <= fin ? h >= debut && h < fin : h >= debut || h < fin;
}

export interface ResultatRobot {
  annonces: Annonce[];
  /** Recherches lues avec succès à ce passage, « site|recherche ». */
  lues: string[];
  /** Messages à poster sur Discord (pause, reprise). */
  messages: string[];
}

export interface OptionsRobot {
  sites: SiteRobot[];
  nuitDebut: number;
  nuitFin: number;
  /** Recherches lues par site et par passage (1 par défaut, 3 au plus). */
  parPassage?: number;
  /** Attente entre deux pages d'un même site (ms). */
  ecartMs?: number;
  maintenant?: Date;
  chercheurs?: Partial<Record<SiteRobot, (r: Recherche) => Promise<Annonce[]>>>;
}

/** Un passage du robot : une recherche par site, à son tour, sauf la nuit ou en pause. */
export async function passageRobot(recherches: Recherche[], etat: EtatRobot, o: OptionsRobot): Promise<ResultatRobot> {
  const maintenant = o.maintenant ?? new Date();
  const res: ResultatRobot = { annonces: [], lues: [], messages: [] };
  if (!recherches.length || estLaNuit(maintenant, o.nuitDebut, o.nuitFin)) return res;
  const chercheurs = { Vinted: chercherVinted, Leboncoin: chercherLeboncoin, ...o.chercheurs };
  const parPassage = Math.min(Math.max(o.parPassage ?? 1, 1), 3, recherches.length);
  for (const site of o.sites) {
    const e: EtatSite = (etat.sites[site] ??= { curseur: 0, blocages: 0 });
    for (let n = 0; n < parPassage; n++) {
      if (e.pauseJusqua && e.pauseJusqua > maintenant.getTime()) break;
      if (n > 0) await new Promise((ok) => setTimeout(ok, o.ecartMs ?? 4000));
      const r = recherches[e.curseur % recherches.length];
      e.curseur = (e.curseur + 1) % recherches.length;
      try {
        const trouvees = await chercheurs[site](r);
        res.annonces.push(...trouvees);
        res.lues.push(`${site}|${r.nom}`);
        if (e.pauseJusqua) res.messages.push(`▶️ ${site} : le robot reprend.`);
        e.blocages = 0;
        delete e.pauseJusqua;
        console.log(`${site} · ${r.nom} : ${trouvees.length} annonces`);
      } catch (err) {
        if (!(err instanceof Blocage)) {
          console.warn((err as Error).message);
          continue;
        }
        e.blocages++;
        const duree = dureePause(e.blocages);
        e.pauseJusqua = maintenant.getTime() + duree;
        const msg = `⏸️ ${err.message} : robot ${site} en pause ${duree / HEURE} h, sans rien forcer. Si ça revient souvent, on l'arrête.`;
        res.messages.push(msg);
        console.warn(msg);
      }
    }
  }
  return res;
}
