// Ce soir / Ce matin : l'heure de coucher conseillée, la routine, l'objectif de la semaine et le journal du matin.
import { useState } from "react";
import { bilanAFaire } from "../core/bilan";
import { moment } from "../core/horaires";
import { dayKey } from "../core/model";
import { nuitsTenues, phraseObjectif } from "../core/objectif";
import { dureeNuit, serie } from "../core/stats";
import { ajouterJours, fmtDuree, heureDuSoir } from "../core/temps";
import { Barre, Carte, conseilDuJour, fmtDate, fmtH, plural, useApp } from "../ui";
import FaireBilan from "./Bilan";
import { FormNuit } from "./Journal";

function Presentation({ bilan }: { bilan: () => void }) {
  const { maj, priere } = useApp();
  const vu = () => maj((d) => ({ ...d, reglages: { ...d.reglages, accueilVu: true, maj: Date.now() } }));
  return (
    <Carte titre="Bienvenue dans Rayan's Sommeil" className="hero">
      <p>L'idée est simple : te coucher assez tôt pour dormir ton compte avant <b>Fajr</b>, et garder des horaires réguliers.</p>
      <ul className="guide">
        <li><b>Ce soir</b> : ton heure de coucher conseillée, calculée à partir de Fajr, et une petite routine.</li>
        <li><b>Ce matin</b> : le journal (moins de 30 secondes).</li>
        <li><b>Progrès</b> : des tendances, jamais de note.</li>
        <li><b>Fiches</b> : ce que dit vraiment la recherche, mythes compris.</li>
      </ul>
      <p className="muted petit">{priere ? `Lieu et méthode repris de Rayan's Prière (${priere.lieu}).` : "Rayan's Prière n'est pas trouvé : choisis ta ville dans Réglages (Paris en attendant)."}</p>
      <p className="muted petit">Cette app n'est pas un avis médical.</p>
      <div className="choix">
        <button className="btn primary" onClick={() => { vu(); bilan(); }}>Faire le bilan de départ (1 min)</button>
        <button className="btn" onClick={vu}>Plus tard</button>
      </div>
    </Carte>
  );
}

function CeSoir() {
  const { db, priere, aller } = useApp();
  const { conseil: c, params, soir } = conseilDuJour(db, priere);
  const r = db.reglages;
  const origine = params.origine === "priere" ? "réglages de Rayan's Prière" : params.origine === "perso" ? "tes réglages" : "Paris par défaut, à changer dans Réglages";
  if (!c.valide) return <Carte titre="Ce soir"><p>Fajr ne peut pas être calculé ce jour-là pour ce lieu. Vérifie le lieu et la règle des hautes latitudes dans Réglages.</p></Carte>;
  return (
    <Carte titre="Ce soir" className="hero">
      <div className="grand-conseil">
        <span className="muted">Coucher conseillé</span>
        <b>{fmtH(c.coucher)}</b>
      </div>
      <ul className="horaire">
        {!r.recoucher ? (
          <>
            <li><span>Endormissement visé</span><b>{fmtH(c.endormi)}</b></li>
            <li><span>Fajr et lever</span><b>{fmtH(c.fajr)}</b></li>
            <li><span>Sommeil</span><b>{fmtDuree(r.dureeMin)}</b></li>
          </>
        ) : (
          <>
            <li><span>1ʳᵉ partie, jusqu'à Fajr</span><b>{fmtDuree(c.partie1)}</b></li>
            <li><span>Fajr</span><b>{fmtH(c.fajr)}</b></li>
            {c.reprise !== null && <li><span>Recoucher vers</span><b>{fmtH(c.reprise)}</b></li>}
            {c.partie2 > 0 && <li><span>2ᵉ partie</span><b>{fmtDuree(c.partie2)}</b></li>}
            <li><span>Lever final</span><b>{fmtH(c.lever)}</b></li>
          </>
        )}
        <li><span>Routine à partir de</span><b>{fmtH(c.debutRoutine)}</b></li>
        <li><span>Dernier café conseillé avant</span><b>{fmtH(c.dernierCafe)}</b></li>
      </ul>
      {r.recoucher && <p className="muted petit">Dormir en deux fois est un choix possible, mais il n'est pas prouvé meilleur qu'une nuit d'un bloc : ce qui compte, c'est la durée totale et la régularité.{c.partie2 === 0 ? " Ce soir, la 1ʳᵉ partie suffit déjà." : c.partie2 < 30 ? " Il ne manque que quelques minutes : rester debout après Fajr est aussi une bonne option." : ""}</p>}
      <p className="muted petit">Fajr {new Date().getHours() < r.heureJour ? "de ce matin" : `du ${fmtDate(ajouterJours(soir, 1))}`} calculé pour {params.lieu} ({origine}). Durée visée {fmtDuree(r.dureeMin)}, {r.latenceMin} min pour s'endormir. <button className="lien" onClick={() => aller("reglages")}>Changer</button></p>
    </Carte>
  );
}

function ObjectifSemaine() {
  const { db, priere } = useApp();
  const { cible } = conseilDuJour(db, priere);
  const o = db.objectif;
  if (o.debut === null)
    return (
      <Carte titre="Objectif de la semaine">
        <p className="muted">Il démarre après 3 nuits notées dans le journal : on part de ton heure de coucher habituelle, puis on la rapproche de {heureDuSoir(cible)} par paliers de 15 min, à ton rythme.</p>
      </Carte>
    );
  const tenues = nuitsTenues(db.nuits, o.debut, o.heure);
  return (
    <Carte titre="Objectif de la semaine">
      <p>Te coucher vers <b>{heureDuSoir(o.heure)}</b> au moins 5 nuits sur 7 <span className="muted">(heure conseillée : {heureDuSoir(cible)})</span>.</p>
      <Barre part={tenues / 5} />
      <p className="muted petit">Cette semaine : {plural(tenues, "nuit tenue", "nuits tenues")} (10 min de marge). {phraseObjectif(o, cible)}</p>
    </Carte>
  );
}

function Routine() {
  const { db, maj, priere } = useApp();
  const { soir } = conseilDuJour(db, priere);
  const faits = db.routineFaite[soir]?.ids ?? [];
  const elements = db.routine.elements.filter((e) => e.actif);
  const basculer = (id: string) => maj((d) => {
    const cur = d.routineFaite[soir]?.ids ?? [];
    const ids = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    return { ...d, routineFaite: { ...d.routineFaite, [soir]: { ids, maj: Date.now() } } };
  });
  if (!elements.length) return null;
  const n = elements.filter((e) => faits.includes(e.id)).length;
  return (
    <Carte titre={`Routine du soir (${n} / ${elements.length})`}>
      <ul className="routine">
        {elements.map((e) => (
          <li key={e.id}><label className="case-a-cocher"><input type="checkbox" checked={faits.includes(e.id)} onChange={() => basculer(e.id)} /> {e.texte}</label></li>
        ))}
      </ul>
      <p className="muted petit">Pas besoin de tout cocher : garde ce qui t'aide. La liste se modifie dans Réglages.</p>
    </Carte>
  );
}

function CeMatin() {
  const { db } = useApp();
  const jour = dayKey(Date.now(), db.reglages.heureJour);
  const nuit = db.nuits.find((n) => n.id === jour && !n.supprime);
  const [edition, setEdition] = useState(!nuit);
  return (
    <Carte titre="Ce matin : ta nuit">
      {nuit && !edition ? (
        <>
          <p>Nuit notée ✓ — {nuit.coucher} → {nuit.lever}, environ {fmtDuree(dureeNuit(nuit))}, énergie {nuit.energie}/5.</p>
          <p className="muted petit">Série : {plural(serie(db.nuits, jour), "jour noté", "jours notés")} d'affilée.</p>
          <button className="btn petit" onClick={() => setEdition(true)}>Modifier</button>
        </>
      ) : <FormNuit jour={jour} apres={() => setEdition(false)} />}
    </Carte>
  );
}

export default function PageJour() {
  const { db, aller } = useApp();
  const [bilan, setBilan] = useState(false);
  const now = Date.now();
  const matin = moment(now, db.reglages.heureJour) === "matin";
  if (bilan) return <div className="pile"><FaireBilan fini={() => setBilan(false)} /></div>;
  return (
    <div className="pile">
      {!db.reglages.accueilVu && <Presentation bilan={() => setBilan(true)} />}
      {matin ? <><CeMatin /><CeSoir /></> : <><CeSoir /><Routine /></>}
      <ObjectifSemaine />
      {matin && <Routine />}
      {!matin && <CeMatin />}
      {db.reglages.accueilVu && bilanAFaire(db.bilans, now) && (
        <Carte titre={db.bilans.length ? "Bilan de la semaine" : "Bilan de départ"}>
          <p className="muted">6 questions, 1 minute, pour comparer ton ressenti d'une semaine à l'autre.</p>
          <button className="btn primary" onClick={() => setBilan(true)}>Faire le bilan</button>
        </Carte>
      )}
      <button className="bandeau-medecin" onClick={() => aller("fiches", "medecin")}>🩺 Quand voir un médecin — cette app n'est pas un avis médical</button>
    </div>
  );
}
