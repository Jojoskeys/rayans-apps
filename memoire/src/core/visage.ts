// Visages dessinés à partir d'une graine (aucune photo de vraie personne) : chaque visage a des traits marqués
// (cheveux, lunettes, barbe, grain de beauté…) pour s'entraîner à repérer « le » détail qui sert de crochet.
import { makeRng, pick, type Rng } from "./rng.ts";

const PEAUX = ["#F6D7C3", "#EAC09F", "#D9A47E", "#B97F57", "#8D5A3B", "#5E3B26"];
const CHEVEUX = ["#1E1A18", "#4A2E1F", "#8A5A2B", "#C99A55", "#E3C27A", "#9A9A9A", "#B5462F"];
const YEUX = ["#3B2A20", "#3C6E8F", "#4F7A4A", "#6B4F2A"];
const FONDS = ["#3B4A7A", "#4A6B5A", "#7A4A5A", "#5A4A7A", "#7A6A3A", "#3A6A7A"];

export interface TraitsVisage {
  peau: string;
  cheveux: string;
  coupe: "court" | "long" | "chauve" | "boucles" | "chignon" | "hijab" | "casquette";
  yeux: string;
  lunettes: "aucune" | "rondes" | "carrees";
  barbe: "aucune" | "courte" | "moustache" | "longue";
  sourcils: "fins" | "epais";
  nez: "petit" | "long" | "large";
  bouche: "sourire" | "neutre" | "grand";
  grain: boolean;
  oreilles: "normales" | "decollees";
  fond: string;
  accessoire: "aucun" | "boucle" | "foulard" | "cicatrice";
}

export function traits(graine: number, genre?: "h" | "f"): TraitsVisage {
  const r: Rng = makeRng(graine);
  const coupes = genre === "h" ? (["court", "chauve", "boucles", "casquette", "court"] as const) : genre === "f" ? (["long", "boucles", "chignon", "hijab", "long"] as const) : (["court", "long", "chauve", "boucles", "chignon", "hijab", "casquette"] as const);
  const coupe = pick(r, coupes);
  return {
    peau: pick(r, PEAUX),
    cheveux: pick(r, CHEVEUX),
    coupe,
    yeux: pick(r, YEUX),
    lunettes: pick(r, ["aucune", "aucune", "rondes", "carrees"] as const),
    barbe: genre === "f" || coupe === "hijab" || coupe === "chignon" || coupe === "long" ? "aucune" : pick(r, ["aucune", "aucune", "courte", "moustache", "longue"] as const),
    sourcils: pick(r, ["fins", "epais"] as const),
    nez: pick(r, ["petit", "long", "large"] as const),
    bouche: pick(r, ["sourire", "neutre", "grand"] as const),
    grain: r() < 0.35,
    oreilles: pick(r, ["normales", "normales", "decollees"] as const),
    fond: pick(r, FONDS),
    accessoire: pick(r, ["aucun", "aucun", "boucle", "foulard", "cicatrice"] as const),
  };
}

/** Le détail le plus visible, proposé comme « crochet » pour accrocher le prénom. */
export function traitMarquant(t: TraitsVisage): string {
  if (t.lunettes === "rondes") return "ses lunettes rondes";
  if (t.lunettes === "carrees") return "ses lunettes carrées";
  if (t.barbe === "longue") return "sa longue barbe";
  if (t.barbe === "moustache") return "sa moustache";
  if (t.coupe === "boucles") return "ses boucles";
  if (t.coupe === "chauve") return "son crâne lisse";
  if (t.coupe === "casquette") return "sa casquette";
  if (t.coupe === "hijab") return "son foulard";
  if (t.coupe === "chignon") return "son chignon";
  if (t.oreilles === "decollees") return "ses oreilles décollées";
  if (t.grain) return "son grain de beauté";
  if (t.accessoire === "cicatrice") return "sa cicatrice au sourcil";
  if (t.nez === "long") return "son long nez";
  return t.sourcils === "epais" ? "ses sourcils épais" : "son sourire";
}

/** Dessin SVG du visage (chaîne autonome, 200 × 200). */
export function svgVisage(t: TraitsVisage): string {
  const p: string[] = [];
  p.push(`<rect width="200" height="200" rx="24" fill="${t.fond}"/>`);
  // Épaules
  p.push(`<path d="M30 200c6-36 34-52 70-52s64 16 70 52z" fill="${t.accessoire === "foulard" ? "#C24D4D" : "#2D3446"}"/>`);
  if (t.coupe === "long") p.push(`<path d="M52 92c0-44 22-62 48-62s48 18 48 62v58H52z" fill="${t.cheveux}"/>`);
  if (t.coupe === "hijab") p.push(`<path d="M44 104c0-50 26-74 56-74s56 24 56 74v58c-16 10-34 14-56 14s-40-4-56-14z" fill="${t.cheveux === "#1E1A18" ? "#2F4F6F" : "#6F4F7F"}"/>`);
  // Cou et oreilles
  p.push(`<rect x="88" y="128" width="24" height="26" fill="${t.peau}"/>`);
  if (t.coupe !== "hijab") {
    const ox = t.oreilles === "decollees" ? 10 : 4;
    p.push(`<ellipse cx="${60 - ox}" cy="98" rx="${8 + ox / 2}" ry="12" fill="${t.peau}"/><ellipse cx="${140 + ox}" cy="98" rx="${8 + ox / 2}" ry="12" fill="${t.peau}"/>`);
  }
  // Tête
  p.push(`<ellipse cx="100" cy="94" rx="40" ry="48" fill="${t.peau}"/>`);
  // Cheveux du dessus
  if (t.coupe === "court") p.push(`<path d="M60 86c0-34 18-46 40-46s40 12 40 46c-8-16-22-22-40-22s-32 6-40 22z" fill="${t.cheveux}"/>`);
  if (t.coupe === "long") p.push(`<path d="M60 90c0-36 18-50 40-50s40 14 40 50c-12-20-26-26-40-26s-28 6-40 26z" fill="${t.cheveux}"/>`);
  if (t.coupe === "boucles") for (let i = 0; i < 9; i++) p.push(`<circle cx="${62 + i * 9.5}" cy="${54 + Math.abs(4 - i) * 3}" r="11" fill="${t.cheveux}"/>`);
  if (t.coupe === "chignon") p.push(`<circle cx="100" cy="38" r="15" fill="${t.cheveux}"/><path d="M60 88c0-34 18-48 40-48s40 14 40 48c-10-18-24-24-40-24s-30 6-40 24z" fill="${t.cheveux}"/>`);
  if (t.coupe === "casquette") p.push(`<path d="M58 74c2-26 20-38 42-38s40 12 42 38z" fill="#C2453A"/><rect x="96" y="68" width="66" height="10" rx="5" fill="#A23A30"/>`);
  if (t.coupe === "hijab") p.push(`<path d="M58 92c0-34 18-54 42-54s42 20 42 54c-10-18-24-26-42-26s-32 8-42 26z" fill="${t.cheveux === "#1E1A18" ? "#2F4F6F" : "#6F4F7F"}"/>`);
  // Sourcils
  const se = t.sourcils === "epais" ? 5 : 2.5;
  p.push(`<path d="M76 80q8-6 16 0M108 80q8-6 16 0" stroke="${t.coupe === "chauve" ? "#5A4636" : t.cheveux}" stroke-width="${se}" fill="none" stroke-linecap="round"/>`);
  if (t.accessoire === "cicatrice") p.push(`<path d="M114 72l6 14" stroke="#B5655A" stroke-width="2"/>`);
  // Yeux
  p.push(`<ellipse cx="84" cy="92" rx="6" ry="4.5" fill="#fff"/><ellipse cx="116" cy="92" rx="6" ry="4.5" fill="#fff"/>`);
  p.push(`<circle cx="84" cy="92" r="3" fill="${t.yeux}"/><circle cx="116" cy="92" r="3" fill="${t.yeux}"/>`);
  if (t.lunettes === "rondes") p.push(`<g stroke="#222" stroke-width="2.5" fill="none"><circle cx="84" cy="92" r="11"/><circle cx="116" cy="92" r="11"/><path d="M95 92h10"/></g>`);
  if (t.lunettes === "carrees") p.push(`<g stroke="#222" stroke-width="3" fill="none"><rect x="72" y="83" width="24" height="18" rx="3"/><rect x="104" y="83" width="24" height="18" rx="3"/><path d="M96 91h8"/></g>`);
  // Nez
  if (t.nez === "petit") p.push(`<path d="M100 98q-4 10 0 12" stroke="#00000044" stroke-width="2.5" fill="none"/>`);
  if (t.nez === "long") p.push(`<path d="M100 94q-2 16-6 20q4 3 10 0" stroke="#00000055" stroke-width="2.5" fill="none"/>`);
  if (t.nez === "large") p.push(`<path d="M94 110q6 5 12 0M100 96v12" stroke="#00000055" stroke-width="3" fill="none"/>`);
  // Barbe et moustache
  if (t.barbe === "courte") p.push(`<path d="M64 108q4 34 36 36q32-2 36-36q-6 18-36 20q-30-2-36-20z" fill="${t.cheveux}" opacity="0.85"/>`);
  if (t.barbe === "longue") p.push(`<path d="M62 104q2 52 38 56q36-4 38-56q-6 20-38 22q-32-2-38-22z" fill="${t.cheveux}"/>`);
  if (t.barbe === "moustache" || t.barbe === "longue") p.push(`<path d="M86 118q14-8 28 0q-14 4-28 0z" fill="${t.cheveux}"/>`);
  // Bouche
  if (t.bouche === "sourire") p.push(`<path d="M88 124q12 10 24 0" stroke="#7A2E2E" stroke-width="3" fill="none" stroke-linecap="round"/>`);
  if (t.bouche === "neutre") p.push(`<path d="M90 126h20" stroke="#7A2E2E" stroke-width="3" stroke-linecap="round"/>`);
  if (t.bouche === "grand") p.push(`<path d="M84 122q16 18 32 0z" fill="#7A2E2E"/>`);
  if (t.grain) p.push(`<circle cx="122" cy="112" r="2.6" fill="#3A2418"/>`);
  if (t.accessoire === "boucle" && t.coupe !== "hijab") p.push(`<circle cx="${t.oreilles === "decollees" ? 52 : 56}" cy="112" r="3.5" fill="#E6C34A"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${p.join("")}</svg>`;
}
