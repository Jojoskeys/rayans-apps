// Progrès : des tendances et des phrases neutres, jamais de note (pour ne pas stresser, voir la fiche « Suivre sans stresser »).
import { useState } from "react";
import { bilanAFaire, phraseComparaison, ressenti } from "../core/bilan";
import { dayKey } from "../core/model";
import { constats, dureeNuit, evolution, periode, pointsEnergie, serie, tendances } from "../core/stats";
import { ajouterJours, fmtDuree, heureDuSoir, versHeure } from "../core/temps";
import { Carte, Courbe, Nuage, plural, useApp } from "../ui";
import FaireBilan from "./Bilan";

export default function PageProgres() {
  const { db } = useApp();
  const [bilan, setBilan] = useState(false);
  const now = Date.now();
  const jour = dayKey(now, db.reglages.heureJour);
  if (bilan) return <div className="pile"><FaireBilan fini={() => setBilan(false)} /></div>;
  const t = tendances(db.nuits, jour, 14);
  const avant = tendances(db.nuits, ajouterJours(jour, -14), 14);
  const recentes = periode(db.nuits, jour, 30);
  const bilans = [...db.bilans].sort((a, b) => a.at - b.at);
  const histo = db.objectif.historique.slice(-8);
  return (
    <div className="pile">
      <Carte titre="Tes 14 dernières nuits">
        {t.nuits === 0 ? <p className="muted">Note quelques nuits dans le journal pour voir tes tendances.</p> : (
          <>
            <div className="chiffres">
              <div><b>{fmtDuree(t.dureeMoyenne)}</b><span>sommeil moyen estimé</span></div>
              <div><b>{versHeure(t.leverHabituel)}</b><span>lever habituel</span></div>
              <div><b>± {t.ecartLever} min</b><span>écart du lever</span></div>
              <div><b>{t.regulieres} / {t.nuits}</b><span>nuits à ± 30 min du lever habituel</span></div>
              <div><b>{serie(db.nuits, jour)}</b><span>jours notés d'affilée</span></div>
            </div>
            {avant.nuits >= 3 && (
              <p className="muted petit">
                Par rapport aux 14 nuits d'avant : durée {evolution(avant.dureeMoyenne, t.dureeMoyenne, 15, "un peu plus longue", "un peu plus courte")},
                lever {evolution(avant.ecartLever, t.ecartLever, 10, "un peu moins régulier", "plus régulier")}.
              </p>
            )}
            <p className="muted petit">Durée estimée de l'endormissement au lever ; les réveils de la nuit ne sont pas retirés. L'heure de lever stable est le repère le plus utile.</p>
          </>
        )}
      </Carte>
      <Carte titre="Durée de sommeil (30 derniers jours)">
        <Courbe valeurs={recentes.map((n) => dureeNuit(n) / 60)} min={4} max={10} repere={db.reglages.dureeMin / 60} />
        <p className="muted petit">Pointillés : ta durée visée ({fmtDuree(db.reglages.dureeMin)}).</p>
      </Carte>
      <Carte titre="Énergie au réveil selon la durée">
        <Nuage points={pointsEnergie(db.nuits, jour)} />
        <p className="muted petit">Chaque point est une nuit. La bande claire correspond à 7–9 h. À regarder sur plusieurs semaines : une nuit seule ne dit pas grand-chose.</p>
        {constats(db.nuits, jour).map((c) => <p key={c} className="petit">{c}</p>)}
      </Carte>
      <Carte titre="Objectif de la semaine">
        {histo.length === 0 ? <p className="muted">L'historique apparaît après la première semaine.</p> : (
          <ul className="tests">{histo.map((h) => <li key={h.debut}>Semaine du {h.debut.slice(8)}/{h.debut.slice(5, 7)} : coucher vers {heureDuSoir(h.heure)}, {plural(h.tenues, "nuit tenue", "nuits tenues")} sur 7</li>)}</ul>
        )}
      </Carte>
      <Carte titre="Bilans de la semaine">
        {bilans.length === 0 ? <p className="muted">Pas encore de bilan. Le premier sert de point de départ.</p> : (
          <>
            <Courbe valeurs={bilans.map(ressenti)} min={0} max={18} />
            <ul className="tests">
              {bilans.slice(-6).map((b) => <li key={b.id}>{new Date(b.at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</li>)}
            </ul>
            {bilans.length >= 2 && <p>{phraseComparaison(bilans[bilans.length - 2], bilans[bilans.length - 1])}</p>}
            <p className="muted petit">Courbe du ressenti (plus haut = semaine plus reposante). Questionnaire fait maison, pas un outil médical.</p>
          </>
        )}
        <button className={`btn ${bilanAFaire(db.bilans, now) ? "primary" : ""}`} onClick={() => setBilan(true)}>{bilans.length ? "Refaire le bilan" : "Faire le bilan de départ"}</button>
      </Carte>
    </div>
  );
}
