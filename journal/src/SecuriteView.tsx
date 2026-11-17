import { useCallback, useEffect, useMemo, useState } from "react";
import { api, texteErreur, type EtatVue, type Niveau, type Programme, type SecuriteVue } from "./api";
import { local } from "./format";

const NIVEAUX: Record<Niveau, { libelle: string; classe: string; icone: string }> = {
  suspect: { libelle: "Suspect", classe: "bad", icone: "❌" },
  a_verifier: { libelle: "À vérifier", classe: "warn", icone: "⚠️" },
  inconnu: { libelle: "Non vérifiable", classe: "", icone: "❔" },
  fiable: { libelle: "Fiable", classe: "good", icone: "✅" },
};

export function SecuriteView(p: { etat: EtatVue; onActiver: () => void }) {
  const [v, setV] = useState<SecuriteVue | null>(null);
  const [filtre, setFiltre] = useState<Niveau | "">("");
  const [mots, setMots] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      setV(await api.securite());
      setErreur(null);
    } catch (e) {
      setErreur(texteErreur(e));
    }
  }, []);

  useEffect(() => {
    charger();
    const t = window.setInterval(charger, 8000);
    return () => window.clearInterval(t);
  }, [charger]);

  const progs = v?.programmes ?? [];
  const compte = (n: Niveau) => progs.filter((x) => x.analyse.niveau === n).length;
  const parChemin = useMemo(() => new Map(progs.map((x) => [x.analyse.chemin.toLowerCase(), x])), [progs]);
  const visibles = progs.filter(
    (x) =>
      (!filtre || x.analyse.niveau === filtre) &&
      (!mots.trim() || `${x.analyse.nom} ${x.analyse.chemin} ${x.analyse.editeur ?? ""}`.toLowerCase().includes(mots.trim().toLowerCase())),
  );
  const r = p.etat.reglages;
  const actif = r.collecteActive && r.securite;

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Sécurité</h1>
          <p className="muted">
            Chaque programme vu sur le PC est vérifié : signature de l’éditeur, emplacement, origine Internet, nom imitant Windows, démarrage automatique,
            détections de Microsoft Defender. Ce n’est pas un antivirus : le niveau dit s’il y a des raisons de se méfier, et lesquelles. Rien n’est envoyé
            en ligne.
          </p>
        </div>
      </header>
      {!actif && (
        <div className="banner">
          <div>
            <strong>{r.collecteActive ? "La vérification de sécurité est décochée dans les réglages." : "La collecte est désactivée."}</strong>
            <div className="muted small">Les programmes sont analysés quand la collecte est active.</div>
          </div>
          {!r.collecteActive && <button className="btn primary" onClick={p.onActiver}>Activer la collecte…</button>}
        </div>
      )}
      {erreur && <div className="alert bad">{erreur}</div>}

      <div className="stats">
        {(["suspect", "a_verifier", "fiable", "inconnu"] as Niveau[]).map((n) => (
          <button key={n} className={"stat stat-btn" + (filtre === n ? " active" : "")} onClick={() => setFiltre(filtre === n ? "" : n)}>
            <div className="stat-value">{NIVEAUX[n].icone} {compte(n)}</div>
            <div className="small muted">{NIVEAUX[n].libelle}</div>
          </button>
        ))}
      </div>

      <div className="filters">
        <label className="field large">
          <span className="field-label">Chercher un programme (nom, dossier, éditeur)</span>
          <input value={mots} onChange={(e) => setMots(e.target.value)} placeholder="ex. roblox" />
        </label>
      </div>

      {progs.length === 0 ? (
        <div className="empty small-empty">
          <p className="muted">{actif ? "Premier inventaire en cours : les programmes ouverts sont analysés (quelques dizaines de secondes)." : "Aucun programme analysé."}</p>
        </div>
      ) : (
        <div className="msgs">
          {visibles.map((x) => (
            <Carte key={x.analyse.chemin} x={x} onChange={charger} />
          ))}
          {visibles.length === 0 && <p className="muted small">Aucun programme pour ce filtre.</p>}
        </div>
      )}

      <div className="card">
        <h2>Démarrage automatique ({v?.demarrage.length ?? 0})</h2>
        <p className="small muted">
          Programmes lancés avec Windows (registre, dossier Démarrage, tâches planifiées hors Microsoft). Relu toutes les 5 minutes : un ajout apparaît dans
          le journal et le programme est analysé.
        </p>
        <div className="timeline">
          {(v?.demarrage ?? []).map((e, i) => {
            const prog = e.executable ? parChemin.get(e.executable.toLowerCase()) : undefined;
            const n = prog?.analyse.niveau;
            return (
              <div className="ev" key={i} style={{ gridTemplateColumns: "150px 1fr" }}>
                <div className="small muted">{e.source}</div>
                <div className="ev-main">
                  <div className="ev-head">
                    <span className="ev-subject">{e.nom}</span>
                    {n ? <span className={"tag " + NIVEAUX[n].classe}>{NIVEAUX[n].libelle}</span> : <span className="tag">pas encore analysé</span>}
                  </div>
                  <div className="path muted" title={e.commande}>{e.commande}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2>Détections de Microsoft Defender (90 jours)</h2>
        {(v?.detections ?? []).length === 0 ? (
          <p className="small muted">Aucune détection lue.</p>
        ) : (
          <div className="timeline">
            {v!.detections.map((d) => (
              <div className="ev" key={d.numero}>
                <div className="ev-time">
                  <span className="t">{local(d.quandMs)}</span>
                  <span className="small muted">{d.id === 1116 ? "détection" : "action"}</span>
                </div>
                <div className="ev-main">
                  <div className="ev-head">
                    <span className="ev-subject">{d.menace}</span>
                    <span className="tag">{d.gravite}</span>
                  </div>
                  <div className="small muted">{d.categorie} · {d.action}</div>
                  {d.chemins.map((c) => <div key={c} className="path muted">{c}</div>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Carte({ x, onChange }: { x: Programme; onChange: () => void }) {
  const a = x.analyse;
  const n = NIVEAUX[a.niveau];
  const [ouvert, setOuvert] = useState(a.niveau === "suspect");
  const [defender, setDefender] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const alertes = a.raisons.filter((r) => r.gravite !== "info");
  return (
    <article className={"msg" + (a.niveau === "suspect" ? " supprime" : a.niveau === "a_verifier" ? " absent" : "")}>
      <div className="msg-head" style={{ cursor: "pointer" }} onClick={() => setOuvert(!ouvert)}>
        <span className={"tag " + n.classe}>{n.icone} {n.libelle}</span>
        <span className="msg-author">{a.nom}</span>
        <span className="small muted">{a.editeur ? `par ${a.editeur}` : "éditeur inconnu"}</span>
        <span className="small muted" style={{ marginLeft: "auto" }}>vu la 1re fois le {local(x.premiereVueMs)}</span>
      </div>
      <div className="path muted">{a.chemin}</div>
      {!ouvert && alertes.length > 0 && <div className="small" style={{ color: "var(--warn)" }}>{alertes.map((r) => r.texte).join(" ")}</div>}
      {ouvert && (
        <>
          <ul className="raisons">
            {a.raisons.map((r, i) => (
              <li key={i} className={r.gravite}>
                {r.gravite === "critique" ? "❌" : r.gravite === "avertissement" ? "⚠️" : "•"} {r.texte}
              </li>
            ))}
          </ul>
          <div className="row wrap">
            <button
              className="btn small"
              disabled={occupe}
              onClick={async () => {
                setOccupe(true);
                setDefender("Analyse par Microsoft Defender en cours…");
                try {
                  const [menace, sortie] = await api.analyserDefender(a.chemin);
                  setDefender(menace ? `Menace trouvée. ${sortie}` : "Microsoft Defender n’a trouvé aucune menace dans ce fichier.");
                  onChange();
                } catch (e) {
                  setDefender(texteErreur(e));
                } finally {
                  setOccupe(false);
                }
              }}
            >
              Analyser avec Microsoft Defender
            </button>
            <button className="btn small ghost" onClick={async () => { await api.reanalyser(a.chemin); window.setTimeout(onChange, 4000); }}>Revérifier</button>
            <button className="btn small ghost" onClick={() => api.montrerFichier(a.chemin)}>Afficher dans l’Explorateur</button>
            <span className="small muted">Analysé le {local(a.analyseMs)} · vu en dernier le {local(x.derniereVueMs)}</span>
          </div>
          {defender && <div className="small">{defender}</div>}
        </>
      )}
    </article>
  );
}


