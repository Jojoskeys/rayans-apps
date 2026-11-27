// Mes mots : ceux déjà découverts, avec leur lecture, leur sens et leur prochaine révision ; et toute la liste.
import { useMemo, useState } from "react";
import { estSu, prochaineRevision } from "../core/espacement";
import { ecrit, mots } from "../core/langues";
import { BoutonEcoute, Carte, Choix, Lecture, useApp, voyellesPour } from "../ui";

export default function PageMots() {
  const { db, langue } = useApp();
  const [vue, setVue] = useState<"vus" | "tous">("vus");
  const [cherche, setCherche] = useState("");
  const cartes = useMemo(() => new Map(db.cartes.filter((c) => c.langue === langue).map((c) => [c.mot, c])), [db.cartes, langue]);
  const liste = mots(langue).filter((m) => (vue === "tous" || cartes.has(m.id)) && (!cherche.trim() || `${m.fr} ${m.lecture} ${m.ecrit}`.toLowerCase().includes(cherche.trim().toLowerCase())));
  const sus = [...cartes.values()].filter(estSu).length;
  return (
    <div className="pile">
      <Carte titre="Mes mots">
        <p className="muted petit">{cartes.size} découverts sur {mots(langue).length}, dont {sus} bien sus (tenus au moins une semaine).</p>
        <Choix valeur={vue} options={[{ v: "vus", t: "Découverts" }, { v: "tous", t: "Toute la liste" }]} onChange={setVue} />
        <label className="champ">Chercher (français, lecture ou écrit)<input value={cherche} onChange={(e) => setCherche(e.target.value)} /></label>
      </Carte>
      <Carte>
        {liste.length === 0 ? <p className="muted">{vue === "vus" ? "Aucun mot découvert pour l'instant : la séance du jour t'en fera découvrir." : "Aucun mot trouvé."}</p> : (
          <ul className="liste-mots">
            {liste.map((m) => {
              const c = cartes.get(m.id);
              return (
                <li key={m.id}>
                  <span className={`ecrit petit ${langue}`}>{ecrit(m, voyellesPour(db, m))}</span>
                  <span><Lecture langue={langue} texte={m.lecture} gauche /> {m.fr}</span>
                  <span className="muted petit">{c ? (estSu(c) ? "✓ su · " : "") + prochaineRevision(c, Date.now(), db.reglages.heureJour) : "pas encore vu"} <BoutonEcoute texte={m.ecrit} langue={langue} /></span>
                </li>
              );
            })}
          </ul>
        )}
      </Carte>
    </div>
  );
}
