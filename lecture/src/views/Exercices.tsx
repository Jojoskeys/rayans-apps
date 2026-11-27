// Accès libre à chaque exercice, sur un texte du niveau de l'exercice (pas relu avant 30 jours si possible).
import { useState, type ReactNode } from "react";
import { EXOS, type ExoId } from "../core/niveaux";
import { choisirTexte } from "../core/seance";
import { NOM_NIVEAU, type Texte } from "../core/textes";
import Lire from "../exercices/Lire";
import Plan from "../exercices/Plan";
import Rsvp from "../exercices/Rsvp";
import Survol from "../exercices/Survol";
import { Carte, useApp } from "../ui";

type Choisi = ExoId | "rsvp";

export default function PageExercices() {
  const { db } = useApp();
  const [choisi, setChoisi] = useState<{ exo: Choisi; texte: Texte; n: number } | null>(null);
  const fermer = () => setChoisi(null);
  const ouvrir = (exo: Choisi) => {
    const niveau = exo === "rsvp" ? 1 : db.niveaux[exo].level;
    setChoisi({ exo, texte: choisirTexte(db, niveau, Date.now(), `libre-${exo}-${Date.now()}`), n: Date.now() });
  };
  if (choisi) {
    const { exo, texte } = choisi;
    let ecran: ReactNode;
    if (exo === "lecture" || exo === "notes") ecran = <Lire texte={texte} mode={exo} fin={fermer} />;
    else if (exo === "plan") ecran = <Plan texte={texte} fin={fermer} />;
    else if (exo === "survol") ecran = <Survol texte={texte} fin={fermer} />;
    else ecran = <Rsvp texte={texte} fin={fermer} />;
    return <div className="pile" key={choisi.n}><button className="btn petit retour" onClick={fermer}>← Exercices</button>{ecran}</div>;
  }
  return (
    <div className="grille-ex">
      {EXOS.map((e) => (
        <button key={e.id} className="carte ex" onClick={() => ouvrir(e.id)}>
          <span className="ex-icone">{e.icone}</span><b>{e.nom}</b>
          <span className="muted petit">{e.entraine}</span>
          <span className="muted petit">Textes : niveau {NOM_NIVEAU[db.niveaux[e.id].level]}</span>
        </button>
      ))}
      <button className="carte ex" onClick={() => ouvrir("rsvp")}>
        <span className="ex-icone">⚡</span><b>Essai : lecture mot à mot</b>
        <span className="muted petit">Une expérience pour voir ce que devient la compréhension quand les mots défilent très vite (de 300 à 1000 mots/min).</span>
      </button>
      <Carte className="ex">
        <span className="ex-icone">ℹ️</span><b>À savoir</b>
        <span className="muted petit">Le niveau (facile, moyen, difficile) de chaque exercice monte après 2 réussites de suite et baisse après un échec.</span>
      </Carte>
    </div>
  );
}
