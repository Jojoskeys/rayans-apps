import { useEffect, useState, type ReactNode } from "react";
import { COLORS, KIND_LABELS, chronoName, itemLabel, normalizeUrl, relativeDay, type AppData, type Item, type ItemKind, type Workspace } from "../core/model.ts";
import type { InitialState, LaunchReport } from "./api-types.ts";

const api = window.bosse;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const errText = (e: unknown) => String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

export function App() {
  const [s, setS] = useState<InitialState | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [report, setReport] = useState<LaunchReport | null>(null);

  useEffect(() => {
    api.getState().then((v) => { setS(v); setSel(v.data.workspaces[0]?.id ?? null); if (v.warning) setToast(v.warning); });
    const off1 = api.onState(setS);
    const off2 = api.onMessage(setToast);
    const refresh = () => api.getState().then(setS);
    window.addEventListener("focus", refresh);
    return () => { off1(); off2(); window.removeEventListener("focus", refresh); };
  }, []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 8000); return () => clearTimeout(id); }, [toast]);
  if (!s) return <div className="chargement">Chargement…</div>;

  const save = (d: AppData) => { setS({ ...s, data: d }); void api.save(d); };
  const update = (id: string, patch: Partial<Workspace>) => save({ ...s.data, workspaces: s.data.workspaces.map((w) => (w.id === id ? { ...w, ...patch } : w)) });
  const ws = s.data.workspaces.find((w) => w.id === sel) ?? null;

  const create = () => {
    const used = new Set(s.data.workspaces.map((w) => w.color));
    let n = 1;
    while (s.data.workspaces.some((w) => w.name === (n === 1 ? "Nouveau projet" : `Nouveau projet ${n}`))) n++;
    const w: Workspace = {
      id: uid(), name: n === 1 ? "Nouveau projet" : `Nouveau projet ${n}`, color: COLORS.find((c) => !used.has(c)) ?? COLORS[0],
      items: [], chrono: true, chronoProject: "", powertoys: null, lastOpened: null, createdAt: Date.now(),
    };
    save({ ...s.data, workspaces: [...s.data.workspaces, w] });
    setSel(w.id);
    setReport(null);
  };

  return (
    <div className="app">
      <nav className="navigation-principale">
        <div className="marque"><img src="../../assets/icon.png" alt="" width={28} height={28} /><span>Rayan's Bosse</span></div>
        <div className="espaces" data-testid="espaces">
          {s.data.workspaces.map((w) => (
            <button key={w.id} className={w.id === sel ? "actif" : ""} onClick={() => { setSel(w.id); setReport(null); }}>
              <i className="couleur" style={{ background: w.color }} /><span>{w.name}</span>
            </button>
          ))}
        </div>
        <button className="nouveau" data-testid="nouvel-espace" onClick={create}><IconPlus /><span>Nouvel espace</span></button>
        <div className="espace" />
        <label className="case petite"><input type="checkbox" checked={s.data.settings.hideAfterLaunch} onChange={(e) => save({ ...s.data, settings: { ...s.data.settings, hideAfterLaunch: e.target.checked } })} />
          <span>Réduire cette fenêtre après l'ouverture</span></label>
        <p className="version">Version {s.version} · <button className="lien" onClick={() => api.openDataDir()}>données</button></p>
      </nav>
      <main className="contenu">
        {ws ? (
          <Editeur key={ws.id} s={s} w={ws} update={(p) => update(ws.id, p)} report={report} setReport={setReport} notify={setToast}
            remove={() => {
              if (!confirm(`Supprimer l'espace « ${ws.name} » ? Les fichiers et dossiers ne sont pas touchés.`)) return;
              const rest = s.data.workspaces.filter((w) => w.id !== ws.id);
              save({ ...s.data, workspaces: rest });
              setSel(rest[0]?.id ?? null);
            }} />
        ) : (
          <section className="vide">
            <h1>Un espace de travail par projet</h1>
            <p className="aide">Rassemblez les applications, dossiers, fichiers et sites d'un projet, puis ouvrez tout en un clic. Rayan's Chrono démarre en même temps sur ce projet.</p>
            <p className="aide">Depuis la barre de Rayan's Outils (<kbd>Ctrl + Alt + Espace</kbd>), tapez <code>bosse</code> suivi du nom de l'espace.</p>
            <button className="bouton" onClick={create}><IconPlus /> Créer un espace</button>
          </section>
        )}
      </main>
      {toast && <div className="toast" role="status"><span>{toast}</span><button className="icone" onClick={() => setToast(null)} title="Fermer"><IconClose /></button></div>}
    </div>
  );
}

function Editeur({ s, w, update, remove, report, setReport, notify }: {
  s: InitialState; w: Workspace; update: (p: Partial<Workspace>) => void; remove: () => void;
  report: LaunchReport | null; setReport: (r: LaunchReport | null) => void; notify: (t: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [over, setOver] = useState(false);
  const names = Object.fromEntries(s.apps.map((a) => [a.id, a.name]));
  const add = (items: Omit<Item, "id" | "label" | "args">[]) => {
    const fresh = items.filter((i) => !w.items.some((x) => x.kind === i.kind && x.target.toLowerCase() === i.target.toLowerCase()));
    if (fresh.length) update({ items: [...w.items, ...fresh.map((i) => ({ ...i, id: uid(), label: "", args: "" }))] });
  };
  const setItem = (id: string, p: Partial<Item>) => update({ items: w.items.map((i) => (i.id === id ? { ...i, ...p } : i)) });
  const move = (i: number, d: number) => { const c = [...w.items]; [c[i], c[i + d]] = [c[i + d], c[i]]; update({ items: c }); };
  const addUrl = () => {
    const u = normalizeUrl(url);
    if (!u) { notify("Adresse invalide : tapez par exemple github.com ou https://exemple.fr/page"); return; }
    add([{ kind: "url", target: u }]);
    setUrl("");
  };
  const empty = !w.items.length && !w.chrono && !w.powertoys;

  return (
    <section className="editeur">
      <header className="entete">
        <i className="couleur grande" style={{ background: w.color }} />
        <input className="titre" data-testid="nom-espace" value={w.name} maxLength={80} onChange={(e) => update({ name: e.target.value })} onBlur={(e) => { if (!e.target.value.trim()) update({ name: "Sans nom" }); }} aria-label="Nom de l'espace" />
        <button className="bouton grand" data-testid="ouvrir-espace" disabled={busy || empty} onClick={async () => {
          setBusy(true);
          try { setReport(await api.openWorkspace(w.id)); } catch (e) { notify(errText(e)); } finally { setBusy(false); }
        }}><IconPlay /> {busy ? "Ouverture…" : "Ouvrir l'espace"}</button>
      </header>
      <p className="aide">{relativeDay(w.lastOpened, Date.now())} · barre de Rayan's Outils : <code>bosse {w.name.split(/\s+/)[0]?.toLowerCase()}</code></p>

      {report && (
        <div className={`resultat ${report.results.every((r) => r.ok) ? "" : "attention"}`} data-testid="rapport">
          <b>{report.results.every((r) => r.ok) ? `« ${report.name} » est ouvert.` : `« ${report.name} » : certains éléments n'ont pas pu être ouverts.`}</b>
          <ul>{report.results.map((r, i) => <li key={i} className={r.ok ? "ok" : "ko"}>{r.ok ? <IconCheck /> : <IconClose />} {r.label}{r.error ? ` : ${r.error}` : ""}</li>)}</ul>
        </div>
      )}

      <div className="carte">
        <div className="entete-carte"><h2>À ouvrir</h2><span className="aide">dans cet ordre</span></div>
        {w.items.length > 0 ? (
          <ol className="elements" data-testid="elements">
            {w.items.map((it, i) => (
              <li key={it.id}>
                <span className={`type type-${it.kind}`} title={KIND_LABELS[it.kind]}>{KIND_ICON[it.kind]}</span>
                <div className="element">
                  <input value={it.label} placeholder={itemLabel(it, names)} onChange={(e) => setItem(it.id, { label: e.target.value })} aria-label="Nom affiché" />
                  <small title={it.target}>{it.kind === "rayan" ? `${KIND_LABELS.rayan} · ${names[it.target] ?? `${it.target} (non installée)`}` : it.target}</small>
                  {it.kind === "app" && /\.exe$/i.test(it.target) && (
                    <input className="args" value={it.args} placeholder="Arguments (facultatif)" onChange={(e) => setItem(it.id, { args: e.target.value })} />
                  )}
                </div>
                <button className="icone" title="Ouvrir seulement celui-ci" onClick={() => api.testItem(it).catch((e) => notify(`${itemLabel(it, names)} : ${errText(e)}`))}><IconPlay size={15} /></button>
                <button className="icone" disabled={i === 0} onClick={() => move(i, -1)} title="Monter"><IconUp /></button>
                <button className="icone" disabled={i === w.items.length - 1} onClick={() => move(i, 1)} title="Descendre"><IconDown /></button>
                <button className="icone" onClick={() => update({ items: w.items.filter((x) => x.id !== it.id) })} title="Retirer"><IconClose /></button>
              </li>
            ))}
          </ol>
        ) : <p className="aide">Rien pour l'instant. Ajoutez des dossiers, des fichiers, des programmes ou des sites, ou déposez-les ici.</p>}

        <div className={`depot ${over ? "survol" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={async (e) => {
            e.preventDefault(); setOver(false);
            const paths = [...e.dataTransfer.files].map((f) => api.pathOf(f)).filter(Boolean);
            if (paths.length) add((await api.inspect(paths)).map((p) => ({ kind: p.kind, target: p.path })));
            else {
              const u = normalizeUrl(e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain"));
              if (u) add([{ kind: "url", target: u }]);
            }
          }}>
          Déposez ici des dossiers, fichiers, programmes ou liens
        </div>
        <div className="ajouts">
          <button className="bouton secondaire" onClick={async () => add((await api.pick("dossier")).map((p) => ({ kind: "dossier" as const, target: p })))}><IconFolder /> Dossier</button>
          <button className="bouton secondaire" onClick={async () => add((await api.pick("fichier")).map((p) => ({ kind: "fichier" as const, target: p })))}><IconFile /> Fichier</button>
          <button className="bouton secondaire" onClick={async () => add((await api.pick("app")).map((p) => ({ kind: "app" as const, target: p })))}><IconApp /> Programme</button>
          {s.apps.length > 0 && (
            <select value="" onChange={(e) => { if (e.target.value) add([{ kind: "rayan", target: e.target.value }]); }} aria-label="Ajouter une app de Rayan">
              <option value="">App de Rayan…</option>
              {s.apps.filter((a) => a.id !== "rayans-bosse").map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <span className="champ-url">
            <input value={url} data-testid="champ-url" placeholder="Site : github.com/…" onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addUrl(); }} />
            <button className="bouton secondaire" data-testid="ajouter-url" disabled={!url.trim()} onClick={addUrl}><IconGlobe /> Ajouter</button>
          </span>
        </div>
      </div>

      <div className="deux">
        <div className="carte pile">
          <label className="case"><input type="checkbox" data-testid="chrono" checked={w.chrono} onChange={(e) => update({ chrono: e.target.checked })} />
            <span>Démarrer Rayan's Chrono<small>Le minuteur démarre sur ce projet (créé dans Chrono s'il n'existe pas).</small></span></label>
          {w.chrono && (
            <label className="champ">Projet dans Chrono
              <input value={w.chronoProject} placeholder={w.name} maxLength={80} onChange={(e) => update({ chronoProject: e.target.value })} />
            </label>
          )}
          {w.chrono && !s.chronoInstalled && <p className="erreur">Rayan's Chrono n'est pas installé dans Rayan's Launcher.</p>}
          {w.chrono && s.chronoInstalled && <p className="aide">Projet : <b>{chronoName(w)}</b></p>}
        </div>
        <div className="carte pile">
          <h2>PowerToys Workspaces</h2>
          {s.powertoys.installed ? (
            s.powertoys.workspaces.length ? (
              <label className="champ">Espace PowerToys à lancer aussi (place les fenêtres)
                <select value={w.powertoys ?? ""} onChange={(e) => update({ powertoys: e.target.value || null })}>
                  <option value="">Aucun</option>
                  {s.powertoys.workspaces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  {w.powertoys && !s.powertoys.workspaces.some((p) => p.id === w.powertoys) && <option value={w.powertoys}>(espace supprimé)</option>}
                </select>
              </label>
            ) : <p className="aide">Aucun espace PowerToys. Créez-en un dans PowerToys (Win + Ctrl + `), il apparaîtra ici.</p>
          ) : <p className="aide">Facultatif : avec PowerToys installé, un espace PowerToys Workspaces peut être lancé en même temps pour placer les fenêtres.</p>}
        </div>
      </div>

      <div className="carte pile">
        <h2>Apparence</h2>
        <div className="couleurs">
          {COLORS.map((c) => <button key={c} className={`pastille-couleur ${c === w.color ? "active" : ""}`} style={{ background: c }} onClick={() => update({ color: c })} title={c} />)}
        </div>
        <button className="lien danger" onClick={remove}>Supprimer cet espace</button>
      </div>
    </section>
  );
}

const Svg = ({ children, size = 18 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
type P = { size?: number };
const IconPlus = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
const IconPlay = (p: P) => <Svg {...p}><path d="M7 4l13 8-13 8z" /></Svg>;
const IconClose = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
const IconCheck = (p: P) => <Svg {...p}><path d="M5 12l5 5 9-10" /></Svg>;
const IconUp = (p: P) => <Svg {...p}><path d="M6 15l6-6 6 6" /></Svg>;
const IconDown = (p: P) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>;
const IconFolder = (p: P) => <Svg {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Svg>;
const IconFile = (p: P) => <Svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></Svg>;
const IconApp = (p: P) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M7 6.5h.01" /></Svg>;
const IconGlobe = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></Svg>;
const IconStar = (p: P) => <Svg {...p}><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></Svg>;
const KIND_ICON: Record<ItemKind, ReactNode> = { app: <IconApp />, rayan: <IconStar />, dossier: <IconFolder />, fichier: <IconFile />, url: <IconGlobe /> };
