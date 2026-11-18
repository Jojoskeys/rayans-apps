// Rayan's Télécommande sur l'iPhone : pilote le PC à travers Tailscale (HTTPS, réseau privé), avec le code
// d'association affiché par Rayan's Télécommande sur le PC. Rien n'est synchronisé par GitHub : tout passe en direct.
import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { mountChrome } from "../shared/chrome.ts";
import "./telecommande.css";
import { appel, ecrireConfig, INJOIGNABLE, lireConfig, normaliserAdresse, quand, taille, type Config } from "../shared/pc.ts";

// ----- Connexion au PC : voir shared/pc.ts (partagée avec la tuile Studio) ----------------------------

/** Envoi d'un fichier avec progression (XMLHttpRequest : fetch ne donne pas la progression de l'envoi). */
function envoyerFichier(cfg: Config, f: File, progression: (p: number) => void): Promise<{ nom: string }> {
  return new Promise((ok, ko) => {
    const x = new XMLHttpRequest();
    x.open("POST", cfg.adresse + "/api/envoi");
    x.setRequestHeader("Authorization", `Bearer ${cfg.code}`);
    x.setRequestHeader("X-Nom-Fichier", encodeURIComponent(f.name));
    x.upload.onprogress = (e) => { if (e.lengthComputable) progression(e.loaded / e.total); };
    x.onload = () => { try { const j = JSON.parse(x.responseText); if (x.status === 200) ok(j); else ko(new Error(j.erreur ?? `erreur ${x.status}`)); } catch { ko(new Error(`erreur ${x.status}`)); } };
    x.onerror = () => ko(new Error(INJOIGNABLE));
    x.send(f);
  });
}

/** Récupère un fichier du PC ; l'enregistrement se fait ensuite d'un toucher (iOS exige un geste pour partager). */
async function recuperer(cfg: Config, chemin: string): Promise<File> {
  const r = await appel<Response>(cfg, chemin, { brut: true, timeout: 10 * 60_000 });
  const nom = decodeURIComponent(r.headers.get("X-Nom-Fichier") ?? "fichier");
  const b = await r.blob();
  return new File([b], nom, { type: b.type || "application/octet-stream" });
}

function enregistrer(f: File) {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [f] })) { void navigator.share({ files: [f] }).catch(() => {}); return; }
  const u = URL.createObjectURL(f);
  const a = document.createElement("a"); a.href = u; a.download = f.name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 60_000);
}

const duree = (ms: number) => { const m = Math.floor(ms / 60_000); return m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${Math.floor(m / 1440)} j ${Math.floor((m % 1440) / 60)} h`; };

// ----- Interface ------------------------------------------------------------------------------------

type Onglet = "accueil" | "applis" | "fichiers" | "plus";

function App() {
  const [cfg, setCfg] = useState<Config | null>(lireConfig);
  const [onglet, setOnglet] = useState<Onglet>("accueil");
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const dire = useCallback((ok: boolean, texte: string) => setMessage({ ok, texte }), []);
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(null), message.ok ? 4000 : 9000); return () => clearTimeout(t); }, [message]);

  if (!cfg) return <div className="tc"><Association onOk={(c) => { ecrireConfig(c); setCfg(c); }} /></div>;
  const proteger = async (f: () => Promise<unknown>) => { try { await f(); } catch (e) { dire(false, String((e as Error).message ?? e)); } };
  const p = { cfg, dire, proteger };
  return (
    <div className="tc">
      <h1>Télécommande</h1>
      <nav className="onglets">
        {([["accueil", "PC"], ["applis", "Applis"], ["fichiers", "Fichiers"], ["plus", "Plus"]] as const).map(([id, nom]) => (
          <button key={id} className={onglet === id ? "actif" : ""} onClick={() => setOnglet(id)}>{nom}</button>
        ))}
      </nav>
      {message && <p className={`toast ${message.ok ? "ok" : "ko"}`} onClick={() => setMessage(null)}>{message.texte}</p>}
      {onglet === "accueil" && <Accueil {...p} />}
      {onglet === "applis" && <Applis {...p} />}
      {onglet === "fichiers" && <Fichiers {...p} />}
      {onglet === "plus" && <Plus {...p} oublier={() => { if (confirm("Oublier l'adresse et le code sur ce téléphone ?")) { ecrireConfig(null); setCfg(null); } }} />}
    </div>
  );
}
interface P { cfg: Config; dire: (ok: boolean, t: string) => void; proteger: (f: () => Promise<unknown>) => Promise<void> }

function Association({ onOk }: { onOk: (c: Config) => void }) {
  const [adresse, setAdresse] = useState(lireConfig()?.adresse ?? "");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tester = async () => {
    setBusy(true); setMsg(null);
    const c = { adresse: normaliserAdresse(adresse), code: code.toUpperCase().replace(/[^A-Z0-9]/g, "") };
    try { await appel(c, "/api/sante"); onOk(c); } catch (e) { setMsg(String((e as Error).message ?? e)); } finally { setBusy(false); }
  };
  return (
    <section className="carte">
      <h1>Télécommande</h1>
      <p>Pilote ton PC depuis l'iPhone, où que tu sois. Sur le PC, ouvre <b>Rayan's Télécommande</b> : elle affiche l'adresse et le code à recopier ici.</p>
      <label>Adresse du PC<input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="https://rayan.tail….ts.net" autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="url" /></label>
      <label>Code<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCDE-FGHJK-MNPQR-STUVW" autoCapitalize="characters" autoCorrect="off" spellCheck={false} /></label>
      <button className="bouton" disabled={busy || !adresse.trim() || code.replace(/[^A-Za-z0-9]/g, "").length < 20} onClick={() => void tester()}>{busy ? "Connexion…" : "Associer"}</button>
      {msg && <p className="ko">{msg}</p>}
      <p className="petit">Tailscale doit être activé sur l'iPhone. Le code reste sur ce téléphone ; « Nouveau code » sur le PC le révoque.</p>
    </section>
  );
}

// ----- PC : état, alimentation, scénarios -----------------------------------------------------------

interface EtatPc {
  nom: string; demarreDepuis: number; cpu: number; memoire: { total: number; libre: number };
  disques: { lettre: string; total: number; libre: number }[];
  wifi: { connecte: boolean; ssid: string | null; signal: number | null };
  version: string; appareils: { nom: string; systeme: string; enLigne: boolean }[];
  reglages: { autoriserArret: boolean; autoriserVeille: boolean }; boite: number;
}

function Accueil({ cfg, dire, proteger }: P) {
  const [etat, setEtat] = useState<EtatPc | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<{ id: string; nom: string; icone: string; etapes: number }[]>([]);
  const [arretEnCours, setArretEnCours] = useState(false);
  const charger = useCallback(async () => {
    try { setEtat(await appel<EtatPc>(cfg, "/api/etat")); setErreur(null); } catch (e) { setErreur(String((e as Error).message)); }
    try { setScenarios((await appel<{ scenarios: typeof scenarios }>(cfg, "/api/scenarios")).scenarios); } catch { /* déjà signalé */ }
  }, [cfg]);
  useEffect(() => { void charger(); const t = setInterval(() => void charger(), 10_000); return () => clearInterval(t); }, [charger]);

  const action = (a: string, confirmation?: string) => proteger(async () => {
    const r = await appel<{ message: string }>(cfg, "/api/action", { corps: { action: a, confirmation } });
    dire(true, r.message);
    if (a === "redemarrer" || a === "eteindre") setArretEnCours(true);
    if (a === "annuler") setArretEnCours(false);
  });

  const c = etat?.disques.find((d) => d.lettre === "C");
  return (
    <>
      <section className="carte">
        <div className="titre-carte">
          <h2>{etat?.nom ?? "PC"}</h2>
          <span className={`puce ${etat ? "vert" : erreur ? "rouge" : ""}`}>{etat ? "En ligne" : erreur ? "Injoignable" : "…"}</span>
        </div>
        {erreur && <p className="ko">{erreur}</p>}
        {etat && (
          <div className="mesures">
            <div><small>Allumé depuis</small><b>{duree(Date.now() - etat.demarreDepuis)}</b></div>
            <div><small>Processeur</small><b>{etat.cpu} %</b></div>
            <div><small>Mémoire</small><b>{Math.round((1 - etat.memoire.libre / etat.memoire.total) * 100)} %</b></div>
            {c && <div><small>Disque C:</small><b>{taille(c.libre)} libres</b></div>}
            <div className="large"><small>Wi-Fi</small><b>{etat.wifi.connecte ? `${etat.wifi.ssid} · ${etat.wifi.signal ?? "?"} %` : "déconnecté"}</b></div>
            {etat.boite > 0 && <div className="large"><small>Depuis le PC</small><b>{etat.boite} élément(s) t'attendent dans Fichiers</b></div>}
          </div>
        )}
      </section>

      <section className="carte">
        <h2>Alimentation</h2>
        <div className="grille-boutons">
          <button className="gros" onClick={() => void action("verrouiller")}>🔒<span>Verrouiller</span></button>
          <button className="gros" onClick={() => { if (confirm("Redémarrer le PC dans 20 secondes ? Il revient tout seul ; la télécommande répondra de nouveau après ta connexion à Windows (Bureau à distance).")) void action("redemarrer"); }}>🔄<span>Redémarrer</span></button>
          {etat?.reglages.autoriserVeille && <button className="gros" onClick={() => { if (confirm("Mettre le PC en veille ? En Wi-Fi, tu ne pourras PAS le réveiller à distance.")) void action("veille", "VEILLE"); }}>🌙<span>Veille</span></button>}
          {etat?.reglages.autoriserArret && <button className="gros danger" onClick={() => { if (confirm("Éteindre le PC ? Tu ne pourras PAS le rallumer à distance.") && confirm("Sûr ? Il faudra appuyer sur le bouton du PC pour le rallumer.")) void action("eteindre", "ETEINDRE"); }}>⏻<span>Éteindre</span></button>}
        </div>
        {arretEnCours && <button className="bouton secondaire" onClick={() => void action("annuler")}>Annuler le redémarrage / l'arrêt</button>}
        <p className="petit">Allumer le PC à distance n'est pas possible : il est en Wi-Fi. C'est pour ça qu'il reste allumé (écran éteint). {!etat?.reglages.autoriserArret && "L'arrêt et la veille à distance sont désactivés (option dans l'app du PC)."}</p>
      </section>

      <section className="carte">
        <h2>Scénarios</h2>
        {scenarios.length === 0 && <p>Aucun scénario.</p>}
        <div className="grille-boutons">
          {scenarios.map((s) => (
            <button key={s.id} className="gros" disabled={!s.etapes} onClick={() => void proteger(async () => { const r = await appel<{ ok: boolean; message: string }>(cfg, "/api/scenarios/lancer", { corps: { id: s.id }, timeout: 60_000 }); dire(r.ok, r.message); })}>
              {s.icone}<span>{s.nom}</span>{!s.etapes && <small>vide</small>}
            </button>
          ))}
        </div>
        <p className="petit">Les scénarios se composent dans Rayan's Télécommande sur le PC.</p>
      </section>
    </>
  );
}

// ----- Applis et fenêtres ---------------------------------------------------------------------------

function Applis({ cfg, dire, proteger }: P) {
  const [applis, setApplis] = useState<{ id: string; nom: string; dossier: string }[] | null>(null);
  const [fenetres, setFenetres] = useState<{ pid: number; processus: string; titre: string }[] | null>(null);
  const [filtre, setFiltre] = useState("");
  const chargerFenetres = useCallback(() => proteger(async () => setFenetres((await appel<{ fenetres: NonNullable<typeof fenetres> }>(cfg, "/api/fenetres")).fenetres)), [cfg, proteger]);
  useEffect(() => {
    void proteger(async () => setApplis((await appel<{ applis: NonNullable<typeof applis> }>(cfg, "/api/applis")).applis));
    void chargerFenetres();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg]);
  const f = filtre.trim().toLowerCase();
  const visibles = (applis ?? []).filter((a) => !f || a.nom.toLowerCase().includes(f)).slice(0, f ? 60 : 30);
  const fermer = (w: { pid: number; titre: string }, forcer: boolean) => proteger(async () => {
    await appel(cfg, "/api/fenetres/fermer", { corps: { pid: w.pid, forcer, titre: w.titre } });
    dire(true, forcer ? "Programme arrêté." : "Fermeture demandée (le programme peut demander d'enregistrer).");
    setTimeout(() => void chargerFenetres(), 1500);
  });
  return (
    <>
      <section className="carte">
        <div className="titre-carte"><h2>Ouvert sur le PC</h2><button className="lien" onClick={() => void chargerFenetres()}>Actualiser</button></div>
        {!fenetres ? <p>Chargement…</p> : fenetres.length === 0 ? <p>Aucune fenêtre ouverte.</p> : (
          <ul className="liste">{fenetres.map((w) => (
            <li key={w.pid}>
              <span className="texte"><b>{w.titre}</b><small>{w.processus}</small></span>
              <button className="lien" onClick={() => void fermer(w, false)}>Fermer</button>
              <button className="lien danger" onClick={() => { if (confirm(`Arrêter ${w.processus} de force ? Ce qui n'est pas enregistré sera perdu.`)) void fermer(w, true); }}>Forcer</button>
            </li>
          ))}</ul>
        )}
      </section>
      <section className="carte">
        <h2>Lancer une application</h2>
        <input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Rechercher (Chrome, Steam, Word…)" autoCorrect="off" />
        {!applis ? <p>Chargement…</p> : (
          <ul className="liste">{visibles.map((a) => (
            <li key={a.id}>
              <span className="texte"><b>{a.nom}</b>{a.dossier && <small>{a.dossier}</small>}</span>
              <button className="lien accent" onClick={() => void proteger(async () => { const r = await appel<{ message: string }>(cfg, "/api/applis/lancer", { corps: { id: a.id } }); dire(true, r.message); setTimeout(() => void chargerFenetres(), 3000); })}>Lancer</button>
            </li>
          ))}</ul>
        )}
        {applis && !f && applis.length > 30 && <p className="petit">{applis.length} applications : tape un nom pour trouver les autres.</p>}
      </section>
    </>
  );
}

// ----- Fichiers -------------------------------------------------------------------------------------

function Fichiers({ cfg, dire, proteger }: P) {
  const entree = useRef<HTMLInputElement>(null);
  const [envois, setEnvois] = useState<{ nom: string; p: number; fini?: boolean; erreur?: string }[]>([]);
  const [prets, setPrets] = useState<Record<string, File>>({});
  const [boite, setBoite] = useState<{ id: string; type: "fichier" | "texte"; nom: string; taille: number; at: number }[]>([]);
  const [racines, setRacines] = useState<{ id: string; nom: string }[]>([]);
  const [lieu, setLieu] = useState<{ racine: string; chemin: string } | null>(null);
  const [entrees, setEntrees] = useState<{ nom: string; dossier: boolean; taille: number; modifie: number }[]>([]);
  const [lien, setLien] = useState("");
  const [telechargements, setTelechargements] = useState<{ id: string; nom: string; recu: number; total: number | null; etat: string; erreur?: string }[]>([]);
  const [prep, setPrep] = useState<string | null>(null);

  const chargerBoite = useCallback(() => proteger(async () => setBoite((await appel<{ elements: typeof boite }>(cfg, "/api/boite")).elements)), [cfg, proteger]);
  useEffect(() => {
    void chargerBoite();
    void proteger(async () => setRacines((await appel<{ racines: typeof racines }>(cfg, "/api/dossiers")).racines));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg]);
  useEffect(() => {
    if (!lieu) return;
    void proteger(async () => setEntrees((await appel<{ entrees: typeof entrees }>(cfg, `/api/dossiers?racine=${encodeURIComponent(lieu.racine)}&chemin=${encodeURIComponent(lieu.chemin)}`)).entrees));
  }, [lieu, cfg, proteger]);
  useEffect(() => {
    if (!telechargements.some((t) => t.etat === "en cours")) return;
    const t = setInterval(() => void appel<{ telechargements: typeof telechargements }>(cfg, "/api/telechargements").then((r) => setTelechargements(r.telechargements)).catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [telechargements, cfg]);

  const envoyer = async (liste: FileList | null) => {
    if (!liste?.length) return;
    const fichiers = [...liste];
    setEnvois((e) => [...fichiers.map((f) => ({ nom: f.name, p: 0 })), ...e]);
    for (const f of fichiers) {
      const maj = (x: Partial<{ p: number; fini: boolean; erreur: string }>) => setEnvois((e) => e.map((y) => (y.nom === f.name && !y.fini && !y.erreur ? { ...y, ...x } : y)));
      try { await envoyerFichier(cfg, f, (p) => maj({ p })); maj({ p: 1, fini: true }); }
      catch (e) { maj({ erreur: String((e as Error).message) }); }
    }
    if (entree.current) entree.current.value = "";
  };
  const preparer = (cle: string, chemin: string) => proteger(async () => {
    setPrep(cle);
    try { const f = await recuperer(cfg, chemin); setPrets((p) => ({ ...p, [cle]: f })); } finally { setPrep(null); }
  });
  const boutonRecup = (cle: string, chemin: string) => prets[cle]
    ? <button className="lien accent" onClick={() => enregistrer(prets[cle])}>Enregistrer</button>
    : <button className="lien" disabled={prep === cle} onClick={() => void preparer(cle, chemin)}>{prep === cle ? "…" : "Récupérer"}</button>;

  const remonter = () => { if (!lieu) return; if (!lieu.chemin) { setLieu(null); return; } setLieu({ ...lieu, chemin: lieu.chemin.split("/").slice(0, -1).join("/") }); };

  return (
    <>
      <section className="carte">
        <h2>Envoyer au PC</h2>
        <input ref={entree} type="file" multiple hidden onChange={(e) => void envoyer(e.target.files)} />
        <button className="bouton" onClick={() => entree.current?.click()}>Choisir des photos ou des fichiers</button>
        <p className="petit">Ils arrivent dans Téléchargements\Depuis le téléphone, sur le PC.</p>
        {envois.length > 0 && <ul className="liste">{envois.slice(0, 10).map((e, i) => (
          <li key={i}><span className="texte"><b>{e.nom}</b><small className={e.erreur ? "ko" : e.fini ? "ok" : ""}>{e.erreur ?? (e.fini ? "Reçu par le PC ✓" : `${Math.round(e.p * 100)} %`)}</small></span></li>
        ))}</ul>}
      </section>

      <section className="carte">
        <div className="titre-carte"><h2>Depuis le PC</h2><button className="lien" onClick={() => void chargerBoite()}>Actualiser</button></div>
        {boite.length === 0 ? <p>Rien en attente. Sur le PC : Rayan's Télécommande → Envoyer au téléphone.</p> : (
          <ul className="liste">{boite.map((b) => (
            <li key={b.id}>
              <span className="texte"><b>{b.type === "texte" ? "📝" : "📄"} {b.nom}</b><small>{taille(b.taille)} · {quand(b.at)}</small></span>
              {b.type === "texte"
                ? <button className="lien accent" onClick={() => void proteger(async () => { const r = await appel<{ texte: string }>(cfg, `/api/boite/element?id=${b.id}`); await navigator.clipboard.writeText(r.texte).then(() => dire(true, "Texte copié sur l'iPhone."), () => { prompt("Copie ce texte :", r.texte); }); })}>Copier</button>
                : boutonRecup(`b-${b.id}`, `/api/boite/element?id=${b.id}`)}
              <button className="lien danger" onClick={() => void proteger(async () => { await appel(cfg, "/api/boite/supprimer", { corps: { id: b.id } }); void chargerBoite(); })}>×</button>
            </li>
          ))}</ul>
        )}
      </section>

      <section className="carte">
        <h2>Parcourir le PC</h2>
        {!lieu ? (
          <div className="grille-boutons">{racines.map((r) => <button key={r.id} className="gros" onClick={() => setLieu({ racine: r.id, chemin: "" })}>📁<span>{r.nom}</span></button>)}</div>
        ) : (
          <>
            <div className="chemin"><button className="lien" onClick={remonter}>‹ Retour</button><span>{racines.find((r) => r.id === lieu.racine)?.nom}{lieu.chemin && ` / ${lieu.chemin.replace(/\//g, " / ")}`}</span></div>
            <ul className="liste">
              {entrees.length === 0 && <li><span className="texte"><small>Dossier vide</small></span></li>}
              {entrees.map((e) => {
                const ch = lieu.chemin ? `${lieu.chemin}/${e.nom}` : e.nom;
                return e.dossier
                  ? <li key={e.nom} className="cliquable" onClick={() => setLieu({ ...lieu, chemin: ch })}><span className="texte"><b>📁 {e.nom}</b></span><span className="fleche">›</span></li>
                  : <li key={e.nom}><span className="texte"><b>{e.nom}</b><small>{taille(e.taille)} · {quand(e.modifie)}</small></span>{boutonRecup(`f-${lieu.racine}-${ch}`, `/api/fichier?racine=${encodeURIComponent(lieu.racine)}&chemin=${encodeURIComponent(ch)}`)}</li>;
              })}
            </ul>
          </>
        )}
      </section>

      <section className="carte">
        <h2>Télécharger sur le PC</h2>
        <p className="petit">Colle un lien : le PC le télécharge lui-même dans Téléchargements (pratique pour les gros fichiers).</p>
        <input value={lien} onChange={(e) => setLien(e.target.value)} placeholder="https://…" autoCapitalize="none" autoCorrect="off" inputMode="url" />
        <button className="bouton secondaire" disabled={!/^https?:\/\/\S+$/i.test(lien.trim())} onClick={() => void proteger(async () => {
          await appel(cfg, "/api/telecharger", { corps: { url: lien.trim() } }); setLien("");
          setTelechargements((await appel<{ telechargements: typeof telechargements }>(cfg, "/api/telechargements")).telechargements);
        })}>Télécharger sur le PC</button>
        {telechargements.length > 0 && <ul className="liste">{telechargements.slice(0, 5).map((t) => (
          <li key={t.id}><span className="texte"><b>{t.nom}</b><small className={t.etat === "échec" ? "ko" : t.etat === "terminé" ? "ok" : ""}>{t.etat === "en cours" ? `${taille(t.recu)}${t.total ? ` / ${taille(t.total)}` : ""}` : t.etat === "échec" ? `Échec : ${t.erreur}` : "Terminé ✓"}</small></span></li>
        ))}</ul>}
      </section>
    </>
  );
}

// ----- Plus : presse-papiers, Wi-Fi, journal, réglages ----------------------------------------------

function Plus({ cfg, dire, proteger, oublier }: P & { oublier: () => void }) {
  const [texte, setTexte] = useState("");
  const [wifi, setWifi] = useState<{ actuel: { ssid: string | null; signal: number | null; profil: string | null }; profils: string[]; bascule: { vers: string; etat: string } | null } | null>(null);
  const [journal, setJournal] = useState<{ evenements: { at: number; quoi: string; detail?: string }[]; bureau: { at: number; utilisateur: string; adresse: string }[] } | null>(null);
  const chargerWifi = useCallback(() => proteger(async () => setWifi(await appel(cfg, "/api/wifi"))), [cfg, proteger]);
  return (
    <>
      <section className="carte">
        <h2>Presse-papiers</h2>
        <div className="ligne">
          <button className="bouton secondaire" onClick={() => void proteger(async () => {
            const r = await appel<{ texte: string }>(cfg, "/api/presse-papiers");
            if (!r.texte) { dire(true, "Le presse-papiers du PC est vide (ou contient une image)."); return; }
            setTexte(r.texte);
            await navigator.clipboard.writeText(r.texte).then(() => dire(true, "Copié depuis le PC ✓"), () => dire(true, "Texte du PC affiché ci-dessous : touche-le longuement pour le copier."));
          })}>PC → iPhone</button>
          <button className="bouton secondaire" onClick={() => void proteger(async () => {
            let t = texte;
            if (!t.trim()) { try { t = await navigator.clipboard.readText(); } catch { /* refusé */ } }
            if (!t.trim()) { dire(false, "Rien à envoyer : écris ou colle un texte dans le champ."); return; }
            await appel(cfg, "/api/presse-papiers", { corps: { texte: t } }); dire(true, "Copié sur le PC ✓ (Ctrl+V pour coller)");
          })}>iPhone → PC</button>
        </div>
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={3} placeholder="Texte à envoyer au PC (vide : le presse-papiers de l'iPhone)" />
      </section>

      <section className="carte">
        <div className="titre-carte"><h2>Wi-Fi du PC</h2>{!wifi && <button className="lien accent" onClick={() => void chargerWifi()}>Afficher</button>}</div>
        {wifi && (
          <>
            <p>Réseau actuel : <b>{wifi.actuel.ssid ?? "aucun"}</b>{wifi.actuel.signal ? ` (${wifi.actuel.signal} %)` : ""}</p>
            {wifi.bascule && <p className="petit">Dernier changement vers « {wifi.bascule.vers} » : {wifi.bascule.etat}</p>}
            <p className="petit">Changer de réseau coupe la télécommande quelques secondes. Si le PC n'obtient pas Internet et Tailscale sur le nouveau réseau en 60 s, il revient tout seul sur l'actuel. Seuls les réseaux déjà enregistrés sur le PC sont proposés ; un PC hors ligne ne peut pas être reconnecté à distance.</p>
            <ul className="liste">{wifi.profils.map((p) => (
              <li key={p}><span className="texte"><b>{p}</b></span>{p === wifi.actuel.profil ? <small className="ok">actuel</small> : <button className="lien accent" onClick={() => { if (confirm(`Passer le PC sur « ${p} » ?`)) void proteger(async () => { const r = await appel<{ message: string }>(cfg, "/api/wifi", { corps: { profil: p } }); dire(true, r.message); setTimeout(() => void chargerWifi(), 75_000); }); }}>Rejoindre</button>}</li>
            ))}</ul>
          </>
        )}
      </section>

      <section className="carte">
        <div className="titre-carte"><h2>Journal et sécurité</h2><button className="lien accent" onClick={() => void proteger(async () => setJournal(await appel(cfg, "/api/journal")))}>{journal ? "Actualiser" : "Afficher"}</button></div>
        {journal && (
          <>
            <h3>Connexions Bureau à distance</h3>
            {journal.bureau.length === 0 ? <p className="petit">Aucune récemment.</p> : <ul className="journal">{journal.bureau.map((b, i) => <li key={i}><time>{quand(b.at)}</time> {b.utilisateur} depuis {b.adresse}</li>)}</ul>}
            <h3>Télécommande</h3>
            <ul className="journal">{journal.evenements.slice(0, 30).map((j, i) => <li key={i}><time>{quand(j.at)}</time> {j.quoi}{j.detail ? ` · ${j.detail}` : ""}</li>)}</ul>
          </>
        )}
      </section>

      <section className="carte">
        <h2>Autres</h2>
        <a className="bouton secondaire" href="https://www.icloud.com/find" target="_blank" rel="noreferrer">Localiser / faire sonner un appareil (iCloud)</a>
        <p className="petit">Écran et souris du PC : ouvre l'app <b>Windows App</b>. Téléphone perdu : sur le PC, « Nouveau code » dans Rayan's Télécommande, puis retire l'iPhone dans la console Tailscale.</p>
        <p className="petit">PC : {cfg.adresse}</p>
        <button className="lien danger" onClick={oublier}>Oublier ce PC sur l'iPhone</button>
      </section>
    </>
  );
}

mountChrome([]);
createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
