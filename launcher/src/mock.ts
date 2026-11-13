// Faux backend pour concevoir l'interface dans un navigateur (`npm run dev:ui`).
// Il n'est jamais utilisé dans l'application Tauri. Scénario choisi par `?scenario=` :
// normal (défaut), vide, indisponible, horsligne, erreur, progression.
import type { AppView, BackupInfo, CoreEvent, Snapshot } from "./api";

type Listener = (e: CoreEvent) => void;

const scenario = new URLSearchParams(location.search).get("scenario") ?? "normal";

function art(hue: number, label: string, wide: boolean): string {
  const [w, h] = wide ? [1280, 720] : [256, 256];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},55%,22%)"/>
  <stop offset="1" stop-color="hsl(${hue + 40},60%,10%)"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <circle cx="${w * 0.72}" cy="${h * 0.4}" r="${h * 0.32}" fill="none" stroke="hsl(${hue},80%,65%)" stroke-width="${wide ? 10 : 14}" opacity=".8"/>
  <text x="${w * 0.08}" y="${h * 0.8}" font-family="Segoe UI, sans-serif" font-weight="700" font-size="${wide ? 72 : 96}" fill="#fff" opacity=".9">${label}</text></svg>`;
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
}

function app(p: Partial<AppView> & { id: string; name: string }): AppView {
  return {
    description: "Application de démonstration.",
    releaseNotes: "Première version.",
    releaseDate: "2026-11-10",
    size: 1_400_000,
    availableVersion: "1.0.0",
    installedVersion: null,
    installedReleaseNotes: null,
    pendingVersion: null,
    inCatalog: true,
    updateAvailable: false,
    running: false,
    task: null,
    partialBytes: null,
    lastError: null,
    dataDir: `C:\\Users\\vous\\AppData\\Local\\fr.rayan.launcher\\data\\${p.id}`,
    previousVersion: null,
    heldVersion: null,
    backupCount: 0,
    lastBackupAt: null,
    ...p,
  };
}

const apps: AppView[] = [
  app({
    id: "rayans-chrono",
    name: "Rayan's Chrono",
    description: "Une petite horloge qui compte ses lancements. Elle sert à tester Rayan's Launcher de bout en bout.",
    availableVersion: "2.0.0",
    installedVersion: "1.0.0",
    updateAvailable: true,
    releaseNotes: "Les secondes sont affichées.\nLe compteur de lancements est conservé pendant la mise à jour.",
    installedReleaseNotes: "Première version.",
  }),
  app({ id: "rayans-notes", name: "Rayan's Notes", description: "Prise de notes rapide, hors ligne, avec export Markdown.", availableVersion: "0.4.2" }),
  app({
    id: "rayans-pixel",
    name: "Rayan's Pixel",
    description: "Éditeur de sprites minimaliste.",
    availableVersion: "1.3.0",
    installedVersion: "1.3.0",
    previousVersion: "1.2.4",
  }),
];

const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const stampId = (iso: string) => iso.replace(/\D/g, "").slice(0, 17) + "-" + Math.random().toString(16).slice(2, 6);
const backups = new Map<string, BackupInfo[]>([
  [
    "rayans-chrono",
    [
      { id: stampId(ago(2)), appId: "rayans-chrono", version: "1.0.0", createdAt: ago(2), reason: "manual", size: 48_200, files: 3 },
      { id: stampId(ago(30)), appId: "rayans-chrono", version: "1.0.0", createdAt: ago(30), reason: "restore", size: 41_000, files: 3 },
    ],
  ],
  ["rayans-pixel", [{ id: stampId(ago(5)), appId: "rayans-pixel", version: "1.2.4", createdAt: ago(5), reason: "update", size: 2_380_000, files: 41 }]],
]);
const syncBackups = (id: string) => {
  const list = backups.get(id) ?? [];
  const a = snap.apps.find((x) => x.id === id);
  if (a) patch(id, { backupCount: list.length, lastBackupAt: list[0]?.createdAt ?? null });
};
const addBackup = (id: string, reason: BackupInfo["reason"]) => {
  const a = snap.apps.find((x) => x.id === id)!;
  const now = new Date().toISOString();
  const b: BackupInfo = { id: stampId(now), appId: id, version: a.installedVersion, createdAt: now, reason, size: 50_000 + Math.round(Math.random() * 9000), files: 3 };
  backups.set(id, [b, ...(backups.get(id) ?? [])]);
  syncBackups(id);
  return b;
};

let snap: Snapshot = {
  mode: "development",
  publicKeyConfigured: false,
  catalogUrl: "http://127.0.0.1:8787/catalog.json",
  dataRoot: "C:\\Users\\vous\\AppData\\Local\\fr.rayan.launcher",
  catalog: {
    status: "ready",
    title: "Le catalogue de Rayan",
    sourceUrl: "http://127.0.0.1:8787/catalog.json",
    fetchedAt: new Date().toISOString(),
    fromCache: false,
    trust: "unsigned",
    refreshing: false,
    error: null,
    warning: "Mode développement : catalogue non signé accepté.",
    appCount: apps.length,
  },
  apps,
  localCatalogPath: "C:\\Users\\vous\\Documents\\Rayan's Launcher\\catalog.json",
  notices: scenario === "ajout" ? ["Analyse-Echecs-1.0.0-Windows-x64.zip ajouté au catalogue (analyse-echecs 1.0.0)."] : [],
};

const netError = {
  code: "network",
  message: "Le catalogue est injoignable : error sending request for url (http://127.0.0.1:8787/catalog.json)",
  hint: "Vérifiez votre connexion et l'adresse du catalogue dans les paramètres, puis réessayez.",
};

if (scenario === "vide") snap.apps = [];
if (scenario === "vide") snap.catalog.appCount = 0;
if (scenario === "indisponible") {
  snap.apps = [];
  snap.catalog = { ...snap.catalog, status: "none", title: null, fetchedAt: null, trust: null, warning: null, error: netError, appCount: 0 };
}
if (scenario === "horsligne") {
  snap.catalog = { ...snap.catalog, fromCache: true, error: netError };
}
if (scenario === "erreur") {
  snap.apps[0] = {
    ...snap.apps[0],
    lastError: {
      code: "integrity",
      message:
        "Le fichier téléchargé ne correspond pas à l'empreinte SHA-256 du catalogue (attendue 3f2a…, obtenue 91bc…). Il est peut-être corrompu ou a été remplacé.",
      hint: "Republiez le ZIP ou corrigez son empreinte sha256 dans le catalogue. La version installée reste utilisable.",
    },
  };
}
if (scenario === "progression") {
  snap.apps[0] = { ...snap.apps[0], task: { kind: "update", phase: "downloading", received: 840_000, total: 1_400_000 } };
  snap.apps[1] = { ...snap.apps[1], task: { kind: "install", phase: "extracting", received: 0, total: null } };
}

for (const a of apps) {
  const list = backups.get(a.id) ?? [];
  a.backupCount = list.length;
  a.lastBackupAt = list[0]?.createdAt ?? null;
}

const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l({ type: "changed" }));
const patch = (id: string, p: Partial<AppView>) => {
  snap = { ...snap, apps: snap.apps.map((a) => (a.id === id ? { ...a, ...p } : a)) };
  emit();
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cancels = new Map<string, () => void>();

async function fakeInstall(id: string) {
  const a = snap.apps.find((x) => x.id === id)!;
  const kind = a.installedVersion ? "update" : "install";
  const total = a.size ?? 1_000_000;
  const cancelled = new Set<string>();
  cancels.set(id, () => cancelled.add(id));
  for (let r = a.partialBytes ?? 0; r <= total; r += total / 40) {
    if (cancelled.has(id)) return;
    patch(id, { task: { kind, phase: "downloading", received: r, total }, lastError: null, partialBytes: null });
    await wait(120);
  }
  cancels.delete(id);
  for (const phase of ["verifying", "extracting", "finalizing"] as const) {
    patch(id, { task: { kind, phase, received: 0, total: null } });
    await wait(300);
  }
  if (a.installedVersion && (backups.get(id)?.length || a.backupCount)) addBackup(id, "update");
  patch(id, { task: null, installedVersion: a.availableVersion, previousVersion: a.installedVersion ?? a.previousVersion, heldVersion: null, updateAvailable: false, installedReleaseNotes: a.releaseNotes });
}

const busyError = { code: "running", message: "L'application est ouverte. Fermez-la d'abord.", hint: "Fermez l'application puis réessayez." };

export const mockBackend = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  async invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const id = args?.id as string;
    switch (cmd) {
      case "get_snapshot":
        return structuredClone(snap) as T;
      case "refresh_catalog":
        snap = { ...snap, catalog: { ...snap.catalog, refreshing: true } };
        emit();
        await wait(500);
        snap = { ...snap, catalog: { ...snap.catalog, refreshing: false } };
        emit();
        if (snap.catalog.error) throw snap.catalog.error;
        return undefined as T;
      case "set_catalog_url":
        snap = { ...snap, catalogUrl: String(args?.url) };
        emit();
        return undefined as T;
      case "install":
        void fakeInstall(id);
        return undefined as T;
      case "launch":
        patch(id, { running: true });
        setTimeout(() => patch(id, { running: false }), 2500);
        return 4242 as T;
      case "uninstall":
        patch(id, { installedVersion: null, updateAvailable: false });
        return undefined as T;
      case "inspect_zip":
        await wait(300);
        return {
          entry: { id: "analyse-echecs", name: "Rayan's Échecs", description: "Analyse de parties d'échecs avec un moteur intégré.", version: "1.0.0", releaseNotes: "Version 1.0.0.", executable: "Analyse Echecs.exe" },
          executables: ["Analyse Echecs.exe"],
          source: "modèle",
          existingVersion: null,
          complete: true,
        } as T;
      case "add_zip":
        await wait(600);
        return (args?.entry as { id: string }).id as T;
      case "cancel_download": {
        const t = snap.apps.find((x) => x.id === id)?.task;
        cancels.get(id)?.();
        patch(id, { task: null, partialBytes: t?.received || 512_000 });
        return true as T;
      }
      case "discard_download":
        patch(id, { partialBytes: null });
        return undefined as T;
      case "open_folder":
        return undefined as T;
      case "features":
        return { shortcuts: true, paletteShortcut: "Ctrl + Alt + Espace" } as T;
      case "create_shortcut":
        return "C:\\Users\\vous\\Desktop\\app.lnk" as T;
      case "launcher_update":
        return (scenario === "ajout" ? { version: "0.1.57", file: "Rayans-Launcher-mise-a-jour.zip", fromCatalog: false } : null) as T;
      case "apply_launcher_update":
        throw { code: "other", message: "Aperçu navigateur : la mise à jour du launcher n'est disponible que sous Windows.", hint: "" };
      case "dismiss_notices":
        snap = { ...snap, notices: [] };
        emit();
        return undefined as T;
      case "minimize_window":
        return undefined as T;
      case "list_backups":
        await wait(150);
        return structuredClone(backups.get(id) ?? []) as T;
      case "backup_app":
        await wait(500);
        return addBackup(id, "manual") as T;
      case "restore_backup": {
        if (snap.apps.find((x) => x.id === id)?.running) throw busyError;
        await wait(500);
        addBackup(id, "restore");
        return undefined as T;
      }
      case "delete_backup":
        backups.set(id, (backups.get(id) ?? []).filter((b) => b.id !== args?.backupId));
        syncBackups(id);
        return undefined as T;
      case "rollback": {
        const a = snap.apps.find((x) => x.id === id)!;
        if (a.running) throw busyError;
        await wait(600);
        if (args?.restore) addBackup(id, "rollback");
        patch(id, { installedVersion: a.previousVersion, previousVersion: a.installedVersion, heldVersion: a.installedVersion, updateAvailable: false, lastError: null });
        return undefined as T;
      }
      case "set_hold": {
        const a = snap.apps.find((x) => x.id === id)!;
        const v = a.availableVersion ?? a.installedVersion;
        const newer = (x: string | null, y: string | null) => !!x && !!y && x.localeCompare(y, undefined, { numeric: true }) > 0;
        patch(id, args?.hold ? { heldVersion: v, updateAvailable: false } : { heldVersion: null, updateAvailable: newer(a.availableVersion, a.installedVersion) });
        return undefined as T;
      }
      case "open_backups_folder":
        return undefined as T;
      case "dismiss_error":
        patch(id, { lastError: null });
        return undefined as T;
      case "get_image": {
        const i = snap.apps.findIndex((a) => a.id === id);
        const a = snap.apps[i];
        return (a ? art(30 + i * 95, a.name.split(" ")[0], args?.kind === "image") : null) as T;
      }
    }
    throw new Error(`commande simulée inconnue : ${cmd}`);
  },
};
