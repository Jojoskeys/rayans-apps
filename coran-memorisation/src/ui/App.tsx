import { useCallback, useEffect, useRef, useState } from 'react';
import { parseTanzil, TOTAL_VERSES } from '../core/quran.ts';
import { emptyData, normalizeData, type HifzData } from '../core/store.ts';
import { todayISO } from '../core/dates.ts';
import { api } from './api.ts';
import { Ctx, type QuranText, type View } from './context.tsx';
import { PlayerBar } from './PlayerBar.tsx';
import { TodayView } from './views/Today.tsx';
import { SurahList } from './views/SurahList.tsx';
import { SurahView } from './views/SurahView.tsx';
import { ReviewView } from './views/Review.tsx';
import { ProgressView } from './views/Progress.tsx';
import { SettingsView } from './views/Settings.tsx';
import { dueQueue } from '../core/store.ts';
import { demoData } from './demo.ts';

async function loadText(): Promise<QuranText> {
  const get = async (f: string) => {
    const r = await fetch(`hifz://app/data/${f}`);
    if (!r.ok) throw new Error(`${f} introuvable`);
    return r.text();
  };
  const [ar, fr] = await Promise.all([get('quran-uthmani.txt'), get('fr.hamidullah.txt')]);
  return { ar: parseTanzil(ar), fr: parseTanzil(fr) };
}

const NAV: Array<{ name: View['name']; label: string; icon: string }> = [
  { name: 'today', label: "Aujourd'hui", icon: '☀' },
  { name: 'surahs', label: 'Sourates', icon: '☰' },
  { name: 'review', label: 'Révision', icon: '↻' },
  { name: 'progress', label: 'Progression', icon: '▦' },
  { name: 'settings', label: 'Réglages', icon: '⚙' },
];

export function App() {
  const [text, setText] = useState<QuranText | null>(null);
  const [data, setData] = useState<HifzData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ name: 'today' });
  const [today, setToday] = useState(todayISO());
  const saveTimer = useRef<number | undefined>(undefined);
  const latest = useRef<HifzData | null>(null);

  useEffect(() => {
    Promise.all([loadText(), api().loadData()])
      .then(([t, raw]) => {
        setText(t);
        setData(raw ? normalizeData(raw) : emptyData());
      })
      .catch((e) => setError(String(e?.message ?? e)));
    const tick = window.setInterval(() => setToday(todayISO()), 60_000);
    return () => window.clearInterval(tick);
  }, []);

  const flush = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = undefined;
    if (latest.current) api().saveData(JSON.stringify(latest.current)).catch((e) => setError(`Sauvegarde impossible : ${e.message}`));
  }, []);

  useEffect(() => {
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [flush]);

  const update = useCallback(
    (fn: (d: HifzData) => HifzData) => {
      setData((d) => {
        if (!d) return d;
        const next = fn(d);
        if (next !== d) {
          latest.current = next;
          window.clearTimeout(saveTimer.current);
          saveTimer.current = window.setTimeout(flush, 400);
        }
        return next;
      });
    },
    [flush],
  );

  // Thème et taille du texte arabe
  useEffect(() => {
    if (!data) return;
    const root = document.documentElement;
    root.style.setProperty('--ar-size', `${data.settings.arabicSize}px`);
    if (data.settings.theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', data.settings.theme);
  }, [data?.settings.arabicSize, data?.settings.theme]);

  // Test de lancement : vérifie le texte, la police et le sens d'écriture, puis rend compte au processus principal.
  useEffect(() => {
    if (!text || !data) return;
    (async () => {
      const info = await api().info();
      if (!info.test) return;
      if (info.demo) {
        update(() => demoData(today));
        api().onSmokeGo((v) => {
          if (v === 'reveal') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
          else setView(v as View);
        });
      }
      await document.fonts.load('32px "Amiri Quran"', 'بِسْمِ');
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 300)));
      const ar = document.querySelector('.ar');
      const verses = text.ar.flat().length;
      const translation = text.fr.flat().length;
      const font = document.fonts.check('32px "Amiri Quran"', 'بِسْمِ');
      const rtl = !!ar && getComputedStyle(ar).direction === 'rtl';
      let audio = false;
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 20000);
        const r = await fetch('hifz://audio/001001.mp3', { signal: ctl.signal });
        clearTimeout(t);
        audio = r.ok && (await r.arrayBuffer()).byteLength > 1000;
      } catch {
        audio = false;
      }
      api().smokeReport({ ok: verses === TOTAL_VERSES && translation === TOTAL_VERSES && font && rtl, verses, translation, font, rtl, audio });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, data !== null]);

  if (error) return <div className="fatal">Erreur : {error}</div>;
  if (!text || !data) return <div className="loading">Chargement du Coran…</div>;

  const dueCount = Math.min(dueQueue(data, today).length, data.settings.dailyLimit);
  const active = view.name === 'surah' ? 'surahs' : view.name;

  return (
    <Ctx.Provider value={{ text, data, today, update, go: setView }}>
      <div className="shell">
        <nav className="side">
          <div className="brand">
            <span className="brand-ar ar" lang="ar" dir="rtl">حفظ</span>
            <span>Rayan's Hifz</span>
          </div>
          {NAV.map((n) => (
            <button
              key={n.name}
              className={`nav ${active === n.name ? 'on' : ''}`}
              onClick={() => setView(n.name === 'review' ? { name: 'review', mode: 'due' } : ({ name: n.name } as View))}
            >
              <span className="nav-ico" aria-hidden>{n.icon}</span>
              {n.label}
              {n.name === 'review' && dueCount > 0 && <span className="badge">{dueCount}</span>}
            </button>
          ))}
        </nav>
        <main className="main">
          {view.name === 'today' && <TodayView />}
          {view.name === 'surahs' && <SurahList />}
          {view.name === 'surah' && <SurahView key={view.sura} sura={view.sura} focus={view.focus} />}
          {view.name === 'review' && <ReviewView key={JSON.stringify(view)} view={view} />}
          {view.name === 'progress' && <ProgressView />}
          {view.name === 'settings' && <SettingsView />}
        </main>
        <PlayerBar />
      </div>
    </Ctx.Provider>
  );
}
