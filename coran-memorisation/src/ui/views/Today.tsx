import { SURAHS, portionLabel } from '../../core/quran.ts';
import { dueQueue, forecast, overview, streak, knownShare } from '../../core/store.ts';
import { addDays, formatDayFr } from '../../core/dates.ts';
import { pct, useApp } from '../context.tsx';

export function TodayView() {
  const { data, today, go } = useApp();
  const queue = dueQueue(data, today);
  const todo = queue.slice(0, data.settings.dailyLimit);
  const st = streak(data, today);
  const o = overview(data);
  const act = data.activity[today] ?? { reviews: 0, memorized: 0 };
  const fc = forecast(data, today, 7);
  const maxFc = Math.max(1, ...fc);

  const learning = new Map<number, number[]>();
  for (const [k, v] of Object.entries(data.verses)) {
    if (v !== 'learning') continue;
    const [s, a] = k.split(':').map(Number);
    learning.set(s, [...(learning.get(s) ?? []), a]);
  }

  const known = o.total.memorized + o.total.weak;

  return (
    <div className="page">
      <h1>Aujourd'hui</h1>
      <p className="muted">{formatDayFr(today)}</p>

      <div className="cards">
        <div className="card hero">
          <div className="big">{todo.length}</div>
          <div>portion{todo.length > 1 ? 's' : ''} à réviser{queue.length > todo.length ? ` (sur ${queue.length} en attente)` : ''}</div>
          <button className="primary" disabled={todo.length === 0} onClick={() => go({ name: 'review', mode: 'due' })}>
            {todo.length ? 'Commencer la révision' : 'Rien à réviser'}
          </button>
        </div>
        <div className="card">
          <div className="big">{st.current} <span className="unit">j</span></div>
          <div>série en cours</div>
          <div className="muted small">record : {st.best} j</div>
        </div>
        <div className="card">
          <div className="big">{known}</div>
          <div>versets mémorisés</div>
          <div className="muted small">{pct(knownShare(o.total))} du Coran · {o.surahsComplete} sourate{o.surahsComplete > 1 ? 's' : ''} complète{o.surahsComplete > 1 ? 's' : ''}</div>
        </div>
        <div className="card">
          <div className="big">{act.reviews}</div>
          <div>révision{act.reviews > 1 ? 's' : ''} aujourd'hui</div>
          <div className="muted small">{act.memorized} verset{act.memorized > 1 ? 's' : ''} appris aujourd'hui</div>
        </div>
      </div>

      {todo.length > 0 && (
        <section>
          <h2>Au programme</h2>
          <ul className="plain">
            {todo.map((q) => (
              <li key={q.portion.id}>
                <button className="link" onClick={() => go({ name: 'surah', sura: q.portion.sura, focus: q.portion.from })}>
                  {portionLabel(q.portion)}
                </button>{' '}
                {q.weak ? <span className="tag weak">versets à revoir</span> : q.overdue > 0 ? <span className="tag">en retard de {q.overdue} j</span> : <span className="tag">prévue aujourd'hui</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>En cours d'apprentissage</h2>
        {learning.size === 0 ? (
          <p className="muted">
            Aucun verset en cours. Ouvre une sourate dans <button className="link" onClick={() => go({ name: 'surahs' })}>Sourates</button> et marque les versets que tu apprends.
          </p>
        ) : (
          <ul className="plain">
            {[...learning.entries()].sort((a, b) => a[0] - b[0]).map(([s, ayas]) => (
              <li key={s}>
                <button className="link" onClick={() => go({ name: 'surah', sura: s, focus: Math.min(...ayas) })}>
                  {SURAHS[s - 1].nameFr}
                </button>{' '}
                <span className="muted">{ayas.length} verset{ayas.length > 1 ? 's' : ''} en cours</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Révisions des 7 prochains jours</h2>
        <div className="forecast">
          {fc.map((n, i) => (
            <div key={i} className="fc-col" title={`${n} portion(s)`}>
              <div className="fc-val">{n}</div>
              <div className="fc-bar" style={{ height: `${(n / maxFc) * 80}px` }} />
              <div className="fc-lbl">{i === 0 ? "auj." : formatDayFr(addDays(today, i)).split(' ')[0]}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
