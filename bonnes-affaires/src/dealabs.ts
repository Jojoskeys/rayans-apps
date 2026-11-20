// Dealabs : les bons plans de la communauté (Amazon, Cdiscount, Fnac, Darty, Boulanger…), lus par ses flux RSS
// officiels, publiés par le site pour être suivis. Aucun compte, une requête par flux et par passage.
import { lirePrix } from "./texte.ts";

export const FLUX_DEALABS = {
  nouveaux: "https://www.dealabs.com/rss/nouveaux",
  tendance: "https://www.dealabs.com/rss/tendance",
};

/** Un bon plan Dealabs. Prix en euros. */
export interface BonPlan {
  site: "Dealabs";
  titre: string;
  lien: string;
  /** Boutique qui vend (Amazon, Cdiscount…). */
  marchand?: string;
  prix?: number;
  /** « Prix habituel » écrit par l'auteur du bon plan, quand il le donne. */
  prixHabituel?: number;
  /** Réduction par rapport au prix habituel (0,5 = 50 % moins cher). */
  reduction?: number;
  /** Température du bon plan : votes de la communauté (plus c'est chaud, plus c'est une vraie affaire). */
  degres: number;
  categorie?: string;
  photo?: string;
  date?: Date;
}

function texteDe(xml: string, balise: string): string | undefined {
  const m = xml.match(new RegExp(`<${balise}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${balise}>`));
  return m?.[1].trim();
}

function attribut(xml: string, balise: string, nom: string): string | undefined {
  const b = xml.match(new RegExp(`<${balise}\\b[^>]*>`))?.[0];
  return b?.match(new RegExp(`\\s${nom}="([^"]*)"`))?.[1];
}

function decoder(t: string): string {
  return t
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** Lit un flux RSS Dealabs et rend ses bons plans. */
export function lireFluxDealabs(xml: string): BonPlan[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items.flatMap((item) => {
    const brut = texteDe(item, "title");
    const lien = texteDe(item, "guid") ?? texteDe(item, "link");
    if (!brut || !lien) return [];
    // Le titre commence par la température : « 128° - Écran 27" … » (ou « -12° - » si le bon plan est froid).
    const temp = decoder(brut).match(/^(-?\d+)°\s*-\s*([\s\S]*)$/);
    const titre = temp ? temp[2] : decoder(brut);
    const description = decoder(texteDe(item, "description") ?? "").replace(/<[^>]+>/g, " ");
    const prix = lirePrix(attribut(item, "pepper:merchant", "price")) ?? undefined;
    const habituel = lirePrix(description.match(/Prix habituel\s*:\s*([\d\s.,]+)\s*€/i)?.[1]) ?? undefined;
    const reduction = prix && habituel && habituel > prix ? 1 - prix / habituel : undefined;
    const date = texteDe(item, "pubDate");
    return [
      {
        site: "Dealabs" as const,
        titre: titre.trim(),
        lien,
        marchand: attribut(item, "pepper:merchant", "name"),
        prix,
        prixHabituel: habituel,
        reduction,
        degres: temp ? Number(temp[1]) : 0,
        categorie: texteDe(item, "category"),
        photo: attribut(item, "media:content", "url"),
        date: date ? new Date(date) : undefined,
      },
    ];
  });
}

/** Rapatrie les bons plans des deux flux (nouveaux et tendance), sans doublon. */
export async function chercherDealabs(chercher: typeof fetch = fetch): Promise<BonPlan[]> {
  const tous = new Map<string, BonPlan>();
  for (const url of Object.values(FLUX_DEALABS)) {
    const rep = await chercher(url, { headers: { "User-Agent": "Mozilla/5.0 (lecteur RSS personnel)", Accept: "application/rss+xml, text/xml" } });
    if (!rep.ok) throw new Error(`Dealabs : flux ${url} indisponible (${rep.status})`);
    // Le flux « tendance » vient en dernier : il donne la température la plus à jour.
    for (const b of lireFluxDealabs(await rep.text())) tous.set(b.lien, b);
  }
  return [...tous.values()];
}
