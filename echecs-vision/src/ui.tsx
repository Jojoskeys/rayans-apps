// Éléments communs de l'interface : accès aux données, sons, petits composants.
import { createContext, useContext, type ReactNode } from "react";
import { apresEssai } from "./core/espacement";
import type { Db, Resultat } from "./core/model";
import { nextLevel } from "./core/niveaux";
import { newId } from "./core/rng";

export type Page = "seance" | "exercices" | "fiches" | "quiz" | "progres" | "reglages";

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

/** Ajoute le résultat d'une manche et fait monter ou descendre le niveau de l'exercice.
 *  Pour une tactique (`ref` = id), met aussi à jour sa carte de révision. */
export function avecResultat(db: Db, r: Omit<Resultat, "id" | "at">, now = Date.now()): Db {
  const res: Resultat = { ...r, id: newId(), at: now };
  const out: Db = {
    ...db,
    resultats: [...db.resultats, res],
    niveaux: { ...db.niveaux, [r.exo]: nextLevel(r.exo, db.niveaux[r.exo], r.reussi, now) },
  };
  if (r.exo === "tactiques" && r.ref) out.cartes = { ...db.cartes, [r.ref]: apresEssai(db.cartes[r.ref], r.reussi, now, db.reglages.heureJour) };
  return out;
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

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export const plural = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
export const pct = (x: number) => `${Math.round(x * 100)} %`;

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

/** Marque ✅ / ⚠️ / ❌. */
export function Statut({ s }: { s: "ok" | "discute" | "mythe" }) {
  const t = { ok: ["✅", "prouvé"], discute: ["⚠️", "discuté"], mythe: ["❌", "mythe"] }[s];
  return <span className={`statut statut-${s}`} title={t[1]}>{t[0]} {t[1]}</span>;
}
