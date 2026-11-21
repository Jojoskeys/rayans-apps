// Éléments communs de l'interface : accès aux données, sons, petits composants.
import { createContext, useContext, type ReactNode } from "react";
import type { Db, Resultat } from "./core/model";
import { newId } from "./core/rng";

export type Page = "seance" | "exercices" | "fiches" | "progres" | "sources" | "reglages";

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

/** Ajoute un résultat (série terminée). */
export function avecResultat(db: Db, r: Omit<Resultat, "id" | "at">, now = Date.now()): Db {
  return { ...db, resultats: [...db.resultats, { ...r, id: newId(), at: now }] };
}

// ----- Sons (WebAudio, aucun fichier) -------------------------------------------------------------------------
let ctx: AudioContext | null = null;
export function bip(freq: number, ms = 220, actif = true, volume = 0.1) {
  if (!actif) return;
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(volume, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + ms / 1000);
  } catch { /* pas de son disponible */ }
}
export const sonJuste = (actif: boolean) => { bip(660, 110, actif); setTimeout(() => bip(880, 150, actif), 100); };
export const sonFaux = (actif: boolean) => bip(240, 240, actif, 0.08);

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

export const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export const plural = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Petit graphique en ligne fait main (valeurs successives). */
export function Courbe({ valeurs, hauteur = 56, max, min, unite = "" }: { valeurs: number[]; hauteur?: number; max?: number; min?: number; unite?: string }) {
  if (valeurs.length < 2) return <p className="muted petit">Encore une ou deux séries pour voir ta courbe.</p>;
  const l = 240;
  const hi = max ?? Math.max(...valeurs, 1);
  const lo = min ?? Math.min(...valeurs, 0);
  const y = (v: number) => hauteur - ((v - lo) / (hi - lo || 1)) * (hauteur - 8) - 4;
  const pts = valeurs.map((v, i) => `${(i / (valeurs.length - 1)) * l},${y(v)}`);
  return (
    <figure className="courbe-bloc">
      <svg className="courbe" viewBox={`0 0 ${l} ${hauteur}`} preserveAspectRatio="none" role="img" aria-label={`De ${valeurs[0]}${unite} à ${valeurs[valeurs.length - 1]}${unite}`}>
        <line x1="0" x2={l} y1={y(lo)} y2={y(lo)} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <figcaption className="muted petit">{valeurs[0]}{unite} → {valeurs[valeurs.length - 1]}{unite}</figcaption>
    </figure>
  );
}
