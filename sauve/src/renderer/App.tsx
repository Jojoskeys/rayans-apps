import { useEffect, useState, type ReactNode } from "react";
import { ago, daysSince, FOLDER, formatBytes, lastPart, lastSuccess, type RunResult, type Source } from "../core/backup.ts";
import type { State } from "./api-types.ts";

const api = window.sauve;
const errText = (e: unknown) => String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
const uid = () => Math.random().toString(36).slice(2, 10);
const duree = (ms: number) => (ms < 60_000 ? `${Math.max(1, Math.round(ms / 1000))} s` : `${Math.round(ms / 60_000)} min`);

export function App() {
  const [s, setS] = useState<State | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { api.getState().then(setS); return api.onState(setS); }, []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 8000); return () => clearTimeout(id); }, [toast]);
  if (!s) return <div className="chargement">Chargement…</div>;

  const st = s.data.settings;
  const set = (p: Partial<typeof st>) => api.updateSettings(p).then(setS);
  const last = lastSuccess(s.data);
  const days = daysSince(last, s.now);
  const late = days === null || days >= st.reminderDays;
  const lastRun = s.data.history.at(-1) ?? null;
  const setSource = (id: string, p: Partial<Source>) => set({ sources: st.sources.map((x) => (x.id === id ? { ...x, ...p } : x)) });

  return (
    <div className="page">
      <section className={`etat ${late ? "en-retard" : "a-jour"}`} data-testid="etat">
        <div>
          <p className="etiquette">Dernière sauvegarde</p>
          <h1 data-testid="derniere">{last ? ago(last, s.now) : "Aucune sauvegarde"}</h1>
          <p className="aide">{late
            ? (last ? `Plus de ${st.reminderDays} jours : il est temps de sauvegarder.` : "Choisissez une destination puis lancez la première sauvegarde.")
            : `Prochain rappel dans ${st.reminderDays - (days ?? 0)} jour${st.reminderDays - (days ?? 0) > 1 ? "s" : ""}.`}</p>
        </div>
        {s.progress ? (
          <div className="progression">
            <div className="barre-progression"><i style={{ width: `${((s.progress.index + 0.5) / s.progress.total) * 100}%` }} /></div>
            <span>{s.progress.label} ({s.progress.index + 1}/{s.progress.total})</span>
            <button className="bouton secondaire" onClick={() => api.cancel()}>Arrêter</button>
          </div>
        ) : (
          <button className="bouton grand" data-testid="sauvegarder" disabled={!s.destinationOk || !st.sources.some((x) => x.enabled)} onClick={async () => {
            try {
              const r = await api.backup();
              setToast(r.ok ? `Sauvegarde terminée : ${r.copied} fichier(s) copié(s), ${r.skipped} déjà à jour.` : r.cancelled ? "Sauvegarde arrêtée." : `Sauvegarde incomplète : ${r.problems[0] ?? ""}`);
            } catch (e) { setToast(errText(e)); }
          }}><IconSave /> Sauvegarder maintenant</button>
        )}
      </section>

      {lastRun && <Rapport r={lastRun} />}

      <div className="carte">
        <h2>Destination</h2>
        {st.destination ? (
          <p className="chemin"><code data-testid="destination">{st.destination}</code>
            {s.destinationOk ? <span className="ok">accessible</span> : <span className="ko">introuvable : disque débranché ?</span>}</p>
        ) : <p className="aide">Un disque externe, une clé USB ou votre dossier OneDrive. La sauvegarde va dans un dossier « {FOLDER} ».</p>}
        <div className="ligne">
          <button className="bouton secondaire" onClick={async () => { const p = await api.pickDestination(); if (p) await set({ destination: p }); }}><IconFolder /> {st.destination ? "Changer…" : "Choisir…"}</button>
          {s.oneDrive && st.destination !== s.oneDrive && <button className="bouton secondaire" onClick={() => set({ destination: s.oneDrive })}><IconCloud /> OneDrive</button>}
          {st.destination && s.destinationOk && <button className="lien" onClick={() => api.open(`${st.destination}\\${FOLDER}`)}>Ouvrir la sauvegarde</button>}
        </div>
        {s.oneDrive && st.destination === s.oneDrive && st.sources.some((x) => x.enabled && x.id === "documents" && x.path.startsWith(s.oneDrive!)) && (
          <p className="aide">Vos Documents sont déjà synchronisés par OneDrive : vous pouvez décocher « Documents » ci-dessous.</p>
        )}
      </div>

      <div className="carte">
        <h2>À sauvegarder</h2>
        <ul className="sources" data-testid="sources">
          {st.sources.map((x) => (
            <li key={x.id} className={s.exists[x.id] ? "" : "absente"}>
              <label className="case">
                <input type="checkbox" checked={x.enabled} onChange={(e) => setSource(x.id, { enabled: e.target.checked })} />
                <span>{x.label}<small title={x.path}>{x.path}{x.files.length ? ` (${x.files.join(", ")})` : ""}{s.exists[x.id] ? "" : " — introuvable sur cet ordinateur"}</small></span>
              </label>
              {!x.preset && <button className="icone" title="Retirer" onClick={() => set({ sources: st.sources.filter((y) => y.id !== x.id) })}><IconClose /></button>}
            </li>
          ))}
        </ul>
        <button className="lien" onClick={async () => {
          const dirs = await api.pickSources();
          const fresh = dirs.filter((d) => !st.sources.some((x) => x.path.toLowerCase() === d.toLowerCase()));
          if (fresh.length) await set({ sources: [...st.sources, ...fresh.map((d) => ({ id: uid(), label: lastPart(d), path: d, enabled: true, files: [], excludeDirs: ["node_modules"], preset: false }))] });
        }}><IconPlus /> Ajouter un dossier</button>
        <p className="aide">Les caches des applications (qui se recréent seuls) et les jonctions comme « Ma musique » ne sont pas copiés. Seuls les fichiers nouveaux ou modifiés sont recopiés.</p>
      </div>

      <div className="carte">
        <h2>Options</h2>
        <label className="case"><input type="checkbox" checked={st.mirror} onChange={(e) => set({ mirror: e.target.checked })} />
          <span>Miroir<small>Supprime aussi de la sauvegarde ce que vous avez supprimé ici. Sinon, rien n'est jamais effacé de la sauvegarde.</small></span></label>
        <label className="champ-ligne">Me rappeler de sauvegarder après
          <select value={st.reminderDays} onChange={(e) => set({ reminderDays: Number(e.target.value) })}>
            {[3, 7, 14, 30].map((n) => <option key={n} value={n}>{n} jours</option>)}
          </select>
        </label>
        <label className="case"><input type="checkbox" checked={st.startWithWindows} onChange={(e) => set({ startWithWindows: e.target.checked })} />
          <span>Démarrer avec Windows<small>Discrètement, dans la zone de notification, pour le rappel.</small></span></label>
        <label className="case"><input type="checkbox" checked={st.closeToTray} onChange={(e) => set({ closeToTray: e.target.checked })} />
          <span>Garder dans la zone de notification à la fermeture</span></label>
      </div>

      {s.data.history.length > 1 && (
        <div className="carte">
          <h2>Historique</h2>
          <table className="historique">
            <tbody>
              {[...s.data.history].reverse().slice(0, 10).map((h) => (
                <tr key={h.at}>
                  <td>{new Date(h.at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className={h.ok ? "ok" : "ko"}>{h.ok ? "Réussie" : h.cancelled ? "Arrêtée" : "Incomplète"}</td>
                  <td>{h.copied} copié(s) · {formatBytes(h.bytes)}</td>
                  <td className="discret">{duree(h.durationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="pied">
        <button className="lien" onClick={() => api.open(s.dataDir)}>Dossier des réglages</button>
        <button className="lien danger" onClick={() => api.quit()}>Quitter</button>
        <span>Version {s.version}</span>
      </p>
      {toast && <div className="toast" role="status"><span>{toast}</span><button className="icone" onClick={() => setToast(null)} title="Fermer"><IconClose /></button></div>}
    </div>
  );
}

function Rapport({ r }: { r: RunResult }) {
  return (
    <div className={`rapport ${r.ok ? "" : "attention"}`} data-testid="rapport">
      <b>{r.ok ? "Dernière sauvegarde réussie" : r.cancelled ? "Dernière sauvegarde arrêtée" : "Dernière sauvegarde incomplète"}</b>
      <span>{r.copied} fichier(s) copié(s) ({formatBytes(r.bytes)}), {r.skipped} déjà à jour{r.failed ? `, ${r.failed} en échec` : ""} · {duree(r.durationMs)}</span>
      {r.problems.length > 0 && <ul>{r.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>}
    </div>
  );
}

const Svg = ({ children, size = 18 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
type P = { size?: number };
const IconSave = (p: P) => <Svg {...p}><path d="M12 3v12M7 10l5 5 5-5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></Svg>;
const IconFolder = (p: P) => <Svg {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Svg>;
const IconCloud = (p: P) => <Svg {...p}><path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z" /></Svg>;
const IconClose = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
const IconPlus = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
