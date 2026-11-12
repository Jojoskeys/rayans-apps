import { useState } from 'react';
import { SURAHS, juzOf } from '../../core/quran.ts';
import { surahCounts } from '../../core/store.ts';
import { useApp } from '../context.tsx';

type Filter = 'all' | 'started' | 'complete' | 'weak';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ'’ -]/g, '').toLowerCase();

export function SurahList() {
  const { data, go } = useApp();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const rows = SURAHS.map((s) => ({ s, c: surahCounts(data, s.number) })).filter(({ s, c }) => {
    const known = c.memorized + c.weak;
    if (filter === 'started' && known + c.learning === 0) return false;
    if (filter === 'complete' && known !== s.ayas) return false;
    if (filter === 'weak' && c.weak === 0) return false;
    if (!q) return true;
    const n = fold(q);
    return String(s.number) === q.trim() || fold(s.nameFr).includes(n) || fold(s.meaningFr).includes(n) || s.nameAr.includes(q.trim());
  });

  return (
    <div className="page">
      <h1>Sourates</h1>
      <div className="toolbar">
        <input className="search" placeholder="Rechercher (nom, sens ou numéro)" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="seg">
          {(
            [
              ['all', 'Toutes'],
              ['started', 'Commencées'],
              ['complete', 'Complètes'],
              ['weak', 'À revoir'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="surah-grid">
        {rows.map(({ s, c }) => {
          const known = c.memorized + c.weak;
          return (
            <button key={s.number} className="surah-row" onClick={() => go({ name: 'surah', sura: s.number })}>
              <span className="num">{s.number}</span>
              <span className="names">
                <span className="fr">{s.nameFr}</span>
                <span className="muted small">
                  {s.meaningFr} · {s.ayas} versets · juz {juzOf(s.number, 1)}
                </span>
              </span>
              <span className="ar surah-ar" lang="ar" dir="rtl">{s.nameAr}</span>
              <span className="bar" title={`${known} mémorisés, ${c.learning} en cours, ${c.weak} à revoir`}>
                <span className="seg-mem" style={{ width: `${(c.memorized / s.ayas) * 100}%` }} />
                <span className="seg-weak" style={{ width: `${(c.weak / s.ayas) * 100}%` }} />
                <span className="seg-learn" style={{ width: `${(c.learning / s.ayas) * 100}%` }} />
              </span>
              <span className="count small">
                {known}/{s.ayas}
              </span>
            </button>
          );
        })}
        {rows.length === 0 && <p className="muted">Aucune sourate ne correspond.</p>}
      </div>
    </div>
  );
}
