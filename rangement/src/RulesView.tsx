import { useState } from "react";
import { api, errorText, type Config, type Rule } from "./api";
import { baseName, MB } from "./format";

function newId() {
  return "r" + Math.random().toString(36).slice(2, 9);
}

export function RulesView(p: { draft: Config; setDraft: (c: Config) => void }) {
  const { draft, setDraft } = p;
  const [error, setError] = useState<string | null>(null);
  const setRules = (rules: Rule[]) => setDraft({ ...draft, rules });
  const update = (i: number, patch: Partial<Rule>) => setRules(draft.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => {
    const r = [...draft.rules];
    const j = i + d;
    if (j < 0 || j >= r.length) return;
    [r[i], r[j]] = [r[j], r[i]];
    setRules(r);
  };
  const add = () =>
    setRules([
      ...draft.rules,
      {
        id: newId(),
        name: "Nouvelle règle",
        enabled: true,
        extensions: [],
        namePattern: "",
        olderThanDays: null,
        minSize: null,
        maxSize: null,
        folders: [],
        target: "",
      },
    ]);
  const reset = async () => {
    try {
      setRules(await api.rulesByDefault());
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Règles</h1>
          <p className="muted">
            Dans l’ordre : la première règle qui correspond à un fichier l’emporte. Toutes les conditions remplies
            d’une règle doivent être vraies. Destination relative = sous-dossier du dossier surveillé.
          </p>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={reset}>Règles par défaut</button>
          <button className="btn primary" onClick={add}>Ajouter une règle</button>
        </div>
      </header>
      {error && <div className="alert bad">{error}</div>}
      <div className="rules">
        {draft.rules.map((r, i) => (
          <RuleCard
            key={r.id || i}
            rule={r}
            watched={draft.watched}
            first={i === 0}
            last={i === draft.rules.length - 1}
            onChange={(patch) => update(i, patch)}
            onMove={(d) => move(i, d)}
            onRemove={() => setRules(draft.rules.filter((_, j) => j !== i))}
          />
        ))}
        {draft.rules.length === 0 && <div className="empty small-empty">Aucune règle : seuls les doublons seront proposés.</div>}
      </div>
    </section>
  );
}

function numOrNull(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function RuleCard(p: {
  rule: Rule;
  watched: string[];
  first: boolean;
  last: boolean;
  onChange: (patch: Partial<Rule>) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}) {
  const r = p.rule;
  const [exts, setExts] = useState(r.extensions.join(", "));
  const [minMb, setMinMb] = useState(r.minSize != null ? String(+(r.minSize / MB).toFixed(2)) : "");
  const [maxMb, setMaxMb] = useState(r.maxSize != null ? String(+(r.maxSize / MB).toFixed(2)) : "");
  const [open, setOpen] = useState(false);

  const browse = async () => {
    const d = await api.pickFolder("Dossier de destination");
    if (d) p.onChange({ target: d });
  };

  const toggleFolder = (f: string, on: boolean) => {
    const set = new Set(p.rule.folders);
    if (on) set.add(f);
    else set.delete(f);
    p.onChange({ folders: [...set] });
  };

  const summary = [
    r.extensions.length ? r.extensions.map((e) => "." + e).join(" ") : null,
    r.namePattern ? `nom « ${r.namePattern} »` : null,
    r.olderThanDays != null ? `plus de ${r.olderThanDays} j` : null,
    r.minSize != null ? `≥ ${+(r.minSize / MB).toFixed(2)} Mo` : null,
    r.maxSize != null ? `≤ ${+(r.maxSize / MB).toFixed(2)} Mo` : null,
  ].filter(Boolean);

  return (
    <div className={"rule" + (r.enabled ? "" : " disabled")}>
      <div className="rule-head">
        <label className="switch" title={r.enabled ? "Désactiver" : "Activer"}>
          <input type="checkbox" checked={r.enabled} onChange={(e) => p.onChange({ enabled: e.target.checked })} />
          <span />
        </label>
        <input className="rule-name" value={r.name} onChange={(e) => p.onChange({ name: e.target.value })} aria-label="Nom de la règle" />
        <span className="arrow">→</span>
        <span className="rule-target" title={r.target}>{r.target || <em className="bad">pas de destination</em>}</span>
        <div className="row" style={{ marginLeft: "auto" }}>
          <button className="icon-btn" onClick={() => p.onMove(-1)} disabled={p.first} title="Monter">↑</button>
          <button className="icon-btn" onClick={() => p.onMove(1)} disabled={p.last} title="Descendre">↓</button>
          <button className="btn ghost small" onClick={() => setOpen(!open)}>{open ? "Replier" : "Modifier"}</button>
        </div>
      </div>
      {!open && <div className="rule-summary muted small">{summary.length ? summary.join(" · ") : "aucune condition"}{r.folders.length ? ` · seulement dans ${r.folders.map(baseName).join(", ")}` : ""}</div>}
      {open && (
        <div className="rule-body">
          <Field label="Extensions" hint="séparées par des virgules, ex. pdf, docx">
            <input
              value={exts}
              onChange={(e) => {
                setExts(e.target.value);
                p.onChange({ extensions: e.target.value.split(/[,;\s]+/).map((x) => x.trim().replace(/^\./, "").toLowerCase()).filter(Boolean) });
              }}
            />
          </Field>
          <Field label="Nom du fichier" hint="* = n’importe quoi, ? = un caractère ; plusieurs modèles séparés par ;">
            <input value={r.namePattern} placeholder="ex. facture*; *capture*" onChange={(e) => p.onChange({ namePattern: e.target.value })} />
          </Field>
          <div className="grid3">
            <Field label="Plus vieux que (jours)">
              <input inputMode="numeric" value={r.olderThanDays ?? ""} onChange={(e) => { const n = numOrNull(e.target.value); p.onChange({ olderThanDays: n == null ? null : Math.floor(n) }); }} />
            </Field>
            <Field label="Taille min. (Mo)">
              <input inputMode="decimal" value={minMb} onChange={(e) => { setMinMb(e.target.value); const n = numOrNull(e.target.value); p.onChange({ minSize: n == null ? null : Math.round(n * MB) }); }} />
            </Field>
            <Field label="Taille max. (Mo)">
              <input inputMode="decimal" value={maxMb} onChange={(e) => { setMaxMb(e.target.value); const n = numOrNull(e.target.value); p.onChange({ maxSize: n == null ? null : Math.round(n * MB) }); }} />
            </Field>
          </div>
          <Field label="Destination" hint="relative (« Images », « Factures\{annee} ») ou dossier complet ; jetons {annee} et {mois}">
            <div className="row">
              <input value={r.target} onChange={(e) => p.onChange({ target: e.target.value })} />
              <button className="btn ghost" onClick={browse}>Parcourir…</button>
            </div>
          </Field>
          {p.watched.length > 1 && (
            <Field label="S’applique à" hint="aucune case cochée = tous les dossiers surveillés">
              <div className="row wrap">
                {p.watched.map((f) => (
                  <label className="chip" key={f} title={f}>
                    <input type="checkbox" checked={r.folders.some((x) => x.toLowerCase() === f.toLowerCase())} onChange={(e) => toggleFolder(f, e.target.checked)} />
                    {baseName(f)}
                  </label>
                ))}
              </div>
            </Field>
          )}
          <div className="row">
            <button className="btn danger small" onClick={p.onRemove}>Retirer cette règle</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Field(p: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <div className="field-label">{p.label}</div>
      {p.children}
      {p.hint && <div className="muted small">{p.hint}</div>}
    </div>
  );
}
