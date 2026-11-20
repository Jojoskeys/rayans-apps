import { useEffect, useMemo, useState } from "react";
import { detailArticle, listeCourses, texteCourses } from "../core/courses.ts";
import { dateCourte } from "../core/donnees.ts";
import { correspond, etiquettes, NOMS_ETIQUETTES, remarques } from "../core/lecture.ts";
import type { Action, Etiquettes, Recette } from "../core/types.ts";
import type { Etat } from "./api-types.ts";

type Vue = "recettes" | "courses" | "ajouter";
type Filtre = "tout" | keyof Etiquettes;
const api = window.recettes;

export function App() {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [vue, setVue] = useState<Vue>("recettes");
  const [choisie, setChoisie] = useState<string | null>(null);

  useEffect(() => {
    api.getState().then(setEtat);
    return api.onChange(() => api.getState().then(setEtat));
  }, []);

  if (!etat) return <div className="chargement">Chargement…</div>;
  const toutes = [...etat.donnees.perso, ...etat.recettes];
  const agir = async (a: Action) => setEtat(await api.dispatch(a));
  const panier = toutes.filter((r) => etat.donnees.panier.includes(r.id));

  return (
    <div className="app">
      <nav className="navigation-principale">
        <div className="marque"><span className="logo" aria-hidden>🌸</span>Rayan's Recettes</div>
        <button className={vue === "recettes" ? "actif" : ""} data-testid="nav-recettes" onClick={() => setVue("recettes")}>
          Recettes <span className="compte">{toutes.length}</span>
        </button>
        <button className={vue === "courses" ? "actif" : ""} data-testid="nav-courses" onClick={() => setVue("courses")}>
          Liste de courses {panier.length > 0 && <span className="compte plein">{panier.length}</span>}
        </button>
        <button className={vue === "ajouter" ? "actif" : ""} data-testid="nav-ajouter" onClick={() => setVue("ajouter")}>
          Ajouter une recette
        </button>
        <div className="pied">
          {!etat.trouve && <p className="aide">Dossier de Rayan's Favoris introuvable. Les recettes ajoutées à la main restent disponibles.</p>}
          {etat.illisibles.length > 0 && <p className="aide">{etat.illisibles.length} fiche(s) illisible(s) sautée(s).</p>}
          <button className="lien" onClick={async () => setEtat(await api.actualiser())}>↻ Relire les recettes</button>
          <button className="lien" onClick={() => api.ouvrirDossier()}>Ouvrir le dossier des favoris</button>
          <small>Version {etat.version}</small>
        </div>
      </nav>
      <main className="contenu">
        {etat.warning && <p className="bandeau">{etat.warning}</p>}
        {vue === "recettes" && <Recettes etat={etat} toutes={toutes} choisie={choisie} setChoisie={setChoisie} agir={agir} />}
        {vue === "courses" && <Courses panier={panier} agir={agir} />}
        {vue === "ajouter" && <Ajouter onAjout={async (r) => { await agir({ type: "ajouterPerso", recette: r }); setChoisie(r.id); setVue("recettes"); }} />}
      </main>
    </div>
  );
}

// ----- Liste et détail ---------------------------------------------------------------------------

function Recettes({ etat, toutes, choisie, setChoisie, agir }: {
  etat: Etat; toutes: Recette[]; choisie: string | null; setChoisie: (id: string) => void; agir: (a: Action) => void;
}) {
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tout");
  const [favorisSeuls, setFavorisSeuls] = useState(false);
  const d = etat.donnees;
  const tags = useMemo(() => new Map(toutes.map((r) => [r.id, etiquettes(r)])), [toutes]);
  const visibles = toutes.filter((r) =>
    correspond(r, recherche) && (filtre === "tout" || tags.get(r.id)![filtre]) && (!favorisSeuls || d.favoris.includes(r.id)));
  const actuelle = visibles.find((r) => r.id === choisie) ?? visibles[0] ?? null;

  return (
    <div className="grille">
      <section className="colonne-liste">
        <input type="search" placeholder="Chercher une recette, un ingrédient…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        <div className="puces">
          {(["tout", "proteines", "rapide", "collation", "repas"] as Filtre[]).map((f) => (
            <button key={f} className={`puce ${filtre === f ? "actif" : ""}`} onClick={() => setFiltre(f)}>
              {f === "tout" ? "Tout" : NOMS_ETIQUETTES[f]}
            </button>
          ))}
          <button className={`puce ${favorisSeuls ? "actif" : ""}`} onClick={() => setFavorisSeuls(!favorisSeuls)}>★ Favoris</button>
        </div>
        {visibles.length === 0 && <p className="vide">{toutes.length ? "Aucune recette ne correspond." : "Aucune recette pour l'instant. Rayan's Favoris les ajoute quand il trouve une vidéo de recette."}</p>}
        <ul className="liste">
          {visibles.map((r) => {
            const t = tags.get(r.id)!;
            const faites = d.faites[r.id]?.length ?? 0;
            return (
              <li key={r.id} data-testid="carte-recette" className={`carte-recette ${actuelle?.id === r.id ? "choisie" : ""}`} onClick={() => setChoisie(r.id)}>
                <input type="checkbox" title="Ajouter à la liste de courses" data-testid="panier" checked={d.panier.includes(r.id)}
                  onClick={(e) => e.stopPropagation()} onChange={(e) => agir({ type: "panier", id: r.id, dedans: e.target.checked })} />
                <div className="carte-texte">
                  <div className="carte-titre">{d.favoris.includes(r.id) && <span className="etoile">★</span>}{r.titre}</div>
                  <div className="mini-tags">
                    {(Object.keys(NOMS_ETIQUETTES) as (keyof Etiquettes)[]).filter((k) => t[k]).map((k) => <span key={k}>{NOMS_ETIQUETTES[k]}</span>)}
                    {r.origine === "perso" && <span className="perso">Ajoutée à la main</span>}
                    {faites > 0 && <span className="faite">Faite ×{faites}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="colonne-detail">
        {actuelle ? <Detail r={actuelle} etat={etat} tags={tags.get(actuelle.id)!} agir={agir} /> : <p className="vide">Choisissez une recette.</p>}
      </section>
    </div>
  );
}

function Detail({ r, etat, tags, agir }: { r: Recette; etat: Etat; tags: Etiquettes; agir: (a: Action) => void }) {
  const d = etat.donnees;
  const favori = d.favoris.includes(r.id);
  const dates = d.faites[r.id] ?? [];
  const rq = remarques(r);
  return (
    <article className="carte detail">
      <header>
        <h1>{r.titre}</h1>
        <div className="mini-tags">
          {(Object.keys(NOMS_ETIQUETTES) as (keyof Etiquettes)[]).filter((k) => tags[k]).map((k) => <span key={k}>{NOMS_ETIQUETTES[k]}</span>)}
          {r.portions && <span className="neutre">{r.portions}</span>}
        </div>
      </header>
      <div className="actions">
        <button className={`bouton secondaire ${favori ? "favori" : ""}`} onClick={() => agir({ type: "favori", id: r.id })}>{favori ? "★ En favori" : "☆ Favori"}</button>
        <button className="bouton" data-testid="faite" onClick={() => agir({ type: "faite", id: r.id, at: Date.now() })}>✓ Je l'ai faite</button>
        <label className="bouton secondaire">
          <input type="checkbox" checked={d.panier.includes(r.id)} onChange={(e) => agir({ type: "panier", id: r.id, dedans: e.target.checked })} /> Liste de courses
        </label>
        {r.lien && <button className="bouton secondaire" onClick={() => api.ouvrirLien(r.lien!)}>▶ Voir la vidéo</button>}
        {r.origine === "perso" && <button className="lien danger" onClick={() => { if (confirm(`Supprimer « ${r.titre} » ?`)) agir({ type: "supprimerPerso", id: r.id }); }}>Supprimer</button>}
      </div>
      {dates.length > 0 && (
        <p className="faites">
          Faite {dates.length} fois :{" "}
          {dates.slice().reverse().map((t) => (
            <span key={t} className="date">{dateCourte(t)}<button title="Retirer cette date" onClick={() => agir({ type: "annulerFaite", id: r.id, at: t })}>×</button></span>
          ))}
        </p>
      )}
      <div className="remarques" data-testid="remarques">
        <div className="remarque halal">
          <h3>Halal</h3>
          {rq.halal.map((p) => <p key={p}>{p}</p>)}
          {rq.aVerifier.map((i) => <p key={i} className="alerte">À vérifier : {i}</p>)}
          {!rq.halal.length && !rq.aVerifier.length && <p className="discret">Rien de signalé. Vérifie quand même la viande et les produits transformés.</p>}
        </div>
        <div className="remarque seche">
          <h3>Sèche et sport</h3>
          {rq.seche.map((p) => <p key={p}>{p}</p>)}
          {!rq.seche.length && <p className="discret">Pas de remarque dans la fiche.</p>}
        </div>
      </div>
      <div className="deux-colonnes">
        <div>
          <h2>Ingrédients</h2>
          <ul className="ingredients">{r.ingredients.map((i, n) => <li key={n}>{i}</li>)}</ul>
        </div>
        <div>
          <h2>Étapes</h2>
          {r.etapes.length ? <ol className="etapes">{r.etapes.map((e, n) => <li key={n}>{e}</li>)}</ol> : <p className="discret">Pas d'étapes notées.</p>}
        </div>
      </div>
      {r.resume && <p className="resume"><b>La vidéo :</b> {r.resume}</p>}
    </article>
  );
}

// ----- Liste de courses ----------------------------------------------------------------------------

function Courses({ panier, agir }: { panier: Recette[]; agir: (a: Action) => void }) {
  const [pris, setPris] = useState<Set<string>>(new Set());
  const [copie, setCopie] = useState(false);
  const groupes = useMemo(() => listeCourses(panier), [panier]);
  if (!panier.length) return <p className="vide">Cochez des recettes dans la liste pour préparer les courses.</p>;
  const copier = async () => {
    await api.copier(texteCourses(groupes, panier));
    setCopie(true);
    setTimeout(() => setCopie(false), 1800);
  };
  return (
    <div className="courses">
      <div className="entete">
        <h1>Liste de courses</h1>
        <div className="actions">
          <button className="bouton" onClick={copier}>{copie ? "Copié ✓" : "Copier la liste"}</button>
          <button className="bouton secondaire" onClick={() => agir({ type: "viderPanier" })}>Tout décocher</button>
        </div>
      </div>
      <div className="puces">
        {panier.map((r) => (
          <span key={r.id} className="puce actif">{r.titre}<button title="Retirer" onClick={() => agir({ type: "panier", id: r.id, dedans: false })}>×</button></span>
        ))}
      </div>
      <div className="rayons" data-testid="liste-courses">
        {groupes.map((g) => (
          <section key={g.rayon} className="carte">
            <h3>{g.rayon}</h3>
            <ul>
              {g.articles.map((a) => {
                const detail = detailArticle(a);
                return (
                  <li key={a.cle} className={pris.has(a.cle) ? "pris" : ""}>
                    <label>
                      <input type="checkbox" checked={pris.has(a.cle)} onChange={() => {
                        const p = new Set(pris);
                        if (p.has(a.cle)) p.delete(a.cle); else p.add(a.cle);
                        setPris(p);
                      }} />
                      <span><b>{a.nom}</b>{detail && <small>{detail}</small>}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

// ----- Ajouter une recette ---------------------------------------------------------------------------

function Ajouter({ onAjout }: { onAjout: (r: Recette) => void }) {
  const [f, setF] = useState({ titre: "", lien: "", portions: "", ingredients: "", etapes: "", remarques: "" });
  const champ = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) });
  const lignes = (s: string) => s.split("\n").map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean);
  const ok = f.titre.trim() && lignes(f.ingredients).length;
  return (
    <form className="carte formulaire" onSubmit={(e) => {
      e.preventDefault();
      if (!ok) return;
      onAjout({
        id: `perso-${crypto.randomUUID()}`, titre: f.titre.trim(), portions: f.portions.trim() || undefined,
        ingredients: lignes(f.ingredients), etapes: lignes(f.etapes), lien: f.lien.trim() || undefined,
        pourRayan: f.remarques.trim() || undefined, origine: "perso",
      });
    }}>
      <h1>Ajouter une recette</h1>
      <label>Nom<input {...champ("titre")} placeholder="Ex. Bowl poulet riz" required /></label>
      <div className="deux-colonnes">
        <label>Lien de la vidéo (facultatif)<input {...champ("lien")} placeholder="https://…" /></label>
        <label>Portions (facultatif)<input {...champ("portions")} placeholder="Ex. 2 personnes" /></label>
      </div>
      <div className="deux-colonnes">
        <label>Ingrédients (un par ligne)<textarea rows={8} {...champ("ingredients")} placeholder={"150 g de poulet halal\n80 g de riz"} /></label>
        <label>Étapes (une par ligne)<textarea rows={8} {...champ("etapes")} placeholder={"Cuire le riz\nGriller le poulet"} /></label>
      </div>
      <label>Remarques (halal, sèche…)<textarea rows={3} {...champ("remarques")} /></label>
      <div><button className="bouton" type="submit" disabled={!ok}>Ajouter</button></div>
    </form>
  );
}
