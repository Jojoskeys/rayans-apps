// Rayan's Mémo sur l'iPhone : noter une idée en deux secondes (au clavier ou en dictée avec le micro du clavier),
// la retrouver par recherche ou par mot-dièse (#fac, #sport…). Synchronisé (chiffré) comme les autres apps.
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { store } from "../shared/sync.ts";
import { mountChrome } from "../shared/chrome.ts";
import { quand } from "../shared/pc.ts";
import { ajouterMemo, chercherMemos, epinglerMemo, MEMOS_VIDES, modifierMemo, nettoyerMemos, supprimerMemo, tagsFrequents, type MemosData } from "../shared/petites.ts";
import "./telecommande.css";
import "./petites.css";

const FICHIER = "memos";
const nouvelId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function App() {
  const [d, setD] = useState<MemosData | null>(null);
  const [texte, setTexte] = useState("");
  const [q, setQ] = useState("");
  const [edition, setEdition] = useState<{ id: string; texte: string } | null>(null);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  useEffect(() => {
    void store.load(FICHIER).then((t) => { try { setD(nettoyerMemos(t ? JSON.parse(t) : null)); } catch { setD(MEMOS_VIDES); } });
  }, []);
  if (!d) return <div className="tc"><h1>Mémo</h1><section className="carte"><p>Chargement…</p></section></div>;
  const changer = (n: MemosData) => { setD(n); store.save(FICHIER, JSON.stringify(n)); };
  const liste = chercherMemos(d, q);
  const tags = tagsFrequents(d);
  return (
    <div className="tc">
      <h1>Mémo</h1>
      <section className="carte">
        <textarea id="m-texte" rows={3} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={"Une idée, une chose à retenir…\nAjoute #fac ou #sport pour ranger"} />
        <button className="bouton" disabled={!texte.trim()} onClick={() => { changer(ajouterMemo(d, texte, Date.now(), nouvelId())); setTexte(""); }}>Noter</button>
        <p className="petit">Pour parler au lieu d'écrire : touche le micro du clavier.</p>
      </section>

      <section className="carte">
        <input id="m-recherche" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher dans mes mémos" />
        {tags.length > 0 && (
          <div className="filtres">{tags.map((t) => (
            <button key={t} className={q === `#${t}` ? "actif" : ""} onClick={() => setQ(q === `#${t}` ? "" : `#${t}`)}>#{t}</button>
          ))}</div>
        )}
        {liste.length === 0 ? <p className="centre">{d.memos.length ? "Aucun mémo ne correspond." : "Pas encore de mémo."}</p> : liste.map((m) => (
          <div key={m.id} className="fiche">
            {edition?.id === m.id ? (
              <>
                <textarea rows={4} value={edition.texte} onChange={(e) => setEdition({ id: m.id, texte: e.target.value })} />
                <div className="ligne">
                  <button className="bouton" disabled={!edition.texte.trim()} onClick={() => { changer(modifierMemo(d, m.id, edition.texte, Date.now())); setEdition(null); }}>Enregistrer</button>
                  <button className="bouton secondaire" onClick={() => setEdition(null)}>Annuler</button>
                </div>
              </>
            ) : <p className="memo" onClick={() => setEdition({ id: m.id, texte: m.texte })}>{m.texte}</p>}
            <div className="memo-pied">
              <span className="petit">{m.epingle ? "📌 " : ""}{quand(m.cree)}</span>
              <span>
                <button className="lien" onClick={() => changer(epinglerMemo(d, m.id, Date.now()))}>{m.epingle ? "Désépingler" : "Épingler"}</button>
                {aSupprimer === m.id
                  ? <button className="lien danger" onClick={() => { changer(supprimerMemo(d, m.id)); setASupprimer(null); }}>Confirmer</button>
                  : <button className="lien danger" onClick={() => setASupprimer(m.id)}>Supprimer</button>}
              </span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

mountChrome([FICHIER]);
createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
