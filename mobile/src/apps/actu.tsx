// « Ton monde ce matin » sur l'iPhone : la revue de l'actualité préparée chaque matin par le veilleur en ligne
// (fichier « actu », chiffré dans le dépôt privé comme le reste). Lecture seule : rien n'est renvoyé.
// Mise en page de magazine : sommaire collant, « L'essentiel » en grandes cartes, puis une rubrique par thème.
// Seulement des résumés courts et les liens : l'article se lit sur le site du média.
// « ?demo » : affiche demo.json posé à côté de la page (essais en local seulement, jamais publié).
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { store } from "../shared/sync.ts";
import { mountChrome } from "../shared/chrome.ts";
import { ACTU_VIDE, nettoyerActu, parRubrique, tempsLecture, type ActuData, type SujetActu } from "../shared/actu.ts";
import "./telecommande.css";
import "./petites.css";
import "./actu.css";

const FICHIER = "actu";
const jourLisible = (jour: string) => new Date(`${jour}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const jourCourt = (jour: string) => new Date(`${jour}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
const DEMO = new URLSearchParams(location.search).has("demo");

/** Image du média : cachée si elle ne se charge pas. */
function Image({ src, lien, className }: { src?: string; lien: string; className: string }) {
  const [ko, setKo] = useState(false);
  if (!src || ko) return null;
  return <a className={className} href={lien} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true"><img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setKo(true)} /></a>;
}

function Sources({ s }: { s: SujetActu }) {
  return (
    <div className="a-sources">
      {s.sources.map((x) => {
        // Plusieurs liens du même média (avis du CERT-FR) : numérotés.
        const memes = s.sources.filter((y) => y.media === x.media);
        return <a key={x.lien} className="a-media" href={x.lien} target="_blank" rel="noopener noreferrer" title={x.titre}>{memes.length > 1 ? `${x.media} ${memes.indexOf(x) + 1}` : x.media}</a>;
      })}
      {s.uneSource && <span className="a-seule">une seule source</span>}
    </div>
  );
}

function Corps({ s }: { s: SujetActu }) {
  return <>
    {s.resume && <p className="a-resume">{s.resume}</p>}
    {s.pourquoi && <p className="a-pourquoi"><b>Pourquoi c'est important</b>{s.pourquoi}</p>}
    <Sources s={s} />
  </>;
}

function Une({ s, n }: { s: SujetActu; n: number }) {
  const lien = s.sources[0].lien;
  return (
    <article className="a-une">
      <Image src={s.image} lien={lien} className="a-img" />
      <div className="a-une-corps">
        <span className="a-num">{String(n).padStart(2, "0")}</span>
        <h3><a href={lien} target="_blank" rel="noopener noreferrer">{s.titre}</a></h3>
        <Corps s={s} />
      </div>
    </article>
  );
}

function Carte({ s }: { s: SujetActu }) {
  const lien = s.sources[0].lien;
  return (
    <article className="a-carte">
      <div className="a-haut">
        <h3><a href={lien} target="_blank" rel="noopener noreferrer">{s.titre}</a></h3>
        <Image src={s.image} lien={lien} className="a-mini" />
      </div>
      <Corps s={s} />
    </article>
  );
}

function App() {
  const [d, setD] = useState<ActuData | null>(null);
  const [choisi, setChoisi] = useState(0);
  const [actif, setActif] = useState("");
  useEffect(() => {
    const lire = DEMO ? fetch("demo.json").then((r) => (r.ok ? r.text() : null)).catch(() => null) : store.load(FICHIER);
    void lire.then((t) => { try { setD(nettoyerActu(t ? JSON.parse(t) : null)); } catch { setD(ACTU_VIDE); } });
  }, []);
  const e = d?.editions[choisi];
  const rubriques = e ? parRubrique(e) : [];
  // Rubrique en cours de lecture : surlignée dans le sommaire.
  useEffect(() => {
    const suivre = () => {
      let id = rubriques[0]?.id ?? "";
      for (const r of rubriques) { const el = document.getElementById(`r-${r.id}`); if (el && el.getBoundingClientRect().top < 140) id = r.id; }
      // Tout en bas de la page : la dernière rubrique, même si son titre n'atteint pas le haut de l'écran.
      if (rubriques.length && innerHeight + scrollY >= document.documentElement.scrollHeight - 4) id = rubriques[rubriques.length - 1].id;
      setActif(id);
    };
    suivre();
    addEventListener("scroll", suivre, { passive: true });
    return () => removeEventListener("scroll", suivre);
  }, [e]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d) return <div className="tc actu"><h1 className="a-titre">Ton monde</h1><section className="carte"><p>Chargement…</p></section></div>;
  return (
    <div className="tc actu">
      <header className="a-tete">
        <p className="a-sur">La revue du matin</p>
        <h1 className="a-titre">Ton monde{e && <span> · {jourLisible(e.jour)}</span>}</h1>
        {e && <p className="a-meta">{e.sujets.length} sujets · {tempsLecture(e)} min de lecture</p>}
        {d.editions.length > 1 && (
          <div className="filtres a-jours">
            {d.editions.map((x, i) => <button key={x.jour} className={i === choisi ? "actif" : ""} onClick={() => { setChoisi(i); scrollTo({ top: 0 }); }}>{jourCourt(x.jour)}</button>)}
          </div>
        )}
      </header>
      {!e && <section className="carte"><p className="centre">Pas encore d'édition. Elle arrive chaque matin vers 6 h 40 avec la notification « Ton monde ce matin ».</p></section>}
      {rubriques.length > 1 && (
        <nav className="a-sommaire" aria-label="Rubriques">
          {rubriques.map((r) => (
            <button key={r.id} className={`rub-${r.id}${actif === r.id ? " actif" : ""}`} onClick={() => document.getElementById(`r-${r.id}`)?.scrollIntoView({ behavior: "smooth" })}>{r.court}</button>
          ))}
        </nav>
      )}
      {e && rubriques.map((r) => (
        <section key={r.id} id={`r-${r.id}`} className={`a-rubrique rub-${r.id}`}>
          <h2 className="a-rub-titre"><span>{r.nom}</span><small>{r.sujets.length}</small></h2>
          {r.id === "essentiel" && e.intro && <p className="a-intro">{e.intro}</p>}
          {r.id === "essentiel" ? r.sujets.map((s, i) => <Une key={i} s={s} n={i + 1} />)
            : r.id === "bref" ? (
              <ul className="a-bref">{r.sujets.map((s, i) => (
                <li key={i}><a href={s.sources[0].lien} target="_blank" rel="noopener noreferrer">{s.titre}</a><span>{s.sources.map((x) => x.media).filter((m, j, t) => t.indexOf(m) === j).join(" · ")}</span></li>
              ))}</ul>
            ) : r.sujets.map((s, i) => <Carte key={i} s={s} />)}
        </section>
      ))}
      {e && <p className="petit centre a-pied">{e.mode === "claude" ? "Sujets choisis et résumés par Claude à partir des titres et chapôs des médias, sans rien ajouter. Lis l'article complet sur le site du média." : "Édition gratuite : sujets regroupés automatiquement, avec le début du texte de présentation du média. Lis l'article complet sur son site."}</p>}
    </div>
  );
}

mountChrome([FICHIER]);
createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
