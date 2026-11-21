// La séance du jour (10 min par défaut) : astuce, entraînement mélangé, défi court facultatif.
// Au premier lancement : une courte présentation et le test de départ (proposé, pas obligatoire).
import { useState } from "react";
import { AstuceLecon, Defi, Entrainement, Test } from "../activites";
import { astuceInfo } from "../core/astuces";
import { testPropose } from "../core/defis";
import { faitsDus } from "../core/espacement";
import { marquerEtape, seanceDuJour, serie, type EtapeId } from "../core/seance";
import { Barre, Carte, plural, useApp } from "../ui";

function Bienvenue({ onTest }: { onTest: () => void }) {
  const { maj } = useApp();
  const vu = () => maj((d) => ({ ...d, reglages: { ...d.reglages, bienvenue: true, maj: Date.now() } }));
  return (
    <Carte className="hero" titre="Bienvenue dans Rayan's Calcul mental">
      <p>Chaque jour, une petite séance (10 minutes par défaut) :</p>
      <ul className="liste-simple">
        <li><b>une astuce</b> expliquée pas à pas, avec le « pourquoi » et 10 exercices ;</li>
        <li><b>un entraînement mélangé</b> qui s'adapte à toi (2 réussites → plus dur, 1 erreur → plus facile) ;</li>
        <li><b>un défi d'une minute</b>, seulement si tu en as envie.</li>
      </ul>
      <p className="muted">Pas de chrono pendant l'entraînement : la vitesse vient avec la pratique. Ce que l'app entraîne surtout, c'est… le calcul mental ; pour le reste des maths, l'effet est discuté (voir Fiches).</p>
      <p>Pour voir tes vrais progrès, tu peux commencer par un <b>test de départ</b> : 20 calculs, 3 à 5 minutes. Tu en referas un chaque semaine.</p>
      <div className="choix">
        <button className="btn primary gros" onClick={() => { vu(); onTest(); }}>Faire le test de départ</button>
        <button className="btn" onClick={vu}>Plus tard</button>
      </div>
    </Carte>
  );
}

export default function PageSeance() {
  const { db, maj, aller } = useApp();
  const [vue, setVue] = useState<EtapeId | "test" | null>(null);
  const now = Date.now();
  const s = seanceDuJour(db, now);
  const test = testPropose(db, now);
  const dus = faitsDus(db, now).length;
  const marquer = (e: EtapeId) => maj((d) => marquerEtape(d, e, Date.now()));
  const retour = () => { setVue(null); window.scrollTo({ top: 0 }); };

  if (vue === "test" && test) return <Test numero={test.numero} surFin={retour} />;
  if (vue === "astuce") return <AstuceLecon id={s.astuce} surFin={(r) => { if (r) marquer("astuce"); retour(); }} />;
  if (vue === "entrainement") {
    const m = s.etapes.find((e) => e.id === "entrainement")!.minutes;
    return <Entrainement secondes={m * 60} surFin={(r) => { if (r.total) marquer("entrainement"); retour(); }} />;
  }
  if (vue === "defi") return <Defi id="60s" surFin={(fait) => { if (fait) marquer("defi"); retour(); }} />;

  const prochaine = s.etapes.find((e) => !s.faites.includes(e.id) && !e.facultatif);
  const faites = s.etapes.filter((e) => !e.facultatif && s.faites.includes(e.id)).length;
  const obligatoires = s.etapes.filter((e) => !e.facultatif).length;
  const a = astuceInfo(s.astuce);
  return (
    <div className="pile">
      {!db.reglages.bienvenue && <Bienvenue onTest={() => setVue("test")} />}
      <Carte className="hero">
        <div className="hero-tete">
          <div>
            <h1>{s.finie ? "Séance du jour faite ✓" : "Ta séance du jour"}</h1>
            <p className="muted">{db.reglages.minutes} minutes · {s.finie ? "le défi reste là si tu en as envie." : "une étape après l'autre, à ton rythme."}</p>
          </div>
          <div className="serie" title="Jours d'affilée avec une séance terminée"><b>{serie(db, now)}</b><span>🔥 jours</span></div>
        </div>
        <ol className="etapes-apercu">
          {s.etapes.map((e) => (
            <li key={e.id} className={s.faites.includes(e.id) ? "faite" : ""}>
              <button className="lien-etape" onClick={() => setVue(e.id)}>
                {s.faites.includes(e.id) ? "✓" : "○"} {e.titre}
                {e.id === "astuce" && <span className="muted"> — {a.icone} {a.titre}{s.nouvelle ? " (nouvelle)" : " (à revoir)"}</span>}
                {e.id === "entrainement" && dus > 0 && <span className="muted"> — dont {plural(dus, "calcul", "calculs")} à revoir</span>}
              </button>
              <em>{e.minutes} min</em>
            </li>
          ))}
        </ol>
        <Barre part={faites / obligatoires} />
        <div className="choix">
          {prochaine ? (
            <button className="btn primary gros" onClick={() => setVue(prochaine.id)}>{faites ? "Continuer" : "Commencer"} : {prochaine.titre.toLowerCase()}</button>
          ) : !s.faites.includes("defi") ? (
            <>
              <button className="btn primary gros" onClick={() => setVue("defi")}>Défi de 60 s (facultatif)</button>
              <button className="btn" onClick={() => aller("progres")}>Voir mes progrès</button>
            </>
          ) : (
            <button className="btn" onClick={() => aller("progres")}>Voir mes progrès</button>
          )}
        </div>
      </Carte>
      {test && db.reglages.bienvenue && (
        <Carte titre={test.numero === 0 ? "Test de départ" : "Test de suivi de la semaine"}>
          <p className="muted">20 calculs à difficulté fixe (3 à 5 min) pour comparer avec {test.numero === 0 ? "les prochaines semaines" : "ton test de départ"} : justesse et temps moyen.</p>
          <div className="choix"><button className="btn" onClick={() => setVue("test")}>Faire le {test.nom.toLowerCase()}</button></div>
        </Carte>
      )}
      <div className="tuiles">
        <button className="tuile" onClick={() => aller("exercices")}><span>🧮</span><b>Exercices</b><em>Astuces, estimation, défis</em></button>
        <button className="tuile" onClick={() => aller("fiches")}><span>📚</span><b>Fiches</b><em>Ce que dit la recherche</em></button>
        <button className="tuile" onClick={() => aller("progres")}><span>📈</span><b>Progrès</b><em>Courbes et tests</em></button>
      </div>
    </div>
  );
}
