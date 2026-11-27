// Questions à choix, répondues sans le texte, puis corrigées avec une explication.
import type { QuestionAffichee } from "../core/lecture";

export function Questions({ qs, reponses, choisir, corrige }: { qs: QuestionAffichee[]; reponses: (number | null)[]; choisir: (i: number, c: number) => void; corrige: boolean }) {
  return (
    <div>
      {qs.map((q, i) => (
        <div key={i} className="question">
          <p>{i + 1}. {q.q} {corrige && <span className="muted petit">({q.sorte === "litterale" ? "écrit dans le texte" : "à déduire"})</span>}</p>
          <div className="options" role="radiogroup">
            {q.choix.map((c, k) => {
              let cls = "option";
              if (corrige) cls += k === q.bonne ? " bonne" : reponses[i] === k ? " fausse" : "";
              else if (reponses[i] === k) cls += " choisie";
              return <button key={k} type="button" role="radio" aria-checked={reponses[i] === k} className={cls} disabled={corrige} onClick={() => choisir(i, k)}>{c}</button>;
            })}
          </div>
          {corrige && <p className="explication">{reponses[i] === q.bonne ? "✓ " : "✗ "}{q.explication}</p>}
        </div>
      ))}
    </div>
  );
}
