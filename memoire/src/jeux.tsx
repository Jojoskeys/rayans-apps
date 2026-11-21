// Les jeux de mémoire. Chaque jeu joue UNE manche au niveau donné et appelle `onFin` avec le résultat ;
// `Partie` enchaîne les manches et fait évoluer le niveau (2 réussites → plus dur, 1 échec → plus facile).
import { useEffect, useMemo, useRef, useState } from "react";
import { compterRetrouves, decouperSaisie, memeMot } from "./core/contenu";
import {
  blocs, chiffresJustes, fluxNBack, grandNombre, jeuKim, jeuPaires, listeMots, motsReussis, nbackReussi, noterNBack,
  pairesReussies, personnes, suiteCases, suiteChiffres, suiteCouleurs,
} from "./core/jeux";
import { gameInfo, type GameId } from "./core/niveaux";
import { makeRng, randomSeed, shuffle } from "./core/rng";
import { motMajor } from "./core/stats";
import { svgVisage, traitMarquant, traits } from "./core/visage";
import { avecResultat, bip, Carte, fmtSec, SaisieAuto, sonFaux, sonJuste, useApp, useCompteARebours } from "./ui";

export interface FinManche {
  reussi: boolean;
  score: number;
  max: number;
  detail?: string;
}

interface PropsJeu {
  niveau: number;
  graine: number;
  sons: boolean;
  onFin: (r: FinManche) => void;
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Lance une animation pas à pas, annulée si le composant disparaît. */
function useDeroule(etapes: (actif: () => boolean) => Promise<void>, deps: unknown[]) {
  useEffect(() => {
    let vivant = true;
    void etapes(() => vivant);
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// ----- Suite de chiffres (à l'endroit ou à l'envers) ---------------------------------------------------------
function JeuChiffres({ niveau, graine, sons, onFin, envers }: PropsJeu & { envers: boolean }) {
  const suite = useMemo(() => suiteChiffres(makeRng(graine), niveau), [graine, niveau]);
  const [affiche, setAffiche] = useState<number | null>(null);
  const [saisie, setSaisie] = useState<string | null>(null);
  useDeroule(async (actif) => {
    await attendre(600);
    for (const c of suite) {
      if (!actif()) return;
      setAffiche(c);
      bip(300 + c * 40, 150, sons, 0.05);
      await attendre(850);
      setAffiche(null);
      await attendre(200);
    }
    if (actif()) setSaisie("");
  }, [suite]);
  if (saisie === null)
    return <div className="scene"><div className="grand-chiffre">{affiche ?? ""}</div><p className="muted">{envers ? "Retiens-les : tu les rediras à l'envers." : "Retiens-les dans l'ordre."}</p></div>;
  const valider = () => {
    const attendu = (envers ? [...suite].reverse() : suite).join("");
    const r = saisie.replace(/\D/g, "");
    onFin({ reussi: r === attendu, score: r === attendu ? niveau : 0, max: niveau, detail: `Attendu ${attendu}, tapé ${r || "rien"}` });
  };
  return (
    <div className="scene">
      <p>{envers ? "Tape les chiffres en commençant par le dernier :" : "Tape les chiffres dans l'ordre :"}</p>
      <SaisieAuto valeur={saisie} onChange={setSaisie} onValider={valider} mode="numeric" large />
      <button className="btn primary" onClick={valider}>Valider</button>
    </div>
  );
}

// ----- Cases lumineuses (Corsi) ------------------------------------------------------------------------------
function JeuCorsi({ niveau, graine, sons, onFin }: PropsJeu) {
  const suite = useMemo(() => suiteCases(makeRng(graine), niveau, 16), [graine, niveau]);
  const [allumee, setAllumee] = useState<number | null>(null);
  const [aToi, setAToi] = useState(false);
  const [clics, setClics] = useState<number[]>([]);
  useDeroule(async (actif) => {
    await attendre(700);
    for (const c of suite) {
      if (!actif()) return;
      setAllumee(c);
      bip(400 + c * 25, 160, sons, 0.05);
      await attendre(650);
      setAllumee(null);
      await attendre(250);
    }
    if (actif()) setAToi(true);
  }, [suite]);
  const clic = (i: number) => {
    if (!aToi) return;
    const n = [...clics, i];
    setClics(n);
    setAllumee(i);
    setTimeout(() => setAllumee(null), 200);
    const k = n.length - 1;
    if (n[k] !== suite[k]) return onFin({ reussi: false, score: k, max: niveau, detail: `Erreur à la case ${k + 1}` });
    bip(500, 80, sons, 0.04);
    if (n.length === suite.length) onFin({ reussi: true, score: niveau, max: niveau });
  };
  return (
    <div className="scene">
      <p className="muted">{aToi ? `À toi : ${clics.length} / ${niveau}` : "Regarde bien l'ordre…"}</p>
      <div className="grille-corsi">
        {Array.from({ length: 16 }, (_, i) => (
          <button key={i} className={`case ${allumee === i ? "allumee" : ""}`} onClick={() => clic(i)} aria-label={`Case ${i + 1}`} disabled={!aToi} />
        ))}
      </div>
    </div>
  );
}

// ----- N-back -------------------------------------------------------------------------------------------------
function JeuNBack({ niveau, graine, sons, onFin }: PropsJeu) {
  const flux = useMemo(() => fluxNBack(makeRng(graine), niveau), [graine, niveau]);
  const [i, setI] = useState(-1);
  const appuis = useRef<boolean[]>([]);
  const [appuye, setAppuye] = useState(false);
  const fini = useRef(false);
  useDeroule(async (actif) => {
    await attendre(800);
    for (let k = 0; k < flux.lettres.length; k++) {
      if (!actif()) return;
      setI(k);
      setAppuye(false);
      await attendre(2300);
    }
    if (!actif() || fini.current) return;
    fini.current = true;
    const r = noterNBack(flux.cibles, appuis.current, niveau);
    onFin({ reussi: nbackReussi(r), score: r.justes, max: r.total, detail: `${r.touches} trouvées, ${r.manquees} manquées, ${r.fausses} fausses alertes` });
  }, [flux]);
  const appuyer = () => {
    if (i < niveau || appuis.current[i]) return;
    appuis.current[i] = true;
    setAppuye(true);
    if (flux.cibles[i]) bip(700, 90, sons, 0.04);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); appuyer(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  return (
    <div className="scene">
      <p className="muted">{niveau}-back : appuie quand la lettre est la même que celle d'il y a {niveau} {niveau > 1 ? "lettres" : "lettre"}.</p>
      <div key={i} className="grand-chiffre lettre">{i >= 0 ? flux.lettres[i] : "…"}</div>
      <p className="muted petit">{Math.max(0, i + 1)} / {flux.lettres.length}</p>
      <button className={`btn primary gros ${appuye ? "appuye" : ""}`} onClick={appuyer} disabled={i < niveau}>Pareil (Espace)</button>
    </div>
  );
}

// ----- Séquence de couleurs -----------------------------------------------------------------------------------
const NOTES = [330, 392, 494, 587];
function JeuSimon({ niveau, graine, sons, onFin }: PropsJeu) {
  const suite = useMemo(() => suiteCouleurs(makeRng(graine), niveau), [graine, niveau]);
  const [allumee, setAllumee] = useState<number | null>(null);
  const [aToi, setAToi] = useState(false);
  const [clics, setClics] = useState(0);
  useDeroule(async (actif) => {
    await attendre(700);
    for (const c of suite) {
      if (!actif()) return;
      setAllumee(c);
      bip(NOTES[c], 380, sons, 0.1);
      await attendre(520);
      setAllumee(null);
      await attendre(180);
    }
    if (actif()) setAToi(true);
  }, [suite]);
  const clic = (c: number) => {
    if (!aToi) return;
    bip(NOTES[c], 200, sons, 0.1);
    setAllumee(c);
    setTimeout(() => setAllumee(null), 180);
    if (suite[clics] !== c) return onFin({ reussi: false, score: clics, max: niveau, detail: `Erreur à la couleur ${clics + 1}` });
    if (clics + 1 === niveau) return onFin({ reussi: true, score: niveau, max: niveau });
    setClics(clics + 1);
  };
  return (
    <div className="scene">
      <p className="muted">{aToi ? `À toi : ${clics} / ${niveau}` : "Regarde et écoute…"}</p>
      <div className="simon">
        {[0, 1, 2, 3].map((c) => <button key={c} className={`pad pad${c} ${allumee === c ? "allumee" : ""}`} onClick={() => clic(c)} disabled={!aToi} aria-label={`Couleur ${c + 1}`} />)}
      </div>
    </div>
  );
}

// ----- Paires -------------------------------------------------------------------------------------------------
function JeuPaires({ niveau, graine, sons, onFin }: PropsJeu) {
  const cartes = useMemo(() => jeuPaires(makeRng(graine), niveau), [graine, niveau]);
  const [ouvertes, setOuvertes] = useState<number[]>([]);
  const [trouvees, setTrouvees] = useState<Set<number>>(new Set());
  const [coups, setCoups] = useState(0);
  const clic = (i: number) => {
    if (ouvertes.length === 2 || ouvertes.includes(i) || trouvees.has(i)) return;
    const o = [...ouvertes, i];
    setOuvertes(o);
    if (o.length < 2) return;
    const c = coups + 1;
    setCoups(c);
    if (cartes[o[0]] === cartes[o[1]]) {
      const t = new Set(trouvees).add(o[0]).add(o[1]);
      setTrouvees(t);
      setOuvertes([]);
      bip(760, 90, sons, 0.04);
      if (t.size === cartes.length) setTimeout(() => onFin({ reussi: pairesReussies(niveau, c), score: niveau, max: c, detail: `${c} coups pour ${niveau} paires (parfait : ${niveau})` }), 400);
    } else setTimeout(() => setOuvertes([]), 850);
  };
  const colonnes = cartes.length <= 12 ? 4 : cartes.length <= 20 ? 5 : 6;
  return (
    <div className="scene">
      <p className="muted">{coups} coups — objectif : {niveau * 2} au plus</p>
      <div className="grille-paires" style={{ gridTemplateColumns: `repeat(${colonnes}, 1fr)` }}>
        {cartes.map((o, i) => {
          const vue = ouvertes.includes(i) || trouvees.has(i);
          return <button key={i} className={`carte-jeu ${vue ? "vue" : ""} ${trouvees.has(i) ? "trouvee" : ""}`} onClick={() => clic(i)}>{vue ? o : ""}</button>;
        })}
      </div>
    </div>
  );
}

// ----- Objet disparu ------------------------------------------------------------------------------------------
function JeuKim({ niveau, graine, onFin }: PropsJeu) {
  const k = useMemo(() => jeuKim(makeRng(graine), niveau), [graine, niveau]);
  const [phase, setPhase] = useState<"regarde" | "cache" | "question">("regarde");
  const duree = Math.max(5, Math.round(niveau * 1.2));
  const reste = useCompteARebours(duree, phase === "regarde", () => setPhase("cache"));
  useEffect(() => {
    if (phase !== "cache") return;
    const t = setTimeout(() => setPhase("question"), 1200);
    return () => clearTimeout(t);
  }, [phase]);
  const restants = useMemo(() => shuffle(makeRng(graine + 1), k.objets.filter((o) => o !== k.disparu)), [k, graine]);
  if (phase === "regarde")
    return (
      <div className="scene">
        <p className="muted">Observe bien ({reste} s)… <button className="btn petit" onClick={() => setPhase("cache")}>C'est bon</button></p>
        <div className="grille-objets">{k.objets.map((o) => <span key={o}>{o}</span>)}</div>
      </div>
    );
  if (phase === "cache") return <div className="scene"><div className="grand-chiffre">🙈</div></div>;
  return (
    <div className="scene">
      <div className="grille-objets">{restants.map((o) => <span key={o}>{o}</span>)}</div>
      <p>Lequel a disparu ?</p>
      <div className="choix">
        {k.choix.map((c) => <button key={c} className="btn gros-emoji" onClick={() => onFin({ reussi: c === k.disparu, score: c === k.disparu ? 1 : 0, max: 1, detail: `C'était ${k.disparu}` })}>{c}</button>)}
      </div>
    </div>
  );
}

// ----- Liste de mots ------------------------------------------------------------------------------------------
export function JeuMots({ niveau, graine, onFin, sorte = "concrets", palaisId: palaisInitial = null, secondesParMot = 3 }: PropsJeu & { sorte?: "concrets" | "abstraits" | "melange"; palaisId?: string | null; secondesParMot?: number }) {
  const { db } = useApp();
  const mots = useMemo(() => listeMots(makeRng(graine), niveau, sorte), [graine, niveau, sorte]);
  const palaisPossibles = db.palais.filter((p) => !p.deleted && p.lieux.length >= niveau);
  const [palaisId, setPalaisId] = useState<string | null>(palaisInitial && palaisPossibles.some((p) => p.id === palaisInitial) ? palaisInitial : null);
  const palais = palaisPossibles.find((p) => p.id === palaisId) ?? null;
  const [phase, setPhase] = useState<"lis" | "ecris">("lis");
  const [texte, setTexte] = useState("");
  const reste = useCompteARebours(niveau * secondesParMot, phase === "lis", () => setPhase("ecris"));
  if (phase === "lis")
    return (
      <div className="scene large">
        <div className="ligne-outils">
          <span className="muted">{fmtSec(reste)}</span>
          {palaisPossibles.length > 0 && (
            <select value={palaisId ?? ""} onChange={(e) => setPalaisId(e.target.value || null)}>
              <option value="">Sans palais</option>
              {palaisPossibles.map((p) => <option key={p.id} value={p.id}>Avec « {p.nom} »</option>)}
            </select>
          )}
          <button className="btn" onClick={() => setPhase("ecris")}>J'ai fini</button>
        </div>
        <ol className="liste-mots">
          {mots.map((m, i) => <li key={m}>{palais && <span className="lieu">{palais.lieux[i].nom}</span>}<b>{m}</b></li>)}
        </ol>
        {palais && <p className="muted petit">Pose chaque mot sur son lieu avec une image en action, exagérée, avec un bruit ou une odeur.</p>}
      </div>
    );
  const valider = () => {
    const r = compterRetrouves(mots, decouperSaisie(texte));
    onFin({ reussi: motsReussis(r.trouves.length, niveau), score: r.trouves.length, max: niveau, detail: r.manques.length ? `Oubliés : ${r.manques.join(", ")}` : "Tous retrouvés !" });
  };
  return (
    <div className="scene large">
      <p>Écris tous les mots dont tu te souviens (dans n'importe quel ordre){palais ? `, en refaisant la visite de « ${palais.nom} »` : ""} :</p>
      <textarea rows={6} value={texte} onChange={(e) => setTexte(e.target.value)} autoFocus placeholder="pomme, vélo, guitare…" />
      <button className="btn primary" onClick={valider}>Valider</button>
    </div>
  );
}

// ----- Noms et visages ----------------------------------------------------------------------------------------
export const imageVisage = (graine: number, genre?: "h" | "f") => `data:image/svg+xml;utf8,${encodeURIComponent(svgVisage(traits(graine, genre)))}`;

export function JeuVisages({ niveau, graine, onFin, aide = false }: PropsJeu & { aide?: boolean }) {
  const gens = useMemo(() => personnes(makeRng(graine), niveau), [graine, niveau]);
  const ordreTest = useMemo(() => shuffle(makeRng(graine + 7), gens), [gens, graine]);
  const [phase, setPhase] = useState<"retiens" | "retrouve">("retiens");
  const [reponses, setReponses] = useState<string[]>(() => gens.map(() => ""));
  const reste = useCompteARebours(niveau * 7, phase === "retiens", () => setPhase("retrouve"));
  if (phase === "retiens")
    return (
      <div className="scene large">
        <div className="ligne-outils"><span className="muted">{fmtSec(reste)}</span><button className="btn" onClick={() => setPhase("retrouve")}>J'ai fini</button></div>
        <div className="grille-visages">
          {gens.map((p) => (
            <figure key={p.prenom}>
              <img src={imageVisage(p.graine, p.genre)} alt="" />
              <figcaption><b>{p.prenom}</b>{aide && <span className="muted petit">Crochet : {traitMarquant(traits(p.graine, p.genre))}</span>}</figcaption>
            </figure>
          ))}
        </div>
        {aide && <p className="muted petit">Pour chaque visage : repère le crochet, transforme le prénom en image (Inès → un nez), et colle l'image sur le crochet.</p>}
      </div>
    );
  const valider = () => {
    const justes = ordreTest.filter((p, i) => memeMot(p.prenom, reponses[i])).length;
    const oublis = ordreTest.filter((p, i) => !memeMot(p.prenom, reponses[i])).map((p) => p.prenom);
    onFin({ reussi: motsReussis(justes, niveau), score: justes, max: niveau, detail: oublis.length ? `À revoir : ${oublis.join(", ")}` : "Tous retrouvés !" });
  };
  return (
    <div className="scene large">
      <p>Comment s'appellent-ils ?</p>
      <div className="grille-visages">
        {ordreTest.map((p, i) => (
          <figure key={p.prenom}>
            <img src={imageVisage(p.graine, p.genre)} alt="" />
            <input value={reponses[i]} autoFocus={i === 0} onChange={(e) => setReponses(reponses.map((r, j) => (j === i ? e.target.value : r)))} onKeyDown={(e) => { if (e.key === "Enter" && i === ordreTest.length - 1) valider(); }} placeholder="Prénom" />
          </figure>
        ))}
      </div>
      <button className="btn primary" onClick={valider}>Valider</button>
    </div>
  );
}

// ----- Grand nombre -------------------------------------------------------------------------------------------
export function JeuNombres({ niveau, graine, onFin }: PropsJeu) {
  const { db } = useApp();
  const nombre = useMemo(() => grandNombre(makeRng(graine), niveau), [graine, niveau]);
  const [phase, setPhase] = useState<"lis" | "ecris">("lis");
  const [aide, setAide] = useState(false);
  const [texte, setTexte] = useState("");
  const b = blocs(nombre);
  const reste = useCompteARebours(b.length * 5, phase === "lis", () => setPhase("ecris"));
  if (phase === "lis")
    return (
      <div className="scene large">
        <div className="ligne-outils">
          <span className="muted">{fmtSec(reste)}</span>
          <label className="petit"><input type="checkbox" checked={aide} onChange={(e) => setAide(e.target.checked)} /> Montrer mes mots Major</label>
          <button className="btn" onClick={() => setPhase("ecris")}>J'ai fini</button>
        </div>
        <div className="blocs">
          {b.map((x, i) => <div key={i} className="bloc"><b>{x}</b>{aide && x.length === 2 && <span>{motMajor(db, Number(x))}</span>}</div>)}
        </div>
      </div>
    );
  const valider = () => {
    const j = chiffresJustes(nombre, texte);
    onFin({ reussi: j === nombre.length, score: j, max: nombre.length, detail: `${j} chiffres justes avant la première erreur. C'était ${b.join(" ")}` });
  };
  return (
    <div className="scene large">
      <p>Retape le nombre ({niveau} chiffres) :</p>
      <SaisieAuto valeur={texte} onChange={setTexte} onValider={valider} mode="numeric" large />
      <button className="btn primary" onClick={valider}>Valider</button>
    </div>
  );
}

export function UnJeu({ jeu, ...p }: PropsJeu & { jeu: GameId }) {
  switch (jeu) {
    case "chiffres": return <JeuChiffres {...p} envers={false} />;
    case "chiffres-envers": return <JeuChiffres {...p} envers />;
    case "corsi": return <JeuCorsi {...p} />;
    case "nback": return <JeuNBack {...p} />;
    case "simon": return <JeuSimon {...p} />;
    case "paires": return <JeuPaires {...p} />;
    case "kim": return <JeuKim {...p} />;
    case "mots": return <JeuMots {...p} />;
    case "visages": return <JeuVisages {...p} />;
    case "nombres": return <JeuNombres {...p} />;
  }
}

// ----- Une partie : intro, manches successives, niveau qui s'adapte ------------------------------------------
export function Partie({ jeu, minutes, onTermine, onQuitter }: { jeu: GameId; minutes?: number; onTermine?: () => void; onQuitter?: () => void }) {
  const { db, maj } = useApp();
  const g = gameInfo(jeu);
  const [phase, setPhase] = useState<"intro" | "jeu" | "resultat">("intro");
  const [graine, setGraine] = useState(randomSeed);
  const [dernier, setDernier] = useState<(FinManche & { niveau: number }) | null>(null);
  const debut = useRef<number | null>(null);
  const [manches, setManches] = useState(0);
  const niveau = db.niveaux[jeu].level;
  const tempsFini = minutes !== undefined && debut.current !== null && Date.now() - debut.current >= minutes * 60_000;
  const commencer = () => {
    debut.current ??= Date.now();
    setGraine(randomSeed());
    setPhase("jeu");
  };
  const fin = (r: FinManche) => {
    if (r.reussi) sonJuste(db.reglages.sons);
    else sonFaux(db.reglages.sons);
    setDernier({ ...r, niveau });
    setManches((m) => m + 1);
    maj((d) => avecResultat(d, { jeu, niveau, score: r.score, max: r.max, reussi: r.reussi, ...(r.detail ? { detail: r.detail } : {}) }));
    setPhase("resultat");
  };
  return (
    <Carte className="partie">
      <div className="partie-tete">
        <h2>{g.icone} {g.nom}</h2>
        <span className="pastille">Niveau : {niveau} {g.unite}</span>
        {onQuitter && <button className="btn petit" onClick={onQuitter}>Quitter</button>}
      </div>
      {phase === "intro" && (
        <div className="scene">
          <p>{g.regle}</p>
          <p className="muted petit">Entraîne : {g.entraine}{g.repere ? ` Repère : ${g.repere}.` : ""}</p>
          <button className="btn primary gros" onClick={commencer}>Commencer</button>
          {minutes !== undefined && <p className="muted petit">Échauffement de {minutes} min : enchaîne les manches.</p>}
        </div>
      )}
      {phase === "jeu" && <UnJeu key={graine} jeu={jeu} niveau={niveau} graine={graine} sons={db.reglages.sons} onFin={fin} />}
      {phase === "resultat" && dernier && (
        <div className="scene">
          <div className={`verdict ${dernier.reussi ? "ok" : "ko"}`}>{dernier.reussi ? "Réussi !" : "Raté, pas grave."}</div>
          <p>{dernier.score} / {dernier.max}{dernier.detail ? ` — ${dernier.detail}` : ""}</p>
          <p className="muted petit">
            {niveau > dernier.niveau ? `Ça monte : niveau ${niveau}.` : niveau < dernier.niveau ? `On redescend un peu : niveau ${niveau}.` : dernier.reussi ? "Encore une réussite à ce niveau et ça monte." : "Même niveau."}
          </p>
          <div className="choix">
            {!tempsFini && <button className="btn primary" onClick={commencer} autoFocus>Manche suivante</button>}
            {minutes !== undefined && onTermine && (
              <button className={`btn ${tempsFini ? "primary" : ""}`} onClick={onTermine} autoFocus={tempsFini}>{tempsFini ? "Échauffement fini → suite" : "Passer à la suite"}</button>
            )}
            {minutes === undefined && onQuitter && <button className="btn" onClick={onQuitter}>Terminer ({manches} {manches > 1 ? "manches" : "manche"})</button>}
          </div>
          <p className="muted petit">Ce jeu entraîne surtout ce jeu ; la technique, elle, sert partout.</p>
        </div>
      )}
    </Carte>
  );
}
