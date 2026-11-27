// Pages : exercices libres, fiches, quiz, progrès, réglages.
import { useMemo, useState } from "react";
import { FICHES, QUIZ, SOURCES } from "../core/contenu";
import { prochaineRevision, serieTactiques } from "../core/espacement";
import { EXOS, exoInfo, type ExoId } from "../core/niveaux";
import { paramsMemoire } from "../core/positions";
import { makeRng, newId, randomSeed, shuffle } from "../core/rng";
import { serieJours } from "../core/seance";
import { bilanTactiques, historique, nbSeancesFinies, tauxReussite } from "../core/stats";
import { TACTIQUES, THEMES } from "../core/tactiques";
import { paramsVision } from "../core/vision";
import { saveExportFile } from "../storage";
import { ExoMemoire, ExoTactiques, ExoVision } from "../exercices";
import { Barre, Carte, Courbe, fmtDate, pct, plural, Statut, useApp } from "../ui";

function detailNiveau(id: ExoId, level: number): string {
  if (id === "memoire") {
    const p = paramsMemoire(level);
    return `${p.min === p.max ? p.max : `${p.min} à ${p.max}`} pièces, ${p.secondes} s pour regarder${p.pionsDonnes ? ", pions donnés" : ""}`;
  }
  if (id === "vision") {
    const p = paramsVision(level);
    return `${p.pieces} pièces ; questions : ${p.types.map((t) => ({ case: "cases contrôlées", attaquees: "pièces attaquées", defenseurs: "défenseurs" })[t]).join(", ")}`;
  }
  return `tactiques de niveau ${Math.min(3, Math.ceil(level / 2))} sur 3`;
}

export function Exercices() {
  const { db } = useApp();
  const [jeu, setJeu] = useState<ExoId | null>(null);
  const serie = useMemo(() => (jeu === "tactiques" ? serieTactiques(db, Date.now(), makeRng(randomSeed()), 6) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jeu]);
  if (jeu === "memoire") return <ExoMemoire nb={3} onFin={() => setJeu(null)} />;
  if (jeu === "vision") return <ExoVision nb={6} onFin={() => setJeu(null)} />;
  if (jeu === "tactiques") return <ExoTactiques serie={serie} onFin={() => setJeu(null)} />;
  return (
    <div className="pile">
      <h1>Exercices</h1>
      <p className="muted">Entraînement libre, en plus de la séance du jour. Les niveaux et les révisions sont les mêmes.</p>
      <div className="grille-jeux">
        {EXOS.map((e) => (
          <button key={e.id} className="jeu" onClick={() => setJeu(e.id)}>
            <span className="icone">{e.icone}</span>
            <b>{e.nom}</b>
            <em>{e.entraine}</em>
            <small>{e.regle}</small>
            <small className="pastille">Niveau {db.niveaux[e.id].level} / {e.max} — {detailNiveau(e.id, db.niveaux[e.id].level)}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Fiches() {
  const { arg } = useApp();
  const [ouverte, setOuverte] = useState<string | null>(arg ?? null);
  const src = (id: string) => SOURCES.find((s) => s.id === id)!;
  return (
    <div className="pile">
      <h1>Fiches</h1>
      <p className="muted">Ce que dit la recherche sur la mémoire et la vision aux échecs, sans exagérer. ✅ prouvé : solide et répliqué. ⚠️ discuté : réel mais limité ou contesté.</p>
      {FICHES.map((f) => (
        <section key={f.id} className="carte fiche">
          <button className="fiche-tete" onClick={() => setOuverte(ouverte === f.id ? null : f.id)}>
            <Statut s={f.statut} /> <b>{f.titre}</b>
            <em>{f.resume}</em>
          </button>
          {ouverte === f.id && (
            <div>
              {f.texte.map((t, i) => <p key={i}>{t}</p>)}
              <ul className="sources">
                {f.sources.map((s) => <li key={s}>{src(s).ref}{src(s).lien && <> — <a href={src(s).lien} target="_blank" rel="noreferrer">lien</a></>}</li>)}
              </ul>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

export function Quiz() {
  const { maj, aller, db } = useApp();
  const [questions, setQuestions] = useState(() => shuffle(makeRng(randomSeed()), QUIZ).slice(0, 8));
  const [i, setI] = useState(0);
  const [rep, setRep] = useState<boolean | null>(null);
  const [justes, setJustes] = useState(0);
  const q = questions[i];
  const dernier = db.quiz[db.quiz.length - 1];
  if (!q)
    return (
      <Carte titre="Quiz terminé">
        <p className="grand-chiffre">{justes} / {questions.length}</p>
        <div className="choix">
          <button className="btn primary" onClick={() => { setQuestions(shuffle(makeRng(randomSeed()), QUIZ).slice(0, 8)); setI(0); setJustes(0); setRep(null); }}>Recommencer</button>
          <button className="btn" onClick={() => aller("fiches")}>Lire les fiches</button>
        </div>
      </Carte>
    );
  const repondre = (v: boolean) => {
    if (rep !== null) return;
    setRep(v);
    const ok = v === q.vrai;
    const n = justes + (ok ? 1 : 0);
    setJustes(n);
    if (i + 1 >= questions.length) maj((d) => ({ ...d, quiz: [...d.quiz, { id: newId(), at: Date.now(), justes: n, total: questions.length }] }));
  };
  return (
    <div className="pile">
      <h1>Quiz : vrai ou faux ?</h1>
      {dernier && <p className="muted petit">Dernier quiz : {dernier.justes} / {dernier.total} ({fmtDate(dernier.at)}).</p>}
      <Carte titre={`Question ${i + 1} / ${questions.length}`}>
        <p className="affirmation">{q.affirmation}</p>
        <div className="choix">
          <button className="btn gros" disabled={rep !== null} onClick={() => repondre(true)}>Vrai</button>
          <button className="btn gros" disabled={rep !== null} onClick={() => repondre(false)}>Faux</button>
        </div>
        {rep !== null && (
          <>
            <p className={`verdict ${rep === q.vrai ? "ok" : "ko"}`}>{rep === q.vrai ? "Juste" : "Raté"} : c'est {q.vrai ? "vrai" : "faux"}.</p>
            <p>{q.explication}</p>
            <div className="choix">
              <button className="btn primary" onClick={() => { setI(i + 1); setRep(null); }}>{i + 1 >= questions.length ? "Voir le score" : "Suivante"}</button>
              <button className="btn petit" onClick={() => aller("fiches", q.fiche)}>La fiche</button>
            </div>
          </>
        )}
      </Carte>
    </div>
  );
}

export function Progres() {
  const { db } = useApp();
  const now = Date.now();
  const t = bilanTactiques(db);
  return (
    <div className="pile">
      <h1>Progrès</h1>
      <div className="chiffres-cles">
        <div><b>{serieJours(db, now)}</b><span>jours de suite</span></div>
        <div><b>{nbSeancesFinies(db)}</b><span>séances finies</span></div>
        <div><b>{t.vues} / {TACTIQUES.length}</b><span>tactiques vues</span></div>
        <div><b>{t.solides}</b><span>tactiques solides (J+7 passé)</span></div>
      </div>
      <div className="grille-progres">
        {EXOS.map((e) => {
          const h = historique(db, e.id, 30);
          const taux = tauxReussite(db, e.id);
          return (
            <Carte key={e.id} className="progres-jeu" titre={`${e.icone} ${e.nom}`}>
              <p>Niveau <b>{db.niveaux[e.id].level}</b> / {e.max} (meilleur : {Math.max(db.niveaux[e.id].best, db.niveaux[e.id].level)})</p>
              <p className="muted petit">{detailNiveau(e.id, db.niveaux[e.id].level)}</p>
              <Courbe valeurs={h.map((r) => r.niveau)} max={exoInfo(e.id).max} />
              <p className="petit">{taux === null ? "Pas encore de manche." : `Réussite sur les 20 dernières manches : ${pct(taux)} (le but est d'être autour de 70 %).`}</p>
              {e.id === "memoire" && h.length > 0 && <p className="petit">Dernières positions : {h.slice(-5).map((r) => `${r.score}/${r.max}`).join(" · ")}</p>}
            </Carte>
          );
        })}
      </div>
      <Carte titre="Tactiques en révision">
        {t.vues === 0 ? <p className="muted">Pas encore de tactique vue.</p> : (
          <ul className="liste-tactiques">
            {TACTIQUES.filter((x) => db.cartes[x.id]).sort((a, b) => (db.cartes[a.id].due ?? Infinity) - (db.cartes[b.id].due ?? Infinity)).map((x) => {
              const c = db.cartes[x.id];
              return (
                <li key={x.id}>
                  <span>{THEMES[x.theme].nom} <span className="muted petit">({x.id})</span></span>
                  <Barre part={c.etape / 7} />
                  <em>{c.reussites}/{c.essais} · {prochaineRevision(c, now, db.reglages.heureJour)}</em>
                </li>
              );
            })}
          </ul>
        )}
      </Carte>
    </div>
  );
}

export function Reglages() {
  const { db, maj } = useApp();
  const r = db.reglages;
  const [msg, setMsg] = useState<string | null>(null);
  const changer = (x: Partial<typeof r>) => maj((d) => ({ ...d, reglages: { ...d.reglages, ...x, maj: Date.now() } }));
  const exporter = async () => {
    try {
      const p = await saveExportFile(`echecs-vision-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db, null, 2));
      setMsg(p ? `Copie enregistrée : ${p}` : null);
    } catch (e) { setMsg(`Export impossible : ${String(e)}`); }
  };
  return (
    <div className="pile">
      <h1>Réglages</h1>
      <Carte>
        <label className="case-a-cocher"><input type="checkbox" checked={r.sons} onChange={(e) => changer({ sons: e.target.checked })} /> Sons (juste / faux)</label>
        <label className="case-a-cocher"><input type="checkbox" checked={r.coordonnees} onChange={(e) => changer({ coordonnees: e.target.checked })} /> Coordonnées au bord de l'échiquier</label>
        <label className="champ">Le nouveau jour commence à
          <select value={r.heureJour} onChange={(e) => changer({ heureJour: Number(e.target.value) })}>
            {Array.from({ length: 13 }, (_, h) => <option key={h} value={h}>{h} h</option>)}
          </select>
        </label>
      </Carte>
      <Carte titre="Données">
        <p className="muted petit">Tout reste sur cet appareil (et se synchronise avec l'iPhone si Rayan's Mobile est utilisé).</p>
        <button className="btn" onClick={exporter}>Exporter une copie (JSON)</button>
        {msg && <p className="petit">{msg}</p>}
      </Carte>
      <Carte titre="À propos">
        <p className="petit">Échiquier : chessground (lichess, licence GPL-3.0). Règles et vérifications : chess.js (licence BSD-2). Pièces « cburnett » (licence GPL).</p>
        <p className="petit muted">{plural(TACTIQUES.length, "tactique", "tactiques")} dans la banque, toutes vérifiées automatiquement.</p>
      </Carte>
    </div>
  );
}
