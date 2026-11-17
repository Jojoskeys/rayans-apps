// Pont vers la couche Rust (src-tauri/src/lib.rs). L'archive, le chiffrement et les imports sont côté Rust.
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { open as tauriOpen, save as tauriSave } from "@tauri-apps/plugin-dialog";
import { mockInvoke } from "./mock";

// Hors de Tauri (`npm run dev:ui` dans un navigateur) : faux backend en mémoire avec des données fictives.
const inTauri = "__TAURI_INTERNALS__" in window;
const invoke = <T,>(cmd: string, args?: Record<string, unknown>): Promise<T> =>
  inTauri ? tauriInvoke<T>(cmd, args) : (mockInvoke(cmd, args) as Promise<T>);
const open: typeof tauriOpen = inTauri ? tauriOpen : (async () => null) as unknown as typeof tauriOpen;
const save: typeof tauriSave = inTauri ? tauriSave : (async () => null) as unknown as typeof tauriSave;

export interface Horodatage {
  utcMs: number;
  decalageMin: number;
  fuseau: string;
  precision: string;
}

export interface ReglesSecrets {
  applisExclues: string[];
  motsSensibles: string[];
  fichiersSensibles: string[];
  titres: "complet" | "appli";
}

export interface Reglages {
  collecteActive: boolean;
  applications: boolean;
  fenetres: boolean;
  fichiers: boolean;
  session: boolean;
  securite: boolean;
  dossiers: string[];
  ignores: string[];
  secrets: ReglesSecrets;
  conservationJournalJours: number;
  conservationMessagesJours: number;
  intervalleProcessusS: number;
  pauseJusquaMs: number | null;
  raccourciPause: boolean;
  seuilInactiviteMin: number;
  heuresCalmes: boolean;
  calmeDebutH: number;
  calmeFinH: number;
  absentDepuisMs: number | null;
  projets: { projet: string; mots: string[] }[];
}

export interface Duree {
  nom: string;
  ms: number;
}

export interface Rapport {
  actifMs: number;
  premiereMs: number | null;
  derniereMs: number | null;
  parAppli: Duree[];
  parFenetre: Duree[];
  parHeure: number[];
  parJour: number[];
  periodes: { debutMs: number; finMs: number }[];
  parProjet: Duree[];
}

export interface RapportVue {
  rapport: Rapport;
  chrono: { fichier: string; executable: boolean; projets: { nom: string; couleur: string; archive: boolean; ms: number }[] } | null;
  fichiersTouches: number;
}

export interface Segment {
  debutMs: number;
  finMs: number;
  appli: string;
  titre: string;
}

export interface HistoriqueFichier {
  chemin: string;
  chemins: string[];
  evenements: Evenement[];
  supprime: boolean;
  telecharge: boolean;
  renomme: boolean;
  premierMs: number;
  dernierMs: number;
}

export interface Statistiques {
  evenements: number;
  conversations: number;
  messages: number;
  premierEvenementMs: number | null;
  tailleOctets: number;
}

export interface EtatVue {
  reglages: Reglages;
  version: string;
  dossier: string;
  statistiques: Statistiques | null;
  erreurArchive: string | null;
  enPause: boolean;
  demarrageAuto: boolean;
  raccourci: string;
}

export interface Filtre {
  duMs?: number | null;
  auMs?: number | null;
  mots?: string;
  categorie?: string | null;
  exclureCategories?: string[];
  appli?: string | null;
  conversation?: number | null;
  limite?: number | null;
  avantId?: number | null;
}

export interface Evenement {
  id: number;
  categorie: string;
  action: string;
  evenement: Horodatage | null;
  detection: Horodatage;
  partiel: boolean;
  contenu: {
    sujet: string;
    appli: string | null;
    chemin: string | null;
    ancienChemin: string | null;
    detail: string | null;
    note: string | null;
  };
}

export interface ConversationVue {
  id: number;
  appli: string;
  nom: string;
  messages: number;
  premierMs: number | null;
  dernierMs: number | null;
  supprimes: number;
}

export interface VersionVue {
  texte: string;
  statut: "originale" | "modifiee" | "modifiee_avant_archivage" | "mention_suppression";
  modifie: Horodatage | null;
  archiveMs: number;
}

export interface MessageVue {
  id: number;
  conversation: number;
  conversationNom: string;
  appli: string;
  auteur: string | null;
  envoi: Horodatage;
  archiveMs: number;
  etat: "present" | "suppression_signalee" | "absent_constate";
  etatMs: number | null;
  etatNote: string | null;
  versions: VersionVue[];
  pieces: { id: number; nom: string; taille: number | null; disponible: boolean; note: string | null }[];
  details: string[];
}

export interface RapportImport {
  appli: string;
  conversations: number;
  messagesLus: number;
  nouveaux: number;
  inchanges: number;
  nouvellesVersions: number;
  suppressionsSignalees: number;
  absencesConstatees: number;
  reapparus: number;
  piecesArchivees: number;
  piecesManquantes: number;
  avertissements: string[];
}

export type Niveau = "fiable" | "a_verifier" | "suspect" | "inconnu";

export interface Programme {
  analyse: {
    chemin: string;
    nom: string;
    niveau: Niveau;
    raisons: { gravite: "info" | "avertissement" | "critique"; texte: string }[];
    editeur: string | null;
    demarrage: string[];
    analyseMs: number;
  };
  premiereVueMs: number;
  derniereVueMs: number;
}

export interface EntreeDemarrage {
  source: string;
  nom: string;
  commande: string;
  executable: string | null;
}

export interface Detection {
  numero: string;
  quandMs: number;
  menace: string;
  gravite: string;
  categorie: string;
  chemins: string[];
  action: string;
  id: number;
}

export interface SecuriteVue {
  programmes: Programme[];
  demarrage: EntreeDemarrage[];
  detections: Detection[];
}

export const api = {
  rapport: (du: number, au: number, jours: number[]) => invoke<RapportVue>("rapport", { du, au, jours }),
  aLInstant: (t: number) => invoke<{ segment: Segment | null; autour: Evenement[] }>("a_l_instant", { t }),
  fichiers: (mots: string, genre: string, du: number, au: number) => invoke<HistoriqueFichier[]>("fichiers", { mots, genre, du, au }),
  chronoProjets: () => invoke<string[]>("chrono_projets"),
  chronoLancer: (projet: string) => invoke<void>("chrono_lancer", { projet }),
  absence: (actif: boolean) => invoke<EtatVue>("absence", { actif }),
  securite: () => invoke<SecuriteVue>("securite_etat"),
  reanalyser: (chemin: string) => invoke<void>("reanalyser", { chemin }),
  analyserDefender: (chemin: string) => invoke<[boolean, string]>("analyser_defender", { chemin }),
  montrerFichier: (chemin: string) => invoke<void>("montrer_fichier", { chemin }),
  etat: () => invoke<EtatVue>("etat"),
  enregistrerReglages: (nouveaux: Reglages) => invoke<EtatVue>("enregistrer_reglages", { nouveaux }),
  activerCollecte: (actif: boolean) => invoke<EtatVue>("activer_collecte", { actif }),
  pause: (minutes: number | null) => invoke<EtatVue>("pause", { minutes }),
  reprendre: () => invoke<EtatVue>("reprendre"),
  evenements: (filtre: Filtre) => invoke<Evenement[]>("evenements", { filtre }),
  messages: (filtre: Filtre) => invoke<MessageVue[]>("messages", { filtre }),
  conversations: (appli: string | null) => invoke<ConversationVue[]>("conversations", { appli }),
  importer: (chemin: string) => invoke<RapportImport>("importer", { chemin }),
  enregistrerPiece: async (id: number) => {
    const nom = await invoke<string>("nom_piece", { id });
    const chemin = await save({ title: "Enregistrer la pièce jointe (non chiffrée)", defaultPath: nom });
    if (chemin) await invoke<void>("enregistrer_piece", { id, chemin });
    return chemin;
  },
  exporter: async (quoi: "evenements" | "messages", filtre: Filtre) => {
    const dossier = await open({ directory: true, multiple: false, title: "Dossier où écrire l’export lisible" });
    if (typeof dossier !== "string") return null;
    return invoke<string[]>("exporter", { quoi, filtre, dossier });
  },
  supprimerConversation: (id: number) => invoke<void>("supprimer_conversation", { id }),
  appliquerConservation: () => invoke<EtatVue>("appliquer_conservation"),
  demarrageAuto: (actif: boolean) => invoke<EtatVue>("demarrage_auto", { actif }),
  ouvrirDossier: (chemin: string) => invoke<void>("ouvrir_dossier", { chemin }),
  pret: () => invoke<void>("frontend_ready"),
  choisirDossier: async (title: string): Promise<string | null> => {
    const r = await open({ directory: true, multiple: false, title });
    return typeof r === "string" ? r : null;
  },
  choisirExport: async (dossier: boolean): Promise<string | null> => {
    const r = await open({
      directory: dossier,
      multiple: false,
      title: dossier ? "Dossier d’export décompressé" : "Fichier d’export (.zip, .txt ou .json)",
      filters: dossier ? undefined : [{ name: "Exports", extensions: ["zip", "txt", "json"] }],
    });
    return typeof r === "string" ? r : null;
  },
};

export function texteErreur(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  return String(e);
}
