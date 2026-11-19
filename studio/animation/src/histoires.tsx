/**
 * Ayati — récits du lot du 21/11. Aucun prophète représenté : Moussa n'apparaît jamais (traces de pas,
 * lumière, lieux). Les autres personnages sont des silhouettes sans visage.
 *   qp_* : le coup de poing (28:15-17)       qa_* : l'homme qui accourt (28:18-21)
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { SceneProps } from "./types";
import { clamp, H, prog, quand, ressort, W } from "./outils";
import { Brume, Cadre, Ciel, Etoiles, Halo, Maisons, Poussieres, Rayons } from "./ayati";
import { Dunes, Pas } from "./madyan";
import { Silhouette } from "./personnages";

const OR = "#f5c25a";
const OR_PALE = "#ffe2a0";
const NUIT = "#0b0a10";

/** Une silhouette qui bascule en arrière (0 debout … 1 au sol). */
const Chute: React.FC<{ x: number; y: number; h: number; p: number; c?: string; lis?: string }> = ({ x, y, h, p, c = NUIT, lis = "#e2b780" }) => (
  <g transform={`rotate(${-82 * p} ${x} ${y})`}>
    <Silhouette x={x} y={y} h={h} role="vieil" c={c} liseré={lis} bras={0.3 * (1 - p)} miroir />
  </g>
);

/** Rue de ville : deux rangées de maisons en perspective. */
const Rue: React.FC<{ sol: number; c1: string; c2: string; graine: string; fenetres?: number[] }> = ({ sol, c1, c2, graine, fenetres = [] }) => (
  <g>
    <Maisons sol={sol - 120} c={c2} graine={graine + "f"} echelle={0.7} />
    <Maisons sol={sol} c={c1} graine={graine} fenetres={fenetres} />
    <rect x={0} y={sol} width={W} height={H - sol} fill={c1} />
  </g>
);

/** Ondes de voix (un cri, une rumeur). */
const Ondes: React.FC<{ x: number; y: number; debut: number; c?: string; n?: number }> = ({ x, y, debut, c = OR_PALE, n = 3 }) => {
  const f = useCurrentFrame();
  if (f < debut) return null;
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const t = ((f - debut) / 30 + i / n) % 1;
        return <circle key={i} cx={x} cy={y} r={60 + t * 260} fill="none" stroke={c} strokeWidth={8} opacity={(1 - t) * 0.7} />;
      })}
    </g>
  );
};

/** Porte en arc, ouverte sur la lumière. */
const PorteLumiere: React.FC<{ x: number; y: number; l: number; h: number; o: number }> = ({ x, y, l, h, o }) => (
  <g>
    <path d={`M${x - l / 2},${y} L${x - l / 2},${y - h + l / 2} A${l / 2},${l / 2} 0 0 1 ${x + l / 2},${y - h + l / 2} L${x + l / 2},${y} Z`} fill="#fff4d2" opacity={0.25 + 0.75 * o} />
    <Halo id="porteh" x={x} y={y - h / 2} r={h * 0.9} c="#fff1c8" o={0.6 * o} />
    <path d={`M${x - l / 2 - 30},${y} L${x - l / 2 - 30},${y - h + l / 2} A${l / 2 + 30},${l / 2 + 30} 0 0 1 ${x + l / 2 + 30},${y - h + l / 2} L${x + l / 2 + 30},${y}`} fill="none" stroke="#2a1c14" strokeWidth={60} />
  </g>
);

// =============================================================== Le coup de poing (28:15-17)
const Poing: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const poing = quand(plan, "poing", 0, 25);
  const tombe = quand(plan, "tombe", 0, d * 0.35);
  const lecon = quand(plan, "leçon", 0, d * 0.85);
  const p = prog(f, tombe - 14, tombe + 4);
  return (
    <Cadre cles={[[0, 1.15, 0, 40], [poing, 1.25, 0, 60], [d, 1.05, 0, 0]]}>
      <Ciel id="qpp" stops={[[0, "#120a0a"], [0.6, "#3a1a14"], [1, "#6a3020"]]} />
      <Rue sol={1300} c1="#1a0f0b" c2="#2a1610" graine="qpp" />
      <Halo id="qppi" x={540} y={1050} r={500} c="#ff9a5a" o={interpolate(f, [poing, poing + 6, poing + 30], [0, 0.9, 0.2], clamp)} />
      <Chute x={700} y={1560} h={380} p={p} />
      <Halo id="qppl" x={540} y={600} r={380} c="#fff1c8" o={0.5 * prog(f, lecon - 10, lecon + 20)} />
      <Poussieres n={30} c={OR_PALE} graine="qppp" haut={1000} bas={1500} />
    </Cadre>
  );
};

const VilleMidi: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const p = interpolate(f, [0, d], [0.05, 1], clamp);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.12, 0, -30]]}>
      <Ciel id="qpv" stops={[[0, "#4a2614"], [0.55, "#a8642e"], [1, "#d89a58"]]} />
      <circle cx={860} cy={720} r={70} fill="#fff6dc" />
      <Halo id="qpvs" x={860} y={720} r={360} c="#fff1c8" o={0.5} />
      <Rue sol={1250} c1="#8a5a34" c2="#a8754a" graine="qpv" />
      {/* rues vides : volets fermés, tout le monde se repose */}
      <Pas de={[540, 1880]} a={[540, 1290]} p={p} n={14} s={1.4} c="#5a3a20" />
      <Poussieres n={25} c="#fff1c8" graine="qpvp" haut={700} bas={1600} />
    </Cadre>
  );
};

const Bagarre: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const battent = quand(plan, "battent", 0, 30);
  const secours = quand(plan, "secours", 0, d * 0.85);
  const lutte = f > battent ? Math.sin(f / 4) * 14 : 0;
  return (
    <Cadre cles={[[0, 1.05, 0, 0], [battent, 1.15, 0, 30], [secours, 1.2, 40, 40], [d, 1.25, 40, 50]]}>
      <Ciel id="qpb" stops={[[0, "#a8582a"], [0.6, "#e0a060"], [1, "#f2c890"]]} />
      <Rue sol={1250} c1="#6a4024" c2="#8a5a34" graine="qpb" />
      <g transform={`translate(${lutte} 0)`}>
        <Silhouette x={430} y={1380} h={400} role="vieil" c={NUIT} liseré={secours < f ? "#fff1c8" : "#e2b780"} bras={f > secours ? 1 : 0.6} />
      </g>
      <g transform={`translate(${-lutte} 0)`}>
        <Silhouette x={660} y={1380} h={420} role="vieil" c={NUIT} liseré="#e2b780" bras={0.6} miroir />
      </g>
      <Ondes x={430} y={1050} debut={secours} />
      <Poussieres n={50} c="#f2c890" graine="qpbp" haut={1100} bas={1450} />
    </Cadre>
  );
};

const Coup: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const poing = quand(plan, "poing", 0, 20);
  const meurt = quand(plan, "meurt", 0, d * 0.3);
  const diable = quand(plan, "Diable", 0, d * 0.75);
  const p = prog(f, poing + 4, meurt);
  const fumee = prog(f, diable - 30, diable + 10);
  return (
    <Cadre cles={[[0, 1.2, 0, 40], [poing, 1.3, 0, 60], [meurt, 1.1, 0, 20], [d, 1.0, 0, 0]]}>
      <Ciel id="qpc" stops={[[0, "#3a1a10"], [0.6, "#8a4020"], [1, "#c07040"]]} />
      <Rue sol={1250} c1="#3a2214" c2="#5a3420" graine="qpb" />
      <Chute x={720} y={1560} h={400} p={p} />
      <Halo id="qpci" x={600} y={1100} r={460} c="#fff" o={interpolate(f, [poing, poing + 4, poing + 22], [0, 0.95, 0], clamp)} />
      <rect width={W} height={H} fill="#2a0000" opacity={0.45 * fumee} />
      <Brume y={900} c="#1a0505" o={0.5 * fumee} graine="qpcb" />
    </Cadre>
  );
};

const Priere: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const seigneur = quand(plan, "Seigneur", 0, Math.min(d * 0.5, 120));
  const monte = prog(f, seigneur - 10, seigneur + 90);
  return (
    <Cadre cles={[[0, 1.0, 0, 20], [d, 1.15, 0, -60]]}>
      <Ciel id="qpr" stops={[[0, "#05060f"], [0.6, "#141634"], [1, "#2a2240"]]} />
      <Etoiles n={120} bas={1100} graine="qpr" />
      <Rue sol={1400} c1="#07070d" c2="#0d0d18" graine="qpr" fenetres={[3]} />
      {/* une lumière douce monte vers le ciel */}
      {Array.from({ length: 6 }).map((_, i) => (
        <circle key={i} cx={540 + Math.sin(f / 20 + i) * 30} cy={1300 - ((monte * 900 + i * 150) % 900)} r={10} fill={OR_PALE} opacity={monte * 0.7} />
      ))}
      <Halo id="qprh" x={540} y={420} r={300 + monte * 200} c="#fff1c8" o={0.2 + 0.5 * monte} />
    </Cadre>
  );
};

const Pardon: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const pardonna = quand(plan, "pardonna", 0, d * 0.55);
  const p = prog(f, pardonna - 5, pardonna + 40);
  return (
    <Cadre cles={[[0, 1.1, 0, -40], [d, 1.0, 0, 0]]}>
      <Ciel id="qpd" stops={[[0, interpolate(p, [0, 1], [0, 1]) > 0.5 ? "#1a1838" : "#05060f"], [0.7, "#2a2448"], [1, "#4a3a58"]]} />
      <Etoiles n={160} bas={1300} graine="qpd" />
      <Rayons x={540} y={-100} c="#fff1c8" o={0.08 + 0.2 * p} />
      <Halo id="qpdh" x={540} y={300} r={500 + 300 * p} c="#fff1c8" o={0.3 + 0.5 * p} />
      <Dunes y={1500} c1="#100c14" c2="#08060a" />
    </Cadre>
  );
};

const Promesse: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const jamais = quand(plan, "jamais", 0, d * 0.7);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -40]]}>
      <Ciel id="qpo" stops={[[0, "#1a1a3a"], [0.55, "#6a4a6a"], [1, "#e0a070"]]} />
      <Halo id="qpos" x={540} y={1250} r={600} c="#ffd8a0" o={0.5 + 0.3 * prog(f, jamais - 10, jamais + 20)} />
      <Rue sol={1320} c1="#1a1218" c2="#2a1e28" graine="qpo" />
      <Pas de={[540, 1900]} a={[540, 1360]} p={interpolate(f, [0, d], [0.3, 1], clamp)} n={10} s={1.3} />
    </Cadre>
  );
};

const LeconPorte: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const ouverte = quand(plan, "ouverte", 0, d * 0.85);
  const changé = quand(plan, "changé", 0, d * 0.4);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [ouverte, 1.08, 0, -20], [d, 1.15, 0, -30]]}>
      <Ciel id="qpl" stops={[[0, "#0a0a18"], [0.7, "#1a1830"], [1, "#2a2240"]]} />
      <Etoiles n={80} bas={900} graine="qpl" />
      <PorteLumiere x={540} y={1250} l={360} h={640} o={prog(f, changé - 20, ouverte + 10)} />
      <rect x={0} y={1250} width={W} height={H - 1250} fill="#0d0a10" />
      <Pas de={[540, 1900]} a={[540, 1280]} p={prog(f, 0, ouverte)} n={10} s={1.2} />
      <Poussieres n={30} c={OR_PALE} graine="qplp" haut={600} bas={1250} />
    </Cadre>
  );
};

// =============================================================== L'homme qui accourt (28:18-21)
const Course: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const x = interpolate(f, [0, d], [1180, -120], clamp);
  return (
    <Cadre cles={[[0, 1.05, 0, 0], [d, 1.12, -30, -20]]}>
      <Ciel id="qac" stops={[[0, "#2a3a6a"], [0.55, "#c08a6a"], [1, "#f0c890"]]} />
      <Rue sol={1300} c1="#3a2a24" c2="#5a4234" graine="qac" />
      <g transform={`translate(${x} 0)`}>
        <Silhouette x={0} y={1420} h={380} role="vieil" c={NUIT} liseré={OR} marche phase={f / 2} bras={0.4} miroir />
      </g>
      <Poussieres n={40} c="#f0c890" graine="qacp" haut={1200} bas={1500} />
    </Cadre>
  );
};

const Aube: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const peur = quand(plan, "peur", 0, d * 0.6);
  // le regard qui balaie la rue, à gauche puis à droite
  const dx = f > peur ? Math.sin((f - peur) / 22) * 60 : 0;
  return (
    <Cadre cles={[[0, 1.05, 0, 0], [d, 1.15, 0, -20]]}>
      <Ciel id="qaa" stops={[[0, "#1a2a4a"], [0.6, "#8a7a8a"], [1, "#e8b890"]]} />
      <g transform={`translate(${dx} 0)`}>
        <Rue sol={1300} c1="#2a2228" c2="#4a3a40" graine="qaa" />
      </g>
      <Brume y={1250} c="#e8d0c0" o={0.25} graine="qaab" />
      <Pas de={[540, 1900]} a={[540, 1340]} p={interpolate(f, [0, peur], [0.2, 1], clamp)} n={9} s={1.3} />
    </Cadre>
  );
};

const Cri: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const cris = quand(plan, "cris", 0, d * 0.4);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [cris, 1.15, -60, 20], [d, 1.2, -60, 30]]}>
      <Ciel id="qar" stops={[[0, "#3a4a7a"], [0.6, "#c0a090"], [1, "#f0d0a0"]]} />
      <Rue sol={1300} c1="#3a2a24" c2="#5a4234" graine="qar" />
      <Silhouette x={330} y={1420} h={400} role="vieil" c={NUIT} liseré="#f0d0a0" bras={f > cris - 10 ? 1 : 0.2} />
      <Ondes x={330} y={1060} debut={cris - 6} />
    </Cadre>
  );
};

const Secret: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const hier = quand(plan, "hier", 0, d * 0.6);
  const dec = quand(plan, "découvert", 0, d * 0.85);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [hier, 1.1, 0, 20], [d, 1.15, 0, 30]]}>
      <Ciel id="qas" stops={[[0, "#3a3a6a"], [0.6, "#a08a8a"], [1, "#e0c0a0"]]} />
      <Rue sol={1300} c1="#2a2024" c2="#4a3a3a" graine="qas" />
      {/* la foule se retourne, la rumeur se répand */}
      {Array.from({ length: 7 }).map((_, i) => (
        <Silhouette key={i} x={90 + i * 150} y={1500 + (i % 2) * 40} h={330} role={i % 3 ? "vieil" : "mere"} c={NUIT}
          liseré={f > dec - 6 ? "#ff8a6a" : "#e0c0a0"} miroir={f > hier + i * 4 ? i > 3 : i <= 3} phase={i} />
      ))}
      <Ondes x={540} y={1150} debut={hier} c="#ffb090" n={4} />
      <rect width={W} height={H} fill="#5a0000" opacity={0.3 * prog(f, dec - 6, dec + 10)} />
    </Cadre>
  );
};

const Conseil: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const quitte = quand(plan, "Quitte", 0, d * 0.6);
  return (
    <Cadre cles={[[0, 1.15, 0, 40], [d, 1.05, 0, 0]]}>
      <Ciel id="qan" stops={[[0, "#2a3a6a"], [0.6, "#b08a7a"], [1, "#f0c890"]]} />
      <Rue sol={1300} c1="#2a2024" c2="#4a3a3a" graine="qan" />
      <Silhouette x={540} y={1440} h={430} role="vieil" c={NUIT} liseré={OR} bras={0.7} />
      {/* la porte de la ville s'éclaire : « quitte la ville » */}
      <Halo id="qanh" x={900} y={1150} r={360} c="#fff1c8" o={0.6 * prog(f, quitte - 10, quitte + 20)} />
      <Poussieres n={30} c="#f0c890" graine="qanp" haut={1000} bas={1500} />
    </Cadre>
  );
};

const Depart: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const sauve = quand(plan, "Sauve-moi", 0, d * 0.7);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.12, 0, -50]]}>
      <Ciel id="qad" stops={[[0, "#0a0c1c"], [0.55, "#3a2a4a"], [1, "#b06a4a"]]} />
      <Etoiles n={60} bas={800} graine="qad" />
      <g opacity={0.9}>
        <Maisons sol={1150} c="#120c10" graine="qadv" echelle={0.6} />
      </g>
      <Dunes y={1250} c1="#2a1c14" c2="#1a110b" />
      <Pas de={[540, 1250]} a={[700, 1880]} p={interpolate(f, [0, d], [0.1, 1], clamp)} n={13} s={1.3} />
      <Halo id="qadh" x={540} y={420} r={360} c="#fff1c8" o={0.2 + 0.4 * prog(f, sauve - 10, sauve + 30)} />
    </Cadre>
  );
};

const LeconCoureur: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const coran = quand(plan, "Coran", 0, d * 0.6);
  const perdu = quand(plan, "perdu", 0, d * 0.9);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -40]]}>
      <Ciel id="qal" stops={[[0, "#1a1a3a"], [0.55, "#8a5a5a"], [1, "#f0b070"]]} />
      <Halo id="qals" x={540} y={1150} r={520} c="#ffd8a0" o={0.5} />
      <Dunes y={1200} c1="#3a2418" c2="#24160e" />
      <g transform={`translate(${interpolate(f, [0, d], [820, 260], clamp)} 0)`} opacity={1 - prog(f, perdu, perdu + 30) * 0.3}>
        <Silhouette x={0} y={1290} h={170} role="vieil" c={NUIT} liseré={OR_PALE} marche phase={f / 2} miroir />
      </g>
      <Rayons x={540} y={-120} c="#fff1c8" o={0.12 * prog(f, coran - 10, coran + 30)} />
      <Poussieres n={30} c={OR_PALE} graine="qalp" haut={700} bas={1500} />
    </Cadre>
  );
};

export const ScenesHistoires: Record<string, React.FC<SceneProps>> = {
  qp_poing: Poing,
  qp_ville: VilleMidi,
  qp_bagarre: Bagarre,
  qp_coup: Coup,
  qp_priere: Priere,
  qp_pardon: Pardon,
  qp_promesse: Promesse,
  qp_lecon: LeconPorte,
  qa_course: Course,
  qa_aube: Aube,
  qa_cri: Cri,
  qa_secret: Secret,
  qa_conseil: Conseil,
  qa_depart: Depart,
  qa_lecon: LeconCoureur,
};
