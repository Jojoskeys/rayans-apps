// Fichier de données local : recettes.json (+ recettes.json.bak, la version précédente).
// Écriture atomique (fichier temporaire puis renommage) pour ne jamais laisser un fichier à moitié écrit.
import fs from "node:fs";
import path from "node:path";
import { donneesVides, normaliser } from "../core/donnees.ts";
import type { Donnees } from "../core/types.ts";

export class Store {
  readonly dir: string;
  readonly file: string;
  warning: string | null = null;

  constructor(dir: string) {
    this.dir = dir;
    this.file = path.join(dir, "recettes.json");
  }

  load(): Donnees {
    fs.mkdirSync(this.dir, { recursive: true });
    for (const candidate of [this.file, `${this.file}.bak`]) {
      if (!fs.existsSync(candidate)) continue;
      try {
        const d = normaliser(JSON.parse(fs.readFileSync(candidate, "utf8")));
        if (candidate !== this.file) this.warning = "Le fichier de données était illisible : la sauvegarde précédente a été restaurée.";
        return d;
      } catch {
        if (candidate === this.file) {
          const kept = path.join(this.dir, `recettes.illisible-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
          fs.renameSync(this.file, kept);
          this.warning = `Le fichier de données était illisible. Il a été mis de côté : ${path.basename(kept)}`;
        }
      }
    }
    return donneesVides();
  }

  save(d: Donnees) {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(d, null, 1));
    if (fs.existsSync(this.file)) fs.copyFileSync(this.file, `${this.file}.bak`);
    fs.renameSync(tmp, this.file);
  }
}
