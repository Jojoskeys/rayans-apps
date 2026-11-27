// Tons à l'oreille (chinois) : on entend une syllabe et on choisit son ton. Plusieurs voix et hauteurs à partir
// du niveau 3, parce que les entraînements qui marchent font varier les voix (Wang et al. 1999).
import { useEffect, useMemo, useState } from "react";
import { mancheReussie, paramsTons } from "../core/niveaux";
import { NOMS_TONS, type Ton } from "../core/pinyin";
import { makeRng, randomSeed } from "../core/rng";
import { itemsTons } from "../core/seance";
import { Avancement, AvisVoix, Carte, Ecrit, finirManche, parler, Pinyin, useApp, useVoix } from "../ui";
import { Bilan } from "./commun";

const COURBES: Record<Ton, string> = { 1: "‾", 2: "/", 3: "∨", 4: "\\", 0: "·" };

export default function ExoTons({ n, fin }: { n: number; fin: () => void }) {
  const { db, maj } = useApp();
  const voix = useVoix("zh");
  const niveau = db.niveaux.zh.tons.level;
  const p = paramsTons(niveau);
  const rng = useMemo(() => makeRng(randomSeed()), []);
  const [items] = useState(() => itemsTons(rng, niveau, n));
  const [i, setI] = useState(0);
  const [rep, setRep] = useState<Ton | null>(null);
  const [score, setScore] = useState(0);
  const [fini, setFini] = useState(false);
  const it = items[i];
  // Voix et hauteur de cette syllabe (fixes pour la syllabe, variées d'une syllabe à l'autre au niveau 3 et plus).
  const style = useMemo(() => (p.plusieursVoix ? { voix: Math.floor(rng() * 8), hauteur: 0.85 + rng() * 0.3 } : { voix: 0, hauteur: 1 }), [i, p.plusieursVoix, rng]);
  const jouer = () => it && parler(it.hz, "zh", p.vitesse, style.voix, style.hauteur);
  useEffect(() => { if (voix.length && it && !fini) { const t = setTimeout(jouer, 250); return () => clearTimeout(t); } }, [i, voix.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!voix.length)
    return (
      <Carte titre="Tons à l'oreille">
        <AvisVoix langue="zh" />
        <p>Cet exercice a besoin d'une voix chinoise pour faire entendre les syllabes.</p>
        <div className="choix"><button className="btn primary" onClick={fin}>Passer</button></div>
      </Carte>
    );
  if (fini) return <Bilan titre="Tons à l'oreille" score={score} max={items.length} niveau={niveau} continuer={fin} />;

  const repondre = (t: Ton) => { if (rep !== null) return; setRep(t); if (t === it.ton) setScore((s) => s + 1); };
  const suivant = () => {
    setRep(null);
    if (i + 1 < items.length) { setI(i + 1); return; }
    const s = score;
    maj((d) => finirManche(d, "zh", "tons", s, items.length, mancheReussie(s, items.length)));
    setFini(true);
  };
  return (
    <Carte titre="Quel ton entends-tu ?">
      <Avancement i={i} n={items.length} />
      <div className="choix"><button className="btn gros" onClick={jouer}>🔊 Réécouter</button></div>
      <div className="reponses">
        {it.choix.map((t) => (
          <button key={t} className={`reponse ${rep !== null ? (t === it.ton ? "bonne" : t === rep ? "fausse" : "") : ""}`} disabled={rep !== null} onClick={() => repondre(t)}>
            <b className={`t${t}`} style={{ fontSize: "1.4rem" }}>{COURBES[t]}</b><br />{NOMS_TONS[t]}
          </button>
        ))}
      </div>
      {rep !== null && (
        <>
          <Ecrit langue="zh" texte={it.hz} taille="moyen" />
          <p className="lecture"><Pinyin texte={it.py} /></p>
          <div className="choix"><button className="btn primary" autoFocus onClick={suivant}>Suivant</button></div>
        </>
      )}
      <p className="muted petit">Les voix de synthèse ne rendent pas toujours les tons aussi nettement qu'une vraie voix : si une syllabe te semble ambiguë, ce n'est pas forcément toi.</p>
    </Carte>
  );
}
