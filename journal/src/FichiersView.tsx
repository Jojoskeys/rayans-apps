import { useEffect, useState } from "react";
import { api, texteErreur, type HistoriqueFichier } from "./api";
import { ACTIONS, debutJour, local } from "./format";

const GENRES: Record<string, string> = {
  "": "Tous",
  telecharge: "Téléchargés",
  renomme: "Renommés ou déplacés",
  supprime: "Supprimés",
};

export function FichiersView() {
  const [mots, setMots] = useState("");
  const [genre, setGenre] = useState("");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [liste, setListe] = useState<HistoriqueFichier[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(async () => {
      try {
        const d = debutJour(du) ?? Date.now() - 365 * 86_400_000;
        const a = debutJour(au);
        setListe(await api.fichiers(mots, genre, d, a !== null ? a + 86_400_000 : Date.now() + 60_000));
        setErreur(null);
      } catch (e) {
        setErreur(texteErreur(e));
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [mots, genre, du, au]);

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Retrouver un fichier</h1>
          <p className="muted">
            Chaque fichier des dossiers suivis, avec tout son parcours : téléchargement, renommages, déplacements, suppression. On le retrouve par n’importe
            lequel des noms qu’il a portés.
          </p>
        </div>
      </header>
      <div className="row wrap">
        {Object.entries(GENRES).map(([k, l]) => (
          <button key={k} className={"btn small" + (genre === k ? " primary" : " ghost")} onClick={() => setGenre(k)}>{l}</button>
        ))}
      </div>
      <div className="filters">
        <label className="field large">
          <span className="field-label">Nom (actuel ou ancien), dossier</span>
          <input value={mots} onChange={(e) => setMots(e.target.value)} placeholder="ex. facture pdf" autoFocus />
        </label>
        <label className="field">
          <span className="field-label">Du</span>
          <input type="date" value={du} onChange={(e) => setDu(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Au (inclus)</span>
          <input type="date" value={au} onChange={(e) => setAu(e.target.value)} />
        </label>
      </div>
      {erreur && <div className="alert bad">{erreur}</div>}
      {liste.length === 0 ? (
        <div className="empty small-empty">
          <p className="muted">Aucun fichier pour ces critères (sur un an par défaut).</p>
        </div>
      ) : (
        <div className="msgs">
          {liste.map((f) => (
            <Fichier key={f.chemin + f.premierMs} f={f} />
          ))}
          {liste.length >= 300 && <p className="small muted">300 premiers résultats : précise la recherche.</p>}
        </div>
      )}
    </section>
  );
}

function Fichier({ f }: { f: HistoriqueFichier }) {
  const [ouvert, setOuvert] = useState(false);
  const nom = f.chemin.split("\\").pop();
  return (
    <article className={"msg" + (f.supprime ? " supprime" : "")}>
      <div className="msg-head" style={{ cursor: "pointer" }} onClick={() => setOuvert(!ouvert)}>
        <span className="msg-author">{nom}</span>
        {f.telecharge && <span className="tag good">téléchargé</span>}
        {f.renomme && <span className="tag warn">renommé ou déplacé</span>}
        {f.supprime && <span className="tag bad">supprimé</span>}
        <span className="small muted" style={{ marginLeft: "auto" }}>dernier changement {local(f.dernierMs)}</span>
      </div>
      <div className="path muted">{f.chemin}</div>
      {f.chemins.length > 1 && <div className="small muted">Aussi appelé : {Array.from(new Set(f.chemins.slice(0, -1).map((c) => c.split("\\").pop()))).join(" · ")}</div>}
      <div className="row">
        <button className="link small" onClick={() => setOuvert(!ouvert)}>{ouvert ? "Masquer" : "Voir"} le parcours ({f.evenements.length})</button>
        {!f.supprime && (
          <button className="link small" onClick={() => api.montrerFichier(f.chemin).catch(() => {})}>Afficher dans l’Explorateur</button>
        )}
      </div>
      {ouvert && (
        <div className="timeline">
          {f.evenements.map((e) => (
            <div className="ev" key={e.id} style={{ gridTemplateColumns: "150px 1fr" }}>
              <span className="small">{e.evenement ? local(e.evenement.utcMs) : "heure inconnue"}</span>
              <div className="ev-main">
                <span className="small"><strong>{ACTIONS[e.action] ?? e.action}</strong> {e.contenu.note ? <span className="muted">— {e.contenu.note}</span> : null}</span>
                {e.contenu.ancienChemin && <span className="path muted">depuis {e.contenu.ancienChemin}</span>}
                <span className="path muted">{e.contenu.chemin}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
