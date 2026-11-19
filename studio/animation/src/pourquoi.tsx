/**
 * La Psycho Facile — série « Pourquoi tu… ». Même style que l'effet spectateur (formes plates, personnages
 * ronds originaux). Le jaune désigne toujours l'idée clé : « toi », ce qui passe le filtre, ce qui reste ouvert.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Key, Music, NotebookPen, Repeat, RotateCw, X } from "lucide-react";
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

// =============================================================== #4 L'effet de la porte
/** Encadrement de porte, vu de face. */
const Porte: React.FC<{ x: number; sol: number; o?: number }> = ({ x, sol, o = 1 }) => (
  <g opacity={o}>
    <rect x={x - 130} y={sol - 520} width={260} height={520} fill="#0B0E26" />
    <rect x={x - 150} y={sol - 540} width={300} height={30} rx={8} fill="#3B418C" />
    <rect x={x - 150} y={sol - 540} width={26} height={540} fill="#3B418C" />
    <rect x={x + 124} y={sol - 540} width={26} height={540} fill="#3B418C" />
  </g>
);

const BullePensee: React.FC<{ x: number; y: number; s: number; children: React.ReactNode }> = ({ x, y, s, children }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <circle cx={-60} cy={150} r={14} fill="#fff" />
    <circle cx={-30} cy={110} r={22} fill="#fff" />
    <ellipse cx={0} cy={0} rx={150} ry={110} fill="#fff" />
    {children}
  </g>
);

const PorteScene: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const piece = quand(plan, "pièce", 0, 40);
  const sais = quand(plan, "sais", 0, d * 0.7);
  const x = interpolate(f, [0, sais], [200, 860], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const passe = x > 540;
  const s = passe ? 1 - prog(f, sais - 10, sais + 4) : ressort(f, piece - 20);
  const doute = passe ? ressort(f, sais) : 0;
  return (
    <Scene>
      <Sol y={1420} />
      <Porte x={540} sol={1420} />
      <Bonhomme x={x} y={1420} s={1.1} c={COULEURS[0]} marche={x < 860} regard={1} />
      <BullePensee x={x + 140} y={860} s={s * 0.9}>
        <Fo x={0} y={0} t={150}><Key size={120} color={ENCRE} strokeWidth={2.4} /></Fo>
      </BullePensee>
      {doute > 0 ? (
        <text x={x + 60} y={980} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={190 * doute} fill={JAUNE}>?</text>
      ) : null}
    </Scene>
  );
};

const Chapitre: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const porte = quand(plan, "porte.", 0, 40);
  const an = quand(plan, "2011", 0, 90);
  const film = quand(plan, "film", 0, d * 0.55);
  const range = quand(plan, "range", 0, d * 0.8);
  const etape = f < film - 10 ? 0 : 1;
  const glisse = prog(f, range, range + 30);
  return (
    <Scene>
      {etape === 0 ? (
        <g>
          {f > porte - 4 ? <Pastille x={540} y={520} texte="c'est la porte" s={ressort(f, porte)} taille={58} /> : null}
          <text x={540} y={760} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={86} fill={JAUNE} opacity={ressort(f, an)}>2011</text>
          {/* une seule grande pièce, ou deux pièces séparées par une porte : même distance */}
          <g opacity={ressort(f, an + 10)}>
            <rect x={110} y={900} width={380} height={260} rx={16} fill="none" stroke="#3B418C" strokeWidth={12} />
            <rect x={590} y={900} width={380} height={260} rx={16} fill="none" stroke="#3B418C" strokeWidth={12} />
            <rect x={772} y={890} width={16} height={280} fill={JAUNE} />
            <path d="M150,1110 L450,1110" stroke="#fff" strokeWidth={6} strokeDasharray="14 14" />
            <path d="M630,1110 L930,1110" stroke="#fff" strokeWidth={6} strokeDasharray="14 14" />
            <text x={300} y={1240} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={40} fill="#fff">même pièce</text>
            <text x={780} y={1240} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={40} fill={JAUNE}>une porte</text>
            <text x={780} y={1330} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={44} fill={ROUGE} opacity={interpolate(f, [an + 60, an + 75], [0, 1], clamp)}>+ d'oublis</text>
          </g>
        </g>
      ) : (
        <g>
          {/* la journée découpée en scènes de film : la porte ferme la scène, et la clé part avec */}
          <g transform={`translate(${-glisse * 760} 0)`}>
            <rect x={140} y={700} width={560} height={440} rx={20} fill={BLEU_NUIT} stroke="#fff" strokeWidth={8} />
            <text x={420} y={790} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={44} fill="#fff">SCÈNE 1 · cuisine</text>
            <Fo x={420} y={960} t={180}><Key size={150} color={JAUNE} strokeWidth={2.4} /></Fo>
          </g>
          <g transform={`translate(${(1 - glisse) * 760} 0)`} opacity={glisse}>
            <rect x={240} y={700} width={600} height={440} rx={20} fill={BLEU_NUIT} stroke="#fff" strokeWidth={8} />
            <text x={540} y={790} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={44} fill="#fff">SCÈNE 2 · chambre</text>
            <text x={540} y={1010} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={150} fill={JAUNE}>?</text>
          </g>
          {Array.from({ length: 8 }).map((_, i) => (
            <rect key={i} x={60 + i * 130} y={600} width={70} height={46} rx={8} fill="#0B0E26" />
          ))}
          {Array.from({ length: 8 }).map((_, i) => (
            <rect key={"b" + i} x={60 + i * 130} y={1200} width={70} height={46} rx={8} fill="#0B0E26" />
          ))}
        </g>
      )}
    </Scene>
  );
};

const Charge: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const an = quand(plan, "2021", 0, 30);
  const pleine = quand(plan, "pleine.", 0, d * 0.4);
  const mille = quand(plan, "mille", 0, d * 0.7);
  const icones = ["📱", "📧", "🛒", "⏰", "📚", "💬", "🍝", "🔑"];
  return (
    <Scene>
      <text x={540} y={560} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={86} fill={JAUNE} opacity={ressort(f, an)}>2021</text>
      <Sol y={1440} />
      <Bonhomme x={540} y={1440} s={1.25} c={COULEURS[0]} regard={0} />
      {icones.map((ic, i) => {
        const a = (i / icones.length) * Math.PI * 2 + f / 40;
        const t = interpolate(f, [pleine - 20 + i * 5, pleine + i * 5], [0, 1], clamp) + (f > mille ? 0.15 : 0);
        const r = 250 + Math.sin(f / 9 + i) * 14;
        const vis = i === 7 ? (1 - prog(f, mille + 20, mille + 40)) : 1;
        return (
          <g key={i} opacity={t * vis} transform={`translate(${540 + Math.cos(a) * r} ${930 + Math.sin(a) * r * 0.55})`}>
            <circle r={62} fill={i === 7 ? JAUNE : "#fff"} />
            <text y={22} textAnchor="middle" fontSize={62}>{ic}</text>
          </g>
        );
      })}
      {f > pleine ? <Pastille x={540} y={720} texte="tête pleine = plus d'oublis" s={ressort(f, pleine + 8)} taille={44} /> : null}
    </Scene>
  );
};

const Voix: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const haute = quand(plan, "haute", 0, 40);
  const cles = quand(plan, "clés", 0, d * 0.5);
  const prononce = quand(plan, "prononce.", 0, d * 0.85);
  const x = interpolate(f, [cles, d], [260, 760], clamp);
  return (
    <Scene>
      <Sol y={1420} />
      <Porte x={600} sol={1420} o={0.9} />
      <Bonhomme x={x} y={1420} s={1.1} c={COULEURS[0]} marche={f > cles && f < d - 4} regard={1} />
      {f > haute - 4 ? (
        <g transform={`translate(${x + 40} 900) scale(${ressort(f, haute)})`}>
          <rect x={-200} y={-110} width={400} height={170} rx={60} fill={JAUNE} />
          <path d="M-60,58 L-90,120 L-10,58 Z" fill={JAUNE} />
          <text x={0} y={0} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={64} fill={ENCRE}>{f > cles - 4 ? "« Les clés ! »" : "…"}</text>
        </g>
      ) : null}
      {f > prononce - 4 ? <Pastille x={540} y={560} texte="✓ dit = retenu" s={ressort(f, prononce)} taille={54} /> : null}
    </Scene>
  );
};

// =============================================================== #5 Le ver d'oreille
const Notes: React.FC<{ x: number; y: number; r: number; n: number; o?: number; c?: string }> = ({ x, y, r, n, o = 1, c = JAUNE }) => {
  const f = useCurrentFrame();
  return (
    <g opacity={o}>
      {Array.from({ length: n }).map((_, i) => {
        const a = (i / n) * Math.PI * 2 + f / 22;
        return (
          <text key={i} x={x + Math.cos(a) * r} y={y + Math.sin(a) * r * 0.45} textAnchor="middle" fontSize={70} fontWeight={800} fill={c}>
            {i % 2 ? "♪" : "♫"}
          </text>
        );
      })}
    </g>
  );
};

const Refrain: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const boucle = quand(plan, "boucle", 0, 40);
  const aimes = quand(plan, "aimes", 0, d * 0.75);
  return (
    <Scene>
      <Sol y={1440} />
      <Bonhomme x={540} y={1440} s={1.3} c={COULEURS[1]} regard={0} />
      <Notes x={540} y={820} r={260} n={6} o={ressort(f, boucle - 10)} />
      <g transform={`translate(540 820) scale(${ressort(f, boucle)})`} opacity={0.9}>
        <Fo x={0} y={0} t={150} r={f * 3}><Repeat size={120} color="#fff" strokeWidth={2.4} /></Fo>
      </g>
      {f > aimes - 4 ? <Pastille x={540} y={520} texte="même pas ta préférée" s={ressort(f, aimes)} taille={50} fond={ROUGE} couleur="#fff" /> : null}
    </Scene>
  );
};

const Stats: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const nom = quand(plan, "nom", 0, 20);
  const neuf = quand(plan, "9", 0, 90);
  return (
    <Scene>
      <g transform={`translate(540 600) scale(${ressort(f, nom)})`}>
        <text x={0} y={0} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={86} fill={JAUNE}>le « ver d'oreille »</text>
      </g>
      {Array.from({ length: 10 }).map((_, i) => {
        const cx = 160 + (i % 5) * 190;
        const cy = 1050 + Math.floor(i / 5) * 360;
        const touche = i < 9 && f > neuf + i * 3;
        return (
          <g key={i}>
            <Bonhomme x={cx} y={cy} s={0.7} c={touche ? JAUNE : "#5A5F9A"} phase={i} />
            {touche ? <text x={cx + 50} y={cy - 210} fontSize={56} fontWeight={800} fill="#fff" opacity={ressort(f, neuf + i * 3)}>♪</text> : null}
          </g>
        );
      })}
      {f > neuf + 30 ? <Pastille x={540} y={1540} texte="9 sur 10, chaque semaine" s={ressort(f, neuf + 30)} taille={50} /> : null}
    </Scene>
  );
};

const Melodie: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const an = quand(plan, "2017", 0, 20);
  const rapide = quand(plan, "rapide", 0, d * 0.45);
  const simple = quand(plan, "simple", 0, d * 0.6);
  const saut = quand(plan, "saut", 0, d * 0.8);
  // notes d'une mélodie inventée : contour simple, puis un saut inattendu (en jaune)
  const hauteurs = [0, 1, 2, 1, 0, 1, 2, 3, 2, 1, 6, 2];
  const n = hauteurs.length;
  const visibles = Math.floor(interpolate(f, [rapide - 10, saut + 10], [0, n], clamp));
  return (
    <Scene>
      <text x={540} y={720} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={86} fill={JAUNE} opacity={ressort(f, an)}>2017</text>
      {Array.from({ length: 5 }).map((_, i) => <rect key={i} x={80} y={820 + i * 70} width={920} height={5} fill="#3B418C" />)}
      {hauteurs.slice(0, visibles).map((h, i) => {
        const special = i === 10;
        return (
          <g key={i} transform={`translate(${130 + i * 75} ${1100 - h * 45}) scale(${ressort(f, rapide - 10 + i * ((saut - rapide + 20) / n))})`}>
            <ellipse cx={0} cy={0} rx={30} ry={22} fill={special ? JAUNE : "#fff"} transform="rotate(-20)" />
            <rect x={24} y={-130} width={7} height={130} fill={special ? JAUNE : "#fff"} />
          </g>
        );
      })}
      <g>
        {f > rapide - 4 ? <Pastille x={250} y={1380} texte="rapide" s={ressort(f, rapide)} taille={44} fond="#fff" /> : null}
        {f > simple - 4 ? <Pastille x={560} y={1380} texte="simple" s={ressort(f, simple)} taille={44} fond="#fff" /> : null}
        {f > saut - 4 ? <Pastille x={850} y={1380} texte="un saut" s={ressort(f, saut)} taille={44} /> : null}
      </g>
    </Scene>
  );
};

const Fragment: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const bout = quand(plan, "bout", 0, 40);
  const rejoue = quand(plan, "rejoue", 0, d * 0.6);
  const zoom = prog(f, bout, bout + 25);
  const tours = f > rejoue ? (f - rejoue) / 18 : 0;
  return (
    <Scene>
      {/* la chanson entière, et le petit bout que ton cerveau garde */}
      <rect x={80} y={760} width={920} height={90} rx={45} fill="#3B418C" opacity={1 - zoom * 0.5} />
      <rect x={430} y={760} width={170} height={90} rx={45} fill={JAUNE} />
      <text x={540} y={700} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={44} fill="#fff" opacity={1 - zoom}>la chanson entière</text>
      <g transform={`translate(515 1180) scale(${zoom})`}>
        <circle r={230} fill="none" stroke={JAUNE} strokeWidth={30} strokeDasharray="60 30" transform={`rotate(${tours * 90})`} />
        <text y={30} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={90} fill="#fff">♪ refrain</text>
        <text y={130} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={60} fill={JAUNE} opacity={f > rejoue ? 1 : 0}>× {Math.max(1, Math.floor(tours) + 1)}</text>
      </g>
    </Scene>
  );
};

const Chewing: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const gum = quand(plan, "chewing-gum", 0, d * 0.3);
  const an = quand(plan, "2015", 0, d * 0.5);
  const bouche = quand(plan, "bouche", 0, d * 0.75);
  const calme = prog(f, bouche, bouche + 40);
  const mache = f > gum ? Math.abs(Math.sin(f / 4)) : 0;
  return (
    <Scene>
      <text x={540} y={560} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={86} fill={JAUNE} opacity={ressort(f, an)}>2015</text>
      <Sol y={1440} />
      <Bonhomme x={540} y={1440} s={1.3} c={COULEURS[1]} regard={0} />
      <Notes x={540} y={820} r={260} n={6} o={1 - calme} />
      {f > gum - 4 ? (
        <g transform={`translate(${540 + 60} ${1440 - 1.3 * 120}) scale(${ressort(f, gum) * (0.9 + mache * 0.25)})`}>
          <circle r={38} fill="#FF7AA2" />
          <circle cx={-10} cy={-10} r={10} fill="#fff" opacity={0.6} />
        </g>
      ) : null}
      {calme > 0.5 ? <Pastille x={540} y={720} texte="moins de ver d'oreille" s={ressort(f, bouche + 25)} taille={46} /> : null}
    </Scene>
  );
};

export const ScenesPourquoi: Record<string, React.FC<SceneProps>> = {
  pq_porte: PorteScene,
  pq_chapitre: Chapitre,
  pq_charge: Charge,
  pq_voix: Voix,
  pq_refrain: Refrain,
  pq_stats: Stats,
  pq_melodie: Melodie,
  pq_fragment: Fragment,
  pq_chewing: Chewing,
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
