/**
 * Décors Ayati, entièrement animés en SVG (gratuits, sans droits).
 * Règle : jamais de prophète ni de personnage, seulement des lieux, des objets et de la lumière.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Silhouette } from "./personnages";
import type { SceneProps } from "./types";
import { clamp, H, prog, quand, rnd, W } from "./outils";

// ------------------------------------------------------------------ briques
const Ciel: React.FC<{ id: string; stops: [number, string][] }> = ({ id, stops }) => (
  <>
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        {stops.map(([o, c], i) => (
          <stop key={i} offset={o} stopColor={c} />
        ))}
      </linearGradient>
    </defs>
    <rect width={W} height={H} fill={`url(#${id})`} />
  </>
);

const Halo: React.FC<{ id: string; x: number; y: number; r: number; c: string; o?: number }> = ({ id, x, y, r, c, o = 1 }) => (
  <>
    <defs>
      <radialGradient id={id}>
        <stop offset="0" stopColor={c} stopOpacity={o} />
        <stop offset="0.35" stopColor={c} stopOpacity={o * 0.35} />
        <stop offset="1" stopColor={c} stopOpacity={0} />
      </radialGradient>
    </defs>
    <circle cx={x} cy={y} r={r} fill={`url(#${id})`} />
  </>
);

const Etoiles: React.FC<{ n: number; bas: number; graine: string }> = ({ n, bas, graine }) => {
  const f = useCurrentFrame();
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const x = rnd(graine + "x" + i) * W;
        const y = rnd(graine + "y" + i) ** 1.3 * bas;
        const r = 1 + rnd(graine + "r" + i) * 2.6;
        const scint = 0.55 + 0.45 * Math.sin(f / (6 + rnd(graine + "s" + i) * 14) + i);
        return <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={scint * (0.4 + 0.6 * rnd(graine + "o" + i))} />;
      })}
    </g>
  );
};

const Fleuve: React.FC<{ y: number; haut: string; bas: string; refletX?: number; reflet?: string; graine: string; vitesse?: number }> = ({
  y,
  haut,
  bas,
  refletX,
  reflet = "#fff4d6",
  graine,
  vitesse = 1,
}) => {
  const f = useCurrentFrame();
  const id = "eau" + graine;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={haut} />
          <stop offset="1" stopColor={bas} />
        </linearGradient>
      </defs>
      <rect x={0} y={y} width={W} height={H - y} fill={`url(#${id})`} />
      {Array.from({ length: 150 }).map((_, i) => {
        const p = rnd(graine + "p" + i) ** 1.7;
        const yy = y + 6 + p * (H - y);
        const prof = 0.3 + p;
        const near = refletX !== undefined && rnd(graine + "n" + i) < 0.45;
        const x0 = near ? refletX! + (rnd(graine + "d" + i) - 0.5) * (120 + p * 500) : rnd(graine + "x" + i) * W;
        const x = x0 + Math.sin(f / 18 * vitesse + i) * 14 * prof;
        const l = (20 + rnd(graine + "l" + i) * 110) * prof;
        const o = (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(f / 7 * vitesse + i * 1.7))) * (near ? 0.9 : 0.28);
        return <rect key={i} x={x - l / 2} y={yy} width={l} height={2 + prof * 3} rx={2} fill={near ? reflet : "#ffffff"} opacity={o} />;
      })}
    </g>
  );
};

const Roseaux: React.FC<{ x0: number; x1: number; base: number; h: number; c: string; n: number; graine: string }> = ({
  x0,
  x1,
  base,
  h,
  c,
  n,
  graine,
}) => {
  const f = useCurrentFrame();
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const x = x0 + rnd(graine + i) * (x1 - x0);
        const hh = h * (0.5 + 0.5 * rnd(graine + "h" + i));
        const sway = Math.sin(f / 28 + i * 0.7) * 16 + (rnd(graine + "p" + i) - 0.5) * 60;
        const tx = x + sway;
        const ty = base - hh;
        return (
          <g key={i}>
            <path d={`M${x},${base} Q${x + sway * 0.2},${base - hh * 0.6} ${tx},${ty}`} stroke={c} strokeWidth={4 + rnd(graine + "w" + i) * 4} fill="none" strokeLinecap="round" />
            {rnd(graine + "e" + i) < 0.4 ? <ellipse cx={tx} cy={ty - 10} rx={8} ry={24} fill={c} transform={`rotate(${sway / 3} ${tx} ${ty})`} /> : null}
          </g>
        );
      })}
    </g>
  );
};

const Palmier: React.FC<{ x: number; sol: number; h: number; c: string; incl?: number; phase?: number }> = ({ x, sol, h, c, incl = 0.12, phase = 0 }) => {
  const f = useCurrentFrame();
  const vent = Math.sin(f / 35 + phase) * 0.04;
  const tx = x + (incl + vent) * h;
  const ty = sol - h;
  const palmes = [-170, -145, -120, -95, -70, -45, -20, 5, 165].map((a, i) => {
    const r = (a * Math.PI) / 180;
    const L = h * (0.42 + 0.06 * Math.sin(i));
    const bend = Math.sin(f / 22 + i + phase) * 10;
    const mx = tx + Math.cos(r) * L * 0.55;
    const my = ty + Math.sin(r) * L * 0.4 - L * 0.12;
    const ex = tx + Math.cos(r) * L;
    const ey = ty + Math.sin(r) * L * 0.25 + L * 0.42 + bend;
    return <path key={i} d={`M${tx},${ty} Q${mx},${my} ${ex},${ey}`} stroke={c} strokeWidth={h / 26} fill="none" strokeLinecap="round" />;
  });
  return (
    <g>
      <path d={`M${x},${sol} Q${x + incl * h * 0.2},${sol - h * 0.5} ${tx},${ty}`} stroke={c} strokeWidth={h / 22} fill="none" strokeLinecap="round" />
      {palmes}
    </g>
  );
};

const Brume: React.FC<{ y: number; c: string; o?: number; graine: string; n?: number }> = ({ y, c, o = 0.35, graine, n = 6 }) => {
  const f = useCurrentFrame();
  return (
    <g>
      <defs>
        <radialGradient id={"br" + graine}>
          <stop offset="0" stopColor={c} stopOpacity={o} />
          <stop offset="1" stopColor={c} stopOpacity={0} />
        </radialGradient>
      </defs>
      {Array.from({ length: n }).map((_, i) => {
        const x = ((rnd(graine + i) * W * 1.6 + f * (0.6 + rnd(graine + "v" + i))) % (W * 1.6)) - W * 0.3;
        return <ellipse key={i} cx={x} cy={y + (rnd(graine + "y" + i) - 0.5) * 220} rx={520} ry={110} fill={`url(#br${graine})`} />;
      })}
    </g>
  );
};

const Poussieres: React.FC<{ n: number; c: string; graine: string; haut?: number; bas?: number }> = ({ n, c, graine, haut = 0, bas = H }) => {
  const f = useCurrentFrame();
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const x = rnd(graine + "x" + i) * W + Math.sin(f / 40 + i) * 30;
        const y = haut + ((rnd(graine + "y" + i) * (bas - haut) - f * (0.4 + rnd(graine + "v" + i)) + 4 * H) % (bas - haut));
        const r = 1.5 + rnd(graine + "r" + i) * 3.5;
        const o = 0.3 + 0.7 * Math.abs(Math.sin(f / 15 + i));
        return <circle key={i} cx={x} cy={y} r={r} fill={c} opacity={o} />;
      })}
    </g>
  );
};

const Rayons: React.FC<{ x: number; y: number; c: string; o?: number }> = ({ x, y, c, o = 0.18 }) => {
  const f = useCurrentFrame();
  return (
    <g opacity={o} style={{ mixBlendMode: "screen" }}>
      {Array.from({ length: 14 }).map((_, i) => {
        const a = (i / 14) * Math.PI * 2 + f / 400;
        const l = 1600;
        const w = 0.06 + 0.03 * Math.sin(i * 3);
        return (
          <path
            key={i}
            d={`M${x},${y} L${x + Math.cos(a - w) * l},${y + Math.sin(a - w) * l} L${x + Math.cos(a + w) * l},${y + Math.sin(a + w) * l} Z`}
            fill={c}
          />
        );
      })}
    </g>
  );
};

const Flamme: React.FC<{ x: number; y: number; t?: number; graine: string }> = ({ x, y, t = 1, graine }) => {
  const f = useCurrentFrame();
  const fl = 1 + 0.12 * Math.sin(f / 2.3 + rnd(graine) * 9) + 0.08 * Math.sin(f / 1.3);
  const pen = Math.sin(f / 4 + rnd(graine) * 5) * 5 * t;
  return (
    <g>
      <Halo id={"fh" + graine} x={x} y={y - 20 * t} r={260 * t * fl} c="#ff9a2e" o={0.55} />
      <path d={`M${x - 16 * t},${y} Q${x - 22 * t},${y - 40 * t * fl} ${x + pen},${y - 80 * t * fl} Q${x + 22 * t},${y - 40 * t * fl} ${x + 16 * t},${y} Z`} fill="#ffb347" />
      <path d={`M${x - 8 * t},${y} Q${x - 10 * t},${y - 22 * t * fl} ${x + pen / 2},${y - 46 * t * fl} Q${x + 10 * t},${y - 22 * t * fl} ${x + 8 * t},${y} Z`} fill="#fff3c4" />
    </g>
  );
};

const Maisons: React.FC<{ sol: number; c: string; graine: string; fenetres?: number[]; echelle?: number }> = ({ sol, c, graine, fenetres = [], echelle = 1 }) => {
  const f = useCurrentFrame();
  const blocs: React.ReactNode[] = [];
  let x = -60;
  let i = 0;
  while (x < W + 60) {
    const w = (150 + rnd(graine + "w" + i) * 160) * echelle;
    const h = (180 + rnd(graine + "h" + i) * 230) * echelle;
    blocs.push(<rect key={"m" + i} x={x} y={sol - h} width={w} height={h + 400} fill={c} />);
    if (rnd(graine + "t" + i) < 0.5) blocs.push(<rect key={"t" + i} x={x + 18} y={sol - h - 70 * echelle} width={w * 0.45} height={72 * echelle} fill={c} />);
    if (fenetres.includes(i)) {
      const o = 0.75 + 0.25 * Math.sin(f / 3 + i);
      blocs.push(<Halo key={"hf" + i} id={"hf" + graine + i} x={x + w / 2} y={sol - h * 0.55} r={180 * echelle} c="#ff9d3b" o={0.5 * o} />);
      blocs.push(<rect key={"f" + i} x={x + w / 2 - 22 * echelle} y={sol - h * 0.55 - 34 * echelle} width={44 * echelle} height={62 * echelle} rx={20 * echelle} fill="#ffc46e" opacity={o} />);
    }
    x += w - 8;
    i++;
  }
  return <g>{blocs}</g>;
};

const Palais: React.FC<{ base: number; c: string; x?: number; echelle?: number; torches?: boolean }> = ({ base, c, x = W / 2, echelle = 1, torches = true }) => {
  const s = echelle;
  const pylone = (cx: number) => (
    <g>
      <path d={`M${cx - 150 * s},${base} L${cx + 150 * s},${base} L${cx + 110 * s},${base - 560 * s} L${cx - 110 * s},${base - 560 * s} Z`} fill={c} />
      <rect x={cx - 128 * s} y={base - 600 * s} width={256 * s} height={44 * s} fill={c} />
    </g>
  );
  return (
    <g>
      {pylone(x - 300 * s)}
      {pylone(x + 300 * s)}
      <rect x={x - 200 * s} y={base - 330 * s} width={400 * s} height={330 * s} fill={c} />
      {[-150, -75, 0, 75, 150].map((d) => (
        <rect key={d} x={x + d * s - 17 * s} y={base - 420 * s} width={34 * s} height={420 * s} fill={c} />
      ))}
      <rect x={x - 200 * s} y={base - 450 * s} width={400 * s} height={34 * s} fill={c} />
      <path d={`M${x - 520 * s},${base} L${x - 500 * s},${base - 700 * s} L${x - 480 * s},${base} Z`} fill={c} />
      {torches ? (
        <>
          <Flamme x={x - 300 * s} y={base - 610 * s} t={0.6 * s} graine={"tg" + x} />
          <Flamme x={x + 300 * s} y={base - 610 * s} t={0.6 * s} graine={"td" + x} />
        </>
      ) : null}
    </g>
  );
};

const Coffre: React.FC<{ x: number; y: number; t: number; lumiere?: string }> = ({ x, y, t, lumiere = "#ffd9a0" }) => {
  const f = useCurrentFrame();
  const bob = Math.sin(f / 14) * 6 * t;
  const rot = Math.sin(f / 19) * 3;
  const w = 240 * t;
  const h = 120 * t;
  return (
    <g>
      {[0, 1, 2].map((k) => {
        const p = ((f / 50 + k / 3) % 1);
        return <ellipse key={k} cx={x} cy={y + h * 0.55} rx={w * (0.6 + p * 1.3)} ry={22 * t * (0.6 + p)} fill="none" stroke="#fff" strokeOpacity={0.45 * (1 - p)} strokeWidth={3} />;
      })}
      <g transform={`translate(${x} ${y + bob}) rotate(${rot})`}>
        <path d={`M${-w / 2},${-h / 2} L${w / 2},${-h / 2} L${w / 2 - 16 * t},${h / 2} L${-w / 2 + 16 * t},${h / 2} Z`} fill="#7a4b26" />
        <path d={`M${-w / 2 - 10 * t},${-h / 2} L${w / 2 + 10 * t},${-h / 2} L${w / 2 - 6 * t},${-h / 2 - 46 * t} L${-w / 2 + 6 * t},${-h / 2 - 46 * t} Z`} fill="#4e2f17" />
        {[-0.25, 0.25].map((k) => (
          <line key={k} x1={k * w} y1={-h / 2} x2={k * w * 0.94} y2={h / 2} stroke="#4e2f17" strokeWidth={6 * t} />
        ))}
        <line x1={-w / 2 + 6} y1={-h / 2 - 44 * t} x2={w / 2 - 6} y2={-h / 2 - 44 * t} stroke={lumiere} strokeWidth={4 * t} />
      </g>
    </g>
  );
};

/** Caméra lente propre au décor (travelling avant + léger déplacement). */
const Travelling: React.FC<{ duree: number; de?: number; a?: number; dx?: number; dy?: number; children: React.ReactNode }> = ({
  duree,
  de = 1.0,
  a = 1.12,
  dx = 0,
  dy = 0,
  children,
}) => {
  const f = useCurrentFrame();
  const p = prog(f, 0, duree);
  const s = de + (a - de) * p;
  return (
    <AbsoluteFill style={{ transform: `translate(${dx * p}px, ${dy * p}px) scale(${s})` }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {children}
      </svg>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ scènes (v3 : l'image suit chaque phrase)

/** Caméra à étapes : [frame, zoom, décalage x, décalage y], interpolés en douceur. */
const Cadre: React.FC<{ cles: [number, number, number, number][]; children: React.ReactNode }> = ({ cles, children }) => {
  const f = useCurrentFrame();
  const fr = cles.map((c) => c[0]);
  const v = (i: number) => (cles.length > 1 ? interpolate(f, fr, cles.map((c) => c[i]), { ...clamp, easing: Easing.inOut(Easing.cubic) }) : cles[0][i]);
  return (
    <AbsoluteFill style={{ transform: `scale(${v(1)}) translate(${v(2)}px, ${v(3)}px)` }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {children}
      </svg>
    </AbsoluteFill>
  );
};

/** Coffre avec couvercle qui s'ouvre (lumière dorée, on ne voit jamais l'enfant). */
const Coffre2: React.FC<{ x: number; y: number; t: number; ouvert?: number; flotte?: boolean; rot?: number }> = ({ x, y, t, ouvert = 0, flotte = true, rot = 0 }) => {
  const f = useCurrentFrame();
  const bob = flotte ? Math.sin(f / 14) * 6 * t : 0;
  const r = flotte ? Math.sin(f / 19) * 3 + rot : rot;
  const w = 240 * t;
  const h = 120 * t;
  return (
    <g>
      {flotte
        ? [0, 1, 2].map((k) => {
            const p = (f / 50 + k / 3) % 1;
            return <ellipse key={k} cx={x} cy={y + h * 0.55} rx={w * (0.6 + p * 1.3)} ry={22 * t * (0.6 + p)} fill="none" stroke="#fff" strokeOpacity={0.45 * (1 - p)} strokeWidth={3} />;
          })
        : null}
      {ouvert > 0 ? <Halo id={"co" + Math.round(x)} x={x} y={y - h * 0.6 + bob} r={340 * t * ouvert} c="#ffe2a0" o={0.9 * ouvert} /> : null}
      <g transform={`translate(${x} ${y + bob}) rotate(${r})`}>
        <path d={`M${-w / 2},${-h / 2} L${w / 2},${-h / 2} L${w / 2 - 16 * t},${h / 2} L${-w / 2 + 16 * t},${h / 2} Z`} fill="#7a4b26" />
        {[-0.25, 0.25].map((k) => (
          <line key={k} x1={k * w} y1={-h / 2} x2={k * w * 0.94} y2={h / 2} stroke="#4e2f17" strokeWidth={6 * t} />
        ))}
        {ouvert > 0 ? <rect x={-w / 2 + 8 * t} y={-h / 2 - 4} width={w - 16 * t} height={10 * t} fill="#fff1c8" opacity={ouvert} /> : null}
        <g transform={`rotate(${-ouvert * 75} ${-w / 2} ${-h / 2})`}>
          <path d={`M${-w / 2 - 10 * t},${-h / 2} L${w / 2 + 10 * t},${-h / 2} L${w / 2 - 6 * t},${-h / 2 - 46 * t} L${-w / 2 + 6 * t},${-h / 2 - 46 * t} Z`} fill="#4e2f17" />
        </g>
      </g>
    </g>
  );
};

const Fondu: React.FC<{ de: number; a: number; children: React.ReactNode; inverse?: boolean }> = ({ de, a, children, inverse }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [de, a], inverse ? [1, 0] : [0, 1], clamp);
  return o <= 0 ? null : <g opacity={o}>{children}</g>;
};

// 1. Accroche : Pharaon de dos domine la ville, puis face au berceau dans son propre palais.
const PalaisNuit: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const egorger = quand(plan, "égorger", 0, 40);
  const elever = quand(plan, "élever", 0, 150);
  const voici = quand(plan, "Voici", 0, 260);
  const interieur = f >= elever;
  return (
    <Cadre cles={interieur ? [[elever, 1.0, 0, 0], [voici, 1.12, 0, 40], [voici + 40, 1.45, 0, 120]] : [[0, 1.0, 0, 0], [elever, 1.15, 0, -60]]}>
      {!interieur ? (
        <>
          <Ciel id="pn" stops={[[0, "#05030c"], [0.5, "#2a0d18"], [1, "#4a1a1a"]]} />
          <Etoiles n={120} bas={800} graine="pn" />
          <Halo id="pnl" x={540} y={1100} r={900} c="#8a1f1f" o={0.45} />
          <Maisons sol={1250} c="#160a10" graine="pnv" fenetres={[1, 4, 6]} echelle={0.7} />
          {/* colonne de soldats aux torches qui traverse la ville */}
          {Array.from({ length: 9 }).map((_, k) => {
            const x = ((f - egorger) * 2.6 + k * 95) % 1400 - 200;
            return f >= egorger ? (
              <g key={k}>
                <Flamme x={x + 14} y={1180} t={0.35} graine={"pt" + k} />
                <Silhouette x={x} y={1260} h={120} role="soldat" c="#120509" liseré="#ff7a3a" marche phase={k} />
              </g>
            ) : null;
          })}
          {/* terrasse du palais au premier plan */}
          <rect x={-20} y={1500} width={1120} height={440} fill="#070306" />
          <rect x={-20} y={1480} width={1120} height={30} fill="#120509" />
          {Array.from({ length: 10 }).map((_, k) => <rect key={k} x={k * 115} y={1400} width={26} height={90} fill="#120509" />)}
          <Silhouette x={540} y={1760} h={560} role="pharaon" c="#050204" liseré="#ff6a3a" />
          <Flamme x={90} y={1360} t={0.9} graine="pnt1" />
          <Flamme x={990} y={1360} t={0.9} graine="pnt2" />
        </>
      ) : (
        <>
          <Ciel id="pni" stops={[[0, "#120806"], [0.6, "#2e170c"], [1, "#160a05"]]} />
          {[-1, 1].map((c) => [0, 1, 2].map((k) => (
            <rect key={c + "" + k} x={540 + c * (220 + k * 150) - 40} y={300 - k * 60} width={80} height={1300 + k * 120} fill={["#3a2010", "#2e190c", "#24130a"][k]} />
          )))}
          <path d="M440,0 L640,0 L760,1500 L320,1500 Z" fill="#ffe2a8" opacity={0.14} />
          <Halo id="pnb" x={540} y={1330} r={420} c="#ffd98a" o={0.6} />
          <path d="M400,1360 Q540,1470 680,1360 L665,1330 L415,1330 Z" fill="#8a5a2b" />
          <path d="M420,1330 Q540,1295 660,1330" fill="#f2e6cc" />
          <rect y={1460} width={W} height={500} fill="#0e0704" />
          <Silhouette x={540} y={1900} h={640} role="pharaon" c="#050302" liseré="#ffc77a" />
          <Poussieres n={40} c="#ffd79a" graine="pni" />
        </>
      )}
    </Cadre>
  );
};

// 2. Les soldats entrent dans le quartier des Bani Israïl.
const VillageNuit: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const tyran = quand(plan, "tyran", 0, 40);
  const garcon = quand(plan, "garçon", 0, 120);
  const filles = quand(plan, "filles", 0, 220);
  const porte = interpolate(f, [garcon, garcon + 10], [0, 1], clamp);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [garcon, 1.12, 40, -40], [filles + 30, 1.2, 0, -80]]}>
      <Ciel id="vn" stops={[[0, "#04060f"], [0.6, "#1b1834"], [1, "#2c2340"]]} />
      <Etoiles n={160} bas={900} graine="vn" />
      <circle cx={260} cy={330} r={58} fill="#f3ead2" />
      <Halo id="vnl" x={260} y={330} r={300} c="#a9b6ff" o={0.35} />
      <Maisons sol={1150} c="#1e1a30" graine="v1" fenetres={[2, 5]} echelle={0.8} />
      {/* maison au fond de la rue, dont la porte s'ouvre */}
      <rect x={380} y={900} width={320} height={420} fill="#141122" />
      <rect x={490} y={1120} width={100} height={200} fill="#05040a" />
      <Halo id="vnp" x={540} y={1220} r={260 * porte} c="#ff9d3b" o={0.7 * porte} />
      <rect x={490} y={1120} width={100 * porte} height={200} fill="#ffb760" opacity={porte} />
      <rect y={1320} width={W} height={700} fill="#0a0912" />
      {/* les soldats remontent la rue, de dos */}
      {[0, 1, 2, 3].map((k) => {
        const avance = interpolate(f, [tyran, garcon + 20], [0, 1], clamp);
        const x = 220 + k * 200 + (540 - (220 + k * 200)) * avance * 0.35;
        const y = 1900 - avance * 380 - (k % 2) * 40;
        const h = 520 - avance * 200;
        return (
          <g key={k}>
            <Flamme x={x + h * 0.15} y={y - h * 0.82} t={h / 900} graine={"vs" + k} />
            <Silhouette x={x} y={y} h={h} role="soldat" c="#06050b" liseré="#ff9a4a" marche={f < garcon + 20} phase={k * 1.3} lance={-8} />
          </g>
        );
      })}
      <Brume y={1500} c="#6a5a8a" o={0.22} graine="vn" />
    </Cadre>
  );
};

// 3. La mère, de dos, veille près du berceau ; les torches passent derrière la fenêtre.
const Lampe: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const favoriser = quand(plan, "favoriser", 0, 30);
  const femme = quand(plan, "femme", 0, 160);
  const soldats = quand(plan, "soldats", 0, 220);
  const pleur = quand(plan, "pleur", 0, 300);
  const trahir = quand(plan, "trahir", 0, 330);
  const lumiere = interpolate(f, [favoriser, favoriser + 30, femme], [0, 1, 0.3], clamp);
  const ombre = interpolate(f, [soldats, soldats + 90], [-500, 1500], clamp);
  const berce = f >= pleur && f < trahir + 30 ? Math.sin((f - pleur) / 2) * 4 : 0;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [femme, 1.05, 0, -20], [pleur, 1.25, 60, -160], [trahir + 40, 1.35, 60, -200]]}>
      <Ciel id="lp" stops={[[0, "#1a0f08"], [1, "#2b1a0e"]]} />
      {Array.from({ length: 18 }).map((_, r) =>
        Array.from({ length: 6 }).map((__, c) => (
          <rect key={r + "-" + c} x={c * 200 - (r % 2) * 100} y={r * 110} width={194} height={104} rx={8} fill="#3a2414" opacity={0.25 + rnd("pi" + r + c) * 0.25} />
        )),
      )}
      <rect x={640} y={330} width={260} height={360} rx={130} fill="#0b1630" />
      <circle cx={800} cy={450} r={46} fill="#f3ead2" />
      {/* torches des soldats qui passent dehors */}
      {f >= soldats ? [0, 1].map((k) => <Flamme key={k} x={ombre - k * 160 > 640 && ombre - k * 160 < 900 ? ombre - k * 160 : -999} y={640} t={0.5} graine={"lw" + k} />) : null}
      <rect x={640} y={330} width={260} height={360} rx={130} fill="none" stroke="#1a0f08" strokeWidth={26} />
      {/* ombres des soldats qui glissent sur le mur */}
      {f >= soldats ? [0, 1, 2].map((k) => <Silhouette key={k} x={ombre - k * 220} y={1250} h={760} role="soldat" c="#000" liseré="#000" marche o={0.35} phase={k} lance={-6} />) : null}
      <Halo id="lpg" x={540} y={500} r={700} c="#ffd27a" o={0.35 * lumiere} />
      <rect x={140} y={1180} width={800} height={30} rx={8} fill="#1a0e06" />
      <path d="M430,1180 Q540,1100 650,1180 Z" fill="#8a5a2b" />
      <path d="M630,1160 L700,1140 L690,1165 Z" fill="#8a5a2b" />
      <Flamme x={698} y={1140} t={1.4} graine="lampe" />
      <g transform={`rotate(${berce} 640 1560)`}>
        <path d="M460,1560 Q640,1680 820,1560 L800,1520 L480,1520 Z" fill="#6b4421" />
        {Array.from({ length: 7 }).map((_, k) => (
          <line key={k} x1={500 + k * 48} y1={1525} x2={508 + k * 44} y2={1620} stroke="#4a2d14" strokeWidth={5} />
        ))}
        <path d="M490,1520 Q640,1480 790,1520" fill="#e8dcc4" />
      </g>
      <Fondu de={femme - 10} a={femme + 10}>
        <Silhouette x={300} y={1900} h={620} role="mere" c="#0d0704" liseré="#ffb35a" agenouille bras={f >= pleur ? 0.6 : 0.15} />
      </Fondu>
      <rect width={W} height={H} fill="#000" opacity={interpolate(f, [trahir, trahir + 20], [0, 0.35], clamp)} />
      <Poussieres n={30} c="#ffc77a" graine="lpd" />
    </Cadre>
  );
};

// 4. Au bord du fleuve : elle ferme le coffre, le pose sur l'eau, le lâche.
const CoffreNuit: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const ferment = quand(plan, "ferment", 0, 90);
  const posent = quand(plan, "posent", 0, 150);
  const lachent = quand(plan, "lâchent", 0, 210);
  const ouvert = interpolate(f, [ferment, ferment + 14], [1, 0], clamp);
  const surEau = interpolate(f, [posent, posent + 30], [0, 1], clamp);
  const derive = interpolate(f, [lachent, lachent + 140], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const cx = 600 + surEau * 60 + derive * 260;
  const cy = 1450 + surEau * 40 - derive * 330;
  return (
    <Cadre cles={[[0, 1.25, -40, -200], [ferment + 10, 1.3, -40, -220], [posent + 20, 1.1, 0, -100], [lachent + 120, 1.0, 0, 0]]}>
      <Ciel id="cn" stops={[[0, "#050a1c"], [0.55, "#18264a"], [1, "#2c3a64"]]} />
      <Etoiles n={150} bas={950} graine="cn" />
      <circle cx={760} cy={360} r={64} fill="#f5eedb" />
      <Halo id="cnl" x={760} y={360} r={380} c="#9fb4ff" o={0.4} />
      <Palmier x={110} sol={1030} h={560} c="#060a16" incl={0.18} />
      <rect y={1030} width={W} height={20} fill="#060a16" />
      <Fleuve y={1040} haut="#1b2a52" bas="#03060f" refletX={760} reflet="#e8ecff" graine="cn" />
      <Coffre2 x={cx} y={cy} t={1.0 - derive * 0.6} ouvert={ouvert} flotte={surEau > 0.5} />
      {/* rive au premier plan, la mère agenouillée de dos */}
      <path d="M-20,1620 Q300,1540 520,1600 L520,1960 L-20,1960 Z" fill="#05070f" />
      <Silhouette x={330} y={1780} h={520} role="mere" c="#03050c" liseré="#b9c8ff" agenouille bras={interpolate(f, [posent, posent + 20, lachent, lachent + 30], [0.3, 0.9, 0.9, 0.2], clamp)} />
      <Roseaux x0={760} x1={1100} base={1960} h={760} c="#02040a" n={34} graine="cnr2" />
      <Brume y={1100} c="#8fa3d9" o={0.18} graine="cn" />
    </Cadre>
  );
};

// 5. Au matin, elle reste seule sur la rive ; elle s'avance… puis la lumière la retient.
const MatinVide: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const reveler = quand(plan, "révéler", 0, 90);
  const raffermi = quand(plan, "raffermi", 0, 170);
  const avance = interpolate(f, [reveler, reveler + 40, raffermi, raffermi + 20], [0, 1, 1, 0.7], clamp);
  const rayons = interpolate(f, [raffermi, raffermi + 25], [0, 1], clamp);
  return (
    <Cadre cles={[[0, 1.15, 0, -60], [reveler, 1.05, 0, 0], [raffermi + 40, 1.2, 0, -120]]}>
      <Ciel id="mv" stops={[[0, "#6c7686"], [0.6, "#a9b0ba"], [1, "#cfd3d8"]]} />
      <Halo id="mvs" x={540} y={760} r={500} c="#fff6dc" o={0.2 + 0.6 * rayons} />
      <g opacity={rayons}><Rayons x={540} y={760} c="#fff8e0" o={0.25} /></g>
      <Fleuve y={1100} haut="#8b939f" bas="#3d434e" graine="mv" vitesse={0.5} />
      <Brume y={1050} c="#ffffff" o={0.55} graine="mv" n={9} />
      <path d="M-20,1500 Q540,1430 1100,1500 L1100,1960 L-20,1960 Z" fill="#59606c" />
      <Silhouette x={540} y={1760 - avance * 120} h={560 - avance * 90} role="mere" c="#20242c" liseré="#ffffff" marche={f >= reveler && f < reveler + 40} />
      <Brume y={1400} c="#ffffff" o={0.35} graine="mv2" n={7} />
      <Roseaux x0={760} x1={1100} base={1960} h={820} c="#3b4250" n={26} graine="mvr" />
    </Cadre>
  );
};

// 6. La sœur, de dos, suit le coffre le long du fleuve en se cachant dans les roseaux.
const Berge: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const suis = quand(plan, "Suis-le", 0, 20);
  const petite = quand(plan, "petite", 0, 80);
  const marche = interpolate(f, [petite, d], [0, 1], clamp);
  const fx = 260 + marche * 520;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [petite, 1.1, 40, -60], [d, 1.25, -160, -120]]}>
      <Ciel id="bg" stops={[[0, "#7aa0c8"], [0.6, "#e9c49a"], [1, "#f1d2a8"]]} />
      <Halo id="bgs" x={880} y={760} r={500} c="#fff1cf" o={0.6} />
      <Fleuve y={880} haut="#7f96b0" bas="#2e4058" refletX={880} reflet="#fff3d8" graine="bg" />
      <Coffre2 x={360 + prog(f, 0, d) * 600} y={1000} t={0.4} />
      <path d={`M0,1300 Q540,1180 1080,1260 L1080,1920 L0,1920 Z`} fill="#c99a63" />
      <path d={`M0,1360 Q540,1250 1080,1330 L1080,1920 L0,1920 Z`} fill="#b3844f" />
      {/* la mère reste en arrière, la sœur part */}
      <Fondu de={0} a={8}>
        <Silhouette x={150} y={1560} h={430} role="mere" c="#3a2a1a" liseré="#fff1cf" bras={f >= suis && f < suis + 30 ? 0.9 : 0.1} />
      </Fondu>
      {Array.from({ length: 12 }).map((_, k) => {
        const t0 = petite + k * 9;
        const x = 270 + k * 44;
        const y = 1640 - k * 14 + (k % 2) * 18;
        return <ellipse key={k} cx={x} cy={y} rx={9} ry={16} fill="#7a5530" opacity={interpolate(f, [t0, t0 + 6], [0, 0.8], clamp)} transform={`rotate(70 ${x} ${y})`} />;
      })}
      <Silhouette x={fx} y={1600 - marche * 150} h={300 - marche * 60} role="fille" c="#2e1f12" liseré="#fff1cf" marche={f >= petite} />
      <Roseaux x0={560} x1={1100} base={1700} h={520} c="#4b3b2a" n={30} graine="bgr" />
      <Palmier x={980} sol={1290} h={620} c="#4b3b2a" incl={-0.12} />
    </Cadre>
  );
};

// 7. Le coffre arrive au palais ; les serviteurs le recueillent ; Pharaon, de dos, le tient.
const PalaisAube: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const pharaon = quand(plan, "Pharaon", 0, 40);
  const recueillent = quand(plan, "recueillent", 0, 90);
  const mains = quand(plan, "mains", 0, 160);
  const arrive = interpolate(f, [0, pharaon + 10], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const leve = interpolate(f, [recueillent + 10, recueillent + 40], [0, 1], clamp);
  const gros = f >= mains - 4;
  if (gros) {
    return (
      <Cadre cles={[[mains - 4, 1.0, 0, 0], [mains + 80, 1.12, 0, -40]]}>
        <Ciel id="pag" stops={[[0, "#2a1408"], [1, "#120804"]]} />
        <Halo id="pagh" x={540} y={1180} r={700} c="#ffcf7a" o={0.55} />
        <Rayons x={540} y={1180} c="#fff0c0" o={0.12} />
        <Coffre2 x={540} y={1260} t={1.3} ouvert={interpolate(f, [mains, mains + 20], [0, 1], clamp)} flotte={false} />
        <Silhouette x={540} y={2050} h={900} role="pharaon" c="#050302" liseré="#ffcf7a" bras={0.55} />
        <Poussieres n={40} c="#ffe2a0" graine="pagp" />
      </Cadre>
    );
  }
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [recueillent, 1.18, -60, -160], [mains, 1.3, -80, -220]]}>
      <Ciel id="pa" stops={[[0, "#3c2a5c"], [0.55, "#e0875a"], [1, "#ffcf8a"]]} />
      <Halo id="pas" x={300} y={980} r={700} c="#fff0c0" o={0.7} />
      <circle cx={300} cy={980} r={110} fill="#fff4d8" />
      <Rayons x={300} y={980} c="#fff3c4" o={0.12} />
      <Palais base={1180} c="#2a1420" echelle={0.95} x={620} torches={false} />
      <rect x={380} y={1180} width={480} height={30} fill="#2a1420" />
      {[0, 1, 2].map((k) => <rect key={k} x={420 + k * 30} y={1210 + k * 24} width={420 - k * 60} height={24} fill="#3a1d2a" />)}
      <Fleuve y={1180} haut="#d08a6a" bas="#3a1f30" refletX={300} reflet="#fff0c8" graine="pa" />
      <Coffre2 x={140 + arrive * 430 + leve * 40} y={1420 - arrive * 110 - leve * 140} t={0.6} flotte={leve < 0.1} />
      {/* deux serviteurs descendent les marches et soulèvent le coffre */}
      {[0, 1].map((k) => {
        const desc = interpolate(f, [recueillent - 20, recueillent + 10], [0, 1], clamp);
        return (
          <Silhouette key={k} x={520 + k * 140 - desc * 20} y={1250 + desc * 60 - leve * 30} h={240} role="servante" c="#24101a" liseré="#ffd9a0" bras={leve > 0 ? 0.9 : 0.2} marche={desc > 0 && desc < 1} phase={k * 2} />
        );
      })}
      <Palmier x={70} sol={1190} h={640} c="#2a1420" incl={0.16} />
      <Poussieres n={30} c="#fff0c8" graine="pap" haut={400} bas={1200} />
    </Cadre>
  );
};

// 8. Dans le palais : la reine s'interpose ; les nourrices se succèdent ; la sœur s'avance.
const PalaisInterieur: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const femme = quand(plan, "femme", 0, 20);
  const tuez = quand(plan, "tuez", 0, 60);
  const amour = quand(plan, "amour", 0, 200);
  const refuse = quand(plan, "refuse", 0, 290);
  const n1 = quand(plan, "Une.", 0, refuse + 40);
  const n2 = quand(plan, "Après.", 0, n1 + 20);
  const n3 = quand(plan, "L'autre.", 0, n2 + 20);
  const fille = quand(plan, "fille", 0, n3 + 40);
  const phase2 = f >= refuse - 10;
  const reine = interpolate(f, [femme, femme + 25], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const lance = interpolate(f, [tuez + 5, tuez + 20], [-10, 55], clamp);
  const lueur = interpolate(f, [amour, amour + 25], [0.35, 1], clamp);
  const nourrice = (t0: number, k: number) => {
    const p = interpolate(f, [t0 - 12, t0, t0 + 12, t0 + 22], [0, 1, 1, 0], clamp);
    if (p <= 0) return null;
    return <Silhouette key={k} x={540 + (k - 1) * 30} y={1640} h={520} role="servante" c="#1a0c06" liseré="#ffcf8a" o={p} bras={0.6} />;
  };
  return (
    <Cadre cles={phase2 ? [[refuse - 10, 1.05, 0, -40], [fille, 1.1, 0, -60], [fille + 60, 1.2, -60, -100]] : [[0, 1.0, 0, 0], [tuez, 1.1, 40, -40], [amour + 30, 1.25, 0, -160]]}>
      <Ciel id="pi" stops={[[0, "#150a06"], [0.5, "#3a2010"], [1, "#1a0d06"]]} />
      <Halo id="pil" x={540} y={600} r={900} c="#ffcf8a" o={0.25} />
      {[0, 1, 2, 3].map((k) => {
        const s = 1 - k * 0.2;
        const ecart = 420 * s;
        const h = 1500 * s;
        const y0 = 980 - h / 2;
        const couleur = ["#4a2a14", "#5e3618", "#73451f", "#8a5627"][k];
        return (
          <g key={k}>
            {[-1, 1].map((cote) => (
              <g key={cote}>
                <rect x={540 + cote * ecart - 50 * s} y={y0} width={100 * s} height={h} fill={couleur} />
                <rect x={540 + cote * ecart - 70 * s} y={y0} width={140 * s} height={40 * s} fill={couleur} />
                <Flamme x={540 + cote * ecart} y={y0 + 420 * s} t={0.5 * s} graine={"pi" + k + cote} />
              </g>
            ))}
          </g>
        );
      })}
      {[-1, 1].map((c) => (
        <path key={c} d={`M${540 + c * 540},0 Q${540 + c * (330 + 20 * Math.sin(f / 30))},500 ${540 + c * 470},1100 L${540 + c * 540},1100 Z`} fill="#7a1f2a" opacity={0.75} />
      ))}
      <path d="M440,0 L640,0 L760,1500 L320,1500 Z" fill="#ffe2a8" opacity={0.12} />
      <Halo id="pic" x={540} y={1400} r={420 * lueur} c="#ffd98a" o={0.7 * lueur} />
      <path d="M440,1480 Q540,1560 640,1480 L630,1455 L450,1455 Z" fill="#8a5a2b" />
      <path d="M455,1455 Q540,1425 625,1455" fill="#f2e6cc" />
      <rect y={1560} width={W} height={400} fill="#120904" />
      {!phase2 ? (
        <>
          <Silhouette x={180} y={1900} h={760} role="pharaon" c="#070403" liseré="#ffc77a" />
          <Silhouette x={900} y={1900} h={700} role="soldat" c="#070403" liseré="#ffc77a" lance={lance} miroir />
          <Silhouette x={1200 - reine * 640} y={1880} h={640} role="reine" c="#0c0605" liseré="#ffd9a0" marche={reine > 0 && reine < 1} />
        </>
      ) : (
        <>
          {nourrice(n1, 0)}
          {nourrice(n2, 1)}
          {nourrice(n3, 2)}
          <Silhouette x={interpolate(f, [fille - 10, fille + 30], [1150, 760], clamp)} y={1720} h={330} role="fille" c="#0c0605" liseré="#ffe2a8" marche={f > fille - 10 && f < fille + 30} />
          <Silhouette x={200} y={1900} h={700} role="reine" c="#070403" liseré="#ffc77a" />
        </>
      )}
      <Poussieres n={50} c="#ffd79a" graine="pip" />
    </Cadre>
  );
};

// 9. Le cortège suit la petite jusqu'à la maison ; la porte s'ouvre sur la mère.
const Retour: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const mene = quand(plan, "mène", 0, 10);
  const mere = quand(plan, "mère", 0, 60);
  const leve = prog(f, 0, Math.min(d, 300));
  const soleilY = 1150 - leve * 380;
  const porte = interpolate(f, [mere, mere + 16], [0, 1], clamp);
  const marche = interpolate(f, [0, mere + 20], [0, 1], clamp);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [mere, 1.15, 0, -120], [mere + 120, 1.05, 0, -40], [d, 1.0, 0, 0]]}>
      <Ciel id="rt" stops={[[0, "#5a7fb8"], [0.55, "#f2b77a"], [1, "#ffd8a0"]]} />
      <Rayons x={540} y={soleilY} c="#fff6d0" o={0.16} />
      <Halo id="rts" x={540} y={soleilY} r={800} c="#fff1c4" o={0.75} />
      <circle cx={540} cy={soleilY} r={120} fill="#fff8e4" />
      {Array.from({ length: 7 }).map((_, k) => {
        const x = ((f * (2 + k * 0.3) + k * 140) % 1400) - 160;
        const y = 420 + k * 40 + Math.sin(f / 10 + k) * 10;
        const a = Math.sin(f / 4 + k) * 10;
        return <path key={k} d={`M${x - 22},${y - a} Q${x - 10},${y - 6} ${x},${y} Q${x + 10},${y - 6} ${x + 22},${y - a}`} stroke="#3b2a2a" strokeWidth={4} fill="none" />;
      })}
      <Fleuve y={1200} haut="#f0b27e" bas="#5a4a6a" refletX={540} reflet="#fff4d8" graine="rt" />
      <Palmier x={110} sol={1210} h={700} c="#3b2a2a" incl={0.16} />
      <Palmier x={970} sol={1210} h={560} c="#3b2a2a" incl={-0.14} phase={1.5} />
      <rect x={300} y={1260} width={480} height={400} fill="#5a3a2a" />
      <rect x={480} y={1440} width={120} height={220} fill="#2a1a12" />
      <Halo id="rtp" x={540} y={1560} r={300 * porte} c="#ffd28a" o={0.8 * porte} />
      <rect x={480} y={1440} width={120} height={220} fill="#ffdca0" opacity={porte} />
      {porte > 0.5 ? <Silhouette x={540} y={1660} h={200} role="mere" c="#3a2416" liseré="#fff1c8" bras={0.8} /> : null}
      <rect y={1660} width={W} height={300} fill="#3b2a2a" opacity={0.9} />
      {/* le cortège, de dos : la petite devant, deux servantes avec le berceau */}
      {f >= mene - 10
        ? [0, 1, 2].map((k) => {
            const y = 1960 - marche * 230 + k * 60;
            const h = (k === 0 ? 260 : 360) - marche * 80;
            return <Silhouette key={k} x={540 + (k === 0 ? 0 : k === 1 ? -110 : 110)} y={y} h={h} role={k === 0 ? "fille" : "servante"} c="#24160e" liseré="#fff1c8" marche={marche < 1} phase={k} bras={k === 0 ? 0 : 0.7} />;
          })
        : null}
      <Poussieres n={36} c="#fff4d0" graine="rtp" />
    </Cadre>
  );
};

const Calligraphie: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  return (
    <Travelling duree={d} de={1.0} a={1.08}>
      <Ciel id="cg" stops={[[0, "#060b1d"], [1, "#02040b"]]} />
      <g transform={`rotate(${f / 20} 540 900)`} opacity={0.16}>
        {Array.from({ length: 9 }).map((_, r) =>
          Array.from({ length: 6 }).map((__, c) => {
            const x = c * 220 - 60;
            const y = r * 220 - 30;
            const pts = (rot: number) =>
              Array.from({ length: 4 })
                .map((_, k) => {
                  const a = ((rot + 90 * k) * Math.PI) / 180;
                  return `${x + 92 * Math.cos(a)},${y + 92 * Math.sin(a)}`;
                })
                .join(" ");
            return (
              <g key={r + "-" + c}>
                <polygon points={pts(0)} fill="none" stroke="#F7C04A" strokeWidth={3} />
                <polygon points={pts(45)} fill="none" stroke="#F7C04A" strokeWidth={3} />
              </g>
            );
          }),
        )}
      </g>
      <Halo id="cgh" x={540} y={820} r={700 + 40 * Math.sin(f / 20)} c="#8a6420" o={0.45} />
      <Poussieres n={60} c="#F7C04A" graine="cgp" />
    </Travelling>
  );
};

export const ScenesAyati: Record<string, React.FC<SceneProps>> = {
  palais_nuit: PalaisNuit,
  village_nuit: VillageNuit,
  lampe: Lampe,
  calligraphie: Calligraphie,
  coffre_nuit: CoffreNuit,
  matin_vide: MatinVide,
  berge: Berge,
  palais_aube: PalaisAube,
  palais_interieur: PalaisInterieur,
  retour: Retour,
};
