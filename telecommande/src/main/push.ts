// Envoi des rappels de fin de minuteur (Rayan's Chrono sur l'iPhone) par Web Push. La paire de clés VAPID est créée
// au premier lancement et reste dans les données locales de la Télécommande (push.json), jamais dans le code.
import fs from "node:fs";
import path from "node:path";
import webpush from "web-push";
import { annuler, echus, normaliserRappels, programmer, type Rappel } from "../core/minuteurs.ts";

// Adresse de l'app (exigée par Apple pour identifier l'expéditeur) : publique, comme le site.
const SUJET = "https://jojoskeys.github.io";
const URL_APP = "https://jojoskeys.github.io/rayans-apps/chrono/";

interface Fichier { publicKey: string; privateKey: string; rappels: Rappel[] }

export class Push {
  private f: Fichier;
  private readonly fichier: string;
  private readonly journaliser: (quoi: string, detail?: string) => void;
  constructor(dir: string, journaliser: (quoi: string, detail?: string) => void) {
    this.journaliser = journaliser;
    this.fichier = path.join(dir, "push.json");
    let lu: Partial<Fichier> = {};
    try { lu = JSON.parse(fs.readFileSync(this.fichier, "utf8")); } catch { /* premier lancement */ }
    if (typeof lu.publicKey === "string" && typeof lu.privateKey === "string") this.f = { publicKey: lu.publicKey, privateKey: lu.privateKey, rappels: normaliserRappels(lu.rappels) };
    else { const k = webpush.generateVAPIDKeys(); this.f = { publicKey: k.publicKey, privateKey: k.privateKey, rappels: [] }; this.enregistrer(); }
    setInterval(() => void this.verifier(), 1000).unref?.();
  }

  get cle() { return this.f.publicKey; }

  programmer(corps: Record<string, unknown>) { this.f.rappels = programmer(this.f.rappels, corps, Date.now()); this.enregistrer(); }
  annuler(endpoint: unknown) { const n = this.f.rappels.length; this.f.rappels = annuler(this.f.rappels, endpoint); if (n !== this.f.rappels.length) this.enregistrer(); }
  prevu(endpoint: unknown) { return this.f.rappels.find((r) => r.abonnement.endpoint === endpoint)?.fin ?? null; }

  /** Envoie tout de suite (essai depuis la tuile). */
  async envoyer(r: Pick<Rappel, "abonnement" | "titre" | "texte">) {
    const corps = JSON.stringify({ title: r.titre, body: r.texte, url: URL_APP, tag: "chrono" });
    const res = await webpush.sendNotification(r.abonnement, corps, { TTL: 3600, urgency: "high", timeout: 20_000, vapidDetails: { subject: SUJET, publicKey: this.f.publicKey, privateKey: this.f.privateKey } });
    return res.statusCode;
  }

  /** Envoie une notification quelconque (ex. pépites de Rayan's Bonnes Affaires). Renvoie le code HTTP. */
  async envoyerMessage(abonnement: Rappel["abonnement"], m: { titre: string; texte: string; url: string; tag: string }) {
    const corps = JSON.stringify({ title: m.titre, body: m.texte, url: m.url, tag: m.tag });
    const res = await webpush.sendNotification(abonnement, corps, { TTL: 6 * 3600, urgency: "high", timeout: 20_000, vapidDetails: { subject: SUJET, publicKey: this.f.publicKey, privateKey: this.f.privateKey } });
    return res.statusCode;
  }

  private async verifier() {
    if (!this.f.rappels.some((r) => r.fin <= Date.now())) return;
    const { aEnvoyer, restants } = echus(this.f.rappels, Date.now());
    this.f.rappels = restants;
    this.enregistrer();
    for (const r of aEnvoyer) {
      try { await this.envoyer(r); this.journaliser("Fin du minuteur envoyée à l'iPhone", r.titre); }
      catch (e) { this.journaliser("Notification du minuteur refusée", String((e as { statusCode?: number }).statusCode ?? (e as Error).message).slice(0, 120)); }
    }
  }

  private enregistrer() {
    const tmp = `${this.fichier}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.f));
    fs.renameSync(tmp, this.fichier);
  }
}
