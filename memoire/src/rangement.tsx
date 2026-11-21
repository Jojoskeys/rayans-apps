// Ranger une liste (dans un palais, sur des mots-crochets, ou en histoire), pause calme, puis rappel sans aide.
// La liste peut être gardée : elle reviendra ensuite à J+1, J+3, J+7… (révisions espacées).
import { useMemo, useState } from "react";
import { bonneReponse, compterRetrouves, decouperSaisie } from "./core/contenu";
import { apresRappel, premiereRevision, prochaineRevision } from "./core/espacement";
import type { Liste } from "./core/model";
import { newId } from "./core/rng";
import { avecResultat, Carte, fmtSec, sonFaux, sonJuste, useApp, useCompteARebours } from "./ui";

export interface Garder {
  titre: string;
  sorte: Liste["sorte"];
  palaisId: string | null;
  /** Repères à garder avec la liste quand elle n'est pas dans un palais (mots-crochets, mots anglais). */
  reperes?: string[];
}

interface Props {
  titre: string;
  elements: string[];
  /** Repère de chaque élément (lieu du palais, mot-crochet…), ou null pour une histoire en chaîne. */
  reperes: string[] | null;
  conseil: string;
  /** Aide facultative pour un élément (exemple d'image, mot Major…). */
  aide?: (element: string, i: number) => string | undefined;
  garder: Garder | null;
  pause?: number;
  /** Consigne du rappel (par défaut : refaire la visite du palais). */
  consigneRappel?: string;
  onFin: (part: number) => void;
}

/** La pause calme : une minute les yeux fermés, sans écran (Dewar et al. 2012). */
export function PauseCalme({ secondes = 60, onFin }: { secondes?: number; onFin: () => void }) {
  const reste = useCompteARebours(secondes, true, onFin);
  return (
    <div className="scene">
      <div className="respire" aria-hidden />
      <p><b>Pause calme.</b> Ferme les yeux, respire lentement. Ne regarde rien, ne révise rien : ton cerveau range.</p>
      <p className="muted">{fmtSec(reste)}</p>
      <button className="btn petit" onClick={onFin}>Passer</button>
    </div>
  );
}

export function Rangement({ titre, elements, reperes, conseil, aide, garder, pause = 60, consigneRappel, onFin }: Props) {
  const { db, maj } = useApp();
  const [phase, setPhase] = useState<"encode" | "pause" | "rappel" | "resultat">("encode");
  const [i, setI] = useState(0);
  const [images, setImages] = useState<string[]>(() => elements.map(() => ""));
  const [part, setPart] = useState(0);
  const [corrige, setCorrige] = useState<boolean[]>([]);

  const finRappel = (justes: boolean[]) => {
    const p = justes.filter(Boolean).length / elements.length;
    setPart(p);
    setCorrige(justes);
    if (p >= 0.8) sonJuste(db.reglages.sons);
    else sonFaux(db.reglages.sons);
    const now = Date.now();
    maj((d) => {
      let out = avecResultat(d, { jeu: "palais", niveau: elements.length, score: justes.filter(Boolean).length, max: elements.length, reussi: p >= 0.8, detail: titre }, now);
      if (garder) {
        const l: Liste = {
          id: newId(), titre: garder.titre, sorte: garder.sorte, palaisId: garder.palaisId, elements, images,
          ...(garder.reperes ? { reperes: garder.reperes } : {}),
          createdAt: now, updatedAt: now, ...premiereRevision(now, d.reglages.heureJour), rappels: [{ at: now, part: p }],
        };
        out = { ...out, listes: [...out.listes, l] };
      }
      return out;
    });
    setPhase("resultat");
  };

  if (phase === "encode") {
    const e = elements[i];
    const a = aide?.(e, i);
    const suivant = () => (i + 1 < elements.length ? setI(i + 1) : setPhase(pause > 0 ? "pause" : "rappel"));
    return (
      <Carte titre={titre} className="rangement">
        <p className="muted petit">{conseil}</p>
        <div className="progression">{i + 1} / {elements.length}</div>
        <div className="placement">
          {reperes ? <div className="repere">{reperes[i]}</div> : i > 0 ? <div className="repere">{elements[i - 1]} →</div> : <div className="repere">Début de l'histoire</div>}
          <div className="element">{e}</div>
          {a && <div className="muted petit">{a}</div>}
        </div>
        <textarea
          key={i}
          rows={2}
          autoFocus
          value={images[i]}
          placeholder={reperes ? "Ton image : que se passe-t-il, à cet endroit précis ? (bruit, odeur, taille…)" : "Ton image : que fait l'élément d'avant à celui-ci ?"}
          onChange={(ev) => setImages(images.map((x, j) => (j === i ? ev.target.value : x)))}
          onKeyDown={(ev) => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); suivant(); } }}
        />
        <div className="choix">
          {i > 0 && <button className="btn" onClick={() => setI(i - 1)}>← Précédent</button>}
          <button className="btn primary" onClick={suivant}>{i + 1 < elements.length ? "Suivant (Entrée)" : "J'ai tout rangé"}</button>
        </div>
      </Carte>
    );
  }
  if (phase === "pause") return <Carte titre={titre}><PauseCalme secondes={pause} onFin={() => setPhase("rappel")} /></Carte>;
  if (phase === "rappel") return <Carte titre={`${titre} — rappel`}><Rappel elements={elements} reperes={reperes} consigne={consigneRappel} onFin={finRappel} /></Carte>;
  return (
    <Carte titre={`${titre} — résultat`}>
      <Correction elements={elements} reperes={reperes} images={images} justes={corrige} part={part} />
      {garder && <p className="muted petit">Liste gardée : premier rappel <b>demain</b>, puis à J+3, J+7, J+14… Le rappel du lendemain, après une nuit, est le plus important.</p>}
      <button className="btn primary" onClick={() => onFin(part)} autoFocus>Continuer</button>
    </Carte>
  );
}

/** Rappel sans aide : élément par repère, ou liste libre dans l'ordre pour une histoire. */
export function Rappel({ elements, reperes, consigne, onFin }: { elements: string[]; reperes: string[] | null; consigne?: string; onFin: (justes: boolean[]) => void }) {
  const [rep, setRep] = useState<string[]>(() => elements.map(() => ""));
  const [texte, setTexte] = useState("");
  if (!reperes) {
    const valider = () => {
      const { trouves } = compterRetrouves(elements, decouperSaisie(texte));
      const restant = [...trouves];
      onFin(elements.map((e) => { const k = restant.indexOf(e); if (k >= 0) { restant.splice(k, 1); return true; } return false; }));
    };
    return (
      <div className="scene large">
        <p>Refais l'histoire dans ta tête et écris les éléments, dans l'ordre si tu peux :</p>
        <textarea rows={6} autoFocus value={texte} onChange={(e) => setTexte(e.target.value)} />
        <button className="btn primary" onClick={valider}>Valider</button>
      </div>
    );
  }
  const valider = () => onFin(elements.map((e, i) => bonneReponse(e, rep[i])));
  return (
    <div className="scene large">
      <p>{consigne ?? "Refais la visite dans ta tête. Qu'avais-tu posé à chaque endroit ?"}</p>
      <div className="rappel-grille">
        {reperes.map((r, i) => (
          <label key={i}>
            <span>{i + 1}. {r}</span>
            <input
              value={rep[i]}
              autoFocus={i === 0}
              onChange={(e) => setRep(rep.map((x, j) => (j === i ? e.target.value : x)))}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const next = (e.currentTarget.closest("label")?.nextElementSibling as HTMLElement | null)?.querySelector("input");
                if (next) next.focus();
                else valider();
              }}
            />
          </label>
        ))}
      </div>
      <button className="btn primary" onClick={valider}>Valider</button>
    </div>
  );
}

export function Correction({ elements, reperes, images, justes, part }: { elements: string[]; reperes: string[] | null; images: string[]; justes: boolean[]; part: number }) {
  return (
    <>
      <div className={`verdict ${part >= 0.8 ? "ok" : part >= 0.5 ? "moyen" : "ko"}`}>{Math.round(part * elements.length)} / {elements.length} retrouvés</div>
      <ol className="correction">
        {elements.map((e, i) => (
          <li key={i} className={justes[i] ? "ok" : "ko"}>
            <span>{justes[i] ? "✓" : "✗"}</span>
            {reperes && <span className="muted">{reperes[i]} :</span>}
            <b>{e}</b>
            {images[i] && <em className="muted">« {images[i]} »</em>}
          </li>
        ))}
      </ol>
      {part < 1 && <p className="muted petit">Pour les oublis : l'image était-elle en action ? Assez exagérée ? Liée au lieu ? Renforce-la maintenant, en la revoyant 5 secondes.</p>}
    </>
  );
}

/** Révision espacée d'une liste gardée (rappel sans aide, puis correction avec tes images). */
export function RevisionListe({ liste, onFin }: { liste: Liste; onFin: () => void }) {
  const { db, maj } = useApp();
  const palais = db.palais.find((p) => p.id === liste.palaisId && !p.deleted);
  const reperes = useMemo(
    () => liste.reperes ?? (liste.palaisId === null ? null : liste.elements.map((_, i) => palais?.lieux[i]?.nom ?? `Lieu n° ${i + 1}`)),
    [liste, palais],
  );
  const [res, setRes] = useState<{ justes: boolean[]; part: number; apres: Liste } | null>(null);
  if (!res)
    return (
      <Carte titre={`Révision : ${liste.titre}`}>
        <p className="muted petit">{palais ? `Palais « ${palais.nom} ».` : liste.reperes ? "" : liste.palaisId ? "Le palais de cette liste a été supprimé : les lieux sont numérotés." : "Histoire en chaîne."} Ne regarde rien : retrouve de mémoire.</p>
        <Rappel
          elements={liste.elements}
          reperes={reperes}
          consigne={liste.reperes ? "Qu'avais-tu accroché à chaque repère ?" : undefined}
          onFin={(justes) => {
            const part = justes.filter(Boolean).length / liste.elements.length;
            const now = Date.now();
            const apres = apresRappel(liste, part, now, db.reglages.heureJour);
            if (part >= 0.8) sonJuste(db.reglages.sons);
            else sonFaux(db.reglages.sons);
            maj((d) => ({
              ...avecResultat(d, { jeu: "palais", niveau: liste.elements.length, score: justes.filter(Boolean).length, max: liste.elements.length, reussi: part >= 0.8, detail: `Révision : ${liste.titre}` }, now),
              listes: d.listes.map((l) => (l.id === liste.id ? apres : l)),
            }));
            setRes({ justes, part, apres });
          }}
        />
      </Carte>
    );
  return (
    <Carte titre={`Révision : ${liste.titre}`}>
      <Correction elements={liste.elements} reperes={reperes} images={liste.images} justes={res.justes} part={res.part} />
      <p className="muted petit">Prochaine révision : {prochaineRevision(res.apres, Date.now(), db.reglages.heureJour)}.</p>
      <button className="btn primary" onClick={onFin} autoFocus>Continuer</button>
    </Carte>
  );
}
