// Progrès de la langue en cours : chiffres, courbes de justesse par exercice, tests comparés.
import { EXOS } from "../core/niveaux";
import { NOM_LANGUE } from "../core/langues";
import { comparerTests, courbe, part, progres } from "../core/stats";
import { Carte, Courbe, fmtDate, plural, useApp } from "../ui";

const pc = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)} %`);

export default function PageProgres() {
  const { db, langue } = useApp();
  const p = progres(db, langue, Date.now());
  const tests = db.tests.filter((t) => t.langue === langue);
  return (
    <div className="pile">
      <Carte titre={`Progrès · ${NOM_LANGUE[langue]}`}>
        <div className="chiffres">
          <div><b>{plural(p.serie, "jour", "jours")}</b><span>d'affilée</span></div>
          <div><b>{p.vus}</b><span>mots découverts</span></div>
          <div><b>{p.sus}</b><span>mots bien sus</span></div>
          <div><b>{p.revisions}</b><span>rappels faits</span></div>
          <div><b>{pc(p.justesse)}</b><span>rappels justes</span></div>
          {langue === "zh" && <div><b>{pc(p.tons)}</b><span>tons reconnus (10 dernières manches)</span></div>}
        </div>
      </Carte>
      {EXOS.filter((e) => e.langues.includes(langue)).map((e) => (
        <Carte key={e.id} titre={`${e.icone} ${e.nom}`}>
          <p className="muted petit">Niveau {db.niveaux[langue][e.id].level} / {e.max} (meilleur : {db.niveaux[langue][e.id].best || "—"}). Justesse par jour (%), ligne pointillée = 80 %.</p>
          <Courbe valeurs={courbe(db, langue, e.id)} />
        </Carte>
      ))}
      <Carte titre="Tests de départ et de suivi">
        {tests.length === 0 ? <p className="muted">Pas encore de test dans cette langue.</p> : (
          <ul className="tests">
            {tests.map((t, i) => (
              <li key={t.id}>
                <b>{fmtDate(t.at)}</b> ({t.sorte === "depart" ? "départ" : "suivi"}) : {t.mots} / {t.motsMax} mots, {t.phrases} / {t.phrasesMax} phrases
                {" "}— {pc(part(t.mots + t.phrases, t.motsMax + t.phrasesMax))}
                {i > 0 && <span className="muted petit"> · {comparerTests(tests[i - 1], t)}</span>}
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </div>
  );
}
