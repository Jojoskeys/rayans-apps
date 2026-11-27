// Exercices en accès libre.
import { useState } from "react";
import { dureeProposee } from "../core/niveaux";
import Examen from "../exercices/Examen";
import Gratitude from "../exercices/Gratitude";
import Nommer from "../exercices/Nommer";
import Questionnaire from "../exercices/Questionnaire";
import Relaxation from "../exercices/Relaxation";
import Respirer from "../exercices/Respirer";
import { Carte, useApp } from "../ui";

type Ex = "respiration" | "nommer" | "gratitude" | "examen" | "relaxation" | "test";

const LISTE: { id: Ex; icone: string; nom: string; texte: (n: number) => string }[] = [
  { id: "respiration", icone: "🌬", nom: "Respiration lente", texte: (n) => `Cercle guidé, 3 rythmes. Proposé pour toi : ${n} min.` },
  { id: "nommer", icone: "🏷", nom: "Nommer et réévaluer", texte: () => "Mettre un mot sur l'émotion, puis regarder la pensée autrement." },
  { id: "gratitude", icone: "🌱", nom: "3 choses bien", texte: () => "Ce qui a été bien aujourd'hui, et pourquoi." },
  { id: "examen", icone: "⏳", nom: "Avant le moment stressant", texte: () => "Routine de 5 à 8 min avant un examen, un oral, un rendez-vous." },
  { id: "relaxation", icone: "💆", nom: "Relaxation musculaire", texte: () => "5 min de contraction et relâchement, pour le confort." },
  { id: "test", icone: "📋", nom: "Questionnaire de la semaine", texte: () => "5 questions de 0 à 10, pour suivre tes semaines (non médical)." },
];

export default function PageExercices() {
  const { db, arg, aller } = useApp();
  const [ex, setEx] = useState<Ex | null>(LISTE.some((l) => l.id === arg) ? (arg as Ex) : null);
  const [n, setN] = useState(0);
  const retour = () => setEx(null);
  if (ex)
    return (
      <div className="pile">
        <button className="btn petit retour" onClick={retour}>← Exercices</button>
        <div key={n}>
          {ex === "respiration" && <Respirer />}
          {ex === "nommer" && <Nommer onFini={retour} />}
          {ex === "gratitude" && <Gratitude />}
          {ex === "examen" && <Examen onFini={() => aller("seance")} />}
          {ex === "relaxation" && <Relaxation />}
          {ex === "test" && <Questionnaire onFini={(t) => (t ? aller("progres") : retour())} />}
        </div>
      </div>
    );
  return (
    <div className="pile">
      <div className="grille-ex">
        {LISTE.map((l) => (
          <button key={l.id} className="carte ex" onClick={() => { setEx(l.id); setN(n + 1); }}>
            <span className="ex-icone">{l.icone}</span>
            <b>{l.nom}</b>
            <span className="muted petit">{l.texte(dureeProposee(db.niveaux.respiration))}</span>
          </button>
        ))}
      </div>
      <Carte>
        <p className="muted petit">Seule la respiration s'adapte : après 2 séances terminées de suite, elle te propose une durée plus longue ; si tu arrêtes avant la fin, une plus courte. Tu peux toujours choisir toi-même.</p>
      </Carte>
    </div>
  );
}
