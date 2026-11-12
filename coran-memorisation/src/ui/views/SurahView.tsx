import { useEffect, useMemo, useRef, useState } from 'react';
import { SURAHS, audioFileName, juzOf, hizbOf, pageOf, isSajda, splitBasmala, verseKey, portionOf } from '../../core/quran.ts';
import { STATUS_LABELS, setVerseStatus, surahCounts, type VerseStatus } from '../../core/store.ts';
import { relativeDayFr } from '../../core/dates.ts';
import { api, type AudioProgress } from '../api.ts';
import { isCurrent, playTracks, surahTracks, usePlayer } from '../audio.ts';
import { ayaMark, useApp } from '../context.tsx';

const CHOICES: Array<VerseStatus | null> = [null, 'learning', 'memorized', 'weak'];
const cls = (s: VerseStatus | null | undefined) => s ?? 'none';

export function SurahView({ sura, focus }: { sura: number; focus?: number }) {
  const { text, data, today, update, go } = useApp();
  const s = SURAHS[sura - 1];
  const player = usePlayer();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [anchor, setAnchor] = useState<number | null>(null);
  const [cached, setCached] = useState<number | null>(null);
  const [dl, setDl] = useState<AudioProgress | null>(null);
  const [showFr, setShowFr] = useState(data.settings.translation);
  const listRef = useRef<HTMLDivElement>(null);
  const c = surahCounts(data, sura);
  const names = useMemo(() => {
    const n = Array.from({ length: s.ayas }, (_, i) => audioFileName(sura, i + 1));
    if (sura !== 1 && sura !== 9) n.push(audioFileName(1, 1));
    return n;
  }, [sura, s.ayas]);

  const refreshCache = () => api().cachedAudio(names).then((l) => setCached(l.length));
  useEffect(() => {
    refreshCache();
  }, [names, player.current]);

  useEffect(() => {
    if (focus) listRef.current?.querySelector(`[data-aya="${focus}"]`)?.scrollIntoView({ block: 'center' });
  }, [focus]);

  // Suivre le verset en cours de lecture
  useEffect(() => {
    if (player.current?.sura === sura && !player.current.basmala) {
      listRef.current?.querySelector(`[data-aya="${player.current.aya}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [player.current, sura]);

  const setStatus = (ayas: number[], st: VerseStatus | null) =>
    update((d) => setVerseStatus(d, ayas.map((a) => verseKey(sura, a)), st, today));

  const clickSelect = (aya: number, shift: boolean) => {
    const next = new Set(selected);
    if (shift && anchor !== null) {
      const [a, b] = anchor < aya ? [anchor, aya] : [aya, anchor];
      for (let i = a; i <= b; i++) next.add(i);
    } else if (next.has(aya)) next.delete(aya);
    else next.add(aya);
    setAnchor(aya);
    setSelected(next);
  };

  const download = async () => {
    const off = api().onAudioProgress(setDl);
    try {
      // Les fichiers déjà en cache sont sautés par le processus principal.
      const r = await api().downloadAudio(names);
      if (r.failed > 0) alert(`${r.failed} fichier(s) audio n'ont pas pu être téléchargés. Vérifie la connexion Internet et réessaie.`);
    } finally {
      off();
      setDl(null);
      refreshCache();
    }
  };

  const sel = [...selected].sort((a, b) => a - b);
  const known = c.memorized + c.weak;

  return (
    <div className="page surah-page">
      <button className="link back" onClick={() => go({ name: 'surahs' })}>← Toutes les sourates</button>
      <header className="surah-head">
        <div>
          <h1>
            {s.number}. {s.nameFr} <span className="muted thin">— {s.meaningFr}</span>
          </h1>
          <p className="muted">
            {s.ayas} versets · {s.revelation} · juz {juzOf(sura, 1)}
            {juzOf(sura, s.ayas) !== juzOf(sura, 1) ? `–${juzOf(sura, s.ayas)}` : ''} · page {pageOf(sura, 1)}
          </p>
          <p>
            <strong>{known}</strong>/{s.ayas} mémorisés
            {c.learning > 0 && <> · {c.learning} en cours</>}
            {c.weak > 0 && <> · <span className="weak-txt">{c.weak} à revoir</span></>}
          </p>
        </div>
        <div className="ar surah-title" lang="ar" dir="rtl">سورة {s.nameAr}</div>
      </header>

      <div className="toolbar wrap">
        <button className="primary" onClick={() => playTracks(surahTracks(sura, 1, s.ayas), data.settings.repeat)}>▶ Écouter la sourate</button>
        <button onClick={download} disabled={!!dl || cached === names.length}>
          {dl ? `Téléchargement ${dl.done}/${dl.total}…` : cached === names.length ? '✓ Audio disponible hors ligne' : `Télécharger l'audio (${cached ?? '…'}/${names.length})`}
        </button>
        <button onClick={() => go({ name: 'review', mode: 'practice', sura, from: 1, to: s.ayas })}>S'entraîner (sans noter)</button>
        <label className="check">
          <input type="checkbox" checked={showFr} onChange={(e) => setShowFr(e.target.checked)} /> Traduction
        </label>
        <span className="spacer" />
        <span className="muted small">Toute la sourate :</span>
        {CHOICES.map((st) => (
          <button key={cls(st)} className={`chip ${cls(st)}`} onClick={() => setStatus(Array.from({ length: s.ayas }, (_, i) => i + 1), st)}>
            {STATUS_LABELS[cls(st)]}
          </button>
        ))}
      </div>

      {sel.length > 0 && (
        <div className="selbar">
          <span>
            {sel.length} verset{sel.length > 1 ? 's' : ''} sélectionné{sel.length > 1 ? 's' : ''}
          </span>
          {CHOICES.map((st) => (
            <button key={cls(st)} className={`chip ${cls(st)}`} onClick={() => { setStatus(sel, st); setSelected(new Set()); }}>
              {STATUS_LABELS[cls(st)]}
            </button>
          ))}
          <button onClick={() => playTracks(sel.flatMap((a) => surahTracks(sura, a, a).filter((t) => !t.basmala)), data.settings.repeat)}>▶ Écouter</button>
          <button onClick={() => go({ name: 'review', mode: 'practice', sura, from: sel[0], to: sel[sel.length - 1] })}>S'entraîner</button>
          <button className="link" onClick={() => setSelected(new Set())}>Annuler</button>
          <span className="muted small">Maj + clic pour sélectionner une plage</span>
        </div>
      )}

      <div className="verses" ref={listRef}>
        {text.ar[sura - 1].map((raw, i) => {
          const aya = i + 1;
          const { basmala, text: ar } = splitBasmala(sura, aya, raw);
          const st = data.verses[verseKey(sura, aya)];
          const p = portionOf(sura, aya);
          const card = data.cards[p.id];
          const firstOfPortion = p.from === aya && (p.from !== 1 || p.to !== s.ayas);
          return (
            <div key={aya}>
              {basmala && <div className="basmala ar" lang="ar" dir="rtl">{basmala}</div>}
              {firstOfPortion && aya > 1 && <div className="quarter">Quart de hizb · hizb {hizbOf(sura, aya)} · juz {juzOf(sura, aya)}</div>}
              <div className={`verse st-${cls(st)} ${isCurrent(player, sura, aya) ? 'playing' : ''} ${selected.has(aya) ? 'sel' : ''}`} data-aya={aya}>
                <div className="verse-side">
                  <button className="vnum" title="Sélectionner (Maj + clic : plage)" onClick={(e) => clickSelect(aya, e.shiftKey)}>
                    {aya}
                  </button>
                  <button className="icon-btn" title="Écouter ce verset" onClick={() => playTracks([{ sura, aya }], data.settings.repeat)}>▶</button>
                </div>
                <div className="verse-body">
                  <p className="ar verse-ar" lang="ar" dir="rtl">
                    {ar} <span className="aya-mark">{ayaMark(aya)}</span>
                    {isSajda(sura, aya) && <span className="sajda" title="Prosternation"> ۩</span>}
                  </p>
                  {showFr && <p className="fr-tr" lang="fr">{text.fr[sura - 1][i]}</p>}
                  <div className="verse-status">
                    {CHOICES.map((c2) => (
                      <button key={cls(c2)} className={`chip small ${cls(c2)} ${cls(st) === cls(c2) ? 'on' : ''}`} onClick={() => setStatus([aya], c2)}>
                        {STATUS_LABELS[cls(c2)]}
                      </button>
                    ))}
                    {card && p.from === aya && (
                      <span className="muted small">
                        Révision de la portion {p.from}–{p.to} : {relativeDayFr(card.due, today)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
