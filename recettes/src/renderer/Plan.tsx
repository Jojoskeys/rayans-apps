import { useMemo, useState } from "react";
import { candidats, dateDuJour, genererPlan, lundiDe, NOMS_JOURS, NOMS_REPAS, preparationsDuJour, totalDuJour } from "../core/plan.ts";
import { REPAS, type Action, type Recette, type Repas } from "../core/types.ts";
import type { Etat } from "./api-types.ts";
import type { Source } from "./Courses.tsx";

const QUAND = { "aujourdhui": "pour aujourd'hui", "ce-soir": "prépare ce soir pour demain", "des-que-possible": "à préparer en avance : lance-la dès que possible" };
const date = (d: Date, mois: "long" | "short" = "long") => d.toLocaleDateString("fr-FR", { day: "numeric", month: mois });

export function MonPlan({ etat, toutes, agir, voirRecette, voirCourses }: {
  etat: Etat; toutes: Recette[]; agir: (a: Action) => void; voirRecette: (id: string) => void; voirCourses: (s: Source) => void;
}) {
  const plan = etat.donnees.plan;
  const cetteSemaine = lundiDe(new Date());
  const indexAujourdhui = (new Date().getDay() + 6) % 7;
  const [jour, setJour] = useState(plan?.debut === cetteSemaine ? indexAujourdhui : 0);
  const parId = useMemo(() => new Map(toutes.map((r) => [r.id, r])), [toutes]);
  const listes = useMemo(() => Object.fromEntries(REPAS.map((r) => [r, candidats(toutes, r)])) as Record<Repas, Recette[]>, [toutes]);

  const generer = (debut: string, garder: boolean) =>
    agir({ type: "plan", plan: genererPlan(toutes, { debut, precedent: garder ? plan : null }) });

  if (!plan) {
    return (
      <div className="carte plan-vide">
        <h1>Mon plan de la semaine</h1>
        <p className="aide">
          Un menu du lundi au dimanche (petit-déjeuner, déjeuner, collation, dîner) pioché dans vos recettes, varié d'un
          jour à l'autre, avec les recettes riches en protéines d'abord aux repas principaux.
        </p>
        <div><button className="bouton" data-testid="generer-plan" disabled={!toutes.length} onClick={() => { setJour(indexAujourdhui); generer(cetteSemaine, false); }}>Créer mon plan de la semaine</button></div>
        {!toutes.length && <p className="vide">Aucune recette pour l'instant.</p>}
      </div>
    );
  }

  const j = plan.jours[jour];
  const preparations = preparationsDuJour(plan, parId, jour);
  const total = totalDuJour(plan, parId, jour);
  const ancien = plan.debut !== cetteSemaine;

  return (
    <div className="plan">
      <div className="entete">
        <h1>Mon plan — semaine du {date(dateDuJour(plan.debut, 0))}</h1>
        <div className="actions">
          {ancien && <button className="bouton" onClick={() => { setJour(indexAujourdhui); generer(cetteSemaine, false); }}>Plan pour cette semaine</button>}
          <button className="bouton secondaire" data-testid="regenerer" title="Les cases que vous avez changées sont gardées" onClick={() => generer(plan.debut, true)}>↻ Régénérer la semaine</button>
        </div>
      </div>
      {ancien && <p className="bandeau">Ce plan est celui d'une autre semaine.</p>}

      <div className="jours">
        {NOMS_JOURS.map((nom, n) => (
          <button key={nom} className={`jour ${n === jour ? "actif" : ""} ${!ancien && n === indexAujourdhui ? "aujourdhui" : ""}`} onClick={() => setJour(n)}>
            <b>{nom.slice(0, 3)}</b><small>{date(dateDuJour(plan.debut, n), "short")}</small>
          </button>
        ))}
      </div>

      <div className="deux-colonnes plan-jour">
        <section className="carte">
          <h2>Ce que tu manges — {NOMS_JOURS[jour]}{!ancien && jour === indexAujourdhui ? " (aujourd'hui)" : ""}</h2>
          <ul className="cases" data-testid="cases-jour">
            {REPAS.map((repas) => {
              const c = j[repas];
              const r = c.id ? parId.get(c.id) : undefined;
              const autres = toutes.filter((x) => !listes[repas].includes(x));
              return (
                <li key={repas}>
                  <span className="nom-repas">{NOMS_REPAS[repas]}{c.fixe && <em title="Choisi par vous : gardé quand vous régénérez"> · choisi</em>}</span>
                  <div className="case">
                    <select data-testid={`case-${repas}`} value={c.id && r ? c.id : ""} onChange={(e) => agir({ type: "casePlan", jour, repas, id: e.target.value || null })}>
                      <option value="">Libre</option>
                      <optgroup label="Conseillées">{listes[repas].map((x) => <option key={x.id} value={x.id}>{x.titre}</option>)}</optgroup>
                      {autres.length > 0 && <optgroup label="Autres recettes">{autres.map((x) => <option key={x.id} value={x.id}>{x.titre}</option>)}</optgroup>}
                    </select>
                    {r && <button className="lien" onClick={() => voirRecette(r.id)}>Voir</button>}
                  </div>
                </li>
              );
            })}
          </ul>
          {total && (
            <p className="total-jour">
              Total approximatif : ≈ {total.kcal} kcal · ≈ {total.proteines} g de protéines
              {total.renseignees < total.recettes && <small> (seulement {total.renseignees} recette(s) sur {total.recettes} donnent ces chiffres)</small>}
            </p>
          )}
        </section>
        <section className="carte">
          <h2>Ce que tu prépares aujourd'hui</h2>
          {preparations.length === 0 ? <p className="discret">Rien à préparer.</p> : (
            <ul className="preparations" data-testid="preparations">
              {preparations.map((p) => (
                <li key={`${p.recette.id}-${p.quand}`} className={p.quand}>
                  <button className="lien" onClick={() => voirRecette(p.recette.id)}>{p.recette.titre}</button>
                  <small>{NOMS_REPAS[p.repas]} {p.quand === "ce-soir" ? `de ${NOMS_JOURS[jour + 1].toLowerCase()}` : ""} — {QUAND[p.quand]}</small>
                </li>
              ))}
            </ul>
          )}
          <div className="actions">
            <button className="bouton secondaire" data-testid="courses-du-jour" onClick={() => voirCourses({ type: "jour", jour })}>Courses de ce jour</button>
            <button className="bouton secondaire" onClick={() => voirCourses({ type: "semaine" })}>Courses de la semaine</button>
          </div>
        </section>
      </div>

      <section className="carte">
        <h2>La semaine</h2>
        <div className="semaine">
          <table>
            <thead><tr><th></th>{REPAS.map((r) => <th key={r}>{NOMS_REPAS[r]}</th>)}</tr></thead>
            <tbody>
              {plan.jours.map((x, n) => (
                <tr key={n} className={n === jour ? "actif" : ""} onClick={() => setJour(n)}>
                  <th>{NOMS_JOURS[n]}</th>
                  {REPAS.map((r) => <td key={r}>{(x[r].id && parId.get(x[r].id!)?.titre) || <span className="discret">Libre</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
