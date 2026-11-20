// Rayan's Arène sur le téléphone : plan mensuel (X € chaque mois sur un ETF, argent fictif), calculé ici à partir
// des prix publiés chaque semaine par arene/publier.py. Mêmes règles que arene/mensuel.py : versement au premier
// jour de cotation du mois, parts entières comme sur un PEA (le reste attend), frais 0,5 % avec 1 € minimum,
// jamais de vente ; Livret A aux taux historiques, intérêts ajoutés chaque mois (approximation).

export interface PrixArene { actif: string; nom: string; devise: string; dates: string[]; prix: number[] }
export interface RobotArene { actif: string; nom: string; ans: number; arene: number; ag: number; hasard: number }
export interface ResumeArene { genere: string; robots: RobotArene[] }

export const FRAIS_PCT = 0.005;
export const FRAIS_MIN = 1;
export const LIVRET_A: [string, number][] = [["2015-08-01", 0.0075], ["2020-02-01", 0.005], ["2022-02-01", 0.01], ["2022-08-01", 0.02],
  ["2023-02-01", 0.03], ["2025-02-01", 0.024], ["2025-08-01", 0.017], ["2026-02-01", 0.015]];

export const tauxLivret = (jour: string) => LIVRET_A.reduce((t, [debut, taux]) => (jour >= debut ? taux : t), LIVRET_A[0][1]);
export const frais = (montant: number) => (montant > 0 ? Math.max(FRAIS_MIN, montant * FRAIS_PCT) : 0);

/** Parts entières achetables avec `liquide` (frais compris) et leur coût. */
export function achat(liquide: number, prix: number): { parts: number; cout: number } {
  let n = Math.floor(liquide / prix);
  while (n > 0 && n * prix + frais(n * prix) > liquide + 1e-9) n--;
  return n > 0 ? { parts: n, cout: n * prix + frais(n * prix) } : { parts: 0, cout: 0 };
}

export interface PointPlan { date: string; verse: number; valeur: number; livret: number }
export interface Plan {
  points: PointPlan[]; // un point par mois (pour le graphique)
  verse: number; valeur: number; livret: number; frais: number; achats: number; mois: number;
  chute: number; chuteDebut: string; chuteBas: string; chuteRetour: string | null; moisPourRemonter: number | null;
  pireDate: string; pireVerse: number; pireValeur: number;
}

export function planMensuel(dates: string[], prix: number[], montant: number): Plan {
  let parts = 0, liquide = 0, verse = 0, livret = 0, fraisPayes = 0, achats = 0;
  let moisLivret: string | null = null, premier: number | null = null;
  let pire = { ecart: Infinity, date: dates[0] ?? "", verse: 0, valeur: 0 };
  const points: PointPlan[] = [];
  let moisCourant = "";
  for (let i = 0; i < dates.length; i++) {
    const d = dates[i];
    if (d.slice(0, 7) !== moisCourant) {
      moisCourant = d.slice(0, 7);
      if (moisLivret !== null) livret *= 1 + tauxLivret(moisLivret) / 12;
      moisLivret = d;
      verse += montant; liquide += montant; livret += montant;
      const a = achat(liquide, prix[i]);
      if (a.parts) { parts += a.parts; liquide -= a.cout; fraisPayes += a.cout - a.parts * prix[i]; achats++; premier ??= i; }
      points.push({ date: d, verse, valeur: parts * prix[i] + liquide, livret });
    }
    const valeur = parts * prix[i] + liquide;
    if (valeur - verse < pire.ecart) pire = { ecart: valeur - verse, date: d, verse, valeur };
  }
  const n = dates.length - 1;
  const valeur = n >= 0 ? parts * prix[n] + liquide : 0;
  if (points.length) points.push({ date: dates[n], verse, valeur, livret });
  // Pire chute de l'ETF depuis le premier achat, et temps pour retrouver le plus haut d'avant.
  const debut = premier ?? 0;
  let haut = prix[debut] ?? 0, iHaut = debut, chute = 0, iA = debut, iB = debut;
  for (let i = debut; i < prix.length; i++) {
    if (prix[i] > haut) { haut = prix[i]; iHaut = i; }
    const c = prix[i] / haut - 1;
    if (c < chute) { chute = c; iA = iHaut; iB = i; }
  }
  let iRetour: number | null = null;
  for (let i = iB; i < prix.length; i++) if (prix[i] >= prix[iA]) { iRetour = i; break; }
  const jours = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;
  return {
    points, verse, valeur, livret, frais: fraisPayes, achats, mois: points.length ? points.length - 1 : 0,
    chute, chuteDebut: dates[iA] ?? "", chuteBas: dates[iB] ?? "",
    chuteRetour: iRetour === null ? null : dates[iRetour],
    moisPourRemonter: iRetour === null ? null : Math.round(jours(dates[iB], dates[iRetour]) / 30.44),
    pireDate: pire.date, pireVerse: pire.verse, pireValeur: pire.valeur,
  };
}

/** Prix venus du réseau : on ne garde que ce qui a la bonne forme. */
export function nettoyerPrix(x: unknown): PrixArene | null {
  const o = x as Partial<PrixArene> | null;
  if (!o || !Array.isArray(o.dates) || !Array.isArray(o.prix) || o.dates.length !== o.prix.length || o.dates.length < 30) return null;
  const ok = o.dates.every((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) && o.prix.every((p) => typeof p === "number" && p > 0);
  return ok ? { actif: String(o.actif ?? ""), nom: String(o.nom ?? ""), devise: String(o.devise ?? "€"), dates: o.dates, prix: o.prix } : null;
}

export const euros = (x: number) => `${Math.round(x).toLocaleString("fr-FR")} €`;
export const pourcent = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;
export const dateFr = (d: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "");
