import { useState } from "react";
import { api, errorText, type Config, type Theme } from "./api";

/** Thèmes du jeton {theme} : nom du sous-dossier et mots-clés cherchés dans le nom du fichier. */
export function ThemesSection(p: { draft: Config; setDraft: (c: Config) => void }) {
  const { draft, setDraft } = p;
  const [error, setError] = useState<string | null>(null);
  const setThemes = (themes: Theme[]) => setDraft({ ...draft, themes });
  const update = (i: number, patch: Partial<Theme>) => setThemes(draft.themes.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const move = (i: number, d: -1 | 1) => {
    const t = [...draft.themes];
    const j = i + d;
    if (j < 0 || j >= t.length) return;
    [t[i], t[j]] = [t[j], t[i]];
    setThemes(t);
  };
  const reset = async () => {
    try {
      setThemes(await api.themesByDefault());
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <div className="themes">
      <header className="page-head">
        <div>
          <h2>Thèmes</h2>
          <p className="muted">
            Une destination qui contient <code>{"{theme}"}</code> (ex. <code>{"Documents/PDF/{theme}"}</code>) range chaque
            fichier dans le sous-dossier de son thème. Le thème est trouvé grâce aux mots-clés dans le nom du fichier,
            sans tenir compte des accents ni des majuscules. Sans mot-clé reconnu : dossier « Autres ». Tout se fait
            sur votre PC.
          </p>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={reset}>Thèmes par défaut</button>
          <button className="btn primary" onClick={() => setThemes([...draft.themes, { name: "Nouveau thème", keywords: [] }])}>
            Ajouter un thème
          </button>
        </div>
      </header>
      {error && <div className="alert bad">{error}</div>}
      <label className="check card">
        <input type="checkbox" checked={draft.readPdfText} onChange={(e) => setDraft({ ...draft, readPdfText: e.target.checked })} />
        <span>
          Si le nom d’un PDF ne suffit pas, lire le texte de sa première page
          <span className="muted small" style={{ display: "block" }}>
            Plus précis, un peu plus lent. Sans effet sur les PDF scannés en image (ils n’ont pas de texte).
          </span>
        </span>
      </label>
      <p className="muted small">Si plusieurs thèmes correspondent, celui qui a le plus de mots-clés trouvés l’emporte, puis le plus haut dans la liste.</p>
      <div className="theme-list">
        {draft.themes.map((t, i) => (
          <ThemeRow
            key={i}
            theme={t}
            first={i === 0}
            last={i === draft.themes.length - 1}
            onChange={(patch) => update(i, patch)}
            onMove={(d) => move(i, d)}
            onRemove={() => setThemes(draft.themes.filter((_, j) => j !== i))}
          />
        ))}
      </div>
    </div>
  );
}

function ThemeRow(p: {
  theme: Theme;
  first: boolean;
  last: boolean;
  onChange: (patch: Partial<Theme>) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [words, setWords] = useState(p.theme.keywords.join(", "));
  return (
    <div className="theme-row">
      <input className="theme-name" value={p.theme.name} onChange={(e) => p.onChange({ name: e.target.value })} aria-label="Nom du thème" />
      <input
        value={words}
        placeholder="mots-clés séparés par des virgules"
        aria-label={`Mots-clés du thème ${p.theme.name}`}
        onChange={(e) => {
          setWords(e.target.value);
          p.onChange({ keywords: e.target.value.split(/[,;]+/).map((x) => x.trim()).filter(Boolean) });
        }}
      />
      <button className="icon-btn" onClick={() => p.onMove(-1)} disabled={p.first} title="Monter">↑</button>
      <button className="icon-btn" onClick={() => p.onMove(1)} disabled={p.last} title="Descendre">↓</button>
      <button className="icon-btn" onClick={p.onRemove} title="Retirer ce thème">✕</button>
    </div>
  );
}
