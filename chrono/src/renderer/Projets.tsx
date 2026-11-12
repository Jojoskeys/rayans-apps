import { useState } from "react";
import { liveEntry, PALETTE } from "../core/engine.ts";
import { addDays, formatDuration, startOfDay, startOfWeek, summarize } from "../core/summary.ts";
import type { AppData, Project } from "../core/types.ts";
import { IconPlay, IconPlus, IconTrash, send } from "./shared.tsx";

export function Projets({ data, now, onGo }: { data: AppData; now: number; onGo: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const live = liveEntry(data, now);
  const extra = live ? [live] : [];
  const day = startOfDay(now);
  const week = startOfWeek(now);
  const today = summarize(data, day, addDays(day, 1), extra);
  const thisWeek = summarize(data, week, addDays(week, 7), extra);
  const all = summarize(data, -Infinity, Infinity, extra);
  const totals = { today, thisWeek, all };
  const active = data.projects.filter((p) => !p.archived);
  const archived = data.projects.filter((p) => p.archived);
  const used = new Set(data.projects.map((p) => p.color));
  const nextColor = color ?? PALETTE.find((c) => !used.has(c)) ?? PALETTE[0];

  return (
    <div className="projets">
      <form className="carte nouveau-projet" onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        send({ type: "addProject", name, color: nextColor });
        setName(""); setColor(null);
      }}>
        <input type="color" value={nextColor} onChange={(e) => setColor(e.target.value)} title="Couleur du projet" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du nouveau projet (client, matière, activité…)" />
        <button className="bouton" type="submit" disabled={!name.trim()}><IconPlus size={18} /> Créer le projet</button>
      </form>

      {active.map((p) => <CarteProjet key={p.id} p={p} data={data} totals={totals} onGo={onGo} canArchive={active.length > 1} />)}

      {archived.length > 0 && (
        <div className="archives">
          <button className="lien" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? "Masquer" : "Afficher"} les projets archivés ({archived.length})
          </button>
          {showArchived && archived.map((p) => <CarteProjet key={p.id} p={p} data={data} totals={totals} onGo={onGo} canArchive />)}
        </div>
      )}
    </div>
  );
}

type Totals = Record<"today" | "thisWeek" | "all", ReturnType<typeof summarize>>;

function CarteProjet({ p, data, totals, onGo, canArchive }: { p: Project; data: AppData; totals: Totals; onGo: () => void; canArchive: boolean }) {
  const [rename, setRename] = useState<string | null>(null);
  const [task, setTask] = useState("");
  const [showDone, setShowDone] = useState(false);
  const pt = (k: keyof Totals) => totals[k].projects.find((x) => x.projectId === p.id);
  const taskMs = (id: string) => pt("all")?.tasks.find((x) => x.taskId === id)?.ms ?? 0;
  const tasks = data.tasks.filter((x) => x.projectId === p.id);
  const open = tasks.filter((x) => !x.done);
  const done = tasks.filter((x) => x.done);
  const selected = data.selection.projectId === p.id;
  const go = (taskId: string | null) => {
    send({ type: "select", projectId: p.id, taskId });
    if (data.timer.status !== "marche") send({ type: "start" });
    onGo();
  };
  const remove = () => {
    const n = data.entries.filter((e) => e.projectId === p.id).length;
    const msg = n
      ? `Supprimer « ${p.name} », ses ${tasks.length} tâche(s) et ses ${n} plage(s) de temps ? Cette action est définitive. (Pour le garder dans l'historique, archivez-le plutôt.)`
      : `Supprimer le projet « ${p.name} » ?`;
    if (window.confirm(msg)) send({ type: "deleteProject", id: p.id });
  };

  return (
    <section className={`carte projet ${p.archived ? "archive" : ""} ${selected ? "selectionne" : ""}`}>
      <header>
        <input type="color" value={p.color} onChange={(e) => send({ type: "updateProject", id: p.id, color: e.target.value })} title="Couleur" />
        {rename !== null ? (
          <form onSubmit={(e) => { e.preventDefault(); send({ type: "updateProject", id: p.id, name: rename }); setRename(null); }} className="renommer">
            <input autoFocus value={rename} onChange={(e) => setRename(e.target.value)} onBlur={() => { send({ type: "updateProject", id: p.id, name: rename }); setRename(null); }} />
          </form>
        ) : (
          <h2 onDoubleClick={() => setRename(p.name)} title="Double-clic pour renommer">{p.name}</h2>
        )}
        <dl className="chiffres">
          <div><dt>Aujourd'hui</dt><dd>{formatDuration(pt("today")?.ms ?? 0)}</dd></div>
          <div><dt>Semaine</dt><dd>{formatDuration(pt("thisWeek")?.ms ?? 0)}</dd></div>
          <div><dt>Total</dt><dd>{formatDuration(pt("all")?.ms ?? 0)}</dd></div>
        </dl>
        {!p.archived && <button className="rond petit-rond" onClick={() => go(null)} title="Travailler sur ce projet"><IconPlay size={14} /></button>}
      </header>

      <ul className="taches">
        {open.map((x) => (
          <li key={x.id} className={data.selection.taskId === x.id ? "selectionne" : ""}>
            <input type="checkbox" checked={false} onChange={() => send({ type: "updateTask", id: x.id, done: true })} title="Marquer comme terminée" />
            <TaskName id={x.id} name={x.name} />
            <span className="duree">{formatDuration(taskMs(x.id))}</span>
            {!p.archived && <button className="icone" onClick={() => go(x.id)} title="Travailler sur cette tâche"><IconPlay size={14} /></button>}
            <button className="icone discret" onClick={() => { if (window.confirm(`Supprimer la tâche « ${x.name} » ? Son temps reste compté dans le projet.`)) send({ type: "deleteTask", id: x.id }); }} title="Supprimer la tâche"><IconTrash size={15} /></button>
          </li>
        ))}
        {showDone && done.map((x) => (
          <li key={x.id} className="terminee">
            <input type="checkbox" checked onChange={() => send({ type: "updateTask", id: x.id, done: false })} title="Rouvrir" />
            <TaskName id={x.id} name={x.name} />
            <span className="duree">{formatDuration(taskMs(x.id))}</span>
            <button className="icone discret" onClick={() => { if (window.confirm(`Supprimer la tâche « ${x.name} » ?`)) send({ type: "deleteTask", id: x.id }); }} title="Supprimer la tâche"><IconTrash size={15} /></button>
          </li>
        ))}
      </ul>

      <footer>
        <form className="ajout-rapide" onSubmit={(e) => { e.preventDefault(); if (task.trim()) { send({ type: "addTask", projectId: p.id, name: task }); setTask(""); } }}>
          <input value={task} onChange={(e) => setTask(e.target.value)} placeholder="Ajouter une tâche…" />
          <button type="submit" className="icone" disabled={!task.trim()} title="Ajouter"><IconPlus size={18} /></button>
        </form>
        <div className="actions">
          {done.length > 0 && <button className="lien" onClick={() => setShowDone(!showDone)}>{showDone ? "Masquer" : "Voir"} les terminées ({done.length})</button>}
          <button className="lien" onClick={() => setRename(p.name)}>Renommer</button>
          {(p.archived || canArchive) && <button className="lien" onClick={() => send({ type: "updateProject", id: p.id, archived: !p.archived })}>{p.archived ? "Désarchiver" : "Archiver"}</button>}
          {data.projects.length > 1 && <button className="lien danger" onClick={remove}>Supprimer</button>}
        </div>
      </footer>
    </section>
  );
}

function TaskName({ id, name }: { id: string; name: string }) {
  const [edit, setEdit] = useState<string | null>(null);
  if (edit !== null) {
    const commit = () => { send({ type: "updateTask", id, name: edit }); setEdit(null); };
    return (
      <form className="renommer" onSubmit={(e) => { e.preventDefault(); commit(); }}>
        <input autoFocus value={edit} onChange={(e) => setEdit(e.target.value)} onBlur={commit} />
      </form>
    );
  }
  return <span className="nom" onDoubleClick={() => setEdit(name)} title="Double-clic pour renommer">{name}</span>;
}
