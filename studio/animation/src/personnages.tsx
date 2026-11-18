/**
 * Personnages vus de dos, en silhouette, sans visage.
 * Règle Ayati : jamais de prophète (Moussa n'apparaît que comme un coffre ou un berceau fermé).
 */
import React from "react";
import { useCurrentFrame } from "remotion";

export type Role = "pharaon" | "soldat" | "mere" | "reine" | "fille" | "servante";

export const Silhouette: React.FC<{
  x: number;
  y: number; // position des pieds
  h: number; // hauteur totale
  role: Role;
  c?: string; // couleur de la silhouette
  liseré?: string; // lumière sur le contour
  marche?: boolean;
  bras?: number; // 0 = le long du corps, 1 = tendus vers l'avant/le haut
  lance?: number; // inclinaison de la lance (soldat), en degrés
  agenouille?: boolean;
  phase?: number;
  o?: number;
  miroir?: boolean;
}> = ({ x, y, h, role, c = "#0b0a10", liseré = "#ffcf8a", marche = false, bras = 0, lance = 0, agenouille = false, phase = 0, o = 1, miroir = false }) => {
  const f = useCurrentFrame();
  const pas = marche ? f / 6 + phase : phase;
  const bob = marche ? Math.abs(Math.sin(pas)) * h * 0.012 : Math.sin(f / 30 + phase) * h * 0.003;
  const sway = marche ? Math.sin(pas) * 1.6 : Math.sin(f / 45 + phase) * 0.6;
  const k = h / 100; // unité
  const larg = role === "pharaon" ? 15 : role === "soldat" ? 13 : role === "fille" ? 10 : 11.5;
  const hautTete = agenouille ? 38 : 0;
  const yTete = 10 + hautTete;
  const ourlet = agenouille ? 70 : 100;
  const evase = role === "reine" || role === "mere" || role === "fille" || role === "servante" ? 1.35 : 1.1;
  const pliG = marche ? Math.sin(pas) * 2.5 : 0;
  const pliD = marche ? -Math.sin(pas) * 2.5 : 0;

  const corps = `M${-larg * 0.55},${yTete + 13}
    Q${-larg},${yTete + 16} ${-larg},${yTete + 28}
    L${-larg * evase + pliG},${ourlet}
    L${larg * evase + pliD},${ourlet}
    L${larg},${yTete + 28}
    Q${larg},${yTete + 16} ${larg * 0.55},${yTete + 13} Z`;

  const tete = (() => {
    switch (role) {
      case "pharaon": // némès qui retombe sur les épaules + couronne
        return (
          <>
            <path d={`M-7,${yTete - 6} Q0,${yTete - 15} 7,${yTete - 6} L12,${yTete + 18} L-12,${yTete + 18} Z`} />
            <path d={`M-4,${yTete - 12} L0,${yTete - 26} L4,${yTete - 12} Z`} />
            <rect x={-1.2} y={yTete + 18} width={2.4} height={10} />
          </>
        );
      case "soldat":
        return (
          <>
            <circle cx={0} cy={yTete} r={6.2} />
            <path d={`M-7,${yTete - 1} Q0,${yTete - 13} 7,${yTete - 1} Z`} />
          </>
        );
      case "reine":
        return (
          <>
            <path d={`M-7.5,${yTete + 2} Q-8,${yTete - 10} 0,${yTete - 10} Q8,${yTete - 10} 7.5,${yTete + 2} L${larg * 1.15},${yTete + 60} L${-larg * 1.15},${yTete + 60} Z`} />
            <rect x={-7} y={yTete - 10} width={14} height={2.5} fill={liseré} />
          </>
        );
      default: // voile
        return (
          <path d={`M-7,${yTete + 2} Q-8,${yTete - 9} 0,${yTete - 9} Q8,${yTete - 9} 7,${yTete + 2} L${larg * 1.05},${yTete + 40} L${-larg * 1.05},${yTete + 40} Z`} />
        );
    }
  })();

  const angleBras = bras * 70;
  const brasPath = (cote: number) => {
    const ex = cote * (larg + 1);
    const ey = yTete + 18;
    const a = ((90 - angleBras) * Math.PI) / 180;
    const L = 30;
    const mx = ex + cote * Math.cos(a) * L * 0.2;
    const my = ey + Math.sin(a) * L;
    return <path d={`M${ex},${ey} L${mx},${my}`} strokeWidth={4.5} stroke="currentColor" strokeLinecap="round" fill="none" />;
  };

  const forme = (
    <>
      <path d={corps} />
      {tete}
      {brasPath(-1)}
      {brasPath(1)}
      {role === "soldat" ? (
        <g transform={`rotate(${lance} ${larg + 2} ${yTete + 40})`}>
          <rect x={larg + 1} y={yTete - 40} width={2} height={100} />
          <path d={`M${larg},${yTete - 40} L${larg + 2},${yTete - 50} L${larg + 4},${yTete - 40} Z`} />
        </g>
      ) : null}
      {role === "pharaon" ? <path d={`M${-larg},${yTete + 20} L${-larg * 1.4},${ourlet} L${larg * 1.4},${ourlet} L${larg},${yTete + 20} Z`} opacity={0.85} /> : null}
    </>
  );

  return (
    <g
      transform={`translate(${x} ${y - bob}) scale(${miroir ? -k : k} ${k}) translate(0 -100) rotate(${sway} 0 100)`}
      opacity={o}
    >
      {/* liseré de lumière : la même forme, légèrement décalée */}
      <g fill={liseré} color={liseré} transform="translate(-1.6 -0.8)" opacity={0.85}>
        {forme}
      </g>
      <g fill={c} color={c}>
        {forme}
      </g>
    </g>
  );
};
