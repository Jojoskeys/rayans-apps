// Personnalisation de l'interface : thème, fond, animations, cartes. Préférences propres à cet ordinateur,
// gardées dans le stockage local de la fenêtre (aucune commande Tauri, rien n'est envoyé).
import { createContext, useContext } from "react";

export type ThemeId = "aurore" | "ocean" | "emeraude" | "braise" | "sakura" | "ambre" | "perso";

export interface Prefs {
  theme: ThemeId;
  customColor: string;
  background: "colore" | "neutre" | "noir";
  ambient: boolean;
  ambientLevel: number; // 0,2 à 1,6
  motion: "completes" | "reduites" | "aucune";
  glow: boolean;
  glass: boolean;
  cardSize: number; // largeur minimale d'une carte, en px
  radius: number; // arrondi des panneaux, en px
  density: "confortable" | "compacte";
  textScale: number; // en %
  showNotes: boolean;
  showStats: boolean;
  sort: "catalogue" | "nom" | "installees" | "maj";
  startPage: "catalog" | "installed";
}

export const DEFAULT_PREFS: Prefs = {
  theme: "aurore",
  customColor: "#22c55e",
  background: "colore",
  ambient: true,
  ambientLevel: 1,
  motion: "completes",
  glow: true,
  glass: true,
  cardSize: 290,
  radius: 14,
  density: "confortable",
  textScale: 100,
  showNotes: true,
  showStats: true,
  sort: "catalogue",
  startPage: "catalog",
};

interface Theme {
  name: string;
  /** Trois couleurs du dégradé principal, puis la couleur d'accent (textes, icônes). */
  stops: [string, string, string];
  accent: string;
  /** Couleur du texte posé sur le dégradé. */
  ink: string;
  /** Teinte du fond (degrés) et teintes des deux halos secondaires. */
  hue: number;
  glows: [number, number];
}

export const THEMES: Record<Exclude<ThemeId, "perso">, Theme> = {
  aurore: { name: "Aurore", stops: ["#8b5cf6", "#ec4899", "#fb923c"], accent: "#f472b6", ink: "#ffffff", hue: 262, glows: [200, 330] },
  ocean: { name: "Océan", stops: ["#22d3ee", "#3b82f6", "#6366f1"], accent: "#38bdf8", ink: "#ffffff", hue: 218, glows: [190, 250] },
  emeraude: { name: "Émeraude", stops: ["#a3e635", "#10b981", "#0ea5a4"], accent: "#34d399", ink: "#03140d", hue: 165, glows: [140, 190] },
  braise: { name: "Braise", stops: ["#fbbf24", "#f43f5e", "#be185d"], accent: "#fb7185", ink: "#ffffff", hue: 345, glows: [20, 300] },
  sakura: { name: "Sakura", stops: ["#fbcfe8", "#f472b6", "#c084fc"], accent: "#f9a8d4", ink: "#2a0d1f", hue: 320, glows: [280, 350] },
  ambre: { name: "Ambre", stops: ["#ffc35c", "#ffb23f", "#ff8a3d"], accent: "#ffb23f", ink: "#1d1406", hue: 220, glows: [225, 155] },
};

const KEY = "rayans-launcher:prefs";

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    /* stockage indisponible : valeurs par défaut */
  }
  return { ...DEFAULT_PREFS };
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* tant pis : la préférence vaut pour cette session */
  }
}

// ----- Couleurs ----------------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

const hsl = (h: number, s: number, l: number) => `hsl(${Math.round(((h % 360) + 360) % 360)} ${s}% ${l}%)`;

/** Thème calculé à partir d'une seule couleur choisie par l'utilisateur. */
function customTheme(color: string): Theme {
  const rgb = hexToRgb(color);
  const [h, s0, l0] = rgbToHsl(rgb);
  const sat = Math.round(Math.max(55, s0));
  const l = Math.round(l0);
  // Luminance relative (WCAG) : texte sombre sur les couleurs claires (jaune, cyan…), blanc sinon.
  const lin = rgb.map((c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return {
    name: "Personnalisé",
    stops: [hsl(h - 28, sat, Math.min(72, l + 12)), color, hsl(h + 32, sat, Math.max(45, l - 4))],
    accent: hsl(h, sat, Math.max(62, l)),
    ink: lum > 0.32 ? "#141414" : "#ffffff",
    hue: h,
    glows: [h - 60, h + 60],
  };
}

export function themeOf(p: Prefs): Theme {
  return p.theme === "perso" ? customTheme(p.customColor) : THEMES[p.theme];
}

function cssColorToRgb(c: string): string {
  if (c.startsWith("#")) return hexToRgb(c).join(", ");
  // hsl(...) : laissons le navigateur faire la conversion.
  const el = document.createElement("i");
  el.style.color = c;
  document.body.appendChild(el);
  const v = getComputedStyle(el).color.match(/\d+(\.\d+)?/g)?.slice(0, 3).join(", ") ?? "236, 72, 153";
  el.remove();
  return v;
}

/** Applique les préférences à la page : variables CSS et attributs data-*. */
export function applyPrefs(p: Prefs) {
  const t = themeOf(p);
  const root = document.documentElement;
  const set = (k: string, v: string) => root.style.setProperty(k, v);

  set("--a1", t.stops[0]);
  set("--a2", t.stops[1]);
  set("--a3", t.stops[2]);
  set("--accent", t.accent);
  set("--accent-rgb", cssColorToRgb(t.accent));
  set("--a2-rgb", cssColorToRgb(t.stops[1]));
  set("--accent-ink", t.ink);
  set("--glow1-rgb", cssColorToRgb(t.stops[0]));
  set("--glow2-rgb", cssColorToRgb(hsl(t.glows[0], 80, 60)));
  set("--glow3-rgb", cssColorToRgb(hsl(t.glows[1], 80, 60)));

  // Fond : teinté par le thème, graphite neutre, ou noir profond.
  const h = t.hue;
  const k = p.background === "colore" ? 1 : p.background === "neutre" ? 0.25 : 0.15;
  const dl = p.background === "noir" ? -4 : 0;
  set("--bg", hsl(h, 24 * k, 7.5 + dl));
  set("--bg-deep", hsl(h, 24 * k, 5.5 + dl));
  set("--surface", hsl(h, 22 * k, 11 + dl));
  set("--surface-2", hsl(h, 20 * k, 14.5 + dl));
  set("--surface-3", hsl(h, 18 * k, 18 + dl));
  set("--line", hsl(h, 18 * k, 21 + dl));
  set("--line-2", hsl(h, 16 * k, 27 + dl));
  set("--muted", hsl(h, 14 * k, 64));
  set("--text-2", hsl(h, 20 * k, 82));
  set("--text", hsl(h, 30 * k, 96));
  set("--side-rgb", cssColorToRgb(hsl(h, 22 * k, 9 + dl)));

  set("--radius", `${p.radius}px`);
  set("--radius-sm", `${Math.max(4, Math.round(p.radius * 0.72))}px`);
  set("--card-min", `${p.cardSize}px`);
  set("--ambient-level", String(p.ambient ? p.ambientLevel : 0));
  const app = document.getElementById("root");
  if (app) app.style.zoom = String(p.textScale / 100);

  root.dataset.motion = p.motion;
  root.dataset.density = p.density;
  root.dataset.glow = p.glow ? "on" : "off";
  root.dataset.glass = p.glass ? "on" : "off";
  root.dataset.ambient = p.ambient ? "on" : "off";
  root.dataset.notes = p.showNotes ? "on" : "off";
  root.dataset.stats = p.showStats ? "on" : "off";
}

export const PrefsContext = createContext<{ prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void; resetPrefs: () => void }>({
  prefs: DEFAULT_PREFS,
  setPrefs: () => {},
  resetPrefs: () => {},
});

export const usePrefs = () => useContext(PrefsContext);
