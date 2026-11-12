import { useState } from 'react';
import { JUZ_STARTS, QUARTER_STARTS, SURAHS, TOTAL_VERSES, fromGlobalIndex } from '../../core/quran.ts';
import { overview, streak, knownShare, type Counts } from '../../core/store.ts';
import { addDays, formatDayFr, weekday } from '../../core/dates.ts';
import { pct, useApp } from '../context.tsx';

const WEEKS = 18;

function Tile({ label, c, size, onClick, title }: { label: string; c: Counts; size: number; onClick: () => void; title: string }) {
  const known = knownShare(c, size);
  const learn = c.learning / size;
  return (
    <button className="tile" onClick={onClick} title={title}>
      <span className="tile-fill" style={{ height: `${known * 100}%` }} />
      <span className="tile-learn" style={{ height: `${learn * 100}%`, bottom: `${known * 100}%` }} />
      <span className="tile-lbl">{label}</span>
      <span className="tile-pct">{known > 0 ? `${Math.round(known * 100)}%` : ''}</span>
    </button>
  );
}

export function ProgressView() {
  const { data, today, go } = useApp();
  const [map, setMap] = useState<'juz' | 'hizb'>('juz');
  const o = overview(data);
  const st = streak(data, today);
  const known = o.total.memorized + o.total.weak;

  const openAt = (globalStart: number) => {
    const [sura, aya] = fromGlobalIndex(globalStart);
    go({ name: 'surah', sura, focus: aya });
  };
  const where = (g: number) => {
    const [s, a] = fromGlobalIndex(g);
    return `${SURAHS[s - 1].nameFr} ${a}`;
  };

  // Calendrier d'activité : WEEKS semaines, colonnes = semaines (lundi en haut)
  const offset = (weekday(today) + 6) % 7;
  const start = addDays(today, -(WEEKS - 1) * 7 - offset);
  const days: string[] = Array.from({ length: WEEKS * 7 }, (_, i) => addDays(start, i));
  const level = (d: string) => {
    const a = data.activity[d];
    const n = a ? a.reviews + Math.ceil(a.memorized / 3) : 0;
    return d > today ? -1 : n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 10 ? 3 : 4;
  };
  const totalReviews = Object.values(data.activity).reduce((n, a) => n + a.reviews, 0);

  return (
    <div className="page">
      <h1>Progression</h1>
      <div className="cards">
        <div className="card">
          <div className="big">{pct(knownShare(o.total))}</div>
          <div>du Coran mémorisé</div>
          <div className="muted small">{known} / {TOTAL_VERSES} versets</div>
        </div>
        <div className="card">
          <div className="big">{o.surahsComplete}</div>
          <div>sourates complètes</div>
          <div className="muted small">sur 114</div>
        </div>
        <div className="card">
          <div className="big">{st.current} <span className="unit">j</span></div>
          <div>série en cours</div>
          <div className="muted small">record : {st.best} j</div>
        </div>
        <div className="card">
          <div className="big">{o.total.weak}</div>
          <div>versets à revoir</div>
          <div className="muted small">{o.total.learning} en cours · {totalReviews} révisions au total</div>
        </div>
      </div>

      <section>
        <div className="section-head">
          <h2>Carte du Coran</h2>
          <div className="seg">
            <button className={map === 'juz' ? 'on' : ''} onClick={() => setMap('juz')}>30 juz</button>
            <button className={map === 'hizb' ? 'on' : ''} onClick={() => setMap('hizb')}>60 hizb</button>
          </div>
        </div>
        <div className={`tiles ${map}`}>
          {map === 'juz'
            ? o.juz.map((c, i) => (
                <Tile key={i} label={String(i + 1)} c={c} size={c.size} onClick={() => openAt(JUZ_STARTS[i])}
                  title={`Juz ${i + 1} (dès ${where(JUZ_STARTS[i])}) : ${c.memorized + c.weak}/${c.size} mémorisés, ${c.learning} en cours`} />
              ))
            : o.hizb.map((c, i) => (
                <Tile key={i} label={String(i + 1)} c={c} size={c.size} onClick={() => openAt(QUARTER_STARTS[i * 4])}
                  title={`Hizb ${i + 1} (dès ${where(QUARTER_STARTS[i * 4])}) : ${c.memorized + c.weak}/${c.size} mémorisés, ${c.learning} en cours`} />
              ))}
        </div>
        <div className="legend small">
          <span><i className="lg mem" /> mémorisé</span>
          <span><i className="lg learn" /> en cours</span>
          <span className="muted">Clique sur une case pour ouvrir le texte.</span>
        </div>
      </section>

      <section>
        <h2>Activité des {WEEKS} dernières semaines</h2>
        <div className="heat" style={{ gridTemplateColumns: `repeat(${WEEKS}, 14px)` }}>
          {days.map((d) => {
            const a = data.activity[d];
            return (
              <span key={d} className={`hc l${level(d)}`}
                title={`${formatDayFr(d)} : ${a?.reviews ?? 0} révision(s), ${a?.memorized ?? 0} verset(s) appris`} />
            );
          })}
        </div>
        <div className="legend small muted">Moins <span className="hc l0" /><span className="hc l1" /><span className="hc l2" /><span className="hc l3" /><span className="hc l4" /> Plus</div>
      </section>
    </div>
  );
}
