/**
 * La Psycho Facile — « Pourquoi tu… » #10 (réveillé avant le réveil) et #11 (le sursaut en s'endormant).
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Brain, Coffee, Moon, ShieldCheck, Zap } from "lucide-react";
import type { SceneProps } from "./types";
import { clamp, prog, quand, ressort } from "./outils";
import { Bonhomme, COULEURS, JAUNE, P, ROUGE, Scene } from "./spectateur";
import { ENCRE, Fo, GRIS, Pastille } from "./pourquoi";

const T: React.FC<{ x: number; y: number; t: number; c?: string; o?: number; children: React.ReactNode }> = ({ x, y, t, c = "#fff", o = 1, children }) => (
  <text x={x} y={y} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={t} fill={c} opacity={o}>{children}</text>
);

/** Lit vu de côté, avec un dormeur allongé (saut = petit bond vers le haut, 0 … 1). */
const Lit: React.FC<{ x: number; y: number; s?: number; c?: string; saut?: number; yeux?: boolean }> = ({ x, y, s = 1, c = COULEURS[1], saut = 0, yeux = false }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x={-260} y={-20} width={520} height={70} rx={14} fill="#3B418C" />
    <rect x={-270} y={-110} width={26} height={200} rx={8} fill="#2A2F70" />
    <rect x={-240} y={-62} width={120} height={46} rx={20} fill="#fff" />
    <g transform={`translate(0 ${-saut * 90})`}>
      <rect x={-200} y={-80} width={360} height={64} rx={32} fill={c} />
      <circle cx={-170} cy={-88} r={42} fill={c} />
      {yeux ? <g><circle cx={-182} cy={-96} r={7} fill="#fff" /><circle cx={-158} cy={-96} r={7} fill="#fff" /></g> : <path d="M-190,-92 h16 M-166,-92 h16" stroke={ENCRE} strokeWidth={5} strokeLinecap="round" />}
    </g>
    <rect x={-120} y={-58} width={330} height={44} rx={14} fill="#5B8DEF" opacity={0.85} />
  </g>
);

const Zzz: React.FC<{ x: number; y: number; o?: number }> = ({ x, y, o = 1 }) => {
  const f = useCurrentFrame();
  return (
    <g opacity={o}>
      {[0, 1, 2].map((i) => {
        const t = ((f / 40 + i / 3) % 1);
        return <T key={i} x={x + t * 80} y={y - t * 160} t={40 + i * 14} c={GRIS} o={1 - t}>z</T>;
      })}
    </g>
  );
};

const Reveil: React.FC<{ x: number; y: number; s?: number; h: string; sonne?: boolean }> = ({ x, y, s = 1, h, sonne }) => {
  const f = useCurrentFrame();
  const tr = sonne ? Math.sin(f * 1.5) * 6 : 0;
  return (
    <g transform={`translate(${x + tr} ${y}) scale(${s})`}>
      <rect x={-150} y={-80} width={300} height={160} rx={30} fill="#0B0E26" stroke={JAUNE} strokeWidth={6} />
      <T x={0} y={30} t={96} c={JAUNE}>{h}</T>
    </g>
  );
};

// =============================================================== #10 Réveillé avant le réveil
const ReAccroche: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const rev = quand(plan, "réveil", 0, d * 0.3);
  return (
    <Scene>
      <Reveil x={540} y={720} h={f > rev ? "6:59" : "6:58"} />
      <Lit x={560} y={1360} s={1.1} yeux={f > rev - 10} />
      {f > rev - 4 ? <Pastille x={540} y={980} texte="1 minute avant !" s={ressort(f, rev)} taille={50} /> : null}
    </Scene>
  );
};

const Horloge: React.FC<SceneProps> = () => {
  const f = useCurrentFrame();
  const a = f * 4;
  return (
    <Scene>
      <g transform="translate(540 860)">
        <circle r={230} fill="#fff" />
        <circle r={230} fill="none" stroke={JAUNE} strokeWidth={18} />
        {Array.from({ length: 12 }).map((_, i) => (
          <rect key={i} x={-5} y={-210} width={10} height={30} fill={ENCRE} transform={`rotate(${i * 30})`} />
        ))}
        <rect x={-6} y={-150} width={12} height={150} rx={6} fill={ENCRE} transform={`rotate(${a / 12})`} />
        <rect x={-4} y={-190} width={8} height={190} rx={4} fill={ROUGE} transform={`rotate(${a})`} />
      </g>
      <Lit x={560} y={1380} s={1.0} />
      <Zzz x={420} y={1240} />
    </Scene>
  );
};

const EtudeReveil: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const six = quand(plan, "6", 0, d * 0.25);
  const monter = quand(plan, "monter", 0, d * 0.55);
  const rien = quand(plan, "rien", 0, d * 0.9);
  const courbe = prog(f, monter - 30, monter + 30);
  const pts = (haut: boolean) => Array.from({ length: 21 }).map((_, i) => {
    const t = i / 20;
    const y = haut && t > 0.45 ? (t - 0.45) * 380 : 0;
    return `${i === 0 ? "M" : "L"}${-200 + t * 400},${-y}`;
  }).join(" ");
  const bloc = (x: number, h: string, haut: boolean, o: number, finTexte: number) => (
    <g transform={`translate(${x} 0)`} opacity={o}>
      <Reveil x={0} y={560} s={0.7} h={h} />
      <g transform="translate(0 1120)">
        <rect x={-220} y={-260} width={440} height={300} rx={20} fill="#2A2F70" />
        <path d={pts(haut)} stroke={haut ? JAUNE : GRIS} strokeWidth={10} fill="none" strokeDasharray={1200} strokeDashoffset={1200 * (1 - courbe)} />
        {haut ? <T x={-20} y={-200} t={30} c={JAUNE} o={courbe}>4 h 30</T> : null}
      </g>
      <T x={0} y={1230} t={36} c={GRIS} o={finTexte}>hormone du réveil</T>
    </g>
  );
  return (
    <Scene>
      {bloc(290, "6:00", true, Math.max(0.35, ressort(f, six)), courbe)}
      {bloc(790, "9:00", false, Math.max(0.35, ressort(f, six + 10)), courbe)}
      {f > rien - 4 ? <Pastille x={790} y={1400} texte="rien" s={ressort(f, rien)} taille={50} fond={ROUGE} couleur="#fff" /> : null}
    </Scene>
  );
};

const Prepare: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const heure = quand(plan, "l'heure", 0, d * 0.2);
  const bien = quand(plan, "bien", 0, d * 0.85);
  return (
    <Scene>
      <g transform={`translate(540 700) scale(${ressort(f, 0)})`}>
        <circle r={170} fill={JAUNE} opacity={0.15} />
        <Fo x={0} y={0} t={240}><Brain size={200} color={JAUNE} strokeWidth={1.8} /></Fo>
      </g>
      {f > heure - 4 ? <Pastille x={540} y={980} texte="noté : 7 h 00" s={ressort(f, heure)} taille={50} fond="#fff" /> : null}
      <Lit x={560} y={1380} s={1.0} yeux={f > bien - 6} />
      {f > bien - 4 ? <Pastille x={540} y={1130} texte="un peu trop tôt…" s={ressort(f, bien)} taille={44} /> : null}
    </Scene>
  );
};

const Astuce: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const clair = quand(plan, "clairement", 0, d * 0.25);
  const ecoute = quand(plan, "écoute", 0, d * 0.9);
  return (
    <Scene>
      <Fo x={880} y={420} t={140}><Moon size={110} color={JAUNE} strokeWidth={2} /></Fo>
      <Lit x={560} y={1380} s={1.0} yeux />
      <g transform={`translate(400 1050) scale(${ressort(f, clair)})`}>
        <rect x={-180} y={-90} width={360} height={150} rx={60} fill="#fff" />
        <circle cx={-60} cy={90} r={18} fill="#fff" />
        <circle cx={-90} cy={130} r={10} fill="#fff" />
        <T x={0} y={10} t={70} c={ENCRE}>7 h 00</T>
      </g>
      {f > ecoute - 4 ? <Pastille x={540} y={700} texte="ton cerveau écoute" s={ressort(f, ecoute)} taille={52} /> : null}
    </Scene>
  );
};

// =============================================================== #11 Le sursaut en s'endormant
const SuAccroche: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const s = quand(plan, "sursautes", 0, d * 0.25);
  const saut = interpolate(f, [s - 2, s + 4, s + 14], [0, 1, 0], clamp);
  return (
    <Scene>
      <Lit x={560} y={1360} s={1.1} saut={saut} yeux={f > s - 2} />
      <Zzz x={420} y={1200} o={f < s - 2 ? 1 : 0} />
      {f > s ? (
        <g transform={`translate(540 860) scale(${ressort(f, s)})`}>
          <Fo x={0} y={0} t={200}><Zap size={170} color={JAUNE} fill={JAUNE} /></Fo>
        </g>
      ) : null}
    </Scene>
  );
};

const NomStats: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const n70 = quand(plan, "70", 0, d * 0.7);
  return (
    <Scene>
      {Array.from({ length: 10 }).map((_, i) => {
        const cx = 160 + (i % 5) * 190;
        const cy = 900 + Math.floor(i / 5) * 330;
        const touche = i < 7 && f > n70 + i * 3;
        return <Bonhomme key={i} x={cx} y={cy} s={0.7} c={touche ? JAUNE : "#5A5F9A"} phase={i} />;
      })}
      {f > n70 + 25 ? <Pastille x={540} y={1420} texte="6 à 7 personnes sur 10" s={ressort(f, n70 + 25)} taille={46} /> : null}
    </Scene>
  );
};

const Chute: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const rel = quand(plan, "relâchent", 0, d * 0.2);
  const tombe = quand(plan, "tombes", 0, d * 0.7);
  const ratt = quand(plan, "rattrape", 0, d * 0.85);
  const chute = prog(f, rel, tombe);
  const stop = f > ratt - 2;
  return (
    <Scene>
      <g transform="translate(160 520)">
        <Fo x={0} y={0} t={150}><Brain size={120} color={JAUNE} strokeWidth={2} /></Fo>
      </g>
      {f > tombe - 6 ? <Pastille x={560} y={520} texte="« je tombe ! »" s={ressort(f, tombe - 6)} taille={52} fond={ROUGE} couleur="#fff" /> : null}
      <g transform={`translate(540 ${stop ? 980 : interpolate(chute, [0, 1], [760, 1280])})`}>
        <Bonhomme x={0} y={0} s={1.2} c={COULEURS[1]} bras={stop ? 1 : 0.5} />
      </g>
      {stop ? <Pastille x={540} y={1180} texte="rattrapé !" s={ressort(f, ratt)} taille={50} /> : null}
    </Scene>
  );
};

const Causes: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const items: [number, React.ReactNode, string][] = [
    [quand(plan, "café", 0, d * 0.3), <Coffee size={100} color={ENCRE} strokeWidth={2.4} />, "café tard"],
    [quand(plan, "stressé", 0, d * 0.6), <Zap size={100} color={ENCRE} strokeWidth={2.4} />, "stress"],
    [quand(plan, "sommeil", 0, d * 0.85), <Moon size={100} color={ENCRE} strokeWidth={2.4} />, "manque de sommeil"],
  ];
  return (
    <Scene>
      {items.map(([t, icone, nom], i) => (
        <g key={nom} transform={`translate(540 ${640 + i * 280}) scale(${ressort(f, t)})`}>
          <circle cx={-260} cy={0} r={90} fill={JAUNE} />
          <Fo x={-260} y={0} t={130}>{icone}</Fo>
          <text x={-130} y={18} fontFamily={P} fontWeight={800} fontSize={60} fill="#fff">{nom}</text>
        </g>
      ))}
    </Scene>
  );
};

const Rassure: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const danger = quand(plan, "danger", 0, d * 0.3);
  return (
    <Scene>
      <g transform={`translate(540 720) scale(${ressort(f, danger)})`}>
        <circle r={150} fill="#4CD18B" />
        <Fo x={0} y={0} t={200}><ShieldCheck size={170} color="#fff" strokeWidth={2} /></Fo>
      </g>
      <Lit x={560} y={1380} s={1.0} />
      <Zzz x={420} y={1240} />
    </Scene>
  );
};

export const ScenesPourquoi4: Record<string, React.FC<SceneProps>> = {
  pq_re_accroche: ReAccroche,
  pq_re_horloge: Horloge,
  pq_re_etude: EtudeReveil,
  pq_re_prepare: Prepare,
  pq_re_astuce: Astuce,
  pq_su_accroche: SuAccroche,
  pq_su_nom: NomStats,
  pq_su_chute: Chute,
  pq_su_causes: Causes,
  pq_su_rassure: Rassure,
};
