// Essai de lecture mot à mot (RSVP), présenté comme une expérience : on voit soi-même ce que devient la compréhension
// quand on lit très vite. Pas un entraînement.
import { useEffect, useMemo, useRef, useState } from "react";
import { corriger, delaiMot, motsRsvp, palierSuivant, preparerQuestions } from "../core/lecture";
import { makeRng, randomSeed } from "../core/rng";
import type { Texte } from "../core/textes";
import { ajouterResultat, Carte, pc, useApp } from "../ui";
import { Questions } from "./Questions";

export default function Rsvp({ texte, fin }: { texte: Texte; fin: () => void }) {
  const { db, maj } = useApp();
  const mpm = useMemo(() => palierSuivant(db.resultats.filter((r) => r.exo === "rsvp").length), []); // eslint-disable-line react-hooks/exhaustive-deps
  const mots = useMemo(() => motsRsvp(texte), [texte]);
  const [phase, setPhase] = useState<"pret" | "defile" | "questions" | "fini">("pret");
  const [i, setI] = useState(0);
  const qs = useMemo(() => preparerQuestions(texte, makeRng(randomSeed())), [texte]);
  const [rep, setRep] = useState<(number | null)[]>(() => qs.map(() => null));
  const minuteur = useRef<number>(0);
  useEffect(() => {
    if (phase !== "defile") return;
    if (i >= mots.length) { setPhase("questions"); return; }
    minuteur.current = window.setTimeout(() => setI((x) => x + 1), delaiMot(mpm, i));
    return () => clearTimeout(minuteur.current);
  }, [phase, i, mots.length, mpm]);
  const res = corriger(qs, rep);

  if (phase === "pret")
    return (
      <Carte titre="Essai : lecture mot à mot">
        <p>Les mots du texte « {texte.titre} » vont s'afficher un par un, au même endroit, à <b>{mpm} mots par minute</b>. Ensuite, les questions habituelles.</p>
        <p className="muted petit">C'est une expérience, pas un entraînement : les études montrent qu'à ces vitesses la compréhension baisse, parce qu'on ne peut plus revenir en arrière ni ralentir sur les passages difficiles. Regarde ce qu'il en est pour toi.</p>
        <div className="choix"><button className="btn primary gros" onClick={() => setPhase("defile")}>Lancer</button></div>
      </Carte>
    );
  if (phase === "defile")
    return (
      <Carte>
        <p className="rsvp" aria-live="off">{mots[Math.min(i, mots.length - 1)]}</p>
        <div className="barre"><div style={{ width: `${(i / mots.length) * 100}%` }} /></div>
        <div className="choix"><button className="btn" onClick={() => setPhase("questions")}>Arrêter</button></div>
      </Carte>
    );
  return (
    <Carte titre={phase === "fini" ? `Mot à mot à ${mpm} mots/min — ${res.bonnes} / ${res.total} (${pc(res.part)})` : "Questions (sans le texte)"}>
      {phase === "fini" && <p className="astuce">Compare avec ta compréhension en lecture normale (onglet Progrès). En général, elle baisse nettement à ces vitesses.</p>}
      <Questions qs={qs} reponses={rep} choisir={(k, c) => setRep(rep.map((x, j) => (j === k ? c : x)))} corrige={phase === "fini"} />
      <div className="choix">
        {phase === "questions"
          ? <button className="btn primary" onClick={() => { maj((d) => ajouterResultat(d, { exo: "rsvp", texteId: texte.id, niveau: texte.niveau, mpm, mots: mots.length, bonnes: res.bonnes, total: res.total, part: res.part })); setPhase("fini"); }}>Valider</button>
          : <button className="btn primary" onClick={fin} autoFocus>Continuer</button>}
      </div>
    </Carte>
  );
}
