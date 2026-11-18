/** Scènes « psycho » : des schémas qui montrent exactement ce que dit la voix. */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Check, Glasses, X } from "lucide-react";
import type { Plan, SceneProps } from "./types";
import { clamp, OR, prog, quand, ressort, ROUGE, VERT } from "./outils";

const P = "Montserrat";
const GRIS = "#8a8f9c";

const Fond: React.FC<{ teinte?: string; children: React.ReactNode }> = ({ teinte = "#1a1405", children }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#08090d" }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.045) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.045) 2px, transparent 2px)",
          backgroundSize: "72px 72px",
          backgroundPosition: `0 ${(f * 0.6) % 72}px`,
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${teinte}, transparent 65%)` }} />
      {children}
    </AbsoluteFill>
  );
};

const Texte: React.FC<{ y: number; taille?: number; couleur?: string; o?: number; s?: number; children: React.ReactNode }> = ({
  y,
  taille = 56,
  couleur = "#fff",
  o = 1,
  s = 1,
  children,
}) => (
  <div
    style={{
      position: "absolute",
      top: y,
      width: "100%",
      textAlign: "center",
      fontFamily: P,
      fontWeight: 800,
      fontSize: taille,
      color: couleur,
      opacity: o,
      transform: `scale(${s})`,
      textShadow: "0 6px 0 rgba(0,0,0,0.7)",
    }}
  >
    {children}
  </div>
);

/** Petit personnage avec une bulle et une étiquette. */
const Perso: React.FC<{
  x: number;
  y: number;
  couleur: string;
  taille?: number;
  bulle?: { texte: string; couleur: string; frame: number } | null;
  etiquette?: { texte: string; couleur: string; frame: number } | null;
  apparition?: number;
  pulse?: number;
}> = ({ x, y, couleur, taille = 1, bulle, etiquette, apparition = -100, pulse }) => {
  const f = useCurrentFrame();
  const a = ressort(f, apparition, { damping: 12, stiffness: 170, mass: 0.6 });
  const p = pulse !== undefined && f >= pulse ? 1 + 0.08 * Math.abs(Math.sin((f - pulse) / 5)) : 1;
  const sb = bulle ? ressort(f, bulle.frame, { damping: 9, stiffness: 200, mass: 0.5 }) : 0;
  const se = etiquette ? ressort(f, etiquette.frame) : 0;
  const t = taille;
  return (
    <div style={{ position: "absolute", left: x - 60 * t, top: y - 70 * t, width: 120 * t, height: 260 * t, transform: `scale(${a * p})`, transformOrigin: "50% 100%" }}>
      <svg width={120 * t} height={240 * t} viewBox="0 0 120 240">
        <circle cx={60} cy={44} r={34} fill={couleur} />
        <rect x={14} y={92} width={92} height={140} rx={42} fill={couleur} />
      </svg>
      {bulle && f >= bulle.frame ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: -120 * t,
            transform: `translateX(-50%) scale(${sb})`,
            background: bulle.couleur,
            color: "#08090d",
            fontFamily: P,
            fontWeight: 800,
            fontSize: 58 * t,
            minWidth: 90 * t,
            textAlign: "center",
            padding: `${6 * t}px ${18 * t}px`,
            borderRadius: 24 * t,
            boxShadow: `0 0 30px ${bulle.couleur}`,
          }}
        >
          {bulle.texte}
        </div>
      ) : null}
      {etiquette && f >= etiquette.frame ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 250 * t,
            transform: `translateX(-50%) scale(${se})`,
            color: etiquette.couleur,
            fontFamily: P,
            fontWeight: 700,
            fontSize: 30 * t,
            whiteSpace: "nowrap",
          }}
        >
          {etiquette.texte}
        </div>
      ) : null}
    </div>
  );
};

/** Les cartes de l'expérience : une ligne de référence, puis A, B, C. */
const Cartes: React.FC<{
  y: number;
  echelle?: number;
  tRef: number;
  tChoix: number;
  tQuestion?: number;
  bonne?: number;
  mauvaise?: number;
}> = ({ y, echelle = 1, tRef, tChoix, tQuestion = 99999, bonne = 99999, mauvaise = 99999 }) => {
  const f = useCurrentFrame();
  const s = echelle;
  const hRef = 300;
  const lignes = [
    { l: "A", h: 200 },
    { l: "B", h: 300 },
    { l: "C", h: 400 },
  ];
  const base = 470;
  const carte = (x: number, w: number, t0: number, enfants: React.ReactNode) => {
    const a = ressort(f, t0);
    return (
      <g transform={`translate(${x} 0)`} opacity={a}>
        <rect x={0} y={0} width={w} height={540} rx={26} fill="#f4f1ea" />
        {enfants}
      </g>
    );
  };
  const trait = (x: number, h: number, t0: number, couleur: string, label: string, k: number) => {
    const p = prog(f, t0 + k * 5, t0 + k * 5 + 16);
    return (
      <g key={label}>
        <rect x={x - 9} y={base - h * p} width={18} height={h * p} rx={4} fill={couleur} />
        <text x={x} y={base + 52} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={44} fill="#222">
          {label}
        </text>
      </g>
    );
  };
  const vraiB = f >= bonne;
  const fauxA = f >= mauvaise;
  return (
    <div style={{ position: "absolute", top: y, left: 0, width: 1080, height: 600, transform: `scale(${s})`, transformOrigin: "50% 0" }}>
      <svg width={1080} height={620}>
        {carte(70, 280, tRef, trait(140, hRef, tRef, "#222", "Réf.", 0))}
        {carte(
          410,
          600,
          tChoix,
          lignes.map((L, k) =>
            trait(110 + k * 190, L.h, tChoix, L.l === "B" && vraiB ? VERT : L.l === "A" && fauxA ? ROUGE : "#222", L.l, k),
          ),
        )}
        {f >= tQuestion ? (
          <line
            x1={210 - 140}
            x2={70 + interpolate(f, [tQuestion, tQuestion + 20], [0, 900], clamp)}
            y1={base - hRef}
            y2={base - hRef}
            stroke={OR}
            strokeWidth={5}
            strokeDasharray="16 12"
          />
        ) : null}
        {vraiB ? (
          <circle cx={410 + 300} cy={base - hRef - 40} r={34 * ressort(f, bonne)} fill={VERT} />
        ) : null}
        {fauxA ? <circle cx={410 + 110} cy={base - 240} r={34 * ressort(f, mauvaise)} fill={ROUGE} /> : null}
      </svg>
      {vraiB ? (
        <div style={{ position: "absolute", left: 410 + 300 - 22, top: base - hRef - 62 }}>
          <Check size={44} color="#08090d" strokeWidth={4} />
        </div>
      ) : null}
      {fauxA ? (
        <div style={{ position: "absolute", left: 410 + 110 - 22, top: base - 262 }}>
          <X size={44} color="#fff" strokeWidth={4} />
        </div>
      ) : null}
    </div>
  );
};

const xRang = (i: number, n = 8) => 90 + i * (900 / (n - 1));

// ------------------------------------------------------------------ scènes
const Accroche: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const fausse = quand(plan, "fausse", 0, 30);
  const trois = quand(plan, "Trois", 0, 80);
  const regarde = quand(plan, "Regarde", 0, 9999);
  const stamp = ressort(f, fausse, { damping: 8, stiffness: 220, mass: 0.6 });
  return (
    <Fond>
      <div style={{ position: "absolute", top: 330, left: 240, width: 600, height: 230, borderRadius: 30, background: "#f4f1ea", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: P, fontWeight: 800, fontSize: 64, color: "#222", transform: `scale(${ressort(f, 4)})` }}>
        Ta réponse : B
      </div>
      {f >= fausse ? (
        <div style={{ position: "absolute", top: 600, left: 300, width: 480, textAlign: "center", fontFamily: P, fontWeight: 800, fontSize: 92, color: ROUGE, background: "rgba(8,9,13,0.85)", border: `10px solid ${ROUGE}`, borderRadius: 20, transform: `rotate(-12deg) scale(${2 - stamp})`, opacity: stamp }}>
          TU DIS A
        </div>
      ) : null}
      {[0, 1, 2, 3].map((i) => (
        <Perso
          key={i}
          x={240 + i * 200}
          y={960}
          couleur={i < 3 && f >= trois + i * 6 ? OR : GRIS}
          apparition={trois - 30 + i * 4}
          etiquette={i < 3 ? { texte: "a cédé", couleur: OR, frame: trois + i * 6 } : { texte: "a tenu", couleur: GRIS, frame: trois + 20 }}
        />
      ))}
      <Texte y={1290} taille={140} couleur={OR} o={interpolate(f, [trois, trois + 8], [0, 1], clamp)} s={ressort(f, trois)}>
        3 / 4
      </Texte>
      <AbsoluteFill style={{ background: "#fff", opacity: interpolate(f, [regarde, regarde + 2, regarde + 8], [0, 0.4, 0], clamp) }} />
    </Fond>
  );
};

const Test: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const asch = quand(plan, "Asch", 0, 20);
  const vision = quand(plan, "vision", 0, 60);
  const gauche = quand(plan, "gauche", 0, 90);
  const droite = quand(plan, "droite", 0, 140);
  const laquelle = quand(plan, "Laquelle", 0, 200);
  const evident = quand(plan, "B.", 0, 300);
  const remonte = prog(f, gauche - 10, gauche + 10);
  return (
    <Fond>
      <Texte y={interpolate(remonte, [0, 1], [520, 210])} taille={interpolate(remonte, [0, 1], [190, 110])} couleur={OR} s={ressort(f, 2)}>
        1951
      </Texte>
      <div
        style={{
          position: "absolute",
          top: interpolate(remonte, [0, 1], [800, 360]),
          left: interpolate(ressort(f, asch), [0, 1], [-700, 0]),
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 24,
          fontFamily: P,
          fontWeight: 700,
          fontSize: 50,
          color: "#fff",
        }}
      >
        <Glasses size={64} color={OR} strokeWidth={2.5} />
        Solomon Asch, psychologue
      </div>
      <Texte y={interpolate(remonte, [0, 1], [920, 440])} taille={42} couleur={GRIS} o={interpolate(f, [vision, vision + 10], [0, 1], clamp)}>
        « Un simple test de vision »
      </Texte>
      <Cartes y={560} tRef={gauche} tChoix={droite} tQuestion={laquelle} bonne={evident} />
      <Texte y={1210} taille={52} couleur={OR} o={interpolate(f, [laquelle, laquelle + 10], [0, 1], clamp)}>
        Laquelle a la même longueur ?
      </Texte>
    </Fond>
  );
};

const Groupe: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const complices = quand(plan, "complices", 0, 40);
  const unParUn = quand(plan, "Un", 0, 90);
  const mauvaise = quand(plan, "mauvaise", 0, 130);
  const dernier = quand(plan, "dernier", 0, 9999);
  const bulleFrame = (i: number) => unParUn + i * 9; // les complices répondent l'un après l'autre
  return (
    <Fond teinte="#1a0505">
      <Cartes y={170} echelle={0.62} tRef={-30} tChoix={-30} mauvaise={mauvaise} />
      {Array.from({ length: 8 }).map((_, i) => {
        const toi = i === 7;
        return (
          <Perso
            key={i}
            x={xRang(i)}
            y={900}
            taille={0.95}
            couleur={toi ? OR : GRIS}
            apparition={i * 3}
            bulle={toi ? (f >= dernier ? { texte: "?", couleur: OR, frame: dernier } : null) : { texte: "A", couleur: ROUGE, frame: bulleFrame(i) }}
            etiquette={toi ? { texte: "TOI", couleur: OR, frame: 0 } : null}
            pulse={toi ? dernier : undefined}
          />
        );
      })}
      <div style={{ position: "absolute", top: 1150, left: xRang(0) - 50, width: xRang(6) - xRang(0) + 100, opacity: interpolate(f, [complices, complices + 8], [0, 1], clamp), transform: `scaleX(${ressort(f, complices)})` }}>
        <div style={{ height: 8, background: ROUGE, borderRadius: 4, boxShadow: `0 0 20px ${ROUGE}` }} />
        <div style={{ textAlign: "center", fontFamily: P, fontWeight: 800, fontSize: 54, color: ROUGE, marginTop: 14 }}>7 COMPLICES</div>
      </div>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${(xRang(7) / 1080) * 100}% 52%, transparent 9%, rgba(0,0,0,0.7) 26%)`,
          opacity: interpolate(f, [dernier, dernier + 12], [0, 1], clamp),
        }}
      />
    </Fond>
  );
};

const Resultats: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const tiers = quand(plan, "tiers", 0, 20);
  const t75 = quand(plan, "75", 0, 120);
  const bonne = quand(plan, "bonne", 0, 220);
  const p1 = interpolate(f, [t75 - 8, t75], [1, 0], clamp);
  const p2 = interpolate(f, [t75, t75 + 8, bonne - 8, bonne], [0, 1, 1, 0], clamp);
  const p3 = interpolate(f, [bonne, bonne + 8], [0, 1], clamp);
  const remplissage = prog(f, tiers, tiers + 25) * 0.33;
  const R = 220;
  const C = 2 * Math.PI * R;
  const compteur = Math.round(prog(f, t75, t75 + 22) * 75);
  return (
    <Fond>
      <AbsoluteFill style={{ opacity: p1 }}>
        <svg width={1080} height={1300} style={{ position: "absolute", top: 120 }}>
          <circle cx={540} cy={520} r={R} fill="none" stroke="#2a2d36" strokeWidth={110} />
          <circle cx={540} cy={520} r={R} fill="none" stroke={ROUGE} strokeWidth={110} strokeDasharray={`${C * remplissage} ${C}`} transform="rotate(-90 540 520)" />
          <text x={540} y={545} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={96} fill="#fff">
            ≈ 1/3
          </text>
        </svg>
        <Texte y={1050} taille={50} o={interpolate(f, [tiers + 10, tiers + 20], [0, 1], clamp)}>
          des réponses suivent le groupe
        </Texte>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: p2 }}>
        <Texte y={300} taille={230} couleur={OR} s={ressort(f, t75)}>
          {compteur} %
        </Texte>
        <Texte y={560} taille={46}>
          ont cédé au moins une fois
        </Texte>
        {[0, 1, 2, 3].map((i) => (
          <Perso key={i} x={240 + i * 200} y={850} couleur={i < 3 ? OR : GRIS} apparition={t75 + 6 + i * 4} />
        ))}
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: p3 }}>
        <Cartes y={240} tRef={bonne - 30} tChoix={bonne - 30} bonne={bonne + 4} mauvaise={bonne + 40} />
        <Texte y={880} taille={60} couleur={VERT} o={interpolate(f, [bonne + 4, bonne + 12], [0, 1], clamp)}>
          Ils voyaient B…
        </Texte>
        <Texte y={980} taille={60} couleur={ROUGE} o={interpolate(f, [bonne + 40, bonne + 48], [0, 1], clamp)}>
          …ils ont dit A.
        </Texte>
      </AbsoluteFill>
    </Fond>
  );
};

const Allie: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const antidote = quand(plan, "antidote", 0, 10);
  const seule = quand(plan, "seule", 0, 60);
  const cinq = quand(plan, "5", 0, 150);
  const barre = interpolate(prog(f, cinq, cinq + 20), [0, 1], [33, 5]);
  const bar = (y: number, pct: number, couleur: string, label: string, o: number) => (
    <div style={{ position: "absolute", top: y, left: 90, right: 90, opacity: o }}>
      <div style={{ fontFamily: P, fontWeight: 700, fontSize: 40, color: "#fff", marginBottom: 12 }}>{label}</div>
      <div style={{ height: 74, background: "#22252d", borderRadius: 18, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(pct / 40) * 100}%`, background: couleur, boxShadow: `0 0 30px ${couleur}`, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 18, fontFamily: P, fontWeight: 800, fontSize: 44, color: "#08090d" }}>
          {Math.round(pct)} %
        </div>
      </div>
    </div>
  );
  return (
    <Fond teinte="#06180c">
      <Texte y={180} taille={120} couleur={VERT} s={ressort(f, antidote)}>
        L'ANTIDOTE
      </Texte>
      {Array.from({ length: 8 }).map((_, i) => {
        const toi = i === 7;
        const allie = i === 6;
        return (
          <Perso
            key={i}
            x={xRang(i)}
            y={600}
            taille={0.8}
            couleur={toi ? OR : allie && f >= seule ? VERT : GRIS}
            bulle={
              toi ? (f >= seule + 15 ? { texte: "B", couleur: VERT, frame: seule + 15 } : null) : allie && f >= seule ? { texte: "B", couleur: VERT, frame: seule } : { texte: "A", couleur: ROUGE, frame: -30 }
            }
            etiquette={toi ? { texte: "TOI", couleur: OR, frame: 0 } : allie ? { texte: "allié", couleur: VERT, frame: seule } : null}
          />
        );
      })}
      {bar(960, 33, ROUGE, "Seul face au groupe", interpolate(f, [seule, seule + 10], [0, 1], clamp))}
      {bar(1160, f >= cinq ? barre : 33, VERT, "Avec un seul allié", interpolate(f, [seule + 10, seule + 20], [0, 1], clamp))}
    </Fond>
  );
};

const Fin: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const dis = quand(plan, "dis-le", 0, 30);
  const libere = quand(plan, "libère", 0, 120);
  return (
    <Fond>
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const x = 540 + Math.cos(angle) * 420;
        const y = 700 + Math.sin(angle) * 400;
        const libre = f >= libere + i * 5;
        return <Perso key={i} x={x} y={y} taille={0.7} couleur={libre ? VERT : GRIS} bulle={libre ? { texte: "B", couleur: VERT, frame: libere + i * 5 } : null} />;
      })}
      <Perso x={540} y={720} taille={1.5} couleur={OR} apparition={0} bulle={f >= dis ? { texte: "B", couleur: VERT, frame: dis } : null} />
      <Texte y={1220} taille={84} couleur={OR} o={interpolate(f, [dis, dis + 8], [0, 1], clamp)} s={ressort(f, dis)}>
        DIS-LE.
      </Texte>
    </Fond>
  );
};

export const ScenesPsycho: Record<string, React.FC<SceneProps>> = {
  asch_accroche: Accroche,
  asch_test: Test,
  asch_groupe: Groupe,
  asch_resultats: Resultats,
  asch_allie: Allie,
  asch_fin: Fin,
};

export type { Plan };
