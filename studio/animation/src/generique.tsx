/**
 * La Psycho Facile — décor générique piloté par le script (champ `visuel` d'un segment).
 * Scènes `pq_g1` … `pq_g9` (même rendu ; plusieurs noms pour que deux segments voisins restent deux plans).
 *
 *   "visuel": {
 *     "annee": "2012",                                   // en haut, en jaune
 *     "chiffre": {"texte": "63 %", "mot": "63", "sous": "plus cher"},
 *     "pastilles": [{"texte": "…", "mot": "…", "rouge": true}],
 *     "icones": [{"nom": "Coffee", "mot": "café", "texte": "café tard"}],   // icônes lucide.dev, 1 à 4
 *     "barres": [{"texte": "toi", "valeur": 0.4, "mot": "…", "rouge": true}], // 2 ou 3 barres (valeur 0…1)
 *     "perso": {"nb": 10, "jaunes": 7, "mot": "70", "bulle": "« … »", "icone": "Phone"}
 *   }
 * Chaque élément surgit quand on dit son `mot` (sinon au début). Utiliser 2 ou 3 éléments par plan au plus.
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import * as Lucide from "lucide-react";
import type { SceneProps, Visuel } from "./types";
import { clamp, quand, ressort } from "./outils";
import { Bonhomme, COULEURS, JAUNE, P, ROUGE, Scene, Sol } from "./spectateur";
import { ENCRE, Fo, Pastille } from "./pourquoi";

const VERT = "#4CD18B";

const Icone: React.FC<{ nom: string; taille: number; couleur: string }> = ({ nom, taille, couleur }) => {
  const C = (Lucide as unknown as Record<string, React.FC<{ size: number; color: string; strokeWidth: number }>>)[nom] ?? Lucide.Sparkles;
  return <C size={taille} color={couleur} strokeWidth={2.2} />;
};

const T: React.FC<{ x: number; y: number; t: number; c?: string; o?: number; children: React.ReactNode }> = ({ x, y, t, c = "#fff", o = 1, children }) => (
  <text x={x} y={y} textAnchor="middle" fontFamily={P} fontWeight={800} fontSize={t} fill={c} opacity={o}>{children}</text>
);

const Generique: React.FC<SceneProps> = ({ plan }) => {
  const f = useCurrentFrame();
  const d = plan.fin - plan.debut;
  const v: Visuel = plan.segments.find((s) => s.visuel)?.visuel ?? {};
  const t = (mot: string | undefined, defaut = 6) => (mot ? quand(plan, mot, 0, defaut) : defaut);
  const perso = v.perso;
  const aPerso = !!perso;
  const aBarres = !!v.barres?.length;
  // placement vertical : on calcule la hauteur de chaque bloc, puis on centre l'ensemble dans la zone libre
  // (sous le titre ≈ 600, au-dessus du personnage ou des sous-titres ≈ 1450)
  const nIc = v.icones?.length ?? 0;
  const rIc = nIc > 3 ? 80 : 100;
  const hAnnee = v.annee ? 120 : 0;
  const hChiffre = v.chiffre ? (v.chiffre.sous ? 270 : 200) : 0;
  const hPast = (v.pastilles?.length ?? 0) * 120;
  const hIc = nIc ? 2 * rIc + 120 : 0;
  const hBar = aBarres ? 440 : 0;
  const haut = 620;
  const bas = aPerso ? 1060 : 1450;
  const total = hAnnee + hChiffre + hPast + hIc + hBar;
  let y = Math.max(haut, (haut + bas) / 2 - total / 2);
  const blocs: React.ReactNode[] = [];

  if (v.annee) {
    blocs.push(<T key="an" x={540} y={y + 80} t={90} c={JAUNE} o={ressort(f, 4)}>{v.annee}</T>);
    y += hAnnee;
  }
  if (v.chiffre) {
    const tc = t(v.chiffre.mot, 8);
    blocs.push(
      <g key="ch" transform={`translate(540 ${y + 150}) scale(${ressort(f, tc)})`} opacity={f > tc - 4 ? 1 : 0}>
        <T x={0} y={0} t={Math.min(160, Math.floor(1500 / Math.max(1, v.chiffre.texte.length)))} c={JAUNE}>{v.chiffre.texte}</T>
        {v.chiffre.sous ? <T x={0} y={80} t={48}>{v.chiffre.sous}</T> : null}
      </g>,
    );
    y += hChiffre;
  }
  (v.pastilles ?? []).forEach((p, i) => {
    const tp = t(p.mot, 10 + i * 20);
    const yy = y + 60 + i * 120;
    blocs.push(f > tp - 4 ? <Pastille key={"p" + i} x={540} y={yy} texte={p.texte} s={ressort(f, tp)} taille={p.texte.length > 26 ? 40 : 50} fond={p.rouge ? ROUGE : JAUNE} couleur={p.rouge ? "#fff" : ENCRE} /> : null);
  });
  y += hPast;

  if (nIc) {
    const pas = nIc === 1 ? 0 : Math.min(400, 880 / (nIc - 1));
    const yi = y + rIc + 10;
    v.icones!.forEach((ic, i) => {
      const ti = t(ic.mot, 10 + i * 15);
      const x = 540 + (i - (nIc - 1) / 2) * pas;
      blocs.push(
        <g key={"i" + i} transform={`translate(${x} ${yi}) scale(${ressort(f, ti)})`} opacity={f > ti - 4 ? 1 : 0}>
          <circle r={rIc} fill={i % 2 ? JAUNE : "#fff"} />
          <Fo x={0} y={0} t={rIc * 1.5}><Icone nom={ic.nom} taille={rIc * 1.1} couleur={ENCRE} /></Fo>
          {ic.texte ? <T x={0} y={rIc + 58} t={nIc > 2 ? 34 : 42}>{ic.texte}</T> : null}
        </g>,
      );
    });
    y += hIc;
  }

  if (aBarres) {
    const bs = v.barres!;
    const n = bs.length;
    const base = y + 360;
    const hmax = 330;
    bs.forEach((b, i) => {
      const tb = t(b.mot, 10 + i * 20);
      const k = interpolate(f, [tb - 10, tb + 15], [0.12, 1], clamp);
      const h = hmax * Math.max(0.06, b.valeur) * k;
      const x = 540 + (i - (n - 1) / 2) * (n > 2 ? 300 : 340);
      blocs.push(
        <g key={"b" + i}>
          <rect x={x - 100} y={base - h} width={200} height={h} rx={20} fill={b.rouge ? ROUGE : i === n - 1 ? JAUNE : "#5A5F9A"} />
          <T x={x} y={base + 55} t={b.texte.length > 14 ? 30 : 38}>{b.texte}</T>
        </g>,
      );
    });
  }

  let persoNode: React.ReactNode = null;
  if (perso) {
    const nb = perso.nb ?? 1;
    const tj = t(perso.mot, 20);
    if (nb === 1) {
      const tb = t(perso.mot, 15);
      persoNode = (
        <g>
          <Sol y={1440} />
          <Bonhomme x={540} y={1440} s={1.4} c={(perso.jaunes ?? 0) > 0 && f > tj ? JAUNE : COULEURS[1]} />
          {perso.icone ? <g transform={`translate(760 1180) scale(${ressort(f, tb)})`}><circle r={70} fill="#fff" /><Fo x={0} y={0} t={100}><Icone nom={perso.icone} taille={80} couleur={ENCRE} /></Fo></g> : null}
          {perso.bulle && f > tb - 4 ? (
            <g transform={`translate(540 1110) scale(${ressort(f, tb)})`}>
              <rect x={-Math.min(470, perso.bulle.length * 15 + 60)} y={-80} width={Math.min(940, perso.bulle.length * 30 + 120)} height={110} rx={50} fill="#fff" />
              <T x={0} y={-8} t={perso.bulle.length > 26 ? 34 : 42} c={ENCRE}>{perso.bulle}</T>
            </g>
          ) : null}
        </g>
      );
    } else {
      const parLigne = nb > 10 ? 6 : 5;
      const lignes = Math.ceil(nb / parLigne);
      const y0 = 1440 - (lignes - 1) * 200;
      persoNode = (
        <g>
          {Array.from({ length: nb }).map((_, i) => {
            const x = 540 + ((i % parLigne) - (parLigne - 1) / 2) * 180;
            const yy = y0 + Math.floor(i / parLigne) * 200;
            const jaune = i < (perso.jaunes ?? 0) && f > tj + i * 2;
            return <Bonhomme key={i} x={x} y={Math.min(yy, 1440)} s={0.6} c={jaune ? JAUNE : "#5A5F9A"} phase={i} />;
          })}
        </g>
      );
    }
  }

  return (
    <Scene zoom={interpolate(f, [0, d], [1.0, 1.03], clamp)}>
      {persoNode}
      {blocs}
    </Scene>
  );
};

export const ScenesGenerique: Record<string, React.FC<SceneProps>> = Object.fromEntries(
  Array.from({ length: 9 }).map((_, i) => [`pq_g${i + 1}`, Generique]),
);

void VERT;
