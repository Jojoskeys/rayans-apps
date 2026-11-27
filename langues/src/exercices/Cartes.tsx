// Cartes mots : découverte des nouveaux mots, puis révisions espacées (rappel actif, dans les deux sens).
import { useMemo, useState } from "react";
import { apresRappel, cartesDues, nouvelleCarte, prochaineRevision } from "../core/espacement";
import { ecrit, motDe, type Mot } from "../core/langues";
import { mancheReussie, paramsCartes } from "../core/niveaux";
import { makeRng, randomSeed, sample } from "../core/rng";
import { choixPour, motsNouveaux, motsVus } from "../core/seance";
import { Avancement, Carte, EcritMot, finirManche, Lecture, parler, useApp, useVoix, voyellesPour } from "../ui";
import { Aides, Bilan, Correction } from "./commun";

/** Nouveaux mots : on découvre chaque mot (écrit, lecture, sens, aide), puis on se teste tout de suite. */
export function Decouverte({ n, fin }: { n: number; fin: () => void }) {
  const { db, langue, maj } = useApp();
  const voix = useVoix(langue);
  const [liste] = useState(() => motsNouveaux(db, langue).slice(0, n));
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"voir" | "tester" | "fini">(liste.length ? "voir" : "fini");
  const rng = useMemo(() => makeRng(randomSeed()), []);
  const ordreTest = useMemo(() => sample(rng, liste, liste.length), [rng, liste]);
  const [rep, setRep] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const choix = useMemo(() => (phase === "tester" && ordreTest[i] ? choixPour(rng, ordreTest[i], 4) : []), [phase, i, ordreTest, rng]);

  if (phase === "fini" || !liste.length)
    return liste.length
      ? <Bilan titre="Nouveaux mots" score={score} max={liste.length} continuer={fin} />
      : <Carte titre="Nouveaux mots"><p>Pas de nouveau mot aujourd'hui (limite du jour atteinte ou liste finie).</p><div className="choix"><button className="btn primary" onClick={fin}>Continuer</button></div></Carte>;

  if (phase === "voir") {
    const m = liste[i];
    const suivant = () => {
      maj((d) => (d.cartes.some((c) => c.id === `${langue}:${m.id}`) ? d : { ...d, cartes: [...d.cartes, nouvelleCarte(langue, m.id, Date.now(), d.reglages.heureJour)] }));
      if (i + 1 < liste.length) setI(i + 1);
      else { setI(0); setPhase("tester"); }
    };
    return (
      <Carte titre={`Nouveau mot · ${m.theme}`}>
        <Avancement i={i} n={liste.length} />
        <EcritMot m={m} />
        <Correction m={m} />
        <div className="choix"><button className="btn primary" onClick={suivant} autoFocus>{i + 1 < liste.length ? "Mot suivant" : "Me tester sur ces mots"}</button></div>
        {i === 0 && voix.length > 0 && <p className="muted petit">Écoute-le et répète-le à voix haute : ça aide à le retenir.</p>}
      </Carte>
    );
  }

  const m = ordreTest[i];
  const repondre = (x: Mot) => { if (rep) return; setRep(x.id); if (x.id === m.id) setScore((s) => s + 1); if (voix.length) parler(m.ecrit, langue); };
  return (
    <Carte titre="Tout de suite : que veut dire ce mot ?">
      <Avancement i={i} n={ordreTest.length} />
      <EcritMot m={m} />
      <div className="reponses">
        {choix.map((x) => (
          <button key={x.id} className={`reponse ${rep ? (x.id === m.id ? "bonne" : x.id === rep ? "fausse" : "") : ""}`} disabled={!!rep} onClick={() => repondre(x)}>{x.fr}</button>
        ))}
      </div>
      {rep && (
        <>
          <Lecture langue={m.langue} texte={m.lecture} />
          <div className="choix"><button className="btn primary" autoFocus onClick={() => { setRep(null); if (i + 1 < ordreTest.length) setI(i + 1); else setPhase("fini"); }}>Suivant</button></div>
        </>
      )}
    </Carte>
  );
}

/**
 * Révisions : les mots dus aujourd'hui (mode « revisions »), ou, en accès libre sans mot dû, un tirage parmi les mots
 * déjà vus (sans changer leurs dates de révision).
 */
export function Revisions({ n, libre, fin }: { n: number; libre?: boolean; fin: () => void }) {
  const { db, langue, maj } = useApp();
  const voix = useVoix(langue);
  const niveau = db.niveaux[langue].cartes.level;
  const p = paramsCartes(niveau);
  const rng = useMemo(() => makeRng(randomSeed()), []);
  const [items] = useState(() => {
    const dues = cartesDues(db.cartes, langue, Date.now()).slice(0, n).map((c) => ({ m: motDe(langue, c.mot), carte: true }));
    if (dues.length || !libre) return dues.filter((x): x is { m: Mot; carte: boolean } => !!x.m);
    return sample(rng, motsVus(db, langue), n).map((m) => ({ m, carte: false }));
  });
  const [i, setI] = useState(0);
  const [rep, setRep] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [fini, setFini] = useState(false);
  const item = items[i];
  const versMot = p.sensVersMot && i % 2 === 1;
  const choix = useMemo(() => (item ? choixPour(rng, item.m, p.choix) : []), [item, rng, p.choix]);

  if (!items.length)
    return (
      <Carte titre="Révisions">
        <p>{motsVus(db, langue).length ? "Rien à réviser aujourd'hui : les mots reviendront au bon moment." : "Tu n'as pas encore de mot à réviser : commence par découvrir des mots."}</p>
        <div className="choix"><button className="btn primary" onClick={fin}>Continuer</button></div>
      </Carte>
    );
  if (fini) return <Bilan titre="Révisions" score={score} max={items.length} niveau={niveau} continuer={fin} />;

  const m = item.m;
  const juste = rep === m.id;
  const repondre = (x: Mot) => {
    if (rep) return;
    setRep(x.id);
    const ok = x.id === m.id;
    if (ok) setScore((s) => s + 1);
    if (item.carte) maj((d) => ({ ...d, cartes: d.cartes.map((c) => (c.id === `${langue}:${m.id}` ? apresRappel(c, ok, Date.now(), d.reglages.heureJour) : c)) }));
    if (voix.length) parler(m.ecrit, langue);
  };
  const suivant = () => {
    setRep(null);
    if (i + 1 < items.length) { setI(i + 1); return; }
    const total = score;
    maj((d) => finirManche(d, langue, "cartes", total, items.length, mancheReussie(total, items.length)));
    setFini(true);
  };
  const carte = db.cartes.find((c) => c.id === `${langue}:${m.id}`);
  return (
    <Carte titre={versMot ? "Quel mot veut dire…" : "Que veut dire ce mot ?"}>
      <Avancement i={i} n={items.length} />
      {versMot ? <p className="ecrit moyen">{m.fr}</p> : <><EcritMot m={m} />{!p.lectureCachee && !rep && <Lecture langue={langue} texte={m.lecture} />}</>}
      <div className="reponses">
        {choix.map((x) => (
          <button key={x.id} className={`reponse ${rep ? (x.id === m.id ? "bonne" : x.id === rep ? "fausse" : "") : ""}`} disabled={!!rep} onClick={() => repondre(x)}>
            {versMot ? <span className={`ecrit petit ${langue}`}>{ecrit(x, voyellesPour(db, x))}</span> : x.fr}
          </button>
        ))}
      </div>
      {rep && (
        <>
          {versMot && <EcritMot m={m} taille="moyen" />}
          <Lecture langue={langue} texte={m.lecture} />
          {!juste && <Aides m={m} />}
          {item.carte && carte && <p className="muted petit" style={{ textAlign: "center" }}>{juste ? "Juste" : "Pas grave"} : prochaine révision {prochaineRevision(carte, Date.now(), db.reglages.heureJour)}.</p>}
          <div className="choix"><button className="btn primary" autoFocus onClick={suivant}>Suivant</button></div>
        </>
      )}
    </Carte>
  );
}
