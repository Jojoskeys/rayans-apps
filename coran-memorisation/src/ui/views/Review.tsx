import { useCallback, useEffect, useMemo, useState } from 'react';
import { SURAHS, juzOf, pageOf, portionLabel, splitBasmala, tokenizeVerse, verseKey, type Portion } from '../../core/quran.ts';
import { dueQueue, gradePortion, setVerseStatus } from '../../core/store.ts';
import { GRADE_LABELS, nextInterval, type Grade } from '../../core/srs.ts';
import { relativeDayFr } from '../../core/dates.ts';
import { playTracks } from '../audio.ts';
import { ayaMark, useApp, type View } from '../context.tsx';

type ReviewProps = { view: Extract<View, { name: 'review' }> };

interface Item {
  portion: Portion;
  graded: boolean;
}

const fmtInterval = (n: number) => (n <= 1 ? '1 jour' : n < 30 ? `${n} jours` : n < 60 ? `${Math.round(n / 7)} sem.` : `${Math.round(n / 30)} mois`);

export function ReviewView({ view }: ReviewProps) {
  const { data, today, update, go } = useApp();
  const [items] = useState<Item[]>(() =>
    view.mode === 'due'
      ? dueQueue(data, today).slice(0, data.settings.dailyLimit).map((q) => ({ portion: q.portion, graded: true }))
      : [{ portion: { id: 'practice', sura: view.sura, from: view.from, to: view.to }, graded: false }],
  );
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Grade[]>([]);

  if (items.length === 0) {
    return (
      <div className="page">
        <h1>Révision</h1>
        <div className="empty">
          <p>Rien à réviser pour aujourd'hui.</p>
          <p className="muted">
            Les portions mémorisées reviennent ici selon leur échéance. Pour t'entraîner librement, ouvre une sourate et choisis « S'entraîner ».
          </p>
          <button onClick={() => go({ name: 'surahs' })}>Voir les sourates</button>
        </div>
      </div>
    );
  }

  if (index >= items.length) {
    const count = (g: Grade) => results.filter((r) => r === g).length;
    return (
      <div className="page">
        <h1>Révision terminée</h1>
        <div className="empty">
          <p className="big">✓ {items.length} portion{items.length > 1 ? 's' : ''}</p>
          {items[0].graded && (
            <p className="muted">
              {([3, 2, 1, 0] as Grade[]).map((g) => `${GRADE_LABELS[g]} : ${count(g)}`).join(' · ')}
            </p>
          )}
          <div className="toolbar center">
            <button className="primary" onClick={() => go({ name: 'today' })}>Retour à aujourd'hui</button>
            {!items[0].graded && <button onClick={() => { setIndex(0); setResults([]); }}>Recommencer</button>}
          </div>
        </div>
      </div>
    );
  }

  const item = items[index];
  return (
    <ReviewCard
      key={`${index}-${item.portion.id}`}
      item={item}
      position={`${index + 1} / ${items.length}`}
      onDone={(g) => {
        if (item.graded && g !== null) {
          update((d) => gradePortion(d, item.portion.id, g, today));
          setResults((r) => [...r, g]);
        }
        setIndex((i) => i + 1);
      }}
      onQuit={() => go(view.mode === 'practice' ? { name: 'surah', sura: view.sura, focus: view.from } : { name: 'today' })}
    />
  );
}

function ReviewCard({ item, position, onDone, onQuit }: { item: Item; position: string; onDone: (g: Grade | null) => void; onQuit: () => void }) {
  const { text, data, today, update } = useApp();
  const { portion: p, graded } = item;
  const s = SURAHS[p.sura - 1];
  const verses = useMemo(() => {
    const out: Array<{ aya: number; basmala: string | null; words: string[] }> = [];
    for (let a = p.from; a <= p.to; a++) {
      const { basmala, text: t } = splitBasmala(p.sura, a, text.ar[p.sura - 1][a - 1]);
      out.push({ aya: a, basmala, words: tokenizeVerse(t) });
    }
    return out;
  }, [p, text]);
  const [v, setV] = useState(0); // versets entièrement affichés
  const [w, setW] = useState(0); // mots affichés dans le verset v
  const [hintFirst, setHintFirst] = useState(false);
  const [hintFr, setHintFr] = useState(false);
  const done = v >= verses.length;
  const card = data.cards[p.id];

  const nextWord = useCallback(() => {
    if (done) return;
    if (w + 1 >= verses[v].words.length) {
      setV(v + 1);
      setW(0);
    } else setW(w + 1);
  }, [done, v, w, verses]);
  const nextVerse = useCallback(() => {
    if (done) return;
    setV(v + 1);
    setW(0);
  }, [done, v]);
  const back = useCallback(() => {
    if (w > 0) setW(0);
    else if (v > 0) setV(v - 1);
  }, [v, w]);
  const listen = useCallback(() => {
    const aya = verses[Math.min(v, verses.length - 1)].aya;
    playTracks([{ sura: p.sura, aya }], 1);
  }, [v, verses, p.sura]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === ' ') { e.preventDefault(); nextWord(); }
      else if (e.key === 'Enter') { e.preventDefault(); nextVerse(); }
      else if (e.key === 'Backspace') { e.preventDefault(); back(); }
      else if (e.key.toLowerCase() === 'a') { setV(verses.length); setW(0); }
      else if (e.key.toLowerCase() === 'l') listen();
      else if (e.key.toLowerCase() === 't') setHintFr((x) => !x);
      else if (e.key === 'Escape') onQuit();
      else if (done && graded && card && ['1', '2', '3', '4'].includes(e.key)) onDone((Number(e.key) - 1) as Grade);
      else if (done && !graded && e.key.toLowerCase() === 'n') onDone(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nextWord, nextVerse, back, listen, done, graded, card, onDone, onQuit, verses.length]);

  useEffect(() => {
    document.querySelector('.rv-verse.current')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [v]);

  const toggleWeak = (aya: number) => {
    const k = verseKey(p.sura, aya);
    const st = data.verses[k];
    if (st === 'weak') update((d) => setVerseStatus(d, [k], 'memorized', today));
    else if (st === 'memorized') update((d) => setVerseStatus(d, [k], 'weak', today));
  };

  return (
    <div className="page review">
      <div className="review-head">
        <div>
          <div className="muted small">{graded ? `Révision ${position}` : 'Entraînement libre (rien n’est noté)'}</div>
          <h1>{graded ? portionLabel(p) : `${s.nameFr} ${p.from}–${p.to}`}</h1>
          <div className="muted small">
            juz {juzOf(p.sura, p.from)} · page {pageOf(p.sura, p.from)} · {p.to - p.from + 1} verset{p.to > p.from ? 's' : ''}
            {card && graded && <> · prévue {relativeDayFr(card.due, today)}</>}
          </div>
        </div>
        <button className="link" onClick={onQuit}>Quitter</button>
      </div>

      <div className="toolbar wrap">
        <button onClick={nextWord} disabled={done} title="Espace">Mot suivant <kbd>Espace</kbd></button>
        <button onClick={nextVerse} disabled={done} title="Entrée">Verset suivant <kbd>Entrée</kbd></button>
        <button onClick={() => { setV(verses.length); setW(0); }} disabled={done}>Tout afficher <kbd>A</kbd></button>
        <button onClick={back} disabled={v === 0 && w === 0}>Revenir <kbd>⌫</kbd></button>
        <button onClick={listen}>▶ Écouter <kbd>L</kbd></button>
        <label className="check"><input type="checkbox" checked={hintFirst} onChange={(e) => setHintFirst(e.target.checked)} /> Indice : premier mot</label>
        <label className="check"><input type="checkbox" checked={hintFr} onChange={(e) => setHintFr(e.target.checked)} /> Traduction <kbd>T</kbd></label>
      </div>

      <div className="rv-verses">
        {verses.map((vv, i) => {
          const shown = i < v ? vv.words.length : i === v ? Math.max(w, hintFirst ? 1 : 0) : hintFirst ? 1 : 0;
          const st = data.verses[verseKey(p.sura, vv.aya)];
          return (
            <div key={vv.aya}>
              {vv.basmala && <div className="basmala ar" lang="ar" dir="rtl">{vv.basmala}</div>}
              <div className={`rv-verse ${i === v ? 'current' : ''} ${i < v ? 'revealed' : ''}`}>
                <p className="ar verse-ar" lang="ar" dir="rtl">
                  {vv.words.map((word, j) => (
                    <span key={j} className={j < shown ? 'w' : 'w hidden-w'} aria-hidden={j >= shown}>
                      {word}{' '}
                    </span>
                  ))}
                  <span className="aya-mark">{ayaMark(vv.aya)}</span>
                </p>
                {(hintFr && i <= v) || (data.settings.translation && i < v) ? (
                  <p className="fr-tr" lang="fr">{text.fr[p.sura - 1][vv.aya - 1]}</p>
                ) : null}
                {graded && i < v && (st === 'memorized' || st === 'weak') && (
                  <button className={`chip small ${st === 'weak' ? 'weak on' : ''}`} onClick={() => toggleWeak(vv.aya)}>
                    {st === 'weak' ? '⚑ À revoir' : '⚐ Marquer à revoir'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {done && (
        <div className="grade-bar">
          {graded && card ? (
            <>
              <span>Comment s'est passée la récitation ?</span>
              {([0, 1, 2, 3] as Grade[]).map((g) => (
                <button key={g} className={`grade g${g}`} onClick={() => onDone(g)}>
                  <strong>{GRADE_LABELS[g]}</strong>
                  <span className="small">{fmtInterval(nextInterval(card, g))} <kbd>{g + 1}</kbd></span>
                </button>
              ))}
            </>
          ) : (
            <button className="primary" onClick={() => onDone(null)}>Terminer <kbd>N</kbd></button>
          )}
        </div>
      )}
    </div>
  );
}
