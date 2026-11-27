// « 3 choses bien aujourd'hui », avec le pourquoi. Sans promesse chiffrée.
import { useState } from "react";
import type { Gratitude as G } from "../core/model";
import { newId } from "../core/rng";
import { aujourdhui, Carte, useApp } from "../ui";

const EXEMPLES = ["Un repas que j'ai aimé", "Un message d'un ami", "Avoir fini un exercice difficile"];

export default function Gratitude({ onFini }: { onFini?: (g: G | null) => void }) {
  const { db, maj } = useApp();
  const [choses, setChoses] = useState([{ quoi: "", pourquoi: "" }, { quoi: "", pourquoi: "" }, { quoi: "", pourquoi: "" }]);
  const [fini, setFini] = useState(false);
  const remplies = choses.filter((c) => c.quoi.trim());
  const set = (i: number, x: Partial<{ quoi: string; pourquoi: string }>) => setChoses(choses.map((c, j) => (j === i ? { ...c, ...x } : c)));

  function enregistrer() {
    const now = Date.now();
    const g: G = { id: newId(), at: now, jour: aujourdhui(db, now), choses: remplies.map((c) => ({ quoi: c.quoi.trim(), pourquoi: c.pourquoi.trim() })), maj: now };
    maj((d) => ({ ...d, gratitudes: [...d.gratitudes, g] }));
    setFini(true);
    onFini?.(g);
  }

  if (fini)
    return (
      <Carte titre="Merci pour ces trois choses">
        <p>Elles sont gardées dans ton journal privé. Les relire un jour moins bien peut faire du bien.</p>
      </Carte>
    );

  return (
    <Carte titre="3 choses bien aujourd'hui">
      <p className="muted petit">Petites ou grandes, peu importe. Le « pourquoi » aide à revivre un peu le moment.</p>
      {choses.map((c, i) => (
        <div key={i} className="gratitude-ligne">
          <label className="champ">{i + 1}. Ce qui était bien
            <input value={c.quoi} maxLength={300} placeholder={EXEMPLES[i]} onChange={(e) => set(i, { quoi: e.target.value })} />
          </label>
          <label className="champ">Pourquoi ça m'a fait du bien
            <input value={c.pourquoi} maxLength={300} onChange={(e) => set(i, { pourquoi: e.target.value })} />
          </label>
        </div>
      ))}
      <div className="choix">
        {onFini && <button className="btn" onClick={() => onFini(null)}>Passer</button>}
        <button className="btn primary" disabled={remplies.length === 0} onClick={enregistrer}>Enregistrer</button>
      </div>
    </Carte>
  );
}
