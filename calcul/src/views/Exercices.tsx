// Accès libre à chaque exercice : entraînement, estimation, les 10 astuces, les défis, les tests.
import { useState, type ReactNode } from "react";
import { AstuceLecon, Defi, Entrainement, Estimation, Test } from "../activites";
import { ASTUCES } from "../core/astuces";
import { DEFIS, meilleurScore, testsFaits, type DefiId } from "../core/defis";
import { typesActifs } from "../core/entrainement";
import { TYPES } from "../core/niveaux";
import type { AstuceId } from "../core/question";
import { meilleursAstuces } from "../core/stats";
import { Carte, useApp } from "../ui";

type Vue = { k: "entrainement" } | { k: "estimation" } | { k: "astuce"; id: AstuceId } | { k: "defi"; id: DefiId } | { k: "test" } | null;

export default function PageExercices() {
  const { db, arg } = useApp();
  const [vue, setVue] = useState<Vue>(arg ? { k: "astuce", id: arg as AstuceId } : null);
  const retour = () => { setVue(null); window.scrollTo({ top: 0 }); };
  const avecRetour = (el: ReactNode) => <div className="pile"><button className="btn petit retour" onClick={retour}>← Exercices</button>{el}</div>;
  if (vue?.k === "entrainement") return avecRetour(<Entrainement surFin={retour} />);
  if (vue?.k === "estimation") return avecRetour(<Estimation surFin={retour} />);
  if (vue?.k === "astuce") return avecRetour(<AstuceLecon key={vue.id} id={vue.id} surFin={retour} />);
  if (vue?.k === "defi") return avecRetour(<Defi id={vue.id} surFin={retour} />);
  if (vue?.k === "test") return avecRetour(<Test numero={testsFaits(db).length} surFin={retour} />);

  const actifs = typesActifs(db);
  const best = meilleursAstuces(db);
  return (
    <div className="pile">
      <Carte titre="Entraînement adaptatif">
        <p className="muted petit">Des calculs de tous les types, mélangés. Chaque type a son niveau : 2 réussites de suite → plus dur, 1 erreur → plus facile. Les calculs ratés reviennent plus tard.</p>
        <div className="niveaux">
          {TYPES.map((t) => (
            <div key={t.id} className={`niveau-type ${actifs.includes(t.id) ? "" : "verrou"}`}>
              <span className="icone-type">{t.icone}</span>
              <span><b>{t.nom}</b> <span className="muted petit">niveau {db.niveaux[t.id].niveau}/{t.max}</span><br /><small className="muted">{actifs.includes(t.id) ? t.paliers[db.niveaux[t.id].niveau - t.min] : t.id === "mult2" ? "s'ouvre au niveau 3 de « × 1 chiffre »" : "s'ouvre après ta première astuce"}</small></span>
            </div>
          ))}
        </div>
        <div className="choix"><button className="btn primary gros" onClick={() => setVue({ k: "entrainement" })}>S'entraîner</button></div>
      </Carte>
      <Carte titre="🎯 Estimer d'abord">
        <p className="muted petit">10 calculs : une estimation rapide (acceptée à 10 % près), puis le calcul exact.</p>
        <div className="choix"><button className="btn" onClick={() => setVue({ k: "estimation" })}>Commencer</button></div>
      </Carte>
      <Carte titre="Les 10 astuces">
        <p className="muted petit">Explication pas à pas, exemple animé, pourquoi ça marche, puis 10 exercices. Ce sont des raccourcis exacts ; leur effet propre n'a pas été mesuré par des études.</p>
        <div className="grille-jeux">
          {ASTUCES.map((a) => (
            <button key={a.id} className="jeu" onClick={() => setVue({ k: "astuce", id: a.id })}>
              <span className="icone">{a.icone}</span>
              <b>{a.titre}</b>
              <em>{best[a.id] === null ? "pas encore faite" : `meilleur : ${best[a.id]} / 10`}</em>
              <small>{a.resume}</small>
            </button>
          ))}
        </div>
      </Carte>
      <Carte titre="Défis chronométrés (facultatifs)">
        <p className="muted petit">Pour le jeu. Le chrono met la pression : si ça te stresse, l'entraînement sans chrono suffit.</p>
        <div className="grille-jeux">
          {DEFIS.map((d) => {
            const m = meilleurScore(db, d.id);
            return (
              <button key={d.id} className="jeu" onClick={() => setVue({ k: "defi", id: d.id })}>
                <span className="icone">{d.icone}</span>
                <b>{d.nom}</b>
                <em>{m === null ? "pas encore de record" : `record : ${m} ${d.unite}`}</em>
                <small>{d.regle}</small>
              </button>
            );
          })}
        </div>
      </Carte>
      <Carte titre="Tests">
        <p className="muted petit">20 calculs à difficulté fixe : le test de départ, puis un test de suivi par semaine. {testsFaits(db).length ? `${testsFaits(db).length} test(s) fait(s).` : "Aucun test fait pour l'instant."}</p>
        <div className="choix"><button className="btn" onClick={() => setVue({ k: "test" })}>{testsFaits(db).length ? "Faire un test de suivi" : "Faire le test de départ"}</button></div>
      </Carte>
    </div>
  );
}
