// Les techniques : chacune s'applique à du contenu nouveau, avec rappel sans aide (dans la séance ou l'atelier).
import { useMemo, useRef, useState } from "react";
import { bonneReponse, CROCHETS, EXEMPLES_ABSTRAITS, MAJOR_SONS, majorCle, VOCABULAIRE } from "./core/contenu";
import { blocs, grandNombre, listeMots } from "./core/jeux";
import type { Palais } from "./core/model";
import { tailleTechnique, TECHNIQUES, type TechniqueId } from "./core/programme";
import { makeRng, randomSeed, sample, shuffle } from "./core/rng";
import { motMajor } from "./core/stats";
import { JeuNombres, JeuVisages, type FinManche } from "./jeux";
import { Rangement } from "./rangement";
import { avecResultat, Carte, sonFaux, sonJuste, useApp } from "./ui";
import { ConstruirePalais } from "./views/Palais";

const jourCourt = () => new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

/** Le palais le moins utilisé récemment, avec assez de lieux si possible. */
function choisirPalais(palais: Palais[], derniers: Map<string, number>, taille: number): Palais | null {
  const vivants = palais.filter((p) => !p.deleted && p.lieux.length >= 5);
  if (!vivants.length) return null;
  const assez = vivants.filter((p) => p.lieux.length >= taille);
  const pool = assez.length ? assez : vivants;
  return pool.slice().sort((a, b) => (derniers.get(a.id) ?? 0) - (derniers.get(b.id) ?? 0) || b.lieux.length - a.lieux.length)[0];
}

const CONSEIL_PALAIS = "Pour chaque lieu : l'objet agit sur le lieu (il l'écrase, le mouille, le fait exploser), en très grand, avec un bruit, une odeur ou une sensation. Écris ton image en quelques mots.";

function aideAbstrait(m: string): string {
  const ex = EXEMPLES_ABSTRAITS.find(([x]) => x === m);
  return ex ? `Exemple : ${ex[1]} (mais invente la tienne !)` : "Trouve un objet qui le représente, ou un mot concret qui sonne pareil.";
}

export function Technique({ id, onFin }: { id: TechniqueId; onFin: () => void }) {
  const { db } = useApp();
  const t = TECHNIQUES[id];
  const [graine] = useState(randomSeed);
  const taille = tailleTechnique(id, db, Date.now());
  const derniers = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of db.listes) if (l.palaisId) m.set(l.palaisId, Math.max(m.get(l.palaisId) ?? 0, l.createdAt));
    return m;
  }, [db.listes]);
  const besoinPalais = id === "palais-concrets" || id === "palais-abstraits" || id === "major-nombre" || id === "championnat";
  // Le palais est choisi une fois pour toute la technique (les listes enregistrées ensuite ne doivent pas le changer).
  const choisi = useRef<string | null>(null);
  if (besoinPalais && choisi.current === null) choisi.current = choisirPalais(db.palais, derniers, id === "major-nombre" ? Math.ceil(taille / 2) : taille)?.id ?? null;
  const palais = db.palais.find((p) => p.id === choisi.current) ?? null;
  const [palaisFait, setPalaisFait] = useState(false);

  if (besoinPalais && !palais && !palaisFait)
    return (
      <div className="pile">
        <Carte titre={t.titre}><p>Cette technique a besoin d'un palais de mémoire. Construisons-le maintenant : 5 minutes, une seule fois.</p></Carte>
        <ConstruirePalais onFin={() => setPalaisFait(true)} />
      </div>
    );

  switch (id) {
    case "palais-concrets":
    case "palais-abstraits": {
      const p = palais!;
      const n = Math.min(taille, p.lieux.length);
      const mots = listeMots(makeRng(graine), n, id === "palais-abstraits" ? "abstraits" : "concrets");
      return (
        <div className="pile">
          {n < taille && <p className="muted petit">Ton palais « {p.nom} » a {p.lieux.length} lieux : agrandis-le (onglet Palais) pour des listes de {taille}.</p>}
          <Rangement
            titre={`${t.titre} — ${p.nom}`}
            elements={mots}
            reperes={p.lieux.slice(0, n).map((l) => l.nom)}
            conseil={id === "palais-abstraits" ? "Mot abstrait → objet concret qui le représente (ou mot qui sonne pareil), puis pose-le sur le lieu en action." : CONSEIL_PALAIS}
            aide={id === "palais-abstraits" ? aideAbstrait : undefined}
            garder={{ titre: `Mots du ${jourCourt()}`, sorte: "exercice", palaisId: p.id }}
            onFin={onFin}
          />
        </div>
      );
    }
    case "histoire": {
      const mots = listeMots(makeRng(graine), taille, "concrets");
      return (
        <Rangement
          titre={t.titre}
          elements={mots}
          reperes={null}
          conseil="Chaque mot fait quelque chose de fou au suivant : « la pomme roule sur le vélo, qui écrase la guitare, qui… ». Plus c'est visuel et en action, mieux c'est."
          garder={{ titre: `Histoire du ${jourCourt()}`, sorte: "exercice", palaisId: null }}
          onFin={onFin}
        />
      );
    }
    case "crochets": {
      const mots = listeMots(makeRng(graine), 10, "concrets");
      const reperes = CROCHETS.map(([n, c]) => `${n} — ${c}`);
      return (
        <Rangement
          titre={t.titre}
          elements={mots}
          reperes={reperes}
          conseil="Chaque nombre rime avec un objet (1 = un hun, 2 = du feu, 3 = une croix…). Accroche chaque mot à l'objet du nombre : le feu brûle la guitare, la croix transperce le ballon."
          garder={{ titre: `Crochets du ${jourCourt()}`, sorte: "exercice", palaisId: null, reperes }}
          consigneRappel="Qu'avais-tu accroché à chaque nombre ?"
          onFin={onFin}
        />
      );
    }
    case "visages":
      return <TechVisages taille={taille} onFin={onFin} />;
    case "major-apprendre":
      return <MajorApprendre onFin={onFin} />;
    case "major-nombre": {
      const p = palais!;
      const nb = Math.min(taille, p.lieux.length * 2);
      const b = blocs(grandNombre(makeRng(graine), nb));
      return (
        <Rangement
          titre={`${t.titre} — ${p.nom}`}
          elements={b}
          reperes={p.lieux.slice(0, b.length).map((l) => l.nom)}
          conseil="Chaque bloc de 2 chiffres devient ton mot Major (34 = mur, 91 = patte), puis tu poses ce mot sur le lieu en action. Au rappel, tape les 2 chiffres."
          aide={(x) => (x.length === 2 ? `Ton mot Major : ${motMajor(db, Number(x))}` : undefined)}
          garder={null}
          onFin={onFin}
        />
      );
    }
    case "mot-cle":
      return <MotCle taille={taille} graine={graine} onFin={onFin} />;
    case "championnat":
      return <Championnat palais={palais!} graine={graine} onFin={onFin} />;
  }
}

function TechVisages({ taille, onFin }: { taille: number; onFin: () => void }) {
  const { db, maj } = useApp();
  const [graine] = useState(randomSeed);
  const [res, setRes] = useState<FinManche | null>(null);
  if (!res)
    return (
      <Carte titre="Noms et visages">
        <p className="muted petit">1) Repère le crochet du visage (proposé sous le prénom). 2) Transforme le prénom en image : Inès → un nez, Karim → un car, Léa → un lit. 3) Colle l'image sur le crochet : un car garé sur ses lunettes.</p>
        <JeuVisages niveau={taille} graine={graine} sons={db.reglages.sons} aide onFin={(r) => {
          if (r.reussi) sonJuste(db.reglages.sons);
          else sonFaux(db.reglages.sons);
          maj((d) => avecResultat(d, { jeu: "visages", niveau: taille, score: r.score, max: r.max, reussi: r.reussi, ...(r.detail ? { detail: r.detail } : {}) }));
          setRes(r);
        }} />
      </Carte>
    );
  return (
    <Carte titre="Noms et visages — résultat">
      <div className={`verdict ${res.reussi ? "ok" : "moyen"}`}>{res.score} / {res.max}</div>
      {res.detail && <p>{res.detail}</p>}
      <p className="muted petit">Dans la vraie vie : redis le prénom tout de suite (« Enchanté, Inès »), utilise-le une fois, et redis-le en partant.</p>
      <button className="btn primary" onClick={onFin} autoFocus>Continuer</button>
    </Carte>
  );
}

/** Système Major : la table des sons, puis 10 nouveaux nombres à apprendre, puis un quiz (avec quelques anciens). */
export function MajorApprendre({ onFin }: { onFin: () => void }) {
  const { db, maj } = useApp();
  const [debut] = useState(() => Math.min(90, db.major.connus));
  const lot = useMemo(() => Array.from({ length: 10 }, (_, i) => debut + i), [debut]);
  const anciens = useMemo(() => sample(makeRng(randomSeed()), Array.from({ length: debut }, (_, i) => i), 5), [debut]);
  const quiz = useMemo(() => shuffle(makeRng(randomSeed()), [...lot, ...anciens]), [lot, anciens]);
  const [phase, setPhase] = useState<"table" | "apprendre" | "quiz" | "fin">(db.major.connus === 0 ? "table" : "apprendre");
  const [rep, setRep] = useState<string[]>(() => quiz.map(() => ""));
  const [justes, setJustes] = useState<boolean[]>([]);
  const changerMot = (n: number, mot: string) =>
    maj((d) => ({ ...d, major: { ...d.major, mots: { ...d.major.mots, [majorCle(n)]: mot }, updatedAt: Date.now() } }));
  if (phase === "table")
    return (
      <Carte titre="Le système Major : chiffres → sons">
        <p>Chaque chiffre devient un son de consonne. Les voyelles ne comptent pas : on les ajoute pour former un mot. On ne compte que ce qu'on <b>entend</b>.</p>
        <table className="table-major"><tbody>{MAJOR_SONS.map((s) => <tr key={s.chiffre}><td><b>{s.chiffre}</b></td><td>{s.sons}</td><td className="muted">{s.astuce}</td></tr>)}</tbody></table>
        <p>Exemples : 34 = m + r → <b>mur</b> ; 91 = p + t → <b>patte</b> ; 12 = t + n → <b>tonneau</b>.</p>
        <button className="btn primary" onClick={() => setPhase("apprendre")}>Apprendre mes 10 premiers nombres</button>
      </Carte>
    );
  if (phase === "apprendre")
    return (
      <Carte titre={`Major : nombres ${majorCle(lot[0])} à ${majorCle(lot[9])}`}>
        <p className="muted petit">Pour chaque nombre, imagine le mot très nettement (couleur, taille, bruit). Tu peux changer un mot qui ne te parle pas : garde les mêmes sons.</p>
        <div className="major-lot">
          {lot.map((n) => (
            <label key={n}>
              <b>{majorCle(n)}</b>
              <input defaultValue={motMajor(db, n)} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== motMajor(db, n)) changerMot(n, v); }} />
            </label>
          ))}
        </div>
        <button className="btn primary" onClick={() => setPhase("quiz")}>Je les ai en tête → quiz</button>
      </Carte>
    );
  if (phase === "quiz") {
    const valider = () => {
      const j = quiz.map((n, i) => bonneReponse(motMajor(db, n), rep[i]));
      const part = j.filter(Boolean).length / j.length;
      const lotOk = lot.every((n) => j[quiz.indexOf(n)]) || part >= 0.8;
      if (lotOk) sonJuste(db.reglages.sons);
      else sonFaux(db.reglages.sons);
      maj((d) => ({
        ...avecResultat(d, { jeu: "major", niveau: debut + 10, score: j.filter(Boolean).length, max: j.length, reussi: lotOk }),
        major: lotOk ? { ...d.major, connus: Math.min(100, Math.max(d.major.connus, debut + 10)), updatedAt: Date.now() } : d.major,
      }));
      setJustes(j);
      setPhase("fin");
    };
    return (
      <Carte titre="Quiz Major : quel est le mot ?">
        <div className="rappel-grille">
          {quiz.map((n, i) => (
            <label key={n}><span><b>{majorCle(n)}</b></span><input autoFocus={i === 0} value={rep[i]} onChange={(e) => setRep(rep.map((x, k) => (k === i ? e.target.value : x)))} /></label>
          ))}
        </div>
        <button className="btn primary" onClick={valider}>Valider</button>
      </Carte>
    );
  }
  const ok = justes.filter(Boolean).length;
  return (
    <Carte titre="Quiz Major — résultat">
      <div className={`verdict ${ok / justes.length >= 0.8 ? "ok" : "moyen"}`}>{ok} / {justes.length}</div>
      <ul className="correction">{quiz.map((n, i) => <li key={n} className={justes[i] ? "ok" : "ko"}><span>{justes[i] ? "✓" : "✗"}</span><b>{majorCle(n)}</b> = {motMajor(db, n)}</li>)}</ul>
      <p className="muted petit">{db.major.connus >= debut + 10 ? `Bravo : ${db.major.connus} nombres appris sur 100.` : "On refait ce lot la prochaine fois : il faut 80 % pour passer au suivant."}</p>
      <button className="btn primary" onClick={onFin} autoFocus>Continuer</button>
    </Carte>
  );
}

function MotCle({ taille, graine, onFin }: { taille: number; graine: number; onFin: () => void }) {
  const { db } = useApp();
  const [mots] = useState(() => {
    const dejaVus = new Set(db.listes.filter((l) => !l.deleted && l.reperes).flatMap((l) => l.reperes!));
    const restants = VOCABULAIRE.filter((v) => !dejaVus.has(v.mot));
    return sample(makeRng(graine), restants.length >= taille ? restants : VOCABULAIRE, taille);
  });
  return (
    <Rangement
      titre="Vocabulaire : mot-clé"
      elements={mots.map((v) => v.sens)}
      reperes={mots.map((v) => v.mot)}
      conseil="1) Trouve un mot français qui sonne comme le mot anglais (knife → « nef »). 2) Fais une image qui relie ce mot-clé au sens (un couteau géant planté dans la nef d'une église). Au rappel, on te donne le mot anglais : écris le sens."
      aide={(_, i) => (mots[i].exemple ? `Exemple : ${mots[i].exemple}` : undefined)}
      garder={{ titre: `Vocabulaire du ${jourCourt()}`, sorte: "exercice", palaisId: null, reperes: mots.map((v) => v.mot) }}
      consigneRappel="Que veut dire chaque mot ?"
      onFin={onFin}
    />
  );
}

/** Mini-championnat : mots dans le palais, grand nombre, noms et visages. */
function Championnat({ palais, graine, onFin }: { palais: Palais; graine: number; onFin: () => void }) {
  const { db, maj } = useApp();
  const [etape, setEtape] = useState(0);
  const [scores, setScores] = useState<string[]>([]);
  const n = Math.min(20, palais.lieux.length);
  const mots = useMemo(() => listeMots(makeRng(graine), n, "melange"), [graine, n]);
  const noter = (s: string) => { setScores([...scores, s]); setEtape(etape + 1); };
  if (etape === 0)
    return (
      <Rangement
        titre={`Épreuve 1 / 3 : ${n} mots dans « ${palais.nom} »`}
        elements={mots}
        reperes={palais.lieux.slice(0, n).map((l) => l.nom)}
        conseil="Concrets et abstraits mélangés. Va vite : une image simple mais en action suffit."
        garder={{ titre: `Championnat du ${jourCourt()}`, sorte: "exercice", palaisId: palais.id }}
        pause={30}
        onFin={(p) => noter(`Mots : ${Math.round(p * n)} / ${n}`)}
      />
    );
  const finJeu = (jeu: "nombres" | "visages", niveau: number) => (r: FinManche) => {
    maj((d) => avecResultat(d, { jeu, niveau, score: r.score, max: r.max, reussi: r.reussi, detail: "Mini-championnat" }));
    noter(`${jeu === "nombres" ? "Nombre" : "Visages"} : ${r.score} / ${r.max}`);
  };
  if (etape === 1) {
    const niv = Math.max(20, db.niveaux.nombres.level);
    return <Carte titre={`Épreuve 2 / 3 : nombre de ${niv} chiffres`}><JeuNombres niveau={niv} graine={graine + 1} sons={db.reglages.sons} onFin={finJeu("nombres", niv)} /></Carte>;
  }
  if (etape === 2) return <Carte titre="Épreuve 3 / 3 : 8 noms et visages"><JeuVisages niveau={8} graine={graine + 2} sons={db.reglages.sons} onFin={finJeu("visages", 8)} /></Carte>;
  return (
    <Carte titre="Mini-championnat — bilan">
      <ul>{scores.map((s) => <li key={s}>{s}</li>)}</ul>
      <p className="muted petit">Compare avec ton test du premier jour dans l'onglet Progrès.</p>
      <button className="btn primary" onClick={onFin} autoFocus>Continuer</button>
    </Carte>
  );
}
