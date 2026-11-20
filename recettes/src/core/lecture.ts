// Lecture des recettes de Rayan's Favoris : recettes.md et fiches JSON (catégorie « recette »),
// puis remarques halal / sèche et étiquettes (protéines, rapide, collation, repas). Aucune dépendance à Electron.
import type { Etiquettes, Recette, Remarques } from "./types.ts";

/** Enlève les accents et met en minuscules, pour comparer des mots. */
export function sansAccents(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/[’‘]/g, "'");
}

/** Lien de la vidéo déduit de son identifiant Rayan's Favoris, si possible. */
export function lienDepuisId(id: string): string | undefined {
  let m = /^tiktok-(\d+)$/.exec(id);
  if (m) return `https://www.tiktok.com/@_/video/${m[1]}`;
  m = /^instagram-([\w-]+)$/.exec(id);
  if (m) return `https://www.instagram.com/reel/${m[1]}/`;
  return undefined;
}

/** Un lien web accepté (http ou https seulement). */
export function lienValide(s: string | undefined): string | undefined {
  if (!s) return undefined;
  try {
    const u = new URL(s.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

const ITEM = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/;

/** Lit recettes.md : un bloc par titre « ## Nom », avec « Source : », « **Ingrédients** » et « **Étapes** ». */
export function lireRecettesMd(texte: string): Recette[] {
  const recettes: Recette[] = [];
  let r: Recette | null = null;
  let section: "ingredients" | "etapes" | null = null;
  const vus = new Set<string>();
  const fin = () => {
    if (!r) return;
    if (!r.lien) r.lien = lienDepuisId(r.id);
    if (r.ingredients.length || r.etapes.length) {
      let id = r.id, n = 2;
      while (vus.has(id)) id = `${r.id}-${n++}`;
      vus.add(id);
      recettes.push({ ...r, id });
    }
  };
  for (const brute of texte.replace(/\r/g, "").split("\n")) {
    const ligne = brute.trim();
    const titre = /^##\s+(.+)$/.exec(ligne);
    if (titre && !ligne.startsWith("###")) {
      fin();
      const t = titre[1].trim();
      r = { id: `md-${sansAccents(t).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`, titre: t, ingredients: [], etapes: [], origine: "favoris" };
      section = null;
      continue;
    }
    if (!r || !ligne) continue;
    const id = /^<!--\s*([\w.-]+)\s*-->$/.exec(ligne);
    if (id) { r.id = id[1]; continue; }
    const source = /^source\s*:\s*(.+)$/i.exec(ligne);
    if (source) {
      const [lien, ...reste] = source[1].split(" · ");
      r.lien = lienValide(lien) ?? r.lien;
      if (reste.length) r.portions = reste.join(" · ").trim();
      continue;
    }
    const entete = sansAccents(ligne.replace(/[*#:_]/g, "").trim());
    if (/^ingredients?$/.test(entete)) { section = "ingredients"; continue; }
    if (/^(etapes?|preparation|instructions?)$/.test(entete)) { section = "etapes"; continue; }
    const item = ITEM.exec(brute);
    if (item && section) {
      const t = item[1].trim();
      if (t) (section === "ingredients" ? r.ingredients : r.etapes).push(t);
    }
  }
  fin();
  return recettes;
}

const texte = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const liste = (v: unknown) => (Array.isArray(v) ? v.map(texte).filter(Boolean) : []);

/** Lit une fiche JSON de Rayan's Favoris. Rend null si ce n'est pas une recette. */
export function lireFiche(fiche: unknown, lien?: string): Recette | null {
  if (!fiche || typeof fiche !== "object") return null;
  const f = fiche as Record<string, unknown>;
  if (f.categorie !== "recette" || !f.recette || typeof f.recette !== "object") return null;
  const r = f.recette as Record<string, unknown>;
  const id = texte(f.id);
  const ingredients = liste(r.ingredients);
  if (!id || !ingredients.length) return null;
  return {
    id,
    titre: texte(r.titre) || texte(f.resume).slice(0, 60) || "Recette",
    portions: texte(r.portions) || undefined,
    ingredients,
    etapes: liste(r.etapes),
    lien: lienValide(texte(f.lien) || lien) ?? lienDepuisId(id),
    resume: texte(f.resume) || undefined,
    pourRayan: texte(f.pour_rayan) || undefined,
    origine: "favoris",
  };
}

/**
 * Rassemble les recettes de recettes.md et des fiches. Une fiche complète la recette de même identifiant
 * (remarques, résumé) ; une fiche sans bloc dans recettes.md est ajoutée. Les recettes perso viennent en premier.
 */
export function fusionner(md: Recette[], fiches: Recette[], perso: Recette[] = []): Recette[] {
  const parId = new Map(fiches.map((f) => [f.id, f]));
  const sortie: Recette[] = [...perso];
  for (const m of md) {
    const f = parId.get(m.id);
    parId.delete(m.id);
    sortie.push(f ? { ...m, ...f, lien: f.lien ?? m.lien, portions: f.portions ?? m.portions } : m);
  }
  sortie.push(...parId.values());
  return sortie;
}

const phrases = (s: string) => s.replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ«"(])/).map((p) => p.trim()).filter(Boolean);

const MOTS_HALAL = /\b(halal|haram|porc|lard|lardons?|bacon|jambon|saucisson|chorizo|alcool|vin|biere|rhum|gelatine|kirsch|cognac|marsala)\b/;
const NON_HALAL = /\b(porc|lardons?|bacon|jambon|saucisson|chorizo|vin|biere|rhum|gelatine|kirsch|cognac|marsala|alcool)\b/;

/** Remarques à afficher : phrases de pour_rayan sur le halal, le reste (sèche, sport) et les ingrédients à vérifier. */
export function remarques(r: Recette): Remarques {
  const halal: string[] = [], seche: string[] = [];
  for (const p of phrases(r.pourRayan ?? "")) (MOTS_HALAL.test(sansAccents(p)) ? halal : seche).push(p);
  const aVerifier = r.ingredients.filter((i) => {
    const s = sansAccents(i);
    return NON_HALAL.test(s) && !/\bhalal\b|sans alcool|vinaigre|agar/.test(s);
  });
  return { halal, seche, aVerifier };
}

const PROTEINES = /\b(whey|proteine?s?|proteinee?s?|poulet|dinde|boeuf|steak|viande|hache|thon|saumon|poisson|crevettes?|oeufs?|blancs? d'oeufs?|skyr|cottage|fromage blanc|yaourt grec|yaourts? grecs?|lentilles|pois chiches|tofu|seitan|kefta|merguez|cabillaud|sardines?)\b/;
const COLLATION = /\b(cookies?|gateaux?|cake|muffins?|brownies?|pancakes?|crepes?|gaufres?|barres?|bowl|smoothie|milkshake|shake|dessert|tiramisu|cheesecake|mousse|glace|overnight|porridge|collation|snack|bouchees?|energy balls?|biscuits?|tartines?|granola|flan|creme)\b/;
const REPAS = /\b(poulet|dinde|boeuf|steak|viande|hache|saumon|poisson|riz|pates|patate|pommes? de terre|wrap|burger|tacos|pizza|salade|curry|gratin|omelette|quiche|bowl|plat|repas|dejeuner|diner|soupe|lasagnes?|couscous|tajine|kefta)\b/;

/** Étiquettes déduites du titre, des ingrédients, des étapes et des remarques. */
export function etiquettes(r: Recette): Etiquettes {
  const titre = sansAccents(r.titre);
  const tout = sansAccents([r.titre, ...r.ingredients, r.pourRayan ?? "", r.resume ?? ""].join(" \n "));
  const etapes = sansAccents(r.etapes.join(" "));
  const proteines = PROTEINES.test(sansAccents([r.titre, ...r.ingredients].join(" \n "))) || /riche en proteines|proteine/.test(titre);
  const minutes = [...etapes.matchAll(/(\d+)\s*(?:min|minutes)\b/g)].reduce((t, m) => t + Number(m[1]), 0);
  const heures = /\b\d+\s*h\b|\bheures?\b|une nuit|toute la nuit|au frigo pendant/.test(etapes);
  const rapide = /\brapide|express|en \d+ ?min|5 minutes|10 minutes|15 minutes\b/.test(tout) || (!heures && minutes <= 20 && r.etapes.length <= 4);
  const collation = COLLATION.test(titre) || (!REPAS.test(titre) && /collation|gouter|petit[- ]dejeuner|en-cas|snack|dessert/.test(tout));
  const repas = !collation || REPAS.test(titre);
  return { proteines, rapide, collation, repas };
}

export const NOMS_ETIQUETTES: Record<keyof Etiquettes, string> = {
  proteines: "Riche en protéines",
  rapide: "Rapide",
  collation: "Collation",
  repas: "Repas",
};

/** Recherche sans accents dans le titre, les ingrédients et les remarques (tous les mots doivent être trouvés). */
export function correspond(r: Recette, recherche: string): boolean {
  const mots = sansAccents(recherche).split(/\s+/).filter(Boolean);
  if (!mots.length) return true;
  const tout = sansAccents([r.titre, ...r.ingredients, r.pourRayan ?? "", r.resume ?? ""].join(" "));
  return mots.every((m) => tout.includes(m));
}
