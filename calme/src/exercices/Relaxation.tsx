// Relaxation musculaire guidée en texte (contraction puis relâchement), environ 5 minutes. Pratique de confort.
import { useEffect, useState } from "react";
import { dureeRelaxation, momentRelax, ZONES } from "../core/relaxation";
import { newId } from "../core/rng";
import { fmtSecondes } from "../core/temps";
import { aujourdhui, Carte, useApp, useChrono } from "../ui";

export default function Relaxation({ onFini }: { onFini?: (faite: boolean) => void }) {
  const { maj } = useApp();
  const [etat, setEtat] = useState<"avant" | "en-cours" | "fini">("avant");
  const [pause, setPause] = useState(false);
  const [t, remettre] = useChrono(etat === "en-cours" && !pause);
  const total = dureeRelaxation();
  const m = momentRelax(t);

  useEffect(() => {
    if (etat === "en-cours" && m.type === "fin") {
      const now = Date.now();
      maj((d) => ({ ...d, activites: [...d.activites, { id: newId(), at: now, jour: aujourdhui(d, now), type: "relaxation", dureeMin: 5 }] }));
      setEtat("fini");
    }
  }, [etat, m.type, maj]);

  if (etat === "avant")
    return (
      <Carte titre="Relaxation musculaire (5 min)">
        <p>Tu vas serrer une zone du corps 5 secondes, puis la relâcher 20 secondes en sentant la différence. Dix zones, des mains aux pieds.</p>
        <p className="muted petit">Une pratique de confort, agréable pour beaucoup. Ne force jamais : si une zone est douloureuse ou blessée, laisse-la tranquille et passe à la suivante.</p>
        <div className="choix">
          {onFini && <button className="btn" onClick={() => onFini(false)}>Passer</button>}
          <button className="btn primary gros" onClick={() => setEtat("en-cours")}>Commencer</button>
        </div>
      </Carte>
    );

  if (etat === "fini")
    return (
      <Carte titre="Relaxation terminée">
        <p>Reste encore un instant immobile, puis bouge doucement les doigts et les pieds avant de te lever.</p>
        {onFini && <div className="choix"><button className="btn primary" onClick={() => onFini(true)}>Continuer</button></div>}
      </Carte>
    );

  return (
    <Carte titre="Relaxation musculaire" className="relax">
      {m.type === "intro" && <div className="relax-zone"><b>Installe-toi</b><p>Assis ou allongé, les yeux fermés si tu veux. Respire calmement.</p><span className="compte">{m.reste}</span></div>}
      {(m.type === "contracte" || m.type === "relache") && (
        <div className={`relax-zone ${m.type}`}>
          <small className="muted">Zone {m.zone + 1} / {ZONES.length} · {ZONES[m.zone].nom}</small>
          <b>{m.type === "contracte" ? "Contracte" : "Relâche"}</b>
          <p>{m.type === "contracte" ? ZONES[m.zone].consigne : "Laisse tout aller d'un coup. Sens la chaleur et la lourdeur qui arrivent."}</p>
          <span className="compte">{m.reste}</span>
        </div>
      )}
      <div className="barre"><div style={{ width: `${Math.round((t / total) * 100)}%` }} /></div>
      <p className="centre muted petit">{fmtSecondes(total - t)} restantes</p>
      <div className="choix">
        <button className="btn" onClick={() => setPause(!pause)}>{pause ? "Reprendre" : "Pause"}</button>
        <button className="btn" onClick={() => (onFini ? onFini(false) : (setEtat("avant"), setPause(false), setTimeout(remettre, 0)))}>Arrêter</button>
      </div>
    </Carte>
  );
}
