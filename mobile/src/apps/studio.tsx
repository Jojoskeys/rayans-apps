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

function App() {
  const [cfg] = useState<Config | null>(lireConfig);
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const charger = useCallback(async () => {
    if (!cfg) return;
    try { setVideos((await appel<{ videos: Video[] }>(cfg, "/api/studio")).videos); setErreur(null); }
    catch (e) { setErreur(String((e as Error).message ?? e)); }
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
  return (
    <div className="tc">
      <div className="titre-carte"><h1>Studio</h1><button className="lien accent" onClick={() => void charger()}>Actualiser</button></div>
      {message && <p className={`toast ${message.ok ? "ok" : "ko"}`} onClick={() => setMessage(null)}>{message.texte}</p>}
      {erreur && <section className="carte"><p className="ko">{erreur === INJOIGNABLE ? erreur : `Impossible de lire les vidéos : ${erreur}`}</p></section>}
      {videos && (
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
      <p className="petit centre">Les vidéos restent sur le PC (Vidéos\Rayan's Studio\A valider) ; tes réponses y sont enregistrées et Claude les lit.</p>
    </div>
  );
}

function Fiche({ cfg, video: v, ouverte, apres, erreur }: { cfg: Config; video: Video; ouverte: boolean; apres: (m: string) => void; erreur: (m: string) => void }) {
  const [deplie, setDeplie] = useState(ouverte);
  const [src, setSrc] = useState<string | null>(null);
  const [progression, setProgression] = useState<number | null>(null);
  const [mode, setMode] = useState<"choix" | "corriger">("choix");
  const [commentaire, setCommentaire] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const lecteur = useRef<HTMLVideoElement>(null);
  const zone = useRef<HTMLTextAreaElement>(null);
  const reponse = reponseActuelle(v);
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  const regarder = async () => {
    setProgression(0);
    try { setSrc(await chargerVideo(cfg, v.id, setProgression)); }
    catch (e) { erreur(String((e as Error).message ?? e)); }
    finally { setProgression(null); }
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
            : <button className="bouton secondaire" disabled={progression !== null} onClick={() => void regarder()}>{progression !== null ? `Chargement… ${Math.round(progression * 100)} %` : "▶ Regarder la vidéo"}</button>}
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
