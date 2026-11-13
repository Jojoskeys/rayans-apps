// Faux backend pour concevoir l'interface dans un navigateur (`npm run dev:ui`).
// Il n'est jamais utilisé dans l'application Tauri. Scénario choisi par `?scenario=` :
// normal (défaut), vide, indisponible, horsligne, erreur, progression.
import type { AppView, BackupInfo, CoreEvent, Features, HistoryEvent, Profile, Snapshot, StorageReport, WorkshopReport } from "./api";

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
    updateRule: "ask",
    updateRuleCustom: false,
    lastExitCode: null,
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
    lastExitCode: 0,
  }),
  app({ id: "rayans-notes", name: "Rayan's Notes", description: "Prise de notes rapide, hors ligne, avec export Markdown.", availableVersion: "0.4.2" }),
  app({
    id: "rayans-pixel",
    name: "Rayan's Pixel",
    description: "Éditeur de sprites minimaliste.",
    availableVersion: "1.3.0",
    installedVersion: "1.3.0",
    previousVersion: "1.2.4",
    updateRule: "auto",
    updateRuleCustom: true,
    lastExitCode: -1073741819,
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

const profile: Profile = {
  personal: [
    { id: "p-vscode", name: "Visual Studio Code", kind: "program", target: "C:\\Program Files\\Microsoft VS Code\\Code.exe", args: "", addedAt: ago(200) },
    { id: "p-github", name: "GitHub", kind: "web", target: "https://github.com", args: "", addedAt: ago(150) },
    { id: "p-projets", name: "Projets", kind: "folder", target: "C:\\Users\\vous\\Documents\\Projets", args: "", addedAt: ago(90) },
  ],
  workspaces: [
    {
      id: "w-dev",
      name: "Dev",
      color: "#8b5cf6",
      items: [
        { kind: "personal", target: "p-vscode" },
        { kind: "personal", target: "p-github" },
        { kind: "folder", target: "C:\\Users\\vous\\Documents\\Projets" },
        { kind: "app", target: "rayans-chrono" },
      ],
    },
    { id: "w-jeu", name: "Jeu", color: "#f59e0b", items: [{ kind: "app", target: "rayans-pixel" }, { kind: "url", target: "https://lichess.org" }] },
  ],
  updates: { defaultRule: "ask", perApp: { "rayans-pixel": "auto" }, paused: false },
};

const ev = (h: number, kind: string, appId: string | null, p: Partial<HistoryEvent> = {}): HistoryEvent => ({
  at: ago(h), appId, kind, version: null, from: null, detail: null, code: null, seconds: null, ...p,
});
let history: HistoryEvent[] = [
  ev(0.3, "exit", "rayans-pixel", { version: "1.3.0", code: -1073741819, seconds: 2 }),
  ev(0.31, "launch", "rayans-pixel", { version: "1.3.0" }),
  ev(1.2, "auto-update", "rayans-pixel", { version: "1.3.0", from: "1.2.4" }),
  ev(1.21, "backup", "rayans-pixel", { detail: "avant mise à jour" }),
  ev(3, "exit", "rayans-chrono", { version: "1.0.0", code: 0, seconds: 1840 }),
  ev(3.6, "launch", "rayans-chrono", { version: "1.0.0" }),
  ev(5, "workspace", null, { detail: "espace « Dev » : 4 ouvert(s)" }),
  ev(26, "error", "rayans-chrono", { version: "2.0.0", detail: "mise à jour : Le fichier téléchargé ne correspond pas à l'empreinte SHA-256 du catalogue." }),
  ev(27, "launch", "p-vscode", { detail: "Visual Studio Code" }),
  ev(50, "install", "rayans-pixel", { version: "1.2.4" }),
  ev(52, "install", "rayans-chrono", { version: "1.0.0" }),
];

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
  profile,
};

function storage(): StorageReport {
  const apps = snap.apps.filter((a) => a.installedVersion).map((a, i) => {
    const items: StorageReport["apps"][number]["items"] = [
      { kind: "version-active", label: `Version active ${a.installedVersion}`, bytes: 48_000_000 + i * 9_000_000, files: 120, removable: false, path: `${snap.dataRoot}\\apps\\${a.id}` },
    ];
    if (a.previousVersion) items.push({ kind: "version-previous", label: `Version précédente ${a.previousVersion} (retour possible)`, bytes: 46_500_000, files: 118, removable: true, path: `${snap.dataRoot}\\apps\\${a.id}` });
    items.push({ kind: "data", label: "Données de l'application", bytes: 2_400_000 + i * 700_000, files: 12, removable: false, path: a.dataDir });
    const b = backups.get(a.id) ?? [];
    const auto = b.filter((x) => x.reason !== "manual");
    const man = b.filter((x) => x.reason === "manual");
    if (auto.length) items.push({ kind: "backups-auto", label: `Sauvegardes automatiques (${auto.length})`, bytes: auto.reduce((n, x) => n + x.size, 0), files: 6, removable: true, path: snap.dataRoot });
    if (man.length) items.push({ kind: "backups-manual", label: `Sauvegardes manuelles (${man.length})`, bytes: man.reduce((n, x) => n + x.size, 0), files: 3, removable: true, path: snap.dataRoot });
    if (a.partialBytes) items.push({ kind: "partial", label: "Téléchargement interrompu", bytes: a.partialBytes, files: 1, removable: true, path: snap.dataRoot });
    const total = items.reduce((n, x) => n + x.bytes, 0);
    return { id: a.id, name: a.name, total, reclaimable: items.filter((x) => x.removable).reduce((n, x) => n + x.bytes, 0), items };
  });
  apps.sort((a, b) => b.total - a.total);
  const total = apps.reduce((n, a) => n + a.total, 0) + 820_000;
  return { apps, images: 820_000, total, reclaimable: apps.reduce((n, a) => n + a.reclaimable, 0), root: snap.dataRoot };
}

const workshop: WorkshopReport = {
  zipName: "Rayans-Chrono-2.1.0-Windows-x64.zip",
  zipBytes: 1_520_000,
  files: 4,
  unpackedBytes: 3_900_000,
  manifest: { id: "rayans-chrono", name: "Rayan's Chrono", description: "Une petite horloge qui compte ses lancements.", version: "2.1.0", releaseNotes: "Corrige l'affichage des secondes.", executable: "RayansChrono.exe" },
  hasManifest: true,
  executables: ["RayansChrono.exe"],
  largest: [
    { path: "RayansChrono.exe", before: null, after: 2_600_000 },
    { path: "assets/sons.pak", before: null, after: 1_200_000 },
    { path: "rayans-launcher.json", before: null, after: 310 },
  ],
  checks: [
    { level: "ok", text: "Fiche complète." },
    { level: "ok", text: "Exécutable « RayansChrono.exe » présent." },
    { level: "ok", text: "Version 2.1.0 plus récente que la 1.0.0 installée." },
    { level: "warn", text: "1 fichier(s) de la version installée manquent dans ce ZIP : oubli ?" },
    { level: "warn", text: "Le paquet grossit de 62 % par rapport à la version installée." },
  ],
  comparison: {
    version: "1.0.0",
    filesBefore: 3,
    bytesBefore: 2_400_000,
    added: [{ path: "assets/sons.pak", before: null, after: 1_200_000 }],
    removed: [{ path: "LISEZMOI.txt", before: 1_200, after: null }],
    grown: [],
    changed: 1,
  },
  ready: true,
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

const shortcutOptions = [
  { id: "ctrl-alt-space", label: "Ctrl + Alt + Espace" },
  { id: "ctrl-shift-space", label: "Ctrl + Maj + Espace" },
  { id: "ctrl-alt-l", label: "Ctrl + Alt + L" },
  { id: "ctrl-shift-alt-space", label: "Ctrl + Maj + Alt + Espace" },
];
/** `?shortcutTaken` : Ctrl + Alt + Espace est déjà pris par un autre logiciel. */
let mockFeatures: Features = new URLSearchParams(location.search).has("shortcutTaken")
  ? { shortcuts: true, paletteShortcut: "Ctrl + Maj + Espace", paletteChoice: "auto", paletteTaken: ["Ctrl + Alt + Espace"], paletteOptions: shortcutOptions }
  : { shortcuts: true, paletteShortcut: "Ctrl + Alt + Espace", paletteChoice: "auto", paletteTaken: [], paletteOptions: shortcutOptions };

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
        return mockFeatures as T;
      case "set_palette_shortcut": {
        const choice = (args as { choice: string }).choice;
        const taken = new URLSearchParams(location.search).has("shortcutTaken") ? ["Ctrl + Alt + Espace"] : [];
        const pick = choice === "off" ? null : choice === "auto" ? mockFeatures.paletteOptions.find((o) => !taken.includes(o.label)) : mockFeatures.paletteOptions.find((o) => o.id === choice);
        if (pick && taken.includes(pick.label)) throw { code: "other", message: `${pick.label} est déjà pris par un autre logiciel. Choisissez-en un autre.`, hint: "" };
        mockFeatures = { ...mockFeatures, paletteChoice: choice, paletteShortcut: pick?.label ?? null, paletteTaken: choice === "auto" ? taken : [] };
        return mockFeatures as T;
      }
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
      case "get_history": {
        const a = args?.appId as string | null;
        return structuredClone(history.filter((e) => !a || e.appId === a).slice(0, Number(args?.limit ?? 400))) as T;
      }
      case "save_profile":
        snap = { ...snap, profile: args?.profile as Profile };
        snap.apps = snap.apps.map((a) => {
          const p = snap.profile.updates;
          return { ...a, updateRule: p.perApp[a.id] ?? p.defaultRule, updateRuleCustom: a.id in p.perApp };
        });
        emit();
        return undefined as T;
      case "launch_personal":
        history = [ev(0, "launch", id, { detail: snap.profile.personal.find((p) => p.id === id)?.name }), ...history];
        return undefined as T;
      case "launch_workspace": {
        await wait(400);
        const w = snap.profile.workspaces.find((x) => x.id === id)!;
        history = [ev(0, "workspace", null, { detail: `espace « ${w.name} » : ${w.items.length} ouvert(s)` }), ...history];
        return { opened: w.items.length, failures: [] } as T;
      }
      case "open_target":
      case "open_path":
        return undefined as T;
      case "storage_report":
        await wait(200);
        return storage() as T;
      case "clean_storage": {
        await wait(400);
        const kinds = args?.kinds as string[];
        const before = storage().apps.find((a) => a.id === id);
        const freed = before?.items.filter((i) => kinds.includes(i.kind)).reduce((n, i) => n + i.bytes, 0) ?? 0;
        if (kinds.includes("version-previous")) patch(id, { previousVersion: null });
        if (kinds.includes("backups-auto")) backups.set(id, (backups.get(id) ?? []).filter((b) => b.reason === "manual"));
        if (kinds.includes("backups-manual")) backups.set(id, (backups.get(id) ?? []).filter((b) => b.reason !== "manual"));
        if (kinds.includes("partial")) patch(id, { partialBytes: null });
        syncBackups(id);
        return freed as T;
      }
      case "workshop_analyze":
        await wait(500);
        return structuredClone(workshop) as T;
      case "export_profile":
        await wait(700);
        return 3_480_000 as T;
      case "read_import":
        await wait(300);
        return {
          format: 1,
          exportedAt: ago(48),
          catalogUrl: snap.catalogUrl,
          prefs: { theme: "ocean" },
          profile: snap.profile,
          apps: snap.apps.filter((a) => a.installedVersion).map((a) => ({ id: a.id, name: a.name, version: a.installedVersion! })).concat([{ id: "rayans-notes", name: "Rayan's Notes", version: "0.4.2" }]),
          data: ["rayans-chrono", "rayans-pixel"],
        } as T;
      case "import_profile": {
        await wait(800);
        const o = args?.options as { data: string[]; installMissing: boolean };
        if (o.installMissing) void fakeInstall("rayans-notes");
        return { prefs: null, toInstall: o.installMissing ? ["rayans-notes"] : [], restored: o.data, messages: [`Données restaurées : ${o.data.join(", ") || "aucune"}.`, "Profil importé : 3 logiciel(s) perso, 2 espace(s) de travail, règles de mise à jour."] } as T;
      }
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
