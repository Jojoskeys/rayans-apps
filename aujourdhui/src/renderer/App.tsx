import { useEffect, useState, type ReactNode } from "react";
import { NAMES, totalLeft, type SourceCount, type SourceId } from "../core/counts.ts";
import type { State } from "./api-types.ts";

const api = window.aujourdhui;
const errText = (e: unknown) => String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
const pad = (n: number) => String(n).padStart(2, "0");

const DESCRIPTIONS: Record<SourceId, string> = {
  revision: "Cartes de révision",
  hifz: "Portions du Coran à réciter",
  ouvertures: "Positions d'ouverture à rejouer",
};

export function App() {
  const [s, setS] = useState<State | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [reglages, setReglages] = useState(false);
  useEffect(() => {
    api.getState().then(setS);
    return api.onState(setS);
  }, []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 7000); return () => clearTimeout(id); }, [toast]);
  if (!s) return <div className="chargement">Chargement…</div>;

  const left = totalLeft(s.counts);
  const [y, m, d] = s.today.split("-").map(Number);
  const date = new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const heure = `${pad(s.settings.reminderHour)}:${pad(s.settings.reminderMinute)}`;

  return (
    <div className="page">
      <header className="entete">
        <div>
          <p className="date">{date}</p>
          <h1 data-testid="resume">{left ? `${left} élément${left > 1 ? "s" : ""} à réviser` : "Tout est fait pour aujourd'hui"}</h1>
        </div>
        <div className="actions">
          <button className="icone" title="Actualiser" onClick={() => api.refresh().then(setS)}><IconRefresh /></button>
          <button className={`icone ${reglages ? "actif" : ""}`} title="Réglages" data-testid="bouton-reglages" onClick={() => setReglages(!reglages)}><IconGear /></button>
        </div>
      </header>

      {!reglages ? (
        <>
          <ul className="sources" data-testid="sources">
            {s.counts.map((c) => <Source key={c.id} c={c} onOpen={() => api.openApp(c.id).then(() => setToast(`Rayan's ${NAMES[c.id]} s'ouvre…`)).catch((e) => setToast(errText(e)))} />)}
          </ul>
          <p className="aide pied">
            {s.settings.reminder ? <>Rappel à <b>{heure}</b> s'il reste quelque chose.</> : "Rappel du soir désactivé."}{" "}
            Mis à jour à {new Date(s.updatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.
          </p>
        </>
      ) : (
        <Reglages s={s} notify={setToast} />
      )}
      {toast && <div className="toast" role="status"><span>{toast}</span><button className="icone" onClick={() => setToast(null)} title="Fermer"><IconClose /></button></div>}
    </div>
  );
}

function Source({ c, onOpen }: { c: SourceCount; onOpen: () => void }) {
  const fait = c.total === 0 && !c.missing;
  return (
    <li className={`source ${c.total ? "a-faire" : ""} ${fait ? "fait" : ""} ${c.error ? "en-erreur" : ""}`} data-source={c.id}>
      <span className={`pastille-source source-${c.id}`}>{ICONS[c.id]}</span>
      <div className="texte">
        <h2>{NAMES[c.id]}</h2>
        <small>{DESCRIPTIONS[c.id]}</small>
        <p className={c.error ? "erreur" : "detail"} title={c.error ?? undefined}>{c.error ? `${c.detail} (${c.error})` : c.detail}</p>
      </div>
      <span className="nombre" data-testid={`nombre-${c.id}`}>{c.total === null ? "?" : fait ? <IconCheck size={30} /> : c.missing ? "–" : c.total}</span>
      <button className={c.total ? "bouton" : "bouton secondaire"} onClick={onOpen}>Ouvrir</button>
    </li>
  );
}

function Reglages({ s, notify }: { s: State; notify: (t: string) => void }) {
  const set = (p: Partial<State["settings"]>) => api.updateSettings(p);
  return (
    <section className="reglages" data-testid="reglages">
      <div className="carte">
        <h2>Rappel du soir</h2>
        <label className="case"><input type="checkbox" checked={s.settings.reminder} onChange={(e) => set({ reminder: e.target.checked })} />
          <span>Me prévenir s'il reste des révisions<small>Une notification Windows, une fois par jour.</small></span></label>
        <label className="champ-ligne">Heure
          <input type="time" value={`${pad(s.settings.reminderHour)}:${pad(s.settings.reminderMinute)}`} disabled={!s.settings.reminder}
            onChange={(e) => { const [h, m] = e.target.value.split(":").map(Number); if (Number.isInteger(h) && Number.isInteger(m)) void set({ reminderHour: h, reminderMinute: m }); }} />
        </label>
        <button className="lien" onClick={async () => notify((await api.testNotification()) ? "Notification envoyée." : "Les notifications ne sont pas disponibles.")}>Tester la notification</button>
      </div>
      <div className="carte">
        <h2>Application</h2>
        <label className="case"><input type="checkbox" checked={s.settings.startWithWindows} onChange={(e) => set({ startWithWindows: e.target.checked })} />
          <span>Démarrer avec Windows<small>Discrètement, dans la zone de notification : nécessaire pour le rappel du soir.</small></span></label>
        <label className="case"><input type="checkbox" checked={s.settings.closeToTray} onChange={(e) => set({ closeToTray: e.target.checked })} />
          <span>Garder dans la zone de notification à la fermeture</span></label>
      </div>
      <div className="carte">
        <h2>Données lues</h2>
        <p className="aide">Les fichiers des applications sont seulement lus, jamais modifiés.</p>
        <dl>
          {(Object.keys(s.paths) as SourceId[]).map((id) => (
            <div key={id}><dt>{NAMES[id]}</dt><dd><code>{s.paths[id]}</code></dd></div>
          ))}
        </dl>
        <p className="aide">Ouvertures : seules les positions déjà travaillées sont comptées ; les nouvelles positions apparaissent dans l'application.</p>
        <div className="ligne"><button className="lien" onClick={() => api.openFolder(s.dataDir)}>Dossier des réglages</button><button className="lien danger" onClick={() => api.quit()}>Quitter l'application</button><span className="version">Version {s.version}</span></div>
      </div>
    </section>
  );
}

const Svg = ({ children, size = 20 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
type P = { size?: number };
const IconRefresh = (p: P) => <Svg {...p}><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></Svg>;
const IconGear = (p: P) => <Svg {...p}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></Svg>;
const IconClose = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
const IconCheck = (p: P) => <Svg {...p}><path d="M5 12l5 5 9-10" /></Svg>;
const IconCards = (p: P) => <Svg {...p}><rect x="3" y="6" width="14" height="14" rx="2" /><path d="M7 3h12a2 2 0 0 1 2 2v12" /></Svg>;
const IconBook = (p: P) => <Svg {...p}><path d="M12 6c-2-1.5-5-2-8-1.5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-14c-3-.5-6 0-8 1.5zM12 6v14" /></Svg>;
const IconKnight = (p: P) => <Svg {...p}><path d="M7 20h11M8 20c0-4 3-5 3-8l-3 1-2-2 4-6h2c4 1 6 5 5 15" /></Svg>;
const ICONS: Record<SourceId, ReactNode> = { revision: <IconCards size={22} />, hifz: <IconBook size={22} />, ouvertures: <IconKnight size={22} /> };
