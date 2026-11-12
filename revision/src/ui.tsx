/** Petits composants et utilitaires d'interface partagés. */
import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { Card, CardState, Db } from "./core/model";

export type View =
  | { name: "home" }
  | { name: "deck"; deckId: string }
  | { name: "review"; deckId: string | null }
  | { name: "stats" }
  | { name: "settings" };

export interface AppApi {
  db: Db;
  /** Modifie les données (enregistrées automatiquement). */
  update: (fn: (db: Db) => Db) => void;
  go: (v: View) => void;
  toast: (msg: string, kind?: "ok" | "error") => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  dataDir: string;
  /** Ouvre l'assistant d'import (dans le paquet `deckId` s'il est donné). */
  startImport: (deckId?: string) => void;
}

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
}

export const AppContext = createContext<AppApi | null>(null);
export function useApp(): AppApi {
  const a = useContext(AppContext);
  if (!a) throw new Error("AppContext manquant");
  return a;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const STATE_LABELS: Record<CardState, string> = {
  new: "Nouvelle",
  learning: "En apprentissage",
  review: "En révision",
  relearning: "À réapprendre",
};

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: new Date(ts).getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
}

export function fmtDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) return `${Math.round(ms / 1000)} s`;
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

export function fmtPercent(x: number | null): string {
  return x === null ? "—" : `${Math.round(x * 100)} %`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

export function cardStatus(c: Card, now: number): string {
  if (c.suspended) return "Suspendue";
  const s = c.sched;
  if (s.state === "new") return "Nouvelle";
  if (s.state !== "review") return STATE_LABELS[s.state];
  return s.due <= now ? "À réviser" : `Le ${fmtDate(s.due)}`;
}

/** Les touches de raccourci ne s'appliquent pas quand on tape dans un champ (sauf Entrée gérée à part). */
export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
}
