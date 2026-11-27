// Éléments communs de l'interface : accès aux données, sons, petits composants.
import { createContext, useContext, type ReactNode } from "react";
import type { Db } from "./core/model";

export type Page = "seance" | "actu" | "fiches" | "progres" | "sources" | "reglages";

/** État du fichier d'actualité, lu au démarrage (ou à la demande). */
export interface EtatActu {
  ou: string;
  /** Jours des éditions trouvées dans le fichier (du plus récent au plus ancien). */
  jours: string[];
  /** Questions ajoutées lors de la dernière lecture. */
  ajoutees: number;
  erreur: string | null;
  lu: boolean;
}

export interface AppApi {
  db: Db;
  /** Modifie les données (copie) et les enregistre. */
  maj: (f: (db: Db) => Db) => void;
  aller: (p: Page, arg?: string) => void;
  arg: string | undefined;
  actu: EtatActu;
  /** Relit le fichier d'actualité (après en avoir choisi un, par exemple). */
  relireActu: (chemin?: string) => Promise<void>;
  /** Importe le contenu d'un fichier choisi dans le navigateur (hors de l'app PC). */
  importerTexteActu: (text: string) => void;
}

export const AppContext = createContext<AppApi | null>(null);
export function useApp(): AppApi {
  const a = useContext(AppContext);
  if (!a) throw new Error("AppContext manquant");
  return a;
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

export const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)} %`);
export const plural = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Histogramme simple en SVG (valeurs entre 0 et `max`). */
export function Barres({ valeurs, etiquettes, max, hauteur = 90 }: { valeurs: (number | null)[]; etiquettes: string[]; max?: number; hauteur?: number }) {
  const hi = max ?? Math.max(1, ...valeurs.map((v) => v ?? 0));
  const l = valeurs.length * 16;
  return (
    <svg className="barres" viewBox={`0 0 ${l} ${hauteur + 14}`} role="img" aria-label="Histogramme">
      {valeurs.map((v, i) => {
        const h = ((v ?? 0) / hi) * hauteur;
        return (
          <g key={i}>
            <rect x={i * 16 + 3} y={hauteur - h} width={10} height={Math.max(h, v ? 2 : 0.5)} rx={2} fill={v === null ? "var(--line)" : "var(--accent)"}><title>{`${etiquettes[i]} : ${v === null ? "—" : Math.round(v * 100) / 100}`}</title></rect>
            {i % 2 === 0 && <text x={i * 16 + 8} y={hauteur + 11} textAnchor="middle" fontSize="7" fill="var(--muted)">{etiquettes[i]}</text>}
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
