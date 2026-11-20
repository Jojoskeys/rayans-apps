// « Ton monde ce matin » : format du fichier « actu » (chiffré dans le dépôt privé comme les autres). Le veilleur
// (veilleur/src/actu.ts) l'écrit chaque matin ; la tuile Actu de l'iPhone le lit. Seulement des résumés courts et
// les liens vers les articles : jamais le texte des articles (droit voisin des éditeurs de presse).

export interface SourceActu { media: string; lien: string; titre: string }
export interface SujetActu {
  titre: string;
  /** Deux phrases neutres écrites par Claude ; vide dans l'édition simple (sans clé). */
  resume: string;
  sources: SourceActu[];
  /** Un seul média en parle : à prendre avec plus de recul. */
  uneSource: boolean;
}
export interface EditionActu {
  /** Jour (AAAA-MM-JJ, heure de Paris). */
  jour: string;
  genere: number;
  /** « claude » : sujets choisis et résumés par Claude ; « simple » : regroupement automatique des titres. */
  mode: "claude" | "simple";
  sujets: SujetActu[];
}
export interface ActuData { editions: EditionActu[] }

/** Nombre de jours gardés pour la tuile. */
export const JOURS_GARDES = 7;
export const ACTU_VIDE: ActuData = { editions: [] };

const texte = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const lienSur = (v: unknown) => { const s = texte(v, 1000); return /^https?:\/\//i.test(s) ? s : ""; };

/** Fichier lu (éventuellement abîmé) → données propres : liens http(s) seulement, textes bornés. */
export function nettoyerActu(v: unknown): ActuData {
  const eds = (v && typeof v === "object" && Array.isArray((v as ActuData).editions)) ? (v as ActuData).editions : [];
  const editions: EditionActu[] = [];
  for (const e of eds) {
    if (!e || typeof e !== "object" || !/^\d{4}-\d{2}-\d{2}$/.test(String(e.jour))) continue;
    const sujets: SujetActu[] = [];
    for (const s of Array.isArray(e.sujets) ? e.sujets : []) {
      if (!s || typeof s !== "object") continue;
      const sources = (Array.isArray(s.sources) ? s.sources : [])
        .map((x: Partial<SourceActu>) => ({ media: texte(x?.media, 60), lien: lienSur(x?.lien), titre: texte(x?.titre, 300) }))
        .filter((x: SourceActu) => x.media && x.lien);
      const titre = texte(s.titre, 200);
      if (!titre || !sources.length) continue;
      sujets.push({ titre, resume: texte(s.resume, 600), sources, uneSource: new Set(sources.map((x: SourceActu) => x.media)).size === 1 });
    }
    editions.push({ jour: e.jour, genere: Number(e.genere) || 0, mode: e.mode === "claude" ? "claude" : "simple", sujets });
  }
  editions.sort((a, b) => b.jour.localeCompare(a.jour));
  return { editions: editions.filter((e, i) => editions.findIndex((x) => x.jour === e.jour) === i).slice(0, JOURS_GARDES) };
}

/** Ajoute (ou remplace) l'édition du jour et ne garde que les derniers jours. */
export function ajouterEdition(d: ActuData, e: EditionActu): ActuData {
  return nettoyerActu({ editions: [e, ...d.editions.filter((x) => x.jour !== e.jour)] });
}
