// Fichier de données local : priere.json (+ priere.json.bak, la version précédente). Écriture atomique.
import fs from "node:fs";
import path from "node:path";
import { normalizeData, type AppData } from "../core/settings.ts";

export class Store {
  readonly dir: string;
  readonly file: string;
  warning: string | null = null;

  constructor(dir: string) {
    this.dir = dir;
    this.file = path.join(dir, "priere.json");
  }

  load(): AppData {
    fs.mkdirSync(this.dir, { recursive: true });
    for (const candidate of [this.file, `${this.file}.bak`]) {
      if (!fs.existsSync(candidate)) continue;
      try {
        const raw = JSON.parse(fs.readFileSync(candidate, "utf8"));
        if (candidate !== this.file) this.warning = "Le fichier de réglages était illisible : la sauvegarde précédente a été restaurée.";
        return normalizeData(raw);
      } catch {
        if (candidate === this.file) {
          const kept = path.join(this.dir, `priere.illisible-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
          fs.renameSync(this.file, kept);
          this.warning = `Le fichier de réglages était illisible. Il a été mis de côté : ${path.basename(kept)}`;
        }
      }
    }
    return normalizeData(null);
  }

  save(data: AppData) {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
    if (fs.existsSync(this.file)) fs.copyFileSync(this.file, `${this.file}.bak`);
    fs.renameSync(tmp, this.file);
  }
}
