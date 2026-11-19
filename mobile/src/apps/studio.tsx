// Rayan's Studio sur l'iPhone (ou dans le navigateur du PC) : Claude dépose les vidéos à valider sur le PC,
// Rayan les regarde ici et répond « C'est bon » ou ce qu'il faut corriger. Tout passe par Rayan's Télécommande
// (Tailscale + code d'association) : les vidéos restent sur le PC, les réponses y sont enregistrées pour Claude.
import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { mountChrome } from "../shared/chrome.ts";
import { appel, INJOIGNABLE, lireConfig, quand, taille, type Config } from "../shared/pc.ts";
import "./telecommande.css";
import "./studio.css";

interface Retour { version: number; verdict: "ok" | "corriger"; commentaire: string; at: number }
interface Video { id: string; titre: string; texte: string; note: string; version: number; envoye: number; taille: number; retours: Retour[] }

const reponseActuelle = (v: Video) => [...v.retours].reverse().find((r) => r.version === v.version);

/** Nom du fichier partagé : le titre, lisible par les amis (« L'histoire de Qâroûn.mp4 »). */
const nomFichier = (v: Video) => `${v.titre.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || v.id}.mp4`;

/**
 * iPhone : feuille de partage (Enregistrer la vidéo, Messages, WhatsApp, Snapchat…).
 * Ailleurs (PC, ou si le partage de fichiers n'existe pas) : téléchargement classique.
 */
async function partager(f: File): Promise<"partage" | "telecharge" | "annule"> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [f] })) {
    try { await navigator.share({ files: [f] }); return "partage"; }
    catch (e) { if ((e as Error).name === "AbortError") return "annule"; }
  }
  const u = URL.createObjectURL(f);
  const a = document.createElement("a"); a.href = u; a.download = f.name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 60_000);
  return "telecharge";
}
const minutes = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Télécharge la vidéo avec sa progression (l'en-tête du code empêche de la lire directement depuis le PC). */
async function chargerVideo(cfg: Config, id: string, progression: (p: number) => void): Promise<string> {
  const r = await appel<Response>(cfg, `/api/studio/video?id=${encodeURIComponent(id)}`, { brut: true, timeout: 10 * 60_000 });
  const total = Number(r.headers.get("Content-Length")) || 0;
  if (!r.body) return URL.createObjectURL(await r.blob());
  const lecteur = r.body.getReader();
  const morceaux: Uint8Array[] = [];
  let recu = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    morceaux.push(value); recu += value.length;
    if (total) progression(recu / total);
  }
  return URL.createObjectURL(new Blob(morceaux as BlobPart[], { type: "video/mp4" }));
}

interface Script { id: string; titre: string; compte: string; texte: string; sources: string[]; note: string; version: number; envoye: number; retours: Retour[] }
interface Idee { id: string; texte: string; compte: "ayati" | "psycho" | ""; at: number; statut: "nouvelle" | "script" | "faite" | "abandonnée" }
type Onglet = "videos" | "scripts" | "idees";
const NOM_COMPTE: Record<string, string> = { ayati: "Ayati", psycho: "La Psycho Facile", "": "Les deux / à voir" };

function App() {
  const [cfg] = useState<Config | null>(lireConfig);
  const [onglet, setOnglet] = useState<Onglet>(() => (new URLSearchParams(location.search).get("onglet") as Onglet) || "videos");
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [scripts, setScripts] = useState<Script[] | null>(null);
  const [idees, setIdees] = useState<Idee[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const charger = useCallback(async () => {
    if (!cfg) return;
    try { setVideos((await appel<{ videos: Video[] }>(cfg, "/api/studio")).videos); setErreur(null); }
    catch (e) { setErreur(String((e as Error).message ?? e)); return; }
    // Scripts et idées : Télécommande 1.2 ou plus ; avec une version plus ancienne, les onglets l'indiquent.
    try { setScripts((await appel<{ scripts: Script[] }>(cfg, "/api/studio/scripts")).scripts); } catch { setScripts(null); }
    try { setIdees((await appel<{ idees: Idee[] }>(cfg, "/api/studio/idees")).idees); } catch { setIdees(null); }
  }, [cfg]);
  useEffect(() => { void charger(); }, [charger]);
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(null), message.ok ? 4000 : 9000); return () => clearTimeout(t); }, [message]);

  if (!cfg) return (
    <div className="tc">
      <h1>Studio</h1>
      <section className="carte">
        <p>Les vidéos à valider arrivent du PC par la Télécommande. Associe d'abord ton PC dans la tuile <b>Télécommande</b> (adresse et code affichés sur le PC), puis reviens ici.</p>
        <a className="bouton" href="../telecommande/">Ouvrir la Télécommande</a>
      </section>
    </div>
  );

  const aRegarder = (videos ?? []).filter((v) => !reponseActuelle(v));
  const repondues = (videos ?? []).filter((v) => reponseActuelle(v));
  const aLire = (scripts ?? []).filter((s) => !reponseActuelle(s));
  const dire = { ok: (m: string) => { setMessage({ ok: true, texte: m }); void charger(); }, ko: (m: string) => setMessage({ ok: false, texte: m }) };
  const pastille = (n: number) => (n > 0 ? <span className="pastille">{n}</span> : null);
  return (
    <div className="tc">
      <div className="titre-carte"><h1>Studio</h1><button className="lien accent" onClick={() => void charger()}>Actualiser</button></div>
      <nav className="onglets trois">
        <button className={onglet === "videos" ? "actif" : ""} onClick={() => setOnglet("videos")}>Vidéos{pastille(aRegarder.length)}</button>
        <button className={onglet === "scripts" ? "actif" : ""} onClick={() => setOnglet("scripts")}>Scripts{pastille(aLire.length)}</button>
        <button className={onglet === "idees" ? "actif" : ""} onClick={() => setOnglet("idees")}>Idées</button>
      </nav>
      {message && <p className={`toast ${message.ok ? "ok" : "ko"}`} onClick={() => setMessage(null)}>{message.texte}</p>}
      {erreur && <section className="carte"><p className="ko">{erreur === INJOIGNABLE ? erreur : `Impossible de lire le Studio : ${erreur}`}</p></section>}
      {onglet === "scripts" && !erreur && <Scripts cfg={cfg} scripts={scripts} dire={dire} />}
      {onglet === "idees" && !erreur && <Idees cfg={cfg} idees={idees} dire={dire} />}
      {onglet === "videos" && videos && (
        <>
          <section className="carte">
            <div className="titre-carte"><h2>À regarder</h2>{aRegarder.length > 0 && <span className="puce orange">{aRegarder.length}</span>}</div>
            {aRegarder.length === 0 ? <p>Rien à valider pour l'instant. Claude dépose ici chaque nouvelle vidéo ou version corrigée.</p>
              : aRegarder.map((v) => <Fiche key={`${v.id}-${v.version}`} cfg={cfg} video={v} ouverte={aRegarder.length === 1} apres={(m) => { setMessage({ ok: true, texte: m }); void charger(); }} erreur={(m) => setMessage({ ok: false, texte: m })} />)}
          </section>
          {repondues.length > 0 && (
            <section className="carte">
              <h2>Déjà répondu</h2>
              {repondues.map((v) => <Fiche key={`${v.id}-${v.version}`} cfg={cfg} video={v} ouverte={false} apres={(m) => { setMessage({ ok: true, texte: m }); void charger(); }} erreur={(m) => setMessage({ ok: false, texte: m })} />)}
            </section>
          )}
        </>
      )}
      <p className="petit centre">Tout reste sur le PC (Vidéos\Rayan's Studio) ; tes réponses et tes idées y sont enregistrées et Claude les lit.</p>
    </div>
  );
}

const TROP_ANCIENNE = "Mets à jour Rayan's Télécommande sur le PC (Rayan's Launcher, version 1.2 ou plus) pour utiliser cet onglet.";
interface Dire { ok: (m: string) => void; ko: (m: string) => void }

/** Réponse « C'est bon » / « À corriger » (commune aux scripts ; les vidéos ont la leur, avec le moment de la vidéo). */
function Reponse({ titre, envoyer }: { titre: string; envoyer: (verdict: "ok" | "corriger", commentaire: string) => Promise<void> }) {
  const [mode, setMode] = useState<"choix" | "corriger">("choix");
  const [commentaire, setCommentaire] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const go = async (v: "ok" | "corriger") => { setEnvoi(true); try { await envoyer(v, commentaire.trim()); } finally { setEnvoi(false); } };
  return mode === "choix" ? (
    <div className="ligne">
      <button className="bouton vert" disabled={envoi} onClick={() => { if (confirm(`Valider « ${titre} » ? Claude pourra fabriquer la vidéo.`)) void go("ok"); }}>✓ C'est bon</button>
      <button className="bouton orange" disabled={envoi} onClick={() => setMode("corriger")}>✎ À corriger</button>
    </div>
  ) : (
    <>
      <textarea rows={5} autoFocus value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder={"Ce qu'il faut changer, par exemple :\nl'accroche est trop longue\nretire la phrase sur…"} />
      <div className="ligne">
        <button className="bouton secondaire" onClick={() => setMode("choix")}>Annuler</button>
        <button className="bouton" disabled={envoi || !commentaire.trim()} onClick={() => void go("corriger")}>{envoi ? "Envoi…" : "Envoyer à Claude"}</button>
      </div>
    </>
  );
}

function Scripts({ cfg, scripts, dire }: { cfg: Config; scripts: Script[] | null; dire: Dire }) {
  if (!scripts) return <section className="carte"><p>{TROP_ANCIENNE}</p></section>;
  const aLire = scripts.filter((s) => !reponseActuelle(s));
  const repondus = scripts.filter((s) => reponseActuelle(s));
  const fiche = (s: Script, ouvert: boolean) => <FicheScript key={`${s.id}-${s.version}`} cfg={cfg} s={s} ouvert={ouvert} dire={dire} />;
  return (
    <>
      <section className="carte">
        <div className="titre-carte"><h2>À lire</h2>{aLire.length > 0 && <span className="puce orange">{aLire.length}</span>}</div>
        {aLire.length === 0 ? <p>Aucun script à valider. Note une idée dans l'onglet Idées : Claude en fait un script et le dépose ici, avant de fabriquer la vidéo.</p>
          : aLire.map((s) => fiche(s, aLire.length === 1))}
      </section>
      {repondus.length > 0 && <section className="carte"><h2>Déjà répondu</h2>{repondus.map((s) => fiche(s, false))}</section>}
    </>
  );
}

function FicheScript({ cfg, s, ouvert, dire }: { cfg: Config; s: Script; ouvert: boolean; dire: Dire }) {
  const [deplie, setDeplie] = useState(ouvert);
  const reponse = reponseActuelle(s);
  return (
    <article className="fiche">
      <button className="entete" onClick={() => setDeplie(!deplie)}>
        <span className="texte">
          <b>{s.titre}</b>
          <small>{NOM_COMPTE[s.compte] ?? s.compte}{s.version > 1 ? ` · version ${s.version}` : ""} · {quand(s.envoye)}</small>
        </span>
        {reponse ? <span className={`puce ${reponse.verdict === "ok" ? "vert" : "rouge"}`}>{reponse.verdict === "ok" ? "Validé" : "À corriger"}</span> : <span className="fleche">{deplie ? "˄" : "˅"}</span>}
      </button>
      {deplie && (
        <div className="corps">
          {s.note && <p className="note"><b>Claude :</b> {s.note}</p>}
          <div className="script">{s.texte}</div>
          {s.sources.length > 0 && <details><summary>Sources ({s.sources.length})</summary><ul className="journal">{s.sources.map((x, i) => <li key={i}>{x}</li>)}</ul></details>}
          {reponse ? (
            <p className="petit">Ta réponse ({quand(reponse.at)}) : <b className={reponse.verdict === "ok" ? "ok" : "ko"}>{reponse.verdict === "ok" ? "c'est bon" : "à corriger"}</b>{reponse.commentaire && <span className="citation">{reponse.commentaire}</span>}</p>
          ) : (
            <Reponse titre={s.titre} envoyer={async (verdict, commentaire) => {
              try {
                await appel(cfg, "/api/studio/script/retour", { corps: { id: s.id, version: s.version, verdict, commentaire } });
                dire.ok(verdict === "ok" ? `Script validé ✓ Claude fabrique la vidéo.` : "Corrections envoyées ✓");
              } catch (e) { dire.ko(String((e as Error).message ?? e)); }
            }} />
          )}
        </div>
      )}
    </article>
  );
}

function Idees({ cfg, idees, dire }: { cfg: Config; idees: Idee[] | null; dire: Dire }) {
  const [texte, setTexte] = useState("");
  const [compte, setCompte] = useState<Idee["compte"]>("");
  const [envoi, setEnvoi] = useState(false);
  if (!idees) return <section className="carte"><p>{TROP_ANCIENNE}</p></section>;
  const ajouter = async () => {
    setEnvoi(true);
    try { await appel(cfg, "/api/studio/idees", { corps: { texte, compte } }); setTexte(""); dire.ok("Idée notée ✓ Claude la verra sur le PC."); }
    catch (e) { dire.ko(String((e as Error).message ?? e)); } finally { setEnvoi(false); }
  };
  const statut: Record<Idee["statut"], string> = { nouvelle: "nouvelle", script: "script en cours", faite: "vidéo faite", "abandonnée": "abandonnée" };
  return (
    <>
      <section className="carte">
        <h2>Nouvelle idée</h2>
        <textarea rows={3} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={"Un sujet, une question, une histoire…\nex. pourquoi on bâille quand quelqu'un bâille"} />
        <div className="choix-compte">
          {(["ayati", "psycho", ""] as const).map((c) => (
            <button key={c} className={compte === c ? "actif" : ""} onClick={() => setCompte(c)}>{NOM_COMPTE[c]}</button>
          ))}
        </div>
        <button className="bouton" disabled={envoi || !texte.trim()} onClick={() => void ajouter()}>{envoi ? "Envoi…" : "Noter l'idée"}</button>
        <p className="petit">Astuce : touche le micro du clavier pour dicter ton idée.</p>
      </section>
      <section className="carte">
        <h2>Mes idées</h2>
        {idees.length === 0 ? <p>Pas encore d'idée.</p> : (
          <ul className="liste">{idees.map((i) => (
            <li key={i.id}>
              <span className="texte"><b className="idee">{i.texte}</b><small>{NOM_COMPTE[i.compte]} · {quand(i.at)} · {statut[i.statut]}</small></span>
              <button className="lien danger" onClick={() => { if (confirm("Supprimer cette idée ?")) void appel(cfg, "/api/studio/idees/supprimer", { corps: { id: i.id } }).then(() => dire.ok("Idée supprimée."), (e) => dire.ko(String((e as Error).message ?? e))); }}>×</button>
            </li>
          ))}</ul>
        )}
      </section>
    </>
  );
}

function Fiche({ cfg, video: v, ouverte, apres, erreur }: { cfg: Config; video: Video; ouverte: boolean; apres: (m: string) => void; erreur: (m: string) => void }) {
  const [deplie, setDeplie] = useState(ouverte);
  const [src, setSrc] = useState<string | null>(null);
  const [fichier, setFichier] = useState<File | null>(null);
  const [progression, setProgression] = useState<number | null>(null);
  const [pourPartage, setPourPartage] = useState(false);
  const [mode, setMode] = useState<"choix" | "corriger">("choix");
  const [commentaire, setCommentaire] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const lecteur = useRef<HTMLVideoElement>(null);
  const zone = useRef<HTMLTextAreaElement>(null);
  const reponse = reponseActuelle(v);
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  const charger = async (): Promise<File | null> => {
    if (fichier) return fichier;
    setProgression(0);
    try {
      const url = await chargerVideo(cfg, v.id, setProgression);
      const f = new File([await (await fetch(url)).blob()], nomFichier(v), { type: "video/mp4" });
      setSrc(url); setFichier(f);
      return f;
    } catch (e) { erreur(String((e as Error).message ?? e)); return null; }
    finally { setProgression(null); }
  };
  const regarder = () => void charger();
  // iOS exige un toucher pour ouvrir le partage : si la vidéo n'est pas encore chargée, on la charge,
  // puis le bouton devient « Partager » et un second toucher ouvre la feuille de partage.
  const telecharger = async () => {
    if (!fichier) { setPourPartage(true); await charger(); return; }
    const r = await partager(fichier);
    if (r === "telecharge") apres("Vidéo téléchargée ✓");
  };
  const repondre = async (verdict: "ok" | "corriger") => {
    setEnvoi(true);
    try {
      await appel(cfg, "/api/studio/retour", { corps: { id: v.id, version: v.version, verdict, commentaire: verdict === "ok" ? commentaire : commentaire.trim() } });
      apres(verdict === "ok" ? `« ${v.titre} » validée ✓` : "Corrections envoyées ✓ Claude les verra sur le PC.");
    } catch (e) { erreur(String((e as Error).message ?? e)); } finally { setEnvoi(false); }
  };
  const ajouterMoment = () => {
    const t = lecteur.current?.currentTime ?? 0;
    const marque = `[${minutes(t)}] `;
    setCommentaire((c) => (c && !c.endsWith("\n") ? c + "\n" : c) + marque);
    setMode("corriger");
    lecteur.current?.pause();
    setTimeout(() => { const z = zone.current; if (!z) return; z.focus(); z.setSelectionRange(z.value.length, z.value.length); }, 50);
  };

  return (
    <article className="fiche">
      <button className="entete" onClick={() => setDeplie(!deplie)}>
        <span className="texte">
          <b>{v.titre}</b>
          <small>{v.version > 1 ? `Version ${v.version} · ` : ""}{quand(v.envoye)} · {taille(v.taille)}</small>
        </span>
        {reponse ? <span className={`puce ${reponse.verdict === "ok" ? "vert" : "rouge"}`}>{reponse.verdict === "ok" ? "Validée" : "À corriger"}</span> : <span className="fleche">{deplie ? "˄" : "˅"}</span>}
      </button>
      {deplie && (
        <div className="corps">
          {v.note && <p className="note"><b>Claude :</b> {v.note}</p>}
          {src ? <video ref={lecteur} src={src} controls playsInline preload="auto" />
            : <button className="bouton secondaire" disabled={progression !== null} onClick={regarder}>{progression !== null ? `Chargement… ${Math.round(progression * 100)} %` : "▶ Regarder la vidéo"}</button>}
          <button className={`bouton ${fichier && pourPartage ? "" : "secondaire"}`} disabled={progression !== null} onClick={() => void telecharger()}>
            {fichier ? "⤴ Enregistrer ou partager" : "⤓ Télécharger pour partager"}
          </button>
          {fichier && <p className="petit">« Enregistrer la vidéo » la met dans tes Photos ; tu peux aussi l'envoyer directement à tes amis (Messages, WhatsApp…).</p>}
          {v.texte && <details><summary>Légende et hashtags</summary><p className="legende">{v.texte}</p></details>}

          {reponse && (
            <p className="petit">Ta réponse ({quand(reponse.at)}) : <b className={reponse.verdict === "ok" ? "ok" : "ko"}>{reponse.verdict === "ok" ? "c'est bon" : "à corriger"}</b>{reponse.commentaire && <span className="citation">{reponse.commentaire}</span>}</p>
          )}

          {!reponse && mode === "choix" && (
            <div className="ligne">
              <button className="bouton vert" disabled={envoi} onClick={() => { if (confirm(`Valider « ${v.titre} » ? Claude pourra la programmer.`)) void repondre("ok"); }}>✓ C'est bon</button>
              <button className="bouton orange" disabled={envoi} onClick={() => { setMode("corriger"); setTimeout(() => zone.current?.focus(), 0); }}>✎ À corriger</button>
            </div>
          )}
          {!reponse && mode === "corriger" && (
            <>
              <textarea ref={zone} rows={5} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder={"Ce qu'il faut changer, par exemple :\n[0:12] le texte sort de l'écran\nla voix va trop vite à la fin"} />
              <div className="ligne">
                {src && <button className="bouton secondaire" onClick={ajouterMoment}>⏱ Ajouter le moment</button>}
                <button className="bouton" disabled={envoi || !commentaire.trim()} onClick={() => void repondre("corriger")}>{envoi ? "Envoi…" : "Envoyer à Claude"}</button>
              </div>
              <button className="lien" onClick={() => setMode("choix")}>Annuler</button>
            </>
          )}
          {!reponse && mode === "choix" && src && <button className="lien" onClick={ajouterMoment}>⏱ Noter un problème à ce moment de la vidéo</button>}

          {v.retours.filter((r) => r.version !== v.version).length > 0 && (
            <details><summary>Versions précédentes</summary>
              <ul className="journal">{v.retours.filter((r) => r.version !== v.version).reverse().map((r, i) => (
                <li key={i}><time>v{r.version} · {quand(r.at)}</time> {r.verdict === "ok" ? "validée" : "à corriger"}{r.commentaire && ` : ${r.commentaire}`}</li>
              ))}</ul>
            </details>
          )}
        </div>
      )}
    </article>
  );
}

mountChrome([]);
createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
