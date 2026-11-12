import { useCallback, useEffect, useState } from "react";
import { api, errorText, type BatchView, type OpView, type UndoReport } from "./api";
import { Confirm } from "./Confirm";
import { baseName, plural, shortDir } from "./format";

export function HistoryView() {
  const [batches, setBatches] = useState<BatchView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ batch: BatchView; ops: number[] | null } | null>(null);

  const load = useCallback(() => {
    api.history().then(setBatches).catch((e) => setError(errorText(e)));
  }, []);
  useEffect(load, [load]);

  const doUndo = async () => {
    if (!confirm) return;
    const { batch, ops } = confirm;
    setConfirm(null);
    setError(null);
    try {
      const r: UndoReport = await api.undo(batch.id, ops);
      let msg = `${plural(r.restored.length, "fichier remis", "fichiers remis")} en place.`;
      if (r.restored.some((x) => x.renamed)) msg += " Certains ont été renommés car leur place était prise.";
      if (r.failed.length) msg += ` ${plural(r.failed.length, "fichier n’a", "fichiers n’ont")} pas pu l’être : ${r.failed.map((f) => `${baseName(f.path)} (${f.reason})`).join(" ; ")}`;
      setInfo(msg);
    } catch (e) {
      setError(errorText(e));
    }
    load();
  };

  const reveal = (p: string) => api.reveal(p).catch((e) => setError(errorText(e)));

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Historique</h1>
          <p className="muted">Chaque rangement est noté. Annuler remet les fichiers à leur place d’origine (renommés si la place est prise).</p>
        </div>
        <button className="btn ghost" onClick={load}>Actualiser</button>
      </header>
      {error && <div className="alert bad">{error}</div>}
      {info && <div className="alert good">{info}</div>}
      {batches && batches.length === 0 && <div className="empty small-empty">Aucun rangement pour l’instant.</div>}
      <div className="history">
        {batches?.map((b) => {
          const active = b.ops.filter((o) => o.state !== "annule");
          const isOpen = open === b.id;
          return (
            <div className="batch" key={b.id}>
              <div className="batch-head" onClick={() => setOpen(isOpen ? null : b.id)}>
                <span className="caret">{isOpen ? "▾" : "▸"}</span>
                <div>
                  <div className="batch-title">{b.date}</div>
                  <div className="muted small">
                    {b.origin === "automatique" ? "Aperçu automatique validé" : "Rangement manuel"} · {plural(b.ops.length, "fichier")}
                    {active.length < b.ops.length && ` · ${plural(b.ops.length - active.length, "annulé")}`}
                  </div>
                </div>
                {active.length > 0 ? (
                  <button className="btn small" style={{ marginLeft: "auto" }} onClick={(e) => { e.stopPropagation(); setConfirm({ batch: b, ops: null }); }}>
                    Annuler ce rangement
                  </button>
                ) : (
                  <span className="tag" style={{ marginLeft: "auto" }}>annulé</span>
                )}
              </div>
              {isOpen && (
                <ul className="ops">
                  {b.ops.map((o) => (
                    <OpRow key={o.op} op={o} onUndo={() => setConfirm({ batch: b, ops: [o.op] })} onReveal={reveal} />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      {confirm && (
        <Confirm
          title={confirm.ops ? "Annuler ce déplacement ?" : "Annuler tout ce rangement ?"}
          confirmLabel="Remettre en place"
          onCancel={() => setConfirm(null)}
          onConfirm={doUndo}
        >
          <p>
            {confirm.ops
              ? "Le fichier retournera à son emplacement d’origine."
              : `${plural(confirm.batch.ops.filter((o) => o.state !== "annule").length, "fichier retournera", "fichiers retourneront")} à leur emplacement d’origine.`}
          </p>
          <p className="muted">Si un autre fichier a pris la place, le fichier remis sera renommé « nom (2) ». Rien n’est écrasé.</p>
        </Confirm>
      )}
    </section>
  );
}

function OpRow(p: { op: OpView; onUndo: () => void; onReveal: (path: string) => void }) {
  const o = p.op;
  const where = o.state === "annule" ? o.restoredTo ?? o.from : o.to;
  return (
    <li className={"op " + o.state}>
      <div className="op-main">
        <div className="item-name">
          {baseName(o.from)}
          {o.kind === "doublon" && <span className="tag">doublon</span>}
          {o.state === "annule" && <span className="tag">remis en place</span>}
          {o.state === "incertain" && <span className="tag warn" title="L’application a été interrompue pendant ce déplacement">à vérifier</span>}
        </div>
        <div className="muted small" title={`${o.from} → ${o.to}`}>
          {shortDir(o.from)} → {shortDir(o.to)} · {o.reason}
        </div>
      </div>
      <button className="btn ghost small" onClick={() => p.onReveal(where)}>Afficher</button>
      {o.state !== "annule" && <button className="btn ghost small" onClick={p.onUndo}>Annuler</button>}
    </li>
  );
}
