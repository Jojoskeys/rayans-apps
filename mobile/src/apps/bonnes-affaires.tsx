// Rayan's Bonnes Affaires sur l'iPhone : « Mes choix » et le reste du classement calculé sur le PC par
// bonnes-affaires/ (npm start). Lu à travers Rayan's Télécommande (Tailscale + code d'association).
// Lecture seule : la tuile ouvre l'annonce, rien n'est acheté ni envoyé au vendeur.
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { mountChrome } from "../shared/chrome.ts";
import { appel, INJOIGNABLE, lireConfig, quand } from "../shared/pc.ts";
import "./telecommande.css";
import "./bonnes-affaires.css";

type Surete = "sûr" | "à vérifier" | "méfiance";
interface Offre {
  titre: string; site: string; recherche: string; lien: string; photo: string | null;
  total: number; prixHabituel: number; ecartPct: number; gainRevente: number;
  distanceKm: number | null; procheDe: string; dansZone: boolean; livrable: boolean; port: number | null;
  surete: Surete; raisons: string[]; choix: boolean;
}
interface Classement { majLe: number | null; demo: boolean; offres: Offre[] }

const euros = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: n % 1 ? 2 : 0 });
const CLASSE: Record<Surete, string> = { "sûr": "sur", "à vérifier": "verif", "méfiance": "mefi" };

export function ouTexte(o: Offre): string {
  const ou = o.distanceKm != null ? `${o.distanceKm} km${o.procheDe ? ` de ${o.procheDe}` : ""}` : "";
  if (o.dansZone) return `${ou} · à aller chercher`;
  const envoi = o.livrable ? (o.port == null ? "livrable (port ?)" : o.port === 0 ? "livraison offerte" : `livraison ${euros(o.port)}`) : "main propre, lieu à vérifier";
  return ou ? `${ou} · ${envoi}` : envoi;
}

function CarteOffre({ o, details }: { o: Offre; details: boolean }) {
  const [ouvert, setOuvert] = useState(details);
  return (
    <div className="offre">
      {o.photo
        ? <a href={o.lien} target="_blank" rel="noopener noreferrer"><img className="vignette" src={o.photo} alt="" loading="lazy" referrerPolicy="no-referrer" /></a>
        : <div className="vignette">pas de photo</div>}
      <div className="infos">
        <a href={o.lien} target="_blank" rel="noopener noreferrer">{o.titre}</a>
        <span className="site">{o.site} · {o.recherche}</span>
        <span className="prix">
          <b>{euros(o.total)}</b><s>{euros(o.prixHabituel)}</s>
          <span className="remise">−{Math.round(o.ecartPct * 100)} %</span>
          <span className={`pastille ${CLASSE[o.surete]}`}>{o.surete}</span>
        </span>
        <span className="ou">{ouTexte(o)}{o.gainRevente > 0 ? ` · revente ≈ ${euros(o.gainRevente)}` : ""}</span>
        {ouvert
          ? <ul className="raisons">{o.raisons.map((r, i) => <li key={i} className={r.startsWith("+") ? "bon" : "mauvais"}>{r.slice(2)}</li>)}</ul>
          : o.raisons.length > 0 && <button className="plus-de-detail" onClick={() => setOuvert(true)}>Pourquoi « {o.surete} » ?</button>}
      </div>
    </div>
  );
}

function App() {
  const cfg = lireConfig();
  const [donnees, setDonnees] = useState<Classement | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tout, setTout] = useState(false);

  const charger = useCallback(async () => {
    if (!cfg) return;
    try { setDonnees(await appel<Classement>(cfg, "/api/bonnes-affaires")); setErreur(null); }
    catch (e) { setErreur(String((e as Error).message ?? e)); }
  }, [cfg?.adresse, cfg?.code]);
  useEffect(() => { void charger(); }, [charger]);

  if (!cfg) return (
    <div className="tc">
      <h1>Bonnes affaires</h1>
      <section className="carte">
        <p>Le classement est calculé sur le PC. Associe d'abord ton PC dans la tuile <b>Télécommande</b>, puis reviens ici.</p>
        <a className="bouton" href="../telecommande/">Ouvrir la Télécommande</a>
      </section>
    </div>
  );

  const choix = donnees?.offres.filter((o) => o.choix) ?? [];
  const autres = donnees?.offres.filter((o) => !o.choix) ?? [];

  return (
    <div className="tc">
      <div className="titre-carte"><h1>Bonnes affaires</h1><button className="lien accent" onClick={() => void charger()}>Actualiser</button></div>
      {erreur && <p className="ko">{erreur === INJOIGNABLE ? erreur : erreur === "adresse inconnue" || /trop ancienne/.test(erreur) ? "Rayan's Télécommande sur le PC est trop ancienne : mets-la à jour avec Rayan's Launcher." : `Impossible de lire le classement : ${erreur}`}</p>}
      {!erreur && !donnees && <p className="petit">Chargement…</p>}
      {donnees?.demo && <p className="bandeau-demo">Données d'exemple (démo) : lance « npm start » dans bonnes-affaires sur le PC pour de vraies annonces.</p>}
      {donnees && donnees.majLe == null && (
        <section className="carte"><p>Pas encore de classement. Sur le PC, lance <b>npm start</b> dans le dossier bonnes-affaires.</p></section>
      )}
      {donnees?.majLe != null && <p className="petit">Mis à jour {quand(donnees.majLe)} · le prix habituel est une estimation, vérifie toujours l'annonce.</p>}

      {donnees?.majLe != null && (
        <section className="carte">
          <h2>Mes choix</h2>
          {choix.length ? choix.map((o) => <CarteOffre key={o.lien} o={o} details />) : <p className="petit">Rien de sûr et intéressant pour l'instant.</p>}
        </section>
      )}

      {autres.length > 0 && (
        <section className="carte">
          <div className="titre-carte"><h2>Les autres ({autres.length})</h2>{!tout && <button className="lien accent" onClick={() => setTout(true)}>Tout voir</button>}</div>
          {(tout ? autres : autres.slice(0, 5)).map((o) => <CarteOffre key={o.lien} o={o} details={false} />)}
        </section>
      )}
    </div>
  );
}

mountChrome([]);
createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
