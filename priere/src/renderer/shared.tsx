import { useEffect, useState, type ReactNode } from "react";
import type { AppData, Settings } from "../core/settings.ts";
import type { InitialState } from "./api-types.ts";

export const api = window.priere;
export const save = (patch: Partial<Settings>) => { void api.updateSettings(patch); };

/** Réglages venant du processus principal + horloge locale qui avance chaque seconde. */
export function usePriere(): { init: InitialState | null; data: AppData | null; now: number } {
  const [init, setInit] = useState<InitialState | null>(null);
  const [data, setData] = useState<AppData | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let alive = true;
    api.getState().then((s) => { if (alive) { setInit(s); setData(s.data); } });
    const off = api.onState((d) => setData(d));
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => { alive = false; off(); clearInterval(id); };
  }, []);
  return { init, data, now };
}

export const hm = (ms: number, tz: string) =>
  Number.isFinite(ms) ? new Intl.DateTimeFormat("fr-FR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(ms)) : "—";

export function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(x)}` : `${p(m)}:${p(x)}`;
}

const DAY = 86_400_000;
/** Date hégirienne (calendrier Umm al-Qura), décalée de « adjust » jours. */
export function hijri(ms: number, tz: string, adjust: number, lang: "fr" | "ar" = "fr") {
  const loc = lang === "fr" ? "fr-FR-u-ca-islamic-umalqura" : "ar-u-ca-islamic-umalqura-nu-arab";
  return new Intl.DateTimeFormat(loc, { timeZone: tz, day: "numeric", month: "long", year: "numeric" }).format(new Date(ms + adjust * DAY));
}

export function gregorian(ms: number, tz: string) {
  const s = new Intl.DateTimeFormat("fr-FR", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(ms));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const Svg = ({ children, size = 20 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
export const IconSun = (p: { size?: number }) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>;
export const IconCalendar = (p: { size?: number }) => <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>;
export const IconGear = (p: { size?: number }) => <Svg {...p}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></Svg>;
export const IconBell = (p: { size?: number }) => <Svg {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" /></Svg>;
export const IconBellOff = (p: { size?: number }) => <Svg {...p}><path d="M8.7 3A6 6 0 0 1 18 8c0 2.7.4 4.6 1 6M17 17H3s3-2 3-9c0-.8.1-1.5.4-2.2M10.3 21a1.9 1.9 0 0 0 3.4 0M3 3l18 18" /></Svg>;
export const IconLeft = (p: { size?: number }) => <Svg {...p}><path d="M15 6l-6 6 6 6" /></Svg>;
export const IconRight = (p: { size?: number }) => <Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>;
export const IconClose = (p: { size?: number }) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const IconPin = (p: { size?: number }) => <Svg {...p}><path d="M12 22s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></Svg>;
