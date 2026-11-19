// Serveur de la télécommande. Il n'écoute que sur 127.0.0.1 : il n'est joignable de l'extérieur qu'à travers
// « tailscale serve » (HTTPS, réseau Tailscale seulement). Chaque requête doit porter :
//   - l'en-tête Tailscale-User-Login ajouté par Tailscale, égal au compte propriétaire du PC ;
//   - le code d'association (Authorization: Bearer …), comparé à temps constant, avec limite d'essais.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { app, clipboard, shell } from "electron";
import { codeValide, LimiteEssais, ORIGINES } from "../core/securite.ts";
import { nomDepuisUrl, nomLibre, nomSur, resoudre, type Racine } from "../core/chemins.ts";
import { profilValide } from "../core/wifi.ts";
import type { Donnees } from "../core/donnees.ts";
import * as studio from "../core/studio.ts";
import * as papiers from "../core/papiers.ts";
import * as favoris from "../core/favoris.ts";
import * as bonnesAffaires from "../core/bonnes-affaires.ts";
import { abonnementValide, ErreurRappel } from "../core/minuteurs.ts";
import type { Push } from "./push.ts";
import type { AlertesAffaires } from "./alertes-affaires.ts";
import * as sys from "./systeme.ts";
import { etatTailscale, PORT } from "./tailscale.ts";

export interface Contexte {
  donnees(): Donnees;
  journaliser(quoi: string, detail?: string): void;
  dossierBoite: string;
  /** Appelé à chaque requête acceptée (notification « iPhone connecté »). */
  utilise(appareil: string): void;
  alerte(titre: string, texte: string): void;
  changeBoite(): void;
  /** Rappels de fin de minuteur (Rayan's Chrono sur l'iPhone). */
  push: Push;
  /** Notifications des pépites de Rayan's Bonnes Affaires. */
  alertesAffaires: AlertesAffaires;
  version: string;
}

const dossiersUtilisateur = (): Racine[] => {
  const p = (n: Parameters<typeof app.getPath>[0]) => { try { return app.getPath(n); } catch { return ""; } };
  return [
    { id: "bureau", nom: "Bureau", chemin: p("desktop") },
    { id: "documents", nom: "Documents", chemin: p("documents") },
    { id: "telechargements", nom: "Téléchargements", chemin: p("downloads") },
    { id: "images", nom: "Images", chemin: p("pictures") },
    { id: "videos", nom: "Vidéos", chemin: p("videos") },
    { id: "musique", nom: "Musique", chemin: p("music") },
  ].filter((r) => r.chemin && fs.existsSync(r.chemin));
};

export const dossierReception = () => path.join(app.getPath("downloads"), "Depuis le téléphone");
/** Vidéos du Studio déposées par Claude pour validation (voir core/studio.ts). */
export const dossierStudio = () => path.join(app.getPath("videos"), "Rayan's Studio", "A valider");
export const dossierScripts = () => path.join(app.getPath("videos"), "Rayan's Studio", "Scripts");
export const fichierIdees = () => path.join(app.getPath("videos"), "Rayan's Studio", "idees.json");
/** Photos de documents envoyées depuis la tuile Papiers (voir core/papiers.ts). */
export const dossierPapiers = () => path.join(app.getPath("documents"), "Rayan's Papiers");
/** Liens et vidéos envoyés depuis la tuile Favoris, lus par l'app Python favoris/ (voir core/favoris.ts). */
export const dossierFavoris = () => path.join(app.getPath("documents"), "Rayan's Favoris");
/** Classement déposé par l'app bonnes-affaires/ (voir core/bonnes-affaires.ts), lu par la tuile Bonnes affaires. */
export const dossierBonnesAffaires = () => path.join(app.getPath("documents"), "Rayan's Bonnes Affaires");

class ErreurHttp extends Error { code: number; constructor(code: number, message: string) { super(message); this.code = code; } }

async function lireJson(req: http.IncomingMessage, max = 64 * 1024): Promise<Record<string, unknown>> {
  const morceaux: Buffer[] = [];
  let n = 0;
  for await (const m of req) { n += (m as Buffer).length; if (n > max) throw new ErreurHttp(413, "requête trop grande"); morceaux.push(m as Buffer); }
  if (!n) return {};
  try { const j = JSON.parse(Buffer.concat(morceaux).toString("utf8")); return j && typeof j === "object" ? j : {}; }
  catch { throw new ErreurHttp(400, "JSON invalide"); }
}

// Téléchargements lancés depuis le téléphone (en mémoire, les 20 derniers).
interface Telechargement { id: string; url: string; nom: string; recu: number; total: number | null; etat: "en cours" | "terminé" | "échec"; erreur?: string; at: number }
const telechargements: Telechargement[] = [];

// Bascule Wi-Fi en cours (une seule à la fois).
let basculeWifi: { vers: string; depuis: string | null; etat: string; at: number } | null = null;

export function demarrerServeur(ctx: Contexte, obtenirProprietaire: () => string | null) {
  const limite = new LimiteEssais();
  let applisCache: { at: number; liste: sys.Appli[] } | null = null;
  const applis = () => { if (!applisCache || Date.now() - applisCache.at > 60_000) applisCache = { at: Date.now(), liste: sys.applisMenuDemarrer() }; return applisCache.liste; };

  const serveur = http.createServer(async (req, res) => {
    const origine = req.headers.origin;
    const entetesCors: Record<string, string> = origine && ORIGINES.includes(origine)
      ? { "Access-Control-Allow-Origin": origine, "Vary": "Origin", "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Nom-Fichier", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Expose-Headers": "Content-Disposition, X-Nom-Fichier", "Access-Control-Max-Age": "600" }
      : {};
    const envoyer = (code: number, corps: unknown) => {
      res.writeHead(code, { ...entetesCors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      res.end(JSON.stringify(corps));
    };
    if (req.method === "OPTIONS") { res.writeHead(204, entetesCors); res.end(); return; }

    try {
      // ----- Authentification -----
      const login = req.headers["tailscale-user-login"];
      const proprietaire = obtenirProprietaire();
      if (!proprietaire || typeof login !== "string" || login.toLowerCase() !== proprietaire.toLowerCase()) throw new ErreurHttp(403, "accès réservé à ton compte Tailscale");
      if (limite.bloque()) throw new ErreurHttp(429, "trop d'essais avec un mauvais code : réessaie dans 15 minutes");
      const jeton = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (!codeValide(jeton, ctx.donnees().code)) {
        if (limite.echec()) { ctx.journaliser("Télécommande bloquée 15 min", "trop de codes faux"); ctx.alerte("Rayan's Télécommande", "Trop d'essais avec un mauvais code : la télécommande est bloquée 15 minutes."); }
        throw new ErreurHttp(401, "code d'association incorrect");
      }
      limite.reussite();
      const appareil = String(req.headers["tailscale-user-name"] ?? login);
      ctx.utilise(appareil);

      const url = new URL(req.url ?? "/", "http://pc");
      const route = `${req.method} ${url.pathname}`;
      const d = ctx.donnees();

      switch (route) {
        case "GET /api/sante":
          return envoyer(200, { ok: true, nom: (await sys.etatSysteme()).nom, version: ctx.version });

        case "GET /api/etat": {
          const [s, ts] = await Promise.all([sys.etatSysteme(), etatTailscale()]);
          return envoyer(200, { ...s, version: ctx.version, appareils: ts.appareils, reglages: { autoriserArret: d.reglages.autoriserArret, autoriserVeille: d.reglages.autoriserVeille }, boite: d.boite.length, basculeWifi });
        }

        case "POST /api/action": {
          const b = await lireJson(req);
          const a = String(b.action ?? "");
          if (a === "verrouiller") { ctx.journaliser("PC verrouillé depuis le téléphone"); sys.verrouiller(); return envoyer(200, { ok: true, message: "PC verrouillé." }); }
          if (a === "redemarrer") { await sys.arret("redemarrer", 20); ctx.journaliser("Redémarrage demandé depuis le téléphone"); return envoyer(200, { ok: true, message: "Redémarrage dans 20 secondes. Tu peux encore l'annuler." }); }
          if (a === "annuler") { await sys.annulerArret(); ctx.journaliser("Redémarrage/arrêt annulé depuis le téléphone"); return envoyer(200, { ok: true, message: "Annulé." }); }
          if (a === "eteindre") {
            if (!d.reglages.autoriserArret) throw new ErreurHttp(403, "l'arrêt à distance est désactivé dans Rayan's Télécommande sur le PC (le PC ne pourrait pas être rallumé à distance)");
            if (b.confirmation !== "ETEINDRE") throw new ErreurHttp(400, "confirmation manquante");
            await sys.arret("eteindre", 30); ctx.journaliser("Arrêt demandé depuis le téléphone");
            return envoyer(200, { ok: true, message: "Arrêt dans 30 secondes. Après, il faudra appuyer sur le bouton du PC pour le rallumer." });
          }
          if (a === "veille") {
            if (!d.reglages.autoriserVeille) throw new ErreurHttp(403, "la mise en veille à distance est désactivée sur le PC (en Wi-Fi, il ne pourrait pas être réveillé à distance)");
            if (b.confirmation !== "VEILLE") throw new ErreurHttp(400, "confirmation manquante");
            ctx.journaliser("Mise en veille depuis le téléphone");
            setTimeout(() => sys.veille(), 1500);
            return envoyer(200, { ok: true, message: "Mise en veille. Il faudra toucher la souris ou le clavier du PC pour le réveiller." });
          }
          throw new ErreurHttp(400, "action inconnue");
        }

        case "GET /api/applis":
          return envoyer(200, { applis: applis().map(({ id, nom, dossier }) => ({ id, nom, dossier })) });

        case "POST /api/applis/lancer": {
          const b = await lireJson(req);
          const a = applis().find((x) => x.id === b.id);
          if (!a) throw new ErreurHttp(404, "application introuvable");
          const err = await shell.openPath(a.chemin);
          if (err) throw new ErreurHttp(500, err);
          ctx.journaliser("Application lancée", a.nom);
          return envoyer(200, { ok: true, message: `${a.nom} lancé.` });
        }

        case "GET /api/fenetres":
          return envoyer(200, { fenetres: await sys.fenetres() });

        case "POST /api/fenetres/fermer": {
          const b = await lireJson(req);
          try { await sys.fermerFenetre(Number(b.pid), b.forcer === true); } catch (e) { throw new ErreurHttp(400, String((e as Error).message)); }
          ctx.journaliser(b.forcer ? "Programme arrêté de force" : "Fenêtre fermée", String(b.titre ?? b.pid));
          return envoyer(200, { ok: true });
        }

        case "GET /api/scenarios":
          return envoyer(200, { scenarios: d.scenarios.map((s) => ({ id: s.id, nom: s.nom, icone: s.icone, etapes: s.etapes.length })) });

        case "POST /api/scenarios/lancer": {
          const b = await lireJson(req);
          const s = d.scenarios.find((x) => x.id === b.id);
          if (!s) throw new ErreurHttp(404, "scénario introuvable");
          if (!s.etapes.length) throw new ErreurHttp(400, "ce scénario est vide : ajoute des étapes dans Rayan's Télécommande sur le PC");
          const erreurs: string[] = [];
          for (const e of s.etapes) {
            try {
              if (e.type === "ouvrir") {
                if (/^https?:\/\//i.test(e.cible)) await shell.openExternal(e.cible);
                else { const m = await shell.openPath(e.cible); if (m) erreurs.push(`${e.nom} : ${m}`); }
              } else await sys.fermerProcessus(e.processus);
            } catch (x) { erreurs.push(String((x as Error).message)); }
            await new Promise((r) => setTimeout(r, 400));
          }
          ctx.journaliser("Scénario lancé", s.nom);
          return envoyer(200, { ok: !erreurs.length, message: erreurs.length ? `Terminé avec ${erreurs.length} problème(s) : ${erreurs.join(" ; ")}` : `« ${s.nom} » terminé.` });
        }

        case "GET /api/dossiers": {
          const racines = dossiersUtilisateur();
          const id = url.searchParams.get("racine");
          if (!id) return envoyer(200, { racines: racines.map(({ id, nom }) => ({ id, nom })), entrees: [] });
          const rel = url.searchParams.get("chemin") ?? "";
          const p = resoudre(racines, id, rel, fs.realpathSync.native);
          if (!p || !fs.existsSync(p) || !fs.statSync(p).isDirectory()) throw new ErreurHttp(404, "dossier introuvable");
          const entrees = fs.readdirSync(p, { withFileTypes: true })
            .filter((e) => !e.name.startsWith(".") && !/^(desktop\.ini|thumbs\.db)$/i.test(e.name))
            .map((e) => { let taille = 0, modifie = 0; try { const st = fs.statSync(path.join(p, e.name)); taille = st.size; modifie = st.mtimeMs; } catch { /* inaccessible */ } return { nom: e.name, dossier: e.isDirectory(), taille, modifie }; })
            .sort((a, b) => (a.dossier === b.dossier ? b.modifie - a.modifie : a.dossier ? -1 : 1))
            .slice(0, 500);
          return envoyer(200, { racines: racines.map(({ id, nom }) => ({ id, nom })), entrees });
        }

        case "GET /api/fichier": {
          const p = resoudre(dossiersUtilisateur(), url.searchParams.get("racine") ?? "", url.searchParams.get("chemin") ?? "", fs.realpathSync.native);
          if (!p || !fs.existsSync(p) || !fs.statSync(p).isFile()) throw new ErreurHttp(404, "fichier introuvable");
          const nom = path.basename(p);
          ctx.journaliser("Fichier envoyé au téléphone", nom);
          res.writeHead(200, { ...entetesCors, "Content-Type": "application/octet-stream", "Content-Length": String(fs.statSync(p).size), "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nom)}`, "X-Nom-Fichier": encodeURIComponent(nom), "Cache-Control": "no-store" });
          await pipeline(fs.createReadStream(p), res);
          return;
        }

        case "POST /api/envoi": {
          const brut = String(req.headers["x-nom-fichier"] ?? "fichier");
          let nom: string; try { nom = nomSur(decodeURIComponent(brut)); } catch { nom = nomSur(brut); }
          const dir = dossierReception();
          fs.mkdirSync(dir, { recursive: true });
          nom = nomLibre(nom, (n) => fs.existsSync(path.join(dir, n)));
          const dest = path.join(dir, nom), tmp = dest + ".partiel";
          try { await pipeline(req, fs.createWriteStream(tmp)); fs.renameSync(tmp, dest); }
          catch (e) { fs.rmSync(tmp, { force: true }); throw e; }
          ctx.journaliser("Fichier reçu du téléphone", nom);
          return envoyer(200, { ok: true, nom, dossier: dir });
        }

        case "POST /api/telecharger": {
          const b = await lireJson(req);
          const lien = String(b.url ?? "").trim();
          if (!/^https?:\/\/[^\s]+$/i.test(lien)) throw new ErreurHttp(400, "lien invalide (il doit commencer par http:// ou https://)");
          const t: Telechargement = { id: randomUUID(), url: lien, nom: nomDepuisUrl(lien), recu: 0, total: null, etat: "en cours", at: Date.now() };
          telechargements.unshift(t); telechargements.splice(20);
          void telecharger(t, ctx);
          return envoyer(200, { ok: true, id: t.id });
        }

        case "GET /api/telechargements":
          return envoyer(200, { telechargements });

        case "GET /api/presse-papiers":
          // Selon la version d'Electron, la lecture est synchrone ou renvoie une promesse.
          return envoyer(200, { texte: String(await Promise.resolve(clipboard.readText()) ?? "") });

        case "POST /api/presse-papiers": {
          const b = await lireJson(req, 2 * 1024 * 1024);
          await Promise.resolve(clipboard.writeText(String(b.texte ?? "")));
          ctx.journaliser("Presse-papiers du PC remplacé depuis le téléphone");
          return envoyer(200, { ok: true });
        }

        case "GET /api/wifi": {
          const [actuel, profils] = await Promise.all([sys.wifi(), sys.profilsWifi()]);
          return envoyer(200, { actuel, profils, bascule: basculeWifi });
        }

        case "POST /api/wifi": {
          const b = await lireJson(req);
          const vers = String(b.profil ?? "");
          const profils = await sys.profilsWifi();
          if (!profilValide(vers, profils)) throw new ErreurHttp(400, "réseau inconnu : seuls les réseaux déjà enregistrés sur le PC sont proposés");
          if (basculeWifi && basculeWifi.etat === "en cours") throw new ErreurHttp(409, "un changement de réseau est déjà en cours");
          const avant = (await sys.wifi()).profil;
          if (avant === vers) return envoyer(200, { ok: true, message: "Le PC est déjà sur ce réseau." });
          basculeWifi = { vers, depuis: avant, etat: "en cours", at: Date.now() };
          ctx.journaliser("Changement de Wi-Fi demandé", `${avant ?? "aucun"} → ${vers}`);
          // Réponse d'abord : la connexion du téléphone va être coupée pendant la bascule.
          envoyer(200, { ok: true, message: `Le PC passe sur « ${vers} ». La connexion va être coupée quelques secondes. S'il n'arrive pas à rejoindre Internet et Tailscale en 60 secondes, il revient tout seul sur « ${avant ?? "l'ancien réseau"} ».` });
          setTimeout(() => void basculer(vers, avant, ctx), 1500);
          return;
        }

        case "GET /api/boite":
          return envoyer(200, { elements: d.boite });

        case "GET /api/boite/element": {
          const id = url.searchParams.get("id") ?? "";
          const el = d.boite.find((e) => e.id === id);
          if (!el) throw new ErreurHttp(404, "élément introuvable");
          const p = path.join(ctx.dossierBoite, el.id);
          if (el.type === "texte") return envoyer(200, { texte: fs.readFileSync(p, "utf8") });
          res.writeHead(200, { ...entetesCors, "Content-Type": "application/octet-stream", "Content-Length": String(fs.statSync(p).size), "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(el.nom)}`, "X-Nom-Fichier": encodeURIComponent(el.nom), "Cache-Control": "no-store" });
          await pipeline(fs.createReadStream(p), res);
          return;
        }

        case "POST /api/boite/supprimer": {
          const b = await lireJson(req);
          const el = d.boite.find((e) => e.id === b.id);
          if (el) { fs.rmSync(path.join(ctx.dossierBoite, el.id), { force: true }); d.boite = d.boite.filter((e) => e !== el); ctx.changeBoite(); }
          return envoyer(200, { ok: true });
        }

        case "GET /api/studio":
          return envoyer(200, { videos: studio.lister(dossierStudio()) });

        case "GET /api/studio/video": {
          const p = studio.cheminVideo(dossierStudio(), url.searchParams.get("id") ?? "");
          if (!p) throw new ErreurHttp(404, "vidéo introuvable");
          res.writeHead(200, { ...entetesCors, "Content-Type": "video/mp4", "Content-Length": String(fs.statSync(p).size), "Cache-Control": "no-store" });
          await pipeline(fs.createReadStream(p), res);
          return;
        }

        case "POST /api/studio/retour": {
          const b = await lireJson(req);
          const id = String(b.id ?? "");
          let r: studio.Retour;
          try { r = studio.ajouterRetour(dossierStudio(), id, Number(b.version), String(b.verdict ?? ""), String(b.commentaire ?? "")); }
          catch (e) { if (e instanceof studio.ErreurRetour) throw new ErreurHttp(e.code, e.message); throw e; }
          const titre = studio.lister(dossierStudio()).find((v) => v.id === id)?.titre ?? id;
          ctx.journaliser(r.verdict === "ok" ? "Vidéo validée" : "Vidéo à corriger", titre);
          ctx.alerte("Rayan's Studio", r.verdict === "ok" ? `Validée : ${titre}` : `À corriger : ${titre}\n${r.commentaire.slice(0, 200)}`);
          return envoyer(200, { ok: true, retour: r });
        }

        case "GET /api/studio/scripts":
          return envoyer(200, { scripts: studio.listerScripts(dossierScripts()) });

        case "POST /api/studio/script/retour": {
          const b = await lireJson(req);
          const id = String(b.id ?? "");
          let r: studio.Retour;
          try { r = studio.ajouterRetourScript(dossierScripts(), id, Number(b.version), String(b.verdict ?? ""), String(b.commentaire ?? "")); }
          catch (e) { if (e instanceof studio.ErreurRetour) throw new ErreurHttp(e.code, e.message); throw e; }
          const titre = studio.listerScripts(dossierScripts()).find((v) => v.id === id)?.titre ?? id;
          ctx.journaliser(r.verdict === "ok" ? "Script validé" : "Script à corriger", titre);
          ctx.alerte("Rayan's Studio", r.verdict === "ok" ? `Script validé : ${titre}` : `Script à corriger : ${titre}\n${r.commentaire.slice(0, 200)}`);
          return envoyer(200, { ok: true, retour: r });
        }

        case "GET /api/studio/idees":
          return envoyer(200, { idees: studio.listerIdees(fichierIdees()) });

        case "POST /api/studio/idees": {
          const b = await lireJson(req);
          let idee: studio.Idee;
          try { idee = studio.ajouterIdee(fichierIdees(), String(b.texte ?? ""), String(b.compte ?? "")); }
          catch (e) { if (e instanceof studio.ErreurRetour) throw new ErreurHttp(e.code, e.message); throw e; }
          ctx.journaliser("Nouvelle idée de vidéo", idee.texte.slice(0, 80));
          ctx.alerte("Rayan's Studio", `Nouvelle idée : ${idee.texte.slice(0, 200)}`);
          return envoyer(200, { ok: true, idee });
        }

        case "POST /api/studio/idees/supprimer": {
          const b = await lireJson(req);
          try { studio.supprimerIdee(fichierIdees(), String(b.id ?? "")); }
          catch (e) { if (e instanceof studio.ErreurRetour) throw new ErreurHttp(e.code, e.message); throw e; }
          return envoyer(200, { ok: true });
        }

        // ----- Rayan's Bonnes Affaires : classement des annonces, en lecture seule -----
        case "GET /api/bonnes-affaires":
          return envoyer(200, bonnesAffaires.lire(dossierBonnesAffaires()));

        case "GET /api/bonnes-affaires/cle":
          return envoyer(200, { cle: ctx.push.cle });

        case "POST /api/bonnes-affaires/abonnement": {
          const b = await lireJson(req);
          try { await ctx.alertesAffaires.abonner(abonnementValide(b.abonnement)); }
          catch (e) { throw new ErreurHttp(e instanceof ErreurRappel ? 400 : 502, e instanceof ErreurRappel ? e.message : `le service de notification a refusé l'envoi (${(e as { statusCode?: number }).statusCode ?? "réseau"})`); }
          return envoyer(200, { ok: true });
        }

        case "POST /api/bonnes-affaires/desabonnement": {
          const b = await lireJson(req);
          ctx.alertesAffaires.desabonner(String(b.endpoint ?? ""));
          return envoyer(200, { ok: true });
        }

        case "POST /api/bonnes-affaires/statut": {
          const b = await lireJson(req);
          return envoyer(200, { abonne: ctx.alertesAffaires.abonne(String(b.endpoint ?? "")) });
        }

        // ----- Rayan's Favoris : liens et vidéos à analyser par Claude -----
        case "GET /api/favoris":
          return envoyer(200, favoris.resume(dossierFavoris()));

        case "POST /api/favoris": {
          const b = await lireJson(req);
          try { favoris.deposerLien(dossierFavoris(), String(b.lien ?? ""), String(b.note ?? "")); }
          catch (e) { if (e instanceof favoris.ErreurFavori) throw new ErreurHttp(e.code, e.message); throw e; }
          ctx.journaliser("Favori reçu du téléphone");
          return envoyer(200, { ok: true });
        }

        case "POST /api/favoris/video": {
          const ext = favoris.VIDEOS[String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase()];
          if (!ext) throw new ErreurHttp(415, "envoie une vidéo (MP4, MOV ou WebM)");
          if (Number(req.headers["content-length"]) > favoris.TAILLE_MAX) throw new ErreurHttp(413, "vidéo trop lourde (500 Mo au plus)");
          const dir = path.join(dossierFavoris(), "a-deposer");
          fs.mkdirSync(dir, { recursive: true });
          const chemin = path.join(dir, `iphone-${Date.now()}.${ext}`), tmp = chemin + ".partiel";
          let n = 0;
          try {
            await pipeline(req, async function* (source) { for await (const m of source) { n += (m as Buffer).length; if (n > favoris.TAILLE_MAX) throw new ErreurHttp(413, "vidéo trop lourde (500 Mo au plus)"); yield m; } }, fs.createWriteStream(tmp));
            fs.renameSync(tmp, chemin);
          } catch (e) { fs.rmSync(tmp, { force: true }); throw e; }
          let note = String(req.headers["x-nom-fichier"] ?? ""); // en-tête déjà autorisé : ici, la note de Rayan
          try { note = decodeURIComponent(note); } catch { /* note brute */ }
          if (note) fs.writeFileSync(chemin + ".note.txt", note.slice(0, 500), "utf8");
          ctx.journaliser("Vidéo de favori reçue du téléphone");
          return envoyer(200, { ok: true });
        }

        // ----- Rayan's Papiers : photos de documents, texte lu par l'OCR de Windows -----
        case "GET /api/papiers":
          return envoyer(200, { papiers: papiers.chercher(papiers.lireIndex(dossierPapiers()), url.searchParams.get("q") ?? "") });

        case "GET /api/papiers/image": {
          const p = papiers.lireIndex(dossierPapiers()).find((x) => x.id === url.searchParams.get("id"));
          const chemin = p && papiers.cheminPapier(dossierPapiers(), p);
          if (!p || !chemin || !fs.existsSync(chemin)) throw new ErreurHttp(404, "papier introuvable");
          res.writeHead(200, { ...entetesCors, "Content-Type": papiers.TYPES[p.ext], "Content-Length": String(fs.statSync(chemin).size), "Cache-Control": "no-store" });
          await pipeline(fs.createReadStream(chemin), res);
          return;
        }

        case "POST /api/papiers": {
          const ext = papiers.extensionDe(req.headers["content-type"]);
          if (!ext) throw new ErreurHttp(415, "envoie une photo (JPEG, PNG ou HEIC)");
          if (Number(req.headers["content-length"]) > papiers.TAILLE_MAX) throw new ErreurHttp(413, "photo trop lourde (25 Mo au plus)");
          let titre = String(req.headers["x-nom-fichier"] ?? "");
          try { titre = decodeURIComponent(titre); } catch { /* titre brut */ }
          const dir = dossierPapiers();
          fs.mkdirSync(dir, { recursive: true });
          const id = randomUUID();
          const chemin = papiers.cheminPapier(dir, { id, ext }), tmp = chemin + ".partiel";
          let n = 0;
          try {
            await pipeline(req, async function* (source) { for await (const m of source) { n += (m as Buffer).length; if (n > papiers.TAILLE_MAX) throw new ErreurHttp(413, "photo trop lourde (25 Mo au plus)"); yield m; } }, fs.createWriteStream(tmp));
            fs.renameSync(tmp, chemin);
          } catch (e) { fs.rmSync(tmp, { force: true }); throw e; }
          let texte = "", ocr = "ok";
          try { texte = (await sys.lireTexteImage(chemin)).trim(); if (!texte) ocr = "vide"; }
          catch (e) { ocr = String((e as Error).message ?? e).slice(0, 300); }
          const p = papiers.ajouterPapier(dir, { id, titre, ext, texte, ajoute: Date.now(), taille: n, ocr });
          ctx.journaliser("Papier reçu du téléphone", p.titre);
          return envoyer(200, { ok: true, papier: papiers.chercher([p], "")[0] });
        }

        case "POST /api/papiers/renommer": {
          const b = await lireJson(req);
          try { papiers.renommerPapier(dossierPapiers(), String(b.id ?? ""), String(b.titre ?? "")); }
          catch (e) { if (e instanceof papiers.ErreurPapier) throw new ErreurHttp(e.code, e.message); throw e; }
          return envoyer(200, { ok: true });
        }

        case "POST /api/papiers/supprimer": {
          const b = await lireJson(req);
          try { papiers.supprimerPapier(dossierPapiers(), String(b.id ?? "")); }
          catch (e) { if (e instanceof papiers.ErreurPapier) throw new ErreurHttp(e.code, e.message); throw e; }
          ctx.journaliser("Papier supprimé depuis le téléphone");
          return envoyer(200, { ok: true });
        }

        // ----- Rayan's Chrono : notification de fin de minuteur, écran éteint -----
        case "GET /api/chrono/cle":
          return envoyer(200, { cle: ctx.push.cle });

        case "POST /api/chrono/programmer": {
          const b = await lireJson(req);
          try { ctx.push.programmer(b); } catch (e) { if (e instanceof ErreurRappel) throw new ErreurHttp(400, e.message); throw e; }
          return envoyer(200, { ok: true });
        }

        case "POST /api/chrono/annuler": {
          const b = await lireJson(req);
          ctx.push.annuler(b.endpoint);
          return envoyer(200, { ok: true });
        }

        case "POST /api/chrono/essai": {
          const b = await lireJson(req);
          try { await ctx.push.envoyer({ abonnement: abonnementValide(b.abonnement), titre: "Rayan's Chrono", texte: "Essai réussi : tu seras prévenu à la fin du minuteur." }); }
          catch (e) { throw new ErreurHttp(e instanceof ErreurRappel ? 400 : 502, e instanceof ErreurRappel ? e.message : `le service de notification a refusé l'envoi (${(e as { statusCode?: number }).statusCode ?? "réseau"})`); }
          return envoyer(200, { ok: true });
        }

        case "GET /api/journal": {
          const bureau = await sys.connexionsBureau(10);
          return envoyer(200, { evenements: d.journal.slice(-60).reverse(), bureau });
        }
      }
      throw new ErreurHttp(404, "adresse inconnue");
    } catch (e) {
      if (res.headersSent) { res.destroy(); return; }
      const code = e instanceof ErreurHttp ? e.code : 500;
      envoyer(code, { ok: false, erreur: String((e as Error).message ?? e) });
    }
  });
  serveur.requestTimeout = 0; // gros fichiers
  serveur.listen(PORT, "127.0.0.1");
  return serveur;
}

async function telecharger(t: Telechargement, ctx: Contexte) {
  const dir = app.getPath("downloads");
  try {
    const r = await fetch(t.url, { redirect: "follow" });
    if (!r.ok || !r.body) throw new Error(`le site a répondu ${r.status}`);
    t.nom = nomLibre(nomDepuisUrl(r.url || t.url, r.headers.get("content-disposition")), (n) => fs.existsSync(path.join(dir, n)));
    const total = Number(r.headers.get("content-length")); t.total = total > 0 ? total : null;
    const dest = path.join(dir, t.nom), tmp = dest + ".partiel";
    const flux = Readable.fromWeb(r.body as import("node:stream/web").ReadableStream);
    flux.on("data", (m: Buffer) => { t.recu += m.length; });
    try { await pipeline(flux, fs.createWriteStream(tmp)); fs.renameSync(tmp, dest); }
    catch (e) { fs.rmSync(tmp, { force: true }); throw e; }
    t.etat = "terminé";
    ctx.journaliser("Téléchargement terminé", t.nom);
  } catch (e) {
    t.etat = "échec"; t.erreur = String((e as Error).message ?? e);
    ctx.journaliser("Téléchargement échoué", `${t.nom} : ${t.erreur}`);
  }
}

/** Changement de Wi-Fi avec retour automatique si Internet + Tailscale ne reviennent pas en 60 s. */
async function basculer(vers: string, depuis: string | null, ctx: Contexte) {
  const netsh = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "netsh.exe");
  const enLigne = async () => {
    const w = await sys.wifi();
    if (w.profil !== vers) return false;
    const ts = await etatTailscale();
    if (!ts.connecte) return false;
    try { const r = await fetch("https://controlplane.tailscale.com/", { method: "HEAD", signal: AbortSignal.timeout(5000) }); return r.status > 0; } catch { return false; }
  };
  try {
    await sys.executer(netsh, ["wlan", "connect", `name=${vers}`]);
    const fin = Date.now() + 60_000;
    while (Date.now() < fin) {
      await new Promise((r) => setTimeout(r, 4000));
      if (await enLigne()) { basculeWifi = { vers, depuis, etat: "réussi", at: Date.now() }; ctx.journaliser("Wi-Fi changé", vers); return; }
    }
    throw new Error("pas d'Internet ou de Tailscale sur le nouveau réseau");
  } catch (e) {
    if (depuis) await sys.executer(netsh, ["wlan", "connect", `name=${depuis}`]).catch(() => "");
    basculeWifi = { vers, depuis, etat: `annulé : retour sur « ${depuis ?? "?"} » (${String((e as Error).message ?? e)})`, at: Date.now() };
    ctx.journaliser("Changement de Wi-Fi annulé", basculeWifi.etat);
  }
}
