// Progrès : série, ressenti avant / après les respirations, émotions les plus nommées, questionnaire. Jamais de diagnostic.
import { comparer, phraseComparaison, QUESTIONS } from "../core/questionnaire";
import { ecartMoyen, emotionsFrequentes, joursActifs, minutesRespirees, ressentis, serie } from "../core/stats";
import { aujourdhui, Carte, Courbe, fmtDate, plural, useApp } from "../ui";

export default function PageProgres() {
  const { db, aller } = useApp();
  const jours = joursActifs(db);
  const s = serie(jours, aujourdhui(db));
  const res = ressentis(db).slice(-30);
  const ecart = ecartMoyen(res);
  const emo = emotionsFrequentes(db);
  const maxEmo = Math.max(1, ...emo.map((e) => e.fois));
  const tests = [...db.tests].sort((a, b) => a.at - b.at);
  const comp = tests.length >= 2 ? comparer(tests[0], tests[tests.length - 1]) : null;
  return (
    <div className="pile">
      <div className="chiffres">
        <div><b>{plural(s, "jour", "jours")}</b><span>d'affilée</span></div>
        <div><b>{jours.size}</b><span>jours pratiqués en tout</span></div>
        <div><b>{minutesRespirees(db)} min</b><span>de respiration</span></div>
        <div><b>{db.activites.filter((a) => a.type === "seance").length}</b><span>séances du jour</span></div>
      </div>

      <Carte titre="Ressenti avant / après les respirations">
        <p className="muted petit">De 1 (très tendu) à 10 (très calme), quand tu l'as noté. 30 dernières fois.</p>
        <Courbe min={1} max={10} vide="Note ton ressenti avant et après deux respirations pour voir la courbe." series={[
          { nom: "avant", valeurs: res.map((r) => r.avant), couleur: "var(--muted)" },
          { nom: "après", valeurs: res.map((r) => r.apres), couleur: "var(--accent)" },
        ]} />
        {ecart !== null && <p className="petit">En moyenne : {ecart > 0 ? `+${ecart}` : ecart} point{Math.abs(ecart) >= 2 ? "s" : ""} après la respiration{ecart > 0 ? ". Ça a l'air de t'aider sur le moment." : "."}</p>}
      </Carte>

      <Carte titre="Les émotions que tu nommes le plus">
        {emo.length === 0 ? <p className="muted petit">Rien pour l'instant. <button className="lien" onClick={() => aller("exercices", "nommer")}>Nommer une émotion</button></p> : (
          <ul className="barres">
            {emo.map((e) => (
              <li key={e.id}><span>{e.icone} {e.nom}</span><div className="barre"><div style={{ width: `${(e.fois / maxEmo) * 100}%` }} /></div><b>{e.fois}</b></li>
            ))}
          </ul>
        )}
        <p className="muted petit">Juste un repère pour mieux te connaître : ça ne dit rien sur ta santé.</p>
      </Carte>

      <Carte titre="Tes semaines (questionnaire)">
        {tests.length === 0 && <p className="muted petit">Pas encore de questionnaire. <button className="lien" onClick={() => aller("exercices", "test")}>Faire le test de départ</button></p>}
        {tests.length === 1 && <p className="muted petit">Test de départ fait le {fmtDate(tests[0].at)}. Le prochain sera proposé dans une semaine.</p>}
        {comp && (
          <>
            <p className="petit">Du {fmtDate(tests[0].at)} au {fmtDate(tests[tests.length - 1].at)} ({tests.length} questionnaires) :</p>
            <ul className="comparaison">{comp.map((c) => <li key={c.question.id}><span className={`sens ${c.sens}`}>{c.sens === "mieux" ? "↗" : c.sens === "moins" ? "↘" : "="}</span>{phraseComparaison(c)}</li>)}</ul>
            {QUESTIONS.map((q, i) => (
              <details key={q.id}><summary className="muted petit">{q.texte}</summary>
                <Courbe min={0} max={10} hauteur={60} series={[{ nom: q.id, valeurs: tests.map((t) => t.reponses[i] ?? 5), couleur: "var(--accent)" }]} />
              </details>
            ))}
          </>
        )}
        <p className="muted petit">Ce questionnaire est fait maison : ce n'est pas un test médical et il ne pose aucun diagnostic. Si tu ne vas pas bien depuis plus de deux semaines, <button className="lien" onClick={() => aller("aide")}>parles-en à quelqu'un</button>.</p>
      </Carte>
    </div>
  );
}
