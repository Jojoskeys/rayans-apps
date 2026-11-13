// Pages et panneaux ajoutés au launcher : logiciels perso, espaces de travail, historique et diagnostic,
// centre de stockage, atelier de publication, règles de mise à jour, export et migration.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  copyText,
  toErrorInfo,
  type AppView,
  type ErrorInfo,
  type ExportManifest,
  type HistoryEvent,
  type PersonalApp,
  type Profile,
  type Snapshot,
  type StorageReport,
  type Workspace,
  type WorkspaceItem,
  type WorkshopReport,
  type ZipEntry,
} from "./api";
import { AppIcon, ErrorBox, Icon } from "./components";
import { bytes, date, dateTime } from "./format";
import { loadPrefs, usePrefs, type Prefs } from "./prefs";

type Toast = (s: string) => void;

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function useAction(onToast?: Toast) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<ErrorInfo | null>(null);
  const run = useCallback(
    async (key: string, f: () => Promise<unknown>, ok?: string | ((r: unknown) => string)) => {
      setBusy(key);
      setErr(null);
      try {
        const r = await f();
        if (ok && onToast) onToast(typeof ok === "string" ? ok : ok(r));
        // Réussite : jamais `undefined` (réservé à l'échec), même pour une commande sans résultat.
        return r === undefined ? true : r;
      } catch (e) {
        setErr(toErrorInfo(e));
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [onToast],
  );
  return { busy, err, setErr, run };
}

function PageHead({ eyebrow, title, text, children }: { eyebrow: string; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {text && <p className="muted">{text}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </header>
  );
}

export function nameOf(snap: Snapshot, id: string | null): string {
  if (!id) return "Launcher";
  return snap.apps.find((a) => a.id === id)?.name ?? snap.profile.personal.find((p) => p.id === id)?.name ?? id;
}

// ----- Logiciels ajoutés à la main ---------------------------------------------------------------

const KIND_LABEL: Record<PersonalApp["kind"], string> = { program: "Programme", web: "Site web", folder: "Dossier" };
const KIND_ICON: Record<PersonalApp["kind"], string> = { program: "play", web: "globe", folder: "folder" };

function Monogram({ name, kind, color, size = 44 }: { name: string; kind: string; color?: string; size?: number }) {
  return (
    <div className={`monogram ${size <= 24 ? "tiny" : ""}`} style={{ width: size, height: size, "--mono": color ?? "var(--a1)" } as React.CSSProperties}>
      <span style={{ fontSize: Math.round(size * 0.42) }}>{name.trim().slice(0, 1).toUpperCase() || "?"}</span>
      <i><Icon name={KIND_ICON[kind as PersonalApp["kind"]] ?? "box"} size={Math.round(size * 0.28)} /></i>
    </div>
  );
}

/** Nom proposé à partir d'un chemin ou d'une adresse. */
function guessName(kind: PersonalApp["kind"], target: string): string {
  if (kind === "web") {
    try {
      const h = new URL(target).hostname.replace(/^www\./, "");
      return h.charAt(0).toUpperCase() + h.slice(1);
    } catch {
      return "";
    }
  }
  const base = target.split(/[\\/]/).filter(Boolean).pop() ?? "";
  return base.replace(/\.(exe|lnk|bat|cmd|url)$/i, "");
}

export function MyApps({ snap, onToast }: { snap: Snapshot; onToast: Toast }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PersonalApp | null>(null);
  const { busy, err, setErr, run } = useAction(onToast);
  const list = snap.profile.personal;

  const save = async (p: PersonalApp) => {
    const others = list.filter((x) => x.id !== p.id);
    const r = await run("save", () => api.saveProfile({ ...snap.profile, personal: [...others, p] }), `« ${p.name} » ${editing ? "modifié" : "ajouté"}.`);
    if (r !== undefined) {
      setAdding(false);
      setEditing(null);
    }
  };
  const remove = (p: PersonalApp) =>
    run(
      p.id,
      () =>
        api.saveProfile({
          ...snap.profile,
          personal: list.filter((x) => x.id !== p.id),
          workspaces: snap.profile.workspaces.map((w) => ({ ...w, items: w.items.filter((i) => !(i.kind === "personal" && i.target === p.id)) })),
        }),
      `« ${p.name} » retiré du launcher (rien n'est supprimé sur le disque).`,
    );

  return (
    <section className="my-apps">
      <div className="section-head">
        <div>
          <h2>Mes logiciels</h2>
          <p className="muted small">Programmes Windows, applications portables, sites et dossiers, lancés depuis le même endroit que le catalogue.</p>
        </div>
        {!adding && !editing && (
          <button className="btn primary small" onClick={() => setAdding(true)}><Icon name="plus" size={14} /> Ajouter un logiciel</button>
        )}
      </div>
      {(adding || editing) && (
        <PersonalForm key={editing?.id ?? "new"} initial={editing} busy={busy === "save"} onCancel={() => { setAdding(false); setEditing(null); setErr(null); }} onSave={save} />
      )}
      {err && <ErrorBox error={err} onClose={() => setErr(null)} />}
      {list.length === 0 && !adding ? (
        <p className="backup-empty">Aucun logiciel ajouté. Ajoutez votre éditeur, votre navigateur ou un outil maison pour le lancer d'ici.</p>
      ) : (
        <div className="mini-grid">
          {list.map((p, i) => (
            <article className="mini-card" key={p.id} style={{ "--i": i } as React.CSSProperties}>
              <Monogram name={p.name} kind={p.kind} />
              <div className="mini-body">
                <b>{p.name}</b>
                <span className="tag manual" title="Ajouté à la main, hors catalogue">ajouté à la main</span>
                <code className="path small" title={p.target}>{p.target}</code>
              </div>
              <div className="mini-actions">
                <button className="btn primary small" onClick={() => void run(p.id, () => api.launchPersonal(p.id), `${p.name} ouvert.`)} disabled={busy === p.id}>
                  <Icon name={p.kind === "program" ? "play" : KIND_ICON[p.kind]} size={13} /> {p.kind === "program" ? "Lancer" : "Ouvrir"}
                </button>
                <button className="btn small ghost" onClick={() => setEditing(p)} aria-label={`Modifier ${p.name}`}><Icon name="edit" size={14} /></button>
                <button className="btn small ghost" onClick={() => void remove(p)} aria-label={`Retirer ${p.name}`}><Icon name="close" size={14} /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PersonalForm({ initial, busy, onSave, onCancel }: { initial: PersonalApp | null; busy: boolean; onSave: (p: PersonalApp) => void; onCancel: () => void }) {
  const [p, setP] = useState<PersonalApp>(initial ?? { id: uid("p"), name: "", kind: "program", target: "", args: "", addedAt: new Date().toISOString() });
  const set = (x: Partial<PersonalApp>) => setP((o) => ({ ...o, ...x }));
  const pick = async () => {
    const r = await api.pickPath(p.kind === "folder" ? "folder" : "program");
    if (r) set({ target: r, name: p.name || guessName(p.kind, r) });
  };
  return (
    <form className="panel inline-form" onSubmit={(e) => { e.preventDefault(); onSave({ ...p, name: p.name.trim() || guessName(p.kind, p.target), target: p.target.trim() }); }}>
      <div className="seg" role="group" aria-label="Type">
        {(Object.keys(KIND_LABEL) as PersonalApp["kind"][]).map((k) => (
          <button key={k} type="button" aria-pressed={p.kind === k} onClick={() => set({ kind: k, target: k === p.kind ? p.target : "" })}>{KIND_LABEL[k]}</button>
        ))}
      </div>
      <div className="form-grid">
        <label className="wide">
          {p.kind === "web" ? "Adresse" : p.kind === "folder" ? "Dossier" : "Programme (.exe, raccourci .lnk…)"}
          <div className="row">
            <input className="input" value={p.target} onChange={(e) => set({ target: e.target.value })} onBlur={() => !p.name && set({ name: guessName(p.kind, p.target) })} placeholder={p.kind === "web" ? "https://…" : "C:\\…"} spellCheck={false} required />
            {p.kind !== "web" && <button className="btn" type="button" onClick={pick}>Parcourir…</button>}
          </div>
        </label>
        <label>Nom<input className="input" value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="Nom affiché" /></label>
        {p.kind === "program" && <label>Arguments<input className="input" value={p.args} onChange={(e) => set({ args: e.target.value })} placeholder="facultatif" spellCheck={false} /></label>}
      </div>
      <div className="row">
        <button className="btn primary" type="submit" disabled={busy || !p.target.trim()}>{busy ? "Enregistrement…" : initial ? "Enregistrer" : "Ajouter"}</button>
        <button className="btn ghost" type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}

// ----- Espaces de travail ------------------------------------------------------------------------

const WS_COLORS = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#6366f1", "#ef4444"];

function itemLabel(snap: Snapshot, i: WorkspaceItem): { name: string; kind: string; missing: boolean } {
  if (i.kind === "app") {
    const a = snap.apps.find((x) => x.id === i.target);
    return { name: a?.name ?? i.target, kind: "app", missing: !a?.installedVersion };
  }
  if (i.kind === "personal") {
    const p = snap.profile.personal.find((x) => x.id === i.target);
    return { name: p?.name ?? "logiciel supprimé", kind: p?.kind ?? "program", missing: !p };
  }
  return { name: i.kind === "url" ? i.target.replace(/^https?:\/\/(www\.)?/, "") : i.target.split(/[\\/]/).filter(Boolean).pop() ?? i.target, kind: i.kind === "url" ? "web" : "folder", missing: false };
}

export function WorkspacesPage({ snap, onToast }: { snap: Snapshot; onToast: Toast }) {
  const [editing, setEditing] = useState<Workspace | null>(null);
  const { busy, err, setErr, run } = useAction(onToast);
  const ws = snap.profile.workspaces;

  const persist = (workspaces: Workspace[], ok: string) => run("save", () => api.saveProfile({ ...snap.profile, workspaces }), ok);
  const open = (w: Workspace) =>
    run(w.id, async () => {
      const r = await api.launchWorkspace(w.id);
      if (r.failures.length) throw { code: "other", message: `${r.opened} élément(s) ouvert(s), ${r.failures.length} échec(s) : ${r.failures.join(" ; ")}`, hint: "Vérifiez les éléments de l'espace." };
      return r;
    }, (r) => `Espace « ${w.name} » ouvert (${(r as { opened: number }).opened} élément${(r as { opened: number }).opened > 1 ? "s" : ""}).`);

  return (
    <>
      <PageHead eyebrow="Rayan's Launcher" title="Espaces de travail" text="Un bouton qui ouvre plusieurs applications, logiciels, dossiers et sites d'un coup.">
        {!editing && <button className="btn primary" onClick={() => setEditing({ id: uid("w"), name: "", color: WS_COLORS[ws.length % WS_COLORS.length], items: [] })}><Icon name="plus" size={16} /> Nouvel espace</button>}
      </PageHead>
      {err && <ErrorBox error={err} onClose={() => setErr(null)} />}
      {editing && (
        <WorkspaceEditor
          snap={snap}
          initial={editing}
          busy={busy === "save"}
          onCancel={() => setEditing(null)}
          onSave={async (w) => {
            if ((await persist([...ws.filter((x) => x.id !== w.id), w], `Espace « ${w.name} » enregistré.`)) !== undefined) setEditing(null);
          }}
        />
      )}
      {ws.length === 0 && !editing ? (
        <section className="empty">
          <div className="empty-art" aria-hidden><span className="empty-orbit" /><span className="empty-orbit inner" /><div className="empty-icon"><Icon name="layers" size={32} /></div></div>
          <h2>Aucun espace de travail</h2>
          <p className="muted">Créez par exemple « Dev » (éditeur, dossier du projet, GitHub) ou « Jeu ». Ils sont aussi dans la palette (Ctrl K).</p>
          <div className="row center"><button className="btn primary" onClick={() => setEditing({ id: uid("w"), name: "", color: WS_COLORS[0], items: [] })}>Créer un espace</button></div>
        </section>
      ) : (
        <div className="ws-grid">
          {ws.map((w, k) => (
            <article className="ws-card" key={w.id} style={{ "--ws": w.color || "var(--accent)", "--i": k } as React.CSSProperties}>
              <div className="ws-top">
                <div className="ws-badge"><Icon name="layers" size={20} /></div>
                <div>
                  <h2>{w.name}</h2>
                  <span className="muted small">{w.items.length} élément{w.items.length > 1 ? "s" : ""}</span>
                </div>
              </div>
              <ul className="ws-items">
                {w.items.map((i, n) => {
                  const l = itemLabel(snap, i);
                  const app = i.kind === "app" ? snap.apps.find((a) => a.id === i.target) : undefined;
                  return (
                    <li key={n} className={l.missing ? "missing" : ""}>
                      {app ? <AppIcon app={app} refresh={snap.catalog.fetchedAt} size={22} /> : <Monogram name={l.name} kind={l.kind} size={22} />}
                      <span>{l.name}</span>
                      {l.missing && <span className="muted small">non installée</span>}
                    </li>
                  );
                })}
              </ul>
              <div className="row">
                <button className="btn primary" onClick={() => void open(w)} disabled={busy === w.id || w.items.length === 0}>
                  <Icon name="play" size={14} /> {busy === w.id ? "Ouverture…" : "Tout ouvrir"}
                </button>
                <button className="btn small ghost" onClick={() => setEditing(w)}><Icon name="edit" size={14} /> Modifier</button>
                <button className="btn small ghost" onClick={() => void persist(ws.filter((x) => x.id !== w.id), `Espace « ${w.name} » supprimé.`)} aria-label={`Supprimer ${w.name}`}><Icon name="close" size={14} /></button>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="muted small note">La position des fenêtres n'est pas encore mémorisée : chaque logiciel s'ouvre là où il s'ouvre d'habitude.</p>
    </>
  );
}

function WorkspaceEditor({ snap, initial, busy, onSave, onCancel }: { snap: Snapshot; initial: Workspace; busy: boolean; onSave: (w: Workspace) => void; onCancel: () => void }) {
  const [w, setW] = useState<Workspace>(initial);
  const [url, setUrl] = useState("");
  const has = (i: WorkspaceItem) => w.items.some((x) => x.kind === i.kind && x.target === i.target);
  const toggle = (i: WorkspaceItem) => setW((o) => ({ ...o, items: has(i) ? o.items.filter((x) => !(x.kind === i.kind && x.target === i.target)) : [...o.items, i] }));
  const installed = snap.apps.filter((a) => a.installedVersion);
  const extra = w.items.filter((i) => i.kind === "folder" || i.kind === "url");
  return (
    <form className="panel inline-form ws-editor" onSubmit={(e) => { e.preventDefault(); if (w.name.trim()) onSave({ ...w, name: w.name.trim() }); }}>
      <div className="form-grid">
        <label>Nom<input className="input" value={w.name} onChange={(e) => setW({ ...w, name: e.target.value })} placeholder="Dev, Bureau, Jeu…" required autoFocus /></label>
        <label>Couleur
          <div className="ws-colors">
            {WS_COLORS.map((c) => <button key={c} type="button" aria-pressed={w.color === c} style={{ background: c }} onClick={() => setW({ ...w, color: c })} aria-label={c} />)}
          </div>
        </label>
      </div>
      <h4>Applications du catalogue</h4>
      <div className="pick-list">
        {installed.length === 0 && <span className="muted small">Aucune application installée.</span>}
        {installed.map((a) => (
          <label key={a.id} className="pick">
            <input type="checkbox" checked={has({ kind: "app", target: a.id })} onChange={() => toggle({ kind: "app", target: a.id })} />
            <AppIcon app={a} refresh={snap.catalog.fetchedAt} size={22} /> {a.name}
          </label>
        ))}
      </div>
      <h4>Mes logiciels</h4>
      <div className="pick-list">
        {snap.profile.personal.length === 0 && <span className="muted small">Ajoutez-en depuis la page « Installées ».</span>}
        {snap.profile.personal.map((p) => (
          <label key={p.id} className="pick">
            <input type="checkbox" checked={has({ kind: "personal", target: p.id })} onChange={() => toggle({ kind: "personal", target: p.id })} />
            <Monogram name={p.name} kind={p.kind} size={22} /> {p.name}
          </label>
        ))}
      </div>
      <h4>Dossiers et sites</h4>
      <div className="pick-list">
        {extra.map((i) => (
          <span key={i.kind + i.target} className="chip">
            <Icon name={i.kind === "url" ? "globe" : "folder"} size={13} /> {itemLabel(snap, i).name}
            <button type="button" className="link" onClick={() => toggle(i)} aria-label="Retirer"><Icon name="close" size={12} /></button>
          </span>
        ))}
      </div>
      <div className="row">
        <button className="btn small" type="button" onClick={async () => { const d = await api.pickPath("folder"); if (d && !has({ kind: "folder", target: d })) toggle({ kind: "folder", target: d }); }}><Icon name="folder" size={14} /> Ajouter un dossier</button>
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" spellCheck={false} />
        <button className="btn small" type="button" disabled={!/^https?:\/\/\S+\.\S+/.test(url)} onClick={() => { toggle({ kind: "url", target: url.trim() }); setUrl(""); }}><Icon name="globe" size={14} /> Ajouter le site</button>
      </div>
      <div className="row">
        <button className="btn primary" type="submit" disabled={busy || !w.name.trim()}>{busy ? "Enregistrement…" : "Enregistrer l'espace"}</button>
        <button className="btn ghost" type="button" onClick={onCancel}>Annuler</button>
        <span className="muted small">{w.items.length} élément{w.items.length > 1 ? "s" : ""}, ouverts dans cet ordre.</span>
      </div>
    </form>
  );
}

// ----- Historique et diagnostic ------------------------------------------------------------------

export const EVENT_LABEL: Record<string, string> = {
  install: "Installation",
  update: "Mise à jour",
  "auto-update": "Mise à jour automatique",
  rollback: "Retour de version",
  uninstall: "Désinstallation",
  launch: "Lancement",
  exit: "Fermeture",
  error: "Erreur",
  backup: "Sauvegarde",
  restore: "Restauration",
  clean: "Nettoyage",
  export: "Export du profil",
  import: "Import du profil",
  workspace: "Espace de travail",
};
const EVENT_ICON: Record<string, string> = {
  install: "download", update: "update", "auto-update": "update", rollback: "back", uninstall: "close", launch: "play", exit: "power",
  error: "alert", backup: "shield", restore: "refresh", clean: "trash", export: "box", import: "box", workspace: "layers",
};

/** Code de sortie lisible (les codes NTSTATUS négatifs en hexadécimal). */
export function exitText(code: number | null): string {
  if (code == null) return "arrêtée sans code";
  if (code === 0) return "0 (normale)";
  const hex = "0x" + (code >>> 0).toString(16).toUpperCase().padStart(8, "0");
  const known: Record<string, string> = {
    "0xC0000005": "violation d'accès mémoire",
    "0xC0000409": "dépassement de pile détecté",
    "0xC000013A": "fermée par Ctrl+C ou l'arrêt de Windows",
    "0xC0000135": "DLL introuvable",
    "0xC0000142": "échec d'initialisation d'une DLL",
    "0x00000001": "erreur générale",
  };
  return code < 0 || code > 255 ? `${code} (${hex}${known[hex] ? `, ${known[hex]}` : ""})` : `${code}${known[hex] ? ` (${known[hex]})` : ""}`;
}

function duration(s: number | null): string {
  if (s == null) return "";
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`;
}

function eventLine(e: HistoryEvent): string {
  const v = e.from && e.version ? `${e.from} → ${e.version}` : e.version ?? "";
  if (e.kind === "exit") return [v, `code ${exitText(e.code)}`, duration(e.seconds) && `après ${duration(e.seconds)}`].filter(Boolean).join(" · ");
  return [v, e.detail].filter(Boolean).join(" · ");
}

/** Texte à coller dans un ticket : versions, dernier code de sortie, dernières erreurs et événements. */
export function diagnosticText(snap: Snapshot, app: AppView, events: HistoryEvent[]): string {
  const lastExit = events.find((e) => e.kind === "exit");
  const changes = events.filter((e) => ["install", "update", "auto-update", "rollback"].includes(e.kind)).slice(0, 3);
  const errors = events.filter((e) => e.kind === "error").slice(0, 3);
  const lines = [
    `Diagnostic ${app.name} (${app.id})`,
    `Version installée : ${app.installedVersion ?? "aucune"}${app.previousVersion ? ` (précédente gardée : ${app.previousVersion})` : ""}`,
    `Version au catalogue : ${app.availableVersion ?? "retirée"}${app.heldVersion ? ` (ignorée jusqu'à ${app.heldVersion})` : ""}`,
    `Dernier lancement : ${lastExit ? `${dateTime(lastExit.at)}, code ${exitText(lastExit.code)}${lastExit.seconds != null ? `, ${duration(lastExit.seconds)}` : ""}` : "aucun"}`,
    ...changes.map((e) => `${EVENT_LABEL[e.kind] ?? e.kind} le ${dateTime(e.at)} : ${eventLine(e)}`),
    ...errors.map((e) => `Erreur le ${dateTime(e.at)} : ${e.detail ?? ""}`),
    `Launcher : mode ${snap.mode === "development" ? "développement" : "distribution"}, données ${snap.dataRoot}`,
    `Système : ${navigator.userAgent}`,
  ];
  if (app.lastError) lines.push(`Erreur affichée : ${app.lastError.message}`);
  return lines.join("\n");
}

function Timeline({ snap, events, showApp, onOpenApp }: { snap: Snapshot; events: HistoryEvent[]; showApp: boolean; onOpenApp?: (id: string) => void }) {
  const days = useMemo(() => {
    const m = new Map<string, HistoryEvent[]>();
    for (const e of events) {
      const d = e.at.slice(0, 10);
      m.set(d, [...(m.get(d) ?? []), e]);
    }
    return [...m.entries()];
  }, [events]);
  if (events.length === 0) return <p className="backup-empty">Rien pour l'instant.</p>;
  return (
    <div className="timeline">
      {days.map(([d, list]) => (
        <div key={d} className="tl-day">
          <h4>{date(d)}</h4>
          <ol>
            {list.map((e, i) => {
              const bad = e.kind === "error" || (e.kind === "exit" && e.code !== 0 && e.code != null);
              return (
                <li key={e.at + i} className={`tl-${bad ? "bad" : e.kind}`}>
                  <span className="tl-dot"><Icon name={EVENT_ICON[e.kind] ?? "box"} size={13} /></span>
                  <span className="tl-time">{new Date(e.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="tl-main">
                    <b>{EVENT_LABEL[e.kind] ?? e.kind}</b>
                    {showApp && e.appId && (
                      <button className="link tl-app" onClick={() => onOpenApp?.(e.appId!)} disabled={!snap.apps.some((a) => a.id === e.appId)}>{nameOf(snap, e.appId)}</button>
                    )}
                    <span className="muted">{eventLine(e)}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

export function HistoryPage({ snap, onOpenApp }: { snap: Snapshot; onOpenApp: (id: string) => void }) {
  const [events, setEvents] = useState<HistoryEvent[] | null>(null);
  const [app, setApp] = useState("");
  const [filter, setFilter] = useState<"tout" | "changements" | "lancements" | "erreurs">("tout");
  useEffect(() => {
    api.history(app || null, 600).then(setEvents).catch(() => setEvents([]));
  }, [app, snap]);
  const shown = (events ?? []).filter((e) =>
    filter === "tout" ? true
    : filter === "erreurs" ? e.kind === "error" || (e.kind === "exit" && e.code !== 0 && e.code != null)
    : filter === "lancements" ? e.kind === "launch" || e.kind === "exit" || e.kind === "workspace"
    : ["install", "update", "auto-update", "rollback", "uninstall", "restore", "backup", "clean", "import"].includes(e.kind),
  );
  const ids = [...new Set((events ?? []).map((e) => e.appId).filter(Boolean))] as string[];
  const crashes = (events ?? []).filter((e) => e.kind === "exit" && e.code !== 0 && e.code != null).length;
  return (
    <>
      <PageHead eyebrow="Rayan's Launcher" title="Historique" text="Installations, mises à jour, lancements et erreurs. Si une application qui marchait hier ne démarre plus, la réponse est souvent ici." />
      <div className="filters">
        <select className="input" value={app} onChange={(e) => setApp(e.target.value)} aria-label="Application">
          <option value="">Toutes les applications</option>
          {[...new Set([...snap.apps.filter((a) => a.installedVersion).map((a) => a.id), ...ids])].map((id) => <option key={id} value={id}>{nameOf(snap, id)}</option>)}
        </select>
        <div className="seg" role="group" aria-label="Filtre">
          {(["tout", "changements", "lancements", "erreurs"] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === "tout" ? "Tout" : f === "changements" ? "Versions" : f === "lancements" ? "Lancements" : `Erreurs${crashes ? ` · ${crashes}` : ""}`}
            </button>
          ))}
        </div>
      </div>
      {app && snap.apps.some((a) => a.id === app && a.installedVersion) && (
        <AppDiagnostics app={snap.apps.find((a) => a.id === app)!} snap={snap} events={events} />
      )}
      <section className="panel">{events === null ? <div className="sk-line w60" /> : <Timeline snap={snap} events={shown} showApp={!app} onOpenApp={onOpenApp} />}</section>
    </>
  );
}

/** Encadré de diagnostic : dernier lancement, version qui a changé, bouton pour copier les détails. */
export function AppDiagnostics({ app, snap, events, onToast }: { app: AppView; snap: Snapshot; events?: HistoryEvent[] | null; onToast?: Toast }) {
  const [own, setOwn] = useState<HistoryEvent[] | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (events === undefined) api.history(app.id, 200).then(setOwn).catch(() => setOwn([]));
  }, [app.id, app.lastExitCode, app.installedVersion, events]);
  const list = events ?? own ?? [];
  const lastExit = list.find((e) => e.kind === "exit");
  const lastChange = list.find((e) => ["install", "update", "auto-update", "rollback"].includes(e.kind));
  const failing = lastExit && lastExit.code !== 0 && lastExit.code != null;
  const copy = async () => {
    await copyText(diagnosticText(snap, app, list));
    setCopied(true);
    onToast?.("Diagnostic copié : collez-le dans votre ticket.");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <section className={`panel diag ${failing ? "bad" : ""}`}>
      <div className="safety-head">
        <h3>Diagnostic</h3>
        <button className="btn small" onClick={() => void copy()}><Icon name={copied ? "check" : "copy"} size={14} /> {copied ? "Copié" : "Copier le diagnostic"}</button>
      </div>
      <dl className="diag-facts">
        <div>
          <dt>Dernier lancement</dt>
          <dd className={failing ? "bad-text" : ""}>{lastExit ? `${dateTime(lastExit.at)} · code ${exitText(lastExit.code)}` : "jamais lancée depuis le launcher"}</dd>
        </div>
        <div>
          <dt>Dernier changement de version</dt>
          <dd>{lastChange ? `${EVENT_LABEL[lastChange.kind]} le ${dateTime(lastChange.at)} · ${eventLine(lastChange)}` : "—"}</dd>
        </div>
      </dl>
      {failing && lastChange && new Date(lastChange.at) > new Date(Date.now() - 7 * 864e5) && (
        <p className="small diag-hint">
          <Icon name="alert" size={14} /> L'application s'est fermée en erreur après {lastChange.from ? `le passage de la ${lastChange.from} à la ${lastChange.version}` : "son installation"}.
          {app.previousVersion && " Vous pouvez revenir à la version précédente ci-dessus."}
        </p>
      )}
    </section>
  );
}

export function RecentHistory({ app, snap }: { app: AppView; snap: Snapshot }) {
  const [events, setEvents] = useState<HistoryEvent[] | null>(null);
  useEffect(() => {
    api.history(app.id, 8).then(setEvents).catch(() => setEvents([]));
  }, [app.id, app.lastExitCode, app.installedVersion, app.backupCount]);
  return (
    <section className="panel">
      <h3>Historique récent</h3>
      {events === null ? <div className="sk-line w60" /> : <Timeline snap={snap} events={events} showApp={false} />}
    </section>
  );
}

// ----- Règles de mise à jour ---------------------------------------------------------------------

export function UpdateRulePicker({ app, snap, onToast }: { app: AppView; snap: Snapshot; onToast: Toast }) {
  const { err, setErr, run } = useAction(onToast);
  const p = snap.profile.updates;
  const value = p.perApp[app.id] ?? "";
  const change = (v: string) => {
    const perApp = { ...p.perApp };
    if (v) perApp[app.id] = v as "ask" | "auto";
    else delete perApp[app.id];
    void run("rule", () => api.saveProfile({ ...snap.profile, updates: { ...p, perApp } }), v === "auto" ? `${app.name} se mettra à jour seule, une fois fermée.` : `Règle de ${app.name} enregistrée.`);
  };
  return (
    <div className="facts rule-pick">
      <div>
        <dt>Mises à jour</dt>
        <dd>
          <select className="input" value={value} onChange={(e) => change(e.target.value)} aria-label="Règle de mise à jour">
            <option value="">Règle générale ({p.defaultRule === "auto" ? "automatique" : "demander"})</option>
            <option value="ask">Toujours demander</option>
            <option value="auto">Automatique quand elle est fermée</option>
          </select>
          {p.paused && <span className="muted small">Pause générale active : rien n'est installé seul.</span>}
        </dd>
      </div>
      {err && <ErrorBox error={err} onClose={() => setErr(null)} />}
    </div>
  );
}

export function UpdateRulesPanel({ snap, onToast }: { snap: Snapshot; onToast: Toast }) {
  const { err, setErr, run } = useAction(onToast);
  const p = snap.profile.updates;
  const save = (updates: Profile["updates"], ok: string) => void run("save", () => api.saveProfile({ ...snap.profile, updates }), ok);
  const exceptions = Object.entries(p.perApp);
  return (
    <section className="panel settings" style={{ "--i": 1 } as React.CSSProperties}>
      <h3>Mises à jour</h3>
      <p className="muted small">Une règle générale et des exceptions par application. « Automatique » installe la mise à jour quand l'application est fermée, au démarrage du launcher puis toutes les heures ; une sauvegarde des données est toujours faite avant.</p>
      <div className="pref-rows">
        <div className="pref">
          <span><b>Règle générale</b></span>
          <div className="seg" role="group" aria-label="Règle générale">
            <button type="button" aria-pressed={p.defaultRule === "ask"} onClick={() => save({ ...p, defaultRule: "ask" }, "Les mises à jour seront proposées.")}>Demander</button>
            <button type="button" aria-pressed={p.defaultRule === "auto"} onClick={() => save({ ...p, defaultRule: "auto" }, "Mises à jour automatiques activées.")}>Automatique</button>
          </div>
        </div>
        <div className="pref">
          <span><b>Pause générale</b><small>Garder l'environnement stable : aucune mise à jour automatique</small></span>
          <label className="switch">
            <input type="checkbox" checked={p.paused} onChange={(e) => save({ ...p, paused: e.target.checked }, e.target.checked ? "Mises à jour automatiques en pause." : "Pause levée.")} aria-label="Pause générale" />
            <i />
          </label>
        </div>
      </div>
      <h4>Exceptions</h4>
      {exceptions.length === 0 ? (
        <p className="muted small">Aucune. Choisissez une règle propre à une application depuis sa fiche, ou ici :</p>
      ) : (
        <ul className="rule-list">
          {exceptions.map(([id, r]) => (
            <li key={id}>
              <span>{nameOf(snap, id)}</span>
              <span className={`tag ${r === "auto" ? "good" : ""}`}>{r === "auto" ? "automatique" : "demander"}</span>
              <button className="link" onClick={() => { const perApp = { ...p.perApp }; delete perApp[id]; save({ ...p, perApp }, `Exception retirée pour ${nameOf(snap, id)}.`); }} aria-label="Retirer l'exception"><Icon name="close" size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      <select className="input" value="" onChange={(e) => { const [id, r] = e.target.value.split("|"); if (id) save({ ...p, perApp: { ...p.perApp, [id]: r as "ask" | "auto" } }, `Exception ajoutée pour ${nameOf(snap, id)}.`); }} aria-label="Ajouter une exception">
        <option value="">Ajouter une exception…</option>
        {snap.apps.filter((a) => a.installedVersion && !(a.id in p.perApp)).flatMap((a) => [
          <option key={a.id + "auto"} value={`${a.id}|auto`}>{a.name} : automatique</option>,
          <option key={a.id + "ask"} value={`${a.id}|ask`}>{a.name} : toujours demander</option>,
        ])}
      </select>
      {err && <ErrorBox error={err} onClose={() => setErr(null)} />}
    </section>
  );
}

// ----- Export et migration -----------------------------------------------------------------------

export function TransferPanel({ snap, onToast }: { snap: Snapshot; onToast: Toast }) {
  const { setPrefs } = usePrefs();
  const { busy, err, setErr, run } = useAction(onToast);
  const installed = snap.apps.filter((a) => a.installedVersion);
  const [data, setData] = useState<string[]>([]);
  const [imp, setImp] = useState<{ path: string; m: ExportManifest } | null>(null);
  const [opts, setOpts] = useState({ settings: true, profile: true, prefs: true, installMissing: true, data: [] as string[] });
  const [result, setResult] = useState<string[] | null>(null);

  const doExport = async () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const path = await api.pickSave(`profil-rayans-launcher-${stamp}.zip`);
    if (!path) return;
    await run("export", () => api.exportProfile(path, loadPrefs(), data), (n) => `Profil exporté (${bytes(n as number)}) : ${path}`);
  };
  const pickImport = async () => {
    setResult(null);
    const path = await api.pickPath("profile");
    if (!path) return;
    const m = (await run("read", () => api.readImport(path))) as ExportManifest | undefined;
    if (m) {
      setImp({ path, m });
      setOpts((o) => ({ ...o, data: m.data.slice() }));
    }
  };
  const doImport = async () => {
    if (!imp) return;
    const r = (await run("import", () => api.importProfile(imp.path, { settings: opts.settings, profile: opts.profile, data: opts.data, installMissing: opts.installMissing }), "Profil importé.")) as
      | { prefs: unknown; messages: string[] }
      | undefined;
    if (!r) return;
    if (opts.prefs && r.prefs && typeof r.prefs === "object") setPrefs(r.prefs as Partial<Prefs>);
    setResult(r.messages);
    setImp(null);
  };
  const missing = imp ? imp.m.apps.filter((a) => !snap.apps.some((x) => x.id === a.id && x.installedVersion)) : [];

  return (
    <section className="panel settings transfer" style={{ "--i": 2 } as React.CSSProperties}>
      <h3>Export et migration du PC</h3>
      <p className="muted small">Un seul fichier ZIP avec vos réglages, espaces de travail, logiciels ajoutés, règles de mise à jour, la liste de vos applications et, si vous le voulez, leurs données. Sur l'autre PC : importez-le, les applications du catalogue sont réinstallées d'un coup.</p>
      <div className="transfer-cols">
        <div>
          <h4>Exporter</h4>
          <p className="small muted">Données à inclure :</p>
          <div className="pick-list">
            {installed.map((a) => (
              <label key={a.id} className="pick">
                <input type="checkbox" checked={data.includes(a.id)} onChange={(e) => setData((d) => (e.target.checked ? [...d, a.id] : d.filter((x) => x !== a.id)))} />
                {a.name}
              </label>
            ))}
          </div>
          <div className="row">
            <button className="btn small ghost" type="button" onClick={() => setData(data.length === installed.length ? [] : installed.map((a) => a.id))}>{data.length === installed.length ? "Aucune" : "Toutes"}</button>
            <button className="btn primary" onClick={() => void doExport()} disabled={busy !== null}><Icon name="box" size={15} /> {busy === "export" ? "Export…" : "Exporter le profil…"}</button>
          </div>
        </div>
        <div>
          <h4>Importer</h4>
          {!imp ? (
            <button className="btn" onClick={() => void pickImport()} disabled={busy !== null}>{busy === "read" ? "Lecture…" : "Choisir un profil exporté…"}</button>
          ) : (
            <div className="import-preview">
              <p className="small">Exporté le <b>{dateTime(imp.m.exportedAt)}</b> · {imp.m.apps.length} application{imp.m.apps.length > 1 ? "s" : ""} · {imp.m.profile.workspaces.length} espace(s) · {imp.m.profile.personal.length} logiciel(s) perso</p>
              <label className="check"><input type="checkbox" checked={opts.settings} onChange={(e) => setOpts({ ...opts, settings: e.target.checked })} /> Adresse du catalogue {imp.m.catalogUrl && <code className="path small">{imp.m.catalogUrl}</code>}</label>
              <label className="check"><input type="checkbox" checked={opts.profile} onChange={(e) => setOpts({ ...opts, profile: e.target.checked })} /> Espaces, logiciels perso et règles de mise à jour</label>
              <label className="check"><input type="checkbox" checked={opts.prefs} onChange={(e) => setOpts({ ...opts, prefs: e.target.checked })} /> Personnalisation (thème, disposition)</label>
              <label className="check"><input type="checkbox" checked={opts.installMissing} onChange={(e) => setOpts({ ...opts, installMissing: e.target.checked })} /> Installer les applications manquantes{missing.length ? ` (${missing.map((a) => a.name).join(", ")})` : " (aucune)"}</label>
              {imp.m.data.length > 0 && (
                <>
                  <p className="small muted">Données à restaurer (les données présentes sont sauvegardées avant) :</p>
                  <div className="pick-list">
                    {imp.m.data.map((id) => (
                      <label key={id} className="pick">
                        <input type="checkbox" checked={opts.data.includes(id)} onChange={(e) => setOpts((o) => ({ ...o, data: e.target.checked ? [...o.data, id] : o.data.filter((x) => x !== id) }))} />
                        {imp.m.apps.find((a) => a.id === id)?.name ?? id}
                      </label>
                    ))}
                  </div>
                </>
              )}
              <div className="row">
                <button className="btn primary" onClick={() => void doImport()} disabled={busy !== null}>{busy === "import" ? "Import…" : "Importer"}</button>
                <button className="btn ghost" onClick={() => setImp(null)}>Annuler</button>
              </div>
            </div>
          )}
          {result && <ul className="result-list">{result.map((m) => <li key={m}><Icon name="check" size={13} /> {m}</li>)}</ul>}
        </div>
      </div>
      {err && <ErrorBox error={err} onClose={() => setErr(null)} />}
    </section>
  );
}

// ----- Centre de stockage ------------------------------------------------------------------------

const STORAGE_COLOR: Record<string, string> = {
  "version-active": "var(--a1)", "version-previous": "var(--a2)", "version-pending": "var(--a2)", data: "var(--good)",
  "backups-auto": "var(--a3)", "backups-manual": "var(--warn)", partial: "var(--muted)",
};

export function StoragePage({ snap, onToast }: { snap: Snapshot; onToast: Toast }) {
  const [report, setReport] = useState<StorageReport | null>(null);
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [confirm, setConfirm] = useState(false);
  const { busy, err, setErr, run } = useAction(onToast);
  const reload = useCallback(() => void api.storageReport().then(setReport).catch((e) => setErr(toErrorInfo(e))), [setErr]);
  useEffect(reload, [reload, snap.apps.length]);

  const chosen = report ? report.apps.flatMap((a) => a.items.filter((i) => sel[a.id]?.includes(i.kind)).map((i) => ({ app: a, item: i }))) : [];
  const chosenBytes = chosen.reduce((n, c) => n + c.item.bytes, 0);
  const toggle = (id: string, kind: string) => {
    setConfirm(false);
    setSel((s) => ({ ...s, [id]: s[id]?.includes(kind) ? s[id].filter((k) => k !== kind) : [...(s[id] ?? []), kind] }));
  };
  const selectAll = () => {
    if (!report) return;
    const all: Record<string, string[]> = {};
    for (const a of report.apps) all[a.id] = a.items.filter((i) => i.removable && i.kind !== "backups-manual").map((i) => i.kind);
    setSel(all);
    setConfirm(false);
  };
  const clean = async () => {
    let freed = 0;
    for (const [id, kinds] of Object.entries(sel)) {
      if (!kinds.length) continue;
      const r = await run("clean", () => api.cleanStorage(id, kinds));
      if (r === undefined) break;
      freed += r as number;
    }
    onToast(`${bytes(freed)} libérés.`);
    setSel({});
    setConfirm(false);
    reload();
  };

  return (
    <>
      <PageHead eyebrow="Rayan's Launcher" title="Stockage" text={report ? `${bytes(report.total)} utilisés · ${bytes(report.reclaimable)} récupérables` : "Calcul…"}>
        <button className="btn" onClick={reload}><Icon name="refresh" size={16} /> Recalculer</button>
        {report && report.reclaimable > 0 && <button className="btn" onClick={selectAll}>Tout le récupérable</button>}
      </PageHead>
      {err && <ErrorBox error={err} onClose={() => setErr(null)} />}
      {report && (
        <section className="panel storage-total">
          <div className="stack-bar" aria-hidden>
            {report.apps.map((a) => <span key={a.id} style={{ flexGrow: a.total }} title={`${a.name} : ${bytes(a.total)}`} />)}
            {report.images > 0 && <span className="img" style={{ flexGrow: report.images }} />}
          </div>
          <div className="legend">
            {Object.entries({ "version-active": "Version active", "version-previous": "Version précédente", data: "Données", "backups-auto": "Sauvegardes auto", "backups-manual": "Sauvegardes manuelles", partial: "Téléchargements interrompus" }).map(([k, l]) => (
              <span key={k}><i style={{ background: STORAGE_COLOR[k] }} /> {l}</span>
            ))}
          </div>
          <p className="muted small">Dossier du launcher : <button className="link" onClick={() => void api.openPath(report.root)}><code className="path">{report.root}</code></button> · visuels en cache : {bytes(report.images)}</p>
        </section>
      )}
      {chosen.length > 0 && (
        <section className="panel clean-plan">
          <h3>Nettoyage prévu · {bytes(chosenBytes)} récupérés</h3>
          <ul>
            {chosen.map((c) => (
              <li key={c.app.id + c.item.kind}><b>{c.app.name}</b> · {c.item.label} · {bytes(c.item.bytes)} ({c.item.files} fichier{c.item.files > 1 ? "s" : ""})</li>
            ))}
          </ul>
          {chosen.some((c) => c.item.kind === "version-previous") && <p className="small warn-text"><Icon name="alert" size={13} /> Sans version précédente, le retour en arrière ne sera plus possible jusqu'à la prochaine mise à jour.</p>}
          {chosen.some((c) => c.item.kind.startsWith("backups")) && <p className="small warn-text"><Icon name="alert" size={13} /> Les sauvegardes supprimées ne pourront plus être restaurées.</p>}
          <div className="row">
            {!confirm ? (
              <button className="btn danger" onClick={() => setConfirm(true)}>Supprimer ces éléments…</button>
            ) : (
              <>
                <button className="btn danger" onClick={() => void clean()} disabled={busy !== null}>{busy ? "Suppression…" : `Oui, supprimer définitivement (${bytes(chosenBytes)})`}</button>
                <button className="btn ghost" onClick={() => setConfirm(false)}>Annuler</button>
              </>
            )}
            <button className="btn ghost" onClick={() => { setSel({}); setConfirm(false); }}>Tout désélectionner</button>
          </div>
        </section>
      )}
      {report === null ? <div className="sk-line w60" /> : report.apps.map((a, k) => (
        <section className="panel storage-app" key={a.id} style={{ "--i": k } as React.CSSProperties}>
          <div className="safety-head">
            <h3>{a.name}</h3>
            <span className="muted small">{bytes(a.total)}{a.reclaimable > 0 && ` · ${bytes(a.reclaimable)} récupérables`}</span>
          </div>
          <div className="stack-bar thin" aria-hidden>
            {a.items.map((i) => <span key={i.kind} style={{ flexGrow: Math.max(i.bytes, 1), background: STORAGE_COLOR[i.kind] }} />)}
          </div>
          <ul className="storage-items">
            {a.items.map((i) => (
              <li key={i.kind + i.path}>
                {i.removable ? (
                  <label className="check"><input type="checkbox" checked={!!sel[a.id]?.includes(i.kind)} onChange={() => toggle(a.id, i.kind)} /> {i.label}</label>
                ) : (
                  <span className="check locked"><Icon name="lock" size={13} /> {i.label}</span>
                )}
                <span className="muted small">{i.files} fichier{i.files > 1 ? "s" : ""}</span>
                <b className="num">{bytes(i.bytes)}</b>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

// ----- Atelier de publication --------------------------------------------------------------------

export function WorkshopPage({ snap, onToast, onOpenApp }: { snap: Snapshot; onToast: Toast; onOpenApp: (id: string) => void }) {
  const [path, setPath] = useState<string | null>(null);
  const [r, setR] = useState<WorkshopReport | null>(null);
  const [m, setM] = useState<ZipEntry | null>(null);
  const { busy, err, setErr, run } = useAction(onToast);
  const analyze = async (p?: string) => {
    const zip = p ?? (await api.pickPath("zip"));
    if (!zip) return;
    const rep = (await run("analyze", () => api.workshopAnalyze(zip))) as WorkshopReport | undefined;
    if (rep) {
      setPath(zip);
      setR(rep);
      setM(rep.manifest);
    }
  };
  const json = m ? JSON.stringify({ id: m.id, name: m.name, description: m.description, version: m.version, releaseNotes: m.releaseNotes, executable: m.executable }, null, 2) : "";
  const preview: AppView | null = m
    ? {
        ...(snap.apps.find((a) => a.id === m.id) ?? ({} as AppView)),
        id: m.id || "nouvelle-app",
        name: m.name || "Sans nom",
        description: m.description,
        releaseNotes: m.releaseNotes,
        availableVersion: m.version,
      }
    : null;
  const set = (k: keyof ZipEntry) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setM((x) => x && { ...x, [k]: e.target.value });
  const counts = r ? { error: r.checks.filter((c) => c.level === "error").length, warn: r.checks.filter((c) => c.level === "warn").length } : null;

  return (
    <>
      <PageHead eyebrow="Publication" title="Atelier" text="Vérifiez le ZIP d'une de vos applications avant de lancer la CI : structure, fiche, fichiers oubliés, paquet qui grossit.">
        <button className="btn primary" onClick={() => void analyze()} disabled={busy !== null}><Icon name="box" size={16} /> {busy === "analyze" ? "Analyse…" : r ? "Analyser un autre ZIP" : "Choisir un ZIP…"}</button>
        {path && <button className="btn" onClick={() => void analyze(path)} disabled={busy !== null}><Icon name="refresh" size={16} /> Réanalyser</button>}
      </PageHead>
      {err && <ErrorBox error={err} onClose={() => setErr(null)} />}
      {!r && !busy && (
        <section className="empty">
          <div className="empty-art" aria-hidden><span className="empty-orbit" /><span className="empty-orbit inner" /><div className="empty-icon"><Icon name="box" size={32} /></div></div>
          <h2>Déposez un ZIP à vérifier</h2>
          <p className="muted">Le launcher le lit sans rien installer, le compare à la version installée de la même application, et prépare sa fiche rayans-launcher.json.</p>
          <div className="row center"><button className="btn primary" onClick={() => void analyze()}>Choisir un ZIP…</button></div>
        </section>
      )}
      {r && m && counts && (
        <div className="workshop">
          <div className="detail-main">
            <section className={`panel verdict ${counts.error ? "bad" : counts.warn ? "warn" : "ok"}`}>
              <div className="verdict-head">
                <Icon name={counts.error ? "alert" : "check"} size={22} />
                <div>
                  <h3>{counts.error ? `${counts.error} problème${counts.error > 1 ? "s" : ""} à corriger` : r.ready ? "Prêt à publier" : "Fiche à ajouter"}</h3>
                  <p className="muted small"><code className="path">{r.zipName}</code> · {bytes(r.zipBytes)} compressé · {bytes(r.unpackedBytes)} une fois extrait · {r.files} fichiers</p>
                </div>
              </div>
              <ul className="checks">
                {r.checks.map((c, i) => <li key={i} className={c.level}><Icon name={c.level === "ok" ? "check" : "alert"} size={14} /> {c.text}</li>)}
              </ul>
            </section>
            {r.comparison && (
              <section className="panel">
                <h3>Comparaison avec la {r.comparison.version} installée</h3>
                <p className="muted small">{r.comparison.filesBefore} → {r.files} fichiers · {bytes(r.comparison.bytesBefore)} → {bytes(r.unpackedBytes)} ({signedPct(r.comparison.bytesBefore, r.unpackedBytes)}) · {r.comparison.changed} modifié(s)</p>
                <DiffList title="Ajoutés" tone="good" list={r.comparison.added} />
                <DiffList title="Absents du nouveau ZIP" tone="bad" list={r.comparison.removed} />
                <DiffList title="Ont beaucoup grossi" tone="warn" list={r.comparison.grown} />
                {!r.comparison.added.length && !r.comparison.removed.length && !r.comparison.grown.length && <p className="small muted">Mêmes fichiers que la version installée.</p>}
              </section>
            )}
            <section className="panel">
              <h3>Plus gros fichiers</h3>
              <ul className="storage-items">
                {r.largest.map((f) => <li key={f.path}><code className="path small">{f.path}</code><b className="num">{bytes(f.after)}</b></li>)}
              </ul>
            </section>
          </div>
          <aside className="detail-main">
            <section className="panel">
              <h3>Fiche {r.hasManifest ? "lue dans le ZIP" : "à ajouter au ZIP"}</h3>
              <div className="form-grid one">
                <label>Nom<input className="input" value={m.name} onChange={set("name")} /></label>
                <label>Identifiant<input className="input" value={m.id} onChange={set("id")} spellCheck={false} /></label>
                <label>Version<input className="input" value={m.version} onChange={set("version")} placeholder="1.2.3" /></label>
                <label>Programme à lancer
                  <select className="input" value={m.executable} onChange={set("executable")}>
                    {[...new Set([m.executable, ...r.executables])].filter(Boolean).map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label>Description<input className="input" value={m.description} onChange={set("description")} /></label>
                <label>Notes de version<textarea className="input" rows={4} value={m.releaseNotes} onChange={set("releaseNotes")} /></label>
              </div>
              <div className="row">
                <button className="btn small" onClick={() => void copyText(json).then(() => onToast("Fiche rayans-launcher.json copiée."))}><Icon name="copy" size={14} /> Copier la fiche JSON</button>
                {snap.localCatalogPath && path && (
                  <button className="btn small primary" disabled={busy !== null || counts.error > 0} onClick={() => void run("add", () => api.addZip(path, m), `${m.name} ${m.version} ajoutée au catalogue local.`).then((id) => typeof id === "string" && onOpenApp(id))}>
                    Ajouter au catalogue local
                  </button>
                )}
              </div>
            </section>
            {preview && (
              <section className="panel">
                <h3>Aperçu de la carte</h3>
                <article className="card preview-card">
                  <div className="card-visual visual"><div className="visual-fallback"><Icon name="box" size={42} /></div></div>
                  <div className="card-body">
                    <div className="card-title">
                      {snap.apps.some((a) => a.id === m.id) ? <AppIcon app={preview} refresh={snap.catalog.fetchedAt} size={48} /> : <Monogram name={preview.name} kind="program" size={48} />}
                      <div><h2>{preview.name}</h2></div>
                    </div>
                    <p className="desc">{preview.description || <span className="muted">Description manquante</span>}</p>
                    <div className="notes-preview">
                      <span className="label">Notes de version {m.version}</span>
                      <p>{m.releaseNotes.split("\n")[0] || "—"}</p>
                    </div>
                  </div>
                </article>
              </section>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

function signedPct(a: number, b: number): string {
  if (!a) return "nouveau";
  const p = Math.round(((b - a) / a) * 100);
  return `${p >= 0 ? "+" : ""}${p} %`;
}

function DiffList({ title, tone, list }: { title: string; tone: string; list: { path: string; before: number | null; after: number | null }[] }) {
  if (!list.length) return null;
  return (
    <div className={`diff ${tone}`}>
      <h4>{title} · {list.length}</h4>
      <ul>
        {list.slice(0, 30).map((f) => (
          <li key={f.path}>
            <code className="path small">{f.path}</code>
            <span className="num small">{f.before != null && f.after != null ? `${bytes(f.before)} → ${bytes(f.after)}` : bytes(f.after ?? f.before)}</span>
          </li>
        ))}
        {list.length > 30 && <li className="muted small">… et {list.length - 30} autres</li>}
      </ul>
    </div>
  );
}
