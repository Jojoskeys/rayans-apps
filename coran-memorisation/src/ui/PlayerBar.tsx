import { SURAHS } from '../core/quran.ts';
import { stop, togglePause, usePlayer } from './audio.ts';
import { useApp } from './context.tsx';

export function PlayerBar() {
  const p = usePlayer();
  const { data, go } = useApp();
  if (!p.current && !p.error) return null;
  const s = p.current ? SURAHS[p.current.sura - 1] : null;
  return (
    <div className="player" role="region" aria-label="Lecteur audio">
      {p.current && s && (
        <>
          <button className="icon-btn" onClick={togglePause} title={p.playing ? 'Pause' : 'Lecture'}>
            {p.playing ? '❚❚' : '▶'}
          </button>
          <button className="link" onClick={() => go({ name: 'surah', sura: s.number, focus: p.current!.aya })}>
            {s.nameFr} · {p.current.basmala ? 'basmala' : `verset ${p.current.aya}`}
          </button>
          {data.settings.repeat > 1 && !p.current.basmala && <span className="muted">répétition {p.pass}/{data.settings.repeat}</span>}
          {p.loading && <span className="muted">chargement…</span>}
          <span className="muted small">Récitation : Mahmoud Khalil Al-Husary</span>
        </>
      )}
      {p.error && <span className="err">{p.error}</span>}
      <button className="icon-btn" onClick={stop} title="Arrêter">■</button>
    </div>
  );
}
