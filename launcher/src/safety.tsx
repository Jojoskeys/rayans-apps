// Fiche d'une application : versions (retour à la précédente, version ignorée) et sauvegardes des données.
import { useCallback, useEffect, useRef, useState } from "react";
import { api, toErrorInfo, type AppView, type BackupInfo, type ErrorInfo } from "./api";
import { ErrorBox, Icon } from "./components";
import { bytes, dateTime } from "./format";

export const REASON_LABEL: Record<BackupInfo["reason"], string> = {
  manual: "Manuelle",
  update: "Avant mise à jour",
  restore: "Avant restauration",
  rollback: "Avant retour de version",
};

/** Sauvegardes de l'application, rechargées quand leur nombre ou la date de la dernière change. */
export function useBackups(app: AppView) {
  const [list, setList] = useState<BackupInfo[] | null>(null);
  const reload = useCallback(() => {
    api.listBackups(app.id).then(setList).catch(() => setList([]));
  }, [app.id]);
  useEffect(reload, [reload, app.backupCount, app.lastBackupAt]);
  return { list, reload };
}

/** Sauvegarde faite juste avant de quitter `version` : celle à remettre si l'on y revient. */
function backupBeforeLeaving(list: BackupInfo[] | null, version: string | null) {
  return list?.find((b) => b.reason === "update" && b.version === version) ?? null;
}

function useFocus(active: boolean) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!active || !ref.current) return;
    ref.current.scrollIntoView({ block: "start" });
    ref.current.classList.add("flash");
    const t = setTimeout(() => ref.current?.classList.remove("flash"), 1400);
    return () => clearTimeout(t);
  }, [active]);
  return ref;
}

export function VersionsPanel({ app, backups, focus, onToast }: { app: AppView; backups: BackupInfo[] | null; focus: boolean; onToast: (s: string) => void }) {
  const [confirm, setConfirm] = useState(false);
  const [withData, setWithData] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ErrorInfo | null>(null);
  const ref = useFocus(focus);
  // Ouverte depuis la palette (« Revenir à … ») : la confirmation est proposée une fois, à l'arrivée.
  const asked = useRef(false);
  useEffect(() => {
    if (focus && app.previousVersion && !asked.current) setConfirm(true);
    asked.current ||= focus;
  }, [focus, app.previousVersion]);

  const match = backupBeforeLeaving(backups, app.previousVersion);
  const blocked = app.running || !!app.task;

  const rollback = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.rollback(app.id, withData && match ? match.id : null);
      setConfirm(false);
      onToast(`${app.name} est revenue à la ${app.previousVersion}${withData && match ? ", avec ses données d'avant la mise à jour" : ""}.`);
    } catch (e) {
      setErr(toErrorInfo(e));
    } finally {
      setBusy(false);
    }
  };
  const hold = (on: boolean) => async () => {
    setErr(null);
    try {
      await api.setHold(app.id, on);
      onToast(on ? `La ${app.availableVersion} de ${app.name} ne sera plus proposée.` : `Les mises à jour de ${app.name} sont de nouveau proposées.`);
    } catch (e) {
      setErr(toErrorInfo(e));
    }
  };

  return (
    <section className="panel safety" ref={ref} id="versions">
      <div className="safety-head">
        <h3>Versions</h3>
        <span className="muted small">La version précédente reste sur le disque après chaque mise à jour.</span>
      </div>
      <ul className="version-list">
        <li>
          <span className="vdot on" />
          <span><b>{app.installedVersion}</b> <span className="tag good">active</span></span>
          {app.pendingVersion && <span className="muted small">la {app.pendingVersion} s'activera à la fermeture</span>}
        </li>
        {app.previousVersion ? (
          <li>
            <span className="vdot" />
            <span><b>{app.previousVersion}</b> <span className="muted small">gardée</span></span>
            {!confirm && (
              <button className="btn small" onClick={() => setConfirm(true)} disabled={blocked}>
                <Icon name="back" size={14} /> Revenir à la {app.previousVersion}
              </button>
            )}
          </li>
        ) : (
          <li className="muted small">Aucune version précédente : elle sera gardée à la prochaine mise à jour.</li>
        )}
      </ul>

      {confirm && app.previousVersion && (
        <div className="confirm">
          <p>
            Réactiver la <b>{app.previousVersion}</b> à la place de la {app.installedVersion} ? La {app.installedVersion} reste gardée, et ne sera plus
            proposée en mise à jour tant qu'une version plus récente ne sort pas.
          </p>
          {match ? (
            <label className="check">
              <input type="checkbox" checked={withData} onChange={(e) => setWithData(e.target.checked)} />
              <span>
                Remettre aussi les données sauvegardées avant la mise à jour ({dateTime(match.createdAt)}, {bytes(match.size)}). Les données actuelles
                sont sauvegardées d'abord.
              </span>
            </label>
          ) : (
            <p className="muted small">Aucune sauvegarde faite avant la mise à jour : les données actuelles sont gardées telles quelles.</p>
          )}
          <div className="row">
            <button className="btn primary small" onClick={rollback} disabled={busy || blocked}>
              {busy ? "Retour…" : `Revenir à la ${app.previousVersion}`}
            </button>
            <button className="btn ghost small" onClick={() => setConfirm(false)} disabled={busy}>Annuler</button>
          </div>
        </div>
      )}
      {blocked && (confirm || app.previousVersion) && <p className="muted small">{app.running ? "Fermez l'application pour changer de version." : "Attendez la fin de l'opération en cours."}</p>}

      {app.heldVersion ? (
        <div className="hold on">
          <Icon name="pin" size={16} />
          <span>Versions ignorées jusqu'à la <b>{app.heldVersion}</b> : la suivante sera proposée normalement.</span>
          <button className="btn small ghost" onClick={hold(false)}>Ne plus ignorer</button>
        </div>
      ) : (
        app.updateAvailable && (
          <div className="hold">
            <Icon name="pin" size={16} />
            <span>Garder la {app.installedVersion} le temps qu'un correctif sorte ?</span>
            <button className="btn small ghost" onClick={hold(true)}>Ignorer la {app.availableVersion}</button>
          </div>
        )
      )}
      {err && <ErrorBox error={err} onClose={() => setErr(null)} />}
    </section>
  );
}

export function BackupsPanel({ app, backups, reload, focus, onToast }: { app: AppView; backups: BackupInfo[] | null; reload: () => void; focus: boolean; onToast: (s: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ id: string; what: "restore" | "delete" } | null>(null);
  const [err, setErr] = useState<ErrorInfo | null>(null);
  const ref = useFocus(focus);

  const run = (key: string, f: () => Promise<unknown>, ok: string) => async () => {
    setBusy(key);
    setErr(null);
    try {
      await f();
      setAsk(null);
      onToast(ok);
    } catch (e) {
      setErr(toErrorInfo(e));
    } finally {
      setBusy(null);
      reload();
    }
  };

  return (
    <section className="panel safety" ref={ref} id="backups">
      <div className="safety-head">
        <h3>Sauvegardes des données</h3>
        <div className="row">
          <button className="btn small ghost" onClick={() => void api.openBackupsFolder(app.id).catch((e) => setErr(toErrorInfo(e)))}>Dossier</button>
          <button className="btn small primary" onClick={run("new", () => api.backup(app.id), `Données de ${app.name} sauvegardées.`)} disabled={busy !== null}>
            <Icon name="shield" size={14} /> {busy === "new" ? "Sauvegarde…" : "Sauvegarder maintenant"}
          </button>
        </div>
      </div>
      <p className="muted small">Une sauvegarde est faite automatiquement avant chaque mise à jour ; les 5 dernières automatiques sont gardées, les manuelles jamais supprimées seules.</p>
      {err && <ErrorBox error={err} onClose={() => setErr(null)} />}
      {backups === null ? (
        <div className="sk-line w60" />
      ) : backups.length === 0 ? (
        <p className="backup-empty">Aucune sauvegarde pour l'instant.</p>
      ) : (
        <ul className="backup-list">
          {backups.map((b) => (
            <li key={b.id} className={ask?.id === b.id ? "asking" : ""}>
              <div className="backup-main">
                <b>{dateTime(b.createdAt)}</b>
                <span className={`tag ${b.reason === "manual" ? "" : "dev"}`}>{REASON_LABEL[b.reason]}</span>
                <span className="muted small">{b.version ? `version ${b.version} · ` : ""}{bytes(b.size)} · {b.files} fichier{b.files > 1 ? "s" : ""}</span>
              </div>
              {ask?.id === b.id ? (
                <div className="backup-ask">
                  <span className="small">
                    {ask.what === "restore"
                      ? "Remplacer les données actuelles par celles-ci ? Elles sont sauvegardées avant."
                      : "Supprimer définitivement cette sauvegarde ?"}
                  </span>
                  <button
                    className={`btn small ${ask.what === "delete" ? "danger" : "primary"}`}
                    disabled={busy !== null || (ask.what === "restore" && (app.running || !!app.task))}
                    onClick={
                      ask.what === "restore"
                        ? run(b.id, () => api.restoreBackup(app.id, b.id), `Données de ${app.name} restaurées (${dateTime(b.createdAt)}).`)
                        : run(b.id, () => api.deleteBackup(app.id, b.id), "Sauvegarde supprimée.")
                    }
                  >
                    {busy === b.id ? "…" : ask.what === "restore" ? "Restaurer" : "Supprimer"}
                  </button>
                  <button className="btn small ghost" onClick={() => setAsk(null)} disabled={busy !== null}>Annuler</button>
                  {ask.what === "restore" && app.running && <span className="muted small">Fermez l'application d'abord.</span>}
                </div>
              ) : (
                <div className="backup-actions">
                  <button className="btn small" onClick={() => setAsk({ id: b.id, what: "restore" })}>Restaurer</button>
                  <button className="btn small ghost" onClick={() => setAsk({ id: b.id, what: "delete" })} aria-label="Supprimer la sauvegarde"><Icon name="close" size={14} /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
