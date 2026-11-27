// Éléments communs de l'interface : accès aux données, voix de synthèse, pinyin en couleur, écriture arabe.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ecrit as ecritMot, type Langue, type Mot } from "./core/langues";
import { dayKey, type Db, type Resultat } from "./core/model";
import { nextLevel, type ExoId } from "./core/niveaux";
import { syllabes, tonDe } from "./core/pinyin";
import { newId } from "./core/rng";
import { estSu } from "./core/espacement";

export type Page = "seance" | "exercices" | "mots" | "fiches" | "progres" | "sources" | "reglages";

export interface AppApi {
  db: Db;
  langue: Langue;
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

/** Enregistre une manche terminée et ajuste la difficulté (2 réussites → +1, 1 échec → −1). */
export function finirManche(db: Db, langue: Langue, exo: ExoId, score: number, max: number, reussie: boolean): Db {
  if (max <= 0) return db;
  const now = Date.now();
  const cur = db.niveaux[langue][exo];
  const r: Resultat = { id: newId(), langue, exo, at: now, niveau: cur.level, score, max };
  return {
    ...db,
    resultats: [...db.resultats, r],
    niveaux: { ...db.niveaux, [langue]: { ...db.niveaux[langue], [exo]: nextLevel(exo, cur, reussie, now) } },
  };
}

// ----- Voix de synthèse (celles du système : rien n'est envoyé sur Internet par l'app) -----------------------------

const PREFIXE: Record<Langue, string> = { zh: "zh", ar: "ar" };

function voixDe(langue: Langue): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === "undefined") return [];
  return speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(PREFIXE[langue]) && !/hk|tw|yue/i.test(v.lang));
}

/** Les voix disponibles pour la langue (la liste arrive parfois après le chargement). */
export function useVoix(langue: Langue): SpeechSynthesisVoice[] {
  const [v, setV] = useState(() => voixDe(langue));
  useEffect(() => {
    if (typeof speechSynthesis === "undefined") return;
    const f = () => setV(voixDe(langue));
    f();
    speechSynthesis.addEventListener("voiceschanged", f);
    return () => speechSynthesis.removeEventListener("voiceschanged", f);
  }, [langue]);
  return v;
}

/** Prononce un texte avec une voix de la langue (vitesse 1 = normale, `voix` = numéro de la voix). */
export function parler(texte: string, langue: Langue, vitesse = 0.9, voix = 0, hauteur = 1) {
  if (typeof speechSynthesis === "undefined") return;
  const vs = voixDe(langue);
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texte);
  u.lang = langue === "zh" ? "zh-CN" : "ar-SA";
  if (vs.length) u.voice = vs[voix % vs.length];
  u.rate = vitesse;
  u.pitch = hauteur;
  speechSynthesis.speak(u);
}

export function BoutonEcoute({ texte, langue, vitesse, voix, hauteur }: { texte: string; langue: Langue; vitesse?: number; voix?: number; hauteur?: number }) {
  const vs = useVoix(langue);
  if (!vs.length) return null;
  return <button type="button" className="btn petit" onClick={() => parler(texte, langue, vitesse, voix, hauteur)} aria-label="Écouter">🔊 Écouter</button>;
}

export function AvisVoix({ langue }: { langue: Langue }) {
  const vs = useVoix(langue);
  if (vs.length) return null;
  return (
    <p className="alerte petit">
      Aucune voix {langue === "zh" ? "chinoise" : "arabe"} n'est installée sur cet appareil : l'écoute est désactivée.
      Sous Windows : Paramètres → Heure et langue → Voix → Ajouter des voix ({langue === "zh" ? "chinois simplifié" : "arabe"}). Sur iPhone, les voix sont déjà là.
    </p>
  );
}

// ----- Affichage des mots ----------------------------------------------------------------------------------------

/** Pinyin, chaque syllabe dans la couleur de son ton (si le réglage est activé). */
export function Pinyin({ texte, className }: { texte: string; className?: string }) {
  const { db } = useApp();
  if (!db.reglages.couleursTons) return <span className={className}>{texte}</span>;
  return (
    <span className={className}>
      {syllabes(texte).map((s, i) => <span key={i}>{i > 0 && " "}<span className={`t${tonDe(s)}`}>{s}</span></span>)}
    </span>
  );
}

/** La lecture d'un mot : pinyin coloré (chinois) ou transcription (arabe). */
export function Lecture({ langue, texte, gauche }: { langue: Langue; texte: string; gauche?: boolean }) {
  return <p className={`lecture ${gauche ? "gauche" : ""}`}>{langue === "zh" ? <Pinyin texte={texte} /> : texte}</p>;
}

/** Faut-il montrer les voyelles courtes de ce mot arabe ? (retirées quand il est su, si le réglage le demande) */
export function voyellesPour(db: Db, m: Mot): boolean {
  if (m.langue !== "ar" || !db.reglages.retirerVoyelles) return true;
  const c = db.cartes.find((x) => x.id === `ar:${m.id}`);
  return !(c && estSu(c));
}

export function Ecrit({ langue, texte, taille }: { langue: Langue; texte: string; taille?: "moyen" | "petit" }) {
  return <p className={`ecrit ${taille ?? ""} ${langue}`} lang={langue === "zh" ? "zh-CN" : "ar"}>{texte}</p>;
}

export function EcritMot({ m, taille }: { m: Mot; taille?: "moyen" | "petit" }) {
  const { db } = useApp();
  return <Ecrit langue={m.langue} texte={ecritMot(m, voyellesPour(db, m))} taille={taille} />;
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

/** Petite courbe (valeurs de 0 à 100). */
export function Courbe({ valeurs, couleur = "var(--accent)" }: { valeurs: number[]; couleur?: string }) {
  if (valeurs.length < 2) return <p className="muted petit">Encore un jour ou deux pour voir la courbe.</p>;
  const l = 300, h = 60;
  const y = (v: number) => h - (v / 100) * (h - 8) - 4;
  return (
    <svg className="courbe" viewBox={`0 0 ${l} ${h}`} preserveAspectRatio="none" role="img" aria-label={`Justesse en % : ${valeurs.join(", ")}`}>
      <line x1="0" x2={l} y1={y(80)} y2={y(80)} stroke="var(--line)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <polyline points={valeurs.map((v, i) => `${(i / (valeurs.length - 1)) * l},${y(v)}`).join(" ")} fill="none" stroke={couleur} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** Barre de progression d'une manche. */
export function Avancement({ i, n }: { i: number; n: number }) {
  return (
    <>
      <div className="compteur">{Math.min(i + 1, n)} / {n}</div>
      <div className="barre"><div style={{ width: `${(i / Math.max(1, n)) * 100}%` }} /></div>
    </>
  );
}
