import { useEffect, useState } from 'react';
import { normalizeData, type Settings } from '../../core/store.ts';
import { api } from '../api.ts';
import { ayaMark, useApp } from '../context.tsx';
import { splitBasmala } from '../../core/quran.ts';

const mb = (b: number) => `${(b / 1048576).toFixed(1).replace('.', ',')} Mo`;

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} onClick={(e) => { e.preventDefault(); api().openLink(href); }}>
      {children}
    </a>
  );
}

export function SettingsView() {
  const { data, text, update } = useApp();
  const [audio, setAudio] = useState<{ files: number; bytes: number } | null>(null);
  const [info, setInfo] = useState<{ version: string; dataFile: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const s = data.settings;
  const set = (patch: Partial<Settings>) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

  useEffect(() => {
    api().audioInfo().then(setAudio);
    api().info().then(setInfo);
  }, []);

  return (
    <div className="page settings">
      <h1>Réglages</h1>

      <section>
        <h2>Lecture</h2>
        <label className="row">
          <span>Traduction française affichée par défaut</span>
          <input type="checkbox" checked={s.translation} onChange={(e) => set({ translation: e.target.checked })} />
        </label>
        <label className="row">
          <span>Taille du texte arabe ({s.arabicSize} px)</span>
          <input type="range" min={20} max={64} value={s.arabicSize} onChange={(e) => set({ arabicSize: Number(e.target.value) })} />
        </label>
        <p className="ar preview" lang="ar" dir="rtl">
          {splitBasmala(93, 1, text.ar[92][0]).text} <span className="aya-mark">{ayaMark(1)}</span> {text.ar[92][1]}{' '}
          <span className="aya-mark">{ayaMark(2)}</span>
        </p>
        <label className="row">
          <span>Thème</span>
          <select value={s.theme} onChange={(e) => set({ theme: e.target.value as Settings['theme'] })}>
            <option value="auto">Comme Windows</option>
            <option value="light">Clair</option>
            <option value="dark">Sombre</option>
          </select>
        </label>
      </section>

      <section>
        <h2>Révision et audio</h2>
        <label className="row">
          <span>Portions à réviser par jour (au plus)</span>
          <input type="number" min={1} max={100} value={s.dailyLimit} onChange={(e) => set({ dailyLimit: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })} />
        </label>
        <label className="row">
          <span>Répéter chaque verset à l'écoute</span>
          <select value={s.repeat} onChange={(e) => set({ repeat: Number(e.target.value) })}>
            {[1, 2, 3, 5, 7, 10, 20].map((n) => <option key={n} value={n}>{n === 1 ? '1 fois' : `${n} fois`}</option>)}
          </select>
        </label>
        <div className="row">
          <span>
            Audio gardé sur ce PC : {audio ? `${audio.files} verset(s), ${mb(audio.bytes)}` : '…'}
            <br />
            <span className="muted small">Récitation de Mahmoud Khalil Al-Husary (murattal), lue depuis everyayah.com puis gardée pour l'écoute hors ligne.</span>
          </span>
          <button disabled={!audio?.files} onClick={async () => { if (confirm("Supprimer l'audio gardé sur ce PC ? Il sera retéléchargé à la prochaine écoute.")) { await api().clearAudio(); setAudio(await api().audioInfo()); } }}>
            Vider le cache audio
          </button>
        </div>
      </section>

      <section>
        <h2>Mes données</h2>
        <p className="muted small">Tout est enregistré sur ce PC{info ? ` : ${info.dataFile}` : ''}.</p>
        <div className="toolbar">
          <button onClick={async () => { if (await api().exportData(JSON.stringify(data, null, 1))) setMsg('Progression exportée.'); }}>Exporter ma progression…</button>
          <button
            onClick={async () => {
              try {
                const raw = await api().importData();
                if (!raw) return;
                const next = normalizeData(raw);
                const n = Object.keys(next.verses).length;
                if (confirm(`Remplacer la progression actuelle par celle importée (${n} verset(s) suivis) ?`)) {
                  update(() => next);
                  setMsg('Progression importée.');
                }
              } catch (e) {
                setMsg(`Import impossible : ${(e as Error).message}`);
              }
            }}
          >
            Importer…
          </button>
          <button onClick={() => api().openDataFolder()}>Ouvrir le dossier</button>
        </div>
        {msg && <p className="ok">{msg}</p>}
      </section>

      <section className="about">
        <h2>À propos et licences</h2>
        <p>Rayan's Hifz {info?.version ?? ''} — suivi de mémorisation du Coran.</p>
        <ul>
          <li>
            Texte coranique : <strong>Tanzil Quran Text (Uthmani, v1.1)</strong>, © Tanzil Project, licence Creative Commons BY 3.0, copie conforme non modifiée.{' '}
            Source : <Link href="https://tanzil.net/">tanzil.net</Link> (mises à jour : <Link href="https://tanzil.net/updates/">tanzil.net/updates</Link>).
          </li>
          <li>
            Traduction française : <strong>Muhammad Hamidullah</strong>, fournie par <Link href="https://tanzil.net/trans/">Tanzil</Link> — usage non commercial uniquement.
          </li>
          <li>Métadonnées (juz, hizb, pages) : Tanzil Quran Metadata 1.0, CC BY 3.0.</li>
          <li>
            Police : <strong>Amiri Quran</strong> 1.003 par Khaled Hosny, <Link href="https://github.com/aliftype/amiri">github.com/aliftype/amiri</Link>, SIL Open Font License 1.1.
          </li>
          <li>
            Audio (non inclus, téléchargé à la demande) : Mahmoud Khalil Al-Husary, via <Link href="https://everyayah.com/">everyayah.com</Link>.
          </li>
        </ul>
        <p className="muted small">Le détail complet est dans le fichier LICENCES.txt à côté de l'application.</p>
      </section>
    </div>
  );
}
