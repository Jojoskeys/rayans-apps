// Éléments communs de l'interface : accès aux données, sons, petits composants.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Db, Resultat } from "./core/model";
import { nextLevel, type GameId } from "./core/niveaux";
import { newId } from "./core/rng";

export type Page = "accueil" | "seance" | "jeux" | "palais" | "atelier" | "apprendre" | "progres" | "reglages";

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

/** Ajoute un résultat (et, pour un jeu, fait monter ou descendre son niveau). */
export function avecResultat(db: Db, r: Omit<Resultat, "id" | "at">, now = Date.now()): Db {
  const res: Resultat = { ...r, id: newId(), at: now };
  const out: Db = { ...db, resultats: [...db.resultats, res] };
  const jeu = r.jeu as GameId;
  if (jeu in db.niveaux) out.niveaux = { ...db.niveaux, [jeu]: nextLevel(jeu, db.niveaux[jeu], r.reussi, now) };
  return out;
}

// ----- Sons (WebAudio, aucun fichier) -------------------------------------------------------------------------
let ctx: AudioContext | null = null;
export function bip(freq: number, ms = 220, actif = true, volume = 0.12) {
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
export const sonJuste = (actif: boolean) => { bip(660, 120, actif); setTimeout(() => bip(880, 160, actif), 110); };
export const sonFaux = (actif: boolean) => bip(220, 260, actif, 0.1);

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

/** Compte à rebours en secondes ; appelle `fini` à zéro. */
export function useCompteARebours(secondes: number, actif: boolean, fini: () => void): number {
  const [reste, setReste] = useState(secondes);
  const finiRef = useRef(fini);
  finiRef.current = fini;
  useEffect(() => setReste(secondes), [secondes]);
  useEffect(() => {
    if (!actif) return;
    const debut = Date.now();
    const id = setInterval(() => {
      const r = Math.max(0, secondes - Math.floor((Date.now() - debut) / 1000));
      setReste(r);
      if (r === 0) {
        clearInterval(id);
        finiRef.current();
      }
    }, 250);
    return () => clearInterval(id);
  }, [actif, secondes]);
  return reste;
}

export const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export const plural = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Petit graphique en ligne (scores successifs). */
export function Courbe({ valeurs, hauteur = 48, max }: { valeurs: number[]; hauteur?: number; max?: number }) {
  if (valeurs.length < 2) return <p className="muted petit">Joue encore une ou deux fois pour voir ta courbe.</p>;
  const l = 240;
  const hi = max ?? Math.max(...valeurs, 1);
  const lo = Math.min(...valeurs, 0);
  const pts = valeurs.map((v, i) => `${(i / (valeurs.length - 1)) * l},${hauteur - ((v - lo) / (hi - lo || 1)) * (hauteur - 6) - 3}`);
  return (
    <svg className="courbe" viewBox={`0 0 ${l} ${hauteur}`} preserveAspectRatio="none" role="img" aria-label={`De ${valeurs[0]} à ${valeurs[valeurs.length - 1]}`}>
      <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** Saisie qui prend le focus à l'affichage et valide avec Entrée. */
export function SaisieAuto(props: { valeur: string; onChange: (v: string) => void; onValider: () => void; placeholder?: string; mode?: "numeric" | "text"; large?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <input
      ref={ref}
      className={props.large ? "saisie-large" : undefined}
      value={props.valeur}
      inputMode={props.mode}
      placeholder={props.placeholder}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      onChange={(e) => props.onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") props.onValider(); }}
    />
  );
}
