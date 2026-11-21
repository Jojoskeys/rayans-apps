// Exercices, Fiches (et quiz), Progrès, Sources, Réglages.
import { useRef, useState } from "react";
import { FICHES, QUIZ, source, SOURCES } from "../core/contenu";
import { TEST } from "../core/exercices";
import { emptyDb, fusionner, parseDb } from "../core/model";
import { EXOS, exoInfo, type ExoId } from "../core/niveaux";
import { serie, testPropose } from "../core/seance";
import { comparerTests, historique, nbSeancesFinies } from "../core/stats";
import { bilanTravail, choisirPalier, minutesPalier, PALIERS } from "../core/travail";
import { Partie } from "../exercices";
import { saveExportFile } from "../storage";
import { Carte, Courbe, fmtDate, fmtMs, plural, Statut, useApp } from "../ui";

// ----- Exercices ----------------------------------------------------------------------------------------------
export function Exercices() {
  const { db, arg, aller } = useApp();
  const [exo, setExo] = useState<ExoId | null>((arg as ExoId) ?? null);
  if (exo) return <Partie key={exo} exo={exo} onQuitter={() => { setExo(null); if (arg) aller("exercices"); }} />;
  const test = testPropose(db, Date.now());
  return (
    <div className="pile">
      <Carte titre="Les 5 exercices">
        <p className="muted petit">Chacun s'adapte : 2 manches réussies de suite → niveau +1, 1 manche ratée → niveau −1. Une manche dure moins d'une minute.</p>
        <div className="grille-jeux">
          {EXOS.map((g) => {
            const l = db.niveaux[g.id];
            return (
              <button key={g.id} className="jeu" onClick={() => setExo(g.id)}>
                <span className="icone">{g.icone}</span>
                <b>{g.nom}</b>
                <em>Niveau {l.level} / {g.max}{l.best ? ` · record ${l.best}` : ""}</em>
                <small>{g.entraine}</small>
              </button>
            );
          })}
        </div>
      </Carte>
      <Carte titre="🎯 Test de suivi">
        <p className="muted petit">2 minutes aux mêmes conditions à chaque fois (niveau {TEST.niveauRecherche} pour la cible, niveau {TEST.niveauFlanker} pour les flèches). {test ? "Un test est conseillé aujourd'hui." : "Conseillé une fois par semaine ; tu peux le refaire quand tu veux."}</p>
        <button className={`btn ${test ? "primary" : ""}`} onClick={() => aller("seance", "test")}>{test === "depart" ? "Faire le test de départ" : "Faire un test de suivi"}</button>
      </Carte>
      <p className="muted petit centre">Ces exercices entraînent surtout… ces exercices. L'effet sur le reste est faible : voir « Fiches ».</p>
    </div>
  );
}

// ----- Fiches et quiz ------------------------------------------------------------------------------------------
function Quiz() {
  const [i, setI] = useState(0);
  const [rep, setRep] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  if (i >= QUIZ.length)
    return (
      <Carte titre="Vrai ou faux ? — résultat">
        <div className="verdict ok">{score} / {QUIZ.length}</div>
        <button className="btn" onClick={() => { setI(0); setScore(0); setRep(null); }}>Recommencer</button>
      </Carte>
    );
  const m = QUIZ[i];
  const s = source(m.source);
  return (
    <Carte titre={`Vrai ou faux ? (${i + 1} / ${QUIZ.length})`}>
      <p className="affirmation">« {m.affirmation} »</p>
      {rep === null ? (
        <div className="choix">
          <button className="btn gros" onClick={() => { setRep(true); if (m.vrai) setScore(score + 1); }}>Vrai</button>
          <button className="btn gros" onClick={() => { setRep(false); if (!m.vrai) setScore(score + 1); }}>Faux</button>
        </div>
      ) : (
        <>
          <p className={rep === m.vrai ? "ok-texte" : "ko-texte"}><b>{rep === m.vrai ? "Bien vu." : "Raté."} C'est {m.vrai ? "vrai" : "faux"}.</b> {m.explication}</p>
          <p className="muted petit">Source : {s.lien ? <a href={s.lien} target="_blank" rel="noreferrer">{s.texte}</a> : s.texte}</p>
          <button className="btn primary" autoFocus onClick={() => { setI(i + 1); setRep(null); }}>Suivant</button>
        </>
      )}
    </Carte>
  );
}

export function Fiches() {
  const { arg } = useApp();
  const [ouverte, setOuverte] = useState<string | null>(arg ?? "exercices");
  const [quiz, setQuiz] = useState(false);
  if (quiz) return <div className="pile"><button className="btn petit retour" onClick={() => setQuiz(false)}>← Fiches</button><Quiz /></div>;
  return (
    <div className="pile">
      <Carte titre="Ce que dit la recherche">
        <p className="muted petit">Simplement, sans promesse en l'air. <Statut s="ok" /> = solidement prouvé · <Statut s="discute" /> = discuté ou prouvé en partie · <Statut s="mythe" /> = mythe.</p>
        <button className="btn primary" onClick={() => setQuiz(true)}>Quiz : vrai ou faux ? ({QUIZ.length} questions)</button>
      </Carte>
      {FICHES.map((f) => (
        <Carte key={f.id} className="fiche">
          <button className="fiche-tete" onClick={() => setOuverte(ouverte === f.id ? null : f.id)} aria-expanded={ouverte === f.id}>
            <span>{f.icone}</span> <b>{f.titre}</b> <em>{ouverte === f.id ? "▾" : "▸"}</em>
          </button>
          {ouverte === f.id && (
            <div>
              <ul className="points">{f.points.map((p) => <li key={p.texte}><Statut s={p.statut} /> <span>{p.texte}</span></li>)}</ul>
              <p className="dans-app">→ Dans l'app : {f.dansLApp}</p>
              <details><summary className="muted petit">Sources</summary><ul className="sources">{f.sources.map((id) => { const s = source(id); return <li key={id}>{s.lien ? <a href={s.lien} target="_blank" rel="noreferrer">{s.texte}</a> : s.texte}</li>; })}</ul></details>
            </div>
          )}
        </Carte>
      ))}
    </div>
  );
}

// ----- Sources ------------------------------------------------------------------------------------------------
export function Sources() {
  return (
    <div className="pile">
      <Carte titre="Sources">
        <p className="muted petit">Les études sur lesquelles s'appuient les fiches, les exercices et les règles de l'app. Chaque lien a été vérifié : il mène bien à l'article cité.</p>
        <ul className="sources liste-sources">
          {SOURCES.map((s) => <li key={s.id}>{s.lien ? <a href={s.lien} target="_blank" rel="noreferrer">{s.texte}</a> : s.texte}</li>)}
        </ul>
      </Carte>
      <Carte titre="Ce que l'app ne prétend pas">
        <ul className="guide">
          <li>Elle ne rend pas plus intelligent : on progresse surtout sur les exercices eux-mêmes.</li>
          <li>Les paliers de 15 à 50 minutes sont un choix pratique, pas une loi prouvée.</li>
          <li>Elle ne dit jamais que ta volonté est « épuisée » : cette idée n'a pas tenu aux réplications.</li>
        </ul>
      </Carte>
    </div>
  );
}

// ----- Progrès ------------------------------------------------------------------------------------------------
const signe = (x: number) => (x > 0 ? `+${x}` : `${x}`);

function Tests() {
  const { db, aller } = useApp();
  const t = db.tests;
  if (t.length === 0)
    return (
      <Carte titre="🎯 Tests (mêmes conditions à chaque fois)">
        <p className="muted">Pas encore de test de départ.</p>
        <button className="btn primary" onClick={() => aller("seance", "test")}>Faire le test de départ (2 min)</button>
      </Carte>
    );
  const depart = t[0];
  return (
    <Carte titre="🎯 Tests (mêmes conditions à chaque fois)">
      <p className="muted petit">1 min de « Trouver la cible » au niveau {TEST.niveauRecherche} + 1 min de « Flèche du milieu » au niveau {TEST.niveauFlanker}. Comme les conditions ne changent pas, la comparaison est honnête.</p>
      <div className="table-wrap">
        <table className="table-tests">
          <thead><tr><th>Date</th><th>Cibles</th><th>Temps cible</th><th>Flèches justes</th><th>Temps flèches</th><th>Coût des pièges</th></tr></thead>
          <tbody>
            {t.map((r) => {
              const c = r === depart ? null : comparerTests(depart, r);
              const d = (x: number | null, unite = "", inverse = false) => (c && x !== null ? <small className={(inverse ? x < 0 : x > 0) ? "ok-texte" : x === 0 ? "muted" : "ko-texte"}> ({signe(x)}{unite})</small> : null);
              return (
                <tr key={r.id}>
                  <td>{fmtDate(r.at)} <small className="muted">{r.sorte === "depart" ? "départ" : "suivi"}</small></td>
                  <td>{r.recherche.justes}{d(c?.trouvees ?? null)}</td>
                  <td>{fmtMs(r.recherche.ms)}{d(c?.msRecherche ?? null, " ms", true)}</td>
                  <td>{r.flanker.justes} / {r.flanker.total}{d(c?.reponsesFlanker ?? null)}</td>
                  <td>{fmtMs(r.flanker.ms)}{d(c?.msFlanker ?? null, " ms", true)}</td>
                  <td>{fmtMs(r.flanker.cout)}{d(c?.coutFlanker ?? null, " ms", true)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted petit">Entre parenthèses : l'écart avec ton test de départ (en vert quand c'est mieux). Une petite variation d'un jour à l'autre est normale.</p>
    </Carte>
  );
}

export function Progres() {
  const { db } = useApp();
  const b = bilanTravail(db.travaux);
  const minutes = db.travaux.slice(-20).map((s) => s.faites);
  return (
    <div className="pile">
      <Carte titre="En bref">
        <div className="chiffres-cles">
          <div><b>{serie(db, Date.now())}</b><span>jour(s) d'affilée</span></div>
          <div><b>{nbSeancesFinies(db)}</b><span>séance(s) du jour</span></div>
          <div><b>{b.minutes}</b><span>min de travail profond</span></div>
          <div><b>{minutesPalier(db.travail)}</b><span>min : palier actuel</span></div>
        </div>
      </Carte>
      <Tests />
      <Carte titre="⏱ Travail profond">
        <p>{plural(b.total, "séance", "séances")}, dont {b.reussies} réussie(s). Durée des dernières séances :</p>
        <Courbe valeurs={minutes} max={PALIERS[PALIERS.length - 1]} />
      </Carte>
      <Carte titre="Exercices">
        <div className="grille-progres">
          {EXOS.map((g) => {
            const h = historique(db, g.id, 40);
            const ms = h.filter((r) => r.ms !== undefined).map((r) => r.ms!);
            const couts = h.filter((r) => r.cout !== undefined).map((r) => r.cout!);
            return (
              <div key={g.id} className="progres-jeu">
                <b>{g.icone} {g.nom}</b>
                <span className="muted petit">Niveau {db.niveaux[g.id].level} · record {db.niveaux[g.id].best || "—"} · {plural(h.length, "manche", "manches")}</span>
                <span className="petit">Niveau :</span>
                <Courbe valeurs={h.map((r) => r.niveau)} max={g.max} />
                {ms.length >= 2 && <><span className="petit">Temps de réponse (dernier : {fmtMs(ms[ms.length - 1])}) :</span><Courbe valeurs={ms} couleur="var(--accent-2)" /></>}
                {couts.length >= 2 && <span className="muted petit">{g.id === "changement" ? "Coût par changement" : "Coût des pièges"} : {fmtMs(couts[couts.length - 1])} (dernière manche), {fmtMs(Math.round(couts.reduce((a, x) => a + x, 0) / couts.length))} en moyenne.</span>}
              </div>
            );
          })}
        </div>
        <p className="muted petit">Attention : le niveau monte, donc le temps de réponse peut augmenter alors que tu progresses (c'est plus dur). Pour une vraie comparaison, regarde les tests.</p>
      </Carte>
    </div>
  );
}

// ----- Réglages -----------------------------------------------------------------------------------------------
export function Reglages() {
  const { db, maj } = useApp();
  const [msg, setMsg] = useState("");
  const fichier = useRef<HTMLInputElement>(null);
  const set = (r: Partial<typeof db.reglages>) => maj((d) => ({ ...d, reglages: { ...d.reglages, ...r, maj: Date.now() } }));
  return (
    <div className="pile">
      <Carte titre="Réglages">
        <label className="champ">Durée de la séance du jour
          <select value={db.reglages.minutes} onChange={(e) => set({ minutes: Number(e.target.value) as 5 | 10 | 15 | 20 })}>
            <option value={5}>5 minutes (2 exercices)</option>
            <option value={10}>10 minutes (4 exercices, conseillé)</option>
            <option value={15}>15 minutes (les 5 exercices)</option>
            <option value={20}>20 minutes (les 5, plus longtemps)</option>
          </select>
        </label>
        <label className="champ">Palier de travail profond
          <select value={db.travail.palier} onChange={(e) => maj((d) => ({ ...d, travail: choisirPalier(Number(e.target.value), Date.now()) }))}>
            {PALIERS.map((m, k) => <option key={m} value={k}>{m} minutes</option>)}
          </select>
        </label>
        <label className="champ">Un nouveau jour commence à
          <select value={db.reglages.heureJour} onChange={(e) => set({ heureJour: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4, 5, 6].map((h) => <option key={h} value={h}>{h} h</option>)}
          </select>
        </label>
        <label className="case-a-cocher"><input type="checkbox" checked={db.reglages.sons} onChange={(e) => set({ sons: e.target.checked })} /> Sons (discrets)</label>
        <button className="btn petit" onClick={() => set({ introVue: false })}>Revoir la présentation</button>
      </Carte>
      <Carte titre="Mes données">
        <p className="muted petit">Une copie de toutes tes données dans un fichier JSON. L'importer ajoute son contenu au tien (rien n'est effacé).</p>
        <div className="choix">
          <button className="btn" onClick={async () => { const f = await saveExportFile(`rayans-focus-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db, null, 2)); if (f) setMsg(`Copie enregistrée : ${f}`); }}>Enregistrer une copie</button>
          <button className="btn" onClick={() => fichier.current?.click()}>Importer une copie</button>
          <input ref={fichier} type="file" accept=".json,application/json" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              const autre = parseDb(await f.text());
              maj((d) => fusionner(d, autre));
              setMsg(`Copie importée : ${autre.resultats.length} manche(s), ${autre.travaux.length} séance(s) de travail, ${autre.distractions.length} distraction(s).`);
            } catch (err) { setMsg(`Import impossible : ${(err as Error).message}`); }
          }} />
          <button className="btn" onClick={() => { if (confirm("Tout effacer (niveaux, tests, séances, journal) ? C'est définitif.") && confirm("Vraiment tout effacer ?")) maj(() => ({ ...emptyDb(), reglages: { ...emptyDb().reglages, introVue: true, maj: Date.now() } })); }}>Tout effacer</button>
        </div>
        {msg && <p className="muted petit">{msg}</p>}
      </Carte>
      <Carte titre="À propos">
        <p className="muted petit">Rayan's Focus · niveaux actuels : {EXOS.map((e) => `${exoInfo(e.id).nom} ${db.niveaux[e.id].level}/${e.max}`).join(" · ")}.</p>
      </Carte>
    </div>
  );
}
