/**
 * Ayati — Youssouf au puits (12:8-18), Younous (37:139-148), Souleymane et la fourmi (27:16-19),
 * la huppe et Saba (27:20-28). Aucun prophète montré (Youssouf, Yaqoub, Younous, Souleymane) ; les frères et le
 * peuple de Saba sont de petites silhouettes lointaines sans visage.
 *   yp_* · yn_* · sf_* · sh_*
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { Plan, SceneProps } from "./types";
import { clamp, H, norm, prog, ressort, rnd, W } from "./outils";
import { Brume, Cadre, Ciel, Etoiles, Fleuve, Halo, Maisons, Palais, Palmier, Poussieres, Rayons } from "./ayati";
import { Dunes } from "./madyan";
import { Silhouette } from "./personnages";

const OR = "#f5c25a";
const OR_PALE = "#ffe2a0";
const NUIT = "#0b0a10";

const dit = (plan: Plan, mot: string): number | null => {
  const c = norm(mot);
  const m = plan.mots.find((x) => norm(x.texte).startsWith(c));
  return m ? m.debut - plan.debut : null;
};

const PuitsDesert: React.FC<{ x: number; y: number; s: number }> = ({ x, y, s }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx={0} cy={0} rx={150} ry={42} fill="#2b2016" />
    <rect x={-150} y={-70} width={300} height={70} fill="#6c5a44" />
    <ellipse cx={0} cy={-70} rx={150} ry={42} fill="#867259" />
    <ellipse cx={0} cy={-70} rx={118} ry={30} fill="#050407" />
  </g>
);

const Loup: React.FC<{ x: number; y: number; s: number; o?: number }> = ({ x, y, s, o = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o} fill={NUIT}>
    <path d="M-90,0 L-80,-50 Q-40,-80 40,-70 L70,-100 L80,-70 L110,-60 L90,-40 L60,-40 L60,0 L45,0 L40,-30 L-50,-30 L-60,0 Z" />
    <path d="M-80,-50 Q-130,-60 -140,-20" stroke={NUIT} strokeWidth={14} fill="none" />
  </g>
);

const Tunique: React.FC<{ x: number; y: number; s: number; tache: number }> = ({ x, y, s, tache }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-60,-120 L-160,-60 L-120,0 L-70,-30 L-70,140 L70,140 L70,-30 L120,0 L160,-60 L60,-120 Q0,-90 -60,-120 Z" fill="#d8c8a8" />
    <ellipse cx={20} cy={40} rx={50 * tache} ry={34 * tache} fill="#7a1a14" opacity={0.85} />
  </g>
);

const GrandPoisson: React.FC<{ x: number; y: number; s: number; o?: number }> = ({ x, y, s, o = 1 }) => {
  const f = useCurrentFrame();
  return (
    <g transform={`translate(${x} ${y + Math.sin(f / 20) * 10}) scale(${s})`} opacity={o}>
      <ellipse cx={0} cy={0} rx={420} ry={150} fill="#0a1420" />
      <path d={`M380,0 L560,${-130 + Math.sin(f / 8) * 20} L560,${130 + Math.sin(f / 8) * 20} Z`} fill="#0a1420" />
      <path d="M-40,-140 L40,-260 L100,-140 Z" fill="#0a1420" />
    </g>
  );
};

const Fourmi: React.FC<{ x: number; y: number; s: number; phase?: number }> = ({ x, y, s, phase = 0 }) => {
  const f = useCurrentFrame();
  const p = Math.sin(f / 2 + phase) * 6;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#1a0e08">
      <circle cx={-26} cy={0} r={14} />
      <circle cx={0} cy={2} r={10} />
      <ellipse cx={30} cy={0} rx={20} ry={14} />
      {[-8, 0, 8].map((dx, i) => <path key={i} d={`M${dx},4 l${-10 + (i % 2 ? p : -p)},16 M${dx},4 l${10 + (i % 2 ? -p : p)},16`} stroke="#1a0e08" strokeWidth={3} />)}
      <path d="M-36,-8 l-10,-16 M-30,-10 l-2,-18" stroke="#1a0e08" strokeWidth={3} />
    </g>
  );
};

const Huppe: React.FC<{ x: number; y: number; s: number; vol?: boolean; r?: number }> = ({ x, y, s, vol = false, r = 0 }) => {
  const f = useCurrentFrame();
  const aile = vol ? Math.sin(f / 2.5) * 40 : 0;
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={70} ry={38} fill="#d89a5a" />
      <circle cx={-62} cy={-22} r={26} fill="#d89a5a" />
      <path d="M-70,-40 L-100,-90 L-80,-48 L-70,-100 L-60,-48 L-40,-92 L-48,-40 Z" fill="#e8a868" />
      {[-96, -76, -56].map((cx) => <circle key={cx} cx={cx + 6} cy={-92 + (cx === -76 ? -6 : 0)} r={5} fill="#1a1414" />)}
      <path d="M-86,-20 L-150,-6 L-86,-12 Z" fill="#2a2018" />
      <circle cx={-68} cy={-26} r={4} fill="#1a1414" />
      <g transform={`rotate(${-aile} 0 -10)`}>
        <path d="M-20,-10 L80,-60 L60,10 Z" fill="#1a1414" />
        {[0, 1, 2].map((i) => <rect key={i} x={10 + i * 22} y={-40 + i * 6} width={10} height={40} fill="#f0e8d8" transform={`rotate(-30 ${10 + i * 22} ${-40 + i * 6})`} />)}
      </g>
      <path d="M60,6 L120,20 L60,24 Z" fill="#1a1414" />
    </g>
  );
};

// =============================================================== Youssouf au fond du puits
const YpPuits: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const rap = dit(plan, "rappelleras") ?? dit(plan, "pleurant") ?? d * 0.85;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.25, 0, -40]]}>
      <Ciel id="ypp" stops={[[0, "#05060f"], [0.6, "#141634"], [1, "#3a2a40"]]} />
      <Etoiles n={120} bas={1100} graine="ypp" />
      <Dunes y={1200} c1="#1a1418" c2="#100c0e" />
      <PuitsDesert x={540} y={1420} s={1.6} />
      {/* une lumière douce au fond du puits : la révélation */}
      <Halo id="ypph" x={540} y={1310} r={180} c="#fff1c8" o={0.6 * prog(f, rap - 10, rap + 30)} />
    </Cadre>
  );
};

const YpJalousie: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.12, 0, -30]]}>
      <Ciel id="ypj" stops={[[0, "#1a1a3a"], [0.6, "#7a4a4a"], [1, "#d08a5a"]]} />
      <Dunes y={1250} c1="#3a2418" c2="#24160e" />
      {/* les frères, petits et lointains, en cercle */}
      {Array.from({ length: 10 }).map((_, i) => (
        <Silhouette key={i} x={300 + i * 52} y={1330 + (i % 2) * 14} h={150} role="vieil" c={NUIT} liseré="#d08a5a" phase={i} miroir={i > 4} />
      ))}
      <rect width={W} height={H} fill="#3a0000" opacity={0.12 + 0.08 * Math.sin(f / 15)} />
    </Cadre>
  );
};

const YpPere: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const loup = dit(plan, "loup") ?? d * 0.85;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -20]]}>
      <Ciel id="ypr" stops={[[0, "#1a1a3a"], [0.6, "#6a4a5a"], [1, "#d09a6a"]]} />
      <Palmier x={140} sol={1350} h={400} c="#140c10" />
      <path d="M340,1350 L340,1050 L740,1050 L740,1350 Z" fill="#1a1014" />
      <rect x={500} y={1180} width={80} height={170} rx={30} fill="#ffc46e" opacity={0.85} />
      <rect x={0} y={1350} width={W} height={H - 1350} fill="#140c10" />
      <Loup x={880} y={1060} s={0.9} o={prog(f, loup - 15, loup + 5)} />
    </Cadre>
  );
};

const YpTunique: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const faux = dit(plan, "faux") ?? d * 0.8;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.15, 0, 40]]}>
      <Ciel id="ypt" stops={[[0, "#1a1a3a"], [0.6, "#5a3a4a"], [1, "#a06a5a"]]} />
      <rect x={0} y={1250} width={W} height={H - 1250} fill="#2a1a14" />
      <Tunique x={540} y={1050} s={1.6} tache={prog(f, faux - 10, faux + 10)} />
    </Cadre>
  );
};

const YpPatience: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const pat = dit(plan, "patience") ?? d * 0.5;
  const p = prog(f, pat - 10, pat + 40);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -30]]}>
      <Ciel id="ypa" stops={[[0, "#05060f"], [0.6, "#1a1838"], [1, "#3a2a48"]]} />
      <Etoiles n={160} bas={1200} graine="ypa" />
      <Rayons x={540} y={-120} c="#fff1c8" o={0.05 + 0.12 * p} />
      <path d="M340,1450 L340,1150 L740,1150 L740,1450 Z" fill="#0e0a10" />
      <rect x={500} y={1280} width={80} height={170} rx={30} fill="#ffc46e" opacity={0.7} />
      <rect x={0} y={1450} width={W} height={H - 1450} fill="#0e0a10" />
      <Halo id="ypah" x={540} y={500} r={300 + 200 * p} c="#fff1c8" o={0.2 + 0.4 * p} />
    </Cadre>
  );
};

const YpLecon: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const pal = dit(plan, "palais") ?? d * 0.8;
  const p = prog(f, d * 0.3, pal);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.05, 0, 0]]}>
      <Ciel id="ypl" stops={[[0, "#1a1a3a"], [0.6, "#8a6a6a"], [1, "#f0c890"]]} />
      <Dunes y={1250} c1="#5a3a24" c2="#3a2418" />
      <PuitsDesert x={220} y={1400} s={0.8} />
      <g transform="translate(320 0)"><Palais base={1300} c="#3a2418" echelle={0.45} x={540} torches={false} /></g>
      <path d={`M260,1380 Q540,1250 820,1300`} stroke={OR_PALE} strokeWidth={10} fill="none" strokeDasharray="20 18" strokeDashoffset={-f} opacity={p} />
      <Halo id="yplh" x={860} y={1150} r={300} c="#fff1c8" o={0.6 * prog(f, pal - 10, pal + 20)} />
    </Cadre>
  );
};

// =============================================================== Younous
const YnVentre: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const glo = dit(plan, "glorifient") ?? d * 0.3;
  const p = prog(f, glo - 20, glo + 30);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, 30]]}>
      <rect width={W} height={H} fill="#03070e" />
      {Array.from({ length: 30 }).map((_, i) => (
        <circle key={i} cx={rnd("ynv" + i) * W} cy={(rnd("ynvy" + i) * H - f * (0.6 + rnd("ynvs" + i))) % H + (f * (0.6 + rnd("ynvs" + i)) > rnd("ynvy" + i) * H ? H : 0)} r={3 + rnd("ynvr" + i) * 5} fill="#3a6a8a" opacity={0.4} />
      ))}
      <GrandPoisson x={540} y={1000} s={1.3} />
      {/* une petite lumière : la glorification */}
      <Halo id="ynvh" x={420} y={1000} r={120 + 120 * p} c="#fff1c8" o={0.15 + 0.6 * p} />
    </Cadre>
  );
};

const Bateau: React.FC<{ x: number; y: number; s: number; rot?: number }> = ({ x, y, s, rot = 0 }) => {
  const f = useCurrentFrame();
  return (
    <g transform={`translate(${x} ${y + Math.sin(f / 15) * 8}) rotate(${rot + Math.sin(f / 20) * 3}) scale(${s})`}>
      <rect x={-6} y={-330} width={12} height={330} fill="#2a1a10" />
      <path d="M6,-320 Q160,-200 10,-60 Z" fill="#c8bca0" />
      {Array.from({ length: 9 }).map((_, i) => <rect key={i} x={-230 + i * 50} y={-90 - (i % 3) * 14} width={36} height={60 + (i % 3) * 14} rx={8} fill="#1a1210" />)}
      <path d="M-260,-40 L260,-40 L200,60 L-200,60 Z" fill="#4a3020" />
    </g>
  );
};

const YnBateau: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -20]]}>
      <Ciel id="ynb" stops={[[0, "#2a3a5a"], [0.6, "#a08a8a"], [1, "#e8c0a0"]]} />
      <Fleuve y={1150} haut="#1c3a5a" bas="#0a1626" graine="ynb" />
      <Bateau x={interpolate(f, [0, d], [400, 620], clamp)} y={1180} s={1.0} />
    </Cadre>
  );
};

const YnTirage: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const mer = dit(plan, "mer") ?? d * 0.85;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.15, 0, 20]]}>
      <Ciel id="ynt" stops={[[0, "#0a0c14"], [0.6, "#2a2a3a"], [1, "#4a4a5a"]]} />
      <Fleuve y={1150} haut="#14243a" bas="#060a14" graine="ynt" vitesse={2} />
      <Bateau x={540} y={1180} s={1.0} rot={Math.sin(f / 9) * 7} />
      <Halo id="ynth" x={300} y={1260} r={200} c="#d8f0ff" o={interpolate(f, [mer, mer + 4, mer + 25], [0, 0.8, 0], clamp)} />
      <Brume y={1100} c="#2a2a3a" o={0.4} graine="yntb" />
    </Cadre>
  );
};

const YnPoisson: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.2, 0, 40]]}>
      <rect width={W} height={H} fill="#06101c" />
      <Rayons x={540} y={-100} c="#6a9ac0" o={0.12} />
      <GrandPoisson x={interpolate(f, [0, d], [900, 500], clamp)} y={1050} s={1.2} />
    </Cadre>
  );
};

const YnPlage: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const courge = dit(plan, "courge") ?? d * 0.75;
  const pousse = prog(f, courge - 30, courge + 30);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -20]]}>
      <Ciel id="ynp" stops={[[0, "#3a5a8a"], [0.6, "#e0b8a0"], [1, "#f8e0b8"]]} />
      <Fleuve y={1050} haut="#3a7aa0" bas="#1a4a6a" graine="ynp" />
      <path d={`M0,1300 Q540,1180 ${W},1300 L${W},${H} L0,${H} Z`} fill="#d8b888" />
      {/* la plante de courge pousse et fait de l'ombre */}
      <path d={`M540,1320 Q520,${1320 - 260 * pousse} 560,${1320 - 400 * pousse}`} stroke="#3a7a3a" strokeWidth={14} fill="none" />
      {Array.from({ length: 6 }).map((_, i) => (
        <ellipse key={i} cx={540 + (i % 2 ? 90 : -90) * pousse} cy={1320 - (100 + i * 55) * pousse} rx={90 * prog(f, courge - 20 + i * 6, courge + i * 6 + 10)} ry={50 * prog(f, courge - 20 + i * 6, courge + i * 6 + 10)} fill="#4a9a4a" />
      ))}
    </Cadre>
  );
};

const YnPeuple: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const cr = dit(plan, "croient") ?? d * 0.7;
  const n = Math.floor(interpolate(f, [0, cr + 20], [0, 12], clamp));
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.08, 0, -20]]}>
      <Ciel id="ynu" stops={[[0, "#05060f"], [0.6, "#1a1838"], [1, "#4a3048"]]} />
      <Etoiles n={100} bas={1000} graine="ynu" />
      <Maisons sol={1350} c="#0e0a10" graine="ynu" fenetres={Array.from({ length: n }).map((_, i) => i)} />
      <rect x={0} y={1350} width={W} height={H - 1350} fill="#0e0a10" />
      <Halo id="ynuh" x={540} y={1200} r={600} c="#ffd8a0" o={0.4 * prog(f, cr, cr + 30)} />
    </Cadre>
  );
};

const YnLecon: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const sy = interpolate(f, [0, d], [1250, 950], clamp);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.08, 0, -20]]}>
      <Ciel id="ynl" stops={[[0, "#2a3a6a"], [0.6, "#e0a080"], [1, "#f8d8a0"]]} />
      <circle cx={540} cy={sy} r={110} fill="#fff4d0" />
      <Halo id="ynlh" x={540} y={sy} r={500} c="#fff1c8" o={0.6} />
      <Fleuve y={1250} haut="#4a6a9a" bas="#1a2a4a" graine="ynl" refletX={540} />
    </Cadre>
  );
};

// =============================================================== Souleymane et la fourmi
const Fourmiliere: React.FC<{ x: number; y: number; s: number }> = ({ x, y, s }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-160,0 Q0,-150 160,0 Z" fill="#8a6a4a" />
    <ellipse cx={0} cy={-30} rx={26} ry={16} fill="#1a0e08" />
  </g>
);

const SfFourmi: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const ombre = interpolate(f, [0, d], [0, 0.5], clamp);
  return (
    <Cadre cles={[[0, 1.1, 0, 30], [d, 1.0, 0, 0]]}>
      <Ciel id="sff" stops={[[0, "#8ab0d0"], [0.6, "#e8d8b0"], [1, "#f0e0c0"]]} />
      <rect x={0} y={900} width={W} height={H - 900} fill="#c8a878" />
      <Fourmiliere x={540} y={1330} s={2} />
      {Array.from({ length: 9 }).map((_, i) => (
        <Fourmi key={i} x={interpolate(f, [0, d], [100 + i * 100, 540 + (i - 4) * 20], clamp)} y={1380 + (i % 3) * 30} s={1.4} phase={i} />
      ))}
      <rect width={W} height={H} fill="#000" opacity={ombre} />
    </Cadre>
  );
};

const SfRoyaume: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -30]]}>
      <Ciel id="sfr" stops={[[0, "#3a5a9a"], [0.6, "#d0b0a0"], [1, "#f0d8b0"]]} />
      <Palais base={1300} c="#4a3020" echelle={0.85} torches={false} />
      <rect x={0} y={1300} width={W} height={H - 1300} fill="#5a3a24" />
      {Array.from({ length: 7 }).map((_, i) => {
        const x = ((f * 4 + i * 170) % 1300) - 100;
        const y = 500 + Math.sin(f / 10 + i) * 30 + i * 30;
        return <path key={i} d={`M${x - 30},${y} q15,${-14 + Math.sin(f / 3 + i) * 10} 30,0 q15,${-14 + Math.sin(f / 3 + i) * 10} 30,0`} stroke="#1a1414" strokeWidth={5} fill="none" />;
      })}
    </Cadre>
  );
};

const SfArmee: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.08, 0, 0]]}>
      <Ciel id="sfa" stops={[[0, "#3a4a7a"], [0.6, "#c0a090"], [1, "#e8c8a0"]]} />
      <rect x={0} y={1150} width={W} height={H - 1150} fill="#8a6a4a" />
      {/* les rangs, tout petits à l'horizon */}
      {Array.from({ length: 4 }).map((_, r) =>
        Array.from({ length: 30 }).map((__, i) => (
          <rect key={`${r}-${i}`} x={60 + i * 32 + (r % 2) * 16} y={1130 + r * 22 - (Math.sin(f / 6 + i) > 0.9 ? 2 : 0)} width={10} height={22} rx={4} fill={r === 3 ? "#2a1a14" : "#3a2a20"} />
        )),
      )}
      {Array.from({ length: 14 }).map((_, i) => (
        <path key={i} d={`M${100 + i * 65},${800 + (i % 3) * 40} q10,-10 20,0 q10,-10 20,0`} stroke="#1a1414" strokeWidth={4} fill="none" />
      ))}
      <Poussieres n={40} c="#e8c8a0" graine="sfap" haut={1000} bas={1300} />
    </Cadre>
  );
};

const SfVallee: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const rentrez = dit(plan, "Rentrez") ?? d * 0.5;
  const course = prog(f, rentrez, rentrez + 40);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [rentrez, 1.15, 0, 40], [d, 1.2, 0, 60]]}>
      <Ciel id="sfv" stops={[[0, "#8ab0d0"], [0.6, "#e8d8b0"], [1, "#f0e0c0"]]} />
      <path d={`M0,900 Q540,1150 ${W},900 L${W},${H} L0,${H} Z`} fill="#b89868" />
      <Fourmiliere x={300} y={1380} s={1.4} />
      <Fourmiliere x={780} y={1420} s={1.6} />
      {Array.from({ length: 14 }).map((_, i) => {
        const cible = i % 2 ? 780 : 300;
        const x0 = 100 + i * 65;
        return <Fourmi key={i} x={interpolate(course, [0, 1], [x0, cible])} y={1450 + (i % 4) * 26} s={1.1} phase={i} />;
      })}
      <Halo id="sfvh" x={540} y={1200} r={300} c="#fff8e0" o={0.3} />
    </Cadre>
  );
};

const SfSourire: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const s = dit(plan, "sourit") ?? d * 0.2;
  const p = prog(f, s - 10, s + 40);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -30]]}>
      <Ciel id="sfs" stops={[[0, "#5a8ac0"], [0.6, "#f0d8b0"], [1, "#fff0c8"]]} />
      <Rayons x={540} y={-120} c="#fff4d0" o={0.1 + 0.2 * p} />
      <path d={`M0,1000 Q540,1250 ${W},1000 L${W},${H} L0,${H} Z`} fill="#c8a878" />
      <Halo id="sfsh" x={540} y={1300} r={400 + 300 * p} c="#fff1c8" o={0.3 + 0.4 * p} />
      <Fourmiliere x={540} y={1450} s={1.2} />
    </Cadre>
  );
};

const SfDoua: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const mis = dit(plan, "miséricorde") ?? d * 0.75;
  const p = prog(f, mis - 20, mis + 30);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -40]]}>
      <Ciel id="sfd" stops={[[0, "#05060f"], [0.6, "#1a1838"], [1, "#4a3a58"]]} />
      <Etoiles n={200} bas={1300} graine="sfd" />
      <Rayons x={540} y={-120} c="#fff1c8" o={0.06 + 0.14 * p} />
      <Halo id="sfdh" x={540} y={400} r={300 + 300 * p} c="#fff1c8" o={0.2 + 0.4 * p} />
      <Dunes y={1450} c1="#14101a" c2="#0a080e" />
    </Cadre>
  );
};

const SfLecon: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  return (
    <Cadre cles={[[0, 1.2, 0, 60], [d, 1.0, 0, 0]]}>
      <Ciel id="sfl" stops={[[0, "#5a8ac0"], [0.6, "#f0d8b0"], [1, "#fff0c8"]]} />
      <path d="M200,1250 Q540,1080 880,1250 Q540,1200 200,1250 Z" fill="#4a9a4a" />
      <Fourmi x={540} y={1180} s={3} />
      <Halo id="sflh" x={540} y={1160} r={300} c="#fff1c8" o={0.5 + 0.1 * Math.sin(f / 10)} />
      <Poussieres n={25} c={OR_PALE} graine="sflp" haut={700} bas={1400} />
    </Cadre>
  );
};

// =============================================================== La huppe et Saba
const ShVol: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const x = interpolate(f, [0, d], [1150, -100], clamp);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.08, 0, -20]]}>
      <Ciel id="shv" stops={[[0, "#3a6aa0"], [0.6, "#e0c0a0"], [1, "#f8e0b8"]]} />
      <Dunes y={1300} c1="#c8a070" c2="#a88050" />
      <Huppe x={x} y={800 + Math.sin(f / 8) * 30} s={1.4} vol />
    </Cadre>
  );
};

const ShRevue: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const hup = dit(plan, "huppe") ?? d * 0.6;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [hup, 1.1, 120, 0], [d, 1.15, 120, 0]]}>
      <Ciel id="shr" stops={[[0, "#3a5a9a"], [0.6, "#d0b0a0"], [1, "#f0d8b0"]]} />
      <path d="M0,1000 L1080,960" stroke="#3a2418" strokeWidth={22} />
      {Array.from({ length: 9 }).map((_, i) => {
        if (i === 2) return <circle key={i} cx={100 + i * 110} cy={930 - i * 4} r={30} fill="none" stroke={OR_PALE} strokeWidth={4} strokeDasharray="10 8" opacity={prog(f, hup - 10, hup + 10)} />;
        return (
          <g key={i} transform={`translate(${100 + i * 110} ${960 - i * 4})`}>
            <ellipse cx={0} cy={-30} rx={30} ry={22} fill="#2a2420" />
            <circle cx={-22} cy={-48} r={14} fill="#2a2420" />
          </g>
        );
      })}
    </Cadre>
  );
};

const ShSaba: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const tr = dit(plan, "trône") ?? d * 0.85;
  const p = prog(f, tr - 15, tr + 20);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [tr, 1.1, 0, 0], [d, 1.25, 0, 40]]}>
      <Ciel id="shs" stops={[[0, "#3a3a6a"], [0.6, "#c09080"], [1, "#f0c890"]]} />
      <Palais base={1300} c="#5a3a24" echelle={0.9} />
      <rect x={0} y={1300} width={W} height={H - 1300} fill="#5a3a24" />
      {/* le trône, vide, immense et doré */}
      <g transform={`translate(540 1300) scale(${0.6 + 0.4 * p})`} opacity={0.2 + 0.8 * p}>
        <rect x={-110} y={-340} width={220} height={260} rx={30} fill={OR} />
        <rect x={-150} y={-100} width={300} height={100} rx={20} fill={OR} />
        <circle cx={0} cy={-280} r={30} fill="#fff4d0" />
      </g>
      <Halo id="shsh" x={540} y={1100} r={400} c={OR} o={0.5 * p} />
    </Cadre>
  );
};

const ShSoleil: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.08, 0, -20]]}>
      <Ciel id="sho" stops={[[0, "#c06a3a"], [0.6, "#f0b070"], [1, "#f8d8a0"]]} />
      <circle cx={540} cy={760} r={170} fill="#fff4d0" />
      <Halo id="shoh" x={540} y={760} r={600} c="#ffd8a0" o={0.7} />
      <rect x={0} y={1350} width={W} height={H - 1350} fill="#6a4024" />
      {/* un peuple minuscule, prosterné, au loin */}
      {Array.from({ length: 12 }).map((_, i) => (
        <ellipse key={i} cx={150 + i * 70} cy={1350} rx={20} ry={12 + Math.sin(f / 20 + i) * 1} fill="#2a1810" />
      ))}
    </Cadre>
  );
};

const ShLettre: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const let_ = dit(plan, "lettre") ?? d * 0.5;
  const vol = prog(f, let_, d);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -30]]}>
      <Ciel id="shl" stops={[[0, "#2a3a6a"], [0.6, "#c0a0a0"], [1, "#f0c890"]]} />
      <Dunes y={1300} c1="#a88050" c2="#886038" />
      <g transform={`translate(${interpolate(vol, [0, 1], [300, 1100])} ${900 - vol * 200})`}>
        <Huppe x={0} y={0} s={1.2} vol={vol > 0} r={-8} />
        <g transform="translate(-40 60) rotate(-10)">
          <rect x={-40} y={-26} width={80} height={52} rx={6} fill="#f0e8d0" />
          <path d="M-40,-26 L0,6 L40,-26" stroke="#b0a080" strokeWidth={3} fill="none" />
        </g>
      </g>
    </Cadre>
  );
};

const ShLecon: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  return (
    <Cadre cles={[[0, 1.15, 0, 40], [d, 1.0, 0, 0]]}>
      <Ciel id="shn" stops={[[0, "#1a1a3a"], [0.6, "#c08a6a"], [1, "#f8d0a0"]]} />
      <path d="M100,1150 Q540,1100 980,1180" stroke="#3a2418" strokeWidth={20} fill="none" />
      <Huppe x={540} y={1090} s={1.6} />
      <Halo id="shnh" x={540} y={1050} r={360} c="#fff1c8" o={0.5 + 0.1 * Math.sin(f / 10)} />
      <Poussieres n={25} c={OR_PALE} graine="shnp" haut={700} bas={1400} />
    </Cadre>
  );
};

export const ScenesRecits2: Record<string, React.FC<SceneProps>> = {
  yp_puits: YpPuits,
  yp_jalousie: YpJalousie,
  yp_pere: YpPere,
  yp_tunique: YpTunique,
  yp_patience: YpPatience,
  yp_lecon: YpLecon,
  yn_ventre: YnVentre,
  yn_bateau: YnBateau,
  yn_tirage: YnTirage,
  yn_poisson: YnPoisson,
  yn_plage: YnPlage,
  yn_peuple: YnPeuple,
  yn_lecon: YnLecon,
  sf_fourmi: SfFourmi,
  sf_royaume: SfRoyaume,
  sf_armee: SfArmee,
  sf_vallee: SfVallee,
  sf_sourire: SfSourire,
  sf_doua: SfDoua,
  sf_lecon: SfLecon,
  sh_vol: ShVol,
  sh_revue: ShRevue,
  sh_saba: ShSaba,
  sh_soleil: ShSoleil,
  sh_lettre: ShLettre,
  sh_lecon: ShLecon,
};
