import { useState } from "react";
import { dayStart } from "../core/fsrs";
import { makeDeck } from "../core/model";
import { dueCounts } from "../core/session";
import { retention, streak, timeToday } from "../core/stats";
import { fmtDuration, fmtPercent, plural, useApp } from "../ui";

export default function Home() {
  const { db, update, go, startImport } = useApp();
  const [newName, setNewName] = useState<string | null>(null);
  const now = Date.now();
  const total = dueCounts(db, now);
  const st = streak(db, now);
  const ret = retention(db, now);
  const todayStart = dayStart(now, db.settings.dayStartHour);
  const reviewedToday = db.reviews.filter((r) => r.ts >= todayStart).length;

  const createDeck = () => {
    const name = (newName ?? "").trim();
    if (!name) return;
    const deck = makeDeck(name);
    update((d) => ({ ...d, decks: [...d.decks, deck] }));
    setNewName(null);
    go({ name: "deck", deckId: deck.id });
  };

  return (
    <div className="page" data-testid="home">
      <header className="page-head">
        <div>
          <h1>Aujourd'hui</h1>
          <p className="muted">
            {total.total === 0
              ? db.cards.length === 0
                ? "Créez un paquet ou importez vos cartes pour commencer."
                : "Tout est révisé pour aujourd'hui. Revenez demain !"
              : `${plural(total.total, "carte", "cartes")} à voir aujourd'hui.`}
          </p>
        </div>
        <button className="btn primary big" disabled={total.total === 0} onClick={() => go({ name: "review", deckId: null })}>
          Commencer la révision
        </button>
      </header>

      <section className="tiles">
        <div className="tile">
          <span className="tile-label">Série</span>
          <strong className="tile-value">{plural(st.current, "jour", "jours")}</strong>
          <span className="muted small">{st.reviewedToday ? "Révisé aujourd'hui ✓" : st.current > 0 ? "Révisez aujourd'hui pour la garder" : `Record : ${plural(st.best, "jour", "jours")}`}</span>
        </div>
        <div className="tile">
          <span className="tile-label">À réviser</span>
          <strong className="tile-value">{total.review + total.learning}</strong>
          <span className="muted small">+ {plural(total.new, "nouvelle", "nouvelles")}</span>
        </div>
        <div className="tile">
          <span className="tile-label">Rétention (30 j)</span>
          <strong className="tile-value">{fmtPercent(ret.rate)}</strong>
          <span className="muted small">{ret.count ? `sur ${plural(ret.count, "révision", "révisions")}` : "Pas encore de révision"}</span>
        </div>
        <div className="tile">
          <span className="tile-label">Aujourd'hui</span>
          <strong className="tile-value">{reviewedToday}</strong>
          <span className="muted small">{reviewedToday > 1 ? "réponses" : "réponse"} · {fmtDuration(timeToday(db, now))}</span>
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Paquets</h2>
          <div className="row">
            <button className="btn" onClick={() => startImport()}>Importer…</button>
            <button className="btn" onClick={() => setNewName("")}>Nouveau paquet</button>
          </div>
        </div>
        {newName !== null && (
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); createDeck(); }}>
            <input autoFocus placeholder="Nom du paquet (ex. : Histoire – Révolution)" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button className="btn primary" type="submit" disabled={!newName.trim()}>Créer</button>
            <button className="btn" type="button" onClick={() => setNewName(null)}>Annuler</button>
          </form>
        )}
        {db.decks.length === 0 ? (
          <div className="empty">Aucun paquet pour l'instant.</div>
        ) : (
          <div className="deck-list">
            {db.decks.map((deck) => {
              const c = dueCounts(db, now, deck.id);
              const n = db.cards.filter((x) => x.deckId === deck.id).length;
              return (
                <div key={deck.id} className="deck-row">
                  <button className="deck-name" onClick={() => go({ name: "deck", deckId: deck.id })}>
                    <strong>{deck.name}</strong>
                    <span className="muted small">{plural(n, "carte", "cartes")} · {deck.answerMode === "typed" ? "réponse tapée" : "carte retournée"}</span>
                  </button>
                  <div className="counts">
                    <span className="count new" title="Nouvelles">{c.new}</span>
                    <span className="count learn" title="En apprentissage">{c.learning}</span>
                    <span className="count due" title="À réviser">{c.review}</span>
                  </div>
                  <button className="btn primary" disabled={c.total === 0} onClick={() => go({ name: "review", deckId: deck.id })}>
                    Réviser
                  </button>
                </div>
              );
            })}
            <div className="legend muted small">
              <span className="count new">■</span> nouvelles <span className="count learn">■</span> en apprentissage <span className="count due">■</span> à réviser
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
