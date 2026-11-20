// Types partagés entre la fenêtre et le processus principal de Rayan's Télécommande.
import type { Donnees, Reglages, Scenario } from "../core/donnees.ts";
import type { EtatTailscale } from "../main/tailscale.ts";

export interface Etat {
  donnees: Donnees;
  version: string;
  tailscale: EtatTailscale;
  publie: boolean;
  serveurOk: boolean;
  dossierReception: string;
  avertissement: string | null;
}

export type Commande =
  | { type: "publier" }
  | { type: "depublier" }
  | { type: "nouveau-code" }
  | { type: "nouveau-code-montre" }
  | { type: "reglages"; patch: Partial<Reglages> }
  | { type: "scenarios"; scenarios: Scenario[] }
  | { type: "choisir-cible"; dossier: boolean }
  | { type: "envoyer-fichiers" }
  | { type: "envoyer-texte"; texte: string }
  | { type: "supprimer-boite"; id: string }
  | { type: "ouvrir-lien"; url: string }
  | { type: "ouvrir-reception" }
  | { type: "actualiser" }
  | { type: "quitter" };

export interface TelecommandeApi {
  etat(): Promise<Etat>;
  commande(c: Commande): Promise<{ ok: boolean; message?: string; lien?: string; cible?: string; nom?: string } | null>;
  surEtat(cb: (e: Etat) => void): () => void;
}

declare global { interface Window { telecommande: TelecommandeApi } }
