// Questions d'actualité tirées de l'édition « Ton monde » que le veilleur prépare chaque matin (format
// EditionActu de mobile/src/shared/actu.ts, recopié ici pour que src/core reste autonome). Sans IA : on ne
// fait que croiser ce qui est dans l'édition (rubrique, médias, titres, début du résumé). Jamais de long
// morceau d'article : un titre (borné) et au plus une phrase de résumé (160 caractères).
import type { Question } from "./questions.ts";
import { makeRng, shuffle, type Rng } from "./rng.ts";

export interface SourceActu { media: string; lien: string; titre: string }
export type RubriqueActu = "essentiel" | "tech" | "cyber" | "geo" | "bref";
export interface SujetActu {
  titre: string;
  resume: string;
  sources: SourceActu[];
  uneSource: boolean;
  rubrique?: RubriqueActu;
  pourquoi?: string;
  image?: string;
}
export interface EditionActu {
  jour: string;
  genere: number;
  mode: "claude" | "simple";
  intro?: string;
  sujets: SujetActu[];
}

export const NOMS_RUBRIQUES: Record<RubriqueActu, string> = {
  essentiel: "L'essentiel", tech: "Informatique & IA", cyber: "Cybersécurité", geo: "Géopolitique", bref: "En bref",
};
/** Rubriques « de thème » : « L'essentiel » et « En bref » disent l'importance du sujet, pas son domaine. */
const THEMATIQUES: RubriqueActu[] = ["tech", "cyber", "geo"];

/** Nombre maximal de questions par édition. */
export const MAX_PAR_EDITION = 8;

const texte = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const lienSur = (v: unknown) => { const s = texte(v, 1000); return /^https?:\/\//i.test(s) ? s : ""; };

/** Lit un fichier d'actu : `{ editions: [...] }` (fichier « actu » de Rayan's Mobile) ou une seule édition.
 *  Renvoie les éditions propres, de la plus récente à la plus ancienne. Lève une erreur si rien n'est lisible. */
export function lireActu(text: string): EditionActu[] {
  const raw: unknown = JSON.parse(text.replace(/^﻿/, ""));
  const liste: unknown[] = raw && typeof raw === "object" && Array.isArray((raw as { editions?: unknown }).editions)
    ? (raw as { editions: unknown[] }).editions
    : raw && typeof raw === "object" && "sujets" in raw ? [raw] : [];
  const editions: EditionActu[] = [];
  for (const e of liste) {
    if (!e || typeof e !== "object") continue;
    const ed = e as Record<string, unknown>;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ed.jour))) continue;
    const sujets: SujetActu[] = [];
    for (const s of Array.isArray(ed.sujets) ? ed.sujets : []) {
      if (!s || typeof s !== "object") continue;
      const sj = s as Record<string, unknown>;
      const sources = (Array.isArray(sj.sources) ? sj.sources : [])
        .map((x: Partial<SourceActu>) => ({ media: texte(x?.media, 60), lien: lienSur(x?.lien), titre: texte(x?.titre, 300) }))
        .filter((x: SourceActu) => x.media && x.lien);
      const titre = texte(sj.titre, 200);
      if (!titre || !sources.length) continue;
      const su: SujetActu = { titre, resume: texte(sj.resume, 600), sources, uneSource: new Set(sources.map((x: SourceActu) => x.media)).size === 1 };
      if (typeof sj.rubrique === "string" && sj.rubrique in NOMS_RUBRIQUES) su.rubrique = sj.rubrique as RubriqueActu;
      sujets.push(su);
    }
    editions.push({ jour: String(ed.jour), genere: Number(ed.genere) || 0, mode: ed.mode === "claude" ? "claude" : "simple", sujets });
  }
  if (!editions.length && !(raw && typeof raw === "object" && Array.isArray((raw as { editions?: unknown }).editions)))
    throw new Error("Ce fichier ne ressemble pas à une édition « Ton monde ».");
  editions.sort((a, b) => b.jour.localeCompare(a.jour));
  return editions.filter((e, i) => editions.findIndex((x) => x.jour === e.jour) === i);
}

/** Petite empreinte d'un texte (FNV-1a), pour un hasard reproductible : même édition → mêmes questions,
 *  sur le PC comme sur l'iPhone (les ids sont les mêmes, la fusion ne fait pas de doublon). */
export function empreinte(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const court = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).replace(/\s+\S*$/, "")}…`);
/** Première phrase du résumé, bornée : jamais plus. */
export function extrait(resume: string, max = 160): string {
  const r = resume.trim();
  if (!r) return "";
  const m = r.match(/^(.+?[.!?])(\s|$)/);
  return court(m ? m[1] : r, max);
}

export function jourFr(jour: string): string {
  const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const j = Number(jour.slice(8, 10));
  return `${j === 1 ? "1er" : j} ${mois[Number(jour.slice(5, 7)) - 1] ?? ""}`;
}

type Sorte = "rubrique" | "rubrique-vf" | "media" | "resume" | "une-source";

/** Les questions qu'on peut tirer d'une édition (au plus MAX_PAR_EDITION, sortes variées). */
export function questionsDepuisEdition(ed: EditionActu): Question[] {
  const rng: Rng = makeRng(empreinte(`${ed.jour}|${ed.sujets.map((s) => s.titre).join("|")}`));
  const sujets = ed.sujets.slice(0, 15);
  const medias = [...new Set(sujets.flatMap((s) => s.sources.map((x) => x.media)))];
  const avecRubriques = sujets.some((s) => s.rubrique && THEMATIQUES.includes(s.rubrique));
  const quand = `« Ton monde » du ${jourFr(ed.jour)}`;

  const candidates = (s: SujetActu, i: number): Question[] => {
    const id = (sorte: Sorte) => `actu:${ed.jour}:${sorte}:${empreinte(s.titre).toString(36)}`;
    const sourcesTxt = `Source${s.sources.length > 1 ? "s" : ""} : ${[...new Set(s.sources.map((x) => x.media))].join(", ")}.`;
    const recul = s.uneSource ? " Un seul média en parlait : à prendre avec recul." : "";
    const base = { theme: "actu" as const, lien: s.sources[0].lien };
    const titre = court(s.titre, 140);
    const out: Question[] = [];
    // Rubrique (QCM) ou rubrique (vrai/faux) : seulement pour les rubriques de thème.
    if (avecRubriques && s.rubrique && THEMATIQUES.includes(s.rubrique)) {
      const nom = NOMS_RUBRIQUES[s.rubrique];
      out.push({ ...base, id: id("rubrique"), difficulte: 1, enonce: `Dans ${quand}, dans quelle rubrique était le sujet « ${titre} » ?`,
        choix: [nom, ...THEMATIQUES.filter((r) => r !== s.rubrique).map((r) => NOMS_RUBRIQUES[r])], bonne: 0,
        explication: `Rubrique « ${nom} ». ${sourcesTxt}${recul}` });
      const vrai = rng() < 0.5;
      const autre = THEMATIQUES.filter((r) => r !== s.rubrique)[Math.floor(rng() * 2)];
      out.push({ ...base, id: id("rubrique-vf"), difficulte: 1, vf: true, choix: ["Vrai", "Faux"], bonne: vrai ? 0 : 1,
        enonce: `Vrai ou faux : dans ${quand}, le sujet « ${titre} » était dans la rubrique « ${NOMS_RUBRIQUES[vrai ? s.rubrique : autre]} ».`,
        explication: `${vrai ? "Vrai" : "Faux"} : il était dans « ${nom} ». ${sourcesTxt}${recul}` });
    }
    // Quel média ? (le vrai, plus des médias de la même édition qui ne parlaient pas de ce sujet)
    const ses = new Set(s.sources.map((x) => x.media));
    const autres = medias.filter((m) => !ses.has(m));
    if (autres.length >= 2) {
      const src = s.sources[0];
      const article = court(src.titre || s.titre, 140);
      out.push({ ...base, id: id("media"), difficulte: 2, enonce: `Quel média a publié l'article « ${article} » (${quand}) ?`,
        choix: [src.media, ...shuffle(rng, autres).slice(0, 3)], bonne: 0, lien: src.lien,
        explication: `C'était ${src.media}. ${sourcesTxt}${recul}` });
    }
    // De quel sujet parle ce début de résumé ?
    const ex = extrait(s.resume);
    const motsTitre = s.titre.toLowerCase();
    if (ex.length >= 40 && !ex.toLowerCase().includes(motsTitre.slice(0, 40))) {
      const leurres = shuffle(rng, sujets.filter((_, k) => k !== i).map((x) => court(x.titre, 140))).slice(0, 3);
      if (leurres.length >= 2)
        out.push({ ...base, id: id("resume"), difficulte: 3, enonce: `De quel sujet de ${quand} parle ce résumé : « ${ex} » ?`,
          choix: [titre, ...leurres], bonne: 0, explication: `C'était « ${titre} ». ${sourcesTxt}${recul}` });
    }
    // Un seul média, ou plusieurs ?
    if (medias.length >= 3)
      out.push({ ...base, id: id("une-source"), difficulte: 2, vf: true, choix: ["Vrai", "Faux"], bonne: s.uneSource ? 0 : 1,
        enonce: `Vrai ou faux : dans ${quand}, un seul média parlait du sujet « ${titre} ».`,
        explication: s.uneSource
          ? `Vrai : seulement ${s.sources[0].media}. Une info reprise par un seul média est à prendre avec plus de recul.`
          : `Faux : ${ses.size} médias en parlaient (${[...ses].join(", ")}). Plusieurs sources indépendantes, c'est plus solide.` });
    return out;
  };

  // Une question par sujet, en variant les sortes (la moins utilisée jusque-là, au hasard en cas d'égalité).
  const usage = new Map<string, number>();
  const choisies: Question[] = [];
  for (let i = 0; i < sujets.length && choisies.length < MAX_PAR_EDITION; i++) {
    const c = candidates(sujets[i], i);
    if (!c.length) continue;
    const sorte = (q: Question) => q.id.split(":")[2];
    const min = Math.min(...c.map((q) => usage.get(sorte(q)) ?? 0));
    const moins = c.filter((q) => (usage.get(sorte(q)) ?? 0) === min);
    const q = moins[Math.floor(rng() * moins.length)];
    if (choisies.some((x) => x.id === q.id)) continue;
    usage.set(sorte(q), min + 1);
    choisies.push(q);
  }
  return choisies;
}
