// Lecture chronométrée (aussi « lire et prendre des notes » et les tests) : avant de lire, lecture par pages, puis
// questions sans le texte. Vitesse et compréhension sont toujours montrées ensemble.
import { useMemo, useState } from "react";
import { corriger, motsParMinute, paginer, preparerQuestions, REPERE_MPM, scoreEfficace, tropVite, SEUIL_ALERTE } from "../core/lecture";
import { issueLecture, issueScore } from "../core/niveaux";
import { makeRng, newId, randomSeed } from "../core/rng";
import { vitesseMediane } from "../core/seance";
import { NOM_NIVEAU, type Texte } from "../core/textes";
import { ajouterResultat, Carte, fmtDuree, pc, useApp, useChrono } from "../ui";
import { Questions } from "./Questions";

export type ModeLecture = "lecture" | "notes" | "test";

export default function Lire({ texte, mode, test, seance, fin }: { texte: Texte; mode: ModeLecture; test?: "depart" | "suivi"; seance?: boolean; fin: () => void }) {
  const { db, maj } = useApp();
  const [phase, setPhase] = useState<"avant" | "lire" | "questions" | "resultat">("avant");
  const [dejaSu, setDejaSu] = useState("");
  const [notes, setNotes] = useState("");
  const pages = useMemo(() => paginer(texte), [texte]);
  const [page, setPage] = useState(0);
  const [t, remettre] = useChrono(phase === "lire");
  const [ms, setMs] = useState(0);
  const qs = useMemo(() => preparerQuestions(texte, makeRng(randomSeed())), [texte]);
  const [reponses, setReponses] = useState<(number | null)[]>(() => qs.map(() => null));
  const mediane = useMemo(() => vitesseMediane(db), []); // eslint-disable-line react-hooks/exhaustive-deps

  const titre = mode === "test" ? (test === "depart" ? "Test de départ" : "Test de la semaine") : mode === "notes" ? "Lire et prendre des notes" : "Lecture chronométrée";

  if (phase === "avant")
    return (
      <Carte titre={titre}>
        <div className="titre-texte"><h2>{texte.titre}</h2><p className="muted petit">{texte.mots} mots · niveau {NOM_NIVEAU[texte.niveau]} · {texte.theme}</p></div>
        <p className="astuce">🤔 À garder en tête : {texte.curiosite}</p>
        <label className="champ">Ce que je sais déjà sur le sujet (facultatif, 1 ou 2 lignes)
          <textarea value={dejaSu} onChange={(e) => setDejaSu(e.target.value)} rows={2} />
        </label>
        <p className="muted petit">
          {mode === "notes" ? "Lis et prends des notes avec tes mots (pas de copier-coller). Les questions se feront avec tes seules notes."
            : "Lis à ton rythme habituel, comme pour comprendre : les questions viendront après, sans le texte. Le chronomètre démarre au bouton."}
        </p>
        <div className="choix"><button className="btn primary gros" onClick={() => { remettre(); setPhase("lire"); }}>Commencer à lire</button></div>
      </Carte>
    );

  if (phase === "lire") {
    const derniere = page === pages.length - 1;
    const finir = () => { setMs(Math.round(t * 1000)); setPhase("questions"); window.scrollTo({ top: 0 }); };
    return (
      <Carte>
        <div className="page-texte">
          {page === 0 && <h2 className="titre-texte">{texte.titre}</h2>}
          {pages[page].map((b, i) => (b.sorte === "titre" ? <h3 key={i}>{b.texte}</h3> : <p key={i}>{b.texte}</p>))}
        </div>
        {mode === "notes" && (
          <label className="champ">Mes notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} onPaste={(e) => e.preventDefault()} />
          </label>
        )}
        <div className="pied-page">
          <button className="btn" disabled={page === 0} onClick={() => { setPage(page - 1); window.scrollTo({ top: 0 }); }}>← Page précédente</button>
          <span className="chrono">Page {page + 1} / {pages.length}</span>
          {derniere
            ? <button className="btn primary" onClick={finir}>J'ai fini de lire</button>
            : <button className="btn primary" onClick={() => { setPage(page + 1); window.scrollTo({ top: 0 }); }}>Page suivante →</button>}
        </div>
      </Carte>
    );
  }

  const res = corriger(qs, reponses);
  const mpm = motsParMinute(texte.mots, ms);

  if (phase === "questions") {
    const valider = () => {
      const base = { exo: mode === "test" ? "test" as const : mode, texteId: texte.id, niveau: texte.niveau, bonnes: res.bonnes, total: res.total, part: res.part, mots: texte.mots, ms, ...(mode !== "notes" ? { mpm } : {}), ...(seance ? { seance: true } : {}), ...(test ? { test } : {}), ...(dejaSu.trim() ? { dejaSu: dejaSu.trim() } : {}) };
      const issue = mode === "lecture" ? issueLecture(res.part, mpm, mediane) : mode === "notes" ? issueScore(res.part) : undefined;
      maj((d) => {
        let n = ajouterResultat(d, base, issue);
        if (mode === "notes" && notes.trim()) n = { ...n, notes: [...n.notes, { id: newId(), texteId: texte.id, texte: notes.trim(), at: Date.now(), maj: Date.now() }] };
        return n;
      });
      setPhase("resultat");
      window.scrollTo({ top: 0 });
    };
    return (
      <Carte titre={`${titre} — questions (sans le texte)`}>
        {mode === "notes" && <div className="astuce"><b>Tes notes :</b><p className="texte-libre" style={{ whiteSpace: "pre-wrap" }}>{notes || "(aucune note)"}</p></div>}
        <Questions qs={qs} reponses={reponses} choisir={(i, c) => setReponses((r) => r.map((x, k) => (k === i ? c : x)))} corrige={false} />
        <div className="choix">
          <span className="muted petit">{reponses.filter((r) => r !== null).length} / {qs.length} réponses</span>
          <button className="btn primary" onClick={valider}>Valider</button>
        </div>
      </Carte>
    );
  }

  return (
    <div className="pile">
      <Carte titre={`${titre} — résultat`}>
        <div className="chiffres">
          {mode !== "notes" && <div><b>{mpm}</b><span>mots par minute ({fmtDuree(ms / 1000)})</span></div>}
          <div><b>{res.bonnes} / {res.total}</b><span>compréhension ({pc(res.part)})</span></div>
          {mode !== "notes" && <div><b>{scoreEfficace(mpm, res.part)}</b><span>mots compris par minute</span></div>}
        </div>
        {mode !== "notes" && mpm > 1000 && <p className="alerte">Plus de 1000 mots par minute : c'est plutôt un survol qu'une lecture. Personne ne lit vraiment à cette vitesse en comprenant tout.</p>}
        {mode !== "notes" && tropVite(res.part) &&<p className="alerte">Moins de {pc(SEUIL_ALERTE)} de compréhension : la vitesse ne compte pas vraiment ici. Mieux vaut ralentir un peu et comprendre.</p>}
        {mode !== "notes" && <p className="muted petit">Repère : en moyenne, un adulte lit environ {REPERE_MPM} mots par minute un texte documentaire (études en anglais, Brysbaert 2019). Ce n'est pas une norme : compare-toi surtout à toi-même.</p>}
        {mode === "lecture" && mediane !== null && <p className="muted petit">Ta vitesse habituelle : {Math.round(mediane)} mots par minute. Une lecture est « réussie » si tu comprends 80 % ou plus sans descendre sous ta vitesse habituelle.</p>}
        <div className="choix"><button className="btn primary" onClick={fin} autoFocus>Continuer</button></div>
      </Carte>
      <Carte titre="Correction">
        <Questions qs={qs} reponses={reponses} choisir={() => {}} corrige />
      </Carte>
    </div>
  );
}
