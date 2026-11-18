/**
 * Ayati — l'armée de l'éléphant (sourate Al-Fil). Décors SVG animés, sans aucun prophète représenté.
 * Personnages vus de dos ou en silhouette lointaine, sans visage.
 */
import React from "react";
import { interpolate, useCurrentFrame, Easing } from "remotion";
import type { SceneProps } from "./types";
import { clamp, H, quand, rnd, W } from "./outils";
import { Brume, Cadre, Ciel, Etoiles, Flamme, Halo, Poussieres, Rayons } from "./ayati";
import { Silhouette } from "./personnages";

// ------------------------------------------------------------------ éléments
/** Éléphant de profil (tourné vers la droite). x,y = pieds ; h = hauteur au garrot ×1. */
export const Elephant: React.FC<{
  x: number;
  y: number;
  h: number;
  c?: string;
  lisere?: string;
  marche?: boolean;
  phase?: number;
  agenouille?: number; // 0 → 1
  palanquin?: boolean;
  miroir?: boolean;
}> = ({ x, y, h, c = "#14090b", lisere = "#ff9d5c", marche = false, phase = 0, agenouille = 0, palanquin = false, miroir = false }) => {
  const f = useCurrentFrame();
  const k = h / 100;
  const pas = marche ? Math.sin(f / 9 + phase) : 0;
  const bob = marche ? Math.abs(pas) * 1.5 : 0;
  const trompe = Math.sin(f / 17 + phase) * 4;
  const avant = 1 - agenouille * 0.55; // pattes avant pliées
  const bascule = agenouille * 14;
  const forme = (
    <g transform={`rotate(${bascule} -40 0)`}>
      {/* pattes arrière */}
      <rect x={-38} y={-38} width={15} height={38} rx={5} transform={`rotate(${pas * 7} -30 -38)`} />
      <rect x={-20} y={-38} width={15} height={38} rx={5} transform={`rotate(${-pas * 7} -12 -38)`} />
      {/* pattes avant (se plient quand il s'agenouille) */}
      <rect x={14} y={-38} width={15} height={38 * avant} rx={5} transform={`rotate(${-pas * 7 + agenouille * 50} 21 -38)`} />
      <rect x={30} y={-38} width={15} height={38 * avant} rx={5} transform={`rotate(${pas * 7 + agenouille * 50} 37 -38)`} />
      {/* corps, tête, oreille, trompe, queue */}
      <ellipse cx={0} cy={-58} rx={50} ry={31} />
      <circle cx={44} cy={-66} r={21} />
      <path d={`M58,-60 Q${72 + trompe},-38 ${64 + trompe},-6 L${56 + trompe},-6 Q${62 + trompe},-38 50,-56 Z`} />
      <path d={`M-48,-62 Q-60,-48 -58,-34`} stroke="currentColor" strokeWidth={3} fill="none" />
      {palanquin ? (
        <>
          <rect x={-24} y={-104} width={44} height={18} rx={3} />
          <path d={`M-28,-104 L-2,-122 L24,-104 Z`} />
        </>
      ) : null}
    </g>
  );
  return (
    <g transform={`translate(${x} ${y - bob * k}) scale(${miroir ? -k : k} ${k})`}>
      <g fill={lisere} color={lisere} transform="translate(-1.4 -1)" opacity={0.85}>
        {forme}
      </g>
      <g fill={c} color={c}>
        {forme}
        <ellipse cx={36} cy={-64} rx={14} ry={19} fill={c} opacity={0.9} />
        <path d="M58,-50 Q70,-46 76,-36" stroke="#e9dcc2" strokeWidth={3.5} fill="none" strokeLinecap="round" />
      </g>
    </g>
  );
};

/** La Kaaba, vue de trois quarts. */
export const Kaaba: React.FC<{ x: number; y: number; t: number; lueur?: number }> = ({ x, y, t, lueur = 0.6 }) => {
  const w = 120 * t;
  const h = 130 * t;
  const p = 46 * t; // profondeur
  return (
    <g>
      <Halo id={"kb" + Math.round(x)} x={x} y={y - h * 0.6} r={420 * t} c="#ffd98a" o={lueur} />
      <path d={`M${x - w / 2},${y} L${x + w / 2},${y} L${x + w / 2},${y - h} L${x - w / 2},${y - h} Z`} fill="#0b0b10" />
      <path d={`M${x + w / 2},${y} L${x + w / 2 + p},${y - p * 0.45} L${x + w / 2 + p},${y - h - p * 0.45} L${x + w / 2},${y - h} Z`} fill="#16161d" />
      <path d={`M${x - w / 2},${y - h} L${x + w / 2},${y - h} L${x + w / 2 + p},${y - h - p * 0.45} L${x - w / 2 + p},${y - h - p * 0.45} Z`} fill="#22222b" />
      <rect x={x - w / 2} y={y - h * 0.78} width={w} height={h * 0.09} fill="#d4a548" />
      <path d={`M${x + w / 2},${y - h * 0.78} L${x + w / 2 + p},${y - h * 0.78 - p * 0.45} L${x + w / 2 + p},${y - h * 0.69 - p * 0.45} L${x + w / 2},${y - h * 0.69} Z`} fill="#a9822f" />
    </g>
  );
};

export const Dunes: React.FC<{ y: number; couleurs: string[]; decal?: number }> = ({ y, couleurs, decal = 0 }) => (
  <g>
    {couleurs.map((c, i) => {
      const yy = y + i * 120;
      const ph = i * 1.7 + decal * (i + 1) * 0.002;
      const pts = Array.from({ length: 13 }).map((_, k) => {
        const x = (k / 12) * (W + 200) - 100;
        return `${x},${yy + Math.sin(k * 0.9 + ph) * 40 + Math.sin(k * 2.3 + ph) * 14}`;
      });
      return <path key={i} d={`M-100,${H} L${pts.join(" L")} L${W + 100},${H} Z`} fill={c} />;
    })}
  </g>
);

export const Montagnes: React.FC<{ base: number; c: string; graine: string; hauteur?: number }> = ({ base, c, graine, hauteur = 520 }) => {
  const pts: string[] = [];
  for (let k = 0; k <= 10; k++) {
    const x = (k / 10) * (W + 200) - 100;
    const h = (k % 2 ? 0.55 : 1) * hauteur * (0.6 + 0.4 * rnd(graine + k));
    pts.push(`${x},${base - h}`);
  }
  return <path d={`M-100,${H} L${pts.join(" L")} L${W + 100},${H} Z`} fill={c} />;
};

export const Oiseau: React.FC<{ x: number; y: number; s: number; f: number; c?: string; pierre?: boolean }> = ({ x, y, s, f, c = "#0c0a10", pierre }) => {
  const a = Math.sin(f / 2.2 + x * 0.01) * 9 * s;
  return (
    <g>
      <path d={`M${x - 16 * s},${y - a} Q${x - 7 * s},${y - 5 * s} ${x},${y} Q${x + 7 * s},${y - 5 * s} ${x + 16 * s},${y - a}`} stroke={c} strokeWidth={3.2 * s} fill="none" strokeLinecap="round" />
      {pierre ? <circle cx={x} cy={y + 5 * s} r={2.6 * s} fill="#ffcf8a" /> : null}
    </g>
  );
};

const Chameau: React.FC<{ x: number; y: number; h: number; c: string; phase?: number }> = ({ x, y, h, c, phase = 0 }) => {
  const f = useCurrentFrame();
  const k = h / 100;
  const tete = Math.sin(f / 25 + phase) * 3;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`} fill={c}>
      {[-30, -18, 14, 26].map((lx) => (
        <rect key={lx} x={lx} y={-46} width={7} height={46} rx={3} />
      ))}
      <ellipse cx={-2} cy={-56} rx={40} ry={16} />
      <ellipse cx={-6} cy={-74} rx={16} ry={14} />
      <path d={`M30,-60 Q44,-80 ${48 + tete},-92 L${60 + tete},-92 L${58 + tete},-84 L${50 + tete},-84 Q42,-70 36,-52 Z`} />
    </g>
  );
};

const Tente: React.FC<{ x: number; y: number; s: number; c: string; lumiere?: boolean }> = ({ x, y, s, c, lumiere }) => (
  <g>
    {lumiere ? <Halo id={"te" + Math.round(x)} x={x} y={y - 60 * s} r={220 * s} c="#ff9d3b" o={0.5} /> : null}
    <path d={`M${x - 120 * s},${y} L${x},${y - 140 * s} L${x + 120 * s},${y} Z`} fill={c} />
    {lumiere ? <path d={`M${x - 20 * s},${y} L${x},${y - 60 * s} L${x + 20 * s},${y} Z`} fill="#ffb760" /> : null}
  </g>
);

// ------------------------------------------------------------------ scènes
const Marche: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const ciel = quand(plan, "ciel", 0, d - 30);
  const avance = interpolate(f, [0, d], [-120, 380]);
  return (
    <Cadre cles={[[0, 1.06, 0, 0], [d, 1.16, -30, -60]]}>
      <Ciel id="fm" stops={[[0, "#2a0f1e"], [0.45, "#a4401f"], [0.7, "#f08a46"], [1, "#f6c27a"]]} />
      <Halo id="fms" x={760} y={1020} r={560} c="#ffd7a0" o={0.8} />
      <circle cx={760} cy={1020} r={130} fill="#ffe8c4" />
      {/* présage : quelques oiseaux au loin quand on parle du ciel */}
      {f > ciel ? Array.from({ length: 9 }).map((_, i) => (
        <Oiseau key={i} x={980 - (f - ciel) * 2.2 - i * 40} y={260 + (i % 3) * 30} s={0.5} f={f + i * 3} c="#2a0f1e" />
      )) : null}
      <Dunes y={1120} couleurs={["#b8562b", "#8e3b1f", "#5e2416"]} />
      {/* colonne de l'armée au loin */}
      {Array.from({ length: 10 }).map((_, i) => {
        const x = ((f * 0.9 + i * 150) % 1500) - 200;
        return i % 3 === 0 ? (
          <Elephant key={i} x={x} y={1205} h={90} c="#3a1510" lisere="#ffb07a" marche phase={i} />
        ) : (
          <Silhouette key={i} x={x} y={1205} h={80} role="soldat" c="#3a1510" liseré="#ffb07a" marche phase={i} lance={10} />
        );
      })}
      <Brume y={1230} c="#ffb27a" o={0.25} graine="fm" />
      <Elephant x={avance} y={1820} h={620} marche palanquin c="#140708" lisere="#ff9d5c" />
      <Poussieres n={40} c="#ffd0a0" graine="fmp" haut={900} bas={1900} />
    </Cadre>
  );
};

const Sanaa: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const eglise = quand(plan, "église", 0, d / 2);
  const lumiere = interpolate(f, [eglise - 5, eglise + 20], [0.2, 1], clamp);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [eglise, 1.08, 0, -40], [d, 1.15, -40, -80]]}>
      <Ciel id="sa" stops={[[0, "#070a1c"], [0.6, "#1d2350"], [1, "#3a2d55"]]} />
      <Etoiles n={140} bas={900} graine="sa" />
      {/* maisons-tours de Sanaa */}
      {Array.from({ length: 7 }).map((_, i) => {
        const x = i * 170 - 40;
        const h = 420 + rnd("sah" + i) * 300;
        return (
          <g key={i}>
            <rect x={x} y={1350 - h} width={140} height={h} fill="#2a2440" />
            {Array.from({ length: Math.floor(h / 90) }).map((_, r) => (
              <g key={r}>
                <rect x={x + 30} y={1350 - h + 40 + r * 90} width={26} height={34} rx={13} fill={rnd("saw" + i + r) < 0.4 ? "#ffcf7a" : "#4a4166"} />
                <rect x={x + 84} y={1350 - h + 40 + r * 90} width={26} height={34} rx={13} fill={rnd("saz" + i + r) < 0.3 ? "#ffcf7a" : "#4a4166"} />
                <rect x={x + 10} y={1350 - h + 90 + r * 90} width={120} height={5} fill="#e8e0f0" opacity={0.35} />
              </g>
            ))}
          </g>
        );
      })}
      {/* la grande église au centre */}
      <Halo id="sae" x={540} y={900} r={560} c="#ffcf7a" o={0.45 * lumiere} />
      <g fill="#120f22">
        <rect x={290} y={820} width={500} height={560} />
        <path d="M380,820 Q540,560 700,820 Z" />
        <rect x={250} y={640} width={80} height={740} />
        <rect x={750} y={640} width={80} height={740} />
        {[0, 1, 2, 3].map((k) => (
          <path key={k} d={`M${330 + k * 110},1380 L${330 + k * 110},1180 Q${370 + k * 110},1120 ${410 + k * 110},1180 L${410 + k * 110},1380 Z`} fill="#ffcf7a" opacity={0.25 + 0.6 * lumiere} />
        ))}
      </g>
      <rect y={1350} width={W} height={600} fill="#0b0915" />
      <Flamme x={210} y={1420} t={0.8} graine="sa1" />
      <Flamme x={870} y={1420} t={0.8} graine="sa2" />
      <Silhouette x={760} y={1960} h={720} role="chef" c="#05040a" liseré="#ffcf7a" />
    </Cadre>
  );
};

const Armee: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const geant = quand(plan, "géant", 0, d - 40);
  const g = interpolate(f, [geant - 10, geant + 25], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [geant, 1.05, 0, 0], [geant + 30, 1.22, 60, 80], [d, 1.25, 60, 90]]}>
      <Ciel id="ar" stops={[[0, "#5a2a1a"], [0.5, "#d0763a"], [1, "#f3c27c"]]} />
      <Halo id="ars" x={300} y={760} r={420} c="#fff0c8" o={0.7} />
      <Dunes y={1000} couleurs={["#c7743e", "#a35a2f"]} />
      {[0, 1, 2].map((rang) => (
        <g key={rang}>
          {Array.from({ length: 12 }).map((_, i) => {
            const v = 1.2 + rang * 0.8;
            const x = ((f * v + i * 130 + rang * 60) % 1700) - 300;
            const y = 1180 + rang * 170;
            const h = 70 + rang * 45;
            const c = ["#5b2b17", "#3d1b0e", "#22100a"][rang];
            return i % 4 === 0 ? (
              <Elephant key={i} x={x} y={y} h={h * 1.2} c={c} lisere="#ffc28a" marche phase={i + rang} palanquin={rang > 0} />
            ) : (
              <Silhouette key={i} x={x} y={y} h={h} role="soldat" c={c} liseré="#ffc28a" marche phase={i + rang} lance={8} />
            );
          })}
        </g>
      ))}
      <Brume y={1500} c="#f3b07a" o={0.3} graine="ar" />
      {/* l'éléphant géant, devant l'armée */}
      <g opacity={g}>
        <Elephant x={330 + f * 0.6} y={1900} h={760} c="#0e0505" lisere="#ffd29a" marche palanquin />
      </g>
      <Poussieres n={60} c="#ffe0b0" graine="arp" haut={1000} bas={1900} />
    </Cadre>
  );
};

const Mecque: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const fuite = quand(plan, "quittent", 0, d / 2);
  return (
    <Cadre cles={[[0, 1.2, 0, -120], [fuite, 1.05, 0, -40], [d, 1.0, 0, 0]]}>
      <Ciel id="me" stops={[[0, "#1b1530"], [0.55, "#6a3a4a"], [1, "#d98a5a"]]} />
      <Etoiles n={60} bas={600} graine="me" />
      <Montagnes base={1250} c="#3a2232" graine="m1" hauteur={600} />
      <Montagnes base={1450} c="#2a1825" graine="m2" hauteur={520} />
      {/* la vallée et la ville */}
      <path d="M-40,1500 Q540,1330 1120,1500 L1120,1920 L-40,1920 Z" fill="#4a2d30" />
      {Array.from({ length: 14 }).map((_, i) => (
        <rect key={i} x={300 + (i % 7) * 70} y={1450 - 60 - (i > 6 ? 40 : 0)} width={52} height={60} fill="#5c3a3a" />
      ))}
      <Kaaba x={540} y={1470} t={0.9} lueur={0.55} />
      {/* les habitants montent vers les montagnes */}
      {f > fuite - 10
        ? Array.from({ length: 22 }).map((_, i) => {
            const p = interpolate(f - fuite - i * 4, [0, 160], [0, 1], clamp);
            const cote = i % 2 ? 1 : -1;
            const x = 540 + cote * (120 + p * 340 + (i % 5) * 18);
            const y = 1480 - p * 420 - (i % 4) * 14;
            return <Silhouette key={i} x={x} y={y} h={46} role={i % 3 ? "mere" : "vieil"} c="#1a0f16" liseré="#ffb08a" marche phase={i} />;
          })
        : null}
      <Brume y={1500} c="#d98a5a" o={0.2} graine="me" />
    </Cadre>
  );
};

const Chameaux: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const parole = quand(plan, "Je", 0, d - 150); // « Je suis le maître de mes chameaux… »
  if (f >= parole - 4) {
    return (
      <Cadre cles={[[parole - 4, 1.25, 0, 60], [d, 1.0, 0, 0]]}>
        <Ciel id="chn" stops={[[0, "#03050f"], [0.6, "#0e1736"], [1, "#1e2346"]]} />
        <Etoiles n={220} bas={1300} graine="chn" />
        <Rayons x={540} y={1130} c="#ffe2a0" o={0.1} />
        <Montagnes base={1500} c="#0b0e1f" graine="chm" hauteur={420} />
        <Kaaba x={540} y={1520} t={2.4} lueur={0.75} />
        <rect y={1520} width={W} height={400} fill="#0a0c18" />
        <Poussieres n={50} c="#ffe2a0" graine="chp" />
      </Cadre>
    );
  }
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [parole, 1.15, -60, -60]]}>
      <Ciel id="ch" stops={[[0, "#1a1028"], [0.55, "#7a3a3a"], [1, "#e0905a"]]} />
      <Halo id="chs" x={200} y={1100} r={500} c="#ffc890" o={0.5} />
      <Dunes y={1250} couleurs={["#6a3528", "#4a2420"]} />
      <Tente x={760} y={1420} s={1.6} c="#1c0e10" lumiere />
      <Tente x={300} y={1360} s={0.9} c="#2a1418" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Chameau key={i} x={120 + i * 150} y={1560 + (i % 2) * 30} h={110} c="#1f0f10" phase={i} />
      ))}
      {/* Abdel-Mouttalib s'avance vers la tente d'Abraha */}
      <Silhouette x={interpolate(f, [0, d * 0.6], [380, 600], clamp)} y={1850} h={480} role="vieil" c="#0a0506" liseré="#ffc890" marche={f < d * 0.6} />
      <Silhouette x={790} y={1500} h={230} role="chef" c="#0a0506" liseré="#ffb760" miroir />
    </Cadre>
  );
};

const ElephantAgenouille: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const genou = quand(plan, "s'agenouille", 0, 80);
  const a = interpolate(f, [genou, genou + 22], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const frappe = quand(plan, "frappent", 0, 140);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [genou, 1.1, 0, -40], [genou + 40, 1.25, 40, -80], [d, 1.3, 40, -90]]}>
      <Ciel id="el" stops={[[0, "#3a2a4a"], [0.55, "#c46a4a"], [1, "#f2b27a"]]} />
      <Halo id="elk" x={930} y={1260} r={300} c="#fff0c0" o={0.8} />
      <Kaaba x={930} y={1300} t={0.45} lueur={0.9} />
      <Dunes y={1300} couleurs={["#9a5236", "#743c28"]} />
      <Elephant x={430} y={1720} h={700} c="#0c0506" lisere="#ffcf9a" marche={f < genou} agenouille={a} palanquin />
      {Array.from({ length: 4 }).map((_, i) => (
        <Silhouette key={i} x={120 + i * 90} y={1800 + (i % 2) * 40} h={360} role="soldat" c="#120709" liseré="#ffcf9a"
          lance={f > frappe ? -20 + Math.sin((f - frappe) / 7 + i) * 18 : 10} bras={f > frappe ? 0.8 : 0.2} phase={i} />
      ))}
      <Poussieres n={40} c="#ffe0b0" graine="elp" haut={1200} bas={1900} />
    </Cadre>
  );
};

const Oiseaux: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const arrivee = quand(plan, "d'oiseaux", 0, 30) - 20;
  const sombre = interpolate(f, [arrivee, arrivee + 60], [0, 0.55], clamp);
  const paille = interpolate(f, [d * 0.72, d * 0.9], [0, 1], clamp);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [arrivee + 40, 1.08, 0, 40], [d, 1.15, 0, 60]]}>
      <Ciel id="oi" stops={[[0, "#3b2440"], [0.55, "#b8603e"], [1, "#efad72"]]} />
      <rect width={W} height={H} fill="#05030a" opacity={sombre} />
      <Dunes y={1450} couleurs={["#7a3e2a", "#55281c"]} />
      {/* l'armée en bas */}
      {Array.from({ length: 14 }).map((_, i) => {
        const x = 40 + i * 78;
        return i % 4 === 1 ? (
          <Elephant key={i} x={x} y={1640 + (i % 2) * 40} h={110} c="#1a0b0b" lisere="#ffb07a" />
        ) : (
          <Silhouette key={i} x={x} y={1660 + (i % 2) * 40} h={110} role="soldat" c="#1a0b0b" liseré="#ffb07a" lance={-30 + (i % 3) * 25} />
        );
      })}
      {/* les volées d'oiseaux et leurs pierres */}
      {Array.from({ length: 170 }).map((_, i) => {
        const t0 = arrivee + rnd("ob" + i) * Math.max(60, d * 0.75);
        const dt = f - t0;
        if (dt < 0) return null;
        const v = 4 + rnd("ov" + i) * 4;
        const x = W + 60 - dt * v;
        if (x < -80) return null;
        const y = 180 + rnd("oy" + i) * 820 + Math.sin(dt / 14 + i) * 18;
        const s = 0.7 + rnd("os" + i) * 0.9;
        const largue = 40 + rnd("ol" + i) * 60;
        return (
          <g key={i}>
            <Oiseau x={x} y={y} s={s} f={f + i} pierre={dt < largue} />
            {dt >= largue && dt < largue + 50 ? (
              <line x1={x + (dt - largue) * v} y1={y + (dt - largue) * 22} x2={x + (dt - largue) * v + 4} y2={y + (dt - largue) * 22 - 26} stroke="#ffcf8a" strokeWidth={3} opacity={0.9} />
            ) : null}
          </g>
        );
      })}
      {/* « semblables à une paille mâchée » : la fin de la récitation */}
      <g opacity={paille}>
        {Array.from({ length: 120 }).map((_, i) => {
          const x = rnd("px" + i) * W;
          const y = 1500 + rnd("py" + i) * 400;
          const a = rnd("pa" + i) * 180;
          return <line key={i} x1={x} y1={y} x2={x + Math.cos(a) * 22} y2={y + Math.sin(a) * 6} stroke="#d9b06a" strokeWidth={3} opacity={0.6} />;
        })}
      </g>
      <Poussieres n={50} c="#ffcf8a" graine="oip" />
    </Cadre>
  );
};

const Aube: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const leve = interpolate(f, [0, Math.min(d, 360)], [0, 1], clamp);
  return (
    <Cadre cles={[[0, 1.15, 0, -60], [d, 1.0, 0, 0]]}>
      <Ciel id="au" stops={[[0, "#4f78b4"], [0.55, "#f2b27a"], [1, "#ffdca8"]]} />
      <Rayons x={540} y={1120 - leve * 300} c="#fff4d0" o={0.15} />
      <Halo id="aus" x={540} y={1120 - leve * 300} r={700} c="#fff0c4" o={0.75} />
      <circle cx={540} cy={1120 - leve * 300} r={110} fill="#fff7e2" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Oiseau key={i} x={((f * (2 + i * 0.3) + i * 150) % 1400) - 160} y={360 + i * 36} s={0.7} f={f + i} c="#4a3030" />
      ))}
      <Montagnes base={1350} c="#a8664a" graine="au1" hauteur={380} />
      <path d="M0,1400 Q540,1330 1080,1400 L1080,1920 L0,1920 Z" fill="#c98a5a" />
      <Kaaba x={540} y={1480} t={1.4} lueur={0.9} />
      <rect y={1480} width={W} height={440} fill="#b07446" />
      <Poussieres n={36} c="#fff4d0" graine="aup" />
    </Cadre>
  );
};

export const ScenesFil: Record<string, React.FC<SceneProps>> = {
  fil_marche: Marche,
  fil_sanaa: Sanaa,
  fil_armee: Armee,
  fil_mecque: Mecque,
  fil_chameaux: Chameaux,
  fil_elephant: ElephantAgenouille,
  fil_oiseaux: Oiseaux,
  fil_aube: Aube,
};
