import type { ReactNode } from "react";

export function Confirm(p: {
  title: string;
  confirmLabel: string;
  children: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-back" onClick={p.onCancel}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>{p.title}</h2>
        <div className="modal-body">{p.children}</div>
        <div className="actions">
          <button className="btn ghost" onClick={p.onCancel} autoFocus>
            Retour
          </button>
          <button className="btn primary" onClick={p.onConfirm}>
            {p.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
