// Rayan's Bonnes Affaires : prévient l'iPhone de chaque nouvelle pépite. Toutes les minutes, si le classement
// déposé par l'app bonnes-affaires/ a changé, les pépites pas encore signalées partent par Web Push vers les
// iPhone abonnés depuis la tuile. Abonnements et liens déjà signalés : alertes-affaires.json (données locales).
import fs from "node:fs";
import path from "node:path";
import { lire, messages, nouvellesPepites } from "../core/bonnes-affaires.ts";
import type { Abonnement } from "../core/minuteurs.ts";
import type { Push } from "./push.ts";

const URL_TUILE = "https://jojoskeys.github.io/rayans-apps/bonnes-affaires/";

interface Etat { abonnements: Abonnement[]; deja: string[]; vuLe: number }

export class AlertesAffaires {
  private e: Etat;
  private readonly fichier: string;
  private readonly dossier: () => string;
  private readonly push: Push;
  private readonly journaliser: (quoi: string, detail?: string) => void;

  constructor(dataDir: string, dossierOffres: () => string, push: Push, journaliser: (quoi: string, detail?: string) => void) {
    this.fichier = path.join(dataDir, "alertes-affaires.json");
    this.dossier = dossierOffres;
    this.push = push;
    this.journaliser = journaliser;
    let lu: Partial<Etat> = {};
    try { lu = JSON.parse(fs.readFileSync(this.fichier, "utf8")); } catch { /* premier lancement */ }
    this.e = { abonnements: Array.isArray(lu.abonnements) ? lu.abonnements : [], deja: Array.isArray(lu.deja) ? lu.deja : [], vuLe: Number(lu.vuLe) || 0 };
    setInterval(() => void this.verifier(), 60_000).unref?.();
  }

  abonne(endpoint: string) { return this.e.abonnements.some((a) => a.endpoint === endpoint); }

  /** Nouvel iPhone abonné : les pépites déjà là sont comptées dans la notification d'essai, pas renvoyées une à une. */
  async abonner(a: Abonnement) {
    const classement = lire(this.dossier());
    this.e.deja = nouvellesPepites(classement, this.e.deja).deja;
    this.e.abonnements = [...this.e.abonnements.filter((x) => x.endpoint !== a.endpoint), a];
    this.enregistrer();
    const n = classement.demo ? 0 : classement.offres.filter((o) => o.pepite).length;
    await this.push.envoyerMessage(a, {
      titre: "Rayan's Bonnes Affaires",
      texte: `Notifications activées ✓ Tu seras prévenu de chaque nouvelle pépite.${n ? ` ${n} pépite(s) en ce moment dans la tuile.` : ""}`,
      url: URL_TUILE,
      tag: "bonnes-affaires-essai",
    });
  }

  desabonner(endpoint: string) {
    this.e.abonnements = this.e.abonnements.filter((a) => a.endpoint !== endpoint);
    this.enregistrer();
  }

  private async verifier() {
    if (!this.e.abonnements.length) return;
    let modifie = 0;
    try { modifie = fs.statSync(path.join(this.dossier(), "offres.json")).mtimeMs; } catch { return; }
    if (modifie <= this.e.vuLe) return;
    this.e.vuLe = modifie;
    const { nouvelles, deja } = nouvellesPepites(lire(this.dossier()), this.e.deja);
    this.e.deja = deja;
    this.enregistrer();
    for (const m of messages(nouvelles)) {
      for (const a of [...this.e.abonnements]) {
        try { await this.push.envoyerMessage(a, { ...m, url: URL_TUILE }); }
        catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) this.desabonner(a.endpoint); // abonnement périmé sur l'iPhone
          this.journaliser("Notification de pépite refusée", String(code ?? (err as Error).message).slice(0, 120));
        }
      }
    }
    if (nouvelles.length) this.journaliser("Pépites signalées à l'iPhone", String(nouvelles.length));
  }

  private enregistrer() {
    const tmp = `${this.fichier}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.e));
    fs.renameSync(tmp, this.fichier);
  }
}
