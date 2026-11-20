/**
 * Format long 16:9 (YouTube), miniatures et extraits verticaux.
 * - VideoLong : la vidéo verticale habituelle au centre, son propre fond flouté derrière ; un passage qui a une
 *   « image » l'affiche en plein cadre avec un zoom très léger et les sous-titres en bas.
 * - Miniature : trois mises en page (variante 0, 1, 2) pour proposer trois miniatures.
 * - Extrait : un morceau d'une vidéo longue remis en vertical, avec les sous-titres mot par mot habituels.
 */
import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { Mot, Timeline } from "./types";
import { clamp, OR } from "./outils";
import { Video, usePolices } from "./Video";
import { Marque, SousTitres } from "./textes";
import { Progression } from "./effets";

const LW = 1920;
const LH = 1080;

/** La vidéo verticale (1080x1920) posée dans le cadre 16:9 : « fit » au centre ou « cover » pour le fond. */
const Colonne: React.FC<{ t: Timeline; mode: "fit" | "cover" }> = ({ t, mode }) => {
  const s = mode === "fit" ? LH / 1920 : LW / 1080;
  return (
    <div style={{ position: "absolute", width: 1080, height: 1920, left: (LW - 1080 * s) / 2, top: (LH - 1920 * s) / 2, transform: `scale(${s})`, transformOrigin: "top left" }}>
      <Video {...t} sansAudio />
    </div>
  );
};

const ImagePassage: React.FC<{ src: string; duree: number }> = ({ src, duree }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, duree], [1, 1.06], clamp);
  const o = interpolate(f, [0, 12], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity: o, background: "#000" }}>
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})` }} />
      <AbsoluteFill style={{ background: "linear-gradient(transparent 60%, rgba(0,0,0,0.75))" }} />
    </AbsoluteFill>
  );
};

export const VideoLong: React.FC<Timeline> = (t) => {
  usePolices();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ filter: "blur(40px) brightness(0.4)" }}>
        <Colonne t={t} mode="cover" />
      </AbsoluteFill>
      <Colonne t={t} mode="fit" />
      {t.segments.filter((s) => s.image).map((s, i) => (
        <Sequence key={i} from={s.debut} durationInFrames={Math.max(1, s.fin - s.debut)} layout="absolute-fill">
          <ImagePassage src={s.image!} duree={s.fin - s.debut} />
        </Sequence>
      ))}
      <SousTitres segments={t.segments.filter((s) => s.image)} y={() => 930} battu={t.battement === true} />
      <Progression total={t.duree} />
      {t.audio ? <Audio src={staticFile(t.audio)} /> : null}
    </AbsoluteFill>
  );
};

export type MiniatureProps = { texte: string; style: "ayati" | "psycho"; variante: number; image?: string | null; marque?: string | null };

export const Miniature: React.FC<MiniatureProps> = ({ texte, style, variante, image, marque }) => {
  usePolices();
  const fond = style === "ayati" ? "radial-gradient(circle at 70% 40%, #2a2350, #07060f 70%)" : "radial-gradient(circle at 30% 40%, #3a3a3a, #050505 70%)";
  const accent = style === "ayati" ? OR : "#FFD400";
  const mots = texte.split(" ");
  // mot mis en valeur : le dernier vrai mot, avec la ponctuation qui le suit (« t'aide ? »)
  let k = mots.length - 1;
  while (k > 0 && !/\p{L}/u.test(mots[k])) k--;
  const fort = mots.slice(k).join(" ");
  const debut = mots.slice(0, k).join(" ");
  const police: React.CSSProperties = { fontFamily: "Montserrat", fontWeight: 800, color: "#fff", lineHeight: 1.05, textShadow: "0 8px 0 rgba(0,0,0,0.8)" };
  return (
    <AbsoluteFill style={{ background: fond }}>
      {image ? <Img src={staticFile(image)} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 }} /> : null}
      {variante === 0 ? (
        <div style={{ position: "absolute", left: 70, top: 120, width: 760, ...police, fontSize: 96 }}>
          {debut} <span style={{ color: accent }}>{fort}</span>
        </div>
      ) : variante === 1 ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
          <div style={{ ...police, fontSize: 84, textAlign: "center" }}>{debut}</div>
          <div style={{ ...police, fontSize: 120, marginTop: 20, padding: "6px 34px", background: accent, color: "#111", textShadow: "none", transform: "rotate(-2deg)" }}>{fort}</div>
        </AbsoluteFill>
      ) : (
        <div style={{ position: "absolute", left: 70, right: 70, bottom: 80, ...police, fontSize: 78 }}>
          <div style={{ width: 160, height: 12, background: accent, marginBottom: 26 }} />
          {texte}
        </div>
      )}
      <Marque texte={marque} />
    </AbsoluteFill>
  );
};

export type ExtraitProps = { source: string; mots: Mot[]; duree: number; style: "ayati" | "psycho"; marque?: string | null; sousTitres?: boolean };

export const Extrait: React.FC<ExtraitProps> = ({ source, mots, duree, marque, sousTitres = true }) => {
  usePolices();
  const seg = [{ type: "narration" as const, scene: "extrait", debut: 0, fin: duree, mots }];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ filter: "blur(40px) brightness(0.45)" }}>
        <OffthreadVideo src={staticFile(source)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center" }}>
        <OffthreadVideo src={staticFile(source)} style={{ width: "100%", objectFit: "contain" }} />
      </AbsoluteFill>
      {sousTitres ? <SousTitres segments={seg} y={() => 1420} /> : null}
      <Marque texte={marque} />
      <Progression total={duree} />
    </AbsoluteFill>
  );
};
