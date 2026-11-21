// Une série de calculs : question, saisie, correction immédiate (avec la décomposition après une erreur),
// calculs ratés reposés plus tard dans la série. Sert à l'entraînement, aux astuces, aux défis et aux tests.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { appliquerTouche, Pave, Saisie, useClavierPhysique, type Touche } from "./clavier";
import { planifierReposer, tirerReposer, type AReposer } from "./core/espacement";
import { ecartPourcent, estimationOk, guideEstimation } from "./core/generateur";
import { fmt, type Question } from "./core/question";
import { Barre, fmtSec, sonFaux, sonJuste, useApp } from "./ui";

export interface Reponse { q: Question; juste: boolean; ms: number; estimOk?: boolean }

export interface SerieStats {
  bonnes: number;
  total: number;
  tempsMoyenMs: number;
  dureeMs: number;
  estimOk: number;
  reponses: Reponse[];
}

export type Fin = { questions: number } | { secondes: number } | { libre: true };

interface Props {
  titre: ReactNode;
  /** La prochaine question (selon celles déjà posées). */
  suivante: (deja: Question[]) => Question;
  fin: Fin;
  /** Afficher le temps qui passe (sinon seulement une barre douce pour les séries au temps). */
  chronoVisible: boolean;
  /** Mode « Estimer d'abord ». */
  estimer?: boolean;
  /** Défi : après une erreur on montre la réponse un instant puis on enchaîne ; rien n'est reposé. */
  defi?: boolean;
  /** Reposer les calculs ratés 3 questions plus tard. */
  reposer?: boolean;
  /** Sous le titre (consigne, message bienveillant…). */
  sousTitre?: ReactNode;
  surReponse?: (r: Reponse) => void;
  surFin: (s: SerieStats) => void;
  /** Quitter sans enregistrer (défis, tests). Sans lui, « Terminer » enregistre ce qui a été fait. */
  surAbandon?: () => void;
}

type Phase = "estime" | "calcul" | "juste" | "correction";

function stats(reponses: Reponse[], debut: number): SerieStats {
  const total = reponses.length;
  return {
    bonnes: reponses.filter((r) => r.juste).length,
    total,
    tempsMoyenMs: total ? Math.round(reponses.reduce((a, r) => a + r.ms, 0) / total) : 0,
    dureeMs: Date.now() - debut,
    estimOk: reponses.filter((r) => r.estimOk).length,
    reponses,
  };
}

export function Serie(p: Props) {
  const { db } = useApp();
  const sons = db.reglages.sons;
  const [debut] = useState(() => Date.now());
  const [deja, setDeja] = useState<Question[]>([]);
  const [q, setQ] = useState<Question>(() => p.suivante([]));
  const [file, setFile] = useState<AReposer[]>([]);
  const [phase, setPhase] = useState<Phase>(p.estimer ? "estime" : "calcul");
  const [saisie, setSaisie] = useState("");
  const [estim, setEstim] = useState<{ valeur: number; ok: boolean } | null>(null);
  const [donnee, setDonnee] = useState<number | null>(null);
  const [reponses, setReponses] = useState<Reponse[]>([]);
  const [t0, setT0] = useState(() => Date.now());
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const fini = useRef(false);
  // Les rappels différés (setTimeout) doivent voir les dernières données (niveaux mis à jour).
  const derniers = useRef(p);
  derniers.current = p;

  const auTemps = "secondes" in p.fin;
  const dureeS = "secondes" in p.fin ? p.fin.secondes : 0;
  const ecouleS = Math.floor((maintenant - debut) / 1000);

  useEffect(() => {
    if (!auTemps && !p.chronoVisible) return;
    const id = setInterval(() => setMaintenant(Date.now()), 250);
    return () => clearInterval(id);
  }, [auTemps, p.chronoVisible]);

  const terminer = (rs: Reponse[]) => {
    if (fini.current) return;
    fini.current = true;
    derniers.current.surFin(stats(rs, debut));
  };

  // Défi au temps (chrono visible) : à zéro, on s'arrête tout de suite.
  useEffect(() => {
    if (auTemps && p.chronoVisible && ecouleS >= dureeS) terminer(reponses);
  });

  const questionSuivante = (rs: Reponse[]) => {
    const fin = p.fin;
    if ("questions" in fin && rs.length >= fin.questions) return terminer(rs);
    if ("secondes" in fin && Date.now() - debut >= fin.secondes * 1000) return terminer(rs);
    const nouvDeja = [...deja, q];
    let prochaine: Question;
    let nouvFile = file;
    if (p.reposer) {
      const t = tirerReposer(file);
      nouvFile = t.file;
      prochaine = t.q ?? derniers.current.suivante(nouvDeja);
    } else prochaine = derniers.current.suivante(nouvDeja);
    setDeja(nouvDeja);
    setFile(nouvFile);
    setQ(prochaine);
    setSaisie("");
    setEstim(null);
    setDonnee(null);
    setPhase(p.estimer ? "estime" : "calcul");
    setT0(Date.now());
  };

  const valider = () => {
    const v = saisie === "" ? null : Number(saisie);
    if (v === null) return;
    if (phase === "estime") {
      setEstim({ valeur: v, ok: estimationOk(v, q.reponse) });
      setSaisie("");
      setPhase("calcul");
      setT0(Date.now());
      return;
    }
    const juste = v === q.reponse;
    const r: Reponse = { q, juste, ms: Date.now() - t0, ...(estim ? { estimOk: estim.ok } : {}) };
    const rs = [...reponses, r];
    setReponses(rs);
    setDonnee(v);
    p.surReponse?.(r);
    if (juste) {
      sonJuste(sons);
      setPhase("juste");
      setTimeout(() => questionSuivante(rs), 550);
    } else {
      sonFaux(sons);
      if (p.reposer) setFile(planifierReposer(file, q));
      setPhase("correction");
      if (p.defi) setTimeout(() => questionSuivante(rs), 1500);
    }
  };

  const touche = (t: Touche) => {
    if (fini.current) return;
    if (phase === "correction") {
      if (t === "OK" && !p.defi) questionSuivante(reponses);
      return;
    }
    if (phase === "juste") return;
    const n = appliquerTouche(saisie, t);
    if (n === null) valider();
    else setSaisie(n);
  };
  useClavierPhysique(true, touche);

  const fin = p.fin;
  const progression = "questions" in fin ? reponses.length / fin.questions : "secondes" in fin ? (maintenant - debut) / (fin.secondes * 1000) : null;
  return (
    <div className="serie-calc">
      <div className="partie-tete">
        <h2>{p.titre}</h2>
        {"questions" in fin && <span className="pastille">{Math.min(reponses.length + 1, fin.questions)} / {fin.questions}</span>}
        {p.chronoVisible && <span className="pastille chrono">⏱ {auTemps ? fmtSec(Math.max(0, dureeS - ecouleS)) : fmtSec(ecouleS)}</span>}
        {p.surAbandon ? (
          <button className="btn petit" onClick={() => { fini.current = true; p.surAbandon!(); }}>Abandonner</button>
        ) : (
          <button className="btn petit" onClick={() => terminer(reponses)}>Terminer</button>
        )}
      </div>
      {p.sousTitre && <div className="muted petit">{p.sousTitre}</div>}
      {progression !== null && <Barre part={progression} />}
      <div className="scene">
        <div className="consigne">{phase === "estime" ? "Estime d'abord (à 10 % près)" : estim ? "Maintenant, le calcul exact" : q.revision ? "À revoir (raté un autre jour)" : " "}</div>
        <div className="calcul">{q.texte} = </div>
        <Saisie valeur={phase === "juste" || phase === "correction" ? String(donnee ?? "") : saisie} etat={phase === "juste" ? "ok" : phase === "correction" ? "ko" : null} />
        {estim && (
          <p className={estim.ok ? "ok-texte" : "ko-texte"}>
            Estimation {fmt(estim.valeur)} : {estim.ok ? `bien vu (à ${ecartPourcent(estim.valeur, q.reponse)} % près)` : `trop loin (${ecartPourcent(estim.valeur, q.reponse)} %)`}.
            {!estim.ok && <span className="muted"> Piste : {guideEstimation(q)}</span>}
          </p>
        )}
        {phase === "correction" && (
          <div className="correction-bloc">
            <p className="ko-texte">Pas tout à fait : <b>{q.texte} = {fmt(q.reponse)}</b></p>
            <ol className="decomposition">{q.etapes.map((e, i) => <li key={i}>{e}</li>)}</ol>
            {!p.defi && <button className="btn primary" onClick={() => questionSuivante(reponses)}>Continuer (Entrée)</button>}
            {p.reposer && !p.defi && <p className="muted petit">Ce calcul reviendra un peu plus tard.</p>}
          </div>
        )}
        {phase === "juste" && <p className="ok-texte verdict">Juste ✓</p>}
        {(phase === "estime" || phase === "calcul") && <Pave onTouche={touche} />}
        {(phase === "estime" || phase === "calcul") && <p className="muted petit indice-clavier">Au clavier : tape la réponse, puis Entrée.</p>}
      </div>
    </div>
  );
}
