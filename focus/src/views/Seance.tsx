// Présentation du premier lancement, tests de départ et de suivi, séance guidée du jour.
import { useState } from "react";
import { TEST } from "../core/exercices";
import type { TestResultat } from "../core/model";
import { exoInfo } from "../core/niveaux";
import { newId, randomSeed } from "../core/rng";
import { marquerEtape, seanceDuJour, serie, testPropose } from "../core/seance";
import { minutesPalier } from "../core/travail";
import { ExoFlanker, ExoRecherche, Partie, type FinManche } from "../exercices";
import { Barre, Carte, fmtMs, useApp } from "../ui";

/** Premier lancement : ce que fait l'app, honnêtement, et le test de départ proposé. */
export function Presentation({ onFin }: { onFin: (faireLeTest: boolean) => void }) {
  return (
    <Carte className="hero" titre="Bienvenue dans Rayan's Focus">
      <p>Ici, tu travailles ton attention de deux façons :</p>
      <ul className="guide">
        <li><b>5 exercices courts</b> (trouver une cible, flèche du milieu, couleur du mot, rester sur la tâche, coût du changement) qui s'adaptent à ton niveau.</li>
        <li><b>Du travail profond</b> sur tes vraies tâches, par blocs de 15 minutes au début, qui s'allongent petit à petit jusqu'à 50 minutes.</li>
        <li><b>Un journal des distractions</b> pour voir ce qui te coupe, et à quelle heure.</li>
      </ul>
      <p className="conseil">Honnêtement : tu vas vite progresser <b>sur les exercices</b>. Leur effet sur le reste (l'intelligence, les notes) est faible d'après la recherche. Ce qui change vraiment ta journée, c'est de protéger ton attention pendant le travail profond. Tout est expliqué dans « Fiches ».</p>
      <p>Pour commencer, un petit test de 2 minutes mesure ton point de départ. Tu le referas chaque semaine, dans les mêmes conditions, pour comparer honnêtement.</p>
      <div className="choix">
        <button className="btn primary gros" onClick={() => onFin(true)}>Faire le test de départ (2 min)</button>
        <button className="btn" onClick={() => onFin(false)}>Plus tard</button>
      </div>
    </Carte>
  );
}

/** Test aux conditions fixes : 1 min de « Trouver la cible » (niveau 5), puis 1 min de « Flèche du milieu » (niveau 4). */
export function TestFixe({ sorte, onFin }: { sorte: "depart" | "suivi"; onFin: () => void }) {
  const { db, maj } = useApp();
  const [phase, setPhase] = useState<"intro" | "recherche" | "pause" | "flanker" | "fin">("intro");
  const [graine] = useState(randomSeed);
  const [recherche, setRecherche] = useState<FinManche | null>(null);
  const [resultat, setResultat] = useState<TestResultat | null>(null);
  const nom = sorte === "depart" ? "Test de départ" : "Test de suivi";
  const precedent = db.tests[0];
  if (phase === "intro")
    return (
      <Carte titre={`🎯 ${nom}`}>
        <p>Deux épreuves d'une minute, toujours au même niveau (pas le tien : un niveau fixe), pour pouvoir comparer d'une semaine à l'autre :</p>
        <ol className="guide">
          <li><b>{exoInfo("recherche").nom}</b> : trouve le plus de cibles possible en 1 minute.</li>
          <li><b>{exoInfo("flanker").nom}</b> : réponds le plus vite et le plus juste possible pendant 1 minute.</li>
        </ol>
        <p className="muted petit">Le test ne change pas tes niveaux. Mets-toi au calme, téléphone hors de vue.</p>
        <div className="choix">
          <button className="btn primary gros" onClick={() => setPhase("recherche")}>C'est parti</button>
          <button className="btn" onClick={onFin}>Plus tard</button>
        </div>
      </Carte>
    );
  if (phase === "recherche")
    return <Carte titre={`${nom} — 1/2 : ${exoInfo("recherche").nom}`}><ExoRecherche niveau={TEST.niveauRecherche} graine={graine} sons={db.reglages.sons} dureeMs={TEST.secondes * 1000} onFin={(r) => { setRecherche(r); setPhase("pause"); }} /></Carte>;
  if (phase === "pause")
    return (
      <Carte titre={nom}>
        <p>Première épreuve finie : {recherche?.score} cible(s) trouvée(s). Souffle un coup.</p>
        <p>Ensuite : <b>{exoInfo("flanker").nom}</b>. {exoInfo("flanker").regle}</p>
        <button className="btn primary gros" autoFocus onClick={() => setPhase("flanker")}>Continuer</button>
      </Carte>
    );
  if (phase === "flanker")
    return <Carte titre={`${nom} — 2/2 : ${exoInfo("flanker").nom}`}><ExoFlanker niveau={TEST.niveauFlanker} graine={graine + 1} sons={db.reglages.sons} dureeMs={TEST.secondes * 1000} onFin={(r) => {
      const t: TestResultat = {
        id: newId(), at: Date.now(), sorte,
        recherche: { justes: recherche?.score ?? 0, total: recherche?.max ?? 0, ms: recherche?.ms ?? null },
        flanker: { justes: r.score, total: r.max, ms: r.ms ?? null, cout: r.cout ?? null },
      };
      maj((d) => ({ ...d, tests: [...d.tests, t] }));
      setResultat(t);
      setPhase("fin");
    }} /></Carte>;
  return (
    <Carte titre={`${nom} terminé ✓`}>
      {resultat && (
        <ul className="lignes">
          <li>{exoInfo("recherche").nom} : <b>{resultat.recherche.justes}</b> cible(s) en 1 min, {fmtMs(resultat.recherche.ms)} en moyenne.</li>
          <li>{exoInfo("flanker").nom} : <b>{resultat.flanker.justes}</b> bonnes réponses sur {resultat.flanker.total}, {fmtMs(resultat.flanker.ms)} en moyenne{resultat.flanker.cout !== null ? `, les flèches trompeuses coûtent ${resultat.flanker.cout} ms` : ""}.</li>
          {sorte === "suivi" && precedent && <li className="muted">Au départ : {precedent.recherche.justes} cible(s) et {precedent.flanker.justes} bonnes réponses. La comparaison complète est dans « Progrès ».</li>}
        </ul>
      )}
      <p className="muted petit">Prochain test de suivi dans 7 jours.</p>
      <button className="btn primary" onClick={onFin}>Continuer</button>
    </Carte>
  );
}

/** La séance du jour : les exercices du jour l'un après l'autre, puis un bloc de travail profond proposé. */
export default function PageSeance() {
  const { db, maj, aller, arg } = useApp();
  const now = Date.now();
  const s = seanceDuJour(db, now);
  const test = testPropose(db, now);
  const [enTest, setEnTest] = useState(arg === "test" && test !== null);
  const [testRepousse, setTestRepousse] = useState(false);
  const [enCours, setEnCours] = useState(false);
  if (enTest && test) return <TestFixe sorte={test} onFin={() => { setEnTest(false); setTestRepousse(true); }} />;
  const prochaine = s.etapes.find((e) => !s.faites.includes(e.id));
  const finirEtape = (id: string) => maj((d) => marquerEtape(d, id, Date.now()));
  if (enCours && prochaine)
    return (
      <div className="pile">
        <div className="etapes">
          {s.etapes.map((e) => <span key={e.id} className={`etape ${s.faites.includes(e.id) ? "faite" : e.id === prochaine.id ? "en-cours" : ""}`}>{exoInfo(e.exo).icone} {exoInfo(e.exo).nom}</span>)}
        </div>
        <Partie key={prochaine.id} exo={prochaine.exo} budgetMinutes={prochaine.minutes} onQuitter={() => finirEtape(prochaine.id)} onEtapeFinie={() => finirEtape(prochaine.id)} />
      </div>
    );
  const faites = s.etapes.filter((e) => s.faites.includes(e.id)).length;
  return (
    <div className="pile">
      <Carte className="hero">
        <div className="hero-tete">
          <div>
            <h1>{s.finie ? "Séance du jour faite ✓" : "Ta séance du jour"}</h1>
            <p className="muted">{db.reglages.minutes} min d'exercices au niveau actuel, puis un bloc de travail profond si tu veux.</p>
          </div>
          <div className="serie" title="Jours d'affilée avec une séance terminée"><b>{serie(db, now)}</b><span>🔥 jours</span></div>
        </div>
        <ol className="etapes-apercu">
          {s.etapes.map((e) => (
            <li key={e.id} className={s.faites.includes(e.id) ? "faite" : ""}>
              {s.faites.includes(e.id) ? "✓" : "○"} {exoInfo(e.exo).icone} {exoInfo(e.exo).nom} <span className="muted">— niveau {db.niveaux[e.exo].level}</span>
              <em>{Math.round(e.minutes * 10) / 10} min</em>
            </li>
          ))}
          <li className="facultatif">⏱ Bloc de travail profond ({minutesPalier(db.travail)} min) <em>facultatif</em></li>
        </ol>
        <Barre part={faites / s.etapes.length} />
        <div className="choix">
          {s.finie ? (
            <button className="btn primary gros" onClick={() => aller("travail")}>Bloc de travail profond ({minutesPalier(db.travail)} min)</button>
          ) : (
            <button className="btn primary gros" onClick={() => setEnCours(true)}>{faites ? "Continuer" : `Commencer (${db.reglages.minutes} min)`}</button>
          )}
        </div>
        {s.finie && <p className="muted petit centre">Bravo. Le bloc de travail profond est en plus, quand tu as une vraie tâche à faire. Ou bien refais un exercice dans « Exercices ».</p>}
      </Carte>
      {test && !testRepousse && (
        <Carte titre={test === "depart" ? "🎯 Test de départ (2 min, facultatif)" : "🎯 Test de suivi de la semaine (2 min)"}>
          <p className="muted petit">Les mêmes conditions à chaque fois (niveau fixe, 1 min de recherche de cible + 1 min de flèches), pour comparer honnêtement tes progrès.</p>
          <div className="choix">
            <button className="btn primary" onClick={() => setEnTest(true)}>Faire le test</button>
            <button className="btn" onClick={() => setTestRepousse(true)}>Plus tard</button>
          </div>
        </Carte>
      )}
      <div className="tuiles">
        <button className="tuile" onClick={() => aller("travail")}><span>⏱</span><b>Travail profond</b><em>Palier : {minutesPalier(db.travail)} min</em></button>
        <button className="tuile" onClick={() => aller("exercices")}><span>🧩</span><b>Exercices</b><em>Les 5, en accès libre</em></button>
        <button className="tuile" onClick={() => aller("journal")}><span>📓</span><b>Journal</b><em>{db.distractions.length} distraction(s) notée(s)</em></button>
        <button className="tuile" onClick={() => aller("fiches")}><span>📚</span><b>Fiches</b><em>Ce qui est prouvé, ou pas</em></button>
      </div>
    </div>
  );
}
