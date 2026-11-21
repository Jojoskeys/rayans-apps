// Rayan's Mobile : écran d'accueil, avec une barre d'onglets en bas (Accueil, Apps, Alertes, Réglages).
import { StrictMode, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { getConfig, onStatus, setConfig, setupKey, syncApp, testConfig, type SyncStatus } from "../shared/sync.ts";
import { APPS, type MobileApp } from "../shared/apps.ts";
import { Notifications } from "./Notifications.tsx";
import { Personnaliser } from "./Personnaliser.tsx";
import { appliquerApparence, derniereApp, lireApparence, trier } from "../shared/apparence.ts";
import "./hub.css";

declare const __BUILD__: string;

type Onglet ="accueil" | "apps" | "alertes" | "reglages";
type SousPage = "" | "perso" | "synchro";
const ONGLETS: Onglet[] = ["accueil", "apps", "alertes", "reglages"];

/** Onglet et sous-page lus dans l'adresse (#apps, #reglages/synchro…) : le bouton retour du téléphone marche. */
function lireAdresse(): { onglet: Onglet; sous: SousPage } {
  const [o, s] = location.hash.slice(1).split("/");
  const onglet = (ONGLETS as string[]).includes(o) ? (o as Onglet) : "accueil";
  const sous = onglet === "reglages" && (s === "perso" || s === "synchro") ? s : "";
  return { onglet, sous };
}
function aller(onglet: Onglet, sous: SousPage = "") {
  const h = onglet === "accueil" ? "" : `#${onglet}${sous ? `/${sous}` : ""}`;
  history.pushState(null, "", h || location.pathname + location.search);
  dispatchEvent(new HashChangeEvent("hashchange"));
}

function Hub() {
  const [adr, setAdr] = useState(lireAdresse);
  const [a, setA] = useState(lireApparence);
  const [st, setSt] = useState<SyncStatus | null>(null);
  useEffect(() => onStatus(setSt), []);
  useEffect(() => {
    const maj = () => { setAdr(lireAdresse()); scrollTo(0, 0); };
    addEventListener("hashchange", maj); addEventListener("popstate", maj);
    return () => { removeEventListener("hashchange", maj); removeEventListener("popstate", maj); };
  }, []);
  // Premier lancement : rien n'est configuré, on ouvre directement la synchronisation.
  useEffect(() => {
    if (!getConfig() && !location.hash) { history.replaceState(null, "", "#reglages/synchro"); setAdr(lireAdresse()); }
  }, []);

  const visibles = trier(APPS, a).filter((x) => !a.masquees.includes(x.id));
  const { onglet, sous } = adr;
  const alerteSynchro = st?.state === "erreur";

  return (
    <>
      <div className="hub">
        {onglet === "accueil" && <Accueil a={a} visibles={visibles} st={st} />}
        {onglet === "apps" && <ToutesLesApps visibles={visibles} />}
        {onglet === "alertes" && (
          <>
            <Titre>Alertes</Titre>
            {st?.configured ? <Notifications /> : (
              <section className="carte"><p>Les alertes passent par la synchronisation avec le PC. Configure-la d'abord dans <b>Réglages</b>.</p>
                <button className="bouton" onClick={() => aller("reglages", "synchro")}>Configurer la synchronisation</button></section>
            )}
          </>
        )}
        {onglet === "reglages" && (sous === "perso" ? <Personnaliser a={a} onChange={setA} onDone={() => aller("reglages")} />
          : sous === "synchro" ? <Synchro onDone={() => aller("reglages")} />
          : <Reglages st={st} />)}
      </div>
      <nav className="barre" aria-label="Navigation">
        <BoutonOnglet o="accueil" actif={onglet} nom="Accueil" icone={<IcAccueil />} />
        <BoutonOnglet o="apps" actif={onglet} nom="Apps" icone={<IcApps />} />
        <BoutonOnglet o="alertes" actif={onglet} nom="Alertes" icone={<IcCloche />} />
        <BoutonOnglet o="reglages" actif={onglet} nom="Réglages" icone={<IcReglages />} pastille={alerteSynchro} />
      </nav>
    </>
  );
}

function BoutonOnglet({ o, actif, nom, icone, pastille }: { o: Onglet; actif: Onglet; nom: string; icone: ReactNode; pastille?: boolean }) {
  const on = o === actif;
  return (
    <button className={on ? "actif" : ""} aria-current={on ? "page" : undefined} data-testid={`onglet-${o}`}
      onClick={() => (on ? (o === "reglages" ? aller("reglages") : scrollTo({ top: 0, behavior: "smooth" })) : aller(o))}>
      <span className="ic">{icone}{pastille && <i className="point" />}</span>
      <span>{nom}</span>
    </button>
  );
}

function Titre({ children, sous }: { children: ReactNode; sous?: string }) {
  return <header>{sous && <p className="sous">{sous}</p>}<h1>{children}</h1></header>;
}

function Tuile({ x }: { x: MobileApp }) {
  return (
    <li>
      <a href={`./${x.id}/`} style={{ ["--c" as string]: x.color }}>
        <span className="icone">{x.icon}</span>
        <b>{x.name}</b>
        <small>{x.tagline}</small>
      </a>
    </li>
  );
}

function Accueil({ a, visibles, st }: { a: ReturnType<typeof lireApparence>; visibles: MobileApp[]; st: SyncStatus | null }) {
  const heure = new Date().getHours();
  const salut = heure < 5 ? "Bonne nuit" : heure < 18 ? "Bonjour" : "Bonsoir";
  const favoris = a.favoris.map((id) => visibles.find((x) => x.id === id)).filter((x): x is MobileApp => !!x);
  const apps = visibles.filter((x) => !a.favoris.includes(x.id));
  const derniere = a.reprendre ? derniereApp() : null;
  const reprise = derniere && Date.now() - derniere.at < 12 * 3600_000 ? APPS.find((x) => x.id === derniere.id) : undefined;
  return (
    <>
      <Titre sous={a.afficherDate ? new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : undefined}>
        {a.prenom.trim() ? <>{salut} <span className="prenom">{a.prenom.trim()}</span></> : salut}
      </Titre>
      {reprise && (
        <a className="reprendre" href={`./${reprise.id}/`} style={{ ["--c" as string]: reprise.color }}>
          <span className="icone">{reprise.icon}</span>
          <span><small>Reprendre</small><b>{reprise.name}</b></span>
          <span className="fleche">›</span>
        </a>
      )}
      {favoris.length > 0 && (
        <>
          <h2 className="section">★ Favoris</h2>
          <ul className={`tuiles favoris taille-${a.tailleTuiles}`}>{favoris.map((x) => <Tuile key={x.id} x={x} />)}</ul>
          {apps.length > 0 && <h2 className="section">Autres apps</h2>}
        </>
      )}
      <ul className={`tuiles ${a.disposition} taille-${a.tailleTuiles}`}>{apps.map((x) => <Tuile key={x.id} x={x} />)}</ul>
      {a.afficherEtat && <p className="etat">{st?.configured ? (st.lastSync ? `Synchronisé ${new Date(st.lastSync).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : "Pas encore synchronisé") : "Synchronisation non configurée : tes données restent sur ce téléphone."}{st?.state === "erreur" ? ` · ${st.message}` : ""}</p>}
    </>
  );
}

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function ToutesLesApps({ visibles }: { visibles: MobileApp[] }) {
  const [q, setQ] = useState("");
  const liste = [...visibles].sort((x, y) => x.name.localeCompare(y.name, "fr"))
    .filter((x) => !q.trim() || sansAccents(`${x.name} ${x.tagline}`).includes(sansAccents(q.trim())));
  return (
    <>
      <Titre>Apps</Titre>
      <label className="recherche">
        <IcLoupe />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Chercher parmi ${visibles.length} apps`} autoCorrect="off" spellCheck={false} data-testid="recherche-apps" />
      </label>
      <ul className="tuiles liste toutes">{liste.map((x) => <Tuile key={x.id} x={x} />)}</ul>
      {liste.length === 0 && <p className="etat">Aucune app ne correspond à « {q} ».</p>}
    </>
  );
}

function Reglages({ st }: { st: SyncStatus | null }) {
  const synchro = st?.configured ? (st.state === "erreur" ? `Problème : ${st.message}` : st.state === "hors-ligne" ? "Hors ligne" : st.lastSync ? `Synchronisé ${new Date(st.lastSync).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : "Configurée") : "Pas encore configurée";
  return (
    <>
      <Titre>Réglages</Titre>
      <ul className="menu">
        <li><button onClick={() => aller("reglages", "perso")} data-testid="bouton-personnaliser">
          <span className="icone" style={{ ["--c" as string]: "#E86FA8" }}>🎨</span>
          <span><b>Personnaliser</b><small>Thème, couleur, tuiles, icône</small></span><span className="fleche">›</span>
        </button></li>
        <li><button onClick={() => aller("reglages", "synchro")}>
          <span className="icone" style={{ ["--c" as string]: st?.state === "erreur" ? "#E8594F" : "#3BA776" }}>⟳</span>
          <span><b>Synchronisation avec le PC</b><small className={st?.state === "erreur" ? "ko" : ""}>{synchro}</small></span><span className="fleche">›</span>
        </button></li>
      </ul>
      <p className="version">Version du {new Date(__BUILD__).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</p>
    </>
  );
}

// ----- Icônes de la barre (traits simples, couleur du texte) -----
const svg = (d: ReactNode) => <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const IcAccueil = () => svg(<><path d="M3.5 10.5 12 3.5l8.5 7" /><path d="M5.5 9v10.5h4.5v-6h4v6h4.5V9" /></>);
const IcApps = () => svg(<><rect x="4" y="4" width="6.5" height="6.5" rx="2" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="2" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="2" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2" /></>);
const IcCloche = () => svg(<><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>);
const IcReglages = () => svg(<><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /></>);
const IcLoupe = () => svg(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.4-4.4" /></>);

function Synchro({ onDone }: { onDone: () => void }) {
  const cfg = getConfig();
  const [repo, setRepo] = useState(cfg?.repo ?? "Jojoskeys/rayans-donnees");
  const [token, setToken] = useState("");
  const [phrase, setPhrase] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const access = { repo, token: token || cfg?.token || "" };
      await testConfig(access);
      const k = phrase ? await setupKey(access, phrase) : cfg ? { key: cfg.key, created: false } : null;
      if (!k) throw new Error("tape ta phrase secrète");
      setConfig({ ...access, key: k.key });
      setToken(""); setPhrase("");
      for (const a of APPS) for (const f of a.files) await syncApp(f);
      setMsg(`✓ ${k.created ? "Chiffrement créé avec ta phrase secrète. " : "Phrase secrète reconnue. "}Données chiffrées et synchronisées.`);
    } catch (e) { setMsg(`✗ ${String((e as Error).message ?? e)}`); } finally { setBusy(false); }
  };
  return (
    <section className="carte">
      <h2>Synchronisation avec le PC</h2>
      <p>Tes données passent par un <b>dépôt GitHub privé</b>, <b>chiffrées sur ce téléphone</b> avec ta phrase secrète : GitHub ne voit que du contenu illisible.</p>
      <ol>
        <li>Sur github.com : Settings → Developer settings → <b>Fine-grained tokens</b> → Generate new token.</li>
        <li>Repository access : <b>Only select repositories</b> → rayans-donnees. Permissions : <b>Contents : Read and write</b>.</li>
        <li>Colle le jeton ci-dessous et tape ta phrase secrète (la même sur le PC et l'iPhone).</li>
      </ol>
      <label>Dépôt<input value={repo} onChange={(e) => setRepo(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
      <label>Jeton d'accès<input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={cfg ? "déjà enregistré (laisser vide pour le garder)" : "github_pat_…"} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
      <label>Phrase secrète<input type="password" value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder={cfg ? "déjà enregistrée (laisser vide pour la garder)" : "plusieurs mots, 12 caractères au moins"} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
      <p className="avertissement">Note-la quelque part de sûr : <b>sans elle, les données synchronisées ne peuvent pas être relues</b> (personne ne peut la retrouver, pas même moi). Les données déjà sur chaque appareil restent intactes.</p>
      <div className="ligne">
        <button className="bouton" disabled={busy || (!cfg && (!token || !phrase))} onClick={save}>{busy ? "Vérification…" : "Enregistrer et synchroniser"}</button>
        <button className="lien" onClick={onDone}>Retour</button>
      </div>
      {msg && <p className={msg.startsWith("✓") ? "ok" : "ko"}>{msg}</p>}
      {cfg && <button className="lien danger" onClick={() => { if (confirm("Oublier le jeton et la clé sur ce téléphone ? Les données restent sur l'appareil.")) { setConfig(null); location.reload(); } }}>Oublier le jeton et la clé</button>}
    </section>
  );
}

appliquerApparence();
// App ouverte directement au lancement (sauf retour volontaire à l'accueil : « ?accueil », ou un onglet demandé).
{
  const dem = lireApparence().demarrage;
  if (dem && APPS.some((x) => x.id === dem) && !new URLSearchParams(location.search).has("accueil") && !location.hash) location.replace(`./${dem}/`);
}
createRoot(document.getElementById("racine")!).render(<StrictMode><Hub /></StrictMode>);
if ("serviceWorker" in navigator) {
  // Nouvelle version installée pendant que l'app est ouverte : on recharge une fois pour l'utiliser tout de suite.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  void navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then((r) => r.update()).catch(() => {});
}
