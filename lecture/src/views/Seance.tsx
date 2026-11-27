// Séance du jour (10 min par défaut) : lecture chronométrée et questions, résumé de mémoire, plan ou survol.
// Au premier lancement : présentation et test de départ proposé.
import { useState } from "react";
import type { Texte } from "../core/textes";
import { NOM_ETAPE, seanceDuJour, serie, testAFaire, joursAvantTest, vitesseMediane, type Etape } from "../core/seance";
import { NOM_NIVEAU } from "../core/textes";
import Lire from "../exercices/Lire";
import Plan from "../exercices/Plan";
import Resume from "../exercices/Resume";
import Survol from "../exercices/Survol";
import { Carte, Choix, marquerEtape, plural, useApp } from "../ui";

function Accueil() {
  const { db, maj } = useApp();
  const [test, setTest] = useState<{ sorte: "depart" | "suivi"; texte: Texte } | null>(null);
  const vu = () => maj((d) => ({ ...d, reglages: { ...d.reglages, accueilVu: true, maj: Date.now() } }));
  const t = testAFaire(db, Date.now());
  if (test) return <Lire texte={test.texte} mode="test" test={test.sorte} fin={vu} />;
  return (
    <Carte titre="Bienvenue dans Lecture" className="hero">
      <p>Ici, on travaille la lecture comme elle sert vraiment : <b>lire plus efficacement sans perdre la compréhension</b>. Chaque lecture est chronométrée <i>et</i> suivie de questions sans le texte : la vitesse ne compte que si tu as compris.</p>
      <p>La séance du jour (10 minutes) : un texte à lire, un résumé de mémoire, et certains jours le plan du texte ou un survol en 60 secondes. Le niveau des textes s'adapte tout seul.</p>
      <p className="muted petit">Honnêtement : aucune méthode ne permet de lire 1000 mots par minute en comprenant (les fiches expliquent pourquoi). Ce qui marche, c'est de lire beaucoup, de se poser des questions et de se rappeler ce qu'on a lu.</p>
      <p>Pour commencer, un test de départ : un texte d'environ 300 mots et ses questions (3 à 4 minutes). C'est facultatif.</p>
      <div className="choix">
        <button className="btn" onClick={vu}>Plus tard</button>
        {t && <button className="btn primary" onClick={() => setTest(t)}>Faire le test de départ</button>}
      </div>
    </Carte>
  );
}

export default function PageSeance() {
  const { db, maj, aller } = useApp();
  const [s] = useState(() => seanceDuJour(db, Date.now()));
  const [en, setEn] = useState<Etape | null>(null);
  const [test, setTest] = useState<{ sorte: "depart" | "suivi"; texte: Texte } | null>(null);
  if (!db.reglages.accueilVu) return <Accueil />;
  const faites = db.seances[s.jour]?.etapes ?? [];
  const tf = testAFaire(db, Date.now());
  if (test) return <Lire texte={test.texte} mode="test" test={test.sorte} fin={() => setTest(null)} />;

  if (en) {
    const finEtape = () => {
      maj((d) => marquerEtape(d, s.jour, en));
      const suiv = s.etapes.find((e) => e !== en && !faites.includes(e) && s.etapes.indexOf(e) > s.etapes.indexOf(en));
      setEn(suiv ?? null);
      window.scrollTo({ top: 0 });
    };
    return (
      <div className="pile">
        <div className="muted petit">Séance du jour · étape {s.etapes.indexOf(en) + 1} / {s.etapes.length} : {NOM_ETAPE[en]}</div>
        {en === "lecture" && <Lire key="l" texte={s.texte} mode="lecture" seance fin={finEtape} />}
        {en === "resume" && <Resume key="r" texte={s.texte} fin={finEtape} />}
        {en === "plan" && <Plan key="p" texte={s.texte} seance fin={finEtape} />}
        {en === "survol" && <Survol key="s" texte={s.texteSurvol} seance fin={finEtape} />}
        <button className="btn petit retour" onClick={() => setEn(null)}>Arrêter là (ce qui est fait est gardé)</button>
      </div>
    );
  }
  const prochaine = s.etapes.find((e) => !faites.includes(e));
  const v = vitesseMediane(db);
  const n = serie(db, Date.now());
  return (
    <div className="pile">
      <Carte titre="Séance du jour" className="hero">
        <p className="muted petit">Texte du jour : « {s.texte.titre} » ({s.texte.mots} mots, niveau {NOM_NIVEAU[s.texte.niveau]}).</p>
        <ul className="plan">
          {s.etapes.map((e) => <li key={e} className={faites.includes(e) ? "fait" : ""}><span>{faites.includes(e) ? "✓ " : ""}{NOM_ETAPE[e]}</span></li>)}
        </ul>
        <Choix valeur={db.reglages.minutes} options={([5, 10, 15, 20] as const).map((m) => ({ v: m, t: `${m} min` }))} onChange={(m) => { maj((d) => ({ ...d, reglages: { ...d.reglages, minutes: m, maj: Date.now() } })); aller("seance"); }} />
        <div className="choix">
          {prochaine
            ? <button className="btn primary gros" onClick={() => setEn(prochaine)}>{faites.length ? "Continuer la séance" : "Commencer"}</button>
            : <p className="ok-texte"><b>Séance du jour faite. Bravo !</b> Les exercices restent ouverts si tu veux continuer.</p>}
        </div>
      </Carte>
      <div className="chiffres">
        <div><b>{plural(n, "jour", "jours")}</b><span>d'affilée</span></div>
        <div><b>{v === null ? "—" : Math.round(v)}</b><span>mots/min habituels</span></div>
        <div><b>{NOM_NIVEAU[db.niveaux.lecture.level]}</b><span>niveau des textes</span></div>
      </div>
      <Carte>
        {tf
          ? <><p>{tf.sorte === "depart" ? "Tu n'as pas encore fait le test de départ (3 à 4 minutes, facultatif)." : "Le test de la semaine est disponible (un texte réservé, toujours dans les mêmes conditions)."}</p><button className="btn" onClick={() => setTest(tf)}>Faire le test</button></>
          : <p className="muted petit">Prochain test de suivi dans {plural(joursAvantTest(db, Date.now()), "jour", "jours")}.</p>}
      </Carte>
    </div>
  );
}
