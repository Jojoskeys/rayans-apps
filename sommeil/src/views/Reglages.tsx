// Réglages : durée visée, temps d'endormissement, nuit en deux parties, lieu et méthode de Fajr, routine, sauvegarde.
import { useState } from "react";
import { LIEU_PAR_DEFAUT, METHODS, VILLES } from "../core/horaires";
import { emptyDb, fusionner, parseDb, type Lieu, type Reglages } from "../core/model";
import { newId } from "../core/rng";
import { fmtDuree } from "../core/temps";
import { saveExportFile } from "../storage";
import { Carte, useApp } from "../ui";

function LieuManuel({ actuel, valider }: { actuel: Lieu; valider: (l: Lieu) => void }) {
  const [l, setL] = useState({ name: actuel.name, lat: String(actuel.lat), lng: String(actuel.lng), tz: actuel.tz });
  const lat = Number(l.lat.replace(",", "."));
  const lng = Number(l.lng.replace(",", "."));
  let tzOk = true;
  try { new Intl.DateTimeFormat("fr", { timeZone: l.tz }); } catch { tzOk = false; }
  const ok = l.name.trim() && Number.isFinite(lat) && Math.abs(lat) < 90 && Number.isFinite(lng) && Math.abs(lng) <= 180 && tzOk;
  return (
    <div className="grille-champs">
      <label className="champ">Nom<input value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} /></label>
      <label className="champ">Latitude<input inputMode="decimal" value={l.lat} onChange={(e) => setL({ ...l, lat: e.target.value })} /></label>
      <label className="champ">Longitude<input inputMode="decimal" value={l.lng} onChange={(e) => setL({ ...l, lng: e.target.value })} /></label>
      <label className="champ">Fuseau horaire<input value={l.tz} onChange={(e) => setL({ ...l, tz: e.target.value })} placeholder="Europe/Paris" /></label>
      <button className="btn" disabled={!ok} onClick={() => valider({ name: l.name.trim().slice(0, 80), lat, lng, tz: l.tz })}>Utiliser ce lieu</button>
    </div>
  );
}

export default function PageReglages() {
  const { db, maj, priere } = useApp();
  const [msg, setMsg] = useState("");
  const [nouveau, setNouveau] = useState("");
  const r = db.reglages;
  const set = (x: Partial<Reglages>) => maj((d) => ({ ...d, reglages: { ...d.reglages, ...x, maj: Date.now() } }));
  const setRoutine = (f: (e: typeof db.routine.elements) => typeof db.routine.elements) => maj((d) => ({ ...d, routine: { elements: f(d.routine.elements), maj: Date.now() } }));
  const lieu = r.lieu ?? LIEU_PAR_DEFAUT;
  const durees = Array.from({ length: 9 }, (_, i) => 420 + i * 15);
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
      <Carte titre="Ta nuit">
        <label className="champ">Durée de sommeil visée
          <select value={r.dureeMin} onChange={(e) => set({ dureeMin: Number(e.target.value) })}>
            {durees.map((m) => <option key={m} value={m}>{fmtDuree(m)}{m === 450 ? " (par défaut)" : ""}</option>)}
          </select>
        </label>
        <label className="champ">Temps pour t'endormir
          <select value={r.latenceMin} onChange={(e) => set({ latenceMin: Number(e.target.value) })}>
            {[5, 10, 15, 20, 30, 45].map((m) => <option key={m} value={m}>{m} min{m === 15 ? " (par défaut)" : ""}</option>)}
          </select>
        </label>
        <label className="case-a-cocher"><input type="checkbox" checked={r.recoucher} onChange={(e) => set({ recoucher: e.target.checked })} /> Je me recouche après Fajr (nuit en deux parties)</label>
        {r.recoucher && (
          <div className="grille-champs">
            <label className="champ">Heure de coucher souhaitée<input type="time" value={r.coucherSouhaite} onChange={(e) => e.target.value && set({ coucherSouhaite: e.target.value })} /></label>
            <label className="champ">Éveillé pour Fajr pendant
              <select value={r.pauseFajrMin} onChange={(e) => set({ pauseFajrMin: Number(e.target.value) })}>
                {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </label>
          </div>
        )}
        {r.recoucher && <p className="muted petit">Dormir en deux fois n'est pas prouvé meilleur : l'écran du soir te montre honnêtement les deux parties et ton heure de lever finale.</p>}
      </Carte>

      <Carte titre="Lieu et calcul de Fajr">
        {priere ? (
          <label className="case-a-cocher"><input type="checkbox" checked={r.source === "priere"} onChange={(e) => set({ source: e.target.checked ? "priere" : "perso" })} /> Reprendre le lieu et la méthode de Rayan's Prière ({priere.lieu})</label>
        ) : <p className="muted petit">Rayan's Prière n'est pas trouvé sur cet appareil : Sommeil utilise les réglages ci-dessous.</p>}
        {(!priere || r.source === "perso") && (
          <>
            <label className="champ">Ville
              <select value={VILLES.some((v) => v.name === lieu.name) ? lieu.name : ""} onChange={(e) => { const v = VILLES.find((x) => x.name === e.target.value); if (v) set({ lieu: v }); }}>
                {!VILLES.some((v) => v.name === lieu.name) && <option value="">{lieu.name} (saisi à la main)</option>}
                {VILLES.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
              </select>
            </label>
            <details><summary className="muted petit">Saisir un lieu à la main</summary><LieuManuel actuel={lieu} valider={(l) => set({ lieu: l })} /></details>
            <label className="champ">Méthode de calcul
              <select value={r.methode} onChange={(e) => set({ methode: e.target.value })}>
                {METHODS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            {r.methode === "perso" && (
              <label className="champ">Angle de Fajr (°)<input type="number" min={5} max={25} step={0.5} value={r.customFajr} onChange={(e) => set({ customFajr: Math.min(25, Math.max(5, Number(e.target.value) || 15)) })} /></label>
            )}
            <label className="champ">Hautes latitudes
              <select value={r.highLat} onChange={(e) => set({ highLat: e.target.value })}>
                <option value="angle">Selon l'angle (par défaut)</option>
                <option value="milieu">Milieu de la nuit</option>
                <option value="septieme">Septième de la nuit</option>
                <option value="aucune">Aucune correction</option>
              </select>
            </label>
          </>
        )}
      </Carte>

      <Carte titre="Routine du soir">
        <ul className="routine-edit">
          {db.routine.elements.map((e, i) => (
            <li key={e.id}>
              <input type="checkbox" checked={e.actif} onChange={(x) => setRoutine((l) => l.map((y) => (y.id === e.id ? { ...y, actif: x.target.checked } : y)))} aria-label="Afficher" />
              <span className={e.actif ? "" : "muted"}>{e.texte}</span>
              <button className="btn mini" disabled={i === 0} onClick={() => setRoutine((l) => { const c = [...l]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; })} aria-label="Monter">↑</button>
              <button className="btn mini" onClick={() => setRoutine((l) => l.filter((y) => y.id !== e.id))} aria-label="Retirer">✕</button>
            </li>
          ))}
        </ul>
        <div className="ajout">
          <input value={nouveau} placeholder="Ajouter une étape (ex. étirements doux)" onChange={(e) => setNouveau(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && nouveau.trim()) { setRoutine((l) => [...l, { id: newId(), texte: nouveau.trim().slice(0, 120), actif: true }]); setNouveau(""); } }} />
          <button className="btn" disabled={!nouveau.trim()} onClick={() => { setRoutine((l) => [...l, { id: newId(), texte: nouveau.trim().slice(0, 120), actif: true }]); setNouveau(""); }}>Ajouter</button>
        </div>
        <p className="muted petit">La routine commence 45 min avant l'heure de coucher.</p>
      </Carte>

      <Carte titre="Divers">
        <label className="champ">Un nouveau jour commence à
          <select value={r.heureJour} onChange={(e) => set({ heureJour: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4, 5, 6].map((h) => <option key={h} value={h}>{h} h</option>)}
          </select>
        </label>
      </Carte>

      <Carte titre="Mes données">
        <div className="choix">
          <button className="btn" onClick={async () => { const f = await saveExportFile(`rayans-sommeil-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db, null, 2)); if (f) setMsg(`Copie enregistrée : ${f}`); }}>Enregistrer une copie</button>
          <label className="btn">Importer une copie<input type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importer(f); e.target.value = ""; }} /></label>
          <button className="btn" onClick={() => { if (confirm("Tout effacer (journal, bilans, routine, réglages) ? C'est définitif.") && confirm("Vraiment tout effacer ?")) maj(() => ({ ...emptyDb(), reglages: { ...emptyDb().reglages, maj: Date.now() } })); }}>Tout effacer</button>
        </div>
        {msg && <p className="muted petit">{msg}</p>}
      </Carte>
    </div>
  );
}
