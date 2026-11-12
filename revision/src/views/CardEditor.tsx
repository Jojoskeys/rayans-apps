import { useState } from "react";
import { clozeGapCount, parseCloze } from "../core/answer";
import { KIND_LABELS, cleanDraft, validateDraft, type Card, type CardDraft, type CardKind } from "../core/model";
import { Modal } from "../ui";

interface Props {
  initial?: Card;
  defaultKind?: CardKind;
  onSave: (draft: CardDraft, keepOpen: boolean) => void;
  onClose: () => void;
}

/** Création ou modification d'une carte : question/réponse, QCM ou texte à trous. */
export default function CardEditor({ initial, defaultKind = "basic", onSave, onClose }: Props) {
  const [kind, setKind] = useState<CardKind>(initial?.kind ?? defaultKind);
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [choices, setChoices] = useState<string[]>(() => {
    if (initial?.kind === "mcq") return initial.choices.filter((c) => c !== initial.answer);
    return ["", ""];
  });
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [tried, setTried] = useState(false);

  const draft: CardDraft = { kind, question, answer, choices: kind === "mcq" ? [answer, ...choices] : [], explanation };
  const error = validateDraft(draft, clozeGapCount);

  const submit = (keepOpen: boolean) => {
    setTried(true);
    if (error) return;
    onSave(cleanDraft(draft), keepOpen);
    if (keepOpen) {
      setQuestion("");
      setAnswer("");
      setChoices(["", ""]);
      setExplanation("");
      setTried(false);
      document.getElementById("card-question")?.focus();
    }
  };

  return (
    <Modal title={initial ? "Modifier la carte" : "Nouvelle carte"} onClose={onClose} wide>
      <form
        className="modal-body editor"
        onSubmit={(e) => { e.preventDefault(); submit(false); }}
        onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); submit(!initial); } }}
      >
        <div className="seg" role="radiogroup" aria-label="Type de carte">
          {(Object.keys(KIND_LABELS) as CardKind[]).map((k) => (
            <button type="button" key={k} role="radio" aria-checked={kind === k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>

        <label>
          {kind === "cloze" ? "Texte (trous entre doubles accolades)" : "Question"}
          <textarea id="card-question" autoFocus rows={kind === "cloze" ? 4 : 3} value={question} onChange={(e) => setQuestion(e.target.value)}
            placeholder={kind === "cloze" ? "La {{Loire}} est le plus long fleuve de {{France::pays}}." : "Quel mot-clé Java crée un objet ?"} />
        </label>
        {kind === "cloze" && (
          <p className="hint">
            Écrivez <code>{"{{réponse}}"}</code> pour un trou, ou <code>{"{{réponse::indice}}"}</code> pour afficher un indice.
            {clozeGapCount(question) > 0 && (
              <> Aperçu : {parseCloze(question).map((s, i) => ("gap" in s ? <span key={i} className="gap-preview">[{s.hint || "…"}]</span> : <span key={i}>{s.text}</span>))}</>
            )}
          </p>
        )}

        {kind === "basic" && (
          <label>
            Réponse
            <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="new" />
            <span className="hint">Plusieurs réponses acceptées ? Séparez-les par « | » (ex. : 4 | quatre). Majuscules et accents sont ignorés à la correction.</span>
          </label>
        )}

        {kind === "mcq" && (
          <div className="choices-edit">
            <label>
              Bonne réponse
              <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="git commit" />
            </label>
            <span className="label-like">Mauvaises réponses</span>
            {choices.map((c, i) => (
              <div key={i} className="row">
                <input value={c} onChange={(e) => setChoices(choices.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Proposition ${i + 2}`} />
                {choices.length > 1 && (
                  <button type="button" className="icon-btn" aria-label="Retirer" onClick={() => setChoices(choices.filter((_, j) => j !== i))}>×</button>
                )}
              </div>
            ))}
            {choices.length < 7 && (
              <button type="button" className="btn small" onClick={() => setChoices([...choices, ""])}>+ Ajouter une proposition</button>
            )}
          </div>
        )}

        <label>
          Explication (facultative, montrée après la réponse)
          <textarea rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
        </label>

        {tried && error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <span className="muted small">Ctrl + Entrée : {initial ? "enregistrer" : "ajouter et continuer"}</span>
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          {!initial && <button type="button" className="btn" onClick={() => submit(true)}>Ajouter et continuer</button>}
          <button type="submit" className="btn primary">{initial ? "Enregistrer" : "Ajouter"}</button>
        </div>
      </form>
    </Modal>
  );
}
