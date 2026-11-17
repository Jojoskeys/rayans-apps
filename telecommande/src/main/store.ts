// Fichier de données local : telecommande.json (+ .bak, la version précédente). Écriture atomique.
import fs from "node:fs";
import path from "node:path";
import { normaliserDonnees, type Donnees } from "../core/donnees.ts";

export class Store {
  readonly file: string;
  readonly boite: string;
  warning: string | null = null;

  readonly dir: string;
  constructor(dir: string) {
    this.dir = dir;
    this.file = path.join(dir, "telecommande.json");
    this.boite = path.join(dir, "boite");
  }

  load(): Donnees {
    fs.mkdirSync(this.boite, { recursive: true });
    for (const c of [this.file, `${this.file}.bak`]) {
      if (!fs.existsSync(c)) continue;
      try {
        const d = normaliserDonnees(JSON.parse(fs.readFileSync(c, "utf8")));
        if (c !== this.file) this.warning = "Le fichier de réglages était illisible : la sauvegarde précédente a été restaurée.";
        return d;
      } catch { /* suivant */ }
    }
    const d = normaliserDonnees(null);
    this.save(d);
    return d;
  }

  save(d: Donnees) {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(d, null, 1));
    if (fs.existsSync(this.file)) fs.copyFileSync(this.file, `${this.file}.bak`);
    fs.renameSync(tmp, this.file);
  }
}
