import { useState } from "react";
import { api, errorText, type Config } from "./api";
import { Field } from "./RulesView";

export function SettingsView(p: { draft: Config; setDraft: (c: Config) => void; dataDir: string; autoStatus: string }) {
  const { draft, setDraft } = p;
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Config>) => setDraft({ ...draft, ...patch });
  const setAuto = (patch: Partial<Config["auto"]>) => setDraft({ ...draft, auto: { ...draft.auto, ...patch } });

  const addFolder = async () => {
    const d = await api.pickFolder("Dossier à surveiller");
    if (d && !draft.watched.some((w) => w.toLowerCase() === d.toLowerCase())) set({ watched: [...draft.watched, d] });
  };
  const pickQuarantine = async () => {
    const d = await api.pickFolder("Dossier de quarantaine des doublons");
    if (d) set({ quarantineDir: d });
  };
  const open = (path: string) => api.openFolder(path).catch((e) => setError(errorText(e)));

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Dossiers et réglages</h1>
          <p className="muted">Seuls les fichiers posés directement dans ces dossiers sont rangés (pas les sous-dossiers).</p>
        </div>
      </header>
      {error && <div className="alert bad">{error}</div>}

      <div className="card">
        <h3>Dossiers surveillés</h3>
        <ul className="folders">
          {draft.watched.map((w) => (
            <li key={w}>
              <span className="path" title={w}>{w}</span>
              <button className="btn ghost small" onClick={() => open(w)}>Ouvrir</button>
              <button className="btn ghost small" onClick={() => set({ watched: draft.watched.filter((x) => x !== w) })}>Retirer</button>
            </li>
          ))}
          {draft.watched.length === 0 && <li className="muted">Aucun dossier surveillé.</li>}
        </ul>
        <button className="btn" onClick={addFolder}>Ajouter un dossier…</button>
      </div>

      <div className="card">
        <h3>Doublons</h3>
        <label className="check">
          <input type="checkbox" checked={draft.duplicates} onChange={(e) => set({ duplicates: e.target.checked })} />
          Repérer les fichiers au contenu identique et proposer de mettre les copies en quarantaine
        </label>
        <p className="muted small">
          Le plus ancien est gardé en place. Les copies vont dans la quarantaine, jamais à la poubelle : vous
          pouvez les récupérer ou les supprimer vous-même plus tard.
        </p>
        <Field label="Dossier de quarantaine">
          <div className="row">
            <input value={draft.quarantineDir} onChange={(e) => set({ quarantineDir: e.target.value })} />
            <button className="btn ghost" onClick={pickQuarantine}>Parcourir…</button>
            <button className="btn ghost" onClick={() => open(draft.quarantineDir)}>Ouvrir</button>
          </div>
        </Field>
      </div>

      <div className="card">
        <h3>Prudence</h3>
        <Field label="Ignorer les fichiers modifiés depuis moins de (minutes)" hint="évite de toucher un téléchargement en cours">
          <input
            className="narrow"
            inputMode="numeric"
            value={draft.ignoreRecentMinutes}
            onChange={(e) => set({ ignoreRecentMinutes: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
          />
        </Field>
      </div>

      <div className="card">
        <h3>Mode automatique</h3>
        <label className="check">
          <input type="checkbox" checked={draft.auto.enabled} onChange={(e) => setAuto({ enabled: e.target.checked })} />
          Préparer un aperçu automatiquement et me prévenir
        </label>
        <p className="muted small">
          Même en mode automatique, rien n’est déplacé sans votre validation : l’application prépare l’aperçu et
          affiche une notification. Elle doit rester ouverte (réduite) pour surveiller.
        </p>
        <div className={"auto-options" + (draft.auto.enabled ? "" : " disabled")}>
          <label className="check">
            <input type="radio" name="mode" checked={draft.auto.mode === "surveillance"} onChange={() => setAuto({ mode: "surveillance" })} disabled={!draft.auto.enabled} />
            Dès que des fichiers arrivent (après quelques instants de calme)
          </label>
          <label className="check">
            <input type="radio" name="mode" checked={draft.auto.mode === "intervalle"} onChange={() => setAuto({ mode: "intervalle" })} disabled={!draft.auto.enabled} />
            Toutes les
            <input
              className="narrow inline"
              inputMode="numeric"
              value={draft.auto.intervalMinutes}
              disabled={!draft.auto.enabled || draft.auto.mode !== "intervalle"}
              onChange={(e) => setAuto({ intervalMinutes: Math.max(5, Math.floor(Number(e.target.value) || 5)) })}
            />
            minutes
          </label>
        </div>
        <p className="muted small">État : {p.autoStatus}</p>
      </div>

      <div className="card">
        <h3>Données de l’application</h3>
        <p className="muted small">Réglages et journal des opérations (historique) :</p>
        <div className="row">
          <span className="path">{p.dataDir}</span>
          <button className="btn ghost small" onClick={() => open(p.dataDir)}>Ouvrir</button>
        </div>
      </div>
    </section>
  );
}
