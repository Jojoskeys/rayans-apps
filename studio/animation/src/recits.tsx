/**
 * Ayati — Dhoul-Qarnayn (18:83-98) et le rêve de Youssouf (12:3-6). Personne n'est montré : routes, soleil,
 * montagnes, muraille ; la nuit, les étoiles, la maison.
 *   kq_* : Dhoul-Qarnayn     yr_* : le rêve de Youssouf
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { Plan, SceneProps } from "./types";
import { clamp, H, norm, prog, ressort, rnd, W } from "./outils";
import { Brume, Cadre, Ciel, Etoiles, Halo, Maisons, Palmier, Poussieres, Rayons } from "./ayati";
import { Dunes, Pas } from "./madyan";

const OR = "#f5c25a";
const OR_PALE = "#ffe2a0";
const CUIVRE = "#c8743a";

const dit = (plan: Plan, mot: string): number | null => {
  const c = norm(mot);
  const m = plan.mots.find((x) => norm(x.texte).startsWith(c));
  return m ? m.debut - plan.debut : null;
};

/** Deux montagnes et le passage entre elles ; `mur` = hauteur de la muraille (0 … 1), `chaud` = fer brûlant. */
const Passage: React.FC<{ sol: number; mur: number; chaud?: number; cuivre?: number }> = ({ sol, mur, chaud = 0, cuivre = 0 }) => {
  const hMur = 640 * mur;
  return (
    <g>
      <path d={`M-60,${sol} L180,${sol - 900} L300,${sol - 820} L420,${sol} Z`} fill="#1e1814" />
      <path d={`M660,${sol} L790,${sol - 860} L920,${sol - 940} L1140,${sol} Z`} fill="#1e1814" />
      {mur > 0 ? (
        <g>
          {Array.from({ length: Math.ceil(mur * 8) }).map((_, r) => (
            <rect key={r} x={380} y={sol - (r + 1) * 80} width={320} height={76} fill={chaud > 0.5 ? "#ff8a3a" : "#4a4a52"} stroke="#2a2a30" strokeWidth={4} />
          ))}
          <rect x={380} y={sol - hMur} width={320} height={hMur} fill={CUIVRE} opacity={0.75 * cuivre} />
          {chaud > 0 ? <Halo id="passh" x={540} y={sol - hMur / 2} r={420} c="#ff7a2a" o={0.6 * chaud} /> : null}
        </g>
      ) : null}
    </g>
  );
};

// =============================================================== Dhoul-Qarnayn
const Muraille: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const mis = dit(plan, "miséricorde") ?? d;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -30]]}>
      <Ciel id="kqm" stops={[[0, "#1a1a3a"], [0.6, "#7a5a6a"], [1, "#e0a070"]]} />
      <Passage sol={1450} mur={1} cuivre={1} />
      <rect x={0} y={1450} width={W} height={H - 1450} fill="#14100c" />
      <Halo id="kqmh" x={540} y={500} r={360} c="#fff1c8" o={0.2 + 0.4 * prog(f, mis - 10, mis + 30)} />
      <Brume y={1500} c="#2a1e18" o={0.4} graine="kqmb" />
    </Cadre>
  );
};

const Routes: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const p = prog(f, 0, d * 0.9);
  const route = (dx: number, k: number) => (
    <path d={`M540,1900 Q${540 + dx * 0.4},1500 ${540 + dx},1150`} stroke={OR_PALE} strokeWidth={14} fill="none" strokeDasharray="1000" strokeDashoffset={1000 * (1 - prog(f, k * 20, k * 20 + d * 0.6))} opacity={0.8} />
  );
  return (
    <Cadre cles={[[0, 1.05, 0, 30], [d, 1.0, 0, 0]]}>
      <Ciel id="kqr" stops={[[0, "#2a3a6a"], [0.6, "#a08a8a"], [1, "#f0c890"]]} />
      <Dunes y={1150} c1="#6a4a30" c2="#4a3020" />
      {route(-420, 0)}
      {route(0, 1)}
      {route(420, 2)}
      <Halo id="kqrh" x={540} y={1150} r={300 + 200 * p} c="#fff1c8" o={0.4} />
    </Cadre>
  );
};

const Couchant: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const sy = interpolate(f, [0, d * 0.6], [900, 1240], clamp);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -20]]}>
      <Ciel id="kqc" stops={[[0, "#2a1a3a"], [0.6, "#a04a3a"], [1, "#f09050"]]} />
      <circle cx={540} cy={sy} r={130} fill="#ffb060" />
      <Halo id="kqch" x={540} y={sy} r={500} c="#ff9a50" o={0.6} />
      {/* une source sombre et boueuse où le soleil semble se coucher */}
      <ellipse cx={540} cy={1300} rx={480} ry={110} fill="#2a1a12" />
      <rect x={0} y={1300} width={W} height={H - 1300} fill="#1a100a" />
      <Pas de={[540, 1900]} a={[540, 1420]} p={1} n={8} s={1.2} />
    </Cadre>
  );
};

const Levant: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const lev = dit(plan, "Levant") ?? 20;
  const sy = interpolate(f, [lev - 20, d], [1250, 760], clamp);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.08, 0, -20]]}>
      <Ciel id="kql" stops={[[0, "#5a8ac0"], [0.6, "#f0d0a0"], [1, "#fff0c8"]]} />
      <circle cx={540} cy={sy} r={120} fill="#fff8e0" />
      <Halo id="kqlh" x={540} y={sy} r={600} c="#fff4d0" o={0.7} />
      {/* une plaine nue : aucun abri */}
      <rect x={0} y={1250} width={W} height={H - 1250} fill="#c8a070" />
      <Poussieres n={30} c="#fff8e0" graine="kqlp" haut={900} bas={1600} />
    </Cadre>
  );
};

const Montagnes: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const des = dit(plan, "désordre") ?? d * 0.5;
  const tempete = prog(f, des - 20, des + 20);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.12, 0, -40]]}>
      <Ciel id="kqo" stops={[[0, "#1a1418"], [0.6, "#5a3a3a"], [1, "#a06a4a"]]} />
      {/* derrière le passage : un nuage de poussière menaçant (Gog et Magog ne sont pas montrés) */}
      {Array.from({ length: 8 }).map((_, i) => (
        <circle key={i} cx={420 + rnd("kqo" + i) * 240 + Math.sin(f / 10 + i) * 20} cy={900 + rnd("kqoy" + i) * 300} r={90 + rnd("kqor" + i) * 80} fill="#3a1a14" opacity={0.85 * tempete} />
      ))}
      <Passage sol={1450} mur={0} />
      <rect x={0} y={1450} width={W} height={H - 1450} fill="#14100c" />
    </Cadre>
  );
};

const Refus: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const mieux = dit(plan, "mieux") ?? d * 0.4;
  const p = prog(f, mieux - 10, mieux + 30);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.08, 0, -20]]}>
      <Ciel id="kqf" stops={[[0, "#1a1a3a"], [0.6, "#6a4a5a"], [1, "#d08a5a"]]} />
      <Passage sol={1450} mur={0} />
      <rect x={0} y={1450} width={W} height={H - 1450} fill="#14100c" />
      {/* les pièces offertes perdent leur éclat ; la lumière vient d'en haut */}
      {Array.from({ length: 9 }).map((_, i) => (
        <ellipse key={i} cx={420 + (i % 3) * 60 + (i > 5 ? 30 : 0)} cy={1520 - Math.floor(i / 3) * 22} rx={34} ry={12} fill={OR} opacity={1 - 0.7 * p} />
      ))}
      <Rayons x={540} y={-120} c="#fff1c8" o={0.05 + 0.15 * p} />
      <Halo id="kqfh" x={540} y={500} r={300} c="#fff1c8" o={0.3 + 0.4 * p} />
    </Cadre>
  );
};

const Forge: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const fer = dit(plan, "fer") ?? d * 0.1;
  const souff = dit(plan, "Soufflez") ?? d * 0.4;
  const verse = dit(plan, "verse") ?? d * 0.85;
  const mur = prog(f, fer, souff);
  const chaud = prog(f, souff - 5, souff + 25) * (1 - prog(f, verse + 20, d));
  const cuivre = prog(f, verse - 10, verse + 30);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [souff, 1.1, 0, 30], [d, 1.05, 0, 0]]}>
      <Ciel id="kqg" stops={[[0, "#1a1418"], [0.6, "#5a3a3a"], [1, "#a06a4a"]]} />
      <Passage sol={1450} mur={Math.max(0.05, mur)} chaud={chaud} cuivre={cuivre} />
      <rect x={0} y={1450} width={W} height={H - 1450} fill="#14100c" />
      {cuivre > 0 && cuivre < 1 ? <path d={`M540,${600} L540,${1450 - 640 * mur}`} stroke={CUIVRE} strokeWidth={30 * (1 - cuivre) + 6} /> : null}
      <Poussieres n={50} c="#ffb060" graine="kqgp" haut={700} bas={1450} />
    </Cadre>
  );
};

const LeconMur: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const gr = dit(plan, "grandeur") ?? d * 0.85;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.12, 0, -40]]}>
      <Ciel id="kqn" stops={[[0, "#2a3a6a"], [0.6, "#c0a0a0"], [1, "#f8d8a8"]]} />
      <Rayons x={540} y={-120} c="#fff1c8" o={0.12 + 0.12 * prog(f, gr - 20, gr + 20)} />
      <Passage sol={1450} mur={1} cuivre={1} />
      <rect x={0} y={1450} width={W} height={H - 1450} fill="#2a1e14" />
      <Halo id="kqnh" x={540} y={450} r={420} c="#fff4d0" o={0.5} />
    </Cadre>
  );
};

// =============================================================== Le rêve de Youssouf
/** Onze étoiles, le soleil et la lune en arc, qui s'inclinent (0 … 1). */
const Ciel11: React.FC<{ incline: number; o?: number }> = ({ incline, o = 1 }) => {
  const f = useCurrentFrame();
  return (
    <g opacity={o}>
      {Array.from({ length: 11 }).map((_, i) => {
        const a = Math.PI * (0.1 + (0.8 * i) / 10);
        const x = 540 - Math.cos(a) * 400;
        const y = 760 - Math.sin(a) * 300 + incline * 120 * Math.sin(a);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={14 + Math.sin(f / 8 + i) * 2} fill="#fff8e0" />
            <Halo id={"y11" + i} x={x} y={y} r={60} c="#fff4d0" o={0.5} />
          </g>
        );
      })}
      <circle cx={260} cy={460 + incline * 160} r={70} fill="#ffd27a" />
      <Halo id="y11s" x={260} y={460 + incline * 160} r={220} c="#ffcf6a" o={0.6} />
      <circle cx={820} cy={460 + incline * 160} r={56} fill="#f0f0ff" />
      <circle cx={845} cy={445 + incline * 160} r={50} fill="#0a0c1c" />
    </g>
  );
};

const Etoiles11: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const pros = dit(plan, "prosterner") ?? dit(plan, "prosternés") ?? d * 0.7;
  return (
    <Cadre cles={[[0, 1.05, 0, 0], [d, 1.0, 0, 20]]}>
      <Ciel id="yre" stops={[[0, "#05060f"], [0.6, "#141634"], [1, "#2a2240"]]} />
      <Etoiles n={60} bas={1300} graine="yre" />
      <Ciel11 incline={prog(f, pros - 10, pros + 40)} />
      <Maisons sol={1450} c="#08070c" graine="yre" fenetres={[3]} echelle={0.8} />
      <rect x={0} y={1450} width={W} height={H - 1450} fill="#08070c" />
    </Cadre>
  );
};

const MaisonY: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -30]]}>
      <Ciel id="yrm" stops={[[0, "#1a1a3a"], [0.6, "#7a4a5a"], [1, "#e09a6a"]]} />
      <Palmier x={160} sol={1350} h={420} c="#140c10" phase={1} />
      <Palmier x={930} sol={1350} h={380} c="#140c10" incl={-0.1} />
      <path d="M340,1350 L340,1050 L740,1050 L740,1350 Z" fill="#1a1014" />
      <rect x={500} y={1180} width={80} height={170} rx={30} fill="#ffc46e" opacity={0.8 + 0.2 * Math.sin(f / 4)} />
      <Halo id="yrmh" x={540} y={1250} r={260} c="#ff9d3b" o={0.5} />
      <rect x={0} y={1350} width={W} height={H - 1350} fill="#140c10" />
    </Cadre>
  );
};

const ReveilY: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.12, 0, -30]]}>
      <Ciel id="yrr" stops={[[0, "#3a4a7a"], [0.6, "#c0a0a0"], [1, "#f8d0a0"]]} />
      <path d="M340,1350 L340,1050 L740,1050 L740,1350 Z" fill="#3a2620" />
      <rect x={500} y={1180} width={80} height={170} rx={30} fill="#ffe0a0" />
      <rect x={0} y={1350} width={W} height={H - 1350} fill="#4a3020" />
      <Pas de={[540, 1900]} a={[540, 1370]} p={interpolate(f, [0, d], [0.2, 1], clamp)} n={10} s={0.8} />
    </Cadre>
  );
};

const Secret: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const fr = dit(plan, "frères") ?? d * 0.4;
  const ombre = prog(f, fr - 10, fr + 30);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.15, 0, 40]]}>
      <rect width={W} height={H} fill="#1a1014" />
      {/* une lampe à huile ; l'ombre gagne la pièce quand il parle des frères */}
      <Halo id="yrsh" x={540} y={1000} r={600 - 250 * ombre} c="#ffb860" o={0.7} />
      <path d="M470,1080 Q540,1140 610,1080 L590,1110 Q540,1140 490,1110 Z" fill="#8a5a2a" />
      <path d={`M540,1060 q-16,-30 0,-60 q16,30 0,60 Z`} fill="#ffd27a" transform={`translate(0 ${Math.sin(f / 5) * 2})`} />
      <rect width={W} height={H} fill="#000" opacity={0.35 * ombre} />
    </Cadre>
  );
};

const Promesse: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const choisi = dit(plan, "choisira") ?? d * 0.2;
  const p = prog(f, choisi - 10, choisi + 50);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -40]]}>
      <Ciel id="yrp" stops={[[0, "#05060f"], [0.6, "#1a1838"], [1, "#4a3a58"]]} />
      <Etoiles n={160} bas={1200} graine="yrp" />
      <Rayons x={540} y={-100} c="#fff1c8" o={0.05 + 0.15 * p} />
      <Dunes y={1350} c1="#14101a" c2="#0a080e" />
      <path d={`M540,1900 Q560,1600 540,1360`} stroke={OR_PALE} strokeWidth={10} fill="none" strokeDasharray="600" strokeDashoffset={600 * (1 - p)} />
      <Halo id="yrph" x={540} y={1360} r={300} c="#fff1c8" o={0.5 * p} />
    </Cadre>
  );
};

const LeconY: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const pu = dit(plan, "puits") ?? d * 0.3;
  const pr = dit(plan, "prison") ?? d * 0.4;
  const pa = dit(plan, "palais") ?? d * 0.5;
  const etape = (x: number, t: number, child: React.ReactNode, c: string) => (
    <g transform={`translate(${x} 900) scale(${ressort(f, t)})`} opacity={f > t - 4 ? 1 : 0}>
      <circle r={130} fill={c} opacity={0.25} />
      {child}
    </g>
  );
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.05, 0, -20]]}>
      <Ciel id="yrl" stops={[[0, "#05060f"], [0.6, "#1a1838"], [1, "#3a2a48"]]} />
      <Etoiles n={100} bas={1500} graine="yrl" />
      <path d="M200,900 L880,900" stroke={OR_PALE} strokeWidth={6} strokeDasharray="20 20" opacity={0.5} />
      {etape(200, pu, <g><ellipse cx={0} cy={30} rx={80} ry={24} fill="#2b2016" /><rect x={-80} y={-10} width={160} height={40} fill="#7c6a54" /><ellipse cx={0} cy={-10} rx={80} ry={24} fill="#0f1a24" /></g>, "#6a8aa0")}
      {etape(540, pr, <g>{[-50, -17, 17, 50].map((x) => <rect key={x} x={x - 7} y={-80} width={14} height={160} fill="#9a9aa8" />)}<rect x={-70} y={-90} width={140} height={14} fill="#9a9aa8" /></g>, "#8a8aa0")}
      {etape(880, pa, <g><rect x={-80} y={-40} width={160} height={110} fill={OR} /><path d="M-90,-40 L0,-110 L90,-40 Z" fill={OR_PALE} /></g>, OR)}
      <Halo id="yrlh" x={880} y={900} r={240} c="#fff1c8" o={0.5 * prog(f, pa, pa + 30)} />
      <Poussieres n={20} c={OR_PALE} graine="yrlp" haut={700} bas={1200} />
    </Cadre>
  );
};

export const ScenesRecits: Record<string, React.FC<SceneProps>> = {
  kq_muraille: Muraille,
  kq_routes: Routes,
  kq_couchant: Couchant,
  kq_levant: Levant,
  kq_montagnes: Montagnes,
  kq_refus: Refus,
  kq_forge: Forge,
  kq_lecon: LeconMur,
  yr_etoiles: Etoiles11,
  yr_maison: MaisonY,
  yr_reveil: ReveilY,
  yr_secret: Secret,
  yr_promesse: Promesse,
  yr_lecon: LeconY,
};
