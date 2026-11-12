import { useEffect, useState } from "react";
import { api, type AppView, type ErrorInfo } from "./api";
import { bytes, phaseLabel, progressPercent } from "./format";

// ----- Icônes (traits simples, dessinées pour Rayan's Launcher) -------------------------------------------

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "catalog":
      return (<svg {...p}><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" /></svg>);
    case "installed":
      return (<svg {...p}><path d="M12 3v11m0 0-4-4m4 4 4-4" /><path d="M4 15v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3" /></svg>);
    case "settings":
      return (<svg {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>);
    case "refresh":
      return (<svg {...p}><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" /><path d="M4 3v5h5" /><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" /><path d="M20 21v-5h-5" /></svg>);
    case "play":
      return (<svg {...p} fill="currentColor" stroke="none"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>);
    case "download":
      return (<svg {...p}><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5" /><path d="M5 20h14" /></svg>);
    case "update":
      return (<svg {...p}><path d="M12 20V9m0 0-4.5 4.5M12 9l4.5 4.5" /><path d="M5 4h14" /></svg>);
    case "back":
      return (<svg {...p}><path d="M15 5 8 12l7 7" /></svg>);
    case "alert":
      return (<svg {...p}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17.5v.01" /></svg>);
    case "offline":
      return (<svg {...p}><path d="M3 3l18 18" /><path d="M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5-2.7M14 10.2a10 10 0 0 1 5 2.7M2 9.3a15 15 0 0 1 4.3-2.6M10.7 5.1A15 15 0 0 1 22 9.3" /></svg>);
    case "shield":
      return (<svg {...p}><path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6l-8-3Z" /><path d="m8.8 12 2.2 2.2 4.2-4.4" /></svg>);
    case "close":
      return (<svg {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>);
    case "box":
      return (<svg {...p}><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" /><path d="m3 7.5 9 4.5 9-4.5M12 12v9" /></svg>);
    default:
      return null;
  }
}

export function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden>
      <path d="M8 54V26L32 10l24 16v28" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinejoin="round" />
      <path d="M20 54V34h24v20" fill="none" stroke="var(--text)" strokeWidth="5" strokeLinejoin="round" />
      <path d="M20 42h24" stroke="var(--text)" strokeWidth="3" opacity=".55" />
    </svg>
  );
}

// ----- Visuels ----------------------------------------------------------------------------------

const imageCache = new Map<string, string | null>();

export function useImage(id: string, kind: "icon" | "image", version: string | null): string | null {
  const key = `${id}:${kind}:${version}`;
  const [src, setSrc] = useState<string | null>(imageCache.get(key) ?? null);
  useEffect(() => {
    let alive = true;
    if (imageCache.has(key)) {
      setSrc(imageCache.get(key)!);
      return;
    }
    api.image(id, kind).then((s) => {
      imageCache.set(key, s);
      if (alive) setSrc(s);
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, [key, id, kind]);
  return src;
}

export function AppIcon({ app, refresh, size = 44 }: { app: AppView; refresh: string | null; size?: number }) {
  const src = useImage(app.id, "icon", refresh);
  return src ? (
    <img className="app-icon" src={src} width={size} height={size} alt="" />
  ) : (
    <div className="app-icon placeholder" style={{ width: size, height: size }}>{app.name.slice(0, 1)}</div>
  );
}

export function Visual({ app, refresh, className }: { app: AppView; refresh: string | null; className: string }) {
  const src = useImage(app.id, "image", refresh);
  return (
    <div className={`visual ${className}`}>
      {src ? <img src={src} alt="" /> : <div className="visual-fallback"><Icon name="box" size={42} /></div>}
    </div>
  );
}

// ----- Actions ----------------------------------------------------------------------------------

export function ProgressBlock({ app }: { app: AppView }) {
  const t = app.task!;
  const pct = progressPercent(t);
  const detail =
    t.phase === "downloading"
      ? t.total
        ? `${bytes(t.received)} / ${bytes(t.total)}`
        : bytes(t.received)
      : "";
  return (
    <div className="progress" role="status" aria-live="polite">
      <div className="progress-head">
        <span>{t.kind === "update" ? "Mise à jour" : "Installation"} · {phaseLabel(t)}</span>
      </div>
      <div className={`bar ${pct == null ? "indeterminate" : ""}`}>
        <div style={{ width: pct == null ? "35%" : `${pct}%` }} />
      </div>
      <div className="progress-foot">
        <span>{detail}</span>
        <span>{pct != null ? `${Math.round(pct)} %` : ""}</span>
      </div>
    </div>
  );
}

export function ErrorBox({ error, onRetry, onClose, retryLabel = "Réessayer" }: { error: ErrorInfo; onRetry?: () => void; onClose?: () => void; retryLabel?: string }) {
  return (
    <div className="error-box" role="alert">
      <div className="error-title"><Icon name="alert" size={16} /> Échec</div>
      <p>{error.message}</p>
      <p className="muted">{error.hint}</p>
      <div className="row">
        {onRetry && <button className="btn small" onClick={onRetry}><Icon name="refresh" size={14} /> {retryLabel}</button>}
        {onClose && <button className="btn small ghost" onClick={onClose}>Fermer</button>}
      </div>
    </div>
  );
}

/** Zone d'action d'une application : le bouton principal suit l'état. */
export function Actions({ app, compact = false }: { app: AppView; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const run = (f: () => Promise<unknown>) => async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setBusy(true);
    try {
      await f();
    } catch {
      /* l'erreur est rapportée par le coeur dans app.lastError */
    } finally {
      setBusy(false);
    }
  };
  const install = run(() => api.install(app.id));
  const launch = run(() => api.launch(app.id));

  if (app.task) return <ProgressBlock app={app} />;

  let primary: React.ReactNode;
  let secondary: React.ReactNode = null;
  if (app.running) {
    primary = <button className="btn primary running" disabled><span className="pulse" /> En cours d'exécution</button>;
  } else if (app.installedVersion && app.updateAvailable) {
    primary = <button className="btn primary" onClick={install} disabled={busy}><Icon name="update" /> Mettre à jour</button>;
    secondary = <button className="btn" onClick={launch} disabled={busy} title={`Lancer la version installée ${app.installedVersion}`}><Icon name="play" size={14} /> Lancer la {app.installedVersion}</button>;
  } else if (app.installedVersion) {
    primary = <button className="btn primary" onClick={launch} disabled={busy}><Icon name="play" size={15} /> Lancer</button>;
  } else if (app.inCatalog) {
    primary = <button className="btn primary" onClick={install} disabled={busy}><Icon name="download" /> Installer</button>;
  }

  const err = app.lastError;
  return (
    <div className="actions" onClick={(e) => e.stopPropagation()}>
      {err && (
        <ErrorBox
          error={err}
          onRetry={err.code === "running" ? undefined : err.code === "launch" ? launch : app.inCatalog ? install : undefined}
          retryLabel={err.code === "tampered" ? "Réinstaller" : "Réessayer"}
          onClose={() => api.dismissError(app.id)}
        />
      )}
      {app.pendingVersion && (
        <div className="note-pending">Version {app.pendingVersion} prête : elle sera activée à la fermeture de l'application.</div>
      )}
      <div className={`row ${compact ? "" : "wrap"}`}>
        {primary}
        {secondary}
      </div>
    </div>
  );
}

export function VersionLine({ app }: { app: AppView }) {
  return (
    <dl className="versions">
      <div><dt>Installée</dt><dd>{app.installedVersion ?? "—"}</dd></div>
      <div><dt>Disponible</dt><dd className={app.updateAvailable ? "accent" : ""}>{app.availableVersion ?? (app.installedVersion ? "retirée du catalogue" : "—")}</dd></div>
    </dl>
  );
}
