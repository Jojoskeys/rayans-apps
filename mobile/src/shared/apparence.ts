// Personnalisation de Rayan's Mobile, propre à chaque téléphone (pas synchronisée) : thème, couleur, taille du texte,
// accueil (tuiles, ordre, prénom), bouton d'accueil dans les apps, et icône de l'écran d'accueil.
// Le thème clair s'applique aux apps qui partagent la palette de l'accueil (Aujourd'hui, Chrono, Prière) ;
// la couleur et la taille du texte s'appliquent partout.

export type Theme = "sombre" | "clair" | "auto";

export interface Apparence {
  theme: Theme;
  /** Couleur principale (boutons, liens actifs). */
  accent: string;
  /** Taille du texte : 0,9 à 1,25. */
  taille: number;
  prenom: string;
  afficherDate: boolean;
  /** Tuiles de l'accueil : ordre (ids) et apps masquées. */
  ordre: string[];
  masquees: string[];
  disposition: "grille" | "liste";
  afficherEtat: boolean;
  /** Bouton d'accueil flottant dans les apps. */
  boutonAccueil: "gauche" | "droite";
  /** Icône de l'écran d'accueil : modèle, ou image (data URL PNG) pour une photo. */
  icone: { modele: string; image?: string };
}

export const COULEURS: { nom: string; valeur: string }[] = [
  { nom: "Bleu", valeur: "#5B8DEF" }, { nom: "Vert", valeur: "#3BA776" }, { nom: "Orange", valeur: "#E3A33B" }, { nom: "Rouge", valeur: "#E8594F" },
  { nom: "Violet", valeur: "#9B7BEA" }, { nom: "Rose", valeur: "#E86FA8" }, { nom: "Turquoise", valeur: "#2FB3B3" }, { nom: "Or", valeur: "#C9A227" },
];

export const APPARENCE_DEPART: Apparence = {
  theme: "sombre", accent: "#5B8DEF", taille: 1, prenom: "Rayan", afficherDate: true, ordre: [], masquees: [], disposition: "grille",
  afficherEtat: true, boutonAccueil: "gauche", icone: { modele: "origine" },
};

const CLE = "rm-apparence";

export function lireApparence(): Apparence {
  try {
    const r = JSON.parse(localStorage.getItem(CLE) ?? "{}") as Partial<Apparence>;
    return nettoyerApparence(r);
  } catch { return { ...APPARENCE_DEPART }; }
}

export function nettoyerApparence(r: Partial<Apparence>): Apparence {
  const d = APPARENCE_DEPART;
  const liste = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 30) : []);
  return {
    theme: r.theme === "clair" || r.theme === "auto" ? r.theme : "sombre",
    accent: typeof r.accent === "string" && /^#[0-9a-f]{6}$/i.test(r.accent) ? r.accent : d.accent,
    taille: typeof r.taille === "number" && r.taille >= 0.9 && r.taille <= 1.25 ? r.taille : 1,
    prenom: typeof r.prenom === "string" ? r.prenom.slice(0, 30) : d.prenom,
    afficherDate: r.afficherDate !== false,
    ordre: liste(r.ordre), masquees: liste(r.masquees),
    disposition: r.disposition === "liste" ? "liste" : "grille",
    afficherEtat: r.afficherEtat !== false,
    boutonAccueil: r.boutonAccueil === "droite" ? "droite" : "gauche",
    icone: r.icone && typeof r.icone.modele === "string" ? { modele: r.icone.modele, ...(typeof r.icone.image === "string" && r.icone.image.startsWith("data:image/") ? { image: r.icone.image } : {}) } : d.icone,
  };
}

export function enregistrerApparence(a: Apparence) {
  try { localStorage.setItem(CLE, JSON.stringify(a)); } catch { throw new Error("Stockage du téléphone plein : choisis une photo plus petite."); }
  appliquerApparence(a);
}

/** Ordre des tuiles : l'ordre choisi, puis les apps pas encore classées. */
export function trier<T extends { id: string }>(apps: T[], a: Apparence): T[] {
  const rang = (id: string) => { const i = a.ordre.indexOf(id); return i < 0 ? 1000 + apps.findIndex((x) => x.id === id) : i; };
  return [...apps].sort((x, y) => rang(x.id) - rang(y.id));
}

const CLAIR = "--fond:#F4F5F7;--panneau:#FFFFFF;--panneau-2:#ECEEF2;--bord:#D8DCE3;--texte:#15181D;--texte-2:#566070;--texte-3:#8790A0;color-scheme:light;";

/** Applique thème, couleur, taille du texte et icône à la page en cours. */
export function appliquerApparence(a: Apparence = lireApparence()) {
  let st = document.getElementById("rm-apparence-css") as HTMLStyleElement | null;
  if (!st) { st = document.createElement("style"); st.id = "rm-apparence-css"; }
  // Toujours en dernier dans <head>, pour passer après les feuilles de style des apps.
  document.head.append(st);
  const clair = `html:root{${CLAIR}} html:root body{background:var(--fond)!important;color:var(--texte)}`;
  st.textContent = [
    `html:root{--accent:${a.accent};}`,
    a.theme === "clair" ? clair : a.theme === "auto" ? `@media (prefers-color-scheme: light){${clair}}` : "",
    a.taille !== 1 ? `body{zoom:${a.taille}}` : "",
  ].join("\n");
  const sombre = a.theme === "sombre" || (a.theme === "auto" && !matchMedia("(prefers-color-scheme: light)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", sombre ? "#111418" : "#F4F5F7");
  appliquerIcone(a);
}

// ----- Icône -------------------------------------------------------------------------------------------------

/** Modèles d'icône dessinés sur le téléphone : fond (dégradé), symbole. */
export const MODELES_ICONE: { id: string; nom: string; fond: [string, string]; symbole: string; police?: string }[] = [
  { id: "r-bleu", nom: "R bleu", fond: ["#5B8DEF", "#2A4FA8"], symbole: "R" },
  { id: "r-nuit", nom: "R nuit", fond: ["#2B313B", "#0B0D10"], symbole: "R" },
  { id: "r-or", nom: "R or", fond: ["#E9C46A", "#B07D1A"], symbole: "R" },
  { id: "soleil", nom: "Soleil", fond: ["#F4A93B", "#E8594F"], symbole: "☀" },
  { id: "croissant", nom: "Croissant", fond: ["#1E3A5F", "#0B1626"], symbole: "☾" },
  { id: "halteres", nom: "Sport", fond: ["#3BA776", "#1D6B49"], symbole: "🏋️" },
  { id: "livre", nom: "Études", fond: ["#9B7BEA", "#5B3DB0"], symbole: "📚" },
  { id: "eclair", nom: "Éclair", fond: ["#111418", "#2B313B"], symbole: "⚡" },
];

const TAILLE_ICONE = 360;

/** Dessine un modèle d'icône (PNG carré, data URL). */
const dessins = new Map<string, string>();
export function dessinerModele(id: string): string | null {
  const deja = dessins.get(id);
  if (deja) return deja;
  const m = MODELES_ICONE.find((x) => x.id === id);
  if (!m) return null;
  const c = document.createElement("canvas");
  c.width = c.height = TAILLE_ICONE;
  const g = c.getContext("2d")!;
  const deg = g.createLinearGradient(0, 0, TAILLE_ICONE, TAILLE_ICONE);
  deg.addColorStop(0, m.fond[0]);
  deg.addColorStop(1, m.fond[1]);
  g.fillStyle = deg;
  g.fillRect(0, 0, TAILLE_ICONE, TAILLE_ICONE);
  const lettre = /^[A-Z]$/.test(m.symbole);
  g.fillStyle = "#FFFFFF";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = lettre ? `700 ${TAILLE_ICONE * 0.6}px -apple-system, "SF Pro Display", "Segoe UI", system-ui, sans-serif` : `${TAILLE_ICONE * 0.5}px "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", system-ui, sans-serif`;
  g.fillText(m.symbole, TAILLE_ICONE / 2, TAILLE_ICONE * (lettre ? 0.54 : 0.53));
  const url = c.toDataURL("image/png");
  dessins.set(id, url);
  return url;
}

/** Photo → icône carrée (recadrée au centre, avec zoom 1 à 3). */
export async function photoEnIcone(f: Blob, zoom = 1): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error("Image illisible (HEIC non pris en charge ? Choisis « Plus compatible » ou une capture).")); i.src = url; });
    const cote = Math.min(img.naturalWidth, img.naturalHeight) / Math.max(1, zoom);
    const c = document.createElement("canvas");
    c.width = c.height = TAILLE_ICONE;
    const g = c.getContext("2d")!;
    g.imageSmoothingQuality = "high";
    g.drawImage(img, (img.naturalWidth - cote) / 2, (img.naturalHeight - cote) / 2, cote, cote, 0, 0, TAILLE_ICONE, TAILLE_ICONE);
    // JPEG : bien plus léger qu'un PNG pour une photo (l'icône est gardée sur le téléphone).
    return c.toDataURL("image/jpeg", 0.88);
  } finally { URL.revokeObjectURL(url); }
}

/** Image de l'icône choisie (null : icône d'origine). */
export function imageIcone(a: Apparence): string | null {
  if (a.icone.modele === "photo") return a.icone.image ?? null;
  if (a.icone.modele === "origine") return null;
  return a.icone.image ?? dessinerModele(a.icone.modele);
}

/** Met l'icône choisie dans la page : l'iPhone la prend au moment d'« Ajouter à l'écran d'accueil ». */
function appliquerIcone(a: Apparence) {
  const img = imageIcone(a);
  for (const l of document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"], link[rel="icon"]')) {
    if (!l.dataset.origine) l.dataset.origine = l.getAttribute("href") ?? "";
    l.href = img ?? l.dataset.origine;
  }
}
