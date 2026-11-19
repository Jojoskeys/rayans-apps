/**
 * La Psycho Facile — « Pourquoi tu… » #8 (chatouilles) et #9 (la file d'à côté).
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Bot, Brain, Hand, Volume2, VolumeX } from "lucide-react";
import type { SceneProps } from "./types";
import { clamp, prog, quand, ressort } from "./outils";
import { Bonhomme, COULEURS, JAUNE, P, ROUGE, Scene, Sol } from "./spectateur";
import { ENCRE, Fo, GRIS, Pastille } from "./pourquoi";

const VERT = "#4CD18B";

const T: React.FC<{ x: number; y: number; t: number; c?: string; o?: number; children: React.ReactNode }> = ({ x, y, t, c = "#fff", o = 1, children }) => (
  <text x={x} y={y} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={t} fill={c} opacity={o}>{children}</text>
);

const Plume: React.FC<{ x: number; y: number; r: number; s?: number }> = ({ x, y, r, s = 1 }) => (
  <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
    <path d="M0,0 C30,-60 30,-140 0,-200 C-30,-140 -30,-60 0,0 Z" fill="#fff" />
    <path d="M0,0 L0,-200" stroke={GRIS} strokeWidth={4} />
    {[-160, -120, -80, -40].map((y) => <path key={y} d={`M0,${y} l18,-22 M0,${y} l-18,-22`} stroke={GRIS} strokeWidth={3} />)}
  </g>
);

// =============================================================== #8 Se chatouiller soi-même
const ChAccroche: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const maint = quand(plan, "maintenant", 0, d * 0.8);
  return (
    <Scene>
      <Sol y={1440} />
      <Bonhomme x={540} y={1440} s={1.4} c={COULEURS[1]} regard={0.5} bras={1} />
      <Plume x={640} y={1250} r={-30 + Math.sin(f / 3) * 18} s={0.9} />
      <g transform={`translate(400 980) scale(${ressort(f, 15)})`}>
        <circle r={60} fill="#fff" />
        <T x={0} y={24} t={70} c={ENCRE}>?</T>
      </g>
      {f > maint - 4 ? <Pastille x={540} y={700} texte="essaie !" s={ressort(f, maint)} taille={70} /> : null}
    </Scene>
  );
};

const Prediction: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const prevoit = quand(plan, "prévoit", 0, 20);
  const peau = quand(plan, "peau", 0, d * 0.55);
  const sentir = quand(plan, "sentir", 0, d * 0.85);
  const main = interpolate(f, [peau - 30, peau], [0, 1], clamp);
  return (
    <Scene>
      <g transform={`translate(540 760) scale(${ressort(f, prevoit)})`}>
        <circle r={150} fill={JAUNE} opacity={0.2 + 0.1 * Math.sin(f / 5)} />
        <Fo x={0} y={0} t={220}><Brain size={180} color={JAUNE} strokeWidth={1.8} /></Fo>
      </g>
      {/* ce que le cerveau prévoit… avant que la main touche */}
      {f > prevoit + 20 ? <Pastille x={540} y={1000} texte="je sais ce qui arrive" s={ressort(f, prevoit + 20)} taille={42} fond="#fff" /> : null}
      <rect x={140} y={1240} width={800} height={60} rx={30} fill="#FFB8A0" />
      <g transform={`translate(${interpolate(main, [0, 1], [980, 600])} ${interpolate(main, [0, 1], [1050, 1180])})`}>
        <Fo x={0} y={0} t={160}><Hand size={130} color="#fff" strokeWidth={2} /></Fo>
      </g>
      {f > sentir - 4 ? <Pastille x={540} y={1430} texte="déjà prévu" s={ressort(f, sentir)} taille={46} /> : null}
    </Scene>
  );
};

const Volume: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const vol = quand(plan, "volume", 0, 25);
  const an = quand(plan, "1998", 0, d * 0.3);
  const moins = quand(plan, "moins", 0, d * 0.85);
  const baisse = prog(f, vol, vol + 25);
  const barre = (x: number, h: number, c: string, txt: string, o: number) => (
    <g opacity={o}>
      <rect x={x - 90} y={1300 - h} width={180} height={h} rx={20} fill={c} />
      <T x={x} y={1370} t={40}>{txt}</T>
    </g>
  );
  return (
    <Scene>
      <g transform="translate(540 560)">
        <Fo x={0} y={0} t={200}>{baisse > 0.5 ? <VolumeX size={160} color={JAUNE} strokeWidth={2} /> : <Volume2 size={160} color="#fff" strokeWidth={2} />}</Fo>
      </g>
      <T x={540} y={790} t={80} c={JAUNE} o={ressort(f, an)}>1998</T>
      {barre(330, 420, ROUGE, "un autre", prog(f, an + 10, an + 30))}
      {barre(750, interpolate(prog(f, moins - 25, moins + 5), [0, 1], [420, 120]), JAUNE, "toi", prog(f, an + 10, an + 30))}
    </Scene>
  );
};

const Robot: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const robot = quand(plan, "robot", 0, d * 0.25);
  const retard = quand(plan, "retard", 0, d * 0.5);
  const dav = quand(plan, "davantage", 0, d * 0.85);
  return (
    <Scene>
      <Sol y={1440} />
      <Bonhomme x={300} y={1440} s={1.2} c={COULEURS[0]} regard={1} />
      <g transform={`translate(780 1250) scale(${ressort(f, robot)})`}>
        <rect x={-110} y={-110} width={220} height={220} rx={40} fill="#5A5F9A" />
        <Fo x={0} y={0} t={190}><Bot size={160} color="#fff" strokeWidth={2} /></Fo>
      </g>
      <Plume x={560} y={1220} r={-60 + Math.sin(f / 3) * 18} s={0.7} />
      {f > retard - 4 ? <Pastille x={540} y={700} texte="+ 0,2 seconde" s={ressort(f, retard)} taille={60} /> : null}
      {f > dav - 4 ? (
        <g>
          {[[200, 900], [380, 820], [220, 1060]].map(([x, y], i) => (
            <Pastille key={i} x={x} y={y} texte="ha ha" s={ressort(f, dav + i * 5)} taille={40} fond={VERT} couleur="#fff" />
          ))}
        </g>
      ) : null}
    </Scene>
  );
};

const Surprise: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const surp = quand(plan, "surprise", 0, 30);
  const lui = quand(plan, "lui-même", 0, d * 0.85);
  return (
    <Scene>
      <g transform={`translate(540 760) scale(${ressort(f, surp)})`}>
        <circle r={200} fill={JAUNE} />
        <T x={0} y={80} t={260} c={ENCRE}>!</T>
      </g>
      <Sol y={1440} />
      <Bonhomme x={380} y={1440} s={1.1} c={COULEURS[2]} regard={1} />
      <Bonhomme x={700} y={1440} s={1.1} c={COULEURS[2]} regard={-1} />
      {f > lui - 4 ? (
        <g transform={`translate(540 1250) scale(${ressort(f, lui)})`}>
          <circle r={60} fill={ROUGE} />
          <path d="M-28,-28 L28,28 M28,-28 L-28,28" stroke="#fff" strokeWidth={14} strokeLinecap="round" />
        </g>
      ) : null}
    </Scene>
  );
};

// =============================================================== #9 La file d'à côté
const Voiture: React.FC<{ x: number; y: number; c: string; s?: number }> = ({ x, y, c, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x={-50} y={-80} width={100} height={160} rx={28} fill={c} />
    <rect x={-38} y={-50} width={76} height={40} rx={10} fill="#0B0E26" opacity={0.6} />
  </g>
);

/** Deux voies vues du dessus : la tienne (gauche) et l'autre (droite). */
const mod = (x: number, n: number) => ((x % n) + n) % n;

const Voies: React.FC<{ toi: number; autre: number; jaune?: boolean }> = ({ toi, autre, jaune = true }) => (
  <g>
    <rect x={240} y={380} width={600} height={1020} fill="#2A2F70" />
    {Array.from({ length: 12 }).map((_, i) => (
      <rect key={i} x={535} y={380 + i * 85} width={10} height={50} fill="#fff" opacity={0.5} />
    ))}
    {[0, 1, 2, 3, 4].map((i) => <Voiture key={"t" + i} x={390} y={460 + mod(i * 190 + toi, 860)} c={i === 2 && jaune ? JAUNE : "#5A5F9A"} />)}
    {[0, 1, 2, 3, 4].map((i) => <Voiture key={"a" + i} x={690} y={460 + mod(i * 190 + autre + 95, 860)} c="#5A5F9A" />)}
  </g>
);

const FiAccroche: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const vite = quand(plan, "vite", 0, d * 0.8);
  return (
    <Scene>
      <Voies toi={-f * 0.5} autre={-f * 6} />
      {f > vite - 4 ? <Pastille x={690} y={1470} texte="plus vite ?" s={ressort(f, vite)} taille={54} fond={ROUGE} couleur="#fff" /> : null}
    </Scene>
  );
};

const Etude: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const meme = quand(plan, "même", 0, d * 0.4);
  const rapide = quand(plan, "rapide", 0, d * 0.85);
  return (
    <Scene>
      <Voies toi={-f * 3} autre={-f * 3} jaune={false} />
      {f > meme - 4 ? <Pastille x={540} y={300} texte="même vitesse moyenne" s={ressort(f, meme)} taille={46} /> : null}
      {f > rapide - 4 ? <Pastille x={540} y={1470} texte="« l'autre est plus rapide »" s={ressort(f, rapide)} taille={40} fond="#fff" /> : null}
    </Scene>
  );
};

const Temps: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const sec = quand(plan, "secondes", 0, d * 0.3);
  const min = quand(plan, "minutes", 0, d * 0.55);
  const long = quand(plan, "long", 0, d * 0.9);
  const a = prog(f, sec - 20, sec);
  const b = prog(f, min - 10, min + 40);
  return (
    <Scene>
      <T x={540} y={640} t={46} c={GRIS}>ton trajet</T>
      <rect x={100} y={700} width={880} height={80} rx={40} fill="#2A2F70" />
      <rect x={100} y={700} width={110 * a} height={80} rx={40} fill={VERT} />
      <rect x={210} y={700} width={770 * b} height={80} rx={40} fill={ROUGE} />
      {a > 0.5 ? <Pastille x={180} y={900} texte="tu doubles" s={ressort(f, sec)} taille={36} fond={VERT} couleur="#fff" /> : null}
      {b > 0.3 ? <Pastille x={640} y={900} texte="on te double" s={ressort(f, min)} taille={36} fond={ROUGE} couleur="#fff" /> : null}
      {f > long - 4 ? (
        <g transform={`translate(540 1200) scale(${ressort(f, long)})`}>
          <T x={0} y={0} t={70} c={JAUNE}>ton cerveau retient</T>
          <T x={0} y={90} t={70} c={ROUGE}>le rouge</T>
        </g>
      ) : null}
    </Scene>
  );
};

const Perte: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const mal = quand(plan, "mal", 0, d * 0.25);
  const perte = quand(plan, "perte", 0, d * 0.85);
  const pench = interpolate(prog(f, mal - 5, mal + 30), [0, 1], [0, 14]);
  return (
    <Scene>
      <g transform="translate(540 1000)">
        <rect x={-14} y={0} width={28} height={420} fill="#fff" />
        <g transform={`rotate(${pench})`}>
          <rect x={-380} y={-14} width={760} height={28} rx={14} fill="#fff" />
          <g transform="translate(-330 0)">
            <path d="M-110,0 L110,0 L80,90 L-80,90 Z" fill={VERT} />
            <T x={0} y={-30} t={46}>gagner</T>
          </g>
          <g transform="translate(330 0)">
            <path d="M-130,0 L130,0 L100,120 L-100,120 Z" fill={ROUGE} />
            <T x={0} y={-30} t={46}>perdre</T>
          </g>
        </g>
      </g>
      {f > perte - 4 ? <Pastille x={540} y={640} texte="l'aversion à la perte" s={ressort(f, perte)} taille={52} /> : null}
    </Scene>
  );
};

const Conseil: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const change = quand(plan, "changes", 0, d * 0.2);
  const rien = quand(plan, "rien", 0, d * 0.5);
  const tienne = quand(plan, "tienne", 0, d * 0.85);
  const saut = prog(f, change, change + 20);
  return (
    <Scene>
      <rect x={240} y={380} width={600} height={1020} fill="#2A2F70" />
      <rect x={535} y={380} width={10} height={1020} fill="#fff" opacity={0.3} />
      <Voiture x={interpolate(saut, [0, 1], [390, 690])} y={1100} c={JAUNE} s={1.3} />
      <path d="M390,960 Q540,820 690,960" stroke={JAUNE} strokeWidth={10} fill="none" strokeDasharray="20 16" opacity={1 - saut} />
      {f > rien - 4 ? <Pastille x={540} y={330} texte="gain : presque rien" s={ressort(f, rien)} taille={50} fond={ROUGE} couleur="#fff" /> : null}
      {f > tienne - 4 ? <Pastille x={540} y={1470} texte="reste dans ta file" s={ressort(f, tienne)} taille={50} /> : null}
    </Scene>
  );
};

export const ScenesPourquoi3: Record<string, React.FC<SceneProps>> = {
  pq_ch_accroche: ChAccroche,
  pq_ch_prediction: Prediction,
  pq_ch_volume: Volume,
  pq_ch_robot: Robot,
  pq_ch_surprise: Surprise,
  pq_fi_accroche: FiAccroche,
  pq_fi_etude: Etude,
  pq_fi_temps: Temps,
  pq_fi_perte: Perte,
  pq_fi_conseil: Conseil,
};
