// Journal du matin : moins de 30 secondes à remplir, tout modifiable ensuite.
import { useState } from "react";
import { dayKey, type Nuit } from "../core/model";
import { actives, dureeNuit } from "../core/stats";
import { ajouterJours, fmtDuree } from "../core/temps";
import { Carte, Choix, conseilDuJour, fmtDate, fmtH, useApp } from "../ui";

/** Valeurs proposées pour une nuit pas encore notée : la nuit précédente, sinon le conseil. */
function brouillon(nuits: Nuit[], id: string, coucher: string, lever: string): Nuit {
  const der = actives(nuits).filter((n) => n.id < id).pop();
  return {
    id, coucher: der?.coucher ?? coucher, endormi: der?.endormi ?? coucher, reveils: 0, lever: der?.lever ?? lever,
    energie: 3, sieste: 0, cafeine: false, ecran: false, maj: 0,
  };
}

export function FormNuit({ jour, apres }: { jour: string; apres?: () => void }) {
  const { db, maj, priere } = useApp();
  const existante = db.nuits.find((n) => n.id === jour && !n.supprime);
  const c = conseilDuJour(db, priere);
  const [n, setN] = useState<Nuit>(() => existante ?? brouillon(db.nuits, jour, fmtH(c.conseil.coucher), fmtH(c.conseil.lever)));
  const set = (x: Partial<Nuit>) => setN((v) => ({ ...v, ...x }));
  const enregistrer = () => {
    const nuit = { ...n, maj: Date.now() };
    delete nuit.supprime;
    maj((d) => ({ ...d, nuits: [...d.nuits.filter((x) => x.id !== jour), nuit].sort((a, b) => a.id.localeCompare(b.id)) }));
    apres?.();
  };
  return (
    <div className="form-nuit">
      <div className="heures">
        <label className="champ">Couché à<input type="time" value={n.coucher} onChange={(e) => e.target.value && set({ coucher: e.target.value })} /></label>
        <label className="champ">Endormi vers<input type="time" value={n.endormi} onChange={(e) => e.target.value && set({ endormi: e.target.value })} /></label>
        <label className="champ">Levé à<input type="time" value={n.lever} onChange={(e) => e.target.value && set({ lever: e.target.value })} /></label>
      </div>
      <p className="muted petit">Sommeil estimé : {fmtDuree(dureeNuit(n))}</p>
      <div className="ligne-champ"><span>Réveils dans la nuit</span>
        <Choix valeur={n.reveils} onChange={(v) => set({ reveils: v })} options={[{ v: 0, t: "0" }, { v: 1, t: "1" }, { v: 2, t: "2" }, { v: 3, t: "3 +" }]} />
      </div>
      <div className="ligne-champ"><span>Énergie au réveil</span>
        <Choix valeur={n.energie} onChange={(v) => set({ energie: v })} options={[1, 2, 3, 4, 5].map((v) => ({ v: v as Nuit["energie"], t: String(v) }))} />
      </div>
      <div className="ligne-champ"><span>Sieste (la veille)</span>
        <Choix valeur={n.sieste} onChange={(v) => set({ sieste: v })} options={[{ v: 0, t: "Non" }, { v: 10, t: "10 min" }, { v: 20, t: "20 min" }, { v: 45, t: "45 min" }, { v: 90, t: "1 h 30" }]} />
      </div>
      <div className="ligne-champ"><span>Caféine après 14 h</span>
        <Choix valeur={n.cafeine ? 1 : 0} onChange={(v) => set({ cafeine: v === 1 })} options={[{ v: 0, t: "Non" }, { v: 1, t: "Oui" }]} />
      </div>
      <div className="ligne-champ"><span>Écran la dernière heure</span>
        <Choix valeur={n.ecran ? 1 : 0} onChange={(v) => set({ ecran: v === 1 })} options={[{ v: 0, t: "Non" }, { v: 1, t: "Oui" }]} />
      </div>
      <div className="choix"><button className="btn primary gros" onClick={enregistrer}>{existante ? "Mettre à jour" : "Enregistrer la nuit"}</button></div>
    </div>
  );
}

export default function PageJournal() {
  const { db, maj } = useApp();
  const aujourdHui = dayKey(Date.now(), db.reglages.heureJour);
  const [jour, setJour] = useState<string | null>(null);
  const nuits = actives(db.nuits).reverse();
  const supprimer = (id: string) => {
    if (!confirm(`Supprimer la nuit du ${fmtDate(id)} ?`)) return;
    maj((d) => ({ ...d, nuits: d.nuits.map((n) => (n.id === id ? { ...n, supprime: true, maj: Date.now() } : n)) }));
  };
  if (jour)
    return (
      <div className="pile">
        <button className="btn petit retour" onClick={() => setJour(null)}>← Journal</button>
        <Carte titre={`Nuit du ${fmtDate(ajouterJours(jour, -1))} au ${fmtDate(jour)}`}><FormNuit key={jour} jour={jour} apres={() => setJour(null)} /></Carte>
      </div>
    );
  return (
    <div className="pile">
      <Carte titre="Journal">
        <p className="muted petit">Une ligne par nuit, notée le matin. Pas besoin d'être précis à la minute : une estimation suffit.</p>
        <div className="choix">
          <button className="btn primary" onClick={() => setJour(aujourdHui)}>{db.nuits.some((n) => n.id === aujourdHui && !n.supprime) ? "Modifier la nuit dernière" : "Noter la nuit dernière"}</button>
          <label className="champ en-ligne">Autre nuit (jour du réveil)
            <input type="date" max={aujourdHui} onChange={(e) => e.target.value && setJour(e.target.value)} />
          </label>
        </div>
      </Carte>
      {nuits.length === 0 ? <p className="muted centre">Aucune nuit notée pour l'instant.</p> : (
        <ul className="liste-nuits">
          {nuits.map((n) => (
            <li key={n.id}>
              <div>
                <b>{fmtDate(n.id)}</b>
                <span className="muted petit"> {n.coucher} → {n.lever} · {fmtDuree(dureeNuit(n))} · énergie {n.energie}/5{n.reveils ? ` · ${n.reveils === 3 ? "3 réveils ou +" : `${n.reveils} réveil${n.reveils > 1 ? "s" : ""}`}` : ""}{n.sieste ? ` · sieste ${n.sieste} min` : ""}{n.cafeine ? " · ☕" : ""}{n.ecran ? " · 📱" : ""}</span>
              </div>
              <div className="choix">
                <button className="btn mini" onClick={() => setJour(n.id)}>Modifier</button>
                <button className="btn mini" onClick={() => supprimer(n.id)}>Supprimer</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
