// Présentation du premier lancement et séance guidée du jour.
import { useMemo, useState } from "react";
import { serieTactiques, tactiquesDues } from "../core/espacement";
import type { ExoId } from "../core/niveaux";
import { makeRng, randomSeed } from "../core/rng";
import { etapeFaite, seanceDuJour, serieJours } from "../core/seance";
import { ExoMemoire, ExoTactiques, ExoVision } from "../exercices";
import { Carte, plural, useApp } from "../ui";

export function Presentation({ onFin }: { onFin: () => void }) {
  return (
    <Carte className="hero" titre="Bienvenue dans Rayan's Échecs Vision">
      <p>Ici, tu entraînes ta « vision » aux échecs de trois façons :</p>
      <ul className="guide">
        <li><b>Mémoire de position</b> : une vraie position s'affiche quelques secondes, tu la replaces sur un échiquier vide.</li>
        <li><b>Vision sans échiquier</b> : la position n'est donnée qu'en texte ; tu dis de tête qui attaque quoi.</li>
        <li><b>Tactiques</b> : mats en 1, fourchettes, clouages… qui reviennent à intervalles croissants pour bien les retenir.</li>
      </ul>
      <p>Chaque jour, une séance d'environ 10 minutes. La difficulté s'adapte : 2 réussites de suite → plus dur, 1 échec → plus facile.</p>
      <p className="conseil">Honnêtement : ces exercices te font progresser sur ce qu'ils entraînent (voir et retenir des positions, repérer des motifs). Ils ne remplacent pas les parties et leur analyse, et ne rendent pas « plus intelligent » en général. Tout est expliqué dans « Fiches ».</p>
      <div className="choix"><button className="btn primary gros" onClick={onFin}>Commencer</button></div>
    </Carte>
  );
}

export default function PageSeance() {
  const { db, maj } = useApp();
  const now = Date.now();
  const s = seanceDuJour(db, now);
  const [enCours, setEnCours] = useState<ExoId | null>(null);
  const serie = useMemo(() => (enCours === "tactiques" ? serieTactiques(db, Date.now(), makeRng(randomSeed()), 6) : []),
    // La série est tirée une fois au début de l'étape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enCours]);
  const finir = (id: ExoId) => { maj((d) => etapeFaite(d, id, Date.now())); setEnCours(null); };

  if (enCours === "memoire") return <ExoMemoire nb={3} onFin={() => finir("memoire")} />;
  if (enCours === "vision") return <ExoVision nb={6} onFin={() => finir("vision")} />;
  if (enCours === "tactiques") return <ExoTactiques serie={serie} onFin={() => finir("tactiques")} />;

  const prochaine = s.etapes.find((e) => !e.faite);
  const serieJ = serieJours(db, now);
  const dues = tactiquesDues(db, now).length;
  return (
    <div className="pile">
      <Carte className="hero" titre={s.finie ? "Séance du jour terminée 🎉" : "Séance du jour (~10 min)"}>
        <div className="serie"><b>{serieJ}</b> <span>{serieJ > 1 ? "jours de suite" : "jour de suite"}</span></div>
        <ol className="etapes">
          {s.etapes.map((e) => (
            <li key={e.id} className={`etape ${e.faite ? "faite" : ""}`}>
              <span>{e.faite ? "✓" : "○"} {e.titre}</span> <em>{plural(e.manches, "manche", "manches")} · ~{e.minutes} min</em>
              {!e.faite && <button className="btn petit" onClick={() => setEnCours(e.id)}>Faire</button>}
            </li>
          ))}
        </ol>
        {prochaine ? (
          <button className="btn primary gros" onClick={() => setEnCours(prochaine.id)}>{s.etapes.some((e) => e.faite) ? "Continuer" : "Commencer la séance"}</button>
        ) : (
          <p>Bravo, c'est fait pour aujourd'hui. Tu peux t'entraîner librement dans « Exercices », ou lire une fiche.</p>
        )}
        <p className="muted petit">{dues ? `${plural(dues, "tactique est à revoir", "tactiques sont à revoir")} aujourd'hui.` : "Aucune tactique à revoir aujourd'hui."}</p>
      </Carte>
    </div>
  );
}
