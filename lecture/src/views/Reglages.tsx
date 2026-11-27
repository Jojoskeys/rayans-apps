// Réglages : durée de la séance, changement de jour, niveaux, sauvegarde.
import { useState } from "react";
import { emptyDb, fusionner, parseDb, type Reglages } from "../core/model";
import { EXOS, startLevel } from "../core/niveaux";
import { saveExportFile } from "../storage";
import { Carte, Choix, useApp } from "../ui";

export default function PageReglages() {
  const { db, maj } = useApp();
  const [msg, setMsg] = useState("");
  const r = db.reglages;
  const set = (x: Partial<Reglages>) => maj((d) => ({ ...d, reglages: { ...d.reglages, ...x, maj: Date.now() } }));
  const importer = async (f: File) => {
    try {
      const autre = parseDb(await f.text());
      maj((d) => fusionner(d, autre));
      setMsg("Sauvegarde importée et fusionnée avec tes données (rien n'est effacé).");
    } catch (e) {
      setMsg(`Import impossible : ${(e as Error).message}`);
    }
  };
  return (
    <div className="pile">
      <Carte titre="Séance du jour">
        <p className="muted petit">Durée</p>
        <Choix valeur={r.minutes} options={([5, 10, 15, 20] as const).map((m) => ({ v: m, t: `${m} min${m === 10 ? " (par défaut)" : ""}` }))} onChange={(m) => set({ minutes: m })} />
        <p className="muted petit">5 min : une lecture courte. 10 min : lecture et résumé, plus le plan ou le survol un jour sur deux. 15 et 20 min : davantage d'exercices.</p>
      </Carte>

      <Carte titre="Divers">
        <label className="champ">Un nouveau jour commence à
          <select value={r.heureJour} onChange={(e) => set({ heureJour: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4, 5, 6].map((h) => <option key={h} value={h}>{h} h</option>)}
          </select>
        </label>
        <div className="choix" style={{ justifyContent: "flex-start" }}>
          <button className="btn petit" onClick={() => set({ accueilVu: false })}>Revoir la présentation</button>
          <button className="btn petit" onClick={() => { if (confirm("Remettre tous les exercices au niveau facile ? Les résultats sont gardés.")) maj((d) => ({ ...d, niveaux: Object.fromEntries(EXOS.map((e) => [e.id, { ...startLevel(), maj: Date.now() }])) as typeof d.niveaux })); }}>Remettre les niveaux au départ</button>
        </div>
      </Carte>

      <Carte titre="Mes données">
        <p className="muted petit">Tes données (résultats, résumés, notes) restent sur cet appareil (et dans ta synchronisation privée entre ton PC et ton téléphone).</p>
        <div className="choix">
          <button className="btn" onClick={async () => { const f = await saveExportFile(`rayans-lecture-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db, null, 2)); if (f) setMsg(`Copie enregistrée : ${f}`); }}>Enregistrer une copie</button>
          <label className="btn">Importer une copie<input type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importer(f); e.target.value = ""; }} /></label>
          <button className="btn" onClick={() => { if (confirm("Tout effacer (résultats, résumés, notes, réglages) ? C'est définitif.") && confirm("Vraiment tout effacer ?")) maj(() => ({ ...emptyDb(), reglages: { ...emptyDb().reglages, maj: Date.now() } })); }}>Tout effacer</button>
        </div>
        {msg && <p className="muted petit">{msg}</p>}
      </Carte>
    </div>
  );
}
