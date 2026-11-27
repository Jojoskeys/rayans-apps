// Les trois exercices : mémoire de position, vision sans échiquier, tactiques. Chacun joue `nb` manches,
// enregistre chaque manche (le niveau monte ou descend) puis appelle `onFin`.
import type { Config } from "chessground/config";
import type { Key } from "chessground/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { ecrirePlacement, type Couleur, type Piece, type Placement, type TypePiece } from "./core/echiquier";
import { choisirPosition, departReconstruction, noterReconstruction, paramsMemoire, type PositionMemoire, type ScoreMemoire } from "./core/positions";
import { makeRng, randomSeed } from "./core/rng";
import { coupSolution, destinations, jouerCoup, sanFr, THEMES, trait, type Tactique } from "./core/tactiques";
import { corriger, questionAuHasard, type QuestionVision } from "./core/vision";
import { Plateau } from "./Plateau";
import { avecResultat, Barre, sonFaux, sonJuste, useApp } from "./ui";

const GLYPHES: Record<Couleur, Record<TypePiece, string>> = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};
const TYPES: TypePiece[] = ["k", "q", "r", "b", "n", "p"];

function EnTete({ titre, manche, nb, niveau }: { titre: string; manche: number; nb: number; niveau: number }) {
  return (
    <div className="partie-tete">
      <h2>{titre}</h2>
      <span className="pastille">Niveau {niveau}</span>
      <span className="pastille">{Math.min(manche + 1, nb)} / {nb}</span>
    </div>
  );
}

// ===== Mémoire de position =====================================================================================

type PhaseMemoire = "pret" | "regarder" | "replacer" | "bilan";

export function ExoMemoire({ nb, onFin }: { nb: number; onFin: () => void }) {
  const { db, maj } = useApp();
  const rng = useMemo(() => makeRng(randomSeed()), []);
  const [manche, setManche] = useState(0);
  const [phase, setPhase] = useState<PhaseMemoire>("pret");
  const [pos, setPos] = useState<PositionMemoire | null>(null);
  const [params, setParams] = useState(() => paramsMemoire(db.niveaux.memoire.level));
  const [reste, setReste] = useState(0);
  const [pose, setPose] = useState<Placement>({});
  const [outil, setOutil] = useState<Piece | "gomme">({ color: "w", type: "p" });
  const [score, setScore] = useState<ScoreMemoire | null>(null);
  const vues = useRef<string[]>(db.resultats.filter((r) => r.exo === "memoire" && r.ref).slice(-15).map((r) => r.ref!));
  const niveau = db.niveaux.memoire.level;

  const commencer = () => {
    const p = paramsMemoire(niveau);
    const choix = choisirPosition(niveau, rng, vues.current);
    vues.current.push(choix.id);
    setParams(p);
    setPos(choix);
    setPose(departReconstruction(choix.fen, p.pionsDonnes));
    setOutil({ color: "w", type: p.pionsDonnes ? "n" : "p" });
    setReste(p.secondes);
    setScore(null);
    setPhase("regarder");
  };

  useEffect(() => {
    if (phase !== "regarder") return;
    if (reste <= 0) { setPhase("replacer"); return; }
    const t = setTimeout(() => setReste((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, reste]);

  // Clic sur une case : pose la pièce choisie, ou l'enlève si c'est la même (ou avec la gomme).
  const clic = useRef<(k: string) => void>(() => {});
  clic.current = (k: string) => {
    if (phase !== "replacer" || !pos) return;
    const donnees = departReconstruction(pos.fen, params.pionsDonnes);
    if (donnees[k]) return;
    setPose((p) => {
      const n = { ...p };
      const x = n[k];
      if (outil === "gomme" || (x && x.color === outil.color && x.type === outil.type)) delete n[k];
      else n[k] = outil;
      return n;
    });
  };

  const valider = () => {
    if (!pos) return;
    const s = noterReconstruction(pos.fen, pose, params.pionsDonnes);
    setScore(s);
    setPhase("bilan");
    (s.reussi ? sonJuste : sonFaux)(db.reglages.sons);
    maj((d) => avecResultat(d, { exo: "memoire", niveau, score: Math.max(0, s.justes - s.fausses), max: s.total, reussi: s.reussi, ref: pos.id }));
  };

  const config = useMemo<Config>(() => {
    const base: Config = { coordinates: db.reglages.coordonnees, orientation: "white", movable: { free: false, color: undefined }, draggable: { enabled: false }, drawable: { enabled: false, autoShapes: [] } };
    if (phase === "regarder" && pos) return { ...base, fen: pos.fen, viewOnly: true };
    if (phase === "replacer") return { ...base, fen: ecrirePlacement(pose), viewOnly: false, selectable: { enabled: true }, events: { select: (k: Key) => clic.current(k) } };
    if (phase === "bilan" && pos && score) {
      const brush = { juste: "green", fausse: "red", oubliee: "yellow" } as const;
      return { ...base, fen: ecrirePlacement(pose), viewOnly: true, drawable: { enabled: false, autoShapes: Object.entries(score.cases).map(([sq, c]) => ({ orig: sq as Key, brush: brush[c] })) } };
    }
    return { ...base, fen: "8/8/8/8/8/8/8/8", viewOnly: true };
  }, [phase, pos, pose, score, db.reglages.coordonnees]);

  const suivant = () => {
    if (manche + 1 >= nb) { onFin(); return; }
    setManche((m) => m + 1);
    setPhase("pret");
  };

  return (
    <div className="exo">
      <EnTete titre="🧠 Mémoire de position" manche={manche} nb={nb} niveau={niveau} />
      <div className="exo-corps">
        <div className="exo-plateau">
          <Plateau config={config} />
          {phase === "bilan" && pos && <div className="exo-plateau-vrai"><p className="muted petit">La vraie position :</p><Plateau petit config={{ fen: pos.fen, viewOnly: true, coordinates: false }} /></div>}
        </div>
        <div className="exo-panneau">
          {phase === "pret" && (
            <>
              <p>Une vraie position va s'afficher <b>{paramsMemoire(niveau).secondes} secondes</b>. Regarde les groupes de pièces (le roque, les pions, les pièces qui travaillent ensemble), puis replace-la.</p>
              {paramsMemoire(niveau).pionsDonnes && <p className="muted petit">À ce niveau, les pions restent sur l'échiquier : replace seulement les pièces.</p>}
              <button className="btn primary gros" onClick={commencer}>Je suis prêt</button>
            </>
          )}
          {phase === "regarder" && (
            <>
              <p className="grand-chiffre">{reste}</p>
              <Barre part={reste / params.secondes} />
              <p className="muted petit">{pos?.nom}</p>
              <button className="btn" onClick={() => setPhase("replacer")}>J'ai retenu</button>
            </>
          )}
          {phase === "replacer" && (
            <>
              <p>Choisis une pièce puis clique les cases. Clique de nouveau pour l'enlever.</p>
              <div className="palette">
                {(["w", "b"] as Couleur[]).map((c) => (
                  <div key={c} className="palette-ligne">
                    {TYPES.map((t) => (
                      <button key={t} className={`piece-btn ${outil !== "gomme" && outil.color === c && outil.type === t ? "actif" : ""}`} title={`${t === "p" ? "pion" : t} ${c === "w" ? "blanc" : "noir"}`} onClick={() => setOutil({ color: c, type: t })}>{GLYPHES[c][t]}</button>
                    ))}
                  </div>
                ))}
                <button className={`btn petit ${outil === "gomme" ? "appuye" : ""}`} onClick={() => setOutil("gomme")}>Gomme</button>
              </div>
              <div className="choix">
                <button className="btn primary" onClick={valider}>Valider</button>
                <button className="btn petit" onClick={() => setPose(pos ? departReconstruction(pos.fen, params.pionsDonnes) : {})}>Tout effacer</button>
              </div>
            </>
          )}
          {phase === "bilan" && score && (
            <>
              <p className={`verdict ${score.reussi ? "ok" : score.part >= 0.5 ? "moyen" : "ko"}`}>{score.reussi ? "Réussi !" : "Pas encore"} — {Math.round(score.part * 100)} %</p>
              <ul className="points">
                <li><span className="rond vert" /> {score.justes} / {score.total} bien placées</li>
                <li><span className="rond rouge" /> {score.fausses} mal placées (chacune retire un point)</li>
                <li><span className="rond jaune" /> {score.oubliees} oubliées</li>
              </ul>
              <p className="muted petit">{pos?.nom}</p>
              <button className="btn primary" onClick={suivant}>{manche + 1 >= nb ? "Terminer" : "Position suivante"}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Vision sans échiquier ===================================================================================

export function ExoVision({ nb, onFin }: { nb: number; onFin: () => void }) {
  const { db, maj } = useApp();
  const rng = useMemo(() => makeRng(randomSeed()), []);
  const niveau = db.niveaux.vision.level;
  const [manche, setManche] = useState(0);
  const [q, setQ] = useState<QuestionVision>(() => questionAuHasard(rng, niveau));
  const [coches, setCoches] = useState<string[]>([]);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const debut = useRef(Date.now());

  const repondre = (rep: boolean | string[]) => {
    if (verdict !== null) return;
    const bon = corriger(q, rep);
    setVerdict(bon);
    (bon ? sonJuste : sonFaux)(db.reglages.sons);
    maj((d) => avecResultat(d, { exo: "vision", niveau, score: bon ? 1 : 0, max: 1, reussi: bon, ref: q.type, ms: Date.now() - debut.current }));
  };
  const suivant = () => {
    if (manche + 1 >= nb) { onFin(); return; }
    setManche((m) => m + 1);
    setQ(questionAuHasard(rng, db.niveaux.vision.level));
    setCoches([]);
    setVerdict(null);
    debut.current = Date.now();
  };
  const config = useMemo<Config>(() => ({ fen: q.fen, viewOnly: true, coordinates: db.reglages.coordonnees }), [q, db.reglages.coordonnees]);

  return (
    <div className="exo">
      <EnTete titre="👁 Vision sans échiquier" manche={manche} nb={nb} niveau={niveau} />
      <div className="exo-corps">
        <div className="exo-panneau large">
          <div className="position-texte">
            <p><b>Blancs :</b> {q.blancs}</p>
            <p><b>Noirs :</b> {q.noirs}</p>
          </div>
          <p className="consigne">{q.enonce}</p>
          {q.type === "case" ? (
            <div className="choix">
              <button className="btn gros" disabled={verdict !== null} onClick={() => repondre(true)}>Oui</button>
              <button className="btn gros" disabled={verdict !== null} onClick={() => repondre(false)}>Non</button>
            </div>
          ) : (
            <>
              <div className="puces">
                {q.options.map((o) => (
                  <button key={o.sq} disabled={verdict !== null}
                    className={`puce ${coches.includes(o.sq) ? "cochee" : ""} ${verdict !== null && q.bonnes.includes(o.sq) ? "bonne" : ""}`}
                    onClick={() => setCoches((c) => (c.includes(o.sq) ? c.filter((x) => x !== o.sq) : [...c, o.sq]))}>{o.nom}</button>
                ))}
              </div>
              <button className="btn primary" disabled={verdict !== null} onClick={() => repondre(coches)}>{coches.length ? "Valider" : "Valider : aucune"}</button>
            </>
          )}
          {verdict !== null && (
            <>
              <p className={`verdict ${verdict ? "ok" : "ko"}`}>{verdict ? "Juste !" : "Raté"}</p>
              <p>{q.explication}</p>
              <button className="btn primary" onClick={suivant}>{manche + 1 >= nb ? "Terminer" : "Question suivante"}</button>
            </>
          )}
        </div>
        {verdict !== null && <div className="exo-plateau"><p className="muted petit">Pour vérifier, l'échiquier :</p><Plateau petit config={config} /></div>}
      </div>
      <p className="muted petit">« Contrôler » une case, c'est pouvoir y prendre : un pion contrôle en diagonale, et une pièce clouée contrôle quand même ses cases.</p>
    </div>
  );
}

// ===== Tactiques ===============================================================================================

export function ExoTactiques({ serie, onFin }: { serie: Tactique[]; onFin: () => void }) {
  const { db, maj } = useApp();
  const [i, setI] = useState(0);
  const [res, setRes] = useState<{ san: string; bon: boolean; fen: string } | null>(null);
  const t = serie[i];
  const niveau = db.niveaux.tactiques.level;
  const jouer = useRef<(from: string, to: string) => void>(() => {});
  jouer.current = (from, to) => {
    if (!t || res) return;
    const r = jouerCoup(t, from, to);
    if (!r) return;
    setRes({ ...r, fen: t.fen });
    (r.bon ? sonJuste : sonFaux)(db.reglages.sons);
    maj((d) => avecResultat(d, { exo: "tactiques", niveau, score: r.bon ? 1 : 0, max: 1, reussi: r.bon, ref: t.id }));
  };
  const config = useMemo<Config>(() => {
    if (!t) return {};
    const couleur = trait(t.fen);
    const base: Config = { fen: t.fen, orientation: couleur, turnColor: couleur, coordinates: db.reglages.coordonnees, lastMove: undefined, drawable: { enabled: false, autoShapes: [] } };
    if (res) {
      const sol = coupSolution(t);
      return { ...base, viewOnly: false, movable: { color: undefined, dests: new Map() }, drawable: { enabled: false, autoShapes: res.bon ? [] : [{ orig: sol.from as Key, dest: sol.to as Key, brush: "green" }] } };
    }
    return { ...base, viewOnly: false, movable: { free: false, color: couleur, dests: destinations(t.fen) as Map<Key, Key[]>, showDests: true, events: { after: (o: Key, d: Key) => jouer.current(o, d) } } };
  }, [t, res, db.reglages.coordonnees]);

  if (!t)
    return (
      <div className="carte">
        <p>Aucune tactique à revoir pour l'instant, et toutes les tactiques de la banque ont déjà été vues. Reviens demain !</p>
        <button className="btn primary" onClick={onFin}>D'accord</button>
      </div>
    );
  const carte = db.cartes[t.id];
  const suivant = () => {
    if (i + 1 >= serie.length) { onFin(); return; }
    setI(i + 1);
    setRes(null);
  };
  return (
    <div className="exo">
      <EnTete titre={`⚔ ${THEMES[t.theme].nom}`} manche={i} nb={serie.length} niveau={niveau} />
      <div className="exo-corps">
        <div className="exo-plateau"><Plateau key={t.id} config={config} /></div>
        <div className="exo-panneau">
          <p><b>Aux {trait(t.fen) === "white" ? "Blancs" : "Noirs"} de jouer.</b> {THEMES[t.theme].consigne}</p>
          {carte && !res && <p className="muted petit">Révision ({carte.reussites} / {carte.essais} trouvée{carte.reussites > 1 ? "s" : ""} jusqu'ici).</p>}
          {!res && <details className="indice"><summary>Un indice ?</summary><p>{THEMES[t.theme].idee}</p></details>}
          {res && (
            <>
              <p className={`verdict ${res.bon ? "ok" : "ko"}`}>{res.bon ? `Bien joué : ${sanFr(res.san)}` : `Non : ${sanFr(res.san)} ne marche pas.`}</p>
              <p>{t.explication}</p>
              {t.origine && <p className="muted petit">{t.origine}</p>}
              <p className="muted petit">{res.bon ? "Elle reviendra plus tard, à un intervalle plus long." : "Elle reviendra demain."}</p>
              <button className="btn primary" onClick={suivant}>{i + 1 >= serie.length ? "Terminer" : "Tactique suivante"}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
