import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorText, type ApplyReport, type Config, type Plan, type StateView } from "./api";
import { HistoryView } from "./HistoryView";
import { PlanView, ReportView } from "./PlanView";
import { RulesView } from "./RulesView";
import { SettingsView } from "./SettingsView";
import { plural } from "./format";

type Tab = "ranger" | "regles" | "reglages" | "historique";

export default function App() {
  const [state, setState] = useState<StateView | null>(null);
  const [draft, setDraft] = useState<Config | null>(null);
  const [tab, setTab] = useState<Tab>("ranger");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [report, setReport] = useState<ApplyReport | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const refresh = useCallback(async () => {
    const s = await api.getState();
    setState(s);
    return s;
  }, []);

  useEffect(() => {
    refresh()
      .then((s) => {
        setDraft(s.config);
        api.ready();
      })
      .catch((e) => setError(errorText(e)));
    const un = api.onAutoPlan(() => refresh());
    const timer = window.setInterval(() => refresh().catch(() => {}), 10_000);
    return () => {
      un.then((f) => f());
      window.clearInterval(timer);
    };
  }, [refresh]);

  const dirty = useMemo(
    () => !!state && !!draft && JSON.stringify(state.config) !== JSON.stringify(draft),
    [state, draft],
  );

  const save = async () => {
    if (!draft) return;
    setSaveError(null);
    try {
      const c = await api.saveConfig(draft);
      setDraft(c);
      await refresh();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError(errorText(e));
    }
  };

  const analyze = async () => {
    setError(null);
    setReport(null);
    setBusy("Analyse des dossiers…");
    try {
      setPlan(await api.analyze());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  if (!state || !draft) {
    return <div className="boot">{error ?? "Chargement…"}</div>;
  }

  const autoCount = state.autoPlan?.items.length ?? 0;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo" aria-hidden>
            <svg viewBox="0 0 32 32" width="30" height="30">
              <rect x="3" y="7" width="26" height="20" rx="4" fill="#ffb23f" />
              <rect x="3" y="4" width="12" height="6" rx="2" fill="#ffb23f" />
              <path d="M9 15h14M9 19.5h10M9 24h6" stroke="#1b1306" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="brand-name">RANGEMENT</div>
            <div className="brand-sub">Rayan’s Rangement {state.version}</div>
          </div>
        </div>
        <nav>
          <NavItem label="Ranger" active={tab === "ranger"} onClick={() => setTab("ranger")} badge={autoCount || undefined} />
          <NavItem label="Règles" active={tab === "regles"} onClick={() => setTab("regles")} count={draft.rules.filter((r) => r.enabled).length} />
          <NavItem label="Dossiers et réglages" active={tab === "reglages"} onClick={() => setTab("reglages")} />
          <NavItem label="Historique" active={tab === "historique"} onClick={() => setTab("historique")} />
        </nav>
        <div className="sidebar-foot">
          <div className={"status-line " + (draft.auto.enabled ? "" : "off")}>
            <span className="dot" />
            {state.config.auto.enabled ? "Mode automatique" : "Mode manuel"}
          </div>
          <div className="status-sub">{state.autoStatus}</div>
          <div className="status-sub">Rien n’est supprimé ni écrasé. Tout s’annule.</div>
        </div>
      </aside>

      <main className="main">
        {dirty && (
          <div className="savebar">
            <span>Modifications non enregistrées</span>
            {saveError && <span className="bad">{saveError}</span>}
            <div className="row" style={{ marginLeft: "auto" }}>
              <button className="btn ghost" onClick={() => { setDraft(state.config); setSaveError(null); }}>Abandonner</button>
              <button className="btn primary" onClick={save}>Enregistrer</button>
            </div>
          </div>
        )}
        {saved && !dirty && <div className="toast">Réglages enregistrés.</div>}

        {tab === "ranger" && (
          <section className="page">
            <header className="page-head">
              <div>
                <h1>Ranger</h1>
                <p className="muted">
                  L’analyse prépare un aperçu : rien n’est déplacé tant que vous ne l’avez pas validé.
                </p>
              </div>
              <button className="btn primary big" onClick={analyze} disabled={!!busy || dirty} title={dirty ? "Enregistrez d’abord vos réglages" : ""}>
                {plan ? "Relancer l’analyse" : "Analyser"}
              </button>
            </header>
            {state.autoPlan && plan?.id !== state.autoPlan.id && (
              <div className="banner">
                <div>
                  <strong>Le mode automatique a préparé {plural(autoCount, "déplacement")}.</strong>
                  <div className="muted small">Rien n’a été déplacé : vérifiez l’aperçu puis validez.</div>
                </div>
                <div className="row">
                  <button className="btn ghost" onClick={async () => { await api.dismissAutoPlan(); refresh(); }}>Ignorer</button>
                  <button className="btn primary" onClick={() => { setReport(null); setPlan(state.autoPlan); }}>Voir l’aperçu</button>
                </div>
              </div>
            )}
            {error && <div className="alert bad">{error}</div>}
            {busy && <div className="alert">{busy}</div>}
            {plan ? (
              <PlanView
                key={plan.id}
                plan={plan}
                onApplied={(r) => { setReport(r); setPlan(null); refresh(); }}
                onClose={() => setPlan(null)}
              />
            ) : report ? (
              <ReportView report={report} onClose={() => setReport(null)} onHistory={() => setTab("historique")} />
            ) : (
              !busy && (
                <div className="empty">
                  <h2>Prêt à ranger</h2>
                  <p className="muted">
                    Dossiers surveillés : {state.config.watched.length ? state.config.watched.join(" · ") : "aucun"}.
                  </p>
                  <ul className="promises">
                    <li>Aperçu de chaque déplacement avant d’agir</li>
                    <li>Aucune suppression : les doublons vont en quarantaine</li>
                    <li>Aucun écrasement : « nom (2) » si la place est prise</li>
                    <li>Fichiers ouverts ou trop récents laissés en place</li>
                    <li>Historique complet, tout s’annule</li>
                  </ul>
                </div>
              )
            )}
          </section>
        )}
        {tab === "regles" && <RulesView draft={draft} setDraft={setDraft} />}
        {tab === "reglages" && <SettingsView draft={draft} setDraft={setDraft} dataDir={state.dataDir} autoStatus={state.autoStatus} />}
        {tab === "historique" && <HistoryView />}
      </main>
    </div>
  );
}

function NavItem(p: { label: string; active: boolean; onClick: () => void; badge?: number; count?: number }) {
  return (
    <button className={"nav-item" + (p.active ? " active" : "")} onClick={p.onClick}>
      {p.label}
      {p.badge ? <span className="badge">{p.badge}</span> : p.count !== undefined ? <span className="count">{p.count}</span> : null}
    </button>
  );
}
