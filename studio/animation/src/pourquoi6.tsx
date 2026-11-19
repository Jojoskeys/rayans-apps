/**
 * La Psycho Facile — « Pourquoi tu… » #14 (effet IKEA), #15 (payer par carte), #16 (faim et sommeil),
 * #17 (illusion de fréquence).
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Banknote, Brain, Car, Cookie, CreditCard, Eye, Moon, Ticket, Wrench } from "lucide-react";
import type { SceneProps } from "./types";
import { clamp, prog, quand, ressort } from "./outils";
import { Bonhomme, COULEURS, JAUNE, P, ROUGE, Scene, Sol } from "./spectateur";
import { ENCRE, Fo, GRIS, Pastille } from "./pourquoi";

const VERT = "#4CD18B";
const T: React.FC<{ x: number; y: number; t: number; c?: string; o?: number; children: React.ReactNode }> = ({ x, y, t, c = "#fff", o = 1, children }) => (
  <text x={x} y={y} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={t} fill={c} opacity={o}>{children}</text>
);
const Rond: React.FC<{ x: number; y: number; r: number; c: string; s?: number; children: React.ReactNode }> = ({ x, y, r, c, s = 1, children }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <circle r={r} fill={c} />
    <Fo x={0} y={0} t={r * 1.5}>{children}</Fo>
  </g>
);

/** Petite étagère un peu bancale (penche 0 … 1). */
const Etagere: React.FC<{ x: number; y: number; s?: number; penche?: number; c?: string }> = ({ x, y, s = 1, penche = 0.3, c = "#C98B4E" }) => (
  <g transform={`translate(${x} ${y}) scale(${s}) rotate(${penche * 5})`}>
    <rect x={-150} y={-300} width={20} height={300} fill={c} />
    <rect x={130} y={-300} width={20} height={300} fill={c} />
    {[0, 1, 2].map((i) => <rect key={i} x={-150} y={-290 + i * 120} width={300} height={18} fill={c} />)}
  </g>
);

// =============================================================== #14 L'effet IKEA
const IkAccroche: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const banc = quand(plan, "bancal", 0, d * 0.8);
  return (
    <Scene>
      <Sol y={1440} />
      <Etagere x={360} y={1440} s={1.1} penche={0.2 + 0.8 * prog(f, banc - 10, banc + 10)} />
      <Bonhomme x={760} y={1440} s={1.3} c={COULEURS[0]} regard={-1} halo={0.6} />
      <Rond x={760} y={1060} r={60} c={JAUNE} s={ressort(f, 10)}><Wrench size={70} color={ENCRE} strokeWidth={2.4} /></Rond>
    </Scene>
  );
};

const IkBoite: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const boite = quand(plan, "boîte", 0, d * 0.2);
  const n63 = quand(plan, "63", 0, d * 0.6);
  const prix = (x: number, h: number, c: string, txt: string, o: number) => (
    <g opacity={o}>
      <rect x={x - 110} y={1300 - h} width={220} height={h} rx={20} fill={c} />
      <T x={x} y={1370} t={38}>{txt}</T>
    </g>
  );
  return (
    <Scene>
      <g transform={`translate(540 640) scale(${ressort(f, boite)})`}>
        <rect x={-120} y={-90} width={240} height={180} rx={16} fill="#C98B4E" />
        <rect x={-120} y={-90} width={240} height={40} rx={10} fill="#A86E38" />
      </g>
      {prix(320, 300, "#5A5F9A", "déjà montée", prog(f, n63 - 40, n63 - 20))}
      {prix(760, interpolate(prog(f, n63 - 10, n63 + 20), [0, 1], [300, 490]), JAUNE, "montée par toi", prog(f, n63 - 40, n63 - 20))}
      {f > n63 ? <Pastille x={760} y={760} texte="+ 63 %" s={ressort(f, n63 + 10)} taille={60} /> : null}
    </Scene>
  );
};

const IkOrigami: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const prec = quand(plan, "précieux", 0, d * 0.55);
  const exp = quand(plan, "expert", 0, d * 0.85);
  const grue = (x: number, c: string, rat: boolean) => (
    <g transform={`translate(${x} 900) rotate(${rat ? -12 : 0})`}>
      <path d="M-120,40 L0,-60 L120,40 L0,10 Z" fill={c} />
      <path d={rat ? "M0,-60 L-30,-150 L10,-120 Z" : "M0,-60 L40,-170 L20,-60 Z"} fill={c} />
      <path d="M-120,40 L-180,-40 L-100,20 Z" fill={c} opacity={0.8} />
    </g>
  );
  return (
    <Scene>
      {grue(300, JAUNE, true)}
      {grue(780, "#fff", false)}
      <T x={300} y={1080} t={40} c={GRIS}>toi</T>
      <T x={780} y={1080} t={40} c={GRIS} o={prog(f, exp - 20, exp)}>un expert</T>
      {f > prec - 4 ? <Pastille x={540} y={1260} texte="presque aussi précieux" s={ressort(f, prec)} taille={48} /> : null}
    </Scene>
  );
};

const IkFini: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const term = quand(plan, "terminé", 0, d * 0.3);
  const reussi = quand(plan, "réussi", 0, d * 0.85);
  return (
    <Scene>
      <Sol y={1440} />
      <g opacity={1 - prog(f, reussi - 20, reussi)}>
        <Etagere x={540} y={1440} s={1.2} penche={0} />
        <rect x={380} y={1100} width={320} height={160} fill="#1B1F4B" opacity={0.9} />
        {f > term - 4 ? <Pastille x={540} y={820} texte="pas fini = pas d'effet" s={ressort(f, term)} taille={46} fond={ROUGE} couleur="#fff" /> : null}
      </g>
      <g opacity={prog(f, reussi - 20, reussi)}>
        <Etagere x={540} y={1440} s={1.2} penche={0.1} c={JAUNE} />
        <Pastille x={540} y={820} texte="réussi !" s={ressort(f, reussi)} taille={60} fond={VERT} couleur="#fff" />
      </g>
    </Scene>
  );
};

const IkValeur: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const eff = quand(plan, "effort", 0, d * 0.2);
  const val = quand(plan, "valeur", 0, d * 0.45);
  return (
    <Scene>
      <Sol y={1440} />
      <Bonhomme x={540} y={1440} s={1.4} c={JAUNE} halo={prog(f, val, val + 20)} bras={f > eff ? 1 : 0} />
      {f > val - 4 ? <T x={540} y={800} t={110} c={JAUNE} o={ressort(f, val)}>effort = valeur</T> : null}
    </Scene>
  );
};

// =============================================================== #15 Payer par carte
const CaAccroche: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const bil = quand(plan, "billets", 0, d * 0.8);
  return (
    <Scene>
      <Rond x={330} y={900} r={160} c={JAUNE}><CreditCard size={200} color={ENCRE} strokeWidth={2} /></Rond>
      <g opacity={prog(f, bil - 10, bil + 5)}>
        <Rond x={750} y={900} r={160} c={VERT}><Banknote size={200} color="#fff" strokeWidth={2} /></Rond>
      </g>
      <T x={330} y={1140} t={50} c={JAUNE}>+ cher</T>
      <T x={750} y={1140} t={50} c={VERT} o={prog(f, bil - 10, bil + 5)}>- cher</T>
    </Scene>
  );
};

const CaEnchere: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const ench = quand(plan, "enchères", 0, d * 0.25);
  const deux = quand(plan, "deux", 0, d * 0.7);
  const h = prog(f, deux - 20, deux + 15);
  return (
    <Scene>
      <Rond x={540} y={760} r={80} c="#fff" s={ressort(f, ench)}><Ticket size={110} color={ENCRE} strokeWidth={2.2} /></Rond>
      <rect x={210} y={1300 - 220} width={220} height={220} rx={20} fill={VERT} opacity={prog(f, ench + 10, ench + 30)} />
      <rect x={650} y={1300 - 220 - 220 * h} width={220} height={220 + 220 * h} rx={20} fill={JAUNE} opacity={prog(f, ench + 10, ench + 30)} />
      <T x={320} y={1370} t={40}>espèces</T>
      <T x={760} y={1370} t={40}>carte</T>
      {f > deux ? <Pastille x={760} y={780} texte="× 2" s={ressort(f, deux + 5)} taille={70} /> : null}
    </Scene>
  );
};

const CaDouleur: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const dou = quand(plan, "douleur", 0, d * 0.2);
  const part = quand(plan, "partir", 0, d * 0.55);
  const rien = quand(plan, "rien", 0, d * 0.9);
  const vol = prog(f, part - 20, part + 30);
  return (
    <Scene>
      {f > dou - 4 ? <Pastille x={540} y={560} texte="la douleur de payer" s={ressort(f, dou)} taille={56} fond={ROUGE} couleur="#fff" /> : null}
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(${300 + i * 20 + vol * (200 + i * 60)} ${900 - vol * (200 + i * 80)}) rotate(${vol * (20 + i * 15)})`} opacity={1 - vol * 0.8}>
          <rect x={-90} y={-45} width={180} height={90} rx={10} fill={VERT} />
          <circle r={24} fill="#fff" opacity={0.6} />
        </g>
      ))}
      <g opacity={prog(f, rien - 20, rien)}>
        <Rond x={540} y={1230} r={110} c={JAUNE}><CreditCard size={140} color={ENCRE} strokeWidth={2} /></Rond>
        <T x={540} y={1420} t={46} c={GRIS}>… presque rien</T>
      </g>
    </Scene>
  );
};

const CaAstuce: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const esp = quand(plan, "espèces", 0, d * 0.6);
  return (
    <Scene>
      <Rond x={540} y={860} r={180} c={VERT} s={ressort(f, esp)}><Banknote size={240} color="#fff" strokeWidth={2} /></Rond>
      {f > esp + 10 ? <Pastille x={540} y={1180} texte="petites dépenses : en espèces" s={ressort(f, esp + 10)} taille={44} /> : null}
    </Scene>
  );
};

// =============================================================== #16 La faim quand on dort mal
const FaAccroche: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const suc = quand(plan, "sucré", 0, d * 0.8);
  return (
    <Scene>
      <Sol y={1440} />
      <Bonhomme x={420} y={1440} s={1.3} c={COULEURS[1]} regard={1} />
      <path d="M380,1252 h20 M424,1252 h20" stroke={ENCRE} strokeWidth={6} />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${720 + i * 90} ${1000 - i * 110}) scale(${ressort(f, suc - 10 + i * 5)})`}>
          <Rond x={0} y={0} r={60} c={JAUNE}><Cookie size={80} color={ENCRE} strokeWidth={2.2} /></Rond>
        </g>
      ))}
    </Scene>
  );
};

const FaHormones: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const quatre = quand(plan, "4", 0, d * 0.2);
  const n28 = quand(plan, "28", 0, d * 0.6);
  const n18 = quand(plan, "18", 0, d * 0.9);
  const a = prog(f, n28 - 15, n28 + 15);
  const b = prog(f, n18 - 15, n18 + 15);
  return (
    <Scene>
      <Rond x={540} y={620} r={70} c="#2A2F70" s={ressort(f, quatre)}><Moon size={90} color={JAUNE} strokeWidth={2} /></Rond>
      <T x={540} y={750} t={46} c={JAUNE} o={ressort(f, quatre)}>4 h × 2 nuits</T>
      <rect x={210} y={1300 - 300 - 84 * a} width={220} height={300 + 84 * a} rx={20} fill={ROUGE} />
      <rect x={650} y={1300 - 300 + 54 * b} width={220} height={300 - 54 * b} rx={20} fill={VERT} />
      <T x={320} y={1370} t={34}>« j'ai faim »</T>
      <T x={760} y={1370} t={34}>« j'ai assez mangé »</T>
      {a > 0.5 ? <Pastille x={320} y={860} texte="+ 28 %" s={ressort(f, n28)} taille={50} fond={ROUGE} couleur="#fff" /> : null}
      {b > 0.5 ? <Pastille x={760} y={920} texte="- 18 %" s={ressort(f, n18)} taille={50} fond={VERT} couleur="#fff" /> : null}
    </Scene>
  );
};

const FaEnvies: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const n24 = quand(plan, "24", 0, d * 0.2);
  const suc = quand(plan, "sucré", 0, d * 0.6);
  return (
    <Scene>
      <T x={540} y={700} t={150} c={JAUNE} o={ressort(f, n24)}>+ 24 %</T>
      <T x={540} y={790} t={46} o={ressort(f, n24)}>de faim</T>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(${180 + i * 180} 1150) scale(${ressort(f, suc + i * 4)})`}>
          <Rond x={0} y={0} r={70} c={JAUNE}><Cookie size={90} color={ENCRE} strokeWidth={2.2} /></Rond>
        </g>
      ))}
    </Scene>
  );
};

const FaCerveau: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const ral = quand(plan, "ralenti", 0, d * 0.6);
  const tent = quand(plan, "tentants", 0, d * 0.9);
  const lent = prog(f, ral - 15, ral + 10);
  return (
    <Scene>
      <g transform="translate(540 800)">
        <circle r={190} fill={JAUNE} opacity={0.2 * (1 - lent) + 0.05} />
        <Fo x={0} y={0} t={280}><Brain size={230} color={lent > 0.5 ? GRIS : JAUNE} strokeWidth={1.6} /></Fo>
      </g>
      {lent > 0.5 ? <Pastille x={540} y={520} texte="décisions au ralenti" s={ressort(f, ral)} taille={46} fond="#fff" /> : null}
      {f > tent - 4 ? <Rond x={540} y={1200} r={100} c={ROUGE} s={1 + 0.1 * Math.sin(f / 4)}><Cookie size={130} color="#fff" strokeWidth={2.2} /></Rond> : null}
    </Scene>
  );
};

const FaConseil: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const dor = quand(plan, "dormir", 0, d * 0.7);
  return (
    <Scene>
      <Rond x={540} y={860} r={180} c="#2A2F70" s={ressort(f, dor)}><Moon size={220} color={JAUNE} strokeWidth={1.8} /></Rond>
      {f > dor ? <Pastille x={540} y={1180} texte="d'abord : dormir" s={ressort(f, dor + 5)} taille={56} /> : null}
    </Scene>
  );
};

// =============================================================== #17 L'illusion de fréquence
const Voitures: React.FC<{ n: number; jaunes: number[]; o?: number }> = ({ n, jaunes, o = 1 }) => (
  <g opacity={o}>
    {Array.from({ length: n }).map((_, i) => {
      const x = 150 + (i % 5) * 195;
      const y = 620 + Math.floor(i / 5) * 190;
      const j = jaunes.includes(i);
      return <Fo key={i} x={x} y={y} t={150}><Car size={120} color={j ? JAUNE : "#5A5F9A"} strokeWidth={j ? 2.6 : 1.8} /></Fo>;
    })}
  </g>
);

const IfAccroche: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const part = quand(plan, "partout", 0, d * 0.8);
  const allumees = f > part - 10 ? [1, 7, 12, 18] : [];
  return (
    <Scene>
      <Voitures n={20} jaunes={allumees} />
      {f > part ? <Pastille x={540} y={1350} texte="partout ?" s={ressort(f, part)} taille={60} /> : null}
    </Scene>
  );
};

const IfNom: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const av = quand(plan, "qu'avant", 0, d * 0.2);
  const an = quand(plan, "2006", 0, d * 0.85);
  return (
    <Scene>
      <Voitures n={20} jaunes={[1, 7, 12, 18]} o={0.4} />
      {f > av - 4 ? <Pastille x={540} y={1350} texte="toujours 4 sur 20" s={ressort(f, av)} taille={50} fond="#fff" /> : null}
      <T x={540} y={540} t={60} c={JAUNE} o={ressort(f, an)}>Zwicky, 2006</T>
    </Scene>
  );
};

const IfFiltre: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const fil = quand(plan, "filtre", 0, d * 0.5);
  const p = prog(f, fil - 20, fil + 10);
  return (
    <Scene>
      <Voitures n={20} jaunes={[1, 7, 12, 18]} o={1} />
      <rect x={0} y={480} width={1080} height={820} fill="#12163A" opacity={0.75 * p} />
      {p > 0.5 ? (
        <g>
          {[1, 7, 12, 18].map((i) => (
            <Fo key={i} x={150 + (i % 5) * 195} y={620 + Math.floor(i / 5) * 190} t={150}><Car size={120} color={JAUNE} strokeWidth={2.6} /></Fo>
          ))}
        </g>
      ) : null}
      <Rond x={540} y={1350} r={70} c={JAUNE} s={ressort(f, fil)}><Eye size={100} color={ENCRE} strokeWidth={2.2} /></Rond>
    </Scene>
  );
};

const IfGorille: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const moit = quand(plan, "moitié", 0, d * 0.3);
  const gor = quand(plan, "gorille", 0, d * 0.5);
  const passes = quand(plan, "passes", 0, d * 0.9);
  const gx = interpolate(f, [gor - 10, gor + 60], [-120, 1200], clamp);
  return (
    <Scene>
      <Sol y={1440} />
      {[0, 1, 2, 3].map((i) => <Bonhomme key={i} x={200 + i * 230} y={1440} s={0.9} c={i % 2 ? "#fff" : "#2A2F70"} phase={i} />)}
      <circle cx={540 + Math.sin(f / 6) * 300} cy={1180 - Math.abs(Math.sin(f / 6)) * 120} r={24} fill="#C98B4E" />
      <g transform={`translate(${gx} 1440)`} opacity={0.85}>
        <ellipse cx={0} cy={-120} rx={70} ry={110} fill="#3a3a3a" />
        <circle cx={0} cy={-250} r={44} fill="#3a3a3a" />
      </g>
      {f > moit - 4 ? <Pastille x={540} y={640} texte="1 personne sur 2 ne l'a pas vu" s={ressort(f, moit)} taille={44} fond={ROUGE} couleur="#fff" /> : null}
      {f > passes - 4 ? <Pastille x={540} y={820} texte="occupés à compter" s={ressort(f, passes)} taille={44} fond="#fff" /> : null}
    </Scene>
  );
};

const IfConfirme: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const rai = quand(plan, "raison", 0, d * 0.85);
  const vues = Math.min(6, Math.floor(f / 18));
  return (
    <Scene>
      {Array.from({ length: vues }).map((_, i) => (
        <g key={i} transform={`translate(${200 + (i % 3) * 340} ${700 + Math.floor(i / 3) * 260}) scale(${ressort(f, i * 18)})`}>
          <circle r={70} fill={VERT} />
          <path d="M-30,0 L-8,24 L32,-22" stroke="#fff" strokeWidth={14} fill="none" strokeLinecap="round" />
        </g>
      ))}
      {f > rai - 4 ? <Pastille x={540} y={1300} texte="il ne compte que les « oui »" s={ressort(f, rai)} taille={46} /> : null}
    </Scene>
  );
};

export const ScenesPourquoi6: Record<string, React.FC<SceneProps>> = {
  pq_ik_accroche: IkAccroche,
  pq_ik_boite: IkBoite,
  pq_ik_origami: IkOrigami,
  pq_ik_fini: IkFini,
  pq_ik_valeur: IkValeur,
  pq_ca_accroche: CaAccroche,
  pq_ca_enchere: CaEnchere,
  pq_ca_douleur: CaDouleur,
  pq_ca_astuce: CaAstuce,
  pq_fa_accroche: FaAccroche,
  pq_fa_hormones: FaHormones,
  pq_fa_envies: FaEnvies,
  pq_fa_cerveau: FaCerveau,
  pq_fa_conseil: FaConseil,
  pq_if_accroche: IfAccroche,
  pq_if_nom: IfNom,
  pq_if_filtre: IfFiltre,
  pq_if_gorille: IfGorille,
  pq_if_confirme: IfConfirme,
};
