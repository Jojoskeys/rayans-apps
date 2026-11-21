// Fiches (et quiz), Progrès, Sources, Réglages.
import { useState } from "react";
import { ASTUCES } from "../core/astuces";
import { DEFIS, meilleurScore } from "../core/defis";
import { faitsDus } from "../core/espacement";
import { FICHES, MYTHES, SYMBOLE, TOUTES_SOURCES, type Source } from "../core/fiches";
import { emptyDb, fusionner, parseDb, type Reglages as TReglages } from "../core/model";
import { TYPES } from "../core/niveaux";
import { nbSeancesFinies, serie } from "../core/seance";
import { comparerTests, historique, justesse, meilleursAstuces } from "../core/stats";
import { openImportFile, saveExportFile } from "../storage";
import { avecResultat, Barre, Carte, Courbe, fmtDate, plural, useApp } from "../ui";

const LienSource = ({ s }: { s: Source }) => (s.lien ? <a href={s.lien} target="_blank" rel="noreferrer">{s.texte}</a> : <span>{s.texte}</span>);

// ----- Fiches -------------------------------------------------------------------------------------------------
function QuizMythes({ onFin }: { onFin: () => void }) {
  const { maj } = useApp();
  const [i, setI] = useState(0);
  const [rep, setRep] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  if (i >= MYTHES.length)
    return (
      <Carte titre="Vrai ou faux ? — résultat">
        <div className="verdict ok-texte">{score} / {MYTHES.length}</div>
        <div className="choix">
          <button className="btn" onClick={() => { setI(0); setScore(0); setRep(null); }}>Recommencer</button>
          <button className="btn primary" onClick={onFin}>Retour aux fiches</button>
        </div>
      </Carte>
    );
  const m = MYTHES[i];
  const repondre = (v: boolean) => {
    setRep(v);
    if (v === m.vrai) setScore(score + 1);
  };
  const suivant = () => {
    if (i + 1 === MYTHES.length) maj((d) => avecResultat(d, { sorte: "quiz", ref: "mythes", bonnes: score, total: MYTHES.length, tempsMoyenMs: 0 }));
    setI(i + 1);
    setRep(null);
  };
  return (
    <Carte titre={`Vrai ou faux ? (${i + 1} / ${MYTHES.length})`}>
      <p className="affirmation">« {m.affirmation} »</p>
      {rep === null ? (
        <div className="choix"><button className="btn gros" onClick={() => repondre(true)}>Vrai</button><button className="btn gros" onClick={() => repondre(false)}>Faux</button></div>
      ) : (
        <>
          <p className={rep === m.vrai ? "ok-texte" : "ko-texte"}><b>{rep === m.vrai ? "Bien vu." : "Raté."}</b> {m.explication}</p>
          {m.source && <p className="muted petit">Source : <LienSource s={m.source} /></p>}
          <div className="choix"><button className="btn primary" onClick={suivant} autoFocus>Suivant</button></div>
        </>
      )}
    </Carte>
  );
}

export function Fiches() {
  const { arg } = useApp();
  const [ouverte, setOuverte] = useState<string | null>(arg ?? FICHES[0].id);
  const [quiz, setQuiz] = useState(false);
  if (quiz) return <div className="pile"><button className="btn petit retour" onClick={() => setQuiz(false)}>← Fiches</button><QuizMythes onFin={() => setQuiz(false)} /></div>;
  return (
    <div className="pile">
      <Carte titre="Ce que dit la recherche">
        <p className="muted petit">Simplement, sans promettre plus que les études. ✅ = prouvé (plusieurs études solides), ⚠️ = discuté ou prouvé en partie, ❌ = mythe. Ces exercices entraînent surtout le calcul mental lui-même ; l'effet sur le reste des maths ou sur « l'intelligence » est discuté.</p>
        <button className="btn primary" onClick={() => setQuiz(true)}>Quiz : vrai ou faux ? ({MYTHES.length} questions)</button>
      </Carte>
      {FICHES.map((f) => (
        <Carte key={f.id} className="fiche">
          <button className="fiche-tete" onClick={() => setOuverte(ouverte === f.id ? null : f.id)} aria-expanded={ouverte === f.id}>
            <span>{f.icone}</span> <b>{f.titre}</b> <em>{ouverte === f.id ? "▾" : "▸"}</em>
          </button>
          {ouverte === f.id && (
            <div>
              <ul className="points">{f.points.map((p) => <li key={p.texte}><span className="statut">{SYMBOLE[p.statut]}</span> {p.texte}</li>)}</ul>
              {f.paragraphes.map((p) => <p key={p}>{p}</p>)}
              <p className="dans-app">→ Dans l'app : {f.dansLApp}</p>
              <details><summary className="muted petit">Sources</summary><ul className="sources">{f.sources.map((s) => <li key={s.texte}><LienSource s={s} /></li>)}</ul></details>
            </div>
          )}
        </Carte>
      ))}
    </div>
  );
}

// ----- Progrès ------------------------------------------------------------------------------------------------
export function Progres() {
  const { db } = useApp();
  const now = Date.now();
  const tests = comparerTests(db);
  const entr = historique(db, "entrainement", 30);
  const best = meilleursAstuces(db);
  const aRevoir = db.revoir.filter((f) => !f.fini);
  const signe = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  return (
    <div className="pile">
      <Carte titre="En bref">
        <div className="chiffres-bilan">
          <div><b>{serie(db, now)}</b><span>🔥 jours d'affilée</span></div>
          <div><b>{nbSeancesFinies(db)}</b><span>séances finies</span></div>
          <div><b>{aRevoir.length}</b><span>calculs à revoir ({faitsDus(db, now).length} aujourd'hui)</span></div>
        </div>
      </Carte>
      <Carte titre="Tests (20 calculs, difficulté fixe)">
        {tests.length === 0 ? <p className="muted">Pas encore de test. Le test de départ est proposé sur la page Séance.</p> : (
          <div className="table-defile">
            <table className="table-tests">
              <thead><tr><th>Test</th><th>Date</th><th>Justesse</th><th>Temps moyen</th><th>vs départ</th></tr></thead>
              <tbody>
                {tests.map((t) => (
                  <tr key={t.r.id}>
                    <td>{t.r.detail ?? "Test"}</td>
                    <td>{fmtDate(t.r.at)}</td>
                    <td>{t.r.bonnes}/{t.r.total} ({t.justesse} %)</td>
                    <td>{t.tempsS} s</td>
                    <td>{t.diffJustesse === null ? "—" : <><span className={t.diffJustesse >= 0 ? "ok-texte" : "ko-texte"}>{signe(t.diffJustesse)} pts</span> · <span className={t.diffTempsS! <= 0 ? "ok-texte" : "ko-texte"}>{signe(t.diffTempsS!)} s</span></>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tests.length >= 2 && <Courbe valeurs={tests.map((t) => t.justesse)} max={100} min={0} unite=" %" />}
      </Carte>
      <Carte titre="Entraînement">
        <div className="grille-progres">
          <div className="progres-jeu"><b>Justesse par série</b><span className="muted petit">Viser 70 à 85 % : c'est la zone où l'on progresse.</span><Courbe valeurs={entr.map((r) => justesse(r))} max={100} min={0} unite=" %" /></div>
          <div className="progres-jeu"><b>Temps moyen par calcul</b><span className="muted petit">Il peut monter quand le niveau monte : c'est normal.</span><Courbe valeurs={entr.map((r) => Math.round(r.tempsMoyenMs / 100) / 10)} min={0} unite=" s" /></div>
        </div>
      </Carte>
      <Carte titre="Niveaux">
        <div className="grille-progres">
          {TYPES.map((t) => {
            const l = db.niveaux[t.id];
            return (
              <div key={t.id} className="progres-jeu">
                <b>{t.icone} {t.nom}</b>
                <span className="muted petit">Niveau {l.niveau} / {t.max} — {t.paliers[l.niveau - t.min]}</span>
                <Barre part={l.niveau / t.max} />
              </div>
            );
          })}
        </div>
      </Carte>
      <Carte titre="Défis et astuces">
        <ul className="liste-simple">
          {DEFIS.map((d) => { const m = meilleurScore(db, d.id); return <li key={d.id}>{d.icone} {d.nom} : {m === null ? <span className="muted">pas encore joué</span> : <b>{m} {d.unite}</b>}</li>; })}
        </ul>
        <div className="astuces-progres">
          {ASTUCES.map((a) => <span key={a.id} className={`puce-astuce ${best[a.id] === null ? "" : best[a.id]! >= 8 ? "ok" : "moyen"}`} title={a.titre}>{a.icone} {a.titre} {best[a.id] === null ? "" : `· ${best[a.id]}/10`}</span>)}
        </div>
        <p className="muted petit">{plural(historique(db, "estimation", 999).length, "série", "séries")} « Estimer d'abord » faites.</p>
      </Carte>
    </div>
  );
}

// ----- Sources ------------------------------------------------------------------------------------------------
export function Sources() {
  return (
    <div className="pile">
      <Carte titre="Sources">
        <p className="muted petit">Les études sur lesquelles s'appuient les fiches et les choix de l'app. Quand un lien n'a pas pu être vérifié, la source est citée sans lien.</p>
        {TOUTES_SOURCES.map((g) => (
          <div key={g.theme}>
            <h3>{g.theme}</h3>
            <ul className="sources">{g.sources.map((s) => <li key={s.texte}><LienSource s={s} /></li>)}</ul>
          </div>
        ))}
        <p className="muted petit">Les astuces (× 11, carrés en 5, compléments…) sont des propriétés mathématiques classiques, expliquées avec nos propres mots.</p>
      </Carte>
    </div>
  );
}

// ----- Réglages -----------------------------------------------------------------------------------------------
export function Reglages() {
  const { db, maj } = useApp();
  const [msg, setMsg] = useState("");
  const set = (r: Partial<TReglages>) => maj((d) => ({ ...d, reglages: { ...d.reglages, ...r, maj: Date.now() } }));
  const importer = async () => {
    try {
      const t = await openImportFile();
      if (t === null) return;
      const autre = parseDb(t);
      maj((d) => fusionner(d, autre));
      setMsg("Copie importée et fusionnée avec tes données (rien n'a été perdu).");
    } catch (e) {
      setMsg(`Import impossible : ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  return (
    <div className="pile">
      <Carte titre="Réglages">
        <label className="champ">Durée de la séance du jour
          <select value={db.reglages.minutes} onChange={(e) => set({ minutes: Number(e.target.value) as TReglages["minutes"] })}>
            <option value={5}>5 minutes (jours chargés)</option>
            <option value={10}>10 minutes (conseillé)</option>
            <option value={15}>15 minutes</option>
            <option value={20}>20 minutes</option>
          </select>
        </label>
        <label className="champ">Un nouveau jour commence à
          <select value={db.reglages.heureJour} onChange={(e) => set({ heureJour: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4, 5, 6].map((h) => <option key={h} value={h}>{h} h</option>)}
          </select>
        </label>
        <label className="case-a-cocher"><input type="checkbox" checked={db.reglages.sons} onChange={(e) => set({ sons: e.target.checked })} /> Sons</label>
        <label className="case-a-cocher"><input type="checkbox" checked={db.reglages.chrono} onChange={(e) => set({ chrono: e.target.checked })} /> Afficher le chrono pendant l'entraînement</label>
        <p className="muted petit">Désactivé par défaut : le temps est mesuré quand même pour tes progrès, mais ne pas le voir enlève une pression inutile. Les défis, eux, ont toujours un chrono (et sont facultatifs).</p>
      </Carte>
      <Carte titre="Mes données">
        <div className="choix">
          <button className="btn" onClick={async () => { const f = await saveExportFile(`rayans-calcul-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db, null, 2)); if (f) setMsg(`Copie enregistrée : ${f}`); }}>Enregistrer une copie</button>
          <button className="btn" onClick={() => void importer()}>Importer une copie</button>
          <button className="btn" onClick={() => { if (confirm("Revoir la présentation du premier lancement ?")) set({ bienvenue: false }); }}>Revoir la présentation</button>
          <button className="btn" onClick={() => { if (confirm("Tout effacer (niveaux, résultats, tests) ? C'est définitif.") && confirm("Vraiment tout effacer ?")) maj(() => emptyDb()); }}>Tout effacer</button>
        </div>
        {msg && <p className="muted petit">{msg}</p>}
      </Carte>
    </div>
  );
}
