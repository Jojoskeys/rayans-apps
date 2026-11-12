import { useEffect, useRef, useState } from "react";
import { PHASE_LABEL, remaining, segmentElapsed } from "../core/engine.ts";
import { formatClock } from "../core/summary.ts";
import { Minuteur } from "./Minuteur.tsx";
import { Projets } from "./Projets.tsx";
import { Reglages } from "./Reglages.tsx";
import { Resumes } from "./Resumes.tsx";
import { api, IconChart, IconClose, IconFolder, IconGear, IconTimer, useChrono } from "./shared.tsx";
import { playChime } from "./sound.ts";

type Onglet = "minuteur" | "projets" | "resumes" | "reglages";
const ONGLETS: { id: Onglet; label: string; icon: () => React.ReactElement }[] = [
  { id: "minuteur", label: "Minuteur", icon: () => <IconTimer /> },
  { id: "projets", label: "Projets et tâches", icon: () => <IconFolder /> },
  { id: "resumes", label: "Résumés", icon: () => <IconChart /> },
  { id: "reglages", label: "Réglages", icon: () => <IconGear /> },
];

export function App() {
  const { init, data, now } = useChrono();
  const [onglet, setOnglet] = useState<Onglet>("minuteur");
  const [toast, setToast] = useState<string | null>(null);
  const volume = useRef(70);
  if (data) volume.current = data.settings.volume;

  useEffect(() => api.onSignal((s) => {
    if (s.type === "son") playChime(s.to, volume.current);
    else setToast(s.text);
  }), []);
  useEffect(() => { if (init?.warning) setToast(init.warning); }, [init]);
  useEffect(() => {
    // Utilisé par le test de lancement pour vérifier que le son se joue sans erreur.
    (window as unknown as { __chronoTestSon: () => void }).__chronoTestSon = () => playChime("travail", 0);
  }, []);

  // Le titre de la fenêtre (barre des tâches) montre le temps restant.
  useEffect(() => {
    if (!data) return;
    const t = data.timer;
    let title = "Rayan's Chrono";
    if (t.status === "marche") {
      title = t.mode === "pomodoro"
        ? `${formatClock(remaining(t, now))} · ${PHASE_LABEL[t.phase]} — Rayan's Chrono`
        : `${formatClock(segmentElapsed(t, now), false)} · Chrono — Rayan's Chrono`;
    }
    if (document.title !== title) document.title = title;
  }, [data, now]);

  if (!data || !init) return <div className="chargement">Chargement…</div>;

  return (
    <div className="app">
      <nav className="navigation-principale">
        <div className="marque"><img src="../../assets/icon.png" alt="" width={28} height={28} /><span>Rayan's Chrono</span></div>
        {ONGLETS.map((o) => (
          <button key={o.id} className={onglet === o.id ? "actif" : ""} onClick={() => setOnglet(o.id)} aria-current={onglet === o.id ? "page" : undefined}>
            {o.icon()}<span>{o.label}</span>
          </button>
        ))}
      </nav>
      <main className="contenu">
        {onglet === "minuteur" && <Minuteur data={data} now={now} />}
        {onglet === "projets" && <Projets data={data} now={now} onGo={() => setOnglet("minuteur")} />}
        {onglet === "resumes" && <Resumes data={data} now={now} notify={setToast} />}
        {onglet === "reglages" && <Reglages data={data} init={init} />}
      </main>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button className="icone" onClick={() => setToast(null)} title="Fermer"><IconClose size={16} /></button>
        </div>
      )}
    </div>
  );
}
