/**
 * Ayati — la Nuit du Destin (sourate Al-Qadr). Aucun prophète ni ange représenté : la grotte de Hira de loin,
 * la lumière, le ciel. Les anges sont suggérés par des traits de lumière qui descendent.
 */
import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import type { SceneProps } from "./types";
import { clamp, H, quand, rnd, W } from "./outils";
import { Cadre, Ciel, Etoiles, Halo, Poussieres, Rayons } from "./ayati";
import { Kaaba, Montagnes } from "./fil";
import { Silhouette } from "./personnages";

const OR = "#F7C04A";

/** Le mont de la Lumière (Jabal an-Nour) avec la grotte de Hira, éclairée ou non. */
const JabalNour: React.FC<{ x: number; base: number; s: number; lueur: number; c?: string }> = ({ x, base, s, lueur, c = "#0d0b1a" }) => (
  <g>
    <path d={`M${x - 560 * s},${base} L${x - 170 * s},${base - 420 * s} L${x - 60 * s},${base - 520 * s} L${x + 30 * s},${base - 470 * s} L${x + 220 * s},${base - 300 * s} L${x + 600 * s},${base} Z`} fill={c} />
    <Halo id={"hira" + Math.round(x)} x={x - 40 * s} y={base - 430 * s} r={260 * s} c="#ffd98a" o={0.75 * lueur} />
    <path d={`M${x - 70 * s},${base - 410 * s} Q${x - 40 * s},${base - 470 * s} ${x - 10 * s},${base - 410 * s} Z`} fill="#ffcf7a" opacity={0.25 + 0.75 * lueur} />
    {/* sentier */}
    <path d={`M${x + 380 * s},${base} Q${x + 120 * s},${base - 160 * s} ${x - 30 * s},${base - 400 * s}`} stroke="#3a3350" strokeWidth={4 * s} fill="none" strokeDasharray={`${10 * s} ${10 * s}`} />
  </g>
);

const HiraNuit: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const vie = quand(plan, "vie", 0, d - 40);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [vie, 1.12, 0, -40], [d, 1.2, 0, -80]]}>
      <Ciel id="hn" stops={[[0, "#02030c"], [0.55, "#0c1236"], [1, "#1c1c3e"]]} />
      <Etoiles n={320} bas={1300} graine="hn" />
      {/* la Voie lactée */}
      <path d="M-100,200 Q540,700 1200,1100" stroke="#cbd3ff" strokeWidth={180} opacity={0.06} fill="none" />
      <circle cx={820} cy={300} r={36} fill="#f4efdc" />
      <JabalNour x={560} base={1500} s={1.4} lueur={interpolate(f, [vie - 20, vie + 20], [0.15, 0.55], clamp)} />
      <rect y={1500} width={W} height={420} fill="#07060f" />
      {/* les lumières lointaines de La Mecque */}
      {Array.from({ length: 40 }).map((_, i) => (
        <circle key={i} cx={rnd("ml" + i) * W} cy={1560 + rnd("my" + i) * 120} r={2 + rnd("mr" + i) * 2} fill="#ffcf7a" opacity={0.4 + 0.4 * Math.sin(f / 9 + i)} />
      ))}
    </Cadre>
  );
};

const HiraGrotte: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const hira = quand(plan, "Hira", 0, d / 2);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [hira, 1.25, 80, 120], [d, 1.45, 90, 180]]}>
      <Ciel id="hg" stops={[[0, "#03040f"], [0.6, "#121a44"], [1, "#2a2448"]]} />
      <Etoiles n={260} bas={1100} graine="hg" />
      <Montagnes base={1500} c="#141228" graine="hgm" hauteur={420} />
      <JabalNour x={560} base={1650} s={2.0} lueur={interpolate(f, [hira - 10, hira + 30], [0.2, 0.7], clamp)} c="#0a0816" />
      {/* un homme, de loin et de dos, gravit le sentier (aucun visage, aucun détail) */}
      <Silhouette x={interpolate(f, [0, d], [880, 760], clamp)} y={interpolate(f, [0, d], [1560, 1390], clamp)} h={70} role="vieil" c="#05040a" liseré="#ffcf7a" marche o={interpolate(f, [hira, hira + 20], [1, 0], clamp)} />
      <Poussieres n={30} c="#ffe2a0" graine="hgp" haut={500} bas={1500} />
    </Cadre>
  );
};

const HiraLumiere: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const jibril = quand(plan, "Jibril", 0, 30);
  const lis = quand(plan, "Lis", 0, 70);
  const descente = interpolate(f, [jibril - 10, lis], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const eclat = interpolate(f, [lis, lis + 4, lis + 40], [0, 1, 0.45], clamp);
  return (
    <Cadre cles={[[0, 1.3, 70, 150], [lis, 1.45, 80, 190], [d, 1.15, 40, 80]]}>
      <Ciel id="hl" stops={[[0, "#04061a"], [0.6, "#16205a"], [1, "#2e2a5a"]]} />
      <Etoiles n={260} bas={1100} graine="hl" />
      {/* la lumière descend du ciel vers la grotte */}
      <path d={`M${500 - 30},0 L${500 + 30},0 L${532},${180 + descente * 1060} L${448},${180 + descente * 1060} Z`} fill="#fff3c4" opacity={0.15 + 0.5 * descente} />
      <Halo id="hlb" x={490} y={180 + descente * 1060} r={260} c="#fff0c0" o={0.6 * descente} />
      <Rayons x={480} y={1230} c="#fff4d0" o={0.22 * eclat} />
      <JabalNour x={560} base={1650} s={2.0} lueur={0.5 + eclat * 0.5} c="#0a0816" />
      <rect width={W} height={H} fill="#fff8e0" opacity={eclat * 0.25} />
      <Poussieres n={60} c="#fff0c0" graine="hlp" haut={300} bas={1600} />
    </Cadre>
  );
};

const QadrCiel: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const aube = interpolate(f, [d * 0.72, d], [0, 1], clamp); // « jusqu'à l'apparition de l'aube »
  return (
    <Cadre cles={[[0, 1.1, 0, 60], [d, 1.0, 0, 0]]}>
      <Ciel id="qc" stops={[[0, "#03040f"], [0.6, "#0f1640"], [1, "#2a2248"]]} />
      <g opacity={aube}>
        <Ciel id="qca" stops={[[0, "#1b2a5a"], [0.6, "#8a5a7a"], [1, "#f2a870"]]} />
      </g>
      <Etoiles n={360} bas={1500} graine="qc" />
      {/* des traits de lumière innombrables qui descendent, paisibles */}
      {Array.from({ length: 90 }).map((_, i) => {
        const vitesse = 3 + rnd("qv" + i) * 5;
        const x = rnd("qx" + i) * W;
        const y = ((rnd("qy" + i) * 1800 + f * vitesse) % 2000) - 100;
        const l = 60 + rnd("ql" + i) * 140;
        return <line key={i} x1={x} y1={y} x2={x - 8} y2={y - l} stroke="#fff3c4" strokeWidth={2.5} opacity={0.35 + 0.4 * rnd("qo" + i)} />;
      })}
      <Montagnes base={1600} c="#0a0a1c" graine="qcm" hauteur={360} />
      <Kaaba x={540} y={1640} t={1.1} lueur={0.55 + aube * 0.3} />
      <rect y={1640} width={W} height={300} fill="#06060f" />
    </Cadre>
  );
};

const QadrAube: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.12, 0, -50]]}>
      <Ciel id="qa" stops={[[0, "#2b3d78"], [0.55, "#c47a6a"], [1, "#f5c08a"]]} />
      <Halo id="qas" x={540} y={1150} r={640} c="#ffe2b0" o={0.6} />
      <Montagnes base={1420} c="#4a3048" graine="qam" hauteur={340} />
      <Kaaba x={540} y={1460} t={1.3} lueur={0.8} />
      {/* des rangs de fidèles, de dos */}
      {Array.from({ length: 3 }).map((_, r) =>
        Array.from({ length: 9 }).map((__, i) => (
          <Silhouette key={r + "-" + i} x={70 + i * 118 + (r % 2) * 50} y={1640 + r * 110} h={150 + r * 40} role={i % 3 ? "vieil" : "mere"} c="#170f18" liseré="#ffd9a0" phase={i + r} />
        )),
      )}
      <Poussieres n={40} c="#fff0c8" graine="qap" haut={600} bas={1500} />
    </Cadre>
  );
};

/** Les dix dernières nuits de Ramadan : les nuits impaires s'allument. */
const QadrNuits: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const impaires = quand(plan, "impaires", 0, d / 3);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.06, 0, -30]]}>
      <Ciel id="qn" stops={[[0, "#03040f"], [0.6, "#0f1640"], [1, "#1c1c3e"]]} />
      <Etoiles n={240} bas={H} graine="qn" />
      {Array.from({ length: 10 }).map((_, i) => {
        const nuit = 21 + i;
        const impaire = nuit % 2 === 1;
        const x = 150 + (i % 5) * 195;
        const y = 600 + Math.floor(i / 5) * 300;
        const allume = impaire ? interpolate(f, [impaires + i * 3, impaires + i * 3 + 12], [0, 1], clamp) : 0;
        return (
          <g key={i}>
            <Halo id={"qn" + i} x={x} y={y} r={150} c="#ffd98a" o={0.7 * allume} />
            <circle cx={x} cy={y} r={70} fill={allume > 0 ? OR : "#2a2f5a"} opacity={0.35 + 0.65 * Math.max(allume, impaire ? 0 : 0.5)} />
            <circle cx={x + 26} cy={y - 14} r={62} fill="#0c1236" opacity={1 - allume * 0.0} />
            <text x={x} y={y + 130} textAnchor="middle" fontFamily="Montserrat" fontWeight={800} fontSize={46} fill={allume > 0.5 ? OR : "#8a8fb8"}>{nuit}</text>
          </g>
        );
      })}
    </Cadre>
  );
};

export const ScenesQadr: Record<string, React.FC<SceneProps>> = {
  hira_nuit: HiraNuit,
  hira_grotte: HiraGrotte,
  hira_lumiere: HiraLumiere,
  qadr_ciel: QadrCiel,
  qadr_aube: QadrAube,
  qadr_nuits: QadrNuits,
};
