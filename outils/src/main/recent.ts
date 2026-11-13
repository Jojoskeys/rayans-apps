// Fichiers récemment créés dans les dossiers où l'on range (ou pas) ce qu'on reçoit.
import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { ignoredFile, latest, type RecentFile } from "../core/suivi.ts";

export interface RecentRoot { label: string; path: string; depth: number }

export function defaultRoots(): RecentRoot[] {
  return [
    { label: "Téléchargements", path: app.getPath("downloads"), depth: 1 },
    { label: "Bureau", path: app.getPath("desktop"), depth: 1 },
    { label: "Documents", path: app.getPath("documents"), depth: 2 },
    // Dossier « Captures d'écran » de Windows (Win + Impr. écran, outil Capture).
    { label: "Captures", path: path.join(app.getPath("pictures"), "Screenshots"), depth: 1 },
  ];
}

const SKIP_DIRS = /^(\.|node_modules$|\$recycle\.bin$|__pycache__$)/i;

/** Parcourt chaque dossier (profondeur limitée, au plus 4000 fichiers par dossier) et garde les plus récents. */
export async function recentFiles(roots = defaultRoots(), n = 20): Promise<RecentFile[]> {
  const all: RecentFile[] = [];
  for (const root of roots) {
    let budget = 4000;
    const walk = async (dir: string, depth: number) => {
      let entries: import("node:fs").Dirent[];
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (budget <= 0) return;
        const p = path.join(dir, e.name);
        if (e.isSymbolicLink()) continue;
        if (e.isDirectory()) { if (depth > 0 && !SKIP_DIRS.test(e.name)) await walk(p, depth - 1); continue; }
        if (!e.isFile() || ignoredFile(e.name)) continue;
        budget--;
        try {
          const st = await fs.stat(p);
          // Date de création ; un fichier copié garde parfois une date de modification plus récente.
          all.push({ path: p, name: e.name, folder: path.relative(root.path, dir) ? `${root.label} › ${path.relative(root.path, dir).split(path.sep).join(" › ")}` : root.label, created: Math.max(st.birthtimeMs, 0) || st.mtimeMs, size: st.size });
        } catch { /* fichier disparu entre-temps */ }
      }
    };
    await walk(root.path, root.depth);
  }
  return latest(all, n);
}
