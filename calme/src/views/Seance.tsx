// Accueil : présentation au premier lancement, bouton « Avant le moment stressant », séance guidée du jour.
import { useState } from "react";
import { testAFaire } from "../core/questionnaire";
import { newId } from "../core/rng";
import { DUREES_SEANCE, motDuJour, NOM_ETAPE, planSeance, type DureeSeance } from "../core/seance";
import { joursActifs, serie } from "../core/stats";
import Gratitude from "../exercices/Gratitude";
import Nommer from "../exercices/Nommer";
import Questionnaire from "../exercices/Questionnaire";
import Relaxation from "../exercices/Relaxation";
import Respirer from "../exercices/Respirer";
import { aujourdhui, Carte, Choix, plural, useApp } from "../ui";

function Presentation({ fermer }: { fermer: () => void }) {
  const [test, setTest] = useState(false);
  if (test) return <Questionnaire onFini={fermer} />;
  return (
    <Carte titre="Bienvenue dans Calme" className="hero">
      <p>Ici, tu trouves des petits outils pour souffler quand ça monte : respirer lentement, mettre des mots sur ce que tu ressens, regarder une pensée autrement, noter ce qui a été bien.</p>
      <p>Chaque outil est expliqué dans les Fiches, avec ce que la recherche montre vraiment, et ce qui reste discuté.</p>
      <p className="muted petit">Calme est une app de bien-être, pas de soin. Si un jour ça ne va vraiment pas, le bouton d'aide est toujours en haut. Ton journal reste sur ton appareil (et dans ta synchronisation privée), il n'est envoyé nulle part ailleurs.</p>
      <p>Pour commencer, tu peux répondre à 5 questions sur ta semaine (1 minute). Ça permettra de comparer plus tard. C'est facultatif.</p>
      <div className="choix">
        <button className="btn" onClick={fermer}>Plus tard</button>
        <button className="btn primary" onClick={() => setTest(true)}>Faire le test de départ</button>
      </div>
    </Carte>
  );
}

function SeanceEnCours({ duree, quitter }: { duree: DureeSeance; quitter: () => void }) {
  const { db, maj } = useApp();
  const nb = db.activites.filter((a) => a.type === "seance").length;
  const [plan] = useState(() => planSeance(duree, nb));
  const [i, setI] = useState(0);
  const e = plan[i];
  const suivant = () => {
    if (plan[i + 1]?.type === "fin") {
      const now = Date.now();
      maj((d) => ({ ...d, activites: [...d.activites, { id: newId(), at: now, jour: aujourdhui(d, now), type: "seance", dureeMin: duree }] }));
    }
    setI(i + 1);
  };
  return (
    <div className="pile">
      <div className="etapes">
        {plan.map((x, j) => <span key={j} className={j === i ? "actif" : j < i ? "fait" : ""}>{NOM_ETAPE[x.type]}</span>)}
      </div>
      <div key={i}>
        {e.type === "respiration" && <Respirer titre={`Respiration lente (${e.min} min)`} dureeS={e.min * 60} onFini={suivant} />}
        {e.type === "nommer" && <Nommer onFini={suivant} />}
        {e.type === "gratitude" && <Gratitude onFini={suivant} />}
        {e.type === "relaxation" && <Relaxation onFini={suivant} />}
        {e.type === "fin" && (
          <Carte titre="Séance terminée" className="hero">
            <p className="affirmation">{motDuJour(aujourdhui(db))}</p>
            <div className="choix"><button className="btn primary" onClick={quitter}>Retour à l'accueil</button></div>
          </Carte>
        )}
      </div>
      {e.type !== "fin" && (
        <div className="choix">
          {e.type === "respiration" && <button className="btn petit" onClick={suivant}>Passer cette étape</button>}
          <button className="btn petit" onClick={quitter}>Quitter la séance</button>
        </div>
      )}
    </div>
  );
}

export default function PageSeance() {
  const { db, maj, aller } = useApp();
  const [enCours, setEnCours] = useState(false);
  const [test, setTest] = useState(false);
  const r = db.reglages;
  const jour = aujourdhui(db);
  if (!r.accueilVu) return <Presentation fermer={() => maj((d) => ({ ...d, reglages: { ...d.reglages, accueilVu: true, maj: Date.now() } }))} />;
  if (enCours) return <SeanceEnCours duree={r.dureeSeance} quitter={() => setEnCours(false)} />;
  if (test) return <Questionnaire onFini={() => setTest(false)} />;

  const plan = planSeance(r.dureeSeance, db.activites.filter((a) => a.type === "seance").length);
  const faiteAujourdhui = db.activites.some((a) => a.type === "seance" && a.jour === jour);
  const s = serie(joursActifs(db), jour);
  const heure = new Date().getHours();
  const rappel = r.rappelGratitude && heure >= r.heureRappel && !db.gratitudes.some((g) => !g.supprime && g.jour === jour);
  return (
    <div className="pile">
      <button className="gros-bouton" onClick={() => aller("exercices", "examen")}>
        <span>⏳</span>
        <span><b>Avant l'examen ou un moment stressant</b><small>5 à 8 min pour te poser</small></span>
      </button>

      {rappel && (
        <Carte className="rappel">
          <p>🌱 Petit rappel du soir : trois choses bien aujourd'hui ?</p>
          <div className="choix"><button className="btn primary" onClick={() => aller("exercices", "gratitude")}>Les noter</button></div>
        </Carte>
      )}

      <Carte titre="Séance du jour" className="hero">
        <ol className="plan">{plan.map((e, i) => <li key={i}><span>{NOM_ETAPE[e.type]}</span><small>{e.type === "fin" ? "" : `${e.min} min`}</small></li>)}</ol>
        <Choix valeur={r.dureeSeance} options={DUREES_SEANCE.map((d) => ({ v: d, t: `${d} min` }))} onChange={(d) => maj((x) => ({ ...x, reglages: { ...x.reglages, dureeSeance: d, maj: Date.now() } }))} />
        <div className="choix"><button className="btn primary gros" onClick={() => setEnCours(true)}>{faiteAujourdhui ? "Refaire une séance" : "Commencer"}</button></div>
        {faiteAujourdhui && <p className="centre ok-texte petit">Séance faite aujourd'hui ✓</p>}
      </Carte>

      <div className="chiffres">
        <div><b>{plural(s, "jour", "jours")}</b><span>d'affilée</span></div>
        <div><b>{db.respirations.length}</b><span>respirations</span></div>
        <div><b>{db.entrees.filter((e) => !e.supprime).length}</b><span>émotions nommées</span></div>
      </div>

      {db.tests.length > 0 && testAFaire(db.tests, Date.now()) && (
        <Carte>
          <p>C'est le moment du petit questionnaire de la semaine (1 minute, facultatif).</p>
          <div className="choix"><button className="btn" onClick={() => setTest(true)}>Répondre</button></div>
        </Carte>
      )}
      {db.tests.length === 0 && (
        <Carte>
          <p className="petit">Tu n'as pas encore fait le test de départ : 5 questions sur ta semaine, pour comparer plus tard.</p>
          <div className="choix"><button className="btn" onClick={() => setTest(true)}>Le faire maintenant</button></div>
        </Carte>
      )}
    </div>
  );
}
