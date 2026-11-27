// Test de départ, puis de suivi chaque semaine : 20 mots (sens) et 5 phrases à remettre dans l'ordre.
// Conditions fixes (4 choix, voyelles visibles, lecture cachée) pour pouvoir comparer d'une semaine à l'autre.
import { useMemo, useState } from "react";
import type { Mot } from "../core/langues";
import type { TestResultat } from "../core/model";
import { makeRng } from "../core/rng";
import { choixPour, graineSemaine, tirageTest } from "../core/seance";
import { comparerTests } from "../core/stats";
import { Avancement, Carte, Ecrit, useApp } from "../ui";
import { Manche } from "./Ordre";

export default function ExoTest({ fin }: { fin: () => void }) {
  const { db, langue, maj } = useApp();
  const [t] = useState(() => tirageTest(db, langue, Date.now()));
  const rng = useMemo(() => makeRng(graineSemaine(langue, t.lundi) + 1), [langue, t.lundi]);
  const choix = useMemo(() => t.mots.map((m) => choixPour(rng, m, 4)), [t, rng]);
  const [i, setI] = useState(0);
  const [mots, setMots] = useState(0);
  const [phrases, setPhrases] = useState(0);
  const [fait, setFait] = useState<TestResultat | null>(null);
  const precedent = useMemo(() => [...db.tests].filter((x) => x.langue === langue).pop(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const total = t.mots.length + t.phrases.length;

  const terminer = (m: number, p: number) => {
    const r: TestResultat = { id: `${langue}-${t.lundi}-${Date.now()}`, langue, at: Date.now(), sorte: t.sorte, semaine: t.lundi, mots: m, motsMax: t.mots.length, phrases: p, phrasesMax: t.phrases.length };
    maj((d) => ({ ...d, tests: [...d.tests, r] }));
    setFait(r);
  };

  if (fait)
    return (
      <Carte titre={t.sorte === "depart" ? "Test de départ — fini" : "Test de la semaine — fini"}>
        <p className="verdict">{fait.mots} / {fait.motsMax} mots · {fait.phrases} / {fait.phrasesMax} phrases</p>
        <p className="muted petit" style={{ textAlign: "center" }}>
          {precedent ? comparerTests(precedent, fait) : "C'est ton point de départ : refais le test dans une semaine pour comparer."}
        </p>
        <div className="choix"><button className="btn primary" onClick={fin} autoFocus>Continuer</button></div>
      </Carte>
    );

  if (i < t.mots.length) {
    const m = t.mots[i];
    const repondre = (x: Mot) => {
      const s = mots + (x.id === m.id ? 1 : 0);
      setMots(s);
      setI(i + 1);
    };
    return (
      <Carte titre={`${t.sorte === "depart" ? "Test de départ" : "Test de la semaine"} : que veut dire ce mot ?`}>
        <Avancement i={i} n={total} />
        <p className="muted petit">Pas de correction pendant le test, pour garder les mêmes conditions chaque semaine. « Je ne sais pas » est une bonne réponse honnête.</p>
        <Ecrit langue={langue} texte={m.ecrit} />
        <div className="reponses">
          {choix[i].map((x) => <button key={x.id} className="reponse" onClick={() => repondre(x)}>{x.fr}</button>)}
          <button className="reponse" onClick={() => repondre({ ...m, id: "" })}>Je ne sais pas</button>
        </div>
      </Carte>
    );
  }
  const k = i - t.mots.length;
  return (
    <Carte titre="Test : remets la phrase dans l'ordre">
      <Avancement i={i} n={total} />
      <Manche key={k} p={t.phrases[k]} voyelles lectureCachee repondu={(ok) => {
        const p = phrases + (ok ? 1 : 0);
        setPhrases(p);
        if (k + 1 < t.phrases.length) setI(i + 1);
        else terminer(mots, p);
      }} />
    </Carte>
  );
}
