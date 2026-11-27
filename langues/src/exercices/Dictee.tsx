// Dictée : écouter puis écrire. Chinois : on tape le pinyin (ni3 hao3 ou nǐ hǎo) ou les caractères.
// Arabe : on tape en arabe (clavier à l'écran) ou en transcription. Sans voix installée, on lit au lieu d'écouter.
import { useMemo, useRef, useState } from "react";
import { CLAVIER, comparerArabe } from "../core/arabe";
import { mancheReussie, paramsDictee } from "../core/niveaux";
import { comparerPinyin } from "../core/pinyin";
import { makeRng, randomSeed } from "../core/rng";
import { itemsDictee, motsVus, type ItemDictee } from "../core/seance";
import { Avancement, AvisVoix, Carte, Ecrit, finirManche, Lecture, parler, useApp, useVoix } from "../ui";
import { Bilan } from "./commun";

type Verdict = "juste" | "tons" | "faux";

function verdictPour(it: ItemDictee, langue: "zh" | "ar", rep: string): Verdict {
  if (langue === "ar") return comparerArabe({ ecrit: it.ecrit, tr: it.lecture }, rep) ? "juste" : "faux";
  if (rep.replace(/\s/g, "") === it.texte.replace(/\s/g, "")) return "juste";
  return comparerPinyin(it.lecture, rep);
}

export default function ExoDictee({ n, fin }: { n: number; fin: () => void }) {
  const { db, langue, maj } = useApp();
  const voix = useVoix(langue);
  const avecSon = voix.length > 0;
  const niveau = db.niveaux[langue].dictee.level;
  const p = paramsDictee(niveau);
  const [items] = useState(() => itemsDictee(makeRng(randomSeed()), langue, niveau, n, motsVus(db, langue)));
  const [i, setI] = useState(0);
  const [rep, setRep] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [score, setScore] = useState(0);
  const [fini, setFini] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  const it = items[i];
  const jouer = useMemo(() => () => it && parler(it.texte, langue, p.vitesse), [it, langue, p.vitesse]);

  if (fini || !items.length) return <Bilan titre="Dictée" score={score} max={items.length} niveau={niveau} continuer={fin} />;

  const verifier = () => {
    if (!rep.trim()) return;
    const v = verdictPour(it, langue, rep);
    setVerdict(v);
    if (v === "juste") setScore((s) => s + 1);
  };
  const suivant = () => {
    setRep(""); setVerdict(null);
    if (i + 1 < items.length) { setI(i + 1); if (avecSon) setTimeout(() => parler(items[i + 1].texte, langue, p.vitesse), 150); return; }
    const s = score;
    maj((d) => finirManche(d, langue, "dictee", s, items.length, mancheReussie(s, items.length)));
    setFini(true);
  };
  const taper = (c: string) => { setRep((r) => r + c); champ.current?.focus(); };

  return (
    <Carte titre={avecSon ? "Écoute, puis écris" : "Lis, puis écris"}>
      <Avancement i={i} n={items.length} />
      <AvisVoix langue={langue} />
      {avecSon ? (
        <div className="choix"><button className="btn gros" onClick={jouer}>🔊 {i === 0 && !rep ? "Écouter" : "Réécouter"}</button></div>
      ) : langue === "zh" ? (
        <><Ecrit langue="zh" texte={it.texte} /><p className="muted petit" style={{ textAlign: "center" }}>Écris le pinyin (avec les tons : ni3 hao3 ou nǐ hǎo).</p></>
      ) : (
        <><p className="ecrit moyen">{it.lecture}</p><p className="muted petit" style={{ textAlign: "center" }}>Écris ce mot en arabe.</p></>
      )}
      {avecSon && <p className="muted petit" style={{ textAlign: "center" }}>{langue === "zh" ? "Tape le pinyin avec les tons (ni3 hao3 ou nǐ hǎo), ou les caractères." : "Tape en arabe (clavier ci-dessous) ou en transcription (ex. kitāb ou kitab)."}{p.phrases ? " C'est une phrase courte." : ""}</p>}
      <form onSubmit={(e) => { e.preventDefault(); if (verdict) suivant(); else verifier(); }}>
        <input ref={champ} className={`saisie ${langue === "ar" && /[؀-ۿ]/.test(rep) ? "ar" : ""}`} value={rep} onChange={(e) => setRep(e.target.value)} disabled={!!verdict} autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false} aria-label="Ta réponse" />
        {langue === "ar" && !verdict && (
          <div className="clavier">
            {CLAVIER.map((c) => <button type="button" key={c} onClick={() => taper(c)}>{c}</button>)}
            <button type="button" className="large" onClick={() => taper(" ")}>espace</button>
            <button type="button" className="large" onClick={() => setRep((r) => [...r].slice(0, -1).join(""))}>⌫ effacer</button>
          </div>
        )}
        {!verdict ? (
          <div className="choix"><button className="btn" type="button" onClick={() => { setVerdict("faux"); }}>Je ne sais pas</button><button className="btn primary" type="submit" disabled={!rep.trim()}>Vérifier</button></div>
        ) : (
          <>
            <p className={verdict === "juste" ? "ok-texte" : "ko-texte"} style={{ textAlign: "center" }}>
              <b>{verdict === "juste" ? "Juste !" : verdict === "tons" ? "Les sons sont justes, mais pas les tons." : "La réponse :"}</b>
            </p>
            <Ecrit langue={langue} texte={it.texte} taille="moyen" />
            <Lecture langue={langue} texte={it.lecture} />
            <p className="sens-fr">{it.fr}</p>
            <div className="choix"><button className="btn primary" type="submit" autoFocus>Suivant</button></div>
          </>
        )}
      </form>
    </Carte>
  );
}
