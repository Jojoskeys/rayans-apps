// Rayan's Demain sur l'iPhone : à quelle heure se lever demain. Premier cours (emploi du temps d'Aujourd'hui,
// synchronisé) moins le temps de préparation et de trajet, et l'heure du Fajr (calculée comme Rayan's Prière).
// Ne fait que lire « fac » et « priere » ; ses trois réglages restent sur l'appareil.
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { store } from "../shared/sync.ts";
import { mountChrome } from "../shared/chrome.ts";
import { displayCourses, sanitizeFac } from "../../../aujourdhui/src/core/fac.ts";
import { heuresDePriere } from "../../../aujourdhui/src/core/prieres.ts";
import { nettoyerReglagesDemain, planDemain, type CoursSimple, type ReglagesDemain } from "../shared/petites.ts";
import "./telecommande.css";
import "./petites.css";

const CLE = "rm-demain-reglages";
const lireReglages = () => { try { return nettoyerReglagesDemain(JSON.parse(localStorage.getItem(CLE) ?? "null")); } catch { return nettoyerReglagesDemain(null); } };
const hm = (t: number) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const jourLong = (t: number) => new Date(t).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const parse = (t: string | null) => { try { return t ? JSON.parse(t) : null; } catch { return null; } };

function App() {
  const [cours, setCours] = useState<CoursSimple[] | null>(null);
  const [priere, setPriere] = useState<unknown>(null);
  const [r, setR] = useState<ReglagesDemain>(lireReglages);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    void Promise.all([store.load("fac"), store.load("priere")]).then(([f, p]) => {
      const fac = sanitizeFac(parse(f) ?? {});
      setCours(displayCourses(fac).map((c) => ({ start: c.start, end: c.end, title: c.title, room: c.room })));
      setPriere(parse(p));
    });
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const regler = (k: keyof ReglagesDemain, v: string) => {
    const n = nettoyerReglagesDemain({ ...r, [k]: Number(v) });
    setR(n);
    try { localStorage.setItem(CLE, JSON.stringify(n)); } catch { /* stockage indisponible */ }
  };

  if (!cours) return <div className="tc"><h1>Demain</h1><section className="carte"><p>Chargement…</p></section></div>;
  const plan = planDemain(cours, (t) => (priere ? heuresDePriere(priere, t)?.fajr ?? null : null), now, r);
  const quand = plan.aujourdhui ? "Aujourd'hui" : "Demain";
  return (
    <div className="tc">
      <h1>{quand}</h1>
      <p className="sous" style={{ marginTop: -6 }}>{jourLong(plan.jour)}</p>

      <section className="carte">
        <h2>Lever pour la fac</h2>
        {plan.premier && plan.reveilCours !== null ? (
          <>
            <p className="heure">{hm(plan.reveilCours)}<small>premier cours à {hm(plan.premier.start)}</small></p>
            <p className="sous">{plan.premier.title}{plan.premier.room ? ` · ${plan.premier.room}` : ""}</p>
            <p className="petit">{plan.nbCours} cours{plan.dernier ? `, fini à ${hm(plan.dernier.end)}` : ""}. Lever = cours − {r.preparation} min de préparation − {r.trajet} min de trajet.</p>
          </>
        ) : cours.length === 0
          ? <p>Pas d'emploi du temps synchronisé. Il arrive du PC par Rayan's Aujourd'hui (lien ADE dans ses réglages) ; vérifie aussi la synchro sur l'accueil.</p>
          : <p className="heure" style={{ fontSize: 26 }}>Pas de cours 🎉</p>}
      </section>

      <section className="carte">
        <h2>Fajr</h2>
        {plan.fajr !== null && plan.reveilFajr !== null ? (
          <>
            <p className="heure">{hm(plan.reveilFajr)}<small>Fajr à {hm(plan.fajr)}</small></p>
            <p className="petit">Alarme {r.avantFajr} min avant l'adhan, d'après les réglages de Rayan's Prière.</p>
          </>
        ) : <p>Horaires de prière indisponibles : ouvre une fois la tuile Prière pour régler ta ville.</p>}
      </section>

      <section className="carte">
        <h2>Mes temps, en minutes</h2>
        <div className="reglages">
          <label htmlFor="d-prep">Préparation<input id="d-prep" type="number" inputMode="numeric" value={r.preparation} onChange={(e) => regler("preparation", e.target.value)} /></label>
          <label htmlFor="d-trajet">Trajet<input id="d-trajet" type="number" inputMode="numeric" value={r.trajet} onChange={(e) => regler("trajet", e.target.value)} /></label>
          <label htmlFor="d-fajr">Avant Fajr<input id="d-fajr" type="number" inputMode="numeric" value={r.avantFajr} onChange={(e) => regler("avantFajr", e.target.value)} /></label>
        </div>
        <p className="petit">Règle ensuite tes alarmes dans l'app Horloge de l'iPhone.</p>
      </section>
    </div>
  );
}

mountChrome([]);
createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
