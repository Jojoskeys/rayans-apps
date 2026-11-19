/**
 * Ayati — deux récits de la sourate Al-Qasas : le puits de Madyan (28:21-28) et le feu sur le Mont (28:29-32).
 * Aucun prophète représenté : Moussa n'apparaît jamais, seulement ses traces de pas, la lumière et les lieux.
 * Les deux femmes du puits ne sont pas montrées non plus : on voit leur troupeau tenu à l'écart.
 */
import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import type { SceneProps } from "./types";
import { clamp, H, prog, quand, ressort, rnd, W } from "./outils";
import { Brume, Cadre, Ciel, Etoiles, Flamme, Halo, Palais, Palmier, Poussieres, Rayons } from "./ayati";
import { Silhouette } from "./personnages";

const OR = "#f5c25a";
const OR_PALE = "#ffe2a0";
const SABLE = "#3a2616";
const NUIT = "#0b0a10";

export const Dunes: React.FC<{ y: number; c1: string; c2: string }> = ({ y, c1, c2 }) => (
  <g>
    <path d={`M0,${y} Q270,${y - 120} 540,${y - 30} T${W},${y - 60} L${W},${H} L0,${H} Z`} fill={c1} />
    <path d={`M0,${y + 160} Q360,${y + 40} 700,${y + 150} T${W},${y + 120} L${W},${H} L0,${H} Z`} fill={c2} />
  </g>
);

/** Traces de pas qui avancent (on ne voit jamais celui qui marche). */
export const Pas: React.FC<{ de: [number, number]; a: [number, number]; p: number; n?: number; c?: string; s?: number }> = ({ de, a, p, n = 12, c = OR_PALE, s = 1 }) => (
  <g>
    {Array.from({ length: n }).map((_, i) => {
      const t = i / (n - 1);
      if (t > p) return null;
      const x = de[0] + (a[0] - de[0]) * t + (i % 2 ? 16 : -16) * s * (1 - t * 0.6);
      const y = de[1] + (a[1] - de[1]) * t;
      const k = s * (1 - t * 0.6);
      return <ellipse key={i} cx={x} cy={y} rx={11 * k} ry={20 * k} fill={c} opacity={0.75 * (0.5 + 0.5 * (1 - (p - t)))} />;
    })}
  </g>
);

const Mouton: React.FC<{ x: number; y: number; s?: number; phase?: number; boit?: boolean; c?: string }> = ({ x, y, s = 1, phase = 0, boit, c = "#e9dcc4" }) => {
  const f = useCurrentFrame();
  const tete = boit ? 18 + Math.sin(f / 8 + phase) * 4 : Math.sin(f / 20 + phase) * 4;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-34} y={0} width={9} height={36} fill="#3a2a20" />
      <rect x={22} y={0} width={9} height={36} fill="#3a2a20" />
      <ellipse cx={0} cy={-6} rx={56} ry={38} fill={c} />
      {[-30, -8, 14, 34].map((dx, i) => <circle key={i} cx={dx} cy={-34} r={18} fill={c} />)}
      <ellipse cx={-62} cy={-10 + tete} rx={20} ry={15} fill="#3a2a20" />
    </g>
  );
};

const Puits: React.FC<{ x: number; y: number; s?: number; seau?: number }> = ({ x, y, s = 1, seau = 0 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x={-120} y={-200} width={14} height={200} fill="#5a3a20" />
    <rect x={106} y={-200} width={14} height={200} fill="#5a3a20" />
    <rect x={-130} y={-212} width={260} height={16} rx={6} fill="#6b4a2a" />
    <line x1={0} y1={-200} x2={0} y2={-120 + seau * 60} stroke="#c9b08a" strokeWidth={4} />
    <rect x={-22} y={-120 + seau * 60} width={44} height={36} rx={6} fill="#7a5530" />
    <ellipse cx={0} cy={0} rx={150} ry={42} fill="#2b2016" />
    <rect x={-150} y={-60} width={300} height={60} fill="#7c6a54" />
    <ellipse cx={0} cy={-60} rx={150} ry={42} fill="#968269" />
    <ellipse cx={0} cy={-60} rx={118} ry={30} fill="#0f1a24" />
  </g>
);

export const Arbre: React.FC<{ x: number; sol: number; s?: number; c?: string; feu?: number }> = ({ x, sol, s = 1, c = "#1a1410", feu = 0 }) => {
  const f = useCurrentFrame();
  return (
    <g transform={`translate(${x} ${sol}) scale(${s})`}>
      <path d="M-18,0 C-14,-80 -26,-150 -8,-230 L8,-230 C22,-150 14,-80 18,0 Z" fill={c} />
      <path d="M-6,-170 C-60,-210 -110,-220 -150,-250" stroke={c} strokeWidth={16} fill="none" />
      <path d="M4,-190 C60,-230 100,-240 150,-270" stroke={c} strokeWidth={16} fill="none" />
      {[[-150, -270, 90], [-60, -300, 110], [40, -320, 120], [140, -290, 95], [0, -360, 100]].map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy + Math.sin(f / 30 + i) * 3} r={r} fill={feu > 0 ? `rgba(255,${200 - feu * 60},${120 - feu * 80},${0.25 + feu * 0.35})` : c} />
      ))}
    </g>
  );
};

export const Mont: React.FC<{ y: number; c: string; lisere?: string }> = ({ y, c, lisere = "#6b4a3a" }) => (
  <g>
    <path d={`M-100,${y} L260,${y - 520} L380,${y - 440} L560,${y - 760} L760,${y - 420} L1180,${y} Z`} fill={c} />
    <path d={`M260,${y - 520} L380,${y - 440} L560,${y - 760} L760,${y - 420}`} stroke={lisere} strokeWidth={5} fill="none" opacity={0.6} />
  </g>
);

export const Lumiere: React.FC<{ x: number; y: number; r: number; o: number; id: string; c?: string }> = ({ x, y, r, o, id, c = "#fff6d8" }) => (
  <g>
    <Halo id={id} x={x} y={y} r={r} c={c} o={o} />
    <circle cx={x} cy={y} r={r * 0.12} fill="#fffdf2" opacity={o} />
  </g>
);

// =============================================================== Le puits de Madyan
const Desert: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const madyan = quand(plan, "Madyan", 0, d * 0.4);
  const droite = quand(plan, "droite", 0, d * 0.9);
  const p = interpolate(f, [0, d], [0.1, 1], clamp);
  return (
    <Cadre cles={[[0, 1.08, 0, 30], [d, 1.0, 0, 0]]}>
      <Ciel id="mdd" stops={[[0, "#0a0c1c"], [0.55, "#2a2140"], [1, "#6a3e3a"]]} />
      <Etoiles n={90} bas={1000} graine="mdd" />
      {/* une étoile plus brillante, comme un repère sur la route */}
      <circle cx={760} cy={430} r={10 + Math.sin(f / 10) * 2} fill="#fff" opacity={0.9} />
      <Halo id="mdds" x={760} y={430} r={140} c="#fff4d0" o={0.4 + prog(f, droite - 10, droite + 10) * 0.4} />
      <Dunes y={1250} c1="#2a1c14" c2="#1a110b" />
      <Pas de={[300, 1880]} a={[700, 1240]} p={p} n={14} s={1.4} />
      {f > madyan - 6 ? (
        <text x={720} y={1180} textAnchor="middle" fontFamily="Montserrat" fontWeight={800} fontSize={48} fill={OR_PALE} opacity={ressort(f, madyan) * 0.85}>Madyan</text>
      ) : null}
      <Poussieres n={30} c={OR_PALE} graine="mddp" haut={900} bas={1700} />
    </Cadre>
  );
};

const PuitsScene: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const ecart = quand(plan, "écart", 0, d * 0.4);
  const abreuve = quand(plan, "abreuve", 0, d * 2);
  const ombre = quand(plan, "ombre", 0, d * 2);
  const seau = abreuve < d ? Math.abs(Math.sin((f - abreuve) / 14)) * prog(f, abreuve, abreuve + 10) : 0;
  const vient = abreuve < d ? prog(f, abreuve + 10, abreuve + 60) : 0;
  const bergers = 1 - (ombre < d ? prog(f, ombre - 30, ombre) : 0);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.08, -30, 20]]}>
      <Ciel id="mdp" stops={[[0, "#3b5a7a"], [0.5, "#d49a62"], [1, "#f2c48d"]]} />
      <Halo id="mdps" x={860} y={520} r={420} c="#fff1c8" o={0.6} />
      <rect x={0} y={1180} width={W} height={H - 1180} fill="#b3824e" />
      <rect x={0} y={1180} width={W} height={30} fill="#9c6c3e" />
      <Palmier x={110} sol={1200} h={520} c="#4a3420" />
      <Puits x={400} y={1420} s={1.1} seau={seau} />
      {/* la foule des bergers et leurs bêtes, autour du puits */}
      {Array.from({ length: 5 }).map((_, i) => (
        <Silhouette key={i} x={150 + i * 120} y={1300 + (i % 2) * 40} h={260} role="vieil" c="#2a1a10" liseré="#ffd9a0" phase={i} o={bergers} />
      ))}
      {Array.from({ length: 4 }).map((_, i) => (
        <Mouton key={"g" + i} x={200 + i * 130} y={1560 + (i % 2) * 30} s={0.9} phase={i} boit c="#d9c8a8" />
      ))}
      {/* à l'écart : un petit troupeau qu'on retient, qui attend */}
      <g opacity={ressort(f, ecart - 10)}>
        <rect x={720} y={1520} width={320} height={10} fill="#6b4a2a" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Mouton key={"e" + i} x={interpolate(vient, [0, 1], [800 + i * 90, 560 + i * 90])} y={1490 + (i % 2) * 20} s={0.8} phase={i + 5} boit={vient > 0.9} />
        ))}
      </g>
      <Poussieres n={25} c="#fff1c8" graine="mdpp" haut={700} bas={1500} />
    </Cadre>
  );
};

const Ombre: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const descend = prog(f, 0, d, Easing.inOut(Easing.cubic));
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -40]]}>
      <Ciel id="mdo" stops={[[0, "#2c3e5c"], [0.55, "#c98a58"], [1, "#e8b47a"]]} />
      <rect x={0} y={1200} width={W} height={H - 1200} fill="#a8783f" />
      {/* l'ombre de l'arbre, vide : il s'y est assis, on ne le voit pas */}
      <ellipse cx={560} cy={1330} rx={380} ry={70} fill="#5a3b1a" opacity={0.55} />
      <Arbre x={560} sol={1300} s={1.5} c="#3a2614" />
      {/* le bien qui descend du ciel, doucement */}
      <Rayons x={560} y={-100} c="#fff4d8" o={0.15 + descend * 0.35} />
      {Array.from({ length: 18 }).map((_, i) => {
        const x = 300 + rnd("mdo" + i) * 520;
        const y = interpolate((f / 120 + rnd("mdoy" + i)) % 1, [0, 1], [200, 1300]);
        return <circle key={i} cx={x} cy={y} r={4 + rnd("mdor" + i) * 4} fill="#fff8e0" opacity={0.3 + descend * 0.6} />;
      })}
    </Cadre>
  );
};

const Reponse: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const pudique = quand(plan, "pudique", 0, d * 0.5);
  const appelle = quand(plan, "appelle", 0, d * 0.75);
  const p = prog(f, pudique - 30, appelle, Easing.out(Easing.quad));
  return (
    <Cadre cles={[[0, 1.05, 0, 0], [d, 1.0, 0, 0]]}>
      <Ciel id="mdr" stops={[[0, "#2c3e5c"], [0.55, "#c98a58"], [1, "#e8b47a"]]} />
      <rect x={0} y={1200} width={W} height={H - 1200} fill="#a8783f" />
      {/* au loin, la maison du vieil homme */}
      <g transform="translate(860 1200)">
        <rect x={-110} y={-150} width={220} height={150} fill="#6b4a2a" />
        <path d="M-130,-150 L0,-230 L130,-150 Z" fill="#4a3018" />
        <rect x={-25} y={-80} width={50} height={80} fill="#ffcf80" opacity={0.4 + prog(f, appelle, appelle + 20) * 0.6} />
      </g>
      {/* des pas qui reviennent de la maison vers l'arbre, lents et réguliers */}
      <Pas de={[840, 1220]} a={[420, 1700]} p={p} n={12} c="#5a3b1a" s={1.2} />
      <Arbre x={300} sol={1500} s={1.1} c="#3a2614" />
    </Cadre>
  );
};

const Maison: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const crainte = quand(plan, "crainte", 0, d * 0.3);
  const toit = quand(plan, "toit", 0, d * 0.55);
  const travail = quand(plan, "travail", 0, d * 0.7);
  const mariage = quand(plan, "mariage", 0, d * 0.85);
  const pastille = (x: number, y: number, t: number, txt: string) =>
    f > t - 4 ? (
      <g transform={`translate(${x} ${y}) scale(${ressort(f, t)})`}>
        <rect x={-170} y={-50} width={340} height={100} rx={50} fill={OR} />
        <text y={16} textAnchor="middle" fontFamily="Montserrat" fontWeight={800} fontSize={44} fill={NUIT}>{txt}</text>
      </g>
    ) : null;
  return (
    <Cadre cles={[[0, 1.1, 0, 30], [d, 1.0, 0, 0]]}>
      <Ciel id="mdm" stops={[[0, "#120f22"], [0.6, "#3a2440"], [1, "#7a4a3a"]]} />
      <Etoiles n={50} bas={800} graine="mdm" />
      <rect x={0} y={1300} width={W} height={H - 1300} fill="#2a1a10" />
      <g transform="translate(540 1300)">
        <rect x={-260} y={-300} width={520} height={300} fill="#5a3a20" />
        <path d="M-300,-300 L0,-470 L300,-300 Z" fill="#3a2414" />
        <rect x={-60} y={-170} width={120} height={170} fill="#ffcf80" opacity={0.85} />
        <Halo id="mdmh" x={0} y={-90} r={300} c="#ffcf80" o={0.35 + prog(f, crainte, crainte + 20) * 0.3} />
        <rect x={150} y={-200} width={70} height={70} fill="#ffcf80" opacity={0.7} />
      </g>
      {Array.from({ length: 4 }).map((_, i) => <Mouton key={i} x={180 + i * 120} y={1500 + (i % 2) * 20} s={0.7} phase={i} c="#cdb894" />)}
      {pastille(540, 560, toit, "un toit")}
      {pastille(540, 700, travail, "un travail")}
      {pastille(540, 840, mariage, "une famille")}
    </Cadre>
  );
};

const Lecon: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const famille = quand(plan, "famille", 0, d * 0.5);
  const p = prog(f, famille - 20, famille + 30);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -30]]}>
      <Ciel id="mdl" stops={[[0, "#0a0c1c"], [0.6, "#24203c"], [1, "#4a2c3a"]]} />
      <Etoiles n={110} bas={1200} graine="mdl" />
      <Dunes y={1350} c1="#1e140e" c2="#140d08" />
      <Arbre x={300} sol={1420} s={1.0} c="#0f0a08" />
      {/* au loin, des lumières : un foyer */}
      <Lumiere id="mdll" x={820} y={1330} r={260} o={p * 0.8} c="#ffcf80" />
      <Pas de={[300, 1500]} a={[800, 1340]} p={p} n={10} s={0.9} />
      <Brume y={1300} c="#a08aa0" o={0.25} graine="mdlb" />
    </Cadre>
  );
};

// =============================================================== Le feu sur le Mont
const FeuLoin: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const voix = quand(plan, "voix", 0, d * 0.85);
  const pulse = 0.7 + Math.sin(f / 6) * 0.15;
  const z = interpolate(f, [0, d], [1.0, 1.25], clamp);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, z, -40, 60]]}>
      <Ciel id="mff" stops={[[0, "#05060f"], [0.6, "#141a30"], [1, "#2a2236"]]} />
      <Etoiles n={140} bas={1100} graine="mff" />
      <Mont y={1350} c="#0e0c14" />
      <Halo id="mffh" x={600} y={980} r={180 + prog(f, voix - 10, voix + 20) * 400} c="#ffb35a" o={pulse} />
      <Flamme x={600} y={1000} t={0.5} graine="mff1" />
      <rect x={0} y={1350} width={W} height={H - 1350} fill="#0a080c" />
      <Poussieres n={20} c="#ffcf9a" graine="mffp" haut={700} bas={1400} />
    </Cadre>
  );
};

const Route: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const famille = quand(plan, "famille", 0, d * 0.3);
  const feu = quand(plan, "feu", 0, d * 0.5);
  const restez = quand(plan, "Restez", 0, d * 2);
  const part = restez < d ? prog(f, restez + 10, d) : 0;
  return (
    <Cadre cles={[[0, 1.05, 0, 0], [d, 1.0, 0, 0]]}>
      <Ciel id="mfr" stops={[[0, "#05060f"], [0.6, "#151b33"], [1, "#2a2438"]]} />
      <Etoiles n={120} bas={1000} graine="mfr" />
      <g opacity={0.9}><Mont y={1250} c="#0e0c14" /></g>
      <Flamme x={600} y={900} t={0.3 + prog(f, feu, feu + 20) * 0.15} graine="mfr1" />
      <Halo id="mfrh" x={600} y={900} r={200} c="#ffb35a" o={prog(f, feu - 10, feu + 10) * 0.8} />
      <rect x={0} y={1250} width={W} height={H - 1250} fill="#120e10" />
      {/* le campement : une tente et une lampe, la famille reste là */}
      <g transform="translate(260 1560)" opacity={ressort(f, famille - 10)}>
        <path d="M-160,0 L0,-210 L160,0 Z" fill="#3a2a22" />
        <path d="M-30,0 L0,-120 L30,0 Z" fill="#ffcf80" opacity={0.7} />
        <Halo id="mfrt" x={0} y={-60} r={200} c="#ffcf80" o={0.35} />
        {/* une bête de somme couchée près de la tente */}
        <ellipse cx={230} cy={-30} rx={90} ry={40} fill="#22181a" />
        <path d="M300,-50 Q330,-120 360,-110 L370,-90 Q340,-90 320,-40 Z" fill="#22181a" />
      </g>
      <Pas de={[380, 1560]} a={[600, 1260]} p={part} n={10} s={1.0} />
    </Cadre>
  );
};

const Vallee: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const arbre = quand(plan, "arbre", 0, d * 0.7);
  const appelle = quand(plan, "appelle", 0, d * 0.9);
  const lum = prog(f, arbre - 20, appelle + 10);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.15, 0, 40]]}>
      <Ciel id="mfv" stops={[[0, "#05060f"], [0.6, "#121830"], [1, "#2a2030"]]} />
      <Etoiles n={100} bas={900} graine="mfv" />
      <path d="M0,1100 L300,1000 L540,1200 L780,1000 L1080,1080 L1080,1920 L0,1920 Z" fill="#100c10" />
      <Lumiere id="mfvl" x={720} y={1060} r={300 + lum * 700} o={0.3 + lum * 0.6} c="#fff1c8" />
      <Arbre x={720} sol={1260} s={1.0} c="#1a1210" feu={0.3 + lum * 0.7} />
      <Pas de={[200, 1880]} a={[600, 1300]} p={interpolate(f, [0, arbre], [0.3, 1], clamp)} n={14} s={1.2} />
      {f > appelle ? <Rayons x={720} y={1000} c="#fff4d8" o={prog(f, appelle, appelle + 20) * 0.6} /> : null}
    </Cadre>
  );
};

const ArbreLumiere: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.08, 0, 20]]}>
      <Ciel id="mfa" stops={[[0, "#0a0a18"], [0.5, "#2a2440"], [1, "#4a3640"]]} />
      <Etoiles n={140} bas={1300} graine="mfa" />
      <Rayons x={540} y={1050} c="#fff4d8" o={0.55 + Math.sin(f / 20) * 0.08} />
      <Lumiere id="mfal" x={540} y={1000} r={900} o={0.85} c="#fff1c8" />
      <Arbre x={540} sol={1350} s={1.4} c="#1a1210" feu={1} />
      <rect x={0} y={1350} width={W} height={H - 1350} fill="#0c0a0c" />
      <Poussieres n={60} c="#fff4d8" graine="mfap" haut={500} bas={1500} />
    </Cadre>
  );
};

const Serpent: React.FC<{ x: number; y: number; m: number }> = ({ x, y, m }) => {
  const f = useCurrentFrame();
  const pts = Array.from({ length: 24 }).map((_, i) => {
    const t = i / 23;
    const px = x - 300 + t * 600;
    const py = y + Math.sin(t * 10 + f / 3) * 40 * m;
    return `${px},${py}`;
  });
  return (
    <g>
      <polyline points={pts.join(" ")} fill="none" stroke={m > 0.5 ? "#4a6a3a" : "#6b4a2a"} strokeWidth={34 - m * 6} strokeLinecap="round" />
      {m > 0.5 ? <ellipse cx={x + 310} cy={y + Math.sin(10 + f / 3) * 40 * m} rx={36} ry={24} fill="#4a6a3a" /> : null}
    </g>
  );
};

const Baton: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const jette = quand(plan, "Jette", 0, 20);
  const serpent = quand(plan, "serpent", 0, d * 0.35);
  const recule = quand(plan, "recule", 0, d * 0.5);
  const approche = quand(plan, "approche", 0, d * 2);
  const tombe = prog(f, jette, jette + 15, Easing.in(Easing.quad));
  const m = prog(f, serpent - 10, serpent + 10) * (approche < d ? 1 - prog(f, approche, approche + 30) : 1);
  const fuite = prog(f, recule, recule + 40);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.05, 0, 0]]}>
      <Ciel id="mfb" stops={[[0, "#0a0a18"], [0.5, "#2a2440"], [1, "#4a3640"]]} />
      <Lumiere id="mfbl" x={540} y={700} r={700} o={0.5} c="#fff1c8" />
      <rect x={0} y={1250} width={W} height={H - 1250} fill="#1a1412" />
      {m < 0.05 ? (
        <g transform={`translate(540 ${interpolate(tombe, [0, 1], [700, 1350])}) rotate(${tombe * 82})`}>
          <rect x={-10} y={-300} width={20} height={600} rx={8} fill="#6b4a2a" />
        </g>
      ) : (
        <Serpent x={540} y={1350} m={m} />
      )}
      {/* des pas qui s'éloignent en courant, puis qui reviennent */}
      <Pas de={[540, 1650]} a={[900, 1880]} p={fuite * (approche < d ? 1 - prog(f, approche, approche + 40) : 1)} n={8} c="#d9c09a" s={1.2} />
    </Cadre>
  );
};

const Preuves: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const blanche = quand(plan, "blanche", 0, d * 0.4);
  const deux = quand(plan, "Deux", 0, d * 0.7);
  const pharaon = quand(plan, "Pharaon", 0, d * 0.9);
  const eclat = prog(f, blanche - 6, blanche + 10);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.06, 0, 0]]}>
      <Ciel id="mfp" stops={[[0, "#08081a"], [0.6, "#1e1c36"], [1, "#3a2c3a"]]} />
      <Etoiles n={100} bas={1200} graine="mfp" />
      {/* une lumière blanche, pure : on ne montre pas la main */}
      <Lumiere id="mfpl" x={540} y={900} r={200 + eclat * 500} o={eclat} c="#ffffff" />
      {f > deux - 4 ? (
        <g>
          {[380, 700].map((x, i) => (
            <g key={i} transform={`translate(${x} 1250) scale(${ressort(f, deux + i * 8)})`}>
              <circle r={70} fill={OR} opacity={0.9} />
              <text y={22} textAnchor="middle" fontFamily="Montserrat" fontWeight={800} fontSize={64} fill={NUIT}>{i + 1}</text>
            </g>
          ))}
        </g>
      ) : null}
      {f > pharaon - 10 ? (
        <g opacity={prog(f, pharaon - 10, pharaon + 20) * 0.8}>
          <Palais base={1800} c="#1a1218" echelle={0.6} torches />
        </g>
      ) : null}
    </Cadre>
  );
};

const Mission: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const mission = quand(plan, "mission", 0, d * 0.45);
  const p = prog(f, mission - 10, mission + 30);
  return (
    <Cadre cles={[[0, 1.1, 0, 0], [d, 1.0, 0, 0]]}>
      <Ciel id="mfm" stops={[[0, "#0a0c1c"], [0.5, "#2a2440"], [1, "#d08a5a"]]} />
      <Etoiles n={80} bas={900} graine="mfm" />
      <Mont y={1300} c="#0e0c14" />
      {/* le petit tison qu'il cherchait… et la grande lumière qu'il a trouvée */}
      <Flamme x={300} y={1550} t={0.25} graine="mfm1" />
      <Lumiere id="mfml" x={600} y={860} r={200 + p * 700} o={0.4 + p * 0.5} c="#fff1c8" />
      <rect x={0} y={1300} width={W} height={H - 1300} fill="#120e10" />
      <Pas de={[300, 1600]} a={[860, 1320]} p={p} n={12} s={1.0} />
    </Cadre>
  );
};

export const ScenesMadyan: Record<string, React.FC<SceneProps>> = {
  md_desert: Desert,
  md_puits: PuitsScene,
  md_ombre: Ombre,
  md_reponse: Reponse,
  md_maison: Maison,
  md_lecon: Lecon,
  mf_feu: FeuLoin,
  mf_route: Route,
  mf_vallee: Vallee,
  mf_arbre: ArbreLumiere,
  mf_baton: Baton,
  mf_preuves: Preuves,
  mf_mission: Mission,
};

void H;
void SABLE;
