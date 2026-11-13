import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, subscribe, toErrorInfo, type AppView, type ErrorInfo, type Features, type LauncherUpdate, type Snapshot, type ZipEntry, type ZipProposal } from "./api";
import { Actions, AppIcon, ErrorBox, Icon, Logo, VersionLine, Visual } from "./components";
import { bytes, date, dateTime } from "./format";
import { applyPrefs, DEFAULT_PREFS, loadPrefs, PrefsContext, savePrefs, THEMES, usePrefs, type Prefs, type ThemeId } from "./prefs";

type Page = "catalog" | "installed" | "settings";
const PAGES: Page[] = ["catalog", "installed", "settings"];

export default function App() {
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  useEffect(() => {
    applyPrefs(prefs);
    savePrefs(prefs);
  }, [prefs]);
  const ctx = useMemo(
    () => ({
      prefs,
      setPrefs: (p: Partial<Prefs>) => setPrefsState((x) => ({ ...x, ...p })),
      resetPrefs: () => setPrefsState({ ...DEFAULT_PREFS }),
    }),
    [prefs],
  );
  return (
    <PrefsContext.Provider value={ctx}>
      <Launcher />
    </PrefsContext.Provider>
  );
}

function Launcher() {
  const { prefs } = usePrefs();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  // `?page=` sert seulement à l'aperçu navigateur (captures) ; l'application Tauri n'a pas de paramètres d'URL.
  const [page, setPage] = useState<Page>(() => (new URLSearchParams(location.search).get("page") as Page | null) ?? prefs.startPage);
  const [detail, setDetail] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [launcherUpd, setLauncherUpd] = useState<LauncherUpdate | null>(null);
  const [features, setFeatures] = useState<Features>({ shortcuts: false });
  const pending = useRef(false);

  const reload = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      setSnap(await api.snapshot());
      setLauncherUpd(await api.launcherUpdate().catch(() => null));
    } finally {
      pending.current = false;
    }
  }, []);

  useEffect(() => {
    api.features().then(setFeatures).catch(() => {});
    void reload();
    let off: (() => void) | undefined;
    subscribe((e) => {
      if (e.type === "progress") {
        setSnap((s) => s && { ...s, apps: s.apps.map((a) => (a.id === e.appId ? { ...a, task: e.task } : a)) });
      } else {
        void reload();
        if (e.type === "exited") void reload();
      }
    }).then((f) => (off = f));
    // Filet de sécurité si un événement est manqué.
    const t = setInterval(reload, 4000);
    return () => {
      off?.();
      clearInterval(t);
    };
  }, [reload]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const refresh = useCallback(() => {
    api.refresh().catch(() => {}).finally(reload);
  }, [reload]);

  if (!snap)
    return (
      <div className="boot">
        <div className="boot-inner">
          <div className="boot-mark"><Logo /></div>
          <div className="boot-label">Rayan's Launcher</div>
        </div>
      </div>
    );

  const installedCount = snap.apps.filter((a) => a.installedVersion).length;
  const updates = snap.apps.filter((a) => a.updateAvailable).length;
  const current = detail ? snap.apps.find((a) => a.id === detail) : undefined;

  const viewKey = current ? `fiche:${current.id}` : page;

  const nav = (p: Page) => {
    setPage(p);
    setDetail(null);
  };

  return (
    <div className="shell">
      <div className="ambient" aria-hidden><i /><i /><i /></div>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo"><Logo /></div>
          <div>
            <div className="brand-name">RAYAN'S</div>
            <div className="brand-sub">launcher</div>
          </div>
        </div>
        <nav>
          <span className="nav-indicator" style={{ "--nav-i": PAGES.indexOf(page) } as React.CSSProperties} aria-hidden />
          <NavItem icon="catalog" label="Catalogue" active={page === "catalog"} onClick={() => nav("catalog")} badge={updates ? `${updates}` : undefined} badgeTitle="mises à jour disponibles" />
          <NavItem icon="installed" label="Installées" active={page === "installed"} onClick={() => nav("installed")} count={installedCount} />
          <NavItem icon="settings" label="Paramètres" active={page === "settings"} onClick={() => nav("settings")} />
        </nav>
        <div className="sidebar-foot">
          <CatalogStatus snap={snap} />
        </div>
      </aside>

      <main className="main">
        {launcherUpd && <LauncherUpdateBanner upd={launcherUpd} />}
        <div className="view" key={viewKey}>
          {current ? (
            <Detail app={current} snap={snap} features={features} onBack={() => setDetail(null)} onToast={setToast} />
          ) : page === "settings" ? (
            <Settings snap={snap} onSaved={reload} />
          ) : (
            <Library snap={snap} page={page} onOpen={setDetail} onRefresh={refresh} goCatalog={() => nav("catalog")} goSettings={() => nav("settings")} />
          )}
        </div>
      </main>
      {toast && <div className="toast" key={toast} role="status"><Icon name="check" size={18} /> {toast}</div>}
    </div>
  );
}

function LauncherUpdateBanner({ upd }: { upd: LauncherUpdate }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ErrorInfo | null>(null);
  const apply = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.applyLauncherUpdate();
    } catch (e) {
      setErr(toErrorInfo(e));
      setBusy(false);
    }
  };
  return (
    <div className="banners">
      <div className="banner info launcher-upd">
        <Icon name="update" />
        <div>
          <strong>Nouvelle version de Rayan's Launcher : {upd.version}</strong>
          <div className="muted">
            {upd.fromCatalog ? "Publiée dans le catalogue." : `Trouvée dans « À ajouter » (${upd.file}).`} Le launcher se ferme, l'installateur s'ouvre ; vos applications et leurs données sont conservées.
          </div>
          {err && <ErrorBox error={err} onClose={() => setErr(null)} />}
        </div>
        <button className="btn primary small" onClick={apply} disabled={busy}>{busy ? (upd.fromCatalog ? "Téléchargement…" : "Ouverture…") : "Mettre à jour le launcher"}</button>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, count, badge, badgeTitle }: { icon: string; label: string; active: boolean; onClick: () => void; count?: number; badge?: string; badgeTitle?: string }) {
  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick} aria-current={active ? "page" : undefined}>
      <Icon name={icon} />
      <span>{label}</span>
      {badge && <span className="badge" title={badgeTitle}>{badge}</span>}
      {count != null && count > 0 && <span className="count">{count}</span>}
    </button>
  );
}

function CatalogStatus({ snap }: { snap: Snapshot }) {
  const c = snap.catalog;
  let cls = "ok";
  let text = "Catalogue à jour";
  if (c.refreshing) [cls, text] = ["busy", "Actualisation…"];
  else if (c.status === "none") [cls, text] = ["bad", "Catalogue indisponible"];
  else if (c.error && c.fromCache) [cls, text] = ["warn", "Hors ligne · cache"];
  else if (c.error) [cls, text] = ["warn", "Dernière actualisation échouée"];
  return (
    <div className="status">
      <div className={`status-line ${cls}`}><span className="dot" /> {text}</div>
      {c.fetchedAt && <div className="status-sub">Reçu le {dateTime(c.fetchedAt)}</div>}
      <div className="status-sub">
        {snap.mode === "development" ? <span className="tag dev">Mode développement</span> : <span className="tag">Distribution</span>}
        {c.trust === "signed" && <span className="tag good"><Icon name="shield" size={12} /> signé</span>}
      </div>
    </div>
  );
}

// ----- Bibliothèque (catalogue / installées) ----------------------------------------------------

function Library({ snap, page, onOpen, onRefresh, goCatalog, goSettings }: { snap: Snapshot; page: Page; onOpen: (id: string) => void; onRefresh: () => void; goCatalog: () => void; goSettings: () => void }) {
  const c = snap.catalog;
  const [adding, setAdding] = useState(false);
  const { prefs } = usePrefs();
  const apps = useMemo(() => {
    const list = page === "installed" ? snap.apps.filter((a) => a.installedVersion) : snap.apps.filter((a) => a.inCatalog);
    const byName = (a: AppView, b: AppView) => a.name.localeCompare(b.name, "fr");
    const rank = (f: (a: AppView) => boolean) => (a: AppView, b: AppView) => Number(f(b)) - Number(f(a)) || byName(a, b);
    if (prefs.sort === "nom") return [...list].sort(byName);
    if (prefs.sort === "installees") return [...list].sort(rank((a) => !!a.installedVersion));
    if (prefs.sort === "maj") return [...list].sort(rank((a) => a.updateAvailable));
    return list;
  }, [snap, page, prefs.sort]);
  const title = page === "installed" ? "Installées" : c.title ?? "Catalogue";
  const subtitle =
    page === "installed"
      ? `${apps.length} application${apps.length > 1 ? "s" : ""} sur cet ordinateur`
      : c.status === "ready"
        ? `${c.appCount} application${c.appCount > 1 ? "s" : ""} disponible${c.appCount > 1 ? "s" : ""}`
        : "";

  const installed = snap.apps.filter((a) => a.installedVersion).length;
  const updates = snap.apps.filter((a) => a.updateAvailable).length;
  const running = snap.apps.filter((a) => a.running).length;
  const stats =
    page === "catalog" && c.status === "ready" && apps.length > 0
      ? [
          <><span className="pip" /><b>{installed}</b> installée{installed > 1 ? "s" : ""}</>,
          updates > 0 && <><span className="pip" /><b>{updates}</b> mise{updates > 1 ? "s" : ""} à jour disponible{updates > 1 ? "s" : ""}</>,
          running > 0 && <><span className="pip" /><b>{running}</b> en cours d'exécution</>,
          c.trust === "signed" && <><Icon name="shield" size={13} /> Catalogue signé</>,
        ]
      : [];
  const statTone = ["good", "accent", "good", ""];

  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">{page === "installed" ? "Sur cet ordinateur" : "Rayan's Launcher"}</span>
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
          {stats.some(Boolean) && (
            <div className="stats">
              {stats.map((el, k) => el && <span key={k} className={`stat ${statTone[k]}`} style={{ "--i": k } as React.CSSProperties}>{el}</span>)}
            </div>
          )}
        </div>
        <div className="row">
          {page === "catalog" && snap.localCatalogPath && (
            <button className="btn primary" onClick={() => setAdding(true)} disabled={adding}>
              <Icon name="download" size={16} /> Ajouter un ZIP
            </button>
          )}
          <button className="btn" onClick={onRefresh} disabled={c.refreshing}>
            <span className={c.refreshing ? "spin" : ""}><Icon name="refresh" size={16} /></span>
            {c.refreshing ? "Actualisation…" : "Actualiser"}
          </button>
        </div>
      </header>

      {adding && <AddZip snap={snap} onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); onOpen(id); }} />}

      <Banners snap={snap} onRetry={onRefresh} />

      {page === "catalog" && c.status === "none" && !c.refreshing && (
        <EmptyState
          icon="offline"
          title="Catalogue indisponible"
          text={
            c.error
              ? "Rayan's Launcher n'a pas pu charger le catalogue et n'en a encore aucune copie valide."
              : snap.catalogUrl
                ? "Le catalogue n'a pas encore été chargé."
                : "Aucune adresse de catalogue n'est configurée."
          }
          error={c.error}
          actions={
            <>
              <button className="btn primary" onClick={onRefresh}><Icon name="refresh" size={16} /> Réessayer</button>
              <button className="btn" onClick={goSettings}>Ouvrir les paramètres</button>
            </>
          }
        />
      )}
      {page === "catalog" && c.status === "none" && c.refreshing && <SkeletonGrid />}
      {page === "catalog" && c.status === "ready" && apps.length === 0 && (
        <EmptyState
          icon="box"
          title="Catalogue vide"
          text={
            snap.localCatalogPath
              ? "Cliquez sur « Ajouter un ZIP » et choisissez le ZIP d'une application. Vous pouvez aussi déposer des ZIP dans le dossier « À ajouter », à côté du catalogue."
              : "Le catalogue est valide mais ne contient encore aucune application. Ajoutez une entrée dans « apps », publiez le fichier, puis actualisez."
          }
          actions={
            snap.localCatalogPath
              ? <button className="btn primary" onClick={() => setAdding(true)}><Icon name="download" size={16} /> Ajouter un ZIP</button>
              : <button className="btn" onClick={onRefresh}><Icon name="refresh" size={16} /> Actualiser</button>
          }
        />
      )}
      {page === "installed" && apps.length === 0 && (
        <EmptyState
          icon="installed"
          title="Aucune application installée"
          text="Les applications que vous installez depuis le catalogue apparaissent ici, et restent lançables hors ligne."
          actions={<button className="btn primary" onClick={goCatalog}>Parcourir le catalogue</button>}
        />
      )}

      {apps.length > 0 && (
        <div className="grid">
          {apps.map((a, i) => (
            <AppCard key={a.id} index={i} app={a} refresh={c.fetchedAt} onOpen={() => onOpen(a.id)} />
          ))}
        </div>
      )}
    </>
  );
}

function Banners({ snap, onRetry }: { snap: Snapshot; onRetry: () => void }) {
  const c = snap.catalog;
  const notices = snap.notices.length > 0 && (
    <div className="banner info">
      <Icon name="box" />
      <div>
        <strong>Dossier « À ajouter »</strong>
        {snap.notices.map((n) => <div key={n} className="muted">{n}</div>)}
      </div>
      <button className="btn small" onClick={() => void api.dismissNotices()}>Fermer</button>
    </div>
  );
  if (c.status !== "ready") return notices ? <div className="banners">{notices}</div> : null;
  return (
    <div className="banners">
      {notices}
      {c.error && (
        <div className={`banner ${c.error.code === "network" || c.error.code === "http" ? "warn" : "bad"}`}>
          <Icon name={c.error.code === "network" ? "offline" : "alert"} />
          <div>
            <strong>
              {c.error.code === "network" || c.error.code === "http"
                ? "Hors ligne : affichage du dernier catalogue valide"
                : "Le nouveau catalogue a été refusé : le dernier catalogue valide reste utilisé"}
            </strong>
            <div className="muted">{c.error.message}</div>
          </div>
          <button className="btn small" onClick={onRetry}>Réessayer</button>
        </div>
      )}
      {c.warning && !c.error && (
        <div className="banner info">
          <Icon name="alert" />
          <div className="muted">{c.warning}</div>
        </div>
      )}
    </div>
  );
}

// ----- Ajouter un ZIP ---------------------------------------------------------------------------

const SOURCE_LABEL: Record<ZipProposal["source"], string> = {
  manifeste: "Informations lues dans le ZIP (fichier rayans-launcher.json).",
  modèle: "Application reconnue : informations préremplies.",
  deviné: "Informations devinées à partir du nom du fichier : vérifiez-les.",
};

function AddZip({ snap, onClose, onAdded }: { snap: Snapshot; onClose: () => void; onAdded: (id: string) => void }) {
  const [path, setPath] = useState<string | null>(null);
  const [prop, setProp] = useState<ZipProposal | null>(null);
  const [entry, setEntry] = useState<ZipEntry | null>(null);
  const [busy, setBusy] = useState<"pick" | "save" | null>("pick");
  const [err, setErr] = useState<ErrorInfo | null>(null);

  const pick = useCallback(async () => {
    setErr(null);
    setBusy("pick");
    try {
      const p = await api.pickZip();
      if (!p) {
        if (!path) onClose();
        return;
      }
      const r = await api.inspectZip(p);
      setPath(p);
      setProp(r);
      setEntry(r.entry);
    } catch (e) {
      setErr(toErrorInfo(e));
    } finally {
      setBusy(null);
    }
  }, [path, onClose]);

  useEffect(() => {
    void pick();
    // Ouvre la fenêtre de choix une seule fois, à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!path || !entry) return;
    setErr(null);
    setBusy("save");
    try {
      onAdded(await api.addZip(path, entry));
    } catch (e) {
      setErr(toErrorInfo(e));
    } finally {
      setBusy(null);
    }
  };

  const set = (k: keyof ZipEntry) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setEntry((x) => x && { ...x, [k]: e.target.value });

  return (
    <section className="panel settings add-zip">
      <div className="row between">
        <h3>Ajouter un ZIP au catalogue</h3>
        <button className="link" onClick={onClose} aria-label="Fermer"><Icon name="close" size={16} /></button>
      </div>
      {busy === "pick" && !prop && <p className="muted">Choisissez le fichier ZIP de l'application…</p>}
      {err && <ErrorBox error={err} onClose={() => setErr(null)} />}
      {prop && entry && path && (
        <form onSubmit={save}>
          <p className="muted small"><code className="path">{path}</code></p>
          <p className="muted small">{SOURCE_LABEL[prop.source]}</p>
          {prop.existingVersion && (
            <p className="small accent">
              Déjà au catalogue en version {prop.existingVersion} : indiquez une version plus grande pour publier une mise à jour.
            </p>
          )}
          <div className="form-grid">
            <label>Nom<input className="input" value={entry.name} onChange={set("name")} required /></label>
            <label>Version<input className="input" value={entry.version} onChange={set("version")} placeholder="1.0.0" required /></label>
            <label>Identifiant<input className="input" value={entry.id} onChange={set("id")} spellCheck={false} required /></label>
            <label>Programme à lancer
              <select className="input" value={entry.executable} onChange={set("executable")}>
                {prop.executables.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
            <label className="wide">Description<input className="input" value={entry.description} onChange={set("description")} required /></label>
            <label className="wide">Nouveautés de cette version<textarea className="input" rows={3} value={entry.releaseNotes} onChange={set("releaseNotes")} required /></label>
          </div>
          <p className="muted small">
            Le ZIP est copié à côté du catalogue (<code className="path">{snap.localCatalogPath}</code>) et son empreinte SHA-256 est calculée.
          </p>
          <div className="row">
            <button className="btn primary" type="submit" disabled={busy !== null}>
              {busy === "save" ? "Ajout…" : prop.existingVersion ? "Publier la mise à jour" : "Ajouter au catalogue"}
            </button>
            <button className="btn" type="button" onClick={() => void pick()} disabled={busy !== null}>Choisir un autre ZIP</button>
            <button className="btn ghost" type="button" onClick={onClose}>Annuler</button>
          </div>
        </form>
      )}
    </section>
  );
}

function AppCard({ app, index, refresh, onOpen }: { app: AppView; index: number; refresh: string | null; onOpen: () => void }) {
  const done = useJustDone(app);
  // Halo qui suit le curseur : seules deux variables CSS changent, le halo se déplace par transform.
  const glow = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <article
      className={`card ${app.updateAvailable ? "has-update" : ""} ${done ? "just-done" : ""}`}
      style={{ "--i": Math.min(index, 12) } as React.CSSProperties}
      onClick={onOpen}
      onMouseMove={glow}
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      aria-label={app.name}
    >
      <span className="card-glow" aria-hidden />
      <Visual app={app} refresh={refresh} className="card-visual" />
      {app.updateAvailable && <span className="ribbon">Mise à jour {app.availableVersion}</span>}
      {done && (
        <span className="done-badge" role="status">
          <Icon name="check" size={14} /> {done === "update" ? "Mise à jour terminée" : "Installation terminée"}
        </span>
      )}
      <div className="card-body">
        <div className="card-title">
          <AppIcon app={app} refresh={refresh} size={48} />
          <div>
            <h2>{app.name}</h2>
            {!app.inCatalog && <span className="tag">retirée du catalogue</span>}
          </div>
        </div>
        <p className="desc">{app.description}</p>
        <VersionLine app={app} />
        <div className="notes-preview">
          <span className="label">Notes de version {app.availableVersion ?? app.installedVersion}</span>
          <p>{app.releaseNotes.split("\n")[0]}</p>
        </div>
        <Actions app={app} compact />
      </div>
    </article>
  );
}

/** Une installation ou une mise à jour vient de réussir : renvoie son type pendant quelques secondes. */
function useJustDone(app: AppView): "install" | "update" | null {
  const prev = useRef(app.task);
  const [done, setDone] = useState<"install" | "update" | null>(null);
  useEffect(() => {
    const was = prev.current;
    prev.current = app.task;
    if (was && !app.task && app.installedVersion && !app.updateAvailable && !app.partialBytes && !app.lastError) setDone(was.kind);
  }, [app.task, app.installedVersion, app.updateAvailable, app.partialBytes, app.lastError]);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(null), 2400);
    return () => clearTimeout(t);
  }, [done]);
  return done;
}

function SkeletonGrid() {
  return (
    <div className="grid">
      {[0, 1, 2].map((i) => (
        <div className="card skeleton" key={i}>
          <div className="card-visual" />
          <div className="card-body"><div className="sk-line w60" /><div className="sk-line" /><div className="sk-line w40" /></div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, title, text, actions, error }: { icon: string; title: string; text: string; actions?: React.ReactNode; error?: ErrorInfo | null }) {
  return (
    <section className="empty">
      <div className={`empty-art ${icon === "offline" ? "bad" : ""}`} aria-hidden>
        <span className="empty-orbit" />
        <span className="empty-orbit inner" />
        <div className="empty-icon"><Icon name={icon} size={32} /></div>
      </div>
      <h2>{title}</h2>
      <p className="muted">{text}</p>
      {error && (
        <div className="empty-error">
          <code>{error.message}</code>
          <p className="muted">{error.hint}</p>
        </div>
      )}
      <div className="row center">{actions}</div>
    </section>
  );
}

// ----- Fiche d'une application -----------------------------------------------------------------

function Detail({ app, snap, features, onBack, onToast }: { app: AppView; snap: Snapshot; features: Features; onBack: () => void; onToast: (s: string) => void }) {
  const [confirm, setConfirm] = useState(false);
  const [removeData, setRemoveData] = useState(false);
  const [err, setErr] = useState<ErrorInfo | null>(null);
  const refresh = snap.catalog.fetchedAt;

  const tool = (f: () => Promise<unknown>, ok?: string) => async () => {
    setErr(null);
    try {
      await f();
      if (ok) onToast(ok);
    } catch (e) {
      setErr(toErrorInfo(e));
    }
  };

  const uninstall = async () => {
    try {
      await api.uninstall(app.id, removeData);
      setConfirm(false);
      onToast(`${app.name} a été désinstallée${removeData ? " avec ses données" : " (données conservées)"}.`);
    } catch (e) {
      setErr(toErrorInfo(e));
    }
  };

  return (
    <div className="detail">
      <button className="link back" onClick={onBack}><Icon name="back" size={16} /> Retour</button>
      <div className="hero">
        <Visual app={app} refresh={refresh} className="hero-visual" />
        <div className="hero-shade" />
        <div className="hero-content">
          <AppIcon app={app} refresh={refresh} size={72} />
          <div>
            <h1>{app.name}</h1>
            <p>{app.description}</p>
          </div>
        </div>
      </div>

      <div className="detail-cols">
        <section className="panel">
          <h3>Notes de version {app.availableVersion && <span className="muted">· {app.availableVersion}</span>}</h3>
          {app.releaseDate && <p className="muted small">Publiée le {date(app.releaseDate)}</p>}
          <div className="notes">{app.releaseNotes}</div>
          {app.installedVersion && app.updateAvailable && app.installedReleaseNotes && (
            <>
              <h4>Version installée · {app.installedVersion}</h4>
              <div className="notes muted">{app.installedReleaseNotes}</div>
            </>
          )}
        </section>

        <aside className="panel side">
          <Actions app={app} />
          <VersionLine app={app} />
          <dl className="facts">
            {app.size != null && <div><dt>Taille du téléchargement</dt><dd>{bytes(app.size)}</dd></div>}
            <div><dt>Identifiant</dt><dd><code>{app.id}</code></dd></div>
            {app.installedVersion && <div><dt>Données utilisateur</dt><dd><code className="path">{app.dataDir}</code></dd></div>}
          </dl>
          {app.installedVersion && (
            <div className="tools">
              <button className="btn small" onClick={tool(() => api.openFolder(app.id, "install"))}>Ouvrir le dossier de l'application</button>
              <button className="btn small" onClick={tool(() => api.openFolder(app.id, "data"))}>Ouvrir le dossier des données</button>
              {features.shortcuts && (
                <button className="btn small" onClick={tool(() => api.createShortcut(app.id), `Raccourci « ${app.name} » créé sur le Bureau.`)}>
                  Créer un raccourci sur le Bureau
                </button>
              )}
            </div>
          )}
          {err && !confirm && <ErrorBox error={err} onClose={() => setErr(null)} />}
          {app.installedVersion && !app.task && (
            <div className="danger-zone">
              {!confirm ? (
                <button className="btn ghost danger" onClick={() => setConfirm(true)} disabled={app.running}>
                  Désinstaller
                </button>
              ) : (
                <div className="confirm">
                  <p>Supprimer les fichiers de {app.name} {app.installedVersion} ?</p>
                  <label className="check">
                    <input type="checkbox" checked={removeData} onChange={(e) => setRemoveData(e.target.checked)} />
                    Supprimer aussi les données utilisateur
                  </label>
                  <div className="row">
                    <button className="btn danger" onClick={uninstall}>Désinstaller</button>
                    <button className="btn ghost" onClick={() => setConfirm(false)}>Annuler</button>
                  </div>
                </div>
              )}
              {app.running && <p className="muted small">Fermez l'application pour la désinstaller.</p>}
              {err && confirm && <ErrorBox error={err} onClose={() => setErr(null)} />}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ----- Personnalisation ------------------------------------------------------------------------

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <i />
    </label>
  );
}

function Range({ value, min, max, step = 1, unit, onChange, label }: { value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void; label: string }) {
  return (
    <div className="range">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
      <output>{unit === "×" ? `${value.toFixed(1).replace(".", ",")}×` : `${value}${unit}`}</output>
    </div>
  );
}

function Pref({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="pref">
      <span><b>{title}</b>{hint && <small>{hint}</small>}</span>
      {children}
    </div>
  );
}

function Personalize() {
  const { prefs: p, setPrefs: set, resetPrefs } = usePrefs();
  const themes = Object.entries(THEMES) as [Exclude<ThemeId, "perso">, (typeof THEMES)["aurore"]][];
  return (
    <section className="panel settings perso" style={{ "--i": 0 } as React.CSSProperties}>
      <div className="perso-head">
        <div>
          <h3>Personnalisation</h3>
          <p className="muted small">Les changements s'appliquent tout de suite et restent sur cet ordinateur.</p>
        </div>
        <button className="btn small" type="button" onClick={resetPrefs}><Icon name="refresh" size={14} /> Valeurs par défaut</button>
      </div>

      <div className="perso-group">
        <h4>Couleurs</h4>
        <div className="swatches">
          {themes.map(([id, t]) => (
            <button key={id} type="button" className="swatch" aria-pressed={p.theme === id} onClick={() => set({ theme: id })}>
              <span className="swatch-chip" style={{ background: `linear-gradient(135deg, ${t.stops[0]}, ${t.stops[1]} 55%, ${t.stops[2]})` }} />
              <span className="swatch-name">{t.name}{p.theme === id && <Icon name="check" size={14} />}</span>
            </button>
          ))}
          <label className="swatch" aria-pressed={p.theme === "perso"}>
            <span className="swatch-chip" style={{ background: p.theme === "perso" ? "var(--accent-grad)" : `conic-gradient(from 90deg, #f43f5e, #f59e0b, #84cc16, #06b6d4, #6366f1, #d946ef, #f43f5e)` }} />
            <span className="swatch-name">Ma couleur{p.theme === "perso" && <Icon name="check" size={14} />}</span>
            <input type="color" value={p.customColor} onChange={(e) => set({ theme: "perso", customColor: e.target.value })} aria-label="Choisir ma couleur" />
          </label>
        </div>
        <div className="pref-rows">
          <Pref title="Fond" hint="Teinté par le thème, graphite ou noir profond">
            <Seg label="Fond" value={p.background} onChange={(v) => set({ background: v })} options={[["colore", "Coloré"], ["neutre", "Neutre"], ["noir", "Noir"]]} />
          </Pref>
          <Pref title="Barre latérale en verre dépoli">
            <Switch label="Verre dépoli" checked={p.glass} onChange={(v) => set({ glass: v })} />
          </Pref>
        </div>
      </div>

      <div className="perso-group">
        <h4>Ambiance et animations</h4>
        <div className="pref-rows">
          <Pref title="Animations" hint="Réduites : sans les boucles décoratives">
            <Seg label="Animations" value={p.motion} onChange={(v) => set({ motion: v })} options={[["completes", "Complètes"], ["reduites", "Réduites"], ["aucune", "Aucune"]]} />
          </Pref>
          <Pref title="Fond lumineux animé">
            <Switch label="Fond lumineux animé" checked={p.ambient} onChange={(v) => set({ ambient: v })} />
          </Pref>
          <Pref title="Intensité des lueurs">
            <Range label="Intensité des lueurs" value={p.ambientLevel} min={0.2} max={1.6} step={0.1} unit="×" onChange={(v) => set({ ambientLevel: v, ambient: true })} />
          </Pref>
          <Pref title="Halo qui suit la souris" hint="Sur les cartes d'applications">
            <Switch label="Halo qui suit la souris" checked={p.glow} onChange={(v) => set({ glow: v })} />
          </Pref>
        </div>
      </div>

      <div className="perso-group">
        <h4>Disposition</h4>
        <div className="pref-rows">
          <Pref title="Taille des cartes">
            <Range label="Taille des cartes" value={p.cardSize} min={230} max={420} step={10} unit=" px" onChange={(v) => set({ cardSize: v })} />
          </Pref>
          <Pref title="Arrondis">
            <Range label="Arrondis" value={p.radius} min={4} max={24} unit=" px" onChange={(v) => set({ radius: v })} />
          </Pref>
          <Pref title="Taille du texte">
            <Range label="Taille du texte" value={p.textScale} min={85} max={120} step={5} unit=" %" onChange={(v) => set({ textScale: v })} />
          </Pref>
          <Pref title="Densité">
            <Seg label="Densité" value={p.density} onChange={(v) => set({ density: v })} options={[["confortable", "Confortable"], ["compacte", "Compacte"]]} />
          </Pref>
          <Pref title="Notes de version sur les cartes">
            <Switch label="Notes de version sur les cartes" checked={p.showNotes} onChange={(v) => set({ showNotes: v })} />
          </Pref>
          <Pref title="Compteurs sous le titre">
            <Switch label="Compteurs sous le titre" checked={p.showStats} onChange={(v) => set({ showStats: v })} />
          </Pref>
        </div>
      </div>

      <div className="perso-group">
        <h4>Comportement</h4>
        <div className="pref-rows">
          <Pref title="Ordre des applications">
            <select className="input" value={p.sort} onChange={(e) => set({ sort: e.target.value as Prefs["sort"] })} aria-label="Ordre des applications">
              <option value="catalogue">Ordre du catalogue</option>
              <option value="nom">Par nom</option>
              <option value="installees">Installées d'abord</option>
              <option value="maj">Mises à jour d'abord</option>
            </select>
          </Pref>
          <Pref title="Page à l'ouverture">
            <Seg label="Page à l'ouverture" value={p.startPage} onChange={(v) => set({ startPage: v })} options={[["catalog", "Catalogue"], ["installed", "Installées"]]} />
          </Pref>
        </div>
      </div>
    </section>
  );
}

// ----- Paramètres ------------------------------------------------------------------------------

function Settings({ snap, onSaved }: { snap: Snapshot; onSaved: () => void }) {
  const [url, setUrl] = useState(snap.catalogUrl ?? "");
  const [state, setState] = useState<"idle" | "saving" | "ok">("idle");
  const [err, setErr] = useState<ErrorInfo | null>(null);
  const dev = snap.mode === "development";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("saving");
    setErr(null);
    try {
      await api.setCatalogUrl(url);
      setState("ok");
    } catch (e) {
      setErr(toErrorInfo(e));
      setState("idle");
    } finally {
      onSaved();
    }
  };

  return (
    <>
      <header className="page-head"><div><span className="eyebrow">Rayan's Launcher</span><h1>Paramètres</h1></div></header>
      <Personalize />
      <section className="panel settings" style={{ "--i": 1 } as React.CSSProperties}>
        <form onSubmit={save}>
          <label htmlFor="url"><h3>Adresse du catalogue</h3></label>
          <p className="muted small">
            {dev
              ? "Mode développement : http://, https:// et file:// sont acceptés. Une signature présente est vérifiée."
              : "Distribution : https:// obligatoire, et le catalogue doit être signé par la clé intégrée à ce launcher."}
          </p>
          <div className="row">
            <input id="url" className="input" value={url} onChange={(e) => { setUrl(e.target.value); setState("idle"); }} placeholder="https://exemple.fr/hangar/catalog.json" spellCheck={false} />
            <button className="btn primary" type="submit" disabled={state === "saving" || !url.trim()}>
              {state === "saving" ? "Vérification…" : "Enregistrer et actualiser"}
            </button>
          </div>
          {state === "ok" && <p className="ok-text">Catalogue chargé et vérifié.</p>}
          {err && <ErrorBox error={err} onClose={() => setErr(null)} />}
        </form>
      </section>
      <section className="panel settings" style={{ "--i": 1 } as React.CSSProperties}>
        <h3>Sécurité</h3>
        <dl className="facts">
          <div><dt>Mode</dt><dd>{dev ? "Développement" : "Distribution"}</dd></div>
          <div><dt>Clé publique intégrée</dt><dd>{snap.publicKeyConfigured ? "oui" : "aucune"}</dd></div>
          <div><dt>Catalogue actuel</dt><dd>{snap.catalog.trust === "signed" ? "signature vérifiée" : snap.catalog.trust === "unsigned" ? "non signé (accepté en développement)" : "—"}</dd></div>
          <div><dt>Empreintes SHA-256</dt><dd>toujours vérifiées avant installation</dd></div>
        </dl>
      </section>
      <section className="panel settings" style={{ "--i": 2 } as React.CSSProperties}>
        <h3>Stockage</h3>
        <dl className="facts">
          <div><dt>Dossier du launcher</dt><dd><code className="path">{snap.dataRoot}</code></dd></div>
          <div><dt>Versions installées</dt><dd><code className="path">apps\&lt;id&gt;\versions\</code></dd></div>
          <div><dt>Données utilisateur</dt><dd><code className="path">data\&lt;id&gt;\</code> (conservées lors des mises à jour)</dd></div>
          {snap.localCatalogPath && (
            <div><dt>Catalogue local</dt><dd><code className="path">{snap.localCatalogPath}</code><br /><span className="muted small">ZIP déposés dans le dossier « À ajouter » à côté : ajoutés au démarrage et à chaque actualisation.</span></dd></div>
          )}
        </dl>
      </section>
    </>
  );
}
