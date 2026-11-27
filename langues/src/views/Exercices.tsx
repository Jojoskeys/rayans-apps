// Accès libre à chaque exercice de la langue en cours.
import { useState } from "react";
import { EXOS, type ExoId } from "../core/niveaux";
import { Decouverte, Revisions } from "../exercices/Cartes";
import ExoDictee from "../exercices/Dictee";
import ExoLettres from "../exercices/Lettres";
import ExoOrdre from "../exercices/Ordre";
import ExoTest from "../exercices/Test";
import ExoTons from "../exercices/Tons";
import { Carte, useApp } from "../ui";

type Choisi = ExoId | "nouveaux" | "test";

export default function PageExercices() {
  const { db, langue } = useApp();
  const [choisi, setChoisi] = useState<Choisi | null>(null);
  const [tour, setTour] = useState(0);
  const fermer = () => setChoisi(null);
  if (choisi) {
    const props = { n: 10, fin: fermer };
    return (
      <div className="pile" key={tour}>
        <button className="btn petit retour" onClick={fermer}>← Exercices</button>
        {choisi === "cartes" && <Revisions n={15} libre fin={fermer} />}
        {choisi === "nouveaux" && <Decouverte n={5} fin={fermer} />}
        {choisi === "ordre" && <ExoOrdre {...props} n={6} />}
        {choisi === "dictee" && <ExoDictee {...props} n={8} />}
        {choisi === "tons" && <ExoTons {...props} n={15} />}
        {choisi === "lettres" && <ExoLettres {...props} n={12} />}
        {choisi === "test" && <ExoTest fin={fermer} />}
      </div>
    );
  }
  const ouvrir = (c: Choisi) => { setChoisi(c); setTour((t) => t + 1); };
  return (
    <div className="grille-ex">
      <button className="carte ex" onClick={() => ouvrir("nouveaux")}>
        <span className="ex-icone">🌱</span><b>Nouveaux mots</b>
        <span className="muted petit">Découvrir 5 mots, avec leur lecture et une aide pour les retenir, puis se tester tout de suite.</span>
      </button>
      {EXOS.filter((e) => e.langues.includes(langue)).map((e) => (
        <button key={e.id} className="carte ex" onClick={() => ouvrir(e.id)}>
          <span className="ex-icone">{e.icone}</span><b>{e.nom}</b>
          <span className="muted petit">{e.entraine}</span>
          <span className="muted petit">Niveau {db.niveaux[langue][e.id].level} / {e.max}</span>
        </button>
      ))}
      <button className="carte ex" onClick={() => ouvrir("test")}>
        <span className="ex-icone">📏</span><b>Test de suivi</b>
        <span className="muted petit">20 mots et 5 phrases, toujours dans les mêmes conditions, pour comparer d'une semaine à l'autre.</span>
      </button>
      <Carte className="ex">
        <span className="ex-icone">ℹ️</span><b>À savoir</b>
        <span className="muted petit">En accès libre, les cartes mots révisent d'abord les mots dus ; sinon elles tirent des mots déjà vus sans changer leurs dates de révision.</span>
      </Carte>
    </div>
  );
}
