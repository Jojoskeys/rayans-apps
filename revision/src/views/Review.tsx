import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { checkCloze, checkTyped, parseCloze, type CheckResult } from "../core/answer";
import { formatDelay, previewAll } from "../core/fsrs";
import { GRADES, GRADE_LABELS, type Card, type Grade } from "../core/model";
import { dueCounts, nextCard, recordAnswer, undoAnswer } from "../core/session";
import { fmtDuration, isTyping, plural, useApp } from "../ui";

type Verdict = { ok: boolean; typo?: boolean; detail?: CheckResult[]; picked?: string; typed?: string };

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Séance de révision : une carte à la fois, puis les quatre notes avec le prochain délai de chacune. */
export default function Review({ deckId }: { deckId: string | null }) {
  const { db, update, go } = useApp();
  const deck = deckId ? db.decks.find((d) => d.id === deckId) : null;
  const [cardId, setCardId] = useState<string | null>(() => nextCard(db, Date.now(), deckId)?.id ?? null);
  const [revealed, setRevealed] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [typed, setTyped] = useState("");
  const [gaps, setGaps] = useState<string[]>([]);
  const [shownAt, setShownAt] = useState(Date.now());
  const [history, setHistory] = useState<Card[]>([]);
  const [session, setSession] = useState({ answered: 0, correct: 0, ms: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const card = cardId ? db.cards.find((c) => c.id === cardId) ?? null : null;
  const cardDeck = card ? db.decks.find((d) => d.id === card.deckId) : null;
  const mode = cardDeck?.answerMode ?? "flip";
  // Les QCM se corrigent toujours automatiquement ; les autres cartes selon le réglage du paquet.
  const autoCheck = card?.kind === "mcq" || mode === "typed";
  const choices = useMemo(() => (card?.kind === "mcq" ? shuffle(card.choices) : []), [card?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const segments = useMemo(() => (card?.kind === "cloze" ? parseCloze(card.question) : []), [card?.question, card?.kind]);
  const now = Date.now();
  const previews = useMemo(() => (card ? previewAll(card.sched, Date.now(), db.settings) : null), [card, db.settings, revealed]); // eslint-disable-line react-hooks/exhaustive-deps
  const remaining = dueCounts(db, now, deckId);

  const resetFace = () => {
    setRevealed(false);
    setVerdict(null);
    setTyped("");
    setGaps([]);
    setShownAt(Date.now());
  };

  useEffect(() => {
    if (card && !revealed) setTimeout(() => (document.querySelector(".answer-input") as HTMLInputElement | null)?.focus(), 0);
  }, [card?.id, revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  const check = () => {
    if (!card || revealed) return;
    if (!autoCheck) { setRevealed(true); return; }
    if (card.kind === "basic") {
      const r = checkTyped(typed, card.answer);
      setVerdict({ ok: r.ok, typo: r.ok && r.typo, detail: [r], typed });
    } else if (card.kind === "cloze") {
      const r = checkCloze(card.question, gaps);
      setVerdict({ ok: r.ok, typo: r.gaps.some((g) => g.ok && g.typo), detail: r.gaps });
    }
    setRevealed(true);
  };

  const pick = (choice: string) => {
    if (!card || revealed) return;
    setVerdict({ ok: choice === card.answer, picked: choice });
    setRevealed(true);
  };

  const grade = useCallback(
    (g: Grade) => {
      if (!card || !revealed) return;
      const t = Date.now();
      const duration = Math.min(t - shownAt, 5 * 60_000);
      const before = card;
      const after = recordAnswer(db, before.id, g, t, duration);
      update(() => after);
      setHistory((h) => [...h.slice(-49), before]);
      setSession((s) => ({ answered: s.answered + 1, correct: s.correct + (g > 1 ? 1 : 0), ms: s.ms + duration }));
      setCardId(nextCard(after, t, deckId)?.id ?? null);
      resetFace();
    },
    [card, revealed, shownAt, db, update, deckId],
  );

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    update((d) => undoAnswer(d, prev));
    setHistory((h) => h.slice(0, -1));
    setSession((s) => ({ answered: Math.max(0, s.answered - 1), correct: s.correct, ms: s.ms }));
    setCardId(prev.id);
    resetFace();
  };

  const suggested: Grade = verdict ? (verdict.ok ? 3 : 1) : 3;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { go(deckId ? { name: "deck", deckId } : { name: "home" }); return; }
      if (e.ctrlKey && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
      if (!card) return;
      if (!revealed) {
        if (e.key === "Enter" && !(card.kind === "mcq")) { e.preventDefault(); check(); return; }
        if (isTyping(e)) return;
        if (e.key === " " && !autoCheck) { e.preventDefault(); check(); return; }
        if (card.kind === "mcq" && /^[1-9]$/.test(e.key)) { const c = choices[Number(e.key) - 1]; if (c) pick(c); }
        return;
      }
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); grade(suggested); return; }
      if (/^[1-4]$/.test(e.key)) grade(Number(e.key) as Grade);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const title = deck ? deck.name : "Tous les paquets";
  const exit = () => go(deckId ? { name: "deck", deckId } : { name: "home" });

  if (!card) {
    const next = db.cards
      .filter((c) => !c.suspended && (!deckId || c.deckId === deckId) && c.sched.state !== "new" && c.sched.due > now)
      .reduce<number | null>((m, c) => (m === null || c.sched.due < m ? c.sched.due : m), null);
    return (
      <div className="review done">
        <div className="done-card">
          <h1>Séance terminée</h1>
          {session.answered > 0 ? (
            <p>
              {plural(session.answered, "réponse", "réponses")} · {Math.round((session.correct / session.answered) * 100)} % de bonnes réponses · {fmtDuration(session.ms)}
            </p>
          ) : (
            <p>Il n'y a rien à réviser dans {deck ? "ce paquet" : "vos paquets"} pour le moment.</p>
          )}
          {next !== null && <p className="muted">Prochaine révision dans {formatDelay(next - now)}.</p>}
          <div className="row center">
            {history.length > 0 && <button className="btn" onClick={undo}>Annuler la dernière réponse</button>}
            <button className="btn primary" autoFocus onClick={exit}>Terminer</button>
          </div>
        </div>
      </div>
    );
  }

  const answerText = card.answer.split("|").map((s) => s.trim()).join(" ou ");

  return (
    <div className="review">
      <header className="review-head">
        <button className="link" onClick={exit}>← Quitter</button>
        <div className="review-title">
          <strong>{title}</strong>
          {deckId === null && cardDeck && <span className="muted small"> · {cardDeck.name}</span>}
        </div>
        <div className="counts" title="Nouvelles · en apprentissage · à réviser">
          <span className={`count new${card.sched.state === "new" ? " current" : ""}`}>{remaining.new}</span>
          <span className={`count learn${card.sched.state === "learning" || card.sched.state === "relearning" ? " current" : ""}`}>{remaining.learning}</span>
          <span className={`count due${card.sched.state === "review" ? " current" : ""}`}>{remaining.review}</span>
        </div>
      </header>

      <div className="flashcard" data-testid="flashcard">
        <div className="question">
          {card.kind === "cloze" ? (
            <p className="cloze">
              {segments.map((s, i) =>
                "gap" in s ? (
                  revealed ? (
                    <span key={i} className={`gap-answer ${verdict?.detail ? (verdict.detail[s.gap]?.ok ? "ok" : "ko") : ""}`}>
                      {s.answer}
                      {verdict?.detail && !verdict.detail[s.gap]?.ok && gaps[s.gap] && <del>{gaps[s.gap]}</del>}
                    </span>
                  ) : autoCheck ? (
                    <input key={i} className="gap-input answer-input" size={Math.max(4, s.answer.length + 1)} placeholder={s.hint || "…"}
                      value={gaps[s.gap] ?? ""} onChange={(e) => { const g = [...gaps]; g[s.gap] = e.target.value; setGaps(g); }} aria-label={`Trou ${s.gap + 1}`} />
                  ) : (
                    <span key={i} className="gap-hidden">[{s.hint || "…"}]</span>
                  )
                ) : (
                  <span key={i}>{s.text}</span>
                ),
              )}
            </p>
          ) : (
            <p>{card.question}</p>
          )}
        </div>

        {card.kind === "mcq" && (
          <div className="mcq">
            {choices.map((c, i) => {
              const state = revealed ? (c === card.answer ? "ok" : c === verdict?.picked ? "ko" : "") : "";
              return (
                <button key={c} className={`choice ${state}`} disabled={revealed} onClick={() => pick(c)}>
                  <kbd>{i + 1}</kbd> {c}
                </button>
              );
            })}
          </div>
        )}

        {card.kind === "basic" && autoCheck && !revealed && (
          <input ref={inputRef} className="typed answer-input" placeholder="Votre réponse, puis Entrée" value={typed} onChange={(e) => setTyped(e.target.value)} />
        )}

        {revealed && (
          <div className="answer">
            {verdict && (
              <p className={`verdict ${verdict.ok ? "ok" : "ko"}`}>
                {verdict.ok ? (verdict.typo ? "Juste (petite faute de frappe acceptée)" : "Juste !") : card.kind === "mcq" ? "Raté." : "Pas tout à fait."}
              </p>
            )}
            {card.kind === "basic" && (
              <>
                {verdict?.typed !== undefined && !verdict.ok && verdict.typed.trim() && <p className="yours">Votre réponse : <del>{verdict.typed}</del></p>}
                <p className="the-answer">{answerText}</p>
              </>
            )}
            {card.explanation && <p className="explanation">{card.explanation}</p>}
          </div>
        )}
      </div>

      <footer className="review-foot">
        {!revealed ? (
          card.kind === "mcq" ? (
            <p className="muted small">Cliquez sur une proposition ou tapez son numéro.</p>
          ) : (
            <button className="btn primary big" onClick={check}>
              {autoCheck ? "Valider (Entrée)" : "Afficher la réponse (Espace)"}
            </button>
          )
        ) : (
          <div className="grades">
            {GRADES.map((g) => (
              <button key={g} className={`grade g${g}${g === suggested ? " suggested" : ""}`} onClick={() => grade(g)}>
                <span className="grade-label"><kbd>{g}</kbd> {GRADE_LABELS[g]}</span>
                <span className="grade-delay">{previews ? formatDelay(previews[g].interval * 86_400_000) : ""}</span>
              </button>
            ))}
          </div>
        )}
        <div className="review-tools">
          {history.length > 0 && <button className="link" onClick={undo}>Annuler la dernière réponse (Ctrl+Z)</button>}
          {revealed && verdict && !verdict.ok && <span className="muted small">Vous pensez avoir juste ? Choisissez une autre note.</span>}
        </div>
      </footer>
    </div>
  );
}
