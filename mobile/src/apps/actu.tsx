// « Ton monde ce matin » sur l'iPhone : la revue de l'actualité préparée chaque matin par le veilleur en ligne
// (fichier « actu », chiffré dans le dépôt privé comme le reste). Lecture seule : rien n'est renvoyé.
// Seulement des résumés courts et les liens : l'article se lit sur le site du média.
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { store } from "../shared/sync.ts";
import { mountChrome } from "../shared/chrome.ts";
import { ACTU_VIDE, nettoyerActu, type ActuData } from "../shared/actu.ts";
import "./telecommande.css";
import "./petites.css";

const FICHIER = "actu";
const jourLisible = (jour: string) => new Date(`${jour}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function App() {
  const [d, setD] = useState<ActuData | null>(null);
  const [choisi, setChoisi] = useState(0);
  useEffect(() => {
    void store.load(FICHIER).then((t) => { try { setD(nettoyerActu(t ? JSON.parse(t) : null)); } catch { setD(ACTU_VIDE); } });
  }, []);
  if (!d) return <div className="tc"><h1>Ton monde</h1><section className="carte"><p>Chargement…</p></section></div>;
  const e = d.editions[choisi];
  return (
    <div className="tc">
      <div className="titre-carte"><h1>Ton monde</h1>{e && <span className="puce">{jourLisible(e.jour)}</span>}</div>
      {!e && <section className="carte"><p className="centre">Pas encore d'édition. Elle arrive chaque matin vers 6 h 45 avec la notification « Ton monde ce matin ».</p></section>}
      {d.editions.length > 1 && (
        <div className="filtres">
          {d.editions.map((x, i) => <button key={x.jour} className={i === choisi ? "actif" : ""} onClick={() => setChoisi(i)}>{new Date(`${x.jour}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })}</button>)}
        </div>
      )}
      {e?.sujets.map((s, i) => (
        <section className="carte" key={i}>
          <div className="titre-carte"><h2>{s.titre}</h2>{s.uneSource && <span className="puce">une seule source</span>}</div>
          {s.resume && <p>{s.resume}</p>}
          <ul className="liste">{s.sources.map((x) => (
            <li key={x.lien}><a className="lien" style={{ whiteSpace: "normal", padding: 0, textDecoration: "none" }} href={x.lien} target="_blank" rel="noopener noreferrer"><b>{x.media}</b> · {x.titre}</a></li>
          ))}</ul>
        </section>
      ))}
      {e && <p className="petit centre">{e.mode === "claude" ? "Sujets choisis et résumés par Claude à partir des titres des médias. Lis l'article complet sur le site du média." : "Édition simple : titres regroupés automatiquement. Lis l'article sur le site du média."}</p>}
    </div>
  );
}

mountChrome([FICHIER]);
createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
