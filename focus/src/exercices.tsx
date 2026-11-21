// Les 5 exercices. Chaque composant joue UNE manche au niveau donné et appelle `onFin` ;
// `Partie` enchaîne les manches et fait évoluer le niveau (2 réussites → plus dur, 1 échec → plus facile).
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  bonneReponse, CHIFFRE_INTERDIT, COULEURS, essaisChangement, essaisFlanker, essaisStroop, fluxSoutenue, grilleRecherche,
  noterChangement, noterInterference, noterRecherche, noterSoutenue, planChangement, planFlanker, planRecherche, planSoutenue,
  planStroop, REGLES, type EssaiChangement,
} from "./core/exercices";
import { exoInfo, type ExoId } from "./core/niveaux";
import { makeRng, randomSeed, type Rng } from "./core/rng";
import { avecResultat, Carte, fmtMs, sonFaux, sonJuste, useApp } from "./ui";

export interface FinManche {
  reussi: boolean;
  /** Réponses justes. */
  score: number;
  /** Essais. */
  max: number;
  ms?: number;
  cout?: number;
  detail?: string;
  /** Ce qu'on montre à la fin de la manche. */
  lignes: string[];
}

export interface PropsExo {
  niveau: number;
  graine: number;
  sons: boolean;
  onFin: (r: FinManche) => void;
  /** Mode test : durée fixe (ms) au lieu d'un nombre d'essais fixe. */
  dureeMs?: number;
}

interface Reponse { valeur: string | null; ms: number | null }

/**
 * Présente `n` essais l'un après l'autre : un court temps vide, puis l'essai, jusqu'à la réponse ou la fin du temps.
 * Avec `dureeMs`, s'arrête après le premier essai qui finit au-delà de cette durée.
 */
function useSerie(n: number, limiteMs: number, fin: (r: Reponse[]) => void, opts: { pauseMs?: number; dureeMs?: number; surReponse?: (i: number, r: Reponse) => void } = {}) {
  const pauseMs = opts.pauseMs ?? 450;
  const [i, setI] = useState(0);
  const [montre, setMontre] = useState(false);
  const rep = useRef<Reponse[]>([]);
  const debut = useRef(0);
  const debutSerie = useRef(performance.now());
  const termine = useRef(false);
  const finRef = useRef(fin);
  finRef.current = fin;
  const surRef = useRef(opts.surReponse);
  surRef.current = opts.surReponse;
  const fini = i >= n || (opts.dureeMs !== undefined && i > 0 && performance.now() - debutSerie.current >= opts.dureeMs);
  useEffect(() => {
    if (fini) {
      if (!termine.current) { termine.current = true; finRef.current(rep.current.slice(0, i)); }
      return;
    }
    setMontre(false);
    const t1 = setTimeout(() => { setMontre(true); debut.current = performance.now(); }, pauseMs);
    const t2 = setTimeout(() => {
      if (rep.current[i]) return;
      rep.current[i] = { valeur: null, ms: null };
      surRef.current?.(i, rep.current[i]);
      setI(i + 1);
    }, pauseMs + limiteMs);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [i, fini, limiteMs, pauseMs]);
  const repondre = (valeur: string) => {
    if (!montre || fini || rep.current[i]) return;
    rep.current[i] = { valeur, ms: performance.now() - debut.current };
    surRef.current?.(i, rep.current[i]);
    setI(i + 1);
  };
  return { i, montre: montre && !fini, repondre };
}

/** Touches du clavier pendant un exercice. */
function useTouches(f: (key: string) => void) {
  const ref = useRef(f);
  ref.current = f;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", " ", "Spacebar"].includes(e.key)) e.preventDefault();
      if (!e.repeat) ref.current(e.key);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
}

const Progression = ({ i, n }: { i: number; n?: number }) => <p className="progression">{n ? `${Math.min(i + 1, n)} / ${n}` : `${i + 1}`}</p>;

// ----- 1. Trouver la cible ------------------------------------------------------------------------------------
export function ExoRecherche({ niveau, graine, sons, onFin, dureeMs }: PropsExo) {
  const plan = planRecherche(niveau);
  const n = dureeMs ? 200 : plan.grilles;
  const rng = useMemo<Rng>(() => makeRng(graine), [graine]);
  const grilles = useMemo(() => Array.from({ length: n }, () => grilleRecherche(rng, niveau)), [rng, n, niveau]);
  const { i, montre, repondre } = useSerie(n, plan.limiteMs, (rs) => {
    const essais = rs.map((r, k) => ({ juste: r.valeur === String(grilles[k].index), ms: r.ms }));
    const note = noterRecherche(essais);
    onFin({
      reussi: note.reussi, score: note.justes, max: note.total, ...(note.ms !== null ? { ms: note.ms } : {}),
      lignes: [`${note.justes} cible(s) trouvée(s) sur ${note.total}.`, `Temps moyen pour trouver : ${fmtMs(note.ms)}.`],
    });
  }, { pauseMs: 700, dureeMs, surReponse: (k, r) => (r.valeur === String(grilles[k].index) ? sonJuste(sons) : sonFaux(sons)) });
  const g = grilles[Math.min(i, n - 1)];
  return (
    <div className="scene large">
      <Progression i={i} n={dureeMs ? undefined : n} />
      <p className="consigne">Trouve : <span className="cible">{g.cible}</span></p>
      <div className="grille-recherche" style={{ gridTemplateColumns: `repeat(${g.colonnes}, 1fr)`, visibility: montre ? "visible" : "hidden" }}>
        {g.symboles.map((s, k) => (
          <button key={k} className="symbole" onClick={() => repondre(String(k))} tabIndex={-1}>{s}</button>
        ))}
      </div>
    </div>
  );
}

// ----- 2. Flèche du milieu ------------------------------------------------------------------------------------
export function ExoFlanker({ niveau, graine, sons, onFin, dureeMs }: PropsExo) {
  const plan = planFlanker(niveau);
  const essais = useMemo(() => essaisFlanker(makeRng(graine), niveau, dureeMs ? 300 : plan.essais), [graine, niveau, dureeMs, plan.essais]);
  const { i, montre, repondre } = useSerie(essais.length, plan.limiteMs, (rs) => {
    const note = noterInterference(rs.map((r, k) => ({ congruent: essais[k].congruent, juste: r.valeur === essais[k].centre, ms: r.ms })));
    onFin({
      reussi: note.reussi, score: note.justes, max: note.total, ...(note.ms !== null ? { ms: note.ms } : {}), ...(note.cout !== null ? { cout: note.cout } : {}),
      lignes: [
        `${note.justes} bonnes réponses sur ${note.total}.`,
        `Flèches toutes pareilles : ${fmtMs(note.msSansPiege)} · avec des flèches contraires : ${fmtMs(note.msAvecPiege)}.`,
        note.cout !== null ? `Les flèches trompeuses t'ont coûté ${note.cout} ms par réponse.` : "",
      ].filter(Boolean),
    });
  }, { dureeMs, surReponse: (k, r) => { if (r.valeur !== essais[k].centre) sonFaux(sons); } });
  useTouches((k) => { if (k === "ArrowLeft") repondre("gauche"); if (k === "ArrowRight") repondre("droite"); });
  const e = essais[Math.min(i, essais.length - 1)];
  return (
    <div className="scene">
      <Progression i={i} n={dureeMs ? undefined : essais.length} />
      <div className="fleches">{montre ? e.fleches : "+"}</div>
      <div className="choix">
        <button className="btn gros" onClick={() => repondre("gauche")}>← Gauche</button>
        <button className="btn gros" onClick={() => repondre("droite")}>Droite →</button>
      </div>
      <p className="muted petit">Regarde seulement la flèche du milieu. Clavier : flèches ← et →.</p>
    </div>
  );
}

// ----- 3. Couleur du mot --------------------------------------------------------------------------------------
export function ExoStroop({ niveau, graine, sons, onFin }: PropsExo) {
  const plan = planStroop(niveau);
  const essais = useMemo(() => essaisStroop(makeRng(graine), niveau), [graine, niveau]);
  const { i, montre, repondre } = useSerie(essais.length, plan.limiteMs, (rs) => {
    const note = noterInterference(rs.map((r, k) => ({ congruent: essais[k].congruent, juste: r.valeur === essais[k].encre, ms: r.ms })));
    onFin({
      reussi: note.reussi, score: note.justes, max: note.total, ...(note.ms !== null ? { ms: note.ms } : {}), ...(note.cout !== null ? { cout: note.cout } : {}),
      lignes: [
        `${note.justes} bonnes réponses sur ${note.total}.`,
        `Mot et encre pareils : ${fmtMs(note.msSansPiege)} · différents : ${fmtMs(note.msAvecPiege)}.`,
        note.cout !== null ? `Bloquer la lecture du mot t'a coûté ${note.cout} ms par réponse : c'est l'effet Stroop.` : "",
      ].filter(Boolean),
    });
  }, { surReponse: (k, r) => { if (r.valeur !== essais[k].encre) sonFaux(sons); } });
  const e = essais[Math.min(i, essais.length - 1)];
  const coul = (id: string) => COULEURS.find((c) => c.id === id)!;
  useTouches((k) => { const n = Number(k); if (n >= 1 && n <= 4) repondre(e.boutons[n - 1]); });
  return (
    <div className="scene">
      <Progression i={i} n={essais.length} />
      <div className="mot-couleur" style={{ color: coul(e.encre).hex }}>{montre ? coul(e.mot).nom : ""}</div>
      <div className="choix">
        {e.boutons.map((id, k) => (
          <button key={id} className="btn bouton-couleur" onClick={() => repondre(id)}>
            <span className="pastille-couleur" style={{ background: coul(id).hex }} /> {coul(id).nom.toLowerCase()} <small className="muted">{k + 1}</small>
          </button>
        ))}
      </div>
      <p className="muted petit">Clique la couleur de l'ENCRE. Clavier : 1 à 4.</p>
    </div>
  );
}

// ----- 4. Rester sur la tâche ---------------------------------------------------------------------------------
export function ExoSoutenue({ niveau, graine, sons, onFin }: PropsExo) {
  const plan = planSoutenue(niveau);
  const flux = useMemo(() => fluxSoutenue(makeRng(graine), niveau), [graine, niveau]);
  const [i, setI] = useState(-3);
  const appuis = useRef<boolean[]>([]);
  const [notif, setNotif] = useState<string | null>(null);
  const cliquees = useRef(0);
  const [flash, setFlash] = useState<"ok" | "ko" | null>(null);
  const termine = useRef(false);
  const finRef = useRef(onFin);
  finRef.current = onFin;
  useEffect(() => {
    if (i >= flux.chiffres.length) {
      if (termine.current) return;
      termine.current = true;
      const note = noterSoutenue(flux.chiffres, appuis.current, cliquees.current);
      finRef.current({
        reussi: note.reussi, score: note.score, max: note.max,
        lignes: [
          `Appuis justes : ${note.appuisJustes} / ${note.appuisTotal}.`,
          `3 bien retenus : ${note.retenusJustes} / ${note.retenusTotal}.`,
          ...(flux.notifications.length ? [note.notificationsCliquees ? `Tu as cliqué ${note.notificationsCliquees} notification(s) : la prochaine fois, laisse-les passer.` : "Tu as ignoré toutes les notifications. Bien joué."] : []),
        ],
      });
      return;
    }
    const n = flux.notifications.find((x) => x.index === i);
    if (n) setNotif(n.texte);
    const t = setTimeout(() => setI(i + 1), i < 0 ? 700 : plan.intervalleMs);
    return () => clearTimeout(t);
  }, [i, flux, plan.intervalleMs]);
  useEffect(() => {
    if (!notif) return;
    const t = setTimeout(() => setNotif(null), 2600);
    return () => clearTimeout(t);
  }, [notif]);
  const appuyer = () => {
    if (i < 0 || i >= flux.chiffres.length || appuis.current[i]) return;
    appuis.current[i] = true;
    const ok = flux.chiffres[i] !== CHIFFRE_INTERDIT;
    if (!ok) sonFaux(sons);
    setFlash(ok ? "ok" : "ko");
    setTimeout(() => setFlash(null), 150);
  };
  useTouches((k) => { if (k === " " || k === "Spacebar") appuyer(); });
  const c = i >= 0 && i < flux.chiffres.length ? flux.chiffres[i] : null;
  return (
    <div className="scene soutenue">
      <p className="progression">{i < 0 ? "Prépare-toi…" : `${Math.min(i + 1, flux.chiffres.length)} / ${flux.chiffres.length}`}</p>
      <div key={i} className={`grand-chiffre apparait ${flash ?? ""}`}>{c ?? (i < 0 ? -i : "")}</div>
      <button className="btn primary gros appui" onPointerDown={(e) => { e.preventDefault(); appuyer(); }}>Appuyer (Espace)</button>
      <p className="muted petit">Appuie pour tous les chiffres, sauf le 3.</p>
      {notif && (
        <button className="fausse-notif" onClick={() => { cliquees.current++; setNotif(null); }}>
          <b>Notification</b>
          <span>{notif}</span>
        </button>
      )}
    </div>
  );
}

// ----- 5. Coût du changement ----------------------------------------------------------------------------------
function SerieChangement({ essais, limiteMs, sons, onFin }: { essais: EssaiChangement[]; limiteMs: number; sons: boolean; onFin: (r: Reponse[]) => void }) {
  const { i, montre, repondre } = useSerie(essais.length, limiteMs, onFin, {
    pauseMs: 400,
    surReponse: (k, r) => { if (r.valeur !== bonneReponse(essais[k].regle, essais[k].chiffre)) sonFaux(sons); },
  });
  useTouches((k) => { if (k === "ArrowLeft") repondre("gauche"); if (k === "ArrowRight") repondre("droite"); });
  const e = essais[Math.min(i, essais.length - 1)];
  const r = REGLES[e.regle];
  return (
    <div className="scene">
      <Progression i={i} n={essais.length} />
      <div className="regle" style={{ borderColor: r.couleur, color: r.couleur }}>{r.question}</div>
      <div className="grand-chiffre" style={{ color: r.couleur }}>{montre ? e.chiffre : ""}</div>
      <div className="choix">
        <button className="btn gros" onClick={() => repondre("gauche")}>← {r.gauche}</button>
        <button className="btn gros" onClick={() => repondre("droite")}>{r.droite} →</button>
      </div>
      <p className="muted petit">Clavier : flèches ← et →.</p>
    </div>
  );
}

export function ExoChangement({ niveau, graine, sons, onFin }: PropsExo) {
  const plan = planChangement(niveau);
  const essais = useMemo(() => essaisChangement(makeRng(graine), niveau), [graine, niveau]);
  const blocs = [
    { titre: "Bloc 1 : une seule règle", texte: `Pour ${plan.parBlocSimple} chiffres : « ${REGLES.parite.question} »`, essais: essais.slice(0, plan.parBlocSimple) },
    { titre: "Bloc 2 : l'autre règle", texte: `Pour ${plan.parBlocSimple} chiffres : « ${REGLES.taille.question} »`, essais: essais.slice(plan.parBlocSimple, 2 * plan.parBlocSimple) },
    { titre: "Bloc 3 : les deux mélangées", texte: "La règle peut changer à chaque chiffre : lis bien la question (et sa couleur) avant de répondre.", essais: essais.slice(2 * plan.parBlocSimple) },
  ];
  const [bloc, setBloc] = useState(0);
  const [enCours, setEnCours] = useState(false);
  const reps = useRef<Reponse[]>([]);
  if (!enCours)
    return (
      <div className="scene">
        <h3>{blocs[bloc].titre}</h3>
        <p>{blocs[bloc].texte}</p>
        <button className="btn primary gros" autoFocus onClick={() => setEnCours(true)}>C'est parti</button>
      </div>
    );
  return (
    <SerieChangement key={bloc} essais={blocs[bloc].essais} limiteMs={plan.limiteMs} sons={sons} onFin={(rs) => {
      reps.current = [...reps.current, ...rs];
      if (bloc < 2) { setBloc(bloc + 1); setEnCours(false); return; }
      const tous = essais.map((e, k) => ({ ...e, juste: reps.current[k]?.valeur === bonneReponse(e.regle, e.chiffre), ms: reps.current[k]?.ms ?? null }));
      const n = noterChangement(tous);
      const pctErr = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)} %`);
      onFin({
        reussi: n.reussi, score: n.justesMelange, max: n.totalMelange, ...(n.msRepetition !== null ? { ms: n.msRepetition } : {}), ...(n.coutChangement !== null ? { cout: n.coutChangement } : {}),
        lignes: [
          `Une seule règle : ${fmtMs(n.msSimple)} par réponse.`,
          `Règles mélangées, même règle que juste avant : ${fmtMs(n.msRepetition)} ; juste après un changement : ${fmtMs(n.msChangement)}.`,
          n.coutChangement !== null ? `Chaque changement de règle t'a coûté ${n.coutChangement} ms (erreurs : ${pctErr(n.erreursChangement)} après un changement, ${pctErr(n.erreursRepetition)} sinon).` : "",
          n.tempsPerdu !== null ? `Sur ce seul bloc, tu as perdu environ ${fmtMs(n.tempsPerdu)} à changer de règle. Imagine sur une heure à passer d'un onglet à l'autre…` : "",
          `Bonnes réponses dans le bloc mélangé : ${n.justesMelange} / ${n.totalMelange}.`,
        ].filter(Boolean),
      });
    }} />
  );
}

export const COMPOSANTS: Record<ExoId, (p: PropsExo) => ReactElement> = {
  recherche: ExoRecherche,
  flanker: ExoFlanker,
  stroop: ExoStroop,
  soutenue: ExoSoutenue,
  changement: ExoChangement,
};

// ----- Partie : enchaîne les manches --------------------------------------------------------------------------
export function Partie({ exo, onQuitter, budgetMinutes, onEtapeFinie }: { exo: ExoId; onQuitter: () => void; budgetMinutes?: number; onEtapeFinie?: () => void }) {
  const { db, maj } = useApp();
  const info = exoInfo(exo);
  const [graine, setGraine] = useState(randomSeed);
  const [phase, setPhase] = useState<"intro" | "joue" | "resultat">("intro");
  const [fin, setFin] = useState<{ r: FinManche; avant: number; apres: number } | null>(null);
  const debut = useRef<number | null>(null);
  const niveau = db.niveaux[exo].level;
  const Composant = COMPOSANTS[exo];
  const jouer = () => {
    debut.current ??= Date.now();
    setGraine(randomSeed());
    setPhase("joue");
  };
  const tempsFini = budgetMinutes !== undefined && debut.current !== null && Date.now() - debut.current >= budgetMinutes * 60_000;
  return (
    <Carte>
      <div className="partie-tete">
        <span className="icone-exo">{info.icone}</span>
        <h2>{info.nom}</h2>
        <span className="pastille">Niveau {niveau}</span>
        <button className="btn petit" onClick={onQuitter}>{onEtapeFinie ? "Passer" : "Quitter"}</button>
      </div>
      {phase === "intro" && (
        <div className="scene">
          <p>{info.regle}</p>
          <p className="muted petit">Ça entraîne : {info.entraine.toLowerCase()} Le niveau monte après 2 manches réussies de suite et baisse après un échec.</p>
          {budgetMinutes !== undefined && <p className="muted petit">Environ {Math.round(budgetMinutes * 10) / 10} min pour cet exercice.</p>}
          <button className="btn primary gros" autoFocus onClick={jouer}>Commencer</button>
        </div>
      )}
      {phase === "joue" && (
        <Composant key={graine} niveau={niveau} graine={graine} sons={db.reglages.sons} onFin={(r) => {
          const avant = db.niveaux[exo].level;
          let apres = avant;
          maj((d) => {
            const n = avecResultat(d, { exo, niveau: avant, score: r.score, max: r.max, reussi: r.reussi, ...(r.ms !== undefined ? { ms: r.ms } : {}), ...(r.cout !== undefined ? { cout: r.cout } : {}), ...(r.detail ? { detail: r.detail } : {}) });
            apres = n.niveaux[exo].level;
            return n;
          });
          setFin({ r, avant, apres });
          setPhase("resultat");
        }} />
      )}
      {phase === "resultat" && fin && (
        <div className="scene">
          <div className={`verdict ${fin.r.reussi ? "ok" : "ko"}`}>{fin.r.reussi ? "Manche réussie" : "Manche ratée, pas grave"}</div>
          <ul className="lignes">{fin.r.lignes.map((l) => <li key={l}>{l}</li>)}</ul>
          <p className="muted petit">
            {fin.apres > fin.avant ? `Niveau suivant : ${fin.apres}.` : fin.apres < fin.avant ? `On redescend au niveau ${fin.apres} pour reprendre confiance.` : fin.r.reussi ? "Encore une réussite et le niveau monte." : "Tu restes au même niveau."}
          </p>
          <div className="choix">
            {onEtapeFinie && tempsFini ? (
              <button className="btn primary gros" autoFocus onClick={onEtapeFinie}>Exercice suivant</button>
            ) : (
              <button className="btn primary" autoFocus onClick={jouer}>Manche suivante</button>
            )}
            {onEtapeFinie && !tempsFini && <button className="btn" onClick={onEtapeFinie}>Passer à la suite</button>}
            {!onEtapeFinie && <button className="btn" onClick={onQuitter}>Terminer</button>}
          </div>
        </div>
      )}
    </Carte>
  );
}
