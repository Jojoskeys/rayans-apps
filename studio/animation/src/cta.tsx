/** Appel à l'action : abonnement, like, partage, animés au moment où la voix les demande. */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Bell, BellRing, Heart, MousePointer2, Send } from "lucide-react";
import type { SceneProps } from "./types";
import { clamp, OR, quand, ressort, ROUGE } from "./outils";

const P = "Montserrat";

export const Cta: React.FC<SceneProps & { marque?: string | null }> = ({ plan, style, marque }) => {
  const f = useCurrentFrame();
  const abo = quand(plan, "abonne", 0, 20);
  const like = quand(plan, "like", 0, -1);
  const partage = Math.max(quand(plan, "partage", 0, -1), quand(plan, "envoie", 0, -1));
  const hadith = quand(plan, "Prophète", 0, -1);
  const clic = abo + 14;
  const abonne = f >= clic;
  const couleurBouton = abonne ? "#3a3d46" : style === "ayati" ? OR : ROUGE;
  const curseurX = interpolate(f, [abo - 10, clic], [900, 640], clamp);
  const curseurY = interpolate(f, [abo - 10, clic], [1050, 760], clamp);
  const appui = abonne && f < clic + 6 ? 0.9 : 1;
  const iconesO = hadith > 0 ? interpolate(f, [hadith - 6, hadith + 4], [1, 0], clamp) : 1;
  const fond =
    style === "ayati"
      ? "radial-gradient(circle at 50% 35%, #3a2a10, #07070c 70%)"
      : "radial-gradient(circle at 50% 35%, #2a0d0d, #08090d 70%)";
  const icone = (Ic: typeof Heart, t: number, x: number, couleur: string, rempli = false) => {
    if (t < 0) return null;
    const s = ressort(f, t, { damping: 7, stiffness: 200, mass: 0.6 });
    const actif = f >= t;
    return (
      <div style={{ position: "absolute", left: x - 90, top: 980, width: 180, height: 180, borderRadius: 999, background: actif ? couleur : "#22252d", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${actif ? 0.85 + 0.25 * s : 0.85})`, boxShadow: actif ? `0 0 50px ${couleur}` : "none" }}>
        <Ic size={92} color="#fff" strokeWidth={2.4} fill={rempli && actif ? "#fff" : "none"} />
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ background: fond }}>
      {/* avatar de la chaîne */}
      <div style={{ position: "absolute", top: 300, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${ressort(f, 0)})` }}>
        <div style={{ width: 230, height: 230, borderRadius: 999, border: `8px solid ${OR}`, background: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: style === "ayati" ? "Amiri" : P, fontWeight: 700, fontSize: style === "ayati" ? 110 : 90, color: OR }}>
          {style === "ayati" ? "آية" : "Ψ"}
        </div>
        <div style={{ fontFamily: P, fontWeight: 800, fontSize: 54, color: "#fff", marginTop: 20 }}>{marque ?? "Psycho"}</div>
      </div>
      {/* bouton s'abonner */}
      <div style={{ position: "absolute", top: 700, width: "100%", display: "flex", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "26px 56px", borderRadius: 999, background: couleurBouton, color: abonne ? "#fff" : "#08090d", fontFamily: P, fontWeight: 800, fontSize: 58, transform: `scale(${appui * (abonne ? 1 : 1 + 0.04 * Math.sin(f / 4))})` }}>
          {abonne ? <BellRing size={60} color="#fff" style={{ transform: `rotate(${Math.sin((f - clic) / 2) * 20 * Math.exp(-(f - clic) / 20)}deg)` }} /> : <Bell size={60} color="#08090d" />}
          {abonne ? "Abonné" : "S'abonner"}
        </div>
      </div>
      {f < clic + 20 ? (
        <div style={{ position: "absolute", left: curseurX, top: curseurY, opacity: interpolate(f, [abo - 10, abo - 4, clic + 10, clic + 20], [0, 1, 1, 0], clamp), transform: `scale(${abonne && f < clic + 6 ? 0.8 : 1})` }}>
          <MousePointer2 size={90} color="#fff" fill="#fff" strokeWidth={1.5} />
        </div>
      ) : null}
      <AbsoluteFill style={{ opacity: iconesO }}>
        {icone(Heart, like, like >= 0 && partage >= 0 ? 380 : 540, ROUGE, true)}
        {icone(Send, partage, like >= 0 ? 700 : 540, "#2f8cff")}
      </AbsoluteFill>
      {hadith > 0 ? (
        <div style={{ position: "absolute", top: 930, left: 80, right: 80, padding: "36px 40px", borderRadius: 28, border: `3px solid ${OR}`, background: "rgba(0,0,0,0.5)", textAlign: "center", opacity: interpolate(f, [hadith, hadith + 12], [0, 1], clamp), transform: `translateY(${interpolate(f, [hadith, hadith + 12], [40, 0], clamp)}px)` }}>
          <div style={{ fontFamily: P, fontWeight: 700, fontSize: 48, lineHeight: 1.35, color: "#fff" }}>
            « Celui qui indique un bien a la même récompense que celui qui le fait. »
          </div>
          <div style={{ fontFamily: P, fontWeight: 600, fontSize: 32, color: OR, marginTop: 16 }}>Le Prophète ﷺ · rapporté par Muslim</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
