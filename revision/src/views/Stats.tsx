import { useState } from "react";
import type { Db } from "../core/model";
import { dueCounts } from "../core/session";
import { breakdown, forecast, retention, reviewsPerDay, streak, timeToday } from "../core/stats";
import { fmtDuration, fmtPercent, plural, useApp } from "../ui";

const dayLabel = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
};

function Bars({ data, max, render }: { data: { key: string; parts: { value: number; cls: string }[]; title: string }[]; max: number; render: (k: string) => string }) {
  return (
    <div className="bars" role="img">
      {data.map((d, i) => (
        <div key={d.key} className="bar-col" title={d.title}>
          <div className="bar-stack">
            {d.parts.map((p) => (
              <div key={p.cls} className={`bar ${p.cls}`} style={{ height: `${max ? (p.value / max) * 100 : 0}%` }} />
            ))}
          </div>
          <span className="bar-label">{data.length <= 10 || i % 5 === 4 || i === data.length - 1 ? render(d.key) : ""}</span>
        </div>
      ))}
    </div>
  );
}

/** Restreint la base à un paquet (pour les statistiques par paquet). */
function scoped(db: Db, deckId: string): Db {
  return { ...db, cards: db.cards.filter((c) => c.deckId === deckId), reviews: db.reviews.filter((r) => r.deckId === deckId) };
}

export default function Stats() {
  const { db: all } = useApp();
  const [deckId, setDeckId] = useState("");
  const db = deckId ? scoped(all, deckId) : all;
  const now = Date.now();
  const st = streak(all, now); // la série compte toutes les révisions
  const ret30 = retention(db, now, 30);
  const ret7 = retention(db, now, 7);
  const due = dueCounts(all, now, deckId || null);
  const bd = breakdown(db, now);
  const perDay = reviewsPerDay(db, now, 30);
  const fc = forecast(db, now, 7);
  const maxDay = Math.max(1, ...perDay.map((d) => d.count));
  const maxFc = Math.max(1, ...fc.map((d) => d.count));
  const total30 = perDay.reduce((s, d) => s + d.count, 0);
  const daysActive = perDay.filter((d) => d.count > 0).length;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Statistiques</h1>
        <select value={deckId} onChange={(e) => setDeckId(e.target.value)} aria-label="Paquet">
          <option value="">Tous les paquets</option>
          {all.decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </header>

      <section className="tiles">
        <div className="tile">
          <span className="tile-label">Série actuelle</span>
          <strong className="tile-value">{plural(st.current, "jour", "jours")}</strong>
          <span className="muted small">Record : {plural(st.best, "jour", "jours")}</span>
        </div>
        <div className="tile">
          <span className="tile-label">À voir aujourd'hui</span>
          <strong className="tile-value">{due.total}</strong>
          <span className="muted small">{due.review} à réviser · {due.learning} en cours · {due.new} nouvelles</span>
        </div>
        <div className="tile">
          <span className="tile-label">Rétention</span>
          <strong className="tile-value">{fmtPercent(ret30.rate)}</strong>
          <span className="muted small">30 j ({ret30.count}) · 7 j : {fmtPercent(ret7.rate)} · objectif {Math.round(all.settings.retention * 100)} %</span>
        </div>
        <div className="tile">
          <span className="tile-label">Cartes maîtrisées</span>
          <strong className="tile-value">{bd.mastered}</strong>
          <span className="muted small">stables plus de 3 semaines, sur {bd.total}</span>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Révisions des 30 derniers jours</h2>
          <span className="muted small">{plural(total30, "réponse", "réponses")} · {plural(daysActive, "jour actif", "jours actifs")} · aujourd'hui {fmtDuration(timeToday(db, now))}</span>
        </div>
        <Bars
          max={maxDay}
          render={dayLabel}
          data={perDay.map((d) => ({
            key: d.key,
            title: `${dayLabel(d.key)} : ${d.count} réponses, ${d.correct} justes`,
            parts: [{ value: d.count - d.correct, cls: "ko" }, { value: d.correct, cls: "ok" }],
          }))}
        />
        <p className="legend muted small"><span className="sw ok" /> justes <span className="sw ko" /> « À revoir »</p>
      </section>

      <div className="two-col">
        <section className="panel">
          <h2>Prévisions (7 jours)</h2>
          <Bars max={maxFc} render={dayLabel} data={fc.map((d) => ({ key: d.key, title: `${dayLabel(d.key)} : ${d.count} cartes`, parts: [{ value: d.count, cls: "due" }] }))} />
          <p className="muted small">Cartes déjà apprises qui reviendront chaque jour (hors nouvelles cartes).</p>
        </section>
        <section className="panel">
          <h2>Cartes</h2>
          <div className="stack-bar" aria-label="Répartition des cartes">
            {bd.total > 0 && (
              <>
                <div className="seg-new" style={{ flex: bd.new }} />
                <div className="seg-learn" style={{ flex: bd.learning }} />
                <div className="seg-young" style={{ flex: bd.review - bd.mastered }} />
                <div className="seg-mature" style={{ flex: bd.mastered }} />
                <div className="seg-susp" style={{ flex: bd.suspended }} />
              </>
            )}
          </div>
          <ul className="kv">
            <li><span className="sw seg-new" /> Nouvelles <b>{bd.new}</b></li>
            <li><span className="sw seg-learn" /> En apprentissage <b>{bd.learning}</b></li>
            <li><span className="sw seg-young" /> En révision (récentes) <b>{bd.review - bd.mastered}</b></li>
            <li><span className="sw seg-mature" /> Maîtrisées <b>{bd.mastered}</b></li>
            <li><span className="sw seg-susp" /> Suspendues <b>{bd.suspended}</b></li>
            <li>Probabilité moyenne de s'en souvenir maintenant <b>{fmtPercent(bd.avgRecall)}</b></li>
          </ul>
        </section>
      </div>
    </div>
  );
}
