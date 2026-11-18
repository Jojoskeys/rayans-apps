/** Photos de profil des comptes (1080x1080, lisibles même en petit rond). */
import React, { useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile } from "remotion";
import { Brain } from "lucide-react";

const OR = "#F7C04A";

function usePolices() {
  const [h] = useState(() => delayRender("polices avatar"));
  useEffect(() => {
    const p = [
      new FontFace("Amiri", `url(${staticFile("polices/Amiri-Bold.ttf")})`, { weight: "700" }),
      new FontFace("Montserrat", `url(${staticFile("polices/Montserrat-ExtraBold.ttf")})`, { weight: "800" }),
    ];
    p.forEach((x) => document.fonts.add(x));
    Promise.all(p.map((x) => x.load())).then(() => continueRender(h));
  }, [h]);
}

const Etoiles8: React.FC<{ opacite: number }> = ({ opacite }) => (
  <svg width={1080} height={1080} style={{ position: "absolute", opacity: opacite }}>
    {Array.from({ length: 6 }).map((_, r) =>
      Array.from({ length: 6 }).map((__, c) => {
        const x = c * 216 + (r % 2) * 108;
        const y = r * 200;
        const pts = (rot: number) =>
          Array.from({ length: 4 })
            .map((_, k) => {
              const a = ((rot + 90 * k) * Math.PI) / 180;
              return `${x + 80 * Math.cos(a)},${y + 80 * Math.sin(a)}`;
            })
            .join(" ");
        return (
          <g key={r + "-" + c} fill="none" stroke={OR} strokeWidth={3}>
            <polygon points={pts(0)} />
            <polygon points={pts(45)} />
          </g>
        );
      }),
    )}
  </svg>
);

export const AvatarAyati: React.FC = () => {
  usePolices();
  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 45%, #1b2c5c 0%, #0a1330 45%, #04070f 100%)" }}>
      <Etoiles8 opacite={0.09} />
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 48%, rgba(247,192,74,0.28), transparent 45%)" }} />
      {/* anneau doré, à l'intérieur de la zone qui reste visible dans un rond */}
      <div style={{ position: "absolute", left: 90, top: 90, width: 900, height: 900, borderRadius: 999, border: `6px solid rgba(247,192,74,0.55)` }} />
      <div style={{ position: "absolute", left: 120, top: 120, width: 840, height: 840, borderRadius: 999, border: `2px solid rgba(247,192,74,0.3)` }} />
      {/* croissant discret */}
      <svg width={1080} height={1080} style={{ position: "absolute" }}>
        <defs>
          <mask id="croissant">
            <rect width={1080} height={1080} fill="#fff" />
            <circle cx={562} cy={250} r={52} fill="#000" />
          </mask>
        </defs>
        <circle cx={540} cy={262} r={56} fill={OR} mask="url(#croissant)" />
      </svg>
      <div
        dir="rtl"
        style={{
          position: "absolute",
          top: 330,
          width: "100%",
          textAlign: "center",
          fontFamily: "Amiri",
          fontWeight: 700,
          fontSize: 330,
          lineHeight: 1,
          color: OR,
          textShadow: `0 0 40px rgba(247,192,74,0.75), 0 10px 0 rgba(0,0,0,0.5)`,
        }}
      >
        آياتي
      </div>
      <div style={{ position: "absolute", top: 760, width: "100%", textAlign: "center", fontFamily: "Montserrat", fontWeight: 800, fontSize: 64, letterSpacing: 22, color: "#FBE3A6", paddingLeft: 22 }}>
        AYATI
      </div>
    </AbsoluteFill>
  );
};

export const AvatarPsycho: React.FC = () => {
  usePolices();
  return (
    <AbsoluteFill style={{ background: "#08090d" }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 3px, transparent 3px), linear-gradient(90deg, rgba(255,255,255,0.06) 3px, transparent 3px)",
          backgroundSize: "90px 90px",
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 46%, rgba(247,192,74,0.35), rgba(8,9,13,0.2) 40%, #08090d 72%)" }} />
      <div style={{ position: "absolute", left: 90, top: 90, width: 900, height: 900, borderRadius: 999, border: `8px solid ${OR}`, boxShadow: `0 0 60px rgba(247,192,74,0.5), inset 0 0 60px rgba(247,192,74,0.25)` }} />
      <div style={{ position: "absolute", top: 200, width: "100%", display: "flex", justifyContent: "center", filter: `drop-shadow(0 0 40px ${OR})` }}>
        <Brain size={520} color={OR} strokeWidth={1.6} />
      </div>
      {/* petite bulle « ? » qui évoque la question qu'on se pose */}
      <div style={{ position: "absolute", left: 690, top: 190, width: 170, height: 170, borderRadius: 999, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Montserrat", fontWeight: 800, fontSize: 120, color: "#08090d", boxShadow: "0 10px 40px rgba(0,0,0,0.6)" }}>
        ?
      </div>
      <div style={{ position: "absolute", top: 740, width: "100%", textAlign: "center", fontFamily: "Montserrat", fontWeight: 800, fontSize: 92, lineHeight: 1, color: "#fff", textShadow: "0 6px 0 rgba(0,0,0,0.7)" }}>
        PSYCHO
        <div style={{ fontSize: 58, letterSpacing: 14, color: OR, marginTop: 10, paddingLeft: 14 }}>FACILE</div>
      </div>
    </AbsoluteFill>
  );
};
