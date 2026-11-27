// Survol en 60 s : seulement l'introduction, les titres et la conclusion, puis 3 questions générales.
import { useEffect, useMemo, useState } from "react";
import { contenuSurvol, corriger, preparerQuestion, questionsSurvol, SURVOL_SECONDES } from "../core/lecture";
import { issueScore } from "../core/niveaux";
import { makeRng, randomSeed } from "../core/rng";
import { TEXTES, type Texte } from "../core/textes";
import { ajouterResultat, Carte, pc, useApp, useChrono } from "../ui";
import { Questions } from "./Questions";

export default function Survol({ texte, seance, fin }: { texte: Texte; seance?: boolean; fin: () => void }) {
  const { maj } = useApp();
  const [phase, setPhase] = useState<"pret" | "survol" | "questions" | "fini">("pret");
  const [t] = useChrono(phase === "survol");
  const c = contenuSurvol(texte);
  const qs = useMemo(() => { const rng = makeRng(randomSeed()); return questionsSurvol(texte, TEXTES, rng).map((q) => preparerQuestion(q, rng)); }, [texte]);
  const [rep, setRep] = useState<(number | null)[]>(() => qs.map(() => null));
  useEffect(() => { if (phase === "survol" && t >= SURVOL_SECONDES) setPhase("questions"); }, [t, phase]);
  const res = corriger(qs, rep);

  if (phase === "pret")
    return (
      <Carte titre="Survol en 60 secondes">
        <p>Tu vas voir seulement l'introduction, les titres des parties et la conclusion d'un texte, pendant 60 secondes. Puis 3 questions sur l'essentiel.</p>
        <p className="muted petit">Le survol aide à se repérer avant de lire, ou à choisir quoi lire. Il ne remplace pas la lecture.</p>
        <div className="choix"><button className="btn primary gros" onClick={() => setPhase("survol")}>Commencer</button></div>
      </Carte>
    );
  if (phase === "survol")
    return (
      <Carte>
        <span className="chrono grand">{Math.max(0, Math.ceil(SURVOL_SECONDES - t))} s</span>
        <div className="page-texte">
          <h2 className="titre-texte">{texte.titre}</h2>
          <p>{c.intro}</p>
          {c.titres.map((x) => <h3 key={x}>{x}</h3>)}
          <p>{c.conclusion}</p>
        </div>
        <div className="choix"><button className="btn" onClick={() => setPhase("questions")}>J'ai fini</button></div>
      </Carte>
    );
  return (
    <Carte titre={phase === "fini" ? `Survol — ${res.bonnes} / ${res.total} (${pc(res.part)})` : "Survol — questions"}>
      <Questions qs={qs} reponses={rep} choisir={(i, k) => setRep(rep.map((x, j) => (j === i ? k : x)))} corrige={phase === "fini"} />
      <div className="choix">
        {phase === "questions"
          ? <button className="btn primary" onClick={() => { maj((d) => ajouterResultat(d, { exo: "survol", texteId: texte.id, niveau: texte.niveau, bonnes: res.bonnes, total: res.total, part: res.part, ...(seance ? { seance: true } : {}) }, issueScore(res.part))); setPhase("fini"); }}>Valider</button>
          : <button className="btn primary" onClick={fin} autoFocus>Continuer</button>}
      </div>
    </Carte>
  );
}
