// Rayan's Courses sur l'iPhone : liste de courses rangée par rayon, synchronisée (chiffrée) entre appareils
// par le dépôt privé, comme les autres apps. Dictée possible : une virgule ou une ligne par article.
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { store } from "../shared/sync.ts";
import { mountChrome } from "../shared/chrome.ts";
import { ajouterPlusieurs, AUTRE_RAYON, changerRayon, cocherArticle, COURSES_VIDES, nettoyerCourses, parRayon, RAYONS, retirerArticle, retirerFaits, type CoursesData } from "../shared/petites.ts";
import "./telecommande.css";
import "./petites.css";

const FICHIER = "courses";
const nouvelId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function App() {
  const [d, setD] = useState<CoursesData | null>(null);
  const [texte, setTexte] = useState("");
  const [rayonOuvert, setRayonOuvert] = useState<string | null>(null);
  useEffect(() => {
    void store.load(FICHIER).then((t) => { try { setD(nettoyerCourses(t ? JSON.parse(t) : null)); } catch { setD(COURSES_VIDES); } });
  }, []);
  if (!d) return <div className="tc"><h1>Courses</h1><section className="carte"><p>Chargement…</p></section></div>;
  const changer = (n: CoursesData) => { setD(n); store.save(FICHIER, JSON.stringify(n)); };
  const ajouter = () => { if (texte.trim()) { changer(ajouterPlusieurs(d, texte, Date.now(), nouvelId)); setTexte(""); } };
  const { aAcheter, faits } = parRayon(d);
  const reste = aAcheter.reduce((n, g) => n + g.articles.length, 0);
  return (
    <div className="tc">
      <div className="titre-carte"><h1>Courses</h1>{reste > 0 && <span className="puce">{reste} à acheter</span>}</div>
      <section className="carte">
        <form className="ligne" onSubmit={(e) => { e.preventDefault(); ajouter(); }}>
          <input id="c-ajout" value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="lait, riz, 2 avocats…" enterKeyHint="done" autoComplete="off" />
          <button className="bouton" type="submit" disabled={!texte.trim()}>Ajouter</button>
        </form>
        <p className="petit">Plusieurs d'un coup : sépare par des virgules (ou dicte avec le micro du clavier).</p>
      </section>

      {aAcheter.length === 0 && <section className="carte"><p className="centre">Rien à acheter.</p></section>}
      {aAcheter.length > 0 && (
        <section className="carte">
          {aAcheter.map((g) => (
            <div key={g.rayon}>
              <p className="rayon">{g.rayon}</p>
              <ul className="liste">{g.articles.map((a) => (
                <li key={a.id}>
                  <button className="coche" onClick={() => changer(cocherArticle(d, a.id, Date.now()))}><span className="case" /><span className="nom">{a.nom}</span></button>
                  <button className="lien" aria-label="Changer de rayon" onClick={() => setRayonOuvert(rayonOuvert === a.id ? null : a.id)}>⋯</button>
                </li>
              ))}</ul>
              {g.articles.some((a) => a.id === rayonOuvert) && (
                <div className="filtres" style={{ marginTop: 8 }}>
                  {[...RAYONS.map((r) => r.nom), AUTRE_RAYON].map((r) => (
                    <button key={r} className={g.rayon === r ? "actif" : ""} onClick={() => { changer(changerRayon(d, rayonOuvert!, r, Date.now())); setRayonOuvert(null); }}>{r}</button>
                  ))}
                  <button onClick={() => { changer(retirerArticle(d, rayonOuvert!)); setRayonOuvert(null); }}>Retirer</button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {faits.length > 0 && (
        <section className="carte">
          <div className="titre-carte"><h2>Dans le panier</h2><button className="lien danger" onClick={() => changer(retirerFaits(d))}>Vider</button></div>
          <ul className="liste">{faits.map((a) => (
            <li key={a.id}><button className="coche fait" onClick={() => changer(cocherArticle(d, a.id, Date.now()))}><span className="case">✓</span><span className="nom">{a.nom}</span></button></li>
          ))}</ul>
        </section>
      )}
    </div>
  );
}

mountChrome([FICHIER]);
createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
