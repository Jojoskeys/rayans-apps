// Rayan's Favoris sur l'iPhone : envoyer au PC un lien TikTok ou Instagram, ou une vidéo, pour que Claude la
// transcrive, la trie et vérifie si l'astuce est sûre et applicable. Tout passe par Rayan's Télécommande
// (Tailscale + code d'association) ; le tri et la validation se font sur le PC (python favoris/favoris.py page).
import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { mountChrome } from "../shared/chrome.ts";
import { appel, INJOIGNABLE, lireConfig, type Config } from "../shared/pc.ts";
import "./telecommande.css";
import "./fiches.css";
import "./petites.css";

interface Resume {
  compte: Record<string, number>;
  enAttente: number;
  recents: { titre: string; categorie: string; verdict: string; etat: string; resume: string; lien: string }[];
}

const CATEGORIES: Record<string, string> = { "pour-claude": "Pour Claude", utile: "Astuce", recette: "Recette", sport: "Sport", religion: "Religion", psychologie: "Psychologie", "a-regarder": "À regarder" };
const VERDICTS: Record<string, string> = { sur: "sûr", prudence: "prudence", danger: "danger" };
const ETATS: Record<string, string> = { analysee: "à décider sur le PC", validee: "validée", appliquee: "appliquée ✓" };

function envoyerVideo(cfg: Config, f: File, note: string, progression: (p: number) => void): Promise<void> {
  return new Promise((ok, ko) => {
    const x = new XMLHttpRequest();
    x.open("POST", cfg.adresse + "/api/favoris/video");
    x.setRequestHeader("Authorization", `Bearer ${cfg.code}`);
    x.setRequestHeader("Content-Type", f.type || "video/mp4");
    x.setRequestHeader("X-Nom-Fichier", encodeURIComponent(note));
    x.timeout = 15 * 60_000;
    x.upload.onprogress = (e) => { if (e.lengthComputable) progression(e.loaded / e.total); };
    x.onload = () => {
      let j: { erreur?: string } = {};
      try { j = JSON.parse(x.responseText); } catch { /* réponse vide */ }
      if (x.status === 200) ok();
      else ko(new Error(x.status === 404 ? "Rayan's Télécommande sur le PC est trop ancienne : mets-la à jour avec Rayan's Launcher." : j.erreur ?? `erreur ${x.status}`));
    };
    x.onerror = x.ontimeout = () => ko(new Error(INJOIGNABLE));
    x.send(f);
  });
}

function App() {
  const cfg = lireConfig();
  const [lien, setLien] = useState("");
  const [note, setNote] = useState("");
  const [resume, setResume] = useState<Resume | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState<number | null>(null);
  const fichier = useRef<HTMLInputElement>(null);

  const charger = useCallback(async () => {
    if (!cfg) return;
    try { setResume(await appel<Resume>(cfg, "/api/favoris")); setErreur(null); }
    catch (e) { setErreur(String((e as Error).message ?? e)); }
  }, [cfg?.adresse, cfg?.code]);
  useEffect(() => { void charger(); }, [charger]);
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(null), message.ok ? 5000 : 9000); return () => clearTimeout(t); }, [message]);
  // Ouvert depuis le menu Partager (raccourci iOS) : …/favoris/?lien=…
  useEffect(() => { const l = new URLSearchParams(location.search).get("lien"); if (l) setLien(l); }, []);

  if (!cfg) return (
    <div className="tc">
      <h1>Favoris</h1>
      <section className="carte">
        <p>Les vidéos sont analysées sur le PC. Associe d'abord ton PC dans la tuile <b>Télécommande</b>, puis reviens ici.</p>
        <a className="bouton" href="../telecommande/">Ouvrir la Télécommande</a>
      </section>
    </div>
  );

  const envoyerLien = async () => {
    try {
      await appel(cfg, "/api/favoris", { corps: { lien, note } });
      setLien(""); setNote("");
      setMessage({ ok: true, texte: "Envoyé au PC ✓ Claude l'analysera au prochain /favoris." });
      void charger();
    } catch (e) { setMessage({ ok: false, texte: String((e as Error).message ?? e) }); }
  };
  const choisi = async (f: File | undefined) => {
    if (!f) return;
    setEnvoi(0);
    try { await envoyerVideo(cfg, f, note, setEnvoi); setNote(""); setMessage({ ok: true, texte: "Vidéo envoyée au PC ✓" }); void charger(); }
    catch (e) { setMessage({ ok: false, texte: String((e as Error).message ?? e) }); }
    finally { setEnvoi(null); if (fichier.current) fichier.current.value = ""; }
  };
  const c = resume?.compte ?? {};
  const aTraiter = (resume?.enAttente ?? 0) + (c.a_recuperer ?? 0) + (c.a_analyser ?? 0);

  return (
    <div className="tc">
      <div className="titre-carte"><h1>Favoris</h1><button className="lien accent" onClick={() => void charger()}>Actualiser</button></div>
      {message && <p className={`toast ${message.ok ? "ok" : "ko"}`} onClick={() => setMessage(null)}>{message.texte}</p>}

      <section className="carte">
        <h2>Envoyer une vidéo</h2>
        <input id="f-lien" type="url" value={lien} onChange={(e) => setLien(e.target.value)} placeholder="Lien TikTok ou Instagram" />
        <input id="f-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Une note pour Claude (facultatif)" />
        <div className="ligne">
          <button className="bouton" disabled={!lien.trim()} onClick={() => void envoyerLien()}>Envoyer le lien</button>
          <input ref={fichier} id="f-video" className="fichier-cache" type="file" accept="video/*" onChange={(e) => void choisi(e.target.files?.[0])} />
          <button className="bouton secondaire" disabled={envoi !== null} onClick={() => fichier.current?.click()}>
            {envoi === null ? "Ou une vidéo" : `Envoi… ${Math.round(envoi * 100)} %`}
          </button>
        </div>
        <p className="petit">Dans TikTok ou Instagram : Partager → Copier le lien, puis colle-le ici.</p>
      </section>

      <section className="carte">
        <h2>Sur le PC</h2>
        {erreur && <p className="ko">{erreur === INJOIGNABLE ? erreur : `Impossible de lire les favoris : ${erreur}`}</p>}
        {!erreur && !resume && <p className="petit">Chargement…</p>}
        {resume && <p className="petit">{aTraiter} à traiter · {c.analysee ?? 0} à décider · {c.appliquee ?? 0} appliquée(s) · {c.ignoree ?? 0} ignorée(s){c.erreur ? ` · ${c.erreur} en erreur` : ""}</p>}
        {resume?.recents.map((r, i) => (
          <div key={i} className="fiche">
            <div className="entete"><span className="texte"><b>{r.titre}</b>
              <small>{[CATEGORIES[r.categorie] ?? r.categorie, r.verdict && `sécurité : ${VERDICTS[r.verdict] ?? r.verdict}`, ETATS[r.etat] ?? r.etat].filter(Boolean).join(" · ")}</small></span></div>
            {r.resume && <p className="extrait">{r.resume}</p>}
          </div>
        ))}
      </section>
    </div>
  );
}

mountChrome([]);
createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
