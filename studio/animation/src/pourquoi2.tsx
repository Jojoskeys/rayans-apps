/**
 * La Psycho Facile — « Pourquoi tu… » à partir du #6 (lot du 21/11). Même style que pourquoi.tsx :
 * formes plates, personnages ronds, le jaune pour l'idée clé.
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { CalendarDays, Check, Clock, FileText, Heart, MapPin, Smartphone } from "lucide-react";
import type { SceneProps } from "./types";
import { clamp, prog, quand, ressort } from "./outils";
import { Bonhomme, COULEURS, JAUNE, P, ROUGE, Scene, Sol } from "./spectateur";
import { ENCRE, Ecran, Fo, GRIS, Pastille } from "./pourquoi";

/** Bouche qui s'ouvre (0 fermée … 1 grand bâillement), posée sur la tête d'un Bonhomme. */
const Bouche: React.FC<{ x: number; y: number; s: number; o: number }> = ({ x, y, s, o }) =>
  o > 0.02 ? <ellipse cx={x} cy={y - 128 * s} rx={(9 + 6 * o) * s} ry={(3 + 16 * o) * s} fill={ENCRE} /> : null;

/** Un bâillement : s'ouvre, tient, se referme (≈ 50 images). */
const baille = (f: number, debut: number) =>
  interpolate(f, [debut, debut + 14, debut + 34, debut + 50], [0, 1, 1, 0], clamp);

const Texte: React.FC<{ x: number; y: number; t: number; c?: string; o?: number; s?: number; children: React.ReactNode }> = ({
  x, y, t, c = "#fff", o = 1, s = 1, children,
}) => (
  <text x={x} y={y} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={t} fill={c} opacity={o} transform={s !== 1 ? `translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})` : undefined}>
    {children}
  </text>
);

// =============================================================== #6 La procrastination
const Demain: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const dem = quand(plan, "demain", 0, d * 0.3);
  const dix = quand(plan, "dix", 0, d * 0.7);
  // la tâche est repoussée d'un jour à chaque « tour »
  const tours = Math.max(0, Math.floor((f - dem) / 22));
  const glisse = f > dem ? ((f - dem) % 22) / 22 : 0;
  const jours = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
  return (
    <Scene>
      {jours.map((j, i) => (
        <g key={j}>
          <rect x={60 + i * 140} y={760} width={124} height={150} rx={18} fill="#2A2F70" />
          <Texte x={122 + i * 140} y={820} t={34} c={GRIS}>{j}</Texte>
        </g>
      ))}
      <g transform={`translate(${122 + Math.min(tours + glisse, 6) * 140} 880)`}>
        <rect x={-52} y={-40} width={104} height={56} rx={12} fill={JAUNE} />
        <Fo x={0} y={-12} t={60}><FileText size={40} color={ENCRE} strokeWidth={2.6} /></Fo>
      </g>
      <Sol y={1440} />
      <Bonhomme x={540} y={1440} s={1.3} c={COULEURS[0]} regard={1} />
      {f > dix - 4 ? <Pastille x={540} y={1100} texte="ça prend 10 minutes" s={ressort(f, dix)} taille={50} fond={ROUGE} couleur="#fff" /> : null}
    </Scene>
  );
};

const StatsEtudiants: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const n95 = quand(plan, "95", 0, plan.fin - plan.debut - 60);
  return (
    <Scene>
      <Texte x={540} y={560} t={150} c={JAUNE} s={ressort(f, n95)} o={f > n95 - 4 ? 1 : 0}>95 %</Texte>
      {Array.from({ length: 20 }).map((_, i) => {
        const cx = 140 + (i % 5) * 200;
        const cy = 820 + Math.floor(i / 5) * 190;
        const touche = i < 19 && f > n95 + i * 2;
        return <Bonhomme key={i} x={cx} y={cy} s={0.55} c={touche ? JAUNE : "#5A5F9A"} phase={i} />;
      })}
      {f > n95 + 45 ? <Pastille x={540} y={1490} texte="des étudiants" s={ressort(f, n95 + 45)} taille={46} fond="#fff" /> : null}
    </Scene>
  );
};

const Fuite: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const fuite = quand(plan, "fuite", 0, d * 0.35);
  const aise = quand(plan, "l'aise", 0, d * 0.55);
  const suite = quand(plan, "suite", 0, d * 0.9);
  const tourne = prog(f, aise + 10, aise + 30);
  return (
    <Scene>
      <Sol y={1440} />
      {/* la tâche, avec son petit nuage gris */}
      <g transform="translate(230 1200)">
        <rect x={-90} y={-120} width={180} height={230} rx={16} fill="#fff" />
        {[0, 1, 2, 3].map((k) => <rect key={k} x={-60} y={-80 + k * 44} width={k === 3 ? 70 : 120} height={14} rx={7} fill={GRIS} />)}
        <g opacity={prog(f, aise - 10, aise + 10)}>
          {[[-50, -230, 60], [10, -260, 70], [70, -225, 55]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y + Math.sin(f / 12 + i) * 5} r={r} fill="#5A5F9A" />)}
        </g>
      </g>
      <Bonhomme x={560} y={1440} s={1.3} c={COULEURS[1]} regard={interpolate(tourne, [0, 1], [-1, 1])} />
      {/* le téléphone : le plaisir tout de suite */}
      <g transform={`translate(860 1150) scale(${ressort(f, fuite)})`}>
        <circle r={150} fill={JAUNE} opacity={0.18 + 0.1 * Math.sin(f / 6)} />
        <Fo x={0} y={0} t={170}><Smartphone size={140} color="#fff" strokeWidth={2} /></Fo>
        <g transform={`translate(0 -150) scale(${ressort(f, suite)})`}><Fo x={0} y={0} t={90}><Heart size={70} color={ROUGE} fill={ROUGE} /></Fo></g>
      </g>
      {f > fuite - 4 ? <Pastille x={540} y={640} texte="une fuite" s={ressort(f, fuite)} taille={60} /> : null}
    </Scene>
  );
};

const Futur: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const ans = quand(plan, "ans", 0, d * 0.3);
  const inconnu = quand(plan, "inconnu", 0, d * 0.6);
  const travail = quand(plan, "travail", 0, d * 0.85);
  const masque = prog(f, inconnu - 8, inconnu + 8);
  const pile = prog(f, travail - 10, travail + 15);
  return (
    <Scene>
      <Sol y={1440} />
      <Bonhomme x={270} y={1440} s={1.2} c={JAUNE} regard={1} />
      <Texte x={270} y={1520} t={44} c="#fff">toi</Texte>
      <g opacity={ressort(f, ans)}>
        <Bonhomme x={800} y={1440} s={1.2} c={interpolate(masque, [0, 1], [0, 1]) > 0.5 ? "#3B418C" : JAUNE} regard={-1} />
        {masque > 0 ? <Texte x={800} y={1440 - 1.2 * 150 + 30} t={110} c="#fff" o={masque}>?</Texte> : null}
        <Texte x={800} y={1520} t={44} c="#fff">toi dans 10 ans</Texte>
      </g>
      {f > inconnu - 4 ? <Pastille x={540} y={700} texte="un inconnu" s={ressort(f, inconnu)} taille={60} fond={ROUGE} couleur="#fff" /> : null}
      {/* la pile de travail glisse vers le « toi » du futur */}
      <g transform={`translate(${interpolate(pile, [0, 1], [270, 800])} ${1080 - Math.sin(pile * Math.PI) * 120})`} opacity={f > travail - 12 ? 1 : 0}>
        {[0, 1, 2].map((k) => <rect key={k} x={-70} y={-k * 26} width={140} height={22} rx={6} fill="#fff" />)}
      </g>
    </Scene>
  );
};

const Plan: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const heures = quand(plan, "heures", 0, d * 0.45);
  const bureau = quand(plan, "bureau", 0, d * 0.55);
  const doc = quand(plan, "document", 0, d * 0.65);
  const vraiment = quand(plan, "vraiment", 0, d * 0.85);
  const lignes: [number, React.ReactNode, string, string][] = [
    [heures, <Clock size={60} color={ENCRE} strokeWidth={2.6} />, "quand", "demain, 10 h"],
    [bureau, <MapPin size={60} color={ENCRE} strokeWidth={2.6} />, "où", "à mon bureau"],
    [doc, <FileText size={60} color={ENCRE} strokeWidth={2.6} />, "quoi", "j'ouvre le doc"],
  ];
  return (
    <Scene>
      <rect x={110} y={520} width={860} height={760} rx={40} fill="#fff" />
      <Fo x={540} y={600} t={100}><CalendarDays size={80} color={ENCRE} strokeWidth={2.4} /></Fo>
      {lignes.map(([t, icone, cle, val], i) => (
        <g key={cle} transform={`translate(0 ${740 + i * 170})`} opacity={f > t - 4 ? 1 : 0.15}>
          <circle cx={230} cy={0} r={58} fill={f > t - 4 ? JAUNE : "#ddd"} />
          <Fo x={230} y={0} t={90}>{icone}</Fo>
          <text x={320} y={-10} fontFamily={P} fontWeight={800} fontSize={36} fill={GRIS}>{cle}</text>
          <text x={320} y={40} fontFamily={P} fontWeight={800} fontSize={52} fill={ENCRE}>{val}</text>
        </g>
      ))}
      <g transform={`translate(860 1250) scale(${ressort(f, vraiment)})`}>
        <circle r={80} fill="#4CD18B" />
        <Fo x={0} y={0} t={110}><Check size={90} color="#fff" strokeWidth={4} /></Fo>
      </g>
    </Scene>
  );
};

// =============================================================== #7 Le bâillement contagieux
const Accroche: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const b1 = quand(plan, "bâilles", 0, 20);
  const moment = quand(plan, "moment", 0, d * 0.8);
  return (
    <Scene>
      <Sol y={1440} />
      <Bonhomme x={300} y={1440} s={1.3} c={COULEURS[2]} regard={1} />
      <Bouche x={300} y={1440} s={1.3} o={baille(f, Math.max(0, b1 - 30))} />
      <Bonhomme x={780} y={1440} s={1.3} c={COULEURS[0]} regard={-1} />
      <Bouche x={780} y={1440} s={1.3} o={baille(f, b1 + 15)} />
      <path d="M380,1120 Q540,1000 700,1120" stroke={JAUNE} strokeWidth={10} fill="none" strokeDasharray="20 18" strokeDashoffset={-f * 3} opacity={prog(f, b1, b1 + 15)} />
      {f > moment - 4 ? <Pastille x={540} y={700} texte="et toi ?" s={ressort(f, moment)} taille={70} /> : null}
    </Scene>
  );
};

const VideoBaillement: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const deux = quand(plan, "deux", 0, d * 0.35);
  const lire = quand(plan, "lire", 0, d * 0.75);
  const mot = prog(f, lire - 6, lire + 10);
  return (
    <Scene>
      <g opacity={1 - mot}>
        <Ecran x={540} y={720} l={560} h={360}>
          <Bonhomme x={540} y={880} s={1.1} c={COULEURS[3]} />
          <Bouche x={540} y={880} s={1.1} o={baille(f % 70, 5)} />
        </Ecran>
        {Array.from({ length: 10 }).map((_, i) => {
          const cx = 140 + (i % 5) * 200;
          const cy = 1220 + Math.floor(i / 5) * 230;
          const touche = [0, 2, 3, 5, 7, 8].includes(i);
          const t = deux - 20 + i * 4;
          return (
            <g key={i}>
              <Bonhomme x={cx} y={cy} s={0.6} c={touche && f > t ? JAUNE : "#5A5F9A"} phase={i} />
              {touche ? <Bouche x={cx} y={cy} s={0.6} o={baille(f, t)} /> : null}
            </g>
          );
        })}
      </g>
      {f > deux - 4 ? <Pastille x={540} y={460} texte="plus d'1 sur 2" s={ressort(f, deux) * (1 - mot)} taille={56} /> : null}
      {mot > 0 ? <Texte x={540} y={1000} t={120} c={JAUNE} s={0.6 + 0.4 * mot} o={mot}>bâillement</Texte> : null}
    </Scene>
  );
};

const Proches: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const fam = quand(plan, "famille", 0, d * 0.55);
  const amis = quand(plan, "amis", 0, d * 0.7);
  const inc = quand(plan, "inconnus", 0, d * 0.88);
  const anneaux: [number, number, string, string, number][] = [
    [fam, 230, "famille", JAUNE, 1],
    [amis, 370, "amis", "#FFB86B", 0.7],
    [inc, 510, "inconnus", GRIS, 0.3],
  ];
  const cy = 1020;
  return (
    <Scene>
      {anneaux.slice().reverse().map(([t, r, nom, c, force]) => (
        <g key={nom} opacity={f > t - 4 ? 1 : 0}>
          <circle cx={540} cy={cy} r={r * ressort(f, t)} fill="none" stroke={c} strokeWidth={14 * force + 4} opacity={0.4 + force * 0.6} />
          <Pastille x={540} y={cy - r} texte={nom} s={ressort(f, t + 4)} taille={40} fond={c} />
        </g>
      ))}
      <Bonhomme x={540} y={cy + 90} s={0.9} c={JAUNE} />
      <Bouche x={540} y={cy + 90} s={0.9} o={baille(f % 80, 10)} />
    </Scene>
  );
};

const Enfants: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const jamais = quand(plan, "jamais", 0, d * 0.4);
  return (
    <Scene>
      <Sol y={1440} />
      <Bonhomme x={330} y={1440} s={1.4} c={COULEURS[4]} regard={1} />
      <Bouche x={330} y={1440} s={1.4} o={baille(f % 75, 5)} />
      <Bonhomme x={760} y={1440} s={0.75} c={COULEURS[2]} regard={-1} />
      {f > jamais - 4 ? (
        <g transform={`translate(760 1180) scale(${ressort(f, jamais)})`}>
          <circle r={56} fill="#fff" />
          <text y={22} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={64} fill={ENCRE}>?</text>
        </g>
      ) : null}
      {f > jamais + 10 ? <Pastille x={540} y={700} texte="avant 4-5 ans : presque jamais" s={ressort(f, jamais + 10)} taille={44} /> : null}
    </Scene>
  );
};

const Chien: React.FC<{ x: number; y: number; s: number; bouche: number }> = ({ x, y, s, bouche }) => {
  const f = useCurrentFrame();
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={-80} rx={110} ry={60} fill="#C98B4E" />
      {[-80, -30, 40, 85].map((dx, i) => <rect key={i} x={dx - 10} y={-40} width={22} height={40} rx={8} fill="#B07640" />)}
      <path d={`M100,-90 q40,${-30 + Math.sin(f / 4) * 20} 60,-50`} stroke="#C98B4E" strokeWidth={16} fill="none" strokeLinecap="round" />
      <g transform="translate(-110 -150)">
        <circle r={58} fill="#C98B4E" />
        <ellipse cx={-30} cy={-40} rx={22} ry={40} fill="#8E5A2E" transform="rotate(-20)" />
        <ellipse cx={-62} cy={18} rx={34} ry={24} fill="#E0B07E" />
        <circle cx={-90} cy={10} r={9} fill={ENCRE} />
        <circle cx={-14} cy={-12} r={8} fill={ENCRE} />
        {bouche > 0.02 ? <ellipse cx={-60} cy={38} rx={18} ry={4 + 18 * bouche} fill={ENCRE} /> : null}
      </g>
    </g>
  );
};

const ChienScene: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const chiens = quand(plan, "chiens", 0, 10);
  const n29 = quand(plan, "29", 0, d * 0.5);
  const humain = quand(plan, "humain", 0, d * 0.8);
  const compte = Math.round(interpolate(f, [n29 - 10, n29 + 25], [0, 21], clamp));
  return (
    <Scene>
      <Sol y={1440} />
      <Bonhomme x={300} y={1440} s={1.3} c={COULEURS[5]} regard={1} />
      <Bouche x={300} y={1440} s={1.3} o={baille(f, humain - 40)} />
      <g opacity={ressort(f, chiens)}>
        <Chien x={800} y={1440} s={1.1} bouche={baille(f, humain + 6)} />
      </g>
      {f > n29 - 10 ? (
        <g transform={`translate(540 680) scale(${ressort(f, n29 - 10)})`}>
          <text textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={140} fill={JAUNE}>{compte} / 29</text>
          <text y={80} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={44} fill="#fff">chiens</text>
        </g>
      ) : null}
    </Scene>
  );
};

export const ScenesPourquoi2: Record<string, React.FC<SceneProps>> = {
  pq_pr_demain: Demain,
  pq_pr_stats: StatsEtudiants,
  pq_pr_fuite: Fuite,
  pq_pr_futur: Futur,
  pq_pr_plan: Plan,
  pq_ba_accroche: Accroche,
  pq_ba_video: VideoBaillement,
  pq_ba_proches: Proches,
  pq_ba_enfants: Enfants,
  pq_ba_chien: ChienScene,
};
