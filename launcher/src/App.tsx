import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, subscribe, toErrorInfo, type AppView, type ErrorInfo, type Snapshot } from "./api";
import { Actions, AppIcon, ErrorBox, Icon, Logo, VersionLine, Visual } from "./components";
import { bytes, date, dateTime } from "./format";

type Page = "catalog" | "installed" | "settings";

export default function App() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [page, setPage] = useState<Page>("catalog");
  const [detail, setDetail] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const pending = useRef(false);

  const reload = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      setSnap(await api.snapshot());
    } finally {
      pending.current = false;
    }
  }, []);

  useEffect(() => {
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

  if (!snap) return <div className="boot"><Logo /></div>;

  const installedCount = snap.apps.filter((a) => a.installedVersion).length;
  const updates = snap.apps.filter((a) => a.updateAvailable).length;
  const current = detail ? snap.apps.find((a) => a.id === detail) : undefined;

  const nav = (p: Page) => {
    setPage(p);
    setDetail(null);
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo />
          <div>
            <div className="brand-name">RAYAN'S</div>
            <div className="brand-sub">launcher</div>
          </div>
        </div>
        <nav>
          <NavItem icon="catalog" label="Catalogue" active={page === "catalog"} onClick={() => nav("catalog")} badge={updates ? `${updates}` : undefined} badgeTitle="mises à jour disponibles" />
          <NavItem icon="installed" label="Installées" active={page === "installed"} onClick={() => nav("installed")} count={installedCount} />
          <NavItem icon="settings" label="Paramètres" active={page === "settings"} onClick={() => nav("settings")} />
        </nav>
        <div className="sidebar-foot">
          <CatalogStatus snap={snap} />
        </div>
      </aside>

      <main className="main">
        {current ? (
          <Detail app={current} snap={snap} onBack={() => setDetail(null)} onToast={setToast} />
        ) : page === "settings" ? (
          <Settings snap={snap} onSaved={reload} />
        ) : (
          <Library snap={snap} page={page} onOpen={setDetail} onRefresh={refresh} goCatalog={() => nav("catalog")} goSettings={() => nav("settings")} />
        )}
      </main>
      {toast && <div className="toast">{toast}</div>}
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
  const apps = useMemo(
    () => (page === "installed" ? snap.apps.filter((a) => a.installedVersion) : snap.apps.filter((a) => a.inCatalog)),
    [snap, page],
  );
  const title = page === "installed" ? "Installées" : c.title ?? "Catalogue";
  const subtitle =
    page === "installed"
      ? `${apps.length} application${apps.length > 1 ? "s" : ""} sur cet ordinateur`
      : c.status === "ready"
        ? `${c.appCount} application${c.appCount > 1 ? "s" : ""} disponible${c.appCount > 1 ? "s" : ""}`
        : "";

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        <button className="btn" onClick={onRefresh} disabled={c.refreshing}>
          <span className={c.refreshing ? "spin" : ""}><Icon name="refresh" size={16} /></span>
          {c.refreshing ? "Actualisation…" : "Actualiser"}
        </button>
      </header>

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
          text="Le catalogue est valide mais ne contient encore aucune application. Ajoutez une entrée dans « apps », publiez le fichier, puis actualisez."
          actions={<button className="btn" onClick={onRefresh}><Icon name="refresh" size={16} /> Actualiser</button>}
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
          {apps.map((a) => (
            <AppCard key={a.id} app={a} refresh={c.fetchedAt} onOpen={() => onOpen(a.id)} />
          ))}
        </div>
      )}
    </>
  );
}

function Banners({ snap, onRetry }: { snap: Snapshot; onRetry: () => void }) {
  const c = snap.catalog;
  if (c.status !== "ready") return null;
  return (
    <div className="banners">
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

function AppCard({ app, refresh, onOpen }: { app: AppView; refresh: string | null; onOpen: () => void }) {
  return (
    <article className={`card ${app.updateAvailable ? "has-update" : ""}`} onClick={onOpen} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen()} aria-label={app.name}>
      <Visual app={app} refresh={refresh} className="card-visual" />
      {app.updateAvailable && <span className="ribbon">Mise à jour {app.availableVersion}</span>}
      <div className="card-body">
        <div className="card-title">
          <AppIcon app={app} refresh={refresh} size={40} />
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
      <div className="empty-icon"><Icon name={icon} size={34} /></div>
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

function Detail({ app, snap, onBack, onToast }: { app: AppView; snap: Snapshot; onBack: () => void; onToast: (s: string) => void }) {
  const [confirm, setConfirm] = useState(false);
  const [removeData, setRemoveData] = useState(false);
  const [err, setErr] = useState<ErrorInfo | null>(null);
  const refresh = snap.catalog.fetchedAt;

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
              {err && <ErrorBox error={err} onClose={() => setErr(null)} />}
            </div>
          )}
        </aside>
      </div>
    </div>
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
      <header className="page-head"><div><h1>Paramètres</h1></div></header>
      <section className="panel settings">
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
      <section className="panel settings">
        <h3>Sécurité</h3>
        <dl className="facts">
          <div><dt>Mode</dt><dd>{dev ? "Développement" : "Distribution"}</dd></div>
          <div><dt>Clé publique intégrée</dt><dd>{snap.publicKeyConfigured ? "oui" : "aucune"}</dd></div>
          <div><dt>Catalogue actuel</dt><dd>{snap.catalog.trust === "signed" ? "signature vérifiée" : snap.catalog.trust === "unsigned" ? "non signé (accepté en développement)" : "—"}</dd></div>
          <div><dt>Empreintes SHA-256</dt><dd>toujours vérifiées avant installation</dd></div>
        </dl>
      </section>
      <section className="panel settings">
        <h3>Stockage</h3>
        <dl className="facts">
          <div><dt>Dossier du launcher</dt><dd><code className="path">{snap.dataRoot}</code></dd></div>
          <div><dt>Versions installées</dt><dd><code className="path">apps\&lt;id&gt;\versions\</code></dd></div>
          <div><dt>Données utilisateur</dt><dd><code className="path">data\&lt;id&gt;\</code> (conservées lors des mises à jour)</dd></div>
        </dl>
      </section>
    </>
  );
}
