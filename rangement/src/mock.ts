// Faux backend en mémoire, utilisé seulement par `npm run dev:ui` dans un navigateur (hors de Tauri),
// pour voir tous les écrans. Aucun fichier n'est touché.
import type { ApplyReport, BatchView, Config, Plan, StateView } from "./api";

const D = "C:\\Users\\vous\\Downloads";
const B = "C:\\Users\\vous\\Desktop";

let config: Config = {
  watched: [D, B],
  rules: [
    { id: "images", name: "Images", enabled: true, extensions: ["jpg", "png"], namePattern: "", olderThanDays: null, minSize: null, maxSize: null, folders: [], target: "Images" },
    { id: "documents", name: "Documents", enabled: true, extensions: ["pdf", "docx"], namePattern: "", olderThanDays: null, minSize: null, maxSize: null, folders: [], target: "Documents" },
    { id: "installateurs", name: "Installateurs", enabled: true, extensions: ["exe", "msi"], namePattern: "", olderThanDays: 7, minSize: null, maxSize: null, folders: [D], target: "Installateurs" },
  ],
  duplicates: true,
  quarantineDir: "C:\\Users\\vous\\Documents\\Rayan's Rangement\\Quarantaine",
  ignoreRecentMinutes: 2,
  auto: { enabled: false, mode: "surveillance", intervalMinutes: 60 },
};

const plan: Plan = {
  id: "demo",
  createdMs: Date.now(),
  scanned: 9,
  items: [
    { id: 1, kind: "doublon", source: `${D}\\contrat (1).pdf`, destination: `${config.quarantineDir}\\2026-11-12\\contrat (1).pdf`, renamed: false, reason: `Doublon de « ${D}\\contrat.pdf »`, size: 182_000, modifiedMs: 0, duplicateOf: `${D}\\contrat.pdf` },
    { id: 2, kind: "ranger", source: `${D}\\contrat.pdf`, destination: `${D}\\Documents\\contrat.pdf`, renamed: false, reason: "Règle « Documents »", size: 182_000, modifiedMs: 0, duplicateOf: null },
    { id: 3, kind: "ranger", source: `${D}\\photo.jpg`, destination: `${D}\\Images\\photo (2).jpg`, renamed: true, reason: "Règle « Images »", size: 2_400_000, modifiedMs: 0, duplicateOf: null },
    { id: 4, kind: "ranger", source: `${B}\\capture.png`, destination: `${B}\\Images\\capture.png`, renamed: false, reason: "Règle « Images »", size: 310_000, modifiedMs: 0, duplicateOf: null },
    { id: 5, kind: "ranger", source: `${D}\\setup.exe`, destination: `${D}\\Installateurs\\setup.exe`, renamed: false, reason: "Règle « Installateurs »", size: 54_000_000, modifiedMs: 0, duplicateOf: null },
  ],
  skipped: [
    { path: `${D}\\rapport.docx`, reason: "en cours d'utilisation par un autre programme" },
    { path: `${D}\\film.mp4`, reason: "modifié il y a moins de 2 min (peut-être encore en cours d'écriture)" },
  ],
};

let history: BatchView[] = [];

export async function mockInvoke(cmd: string, args: Record<string, unknown> = {}): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 150));
  switch (cmd) {
    case "get_state":
      return { config, dataDir: "C:\\Users\\vous\\AppData\\Local\\Rayan's Rangement", version: "1.0.0", autoPlan: null, autoStatus: "Mode automatique désactivé" } satisfies StateView;
    case "save_config":
      config = args.config as Config;
      return config;
    case "rules_by_default":
      return config.rules;
    case "analyze":
      return { ...plan, id: "demo-" + Date.now() };
    case "apply": {
      const ids = args.ids as number[];
      const items = plan.items.filter((i) => ids.includes(i.id));
      history = [
        { id: "lot" + history.length, date: new Date().toLocaleString("fr-FR"), origin: "manuel", ops: items.map((i) => ({ op: i.id, kind: i.kind, reason: i.reason, from: i.source, to: i.destination, state: "fait", restoredTo: null })) },
        ...history,
      ];
      return { batch: history[0].id, moved: items.map((i) => ({ id: i.id, source: i.source, destination: i.destination, renamed: false })), failed: [] } satisfies ApplyReport;
    }
    case "history":
      return history;
    case "undo_batch": {
      const b = history.find((h) => h.id === args.batch)!;
      const ops = b.ops.filter((o) => o.state !== "annule" && (!args.ops || (args.ops as number[]).includes(o.op)));
      ops.forEach((o) => { o.state = "annule"; o.restoredTo = o.from; });
      return { restored: ops.map((o) => ({ id: o.op, source: o.to, destination: o.from, renamed: false })), failed: [] };
    }
    default:
      return null;
  }
}
