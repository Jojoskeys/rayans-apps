// Palette de commandes : Ctrl + K dans le launcher, Ctrl + Alt + Espace depuis n'importe quelle application.
// Une ligne de recherche, et toutes les actions utiles sur les applications au clavier.
import { useEffect, useMemo, useRef, useState } from "react";
import { api, toErrorInfo, type AppView, type ErrorInfo, type Snapshot } from "./api";
import { AppIcon, Icon } from "./components";
import { bytes } from "./format";

export type PaletteNav = "catalog" | "installed" | "workspaces" | "history" | "storage" | "workshop" | "settings";

export interface PaletteHandlers {
  openApp: (id: string, section?: "versions" | "backups") => void;
  navigate: (p: PaletteNav) => void;
  refresh: () => void;
  toast: (s: string) => void;
}

interface Command {
  key: string;
  title: string;
  hint?: string;
  /** Mots supplémentaires pour la recherche. */
  words?: string;
  app?: AppView;
  icon?: string;
  /** Une action qui ouvre une application : la fenêtre se range après, si la palette a été ouverte de l'extérieur. */
  launches?: boolean;
  run: () => Promise<unknown> | void;
}

/** Minuscules, sans accents ni apostrophes typographiques. */
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'").toLowerCase();

/** Tous les mots tapés doivent se retrouver ; les débuts de mots du titre comptent davantage. */
function score(c: Command, q: string[]): number {
  if (q.length === 0) return 1;
  const title = norm(c.title);
  const hay = `${title} ${norm(c.app?.name ?? "")} ${norm(c.words ?? "")} ${norm(c.hint ?? "")}`;
  let s = 0;
  for (const w of q) {
    const i = hay.indexOf(w);
    if (i < 0) return 0;
    s += i === 0 ? 6 : title.includes(" " + w) || title.startsWith(w) ? 4 : title.includes(w) ? 2 : 1;
  }
  return s;
}

function commands(snap: Snapshot, h: PaletteHandlers): Command[] {
  const out: Command[] = [];
  const act = (f: () => Promise<unknown>, ok?: string) => async () => {
    await f();
    if (ok) h.toast(ok);
  };
  for (const a of snap.apps) {
    const base = { app: a };
    if (a.installedVersion) {
      out.push({
        ...base,
        key: `launch:${a.id}`,
        title: `Lancer ${a.name}`,
        hint: a.running ? "déjà ouverte" : `version ${a.installedVersion}`,
        words: "ouvrir demarrer jouer",
        icon: "play",
        launches: true,
        run: act(() => api.launch(a.id)),
      });
    }
    if (a.task?.phase === "downloading") {
      out.push({ ...base, key: `cancel:${a.id}`, title: `Mettre en pause le téléchargement de ${a.name}`, icon: "close", run: act(() => api.cancelDownload(a.id)) });
    } else if (!a.task && a.partialBytes && a.inCatalog && (a.updateAvailable || !a.installedVersion)) {
      out.push({ ...base, key: `resume:${a.id}`, title: `Reprendre le téléchargement de ${a.name}`, hint: `${bytes(a.partialBytes)} déjà reçus`, words: "continuer", icon: "download", run: act(() => api.install(a.id)) });
    } else if (!a.task && a.updateAvailable) {
      out.push({ ...base, key: `update:${a.id}`, title: `Mettre à jour ${a.name}`, hint: `${a.installedVersion} → ${a.availableVersion}`, words: "maj nouvelle version", icon: "update", run: act(() => api.install(a.id)) });
    } else if (!a.task && !a.installedVersion && a.inCatalog) {
      out.push({ ...base, key: `install:${a.id}`, title: `Installer ${a.name}`, hint: a.availableVersion ? `version ${a.availableVersion}` : undefined, words: "telecharger", icon: "download", run: act(() => api.install(a.id)) });
    }
    out.push({ ...base, key: `open:${a.id}`, title: `Fiche de ${a.name}`, hint: "notes de version, dossiers, versions", words: "details notes nouveautes changelog", icon: "catalog", run: () => h.openApp(a.id) });
    if (a.installedVersion) {
      out.push({ ...base, key: `data:${a.id}`, title: `Ouvrir le dossier de données de ${a.name}`, words: "explorateur fichiers donnees", icon: "box", run: act(() => api.openFolder(a.id, "data")) });
      out.push({ ...base, key: `folder:${a.id}`, title: `Ouvrir le dossier de l'application ${a.name}`, words: "explorateur fichiers installation", icon: "box", run: act(() => api.openFolder(a.id, "install")) });
      out.push({
        ...base,
        key: `backup:${a.id}`,
        title: `Sauvegarder les données de ${a.name}`,
        hint: a.backupCount ? `${a.backupCount} sauvegarde${a.backupCount > 1 ? "s" : ""}` : undefined,
        words: "copie securite",
        icon: "shield",
        run: act(() => api.backup(a.id), `Données de ${a.name} sauvegardées.`),
      });
      if (a.backupCount > 0) {
        out.push({ ...base, key: `restore:${a.id}`, title: `Restaurer une sauvegarde de ${a.name}`, words: "recuperer donnees", icon: "refresh", run: () => h.openApp(a.id, "backups") });
      }
      if (a.previousVersion && !a.task) {
        out.push({ ...base, key: `rollback:${a.id}`, title: `Revenir à ${a.name} ${a.previousVersion}`, hint: `au lieu de la ${a.installedVersion}`, words: "retour version precedente annuler mise a jour", icon: "back", run: () => h.openApp(a.id, "versions") });
      }
    }
  }
  for (const w of snap.profile.workspaces) {
    out.push({
      key: `ws:${w.id}`,
      title: `Ouvrir l'espace ${w.name}`,
      hint: `${w.items.length} élément${w.items.length > 1 ? "s" : ""}`,
      words: "espace travail workspace tout ouvrir",
      icon: "layers",
      launches: true,
      run: async () => {
        const r = await api.launchWorkspace(w.id);
        if (r.failures.length) throw { code: "other", message: r.failures.join(" ; "), hint: `${r.opened} élément(s) ouvert(s).` };
        h.toast(`Espace « ${w.name} » ouvert.`);
      },
    });
  }
  for (const p of snap.profile.personal) {
    out.push({
      key: `perso:${p.id}`,
      title: `${p.kind === "program" ? "Lancer" : "Ouvrir"} ${p.name}`,
      hint: p.kind === "web" ? p.target.replace(/^https?:\/\//, "") : "ajouté à la main",
      words: "logiciel perso",
      icon: p.kind === "web" ? "globe" : p.kind === "folder" ? "folder" : "play",
      launches: true,
      run: () => api.launchPersonal(p.id),
    });
  }
  out.push(
    { key: "nav:workspaces", title: "Gérer les espaces de travail", icon: "layers", run: () => h.navigate("workspaces") },
    { key: "nav:history", title: "Historique et diagnostic", words: "journal erreurs code sortie chronologie", icon: "history", run: () => h.navigate("history") },
    { key: "nav:storage", title: "Centre de stockage", words: "espace disque nettoyer place", icon: "disk", run: () => h.navigate("storage") },
    { key: "nav:workshop", title: "Atelier de publication", words: "zip publier verifier ci", icon: "tool", run: () => h.navigate("workshop") },
    { key: "nav:catalog", title: "Aller au catalogue", icon: "catalog", run: () => h.navigate("catalog") },
    { key: "nav:installed", title: "Aller aux applications installées", icon: "installed", run: () => h.navigate("installed") },
    { key: "nav:settings", title: "Ouvrir les paramètres", words: "personnalisation theme adresse export import migration regles mises a jour", icon: "settings", run: () => h.navigate("settings") },
    { key: "refresh", title: "Actualiser le catalogue", words: "recharger", icon: "refresh", run: () => h.refresh() },
  );
  return out;
}

export function Palette({ snap, external, onClose, handlers }: { snap: Snapshot; external: boolean; onClose: () => void; handlers: PaletteHandlers }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [err, setErr] = useState<ErrorInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const all = useMemo(() => commands(snap, handlers), [snap, handlers]);
  const shown = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    return all
      .map((c, i) => ({ c, s: score(c, words), i }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .slice(0, 40)
      .map((x) => x.c);
  }, [all, q]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const run = async (c: Command | undefined) => {
    if (!c || busy) return;
    setErr(null);
    setBusy(true);
    try {
      await c.run();
      onClose();
      if (c.launches && external) void api.minimizeWindow().catch(() => {});
    } catch (e) {
      setErr(toErrorInfo(e));
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      void run(shown[sel]);
    }
  };

  return (
    <div className="palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Palette de commandes" onKeyDown={onKey}>
        <div className="palette-search">
          <Icon name="search" size={18} />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Lancer, installer, sauvegarder, ouvrir un dossier…"
            spellCheck={false}
            aria-label="Rechercher une commande"
            aria-controls="palette-list"
            aria-activedescendant={shown[sel] ? `pc-${sel}` : undefined}
          />
          <kbd>Échap</kbd>
        </div>
        {err && (
          <div className="palette-error" role="alert">
            <Icon name="alert" size={16} />
            <span><b>{err.message}</b> {err.hint}</span>
          </div>
        )}
        <ul className="palette-list" id="palette-list" role="listbox" ref={list}>
          {shown.length === 0 && <li className="palette-empty">Aucune commande ne correspond à « {q} ».</li>}
          {shown.map((c, i) => (
            <li
              key={c.key}
              id={`pc-${i}`}
              data-i={i}
              role="option"
              aria-selected={i === sel}
              className={i === sel ? "on" : ""}
              onMouseMove={() => setSel(i)}
              onClick={() => void run(c)}
            >
              <span className="palette-icon">{c.app ? <AppIcon app={c.app} refresh={snap.catalog.fetchedAt} size={28} /> : <Icon name={c.icon ?? "catalog"} size={16} />}</span>
              <span className="palette-title">{c.title}</span>
              {c.hint && <span className="palette-hint">{c.hint}</span>}
              {c.app && c.icon && <span className="palette-kind"><Icon name={c.icon} size={14} /></span>}
            </li>
          ))}
        </ul>
        <div className="palette-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> choisir</span>
          <span><kbd>Entrée</kbd> exécuter</span>
          <span className="grow" />
          <span className="muted">{busy ? "En cours…" : `${shown.length} commande${shown.length > 1 ? "s" : ""}`}</span>
        </div>
      </div>
    </div>
  );
}
