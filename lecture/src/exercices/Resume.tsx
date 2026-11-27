// Résumé de mémoire : 2 à 5 phrases sans revoir le texte, puis comparaison avec les idées clés (pré-cochées, à confirmer).
import { useState } from "react";
import { compterPhrases, detecterIdees } from "../core/lecture";
import { newId } from "../core/rng";
import type { Texte } from "../core/textes";
import { Carte, useApp } from "../ui";

export default function Resume({ texte, fin }: { texte: Texte; fin: () => void }) {
  const { maj } = useApp();
  const [ecrit, setEcrit] = useState("");
  const [coches, setCoches] = useState<boolean[] | null>(null);
  const [fait, setFait] = useState(false);
  const phrases = compterPhrases(ecrit);

  if (fait) {
    const n = coches!.filter(Boolean).length;
    return (
      <Carte titre="Résumé — fini">
        <p className="verdict">{n} / {texte.idees.length} idées clés</p>
        <p className="muted petit" style={{ textAlign: "center" }}>Se rappeler un texte avec ses mots, sans le relire, aide à le retenir bien mieux que de le relire.</p>
        <div className="choix"><button className="btn primary" onClick={fin} autoFocus>Continuer</button></div>
      </Carte>
    );
  }
  return (
    <Carte titre={`Résumé de mémoire : « ${texte.titre} »`}>
      {!coches ? (
        <>
          <p className="muted petit">Sans revoir le texte, écris en 2 à 5 phrases ce que tu en retiens : l'idée principale et les points importants.</p>
          <textarea value={ecrit} onChange={(e) => setEcrit(e.target.value)} rows={6} autoFocus aria-label="Ton résumé" />
          <div className="choix">
            <span className="muted petit">{phrases} phrase{phrases > 1 ? "s" : ""}</span>
            <button className="btn primary" disabled={phrases < 1} onClick={() => setCoches(detecterIdees(ecrit, texte.idees))}>Comparer avec les idées clés</button>
          </div>
        </>
      ) : (
        <>
          <div className="astuce"><b>Ton résumé :</b> <span style={{ whiteSpace: "pre-wrap" }}>{ecrit}</span></div>
          <p className="muted petit">Les idées clés du texte. Celles qui semblent dans ton résumé sont pré-cochées : vérifie et corrige, c'est toi qui décides.</p>
          <ul className="idees">
            {texte.idees.map((idee, i) => (
              <li key={i}><label className="case-a-cocher"><input type="checkbox" checked={coches[i]} onChange={(e) => setCoches(coches.map((c, k) => (k === i ? e.target.checked : c)))} /> {idee.texte}</label></li>
            ))}
          </ul>
          <div className="choix">
            <button className="btn" onClick={() => setCoches(null)}>Modifier mon résumé</button>
            <button className="btn primary" onClick={() => {
              maj((d) => ({ ...d, resumes: [...d.resumes, { id: newId(), texteId: texte.id, at: Date.now(), texte: ecrit.trim(), idees: coches.flatMap((c, i) => (c ? [i] : [])), total: texte.idees.length }] }));
              setFait(true);
            }}>Enregistrer</button>
          </div>
        </>
      )}
    </Carte>
  );
}
