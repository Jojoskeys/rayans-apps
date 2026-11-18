import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { Plan, Timeline } from "./types";
import { clamp, regrouperPlans } from "./outils";
import { ScenesAyati } from "./ayati";
import { ScenesPsycho } from "./psycho";
import { ScenesFil } from "./fil";
import { ScenesQadr } from "./qadr";
import { ScenesSpectateur } from "./spectateur";
import { ScenesPourquoi } from "./pourquoi";
import { ScenesQasas } from "./qasas";
import { Cta } from "./cta";
import { Camera, Eclairs, Grain, Progression, Surgissements, Vignette } from "./effets";
import { Accroche, CarteVerset, Marque, References, SousTitres, Titres } from "./textes";

const POLICES: [string, string, string][] = [
  ["Montserrat", "polices/Montserrat-ExtraBold.ttf", "800"],
  ["Montserrat", "polices/Montserrat-SemiBold.ttf", "600"],
  ["Montserrat", "polices/Montserrat-SemiBold.ttf", "700"],
  ["Amiri Quran", "polices/AmiriQuran.ttf", "400"],
  ["Amiri", "polices/Amiri-Bold.ttf", "700"],
];

function usePolices() {
  const [poignee] = useState(() => delayRender("polices"));
  useEffect(() => {
    Promise.all(
      POLICES.map(([nom, fichier, poids]) => {
        const p = new FontFace(nom, `url(${staticFile(fichier)})`, { weight: poids });
        document.fonts.add(p);
        return p.load();
      }),
    ).then(() => continueRender(poignee));
  }, [poignee]);
}

const FONDU = 12;

const Plan_: React.FC<{ plan: Plan; t: Timeline; premier: boolean }> = ({ plan, t, premier }) => {
  const f = useCurrentFrame();
  const o = premier ? 1 : interpolate(f, [0, FONDU], [0, 1], clamp);
  const Scene = plan.scene === "cta" ? null : (t.style === "ayati" ? { ...ScenesAyati, ...ScenesFil, ...ScenesQadr, ...ScenesQasas } : { ...ScenesPsycho, ...ScenesSpectateur, ...ScenesPourquoi })[plan.scene];
  return (
    <AbsoluteFill style={{ opacity: o }}>
      {plan.scene === "cta" ? (
        <Cta plan={plan} style={t.style} marque={t.marque} />
      ) : Scene ? (
        <Scene plan={plan} style={t.style} />
      ) : (
        <AbsoluteFill style={{ background: "#300", color: "#fff", fontSize: 60 }}>Scène inconnue : {plan.scene}</AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

const ySous = (style: Timeline["style"]) => (scene: string) => {
  if (scene === "cta") return 1500;
  if (style === "psycho") return ({ ps_rue: 1000, ps_diffusion: 1730 } as Record<string, number>)[scene] ?? 1570;
  return { lampe: 1330, palais_interieur: 1290, berge: 1180, retour: 1180 }[scene] ?? 1240;
};

export const Video: React.FC<Timeline> = (t) => {
  usePolices();
  const plans = regrouperPlans(t.segments);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Camera cues={t.cues}>
        {plans.map((p, i) => (
          <Sequence key={i} from={p.debut - (i === 0 ? p.debut : 0)} durationInFrames={p.fin - p.debut + FONDU + (i === 0 ? p.debut : 0)} layout="absolute-fill">
            <Plan_ plan={{ ...p, debut: i === 0 ? 0 : p.debut, mots: p.mots }} t={t} premier={i === 0} />
          </Sequence>
        ))}
      </Camera>
      <Eclairs cues={t.cues} />
      {t.style === "ayati" ? <Vignette force={0.7} /> : <Vignette force={0.5} />}
      <Grain force={t.style === "ayati" ? 0.1 : 0.05} />
      <CarteVerset segments={t.segments} />
      {t.style === "ayati" ? <References segments={t.segments} /> : null}
      <Accroche texte={t.accroche} fin={Math.min(105, ...t.segments.filter((x) => x.titre).map((x) => x.titre!.frame - 6))} />
      <Titres segments={t.segments} />
      <Surgissements cues={t.cues} y={t.style === "ayati" ? 640 : 1300} />
      <SousTitres segments={t.segments} y={ySous(t.style)} />
      <Marque texte={t.marque} />
      <Progression total={t.duree} />
      <Audio src={staticFile(t.audio)} />
    </AbsoluteFill>
  );
};
