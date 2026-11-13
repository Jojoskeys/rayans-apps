import { useEffect, useState, type ReactNode } from "react";
import type { State } from "./api-types.ts";

export const api = window.outils;

export function useOutils(): State | null {
  const [s, setS] = useState<State | null>(null);
  useEffect(() => {
    let alive = true;
    api.getState().then((v) => { if (alive) setS(v); });
    const off = api.onState(setS);
    return () => { alive = false; off(); };
  }, []);
  return s;
}

/** Message d'erreur lisible depuis une promesse IPC rejetée (« Error invoking remote method 'x': Error: … »). */
export const errText = (e: unknown) => String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

export const basename = (p: string) => p.split(/[\\/]/).pop() ?? p;

/** Zone où déposer des fichiers (ou cliquer pour les choisir). */
export function DropZone({ onFiles, onPick, label, accept }: { onFiles: (paths: string[]) => void; onPick: () => void; label: string; accept: string[] }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`depot ${over ? "survol" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const paths = [...e.dataTransfer.files].map((f) => api.pathOf(f)).filter((p) => p && (accept.includes("*") || accept.includes(p.split(".").pop()!.toLowerCase())));
        if (paths.length) onFiles(paths);
      }}
      onClick={onPick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onPick(); }}
    >
      <IconUpload size={26} />
      <span>{label}</span>
      <small>ou cliquez pour choisir</small>
    </div>
  );
}

const Svg = ({ children, size = 20 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
type P = { size?: number };
export const IconPdf = (p: P) => <Svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></Svg>;
export const IconImage = (p: P) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></Svg>;
export const IconPhone = (p: P) => <Svg {...p}><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></Svg>;
export const IconWifi = (p: P) => <Svg {...p}><path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0" /><circle cx="12" cy="19" r="1" fill="currentColor" /></Svg>;
export const IconSound = (p: P) => <Svg {...p}><path d="M11 5L6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></Svg>;
export const IconText = (p: P) => <Svg {...p}><path d="M4 7V5h16v2M9 19h6M12 5v14" /><path d="M2 2h3M2 2v3M22 2h-3M22 2v3M2 22h3M2 22v-3M22 22h-3M22 22v-3" /></Svg>;
export const IconPower = (p: P) => <Svg {...p}><path d="M12 3v9" /><path d="M6.4 6.4a8 8 0 1 0 11.2 0" /></Svg>;
export const IconGear = (p: P) => <Svg {...p}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></Svg>;
export const IconUpload = (p: P) => <Svg {...p}><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></Svg>;
export const IconClose = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const IconUp = (p: P) => <Svg {...p}><path d="M6 15l6-6 6 6" /></Svg>;
export const IconDown = (p: P) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>;
export const IconCopy = (p: P) => <Svg {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></Svg>;
export const IconEye = (p: P) => <Svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>;
export const IconCheck = (p: P) => <Svg {...p}><path d="M5 12l5 5 9-10" /></Svg>;
