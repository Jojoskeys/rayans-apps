// Rayan's Montre sur l'iPhone : ce que la montre Garmin (garmin/montre) a envoyé au PC — eau, séances, humeur,
// pas — aujourd'hui et sur 7 jours. Lu à travers Rayan's Télécommande, avec l'adresse et le code de la tuile
// Télécommande (shared/pc.ts). Les saisies se font sur la montre.
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { mountChrome } from "../shared/chrome.ts";
import { appel, INJOIGNABLE, lireConfig } from "../shared/pc.ts";
import { barres, dernierEnvoi, distance, humeur, HUMEURS, initiale, nombre, type JourMontre, type VueMontre } from "../shared/montre.ts";
import "./telecommande.css";
import "./petites.css";

function Semaine({ titre, jours, valeur, texte }: { titre: string; jours: JourMontre[]; valeur: (j: JourMontre) => number | null; texte: (j: JourMontre) => string }) {
  const h = barres(jours, valeur);
  return (
    <div>
      <p className="rayon">{titre}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, alignItems: "end", height: 86, marginTop: 6 }}>
        {jours.map((j, i) => (
          <div key={j.date} title={`${j.date} : ${texte(j)}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, height: "100%", justifyContent: "flex-end" }}>
            <small style={{ fontSize: 11, color: "var(--texte-2)" }}>{h[i] === null ? "" : texte(j)}</small>
            <div style={{ width: "70%", borderRadius: 5, background: h[i] === null ? "transparent" : i === 6 ? "var(--accent)" : "var(--panneau-2)", border: h[i] === null ? "1px dashed var(--bord)" : "0", height: `${Math.max(4, (h[i] ?? 0) * 52)}px` }} />
            <small style={{ fontSize: 11, color: i === 6 ? "var(--texte)" : "var(--texte-2)" }}>{initiale(j.date)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  const cfg = lireConfig();
  const [vue, setVue] = useState<VueMontre | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!cfg) return;
    try { setVue(await appel<VueMontre>(cfg, "/api/montre")); setErreur(null); }
    catch (e) { setErreur(String((e as Error).message ?? e)); }
  }, [cfg?.adresse, cfg?.code]);
  useEffect(() => { void charger(); }, [charger]);

  if (!cfg) return (
    <div className="tc">
      <h1>Montre</h1>
      <section className="carte">
        <p>Les saisies de la montre arrivent sur le PC. Associe d'abord ton PC dans la tuile <b>Télécommande</b>, puis reviens ici.</p>
        <a className="bouton" href="../telecommande/">Ouvrir la Télécommande</a>
      </section>
    </div>
  );

  const a = vue?.aujourdhui;
  return (
    <div className="tc">
      <div className="titre-carte"><h1>Montre</h1><button className="lien accent" onClick={() => void charger()}>Actualiser</button></div>
      {erreur && <section className="carte"><p className="ko">{erreur === INJOIGNABLE ? erreur : `Impossible de lire les données de la montre : ${erreur}`}</p></section>}
      {!erreur && !vue && <p className="petit">Chargement…</p>}
      {vue && a && (
        <>
          <section className="carte">
            <h2>Aujourd'hui</h2>
            <div className="mesures">
              <div><small>Eau</small><b>{a.eau} verre{a.eau > 1 ? "s" : ""}</b></div>
              <div><small>Séance</small><b>{a.seances ? `faite${a.seances > 1 ? ` (${a.seances})` : ""} ✓` : "pas encore"}</b></div>
              <div><small>Humeur</small><b>{humeur(a.humeur)}</b>{a.humeurs.length > 1 && <small>{a.humeurs.map((h) => HUMEURS[h - 1]).join(" ")}</small>}</div>
              <div><small>Pas</small><b>{nombre(a.pas)}</b></div>
              <div><small>Distance</small><b>{distance(a.distance)}</b></div>
              <div><small>Calories</small><b>{a.calories === null ? "—" : `${nombre(a.calories)} kcal`}</b></div>
            </div>
            <p className="petit">{dernierEnvoi(vue.derniereReception)}</p>
          </section>
          <section className="carte">
            <h2>7 derniers jours</h2>
            <Semaine titre="Pas" jours={vue.jours} valeur={(j) => j.pas} texte={(j) => (j.pas === null ? "—" : j.pas >= 1000 ? `${Math.round(j.pas / 1000)}k` : String(j.pas))} />
            <Semaine titre="Verres d'eau" jours={vue.jours} valeur={(j) => j.eau} texte={(j) => String(j.eau)} />
            <p className="petit">Séances : {vue.jours.map((j) => (j.seances ? "✓" : "·")).join(" ")} · Humeur : {vue.jours.map((j) => (j.humeur ? HUMEURS[j.humeur - 1] : "·")).join(" ")}</p>
          </section>
        </>
      )}
    </div>
  );
}

mountChrome([]);
createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
