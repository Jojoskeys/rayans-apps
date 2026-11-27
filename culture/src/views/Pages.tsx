// Actualité, Fiches (et quiz), Progrès, Sources, Réglages.
import { useRef, useState } from "react";
import { jourFr } from "../core/actu";
import { FICHES, QUIZ, source, SOURCES } from "../core/contenu";
import { emptyDb, fusionner, parseDb } from "../core/model";
import { BANQUE, nomTheme, THEMES } from "../core/questions";
import { bilan, FRAICHEUR_ACTU_JOURS, NOMS_NIVEAUX, serie } from "../core/seance";
import { choisirFichierActu, isTauri, saveExportFile } from "../storage";
import { Barre, Barres, Carte, pct, plural, Statut, useApp } from "../ui";

// ----- Actualité ----------------------------------------------------------------------------------------------
export function PageActu() {
  const { db, maj, actu, relireActu, importerTexteActu } = useApp();
  const fichier = useRef<HTMLInputElement>(null);
  const parJour = new Map<string, { n: number; vues: number; justes: number; reponses: number }>();
  for (const c of db.cartes) {
    if (!c.jour) continue;
    const x = parJour.get(c.jour) ?? { n: 0, vues: 0, justes: 0, reponses: 0 };
    x.n++;
    if (c.vues > 0) x.vues++;
    x.justes += c.justes;
    x.reponses += c.vues;
    parJour.set(c.jour, x);
  }
  const jours = [...parJour.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const choisir = async () => {
    if (!isTauri) { fichier.current?.click(); return; }
    const p = await choisirFichierActu();
    if (!p) return;
    maj((d) => ({ ...d, reglages: { ...d.reglages, cheminActu: p, maj: Date.now() } }));
    await relireActu(p);
  };
  return (
    <div className="pile">
      <Carte titre="📰 L'actualité de « Ton monde »">
        <p className="muted petit">Chaque matin, le veilleur prépare l'édition « Ton monde » (les sujets du jour, avec leurs médias). L'app la lit <b>sans jamais la modifier</b> et en tire quelques questions simples, sans IA : quelle rubrique, quel média, de quel sujet parle ce résumé, un seul média ou plusieurs… Ces questions entrent ensuite dans tes révisions.</p>
        <ul className="points">
          <li><span>📂</span> <span>Fichier lu : <code>{actu.ou || "—"}</code></span></li>
          <li><span>🗓️</span> <span>{actu.jours.length ? `Éditions trouvées : ${actu.jours.map(jourFr).join(", ")}.` : "Aucune édition trouvée pour l'instant."}{actu.lu && actu.ajoutees > 0 ? ` ${plural(actu.ajoutees, "nouvelle question ajoutée", "nouvelles questions ajoutées")}.` : ""}</span></li>
        </ul>
        {actu.erreur && <p className="ko-texte petit">Lecture impossible : {actu.erreur}</p>}
        <div className="choix" style={{ justifyContent: "flex-start" }}>
          {(isTauri || actu.ou.includes("synchronisé")) && <button className="btn" onClick={() => void relireActu()}>Relire le fichier</button>}
          <button className="btn" onClick={() => void choisir()}>Choisir un fichier…</button>
          {db.reglages.cheminActu && <button className="btn" onClick={() => { maj((d) => ({ ...d, reglages: { ...d.reglages, cheminActu: "", maj: Date.now() } })); void relireActu(""); }}>Revenir à l'emplacement habituel</button>}
          <input ref={fichier} type="file" accept=".json,application/json" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) importerTexteActu(await f.text());
          }} />
        </div>
        <p className="muted petit">Sans fichier d'actualité, l'app marche quand même : la banque de culture générale ({BANQUE.length} questions) prend le relais. Les questions d'une édition ne sont proposées comme nouvelles que pendant {FRAICHEUR_ACTU_JOURS} jours.</p>
      </Carte>
      <Carte titre="Questions tirées de l'actu">
        {jours.length === 0 ? <p className="muted">Pas encore de question d'actualité.</p> : (
          <ul className="liste-seances">
            {jours.map(([j, x]) => (
              <li key={j}><span>{jourFr(j)}</span> <span className="muted petit">{plural(x.n, "question", "questions")} · {x.vues} vue{x.vues > 1 ? "s" : ""}</span> <em>{x.reponses ? `${pct(x.justes / x.reponses)} de bonnes réponses` : "pas encore faites"}</em></li>
            ))}
          </ul>
        )}
      </Carte>
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
          <p className={rep === m.vrai ? "ok-texte" : "ko-texte"}><b>{rep === m.vrai ? "Bien vu." : "Raté."}</b> {m.explication}</p>
          <p className="muted petit">Source : {s.lien ? <a href={s.lien} target="_blank" rel="noreferrer">{s.texte}</a> : s.texte}</p>
          <button className="btn primary" autoFocus onClick={() => { setI(i + 1); setRep(null); }}>Suivant</button>
        </>
      )}
    </Carte>
  );
}

export function Fiches() {
  const { arg } = useApp();
  const [ouverte, setOuverte] = useState<string | null>(arg ?? "test");
  const [quiz, setQuiz] = useState(false);
  if (quiz) return <div className="pile"><button className="btn petit retour" onClick={() => setQuiz(false)}>← Fiches</button><Quiz /></div>;
  return (
    <div className="pile">
      <Carte titre="Ce que dit la recherche">
        <p className="muted petit">Simplement, sans promesse en l'air. <Statut s="ok" /> = solidement prouvé · <Statut s="discute" /> = discuté ou prouvé en partie.</p>
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
        <p className="muted petit">Les études sur lesquelles s'appuient les fiches et les règles de l'app. Chaque lien a été vérifié : il mène bien à l'article cité.</p>
        <ul className="sources liste-sources">
          {SOURCES.map((s) => <li key={s.id}>{s.lien ? <a href={s.lien} target="_blank" rel="noreferrer">{s.texte}</a> : s.texte}</li>)}
        </ul>
      </Carte>
      <Carte titre="Ce que l'app ne prétend pas">
        <ul className="guide">
          <li>Elle ne remplace pas la lecture des articles : les questions d'actu ne retiennent que le titre, le média et une phrase.</li>
          <li>Les écarts de révision (1, 3, 7, 14, 30, 60, 120 jours) sont un choix pratique, pas une loi prouvée.</li>
          <li>Les réponses de la banque sont des faits stables ; si l'un d'eux change (un record, une population), l'explication donne la date.</li>
        </ul>
      </Carte>
    </div>
  );
}

// ----- Progrès ------------------------------------------------------------------------------------------------
export function Progres() {
  const { db } = useApp();
  const now = Date.now();
  const b = bilan(db, now);
  const jours = ["auj.", "dem.", "J+2", "J+3", "J+4", "J+5", "J+6"];
  return (
    <div className="pile">
      <Carte titre="📈 Tes progrès">
        <div className="chiffres-cles">
          <div><b>{serie(db, now)}</b><span>jours de suite</span></div>
          <div><b>{b.reponses}</b><span>réponses en tout</span></div>
          <div><b>{pct(b.reussite7)}</b><span>de bonnes réponses (7 jours)</span></div>
          <div><b>{NOMS_NIVEAUX[db.niveau.level]}</b><span>niveau actuel (record : {NOMS_NIVEAUX[db.niveau.best].toLowerCase()})</span></div>
          <div><b>{b.enRevision}</b><span>questions en révision</span></div>
          <div><b>{b.apprises}</b><span>questions apprises</span></div>
        </div>
      </Carte>
      <Carte titre="Réussite, jour par jour (14 jours)">
        {b.reponses === 0 ? <p className="muted">Fais ta première séance pour voir ta courbe.</p> : <>
          <Barres valeurs={b.parJour.map((j) => j.part)} etiquettes={b.parJour.map((j) => j.jour.slice(8))} max={1} />
          <p className="muted petit">Une barre = la part de bonnes réponses ce jour-là. Comme le niveau monte quand tu réussis, une réussite autour de 70 % est normale : c'est le bon niveau de difficulté.</p>
        </>}
      </Carte>
      <Carte titre="Révisions des 7 prochains jours">
        <Barres valeurs={b.aVenir} etiquettes={jours} />
      </Carte>
      <Carte titre="Par thème">
        {b.parTheme.length === 0 ? <p className="muted">Pas encore de réponse.</p> : (
          <div className="stats-types">
            {b.parTheme.map((t) => (
              <div key={t.theme} className="stat-type">
                <span>{THEMES.find((x) => x.id === t.theme)?.icone} {nomTheme(t.theme)}</span>
                <Barre part={t.justes / t.n} />
                <b>{pct(t.justes / t.n)}</b>
              </div>
            ))}
          </div>
        )}
        <p className="muted petit">Banque de culture générale : {b.banqueVue} / {BANQUE.length} questions déjà vues · actualité : {b.actuVues} questions vues.</p>
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
        <label className="champ">Questions par séance (à partir de demain)
          <select value={db.reglages.questions} onChange={(e) => set({ questions: Number(e.target.value) as 6 | 10 | 14 })}>
            <option value={6}>6 questions (3 minutes)</option>
            <option value={10}>10 questions (5 minutes, conseillé)</option>
            <option value={14}>14 questions (7 minutes)</option>
          </select>
        </label>
        <label className="champ">Questions d'actualité, au plus, par séance
          <select value={db.reglages.actuParSeance} onChange={(e) => set({ actuParSeance: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n === 0 ? "Aucune" : n}</option>)}
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
          <button className="btn" onClick={async () => { const f = await saveExportFile(`rayans-culture-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db, null, 2)); if (f) setMsg(`Copie enregistrée : ${f}`); }}>Enregistrer une copie</button>
          <button className="btn" onClick={() => fichier.current?.click()}>Importer une copie</button>
          <input ref={fichier} type="file" accept=".json,application/json" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              const autre = parseDb(await f.text());
              maj((d) => fusionner(d, autre));
              setMsg(`Copie importée : ${autre.reponses.length} réponse(s), ${autre.cartes.length} question(s) en révision.`);
            } catch (err) { setMsg(`Import impossible : ${(err as Error).message}`); }
          }} />
          <button className="btn" onClick={() => { if (confirm("Tout effacer (révisions, réponses, niveau) ? C'est définitif.") && confirm("Vraiment tout effacer ?")) maj(() => ({ ...emptyDb(), reglages: { ...emptyDb().reglages, introVue: true, maj: Date.now() } })); }}>Tout effacer</button>
        </div>
        {msg && <p className="muted petit">{msg}</p>}
      </Carte>
      <Carte titre="À propos">
        <p className="muted petit">Rayan's Culture · {BANQUE.length} questions de culture générale · niveau {NOMS_NIVEAUX[db.niveau.level].toLowerCase()} · {plural(db.cartes.length, "question suivie", "questions suivies")}.</p>
      </Carte>
    </div>
  );
}
