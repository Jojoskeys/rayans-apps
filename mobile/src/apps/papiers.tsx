// Rayan's Papiers sur l'iPhone : photographier un document (attestation, facture, carte…), l'envoyer au PC qui en
// lit le texte (OCR de Windows), puis le retrouver par recherche. Tout passe par Rayan's Télécommande (Tailscale +
// code d'association) : les photos restent sur le PC, dans Documents\Rayan's Papiers.
import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { mountChrome } from "../shared/chrome.ts";
import { appel, INJOIGNABLE, lireConfig, quand, taille, type Config } from "../shared/pc.ts";
import "./telecommande.css";
import "./studio.css";
import "./petites.css";

interface Resultat { id: string; titre: string; ajoute: number; taille: number; extrait: string; ocr: string }

function envoyerPhoto(cfg: Config, f: File, titre: string, progression: (p: number) => void): Promise<Resultat> {
  return new Promise((ok, ko) => {
    const x = new XMLHttpRequest();
    x.open("POST", cfg.adresse + "/api/papiers");
    x.setRequestHeader("Authorization", `Bearer ${cfg.code}`);
    x.setRequestHeader("Content-Type", f.type || "image/jpeg");
    x.setRequestHeader("X-Nom-Fichier", encodeURIComponent(titre));
    x.timeout = 5 * 60_000;
    x.upload.onprogress = (e) => { if (e.lengthComputable) progression(e.loaded / e.total); };
    x.onload = () => {
      let j: { papier?: Resultat; erreur?: string } = {};
      try { j = JSON.parse(x.responseText); } catch { /* réponse vide */ }
      if (x.status === 200 && j.papier) ok(j.papier);
      else ko(new Error(x.status === 404 ? "Rayan's Télécommande sur le PC est trop ancienne : mets-la à jour avec Rayan's Launcher." : j.erreur ?? `erreur ${x.status}`));
    };
    x.onerror = x.ontimeout = () => ko(new Error(INJOIGNABLE));
    x.send(f);
  });
}

function Apercu({ cfg, id }: { cfg: Config; id: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    let url = "";
    appel<Response>(cfg, `/api/papiers/image?id=${encodeURIComponent(id)}`, { brut: true, timeout: 120_000 })
      .then((r) => r.blob()).then((b) => { url = URL.createObjectURL(b); setSrc(url); }, (e) => setErreur(String((e as Error).message ?? e)));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [cfg, id]);
  if (erreur) return <p className="ko">{erreur}</p>;
  return src ? <img className="apercu" src={src} alt="Photo du document" /> : <p className="petit">Chargement de la photo…</p>;
}

function App() {
  const cfg = lireConfig();
  const [q, setQ] = useState("");
  const [liste, setListe] = useState<Resultat[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [titre, setTitre] = useState("");
  const [envoi, setEnvoi] = useState<number | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const fichier = useRef<HTMLInputElement>(null);

  const charger = useCallback(async (recherche: string) => {
    if (!cfg) return;
    try { const r = await appel<{ papiers: Resultat[] }>(cfg, `/api/papiers?q=${encodeURIComponent(recherche)}`); setListe(r.papiers); setErreur(null); }
    catch (e) { setErreur(String((e as Error).message ?? e)); }
  }, [cfg?.adresse, cfg?.code]);
  useEffect(() => { const t = setTimeout(() => void charger(q), q ? 300 : 0); return () => clearTimeout(t); }, [q, charger]);
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(null), message.ok ? 5000 : 9000); return () => clearTimeout(t); }, [message]);

  if (!cfg) return (
    <div className="tc">
      <h1>Papiers</h1>
      <section className="carte">
        <p>Les photos de tes documents sont rangées sur le PC. Associe d'abord ton PC dans la tuile <b>Télécommande</b>, puis reviens ici.</p>
        <a className="bouton" href="../telecommande/">Ouvrir la Télécommande</a>
      </section>
    </div>
  );

  const choisi = async (f: File | undefined) => {
    if (!f) return;
    setEnvoi(0);
    try {
      const p = await envoyerPhoto(cfg, f, titre, setEnvoi);
      setTitre("");
      setMessage({ ok: p.ocr === "ok", texte: p.ocr === "ok" ? `« ${p.titre} » rangé, texte lu ✓` : p.ocr === "vide" ? `« ${p.titre} » rangé, mais aucun texte n'a été lu (photo floue ?).` : `« ${p.titre} » rangé, mais le texte n'a pas pu être lu : ${p.ocr}` });
      void charger(q);
    } catch (e) { setMessage({ ok: false, texte: String((e as Error).message ?? e) }); }
    finally { setEnvoi(null); if (fichier.current) fichier.current.value = ""; }
  };
  const supprimer = async (id: string) => {
    try { await appel(cfg, "/api/papiers/supprimer", { corps: { id } }); setASupprimer(null); setOuvert(null); setMessage({ ok: true, texte: "Papier supprimé du PC." }); void charger(q); }
    catch (e) { setMessage({ ok: false, texte: String((e as Error).message ?? e) }); }
  };

  return (
    <div className="tc">
      <div className="titre-carte"><h1>Papiers</h1><button className="lien accent" onClick={() => void charger(q)}>Actualiser</button></div>
      {message && <p className={`toast ${message.ok ? "ok" : "ko"}`} onClick={() => setMessage(null)}>{message.texte}</p>}

      <section className="carte">
        <h2>Nouveau document</h2>
        <input id="p-titre" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Nom (ex. Attestation CAF 2026)" />
        <input ref={fichier} id="p-photo" className="fichier-cache" type="file" accept="image/*" onChange={(e) => void choisi(e.target.files?.[0])} />
        <button className="bouton" disabled={envoi !== null} onClick={() => fichier.current?.click()}>
          {envoi === null ? "Prendre ou choisir une photo" : envoi < 1 ? `Envoi… ${Math.round(envoi * 100)} %` : "Lecture du texte sur le PC…"}
        </button>
        <p className="petit">Pose le document à plat, bien éclairé. Le PC lit le texte pour que tu puisses le retrouver.</p>
      </section>

      <section className="carte">
        <input id="p-recherche" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher : caf, loyer, carte vitale…" />
        {erreur && <p className="ko">{erreur === INJOIGNABLE ? erreur : `Impossible de lire les papiers : ${erreur}`}</p>}
        {!erreur && liste === null && <p className="petit">Chargement…</p>}
        {liste && liste.length === 0 && <p className="centre">{q ? "Aucun document ne correspond." : "Pas encore de document."}</p>}
        {liste?.map((p) => (
          <div key={p.id} className="fiche">
            <button className="entete" onClick={() => setOuvert(ouvert === p.id ? null : p.id)}>
              <span className="texte"><b>{p.titre}</b><small>{quand(p.ajoute)} · {taille(p.taille)}{p.ocr !== "ok" ? " · texte non lu" : ""}</small></span>
            </button>
            {p.extrait && <p className="extrait">{p.extrait}</p>}
            {ouvert === p.id && (
              <div className="corps">
                <Apercu cfg={cfg} id={p.id} />
                <div className="ligne">
                  {aSupprimer === p.id
                    ? <button className="bouton orange" onClick={() => void supprimer(p.id)}>Confirmer la suppression</button>
                    : <button className="bouton secondaire" onClick={() => setASupprimer(p.id)}>Supprimer</button>}
                </div>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

mountChrome([]);
createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
