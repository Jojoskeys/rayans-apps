// Objectifs du jour : une dizaine d'objectifs (dont ceux « tous les jours »), mesurés automatiquement quand une app
// le permet (Révision, Chrono, Rayan's Journal, Sport), compteurs avec + / − et palier bonus, sinon à cocher.
// Réglages : nombre par jour, domaines, et pour chaque objectif « tous les jours », « proposé », modifier ou supprimer.
import { useEffect, useState } from "react";
import { DOMAINES, NOMBRE_MAX, NOMS_DOMAINES, nombreTexte, type Domaine, type ObjectifPerso } from "../core/objectifs.ts";
import type { ObjectifsView } from "./api-types.ts";

const api = window.aujourdhui;
const errText = (e: unknown) => String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
const ICONES: Record<Domaine, string> = { foi: "🕌", etudes: "📚", ecran: "🖥️", sante: "🌱" };

type Ligne = ObjectifsView["objectifs"][number];

export function ObjectifsToday({ o, notify }: { o: ObjectifsView; notify: (t: string) => void }) {
  if (!o.objectifs.length) return null;
  const atteints = o.objectifs.filter((x) => x.avancement.etat === "atteint").length;
  const bonus = o.objectifs.filter((x) => x.avancement.bonus).length;
  return (
    <section className="carte objectifs" data-testid="objectifs">
      <div className="titre-ligne">
        <h2>Objectifs du jour <span className="aide">· {atteints}/{o.objectifs.length}{bonus ? ` · ${bonus} bonus ★` : ""}</span></h2>
        {o.serie > 0 && <span className="badge orange" title="Jours d'affilée où tous les objectifs ont été atteints">{o.serie} jour{o.serie > 1 ? "s" : ""} d'affilée</span>}
      </div>
      <ul className="objectifs-liste">
        {o.objectifs.map((x) => <ObjectifLigne key={x.id} x={x} notify={notify} />)}
      </ul>
      {!o.sources.journal && (
        <p className="aide">Pour des objectifs sur l'écran et les jeux, active le résumé quotidien dans Rayan's Journal (Réglages → Temps d'écran).</p>
      )}
    </section>
  );
}

function ObjectifLigne({ x, notify }: { x: Ligne; notify: (t: string) => void }) {
  const a = x.avancement;
  const compteur = x.mesure?.source === "saisie";
  const pct = x.mesure && a.valeur !== null && x.mesure.sens === "min" ? Math.min(100, (a.valeur / x.mesure.cible) * 100) : null;
  const bonusPct = compteur && x.mesure!.bonus && a.valeur !== null && a.valeur >= x.mesure!.cible ? Math.min(100, ((a.valeur - x.mesure!.cible) / (x.mesure!.bonus - x.mesure!.cible)) * 100) : null;
  return (
    <li className={`objectif ${a.etat}${a.bonus ? " bonus" : ""}`} data-testid="objectif">
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
          {x.mesure && !compteur && <> · <span className="aide">mesuré automatiquement</span></>}
          {x.facile && <> · <span className="aide">version douce</span></>}
          {x.fixe && <> · <span className="aide">tous les jours</span></>}
        </small>
        {compteur && <Compteur x={x} notify={notify} />}
        {compteur && x.detail && <small>{x.detail}</small>}
        {pct !== null && (bonusPct === null
          ? <div className="objectif-barre" aria-hidden="true"><div style={{ width: `${pct}%` }} /></div>
          : <div className="objectif-barre bonus" aria-hidden="true" title="Vers le bonus"><div style={{ width: `${bonusPct}%` }} /></div>)}
      </div>
      {a.etat !== "atteint" && !x.fixe && (
        <button className="lien" title="Proposer un autre objectif à la place" onClick={() => api.objectifs.change(x.id).catch((e) => notify(errText(e)))}>
          Autre
        </button>
      )}
    </li>
  );
}

/** − / nombre / + : le nombre se tape aussi directement (total du jour). */
function Compteur({ x, notify }: { x: Ligne; notify: (t: string) => void }) {
  const total = x.avancement.valeur ?? 0;
  const pas = x.mesure!.pas ?? 1;
  const [texte, setTexte] = useState(String(total));
  useEffect(() => setTexte(String(total)), [total]);
  const envoyer = (n: number) => api.objectifs.count(x.id, Math.max(0, n)).catch((e) => notify(errText(e)));
  const valider = () => {
    const n = Number(texte.replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(n) && n !== total) void envoyer(n); else setTexte(String(total));
  };
  return (
    <div className="objectif-compteur" data-testid={`compteur-${x.id}`}>
      <button className="bouton secondaire petit" aria-label={`Enlever ${pas}`} onClick={() => envoyer(total - pas)} disabled={total <= 0}>−{nombreTexte(pas)}</button>
      <input inputMode="numeric" value={texte} aria-label={`Total : ${x.mesure!.unite ?? ""}`} onChange={(e) => setTexte(e.target.value)} onBlur={valider} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      <button className="bouton petit" aria-label={`Ajouter ${pas}`} onClick={() => envoyer(total + pas)}>+{nombreTexte(pas)}</button>
      {x.mesure!.unite && <span className="aide">{x.mesure!.unite}</span>}
    </div>
  );
}

// ----- Réglages ---------------------------------------------------------------------------------------------

type Brouillon = { id: string | null; base: string | null; titre: string; domaine: Domaine; detail: string; compteur: boolean; unite: string; cible: string; bonus: string; pas: string };
const VIDE: Brouillon = { id: null, base: null, titre: "", domaine: "sante", detail: "", compteur: false, unite: "", cible: "", bonus: "", pas: "1" };

export function ObjectifsReglages({ o, notify }: { o: ObjectifsView; notify: (t: string) => void }) {
  const r = o.reglages;
  const [edit, setEdit] = useState<Brouillon | null>(null);
  const set = (x: Parameters<typeof api.objectifs.settings>[0], msg = "Objectifs mis à jour.") =>
    api.objectifs.settings(x).then(() => { notify(msg); return true; }).catch((e) => { notify(errText(e)); return false; });
  const basculer = (liste: string[], id: string, oui: boolean) => (oui ? [...new Set([...liste, id])] : liste.filter((y) => y !== id));

  const modifier = (id: string) => {
    const p = r.perso.find((x) => x.id === id);
    const c = o.catalogue.find((x) => x.id === id)!;
    if (p) setEdit({ id: p.id, base: p.id, titre: p.titre, domaine: p.domaine, detail: p.detail, compteur: !!p.compteur, unite: p.compteur?.unite ?? "", cible: String(p.compteur?.cible ?? ""), bonus: p.compteur?.bonus ? String(p.compteur.bonus) : "", pas: String(p.compteur?.pas ?? 1) });
    else setEdit({ ...VIDE, id: c.id, base: c.id, titre: c.titre, domaine: c.domaine });
  };
  const enregistrer = async () => {
    if (!edit) return;
    const avant = edit.base ? r.perso.find((x) => x.id === edit.base) : undefined;
    const p: ObjectifPerso = {
      id: edit.id ?? `p-${Date.now().toString(36)}`, domaine: edit.domaine, titre: edit.titre.trim(), detail: edit.detail.trim(),
      ...(edit.compteur ? { compteur: { unite: edit.unite.trim(), cible: Number(edit.cible), pas: Number(edit.pas) || 1, ...(edit.bonus ? { bonus: Number(edit.bonus) } : {}), ...(avant?.compteur?.exercices ? { exercices: avant.compteur.exercices } : {}) } } : {}),
    };
    if (edit.compteur && p.compteur?.bonus !== undefined && !(p.compteur.bonus > p.compteur.cible)) { notify("Le bonus doit être plus haut que l'objectif principal."); return; }
    const perso = r.perso.some((x) => x.id === p.id) ? r.perso.map((x) => (x.id === p.id ? p : x)) : [...r.perso, p];
    if (await set({ perso }, edit.base ? "Objectif modifié." : "Objectif ajouté.")) setEdit(null);
  };
  const retirer = (id: string, modele: boolean) => {
    if (!modele && !confirm("Supprimer cet objectif ?")) return;
    void set({ perso: r.perso.filter((x) => x.id !== id), toujours: modele ? r.toujours : r.toujours.filter((y) => y !== id) }, modele ? "Objectif d'origine rétabli." : "Objectif supprimé.");
  };

  const fixes = r.toujours.filter((id) => o.catalogue.some((c) => c.id === id && !r.masques.includes(id))).length;
  return (
    <div className="carte" data-testid="objectifs-reglages">
      <h2>Objectifs du jour</h2>
      <p className="aide">
        Les objectifs « tous les jours » sont toujours là ; les autres tournent d'un jour à l'autre, dans des domaines différents. Cible des objectifs mesurés :
        un peu au-dessus de ta moyenne des 7 derniers jours, plus douce après un échec. Les compteurs (pas, pompes…) ont un palier bonus plus dur ;
        les pompes et tractions de tes séances comptent toutes seules.
      </p>
      <div className="ligne">
        <label className="champ-ligne">Nombre par jour
          <select value={r.nombre} onChange={(e) => set({ nombre: Number(e.target.value) })} data-testid="objectifs-nombre">
            {Array.from({ length: NOMBRE_MAX }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <span className="aide">dont {fixes} tous les jours</span>
      </div>
      <div className="ligne" style={{ flexWrap: "wrap" }}>
        {DOMAINES.map((x) => (
          <label key={x} className="case">
            <input type="checkbox" checked={r.domaines.includes(x)} onChange={(e) => set({ domaines: e.target.checked ? [...r.domaines, x] : r.domaines.filter((y) => y !== x) })} />
            <span>{ICONES[x]} {NOMS_DOMAINES[x]}</span>
          </label>
        ))}
      </div>

      <table className="table-objectifs">
        <thead><tr><th>Objectif</th><th title="Présent tous les jours">Tous les jours</th><th title="Peut être proposé">Proposé</th><th /></tr></thead>
        <tbody>
          {o.catalogue.map((c) => {
            const masque = r.masques.includes(c.id);
            return (
              <tr key={c.id} className={masque ? "masque" : ""}>
                <td>{ICONES[c.domaine]} {c.titre} <span className="aide">· {c.type === "auto" ? "mesuré" : c.type === "compteur" ? "compteur" : "à cocher"}{c.perso && c.modele ? " · modifié" : ""}{!c.modele ? " · perso" : ""}</span></td>
                <td><input type="checkbox" aria-label={`${c.titre} tous les jours`} checked={r.toujours.includes(c.id)} disabled={masque} onChange={(e) => set({ toujours: basculer(r.toujours, c.id, e.target.checked) })} /></td>
                <td><input type="checkbox" aria-label={`${c.titre} proposé`} checked={!masque} onChange={(e) => set({ masques: basculer(r.masques, c.id, !e.target.checked) })} /></td>
                <td className="actions">
                  {c.type !== "auto" && <button className="lien" onClick={() => modifier(c.id)}>Modifier</button>}
                  {c.perso && <button className="lien danger" onClick={() => retirer(c.id, c.modele)}>{c.modele ? "Rétablir" : "Supprimer"}</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {edit ? (
        <div className="editeur" data-testid="editeur-objectif">
          <h3>{edit.base ? "Modifier l'objectif" : "Nouvel objectif"}</h3>
          <label className="champ-ligne">Titre<input style={{ width: 320 }} value={edit.titre} placeholder="Ex. Marcher 12 000 pas" onChange={(e) => setEdit({ ...edit, titre: e.target.value })} /></label>
          <label className="champ-ligne">Domaine
            <select value={edit.domaine} onChange={(e) => setEdit({ ...edit, domaine: e.target.value as Domaine })}>{DOMAINES.map((d) => <option key={d} value={d}>{NOMS_DOMAINES[d]}</option>)}</select>
          </label>
          <label className="champ-ligne">Précision<input style={{ width: 320 }} value={edit.detail} placeholder="Facultatif" onChange={(e) => setEdit({ ...edit, detail: e.target.value })} /></label>
          <div className="ligne">
            <label className="case"><input type="radio" name="type-obj" checked={!edit.compteur} onChange={() => setEdit({ ...edit, compteur: false })} /><span>À cocher</span></label>
            <label className="case"><input type="radio" name="type-obj" checked={edit.compteur} onChange={() => setEdit({ ...edit, compteur: true })} /><span>Compteur (avec + / −)</span></label>
          </div>
          {edit.compteur && (
            <div className="ligne" style={{ flexWrap: "wrap" }}>
              <label className="champ-ligne">Unité<input style={{ width: 90 }} value={edit.unite} placeholder="pas" onChange={(e) => setEdit({ ...edit, unite: e.target.value })} /></label>
              <label className="champ-ligne">Objectif<input inputMode="numeric" style={{ width: 90 }} value={edit.cible} onChange={(e) => setEdit({ ...edit, cible: e.target.value })} /></label>
              <label className="champ-ligne">Bonus<input inputMode="numeric" style={{ width: 90 }} value={edit.bonus} placeholder="facultatif" onChange={(e) => setEdit({ ...edit, bonus: e.target.value })} /></label>
              <label className="champ-ligne">Bouton +<input inputMode="numeric" style={{ width: 70 }} value={edit.pas} onChange={(e) => setEdit({ ...edit, pas: e.target.value })} /></label>
            </div>
          )}
          <div className="ligne">
            <button className="bouton" onClick={enregistrer} data-testid="enregistrer-objectif">Enregistrer</button>
            <button className="lien" onClick={() => setEdit(null)}>Annuler</button>
          </div>
        </div>
      ) : (
        <button className="bouton secondaire" onClick={() => setEdit({ ...VIDE })} data-testid="ajouter-objectif">Ajouter un objectif</button>
      )}

      <p className="aide">
        Sources : Révision {o.sources.revision ? "✓" : "— pas encore de révisions"} · Chrono {o.sources.chrono ? "✓" : "— pas trouvé"} · Rayan's Journal{" "}
        {o.sources.journal ? "✓" : "— résumé quotidien absent"}. Le nombre de pas n'est pas lu tout seul : reporte-le depuis l'app Santé. Notification le matin (dès 8 h)
        et le soir à l'heure du rappel s'il reste des objectifs.
      </p>
    </div>
  );
}
