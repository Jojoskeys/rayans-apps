/**
 * Ayati — deux récits de la sourate Al-Qasas : Qâroûn (28:76-82) et la tour de Pharaon (28:38-40).
 * Aucun prophète représenté (Moussa n'apparaît jamais). Silhouettes sans visage, lumière et décors.
 */
import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import type { SceneProps } from "./types";
import { clamp, H, prog, quand, rnd, W } from "./outils";
import { Brume, Cadre, Ciel, Coffre2, Etoiles, Flamme, Fleuve, Halo, Maisons, Palais, Poussieres, Rayons } from "./ayati";
import { Silhouette } from "./personnages";

const OR = "#f5c25a";
const OR_PALE = "#ffe2a0";
const NUIT = "#0b0a10";

/** Pièces d'or en tas. */
const TasOr: React.FC<{ x: number; y: number; l: number; h: number; graine: string; brille?: number }> = ({ x, y, l, h, graine, brille = 1 }) => {
  const f = useCurrentFrame();
  return (
    <g>
      <path d={`M${x - l / 2},${y} Q${x},${y - h * 2} ${x + l / 2},${y} Z`} fill="#b07d22" />
      {Array.from({ length: Math.round(l / 9) }).map((_, i) => {
        const u = rnd(graine + i) - 0.5;
        const px = x + u * l * 0.9;
        const py = y - (1 - (2 * u) ** 2) * h * rnd(graine + "y" + i) - 6;
        const o = 0.6 + 0.4 * Math.sin(f / 6 + i);
        return <ellipse key={i} cx={px} cy={py} rx={13} ry={6} fill={rnd(graine + "c" + i) > 0.5 ? OR : "#e0a73a"} opacity={o * brille} />;
      })}
    </g>
  );
};

/** Grosse clé dorée. */
const Cle: React.FC<{ x: number; y: number; s: number; r?: number }> = ({ x, y, s, r = 0 }) => (
  <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} fill={OR}>
    <circle cx={0} cy={-40} r={22} fill="none" stroke={OR} strokeWidth={9} />
    <rect x={-5} y={-20} width={10} height={70} rx={3} />
    <rect x={5} y={30} width={18} height={8} />
    <rect x={5} y={44} width={12} height={8} />
  </g>
);

/** Tour de briques en construction (style ziggourat élancée). `p` = hauteur construite 0 → 1. */
const Tour: React.FC<{ x: number; base: number; h: number; p: number; c?: string; lisere?: string; feux?: boolean }> = ({ x, base, h, p, c = "#2a1410", lisere = "#ff9d5c", feux }) => {
  const etages = 9;
  const vis = Math.max(1, Math.round(etages * p));
  return (
    <g>
      {Array.from({ length: vis }).map((_, i) => {
        const l0 = 520 - i * 48;
        const hh = h / etages;
        const y = base - (i + 1) * hh;
        return (
          <g key={i}>
            <rect x={x - l0 / 2 - 3} y={y - 3} width={l0 + 6} height={hh} fill={lisere} opacity={0.7} />
            <rect x={x - l0 / 2} y={y} width={l0} height={hh} fill={c} />
            {Array.from({ length: 4 }).map((_, k) => (
              <rect key={k} x={x - l0 / 2 + 10} y={y + 14 + k * (hh / 4)} width={l0 - 20} height={2} fill="#000" opacity={0.25} />
            ))}
            {feux && i === vis - 1 ? <Flamme x={x - l0 / 2 + 30} y={y} t={0.45} graine={"tf" + i} /> : null}
          </g>
        );
      })}
      {/* échafaudage au sommet */}
      {p < 1 ? (
        <g stroke="#6b4a30" strokeWidth={5}>
          <line x1={x - 60} y1={base - (vis * h) / etages} x2={x - 60} y2={base - (vis * h) / etages - 140} />
          <line x1={x + 60} y1={base - (vis * h) / etages} x2={x + 60} y2={base - (vis * h) / etages - 140} />
          <line x1={x - 60} y1={base - (vis * h) / etages - 70} x2={x + 60} y2={base - (vis * h) / etages - 70} />
        </g>
      ) : null}
    </g>
  );
};

// =============================================================== Qâroûn
const Cles: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const englouti = quand(plan, "englouti", 0, d - 40);
  const sombre = prog(f, englouti - 6, englouti + 20);
  const marche = interpolate(f, [0, d], [-200, 160]);
  return (
    <Cadre cles={[[0, 1.12, 0, 40], [englouti, 1.0, 0, 0], [d, 1.04, 0, 0]]}>
      <Ciel id="qc" stops={[[0, "#0d0a1a"], [0.6, "#2a1530"], [1, "#4a2232"]]} />
      <Etoiles n={60} bas={900} graine="qc" />
      <Halo id="qch" x={540} y={1000} r={700} c={OR} o={0.35 * (1 - sombre)} />
      <rect x={0} y={1350} width={W} height={H - 1350} fill="#140c10" />
      {/* une bande d'hommes porte une perche chargée de clés */}
      <g transform={`translate(${marche} 0)`}>
        <path d={`M120,1050 Q520,${1110 + Math.sin(f / 8) * 8} 920,1050`} stroke="#6b4a30" strokeWidth={14} fill="none" />
        {Array.from({ length: 9 }).map((_, i) => (
          <Cle key={i} x={190 + i * 85} y={1130 + Math.sin(f / 8 + i) * 4 + (i % 2) * 12} s={1.15} r={Math.sin(f / 10 + i) * 6} />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <Silhouette key={i} x={150 + i * 150} y={1360} h={300} role="soldat" lance={-90} c={NUIT} liseré={OR_PALE} marche phase={i} bras={0.8} />
        ))}
      </g>
      {/* et un jour, la terre s'ouvre */}
      {f > englouti - 4 ? (
        <path d={`M0,1350 L300,1350 L${360 + sombre * 20},${1380 + sombre * 220} L420,1350 L${W},1350`} stroke="#000" strokeWidth={6 + sombre * 30} fill="none" />
      ) : null}
      <rect x={0} y={0} width={W} height={H} fill="#000" opacity={sombre * 0.45} />
      <Poussieres n={30} c={OR_PALE} graine="qcp" haut={700} bas={1500} />
    </Cadre>
  );
};

const Tresor: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const opprime = quand(plan, "opprime", 0, d * 0.4);
  const immenses = quand(plan, "immenses", 0, d * 0.8);
  const ouvre = prog(f, immenses - 10, immenses + 20);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.12, 0, -40]]}>
      <Ciel id="qt" stops={[[0, "#120a08"], [0.5, "#2d1a0e"], [1, "#4a2c12"]]} />
      {/* salle aux colonnes */}
      {[90, 330, 750, 990].map((x) => <rect key={x} x={x - 45} y={250} width={90} height={1200} fill="#1a0f08" />)}
      <Halo id="qth" x={540} y={1150} r={760} c={OR} o={0.55} />
      <TasOr x={250} y={1450} l={420} h={140} graine="qt1" />
      <TasOr x={840} y={1450} l={460} h={170} graine="qt2" />
      <TasOr x={540} y={1500} l={800} h={110} graine="qt3" />
      <Coffre2 x={230} y={1290} t={0.8} ouvert={ouvre} flotte={false} />
      <Coffre2 x={860} y={1270} t={0.8} ouvert={ouvre} flotte={false} rot={-4} />
      {/* Qâroûn, de dos, domine son trésor ; les siens, courbés, plus bas */}
      <Silhouette x={540} y={1400} h={430} role="chef" c={NUIT} liseré={OR_PALE} />
      {f > opprime
        ? Array.from({ length: 4 }).map((_, i) => (
            <Silhouette key={i} x={130 + i * 270} y={1760} h={300} role={i % 2 ? "vieil" : "servante"} c={NUIT} liseré="#a77a3a"
              o={interpolate(f, [opprime + i * 4, opprime + 14 + i * 4], [0, 1], clamp)} phase={i} />
          ))
        : null}
      <Poussieres n={50} c={OR_PALE} graine="qtp" haut={300} bas={1600} />
    </Cadre>
  );
};

const Conseil: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const savoir = quand(plan, "savoir", 0, d * 0.75);
  const orgueil = prog(f, savoir - 8, savoir + 14);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [savoir, 1.06, -40, 0], [d, 1.14, -60, -30]]}>
      <Ciel id="qk" stops={[[0, "#160d0a"], [0.6, "#2f1b10"], [1, "#3d2414"]]} />
      <Palais base={1380} c="#1c110b" echelle={0.85} />
      <rect x={0} y={1380} width={W} height={H - 1380} fill="#1a100a" />
      <Halo id="qkh" x={780} y={1100} r={300 + orgueil * 400} c={OR} o={0.4 + orgueil * 0.4} />
      {orgueil > 0 ? <Rayons x={780} y={1000} c={OR} o={0.16 * orgueil} /> : null}
      {/* les gens de son peuple, à gauche, le mettent en garde */}
      {[120, 260, 400].map((x, i) => (
        <Silhouette key={i} x={x} y={1500} h={300} role={i === 1 ? "vieil" : i ? "mere" : "vieil"} c={NUIT} liseré="#e2b780" bras={i === 1 ? 0.6 : 0.2} phase={i} />
      ))}
      <Silhouette x={790} y={1520} h={430} role="chef" c={NUIT} liseré={OR_PALE} miroir />
    </Cadre>
  );
};

const Cortege: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const recompense = quand(plan, "récompense", 0, d * 0.7);
  const avance = interpolate(f, [0, d], [-180, 520]);
  const sages = prog(f, recompense - 20, recompense + 10);
  return (
    <Cadre cles={[[0, 1.05, 0, 0], [recompense - 20, 1.0, 0, 0], [d, 1.1, 30, -40]]}>
      <Ciel id="qo" stops={[[0, "#3a1d12"], [0.5, "#a65a26"], [1, "#e3a45a"]]} />
      <Maisons sol={1150} c="#3a2015" graine="qo" />
      <rect x={0} y={1150} width={W} height={H - 1150} fill="#5a3218" />
      {/* le cortège doré traverse la ville */}
      <g transform={`translate(${avance} 0)`}>
        <Halo id="qoh" x={0} y={1050} r={420} c={OR} o={0.6} />
        {Array.from({ length: 5 }).map((_, i) => (
          <Silhouette key={i} x={-150 - i * 120} y={1290} h={230} role="soldat" c="#2a1208" liseré={OR} marche phase={i} lance={6} />
        ))}
        <Silhouette x={0} y={1310} h={330} role="chef" c="#1a0c06" liseré={OR_PALE} marche />
        {Array.from({ length: 8 }).map((_, i) => <Cle key={i} x={-60 + (i % 4) * 40} y={1000 - Math.floor(i / 4) * 50} s={0.35} r={f * 2 + i * 40} />)}
      </g>
      {/* la foule au premier plan, de dos */}
      {Array.from({ length: 6 }).map((_, i) => {
        const sage = i >= 4;
        return (
          <Silhouette key={i} x={90 + i * 180} y={1880} h={420} role={i % 2 ? "mere" : "vieil"} c={NUIT}
            liseré={sage ? interpolate(sages, [0, 1], [0, 1]) > 0.5 ? "#fff1c8" : "#e2b780" : "#e2b780"} bras={!sage ? 0.5 : 0} phase={i} />
        );
      })}
      {sages > 0 ? <Halo id="qos" x={900} y={1650} r={320} c="#fff1c8" o={0.35 * sages} /> : null}
      <Poussieres n={40} c={OR_PALE} graine="qop" haut={800} bas={1500} />
    </Cadre>
  );
};

const Engloutie: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const debut = Math.min(d * 0.2, 70);
  const p = interpolate(f, [debut, d * 0.75], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const tremble = p > 0 && p < 1 ? Math.sin(f * 1.9) * 7 * (1 - p * 0.5) : 0;
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.08, 0, 30]]}>
      <Ciel id="qe" stops={[[0, "#07060c"], [0.6, "#1c1020"], [1, "#2c1418"]]} />
      <Etoiles n={80} bas={1000} graine="qe" />
      <g transform={`translate(${tremble} 0)`}>
        <defs>
          <clipPath id="qeclip"><rect x={0} y={0} width={W} height={1400} /></clipPath>
        </defs>
        {/* la maison de Qâroûn s'enfonce dans la terre */}
        <g clipPath="url(#qeclip)">
          <g transform={`translate(0 ${p * 900})`}>
            <Halo id="qeh" x={540} y={1050} r={520} c={OR} o={0.5 * (1 - p)} />
            <Palais base={1400} c="#170d0a" echelle={0.95} />
            <Silhouette x={540} y={1400} h={230} role="chef" c={NUIT} liseré={OR_PALE} />
          </g>
        </g>
        <rect x={0} y={1400} width={W} height={H - 1400} fill="#1a0f0a" />
        <path d={`M0,1400 Q540,${1400 + p * 60} ${W},1400`} stroke="#000" strokeWidth={8 + p * 20} fill="none" />
      </g>
      <Brume y={1380} c="#8a6a50" o={0.5 * p} graine="qeb" />
      <Poussieres n={50} c="#c9a27a" graine="qep" haut={1000} bas={1500} />
    </Cadre>
  );
};

const Lendemain: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const allah = quand(plan, "Allah", 1, d * 0.6);
  const lumiere = prog(f, allah - 10, allah + 30);
  return (
    <Cadre cles={[[0, 1.1, 0, 20], [d, 1.0, 0, 0]]}>
      <Ciel id="ql" stops={[[0, "#2a2a4a"], [0.5, "#b7787a"], [1, "#f2c48d"]]} />
      <Halo id="qls" x={540} y={1180} r={600} c="#ffe0b0" o={0.5 + lumiere * 0.4} />
      <circle cx={540} cy={1180} r={90 + lumiere * 30} fill="#fff1d6" />
      {lumiere > 0 ? <Rayons x={540} y={1180} c="#fff1d6" o={0.15 * lumiere} /> : null}
      <rect x={0} y={1230} width={W} height={H - 1230} fill="#4a2c1a" />
      {/* là où se tenait la maison : un sol vide et fendu */}
      <path d="M260,1300 L420,1320 L540,1290 L660,1330 L820,1300" stroke="#1a0c06" strokeWidth={10} fill="none" />
      <ellipse cx={540} cy={1320} rx={300} ry={30} fill="#2a170c" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Silhouette key={i} x={140 + i * 200} y={1820} h={420} role={i % 2 ? "mere" : "vieil"} c={NUIT} liseré="#ffd9a6" phase={i} />
      ))}
      <Poussieres n={30} c="#fff1d6" graine="qlp" haut={700} bas={1400} />
    </Cadre>
  );
};

// =============================================================== La tour de Pharaon
const TourScene: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const pousse = prog(f, 0, d * 0.8, Easing.out(Easing.cubic));
  return (
    <Cadre cles={[[0, 1.15, 0, -60], [d, 1.08, 0, 60]]}>
      <Ciel id="tt" stops={[[0, "#170b1e"], [0.4, "#5a2032"], [0.75, "#c4552a"], [1, "#f09a4a"]]} />
      <Etoiles n={50} bas={600} graine="tt" />
      <Halo id="tth" x={540} y={300} r={500} c="#ffd7a0" o={0.25 + pousse * 0.25} />
      <Tour x={540} base={1500} h={1300} p={0.25 + pousse * 0.75} feux />
      <rect x={0} y={1500} width={W} height={H - 1500} fill="#2a120c" />
      {Array.from({ length: 10 }).map((_, i) => (
        <Silhouette key={i} x={60 + i * 110} y={1560 + (i % 2) * 20} h={110} role="servante" c="#1a0906" liseré="#ff9d5c" marche phase={i} bras={0.7} />
      ))}
      <Poussieres n={30} c="#ffcf9a" graine="ttp" haut={400} bas={1500} />
    </Cadre>
  );
};

const Trone: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const moi = quand(plan, "moi", 0, d * 0.8);
  const eclat = prog(f, moi - 6, moi + 12);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [moi, 1.08, 0, -20], [d, 1.14, 0, -40]]}>
      <Ciel id="tr" stops={[[0, "#120808"], [0.6, "#2c1210"], [1, "#401a12"]]} />
      {[110, 310, 770, 970].map((x) => <rect key={x} x={x - 50} y={200} width={100} height={1300} fill="#1c0c08" />)}
      <Halo id="trh" x={540} y={820} r={480 + eclat * 300} c="#ff8a3a" o={0.45 + eclat * 0.35} />
      {eclat > 0 ? <Rayons x={540} y={800} c="#ffb070" o={0.18 * eclat} /> : null}
      {/* marches et trône */}
      {[0, 1, 2, 3].map((k) => <rect key={k} x={240 + k * 40} y={1100 + k * 60} width={600 - k * 80} height={60} fill="#2a130c" />)}
      <Flamme x={200} y={1080} t={0.9} graine="trf1" />
      <Flamme x={880} y={1080} t={0.9} graine="trf2" />
      <Silhouette x={540} y={1110} h={380} role="pharaon" c={NUIT} liseré="#ffcf8a" bras={eclat * 0.8} />
      {/* les notables, prosternés, de dos */}
      {Array.from({ length: 5 }).map((_, i) => (
        <Silhouette key={i} x={140 + i * 200} y={1840} h={400} role={i % 2 ? "vieil" : "chef"} c={NUIT} liseré="#d88a50" phase={i} />
      ))}
    </Cadre>
  );
};

const Briques: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const feu = quand(plan, "feu", 0, 30);
  const tour = quand(plan, "tour", 0, 120);
  const monte = prog(f, tour, d, Easing.inOut(Easing.cubic));
  return (
    <Cadre cles={[[0, 1.08, 0, 30], [tour, 1.0, 0, 0], [d, 1.1, 0, 70]]}>
      <Ciel id="tb" stops={[[0, "#1a0a14"], [0.5, "#6a2420"], [1, "#d4632e"]]} />
      <Tour x={540} base={1350} h={1150} p={0.3 + monte * 0.6} />
      <rect x={0} y={1350} width={W} height={H - 1350} fill="#2a120c" />
      {/* fours : le feu sur l'argile */}
      {[180, 540, 900].map((x, i) => (
        <g key={i} opacity={interpolate(f, [feu - 6 + i * 5, feu + 8 + i * 5], [0, 1], clamp)}>
          <path d={`M${x - 110},1600 Q${x},1420 ${x + 110},1600 Z`} fill="#3a1a10" />
          <Flamme x={x} y={1600} t={1.1} graine={"tbf" + i} />
          {/* briques qui sortent du four */}
          {Array.from({ length: 4 }).map((_, k) => (
            <rect key={k} x={x - 80 + k * 42} y={1650 + ((f + k * 11 + i * 7) % 40) * 0} width={36} height={18} rx={3} fill="#9a4a22" stroke="#d07a40" strokeWidth={2} />
          ))}
        </g>
      ))}
      <Poussieres n={40} c="#ffb070" graine="tbp" haut={900} bas={1700} />
    </Cadre>
  );
};

const Orgueil: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const avance = interpolate(f, [0, d], [0, 160]);
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.1, -40, 0]]}>
      <Ciel id="to" stops={[[0, "#1a0808"], [0.5, "#7a1e14"], [1, "#d0502a"]]} />
      <Halo id="toh" x={540} y={1000} r={600} c="#ff6a3a" o={0.4} />
      <Tour x={860} base={1260} h={900} p={0.85} c="#1a0906" />
      <rect x={0} y={1260} width={W} height={H - 1260} fill="#2a0e08" />
      {/* l'armée en rangs serrés */}
      <g transform={`translate(${avance} 0)`}>
        {Array.from({ length: 3 }).map((_, r) =>
          Array.from({ length: 9 }).map((_, i) => (
            <Silhouette key={`${r}-${i}`} x={-200 + i * 120 + r * 40} y={1320 + r * 110} h={180 + r * 50} role="soldat" lance={4} c="#140504" liseré="#ff8a50" marche phase={i + r} />
          )),
        )}
        <Silhouette x={760} y={1720} h={420} role="pharaon" c={NUIT} liseré="#ffcf8a" marche />
      </g>
      <Poussieres n={40} c="#ffb070" graine="top" haut={1000} bas={1800} />
    </Cadre>
  );
};

const Mer: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const saisit = quand(plan, "saisit", 0, 30);
  const p = prog(f, saisit, Math.min(d, saisit + 200), Easing.inOut(Easing.cubic));
  const vague = (cote: number) => {
    const x0 = cote < 0 ? -200 + p * 560 : W + 200 - p * 560;
    return (
      <path
        d={`M${cote < 0 ? -400 : W + 400},${H} L${cote < 0 ? -400 : W + 400},${300 + p * 200} Q${x0},${250 + Math.sin(f / 6) * 20} ${x0 + cote * -120},${900} L${x0 + cote * -60},${H} Z`}
        fill="#0f3346"
        stroke="#bfe3ee"
        strokeWidth={10}
        opacity={1}
      />
    );
  };
  return (
    <Cadre cles={[[0, 1.0, 0, 0], [d, 1.12, 0, 40]]}>
      <Ciel id="tm" stops={[[0, "#05070c"], [0.6, "#132233"], [1, "#22394a"]]} />
      <Etoiles n={60} bas={700} graine="tm" />
      <rect x={0} y={1300} width={W} height={H - 1300} fill="#1a1a14" />
      {/* l'armée sur le fond asséché, avant que l'eau ne se referme */}
      {Array.from({ length: 12 }).map((_, i) => (
        <Silhouette key={i} x={60 + i * 85} y={1360 + (i % 3) * 40} h={170} role={i === 6 ? "pharaon" : "soldat"} c="#05070c" liseré="#7fb8c9" marche phase={i} lance={8}
          o={1 - interpolate(p, [0.55, 0.9], [0, 1], clamp)} />
      ))}
      {vague(-1)}
      {vague(1)}
      {p > 0.85 ? <Fleuve y={interpolate(p, [0.85, 1], [1300, 900], clamp)} haut="#123246" bas="#06121c" graine="tmf" vitesse={1.4} /> : null}
      <Brume y={1100} c="#9fc9d6" o={0.35 * p} graine="tmb" />
    </Cadre>
  );
};

const Ruines: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const mer = quand(plan, "mer", 0, d * 0.4);
  const descend = prog(f, 0, mer + 20);
  return (
    <Cadre cles={[[0, 1.15, 0, -100], [mer, 1.02, 0, 0], [d, 1.06, 0, 0]]}>
      <Ciel id="tu" stops={[[0, "#1b2a44"], [0.5, "#8a6a7a"], [1, "#f2c48d"]]} />
      <Halo id="tus" x={540} y={980} r={520} c="#ffe0b0" o={0.7} />
      <circle cx={540} cy={1000} r={100} fill="#fff1d6" />
      <Fleuve y={1000} haut="#3a5a72" bas="#0c1a28" refletX={540} graine="tuf" vitesse={0.6} />
      {/* au loin, la tour inachevée, seule */}
      <g opacity={0.55}>
        <Tour x={180} base={1000} h={420} p={0.55} c="#2a2230" lisere="#ffcf9a" />
      </g>
      {/* une pièce de bois qui flotte, rien de plus */}
      <g transform={`translate(${620 + Math.sin(f / 30) * 20} ${1320 + Math.sin(f / 14) * 6}) rotate(${Math.sin(f / 19) * 4})`}>
        <rect x={-90} y={-10} width={180} height={20} rx={8} fill="#3a2414" />
      </g>
      <rect x={0} y={0} width={W} height={H} fill="#000" opacity={0.25 * (1 - descend)} />
    </Cadre>
  );
};

export const ScenesQasas: Record<string, React.FC<SceneProps>> = {
  qr_cles: Cles,
  qr_tresor: Tresor,
  qr_conseil: Conseil,
  qr_cortege: Cortege,
  qr_engloutie: Engloutie,
  qr_lendemain: Lendemain,
  tp_tour: TourScene,
  tp_trone: Trone,
  tp_briques: Briques,
  tp_orgueil: Orgueil,
  tp_mer: Mer,
  tp_ruines: Ruines,
};

void H;
