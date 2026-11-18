/**
 * La Psycho Facile — série « Pourquoi tu… ». Même style que l'effet spectateur (formes plates, personnages
 * ronds originaux). Le jaune désigne toujours l'idée clé : « toi », ce qui passe le filtre, ce qui reste ouvert.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Music, NotebookPen, RotateCw, X } from "lucide-react";
import type { SceneProps } from "./types";
import { clamp, H, prog, quand, ressort, rnd, W } from "./outils";
import { Bonhomme, COULEURS, FOND, JAUNE, P, ROUGE, Scene, Sol } from "./spectateur";

const GRIS = "#8A8FB8";
const BLEU_NUIT = "#2A2F70";
const ENCRE = "#10132e";

const Pastille: React.FC<{ x: number; y: number; texte: string; s?: number; fond?: string; couleur?: string; taille?: number; o?: number }> = ({
  x, y, texte, s = 1, fond = JAUNE, couleur = ENCRE, taille = 44, o = 1,
}) => {
  const l = texte.length * taille * 0.62 + 70;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>
      <rect x={-l / 2} y={-taille * 0.95} width={l} height={taille * 1.9} rx={taille * 0.95} fill={fond} />
      <text x={0} y={taille * 0.35} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={taille} fill={couleur}>{texte}</text>
    </g>
  );
};

/** Bulle de pensée ou de parole au-dessus d'un personnage. */
const Bulle: React.FC<{ x: number; y: number; l?: number; h?: number; o?: number; fond?: string; children?: React.ReactNode }> = ({
  x, y, l = 200, h = 120, o = 1, fond = "#fff", children,
}) => (
  <g opacity={o}>
    <rect x={x - l / 2} y={y - h} width={l} height={h} rx={h / 2.4} fill={fond} />
    <path d={`M${x - 18},${y - 4} L${x},${y + 30} L${x + 14},${y - 4} Z`} fill={fond} />
    {children}
  </g>
);

const Gribouillis: React.FC<{ x: number; y: number; l: number; c?: string; graine: string }> = ({ x, y, l, c = GRIS, graine }) => (
  <g>
    {[0, 1].map((k) => (
      <rect key={k} x={x - l / 2} y={y + k * 26} width={l * (0.6 + rnd(graine + k) * 0.4)} height={12} rx={6} fill={c} />
    ))}
  </g>
);

const Fo: React.FC<{ x: number; y: number; t: number; children: React.ReactNode; s?: number; r?: number }> = ({ x, y, t, children, s = 1, r = 0 }) => (
  <foreignObject x={x - t / 2} y={y - t / 2} width={t} height={t}>
    <div style={{ width: t, height: t, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${s}) rotate(${r}deg)` }}>{children}</div>
  </foreignObject>
);

// =============================================================== #1 L'effet projecteur
const Tache: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const tshirt = quand(plan, "t-shirt", 0, 40);
  const personne = quand(plan, "personne", 0, 110);
  const tache = ressort(f, tshirt);
  const detourne = prog(f, personne - 6, personne + 10, Easing.out(Easing.cubic));
  const s = 2.6;
  const y = 1380;
  return (
    <Scene zoom={interpolate(f, [0, tshirt, personne], [1, 1.06, 1], clamp)}>
      <Sol y={1380} />
      {/* les regards imaginés : des yeux tout autour, braqués sur la tache */}
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2 + 0.3;
        const ex = 540 + Math.cos(a) * 400;
        const ey = 900 + Math.sin(a) * 360;
        const o = interpolate(f, [tshirt + i * 3, tshirt + 8 + i * 3], [0, 1], clamp) * (1 - detourne);
        const dx = (540 - ex) / 40;
        const dy = (1150 - ey) / 40;
        return (
          <g key={i} opacity={o} transform={`translate(${ex} ${ey}) scale(${1 - detourne * 0.5})`}>
            <ellipse cx={0} cy={0} rx={46} ry={30} fill="#fff" />
            <circle cx={dx} cy={dy} r={16} fill={ENCRE} />
          </g>
        );
      })}
      <Bonhomme x={540} y={y} s={s} c={COULEURS[0]} regard={0} />
      <g transform={`translate(${540 + 14 * s} ${y - 62 * s}) scale(${tache})`}>
        <path d="M0,-26 C22,-30 30,-8 22,6 C30,22 8,32 -6,24 C-26,30 -32,8 -20,-4 C-30,-22 -14,-28 0,-26 Z" fill="#7A4B1E" opacity={0.9} />
      </g>
      {f > personne - 6 ? <Pastille x={540} y={560} texte="presque personne" s={ressort(f, personne)} taille={52} /> : null}
    </Scene>
  );
};

const Salle: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const gene = quand(plan, "gênant", 0, 70);
  const puis = quand(plan, "Puis", 0, 150);
  const pleine = quand(plan, "pleine", 0, 190);
  const entre = prog(f, puis, pleine + 10, Easing.out(Easing.cubic));
  const foule = interpolate(f, [puis - 10, pleine], [0, 1], clamp);
  const avant = f < puis - 5;
  return (
    <Scene>
      <text x={540} y={560} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={64} fill={JAUNE} opacity={ressort(f, 0) * (avant ? 1 : 0.0)}>Université Cornell</text>
      {avant ? (
        // le t-shirt gênant, en gros plan
        <g transform={`translate(540 1060) scale(${ressort(f, 6)})`}>
          <path d="M-230,-200 L-90,-260 Q0,-210 90,-260 L230,-200 L300,-60 L190,-20 L190,260 L-190,260 L-190,-20 L-300,-60 Z" fill={JAUNE} />
          <circle cx={0} cy={20} r={110} fill="#fff" opacity={0.9} />
          <Fo x={0} y={20} t={170} s={1} r={f > gene ? Math.sin(f / 2) * 8 : 0}>
            <Music size={150} color={ENCRE} strokeWidth={2.4} />
          </Fo>
        </g>
      ) : (
        <g>
          <Sol y={1400} />
          {/* rangées de spectateurs assis */}
          {Array.from({ length: 3 }).map((_, r) =>
            Array.from({ length: 6 }).map((_, i) => (
              <g key={`${r}-${i}`} opacity={interpolate(foule, [i / 8 + r * 0.05, i / 8 + r * 0.05 + 0.25], [0, 1], clamp)}>
                <Bonhomme x={190 + i * 150 + (r % 2) * 40} y={900 + r * 190} s={0.62} c={COULEURS[(i + r) % COULEURS.length]} regard={r === 0 ? -1 : 0} phase={i + r} />
              </g>
            )),
          )}
          {/* la porte et l'étudiant au t-shirt jaune qui entre */}
          <rect x={20} y={1050} width={150} height={350} rx={12} fill="#151A45" />
          <Bonhomme x={interpolate(entre, [0, 1], [-60, 200])} y={1420} s={1.1} c={JAUNE} marche={entre > 0 && entre < 1} regard={1} />
        </g>
      )}
    </Scene>
  );
};

const Jauge: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const moitie = quand(plan, "moitié", 0, 40);
  const quart = quand(plan, "quart", 0, 120);
  const realite = quand(plan, "réalité", 0, quart - 30);
  const barre = (y: number, t0: number, valeur: number, couleur: string, etiquette: string) => {
    const p = prog(f, t0, t0 + 24, Easing.out(Easing.cubic));
    return (
      <g opacity={interpolate(f, [t0 - 12, t0], [0, 1], clamp)}>
        <text x={120} y={y - 40} fontFamily={P} fontWeight={800} fontSize={52} fill="#fff">{etiquette}</text>
        <rect x={120} y={y} width={840} height={90} rx={45} fill={BLEU_NUIT} />
        <rect x={120} y={y} width={Math.max(90, 840 * (valeur / 100) * p)} height={90} rx={45} fill={couleur} />
        <text x={150 + Math.max(160, 840 * (valeur / 100) * p) + 20} y={y + 64} fontFamily={P} fontWeight={800} fontSize={56} fill="#fff">
          ≈ {Math.round(valeur * p)} %
        </text>
      </g>
    );
  };
  return (
    <Scene>
      {barre(620, Math.max(10, moitie - 10), 50, GRIS, "Ce qu'ils croyaient")}
      {barre(1000, realite, 23, JAUNE, "La réalité")}
      <text x={540} y={1300} textAnchor="middle" fontFamily={P} fontWeight={700} fontSize={38} fill="#B9BCE0" opacity={interpolate(f, [quart + 20, quart + 35], [0, 1], clamp)}>
        des gens dans la salle avaient remarqué le t-shirt
      </text>
    </Scene>
  );
};

const Projecteur: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const autres = quand(plan, "autres", 0, 90);
  const leur = quand(plan, "leur", 0, 140);
  const xs = [140, 340, 540, 740, 940];
  const cone = (x: number, o: number) => (
    <path d={`M${x - 30},200 L${x + 30},200 L${x + 150},1400 L${x - 150},1400 Z`} fill={JAUNE} opacity={0.38 * o} />
  );
  return (
    <Scene>
      {/* d'abord un seul projecteur sur toi, puis chacun reçoit le sien */}
      {cone(540, ressort(f, 4))}
      {xs.map((x, i) => (x === 540 ? null : <g key={i}>{cone(x, interpolate(f, [autres + i * 5, autres + 12 + i * 5], [0, 1], clamp))}</g>))}
      {xs.map((x, i) => (
        <circle key={`l${i}`} cx={x} cy={190} r={34} fill={JAUNE} opacity={x === 540 ? 1 : interpolate(f, [autres + i * 5, autres + 12 + i * 5], [0, 1], clamp)} />
      ))}
      <Sol y={1400} />
      {xs.map((x, i) => (
        <Bonhomme key={i} x={x} y={1410} s={x === 540 ? 0.95 : 0.8} c={x === 540 ? COULEURS[0] : COULEURS[(i + 2) % COULEURS.length]}
          regard={x === 540 ? 0 : 0} halo={x === 540 ? 0.6 : interpolate(f, [leur, leur + 12], [0, 0.6], clamp)} phase={i} />
      ))}
    </Scene>
  );
};

const Boucle: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const oublie = quand(plan, "oublié", 0, 80);
  const boucle = quand(plan, "boucle", 0, 140);
  const efface = prog(f, oublie - 4, oublie + 14);
  return (
    <Scene>
      <Sol y={1400} />
      {[160, 920].map((x, i) => (
        <g key={i}>
          <Bulle x={x} y={1130} l={200} h={120} o={1 - efface}>
            <Gribouillis x={x} y={1050} l={130} graine={"b" + i} />
          </Bulle>
          <Bonhomme x={x} y={1410} s={0.8} c={COULEURS[i + 2]} regard={i ? -1 : 1} />
        </g>
      ))}
      {/* toi : la même scène repasse en boucle */}
      <Bulle x={540} y={1080} l={420} h={330} fond={JAUNE} o={ressort(f, 6)}>
        <Fo x={540} y={915} t={230} r={f * (f > boucle ? 9 : 4)}>
          <RotateCw size={200} color={ENCRE} strokeWidth={2.6} />
        </Fo>
      </Bulle>
      <Bonhomme x={540} y={1430} s={1.05} c={COULEURS[0]} regard={0} />
    </Scene>
  );
};

// =============================================================== #2 Ton prénom
const Brouhaha: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const prenom = quand(plan, "prénom", 0, 40);
  const tourne = prog(f, prenom, prenom + 10);
  const places: [number, number][] = [[150, 760], [400, 640], [700, 700], [940, 820], [260, 1010], [820, 1060], [560, 940]];
  return (
    <Scene zoom={interpolate(f, [prenom, prenom + 20], [1, 1.07], clamp)}>
      <Sol y={1250} />
      {places.map(([x, y], i) => (
        <g key={i} transform={`translate(${Math.sin(f / 9 + i) * 6} ${Math.cos(f / 11 + i) * 5})`} opacity={0.9}>
          {i === 6 && f > prenom - 2 ? (
            <Pastille x={x} y={y - 40} texte="TON PRÉNOM" s={ressort(f, prenom)} taille={46} />
          ) : (
            <Bulle x={x} y={y} l={190} h={100} fond={i === 6 ? "#fff" : "#D9DBF0"} o={0.85}>
              <Gribouillis x={x} y={y - 70} l={120} graine={"c" + i} />
            </Bulle>
          )}
        </g>
      ))}
      {Array.from({ length: 6 }).map((_, i) => (
        <Bonhomme key={i} x={110 + i * 172} y={1250 + (i % 2) * 30} s={0.72} c={COULEURS[(i + 1) % COULEURS.length]} regard={i < 3 ? 1 : -1} phase={i} />
      ))}
      {/* toi, au premier plan : tu te retournes */}
      <Bonhomme x={540} y={1340} s={1.1} c={JAUNE} regard={interpolate(tourne, [0, 1], [-1, 1])} halo={tourne} />
    </Scene>
  );
};

const Filtre: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const trie = quand(plan, "trie", 0, 20);
  const prenom = quand(plan, "prénom.", 0, 200);
  const passe = prog(f, prenom - 4, prenom + 30, Easing.inOut(Easing.cubic));
  const yFiltre = 980;
  return (
    <Scene>
      {/* des sons qui tombent et rebondissent sur le filtre */}
      {Array.from({ length: 14 }).map((_, i) => {
        const cycle = 60;
        const t = (f - trie + i * (cycle / 14)) % cycle;
        if (f < trie || t < 0) return null;
        const x0 = 200 + rnd("s" + i) * 680;
        const chute = Math.min(1, t / 30);
        const rebond = Math.max(0, (t - 30) / 30);
        const cote = rnd("d" + i) > 0.5 ? 1 : -1;
        const x = x0 + cote * rebond * 420;
        const y = 360 + chute * (yFiltre - 400) - Math.sin(rebond * Math.PI) * 220;
        return (
          <g key={i} opacity={1 - rebond * 0.9}>
            <rect x={x - 60} y={y - 28} width={120} height={56} rx={28} fill="#D9DBF0" />
            <text x={x} y={y + 12} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={30} fill={ENCRE}>bla</text>
          </g>
        );
      })}
      {/* le filtre */}
      <rect x={120} y={yFiltre} width={840} height={26} rx={13} fill={GRIS} />
      {Array.from({ length: 13 }).map((_, i) => (
        <rect key={i} x={150 + i * 62} y={yFiltre} width={18} height={26} fill="#12163A" />
      ))}
      <text x={540} y={yFiltre + 90} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={44} fill="#B9BCE0">filtre de ton cerveau</text>
      {/* ton prénom passe à travers */}
      {f > prenom - 6 ? (
        <g>
          {passe > 0.45 ? <circle cx={540} cy={yFiltre + 13} r={60 + passe * 200} fill={JAUNE} opacity={0.35 * (1 - passe)} /> : null}
          <Pastille x={540} y={interpolate(passe, [0, 1], [380, 1300])} texte="TON PRÉNOM" s={ressort(f, prenom - 6)} taille={50} />
        </g>
      ) : null}
    </Scene>
  );
};

const Oreilles: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const annee = quand(plan, "1959", 0, 0);
  const ignorer = quand(plan, "ignorer", 0, 100);
  const sauf = quand(plan, "sauf", 0, 200);
  const tiers = quand(plan, "tiers", 0, 280);
  const enTiers = f > tiers - 8;
  const ondes = (cote: -1 | 1, couleur: string, o: number) =>
    [0, 1, 2, 3].map((k) => {
      const p = ((f / 30 + k / 4) % 1);
      const x = 540 + cote * (480 - p * 300);
      return <path key={k} d={`M${x},${880} q${-cote * 30},60 0,120`} stroke={couleur} strokeWidth={12} fill="none" strokeLinecap="round" opacity={o * (1 - Math.abs(p - 0.5) * 1.4)} />;
    });
  const oIgnore = interpolate(f, [ignorer, ignorer + 12], [1, 0.25], clamp);
  return (
    <Scene>
      <text x={540} y={560} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={140} fill={JAUNE} opacity={ressort(f, annee) * (enTiers ? 0 : 1)}>1959</text>
      {!enTiers ? (
        <g>
          {ondes(-1, "#fff", 1)}
          {ondes(1, GRIS, oIgnore)}
          <text x={130} y={1180} fontFamily={P} fontWeight={800} fontSize={40} fill="#fff">à écouter</text>
          <text x={950} y={1180} textAnchor="end" fontFamily={P} fontWeight={800} fontSize={40} fill={GRIS} opacity={interpolate(f, [ignorer, ignorer + 10], [0, 1], clamp)}>à ignorer</text>
          <Bonhomme x={540} y={1230} s={1.6} c={COULEURS[1]} regard={-0.4} />
          {/* casque */}
          <path d="M470,960 Q540,860 610,960" stroke={ENCRE} strokeWidth={14} fill="none" />
          <rect x={448} y={950} width={34} height={60} rx={14} fill={ENCRE} />
          <rect x={598} y={950} width={34} height={60} rx={14} fill={ENCRE} />
          {f > sauf - 4 ? <Pastille x={800} y={800} texte="ton prénom" s={ressort(f, sauf)} taille={44} /> : null}
        </g>
      ) : (
        <g>
          <Sol y={1300} />
          {[300, 540, 780].map((x, i) => (
            <Bonhomme key={i} x={x} y={1310} s={1.1} c={i === 1 ? JAUNE : GRIS} halo={i === 1 ? ressort(f, tiers) : 0} regard={0} />
          ))}
          <text x={540} y={760} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={150} fill={JAUNE} opacity={ressort(f, tiers)}>1 sur 3</text>
        </g>
      )}
    </Scene>
  );
};

const Veille: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const garde = quand(plan, "garde", 0, 120);
  const toi = quand(plan, "toi.", 0, 200);
  const radar = interpolate(f, [garde - 10, garde + 10], [0.3, 1], clamp);
  const ping = f > toi ? prog(f, toi, toi + 25) : 0;
  const a = (f / 40) * Math.PI * 2;
  return (
    <Scene>
      <Sol y={1400} />
      <Bonhomme x={540} y={1420} s={1.4} c={COULEURS[0]} regard={0.6} />
      {/* une partie du cerveau reste de garde */}
      <g transform="translate(540 820)" opacity={radar}>
        {[110, 200, 290].map((r) => <circle key={r} r={r} fill="none" stroke={JAUNE} strokeWidth={4} opacity={0.35} />)}
        <path d={`M0,0 L${Math.cos(a) * 290},${Math.sin(a) * 290} A290,290 0 0 0 ${Math.cos(a - 0.6) * 290},${Math.sin(a - 0.6) * 290} Z`} fill={JAUNE} opacity={0.35} />
        <circle r={22} fill={JAUNE} />
        {ping > 0 ? <circle r={30 + ping * 400} fill="none" stroke={JAUNE} strokeWidth={10} opacity={1 - ping} /> : null}
      </g>
      {f > toi - 4 ? <Pastille x={780} y={560} texte="toi" s={ressort(f, toi)} taille={60} /> : null}
    </Scene>
  );
};

// =============================================================== #3 L'inachevé
const Ecran: React.FC<{ x: number; y: number; l: number; h: number; children?: React.ReactNode; o?: number }> = ({ x, y, l, h, children, o = 1 }) => (
  <g opacity={o}>
    <rect x={x - l / 2 - 16} y={y - h / 2 - 16} width={l + 32} height={h + 32} rx={28} fill="#0B0E26" />
    <rect x={x - l / 2} y={y - h / 2} width={l} height={h} rx={16} fill={BLEU_NUIT} />
    {children}
    <rect x={x - 60} y={y + h / 2 + 16} width={120} height={50} fill="#0B0E26" />
  </g>
);

const Episode: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const finie = quand(plan, "finie", 0, 30);
  const terminee = quand(plan, "terminée", 0, 90);
  const gris = prog(f, terminee, terminee + 15);
  const pulse = 1 + Math.sin(f / 5) * 0.03;
  return (
    <Scene>
      <g transform={`translate(0 0)`} opacity={interpolate(f, [terminee - 10, terminee], [0, 1], clamp) * (1 - gris * 0.55)}>
        <Ecran x={540} y={1220} l={560} h={300}>
          <text x={540} y={1210} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={48} fill="#fff">Épisode 8 / 8</text>
          <text x={540} y={1280} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={42} fill="#4CD18B">✓ terminé</text>
        </Ecran>
      </g>
      <g transform={`translate(540 700) scale(${ressort(f, finie - 6) * pulse}) translate(-540 -700)`}>
        <Ecran x={540} y={700} l={720} h={420}>
          <text x={540} y={660} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={60} fill="#fff">Épisode 5 / 8</text>
          <rect x={250} y={740} width={580} height={22} rx={11} fill="#151A45" />
          <rect x={250} y={740} width={580 * 0.62} height={22} rx={11} fill={JAUNE} />
          <circle cx={250 + 580 * 0.62} cy={751} r={22} fill={JAUNE} opacity={0.6 + Math.sin(f / 4) * 0.4} />
          <text x={540} y={850} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={44} fill={JAUNE}>pas fini…</text>
        </Ecran>
      </g>
    </Scene>
  );
};

const Serveur: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const annees = quand(plan, "1920", 0, 10);
  const regle = quand(plan, "réglée", 0, 170);
  const oubliee = quand(plan, "oubliée", 0, 220);
  const tables = [200, 540, 880];
  return (
    <Scene>
      <text x={540} y={560} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={88} fill={JAUNE} opacity={ressort(f, annees)}>Années 1920</text>
      <Sol y={1400} />
      {tables.map((x, i) => {
        const payee = i === 1;
        const tampon = payee ? ressort(f, regle) : 0;
        const envole = payee ? prog(f, oubliee - 4, oubliee + 20) : 0;
        return (
          <g key={i}>
            <rect x={x - 110} y={1230} width={220} height={24} rx={10} fill="#3B418C" />
            <rect x={x - 10} y={1254} width={20} height={150} fill="#3B418C" />
            {/* le ticket de commande qui flotte au-dessus de la table */}
            <g transform={`translate(${x} ${980 - envole * 500}) rotate(${(i - 1) * 4 + envole * 30})`} opacity={(1 - envole) * interpolate(f, [20 + i * 8, 32 + i * 8], [0, 1], clamp)}>
              <rect x={-90} y={-130} width={180} height={230} rx={14} fill={payee && f > regle ? "#D9DBF0" : JAUNE} />
              <Gribouillis x={0} y={-90} l={120} c={ENCRE} graine={"t" + i} />
              <Gribouillis x={0} y={-20} l={120} c={ENCRE} graine={"u" + i} />
              {payee && f > regle - 2 ? (
                <g transform={`rotate(-14) scale(${tampon})`}>
                  <rect x={-86} y={20} width={172} height={64} rx={10} fill="none" stroke={ROUGE} strokeWidth={7} />
                  <text x={0} y={68} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={42} fill={ROUGE}>PAYÉ</text>
                </g>
              ) : null}
            </g>
          </g>
        );
      })}
      <Bonhomme x={interpolate(f, [0, plan.fin - plan.debut], [80, 1000])} y={1420} s={0.9} c={COULEURS[5]} marche regard={1} />
    </Scene>
  );
};

const Onglets: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const ouvert = quand(plan, "ouvert", 0, 30);
  const reprendre = quand(plan, "reprendre.", 0, 260);
  const n = 6;
  const reste = 3;
  return (
    <Scene>
      <g transform="translate(90 600)">
        <rect x={0} y={0} width={900} height={640} rx={26} fill="#0B0E26" />
        <rect x={0} y={90} width={900} height={550} rx={0} fill={BLEU_NUIT} />
        {Array.from({ length: n }).map((_, i) => {
          const ferme = i === reste ? 0 : prog(f, ouvert + 12 + i * 8, ouvert + 22 + i * 8);
          const clign = i === reste ? 0.75 + Math.sin(f / 4) * 0.25 : 1;
          const sc = i === reste ? 1 + prog(f, reprendre - 6, reprendre + 10) * 0.25 : 1;
          return (
            <g key={i} transform={`translate(${20 + i * 145 + 62} 50) scale(${sc}) translate(${-62} -50)`} opacity={(1 - ferme) * clign}>
              <rect x={0} y={20} width={130} height={70} rx={16} fill={i === reste ? JAUNE : "#3B418C"} />
              <Fo x={100} y={55} t={40}><X size={30} color={ENCRE} strokeWidth={3} /></Fo>
            </g>
          );
        })}
        <text x={450} y={380} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={56} fill={JAUNE} opacity={interpolate(f, [ouvert + 70, ouvert + 85], [0, 1], clamp)}>toujours ouvert</text>
      </g>
      {f > reprendre - 8 ? <Pastille x={540} y={1380} texte="envie de reprendre" s={ressort(f, reprendre)} taille={50} /> : null}
    </Scene>
  );
};

const Cliffhanger: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const moment = quand(plan, "moment.", 0, 90);
  const coupe = f > moment;
  const pench = prog(f, moment - 40, moment);
  return (
    <AbsoluteFill style={{ background: FOND }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <g transform="translate(0 190)"><Ecran x={540} y={760} l={820} h={520}>
          {!coupe ? (
            <g>
              {/* tension : une silhouette au bord d'une falaise (scène de série inventée) */}
              <rect x={150} y={880} width={360} height={130} fill="#151A45" />
              <Bonhomme x={470} y={882} s={0.6} c={ROUGE} regard={1} />
              <rect x={150} y={980} width={760} height={30} fill="#151A45" opacity={0.6} />
              <rect x={150} y={1004} width={760 * interpolate(f, [0, moment], [0.5, 0.98], clamp)} height={10} fill={JAUNE} />
            </g>
          ) : (
            <g>
              <rect x={130} y={500} width={820} height={520} rx={16} fill="#000" />
              <text x={540} y={790} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={76} fill={JAUNE} opacity={ressort(f, moment + 6)}>À SUIVRE…</text>
            </g>
          )}
        </Ecran></g>
        <Sol y={1440} />
        {/* toi sur le canapé, penché en avant */}
        <rect x={290} y={1300} width={500} height={150} rx={40} fill="#3B418C" />
        <g transform={`rotate(${-pench * 8} 540 1440)`}>
          <Bonhomme x={540} y={1440} s={1.1} c={COULEURS[0]} regard={0} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

const Papier: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const papier = quand(plan, "papier.", 0, 90);
  const plan_ = quand(plan, "plan", 0, 170);
  const fermer = quand(plan, "fermer.", 0, 260);
  const ecrit = prog(f, papier - 20, papier + 40);
  const dort = prog(f, fermer, fermer + 25);
  return (
    <Scene>
      {/* la feuille : la prochaine étape s'écrit */}
      <g transform={`translate(540 820) rotate(-3) scale(${ressort(f, 4)})`}>
        <rect x={-300} y={-260} width={600} height={520} rx={18} fill="#F4F1E6" />
        {Array.from({ length: 6 }).map((_, i) => <rect key={i} x={-260} y={-150 + i * 70} width={520} height={4} fill="#C9D6F0" />)}
        <text x={-250} y={-170} fontFamily={P} fontWeight={800} fontSize={40} fill={ENCRE}>Prochaine étape :</text>
        <rect x={-250} y={-110} width={480 * Math.min(1, ecrit * 1.6)} height={14} rx={7} fill="#3B418C" />
        <rect x={-250} y={-40} width={360 * Math.max(0, ecrit * 1.6 - 0.6)} height={14} rx={7} fill="#3B418C" />
        <Fo x={240} y={-200} t={130} r={-10 + Math.sin(f / 3) * (ecrit < 1 ? 6 : 0)}>
          <NotebookPen size={110} color={ENCRE} strokeWidth={2.2} />
        </Fo>
        {f > plan_ ? <g transform={`translate(0 140) scale(${ressort(f, plan_)})`}><Pastille x={0} y={0} texte="✓ plan précis" taille={42} /></g> : null}
      </g>
      {/* l'onglet jaune se ferme, et tu dors */}
      {f > fermer - 30 ? (
        <g transform="translate(540 1250)" opacity={1 - dort}>
          <rect x={-90} y={-40} width={180} height={80} rx={18} fill={JAUNE} />
          <Fo x={50} y={0} t={50}><X size={40} color={ENCRE} strokeWidth={3.4} /></Fo>
        </g>
      ) : null}
      <g opacity={dort}>
        {[0, 1, 2].map((k) => (
          <text key={k} x={680 + k * 50} y={1260 - k * 60 - ((f / 2) % 30)} fontFamily={P} fontWeight={800} fontSize={44 + k * 10} fill="#fff" opacity={0.8}>z</text>
        ))}
        <Bonhomme x={540} y={1430} s={1.1} c={COULEURS[0]} au_sol />
      </g>
    </Scene>
  );
};

export const ScenesPourquoi: Record<string, React.FC<SceneProps>> = {
  pq_tache: Tache,
  pq_salle: Salle,
  pq_jauge: Jauge,
  pq_projecteur: Projecteur,
  pq_boucle: Boucle,
  pq_brouhaha: Brouhaha,
  pq_filtre: Filtre,
  pq_oreilles: Oreilles,
  pq_veille: Veille,
  pq_episode: Episode,
  pq_serveur: Serveur,
  pq_onglets: Onglets,
  pq_cliffhanger: Cliffhanger,
  pq_papier: Papier,
};

void H;
