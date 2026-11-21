// La séance guidée du jour : (test), échauffement, révisions espacées, technique du jour, bilan.
import { useMemo, useState } from "react";
import { compterRetrouves, decouperSaisie } from "../core/contenu";
import { listesDues } from "../core/espacement";
import { listeMots } from "../core/jeux";
import { CONSEILS, MYTHES } from "../core/lecons";
import { dayKey, type Db } from "../core/model";
import { gameInfo } from "../core/niveaux";
import { seanceDuJour, serie, TECHNIQUES, type EtapeId } from "../core/programme";
import { makeRng, randomSeed } from "../core/rng";
import { Partie } from "../jeux";
import { RevisionListe } from "../rangement";
import { Technique } from "../techniques";
import { avecResultat, Carte, fmtSec, useApp, useCompteARebours } from "../ui";

export function marquerEtape(db: Db, etape: string, now = Date.now()): Db {
  const k = dayKey(now, db.reglages.heureJour);
  const s = db.seances[k] ?? { etapes: [] };
  if (s.etapes.includes(etape)) return db;
  return { ...db, seances: { ...db.seances, [k]: { ...s, etapes: [...s.etapes, etape] } } };
}

/** Test de mesure (départ, fin, retests) : 20 mots, 2 minutes, rappel libre. Sans consigne de technique au départ. */
export function TestMesure({ nom, onFin }: { nom: string; onFin: () => void }) {
  const { db, maj } = useApp();
  const [graine] = useState(randomSeed);
  const mots = useMemo(() => listeMots(makeRng(graine), 20, "concrets"), [graine]);
  const [phase, setPhase] = useState<"intro" | "lis" | "ecris" | "fin">("intro");
  const [texte, setTexte] = useState("");
  const [score, setScore] = useState(0);
  const reste = useCompteARebours(120, phase === "lis", () => setPhase("ecris"));
  const depart = nom === "Test de départ";
  if (phase === "intro")
    return (
      <Carte titre={`🎯 ${nom}`}>
        <p>{depart ? "Avant de commencer le programme, on mesure ton point de départ : 20 mots à retenir en 2 minutes, puis tu écris tous ceux dont tu te souviens. Fais comme d'habitude, sans technique particulière." : "On refait la même épreuve qu'au premier jour : 20 mots en 2 minutes. Cette fois, utilise ton palais !"}</p>
        <p className="muted petit">Repère : environ 8 à 10 mots sans technique ; 15 à 20 avec un palais après quelques semaines.</p>
        <button className="btn primary gros" onClick={() => setPhase("lis")}>C'est parti</button>
      </Carte>
    );
  if (phase === "lis")
    return (
      <Carte titre={`${nom} — ${fmtSec(reste)}`}>
        <ol className="liste-mots">{mots.map((m) => <li key={m}><b>{m}</b></li>)}</ol>
        <button className="btn" onClick={() => setPhase("ecris")}>J'ai fini</button>
      </Carte>
    );
  if (phase === "ecris")
    return (
      <Carte titre={nom}>
        <p>Écris tous les mots dont tu te souviens :</p>
        <textarea rows={7} autoFocus value={texte} onChange={(e) => setTexte(e.target.value)} />
        <button className="btn primary" onClick={() => {
          const r = compterRetrouves(mots, decouperSaisie(texte));
          setScore(r.trouves.length);
          maj((d) => ({
            ...avecResultat(d, { jeu: "test-mots", niveau: 20, score: r.trouves.length, max: 20, reussi: true, detail: nom }),
            debutProgramme: d.debutProgramme ?? Date.now(),
          }));
          setPhase("fin");
        }}>Valider</button>
      </Carte>
    );
  const premier = db.resultats.find((r) => r.jeu === "test-mots" && r.detail === "Test de départ");
  return (
    <Carte titre={`${nom} — résultat`}>
      <div className="verdict ok">{score} / 20</div>
      {depart ? <p>C'est ton point de départ. On refera ce test à la fin des 6 semaines, puis 1 mois et 4 mois après.</p> : premier && <p>Au départ : {premier.score} / 20. Aujourd'hui : {score} / 20 ({score - premier.score >= 0 ? "+" : ""}{score - premier.score}).</p>}
      <button className="btn primary" onClick={onFin} autoFocus>Continuer</button>
    </Carte>
  );
}

function Revisions({ onFin }: { onFin: () => void }) {
  const { db } = useApp();
  const [ids] = useState(() => listesDues(db.listes, Date.now()).slice(0, db.reglages.minutes === 30 ? 6 : 3).map((l) => l.id));
  const [i, setI] = useState(0);
  const [mythe] = useState(() => MYTHES[Math.floor(Math.random() * MYTHES.length)]);
  const [reponse, setReponse] = useState<boolean | null>(null);
  if (ids.length === 0)
    return (
      <Carte titre="Révisions espacées">
        <p>Rien à réviser aujourd'hui. Les listes que tu ranges reviendront demain, puis à J+3, J+7… En attendant, une question :</p>
        <p className="affirmation">« {mythe.affirmation} »</p>
        {reponse === null ? (
          <div className="choix"><button className="btn" onClick={() => setReponse(true)}>Vrai</button><button className="btn" onClick={() => setReponse(false)}>Faux</button></div>
        ) : (
          <>
            <p className={reponse === mythe.vrai ? "ok-texte" : "ko-texte"}>{reponse === mythe.vrai ? "Bien vu." : "Raté."} {mythe.explication}</p>
            <button className="btn primary" onClick={onFin} autoFocus>Continuer</button>
          </>
        )}
      </Carte>
    );
  const l = db.listes.find((x) => x.id === ids[i]);
  if (!l) return <Carte><button className="btn primary" onClick={onFin}>Continuer</button></Carte>;
  return (
    <div className="pile">
      <p className="muted petit">Révision {i + 1} / {ids.length}</p>
      <RevisionListe key={l.id} liste={l} onFin={() => (i + 1 < ids.length ? setI(i + 1) : onFin())} />
    </div>
  );
}

function Bilan({ onFin }: { onFin: () => void }) {
  const { db } = useApp();
  const k = dayKey(Date.now(), db.reglages.heureJour);
  const aujourdhui = db.resultats.filter((r) => dayKey(r.at, db.reglages.heureJour) === k);
  const conseil = CONSEILS[(Object.keys(db.seances).length + new Date().getDate()) % CONSEILS.length];
  return (
    <Carte titre="Bilan du jour">
      <div className="verdict ok">Séance terminée 🎉</div>
      <p>Série : <b>{serie(db, Date.now()) + (db.seances[k]?.fin ? 0 : 1)} jour(s)</b> d'affilée. {aujourdhui.length} exercice(s) aujourd'hui.</p>
      <ul>{aujourdhui.slice(-8).map((r) => <li key={r.id}>{r.jeu in db.niveaux ? gameInfo(r.jeu as never).nom : r.detail ?? r.jeu} : {r.score} / {r.max}</li>)}</ul>
      <p className="conseil">💡 {conseil}</p>
      <button className="btn primary" onClick={onFin} autoFocus>Retour à l'accueil</button>
    </Carte>
  );
}

export default function PageSeance() {
  const { db, maj, aller } = useApp();
  const s = seanceDuJour(db, Date.now());
  const [cours, setCours] = useState<EtapeId | null>(() => s.etapes.find((e) => !s.faites.includes(e.id))?.id ?? null);
  // Le nom du test est gardé : une fois le test enregistré, il n'est plus « à faire ».
  const [testNom] = useState(s.test?.nom ?? null);
  const finir = (id: EtapeId) => {
    const apres = s.etapes.filter((e) => e.id !== id && !s.faites.includes(e.id));
    maj((d) => {
      let out = marquerEtape(d, id);
      if (id === "bilan" || apres.length === 0) {
        const k = dayKey(Date.now(), d.reglages.heureJour);
        out = { ...out, seances: { ...out.seances, [k]: { ...out.seances[k], fin: out.seances[k].fin ?? Date.now() } } };
      }
      return out;
    });
    if (id === "bilan") return aller("accueil");
    setCours(apres[0]?.id ?? null);
  };
  return (
    <div className="pile">
      <div className="etapes">
        {s.etapes.map((e) => (
          <button key={e.id} className={`etape ${s.faites.includes(e.id) ? "faite" : ""} ${cours === e.id ? "en-cours" : ""}`} onClick={() => setCours(e.id)}>
            <span>{s.faites.includes(e.id) ? "✓" : "○"}</span> {e.titre} <em>{e.minutes} min</em>
          </button>
        ))}
      </div>
      {cours === null && <Carte titre="Séance du jour terminée"><p>Bravo, tout est fait pour aujourd'hui. Tu peux rejouer librement dans « Jeux » ou « Atelier ».</p><button className="btn primary" onClick={() => aller("accueil")}>Accueil</button></Carte>}
      {cours === "test" && (testNom ?? s.test) && <TestMesure key="test" nom={testNom ?? s.test!.nom} onFin={() => finir("test")} />}
      {cours === "echauffement" && <Partie key="ech" jeu={s.echauffement} minutes={s.etapes.find((e) => e.id === "echauffement")!.minutes} onTermine={() => finir("echauffement")} />}
      {cours === "revisions" && <Revisions key="rev" onFin={() => finir("revisions")} />}
      {cours === "technique" && (
        <div className="pile">
          <p className="muted petit">Technique du jour : {TECHNIQUES[s.technique].resume}</p>
          <Technique key={s.technique} id={s.technique} onFin={() => finir("technique")} />
        </div>
      )}
      {cours === "bilan" && <Bilan onFin={() => finir("bilan")} />}
    </div>
  );
}
