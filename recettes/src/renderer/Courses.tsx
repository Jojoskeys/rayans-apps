import { useMemo, useState } from "react";
import { detailArticle, listeCourses, texteCourses, type Article } from "../core/courses.ts";
import { conseil, MAGASINS, magasinDe, parMagasin, texteParMagasin, a as chez } from "../core/magasins.ts";
import { dateDuJour, NOMS_JOURS, recettesDeLaSemaine, recettesDuJour } from "../core/plan.ts";
import type { Action, Recette } from "../core/types.ts";
import type { Etat } from "./api-types.ts";

/** D'où vient la liste : les recettes cochées, un jour du plan, ou toute la semaine du plan. */
export type Source = { type: "panier" } | { type: "jour"; jour: number } | { type: "semaine" };
const api = window.recettes;

export function Courses({ etat, toutes, panier, source, setSource, agir }: {
  etat: Etat; toutes: Recette[]; panier: Recette[]; source: Source; setSource: (s: Source) => void; agir: (a: Action) => void;
}) {
  const [mode, setMode] = useState<"rayon" | "magasin">("rayon");
  const [pris, setPris] = useState<Set<string>>(new Set());
  const [copie, setCopie] = useState(false);
  const plan = etat.donnees.plan;
  const choix = etat.donnees.magasins;
  const parId = useMemo(() => new Map(toutes.map((r) => [r.id, r])), [toutes]);

  const recettes: Recette[] =
    source.type === "panier" ? panier
      : !plan ? []
        : source.type === "jour" ? recettesDuJour(plan, parId, source.jour).map((x) => x.recette)
          : recettesDeLaSemaine(plan, parId);
  const groupes = useMemo(() => listeCourses(recettes), [recettes.map((r) => r.id).join("|")]);
  const magasins = useMemo(() => parMagasin(groupes, choix), [groupes, choix]);
  const titre =
    source.type === "panier" ? undefined
      : source.type === "jour" && plan ? `Liste de courses — ${NOMS_JOURS[source.jour]} ${dateDuJour(plan.debut, source.jour).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`
        : "Liste de courses — semaine du plan";

  const copier = async () => {
    const t = mode === "magasin" ? texteParMagasin(titre ?? `Liste de courses — ${[...new Set(recettes.map((r) => r.titre))].join(", ")}`, magasins) : texteCourses(groupes, recettes, titre);
    await api.copier(t);
    setCopie(true);
    setTimeout(() => setCopie(false), 1800);
  };
  const changer = (s: Source) => { setSource(s); setPris(new Set()); };
  const ligne = (a: Article) => <LigneArticle key={a.cle} a={a} pris={pris.has(a.cle)} magasin={magasinDe(a.cle, choix)} montrerMagasin={mode === "rayon"}
    basculer={() => { const p = new Set(pris); if (p.has(a.cle)) p.delete(a.cle); else p.add(a.cle); setPris(p); }}
    choisir={(m) => agir({ type: "magasin", cle: a.cle, magasin: m })} />;

  return (
    <div className="courses">
      <div className="entete">
        <h1>Liste de courses</h1>
        <div className="actions">
          {recettes.length > 0 && <button className="bouton" onClick={copier}>{copie ? "Copié ✓" : "Copier la liste"}</button>}
          {source.type === "panier" && panier.length > 0 && <button className="bouton secondaire" onClick={() => agir({ type: "viderPanier" })}>Tout décocher</button>}
        </div>
      </div>
      <div className="barre-outils">
        <div className="segmente">
          <button className={source.type === "panier" ? "actif" : ""} onClick={() => changer({ type: "panier" })}>Recettes cochées</button>
          <button className={source.type === "jour" ? "actif" : ""} data-testid="courses-jour" onClick={() => changer({ type: "jour", jour: source.type === "jour" ? source.jour : 0 })}>Un jour du plan</button>
          <button className={source.type === "semaine" ? "actif" : ""} data-testid="courses-semaine" onClick={() => changer({ type: "semaine" })}>Semaine du plan</button>
        </div>
        {source.type === "jour" && plan && (
          <select value={source.jour} onChange={(e) => changer({ type: "jour", jour: Number(e.target.value) })}>
            {NOMS_JOURS.map((j, n) => <option key={j} value={n}>{j} {dateDuJour(plan.debut, n).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</option>)}
          </select>
        )}
        <div className="segmente">
          <button className={mode === "rayon" ? "actif" : ""} onClick={() => setMode("rayon")}>Par rayon</button>
          <button className={mode === "magasin" ? "actif" : ""} data-testid="par-magasin" onClick={() => setMode("magasin")}>Par magasin</button>
        </div>
      </div>
      {source.type === "panier" && panier.length > 0 && (
        <div className="puces">
          {panier.map((r) => (
            <span key={r.id} className="puce actif">{r.titre}<button title="Retirer" onClick={() => agir({ type: "panier", id: r.id, dedans: false })}>×</button></span>
          ))}
        </div>
      )}
      {recettes.length === 0 ? (
        <p className="vide">{source.type === "panier" ? "Cochez des recettes dans la liste pour préparer les courses." : !plan ? "Pas encore de plan : créez-le dans « Mon plan »." : "Rien de prévu (cases libres)."}</p>
      ) : (
        <>
          <div className="rayons" data-testid="liste-courses">
            {mode === "rayon"
              ? groupes.map((g) => <section key={g.rayon} className="carte"><h3>{g.rayon}</h3><ul>{g.articles.map(ligne)}</ul></section>)
              : magasins.map((g) => <section key={g.magasin} className="carte"><h3>{chez(g.magasin)}</h3><ul>{g.articles.map(ligne)}</ul></section>)}
          </div>
          <p className="aide">
            Magasins conseillés : des habitudes générales en France pour payer moins cher, pas des prix. Les prix et les promotions
            varient selon la ville et la semaine. Vous pouvez changer le magasin d'un produit : le choix est gardé.
          </p>
        </>
      )}
    </div>
  );
}

function LigneArticle({ a, pris, magasin, montrerMagasin, basculer, choisir }: {
  a: Article; pris: boolean; magasin: string; montrerMagasin: boolean; basculer: () => void; choisir: (m: string | null) => void;
}) {
  const c = conseil(a.cle);
  const detail = detailArticle(a);
  const options = [...new Set([...c.magasins, ...MAGASINS, magasin])];
  return (
    <li className={pris ? "pris" : ""}>
      <label>
        <input type="checkbox" checked={pris} onChange={basculer} />
        <span>
          <b>{a.nom}</b>
          {detail && <small>{detail}</small>}
          <small className="conseil" title={c.note}>
            {montrerMagasin ? `${chez(magasin)} · ` : ""}conseillé : {c.magasins.join(", ")}
          </small>
        </span>
      </label>
      <select className="choix-magasin" value={magasin} title={c.note}
        onChange={(e) => choisir(e.target.value === c.magasins[0] ? null : e.target.value)}>
        {options.map((m) => <option key={m} value={m}>{m}{c.magasins.includes(m) ? " (conseillé)" : ""}</option>)}
      </select>
    </li>
  );
}
