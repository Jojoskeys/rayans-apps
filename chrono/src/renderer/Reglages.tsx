import { useEffect, useState } from "react";
import type { AppData, Settings } from "../core/types.ts";
import type { InitialState } from "./api-types.ts";
import { api, IconFolder, send } from "./shared.tsx";
import { playChime } from "./sound.ts";

export function Reglages({ data, init }: { data: AppData; init: InitialState }) {
  const s = data.settings;
  const set = (patch: Partial<Settings>) => send({ type: "settings", patch });
  const num = (key: "workMin" | "shortBreakMin" | "longBreakMin" | "longEvery", label: string, unit: string, max: number) => (
    <label className="champ">
      <span>{label}</span>
      <span className="avec-unite">
        <NumberInput value={s[key]} max={max} onCommit={(v) => set({ [key]: v })} />
        <small>{unit}</small>
      </span>
    </label>
  );
  const check = (key: "autoStartBreaks" | "autoStartWork" | "sound" | "notifications" | "miniOnTop" | "closeToTray", label: string, hint?: string) => (
    <label className="case">
      <input type="checkbox" checked={s[key]} onChange={(e) => set({ [key]: e.target.checked })} />
      <span>{label}{hint && <small>{hint}</small>}</span>
    </label>
  );

  return (
    <div className="reglages">
      <section className="carte">
        <h2>Cycle Pomodoro</h2>
        <div className="champs">
          {num("workMin", "Travail", "min", 180)}
          {num("shortBreakMin", "Pause courte", "min", 60)}
          {num("longBreakMin", "Longue pause", "min", 120)}
          {num("longEvery", "Longue pause après", "pomodoros", 12)}
        </div>
        {check("autoStartBreaks", "Démarrer les pauses automatiquement")}
        {check("autoStartWork", "Reprendre le travail automatiquement après une pause")}
        <p className="aide">Une phase en cours garde sa durée ; les nouvelles valeurs s'appliquent à la suivante.</p>
      </section>

      <section className="carte">
        <h2>Alertes</h2>
        {check("notifications", "Notification Windows en fin de phase")}
        {check("sound", "Son en fin de phase")}
        <div className="volume">
          <span>Volume</span>
          <input type="range" min={0} max={100} value={s.volume} disabled={!s.sound} onChange={(e) => set({ volume: Number(e.target.value) })} />
          <button className="bouton secondaire" disabled={!s.sound} onClick={() => playChime("pause", s.volume)}>Tester</button>
        </div>
      </section>

      <section className="carte">
        <h2>Fenêtres</h2>
        {check("miniOnTop", "Mini-fenêtre toujours au-dessus des autres")}
        {check("closeToTray", "Fermer la fenêtre garde Rayan's Chrono dans la zone de notification", "Le minuteur continue ; clic droit sur l'icône près de l'horloge pour quitter.")}
        <button className="bouton secondaire" onClick={() => void api.command("quitter")}>Quitter Rayan's Chrono</button>
      </section>

      <section className="carte">
        <h2>Données</h2>
        <p className="aide">Tout est enregistré sur cet ordinateur, dans un seul fichier <code>chrono.json</code> (avec une copie de la version précédente <code>chrono.json.bak</code>).</p>
        <p className="chemin"><code>{init.dataDir}</code></p>
        <button className="bouton secondaire" onClick={() => void api.command("ouvrir-dossier")}><IconFolder size={16} /> Ouvrir le dossier</button>
        <p className="version">Rayan's Chrono {init.version}</p>
      </section>
    </div>
  );
}

/** Champ numérique : on peut l'effacer pour retaper ; la valeur est appliquée en quittant le champ ou avec Entrée. */
function NumberInput({ value, max, onCommit }: { value: number; max: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const v = Math.round(Number(text.replace(",", ".")));
    if (Number.isFinite(v) && v >= 1 && v <= max) onCommit(v);
    else setText(String(value));
  };
  return (
    <input type="number" min={1} max={max} value={text} onChange={(e) => setText(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
  );
}
