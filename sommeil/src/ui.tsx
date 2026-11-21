// Éléments communs de l'interface : accès aux données, conseil de la nuit, petits composants.
import { createContext, useContext, type ReactNode } from "react";
import { conseilNuit, paramsFajr, soirDuJour, type ConseilNuit, type ParamsFajr } from "./core/horaires";
import type { Db } from "./core/model";
import { minutesDuSoir, quartInf, versHeure } from "./core/temps";

export type Page = "jour" | "journal" | "fiches" | "progres" | "sources" | "reglages";

export interface AppApi {
  db: Db;
  /** Modifie les données (copie) et les enregistre. */
  maj: (f: (db: Db) => Db) => void;
  aller: (p: Page, arg?: string) => void;
  arg: string | undefined;
  /** Réglages lus dans Rayan's Prière (null si absents). */
  priere: ParamsFajr | null;
}

export const AppContext = createContext<AppApi | null>(null);
export function useApp(): AppApi {
  const a = useContext(AppContext);
  if (!a) throw new Error("AppContext manquant");
  return a;
}

/** Heure locale « 23:15 » d'un instant. */
export const fmtH = (ms: number) => (Number.isFinite(ms) ? versHeure(new Date(ms).getHours() * 60 + new Date(ms).getMinutes()) : "—");

export function fmtDate(jour: string): string {
  const [y, m, d] = jour.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

/** Heure conseillée en « minutes du soir », arrondie au quart d'heure inférieur (sert de cible à l'objectif). */
export function cibleSoir(c: ConseilNuit): number {
  return quartInf(minutesDuSoir(fmtH(c.coucher)) ?? 0);
}

export interface ConseilDuJour { params: ParamsFajr; conseil: ConseilNuit; soir: string; cible: number }

export function conseilDuJour(db: Db, priere: ParamsFajr | null, now = Date.now()): ConseilDuJour {
  const params = paramsFajr(db.reglages, priere);
  const soir = soirDuJour(now, db.reglages.heureJour);
  const conseil = conseilNuit(params.calc, db.reglages, soir);
  return { params, conseil, soir, cible: cibleSoir(conseil) };
}

export const plural = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

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

/** Petite courbe (valeurs successives), avec une ligne de repère optionnelle. */
export function Courbe({ valeurs, hauteur = 60, min, max, repere }: { valeurs: number[]; hauteur?: number; min?: number; max?: number; repere?: number }) {
  if (valeurs.length < 2) return <p className="muted petit">Note encore une ou deux nuits pour voir la courbe.</p>;
  const l = 300;
  const hi = max ?? Math.max(...valeurs);
  const lo = min ?? Math.min(...valeurs);
  const y = (v: number) => hauteur - ((v - lo) / (hi - lo || 1)) * (hauteur - 8) - 4;
  const pts = valeurs.map((v, i) => `${(i / (valeurs.length - 1)) * l},${y(v)}`);
  return (
    <svg className="courbe" viewBox={`0 0 ${l} ${hauteur}`} preserveAspectRatio="none" role="img" aria-label={`${valeurs.length} valeurs`}>
      {repere !== undefined && <line x1="0" x2={l} y1={y(repere)} y2={y(repere)} stroke="var(--muted)" strokeOpacity="0.6" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
      <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** Nuage de points « énergie au réveil (1-5) selon la durée de sommeil (heures) ». */
export function Nuage({ points }: { points: { id: string; heures: number; energie: number }[] }) {
  if (points.length < 3) return <p className="muted petit">Il faut au moins 3 nuits notées pour voir le nuage.</p>;
  const L = 320, H = 180, g = 34, b = 26;
  const hMin = Math.min(4, Math.floor(Math.min(...points.map((p) => p.heures))));
  const hMax = Math.max(10, Math.ceil(Math.max(...points.map((p) => p.heures))));
  const x = (h: number) => g + ((h - hMin) / (hMax - hMin)) * (L - g - 18);
  const y = (e: number) => H - b - ((e - 1) / 4) * (H - b - 10);
  const graduations = Array.from({ length: hMax - hMin + 1 }, (_, i) => hMin + i);
  return (
    <svg className="nuage" viewBox={`0 0 ${L} ${H}`} role="img" aria-label="Énergie au réveil selon la durée de sommeil">
      {[1, 2, 3, 4, 5].map((e) => (
        <g key={e}>
          <line x1={g} x2={L - 18} y1={y(e)} y2={y(e)} stroke="var(--line)" />
          <text x={g - 8} y={y(e) + 4} textAnchor="end" className="axe">{e}</text>
        </g>
      ))}
      {graduations.map((h) => <text key={h} x={x(h)} y={H - 8} textAnchor="middle" className="axe">{h} h</text>)}
      <rect x={x(7)} y={6} width={Math.max(0, x(Math.min(9, hMax)) - x(7))} height={H - b - 6} fill="var(--accent)" opacity="0.07" />
      {points.map((p) => <circle key={p.id} cx={x(p.heures)} cy={y(p.energie)} r="5" fill="var(--accent)" opacity="0.75"><title>{`${p.id} : ${p.heures.toFixed(1)} h, énergie ${p.energie}`}</title></circle>)}
    </svg>
  );
}
