import type { SourceCount, SourceId } from "../core/counts.ts";
import type { CourseChange } from "../core/ics.ts";
import type { Deadline, DisplayCourse, SharedMail } from "../core/fac.ts";
import type { RoutineItem } from "../core/routine.ts";
import type { Avancement, ObjectifJour, Reglages, catalogue } from "../core/objectifs.ts";
import type { Citation } from "../core/citations.ts";
import type { SportView } from "../core/sportvue.ts";
import type { Ajustement, BlocReglage, Perf, SeanceFaite, TypeSeance } from "../core/sport.ts";
import type { APrevoir, EntreeMatin, EntreeSoir, JourBilan, Moments, Prieres, ReglagesBilan, SoirPlus } from "../core/bilan.ts";

/** Synchronisation avec l'iPhone (Rayan's Mobile) par un dépôt GitHub privé. */
export interface SyncView {
  configured: boolean;
  repo: string;
  state: "inactif" | "en-cours" | "a-jour" | "erreur";
  message: string;
  lastSync: number;
  details: { name: string; result: string }[];
}

/** Routine : tâches de chaque jour, à cocher, avec rappel. */
export interface RoutineView {
  items: RoutineItem[];
  today: (RoutineItem & { done: boolean })[];
  streak: number;
  day: string;
}

/** Lecture automatique des mails de la fac (IMAP, lecture seule). Le mot de passe n'est jamais renvoyé. */
export interface CourrierView {
  host: string;
  port: number;
  user: string;
  motDePasseEnregistre: boolean;
  actif: boolean;
  lastCheck: number;
  lastError: string | null;
  enCours: boolean;
  derniers: { at: number; sujet: string; appliquees: string[]; aValider: number }[];
}

/** Bilan du matin et du soir, liste prévue la veille, adhkar. */
export interface BilanView {
  jour: string;
  aujourdhui: JourBilan;
  /** Ce qui est déjà noté pour demain (bilan du soir). */
  demain: APrevoir[];
  aRemplir: { matin: boolean; soir: boolean };
  moments: Moments;
  prieres: Prieres | null;
  reglages: ReglagesBilan;
  historique: { jour: string; matin: EntreeMatin | null; soir: EntreeSoir | null }[];
  citations: { matin: Citation; midi: Citation };
  /** Noté aujourd'hui sur la montre (Rayan's Montre, par la Télécommande) ; absent sur l'iPhone. */
  montre?: { eau: number; seances: number; humeur: number | null } | null;
}

/** Objectifs du jour : petits objectifs faciles, adaptés aux habitudes. */
export interface ObjectifsView {
  jour: string;
  objectifs: (ObjectifJour & { avancement: Avancement })[];
  serie: number;
  reglages: Reglages;
  /** Tous les objectifs connus (modèles, automatiques, perso), pour les réglages. */
  catalogue: ReturnType<typeof catalogue>;
  /** Ce qui peut être mesuré automatiquement. */
  sources: { journal: boolean; chrono: boolean; revision: boolean };
}

/** Fac : emploi du temps ADE et mails partagés, tels qu'affichés. */
export interface FacView {
  configured: boolean;
  /** Adresse ADE raccourcie (elle donne accès au planning sans connexion). */
  url: string;
  lastFetch: number;
  lastError: string | null;
  fetching: boolean;
  courses: DisplayCourse[];
  removed: CourseChange[];
  mails: SharedMail[];
  deadlines: Deadline[];
  allowedSenders: string[];
  groups: string[];
  availableGroups: { name: string; count: number }[];
  webmail: string;
}

export interface Settings {
  reminder: boolean;
  reminderHour: number;
  reminderMinute: number;
  startWithWindows: boolean;
  closeToTray: boolean;
}

export interface State {
  settings: Settings;
  counts: SourceCount[];
  updatedAt: number;
  version: string;
  dataDir: string;
  paths: Record<SourceId, string>;
  today: string;
  fac: FacView;
  routine: RoutineView;
  objectifs: ObjectifsView;
  bilan: BilanView;
  courrier?: CourrierView;
  sport: SportView;
  sync?: SyncView;
}

export interface AujourdhuiApi {
  getState(): Promise<State>;
  onState(cb: (s: State) => void): () => void;
  refresh(): Promise<State>;
  updateSettings(p: Partial<Settings>): Promise<State>;
  openApp(id: SourceId): Promise<void>;
  testNotification(): Promise<boolean>;
  openFolder(p: string): void;
  quit(): void;
  sync?: {
    configure(repo: string, token: string, passphrase: string): Promise<SyncView>;
    now(): Promise<SyncView>;
    forget(): Promise<SyncView>;
  };
  routine: {
    add(title: string, time: string, days: number[]): Promise<RoutineView>;
    update(id: string, patch: { title?: string; time?: string; days?: number[] }): Promise<RoutineView>;
    remove(id: string): Promise<RoutineView>;
    toggle(id: string): Promise<RoutineView>;
  };
  sport: {
    save(s: SeanceFaite): Promise<SportView>;
    addPerf(p: Perf): Promise<SportView>;
    adjust(a: Ajustement): Promise<SportView>;
    configure(bloc: string, r: BlocReglage | null): Promise<SportView>;
    setWeek(s: TypeSeance[] | null): Promise<SportView>;
  };
  courrier?: {
    configure(p: { host?: string; port?: number; user?: string; motDePasse?: string }): Promise<CourrierView & { messagesDansLaBoite: number }>;
    now(): Promise<CourrierView>;
    setActive(actif: boolean): Promise<CourrierView>;
    forget(): Promise<CourrierView>;
  };
  bilan: {
    morning(humeur: number, ressenti: string): Promise<BilanView>;
    evening(humeur: number, journee: string, ressenti: string, demain: string[], extra?: SoirPlus): Promise<BilanView>;
    togglePlanned(id: string): Promise<BilanView>;
    toggleAdhkar(quand: "sabah" | "masa"): Promise<BilanView>;
    settings(r: Partial<ReglagesBilan>): Promise<BilanView>;
  };
  objectifs: {
    toggle(id: string): Promise<ObjectifsView>;
    change(id: string): Promise<ObjectifsView>;
    /** Compteur : nouveau total du jour. */
    count(id: string, total: number): Promise<ObjectifsView>;
    settings(r: Partial<Reglages>): Promise<ObjectifsView>;
  };
  fac: {
    setUrl(url: string): Promise<FacView>;
    refresh(): Promise<FacView>;
    addMail(text: string): Promise<FacView>;
    accept(mailId: string, id: string): Promise<FacView>;
    ignore(mailId: string, id: string): Promise<FacView>;
    undoCorrection(courseUid: string): Promise<FacView>;
    resolveConflict(courseUid: string, keep: "ade" | "mail"): Promise<FacView>;
    removeDeadline(id: string): Promise<FacView>;
    removeMail(id: string): Promise<FacView>;
    setSenders(list: string[]): Promise<FacView>;
    setGroups(list: string[]): Promise<FacView>;
    forget(): Promise<FacView>;
    openWebmail(subject: string): Promise<void>;
  };
}

declare global {
  interface Window { aujourdhui: AujourdhuiApi }
}
