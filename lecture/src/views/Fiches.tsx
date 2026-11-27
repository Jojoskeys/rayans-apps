// Fiches (✅ prouvé / ⚠️ discuté / ❌ mythe), quiz « vrai ou faux » et page des sources.
import { useMemo, useState } from "react";
import { FICHES, QUIZ, source, SOURCES, STATUT } from "../core/contenu";
import { makeRng, randomSeed, shuffle } from "../core/rng";
import { Carte, useApp } from "../ui";

function Lien({ id }: { id: string }) {
  const s = source(id);
  return s.lien ? <a href={s.lien} target="_blank" rel="noreferrer">{s.texte}</a> : <>{s.texte}</>;
}

function Quiz({ fermer, ouvrir }: { fermer: () => void; ouvrir: (fiche: string) => void }) {
  const questions = useMemo(() => shuffle(makeRng(randomSeed()), QUIZ), []);
  const [i, setI] = useState(0);
  const [rep, setRep] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  if (i >= questions.length)
    return (
      <Carte titre="Vrai ou faux ? — fini">
        <p className="verdict">{score} / {questions.length} bonnes réponses</p>
        <p className="muted petit">Les fiches détaillent chaque point, avec leurs sources.</p>
        <div className="choix">
          <button className="btn" onClick={() => { setI(0); setScore(0); setRep(null); }}>Recommencer</button>
          <button className="btn primary" onClick={fermer}>Retour aux fiches</button>
        </div>
      </Carte>
    );
  const q = questions[i];
  const repondre = (v: boolean) => { setRep(v); if (v === q.vrai) setScore((s) => s + 1); };
  return (
    <Carte titre={`Vrai ou faux ? (${i + 1} / ${questions.length})`}>
      <p className="affirmation">« {q.affirmation} »</p>
      {rep === null ? (
        <div className="choix"><button className="btn gros" onClick={() => repondre(true)}>Vrai</button><button className="btn gros" onClick={() => repondre(false)}>Faux</button></div>
      ) : (
        <>
          <p className={rep === q.vrai ? "ok-texte" : "ko-texte"}><b>{q.vrai ? "Vrai." : "Faux."}</b> {q.explication}</p>
          <div className="choix">
            <button className="btn" onClick={() => ouvrir(q.fiche)}>Voir la fiche</button>
            <button className="btn primary" onClick={() => { setI(i + 1); setRep(null); }} autoFocus>Suivant</button>
          </div>
        </>
      )}
    </Carte>
  );
}

export function PageFiches() {
  const { arg } = useApp();
  const [ouverte, setOuverte] = useState<string | null>(arg ?? null);
  const [quiz, setQuiz] = useState(false);
  if (quiz) return <div className="pile"><button className="btn petit retour" onClick={() => setQuiz(false)}>← Fiches</button><Quiz fermer={() => setQuiz(false)} ouvrir={(f) => { setQuiz(false); setOuverte(f); }} /></div>;
  return (
    <div className="pile">
      <Carte titre="Comment on lit (et on comprend)">
        <p className="muted petit">Ce que dit la recherche, simplement. {STATUT.prouve} = solide, {STATUT.discute} = discuté ou prouvé en partie, {STATUT.mythe} = idée reçue.</p>
        <button className="btn primary" onClick={() => setQuiz(true)}>Quiz : vrai ou faux ? ({QUIZ.length} questions)</button>
      </Carte>
      {FICHES.map((f) => (
        <Carte key={f.id} className={`fiche`}>
          <button className="fiche-tete" onClick={() => setOuverte(ouverte === f.id ? null : f.id)} aria-expanded={ouverte === f.id}>
            <span>{f.icone}</span> <b>{f.titre}</b> <em>{ouverte === f.id ? "▾" : "▸"}</em>
          </button>
          {ouverte === f.id && (
            <div>
              <ul className="principes">{f.principes.map((p) => <li key={p.texte} className={p.statut}><span>{STATUT[p.statut]}</span> {p.texte}</li>)}</ul>
              {f.paragraphes.map((p) => <p key={p}>{p}</p>)}
              <p className="dans-app">→ Dans l'app : {f.dansLApp}</p>
              {f.sources.length > 0 && <details><summary className="muted petit">Sources</summary><ul className="sources">{f.sources.map((s) => <li key={s}><Lien id={s} /></li>)}</ul></details>}
            </div>
          )}
        </Carte>
      ))}
    </div>
  );
}

export function PageSources() {
  return (
    <div className="pile">
      <Carte titre="Sources">
        <p className="muted petit">Les études sur lesquelles s'appuient les fiches. Un lien est donné quand il a pu être vérifié ; sinon, auteurs, année et revue suffisent pour retrouver l'article.</p>
        <ul className="sources liste-sources">{SOURCES.map((s) => <li key={s.id}><Lien id={s.id} /></li>)}</ul>
      </Carte>
      <Carte titre="À savoir">
        <p className="petit">Tous les textes ont été écrits pour l'app : aucun n'est copié d'un livre ou d'un article. Ils simplifient parfois un sujet pour rester courts et lisibles.</p>
        <p className="petit">La plupart des études sur la vitesse de lecture portent sur l'anglais : les repères donnés sont des ordres de grandeur, pas des normes.</p>
      </Carte>
    </div>
  );
}
