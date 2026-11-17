// Données de Rayan's Télécommande (telecommande.json) et leur normalisation.
import { genererCode } from "./securite.ts";

export type Etape =
  | { type: "ouvrir"; cible: string; nom: string } // programme, raccourci, dossier, fichier ou lien web
  | { type: "fermer"; processus: string };         // nom de processus sans .exe (ex. « Discord »)

export interface Scenario { id: string; nom: string; icone: string; etapes: Etape[] }

export interface Evenement { at: number; quoi: string; detail?: string }

export interface ElementBoite { id: string; type: "fichier" | "texte"; nom: string; taille: number; at: number }

export interface Reglages {
  demarrerAvecWindows: boolean;
  /** Arrêt complet autorisé depuis le téléphone (désactivé par défaut : le PC ne peut pas être rallumé à distance). */
  autoriserArret: boolean;
  /** Mise en veille autorisée (même raison : en Wi-Fi, le PC ne peut pas être réveillé à distance). */
  autoriserVeille: boolean;
  notifierConnexion: boolean;
}

export interface Donnees {
  code: string;
  reglages: Reglages;
  scenarios: Scenario[];
  journal: Evenement[];
  boite: ElementBoite[];
}

export const REGLAGES_DEFAUT: Reglages = { demarrerAvecWindows: true, autoriserArret: false, autoriserVeille: false, notifierConnexion: true };

export const SCENARIOS_DEFAUT: Scenario[] = [
  { id: "travail", nom: "Préparer pour travailler", icone: "💼", etapes: [] },
  { id: "pause", nom: "Fin de journée", icone: "🌙", etapes: [] },
];

const estObjet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

function normaliserEtape(e: unknown): Etape | null {
  if (!estObjet(e)) return null;
  if (e.type === "ouvrir" && typeof e.cible === "string" && e.cible.trim()) return { type: "ouvrir", cible: e.cible.trim(), nom: typeof e.nom === "string" && e.nom.trim() ? e.nom.trim() : e.cible.trim() };
  if (e.type === "fermer" && typeof e.processus === "string" && /^[\w .()+-]{1,80}$/.test(e.processus.trim())) return { type: "fermer", processus: e.processus.trim().replace(/\.exe$/i, "") };
  return null;
}

export function normaliserDonnees(brut: unknown): Donnees {
  const d = estObjet(brut) ? brut : {};
  const r = estObjet(d.reglages) ? d.reglages : {};
  const reglages: Reglages = {
    demarrerAvecWindows: typeof r.demarrerAvecWindows === "boolean" ? r.demarrerAvecWindows : REGLAGES_DEFAUT.demarrerAvecWindows,
    autoriserArret: r.autoriserArret === true,
    autoriserVeille: r.autoriserVeille === true,
    notifierConnexion: typeof r.notifierConnexion === "boolean" ? r.notifierConnexion : true,
  };
  const scenarios = Array.isArray(d.scenarios)
    ? d.scenarios.filter(estObjet).map((s, i) => ({
        id: typeof s.id === "string" && s.id ? s.id : `s${i}`,
        nom: typeof s.nom === "string" && s.nom.trim() ? s.nom.trim().slice(0, 60) : "Scénario",
        icone: typeof s.icone === "string" && s.icone ? s.icone.slice(0, 4) : "▶",
        etapes: Array.isArray(s.etapes) ? s.etapes.map(normaliserEtape).filter((x): x is Etape => !!x).slice(0, 30) : [],
      }))
    : SCENARIOS_DEFAUT.map((s) => ({ ...s, etapes: [] }));
  const journal = Array.isArray(d.journal) ? d.journal.filter((e): e is Evenement => estObjet(e) && typeof e.at === "number" && typeof e.quoi === "string").slice(-200) : [];
  const boite = Array.isArray(d.boite) ? d.boite.filter((e): e is ElementBoite => estObjet(e) && typeof e.id === "string" && /^[a-z0-9-]+$/.test(e.id) && (e.type === "fichier" || e.type === "texte")) : [];
  const code = typeof d.code === "string" && d.code.replace(/[^A-Z0-9]/g, "").length >= 20 ? d.code : genererCode();
  return { code, reglages, scenarios, journal, boite };
}
