// Phrase dans l'ordre : on voit le sens en français et on remet les mots dans l'ordre (produire avant la correction).
import { useMemo, useState } from "react";
import { sansHarakat } from "../core/arabe";
import { textePhrase, type Phrase } from "../core/langues";
import { mancheReussie, paramsOrdre } from "../core/niveaux";
import { makeRng, randomSeed } from "../core/rng";
import { melanger, phrasesPourOrdre } from "../core/seance";
import { Avancement, BoutonEcoute, Carte, finirManche, Lecture, Pinyin, useApp } from "../ui";
import { Bilan } from "./commun";

interface Tuile { k: number; mot: string; py: string }

export function Manche({ p, voyelles, lectureCachee, repondu }: { p: Phrase; voyelles: boolean; lectureCachee: boolean; repondu: (juste: boolean) => void }) {
  const rng = useMemo(() => makeRng(randomSeed()), []);
  const tuiles = useMemo<Tuile[]>(() => {
    const t = p.mots.map((mot, k) => ({ k, mot, py: p.lectures[k] ?? "" }));
    const ordre = melanger(rng, t.map((x) => String(x.k)));
    return ordre.map((k) => t[Number(k)]);
  }, [p, rng]);
  const [pris, setPris] = useState<Tuile[]>([]);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const reste = tuiles.filter((t) => !pris.includes(t));
  const montrer = (mot: string) => (voyelles ? mot : sansHarakat(mot));
  const verifier = () => {
    const ok = pris.map((t) => t.mot).join("\u0001") === p.mots.join("\u0001");
    setVerdict(ok);
  };
  const ar = p.langue === "ar";
  return (
    <>
      <p className="sens-fr">« {p.fr} »</p>
      {ar && !lectureCachee && <p className="lecture">{p.lecture}</p>}
      <div className={`tuiles phrase ${ar ? "ar-ordre" : ""}`}>
        {pris.map((t) => (
          <button key={t.k} className={`tuile ${p.langue}`} disabled={verdict !== null} onClick={() => setPris(pris.filter((x) => x !== t))}>{montrer(t.mot)}</button>
        ))}
      </div>
      <div className={`tuiles ${ar ? "ar-ordre" : ""}`}>
        {reste.map((t) => (
          <button key={t.k} className={`tuile ${p.langue}`} disabled={verdict !== null} onClick={() => setPris([...pris, t])}>
            {montrer(t.mot)}
            {!ar && !lectureCachee && <><br /><small><Pinyin texte={t.py} /></small></>}
          </button>
        ))}
      </div>
      {verdict === null ? (
        <div className="choix">
          <button className="btn" disabled={!pris.length} onClick={() => setPris([])}>Recommencer</button>
          <button className="btn primary" disabled={reste.length > 0} onClick={verifier}>Vérifier</button>
        </div>
      ) : (
        <>
          <p className={verdict ? "ok-texte" : "ko-texte"} style={{ textAlign: "center" }}><b>{verdict ? "Juste !" : "Pas tout à fait. La bonne phrase :"}</b></p>
          <p className={`ecrit moyen ${p.langue}`}>{textePhrase(p, voyelles)}</p>
          <Lecture langue={p.langue} texte={p.lecture} />
          <div className="choix">
            <BoutonEcoute texte={textePhrase(p)} langue={p.langue} />
            <button className="btn primary" autoFocus onClick={() => repondu(verdict)}>Suivant</button>
          </div>
        </>
      )}
    </>
  );
}

export default function ExoOrdre({ n, fin }: { n: number; fin: () => void }) {
  const { db, langue, maj } = useApp();
  const niveau = db.niveaux[langue].ordre.level;
  const p = paramsOrdre(niveau);
  const [liste] = useState(() => phrasesPourOrdre(makeRng(randomSeed()), langue, niveau, n));
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [fini, setFini] = useState(false);
  if (fini || !liste.length) return <Bilan titre="Phrase dans l'ordre" score={score} max={liste.length} niveau={niveau} continuer={fin} />;
  const repondu = (ok: boolean) => {
    const s = score + (ok ? 1 : 0);
    setScore(s);
    if (i + 1 < liste.length) setI(i + 1);
    else { maj((d) => finirManche(d, langue, "ordre", s, liste.length, mancheReussie(s, liste.length))); setFini(true); }
  };
  return (
    <Carte titre="Remets la phrase dans l'ordre">
      <Avancement i={i} n={liste.length} />
      <Manche key={i} p={liste[i]} voyelles={!(langue === "ar" && p.sansVoyelles)} lectureCachee={p.lectureCachee} repondu={repondu} />
    </Carte>
  );
}
