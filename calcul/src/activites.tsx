// Les activités, utilisées par la séance du jour et par l'onglet Exercices : entraînement, estimation,
// astuce (explication + 10 exercices), défi, test.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { astuceInfo, exercicesAstuce } from "./core/astuces";
import { defiInfo, meilleurScore, nomTest, questionDefi, questionsTest, scoreDefi, type DefiId } from "./core/defis";
import { appliquerReponse, questionEstimation, prochaineQuestion } from "./core/entrainement";
import { apresReponse } from "./core/espacement";
import { fmt, type AstuceId, type Question } from "./core/question";
import { makeRng, randomSeed } from "./core/rng";
import { comparerTests, justesse } from "./core/stats";
import { Serie, type SerieStats } from "./serie";
import { avecResultat, Carte, plural, useApp } from "./ui";

const MSG_SANS_CHRONO = "Pas de chrono ici : prends ton temps, la vitesse vient toute seule avec la pratique. (Réglable dans Réglages.)";

/** Un message selon la réussite : viser 70 à 85 %, c'est la bonne zone. */
export function messageReussite(part: number): string {
  if (part >= 0.9) return "Très bien ! Le niveau monte : c'est fait pour rester un peu difficile.";
  if (part >= 0.7) return "Pile dans la bonne zone : difficile mais réussissable. C'est là qu'on progresse le plus.";
  if (part >= 0.5) return "C'était costaud. Le niveau s'ajuste pour que ça reste utile — les erreurs font partie de l'entraînement.";
  return "C'était trop dur : le niveau baisse pour revenir dans une zone où tu réussis souvent. Rien de grave, c'est fait pour ça.";
}

export function Bilan({ s, titre, children, onContinuer, libelle = "Continuer" }: { s: SerieStats; titre: string; children?: ReactNode; onContinuer: () => void; libelle?: string }) {
  const rates = s.reponses.filter((r) => !r.juste);
  return (
    <Carte titre={titre}>
      {s.total === 0 ? <p className="muted">Aucun calcul fait cette fois-ci.</p> : (
        <>
          <div className="chiffres-bilan">
            <div><b>{s.bonnes} / {s.total}</b><span>justes ({justesse(s)} %)</span></div>
            <div><b>{(s.tempsMoyenMs / 1000).toFixed(1)} s</b><span>par calcul en moyenne</span></div>
          </div>
          <p>{messageReussite(s.bonnes / s.total)}</p>
          {rates.length > 0 && (
            <details>
              <summary className="muted petit">{plural(rates.length, "calcul raté", "calculs ratés")} (ils reviendront plus tard)</summary>
              <ul className="rates">{rates.map((r, i) => <li key={i}>{r.q.texte} = <b>{fmt(r.q.reponse)}</b></li>)}</ul>
            </details>
          )}
        </>
      )}
      {children}
      <div className="choix"><button className="btn primary" onClick={onContinuer} autoFocus>{libelle}</button></div>
    </Carte>
  );
}

// ----- Entraînement adaptatif -----------------------------------------------------------------------------------
export function Entrainement({ secondes, surFin }: { secondes?: number; surFin: (s: SerieStats) => void }) {
  const { db, maj } = useApp();
  const rng = useMemo(() => makeRng(randomSeed()), []);
  const [bilan, setBilan] = useState<SerieStats | null>(null);
  if (bilan) return <Bilan s={bilan} titre="Entraînement terminé" onContinuer={() => surFin(bilan)} />;
  return (
    <Serie
      titre="Entraînement mélangé"
      sousTitre={db.reglages.chrono ? "Les types de calculs sont mélangés exprès : c'est plus dur sur le moment, mieux retenu ensuite." : MSG_SANS_CHRONO}
      fin={secondes ? { secondes } : { libre: true }}
      chronoVisible={db.reglages.chrono}
      reposer
      suivante={(deja: Question[]) => prochaineQuestion(db, deja, Date.now(), rng)}
      surReponse={(r) => maj((d) => appliquerReponse(d, r.q, r.juste, Date.now()))}
      surFin={(s) => {
        if (s.total) maj((d) => avecResultat(d, { sorte: "entrainement", ref: "", bonnes: s.bonnes, total: s.total, tempsMoyenMs: s.tempsMoyenMs }));
        setBilan(s);
      }}
    />
  );
}

// ----- Estimer d'abord ----------------------------------------------------------------------------------------
export function Estimation({ surFin }: { surFin: () => void }) {
  const { db, maj } = useApp();
  const rng = useMemo(() => makeRng(randomSeed()), []);
  const [bilan, setBilan] = useState<SerieStats | null>(null);
  if (bilan)
    return (
      <Bilan s={bilan} titre="Estimer d'abord : bilan" onContinuer={surFin}>
        <p className="muted">Estimations à 10 % près : <b>{bilan.estimOk} / {bilan.total}</b>. Une bonne estimation te dit tout de suite si un résultat exact « sonne faux ».</p>
      </Bilan>
    );
  return (
    <Serie
      titre="Estimer d'abord"
      sousTitre="Donne vite un ordre de grandeur (accepté à 10 % près), puis le calcul exact."
      fin={{ questions: 10 }}
      chronoVisible={db.reglages.chrono}
      estimer
      suivante={(deja) => questionEstimation(db, deja, rng)}
      surReponse={(r) => maj((d) => ({ ...d, revoir: apresReponse(d.revoir, r.q, r.juste, Date.now(), d.reglages.heureJour) }))}
      surFin={(s) => {
        if (s.total) maj((d) => avecResultat(d, { sorte: "estimation", ref: "", bonnes: s.bonnes, total: s.total, tempsMoyenMs: s.tempsMoyenMs, estimOk: s.estimOk }));
        setBilan(s);
      }}
    />
  );
}

// ----- Astuce : explication, exemple animé, pourquoi, 10 exercices ---------------------------------------------
export function ExempleAnime({ images }: { images: string[] }) {
  const [n, setN] = useState(1);
  const [tour, setTour] = useState(0);
  useEffect(() => {
    setN(1);
    const id = setInterval(() => setN((x) => (x >= images.length ? x : x + 1)), 1300);
    return () => clearInterval(id);
  }, [images, tour]);
  return (
    <div className="exemple-anime" aria-live="polite">
      {images.slice(0, n).map((t, i) => <div key={`${tour}-${i}`} className={`image-ex ${i === n - 1 ? "derniere" : ""}`}>{t}</div>)}
      <button className="btn petit" onClick={() => setTour(tour + 1)} disabled={n < images.length}>↻ Revoir l'exemple</button>
    </div>
  );
}

export function AstuceLecon({ id, surFin }: { id: AstuceId; surFin: (s: SerieStats | null) => void }) {
  const { db, maj } = useApp();
  const a = astuceInfo(id);
  const [phase, setPhase] = useState<"explication" | "exercices">("explication");
  const exos = useMemo(() => exercicesAstuce(id, randomSeed()), [id]);
  const [bilan, setBilan] = useState<SerieStats | null>(null);
  if (bilan)
    return (
      <Bilan s={bilan} titre={`${a.titre} : ${bilan.bonnes} / 10`} onContinuer={() => surFin(bilan)}>
        <p className="muted petit">Cette astuce va maintenant revenir de temps en temps, mélangée aux autres calculs de l'entraînement.</p>
      </Bilan>
    );
  if (phase === "exercices")
    return (
      <Serie
        titre={`${a.icone} ${a.titre} — 10 exercices`}
        sousTitre={a.resume}
        fin={{ questions: 10 }}
        chronoVisible={db.reglages.chrono}
        suivante={(deja) => exos[Math.min(deja.length, exos.length - 1)]}
        surReponse={(r) => maj((d) => ({ ...d, revoir: apresReponse(d.revoir, r.q, r.juste, Date.now(), d.reglages.heureJour) }))}
        surFin={(s) => {
          if (s.total) maj((d) => avecResultat(d, { sorte: "astuce", ref: id, bonnes: s.bonnes, total: s.total, tempsMoyenMs: s.tempsMoyenMs }));
          setBilan(s);
        }}
      />
    );
  return (
    <Carte titre={<>{a.icone} {a.titre}</>}>
      <p className="regle">{a.resume}</p>
      <div className="lecon">
        <div>
          <h3>Pas à pas</h3>
          <ol className="pas">{a.etapes.map((e) => <li key={e}>{e}</li>)}</ol>
        </div>
        <div>
          <h3>Exemple : {a.exemple.calcul}</h3>
          <ExempleAnime images={a.exemple.images} />
        </div>
      </div>
      <p className="pourquoi"><b>Pourquoi ça marche ?</b> {a.pourquoi}</p>
      <p className="muted petit">C'est un raccourci exact (de l'arithmétique) ; aucune étude ne mesure l'effet de chaque astuce, mais comprendre pourquoi elle marche aide à s'en servir.</p>
      <div className="choix">
        <button className="btn primary gros" onClick={() => setPhase("exercices")}>10 exercices</button>
        <button className="btn" onClick={() => surFin(null)}>Retour</button>
      </div>
    </Carte>
  );
}

// ----- Défis chronométrés (facultatifs) -------------------------------------------------------------------------
export function Defi({ id, surFin }: { id: DefiId; surFin: (fait: boolean) => void }) {
  const { db, maj } = useApp();
  const d = defiInfo(id);
  const rng = useMemo(() => makeRng(randomSeed()), []);
  const [phase, setPhase] = useState<"intro" | "jeu">("intro");
  const [res, setRes] = useState<{ s: SerieStats; score: number; record: boolean } | null>(null);
  const avant = meilleurScore(db, id);
  if (res)
    return (
      <Bilan s={res.s} titre={`${d.nom} : ${res.score} ${d.unite}`} onContinuer={() => surFin(true)}>
        {res.record ? <p className="ok-texte"><b>Nouveau record !</b></p> : avant !== null && <p className="muted">Ton record : {avant} {d.unite}.</p>}
        {id === "20q" && <p className="muted petit">Temps total + 5 s par erreur.</p>}
      </Bilan>
    );
  if (phase === "jeu")
    return (
      <Serie
        titre={`${d.icone} ${d.nom}`}
        fin={d.secondes ? { secondes: d.secondes } : { questions: d.questions! }}
        chronoVisible
        defi
        suivante={(deja) => questionDefi(rng, deja[deja.length - 1])}
        surAbandon={() => surFin(false)}
        surFin={(s) => {
          const score = scoreDefi(id, s.bonnes, s.total, s.dureeMs);
          const record = s.total > 0 && (avant === null || (d.sens === "plus" ? score > avant : score < avant));
          if (s.total) maj((x) => avecResultat(x, { sorte: "defi", ref: id, bonnes: s.bonnes, total: s.total, tempsMoyenMs: s.tempsMoyenMs, score }));
          setRes({ s, score, record });
        }}
      />
    );
  return (
    <Carte titre={<>{d.icone} Défi : {d.nom}</>}>
      <p>{d.regle} Toujours la même difficulté (additions, soustractions, tables, × 1 chiffre, pourcentages simples), pour comparer tes scores.</p>
      <p className="muted">Record : {avant === null ? "pas encore" : `${avant} ${d.unite}`}</p>
      <p className="conseil">Le chrono met la pression : c'est un jeu, pas un examen. Si ça te stresse, saute-le — l'entraînement sans chrono suffit pour progresser.</p>
      <div className="choix">
        <button className="btn primary gros" onClick={() => setPhase("jeu")}>C'est parti</button>
        <button className="btn" onClick={() => surFin(false)}>Pas aujourd'hui</button>
      </div>
    </Carte>
  );
}

// ----- Tests de départ et de suivi -------------------------------------------------------------------------------
export function Test({ numero, surFin }: { numero: number; surFin: (fait: boolean) => void }) {
  const { maj, db } = useApp();
  const qs = useMemo(() => questionsTest(numero), [numero]);
  const [phase, setPhase] = useState<"intro" | "jeu">("intro");
  const [bilan, setBilan] = useState<SerieStats | null>(null);
  const nom = nomTest(numero);
  if (bilan) {
    const c = comparerTests(db);
    const dernier = c[c.length - 1];
    return (
      <Bilan s={bilan} titre={`${nom} : ${bilan.bonnes} / 20`} onContinuer={() => surFin(true)}>
        {dernier && dernier.diffJustesse !== null && (
          <p>Par rapport au test de départ : <b>{dernier.diffJustesse >= 0 ? "+" : ""}{dernier.diffJustesse} points</b> de justesse, <b>{dernier.diffTempsS! <= 0 ? "" : "+"}{dernier.diffTempsS} s</b> par calcul.</p>
        )}
        <p className="muted petit">Le prochain test de suivi sera proposé dans 7 jours.</p>
      </Bilan>
    );
  }
  if (phase === "jeu")
    return (
      <Serie
        titre={nom}
        sousTitre="Pas de chrono affiché : le temps est mesuré discrètement, pour voir tes progrès."
        fin={{ questions: 20 }}
        chronoVisible={false}
        suivante={(deja) => qs[Math.min(deja.length, qs.length - 1)]}
        surAbandon={() => surFin(false)}
        surFin={(s) => {
          maj((d) => avecResultat(d, { sorte: "test", ref: String(numero), bonnes: s.bonnes, total: s.total, tempsMoyenMs: s.tempsMoyenMs, detail: nom }));
          setBilan(s);
        }}
      />
    );
  return (
    <Carte titre={nom}>
      <p>20 calculs : additions, soustractions, tables, × 1 chiffre et pourcentages, du plus simple au plus costaud. <b>Même difficulté à chaque test</b> (les nombres changent mais sont tirés de la même façon), pour comparer honnêtement.</p>
      <p className="muted">Environ 3 à 5 minutes. Pas de piège, pas de chrono affiché. On mesure la justesse et le temps moyen par calcul.</p>
      <div className="choix">
        <button className="btn primary gros" onClick={() => setPhase("jeu")}>Commencer le test</button>
        <button className="btn" onClick={() => surFin(false)}>Plus tard</button>
      </div>
    </Carte>
  );
}
