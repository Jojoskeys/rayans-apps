// Fichier de données local : chrono.json (+ chrono.json.bak, la version précédente).
// Écriture atomique (fichier temporaire puis renommage) pour ne jamais laisser un fichier à moitié écrit.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { normalizeData } from "../core/engine.ts";
import type { AppData } from "../core/types.ts";

export const newId = () => randomUUID();

export class Store {
  readonly dir: string;
  readonly file: string;
  /** Message à montrer à l'utilisateur si le fichier a dû être réparé au démarrage. */
  warning: string | null = null;

  constructor(dir: string) {
    this.dir = dir;
    this.file = path.join(dir, "chrono.json");
  }

  load(now: number): AppData {
    fs.mkdirSync(this.dir, { recursive: true });
    for (const candidate of [this.file, `${this.file}.bak`]) {
      if (!fs.existsSync(candidate)) continue;
      try {
        const raw = JSON.parse(fs.readFileSync(candidate, "utf8"));
        if (candidate !== this.file) this.warning = "Le fichier de données était illisible : la sauvegarde précédente a été restaurée.";
        return normalizeData(raw, { now, newId });
      } catch {
        if (candidate === this.file) {
          const kept = path.join(this.dir, `chrono.illisible-${new Date(now).toISOString().replace(/[:.]/g, "-")}.json`);
          fs.renameSync(this.file, kept);
          this.warning = `Le fichier de données était illisible. Il a été mis de côté : ${path.basename(kept)}`;
        }
      }
    }
    return normalizeData(null, { now, newId });
  }

  save(data: AppData) {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
    if (fs.existsSync(this.file)) fs.copyFileSync(this.file, `${this.file}.bak`);
    fs.renameSync(tmp, this.file);
  }
}
