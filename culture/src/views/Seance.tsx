// Accueil, séance du jour (10 questions, 5 minutes), questions bonus, présentation du premier lancement.
import { useCallback, useEffect, useState } from "react";
import { jourFr } from "../core/actu";
import { dayKey } from "../core/model";
import { nomTheme, THEMES } from "../core/questions";
import { avecSeance, choixAffiches, composer, NOMS_NIVEAUX, questionDe, repondre, seanceDuJour, serie } from "../core/seance";
import { cartesDues } from "../core/espacement";
import { Barre, Carte, plural, sonFaux, sonJuste, useApp } from "../ui";

/** Une question : choisir, voir tout de suite la bonne réponse et l'explication. */
function QuestionVue({ id, onSuivant, rang, total }: { id: string; onSuivant: () => void; rang: number; total: number }) {
  const { db, maj } = useApp();
  const q = questionDe(db, id);
  const carte = db.cartes.find((c) => c.id === id);
  // Mélange figé pour cette question à l'écran (le niveau et le passage sont lus une seule fois).
  const [aff] = useState(() => (q ? choixAffiches(q, db.niveau.level, carte?.vues ?? 0) : { choix: [], bonne: 0 }));
  const [revision] = useState(() => (carte?.vues ?? 0) > 0);
  const [rep, setRep] = useState<number | null>(null);
  const repondu = rep !== null;
  const juste = rep === aff.bonne;

  const choisir = (i: number) => {
    if (repondu || !q) return;
    setRep(i);
    const ok = i === aff.bonne;
    (ok ? sonJuste : sonFaux)(db.reglages.sons);
    maj((d) => repondre(d, id, ok, Date.now()));
  };

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (!repondu) {
        const n = Number(e.key);
        if (n >= 1 && n <= aff.choix.length) choisir(n - 1);
        if (aff.choix.length === 2 && (e.key === "v" || e.key === "f")) choisir(e.key === "v" ? 0 : 1);
      } else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSuivant(); }
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  });

  if (!q) return <Carte><p className="muted">Question introuvable.</p><button className="btn" onClick={onSuivant}>Suivante</button></Carte>;
  const theme = THEMES.find((t) => t.id === q.theme);
  return (
    <Carte className="question">
      <div className="partie-tete">
        <span className="pastille">{theme?.icone} {nomTheme(q.theme)}</span>
        <span className="pastille">{NOMS_NIVEAUX[q.difficulte]}</span>
        {revision && <span className="pastille revision">Révision</span>}
        <span className="progression">{rang} / {total}</span>
      </div>
      <p className="enonce">{q.enonce}</p>
      <div className={`reponses ${q.vf ? "vf" : ""}`}>
        {aff.choix.map((c, i) => {
          const etat = !repondu ? "" : i === aff.bonne ? "bonne" : i === rep ? "fausse" : "eteinte";
          return (
            <button key={c} className={`reponse ${etat}`} disabled={repondu} onClick={() => choisir(i)}>
              <kbd>{q.vf ? (i === 0 ? "V" : "F") : i + 1}</kbd> <span>{c}</span>
            </button>
          );
        })}
      </div>
      {repondu && (
        <div className="retour-question">
          <p className={juste ? "verdict ok" : "verdict ko"}>{juste ? "Bien vu !" : `Raté : c'était « ${aff.choix[aff.bonne]} ».`}</p>
          <p>{q.explication}</p>
          {q.lien && <p className="petit"><a href={q.lien} target="_blank" rel="noreferrer">Lire l'article d'origine</a></p>}
          <p className="muted petit">{juste ? "Elle reviendra plus tard, de plus en plus espacée." : "Elle reviendra demain : c'est en la retrouvant qu'elle restera."}</p>
          <button className="btn primary" autoFocus onClick={onSuivant}>Suivante ⏎</button>
        </div>
      )}
    </Carte>
  );
}

/** Enchaîne une liste de questions. */
function Serie({ ids: depart, onFin, titre }: { ids: string[]; onFin: () => void; titre: string }) {
  // Liste figée au départ : la séance enregistrée change à chaque réponse, pas l'ordre affiché.
  const [ids] = useState(depart);
  const [i, setI] = useState(0);
  const fini = i >= ids.length;
  useEffect(() => { if (fini) onFin(); }, [fini, onFin]);
  if (fini) return null;
  return (
    <div className="pile">
      <div className="partie-tete"><h2>{titre}</h2><button className="btn petit" onClick={onFin}>Arrêter</button></div>
      <Barre part={i / ids.length} />
      <QuestionVue key={ids[i]} id={ids[i]} rang={i + 1} total={ids.length} onSuivant={() => setI(i + 1)} />
    </div>
  );
}

export default function PageSeance() {
  const { db, maj, aller, actu } = useApp();
  const now = Date.now();
  const { seance, jour } = seanceDuJour(db, now);
  const restantes = seance.ids.filter((id) => !seance.faites.includes(id));
  const [enCours, setEnCours] = useState<{ ids: string[]; titre: string } | null>(null);
  const retour = useCallback(() => setEnCours(null), []);
  const lancerBonus = () => {
    const deja = new Set([...seance.ids, ...db.reponses.filter((r) => dayKey(r.at, db.reglages.heureJour) === jour).map((r) => r.carte)]);
    const ids = composer(db, Date.now(), 5, `${jour}-bonus-${db.reponses.length}`, deja);
    if (ids.length) setEnCours({ ids, titre: "Questions bonus" });
  };

  if (enCours) return <Serie ids={enCours.ids} titre={enCours.titre} onFin={retour} />;

  const n = serie(db, now);
  const reponsesJour = db.reponses.filter((r) => dayKey(r.at, db.reglages.heureJour) === jour);
  const justesJour = reponsesJour.filter((r) => r.juste).length;
  const dues = cartesDues(db.cartes, now).length;
  const actuDansSeance = seance.ids.filter((id) => id.startsWith("actu:")).length;
  const finie = restantes.length === 0;
  return (
    <div className="pile">
      <Carte className="hero">
        <div className="hero-tete">
          <div>
            <h1>{finie ? "Séance du jour faite ✔" : "Ta séance du jour"}</h1>
            <p className="muted">{plural(seance.ids.length, "question", "questions")}, environ {Math.max(1, Math.round(seance.ids.length / 2))} minutes · niveau {NOMS_NIVEAUX[db.niveau.level].toLowerCase()}</p>
          </div>
          <div className="serie"><b>{n}</b><span>{n > 1 ? "jours de suite" : "jour de suite"}</span></div>
        </div>
        <Barre part={seance.faites.length / Math.max(1, seance.ids.length)} />
        <ul className="etapes-apercu">
          <li>🔁 {dues ? `${plural(dues, "révision", "révisions")} à faire aujourd'hui` : "Pas de révision en retard"}</li>
          <li>📰 {actuDansSeance ? plural(actuDansSeance, "question d'actualité", "questions d'actualité") : "Pas de question d'actualité aujourd'hui"}</li>
          <li>🧠 Le reste : culture générale, au bon niveau</li>
        </ul>
        {finie ? (
          <>
            <p className="ok-texte">{justesJour} bonne{justesJour > 1 ? "s" : ""} réponse{justesJour > 1 ? "s" : ""} sur {reponsesJour.length} aujourd'hui. À demain pour les révisions !</p>
            <div className="choix" style={{ justifyContent: "flex-start" }}>
              <button className="btn" onClick={lancerBonus}>5 questions bonus</button>
              <button className="btn" onClick={() => aller("progres")}>Voir mes progrès</button>
            </div>
          </>
        ) : (
          <button className="btn primary gros" autoFocus onClick={() => { maj((d) => avecSeance(d, Date.now())); setEnCours({ ids: restantes, titre: "Séance du jour" }); }}>{seance.faites.length ? `Continuer (${restantes.length} restantes)` : "Commencer"}</button>
        )}
      </Carte>
      {!actuDansSeance && (
        <Carte titre="📰 Actualité">
          {actu.erreur ? <p className="ko-texte petit">Fichier d'actualité illisible : {actu.erreur}</p>
            : actu.jours.length ? <p className="muted petit">Dernière édition lue : {jourFr(actu.jours[0])}. Ses questions sont déjà dans tes révisions ou arriveront dans les prochaines séances.</p>
            : <p className="muted petit">Aucune édition « Ton monde » trouvée pour l'instant. L'app marche très bien sans : la banque de culture générale suffit.</p>}
          <button className="btn petit" onClick={() => aller("actu")}>Voir l'actualité</button>
        </Carte>
      )}
      <p className="muted petit centre">Chaque réponse est suivie de la bonne réponse : se tester, puis voir la correction, est ce qui fait le mieux retenir (voir « Fiches »).</p>
    </div>
  );
}

export function Presentation({ onFin }: { onFin: () => void }) {
  return (
    <div className="pile">
      <Carte className="hero">
        <h1>Bienvenue dans Rayan's Culture</h1>
        <p>5 minutes par jour pour apprendre et <b>retenir</b> : de la culture générale et l'actualité de « Ton monde ».</p>
        <ul className="guide">
          <li><b>10 questions par jour</b> : des révisions, un peu d'actualité, et des nouvelles questions de culture générale.</li>
          <li><b>Révision espacée</b> : une question réussie revient dans 3 jours, puis 7, 14, 30… ; une question ratée revient demain.</li>
          <li><b>Difficulté qui s'adapte</b> : 2 bonnes réponses de suite → plus dur ; 1 erreur → plus facile.</li>
          <li><b>L'actualité</b> vient de l'édition « Ton monde » du matin, en lecture seule. Sans elle, l'app marche aussi.</li>
          <li>Les <b>fiches</b> disent honnêtement ce qui est prouvé ✅ et ce qui est discuté ⚠️.</li>
        </ul>
        <button className="btn primary gros" onClick={onFin}>C'est parti</button>
      </Carte>
    </div>
  );
}
