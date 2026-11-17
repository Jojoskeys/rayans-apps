// Objectifs du jour : 3 petits objectifs faciles, adaptés aux habitudes, mesurés automatiquement quand une app
// le permet (Révision, Chrono, Rayan's Journal), sinon à cocher.
import { DOMAINES, NOMS_DOMAINES, type Domaine } from "../core/objectifs.ts";
import type { ObjectifsView } from "./api-types.ts";

const api = window.aujourdhui;
const errText = (e: unknown) => String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
const ICONES: Record<Domaine, string> = { foi: "🕌", etudes: "📚", ecran: "🖥️", sante: "🌱" };

export function ObjectifsToday({ o, notify }: { o: ObjectifsView; notify: (t: string) => void }) {
  if (!o.objectifs.length) return null;
  const atteints = o.objectifs.filter((x) => x.avancement.etat === "atteint").length;
  return (
    <section className="carte objectifs" data-testid="objectifs">
      <div className="titre-ligne">
        <h2>Objectifs du jour <span className="aide">· {atteints}/{o.objectifs.length}</span></h2>
        {o.serie > 0 && <span className="badge orange" title="Jours d'affilée où tous les objectifs ont été atteints">{o.serie} jour{o.serie > 1 ? "s" : ""} d'affilée</span>}
      </div>
      <ul className="objectifs-liste">
        {o.objectifs.map((x) => {
          const a = x.avancement;
          const pct = x.mesure && a.valeur !== null && x.mesure.sens === "min" ? Math.min(100, (a.valeur / x.mesure.cible) * 100) : null;
          return (
            <li key={x.id} className={`objectif ${a.etat}`} data-testid="objectif">
              <span className="objectif-icone" title={NOMS_DOMAINES[x.domaine]}>{ICONES[x.domaine]}</span>
              <div className="objectif-texte">
                {x.mesure ? (
                  <span className="objectif-titre">{a.etat === "atteint" ? "✓ " : ""}{x.titre}</span>
                ) : (
                  <label className="case">
                    <input type="checkbox" checked={x.fait} onChange={() => api.objectifs.toggle(x.id).catch((e) => notify(errText(e)))} />
                    <span className="objectif-titre">{x.titre}</span>
                  </label>
                )}
                <small>
                  {x.mesure ? a.texte : x.detail}
                  {x.mesure && <> · <span className="aide">mesuré automatiquement</span></>}
                  {x.facile && <> · <span className="aide">version douce</span></>}
                </small>
                {pct !== null && <div className="objectif-barre" aria-hidden="true"><div style={{ width: `${pct}%` }} /></div>}
              </div>
              {a.etat !== "atteint" && (
                <button className="lien" title="Proposer un autre objectif à la place" onClick={() => api.objectifs.change(x.id).catch((e) => notify(errText(e)))}>
                  Autre
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {!o.sources.journal && (
        <p className="aide">Pour des objectifs sur l'écran et les jeux, active le résumé quotidien dans Rayan's Journal (Réglages → Temps d'écran).</p>
      )}
    </section>
  );
}

export function ObjectifsReglages({ o, notify }: { o: ObjectifsView; notify: (t: string) => void }) {
  const set = (r: Parameters<typeof api.objectifs.settings>[0]) => api.objectifs.settings(r).then(() => notify("Objectifs du jour choisis à nouveau.")).catch((e) => notify(errText(e)));
  const d = o.reglages.domaines;
  return (
    <div className="carte">
      <h2>Objectifs du jour</h2>
      <p className="aide">
        Chaque jour, des petits objectifs faciles dans des domaines différents. La cible est un peu au-dessus de ta moyenne des 7 derniers jours, et plus douce
        après un objectif raté. Mesurés automatiquement depuis Rayan's Révision, Rayan's Chrono et Rayan's Journal quand c'est possible, sinon à cocher.
      </p>
      <div className="ligne">
        {DOMAINES.map((x) => (
          <label key={x} className="case">
            <input type="checkbox" checked={d.includes(x)} onChange={(e) => set({ domaines: e.target.checked ? [...d, x] : d.filter((y) => y !== x) })} />
            <span>{ICONES[x]} {NOMS_DOMAINES[x]}</span>
          </label>
        ))}
      </div>
      <label className="champ-ligne">Nombre par jour
        <select value={o.reglages.nombre} onChange={(e) => set({ nombre: Number(e.target.value) })}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <p className="aide">
        Sources : Révision {o.sources.revision ? "✓" : "— pas encore de révisions"} · Chrono {o.sources.chrono ? "✓" : "— pas trouvé"} · Rayan's Journal{" "}
        {o.sources.journal ? "✓" : "— résumé quotidien absent"}. Notification le matin (dès 8 h) et le soir à l'heure du rappel s'il reste des objectifs.
      </p>
    </div>
  );
}
