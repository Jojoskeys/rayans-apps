// Réglages : séance, respiration, son et vibration, rappel de gratitude, changement de jour, sauvegarde.
import { useState } from "react";
import { emptyDb, fusionner, parseDb, type Reglages } from "../core/model";
import { dureeProposee } from "../core/niveaux";
import { RYTHMES } from "../core/respiration";
import { DUREES_SEANCE } from "../core/seance";
import { saveExportFile } from "../storage";
import { Carte, Choix, useApp } from "../ui";

export default function PageReglages() {
  const { db, maj } = useApp();
  const [msg, setMsg] = useState("");
  const r = db.reglages;
  const set = (x: Partial<Reglages>) => maj((d) => ({ ...d, reglages: { ...d.reglages, ...x, maj: Date.now() } }));
  const vibrationDispo = typeof navigator !== "undefined" && "vibrate" in navigator;
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
        <Choix valeur={r.dureeSeance} options={DUREES_SEANCE.map((d) => ({ v: d, t: `${d} min${d === 10 ? " (par défaut)" : ""}` }))} onChange={(d) => set({ dureeSeance: d })} />
      </Carte>

      <Carte titre="Respiration">
        <p className="muted petit">Rythme par défaut</p>
        <Choix valeur={r.rythme} options={RYTHMES.map((x) => ({ v: x.id, t: x.nom }))} onChange={(v) => set({ rythme: v })} />
        <label className="case-a-cocher"><input type="checkbox" checked={r.son} onChange={(e) => set({ son: e.target.checked })} /> Son doux qui suit la respiration</label>
        <label className="case-a-cocher"><input type="checkbox" checked={r.vibration} onChange={(e) => set({ vibration: e.target.checked })} /> Vibration à chaque changement (téléphone){vibrationDispo ? "" : " — pas disponible sur cet appareil"}</label>
        <p className="muted petit">Durée proposée en ce moment : {dureeProposee(db.niveaux.respiration)} min.{" "}
          <button className="lien" onClick={() => maj((d) => ({ ...d, niveaux: { respiration: { niveau: 1, serie: 0, meilleur: d.niveaux.respiration.meilleur, maj: Date.now() } } }))}>Revenir à 3 min</button>
        </p>
      </Carte>

      <Carte titre="Rappel de gratitude">
        <label className="case-a-cocher"><input type="checkbox" checked={r.rappelGratitude} onChange={(e) => set({ rappelGratitude: e.target.checked })} /> Me rappeler « 3 choses bien » le soir (sur l'accueil de l'app)</label>
        {r.rappelGratitude && (
          <label className="champ">À partir de
            <select value={r.heureRappel} onChange={(e) => set({ heureRappel: Number(e.target.value) })}>
              {[18, 19, 20, 21, 22, 23].map((h) => <option key={h} value={h}>{h} h</option>)}
            </select>
          </label>
        )}
      </Carte>

      <Carte titre="Divers">
        <label className="champ">Un nouveau jour commence à
          <select value={r.heureJour} onChange={(e) => set({ heureJour: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4, 5, 6].map((h) => <option key={h} value={h}>{h} h</option>)}
          </select>
        </label>
        <button className="btn petit" onClick={() => set({ accueilVu: false })}>Revoir la présentation</button>
      </Carte>

      <Carte titre="Mes données">
        <p className="muted petit">🔒 Ton journal est sensible : il reste sur cet appareil (et dans ta synchronisation privée), il n'est envoyé nulle part ailleurs. Une copie enregistrée contient tout ton journal : garde-la en lieu sûr.</p>
        <div className="choix">
          <button className="btn" onClick={async () => { const f = await saveExportFile(`rayans-calme-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db, null, 2)); if (f) setMsg(`Copie enregistrée : ${f}`); }}>Enregistrer une copie</button>
          <label className="btn">Importer une copie<input type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importer(f); e.target.value = ""; }} /></label>
          <button className="btn" onClick={() => { if (confirm("Tout effacer (journal, respirations, questionnaires, réglages) ? C'est définitif.") && confirm("Vraiment tout effacer ?")) maj(() => ({ ...emptyDb(), reglages: { ...emptyDb().reglages, maj: Date.now() } })); }}>Tout effacer</button>
        </div>
        {msg && <p className="muted petit">{msg}</p>}
      </Carte>
    </div>
  );
}
