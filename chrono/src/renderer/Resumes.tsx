import { Fragment, useState } from "react";
import { liveEntry } from "../core/engine.ts";
import { addDays, DAY_NAMES, dayLabel, formatDuration, startOfDay, startOfWeek, summarize, weekLabel } from "../core/summary.ts";
import type { AppData } from "../core/types.ts";
import { api, IconDownload, IconLeft, IconRight, toDateInput } from "./shared.tsx";

export function Resumes({ data, now, notify }: { data: AppData; now: number; notify: (t: string) => void }) {
  const [kind, setKind] = useState<"jour" | "semaine">("semaine");
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const live = liveEntry(data, now);

  const from = kind === "jour" ? addDays(startOfDay(now), offset) : addDays(startOfWeek(now), offset * 7);
  const to = addDays(from, kind === "jour" ? 1 : 7);
  const s = summarize(data, from, to, live ? [live] : []);
  const title = kind === "jour" ? dayLabel(from) : weekLabel(from);
  const maxDay = Math.max(...s.days.map((d) => d.ms), 1);
  const colors = new Map(data.projects.map((p) => [p.id, p.color]));
  const names = new Map(data.projects.map((p) => [p.id, p.name]));
  const todayKey = startOfDay(now);

  const exporter = async (all: boolean) => {
    const base = all ? "rayans-chrono-tout" : kind === "jour" ? `rayans-chrono-${toDateInput(from)}` : `rayans-chrono-semaine-${toDateInput(from)}`;
    const file = await api.exportCsv(all ? { name: base } : { from, to, name: base });
    if (file) notify(`Export enregistré : ${file}`);
  };

  return (
    <div className="resumes">
      <div className="barre-outils">
        <div className="segmente">
          <button className={kind === "jour" ? "actif" : ""} onClick={() => { setKind("jour"); setOffset(0); }}>Jour</button>
          <button className={kind === "semaine" ? "actif" : ""} onClick={() => { setKind("semaine"); setOffset(0); }}>Semaine</button>
        </div>
        <div className="navigation">
          <button className="icone" onClick={() => setOffset(offset - 1)} title="Précédent"><IconLeft /></button>
          <button className="lien" onClick={() => setOffset(0)} disabled={offset === 0}>{kind === "jour" ? "Aujourd'hui" : "Cette semaine"}</button>
          <button className="icone" onClick={() => setOffset(offset + 1)} disabled={offset >= 0} title="Suivant"><IconRight /></button>
        </div>
        <div className="exports">
          <button className="bouton secondaire" onClick={() => void exporter(false)}><IconDownload size={16} /> Exporter {kind === "jour" ? "ce jour" : "cette semaine"}</button>
          <button className="bouton secondaire" onClick={() => void exporter(true)}><IconDownload size={16} /> Tout exporter</button>
        </div>
      </div>

      <section className="carte">
        <header className="entete">
          <h2 className="titre-periode">{title}</h2>
          <div className="total">{formatDuration(s.ms)}</div>
        </header>

        {kind === "semaine" && (
          <div className="histogramme" role="img" aria-label="Temps par jour">
            {s.days.map((d, i) => (
              <div key={d.key} className={`colonne ${d.start === todayKey ? "aujourdhui" : ""}`}>
                <div className="valeur">{d.ms ? formatDuration(d.ms) : ""}</div>
                <div className="pile" style={{ height: `${(d.ms / maxDay) * 100}%` }}>
                  {Object.entries(d.byProject).map(([pid, ms]) => (
                    <span key={pid} style={{ flexGrow: ms, background: colors.get(pid) }} title={`${names.get(pid)} : ${formatDuration(ms)}`} />
                  ))}
                </div>
                <div className="jour">{DAY_NAMES[i].slice(0, 3)}. {new Date(d.start).getDate()}</div>
              </div>
            ))}
          </div>
        )}

        {s.projects.length === 0 ? (
          <p className="vide">Aucun temps enregistré sur cette période.</p>
        ) : (
          <table className="tableau">
            <thead><tr><th>Projet / tâche</th><th className="nombre">Durée</th><th className="part">Part</th></tr></thead>
            <tbody>
              {s.projects.map((p) => {
                const isOpen = open.has(p.projectId);
                return (
                  <Fragment key={p.projectId}>
                    <tr className="ligne-projet" onClick={() => { const n = new Set(open); if (isOpen) n.delete(p.projectId); else n.add(p.projectId); setOpen(n); }}>
                      <td><span className="nom-projet"><span className="chevron">{isOpen ? "▾" : "▸"}</span><span className="swatch" style={{ background: p.color }} />{p.name}</span></td>
                      <td className="nombre">{formatDuration(p.ms)}</td>
                      <td className="part"><div className="jauge"><span style={{ width: `${(p.ms / s.ms) * 100}%`, background: p.color }} /></div><small>{Math.round((p.ms / s.ms) * 100)} %</small></td>
                    </tr>
                    {isOpen && p.tasks.map((t) => (
                      <tr key={t.taskId ?? "aucune"} className="ligne-tache">
                        <td>{t.name}</td>
                        <td className="nombre">{formatDuration(t.ms)}</td>
                        <td className="part"><small>{Math.round((t.ms / p.ms) * 100)} % du projet</small></td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
