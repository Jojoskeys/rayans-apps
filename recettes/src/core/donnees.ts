// Données locales de l'app (favoris, « je l'ai faite », recettes perso, panier) : création, réparation, actions.
import { lienValide } from "./lecture.ts";
import type { Action, Donnees, Recette } from "./types.ts";

export function donneesVides(): Donnees {
  return { version: 1, favoris: [], faites: {}, perso: [], panier: [] };
}

const chaines = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && !!x))] : []);
const lignes = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : []);

/** Recette perso propre (titre et ingrédients obligatoires), ou null. */
export function recettePerso(v: unknown): Recette | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const titre = typeof r.titre === "string" ? r.titre.trim().slice(0, 200) : "";
  const id = typeof r.id === "string" && r.id.startsWith("perso-") ? r.id : "";
  const ingredients = lignes(r.ingredients);
  if (!titre || !id || !ingredients.length) return null;
  const t = (k: string) => (typeof r[k] === "string" && (r[k] as string).trim() ? (r[k] as string).trim() : undefined);
  return { id, titre, portions: t("portions"), ingredients, etapes: lignes(r.etapes), lien: lienValide(t("lien")), pourRayan: t("pourRayan"), origine: "perso" };
}

/** Données lues sur le disque, réparées au besoin (champs manquants ou de mauvais type). */
export function normaliser(brut: unknown): Donnees {
  const d = donneesVides();
  if (!brut || typeof brut !== "object") return d;
  const b = brut as Record<string, unknown>;
  d.favoris = chaines(b.favoris);
  d.panier = chaines(b.panier);
  if (b.faites && typeof b.faites === "object") {
    for (const [id, dates] of Object.entries(b.faites as Record<string, unknown>)) {
      const ok = Array.isArray(dates) ? dates.filter((x): x is number => Number.isFinite(x)).sort((x, y) => x - y) : [];
      if (ok.length) d.faites[id] = ok;
    }
  }
  if (Array.isArray(b.perso)) d.perso = b.perso.map(recettePerso).filter((r): r is Recette => !!r);
  return d;
}

const basculer = (l: string[], id: string, dedans: boolean) => (dedans ? (l.includes(id) ? l : [...l, id]) : l.filter((x) => x !== id));

/** Applique une action et rend de nouvelles données (les anciennes ne sont pas modifiées). */
export function appliquer(d: Donnees, a: Action): Donnees {
  switch (a.type) {
    case "favori":
      return { ...d, favoris: basculer(d.favoris, a.id, !d.favoris.includes(a.id)) };
    case "faite":
      return { ...d, faites: { ...d.faites, [a.id]: [...(d.faites[a.id] ?? []), a.at].sort((x, y) => x - y) } };
    case "annulerFaite": {
      const reste = (d.faites[a.id] ?? []).filter((t) => t !== a.at);
      const faites = { ...d.faites };
      if (reste.length) faites[a.id] = reste; else delete faites[a.id];
      return { ...d, faites };
    }
    case "ajouterPerso": {
      const r = recettePerso(a.recette);
      if (!r) return d;
      return { ...d, perso: [r, ...d.perso.filter((x) => x.id !== r.id)] };
    }
    case "supprimerPerso":
      return { ...d, perso: d.perso.filter((x) => x.id !== a.id), favoris: basculer(d.favoris, a.id, false), panier: basculer(d.panier, a.id, false) };
    case "panier":
      return { ...d, panier: basculer(d.panier, a.id, a.dedans) };
    case "viderPanier":
      return { ...d, panier: [] };
  }
}

/** Date courte en français : « 18 nov. 2026 ». */
export function dateCourte(ms: number): string {
  return new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
