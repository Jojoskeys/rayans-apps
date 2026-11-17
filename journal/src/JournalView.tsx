import { Fragment, useCallback, useEffect, useState } from "react";
import { api, texteErreur, type EtatVue, type Evenement, type Filtre } from "./api";
import { ACTIONS, CATEGORIES, debutJour, decalage, heure, jour } from "./format";

const PAGE = 200;

export function JournalView(p: { etat: EtatVue; onActiver: () => void }) {
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [categorie, setCategorie] = useState("");
  const [appli, setAppli] = useState("");
  const [mots, setMots] = useState("");
  const [composants, setComposants] = useState(false);
  const [liste, setListe] = useState<Evenement[]>([]);
  const [fin, setFin] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const filtre = useCallback((): Filtre => {
    const d = debutJour(du);
    const a = debutJour(au);
    return {
      duMs: d,
      auMs: a !== null ? a + 86_400_000 : null,
      categorie: categorie || null,
      exclureCategories: composants ? [] : ["composant"],
      appli: appli.trim() || null,
      mots,
      limite: PAGE,
    };
  }, [du, au, categorie, appli, mots, composants]);

  const charger = useCallback(async () => {
    try {
      const r = await api.evenements(filtre());
      setListe(r);
      setFin(r.length < PAGE);
      setErreur(null);
    } catch (e) {
      setErreur(texteErreur(e));
    }
  }, [filtre]);

  useEffect(() => {
    const t = window.setTimeout(charger, 200);
    return () => window.clearTimeout(t);
  }, [charger]);

  // Rafraîchissement en direct quand on regarde les derniers événements sans filtre de date.
  useEffect(() => {
    if (du || au) return;
    const t = window.setInterval(charger, 5000);
    return () => window.clearInterval(t);
  }, [charger, du, au]);

  const plus = async () => {
    const dernier = liste[liste.length - 1];
    if (!dernier) return;
    // Page suivante : tout ce qui est au plus à l'heure du dernier affiché (sans doublon).
    const f = filtre();
    const borne = quand(dernier) + 1;
    const vus = new Set(liste.map((x) => x.id));
    const r = await api.evenements({ ...f, auMs: f.auMs != null ? Math.min(f.auMs, borne) : borne, limite: PAGE + vus.size });
    const suite = r.filter((e) => !vus.has(e.id)).slice(0, PAGE);
    setListe([...liste, ...suite]);
    setFin(suite.length < PAGE);
  };

  const exporter = async () => {
    try {
      const f = await api.exporter("evenements", filtre());
      if (f) setInfo(`Export écrit : ${f.join(" · ")}`);
    } catch (e) {
      setErreur(texteErreur(e));
    }
  };

  const r = p.etat.reglages;
  let jourCourant = "";
  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Journal d’activité</h1>
          <p className="muted">
            Chaque ligne donne l’heure réelle de l’événement, sa précision, et l’heure à laquelle il a été détecté. Les lignes en jaune signalent un suivi
            partiel ou une heure inconnue.
          </p>
        </div>
        <button className="btn" onClick={exporter}>Exporter (JSON + HTML)</button>
      </header>
      {!r.collecteActive && (
        <div className="banner">
          <div>
            <strong>La collecte est désactivée.</strong>
            <div className="muted small">Rien n’est enregistré tant que tu ne l’as pas activée. Tu peux déjà archiver tes conversations.</div>
          </div>
          <button className="btn primary" onClick={p.onActiver}>Voir ce qui sera enregistré…</button>
        </div>
      )}
      <div className="filters">
        <label className="field">
          <span className="field-label">Du</span>
          <input type="date" value={du} onChange={(e) => setDu(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Au (inclus)</span>
          <input type="date" value={au} onChange={(e) => setAu(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Type</span>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)}>
            <option value="">Tous</option>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Programme exact</span>
          <input placeholder="ex. chrome.exe" value={appli} onChange={(e) => setAppli(e.target.value)} />
        </label>
        <label className="field large">
          <span className="field-label">Mots-clés (titre, fichier, programme)</span>
          <input placeholder="ex. mémoire stage" value={mots} onChange={(e) => setMots(e.target.value)} />
        </label>
      </div>
      <label className="check small muted">
        <input type="checkbox" checked={composants} onChange={(e) => setComposants(e.target.checked)} />
        Afficher aussi les composants Windows (RuntimeBroker, conhost… : programmes du dossier Windows sans fenêtre, enregistrés mais masqués par défaut)
      </label>
      {erreur && <div className="alert bad">{erreur}</div>}
      {info && <div className="alert good">{info}</div>}
      {liste.length === 0 ? (
        <div className="empty small-empty">
          <p className="muted">{r.collecteActive ? "Aucun événement pour ces critères." : "Aucun événement enregistré."}</p>
        </div>
      ) : (
        <div className="timeline">
          {liste.map((e) => {
            const h = e.evenement ?? e.detection;
            const j = jour(h);
            const entete = j !== jourCourant;
            jourCourant = j;
            return (
              <Fragment key={e.id}>
                {entete && <div className="day">{j}</div>}
                <Ligne e={e} />
              </Fragment>
            );
          })}
        </div>
      )}
      {!fin && liste.length > 0 && (
        <div className="actions">
          <button className="btn" onClick={plus}>Plus ancien…</button>
        </div>
      )}
    </section>
  );
}

function quand(e: Evenement) {
  return (e.evenement ?? e.detection).utcMs;
}

function Ligne({ e }: { e: Evenement }) {
  const c = e.contenu;
  const ecart = e.evenement ? Math.abs(e.detection.utcMs - e.evenement.utcMs) : null;
  return (
    <div className={"ev" + (e.partiel || !e.evenement ? " partiel" : "")}>
      <div className="ev-time">
        {e.evenement ? (
          <>
            <span className="t" title={`${e.evenement.fuseau}, ${decalage(e.evenement)}`}>{heure(e.evenement, true)}</span>
            <span className="small muted">{e.evenement.precision}</span>
          </>
        ) : (
          <>
            <span className="t">heure inconnue</span>
            <span className="small muted">détectée {heure(e.detection)}</span>
          </>
        )}
        {e.evenement && ecart !== null && ecart > 1500 && (
          <span className="small muted" title="Heure de détection">détecté {jourCourt(e)} {heure(e.detection)}</span>
        )}
      </div>
      <div className="ev-main">
        <div className="ev-head">
          <span className={"cat cat-" + e.categorie}>{CATEGORIES[e.categorie] ?? e.categorie}</span>
          <span className="muted small">{ACTIONS[e.action] ?? e.action}</span>
          <span className="ev-subject" title={c.sujet}>{c.sujet}</span>
          {c.appli && c.appli !== c.sujet && <span className="tag">{c.appli}</span>}
          {e.partiel && <span className="tag warn">suivi partiel</span>}
        </div>
        {c.ancienChemin && <div className="path muted">depuis {c.ancienChemin}</div>}
        {c.chemin && <div className="path muted">{c.chemin}</div>}
        {c.detail && <div className="small muted">{c.detail}</div>}
        {c.note && <div className="small" style={{ color: e.partiel ? "var(--warn)" : "var(--muted)" }}>{c.note}</div>}
      </div>
    </div>
  );
}

function jourCourt(e: Evenement) {
  if (!e.evenement) return "";
  const a = new Date(e.evenement.utcMs + e.evenement.decalageMin * 60_000).getUTCDate();
  const b = new Date(e.detection.utcMs + e.detection.decalageMin * 60_000);
  return a === b.getUTCDate() ? "à" : `le ${b.getUTCDate()}/${b.getUTCMonth() + 1} à`;
}
