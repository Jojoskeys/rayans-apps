// Avant l'examen / le moment stressant (5 à 8 min) : respiration 2 min → écrire ce qui inquiète → phrase de
// réévaluation → une respiration finale. Présenté honnêtement : à essayer pour soi, rien de magique.
import { useState } from "react";
import type { Preparation } from "../core/model";
import { newId } from "../core/rng";
import { fmtSecondes } from "../core/temps";
import { aujourdhui, Carte, useApp, useChrono } from "../ui";
import Respirer from "./Respirer";

type Etape = "intro" | "respirer" | "ecrire" | "phrase" | "final" | "fin";

export default function Examen({ onFini }: { onFini?: () => void }) {
  const { db, maj } = useApp();
  const [etape, setEtape] = useState<Etape>("intro");
  const [texte, setTexte] = useState("");
  const [garder, setGarder] = useState(false);
  const [t] = useChrono(etape === "ecrire");

  function terminer() {
    const now = Date.now();
    const p: Preparation = { id: newId(), at: now, jour: aujourdhui(db, now), ...(garder && texte.trim() ? { texte: texte.trim() } : {}), maj: now };
    maj((d) => ({ ...d, preparations: [...d.preparations, p] }));
    onFini?.();
  }

  const num = (n: number) => <small className="muted">({n} / 4)</small>;

  if (etape === "intro")
    return (
      <Carte titre="Avant le moment stressant">
        <p>5 à 8 minutes, en 4 étapes : respirer, écrire ce qui t'inquiète, une phrase pour ton corps, une dernière respiration.</p>
        <ol className="guide">
          <li>Respiration 4-6 pendant 2 min</li>
          <li>Écrire ce qui t'inquiète (3 à 5 min)</li>
          <li>« Mon cœur accélère, mon corps se prépare »</li>
          <li>Une respiration finale</li>
        </ol>
        <div className="choix"><button className="btn primary gros" onClick={() => setEtape("respirer")}>C'est parti</button></div>
      </Carte>
    );

  if (etape === "respirer")
    return <Respirer key="r1" titre="1. Respirer (2 min)" dureeS={120} rythmeImpose="quatre-six" noter={false} direct onFini={() => setEtape("ecrire")} />;

  if (etape === "ecrire")
    return (
      <Carte titre={<>2. Écrire ce qui t'inquiète {num(2)}</>}>
        <p className="muted petit">Écris librement ce qui te fait peur pour ce moment : ce qui pourrait mal se passer, ce que tu ressens. Personne ne le lira.</p>
        <textarea rows={8} value={texte} maxLength={10000} onChange={(e) => setTexte(e.target.value)} autoFocus placeholder="J'ai peur de…" />
        <p className="muted petit">{fmtSecondes(t)} · 3 à 5 minutes suffisent.</p>
        <p className="alerte petit">Honnêtement : une étude de 2011 a trouvé que ça aidait avant un examen, mais une autre, dans une vraie classe, n'a rien retrouvé. C'est à essayer pour toi : regarde si ça t'aide.</p>
        <div className="choix"><button className="btn primary" onClick={() => setEtape("phrase")}>{t < 180 ? "J'ai fini d'écrire" : "Suivant"}</button></div>
      </Carte>
    );

  if (etape === "phrase")
    return (
      <Carte titre={<>3. Une phrase pour ton corps {num(3)}</>}>
        <p className="affirmation">« Mon cœur accélère : mon corps se prépare. Cette énergie peut m'aider à me concentrer. »</p>
        <p>Dis-la dans ta tête, une ou deux fois. Le cœur qui bat, les mains moites : ce sont des signes que ton corps se met en route, pas forcément que ça va mal se passer.</p>
        <p className="muted petit">Preuve limitée : idée testée surtout par une même équipe de chercheurs. Garde-la si elle te parle.</p>
        <div className="choix"><button className="btn primary" onClick={() => setEtape("final")}>Suivant</button></div>
      </Carte>
    );

  if (etape === "final")
    return <Respirer key="r2" titre="4. Une respiration finale" dureeS={10} rythmeImpose="quatre-six" noter={false} direct onFini={() => setEtape("fin")} />;

  return (
    <Carte titre="Tu es prêt">
      <p>Tu as fait ce que tu pouvais pour te poser. Le reste, tu le feras au mieux, et c'est déjà bien.</p>
      {texte.trim() && <label className="case-a-cocher"><input type="checkbox" checked={garder} onChange={(e) => setGarder(e.target.checked)} /> Garder ce que j'ai écrit dans mon journal privé (sinon, c'est effacé)</label>}
      <div className="choix"><button className="btn primary" onClick={terminer}>Terminer</button></div>
    </Carte>
  );
}
