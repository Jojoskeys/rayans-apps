// Sélection d'une zone de l'écran : la capture est affichée en plein écran, on trace un rectangle à la souris.
import { useEffect, useState } from "react";
import { api } from "./shared.tsx";

type Pt = { x: number; y: number };

export function Capture() {
  const [img, setImg] = useState<string | null>(null);
  const [a, setA] = useState<Pt | null>(null);
  const [b, setB] = useState<Pt | null>(null);
  useEffect(() => api.onCaptureImage(setImg), []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") api.captureDone(null); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  const r = a && b ? { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) } : null;

  return (
    <div className="capture" style={img ? { backgroundImage: `url(${img})` } : undefined}
      onMouseDown={(e) => { setA({ x: e.clientX, y: e.clientY }); setB({ x: e.clientX, y: e.clientY }); }}
      onMouseMove={(e) => { if (a) setB({ x: e.clientX, y: e.clientY }); }}
      onMouseUp={() => { if (r && r.width > 3 && r.height > 3) api.captureDone(r); else { setA(null); setB(null); } }}
      onContextMenu={() => api.captureDone(null)}>
      {!r && <div className="capture-aide">Tracez un rectangle autour du texte à copier · Échap pour annuler</div>}
      {r && <div className="capture-zone" style={{ left: r.x, top: r.y, width: r.width, height: r.height }} />}
    </div>
  );
}
