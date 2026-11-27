// Repérer le plan : remettre les titres des parties dans l'ordre, puis rattacher des passages à leur partie.
import { useMemo, useState } from "react";
import { exercicePlan, scorePlan } from "../core/lecture";
import { issueScore } from "../core/niveaux";
import { makeRng, randomSeed } from "../core/rng";
import type { Texte } from "../core/textes";
import { ajouterResultat, Carte, pc, useApp } from "../ui";

export default function Plan({ texte, seance, fin }: { texte: Texte; seance?: boolean; fin: () => void }) {
  const { maj } = useApp();
  const ex = useMemo(() => exercicePlan(texte, makeRng(randomSeed())), [texte]);
  const [ordre, setOrdre] = useState<number[]>(ex.titres);
  const [ratt, setRatt] = useState<(number | null)[]>(() => ex.extraits.map(() => null));
  const [score, setScore] = useState<ReturnType<typeof scorePlan> | null>(null);
  const bouger = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= ordre.length) return;
    const o = [...ordre];
    [o[i], o[j]] = [o[j], o[i]];
    setOrdre(o);
  };
  const valider = () => {
    const s = scorePlan(ex, ordre, ratt);
    setScore(s);
    maj((d) => ajouterResultat(d, { exo: "plan", texteId: texte.id, niveau: texte.niveau, bonnes: s.points, total: s.max, part: s.part, ...(seance ? { seance: true } : {}) }, issueScore(s.part)));
  };
  return (
    <Carte titre={`Repérer le plan : « ${texte.titre} »`}>
      <p className="muted petit">1. Remets les parties dans l'ordre du texte (flèches).</p>
      <ol className="ordre-liste">
        {ordre.map((p, i) => (
          <li key={p} className={score ? (p === i ? "ok-texte" : "ko-texte") : ""}>
            <span>{texte.parties[p].titre}</span>
            {!score && <><button className="btn mini" aria-label="Monter" onClick={() => bouger(i, -1)} disabled={i === 0}>↑</button><button className="btn mini" aria-label="Descendre" onClick={() => bouger(i, 1)} disabled={i === ordre.length - 1}>↓</button></>}
          </li>
        ))}
      </ol>
      <p className="muted petit">2. À quelle partie appartient chaque passage ?</p>
      {ex.extraits.map((e, i) => (
        <div key={i}>
          <p className="extrait">« {e.texte} »</p>
          <select value={ratt[i] ?? ""} disabled={!!score} onChange={(ev) => setRatt(ratt.map((x, k) => (k === i ? (ev.target.value === "" ? null : Number(ev.target.value)) : x)))} aria-label={`Partie du passage ${i + 1}`}>
            <option value="">Choisir une partie…</option>
            {texte.parties.map((p, k) => <option key={k} value={k}>{p.titre}</option>)}
          </select>
          {score && <span className={ratt[i] === e.partie ? "ok-texte" : "ko-texte"}> {ratt[i] === e.partie ? "✓" : `✗ ${texte.parties[e.partie].titre}`}</span>}
        </div>
      ))}
      {!score ? (
        <div className="choix"><button className="btn primary" onClick={valider} disabled={ratt.some((r) => r === null)}>Valider</button></div>
      ) : (
        <>
          <p className="verdict">{score.points} / {score.max} ({pc(score.part)})</p>
          {score.part < 1 && <p className="muted petit">Le bon ordre : {texte.parties.map((p) => p.titre).join(" → ")}.</p>}
          <div className="choix"><button className="btn primary" onClick={fin} autoFocus>Continuer</button></div>
        </>
      )}
    </Carte>
  );
}
