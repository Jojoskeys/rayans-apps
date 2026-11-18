import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import * as Icones from "lucide-react";
import type { Cue } from "./types";
import { clamp, H, OR, ressort, rnd, W } from "./outils";

/** Mouvements de caméra déclenchés par les bruitages : impact, secousse, battement, zoom, souffle. */
export const Camera: React.FC<{ cues: Cue[]; children: React.ReactNode; derive?: boolean }> = ({
  cues,
  children,
}) => {
  const f = useCurrentFrame();
  let s = 1;
  let x = 0;
  let y = 0;
  let rot = 0;
  for (const c of cues) {
    const d = f - c.frame;
    if (d < 0 || d > 70) continue;
    if (c.type === "impact") {
      s += 0.09 * Math.exp(-d / 6);
      const a = 18 * Math.exp(-d / 5);
      x += a * Math.sin(d * 2.1);
      y += a * Math.cos(d * 2.7);
    } else if (c.type === "secousse") {
      const a = 16 * Math.exp(-d / 7);
      x += a * Math.sin(d * 3.3);
      rot += 0.6 * Math.exp(-d / 7) * Math.sin(d * 2.2);
    } else if (c.type === "battement") {
      s += 0.035 * (Math.exp(-(((d - 2) / 3) ** 2)) + 0.8 * Math.exp(-(((d - 11) / 3) ** 2)));
    } else if (c.type === "zoom") {
      s += interpolate(d, [0, 14, 70], [0, 0.14, 0.1], clamp);
    } else if (c.type === "whoosh") {
      x += interpolate(d, [0, 6, 20], [0, -40, 0], clamp);
    }
  }
  return (
    <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) scale(${s}) rotate(${rot}deg)` }}>
      {children}
    </AbsoluteFill>
  );
};

/** Calque d'effets lumineux au-dessus de l'image. */
export const Eclairs: React.FC<{ cues: Cue[] }> = ({ cues }) => {
  const f = useCurrentFrame();
  const couches: React.ReactNode[] = [];
  cues.forEach((c, i) => {
    const d = f - c.frame;
    if (d < -2 || d > 40) return;
    if (c.type === "flash") {
      const o = interpolate(d, [0, 1, 9], [0, 0.95, 0], clamp);
      couches.push(<AbsoluteFill key={i} style={{ background: "#fff", opacity: o, mixBlendMode: "screen" }} />);
    } else if (c.type === "flash_doux") {
      const o = interpolate(d, [0, 3, 22], [0, 0.55, 0], clamp);
      couches.push(
        <AbsoluteFill
          key={i}
          style={{ background: "radial-gradient(circle at 50% 40%, #FFE7B0, transparent 70%)", opacity: o }}
        />,
      );
    } else if (c.type === "impact") {
      const o = interpolate(d, [0, 2, 16], [0, 0.6, 0], clamp);
      couches.push(
        <AbsoluteFill
          key={i}
          style={{ boxShadow: "inset 0 0 260px 80px rgba(0,0,0,0.95)", opacity: o, background: "rgba(255,255,255,0.06)" }}
        />,
      );
    } else if (c.type === "battement") {
      const o = 0.55 * (Math.exp(-(((d - 2) / 3) ** 2)) + 0.8 * Math.exp(-(((d - 11) / 3) ** 2)));
      couches.push(
        <AbsoluteFill key={i} style={{ boxShadow: "inset 0 0 300px 120px rgba(120,0,0,0.9)", opacity: o }} />,
      );
    } else if (c.type === "whoosh") {
      const p = interpolate(d, [0, 14], [-0.3, 1.3], clamp);
      couches.push(
        <AbsoluteFill
          key={i}
          style={{
            background: `linear-gradient(100deg, transparent ${p * 100 - 25}%, rgba(255,255,255,0.35) ${p * 100}%, transparent ${p * 100 + 25}%)`,
            opacity: interpolate(d, [0, 14], [1, 0], clamp),
          }}
        />,
      );
    }
  });
  return <>{couches}</>;
};

/** Objets qui surgissent : une icône dans un cercle lumineux, pour attirer l'œil. */
export const Surgissements: React.FC<{ cues: Cue[]; y?: number }> = ({ cues, y = 560 }) => {
  const f = useCurrentFrame();
  return (
    <>
      {cues
        .filter((c) => c.type === "pop" && c.icone)
        .map((c, i) => {
          const d = f - c.frame;
          if (d < 0 || d > 55) return null;
          const s = ressort(f, c.frame, { damping: 9, stiffness: 180, mass: 0.6 });
          const sortie = interpolate(d, [40, 55], [1, 0], clamp);
          const Icone = (Icones as unknown as Record<string, React.FC<{ size: number; color: string; strokeWidth: number }>>)[
            c.icone!
          ];
          const cote = rnd(c.frame) > 0.5 ? 1 : -1;
          const x = W / 2 + cote * 250;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x - 110,
                top: y - 110,
                width: 220,
                height: 220,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "radial-gradient(circle, rgba(247,192,74,0.35), rgba(0,0,0,0.55) 70%)",
                border: `5px solid ${OR}`,
                boxShadow: `0 0 60px ${OR}`,
                transform: `scale(${s * sortie}) rotate(${(1 - s) * 40 * cote}deg)`,
              }}
            >
              {Icone ? <Icone size={120} color="#fff" strokeWidth={2.2} /> : null}
            </div>
          );
        })}
    </>
  );
};

export const Grain: React.FC<{ force?: number }> = ({ force = 0.08 }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: force }}>
      <svg width={W} height={H}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={f % 8} />
        </filter>
        <rect width={W} height={H} filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{ force?: number }> = ({ force = 0.75 }) => (
  <AbsoluteFill
    style={{ background: `radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(0,0,0,${force}) 100%)` }}
  />
);

export const Progression: React.FC<{ total: number; couleur?: string }> = ({ total, couleur = OR }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 0, top: 0, height: 8, width: `${(f / total) * 100}%`, background: couleur, boxShadow: `0 0 18px ${couleur}` }} />
  );
};
