// Réglages : langue, séance, nouveaux mots par jour, tons en couleur, voyelles arabes, changement de jour, sauvegarde.
import { useState } from "react";
import { LANGUES, NOM_LANGUE } from "../core/langues";
import { emptyDb, fusionner, parseDb, type Reglages } from "../core/model";
import { EXOS, startLevel } from "../core/niveaux";
import { saveExportFile } from "../storage";
import { AvisVoix, Carte, Choix, useApp, useVoix } from "../ui";

export default function PageReglages() {
  const { db, langue, maj } = useApp();
  const voix = useVoix(langue);
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
      <Carte titre="Langue">
        <Choix valeur={langue} options={LANGUES.map((l) => ({ v: l, t: NOM_LANGUE[l] }))} onChange={(l) => set({ langue: l })} />
        <p className="muted petit">Les progrès de chaque langue sont gardés à part.</p>
      </Carte>

      <Carte titre="Séance du jour">
        <p className="muted petit">Durée</p>
        <Choix valeur={r.minutes} options={([5, 10, 15, 20] as const).map((m) => ({ v: m, t: `${m} min${m === 10 ? " (par défaut)" : ""}` }))} onChange={(m) => set({ minutes: m })} />
        <p className="muted petit">Nouveaux mots par jour (au plus)</p>
        <Choix valeur={r.nouveauxParJour} options={[4, 6, 8, 10, 12].map((n) => ({ v: n, t: String(n) }))} onChange={(n) => set({ nouveauxParJour: n })} />
      </Carte>

      <Carte titre="Affichage">
        <label className="case-a-cocher"><input type="checkbox" checked={r.couleursTons} onChange={(e) => set({ couleursTons: e.target.checked })} /> Chinois : pinyin en couleur selon le ton (<span className="t1">1</span> <span className="t2">2</span> <span className="t3">3</span> <span className="t4">4</span>)</label>
        <label className="case-a-cocher"><input type="checkbox" checked={r.retirerVoyelles} onChange={(e) => set({ retirerVoyelles: e.target.checked })} /> Arabe : retirer les voyelles courtes d'un mot quand il est bien su</label>
      </Carte>

      <Carte titre="Voix">
        {voix.length ? <p className="muted petit">{voix.length} voix {langue === "zh" ? "chinoise(s)" : "arabe(s)"} trouvée(s) sur cet appareil : {voix.map((v) => v.name).join(", ")}.</p> : <AvisVoix langue={langue} />}
      </Carte>

      <Carte titre="Divers">
        <label className="champ">Un nouveau jour commence à
          <select value={r.heureJour} onChange={(e) => set({ heureJour: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4, 5, 6].map((h) => <option key={h} value={h}>{h} h</option>)}
          </select>
        </label>
        <div className="choix" style={{ justifyContent: "flex-start" }}>
          <button className="btn petit" onClick={() => set({ accueilVu: false })}>Revoir la présentation</button>
          <button className="btn petit" onClick={() => { if (confirm(`Remettre les niveaux de difficulté (${NOM_LANGUE[langue]}) au départ ? Les mots et les résultats sont gardés.`)) maj((d) => ({ ...d, niveaux: { ...d.niveaux, [langue]: Object.fromEntries(EXOS.map((e) => [e.id, { ...startLevel(e.id), maj: Date.now() }])) } })); }}>Remettre les niveaux au départ</button>
        </div>
      </Carte>

      <Carte titre="Mes données">
        <p className="muted petit">Tes données restent sur cet appareil (et dans ta synchronisation privée entre ton PC et ton téléphone).</p>
        <div className="choix">
          <button className="btn" onClick={async () => { const f = await saveExportFile(`rayans-langues-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db, null, 2)); if (f) setMsg(`Copie enregistrée : ${f}`); }}>Enregistrer une copie</button>
          <label className="btn">Importer une copie<input type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importer(f); e.target.value = ""; }} /></label>
          <button className="btn" onClick={() => { if (confirm("Tout effacer (mots, résultats, tests, réglages, pour les deux langues) ? C'est définitif.") && confirm("Vraiment tout effacer ?")) maj(() => ({ ...emptyDb(), reglages: { ...emptyDb().reglages, maj: Date.now() } })); }}>Tout effacer</button>
        </div>
        {msg && <p className="muted petit">{msg}</p>}
      </Carte>
    </div>
  );
}
