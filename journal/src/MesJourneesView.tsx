import { useCallback, useEffect, useMemo, useState } from "react";
import { api, texteErreur, type EtatVue, type Evenement, type RapportVue, type Segment } from "./api";
import { ACTIONS, CATEGORIES, duree, heureLocale } from "./format";

type Mode = "jour" | "semaine";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const JOURS_COURTS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

function bornes(mode: Mode, date: string): { du: number; au: number; jours: number[] } {
  const [a, m, j] = date.split("-").map(Number);
  if (mode === "jour") {
    return { du: new Date(a, m - 1, j).getTime(), au: new Date(a, m - 1, j + 1).getTime(), jours: [new Date(a, m - 1, j).getTime()] };
  }
  const d = new Date(a, m - 1, j);
  const lundi = j - ((d.getDay() + 6) % 7);
  const jours = Array.from({ length: 7 }, (_, i) => new Date(a, m - 1, lundi + i).getTime());
  return { du: jours[0], au: new Date(a, m - 1, lundi + 7).getTime(), jours };
}

export function MesJourneesView(p: { etat: EtatVue; onReglages: () => void }) {
  const [mode, setMode] = useState<Mode>("jour");
  const [date, setDate] = useState(iso(new Date()));
  const [v, setV] = useState<RapportVue | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fenetres, setFenetres] = useState(false);
  const { du, au, jours } = useMemo(() => bornes(mode, date), [mode, date]);

  const charger = useCallback(async () => {
    try {
      setV(await api.rapport(du, au, jours));
      setErreur(null);
    } catch (e) {
      setErreur(texteErreur(e));
    }
  }, [du, au, jours]);

  useEffect(() => {
    charger();
    const t = window.setInterval(charger, 30_000);
    return () => window.clearInterval(t);
  }, [charger]);

  const decaler = (n: number) => {
    const [a, m, j] = date.split("-").map(Number);
    setDate(iso(new Date(a, m - 1, j + n * (mode === "jour" ? 1 : 7))));
  };

  const r = v?.rapport;
  const titre =
    mode === "jour"
      ? new Date(du).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : `Semaine du ${new Date(du).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} au ${new Date(au - 1).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Mes journées</h1>
          <p className="muted">
            Temps d’écran : temps où une fenêtre était au premier plan et où tu utilisais le PC. Verrouillage, veille, pause et inactivité (aucune action
            au clavier ou à la souris depuis {p.etat.reglages.seuilInactiviteMin} min) ne comptent pas.
          </p>
        </div>
      </header>

      <div className="row wrap">
        <div className="row">
          <button className={"btn small" + (mode === "jour" ? " primary" : " ghost")} onClick={() => setMode("jour")}>Jour</button>
          <button className={"btn small" + (mode === "semaine" ? " primary" : " ghost")} onClick={() => setMode("semaine")}>Semaine</button>
        </div>
        <button className="btn small ghost" onClick={() => decaler(-1)} aria-label="Précédent">‹</button>
        <input type="date" style={{ width: 160 }} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <button className="btn small ghost" onClick={() => decaler(1)} aria-label="Suivant">›</button>
        <button className="btn small ghost" onClick={() => setDate(iso(new Date()))}>Aujourd’hui</button>
        <strong style={{ marginLeft: 8, textTransform: "capitalize" }}>{titre}</strong>
      </div>
      {erreur && <div className="alert bad">{erreur}</div>}

      {r && (
        <>
          <div className="stats">
            <Tuile valeur={duree(r.actifMs)} libelle={mode === "jour" ? "temps d’écran" : `temps d’écran (${duree(r.actifMs / 7)} par jour)`} />
            <Tuile valeur={r.premiereMs ? heureLocale(r.premiereMs) : "—"} libelle={mode === "jour" ? "première activité" : "première activité de la semaine"} />
            <Tuile valeur={r.derniereMs ? heureLocale(r.derniereMs) : "—"} libelle="dernière activité" />
            <Tuile valeur={String(v!.fichiersTouches)} libelle="fichiers créés ou modifiés" />
          </div>

          {r.actifMs === 0 ? (
            <div className="empty small-empty">
              <p className="muted">
                {p.etat.reglages.collecteActive ? "Aucune utilisation enregistrée sur cette période." : "La collecte est désactivée : rien n’est mesuré."}
              </p>
            </div>
          ) : (
            <>
              {mode === "semaine" && (
                <div className="card">
                  <h2>Par jour</h2>
                  <Colonnes valeurs={r.parJour} etiquettes={JOURS_COURTS} onClic={(i) => { setMode("jour"); setDate(iso(new Date(jours[i]))); }} />
                </div>
              )}
              <div className="card">
                <h2>Par heure{mode === "semaine" ? " (toute la semaine)" : ""}</h2>
                <Colonnes valeurs={r.parHeure} etiquettes={r.parHeure.map((_, i) => (i % 3 === 0 ? `${i} h` : ""))} titres={r.parHeure.map((_, i) => `${i} h – ${i + 1} h`)} />
              </div>
              <div className="card">
                <div className="row">
                  <h2>{fenetres ? "Par fenêtre" : "Par programme"}</h2>
                  <button className="link small" style={{ marginLeft: "auto" }} onClick={() => setFenetres(!fenetres)}>
                    {fenetres ? "Voir par programme" : "Voir le détail par fenêtre"}
                  </button>
                </div>
                <Barres liste={(fenetres ? r.parFenetre : r.parAppli).slice(0, fenetres ? 30 : 15)} total={r.actifMs} />
              </div>
              {mode === "jour" && r.periodes.length > 0 && (
                <div className="card">
                  <h2>Périodes d’utilisation</h2>
                  <div className="row wrap">
                    {r.periodes.map((x) => (
                      <span key={x.debutMs} className="tag" style={{ fontSize: 12, padding: "3px 8px" }}>
                        {heureLocale(x.debutMs)} → {heureLocale(x.finMs)} · {duree(x.finMs - x.debutMs)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {mode === "jour" && <AUneHeure jour={du} />}
          <Projets v={v!} etat={p.etat} onReglages={p.onReglages} />
        </>
      )}
    </section>
  );
}

function Tuile({ valeur, libelle }: { valeur: string; libelle: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{valeur}</div>
      <div className="small muted">{libelle}</div>
    </div>
  );
}

/** Colonnes verticales, une seule série (pas de légende : le titre la nomme). */
function Colonnes({ valeurs, etiquettes, titres, onClic }: { valeurs: number[]; etiquettes: string[]; titres?: string[]; onClic?: (i: number) => void }) {
  const max = Math.max(1, ...valeurs);
  return (
    <div className="colonnes" role="table">
      {valeurs.map((ms, i) => (
        <div
          key={i}
          className={"colonne" + (onClic ? " cliquable" : "")}
          role="row"
          title={`${titres?.[i] ?? etiquettes[i]} : ${duree(ms)}`}
          onClick={onClic ? () => onClic(i) : undefined}
        >
          <div className="colonne-zone">
            <div className="colonne-barre" style={{ height: `${(ms / max) * 100}%` }} />
          </div>
          <span className="colonne-etiquette">{etiquettes[i]}</span>
        </div>
      ))}
    </div>
  );
}

function Barres({ liste, total }: { liste: { nom: string; ms: number }[]; total: number }) {
  const max = Math.max(1, ...liste.map((x) => x.ms));
  return (
    <div className="barres">
      {liste.map((x) => (
        <div key={x.nom} className="barre-ligne" title={`${x.nom} : ${duree(x.ms)} (${Math.round((x.ms / Math.max(1, total)) * 100)} %)`}>
          <span className="barre-nom">{x.nom}</span>
          <div className="barre-zone">
            <div className="barre" style={{ width: `${(x.ms / max) * 100}%` }} />
          </div>
          <span className="barre-valeur">{duree(x.ms)}</span>
        </div>
      ))}
    </div>
  );
}

function AUneHeure({ jour }: { jour: number }) {
  const [h, setH] = useState("15:00");
  const [res, setRes] = useState<{ segment: Segment | null; autour: Evenement[] } | null>(null);
  const chercher = async () => {
    const [hh, mm] = h.split(":").map(Number);
    const d = new Date(jour);
    d.setHours(hh, mm, 0, 0);
    setRes(await api.aLInstant(d.getTime()));
  };
  return (
    <div className="card">
      <h2>Que faisais-je à…</h2>
      <div className="row">
        <input type="time" style={{ width: 120 }} value={h} onChange={(e) => setH(e.target.value)} />
        <button className="btn small primary" onClick={chercher}>Voir</button>
      </div>
      {res && (
        <>
          {res.segment ? (
            <p>
              <strong>{res.segment.titre || res.segment.appli}</strong> <span className="muted">({res.segment.appli})</span>, au premier plan de{" "}
              {heureLocale(res.segment.debutMs)} à {heureLocale(res.segment.finMs)}.
            </p>
          ) : (
            <p className="muted">Le PC n’était pas utilisé à cette heure-là (verrouillé, en veille, inactif, éteint, ou collecte en pause).</p>
          )}
          {res.autour.length > 0 && (
            <>
              <p className="small muted">Dans le quart d’heure avant et après :</p>
              <div className="timeline">
                {res.autour.slice(0, 40).map((e) => (
                  <div className="ev" key={e.id} style={{ gridTemplateColumns: "70px 1fr" }}>
                    <span className="small">{heureLocale((e.evenement ?? e.detection).utcMs)}</span>
                    <div className="ev-head">
                      <span className={"cat cat-" + e.categorie}>{CATEGORIES[e.categorie] ?? e.categorie}</span>
                      <span className="muted small">{ACTIONS[e.action] ?? e.action}</span>
                      <span className="ev-subject">{e.contenu.sujet}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Projets({ v, etat, onReglages }: { v: RapportVue; etat: EtatVue; onReglages: () => void }) {
  const regles = etat.reglages.projets;
  const auto = new Map(v.rapport.parProjet.map((x) => [x.nom, x.ms]));
  const chrono = new Map((v.chrono?.projets ?? []).map((x) => [x.nom.toLowerCase(), x]));
  const noms = Array.from(new Set([...regles.map((r) => r.projet), ...(v.chrono?.projets ?? []).filter((x) => !x.archive).map((x) => x.nom)]));
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="card">
      <div className="row">
        <h2>Projets</h2>
        <button className="link small" style={{ marginLeft: "auto" }} onClick={onReglages}>Régler les mots-clés…</button>
      </div>
      <p className="small muted">
        « D’après les fenêtres » : temps où le titre de la fenêtre ou le programme contient un mot-clé du projet. « Dans Chrono » : temps chronométré dans
        Rayan’s Chrono (lu sans le modifier). {v.chrono ? "" : "Rayan’s Chrono n’a pas été trouvé sur ce PC."}
      </p>
      {noms.length === 0 ? (
        <p className="small muted">Aucun projet : ajoute des mots-clés dans Réglages, ou crée des projets dans Rayan’s Chrono.</p>
      ) : (
        <table className="table-perm">
          <tbody>
            <tr className="small muted">
              <td>Projet</td>
              <td>D’après les fenêtres</td>
              <td>Dans Chrono</td>
              <td />
            </tr>
            {noms.map((n) => {
              const c = chrono.get(n.toLowerCase());
              const sansRegle = !regles.some((r) => r.projet === n);
              return (
                <tr key={n}>
                  <td>{n}</td>
                  <td>{sansRegle ? <span className="muted small">pas de mot-clé</span> : duree(auto.get(n) ?? 0)}</td>
                  <td>{c ? duree(c.ms) : <span className="muted small">—</span>}</td>
                  <td style={{ textAlign: "right" }}>
                    {v.chrono?.executable && c && (
                      <button
                        className="btn small ghost"
                        onClick={async () => {
                          try {
                            await api.chronoLancer(n);
                            setMsg(`Rayan’s Chrono démarre le projet « ${n} ».`);
                          } catch (e) {
                            setMsg(texteErreur(e));
                          }
                        }}
                      >
                        Démarrer dans Chrono
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {msg && <p className="small">{msg}</p>}
    </div>
  );
}
