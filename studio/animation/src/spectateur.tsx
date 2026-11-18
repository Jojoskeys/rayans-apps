/**
 * La Psycho Facile — l'effet spectateur. Style plat et coloré (formes sans contour, personnages ronds
 * originaux), un seul accent : le jaune = « l'aide / la responsabilité ».
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { CassetteTape as Cassette, Phone } from "lucide-react";
import type { SceneProps } from "./types";
import { clamp, H, prog, quand, ressort, rnd, W } from "./outils";

export const P = "Montserrat";
export const JAUNE = "#FFD166";
export const ROUGE = "#FF5A5F";
export const COULEURS = ["#3EC1D3", "#7A6FF0", "#FF7AA2", "#FF9F43", "#4CD18B", "#5B8DEF"];
export const FOND = "linear-gradient(180deg, #1B1F4B 0%, #12163A 60%, #0E1130 100%)";

/** Personnage rond (original) : tête, corps arrondi, deux yeux. */
export const Bonhomme: React.FC<{
  x: number;
  y: number; // pieds
  s?: number;
  c: string;
  marche?: boolean;
  phase?: number;
  regard?: number; // -1 gauche … +1 droite
  au_sol?: boolean;
  halo?: number;
  bras?: number; // 0 bas, 1 levé
}> = ({ x, y, s = 1, c, marche, phase = 0, regard = 0, au_sol, halo = 0, bras = 0 }) => {
  const f = useCurrentFrame();
  const bob = marche ? Math.abs(Math.sin(f / 5 + phase)) * 6 * s : Math.sin(f / 30 + phase) * 1.5 * s;
  const yeux = (cx: number) => (
    <g>
      <circle cx={cx} cy={-150 * s} r={7 * s} fill="#fff" />
      <circle cx={cx + regard * 3 * s} cy={-150 * s} r={3.4 * s} fill="#10132e" />
    </g>
  );
  const corps = (
    <g>
      {halo > 0 ? <circle cx={0} cy={-100 * s} r={150 * s} fill={JAUNE} opacity={0.22 * halo} /> : null}
      <rect x={-38 * s} y={-118 * s} width={76 * s} height={118 * s} rx={36 * s} fill={c} />
      <circle cx={0} cy={-150 * s} r={34 * s} fill={c} />
      <rect x={-34 * s} y={-118 * s} width={68 * s} height={10 * s} rx={5 * s} fill="#000" opacity={0.12} />
      {yeux(-12 * s)}
      {yeux(12 * s)}
      {bras > 0 ? <rect x={30 * s} y={(-110 - 50 * bras) * s} width={16 * s} height={60 * s} rx={8 * s} fill={c} transform={`rotate(${-30 * bras} ${38 * s} ${-100 * s})`} /> : null}
    </g>
  );
  return (
    <g transform={`translate(${x} ${y - bob})${au_sol ? ` rotate(-90) translate(${40 * s} ${-30 * s})` : ""}`}>
      <ellipse cx={0} cy={4} rx={44 * s} ry={9 * s} fill="#000" opacity={au_sol ? 0 : 0.25} />
      {corps}
    </g>
  );
};

export const Sol: React.FC<{ y: number }> = ({ y }) => (
  <g>
    <rect x={0} y={y} width={W} height={H - y} fill="#232861" />
    <rect x={0} y={y} width={W} height={10} fill="#2E347A" />
  </g>
);

export const Scene: React.FC<{ children: React.ReactNode; zoom?: number; dx?: number; dy?: number }> = ({ children, zoom = 1, dx = 0, dy = 0 }) => (
  <AbsoluteFill style={{ background: FOND }}>
    <AbsoluteFill style={{ transform: `scale(${zoom}) translate(${dx}px, ${dy}px)` }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {children}
      </svg>
    </AbsoluteFill>
  </AbsoluteFill>
);

export const Texte: React.FC<{ y: number; taille?: number; couleur?: string; o?: number; s?: number; children: React.ReactNode }> = ({
  y, taille = 64, couleur = "#fff", o = 1, s = 1, children,
}) => (
  <div style={{ position: "absolute", top: y, width: "100%", textAlign: "center", fontFamily: P, fontWeight: 800, fontSize: taille, color: couleur, opacity: o, transform: `scale(${s})`, textShadow: "0 6px 0 rgba(0,0,0,0.35)" }}>
    {children}
  </div>
);

// ------------------------------------------------------------------ scènes
const Rue: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const vide = quand(plan, "vide", 0, d * 0.5);
  const split = interpolate(f, [vide - 12, vide + 8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const aide = interpolate(f, [vide + 10, vide + 50], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: FOND }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* immeubles */}
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={i} x={i * 140 - 20} y={700 - rnd("im" + i) * 260} width={120} height={900} rx={10} fill={["#262B6A", "#2C3278", "#1F2459"][i % 3]} />
        ))}
        <Sol y={1430} />
        {/* rue bondée : la foule passe sans s'arrêter */}
        <g transform={`translate(${-split * 270} 0)`}>
          {Array.from({ length: 16 }).map((_, i) => {
            const sens = i % 2 ? 1 : -1;
            const x = ((i * 97 + f * 2.4 * sens) % 1300 + 1300) % 1300 - 110;
            return <Bonhomme key={i} x={x} y={1440 + (i % 3) * 40} s={0.8} c={COULEURS[i % COULEURS.length]} marche phase={i} regard={sens} />;
          })}
          <Bonhomme x={540} y={1600} s={0.9} c={ROUGE} au_sol />
        </g>
        {/* rue presque vide (apparaît à droite) */}
        <g opacity={split} transform={`translate(${(1 - split) * 400} 0)`}>
          <rect x={560} y={600} width={520} height={1320} fill="#151A45" />
          <rect x={556} y={600} width={8} height={1320} fill={JAUNE} opacity={0.8} />
          <Bonhomme x={820} y={1600} s={0.9} c={ROUGE} au_sol />
          <Bonhomme x={interpolate(aide, [0, 1], [1060, 900])} y={1580} s={0.85} c={COULEURS[4]} marche={aide < 1} regard={-1} halo={aide} bras={aide} />
        </g>
      </svg>
      <Texte y={1150} taille={54} couleur="#fff" o={split}>
        <span style={{ marginRight: 260 }}>Bondée</span>
        <span>Vide</span>
      </Texte>
    </AbsoluteFill>
  );
};

const Labo: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const crise = quand(plan, "crise", 0, 200);
  const bande = quand(plan, "enregistrement", 0, 300);
  const cabines = 6;
  return (
    <Scene zoom={interpolate(f, [0, crise, crise + 30], [1, 1.04, 1.12], clamp)} dy={interpolate(f, [crise, crise + 30], [0, -40], clamp)}>
      <text x={540} y={380} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={140} fill={JAUNE} opacity={ressort(f, 0)}>1968</text>
      <text x={540} y={460} textAnchor="middle" fontFamily={P} fontWeight={700} fontSize={40} fill="#fff" opacity={interpolate(f, [20, 35], [0, 1], clamp)}>Darley & Latané</text>
      {Array.from({ length: cabines }).map((_, i) => {
        const x = 90 + i * 180;
        const victime = i === 0;
        const tremble = victime && f > crise ? Math.sin(f * 1.7) * 6 : 0;
        return (
          <g key={i} transform={`translate(${tremble} 0)`} opacity={interpolate(f, [30 + i * 6, 45 + i * 6], [0, 1], clamp)}>
            <rect x={x - 70} y={760} width={140} height={420} rx={20} fill="#2A2F70" />
            <Bonhomme x={x} y={1150} s={0.7} c={victime ? (f > crise ? ROUGE : COULEURS[5]) : COULEURS[(i + 1) % COULEURS.length]} />
            <path d={`M${x - 28},1010 Q${x},970 ${x + 28},1010`} stroke="#10132e" strokeWidth={8} fill="none" />
            {/* ondes de l'interphone */}
            {victime && f > crise
              ? [0, 1, 2].map((k) => {
                  const p = ((f - crise) / 18 + k / 3) % 1;
                  return <circle key={k} cx={x} cy={880} r={40 + p * 140} fill="none" stroke={ROUGE} strokeWidth={6} opacity={1 - p} />;
                })
              : null}
          </g>
        );
      })}
      {f > bande - 4 ? (
        <g transform={`translate(540 1330) scale(${ressort(f, bande)})`}>
          <rect x={-250} y={-60} width={500} height={120} rx={60} fill={JAUNE} />
          <text x={30} y={18} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={44} fill="#10132e">un enregistrement</text>
        </g>
      ) : null}
      {f > bande - 4 ? (
        <foreignObject x={300} y={1280} width={100} height={100}>
          <Cassette size={88} color="#10132e" strokeWidth={2.6} />
        </foreignObject>
      ) : null}
    </Scene>
  );
};

const Resultats: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const t85 = quand(plan, "85", 0, 60);
  const t31 = quand(plan, "31", 0, 200);
  const quatre = quand(plan, "quatre", 0, t31 - 40);
  const barre = (y: number, t0: number, valeur: number, couleur: string) => {
    const p = prog(f, t0, t0 + 24, Easing.out(Easing.cubic));
    return (
      <g>
        <rect x={120} y={y} width={840} height={90} rx={45} fill="#2A2F70" />
        <rect x={120} y={y} width={Math.max(90, 840 * (valeur / 100) * p)} height={90} rx={45} fill={couleur} />
        <text x={150 + Math.max(60, 840 * (valeur / 100) * p) - 40} y={y + 64} textAnchor="end" fontFamily={P} fontWeight={800} fontSize={56} fill="#10132e">
          {Math.round(valeur * p)} %
        </text>
      </g>
    );
  };
  return (
    <Scene>
      <text x={120} y={430} fontFamily={P} fontWeight={800} fontSize={54} fill="#fff">Seul à entendre</text>
      <Bonhomme x={880} y={470} s={0.6} c={COULEURS[0]} halo={f > t85 ? 1 : 0} />
      {barre(520, t85, 85, JAUNE)}
      <g opacity={interpolate(f, [quatre - 10, quatre + 5], [0, 1], clamp)}>
        <text x={120} y={900} fontFamily={P} fontWeight={800} fontSize={54} fill="#fff">Avec 4 autres</text>
        {Array.from({ length: 5 }).map((_, i) => (
          <Bonhomme key={i} x={640 + i * 80} y={940} s={0.5} c={COULEURS[(i + 1) % COULEURS.length]} />
        ))}
        {f > t31 - 2 ? barre(990, t31, 31, "#8A8FB8") : null}
      </g>
      <text x={540} y={1330} textAnchor="middle" fontFamily={P} fontWeight={700} fontSize={38} fill="#B9BCE0" opacity={interpolate(f, [t85 + 30, t85 + 45], [0, 1], clamp)}>
        ont prévenu avant la fin de la crise
      </text>
    </Scene>
  );
};

const Diffusion: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const chacun = quand(plan, "Chacun", 0, 60);
  const dilue = quand(plan, "diffusion", 0, 200);
  const split = prog(f, chacun, chacun + 40, Easing.inOut(Easing.cubic));
  const fade = interpolate(f, [chacun + 40, dilue], [1, 0.25], clamp);
  const n = 5;
  return (
    <Scene>
      {/* un seul faisceau de responsabilité qui se divise en cinq, de plus en plus pâles */}
      {Array.from({ length: n }).map((_, i) => {
        const cible = 140 + i * 200;
        const x = 540 + (cible - 540) * split;
        const largeur = 260 - split * 200;
        return (
          <path key={i} d={`M${540 - 60},250 L${540 + 60},250 L${x + largeur / 2},1300 L${x - largeur / 2},1300 Z`} fill={JAUNE} opacity={(split < 0.05 ? (i === 2 ? 0.55 : 0) : 0.55 * fade)} />
        );
      })}
      <circle cx={540} cy={240} r={60} fill={JAUNE} />
      <text x={540} y={258} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={44} fill="#10132e">!</text>
      <Sol y={1340} />
      {Array.from({ length: n }).map((_, i) => (
        <Bonhomme key={i} x={140 + i * 200} y={1350} s={0.8} c={COULEURS[i % COULEURS.length]} regard={i < 2 ? 1 : -1} halo={split < 0.05 && i === 2 ? 1 : 0} />
      ))}
      {f > chacun + 20
        ? Array.from({ length: n }).map((_, i) => (
            <g key={i} opacity={interpolate(f, [chacun + 20 + i * 6, chacun + 30 + i * 6], [0, 1], clamp)}>
              <rect x={140 + i * 200 - 60} y={1050} width={120} height={70} rx={20} fill="#fff" />
              <text x={140 + i * 200} y={1100} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={40} fill="#10132e">…</text>
            </g>
          ))
        : null}
      <text x={540} y={1560} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={58} fill={JAUNE} opacity={interpolate(f, [dilue, dilue + 10], [0, 1], clamp)}>
        diffusion de la responsabilité
      </text>
    </Scene>
  );
};

const Antidote: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const choisis = quand(plan, "Choisis", 0, 90);
  const toi = quand(plan, "Toi,", 0, 140);
  const appelle = quand(plan, "appelle", 0, 180);
  const fleche = prog(f, toi, toi + 16, Easing.out(Easing.back(1.4)));
  return (
    <Scene>
      <Sol y={1300} />
      {Array.from({ length: 7 }).map((_, i) => {
        const x = 110 + i * 145;
        const elu = i === 4;
        return (
          <Bonhomme key={i} x={x} y={1310 + (i % 2) * 30} s={0.8} c={elu && f > toi ? ROUGE : COULEURS[i % COULEURS.length]}
            halo={elu ? interpolate(f, [toi, toi + 15], [0, 1], clamp) : 0} regard={i < 4 ? 1 : -1} bras={elu && f > appelle ? 1 : 0} />
        );
      })}
      {/* la flèche désigne UNE personne */}
      <g opacity={f > choisis ? 1 : 0}>
        <path d={`M540,420 Q${540 + 120 * fleche},${700} ${110 + 4 * 145},${1050 - 80 * (1 - fleche)}`} stroke={JAUNE} strokeWidth={14} fill="none" strokeDasharray="1600" strokeDashoffset={1600 * (1 - prog(f, choisis, toi + 12))} strokeLinecap="round" />
      </g>
      {f > appelle ? (
        <foreignObject x={110 + 4 * 145 + 30} y={880} width={120} height={120}>
          <div style={{ transform: `scale(${ressort(f, appelle)}) rotate(${Math.sin(f / 2) * 10}deg)` }}>
            <Phone size={96} color={JAUNE} strokeWidth={2.6} />
          </div>
        </foreignObject>
      ) : null}
    </Scene>
  );
};

const Premier: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const premier = quand(plan, "premier", 0, 50);
  const suivent = quand(plan, "suivent", 0, 120);
  return (
    <Scene>
      <Sol y={1300} />
      <Bonhomme x={540} y={1395} s={0.9} c={ROUGE} au_sol />
      {Array.from({ length: 6 }).map((_, i) => {
        const x0 = 100 + i * 175;
        const t0 = i === 3 ? premier : suivent + (i % 3) * 8 + (i > 3 ? 6 : 0);
        const p = interpolate(f, [t0, t0 + 30], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
        const x = x0 + (540 + (i - 2.5) * 110 - x0) * p * 0.6;
        return <Bonhomme key={i} x={x} y={1330 + (i % 2) * 30 - p * 40} s={0.75} c={p > 0.05 ? JAUNE : COULEURS[i % COULEURS.length]} marche={p > 0 && p < 1} regard={x < 540 ? 1 : -1} />;
      })}
    </Scene>
  );
};

export const ScenesSpectateur: Record<string, React.FC<SceneProps>> = {
  ps_rue: Rue,
  ps_labo: Labo,
  ps_resultats: Resultats,
  ps_diffusion: Diffusion,
  ps_antidote: Antidote,
  ps_premier: Premier,
};
