import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { Mot, Segment } from "./types";
import { clamp, OR, OR_PALE, ressort } from "./outils";

const POLICE = "Montserrat";

/** Groupes de 1 à 3 mots, coupés après la ponctuation (style TikTok). */
function groupes(mots: Mot[]): Mot[][] {
  const out: Mot[][] = [];
  let g: Mot[] = [];
  for (const m of mots) {
    g.push(m);
    if (g.length >= 3 || /[.,:;?!…»]$/.test(m.texte)) {
      out.push(g);
      g = [];
    }
  }
  if (g.length) out.push(g);
  return out;
}

export const SousTitres: React.FC<{ segments: Segment[]; y: (scene: string) => number }> = ({ segments, y }) => {
  const f = useCurrentFrame();
  for (const s of segments) {
    if (!s.mots || f < s.debut || f >= s.fin) continue;
    const gs = groupes(s.mots);
    for (let i = 0; i < gs.length; i++) {
      const g = gs[i];
      const debut = g[0].debut;
      const fin = i + 1 < gs.length ? gs[i + 1][0].debut : s.fin - 4;
      if (f < debut || f >= fin) continue;
      const entree = ressort(f, debut, { damping: 13, stiffness: 220, mass: 0.5 });
      return (
        <div
          style={{
            position: "absolute",
            top: y(s.scene),
            left: 60,
            right: 60,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0 22px",
            transform: `translateY(-50%) scale(${0.8 + 0.2 * entree})`,
            opacity: entree,
          }}
        >
          {g.map((m, k) => {
            const actif = f >= m.debut && (k + 1 >= g.length || f < g[k + 1].debut);
            const s2 = actif ? 1 + 0.12 * Math.exp(-(f - m.debut) / 4) : 1;
            return (
              <span
                key={k}
                style={{
                  fontFamily: POLICE,
                  fontWeight: 800,
                  fontSize: 92,
                  lineHeight: 1.15,
                  color: actif ? OR : "#fff",
                  transform: `scale(${s2})`,
                  display: "inline-block",
                  textShadow: actif
                    ? `0 0 30px rgba(247,192,74,0.7), 0 6px 0 rgba(0,0,0,0.85)`
                    : "0 6px 0 rgba(0,0,0,0.85), 0 0 24px rgba(0,0,0,0.9)",
                  WebkitTextStroke: "3px rgba(0,0,0,0.85)",
                  paintOrder: "stroke fill",
                }}
              >
                {m.texte}
              </span>
            );
          })}
        </div>
      );
    }
  }
  return null;
};

/** Gros titre qui claque à l'écran sur un mot clé. */
export const Titres: React.FC<{ segments: Segment[] }> = ({ segments }) => {
  const f = useCurrentFrame();
  return (
    <>
      {segments
        .filter((s) => s.titre)
        .map((s, i) => {
          const t = s.titre!;
          const d = f - t.frame;
          const fin = Math.min(s.fin, t.frame + 95);
          if (d < 0 || f > fin) return null;
          const e = ressort(f, t.frame, { damping: 10, stiffness: 200, mass: 0.6 });
          const sortie = interpolate(f, [fin - 10, fin], [1, 0], clamp);
          const lettres = t.texte.split("");
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: 360,
                left: 50,
                right: 50,
                textAlign: "center",
                fontFamily: POLICE,
                fontWeight: 800,
                fontSize: t.texte.length > 18 ? 104 : 130,
                lineHeight: 1.05,
                textTransform: "uppercase",
                letterSpacing: interpolate(e, [0, 1], [30, 2]),
                color: OR_PALE,
                opacity: sortie,
                transform: `scale(${interpolate(e, [0, 1], [1.7, 1])})`,
                filter: `blur(${interpolate(e, [0, 1], [14, 0], clamp)}px)`,
                textShadow: `0 0 50px ${OR}, 0 8px 0 rgba(0,0,0,0.8)`,
              }}
            >
              {lettres.map((l, k) => (
                <span key={k} style={{ opacity: interpolate(d, [k * 0.8, k * 0.8 + 4], [0, 1], clamp) }}>
                  {l}
                </span>
              ))}
            </div>
          );
        })}
    </>
  );
};

/** Référence coranique discrète en haut de l'écran. */
export const References: React.FC<{ segments: Segment[] }> = ({ segments }) => {
  const f = useCurrentFrame();
  const s = segments.find((x) => x.type === "narration" && x.ref && f >= x.debut && f < x.fin);
  if (!s) return null;
  const o = interpolate(f, [s.debut, s.debut + 12, s.fin - 8, s.fin], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", top: 190, width: "100%", display: "flex", justifyContent: "center", opacity: o }}>
      <div
        style={{
          fontFamily: POLICE,
          fontWeight: 600,
          fontSize: 36,
          color: OR_PALE,
          padding: "10px 30px",
          borderRadius: 999,
          border: "2px solid rgba(247,192,74,0.6)",
          background: "rgba(0,0,0,0.45)",
          letterSpacing: 2,
        }}
      >
        {/^\d/.test(s.ref ?? "") ? `Coran ${s.ref}` : s.ref}
      </div>
    </div>
  );
};

/** Verset : arabe mot à mot synchronisé sur la récitation, traduction Hamidullah en dessous. */
export const CarteVerset: React.FC<{ segments: Segment[] }> = ({ segments }) => {
  const f = useCurrentFrame();
  const s = segments.find((x) => x.type === "verset" && f >= x.debut - 10 && f < x.fin);
  if (!s || !s.verset) return null;
  const v = s.verset;
  const o = interpolate(f, [s.debut - 10, s.debut + 10, s.fin - 10, s.fin], [0, 1, 1, 0], clamp);
  const debutMot = (i: number) => v.minutage.find((m) => m[0] === i)?.[1] ?? Infinity;
  const finMot = (i: number) => v.minutage.find((m) => m[0] === i)?.[2] ?? Infinity;
  const phrases = (v.parties ? "" : v.fr).replace(/ ([!?:;»”])/g, " $1").replace(/“ /g, "“ ").split(/(?<=[.!?»”])\s+/);
  const duree = s.fin - s.debut;
  // Verset long : arabe et traduction plus petits pour que les deux blocs ne se chevauchent pas.
  const long = !v.parties && v.arabe.length > 18;
  const taillFr = !v.parties && v.fr.length > 200 ? 40 : 48;
  // Suite de versets : on n'affiche que le verset en cours de récitation, avec sa traduction.
  let mots = v.arabe.map((m, i) => [m, i] as [string, number]);
  let fr = v.fr;
  let titre = v.ref;
  let debutPartie = s.debut;
  if (v.parties && v.parties.length) {
    let idx = 0;
    for (const m of v.minutage) if (m[1] <= f) idx = Math.max(idx, m[0]);
    const p = v.parties.find((x) => idx >= x.de && idx < x.a) ?? v.parties[0];
    mots = mots.slice(p.de, p.a);
    fr = p.fr;
    titre = `${v.ref.split(":")[0]}:${p.num}`;
    debutPartie = Math.min(...v.minutage.filter((m) => m[0] === p.de).map((m) => m[1]), f);
  }
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <AbsoluteFill style={{ background: "rgba(3,6,16,0.5)" }} />
      <div style={{ position: "absolute", top: 230, width: "100%", textAlign: "center" }}>
        <span
          style={{
            fontFamily: POLICE,
            fontWeight: 600,
            fontSize: 38,
            color: OR,
            letterSpacing: 6,
            textTransform: "uppercase",
          }}
        >
          {v.sourate} · {titre}
        </span>
        <div style={{ width: interpolate(f - s.debut, [0, duree], [0, 560], clamp), height: 3, background: OR, margin: "18px auto 0", boxShadow: `0 0 16px ${OR}` }} />
      </div>
      <div
        dir="rtl"
        style={{
          position: "absolute",
          top: 360,
          left: 60,
          right: 60,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "6px 22px",
        }}
      >
        {mots.map(([mot, i]) => {
          const a = debutMot(i);
          const b = finMot(i);
          const actif = f >= a && f < b + 4;
          const passe = f >= b + 4;
          const e = ressort(f, a, { damping: 14, stiffness: 160, mass: 0.6 });
          return (
            <span
              key={i}
              style={{
                fontFamily: "Amiri Quran",
                fontSize: v.parties ? 108 : long ? 66 : 86,
                lineHeight: long ? 1.75 : 1.9,
                color: actif ? OR : passe ? "#fff" : "rgba(255,255,255,0.28)",
                textShadow: actif ? `0 0 34px ${OR}` : "0 4px 12px rgba(0,0,0,0.8)",
                transform: `scale(${actif ? 1 + 0.08 * e : 1})`,
                display: "inline-block",
              }}
            >
              {mot}
            </span>
          );
        })}
      </div>
      <div style={{ position: "absolute", bottom: 300, left: 80, right: 80, textAlign: "center" }}>
        {v.parties ? (
          <span style={{ fontFamily: POLICE, fontWeight: 600, fontSize: 50, lineHeight: 1.4, color: "#fff", textShadow: "0 4px 14px rgba(0,0,0,0.9)", opacity: interpolate(f, [debutPartie - 4, debutPartie + 10], [0, 1], clamp) }}>
            « {fr.replace(/ ([!?:;»”])/g, " $1")} »
          </span>
        ) : null}
        {(v.parties ? [] : phrases).map((p, k) => {
          const t0 = s.debut + 12 + (k * duree * 0.7) / Math.max(1, phrases.length);
          return (
            <span
              key={k}
              style={{
                fontFamily: POLICE,
                fontWeight: 600,
                fontSize: taillFr,
                lineHeight: 1.4,
                color: "#fff",
                opacity: interpolate(f, [t0, t0 + 15], [0, 1], clamp),
                textShadow: "0 4px 14px rgba(0,0,0,0.9)",
              }}
            >
              {k === 0 ? "« " : ""}
              {p}
              {k === phrases.length - 1 ? " »" : " "}
            </span>
          );
        })}
        <div style={{ fontFamily: POLICE, fontSize: 30, color: "rgba(255,255,255,0.55)", marginTop: 18 }}>
          Trad. M. Hamidullah · {v.recitateur ?? "récitation as-Sudais"}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Marque: React.FC<{ texte?: string | null }> = ({ texte }) =>
  texte ? (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        width: "100%",
        textAlign: "center",
        fontFamily: POLICE,
        fontWeight: 600,
        fontSize: 34,
        letterSpacing: 3,
        color: "rgba(255,255,255,0.55)",
      }}
    >
      {texte}
    </div>
  ) : null;

/** Accroche lisible dès la toute première image (miniature, lecture sans le son), jusqu'à ~3,5 s. */
export const Accroche: React.FC<{ texte?: string | null; fin: number }> = ({ texte, fin }) => {
  const f = useCurrentFrame();
  if (!texte || f > fin) return null;
  const o = interpolate(f, [fin - 12, fin], [1, 0], clamp);
  const mots = texte.toUpperCase().split(" ");
  return (
    <div style={{ position: "absolute", top: 300, left: 60, right: 60, display: "flex", justifyContent: "center", opacity: o }}>
      <div
        style={{
          background: "rgba(5,6,12,0.78)",
          borderRadius: 28,
          padding: "26px 34px",
          textAlign: "center",
          fontFamily: POLICE,
          fontWeight: 800,
          fontSize: 96,
          lineHeight: 1.05,
          color: "#fff",
          letterSpacing: 1,
          boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
        }}
      >
        {mots.map((m, i) => (
          <span key={i} style={{ color: i >= mots.length - 2 ? OR : "#fff" }}>
            {m}
            {i < mots.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </div>
  );
};
