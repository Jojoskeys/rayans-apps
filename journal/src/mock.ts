// Faux backend pour `npm run dev:ui` dans un navigateur : données fictives, rien n'est lu ni écrit.
import type { ConversationVue, EtatVue, Evenement, Filtre, Horodatage, MessageVue, Reglages } from "./api";

const h = (iso: string, precision = "exacte (milliseconde)"): Horodatage => ({
  utcMs: Date.parse(iso),
  decalageMin: 60,
  fuseau: "Europe/Paris",
  precision,
});

let reglages: Reglages = {
  collecteActive: false,
  applications: true,
  fenetres: true,
  fichiers: true,
  session: true,
  securite: true,
  dossiers: ["C:\\Users\\exemple\\Desktop", "C:\\Users\\exemple\\Documents", "C:\\Users\\exemple\\Downloads"],
  ignores: [".git", "node_modules", "~$*", "*.tmp"],
  secrets: { applisExclues: ["keepassxc.exe", "bitwarden.exe"], motsSensibles: ["mot de passe", "inprivate"], fichiersSensibles: ["*.kdbx", ".env"], titres: "complet" },
  conservationJournalJours: 90,
  conservationMessagesJours: 0,
  intervalleProcessusS: 2,
  pauseJusquaMs: null,
  raccourciPause: true,
  confiance: [],
  seuilInactiviteMin: 5,
  heuresCalmes: false,
  calmeDebutH: 0,
  calmeFinH: 7,
  absentDepuisMs: null,
  projets: [{ projet: "Mémoire", mots: ["mémoire", "stage"] }],
};

const ev = (id: number, categorie: string, action: string, sujet: string, quand: Horodatage | null, extra: Partial<Evenement["contenu"]> = {}, partiel = false): Evenement => ({
  id,
  categorie,
  action,
  evenement: quand,
  detection: quand ? { ...quand, utcMs: quand.utcMs + 35 } : h("2026-11-17T08:00:04Z"),
  partiel,
  contenu: { sujet, appli: null, chemin: null, ancienChemin: null, detail: null, note: null, ...extra },
});

const evenements: Evenement[] = [
  ev(9, "fenetre", "premier_plan", "Mémoire de stage.docx - Word", h("2026-11-17T08:12:40.512Z"), { appli: "WINWORD.EXE" }),
  ev(8, "fichier", "modification", "Mémoire de stage.docx", h("2026-11-17T08:11:02.004Z", "exacte (à la détection, moins d'une seconde)"), { chemin: "C:\\Users\\exemple\\Documents\\Mémoire de stage.docx" }),
  ev(7, "fenetre", "premier_plan", "[titre masqué]", h("2026-11-17T08:10:15.250Z"), { appli: "msedge.exe", note: "Titre non enregistré (application exclue, navigation privée ou mot sensible)." }),
  ev(6, "application", "ouverture", "WINWORD.EXE", h("2026-11-17T08:05:31.870Z", "exacte (heure de création du processus)"), { appli: "WINWORD.EXE" }),
  ev(5, "session", "deverrouillage", "Session déverrouillée", h("2026-11-17T08:05:02.100Z")),
  ev(4, "session", "reveil", "Sortie de veille", h("2026-11-17T08:04:58.733Z", "exacte (journal Windows)"), { detail: "Journal Système, événement 107 n° 98766" }),
  ev(3, "fichier", "suppression", "brouillon.txt", null, { chemin: "C:\\Users\\exemple\\Desktop\\brouillon.txt", note: "Constaté au démarrage : supprimé, renommé ou déplacé entre 2026-11-16 23:40 et 2026-11-17 08:04. Heure réelle inconnue." }, true),
  ev(2, "collecte", "reprise", "Suivi relancé avec l'application", h("2026-11-17T08:04:10Z"), { note: "Suivi partiel entre 2026-11-16 23:40 et 2026-11-17 09:04 (application fermée, PC éteint ou en veille)." }, true),
  ev(1, "session", "veille", "Mise en veille", h("2026-11-16T22:40:12.004Z", "exacte (journal Windows)")),
];

const convs: ConversationVue[] = [
  { id: 1, appli: "whatsapp", nom: "Léa Exemple", messages: 3, premierMs: Date.parse("2026-11-15T08:14:02Z"), dernierMs: Date.parse("2026-11-17T07:30:15Z"), supprimes: 1 },
  { id: 2, appli: "telegram", nom: "Club échecs (exemple)", messages: 1, premierMs: Date.parse("2026-11-14T20:06:30Z"), dernierMs: Date.parse("2026-11-14T20:06:30Z"), supprimes: 0 },
];

const msg = (id: number, conversation: number, auteur: string, envoi: Horodatage, textes: [string, MessageVue["versions"][0]["statut"]][], etat: MessageVue["etat"] = "present", etatNote: string | null = null): MessageVue => ({
  id,
  conversation,
  conversationNom: convs.find((c) => c.id === conversation)!.nom,
  appli: convs.find((c) => c.id === conversation)!.appli,
  auteur,
  envoi,
  archiveMs: Date.parse("2026-11-16T10:00:00Z"),
  etat,
  etatMs: etat === "present" ? null : Date.parse("2026-11-17T10:00:00Z"),
  etatNote,
  versions: textes.map(([texte, statut], i) => ({ texte, statut, modifie: null, archiveMs: Date.parse(i ? "2026-11-17T10:00:00Z" : "2026-11-16T10:00:00Z") })),
  pieces: [],
  details: [],
});

const messages: MessageVue[] = [
  msg(1, 1, "Léa Exemple", h("2026-11-15T08:16:10Z", "à la seconde"), [
    ["Parfait 👍\nPense à apporter :\n- le gâteau\n- les bougies 🕯️", "originale"],
    ["Parfait 👍\nPense à apporter :\n- le gâteau\n- les bougies 🕯️\n- des assiettes", "modifiee"],
  ]),
  msg(2, 1, "Rayan", h("2026-11-15T08:20:33Z", "à la seconde"), [
    ["Désolé, je me suis trompé de discussion 😅", "originale"],
    ["Ce message a été supprimé.", "mention_suppression"],
  ], "suppression_signalee", "L'application indique que ce message a été supprimé (constaté à l'import du 2026-11-17 11:00). Le texte archivé avant la suppression est conservé."),
  msg(3, 1, "Léa Exemple", h("2026-11-16T17:02:00Z", "à la seconde"), [["Famille 👨‍👩‍👧‍👦 au complet !", "originale"]]),
  msg(4, 2, "Rayan", h("2026-11-14T20:06:30Z", "à la seconde"), [["Oui ! Ouverture italienne cette fois.", "originale"], ["Oui ! Ouverture sicilienne cette fois.", "modifiee"]]),
];

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const etat = (): EtatVue => ({
  reglages,
  version: "1.0.0 (aperçu navigateur)",
  dossier: "C:\\Users\\exemple\\AppData\\Local\\Rayan's Journal",
  statistiques: { evenements: evenements.length, conversations: convs.length, messages: messages.length, premierEvenementMs: evenements[evenements.length - 1].evenement!.utcMs, tailleOctets: 182_000 },
  erreurArchive: null,
  enPause: !!reglages.pauseJusquaMs && reglages.pauseJusquaMs > Date.now(),
  demarrageAuto: false,
  raccourci: "Ctrl+Alt+J",
});

const securite = {
  programmes: [
    { analyse: { chemin: "C:\\Users\\exemple\\Downloads\\cheat-roblox.exe", nom: "cheat-roblox.exe", niveau: "suspect", editeur: null, demarrage: [], analyseMs: Date.now(), raisons: [
      { gravite: "avertissement", texte: "Non signé : l'éditeur ne peut pas être vérifié." },
      { gravite: "avertissement", texte: "Lancé directement depuis Téléchargements, le Bureau ou le dossier Public." },
      { gravite: "avertissement", texte: "Téléchargé d'Internet depuis https://exemple.test/cheat.exe." } ] }, premiereVueMs: Date.now() - 3600_000, derniereVueMs: Date.now() },
    { analyse: { chemin: "C:\\Program Files\\Git\\usr\\bin\\grep.exe", nom: "grep.exe", niveau: "a_verifier", editeur: null, demarrage: [], analyseMs: Date.now(), raisons: [
      { gravite: "avertissement", texte: "Non signé : l'éditeur ne peut pas être vérifié." }, { gravite: "info", texte: "Installé dans Program Files." } ] }, premiereVueMs: Date.now() - 86400_000, derniereVueMs: Date.now() },
    { analyse: { chemin: "C:\\Users\\exemple\\AppData\\Local\\Discord\\app-1.0\\Discord.exe", nom: "Discord.exe", niveau: "fiable", editeur: "Discord Inc.", demarrage: ["Registre utilisateur Run : Discord"], analyseMs: Date.now(), raisons: [
      { gravite: "info", texte: "Signé par Discord Inc. : signature vérifiée par Windows." }, { gravite: "info", texte: "Se lance automatiquement : Registre utilisateur Run : Discord." } ] }, premiereVueMs: Date.now() - 5 * 86400_000, derniereVueMs: Date.now() },
  ],
  demarrage: [{ source: "Registre utilisateur Run", nom: "Discord", commande: "\"C:\\Users\\exemple\\AppData\\Local\\Discord\\Update.exe\" --processStart Discord.exe", executable: "C:\\Users\\exemple\\AppData\\Local\\Discord\\Update.exe" }],
  detections: [{ numero: "9025", quandMs: Date.parse("2026-01-19T00:05:56Z"), menace: "PUADlManager:Win32/OfferCore", gravite: "Faible", categorie: "Logiciel potentiellement non désiré", chemins: ["C:\\$Recycle.Bin\\…\\$RWL4XQB.exe"], action: "Non applicable", id: 1116 }],
};

export async function mockInvoke(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
  const f = (args?.filtre ?? {}) as Filtre;
  switch (cmd) {
    case "rapport": {
      const M = 60_000;
      return {
        rapport: {
          actifMs: 312 * M, premiereMs: Date.parse("2026-11-17T08:05:00Z"), derniereMs: Date.parse("2026-11-17T21:40:00Z"),
          parAppli: [{ nom: "WINWORD.EXE", ms: 128 * M }, { nom: "opera.exe", ms: 84 * M }, { nom: "RobloxPlayerBeta.exe", ms: 61 * M }, { nom: "Discord.exe", ms: 27 * M }, { nom: "Calculatrice", ms: 12 * M }],
          parFenetre: [{ nom: "WINWORD.EXE — Mémoire de stage.docx - Word", ms: 120 * M }, { nom: "opera.exe — YouTube - Opera", ms: 50 * M }],
          parHeure: [0, 0, 0, 0, 0, 0, 0, 0, 0, 40, 55, 50, 20, 0, 10, 45, 30, 0, 12, 0, 25, 25, 0, 0].map((x) => x * M),
          parJour: [312 * M],
          periodes: [{ debutMs: Date.parse("2026-11-17T08:05:00Z"), finMs: Date.parse("2026-11-17T11:30:00Z") }, { debutMs: Date.parse("2026-11-17T14:10:00Z"), finMs: Date.parse("2026-11-17T16:20:00Z") }],
          parProjet: [{ nom: "Mémoire", ms: 128 * M }],
        },
        chrono: { fichier: "chrono.json", executable: true, projets: [{ nom: "Mémoire", couleur: "#ffb23f", archive: false, ms: 95 * M }] },
        fichiersTouches: 14,
      };
    }
    case "a_l_instant":
      return { segment: { debutMs: Date.parse("2026-11-17T14:10:00Z"), finMs: Date.parse("2026-11-17T14:55:00Z"), appli: "WINWORD.EXE", titre: "Mémoire de stage.docx - Word" }, autour: evenements.slice(0, 3) };
    case "fichiers":
      return [{ chemin: "C:\\Users\\exemple\\Documents\\Factures\\Facture EDF novembre.pdf", chemins: ["C:\\Users\\exemple\\Downloads\\facture_8841.pdf", "C:\\Users\\exemple\\Downloads\\Facture EDF novembre.pdf", "C:\\Users\\exemple\\Documents\\Factures\\Facture EDF novembre.pdf"], evenements: [], supprime: false, telecharge: true, renomme: true, premierMs: Date.now() - 86400_000, dernierMs: Date.now() - 3600_000 }];
    case "chrono_projets":
      return ["Mémoire"];
    case "absence":
      reglages = { ...reglages, absentDepuisMs: args!.actif ? Date.now() : null };
      return etat();
    case "securite_etat":
      return securite;
    case "analyser_defender":
      return [false, "Scan finished. found no threats."];
    case "etat":
      return etat();
    case "enregistrer_reglages":
      reglages = { ...(args!.nouveaux as Reglages), collecteActive: reglages.collecteActive, pauseJusquaMs: reglages.pauseJusquaMs };
      return etat();
    case "activer_collecte":
      reglages = { ...reglages, collecteActive: !!args!.actif, pauseJusquaMs: null };
      return etat();
    case "pause":
      reglages = { ...reglages, pauseJusquaMs: args!.minutes ? Date.now() + (args!.minutes as number) * 60_000 : 9e15 };
      return etat();
    case "reprendre":
      reglages = { ...reglages, pauseJusquaMs: null };
      return etat();
    case "evenements":
      return evenements.filter(
        (e) =>
          (!f.categorie || e.categorie === f.categorie) &&
          (!f.mots || norm(`${e.contenu.sujet} ${e.contenu.chemin ?? ""} ${e.contenu.appli ?? ""}`).includes(norm(f.mots))) &&
          (!f.auMs || (e.evenement ?? e.detection).utcMs < f.auMs),
      );
    case "conversations":
      return convs.filter((c) => !args?.appli || c.appli === args.appli);
    case "messages":
      return messages.filter(
        (m) =>
          (!f.conversation || m.conversation === f.conversation) &&
          (!f.appli || m.appli === f.appli) &&
          (!f.mots || norm(m.versions.map((v) => v.texte).join(" ")).includes(norm(f.mots))) &&
          (!f.categorie || (f.categorie === "supprime" ? m.etat !== "present" : f.categorie === "modifie" ? m.versions.some((v) => v.statut === "modifiee") : m.etat === f.categorie)),
      );
    case "demarrage_auto":
    case "appliquer_conservation":
      return etat();
    default:
      return null;
  }
}
