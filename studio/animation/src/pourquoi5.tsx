/**
 * La Psycho Facile — « Pourquoi tu… » #12 (le déjà-vu) et #13 (les frissons en musique).
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { BatteryLow, Brain, Headphones, Search, Sparkles, Utensils, Zap } from "lucide-react";
import type { SceneProps } from "./types";
import { clamp, prog, quand, ressort } from "./outils";
import { Bonhomme, COULEURS, JAUNE, P, ROUGE, Scene, Sol } from "./spectateur";
import { ENCRE, Fo, GRIS, Notes, Pastille } from "./pourquoi";

const T: React.FC<{ x: number; y: number; t: number; c?: string; o?: number; children: React.ReactNode }> = ({ x, y, t, c = "#fff", o = 1, children }) => (
  <text x={x} y={y} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={t} fill={c} opacity={o}>{children}</text>
);

/** Plan d'une pièce vu du dessus : mêmes emplacements, couleurs au choix. */
const PlanPiece: React.FC<{ x: number; y: number; c: string; o?: number; s?: number }> = ({ x, y, c, o = 1, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>
    <rect x={-200} y={-200} width={400} height={400} rx={16} fill="none" stroke="#fff" strokeWidth={8} />
    <rect x={-40} y={192} width={80} height={16} fill="#1B1F4B" />
    <rect x={-170} y={-170} width={150} height={80} rx={10} fill={c} />
    <circle cx={110} cy={-100} r={55} fill={c} />
    <rect x={60} y={80} width={110} height={90} rx={10} fill={c} />
  </g>
);

// =============================================================== #12 Le déjà-vu
const DvAccroche: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const deja = quand(plan, "déjà", 0, d * 0.3);
  const fant = prog(f, deja - 5, deja + 20);
  return (
    <Scene>
      <Sol y={1440} />
      <g opacity={0.35 * fant} transform={`translate(${24 * fant} ${-14 * fant})`}>
        <Bonhomme x={540} y={1440} s={1.4} c="#fff" />
      </g>
      <Bonhomme x={540} y={1440} s={1.4} c={COULEURS[0]} regard={0.4} />
      {f > deja ? <Pastille x={540} y={900} texte="déjà vécu ?" s={ressort(f, deja + 4)} taille={60} /> : null}
    </Scene>
  );
};

const DvStats: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const trois = quand(plan, "trois", 0, d * 0.5);
  const jeunes = quand(plan, "jeunes", 0, d * 0.85);
  return (
    <Scene>
      <Sol y={1440} />
      {[0, 1, 2].map((i) => (
        <Bonhomme key={i} x={270 + i * 270} y={1440} s={1.1} c={i < 2 && f > trois + i * 6 ? JAUNE : "#5A5F9A"} phase={i} />
      ))}
      {f > trois - 4 ? <Pastille x={540} y={900} texte="2 personnes sur 3" s={ressort(f, trois)} taille={56} /> : null}
      {f > jeunes - 4 ? <Pastille x={540} y={1080} texte="surtout les jeunes" s={ressort(f, jeunes)} taille={44} fond="#fff" /> : null}
    </Scene>
  );
};

const DvPlan: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const an = quand(plan, "2012", 0, d * 0.25);
  const pl = quand(plan, "plan", 0, d * 0.6);
  const sup = prog(f, pl, pl + 30);
  return (
    <Scene>
      <T x={540} y={480} t={80} c={JAUNE} o={ressort(f, an)}>2012</T>
      <PlanPiece x={interpolate(sup, [0, 1], [290, 540])} y={900} c="#5A5F9A" o={0.6 * prog(f, an, an + 20)} s={0.6} />
      <PlanPiece x={interpolate(sup, [0, 1], [790, 540])} y={900} c={JAUNE} o={prog(f, an + 20, an + 40)} s={0.6} />
      <T x={290} y={1100} t={36} c={GRIS} o={1 - sup}>pièce oubliée</T>
      <T x={790} y={1100} t={36} c={GRIS} o={1 - sup}>nouvelle pièce</T>
      {sup > 0.9 ? <Pastille x={540} y={1240} texte="même plan → déjà-vu" s={ressort(f, pl + 30)} taille={46} /> : null}
    </Scene>
  );
};

const DvFamilier: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const fam = quand(plan, "familier", 0, d * 0.25);
  const sou = quand(plan, "souvenir", 0, d * 0.55);
  return (
    <Scene>
      <g transform="translate(540 820)">
        <circle r={190} fill={JAUNE} opacity={0.15} />
        <Fo x={0} y={0} t={280}><Brain size={230} color={JAUNE} strokeWidth={1.6} /></Fo>
      </g>
      {f > fam - 4 ? <Pastille x={540} y={520} texte="familier…" s={ressort(f, fam)} taille={56} /> : null}
      <g transform={`translate(${780 + Math.sin(f / 6) * 40} 1150)`} opacity={prog(f, sou - 10, sou + 5)}>
        <Fo x={0} y={0} t={140}><Search size={110} color="#fff" strokeWidth={2.4} /></Fo>
      </g>
      {f > sou + 10 ? <Pastille x={540} y={1330} texte="souvenir introuvable" s={ressort(f, sou + 10)} taille={44} fond={ROUGE} couleur="#fff" /> : null}
    </Scene>
  );
};

const DvFatigue: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const fat = quand(plan, "fatigué", 0, d * 0.5);
  const str = quand(plan, "stressé", 0, d * 0.8);
  return (
    <Scene>
      <g transform={`translate(330 900) scale(${ressort(f, fat)})`}>
        <circle r={140} fill={JAUNE} />
        <Fo x={0} y={0} t={180}><BatteryLow size={140} color={ENCRE} strokeWidth={2.2} /></Fo>
      </g>
      <g transform={`translate(750 900) scale(${ressort(f, str)})`}>
        <circle r={140} fill={ROUGE} />
        <Fo x={0} y={0} t={180}><Zap size={140} color="#fff" strokeWidth={2.2} /></Fo>
      </g>
      <T x={330} y={1120} t={46} o={ressort(f, fat)}>fatigue</T>
      <T x={750} y={1120} t={46} o={ressort(f, str)}>stress</T>
    </Scene>
  );
};

// =============================================================== #13 Les frissons en musique
const FrAccroche: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const fr = quand(plan, "frissons", 0, d * 0.5);
  const p = prog(f, fr - 5, fr + 20);
  return (
    <Scene>
      <Sol y={1440} />
      <Bonhomme x={540} y={1440} s={1.4} c={COULEURS[1]} />
      <Fo x={540} y={1440 - 1.4 * 150} t={160}><Headphones size={130} color="#fff" strokeWidth={2.2} /></Fo>
      <Notes x={540} y={880} r={260} n={6} o={0.8} />
      {/* la chair de poule : des petits points qui se dressent */}
      {Array.from({ length: 18 }).map((_, i) => (
        <circle key={i} cx={470 + (i % 6) * 28} cy={1290 + Math.floor(i / 6) * 34} r={6 * p} fill={JAUNE} />
      ))}
    </Scene>
  );
};

const FrCerveau: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const pl = quand(plan, "plaisir", 0, d * 0.5);
  const nour = quand(plan, "nourriture", 0, d * 0.85);
  const p = prog(f, pl - 10, pl + 20);
  return (
    <Scene>
      <g transform="translate(540 960)">
        <circle r={200 + 30 * p} fill={JAUNE} opacity={0.12 + 0.25 * p} />
        <Fo x={0} y={0} t={300}><Brain size={250} color={p > 0.5 ? JAUNE : "#fff"} strokeWidth={1.6} /></Fo>
      </g>
      {f > pl - 4 ? <Pastille x={540} y={680} texte="plaisir + récompense" s={ressort(f, pl)} taille={52} /> : null}
      {f > nour - 4 ? (
        <g transform={`translate(540 1320) scale(${ressort(f, nour)})`}>
          <circle r={80} fill="#fff" />
          <Fo x={0} y={0} t={110}><Utensils size={80} color={ENCRE} strokeWidth={2.4} /></Fo>
        </g>
      ) : null}
    </Scene>
  );
};

const FrDopamine: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const dop = quand(plan, "dopamine", 0, d * 0.15);
  const fris = quand(plan, "frisson", 0, d * 0.45);
  const avant = quand(plan, "avant", 0, d * 0.65);
  const trace = prog(f, dop, fris + 20);
  const pts = Array.from({ length: 41 }).map((_, i) => {
    const t = i / 40;
    const y = t < 0.5 ? 20 : t < 0.7 ? 20 + (t - 0.5) * 900 : t < 0.78 ? 200 + (t - 0.7) * 2500 : 400 - (t - 0.78) * 1500;
    return `${i === 0 ? "M" : "L"}${120 + t * 840},${1250 - Math.max(20, y)}`;
  }).join(" ");
  return (
    <Scene>
      <T x={540} y={520} t={70} c={JAUNE} o={ressort(f, dop)}>dopamine</T>
      <rect x={120} y={700} width={4} height={560} fill={GRIS} />
      <rect x={120} y={1256} width={840} height={4} fill={GRIS} />
      <path d={pts} stroke={JAUNE} strokeWidth={10} fill="none" strokeDasharray={2000} strokeDashoffset={2000 * (1 - trace)} />
      {f > fris - 4 ? <Pastille x={780} y={760} texte="le frisson" s={ressort(f, fris)} taille={40} /> : null}
      {f > avant - 4 ? <Pastille x={500} y={1000} texte="déjà avant !" s={ressort(f, avant)} taille={40} fond="#fff" /> : null}
    </Scene>
  );
};

const FrSurprise: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const monte = quand(plan, "monte", 0, d * 0.4);
  const sil = quand(plan, "silence", 0, d * 0.6);
  const coup = quand(plan, "coup", 0, d * 0.85);
  const barres = Array.from({ length: 30 }).map((_, i) => {
    const t = i / 29;
    let h = 60 + Math.abs(Math.sin(i * 1.7 + f / 5)) * 60;
    if (t > 0.3 && t < 0.5) h += (t - 0.3) * 1200;
    if (t >= 0.55 && t < 0.65) h = 8;
    if (t >= 0.65) h = 340 + Math.abs(Math.sin(i + f / 4)) * 60;
    return h;
  });
  const vis = Math.floor(interpolate(f, [0, coup + 10], [0, 30], clamp));
  return (
    <Scene>
      {barres.slice(0, vis).map((h, i) => (
        <rect key={i} x={110 + i * 29} y={950 - h / 2} width={20} height={h} rx={10} fill={i >= 19 ? JAUNE : "#fff"} />
      ))}
      {f > monte - 4 ? <Pastille x={330} y={1300} texte="ça monte" s={ressort(f, monte)} taille={38} fond="#fff" /> : null}
      {f > sil - 4 ? <Pastille x={600} y={1300} texte="silence" s={ressort(f, sil)} taille={38} fond="#fff" /> : null}
      {f > coup - 4 ? <Pastille x={850} y={1300} texte="boum" s={ressort(f, coup)} taille={38} /> : null}
    </Scene>
  );
};

const FrOuverts: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const ouv = quand(plan, "ouvertes", 0, d * 0.6);
  return (
    <Scene>
      <Sol y={1440} />
      {[0, 1, 2, 3].map((i) => {
        const ouvert = i % 2 === 0;
        return (
          <g key={i}>
            <Bonhomme x={170 + i * 250} y={1440} s={0.9} c={ouvert && f > ouv ? JAUNE : "#5A5F9A"} phase={i} />
            {ouvert && f > ouv ? <g transform={`translate(${170 + i * 250} 1180) scale(${ressort(f, ouv + i * 3)})`}><Fo x={0} y={0} t={110}><Sparkles size={90} color={JAUNE} strokeWidth={2} /></Fo></g> : null}
          </g>
        );
      })}
      {f > ouv + 10 ? <Pastille x={540} y={820} texte="ouverts aux nouvelles expériences" s={ressort(f, ouv + 10)} taille={40} /> : null}
    </Scene>
  );
};

export const ScenesPourquoi5: Record<string, React.FC<SceneProps>> = {
  pq_dv_accroche: DvAccroche,
  pq_dv_stats: DvStats,
  pq_dv_plan: DvPlan,
  pq_dv_familier: DvFamilier,
  pq_dv_fatigue: DvFatigue,
  pq_fr_accroche: FrAccroche,
  pq_fr_cerveau: FrCerveau,
  pq_fr_dopamine: FrDopamine,
  pq_fr_surprise: FrSurprise,
  pq_fr_ouverts: FrOuverts,
};
