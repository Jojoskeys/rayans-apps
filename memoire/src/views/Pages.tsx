// Accueil, Jeux, Atelier, Apprendre, Progrès, Réglages.
import { useState } from "react";
import { MAJOR_SONS, majorCle } from "../core/contenu";
import { listesDues } from "../core/espacement";
import { FICHES, MYTHES } from "../core/lecons";
import { emptyDb } from "../core/model";
import { GAMES, type GameId } from "../core/niveaux";
import { JOURS_TEST, SEMAINES, seanceDuJour, serie, TECHNIQUES, type TechniqueId } from "../core/programme";
import { historique, motMajor, nbSeancesFinies, tests } from "../core/stats";
import { Partie } from "../jeux";
import { saveExportFile } from "../storage";
import { MajorApprendre, Technique } from "../techniques";
import { avecResultat, Barre, Carte, Courbe, fmtDate, plural, useApp } from "../ui";

// ----- Accueil ------------------------------------------------------------------------------------------------
export function Accueil() {
  const { db, aller } = useApp();
  const now = Date.now();
  const s = seanceDuJour(db, now);
  const dues = listesDues(db.listes, now).length;
  const palais = db.palais.filter((p) => !p.deleted);
  const faites = s.etapes.filter((e) => s.faites.includes(e.id)).length;
  const minutes = s.etapes.reduce((a, e) => a + e.minutes, 0);
  return (
    <div className="pile">
      <Carte className="hero">
        <div className="hero-tete">
          <div>
            <h1>{s.finie ? "Séance du jour faite ✓" : "Ta séance du jour"}</h1>
            <p className="muted">
              {s.jourProgramme === null ? "Programme de 6 semaines : on commence par un petit test." : s.semaine ? `Semaine ${s.semaine.numero} / 6 — ${s.semaine.titre} (jour ${s.jourProgramme + 1})` : "Programme terminé : séances d'entretien."}
            </p>
          </div>
          <div className="serie" title="Jours d'affilée avec une séance terminée"><b>{serie(db, now)}</b><span>🔥 jours</span></div>
        </div>
        <ol className="etapes-apercu">
          {s.etapes.map((e) => (
            <li key={e.id} className={s.faites.includes(e.id) ? "faite" : ""}>
              {s.faites.includes(e.id) ? "✓" : "○"} {e.titre}
              {e.id === "echauffement" && <span className="muted"> — {GAMES.find((g) => g.id === s.echauffement)!.nom}</span>}
              {e.id === "revisions" && <span className="muted"> — {dues ? plural(dues, "liste", "listes") : "rien de prévu"}</span>}
              <em>{e.minutes} min</em>
            </li>
          ))}
        </ol>
        <Barre part={faites / s.etapes.length} />
        <div className="choix">
          <button className="btn primary gros" onClick={() => aller("seance")}>{s.finie ? "Revoir la séance" : faites ? "Continuer" : `Commencer (${minutes} min)`}</button>
        </div>
        {s.semaine && <p className="muted petit">Objectif de la semaine : {s.semaine.objectif}</p>}
      </Carte>
      <div className="tuiles">
        <button className="tuile" onClick={() => aller("palais")}><span>🏛️</span><b>Palais</b><em>{palais.length ? plural(palais.length, "palais", "palais") : "à construire"}{dues ? ` · ${dues} à réviser` : ""}</em></button>
        <button className="tuile" onClick={() => aller("jeux")}><span>🎮</span><b>Jeux</b><em>10 jeux qui s'adaptent</em></button>
        <button className="tuile" onClick={() => aller("atelier")}><span>🧰</span><b>Atelier</b><em>Major, visages, vocabulaire…</em></button>
        <button className="tuile" onClick={() => aller("apprendre")}><span>📚</span><b>Comprendre</b><em>La science, les mythes</em></button>
        <button className="tuile" onClick={() => aller("progres")}><span>📈</span><b>Progrès</b><em>{nbSeancesFinies(db)} séance(s)</em></button>
      </div>
    </div>
  );
}

// ----- Jeux ---------------------------------------------------------------------------------------------------
export function Jeux() {
  const { db, arg, aller } = useApp();
  const [jeu, setJeu] = useState<GameId | null>((arg as GameId) ?? null);
  if (jeu) return <Partie key={jeu} jeu={jeu} onQuitter={() => { setJeu(null); if (arg) aller("jeux"); }} />;
  const familles: [string, string, GameInfoFamille][] = [
    ["Mémoire de travail", "Garder et manipuler quelques éléments pendant quelques secondes. Parfait en échauffement.", "travail"],
    ["Vers la mémoire à long terme", "Là où les techniques (palais, Major, visages) font la différence.", "long-terme"],
  ];
  return (
    <div className="pile">
      {familles.map(([t, d, f]) => (
        <Carte key={f} titre={t}>
          <p className="muted petit">{d}</p>
          <div className="grille-jeux">
            {GAMES.filter((g) => g.famille === f).map((g) => {
              const l = db.niveaux[g.id];
              return (
                <button key={g.id} className="jeu" onClick={() => setJeu(g.id)}>
                  <span className="icone">{g.icone}</span>
                  <b>{g.nom}</b>
                  <em>Niveau {l.level}{l.best ? ` · record ${l.best}` : ""}</em>
                  <small>{g.entraine}</small>
                </button>
              );
            })}
          </div>
        </Carte>
      ))}
      <p className="muted petit centre">Les jeux entraînent surtout… les jeux. Les techniques, elles, servent partout : voir « Comprendre ».</p>
    </div>
  );
}
type GameInfoFamille = "travail" | "long-terme";

// ----- Atelier ------------------------------------------------------------------------------------------------
const ATELIER: { id: TechniqueId; fiche: string }[] = [
  { id: "palais-concrets", fiche: "palais" },
  { id: "palais-abstraits", fiche: "images" },
  { id: "histoire", fiche: "autres" },
  { id: "crochets", fiche: "autres" },
  { id: "visages", fiche: "noms" },
  { id: "major-apprendre", fiche: "major" },
  { id: "major-nombre", fiche: "major" },
  { id: "mot-cle", fiche: "vocabulaire" },
  { id: "championnat", fiche: "palais" },
];

function TableMajor() {
  const { db, maj } = useApp();
  return (
    <Carte titre="Mes mots Major (00 à 99)">
      <p className="muted petit">Sons : {MAJOR_SONS.map((s) => `${s.chiffre} = ${s.sons}`).join(" · ")}. Change un mot qui ne te parle pas (garde les mêmes sons). Appris : {db.major.connus} / 100.</p>
      <div className="major-table">
        {Array.from({ length: 100 }, (_, n) => (
          <label key={n} className={n < db.major.connus ? "appris" : ""}>
            <b>{majorCle(n)}</b>
            <input defaultValue={motMajor(db, n)} onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== motMajor(db, n)) maj((d) => ({ ...d, major: { ...d.major, mots: { ...d.major.mots, [majorCle(n)]: v }, updatedAt: Date.now() } }));
            }} />
          </label>
        ))}
      </div>
    </Carte>
  );
}

export function Atelier() {
  const { aller } = useApp();
  const [t, setT] = useState<TechniqueId | "table-major" | null>(null);
  if (t === "table-major") return <div className="pile"><button className="btn petit" onClick={() => setT(null)}>← Atelier</button><TableMajor /></div>;
  if (t === "major-apprendre") return <MajorApprendre onFin={() => setT(null)} />;
  if (t) return <div className="pile"><button className="btn petit" onClick={() => setT(null)}>← Atelier</button><Technique key={t} id={t} onFin={() => setT(null)} /></div>;
  return (
    <div className="pile">
      <Carte titre="L'atelier des techniques">
        <p className="muted petit">Chaque technique, quand tu veux, en plus de la séance du jour. Pour tes cours et le Coran : range tes propres listes dans un palais (onglet Palais → « Ranger ma propre liste »), elles seront révisées à J+1, J+3, J+7…</p>
        <div className="grille-jeux">
          {ATELIER.map(({ id, fiche }) => (
            <div key={id} className="jeu">
              <b>{TECHNIQUES[id].titre}</b>
              <small>{TECHNIQUES[id].resume}</small>
              <div className="choix">
                <button className="btn primary petit" onClick={() => setT(id)}>S'entraîner</button>
                <button className="btn petit" onClick={() => aller("apprendre", fiche)}>Comprendre</button>
              </div>
            </div>
          ))}
          <div className="jeu">
            <b>Ma table Major</b>
            <small>Voir et changer tes 100 mots du système Major.</small>
            <div className="choix"><button className="btn petit" onClick={() => setT("table-major")}>Ouvrir</button></div>
          </div>
        </div>
      </Carte>
    </div>
  );
}

// ----- Apprendre ----------------------------------------------------------------------------------------------
function QuizMythes() {
  const { maj } = useApp();
  const [i, setI] = useState(0);
  const [rep, setRep] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  if (i >= MYTHES.length)
    return (
      <Carte titre="Vrai ou faux ? — résultat">
        <div className="verdict ok">{score} / {MYTHES.length}</div>
        <button className="btn" onClick={() => { setI(0); setScore(0); setRep(null); }}>Recommencer</button>
      </Carte>
    );
  const m = MYTHES[i];
  const repondre = (v: boolean) => {
    setRep(v);
    if (v === m.vrai) setScore(score + 1);
  };
  const suivant = () => {
    if (i + 1 === MYTHES.length) maj((d) => avecResultat(d, { jeu: "quiz", niveau: MYTHES.length, score: score, max: MYTHES.length, reussi: score >= MYTHES.length * 0.8 }));
    setI(i + 1);
    setRep(null);
  };
  return (
    <Carte titre={`Vrai ou faux ? (${i + 1} / ${MYTHES.length})`}>
      <p className="affirmation">« {m.affirmation} »</p>
      {rep === null ? (
        <div className="choix"><button className="btn" onClick={() => repondre(true)}>Vrai</button><button className="btn" onClick={() => repondre(false)}>Faux</button></div>
      ) : (
        <>
          <p className={rep === m.vrai ? "ok-texte" : "ko-texte"}>{rep === m.vrai ? "Bien vu." : "Raté."} {m.explication}</p>
          {m.source && <p className="muted petit">Source : {m.source.lien ? <a href={m.source.lien} target="_blank" rel="noreferrer">{m.source.texte}</a> : m.source.texte}</p>}
          <button className="btn primary" onClick={suivant} autoFocus>Suivant</button>
        </>
      )}
    </Carte>
  );
}

export function Apprendre() {
  const { arg } = useApp();
  const [ouverte, setOuverte] = useState<string | null>(arg ?? "etapes");
  const [quiz, setQuiz] = useState(false);
  if (quiz) return <div className="pile"><button className="btn petit" onClick={() => setQuiz(false)}>← Comprendre</button><QuizMythes /></div>;
  return (
    <div className="pile">
      <Carte titre="Comprendre ta mémoire">
        <p className="muted petit">Ce que dit la recherche, simplement. ✅ = solidement prouvé, ⚠️ = discuté ou prouvé en partie.</p>
        <button className="btn primary" onClick={() => setQuiz(true)}>Quiz : vrai ou faux ? ({MYTHES.length} questions)</button>
      </Carte>
      {FICHES.map((f) => (
        <Carte key={f.id} className="fiche">
          <button className="fiche-tete" onClick={() => setOuverte(ouverte === f.id ? null : f.id)} aria-expanded={ouverte === f.id}>
            <span>{f.icone}</span> <b>{f.titre}</b> <em>{ouverte === f.id ? "▾" : "▸"}</em>
          </button>
          {ouverte === f.id && (
            <div>
              {f.paragraphes.map((p) => <p key={p}>{p}</p>)}
              <p className="dans-app">→ Dans l'app : {f.dansLApp}</p>
              <details><summary className="muted petit">Sources</summary><ul className="sources">{f.sources.map((s) => <li key={s.texte}>{s.lien ? <a href={s.lien} target="_blank" rel="noreferrer">{s.texte}</a> : s.texte}</li>)}</ul></details>
            </div>
          )}
        </Carte>
      ))}
      <Carte titre="Le programme de 6 semaines">
        <ol className="programme">{SEMAINES.map((s) => <li key={s.numero}><b>Semaine {s.numero} — {s.titre}.</b> {s.objectif}</li>)}</ol>
        <p className="muted petit">Tests : {JOURS_TEST.map((t) => `${t.nom} (jour ${t.jour + 1})`).join(", ")}, comme dans l'étude de Dresler (2017), qui faisait environ 30 min par jour. Avec 15 min, compte un peu plus de temps pour les mêmes résultats.</p>
      </Carte>
    </div>
  );
}

// ----- Progrès ------------------------------------------------------------------------------------------------
export function Progres() {
  const { db } = useApp();
  const t = tests(db);
  const palais = historique(db, "palais", 40);
  return (
    <div className="pile">
      <Carte titre="Tests (20 mots en 2 minutes)">
        {t.length === 0 ? <p className="muted">Le test de départ se fait au début de ta première séance.</p> : (
          <ul className="tests">{t.map((r) => <li key={r.id}><b>{r.detail}</b> — {fmtDate(r.at)} : <b>{r.score} / {r.max}</b><Barre part={r.score / r.max} /></li>)}</ul>
        )}
      </Carte>
      <Carte titre="Palais et listes">
        <p>{plural(palais.length, "rappel", "rappels")} récents — moyenne {palais.length ? Math.round((palais.reduce((a, r) => a + r.score / r.max, 0) / palais.length) * 100) : 0} % retrouvés.</p>
        <Courbe valeurs={palais.map((r) => Math.round((r.score / r.max) * 100))} max={100} />
        <p className="muted petit">Major : {db.major.connus} / 100 nombres appris. Séances terminées : {nbSeancesFinies(db)}. Série actuelle : {serie(db, Date.now())} jour(s).</p>
      </Carte>
      <Carte titre="Jeux">
        <div className="grille-progres">
          {GAMES.map((g) => {
            const h = historique(db, g.id, 40);
            return (
              <div key={g.id} className="progres-jeu">
                <b>{g.icone} {g.nom}</b>
                <span className="muted petit">Niveau {db.niveaux[g.id].level} · record {db.niveaux[g.id].best || "—"} · {plural(h.length, "manche", "manches")}{g.repere ? ` · repère : ${g.repere}` : ""}</span>
                <Courbe valeurs={h.map((r) => r.niveau)} />
              </div>
            );
          })}
        </div>
      </Carte>
    </div>
  );
}

// ----- Réglages -----------------------------------------------------------------------------------------------
export function Reglages() {
  const { db, maj } = useApp();
  const [msg, setMsg] = useState("");
  const set = (r: Partial<typeof db.reglages>) => maj((d) => ({ ...d, reglages: { ...d.reglages, ...r, updatedAt: Date.now() } }));
  return (
    <div className="pile">
      <Carte titre="Réglages">
        <label className="champ">Durée de la séance du jour
          <select value={db.reglages.minutes} onChange={(e) => set({ minutes: Number(e.target.value) as 5 | 15 | 30 })}>
            <option value={5}>5 minutes (jours chargés)</option>
            <option value={15}>15 minutes (conseillé)</option>
            <option value={30}>30 minutes (comme l'étude de 2017)</option>
          </select>
        </label>
        <label className="champ">Un nouveau jour commence à
          <select value={db.reglages.heureJour} onChange={(e) => set({ heureJour: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4, 5, 6].map((h) => <option key={h} value={h}>{h} h</option>)}
          </select>
        </label>
        <label className="case-a-cocher"><input type="checkbox" checked={db.reglages.sons} onChange={(e) => set({ sons: e.target.checked })} /> Sons</label>
      </Carte>
      <Carte titre="Mes données">
        <div className="choix">
          <button className="btn" onClick={async () => { const f = await saveExportFile(`rayans-memoire-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db, null, 2)); if (f) setMsg(`Copie enregistrée : ${f}`); }}>Enregistrer une copie</button>
          <button className="btn" onClick={() => { if (confirm("Recommencer le programme de 6 semaines au jour 1 ? Tes palais, listes et niveaux sont gardés.")) maj((d) => ({ ...d, debutProgramme: null, resultats: d.resultats.filter((r) => r.jeu !== "test-mots") })); }}>Recommencer le programme</button>
          <button className="btn" onClick={() => { if (confirm("Tout effacer (palais, listes, scores) ? C'est définitif.") && confirm("Vraiment tout effacer ?")) maj(() => emptyDb()); }}>Tout effacer</button>
        </div>
        {msg && <p className="muted petit">{msg}</p>}
      </Carte>
    </div>
  );
}
