import { useState } from "react";
import { liveEntry, PHASE_LABEL, phaseMs, remaining, segmentElapsed } from "../core/engine.ts";
import { addDays, formatClock, formatDuration, formatTime, startOfDay, summarize } from "../core/summary.ts";
import type { AppData } from "../core/types.ts";
import {
  api, fromDateTimeInputs, IconMini, IconPause, IconPlay, IconPlus, IconReset, IconSkip, IconTrash, PHASE_COLOR, send, toDateInput,
} from "./shared.tsx";

export function Minuteur({ data, now }: { data: AppData; now: number }) {
  return (
    <div className="grille-minuteur">
      <Cadran data={data} now={now} />
      <Aujourdhui data={data} now={now} />
    </div>
  );
}

function Cadran({ data, now }: { data: AppData; now: number }) {
  const t = data.timer;
  const pomo = t.mode === "pomodoro";
  const running = t.status === "marche";
  const total = phaseMs(data.settings, t.phase);
  const rest = Math.min(total, remaining(t, now));
  const progress = pomo ? 1 - rest / total : (segmentElapsed(t, now) % 3_600_000) / 3_600_000;
  const color = pomo ? PHASE_COLOR[t.phase] : "var(--bleu)";
  const R = 118;
  const C = 2 * Math.PI * R;
  const label = pomo ? PHASE_LABEL[t.phase] : running ? "Chrono en marche" : "Chrono libre";
  const startLabel = running ? "Pause" : t.status === "pause" ? "Reprendre" : "Démarrer";

  return (
    <section className="carte cadran" style={{ ["--phase" as string]: color }}>
      <div className="segmente" role="tablist" aria-label="Mode">
        <button role="tab" aria-selected={pomo} className={pomo ? "actif" : ""} onClick={() => send({ type: "setMode", mode: "pomodoro" })}>Pomodoro</button>
        <button role="tab" aria-selected={!pomo} className={!pomo ? "actif" : ""} onClick={() => send({ type: "setMode", mode: "chrono" })}>Chrono libre</button>
      </div>

      <div className={`anneau ${running ? "en-marche" : ""}`}>
        <svg viewBox="0 0 260 260" width="260" height="260">
          <circle cx="130" cy="130" r={R} className="piste" />
          <circle cx="130" cy="130" r={R} className="progression" strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, Math.max(0, progress)))} transform="rotate(-90 130 130)" />
        </svg>
        <div className="anneau-texte">
          <div className="phase">{label}{t.status === "pause" ? " · en pause" : ""}</div>
          <div className="temps" data-testid="temps">{pomo ? formatClock(rest) : formatClock(segmentElapsed(t, now), false)}</div>
          {pomo && (
            <div className="cycles" title={`${t.cycle} pomodoro(s) sur ${data.settings.longEvery} avant la longue pause · ${t.completed} au total`}>
              {Array.from({ length: data.settings.longEvery }, (_, i) => <span key={i} className={i < t.cycle ? "plein" : ""} />)}
            </div>
          )}
        </div>
      </div>

      <div className="commandes">
        <button className="rond secondaire" onClick={() => send({ type: "reset" })} disabled={t.status === "arret" && (!pomo || (t.phase === "travail" && t.cycle === 0))} title="Arrêter et remettre à zéro"><IconReset /></button>
        <button className="rond principal grand" onClick={() => send({ type: "toggle" })} data-testid="demarrer" aria-label={startLabel} title={startLabel}>
          {running ? <IconPause size={28} /> : <IconPlay size={28} />}
        </button>
        <button className="rond secondaire" onClick={() => send({ type: "skip" })} disabled={!pomo} title="Passer à la phase suivante"><IconSkip /></button>
      </div>

      <Selection data={data} />

      <button className="lien" onClick={() => void api.command("mini")}><IconMini size={16} /> Mini-fenêtre toujours visible</button>
    </section>
  );
}

function Selection({ data }: { data: AppData }) {
  const [newTask, setNewTask] = useState("");
  const projects = data.projects.filter((p) => !p.archived);
  const tasks = data.tasks.filter((x) => x.projectId === data.selection.projectId && (!x.done || x.id === data.selection.taskId));
  const addTask = () => {
    if (!newTask.trim()) return;
    send({ type: "addTask", projectId: data.selection.projectId, name: newTask });
    setNewTask("");
  };
  return (
    <div className="selection">
      <label>
        <span>Projet</span>
        <select value={data.selection.projectId} onChange={(e) => send({ type: "select", projectId: e.target.value, taskId: null })}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label>
        <span>Tâche</span>
        <select value={data.selection.taskId ?? ""} onChange={(e) => send({ type: "select", projectId: data.selection.projectId, taskId: e.target.value || null })}>
          <option value="">— Sans tâche —</option>
          {tasks.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </label>
      <form className="ajout-rapide" onSubmit={(e) => { e.preventDefault(); addTask(); }}>
        <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Nouvelle tâche pour ce projet…" />
        <button type="submit" className="icone" disabled={!newTask.trim()} title="Ajouter la tâche"><IconPlus size={18} /></button>
      </form>
    </div>
  );
}

function Aujourdhui({ data, now }: { data: AppData; now: number }) {
  const [form, setForm] = useState(false);
  const day = startOfDay(now);
  const live = liveEntry(data, now);
  const s = summarize(data, day, addDays(day, 1), live ? [live] : []);
  const entries = [...data.entries.filter((e) => e.end > day && e.start < addDays(day, 1)), ...(live ? [live] : [])].reverse();
  const proj = new Map(data.projects.map((p) => [p.id, p]));
  const task = new Map(data.tasks.map((x) => [x.id, x]));

  return (
    <section className="carte aujourdhui">
      <header className="entete">
        <h2>Aujourd'hui</h2>
        <div className="total" data-testid="total-jour">{formatDuration(s.ms)}</div>
      </header>

      {s.projects.length > 0 && (
        <div className="barre-projets" aria-label="Répartition par projet">
          {s.projects.map((p) => <span key={p.projectId} style={{ flexGrow: p.ms, background: p.color }} title={`${p.name} : ${formatDuration(p.ms)}`} />)}
        </div>
      )}
      <ul className="legende">
        {s.projects.map((p) => (
          <li key={p.projectId}><span className="swatch" style={{ background: p.color }} />{p.name}<b>{formatDuration(p.ms)}</b></li>
        ))}
      </ul>

      <div className="entete-liste">
        <h3>Plages enregistrées</h3>
        <button className="lien" onClick={() => setForm(!form)}><IconPlus size={16} /> {form ? "Fermer" : "Ajouter du temps"}</button>
      </div>
      {form && <SaisieManuelle data={data} now={now} onDone={() => setForm(false)} />}

      {entries.length === 0 ? (
        <p className="vide">Rien d'enregistré aujourd'hui. Choisissez un projet et cliquez sur Démarrer.</p>
      ) : (
        <ul className="plages">
          {entries.map((e) => {
            const p = proj.get(e.projectId);
            const en = e.id === "en-cours";
            return (
              <li key={e.id} className={en ? "en-cours" : ""}>
                <span className="heures">{formatTime(e.start)} – {en ? "…" : formatTime(e.end)}</span>
                <span className="swatch" style={{ background: p?.color }} />
                <span className="quoi">
                  {p?.name}{e.taskId && task.get(e.taskId) ? <em> — {task.get(e.taskId)!.name}</em> : null}
                  {e.note ? <small> · {e.note}</small> : null}
                </span>
                <span className="duree">{en ? formatClock(e.end - e.start, false) : formatDuration(e.end - e.start)}</span>
                {en ? <span className="place-icone" /> : <button className="icone discret" title="Supprimer cette plage" onClick={() => send({ type: "deleteEntry", id: e.id })}><IconTrash size={16} /></button>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function SaisieManuelle({ data, now, onDone }: { data: AppData; now: number; onDone: () => void }) {
  const [projectId, setProjectId] = useState(data.selection.projectId);
  const [taskId, setTaskId] = useState<string>("");
  const [date, setDate] = useState(toDateInput(now));
  const [start, setStart] = useState(formatTime(now - 3_600_000));
  const [end, setEnd] = useState(formatTime(now));
  const [note, setNote] = useState("");
  const s = date && start ? fromDateTimeInputs(date, start) : NaN;
  let e = date && end ? fromDateTimeInputs(date, end) : NaN;
  if (e <= s) e = addDays(startOfDay(e), 1) + (e - startOfDay(e)); // fin après minuit
  const valid = Number.isFinite(s) && Number.isFinite(e) && e - s >= 60_000 && e - s <= 24 * 3_600_000;
  return (
    <form className="saisie" onSubmit={(ev) => {
      ev.preventDefault();
      if (!valid) return;
      send({ type: "addEntry", projectId, taskId: taskId || null, start: s, end: e, note });
      onDone();
    }}>
      <select value={projectId} onChange={(ev) => { setProjectId(ev.target.value); setTaskId(""); }}>
        {data.projects.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select value={taskId} onChange={(ev) => setTaskId(ev.target.value)}>
        <option value="">— Sans tâche —</option>
        {data.tasks.filter((x) => x.projectId === projectId).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} aria-label="Date" />
      <div className="heures-saisie">
        <input type="time" value={start} onChange={(ev) => setStart(ev.target.value)} aria-label="Début" />
        <span>à</span>
        <input type="time" value={end} onChange={(ev) => setEnd(ev.target.value)} aria-label="Fin" />
        <span className="duree">{valid ? formatDuration(e - s) : "—"}</span>
      </div>
      <input value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Note (facultatif)" />
      <button type="submit" className="bouton" disabled={!valid}>Ajouter</button>
    </form>
  );
}
