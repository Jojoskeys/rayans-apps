// « Nommer et réévaluer » : émotion + intensité → situation → pensée automatique → questions → intensité après.
import { useState } from "react";
import { besoinAide, FAMILLES, famille, phraseEcart, QUESTIONS_REEVAL, type CleReeval } from "../core/emotions";
import type { Entree } from "../core/model";
import { newId } from "../core/rng";
import { aujourdhui, Carte, Echelle, useApp } from "../ui";
import Aide from "./Aide";

const NB_ETAPES = 5;

export default function Nommer({ onFini }: { onFini?: (e: Entree | null) => void }) {
  const { db, maj } = useApp();
  const [etape, setEtape] = useState(1);
  const [fam, setFam] = useState("");
  const [nuance, setNuance] = useState("");
  const [intensite, setIntensite] = useState<number | null>(null);
  const [ideesNoires, setIdeesNoires] = useState(false);
  const [aideVue, setAideVue] = useState(false);
  const [situation, setSituation] = useState("");
  const [pensee, setPensee] = useState("");
  const [reponses, setReponses] = useState<Partial<Record<CleReeval, string>>>({});
  const [equilibree, setEquilibree] = useState("");
  const [apres, setApres] = useState<number | null>(null);
  const [fini, setFini] = useState<Entree | null>(null);

  const f = famille(fam);
  const tete = (titre: string) => <span>{titre} <small className="muted">({Math.min(etape, NB_ETAPES)} / {NB_ETAPES})</small></span>;

  function enregistrer() {
    const now = Date.now();
    const e: Entree = {
      id: newId(), at: now, jour: aujourdhui(db, now), famille: fam, nuance, intensite: intensite ?? 5,
      situation: situation.trim(), pensee: pensee.trim(), reponses, equilibree: equilibree.trim(), apres, ideesNoires, maj: now,
    };
    maj((d) => ({ ...d, entrees: [...d.entrees, e] }));
    setFini(e);
  }

  if (fini)
    return (
      <div className="pile">
      {fini.apres !== null && besoinAide(fini.apres, false) && <Aide intro="C'est encore très fort. Tu n'as pas à gérer ça seul : quelqu'un peut t'écouter, à toute heure." />}
      <Carte titre="C'est noté dans ton journal">
        {fini.apres !== null && <p>{phraseEcart(fini.intensite, fini.apres)}</p>}
        {fini.equilibree && <p className="dans-app">Ta pensée plus équilibrée : « {fini.equilibree} »</p>}
        <p className="muted petit">Ton journal reste sur ton appareil (et dans ta synchronisation privée), nulle part ailleurs.</p>
        <div className="choix"><button className="btn primary" onClick={() => onFini?.(fini)}>Continuer</button></div>
      </Carte>
      </div>
    );

  // Intensité très forte ou idées noires : on affiche calmement la page d'aide avant de continuer.
  if (etape === 2 && !aideVue && besoinAide(intensite ?? 0, ideesNoires))
    return (
      <div className="pile">
        <Aide intro="Ce que tu ressens a l'air très fort en ce moment. C'est important d'en parler à quelqu'un : voici des personnes à qui t'adresser, à toute heure." />
        <div className="choix"><button className="btn" onClick={() => setAideVue(true)}>Continuer l'exercice</button></div>
      </div>
    );

  if (etape === 1)
    return (
      <Carte titre={tete("Qu'est-ce que tu ressens ?")}>
        <p className="muted petit">Choisis le mot le plus proche, puis une nuance si elle colle mieux.</p>
        <div className="roue">
          {FAMILLES.map((x) => (
            <button key={x.id} type="button" className={`mot ${fam === x.id ? "actif" : ""}`} onClick={() => { setFam(x.id); setNuance(""); }}>{x.icone} {x.nom}</button>
          ))}
        </div>
        {f && (
          <div className="roue nuances">
            {f.nuances.map((n) => <button key={n} type="button" className={`mot petit ${nuance === n ? "actif" : ""}`} onClick={() => setNuance(nuance === n ? "" : n)}>{n}</button>)}
          </div>
        )}
        <p className="muted petit">Intensité, de 0 (à peine) à 10 (le plus fort possible)</p>
        <Echelle valeur={intensite} onChange={setIntensite} bas="à peine" haut="très fort" />
        <label className="case-a-cocher"><input type="checkbox" checked={ideesNoires} onChange={(e) => setIdeesNoires(e.target.checked)} /> J'ai des idées noires</label>
        <div className="choix"><button className="btn primary" disabled={!fam || intensite === null} onClick={() => setEtape(2)}>Suivant</button></div>
      </Carte>
    );

  if (etape === 2)
    return (
      <Carte titre={tete("La situation, en une phrase")}>
        <p className="muted petit">Juste les faits : où, quand, avec qui, ce qui s'est passé.</p>
        <textarea rows={2} value={situation} maxLength={600} placeholder="Ex. Le prof m'a rendu ma copie devant tout le monde." onChange={(e) => setSituation(e.target.value)} autoFocus />
        <div className="choix"><button className="btn" onClick={() => setEtape(1)}>Retour</button><button className="btn primary" onClick={() => setEtape(3)}>Suivant</button></div>
      </Carte>
    );

  if (etape === 3)
    return (
      <Carte titre={tete("La pensée qui est venue toute seule")}>
        <p className="muted petit">Ce que tu t'es dit sur le moment, même si ça paraît exagéré.</p>
        <textarea rows={2} value={pensee} maxLength={600} placeholder="Ex. Je suis nul, je vais rater mon année." onChange={(e) => setPensee(e.target.value)} autoFocus />
        <div className="choix"><button className="btn" onClick={() => setEtape(2)}>Retour</button><button className="btn primary" onClick={() => setEtape(4)}>Suivant</button></div>
      </Carte>
    );

  if (etape === 4)
    return (
      <Carte titre={tete("Regarder cette pensée autrement")}>
        {pensee.trim() && <p className="dans-app">« {pensee.trim()} »</p>}
        <p className="muted petit">Réponds à celles qui te parlent, pas besoin de tout remplir.</p>
        {QUESTIONS_REEVAL.map((q) => (
          <label key={q.id} className="champ">{q.question} <small>{q.aide}</small>
            <textarea rows={2} maxLength={600} value={reponses[q.id] ?? ""} onChange={(e) => setReponses({ ...reponses, [q.id]: e.target.value })} />
          </label>
        ))}
        <label className="champ"><b>Une pensée plus équilibrée</b> <small>Pas forcément positive : plus juste, plus complète.</small>
          <textarea rows={2} maxLength={600} value={equilibree} placeholder="Ex. J'ai raté ce contrôle, mais j'ai réussi les deux d'avant ; je peux demander de l'aide sur ce chapitre." onChange={(e) => setEquilibree(e.target.value)} />
        </label>
        <div className="choix"><button className="btn" onClick={() => setEtape(3)}>Retour</button><button className="btn primary" onClick={() => setEtape(5)}>Suivant</button></div>
      </Carte>
    );

  return (
    <Carte titre={tete("Et maintenant ?")}>
      <p>Au départ : {f?.nom.toLowerCase()}{nuance ? ` (${nuance})` : ""}, intensité {intensite}.</p>
      <p className="muted petit">Quelle intensité maintenant, de 0 à 10 ? (facultatif)</p>
      <Echelle valeur={apres} onChange={setApres} bas="à peine" haut="très fort" />
      <div className="choix"><button className="btn" onClick={() => setEtape(4)}>Retour</button><button className="btn primary" onClick={enregistrer}>Enregistrer</button></div>
    </Carte>
  );
}
