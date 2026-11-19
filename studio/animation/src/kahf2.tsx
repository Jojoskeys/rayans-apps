/**
 * Ayati — Al-Kahf, Moussa et le serviteur savant (18:60-82). Ni Moussa, ni le serviteur, ni le garçon ne sont
 * montrés : la mer, le poisson, le bateau, le village, le mur et le trésor.
 *   kb_* : le bateau troué (18:60-73)     ks_* : les trois secrets (18:74-82)
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { Plan, SceneProps } from "./types";
import { clamp, H, norm, prog, ressort, W } from "./outils";
import { Cadre, Ciel, Coffre2, Etoiles, Fleuve, Halo, Maisons, Poussieres, Rayons } from "./ayati";

const OR = "#f5c25a";
const OR_PALE = "#ffe2a0";

const dit = (plan: Plan, mot: string): number | null => {
  const c = norm(mot);
  const m = plan.mots.find((x) => norm(x.texte).startsWith(c));
  return m ? m.debut - plan.debut : null;
};

/** Bateau en bois, avec ou sans brèche (0 … 1). */
const Bateau: React.FC<{ x: number; y: number; s: number; breche?: number; c?: string }> = ({ x, y, s, breche = 0, c = "#5a3a22" }) => {
  const f = useCurrentFrame();
  const roulis = Math.sin(f / 22) * 3;
  return (
    <g transform={`translate(${x} ${y + Math.sin(f / 18) * 6}) rotate(${roulis}) scale(${s})`}>
      <rect x={-6} y={-330} width={12} height={330} fill="#3a2614" />
      <path d="M6,-320 Q150,-200 10,-60 Z" fill="#e8dcc0" />
      <path d="M-260,-40 L260,-40 L200,60 L-200,60 Z" fill={c} />
      <rect x={-250} y={-48} width={500} height={14} fill="#7a5532" />
      {breche > 0 ? (
        <g>
          <ellipse cx={90} cy={20} rx={22 * breche} ry={14 * breche} fill="#120a06" />
          <path d={`M90,30 q10,${30 * breche} 0,${60 * breche}`} stroke="#bfe6ff" strokeWidth={6 * breche} fill="none" opacity={0.8} />
        </g>
      ) : null}
    </g>
  );
};

const Mer: React.FC<{ y: number; id: string; haut?: string; bas?: string }> = ({ y, id, haut = "#1c3a5a", bas = "#0a1626" }) => (
  <Fleuve y={y} haut={haut} bas={bas} graine={id} />
);

const Poisson: React.FC<{ x: number; y: number; s: number; r?: number }> = ({ x, y, s, r = 0 }) => (
  <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
    <ellipse cx={0} cy={0} rx={60} ry={24} fill="#c0d0d8" />
    <path d="M55,0 L95,-26 L95,26 Z" fill="#a0b4c0" />
    <circle cx={-34} cy={-6} r={5} fill="#10132e" />
  </g>
);

/** Mur en pierres, penché (0 droit … 1 sur le point de tomber). */
const Mur: React.FC<{ x: number; sol: number; penche: number; c?: string }> = ({ x, sol, penche, c = "#8a6a4a" }) => (
  <g transform={`rotate(${penche * 9} ${x - 220} ${sol})`}>
    {Array.from({ length: 7 }).map((_, r) =>
      Array.from({ length: 6 }).map((__, i) => (
        <rect key={`${r}-${i}`} x={x - 220 + i * 74 + (r % 2 ? 37 : 0) - (r % 2 && i === 5 ? 37 : 0)} y={sol - (r + 1) * 52} width={r % 2 && i === 5 ? 37 : 70} height={48} rx={6} fill={c} stroke="#5a4430" strokeWidth={3} />
      )),
    )}
  </g>
);

// =============================================================== Le bateau troué
const Breche: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const t = dit(plan, "trou") ?? dit(plan, "troué") ?? d * 0.3;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [t, 1.2, -60, -40], [d, 1.1, -30, -20]]}>
      <Ciel id="kbb" stops={[[0, "#2a3a5a"], [0.6, "#8a8a9a"], [1, "#d8c0a0"]]} />
      <Mer y={1150} id="kbb" />
      <Bateau x={540} y={1180} s={1.2} breche={prog(f, t - 6, t + 10)} />
      <Halo id="kbbi" x={650} y={1200} r={260} c="#fff" o={interpolate(f, [t, t + 4, t + 20], [0, 0.7, 0], clamp)} />
    </Cadre>
  );
};

const Confluent: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.12, 0, -40]]}>
      <Ciel id="kbc" stops={[[0, "#1a2a4a"], [0.6, "#6a7a9a"], [1, "#e0c8a0"]]} />
      {/* deux mers qui se rejoignent : deux couleurs d'eau */}
      <path d={`M0,1100 L540,1100 L380,${H} L0,${H} Z`} fill="#1a4a6a" />
      <path d={`M540,1100 L${W},1100 L${W},${H} L380,${H} Z`} fill="#2a6a5a" />
      <path d={`M540,1100 L380,${H}`} stroke="#d8f0ff" strokeWidth={6} opacity={0.4 + 0.2 * Math.sin(f / 10)} />
      <Halo id="kbch" x={540} y={1100} r={420} c="#fff1c8" o={0.4} />
      <Poussieres n={20} c="#fff" graine="kbcp" haut={1150} bas={1900} />
    </Cadre>
  );
};

const PoissonScene: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const mer = dit(plan, "mer") ?? d * 0.35;
  const cherch = dit(plan, "cherchions") ?? d * 0.7;
  const saut = prog(f, mer - 25, mer + 10);
  return (
    <Cadre cles={[[0, 1.05, 0, 0], [d, 1.1, 0, -30]]}>
      <Ciel id="kbp" stops={[[0, "#2a3a6a"], [0.6, "#a08a8a"], [1, "#f0c890"]]} />
      <Mer y={1150} id="kbp" haut="#2a5a7a" />
      <path d="M120,1250 Q260,1000 460,1080 Q560,1150 600,1300 Z" fill="#3a2a22" />
      <g opacity={saut < 1 ? 1 : 0}>
        <Poisson x={interpolate(saut, [0, 1], [440, 760])} y={1120 - Math.sin(saut * Math.PI) * 220} s={1.3} r={interpolate(saut, [0, 1], [-30, 40])} />
      </g>
      {saut >= 1 ? <path d={`M760,1180 Q900,1220 ${760 + (f - mer) * 6},1200`} stroke="#d8f0ff" strokeWidth={8} fill="none" opacity={0.6} /> : null}
      <Halo id="kbph" x={300} y={1100} r={300} c="#fff1c8" o={0.5 * prog(f, cherch - 10, cherch + 20)} />
    </Cadre>
  );
};

const Serviteur: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const sci = dit(plan, "science") ?? d * 0.4;
  const p = prog(f, sci - 20, sci + 30);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.15, 0, -40]]}>
      <Ciel id="kbs" stops={[[0, "#1a1a3a"], [0.6, "#6a5a7a"], [1, "#e0b890"]]} />
      <Mer y={1200} id="kbs" />
      <path d="M200,1260 Q400,980 640,1040 Q820,1100 880,1300 Z" fill="#2a1e1a" />
      <Rayons x={540} y={-120} c="#fff1c8" o={0.06 + 0.14 * p} />
      <Halo id="kbsh" x={540} y={1000} r={260 + 200 * p} c="#fff1c8" o={0.3 + 0.5 * p} />
      <Poussieres n={30} c={OR_PALE} graine="kbsp" haut={700} bas={1200} />
    </Cadre>
  );
};

const Condition: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const rien = dit(plan, "rien") ?? d * 0.75;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.08, 0, -20]]}>
      <Ciel id="kbk" stops={[[0, "#14142e"], [0.6, "#4a3a5a"], [1, "#a07060"]]} />
      <Etoiles n={60} bas={800} graine="kbk" />
      <Mer y={1200} id="kbk" haut="#1a2a44" />
      {/* le silence promis : une ligne calme sur l'eau */}
      <rect x={140} y={1196} width={800 * prog(f, rien - 20, rien + 20)} height={6} rx={3} fill={OR_PALE} opacity={0.7} />
    </Cadre>
  );
};

const BateauScene: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const bre = dit(plan, "brèche") ?? d * 0.85;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [bre, 1.1, 0, -20], [d, 1.18, -40, -40]]}>
      <Ciel id="kbt" stops={[[0, "#3a5a8a"], [0.6, "#a0b0c0"], [1, "#e8d8b8"]]} />
      <Mer y={1150} id="kbt" haut="#2a5a8a" />
      <Bateau x={interpolate(f, [0, d], [380, 620], clamp)} y={1180} s={1.1} breche={prog(f, bre - 6, bre + 10)} />
    </Cadre>
  );
};

const LeconBateau: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const sag = dit(plan, "sagesse") ?? d * 0.5;
  const p = prog(f, sag - 20, sag + 40);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -40]]}>
      <Ciel id="kbl" stops={[[0, "#1a1a2a"], [0.6, "#3a3a4a"], [1, "#6a5a5a"]]} />
      {/* les nuages s'écartent sur la lumière */}
      <Halo id="kblh" x={540} y={600} r={200 + 500 * p} c="#fff1c8" o={0.2 + 0.6 * p} />
      <ellipse cx={540 - 380 * p} cy={620} rx={420} ry={160} fill="#2a2a38" />
      <ellipse cx={540 + 380 * p} cy={640} rx={420} ry={160} fill="#24242f" />
      <Mer y={1250} id="kbl" haut="#1a2a3a" />
      <Bateau x={540} y={1280} s={0.6} breche={1} />
    </Cadre>
  );
};

// =============================================================== Les trois secrets
const MurScene: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const raison = dit(plan, "raison") ?? d * 0.85;
  const redresse = prog(f, d * 0.2, d * 0.6);
  return (
    <Cadre cles={[[0, 1.05, 0, 0], [d, 1.12, 0, -30]]}>
      <Ciel id="ksm" stops={[[0, "#3a2a4a"], [0.6, "#b07a5a"], [1, "#f0c890"]]} />
      <Maisons sol={1250} c="#3a2620" graine="ksm" echelle={0.8} />
      <rect x={0} y={1250} width={W} height={H - 1250} fill="#4a3020" />
      <Mur x={560} sol={1380} penche={1 - redresse} />
      <Halo id="ksmh" x={540} y={1100} r={460} c="#fff1c8" o={0.5 * prog(f, raison - 10, raison + 20)} />
    </Cadre>
  );
};

const Nuit: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const vie = dit(plan, "vie") ?? d * 0.5;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -20]]}>
      <Ciel id="ksn" stops={[[0, "#05060f"], [0.6, "#141634"], [1, "#2a2240"]]} />
      <Etoiles n={140} bas={1200} graine="ksn" />
      <rect x={0} y={1300} width={W} height={H - 1300} fill="#0a0810" />
      <path d="M540,1300 Q500,1600 420,1920 L660,1920 Q580,1600 540,1300 Z" fill="#14101a" />
      {/* une étoile qui s'éteint : rien d'autre n'est montré */}
      <circle cx={760} cy={480} r={9} fill="#fff" opacity={1 - prog(f, vie - 10, vie + 20)} />
      <rect width={W} height={H} fill="#000" opacity={0.35 * prog(f, vie, vie + 30)} />
    </Cadre>
  );
};

const Village: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const red = dit(plan, "redresse") ?? dit(plan, "séparation") ?? d * 0.8;
  const deja = dit(plan, "salaire") !== null; // deuxième plan : le mur est déjà droit
  const redresse = deja ? 1 : prog(f, red - 20, red + 20);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -30]]}>
      <Ciel id="ksv" stops={[[0, "#2a2a4a"], [0.6, "#9a7a6a"], [1, "#e8c090"]]} />
      <Maisons sol={1250} c="#2a1c18" graine="ksv" />
      <rect x={0} y={1250} width={W} height={H - 1250} fill="#3a2618" />
      <Mur x={560} sol={1420} penche={1 - redresse} />
      <Poussieres n={30} c="#e8c090" graine="ksvp" haut={1100} bas={1500} />
      {deja ? <Halo id="ksvh" x={540} y={1000} r={360} c="#fff1c8" o={0.3 + 0.1 * Math.sin(f / 15)} /> : null}
    </Cadre>
  );
};

const BateauxRoi: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const roi = dit(plan, "roi") ?? d * 0.6;
  const flotte = interpolate(f, [roi - 20, d], [1300, 700], clamp);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.08, 0, -20]]}>
      <Ciel id="ksb" stops={[[0, "#2a3a5a"], [0.6, "#8a8a9a"], [1, "#d8c0a0"]]} />
      <Mer y={1150} id="ksb" />
      {/* les navires du roi approchent ; le bateau abîmé, lui, est laissé */}
      {[0, 1, 2].map((i) => (
        <Bateau key={i} x={flotte + i * 260} y={1100 + i * 20} s={0.5} c="#1a1210" />
      ))}
      <Bateau x={300} y={1260} s={0.9} breche={1} />
      <Halo id="ksbh" x={300} y={1200} r={260} c={OR} o={0.3 * prog(f, roi, roi + 30)} />
    </Cadre>
  );
};

const Garcon: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const pur = dit(plan, "pur") ?? d * 0.8;
  const p = prog(f, pur - 20, pur + 30);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -30]]}>
      <Ciel id="ksg" stops={[[0, "#05060f"], [0.6, "#1a1838"], [1, "#3a2a48"]]} />
      <Etoiles n={140} bas={1100} graine="ksg" />
      <Maisons sol={1350} c="#100c14" graine="ksg" fenetres={[3]} />
      <rect x={0} y={1350} width={W} height={H - 1350} fill="#0c0a10" />
      <Halo id="ksgh" x={540} y={500} r={200 + 300 * p} c="#fff1c8" o={0.2 + 0.5 * p} />
    </Cadre>
  );
};

const Tresor: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const tr = dit(plan, "trésor") ?? d * 0.4;
  const p = prog(f, tr - 20, tr + 20);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, 40]]}>
      <Ciel id="kst" stops={[[0, "#2a2a4a"], [0.6, "#9a7a6a"], [1, "#e8c090"]]} />
      <Maisons sol={1050} c="#2a1c18" graine="kst" echelle={0.7} />
      <rect x={0} y={1050} width={W} height={H - 1050} fill="#3a2618" />
      <Mur x={560} sol={1180} penche={0} />
      {/* sous le mur, la terre en coupe et le trésor des deux orphelins */}
      <rect x={0} y={1180} width={W} height={H - 1180} fill="#2a1a10" />
      <Halo id="ksth" x={540} y={1480} r={300} c={OR} o={0.2 + 0.6 * p} />
      <Coffre2 x={540} y={1480} t={1.1} ouvert={p * 0.6} flotte={false} />
      <Poussieres n={30} c={OR_PALE} graine="kstp" haut={1250} bas={1700} />
    </Cadre>
  );
};

const LeconSecrets: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const tout = dit(plan, "tout") ?? d * 0.45;
  const z = interpolate(f, [tout - 30, tout + 20], [2.2, 1], clamp);
  return (
    <Cadre cles={[[0, z, 0, 0], [d, 1, 0, 0]]}>
      <Ciel id="ksl" stops={[[0, "#05060f"], [0.6, "#1a1838"], [1, "#4a3048"]]} />
      <Etoiles n={220} bas={1500} graine="ksl" />
      <Halo id="kslh" x={540} y={900} r={600} c="#fff1c8" o={0.3 * prog(f, tout, tout + 30)} />
      <rect x={0} y={1600} width={W} height={H - 1600} fill="#0c0a10" />
    </Cadre>
  );
};

export const ScenesKahf2: Record<string, React.FC<SceneProps>> = {
  kb_breche: Breche,
  kb_confluent: Confluent,
  kb_poisson: PoissonScene,
  kb_serviteur: Serviteur,
  kb_condition: Condition,
  kb_bateau: BateauScene,
  kb_lecon: LeconBateau,
  ks_mur: MurScene,
  ks_nuit: Nuit,
  ks_village: Village,
  ks_bateau: BateauxRoi,
  ks_garcon: Garcon,
  ks_tresor: Tresor,
  ks_lecon: LeconSecrets,
};

void ressort;
