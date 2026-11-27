// Progrès : vitesse et compréhension ensemble, mots compris par minute, niveaux, résumés, tests comparés.
import { scoreEfficace } from "../core/lecture";
import { EXOS } from "../core/niveaux";
import { resultatsTests, serie, vitesseMediane } from "../core/seance";
import { NOM_NIVEAU, texteParId } from "../core/textes";
import { Carte, Courbe, fmtDate, pc, plural, useApp } from "../ui";

export default function PageProgres() {
  const { db } = useApp();
  const lectures = db.resultats.filter((r) => r.exo === "lecture" && typeof r.mpm === "number").slice(-20);
  const tests = resultatsTests(db);
  const v = vitesseMediane(db);
  const comp = lectures.length ? lectures.reduce((s, r) => s + r.part, 0) / lectures.length : null;
  const idees = db.resumes.length ? db.resumes.reduce((s, r) => s + (r.total ? r.idees.length / r.total : 0), 0) / db.resumes.length : null;
  const rsvp = db.resultats.filter((r) => r.exo === "rsvp");
  const maxMpm = Math.max(300, ...lectures.map((r) => r.mpm!));
  return (
    <div className="pile">
      <Carte titre="En bref">
        <div className="chiffres">
          <div><b>{plural(serie(db, Date.now()), "jour", "jours")}</b><span>d'affilée</span></div>
          <div><b>{v === null ? "—" : Math.round(v)}</b><span>mots/min habituels (médiane)</span></div>
          <div><b>{comp === null ? "—" : pc(comp)}</b><span>compréhension moyenne</span></div>
          <div><b>{db.resumes.length}</b><span>résumés{idees === null ? "" : ` (${pc(idees)} des idées)`}</span></div>
        </div>
      </Carte>
      <Carte titre="Lectures chronométrées (20 dernières)">
        <p className="muted petit">Vitesse (mots/min) et compréhension (%), sur la même courbe : la vitesse ne compte que si la compréhension suit.</p>
        <Courbe min={0} max={100} series={[
          { nom: "Vitesse (en % de ta meilleure)", valeurs: lectures.map((r) => Math.round((r.mpm! / maxMpm) * 100)), couleur: "var(--accent)" },
          { nom: "Compréhension (%)", valeurs: lectures.map((r) => Math.round(r.part * 100)), couleur: "var(--warn)" },
        ]} vide="Encore une ou deux lectures pour voir la courbe." />
        {lectures.length > 0 && <p className="muted petit">Dernière : {lectures[lectures.length - 1].mpm} mots/min, {pc(lectures[lectures.length - 1].part)} compris, soit {scoreEfficace(lectures[lectures.length - 1].mpm!, lectures[lectures.length - 1].part)} mots compris par minute.</p>}
      </Carte>
      <Carte titre="Niveaux des exercices">
        <ul className="tests">
          {EXOS.map((e) => <li key={e.id}>{e.icone} {e.nom} : <b>{NOM_NIVEAU[db.niveaux[e.id].level]}</b> <span className="muted petit">({db.resultats.filter((r) => r.exo === e.id).length} fait(s))</span></li>)}
        </ul>
      </Carte>
      <Carte titre="Tests de départ et de suivi">
        {tests.length === 0 ? <p className="muted">Pas encore de test.</p> : (
          <ul className="tests">
            {tests.map((t) => (
              <li key={t.id}><b>{fmtDate(t.at)}</b> ({t.test === "depart" ? "départ" : "suivi"}, « {texteParId(t.texteId)?.titre ?? t.texteId} ») : {t.mpm} mots/min, {pc(t.part)} compris, {scoreEfficace(t.mpm ?? 0, t.part)} mots compris/min</li>
            ))}
          </ul>
        )}
        <p className="muted petit">Les textes de test ont le même niveau et des longueurs proches, mais aucun texte n'est parfaitement comparable : regarde la tendance sur plusieurs semaines.</p>
      </Carte>
      {rsvp.length > 0 && (
        <Carte titre="Essais mot à mot">
          <ul className="tests">{rsvp.map((r) => <li key={r.id}>{fmtDate(r.at)} : {r.mpm} mots/min imposés, {pc(r.part)} compris</li>)}</ul>
        </Carte>
      )}
    </div>
  );
}
