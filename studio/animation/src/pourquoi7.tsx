/**
 * La Psycho Facile — « Pourquoi tu… » #18 à #31 (lot 2). Décors construits à partir d'un modèle réglable :
 * une icône (ou une scène simple), un grand texte, des pastilles et des personnages qui surgissent sur des mots
 * précis de la voix. Même style plat que pourquoi.tsx.
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import {
  BookOpen, Brain, Car, Clock, Cloud, Eye, Footprints, GraduationCap, Hand, History, Hourglass, Lightbulb, ListOrdered,
  MessageCircle, Moon, NotebookPen, Plug, Route, ShowerHead, Smile, Tag, Timer, Users, Utensils,
} from "lucide-react";
import type { SceneProps } from "./types";
import { prog, quand, ressort } from "./outils";
import { Bonhomme, COULEURS, JAUNE, P, ROUGE, Scene, Sol } from "./spectateur";
import { ENCRE, Fo, Pastille } from "./pourquoi";

const VERT = "#4CD18B";
type Icone = React.FC<{ size?: number; color?: string; strokeWidth?: number }>;

export type Conf = {
  icone?: Icone;
  fondIcone?: string;
  couleurIcone?: string;
  grand?: [string, string, string?]; // [mot déclencheur, texte, couleur]
  pastilles?: [string, string, string?][]; // [mot, texte, fond]
  foule?: { n: number; jaunes: number; mot: string };
  perso?: boolean; // un personnage au sol
};

const Fiche: React.FC<{ plan: SceneProps["plan"]; c: Conf }> = ({ plan, c }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const yIcone = c.grand ? 860 : 780;
  return (
    <Scene>
      {c.perso || c.foule ? <Sol y={1440} /> : null}
      {c.grand ? (() => {
        const t = quand(plan, c.grand[0], 0, d * 0.4);
        return f > t - 4 ? (
          <g transform={`translate(540 600) scale(${ressort(f, t)})`}>
            <text textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={c.grand[1].length > 8 ? 96 : 150} fill={c.grand[2] ?? JAUNE}>{c.grand[1]}</text>
          </g>
        ) : null;
      })() : null}
      {c.icone ? (
        <g transform={`translate(540 ${c.perso || c.foule ? yIcone - 60 : yIcone}) scale(${ressort(f, 2)})`}>
          <circle r={150} fill={c.fondIcone ?? JAUNE} opacity={c.fondIcone ? 1 : 0.9} />
          <Fo x={0} y={0} t={220}>{React.createElement(c.icone, { size: 170, color: c.couleurIcone ?? ENCRE, strokeWidth: 2 })}</Fo>
        </g>
      ) : null}
      {c.foule ? (() => {
        const t = quand(plan, c.foule.mot, 0, d * 0.5);
        return Array.from({ length: c.foule.n }).map((_, i) => {
          const n = c.foule!.n;
          const x = 540 + (i - (n - 1) / 2) * Math.min(180, 900 / n);
          return <Bonhomme key={i} x={x} y={1440} s={0.8} c={i < c.foule!.jaunes && f > t + i * 3 ? JAUNE : "#5A5F9A"} phase={i} />;
        });
      })() : c.perso ? <Bonhomme x={540} y={1440} s={1.1} c={COULEURS[(plan.debut / 7) % 6 | 0]} /> : null}
      {(c.pastilles ?? []).map(([mot, texte, fond], i) => {
        const t = quand(plan, mot, 0, d * (0.3 + i * 0.2));
        const y = (c.perso || c.foule ? 1120 : 1150) + i * 0 - (c.pastilles!.length - 1 - i) * 120;
        return f > t - 4 ? (
          <Pastille key={i} x={540} y={y} texte={texte} s={ressort(f, t)} taille={texte.length > 24 ? 38 : 46}
            fond={fond ?? (i % 2 ? "#fff" : JAUNE)} couleur={fond === ROUGE || fond === VERT ? "#fff" : ENCRE} />
        ) : null;
      })}
    </Scene>
  );
};

export const S = (c: Conf): React.FC<SceneProps> => ({ plan }) => <Fiche plan={plan} c={c} />;

/** Une liste de mots, le début et la fin en jaune (#31). */
const Liste: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const prem = quand(plan, "premiers", 0, d * 0.5);
  const mots = ["pain", "lait", "œufs", "riz", "sel", "thé", "miel", "pâtes", "pommes"];
  return (
    <Scene>
      {mots.map((m, i) => {
        const fort = i < 2 || i > 6;
        const p = prog(f, prem - 10, prem + 15);
        return (
          <g key={m} transform={`translate(540 ${500 + i * 100})`} opacity={fort ? 1 : 1 - 0.7 * p}>
            <rect x={-220} y={-40} width={440} height={76} rx={38} fill={fort && p > 0.5 ? JAUNE : "#2A2F70"} />
            <text y={14} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={44} fill={fort && p > 0.5 ? ENCRE : "#fff"}>{m}</text>
          </g>
        );
      })}
    </Scene>
  );
};

export const ScenesPourquoi7: Record<string, React.FC<SceneProps>> = {
  // #18 le trajet retour
  pq_rt_accroche: S({ icone: Route, pastilles: [["retour", "le retour… plus court ?"]] }),
  pq_rt_mesure: S({ icone: Clock, grand: ["22", "- 22 %"], pastilles: [["court", "même distance"]] }),
  pq_rt_attente: S({ icone: Hourglass, fondIcone: ROUGE, couleurIcone: "#fff", pastilles: [["sous-estimes", "aller : plus long que prévu", ROUGE]] }),
  pq_rt_retour: S({ icone: Car, fondIcone: VERT, couleurIcone: "#fff", pastilles: [["surpris", "retour : agréable surprise", VERT]] }),
  pq_rt_astuce: S({ icone: Timer, pastilles: [["plus", "prévois un peu plus de temps"]] }),
  // #19 je le savais
  pq_js_accroche: S({ icone: History, perso: true, pastilles: [["début", "« je le savais ! »"]] }),
  pq_js_nom: S({ icone: Eye, grand: ["rétrospectif", "après coup"], pastilles: [["évident", "tout paraît évident"]] }),
  pq_js_etude: S({ icone: Brain, grand: ["1975", "1975"], pastilles: [["prédire", "prédiction : pas sûr", "#fff"], ["vraiment", "souvenir : « j'étais sûr »", ROUGE]] }),
  pq_js_reecrit: S({ icone: NotebookPen, pastilles: [["réécrit", "ton cerveau réécrit"], ["doutes", "tes doutes effacés", ROUGE]] }),
  pq_js_astuce: S({ icone: NotebookPen, fondIcone: VERT, couleurIcone: "#fff", pastilles: [["note", "note ton avis avant"]] }),
  // #20 dire non
  pq_dn_accroche: S({ icone: Hand, perso: true, pastilles: [["oui", "oui…"], ["non", "… pas de non possible", ROUGE]] }),
  pq_dn_panneau: S({ grand: ["17", "17 %", ROUGE], foule: { n: 6, jaunes: 1, mot: "17" }, pastilles: [["moche", "un grand panneau moche"]] }),
  pq_dn_petit: S({ grand: ["76", "76 %", VERT], foule: { n: 6, jaunes: 5, mot: "76" }, pastilles: [["autocollant", "d'abord : un petit autocollant", "#fff"]] }),
  pq_dn_coherence: S({ icone: Users, pastilles: [["aide", "« je suis quelqu'un qui aide »"], ["cohérent", "rester cohérent", "#fff"]] }),
  pq_dn_astuce: S({ icone: MessageCircle, pastilles: [["premier", "oui… sans le premier oui ?"]] }),
  // #21 prix en ,99
  pq_99_accroche: S({ icone: Tag, grand: ["9,99", "9,99 €"], pastilles: [["10", "10 €", "#fff"]] }),
  pq_99_gauche: S({ grand: ["premier", "9 < 10"], icone: Eye, pastilles: [["gauche", "lu de gauche à droite", "#fff"]] }),
  pq_99_etude: S({ grand: ["2005", "2,99 vs 3,00"], icone: Tag, pastilles: [["différence", "3,60 vs 3,59 : pareil", "#fff"], ["gauche", "seul le 1er chiffre compte"]] }),
  pq_99_magasins: S({ icone: Tag, fondIcone: ROUGE, couleurIcone: "#fff", pastilles: [["partout", "des 99 partout", ROUGE]] }),
  pq_99_astuce: S({ grand: ["10", "9,99 = 10"], icone: Tag, fondIcone: VERT, couleurIcone: "#fff" }),
  // #22 apprendre en expliquant
  pq_ex_accroche: S({ icone: GraduationCap, perso: true, pastilles: [["expliquer", "l'expliquer à quelqu'un"]] }),
  pq_ex_etude: S({ grand: ["2014", "2014"], icone: BookOpen, pastilles: [["test", "« il y aura un test »", "#fff"], ["l'enseigner", "« vous l'enseignerez » : mieux retenu"]] }),
  pq_ex_range: S({ icone: Brain, pastilles: [["l'essentiel", "l'essentiel"], ["idées", "les liens entre les idées", "#fff"]] }),
  pq_ex_vrai: S({ icone: MessageCircle, pastilles: [["vrai", "à voix haute : encore mieux", VERT]] }),
  pq_ex_astuce: S({ icone: GraduationCap, fondIcone: VERT, couleurIcone: "#fff", pastilles: [["chaise", "explique… même à ta chaise"]] }),
  // #23 dormir pour retenir
  pq_dr_accroche: S({ icone: Moon, pastilles: [["dormi", "dormir = retenir ?"]] }),
  pq_dr_etude: S({ grand: ["1924", "1924"], icone: Moon, pastilles: [["éveillé", "on oublie moins après le sommeil"]] }),
  pq_dr_rejoue: S({ icone: Brain, pastilles: [["rejoue", "la nuit, ton cerveau rejoue"], ["terme", "mémoire à long terme", "#fff"]] }),
  pq_dr_nuit: S({ icone: Clock, fondIcone: ROUGE, couleurIcone: "#fff", pastilles: [["blanche", "nuit blanche = mauvaise idée", ROUGE]] }),
  pq_dr_astuce: S({ icone: BookOpen, fondIcone: VERT, couleurIcone: "#fff", pastilles: [["dors", "révise… puis dors"]] }),
  // #24 première impression
  pq_pi_accroche: S({ icone: Eye, perso: true, pastilles: [["seconde", "en moins d'une seconde"]] }),
  pq_pi_etude: S({ grand: ["dixième", "0,1 s"], icone: Timer, pastilles: [["temps", "jugement déjà fait"]] }),
  pq_pi_confiance: S({ icone: Clock, pastilles: [["longtemps", "plus de temps…", "#fff"], ["sûrs", "… juste plus sûrs d'eux"]] }),
  pq_pi_piege: S({ icone: Eye, fondIcone: ROUGE, couleurIcone: "#fff", pastilles: [["juste", "pas toujours juste", ROUGE]] }),
  pq_pi_astuce: S({ icone: Users, fondIcone: VERT, couleurIcone: "#fff", pastilles: [["deuxième", "une deuxième chance"]] }),
  // #25 preuve sociale
  pq_sf_accroche: S({ icone: Utensils, foule: { n: 5, jaunes: 5, mot: "monde" }, pastilles: [["vide", "plein ou vide ?"]] }),
  pq_sf_nom: S({ icone: Users, grand: ["sociale", "preuve sociale"], pastilles: [["autres", "on copie les autres", "#fff"]] }),
  pq_sf_hotel: S({ grand: ["44", "35 → 44 %"], icone: Users, pastilles: [["serviette", "« la plupart des clients… »", "#fff"]] }),
  pq_sf_chambre: S({ grand: ["49", "49 %", VERT], icone: Users, pastilles: [["suis", "plus ils te ressemblent…"]] }),
  pq_sf_astuce: S({ icone: Hand, pastilles: [["raison", "souvent juste", VERT], ["seul", "je le ferais seul ?"]] }),
  // #26 paréidolie
  pq_vo_accroche: S({ icone: Plug, pastilles: [["visages", "un visage ?"]] }),
  pq_vo_nom: S({ icone: Smile, grand: ["paréidolie", "paréidolie"], pastilles: [["pas", "des visages partout", "#fff"]] }),
  pq_vo_vite: S({ icone: Brain, grand: ["2020", "2020"], pastilles: [["vite", "traité comme un vrai visage"]] }),
  pq_vo_pourquoi: S({ icone: Eye, pastilles: [["existe", "mieux voir un faux visage…", "#fff"], ["vraiment", "… que rater un vrai"]] }),
  pq_vo_normal: S({ icone: Plug, fondIcone: VERT, couleurIcone: "#fff", pastilles: [["travail", "ton cerveau fait son travail"]] }),
  // #27 sourire
  pq_so_accroche: S({ icone: Smile, pastilles: [["heureux", "sourire → heureux ?"]] }),
  pq_so_retour: S({ icone: Smile, pastilles: [["sens", "le visage parle au cerveau"]] }),
  pq_so_etude: S({ grand: ["19", "19 pays"], icone: Smile, pastilles: [["heureux", "un peu plus heureux"]] }),
  pq_so_honnete: S({ icone: Smile, fondIcone: "#fff", pastilles: [["petit", "effet petit", ROUGE], ["ordinaire", "mais réel", VERT]] }),
  pq_so_astuce: S({ icone: Smile, fondIcone: VERT, couleurIcone: "#fff", pastilles: [["sourire", "souris, là, maintenant"]] }),
  // #28 marcher pour avoir des idées
  pq_mi_accroche: S({ icone: Footprints, perso: true, pastilles: [["marchant", "les idées en marchant"]] }),
  pq_mi_etude: S({ grand: ["60", "+ 60 %", VERT], icone: Lightbulb, pastilles: [["Assis", "assis ou en marchant ?", "#fff"]] }),
  pq_mi_apres: S({ icone: Lightbulb, pastilles: [["continuait", "l'effet dure un peu après"]] }),
  pq_mi_dehors: S({ icone: Footprints, pastilles: [["mur", "même face à un mur", "#fff"], ["compte", "c'est marcher qui compte"]] }),
  pq_mi_astuce: S({ icone: Footprints, fondIcone: VERT, couleurIcone: "#fff", pastilles: [["bloques", "tu bloques ? marche"]] }),
  // #29 le temps qui ralentit
  pq_tr_accroche: S({ icone: Hourglass, pastilles: [["ralenti", "tout au ralenti ?"]] }),
  pq_tr_chute: S({ grand: ["36", "+ 36 %"], icone: Clock, pastilles: [["31", "chute libre : 31 m", "#fff"]] }),
  pq_tr_test: S({ icone: Eye, pastilles: [["chiffre", "lire un chiffre trop rapide", "#fff"], ["ralenti", "les yeux : pas au ralenti", ROUGE]] }),
  pq_tr_memoire: S({ icone: Brain, grand: ["mémoire", "la mémoire"], pastilles: [["détails", "plus de détails enregistrés"]] }),
  // #30 la pause qui débloque
  pq_pa_accroche: S({ icone: ShowerHead, pastilles: [["solution", "la solution… sous la douche"]] }),
  pq_pa_nom: S({ icone: Lightbulb, grand: ["l'incubation", "l'incubation"], pastilles: [["trouver", "la pause aide à trouver", VERT]] }),
  pq_pa_pourquoi: S({ icone: Brain, pastilles: [["bloqué", "bloqué sur une mauvaise piste", ROUGE], ["autrement", "la pause te fait voir autrement", VERT]] }),
  pq_pa_leger: S({ icone: ShowerHead, pastilles: [["légère", "marcher, ranger, se doucher"]] }),
  pq_pa_astuce: S({ icone: Cloud, fondIcone: VERT, couleurIcone: "#fff", pastilles: [["pause", "fais une pause"]] }),
  // #31 le début et la fin
  pq_df_accroche: S({ icone: ListOrdered, pastilles: [["milieu", "le milieu disparaît", ROUGE]] }),
  pq_df_etude: Liste,
  pq_df_pourquoi: S({ icone: Brain, pastilles: [["répéter", "début : répété", "#fff"], ["frais", "fin : encore fraîche"], ["l'autre", "milieu : rien", ROUGE]] }),
  pq_df_astuce: S({ icone: BookOpen, fondIcone: VERT, couleurIcone: "#fff", pastilles: [["l'ordre", "change l'ordre de tes fiches"]] }),
};
