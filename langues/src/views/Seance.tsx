// Séance du jour (10 min par défaut) : révisions dues, nouveaux mots, production (ordre ou dictée), oreille ou lettres.
// Au tout premier lancement : choix de la langue, courte présentation et test de départ proposé.
import { useState } from "react";
import { cartesDues } from "../core/espacement";
import { LANGUES, NOM_LANGUE, NOM_NATIF, type Langue } from "../core/langues";
import { planSeance, testFaitCetteSemaine, type Etape } from "../core/seance";
import { serie } from "../core/stats";
import ExoDictee from "../exercices/Dictee";
import ExoLettres from "../exercices/Lettres";
import ExoOrdre from "../exercices/Ordre";
import ExoTest from "../exercices/Test";
import ExoTons from "../exercices/Tons";
import { Decouverte, Revisions } from "../exercices/Cartes";
import { aujourdhui, Carte, Choix, plural, useApp } from "../ui";

function Accueil() {
  const { db, maj } = useApp();
  const [langue, setLangue] = useState<Langue | null>(db.reglages.langue);
  const [test, setTest] = useState(false);
  const choisir = (l: Langue, faireTest: boolean) => {
    maj((d) => ({ ...d, reglages: { ...d.reglages, langue: l, accueilVu: !faireTest, maj: Date.now() } }));
    if (faireTest) setTest(true);
  };
  if (test && db.reglages.langue)
    return <ExoTest fin={() => maj((d) => ({ ...d, reglages: { ...d.reglages, accueilVu: true, maj: Date.now() } }))} />;
  return (
    <div className="pile">
      <Carte titre="Bienvenue dans Langues" className="hero">
        <p>Deux langues pour débuter : le <b>chinois mandarin</b> (environ 300 mots courants, caractères simplifiés et pinyin, tons en couleur) et l'<b>arabe</b> standard (lettres, voyelles courtes, mots et phrases de tous les jours).</p>
        <p>Chaque jour, une séance de 10 minutes : les mots à revoir reviennent au bon moment (révisions espacées), tu en découvres quelques nouveaux, tu construis des phrases et tu entraînes ton oreille. La difficulté s'adapte toute seule.</p>
        <p className="muted petit">Honnêtement : ces exercices aident surtout à retenir du vocabulaire et à reconnaître les sons. Pour parler couramment, il faudra aussi parler avec des gens. Les fiches expliquent ce que montre la recherche.</p>
      </Carte>
      <Carte titre="Par quelle langue commencer ?">
        <div className="grand-choix">
          {LANGUES.map((l) => (
            <button key={l} className={langue === l ? "actif" : ""} onClick={() => setLangue(l)} aria-pressed={langue === l}>
              <b className={l}>{NOM_NATIF[l]}</b>{NOM_LANGUE[l]}
            </button>
          ))}
        </div>
        <p className="muted petit">Tu pourras changer à tout moment avec le bouton en haut ; les progrès sont séparés pour chaque langue.</p>
        {langue && (
          <>
            <p>Un petit test de départ (20 mots, 5 phrases, environ 3 minutes) permettra de voir tes progrès. C'est facultatif ; si tu débutes complètement, réponds « Je ne sais pas » sans souci.</p>
            <div className="choix">
              <button className="btn" onClick={() => choisir(langue, false)}>Plus tard</button>
              <button className="btn primary" onClick={() => choisir(langue, true)}>Faire le test de départ</button>
            </div>
          </>
        )}
      </Carte>
    </div>
  );
}

function Exercice({ e, fin }: { e: Etape; fin: () => void }) {
  const { langue } = useApp();
  if (e.id === "revisions") return <Revisions n={e.n} fin={fin} />;
  if (e.id === "nouveaux") return <Decouverte n={e.n} fin={fin} />;
  if (e.id === "production") return e.sorte === "dictee" ? <ExoDictee n={e.n} fin={fin} /> : <ExoOrdre n={e.n} fin={fin} />;
  return langue === "zh" ? <ExoTons n={e.n} fin={fin} /> : <ExoLettres n={e.n} fin={fin} />;
}

export default function PageSeance() {
  const { db, langue, maj, aller } = useApp();
  const [plan] = useState(() => planSeance(db, langue, Date.now()));
  const [en, setEn] = useState<number | null>(null);
  const [test, setTest] = useState(false);
  if (!db.reglages.langue || !db.reglages.accueilVu) return <Accueil />;
  const cle = `${langue}:${aujourdhui(db)}`;
  const faites = [...(db.seances[cle]?.etapes ?? []), ...plan.filter((e) => e.n === 0).map((e) => e.id)];
  const marquer = (id: string) => maj((d) => ({ ...d, seances: { ...d.seances, [cle]: { etapes: [...new Set([...(d.seances[cle]?.etapes ?? []), id])] } } }));
  const prochaine = plan.findIndex((e) => !faites.includes(e.id));

  if (test) return <ExoTest fin={() => setTest(false)} />;
  if (en !== null) {
    const e = plan[en];
    return (
      <div className="pile">
        <div className="etapes muted petit">Séance du jour · étape {en + 1} / {plan.length} : {e.titre}</div>
        <Exercice key={en} e={e} fin={() => {
          marquer(e.id);
          const suiv = plan.findIndex((x, k) => k > en && !faites.includes(x.id) && x.id !== e.id);
          setEn(suiv >= 0 ? suiv : null);
        }} />
        <button className="btn petit retour" onClick={() => setEn(null)}>Arrêter là (ce qui est fait est gardé)</button>
      </div>
    );
  }
  const n = serie(db, langue, Date.now());
  const dues = cartesDues(db.cartes, langue, Date.now()).length;
  return (
    <div className="pile">
      <Carte titre={`Séance du jour · ${NOM_LANGUE[langue]}`} className="hero">
        <ul className="plan">
          {plan.map((e) => (
            <li key={e.id} className={faites.includes(e.id) ? "fait" : ""}>
              <span>{faites.includes(e.id) ? "✓ " : ""}{e.titre}</span>
              <span className="muted">{e.id === "revisions" ? plural(e.n, "mot", "mots") : e.id === "nouveaux" ? plural(e.n, "mot", "mots") : plural(e.n, "question", "questions")}</span>
            </li>
          ))}
        </ul>
        <Choix valeur={db.reglages.minutes} options={[5, 10, 15, 20].map((m) => ({ v: m as 5 | 10 | 15 | 20, t: `${m} min` }))}
          onChange={(m) => { maj((d) => ({ ...d, reglages: { ...d.reglages, minutes: m, maj: Date.now() } })); aller("seance"); }} />
        <div className="choix">
          {prochaine >= 0
            ? <button className="btn primary gros" onClick={() => setEn(prochaine)}>{db.seances[cle]?.etapes.length ? "Continuer la séance" : "Commencer"}</button>
            : <p className="ok-texte"><b>Séance du jour faite. Bravo !</b> Les exercices restent ouverts si tu veux continuer.</p>}
        </div>
      </Carte>
      <div className="chiffres">
        <div><b>{plural(n, "jour", "jours")}</b><span>d'affilée</span></div>
        <div><b>{db.cartes.filter((c) => c.langue === langue).length}</b><span>mots découverts</span></div>
        <div><b>{dues}</b><span>à réviser aujourd'hui</span></div>
      </div>
      {!testFaitCetteSemaine(db, langue, Date.now()) && (
        <Carte>
          <p>{db.tests.some((t) => t.langue === langue) ? "Le test de la semaine n'est pas encore fait (3 minutes, pour suivre tes progrès)." : "Tu n'as pas encore fait de test de départ dans cette langue (3 minutes, facultatif)."}</p>
          <button className="btn" onClick={() => setTest(true)}>Faire le test</button>
        </Carte>
      )}
    </div>
  );
}
