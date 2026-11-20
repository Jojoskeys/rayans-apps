// « Ton monde ce matin » : format du fichier « actu » (chiffré dans le dépôt privé comme les autres). Le veilleur
// (veilleur/src/actu.ts) l'écrit chaque matin ; la tuile Actu de l'iPhone le lit. Seulement des résumés courts et
// les liens vers les articles : jamais le texte des articles (droit voisin des éditeurs de presse).
// Version 2 (rubriques, images, « pourquoi c'est important », intro) : champs facultatifs, les anciennes éditions
// (sans rubrique) s'affichent encore, en une seule liste.

export interface SourceActu { media: string; lien: string; titre: string }
/** essentiel : les 3 sujets du jour les plus repris ; tech : informatique et IA ; cyber : cybersécurité ;
 *  geo : géopolitique ; bref : quelques titres de plus. */
export type RubriqueActu = "essentiel" | "tech" | "cyber" | "geo" | "bref";
export const RUBRIQUES: { id: RubriqueActu; nom: string; court: string }[] = [
  { id: "essentiel", nom: "L'essentiel", court: "Essentiel" },
  { id: "tech", nom: "Informatique & IA", court: "Tech" },
  { id: "cyber", nom: "Cybersécurité", court: "Cyber" },
  { id: "geo", nom: "Géopolitique", court: "Géopo" },
  { id: "bref", nom: "En bref", court: "Bref" },
];
export interface SujetActu {
  titre: string;
  /** Deux ou trois phrases écrites par l'IA, ou le début du chapô du média (édition gratuite), ou vide. */
  resume: string;
  sources: SourceActu[];
  /** Un seul média en parle : à prendre avec plus de recul. */
  uneSource: boolean;
  rubrique?: RubriqueActu;
  /** « Pourquoi c'est important », une phrase (édition IA seulement). */
  pourquoi?: string;
  /** Image fournie par le flux du média (https), affichée en miniature. */
  image?: string;
}
export interface EditionActu {
  /** Jour (AAAA-MM-JJ, heure de Paris). */
  jour: string;
  genere: number;
  /** « claude » : sujets choisis et résumés par Claude ; « simple » : édition gratuite (regroupement automatique). */
  mode: "claude" | "simple";
  /** Une ou deux phrases qui présentent l'essentiel du jour (édition IA). */
  intro?: string;
  sujets: SujetActu[];
}
export interface ActuData { editions: EditionActu[] }

/** Nombre de jours gardés pour la tuile. */
export const JOURS_GARDES = 7;
export const ACTU_VIDE: ActuData = { editions: [] };

const texte = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const lienSur = (v: unknown) => { const s = texte(v, 1000); return /^https?:\/\//i.test(s) ? s : ""; };
const RUB = new Set<string>(RUBRIQUES.map((r) => r.id));

/** Fichier lu (éventuellement abîmé) → données propres : liens http(s) seulement, images https, textes bornés. */
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
      const su: SujetActu = { titre, resume: texte(s.resume, 600), sources, uneSource: new Set(sources.map((x: SourceActu) => x.media)).size === 1 };
      if (RUB.has(s.rubrique as string)) su.rubrique = s.rubrique;
      const pourquoi = texte(s.pourquoi, 300);
      if (pourquoi) su.pourquoi = pourquoi;
      const image = texte(s.image, 1000);
      if (/^https:\/\//i.test(image)) su.image = image;
      sujets.push(su);
    }
    const ed: EditionActu = { jour: e.jour, genere: Number(e.genere) || 0, mode: e.mode === "claude" ? "claude" : "simple", sujets };
    const intro = texte(e.intro, 400);
    if (intro) ed.intro = intro;
    editions.push(ed);
  }
  editions.sort((a, b) => b.jour.localeCompare(a.jour));
  return { editions: editions.filter((e, i) => editions.findIndex((x) => x.jour === e.jour) === i).slice(0, JOURS_GARDES) };
}

/** Ajoute (ou remplace) l'édition du jour et ne garde que les derniers jours. */
export function ajouterEdition(d: ActuData, e: EditionActu): ActuData {
  return nettoyerActu({ editions: [e, ...d.editions.filter((x) => x.jour !== e.jour)] });
}

/** Sujets rangés par rubrique (dans l'ordre du sommaire). Une ancienne édition sans rubrique : une seule liste. */
export function parRubrique(e: EditionActu): { id: RubriqueActu | "une"; nom: string; court: string; sujets: SujetActu[] }[] {
  if (!e.sujets.some((s) => s.rubrique)) return e.sujets.length ? [{ id: "une", nom: "À la une", court: "À la une", sujets: e.sujets }] : [];
  return RUBRIQUES.map((r) => ({ ...r, sujets: e.sujets.filter((s) => (s.rubrique ?? "bref") === r.id) })).filter((r) => r.sujets.length);
}

/** Temps de lecture estimé (minutes, 1 au moins) : titres, résumés et « pourquoi », à 220 mots par minute. */
export function tempsLecture(e: EditionActu): number {
  const mots = [e.intro ?? "", ...e.sujets.flatMap((s) => [s.titre, s.resume, s.pourquoi ?? ""])].join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(mots / 220));
}

/** Titres de l'essentiel (pour la notification) ; à défaut, les premiers sujets. */
export function titresEssentiel(e: EditionActu, n = 3): string[] {
  const ess = e.sujets.filter((s) => s.rubrique === "essentiel");
  return (ess.length ? ess : e.sujets).slice(0, n).map((s) => s.titre);
}
