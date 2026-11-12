import { useEffect, useState, type ReactNode } from "react";
import type { Action, AppData, Phase } from "../core/types.ts";
import type { InitialState } from "./api-types.ts";

export const api = window.chrono;
export const send = (a: Action) => { void api.dispatch(a); };

/** État partagé par le processus principal + une horloge locale qui avance tous les 250 ms. */
export function useChrono(): { init: InitialState | null; data: AppData | null; now: number } {
  const [init, setInit] = useState<InitialState | null>(null);
  const [data, setData] = useState<AppData | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let alive = true;
    api.getState().then((s) => { if (alive) { setInit(s); setData(s.data); } });
    const off = api.onState((d) => { setNow(Date.now()); setData(d); });
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => { alive = false; off(); clearInterval(id); };
  }, []);
  return { init, data, now };
}

export const PHASE_COLOR: Record<Phase, string> = { travail: "var(--rouge)", pause: "var(--vert)", longue: "var(--bleu)" };

// ----- Icônes (traits simples, 20 px) -----------------------------------------------------------

const Svg = ({ children, size = 20 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
export const IconPlay = (p: { size?: number }) => <Svg {...p}><path d="M7 4.5v15l12-7.5z" fill="currentColor" /></Svg>;
export const IconPause = (p: { size?: number }) => <Svg {...p}><path d="M8 5v14M16 5v14" strokeWidth="3" /></Svg>;
export const IconSkip = (p: { size?: number }) => <Svg {...p}><path d="M5 5l10 7-10 7z" fill="currentColor" /><path d="M19 5v14" /></Svg>;
export const IconReset = (p: { size?: number }) => <Svg {...p}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></Svg>;
export const IconMini = (p: { size?: number }) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><rect x="12" y="12" width="7" height="5" rx="1" fill="currentColor" /></Svg>;
export const IconExpand = (p: { size?: number }) => <Svg {...p}><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></Svg>;
export const IconClose = (p: { size?: number }) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const IconTrash = (p: { size?: number }) => <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>;
export const IconPlus = (p: { size?: number }) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconLeft = (p: { size?: number }) => <Svg {...p}><path d="M15 6l-6 6 6 6" /></Svg>;
export const IconRight = (p: { size?: number }) => <Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>;
export const IconDownload = (p: { size?: number }) => <Svg {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Svg>;
export const IconTimer = (p: { size?: number }) => <Svg {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></Svg>;
export const IconFolder = (p: { size?: number }) => <Svg {...p}><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Svg>;
export const IconChart = (p: { size?: number }) => <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>;
export const IconGear = (p: { size?: number }) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Svg>;

/** Date locale « AAAA-MM-JJ » et heure « HH:MM » pour les champs de formulaire. */
export function toDateInput(t: number) {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function fromDateTimeInputs(date: string, time: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();
}
