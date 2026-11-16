// Routine : ce que Rayan veut faire chaque jour, à cocher, avec un rappel à l'heure choisie.
import { useState } from "react";
import { ALL_DAYS, DAY_LABELS, type RoutineItem } from "../core/routine.ts";
import type { RoutineView } from "./api-types.ts";

const api = window.aujourdhui;
const errText = (e: unknown) => String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
const DAY_NAMES: Record<number, string> = { 1: "lundi", 2: "mardi", 3: "mercredi", 4: "jeudi", 5: "vendredi", 6: "samedi", 0: "dimanche" };
const daysText = (d: number[]) => d.length === 7 ? "tous les jours" : [1, 2, 3, 4, 5].every((x) => d.includes(x)) && d.length === 5 ? "en semaine" : ALL_DAYS.filter((x) => d.includes(x)).map((x) => DAY_NAMES[x]).join(", ");

export function RoutineToday({ r, now, notify }: { r: RoutineView; now: number; notify: (t: string) => void }) {
  const [editing, setEditing] = useState(false);
  const done = r.today.filter((i) => i.done).length;
  const nowHM = new Date(now).toTimeString().slice(0, 5);
  return (
    <section className="carte routine" data-testid="routine">
      <div className="titre-ligne">
        <h2>Ma journée {r.today.length > 0 && <span className="aide">· {done}/{r.today.length}</span>}</h2>
        {r.streak > 0 && <span className="badge orange" title="Jours d'affilée où tout a été fait">{r.streak} jour{r.streak > 1 ? "s" : ""} d'affilée</span>}
        <button className={`lien ${editing ? "actif" : ""}`} data-testid="gerer-routine" onClick={() => setEditing(!editing)}>{editing ? "Terminé" : "Gérer"}</button>
      </div>
      {!editing && (r.items.length === 0 ? (
        <p className="aide">Ajoute ce que tu veux faire chaque jour (sport, lecture, révision du soir…) : une case à cocher ici et un rappel Windows à l'heure choisie tant que ce n'est pas fait. <button className="lien" onClick={() => setEditing(true)}>Ajouter une tâche</button></p>
      ) : r.today.length === 0 ? <p className="aide">Rien de prévu aujourd'hui.</p> : (
        <ul className="routine-liste">
          {r.today.map((i) => (
            <li key={i.id} className={`${i.done ? "fait" : ""} ${!i.done && i.time && i.time < nowHM ? "en-retard" : ""}`} data-testid="tache">
              <label className="case">
                <input type="checkbox" checked={i.done} onChange={() => api.routine.toggle(i.id).catch((e) => notify(errText(e)))} />
                <span className="routine-heure">{i.time || "—"}</span>
                <span className="routine-titre">{i.title}</span>
              </label>
            </li>
          ))}
        </ul>
      ))}
      {editing && <RoutineEditor r={r} notify={notify} />}
    </section>
  );
}

function RoutineEditor({ r, notify }: { r: RoutineView; notify: (t: string) => void }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  const add = () => api.routine.add(title, time, days).then(() => { setTitle(""); setTime(""); setDays(ALL_DAYS); notify("Tâche ajoutée."); }).catch((e) => notify(errText(e)));
  return (
    <div className="routine-edition" data-testid="routine-edition">
      <div className="ligne ajout-tache">
        <input className="large" data-testid="titre-tache" placeholder="Ex. 30 min de sport" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <input type="time" data-testid="heure-tache" value={time} onChange={(e) => setTime(e.target.value)} title="Heure du rappel (facultatif)" />
        <button className="bouton" data-testid="ajouter-tache" onClick={add} disabled={!title.trim()}>Ajouter</button>
      </div>
      <Days value={days} onChange={setDays} />
      <p className="aide">Sans heure : pas de rappel, juste une case à cocher. Les rappels arrivent si l'application tourne (Réglages → Démarrer avec Windows).</p>
      {r.items.length > 0 && (
        <ul className="routine-gestion">
          {r.items.map((i) => <ItemRow key={i.id} i={i} notify={notify} />)}
        </ul>
      )}
    </div>
  );
}

function ItemRow({ i, notify }: { i: RoutineItem; notify: (t: string) => void }) {
  const upd = (p: Parameters<typeof api.routine.update>[1]) => api.routine.update(i.id, p).catch((e) => notify(errText(e)));
  return (
    <li>
      <input defaultValue={i.title} onBlur={(e) => e.target.value.trim() !== i.title && void upd({ title: e.target.value })} />
      <input type="time" value={i.time} onChange={(e) => void upd({ time: e.target.value })} />
      <Days value={i.days} onChange={(d) => d.length && void upd({ days: d })} small />
      <span className="aide">{daysText(i.days)}</span>
      <button className="lien danger" onClick={() => api.routine.remove(i.id).then(() => notify(`« ${i.title} » supprimée.`)).catch((e) => notify(errText(e)))}>Supprimer</button>
    </li>
  );
}

function Days({ value, onChange, small }: { value: number[]; onChange: (d: number[]) => void; small?: boolean }) {
  return (
    <div className={`jours ${small ? "petits" : ""}`} role="group" aria-label="Jours">
      {ALL_DAYS.map((d) => (
        <button key={d} type="button" title={DAY_NAMES[d]} className={value.includes(d) ? "on" : ""} aria-pressed={value.includes(d)}
          onClick={() => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d])}>{DAY_LABELS[d]}</button>
      ))}
    </div>
  );
}
