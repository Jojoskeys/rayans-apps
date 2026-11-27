// Questionnaire de la semaine (fait maison, non médical) : test de départ puis un par semaine.
import { useState } from "react";
import { QUESTIONS, type Test } from "../core/questionnaire";
import { newId } from "../core/rng";
import { Carte, Echelle, useApp } from "../ui";

export default function Questionnaire({ onFini }: { onFini?: (t: Test | null) => void }) {
  const { db, maj } = useApp();
  const [rep, setRep] = useState<(number | null)[]>(QUESTIONS.map(() => null));
  const type: Test["type"] = db.tests.length === 0 ? "depart" : "suivi";
  const complet = rep.every((r) => r !== null);

  function enregistrer() {
    const t: Test = { id: newId(), at: Date.now(), type, reponses: rep.map((r) => r ?? 5) };
    maj((d) => ({ ...d, tests: [...d.tests, t] }));
    onFini?.(t);
  }

  return (
    <Carte titre={type === "depart" ? "Ton point de départ" : "Ta semaine"}>
      <p className="muted petit">5 questions sur les 7 derniers jours, de 0 à 10. Écrites pour l'app : ce n'est pas un questionnaire médical et il ne dit rien sur ta santé. Il sert juste à voir comment tes semaines évoluent.</p>
      {QUESTIONS.map((q, i) => (
        <div key={q.id} className="question">
          <p>{q.texte}</p>
          <Echelle valeur={rep[i]} onChange={(v) => setRep(rep.map((x, j) => (j === i ? v : x)))} bas={q.bas} haut={q.haut} />
        </div>
      ))}
      <div className="choix">
        {onFini && <button className="btn" onClick={() => onFini(null)}>Plus tard</button>}
        <button className="btn primary" disabled={!complet} onClick={enregistrer}>Enregistrer</button>
      </div>
    </Carte>
  );
}
