import { useMemo, useState } from "react";
import { api, errorText, type ApplyReport, type Plan, type UndoReport } from "./api";
import { Confirm } from "./Confirm";
import { baseName, dirName, formatSize, plural, shortDir } from "./format";

/** Aperçu obligatoire : chaque déplacement prévu, cochable, avant toute action. */
export function PlanView(p: { plan: Plan; onApplied: (r: ApplyReport) => void; onClose: () => void }) {
  const { plan } = p;
  const [checked, setChecked] = useState<Set<number>>(() => new Set(plan.items.map((i) => i.id)));
  const [confirm, setConfirm] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);

  const groups = useMemo(() => {
    const m = new Map<string, typeof plan.items>();
    for (const it of plan.items) {
      const key = it.kind === "doublon" ? "Quarantaine des doublons" : dirName(it.destination);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(it);
    }
    return [...m.entries()];
  }, [plan]);

  const selected = plan.items.filter((i) => checked.has(i.id));
  const nbDup = selected.filter((i) => i.kind === "doublon").length;
  const nbMove = selected.length - nbDup;
  const total = selected.reduce((a, i) => a + i.size, 0);

  const toggle = (ids: number[], on: boolean) => {
    const next = new Set(checked);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    setChecked(next);
  };

  const apply = async () => {
    setConfirm(false);
    setWorking(true);
    setError(null);
    try {
      p.onApplied(await api.apply(plan.id, [...checked]));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="plan">
      <div className="plan-summary">
        <Stat value={plan.items.filter((i) => i.kind === "ranger").length} label="à ranger" />
        <Stat value={plan.items.filter((i) => i.kind === "doublon").length} label="doublons" />
        <Stat value={plan.skipped.length} label="laissés en place" />
        <Stat value={plan.scanned} label="fichiers examinés" />
      </div>

      {plan.items.length === 0 ? (
        <div className="empty small-empty">
          <h2>Rien à ranger</h2>
          <p className="muted">Aucun fichier ne correspond à vos règles pour l’instant.</p>
        </div>
      ) : (
        <>
          <div className="row toolbar">
            <button className="btn ghost small" onClick={() => toggle(plan.items.map((i) => i.id), true)}>Tout cocher</button>
            <button className="btn ghost small" onClick={() => toggle(plan.items.map((i) => i.id), false)}>Tout décocher</button>
            <span className="muted small" style={{ marginLeft: "auto" }}>
              {plural(selected.length, "fichier coché", "fichiers cochés")} · {formatSize(total)}
            </span>
          </div>
          <div className="groups">
            {groups.map(([dest, items]) => {
              const all = items.every((i) => checked.has(i.id));
              return (
                <div className="group" key={dest}>
                  <label className="group-head">
                    <input type="checkbox" checked={all} onChange={(e) => toggle(items.map((i) => i.id), e.target.checked)} />
                    <span className="arrow">→</span>
                    <span className="group-dest" title={dest}>{dest}</span>
                    <span className="muted small">{items.length}</span>
                  </label>
                  {items.map((it) => (
                    <label className={"item" + (checked.has(it.id) ? "" : " unchecked")} key={it.id}>
                      <input type="checkbox" checked={checked.has(it.id)} onChange={(e) => toggle([it.id], e.target.checked)} />
                      <div className="item-main">
                        <div className="item-name">
                          {baseName(it.source)}
                          {it.theme && (
                            <span className={"tag" + (it.theme === "Autres" ? "" : " theme")} title={it.themeReason ?? ""}>
                              thème : {it.theme}
                            </span>
                          )}
                          {it.renamed && (
                            <span className="tag warn" title="Un fichier du même nom existe déjà : rien n’est écrasé">
                              renommé en « {baseName(it.destination)} »
                            </span>
                          )}
                        </div>
                        <div className="muted small" title={it.source}>
                          depuis {shortDir(dirName(it.source))} · {it.reason}
                          {it.themeReason && <> · {it.themeReason}</>}
                        </div>
                      </div>
                      <span className="muted small size">{formatSize(it.size)}</span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      {plan.skipped.length > 0 && (
        <div className="skipped">
          <button className="link" onClick={() => setShowSkipped(!showSkipped)}>
            {showSkipped ? "▾" : "▸"} {plural(plan.skipped.length, "fichier laissé", "fichiers laissés")} en place
          </button>
          {showSkipped && (
            <ul>
              {plan.skipped.map((s) => (
                <li key={s.path}>
                  <span title={s.path}>{baseName(s.path)}</span> <span className="muted small">— {s.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <div className="alert bad">{error}</div>}

      <div className="actions">
        <button className="btn ghost" onClick={p.onClose} disabled={working}>Fermer l’aperçu</button>
        {plan.items.length > 0 && (
          <button className="btn primary big" disabled={selected.length === 0 || working} onClick={() => setConfirm(true)}>
            {working ? "Rangement…" : `Ranger ${plural(selected.length, "fichier")}`}
          </button>
        )}
      </div>

      {confirm && (
        <Confirm
          title="Valider le rangement ?"
          confirmLabel="Ranger maintenant"
          onCancel={() => setConfirm(false)}
          onConfirm={apply}
        >
          <p>
            {nbMove > 0 && <>{plural(nbMove, "fichier sera rangé", "fichiers seront rangés")}. </>}
            {nbDup > 0 && <>{plural(nbDup, "doublon ira", "doublons iront")} en quarantaine. </>}
          </p>
          <p className="muted">
            Rien n’est supprimé ni écrasé. Chaque fichier est revérifié juste avant d’être déplacé, et le rangement
            pourra être annulé depuis l’Historique.
          </p>
        </Confirm>
      )}
    </div>
  );
}

/** Résultat d'un rangement, avec annulation immédiate possible. */
export function ReportView(p: { report: ApplyReport; onClose: () => void; onHistory: () => void }) {
  const { report } = p;
  const [undone, setUndone] = useState<UndoReport | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const undoAll = async () => {
    if (!report.batch) return;
    setWorking(true);
    try {
      setUndone(await api.undo(report.batch, null));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="plan">
      {undone ? (
        <div className="result good">
          <h2>Rangement annulé</h2>
          <p>{plural(undone.restored.length, "fichier remis", "fichiers remis")} à sa place d’origine.</p>
          {undone.restored.some((r) => r.renamed) && (
            <p className="muted small">Certains ont été renommés car un autre fichier avait pris leur place.</p>
          )}
          <FailedList failed={undone.failed} />
        </div>
      ) : (
        <div className={"result " + (report.failed.length ? "warn" : "good")}>
          <h2>{report.moved.length ? `${plural(report.moved.length, "fichier rangé", "fichiers rangés")}` : "Aucun fichier déplacé"}</h2>
          {report.moved.some((m) => m.renamed) && (
            <p className="muted small">Certains fichiers ont été renommés : un fichier du même nom est apparu depuis l’aperçu.</p>
          )}
          <FailedList failed={report.failed} />
        </div>
      )}
      {error && <div className="alert bad">{error}</div>}
      <div className="actions">
        <button className="btn ghost" onClick={p.onHistory}>Voir l’historique</button>
        <button className="btn ghost" onClick={p.onClose}>Fermer</button>
        {report.batch && !undone && (
          <button className="btn" onClick={undoAll} disabled={working}>
            {working ? "Annulation…" : "Annuler ce rangement"}
          </button>
        )}
      </div>
    </div>
  );
}

function FailedList(p: { failed: { id: number; path: string; reason: string }[] }) {
  if (!p.failed.length) return null;
  return (
    <div className="failed">
      <p>{plural(p.failed.length, "fichier laissé", "fichiers laissés")} en place :</p>
      <ul>
        {p.failed.map((f) => (
          <li key={f.id + f.path}>
            <span title={f.path}>{baseName(f.path)}</span> <span className="muted small">— {f.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat(p: { value: number; label: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{p.value.toLocaleString("fr-FR")}</div>
      <div className="muted small">{p.label}</div>
    </div>
  );
}
