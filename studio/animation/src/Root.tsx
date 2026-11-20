import React from "react";
import { Composition, Still } from "remotion";
import { Video } from "./Video";
import { AvatarAyati, AvatarPsycho } from "./Avatars";
import { Extrait, Miniature, VideoLong } from "./long";
import type { ExtraitProps, MiniatureProps } from "./long";
import type { Timeline } from "./types";

const miniature: MiniatureProps = { texte: "Titre de la vidéo", style: "psycho", variante: 0 };
const extrait: ExtraitProps = { source: "", mots: [], duree: 90, style: "psycho" };

const vide: Timeline = { slug: "vide", style: "psycho", fps: 30, duree: 90, segments: [], cues: [], audio: "" };

export const Root: React.FC = () => (
  <>
    <Composition
      id="Video"
      component={Video as unknown as React.FC<Record<string, unknown>>}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={90}
      defaultProps={vide as unknown as Record<string, unknown>}
      calculateMetadata={({ props }) => ({ durationInFrames: (props as unknown as Timeline).duree })}
    />
    <Composition
      id="VideoLong"
      component={VideoLong as unknown as React.FC<Record<string, unknown>>}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={90}
      defaultProps={vide as unknown as Record<string, unknown>}
      calculateMetadata={({ props }) => ({ durationInFrames: (props as unknown as Timeline).duree })}
    />
    <Composition
      id="Extrait"
      component={Extrait as unknown as React.FC<Record<string, unknown>>}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={90}
      defaultProps={extrait as unknown as Record<string, unknown>}
      calculateMetadata={({ props }) => ({ durationInFrames: (props as unknown as ExtraitProps).duree })}
    />
    <Still id="Miniature" component={Miniature as unknown as React.FC<Record<string, unknown>>} width={1280} height={720} defaultProps={miniature as unknown as Record<string, unknown>} />
    <Still id="AvatarAyati" component={AvatarAyati} width={1080} height={1080} />
    <Still id="AvatarPsycho" component={AvatarPsycho} width={1080} height={1080} />
  </>
);
