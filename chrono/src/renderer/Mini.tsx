import { PHASE_LABEL, phaseMs, remaining, segmentElapsed } from "../core/engine.ts";
import { formatClock } from "../core/summary.ts";
import { api, IconClose, IconExpand, IconPause, IconPlay, IconSkip, PHASE_COLOR, send, useChrono } from "./shared.tsx";

export function Mini() {
  const { data, now } = useChrono();
  if (!data) return <div className="mini" />;
  const t = data.timer;
  const pomo = t.mode === "pomodoro";
  const project = data.projects.find((p) => p.id === data.selection.projectId);
  const task = data.tasks.find((x) => x.id === data.selection.taskId);
  const color = pomo ? PHASE_COLOR[t.phase] : "var(--bleu)";
  const time = pomo ? formatClock(Math.min(phaseMs(data.settings, t.phase), remaining(t, now))) : formatClock(segmentElapsed(t, now), false);
  const label = pomo ? PHASE_LABEL[t.phase] : "Chrono libre";
  const running = t.status === "marche";
  return (
    <div className={`mini ${running ? "en-marche" : ""}`} style={{ ["--phase" as string]: color }}>
      <div className="mini-info">
        <div className="mini-phase"><span className="dot" />{label}{t.status === "pause" ? " · en pause" : ""}</div>
        <div className="mini-temps" data-testid="mini-temps">{time}</div>
        <div className="mini-tache" title={`${project?.name ?? ""}${task ? ` — ${task.name}` : ""}`}>
          <span className="swatch" style={{ background: project?.color }} />{project?.name}{task ? ` — ${task.name}` : ""}
        </div>
      </div>
      <div className="mini-boutons">
        <button className="rond principal" onClick={() => send({ type: "toggle" })} title={running ? "Pause" : "Démarrer"} data-testid="mini-demarrer">
          {running ? <IconPause size={18} /> : <IconPlay size={18} />}
        </button>
        {pomo && <button className="rond" onClick={() => send({ type: "skip" })} title="Passer à la phase suivante"><IconSkip size={16} /></button>}
        <div className="mini-coin">
          <button className="petit" onClick={() => void api.command("principal")} title="Agrandir" data-testid="mini-agrandir"><IconExpand size={14} /></button>
          <button className="petit" onClick={() => void api.command("masquer-mini")} title="Fermer la mini-fenêtre"><IconClose size={14} /></button>
        </div>
      </div>
    </div>
  );
}
