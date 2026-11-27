// Lettres arabes : reconnaître une lettre, puis ses formes (début, milieu, fin de mot), puis parmi les lettres
// qui ne diffèrent que par leurs points.
import { useMemo, useState } from "react";
import { NOMS_FORMES, type Lettre } from "../core/arabe";
import { mancheReussie } from "../core/niveaux";
import { makeRng, randomSeed } from "../core/rng";
import { itemsLettres } from "../core/seance";
import { Avancement, BoutonEcoute, Carte, Ecrit, finirManche, useApp } from "../ui";
import { Bilan } from "./commun";

export default function ExoLettres({ n, fin }: { n: number; fin: () => void }) {
  const { db, maj } = useApp();
  const niveau = db.niveaux.ar.lettres.level;
  const [items] = useState(() => itemsLettres(makeRng(randomSeed()), niveau, n));
  const [i, setI] = useState(0);
  const [rep, setRep] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [fini, setFini] = useState(false);
  const it = items[i];
  const titre = useMemo(() => (it && it.forme !== "isolee" ? `Quelle lettre ? (forme ${NOMS_FORMES[it.forme]} d'un mot)` : "Quelle lettre ?"), [it]);
  if (fini) return <Bilan titre="Lettres arabes" score={score} max={items.length} niveau={niveau} continuer={fin} />;

  const repondre = (l: Lettre) => { if (rep) return; setRep(l.l); if (l.l === it.lettre.l) setScore((s) => s + 1); };
  const suivant = () => {
    setRep(null);
    if (i + 1 < items.length) { setI(i + 1); return; }
    const s = score;
    maj((d) => finirManche(d, "ar", "lettres", s, items.length, mancheReussie(s, items.length)));
    setFini(true);
  };
  return (
    <Carte titre={titre}>
      <Avancement i={i} n={items.length} />
      <Ecrit langue="ar" texte={it.affiche} />
      <div className="reponses">
        {it.choix.map((l) => (
          <button key={l.l} className={`reponse ${rep ? (l.l === it.lettre.l ? "bonne" : l.l === rep ? "fausse" : "") : ""}`} disabled={!!rep} onClick={() => repondre(l)}>
            <b>{l.nom}</b> <span className="muted">({l.tr})</span>
          </button>
        ))}
      </div>
      {rep && (
        <>
          <p className="sens-fr"><span className="ar">{it.lettre.l}</span> — {it.lettre.nom} : {it.lettre.son}</p>
          {!it.lettre.lie && <p className="astuce petit">Cette lettre ne s'attache jamais à la lettre qui la suit.</p>}
          <div className="choix"><BoutonEcoute texte={it.lettre.l} langue="ar" /><button className="btn primary" autoFocus onClick={suivant}>Suivant</button></div>
        </>
      )}
    </Carte>
  );
}
