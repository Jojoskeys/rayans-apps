// Éléments communs de l'interface : accès aux données, sons, petits composants.
import { createContext, useContext, type ReactNode } from "react";
import type { Db, Resultat } from "./core/model";
import { nextLevel } from "./core/niveaux";
import { newId } from "./core/rng";

export type Page = "seance" | "exercices" | "travail" | "journal" | "fiches" | "progres" | "sources" | "reglages";

export interface AppApi {
  db: Db;
  /** Modifie les données (copie) et les enregistre. */
  maj: (f: (db: Db) => Db) => void;
  aller: (p: Page, arg?: string) => void;
  arg: string | undefined;
}

export const AppContext = createContext<AppApi | null>(null);
export function useApp(): AppApi {
  const a = useContext(AppContext);
  if (!a) throw new Error("AppContext manquant");
  return a;
}

/** Ajoute le résultat d'une manche et fait monter ou descendre le niveau de l'exercice. */
export function avecResultat(db: Db, r: Omit<Resultat, "id" | "at">, now = Date.now()): Db {
  const res: Resultat = { ...r, id: newId(), at: now };
  return {
    ...db,
    resultats: [...db.resultats, res],
    niveaux: { ...db.niveaux, [r.exo]: nextLevel(r.exo, db.niveaux[r.exo], r.reussi, now) },
  };
}

// ----- Sons (Web Audio, aucun fichier) ------------------------------------------------------------------------
let ctx: AudioContext | null = null;
export function bip(freq: number, ms = 220, actif = true, volume = 0.12) {
  if (!actif) return;
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + ms / 1000 + 0.02);
  } catch { /* pas de son disponible */ }
}
export const sonJuste = (actif: boolean) => bip(740, 110, actif, 0.06);
export const sonFaux = (actif: boolean) => bip(220, 200, actif, 0.07);
/** Fin d'un bloc de travail profond : trois notes douces, descendantes. */
export const sonFin = (actif: boolean) => {
  bip(784, 700, actif, 0.07);
  setTimeout(() => bip(659, 700, actif, 0.06), 350);
  setTimeout(() => bip(523, 1200, actif, 0.05), 700);
};

// ----- Petits composants --------------------------------------------------------------------------------------
export function Carte({ titre, children, className }: { titre?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`carte ${className ?? ""}`}>
      {titre && <h2>{titre}</h2>}
      {children}
    </section>
  );
}

export function Barre({ part, couleur }: { part: number; couleur?: string }) {
  return (
    <div className="barre"><div style={{ width: `${Math.round(Math.min(1, Math.max(0, part)) * 100)}%`, background: couleur }} /></div>
  );
}

export const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export const fmtMs = (ms: number | null | undefined) => (ms === null || ms === undefined ? "—" : ms >= 10000 ? `${(ms / 1000).toFixed(0)} s` : ms >= 1000 ? `${(ms / 1000).toFixed(1).replace(".", ",")} s` : `${Math.round(ms)} ms`);

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export const plural = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Petit graphique en ligne (valeurs successives), fait main en SVG. */
export function Courbe({ valeurs, hauteur = 48, max, couleur }: { valeurs: number[]; hauteur?: number; max?: number; couleur?: string }) {
  if (valeurs.length < 2) return <p className="muted petit">Encore une ou deux manches pour voir ta courbe.</p>;
  const l = 240;
  const hi = max ?? Math.max(...valeurs, 1);
  const lo = Math.min(...valeurs, 0);
  const pts = valeurs.map((v, i) => `${(i / (valeurs.length - 1)) * l},${hauteur - ((v - lo) / (hi - lo || 1)) * (hauteur - 6) - 3}`);
  return (
    <svg className="courbe" viewBox={`0 0 ${l} ${hauteur}`} preserveAspectRatio="none" role="img" aria-label={`De ${valeurs[0]} à ${valeurs[valeurs.length - 1]}`}>
      <polyline points={pts.join(" ")} fill="none" stroke={couleur ?? "var(--accent)"} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** Histogramme simple en SVG (par exemple, distractions par heure). */
export function Barres({ valeurs, etiquettes, hauteur = 90 }: { valeurs: number[]; etiquettes: string[]; hauteur?: number }) {
  const max = Math.max(...valeurs, 1);
  const l = valeurs.length * 12;
  return (
    <svg className="barres" viewBox={`0 0 ${l} ${hauteur + 14}`} role="img" aria-label="Histogramme">
      {valeurs.map((v, i) => {
        const h = (v / max) * hauteur;
        return (
          <g key={i}>
            <rect x={i * 12 + 2} y={hauteur - h} width={8} height={Math.max(h, v ? 2 : 0.5)} rx={2} fill={v ? "var(--accent)" : "var(--line)"}><title>{`${etiquettes[i]} : ${v}`}</title></rect>
            {i % 3 === 0 && <text x={i * 12 + 6} y={hauteur + 11} textAnchor="middle" fontSize="7" fill="var(--muted)">{etiquettes[i]}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/** Marque ✅ / ⚠️ / ❌. */
export function Statut({ s }: { s: "ok" | "discute" | "mythe" }) {
  const t = { ok: ["✅", "prouvé"], discute: ["⚠️", "discuté"], mythe: ["❌", "mythe"] }[s];
  return <span className={`statut statut-${s}`} title={t[1]}>{t[0]}</span>;
}
