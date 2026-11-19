/**
 * Ayati — sourate Al-Kahf. Les jeunes gens de la caverne ne sont jamais montrés de près (petites silhouettes
 * lointaines, puis seulement la caverne, la lumière et leur chien). Les hommes des deux jardins sont des
 * silhouettes sans visage.
 *   kc_* : les gens de la caverne (18:9-25)     kj_* : les deux jardins (18:32-44)
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { Plan, SceneProps } from "./types";
import { clamp, H, norm, prog, ressort, rnd, W } from "./outils";
import { Cadre, Ciel, Etoiles, Halo, Maisons, Palmier, Poussieres, Rayons } from "./ayati";
import { Dunes, Pas } from "./madyan";
import { Silhouette } from "./personnages";

const OR = "#f5c25a";
const OR_PALE = "#ffe2a0";
const NUIT = "#0b0a10";
const ROCHE = "#1c1612";

/** Frame (relative au plan) où un mot est dit, ou null s'il n'est pas dans ce plan. */
const dit = (plan: Plan, mot: string): number | null => {
  const c = norm(mot);
  const m = plan.mots.find((x) => norm(x.texte).startsWith(c));
  return m ? m.debut - plan.debut : null;
};

/** Falaise avec l'entrée de la caverne. */
const Falaise: React.FC<{ sol: number; cx?: number; r?: number; c?: string; lumiere?: number }> = ({ sol, cx = 540, r = 210, c = ROCHE, lumiere = 0 }) => (
  <g>
    <path d={`M-50,${sol} L-50,${sol - 760} Q200,${sol - 900} 420,${sol - 820} Q700,${sol - 940} 1130,${sol - 780} L1130,${sol} Z`} fill={c} />
    <path d={`M${cx - r},${sol} L${cx - r},${sol - r * 1.1} A${r},${r} 0 0 1 ${cx + r},${sol - r * 1.1} L${cx + r},${sol} Z`} fill="#050407" />
    {lumiere > 0 ? <Halo id={"fal" + cx} x={cx} y={sol - r * 0.9} r={r * 1.3} c="#fff1c8" o={0.45 * lumiere} /> : null}
  </g>
);

/** Chien couché, pattes étendues (silhouette). */
const ChienCouche: React.FC<{ x: number; y: number; s: number; c?: string; lis?: string }> = ({ x, y, s, c = NUIT, lis = OR_PALE }) => {
  const f = useCurrentFrame();
  const souffle = 1 + Math.sin(f / 18) * 0.02;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={-30} rx={95 * souffle} ry={34 * souffle} fill={c} stroke={lis} strokeWidth={3} />
      <path d="M-80,-20 L-170,-6 L-170,6 L-80,0 Z" fill={c} stroke={lis} strokeWidth={3} />
      <circle cx={-100} cy={-58} r={30} fill={c} stroke={lis} strokeWidth={3} />
      <path d="M-128,-60 L-150,-44 L-122,-44 Z" fill={c} />
      <path d="M-92,-84 L-80,-110 L-74,-80 Z" fill={c} stroke={lis} strokeWidth={3} />
      <path d="M90,-30 Q140,-40 150,-10" stroke={lis} strokeWidth={10} fill="none" strokeLinecap="round" />
      <path d="M50,-4 L120,4" stroke={c} strokeWidth={14} strokeLinecap="round" />
    </g>
  );
};

// =============================================================== Les gens de la caverne
const Reveil: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const cents = dit(plan, "cents");
  const combien = dit(plan, "Combien");
  const jour = dit(plan, "jour");
  const eveil = prog(f, 0, Math.min(60, d * 0.3));
  const compte = cents !== null ? Math.round(interpolate(f, [cents - 30, cents + 20], [1, 309], clamp)) : null;
  return (
    <Cadre cles={[[0, 1.12, 0, 30], [d, 1.0, 0, 0]]}>
      {/* vue de l'intérieur de la caverne : la lumière du dehors */}
      <rect width={W} height={H} fill="#f3d9a8" />
      <Halo id="kcr" x={540} y={900} r={700} c="#fff8e0" o={0.6 + 0.4 * eveil} />
      <path d={`M0,0 L${W},0 L${W},${H} L0,${H} Z M260,1500 L260,820 A280,300 0 0 1 820,820 L820,1500 Z`} fill={ROCHE} fillRule="evenodd" />
      <rect x={0} y={1500} width={W} height={H - 1500} fill="#120e0b" />
      <ChienCouche x={560} y={1520} s={1.1} />
      {compte !== null ? (
        <g transform={`translate(540 520) scale(${ressort(f, (cents ?? 0) - 30)})`}>
          <text textAnchor="middle" fontFamily="Montserrat" fontWeight={800} fontSize={130} fill={OR}>{compte} ans</text>
        </g>
      ) : null}
      {combien !== null && jour !== null ? (
        <g transform={`translate(540 520) scale(${ressort(f, jour)})`}>
          <text textAnchor="middle" fontFamily="Montserrat" fontWeight={800} fontSize={100} fill={OR_PALE}>« 1 jour ? »</text>
        </g>
      ) : null}
    </Cadre>
  );
};

const VilleIdoles: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const leves = dit(plan, "levés") ?? d * 0.6;
  const lumiere = prog(f, leves - 10, leves + 25);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [leves, 1.08, 0, -20], [d, 1.15, 0, -40]]}>
      <Ciel id="kcv" stops={[[0, "#0a0a1a"], [0.6, "#2a1a2a"], [1, "#5a2a20"]]} />
      <Etoiles n={60} bas={700} graine="kcv" />
      <Maisons sol={1200} c="#150d0c" graine="kcv" fenetres={[1, 4, 6]} />
      {/* les autels de la ville : des stèles éclairées de feux */}
      {[160, 400, 680, 920].map((x, i) => (
        <g key={i}>
          <rect x={x - 26} y={1080} width={52} height={150} fill="#2a1810" />
          <Halo id={"kcvf" + i} x={x} y={1060} r={90} c="#ff8a3a" o={0.5 + 0.2 * Math.sin(f / 5 + i)} />
        </g>
      ))}
      <rect x={0} y={1230} width={W} height={H - 1230} fill="#0e0907" />
      {/* les jeunes gens, petits et lointains */}
      <Halo id="kcvh" x={540} y={1330} r={240} c="#fff1c8" o={0.6 * lumiere} />
      {[450, 510, 570, 630].map((x, i) => (
        <Silhouette key={i} x={x} y={1400} h={150} role="vieil" c={NUIT} liseré={lumiere > 0.5 ? "#fff1c8" : "#a0806a"} phase={i} />
      ))}
    </Cadre>
  );
};

const FuiteCaverne: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.15, 0, -40]]}>
      <Ciel id="kcf" stops={[[0, "#05060f"], [0.6, "#151a34"], [1, "#2a2a48"]]} />
      <Etoiles n={140} bas={900} graine="kcf" />
      <Falaise sol={1250} r={120} c="#120e10" />
      <Dunes y={1300} c1="#1a1418" c2="#0e0a0c" />
      <Pas de={[540, 1900]} a={[540, 1290]} p={interpolate(f, [0, d], [0.1, 1], clamp)} n={12} s={1.3} />
    </Cadre>
  );
};

const Entree: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const mis = dit(plan, "miséricorde") ?? d * 0.5;
  const p = prog(f, mis - 20, mis + 40);
  return (
    <Cadre cles={[[0, 1.05, 0, 0], [d, 1.12, 0, 30]]}>
      <Ciel id="kce" stops={[[0, "#05060f"], [0.6, "#1a1838"], [1, "#2a2448"]]} />
      <Etoiles n={160} bas={1000} graine="kce" />
      <Rayons x={540} y={-120} c="#fff1c8" o={0.05 + 0.12 * p} />
      <Falaise sol={1500} r={200} lumiere={0.2 + 0.8 * p} />
      <rect x={0} y={1500} width={W} height={H - 1500} fill="#0e0a0c" />
      <Poussieres n={30} c={OR_PALE} graine="kcep" haut={900} bas={1500} />
    </Cadre>
  );
};

const Soleil: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const droite = dit(plan, "droite") ?? d * 0.6;
  const gauche = dit(plan, "gauche") ?? d * 0.9;
  // le soleil se lève (à droite de la caverne) puis se couche (à sa gauche) : sa lumière ne touche jamais l'entrée
  const a = interpolate(f, [droite - 50, gauche + 20], [0, Math.PI], clamp);
  const sx = 900 - (a / Math.PI) * 760;
  const sy = 1100 - Math.sin(a) * 650;
  const nuit = 1 - Math.sin(a);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.05, 0, -20]]}>
      <Ciel id="kcs" stops={[[0, "#2a3a6a"], [0.6, "#8a7a8a"], [1, "#e0b890"]]} />
      <rect width={W} height={H} fill="#05060f" opacity={0.7 * nuit} />
      <circle cx={sx} cy={sy} r={70} fill="#fff4d0" />
      <Halo id="kcsh" x={sx} y={sy} r={300} c="#fff1c8" o={0.6} />
      <Falaise sol={1500} r={190} />
      <rect x={0} y={1500} width={W} height={H - 1500} fill="#120e0b" />
    </Cadre>
  );
};

const ChienScene: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const chien = dit(plan, "chien") ?? d * 0.8;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [chien - 10, 1.05, 0, 0], [d, 1.3, 0, -160]]}>
      <Ciel id="kcc" stops={[[0, "#05060f"], [0.6, "#141634"], [1, "#2a2240"]]} />
      <Etoiles n={120} bas={900} graine="kcc" />
      <Falaise sol={1500} r={220} lumiere={0.3} />
      <rect x={0} y={1500} width={W} height={H - 1500} fill="#0e0a0c" />
      <g opacity={prog(f, chien - 15, chien + 5)}>
        <ChienCouche x={560} y={1500} s={1.0} />
      </g>
    </Cadre>
  );
};

const Siecles: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const cents = dit(plan, "cents") ?? d * 0.4;
  const neuf = dit(plan, "neuf") ?? d * 0.8;
  const tours = f / 3; // le temps file : jours et nuits défilent
  const jour = (Math.sin(tours) + 1) / 2;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.08, 0, 0]]}>
      <Ciel id="kcy" stops={[[0, "#2a3a6a"], [0.6, "#8a7a8a"], [1, "#e0b890"]]} />
      <rect width={W} height={H} fill="#05060f" opacity={0.85 * (1 - jour)} />
      <Falaise sol={1500} r={190} />
      <rect x={0} y={1500} width={W} height={H - 1500} fill="#120e0b" />
      <g transform={`translate(540 560) scale(${ressort(f, cents)})`}>
        <text textAnchor="middle" fontFamily="Montserrat" fontWeight={800} fontSize={150} fill={OR}>300 ans</text>
      </g>
      {f > neuf - 4 ? (
        <g transform={`translate(540 720) scale(${ressort(f, neuf)})`}>
          <text textAnchor="middle" fontFamily="Montserrat" fontWeight={800} fontSize={100} fill="#fff">+ 9</text>
        </g>
      ) : null}
    </Cadre>
  );
};

const LeconCaverne: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const prot = dit(plan, "protégés") ?? d * 0.4;
  const p = prog(f, prot - 10, prot + 40);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.12, 0, -30]]}>
      <Ciel id="kcl" stops={[[0, "#05060f"], [0.6, "#1a1838"], [1, "#3a2a48"]]} />
      <Etoiles n={160} bas={1100} graine="kcl" />
      <Halo id="kclh" x={540} y={1150} r={400 + 300 * p} c="#fff1c8" o={0.3 + 0.4 * p} />
      <Falaise sol={1500} r={190} lumiere={0.5 + 0.5 * p} />
      <rect x={0} y={1500} width={W} height={H - 1500} fill="#0e0a0c" />
      <Poussieres n={30} c={OR_PALE} graine="kclp" haut={800} bas={1500} />
    </Cadre>
  );
};

// =============================================================== Les deux jardins
/** Rangées de vignes, vertes ou ravagées (0 … 1). */
const Vignes: React.FC<{ x0: number; x1: number; y: number; rangs: number; ruine: number; graine: string }> = ({ x0, x1, y, rangs, ruine, graine }) => {
  const f = useCurrentFrame();
  const vert = ruine < 0.5 ? "#3f7a3a" : "#5a4a2a";
  return (
    <g>
      {Array.from({ length: rangs }).map((_, r) => {
        const yy = y + r * 90;
        const n = Math.round((x1 - x0) / 70);
        return (
          <g key={r}>
            <rect x={x0} y={yy + 30} width={x1 - x0} height={8} fill="#4a3220" />
            {Array.from({ length: n }).map((_, i) => {
              const x = x0 + i * 70 + 35;
              const tombe = ruine * (20 + rnd(graine + r + "t" + i) * 40);
              return (
                <g key={i} transform={`translate(0 ${tombe})`} opacity={1 - ruine * 0.5}>
                  <circle cx={x} cy={yy + Math.sin(f / 30 + i) * 2} r={30} fill={vert} />
                  {ruine < 0.5 && rnd(graine + r + i) < 0.6 ? <circle cx={x + 10} cy={yy + 12} r={10} fill="#6a3a8a" /> : null}
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
};

const Ruisseau: React.FC<{ y0: number; y1: number; o?: number }> = ({ y0, y1, o = 1 }) => {
  const f = useCurrentFrame();
  return (
    <g opacity={o}>
      <path d={`M540,${y0} C500,${(y0 + y1) / 2} 600,${(y0 + y1) / 2} 520,${y1}`} stroke="#4aa0d0" strokeWidth={36} fill="none" />
      <path d={`M540,${y0} C500,${(y0 + y1) / 2} 600,${(y0 + y1) / 2} 520,${y1}`} stroke="#bfe6ff" strokeWidth={6} fill="none" strokeDasharray="30 50" strokeDashoffset={-f * 4} />
    </g>
  );
};

const Jardin: React.FC<{ ruine: number; ciel: [number, string][]; id: string }> = ({ ruine, ciel, id }) => (
  <g>
    <Ciel id={id} stops={ciel} />
    <rect x={0} y={1000} width={W} height={H - 1000} fill={ruine < 0.5 ? "#5a7a3a" : "#5a4a30"} />
    {[60, 240, 840, 1020].map((x, i) => (
      <Palmier key={i} x={x} sol={1060} h={ruine > 0.6 ? 260 : 380} c={ruine < 0.5 ? "#1f3a1a" : "#2a2016"} phase={i} incl={i < 2 ? 0.1 : -0.1} />
    ))}
    <Vignes x0={60} x1={460} y={1100} rangs={5} ruine={ruine} graine={id + "a"} />
    <Vignes x0={620} x1={1020} y={1100} rangs={5} ruine={ruine} graine={id + "b"} />
    <Ruisseau y0={1000} y1={1920} o={1 - ruine * 0.9} />
  </g>
);

const Jardins: React.FC<SceneProps> = ({ plan }) => {
  const d = plan.fin - plan.debut;
  return (
    <Cadre cles={[[0, 1.15, 0, -60], [d, 1.0, 0, 0]]}>
      <Jardin ruine={0} id="kjj" ciel={[[0, "#3a6a9a"], [0.6, "#9ac0d0"], [1, "#e8e0b0"]]} />
      <Poussieres n={25} c="#fff8d0" graine="kjjp" haut={700} bas={1400} />
    </Cadre>
  );
};

const Ruine: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const coup = dit(plan, "détruite") ?? dit(plan, "jour") ?? d * 0.3;
  const r = prog(f, coup - 15, coup + 25);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [coup, 1.08, 0, 0], [d, 1.12, 0, -30]]}>
      <Jardin ruine={r} id="kjr" ciel={r < 0.5 ? [[0, "#3a6a9a"], [0.6, "#9ac0d0"], [1, "#e8e0b0"]] : [[0, "#1a1418"], [0.6, "#4a3a3a"], [1, "#8a6a4a"]]} />
      <rect width={W} height={H} fill="#000" opacity={0.25 * r} />
      <g opacity={r}>
        <Silhouette x={540} y={1560} h={260} role="vieil" c={NUIT} liseré="#a0806a" agenouille />
      </g>
      <Poussieres n={40} c="#c0a080" graine="kjrp" haut={900} bas={1600} />
    </Cadre>
  );
};

const Orgueil: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const moi = dit(plan, "moi") ?? d * 0.35;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -30]]}>
      <Jardin ruine={0} id="kjo" ciel={[[0, "#5a4a7a"], [0.6, "#c09070"], [1, "#f0c890"]]} />
      <Halo id="kjoh" x={380} y={1300} r={300} c={OR} o={0.4 + 0.3 * prog(f, moi - 10, moi + 10)} />
      <Silhouette x={380} y={1560} h={460} role="chef" c={NUIT} liseré={OR} bras={0.6} />
      <Silhouette x={760} y={1560} h={360} role="vieil" c={NUIT} liseré="#e0c0a0" miroir />
    </Cadre>
  );
};

const Compagnon: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const seig = dit(plan, "Seigneur") ?? d * 0.8;
  const p = prog(f, seig - 10, seig + 30);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.12, 60, -20]]}>
      <Jardin ruine={0} id="kjc" ciel={[[0, "#3a3a6a"], [0.6, "#a08080"], [1, "#e0b890"]]} />
      <rect width={W} height={H} fill="#000" opacity={0.25} />
      <Silhouette x={380} y={1560} h={420} role="chef" c={NUIT} liseré="#a0806a" />
      <Halo id="kjch" x={720} y={1330} r={260 + 80 * p} c="#fff1c8" o={0.3 + 0.4 * p} />
      <Silhouette x={720} y={1560} h={400} role="vieil" c={NUIT} liseré="#fff1c8" miroir bras={0.4} />
    </Cadre>
  );
};

const MashaAllah: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, 0, -40]]}>
      <Jardin ruine={0} id="kjm" ciel={[[0, "#1a1a3a"], [0.6, "#6a4a6a"], [1, "#e0a070"]]} />
      <rect width={W} height={H} fill="#0a0814" opacity={0.35} />
      {/* la porte du jardin, ouverte sur la lumière */}
      <path d="M380,1250 L380,980 A160,160 0 0 1 700,980 L700,1250 Z" fill="#fff1c8" opacity={0.25 + 0.15 * Math.sin(f / 20)} />
      <path d="M350,1250 L350,980 A190,190 0 0 1 730,980 L730,1250" fill="none" stroke="#2a2016" strokeWidth={40} />
      <Halo id="kjmh" x={540} y={1080} r={420} c="#fff1c8" o={0.4} />
    </Cadre>
  );
};

const LeconJardin: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const ma = dit(plan, "Mâ") ?? d * 0.8;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.08, 0, -20]]}>
      <Ciel id="kjl" stops={[[0, "#1a1a3a"], [0.6, "#5a3a5a"], [1, "#c08060"]]} />
      <Etoiles n={60} bas={700} graine="kjl" />
      <Maisons sol={1350} c="#1a1218" graine="kjl" fenetres={[2, 4]} />
      <rect x={0} y={1350} width={W} height={H - 1350} fill="#120c10" />
      <g transform={`translate(540 640) scale(${ressort(f, ma)})`} opacity={f > ma - 4 ? 1 : 0}>
        <Halo id="kjlh" x={0} y={-40} r={380} c="#fff1c8" o={0.5} />
        <text textAnchor="middle" fontFamily="Amiri" fontWeight={700} fontSize={150} fill={OR} direction="rtl">ما شاء الله</text>
      </g>
    </Cadre>
  );
};

export const ScenesKahf: Record<string, React.FC<SceneProps>> = {
  kc_reveil: Reveil,
  kc_ville: VilleIdoles,
  kc_fuite: FuiteCaverne,
  kc_entree: Entree,
  kc_soleil: Soleil,
  kc_chien: ChienScene,
  kc_siecles: Siecles,
  kc_lecon: LeconCaverne,
  kj_jardins: Jardins,
  kj_ruine: Ruine,
  kj_orgueil: Orgueil,
  kj_compagnon: Compagnon,
  kj_mashaallah: MashaAllah,
  kj_lecon: LeconJardin,
};
