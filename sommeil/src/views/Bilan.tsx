// Bilan de la semaine : questionnaire fait maison, à refaire chaque semaine pour comparer son ressenti.
import { useState } from "react";
import { alerteSomnolence, comparer, phraseComparaison, QUESTIONS } from "../core/bilan";
import type { Bilan } from "../core/model";
import { newId } from "../core/rng";
import { Carte, useApp } from "../ui";

export default function FaireBilan({ fini }: { fini: () => void }) {
  const { db, maj, aller } = useApp();
  const [reps, setReps] = useState<(number | null)[]>(QUESTIONS.map(() => null));
  const [fait, setFait] = useState<Bilan | null>(null);
  const precedent = [...db.bilans].sort((a, b) => b.at - a.at)[0];
  if (fait)
    return (
      <Carte titre="Bilan enregistré">
        {precedent ? (
          <>
            <p>{phraseComparaison(precedent, fait)}</p>
            <ul className="comparaison">
              {comparer(precedent, fait).map((c, i) => (
                <li key={c.question}><span className={`sens ${c.sens}`}>{c.sens === "mieux" ? "↗" : c.sens === "moins" ? "↘" : "→"}</span> {QUESTIONS[i].texte}</li>
              ))}
            </ul>
          </>
        ) : <p>C'est ton point de départ. Refais ce bilan dans une semaine pour comparer.</p>}
        {alerteSomnolence(fait) && <p className="alerte">Tu luttes souvent contre le sommeil dans la journée. Si ça dure, lis la fiche « Quand voir un médecin » et parles-en à un professionnel.</p>}
        <div className="choix">
          {alerteSomnolence(fait) && <button className="btn" onClick={() => aller("fiches", "medecin")}>Quand voir un médecin</button>}
          <button className="btn primary" onClick={fini}>Terminé</button>
        </div>
      </Carte>
    );
  const complet = reps.every((r) => r !== null);
  return (
    <Carte titre={precedent ? "Bilan de la semaine" : "Bilan de départ"}>
      <p className="muted petit">6 questions sur les 7 derniers jours, écrites pour l'app. Ce n'est pas un test médical : il sert seulement à comparer tes semaines entre elles.</p>
      {QUESTIONS.map((q, i) => (
        <div key={q.id} className="question">
          <p>{i + 1}. {q.texte}</p>
          <div className="segments">
            {q.options.map((o, j) => (
              <button key={o} type="button" className={reps[i] === j ? "actif" : ""} onClick={() => setReps((r) => r.map((x, k) => (k === i ? j : x)))}>{o}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="choix">
        <button className="btn" onClick={fini}>Plus tard</button>
        <button className="btn primary" disabled={!complet} onClick={() => {
          const b: Bilan = { id: newId(), at: Date.now(), reponses: reps.map((r) => r ?? 0) };
          maj((d) => ({ ...d, bilans: [...d.bilans, b] }));
          setFait(b);
        }}>Enregistrer</button>
      </div>
    </Carte>
  );
}
