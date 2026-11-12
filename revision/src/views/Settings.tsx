import { useState } from "react";
import { dayKey } from "../core/fsrs";
import { exportCsv, exportJson } from "../core/io";
import { DEFAULT_SETTINGS, type Settings as S } from "../core/model";
import { saveExportFile } from "../storage";
import { useApp } from "../ui";

function StepsInput({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const [text, setText] = useState(value.join(" "));
  const [bad, setBad] = useState(false);
  return (
    <input
      className={bad ? "invalid" : ""}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const parts = e.target.value.trim() === "" ? [] : e.target.value.trim().split(/[\s,;]+/).map(Number);
        const ok = parts.every((n) => Number.isFinite(n) && n > 0 && n < 1440);
        setBad(!ok);
        if (ok) onChange(parts);
      }}
    />
  );
}

export default function Settings() {
  const { db, update, toast, confirm, dataDir, startImport } = useApp();
  const s = db.settings;
  const set = (patch: Partial<S>) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

  const doExport = async (format: "csv" | "json") => {
    try {
      const day = dayKey(Date.now(), s.dayStartHour);
      const name = format === "json" ? `Rayans-Revision-sauvegarde-${day}.json` : `Rayans-Revision-cartes-${day}.csv`;
      const path = await saveExportFile(name, format === "json" ? exportJson(db) : exportCsv(db));
      if (path) toast(`Exporté : ${path}`);
    } catch (e) {
      toast(`Export impossible : ${String(e)}`, "error");
    }
  };

  const resetSettings = async () => {
    if (await confirm({ title: "Rétablir les réglages ?", message: <p>Les réglages de révision reprennent leurs valeurs par défaut. Vos cartes ne changent pas.</p>, confirmLabel: "Rétablir" })) {
      set({ ...DEFAULT_SETTINGS });
    }
  };

  return (
    <div className="page narrow">
      <header className="page-head">
        <h1>Réglages et données</h1>
      </header>

      <section className="panel">
        <h2>Révisions (algorithme FSRS)</h2>
        <label className="field">
          <span>Rétention visée : <b>{Math.round(s.retention * 100)} %</b></span>
          <input type="range" min={0.8} max={0.97} step={0.01} value={s.retention} onChange={(e) => set({ retention: Number(e.target.value) })} />
          <span className="hint">
            Probabilité de vous souvenir d'une carte au moment où elle revient. Plus haut = plus de révisions chaque jour ;
            90 % est un bon équilibre.
          </span>
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Révisions maximum par jour</span>
            <input type="number" min={1} max={9999} value={s.maxReviewsPerDay} onChange={(e) => set({ maxReviewsPerDay: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
          </label>
          <label className="field">
            <span>Intervalle maximum (jours)</span>
            <input type="number" min={1} max={36500} value={s.maxInterval} onChange={(e) => set({ maxInterval: Math.max(1, Math.min(36500, Math.floor(Number(e.target.value) || 1))) })} />
          </label>
          <label className="field">
            <span>Étapes d'apprentissage (minutes)</span>
            <StepsInput value={s.learningSteps} onChange={(v) => set({ learningSteps: v })} />
            <span className="hint">Nouvelles cartes : revues après 1 puis 10 min par défaut.</span>
          </label>
          <label className="field">
            <span>Étapes après un oubli (minutes)</span>
            <StepsInput value={s.relearningSteps} onChange={(v) => set({ relearningSteps: v })} />
          </label>
          <label className="field">
            <span>Début d'une nouvelle journée</span>
            <select value={s.dayStartHour} onChange={(e) => set({ dayStartHour: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h} h</option>)}
            </select>
            <span className="hint">Réviser à 1 h du matin compte encore pour la veille (série, limites quotidiennes).</span>
          </label>
        </div>
        <p className="hint">Le nombre de nouvelles cartes par jour et le mode de réponse se règlent dans chaque paquet.</p>
        <button className="btn small" onClick={resetSettings}>Rétablir les valeurs par défaut</button>
      </section>

      <section className="panel">
        <h2>Importer</h2>
        <p>
          Fichiers <b>CSV</b> ou texte (séparateur « ; », « , » ou tabulation) et <b>JSON</b>. Le format de quiz-revision
          (<code>question;réponse</code> sur chaque ligne) est reconnu tel quel.
        </p>
        <details>
          <summary>Format CSV complet</summary>
          <p>Première ligne (en-tête) puis une carte par ligne :</p>
          <pre>{`type;question;reponse;choix;explication;paquet
qr;Quel mot-clé Java crée un objet ?;new;;;Java
qcm;2 + 2 ?;4;3 | 4 | 5;;Maths
trous;La {{Loire}} est le plus long fleuve de {{France::pays}}.;;;;Géographie`}</pre>
          <ul>
            <li><code>type</code> : <code>qr</code> (question/réponse), <code>qcm</code> ou <code>trous</code> ; deviné s'il est absent.</li>
            <li><code>reponse</code> : plusieurs réponses acceptées séparées par « | ».</li>
            <li><code>choix</code> (QCM) : propositions séparées par « | » ; la bonne réponse est ajoutée si elle manque.</li>
            <li><code>paquet</code> : facultatif ; le paquet est créé s'il n'existe pas.</li>
          </ul>
        </details>
        <button className="btn primary" onClick={() => startImport()}>Importer un fichier…</button>
      </section>

      <section className="panel">
        <h2>Exporter et sauvegarder</h2>
        <div className="row wrap">
          <button className="btn" onClick={() => doExport("json")}>Sauvegarde complète (JSON)</button>
          <button className="btn" onClick={() => doExport("csv")}>Toutes les cartes (CSV)</button>
        </div>
        <p className="hint">
          La sauvegarde JSON contient tout (paquets, cartes, progression, historique, réglages) : importez-la pour tout
          restaurer, sur ce PC ou un autre. Le CSV s'ouvre dans Excel mais ne garde pas la progression.
        </p>
        <p className="hint">
          Vos données restent sur ce PC, enregistrées automatiquement dans <code>{dataDir}</code> (fichier
          <code> revision.json</code>, version précédente dans <code>revision.bak.json</code> et une copie par jour dans
          <code> sauvegardes</code>, 14 derniers jours).
        </p>
      </section>
    </div>
  );
}
