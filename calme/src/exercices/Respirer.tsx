// Respiration lente guidée : cercle qui grandit et rétrécit, son doux et vibration en option, ressenti avant / après.
import { useEffect, useRef, useState } from "react";
import type { Respiration } from "../core/model";
import { apresRespiration, dureeProposee, phraseNiveau } from "../core/niveaux";
import { DUREES, instant, rythme, RYTHMES, SEUIL_ABANDON_S, type RythmeId, type TypePhase } from "../core/respiration";
import { newId } from "../core/rng";
import { fmtSecondes } from "../core/temps";
import { aujourdhui, Carte, Choix, Echelle, useApp, useChrono, useMoinsDeMouvement } from "../ui";

// ----- Son doux (Web Audio) : une note qui monte à l'inspiration et descend à l'expiration. -----------------------
class Son {
  private ctx: AudioContext | null = null;
  constructor() {
    try { this.ctx = new AudioContext(); } catch { this.ctx = null; }
  }
  jouer(type: TypePhase, s: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    const [de, a] = type === "expire" ? [392, 262] : type === "inspire2" ? [392, 440] : [262, 392];
    o.frequency.setValueAtTime(de, t);
    o.frequency.linearRampToValueAtTime(a, t + s);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + Math.min(0.6, s / 3));
    g.gain.linearRampToValueAtTime(0.0001, t + s);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + s + 0.05);
  }
  fermer() { void this.ctx?.close(); }
}

function vibrer(type: TypePhase) {
  try { navigator.vibrate?.(type === "expire" ? [15, 80, 15] : 30); } catch { /* pas de vibration */ }
}

export interface PropsRespirer {
  /** Durée imposée (séance du jour, examen), en secondes ; sinon l'utilisateur choisit (niveau adaptatif). */
  dureeS?: number;
  rythmeImpose?: RythmeId;
  /** Proposer de noter le ressenti avant / après (facultatif). */
  noter?: boolean;
  titre?: string;
  /** Appelé à la fin (terminée ou arrêtée). */
  onFini?: (r: Respiration | null) => void;
  /** Démarrer tout de suite (sans écran de choix). */
  direct?: boolean;
}

type Etat = "choix" | "en-cours" | "apres" | "fini";

export default function Respirer({ dureeS, rythmeImpose, noter = true, titre = "Respiration lente", onFini, direct }: PropsRespirer) {
  const { db, maj } = useApp();
  const libre = dureeS === undefined;
  const niveau = db.niveaux.respiration;
  const [rid, setRid] = useState<RythmeId>(rythmeImpose ?? db.reglages.rythme);
  const [duree, setDuree] = useState<number>(libre ? dureeProposee(niveau) : Math.max(1, Math.round(dureeS! / 60)));
  const [avant, setAvant] = useState<number | null>(null);
  const [apres, setApres] = useState<number | null>(null);
  const [etat, setEtat] = useState<Etat>(direct ? "en-cours" : "choix");
  const [pause, setPause] = useState(false);
  const [terminee, setTerminee] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [t, remettre] = useChrono(etat === "en-cours" && !pause);
  const reduit = useMoinsDeMouvement();
  const son = useRef<Son | null>(null);
  const dernierePhase = useRef("");
  const total = libre ? duree * 60 : dureeS!;
  const r = rythme(rid);
  const ins = instant(r, t);

  // Son et vibration au début de chaque phase.
  useEffect(() => {
    if (etat !== "en-cours" || pause) return;
    const cle = `${ins.cycle}-${ins.indexPhase}`;
    if (cle === dernierePhase.current) return;
    dernierePhase.current = cle;
    if (db.reglages.son) son.current?.jouer(ins.phase.type, ins.phase.s * (1 - ins.avance));
    if (db.reglages.vibration) vibrer(ins.phase.type);
  }, [ins.cycle, ins.indexPhase, etat, pause, db.reglages.son, db.reglages.vibration, ins.phase, ins.avance]);

  useEffect(() => () => son.current?.fermer(), []);

  // Fin du temps.
  useEffect(() => {
    if (etat === "en-cours" && t >= total) { setTerminee(true); finir(true); }
  });

  function demarrer() {
    if (db.reglages.son && !son.current) son.current = new Son();
    dernierePhase.current = "";
    setEtat("en-cours");
  }

  function finir(fin: boolean) {
    setTerminee(fin);
    if (!fin && t < SEUIL_ABANDON_S) {
      setEtat("fini");
      onFini?.(null);
      return;
    }
    if (noter) setEtat("apres");
    else enregistrer(fin, null);
  }

  function enregistrer(fin: boolean, noteApres: number | null) {
    const now = Date.now();
    const res: Respiration = {
      id: newId(), at: now, jour: aujourdhui(db, now), rythme: rid, dureeMin: libre ? duree : Math.max(1, Math.round(total / 60)),
      secondes: Math.round(Math.min(t, total)), terminee: fin,
      ...(avant !== null ? { avant } : {}), ...(noteApres !== null ? { apres: noteApres } : {}),
    };
    maj((d) => {
      const n = libre ? apresRespiration(d.niveaux.respiration, duree, fin, now) : d.niveaux.respiration;
      if (libre) setMessage(phraseNiveau(d.niveaux.respiration, n));
      return { ...d, respirations: [...d.respirations, res], niveaux: { ...d.niveaux, respiration: n } };
    });
    setEtat("fini");
    onFini?.(res);
  }

  if (etat === "choix")
    return (
      <Carte titre={titre}>
        {!rythmeImpose && (
          <>
            <p className="muted petit">Rythme</p>
            <Choix valeur={rid} options={RYTHMES.map((x) => ({ v: x.id, t: x.nom }))} onChange={setRid} />
          </>
        )}
        <p className="petit">{r.explication}</p>
        {libre && (
          <>
            <p className="muted petit">Durée {duree === dureeProposee(niveau) ? "(proposée pour toi)" : ""}</p>
            <Choix valeur={duree} options={DUREES.map((m) => ({ v: m, t: `${m} min` }))} onChange={setDuree} />
          </>
        )}
        {noter && (
          <>
            <p className="muted petit">Comment tu te sens là, tout de suite ? (facultatif)</p>
            <Echelle valeur={avant} min={1} max={10} onChange={(v) => setAvant(avant === v ? null : v)} bas="très tendu" haut="très calme" />
          </>
        )}
        <div className="choix"><button className="btn primary gros" onClick={demarrer}>Commencer</button></div>
        <p className="muted petit centre">Installe-toi confortablement. Si la tête tourne, reprends une respiration normale.</p>
      </Carte>
    );

  if (etat === "en-cours") {
    const taille = reduit ? 0.75 : 0.45 + 0.55 * ins.taille;
    return (
      <Carte titre={titre} className="respiration">
        <div className={`cercle-zone ${ins.phase.type}`} aria-live="polite">
          <svg viewBox="0 0 200 200" className="cercle" aria-hidden="true">
            <circle cx="100" cy="100" r="96" className="cercle-fond" />
            <circle cx="100" cy="100" r={90 * taille} className="cercle-souffle" />
          </svg>
          <div className="cercle-texte"><b>{ins.phase.texte}</b><span>{ins.reste}</span></div>
        </div>
        {reduit && <div className="barre"><div style={{ width: `${Math.round(ins.avance * 100)}%` }} /></div>}
        <p className="centre muted">{fmtSecondes(total - t)} restantes · {r.court}</p>
        <div className="choix">
          <button className="btn" onClick={() => setPause(!pause)}>{pause ? "Reprendre" : "Pause"}</button>
          <button className="btn" onClick={() => finir(false)}>Arrêter</button>
        </div>
        <p className="muted petit centre">Si ton esprit part ailleurs, c'est normal : reviens simplement au cercle.</p>
      </Carte>
    );
  }

  if (etat === "apres")
    return (
      <Carte titre={terminee ? "C'est fini, bien joué" : "Respiration arrêtée"}>
        <p>{terminee ? "Prends quelques secondes pour revenir doucement." : "Pas de souci, chaque minute compte."}</p>
        <p className="muted petit">Et maintenant, comment tu te sens ? (facultatif)</p>
        <Echelle valeur={apres} min={1} max={10} onChange={setApres} bas="très tendu" haut="très calme" />
        <div className="choix">
          <button className="btn" onClick={() => enregistrer(terminee, null)}>Passer</button>
          <button className="btn primary" disabled={apres === null} onClick={() => enregistrer(terminee, apres)}>Valider</button>
        </div>
      </Carte>
    );

  return (
    <Carte titre="Respiration enregistrée">
      {avant !== null && apres !== null && <p>Ressenti : {avant} → {apres}. La courbe est dans Progrès.</p>}
      {message && <p className="dans-app">{message}</p>}
      {libre && <div className="choix"><button className="btn" onClick={() => { remettre(); setEtat("choix"); setApres(null); setAvant(null); setMessage(null); }}>Encore une</button></div>}
    </Carte>
  );
}
