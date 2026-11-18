import React from "react";
import { Composition, Still } from "remotion";
import { Video } from "./Video";
import { AvatarAyati, AvatarPsycho } from "./Avatars";
import type { Timeline } from "./types";

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
    <Still id="AvatarAyati" component={AvatarAyati} width={1080} height={1080} />
    <Still id="AvatarPsycho" component={AvatarPsycho} width={1080} height={1080} />
  </>
);
