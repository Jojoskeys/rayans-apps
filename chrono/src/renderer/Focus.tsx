// Vues des aides à la concentration : écran de pause plein écran et barre du temps de travail du jour.
import { useEffect, useRef, useState } from "react";
import { PHASE_LABEL, remaining } from "../core/engine.ts";
import { formatClock } from "../core/summary.ts";
import { api, useChrono } from "./shared.tsx";

const CONSEILS = [
  "Lève-toi et étire-toi.",
  "Regarde au loin par la fenêtre, 20 secondes au moins.",
  "Bois un verre d'eau.",
  "Marche un peu, même dans la pièce.",
  "Respire lentement : 4 secondes pour inspirer, 6 pour expirer.",
  "Fais quelques adhkar.",
];

export function EcranPause() {
  const { data, now } = useChrono();
  const [maintien, setMaintien] = useState(0);
  const [reporte, setReporte] = useState(false);
  const timer = useRef<number | null>(null);
  const conseil = useRef(CONSEILS[Math.floor(Math.random() * CONSEILS.length)]);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  if (!data) return <div className="ecran-pause" />;
  const t = data.timer;
  // Passer la pause demande d'appuyer 3 secondes sans lâcher : possible en cas d'urgence, mais pas par réflexe.
  const appuyer = () => {
    const debut = Date.now();
    timer.current = window.setInterval(() => {
      const p = Math.min(1, (Date.now() - debut) / 3000);
      setMaintien(p);
      if (p >= 1) { lacher(); void api.command("pause-passer"); }
    }, 50);
  };
  const lacher = () => { if (timer.current) clearInterval(timer.current); timer.current = null; setMaintien(0); };
  return (
    <div className="ecran-pause">
      <p className="ep-phase">{PHASE_LABEL[t.phase]}</p>
      <p className="ep-temps">{formatClock(remaining(t, now))}</p>
      <p className="ep-conseil">{conseil.current}</p>
      <div className="ep-boutons">
        <button className="bouton secondaire" disabled={reporte} onClick={() => { setReporte(true); void api.command("pause-reporter"); }}>Encore 5 min (une fois)</button>
        <button className="bouton secondaire ep-passer" onPointerDown={appuyer} onPointerUp={lacher} onPointerLeave={lacher}
          style={{ ["--maintien" as string]: `${maintien * 100}%` }}>Passer la pause (maintenir 3 s)</button>
      </div>
    </div>
  );
}

export function BarreTemps() {
  const [ratio, setRatio] = useState(0);
  useEffect(() => api.onBarre(setRatio), []);
  return <div className="barre-temps"><div style={{ width: `${Math.round(ratio * 1000) / 10}%`, background: ratio >= 1 ? "var(--vert)" : "var(--accent)" }} /></div>;
}
