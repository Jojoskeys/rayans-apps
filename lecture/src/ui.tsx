// Éléments communs de l'interface : accès aux données, petits composants, chronomètre, enregistrement des résultats.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { dayKey, type Db, type Resultat } from "./core/model";
import { EXOS, nextLevel, type ExoId, type Issue } from "./core/niveaux";
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

export const aujourdhui = (db: Db, now = Date.now()) => dayKey(now, db.reglages.heureJour);

export function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

export const plural = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Préférence « réduire les animations » du système. */
export function useMoinsDeMouvement(): boolean {
  const [r, setR] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    const f = () => setR(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return r;
}

/** Chronomètre (secondes, avec décimales) qui avance tant que `marche` est vrai ; se met en pause sinon. */
export function useChrono(marche: boolean): [number, () => void] {
  const [t, setT] = useState(0);
  const base = useRef(0);
  useEffect(() => {
    if (!marche) return;
    const debut = performance.now();
    let id = 0;
    const tick = () => {
      setT(base.current + (performance.now() - debut) / 1000);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(id);
      base.current += (performance.now() - debut) / 1000;
    };
  }, [marche]);
  const remettre = () => { base.current = 0; setT(0); };
  return [t, remettre];
}

// ----- Petits composants --------------------------------------------------------------------------------------
export function Carte({ titre, children, className }: { titre?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`carte ${className ?? ""}`}>
      {titre && <h2>{titre}</h2>}
      {children}
    </section>
  );
}

/** Groupe de boutons « un seul choix ». */
export function Choix<T extends string | number>({ valeur, options, onChange }: { valeur: T; options: { v: T; t: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segments" role="radiogroup">
      {options.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={valeur === o.v} className={valeur === o.v ? "actif" : ""} onClick={() => onChange(o.v)}>{o.t}</button>
      ))}
    </div>
  );
}

/** Échelle de notes (0-10 ou 1-10) en boutons ; `valeur` null = rien choisi. */
export function Echelle({ valeur, min = 0, max = 10, onChange, bas, haut }: { valeur: number | null; min?: number; max?: number; onChange: (v: number) => void; bas?: string; haut?: string }) {
  const notes = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="echelle">
      <div className="notes" role="radiogroup">
        {notes.map((n) => (
          <button key={n} type="button" role="radio" aria-checked={valeur === n} className={valeur === n ? "actif" : ""} onClick={() => onChange(n)}>{n}</button>
        ))}
      </div>
      {(bas || haut) && <div className="bornes"><span>{min} = {bas}</span><span>{max} = {haut}</span></div>}
    </div>
  );
}

/** Petite courbe à une ou plusieurs séries (valeurs successives), échelle fixe. */
export function Courbe({ series, min, max, hauteur = 80, vide }: { series: { nom: string; valeurs: number[]; couleur: string }[]; min: number; max: number; hauteur?: number; vide?: string }) {
  const n = Math.max(0, ...series.map((s) => s.valeurs.length));
  if (n < 2) return <p className="muted petit">{vide ?? "Encore une ou deux fois pour voir la courbe."}</p>;
  const l = 300;
  const y = (v: number) => hauteur - ((v - min) / (max - min || 1)) * (hauteur - 8) - 4;
  return (
    <>
      <svg className="courbe" style={{ height: hauteur }} viewBox={`0 0 ${l} ${hauteur}`} preserveAspectRatio="none" role="img" aria-label={series.map((s) => `${s.nom} : ${s.valeurs.join(", ")}`).join(" ; ")}>
        <line x1="0" x2={l} y1={y((min + max) / 2)} y2={y((min + max) / 2)} stroke="var(--line)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        {series.map((s) => (
          <polyline key={s.nom} points={s.valeurs.map((v, i) => `${(i / (n - 1)) * l},${y(v)}`).join(" ")} fill="none" stroke={s.couleur} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        ))}
      </svg>
      {series.length > 1 && <div className="legende">{series.map((s) => <span key={s.nom}><i style={{ background: s.couleur }} /> {s.nom}</span>)}</div>}
    </>
  );
}

// ----- Enregistrement ---------------------------------------------------------------------------------------------

/** Ajoute un résultat et, pour un exercice à niveau, applique la règle de difficulté (2 réussites → +1, 1 échec → −1). */
export function ajouterResultat(db: Db, r: Omit<Resultat, "id" | "at">, issue?: Issue): Db {
  const now = Date.now();
  const res: Resultat = { ...r, id: newId(), at: now };
  const out: Db = { ...db, resultats: [...db.resultats, res] };
  if (issue && (EXOS as { id: string }[]).some((e) => e.id === r.exo)) {
    const id = r.exo as ExoId;
    out.niveaux = { ...db.niveaux, [id]: nextLevel(db.niveaux[id], issue, now) };
  }
  return out;
}

/** Marque une étape de la séance du jour comme faite. */
export function marquerEtape(db: Db, jour: string, etape: string): Db {
  const s = db.seances[jour] ?? { etapes: [] };
  if (s.etapes.includes(etape)) return db;
  return { ...db, seances: { ...db.seances, [jour]: { ...s, etapes: [...s.etapes, etape] } } };
}

export const fmtDuree = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export const pc = (x: number) => `${Math.round(x * 100)} %`;
