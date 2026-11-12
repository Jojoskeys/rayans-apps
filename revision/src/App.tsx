import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Db } from "./core/model";
import { dueCounts } from "./core/session";
import { streak } from "./core/stats";
import { Saver, loadDb, signalReady } from "./storage";
import { AppContext, Modal, type AppApi, type ConfirmOptions, type View } from "./ui";
import DeckView from "./views/DeckView";
import Home from "./views/Home";
import ImportDialog from "./views/ImportDialog";
import Review from "./views/Review";
import Settings from "./views/Settings";
import Stats from "./views/Stats";

interface Toast {
  id: number;
  msg: string;
  kind: "ok" | "error";
}

export default function App() {
  const [db, setDb] = useState<Db | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataDir, setDataDir] = useState("");
  const [view, setView] = useState<View>({ name: "home" });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const [importFor, setImportFor] = useState<{ deckId?: string } | null>(null);
  const smokeSent = useRef(false);

  const toast = useCallback((msg: string, kind: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 8000 : 3500);
  }, []);

  const saver = useMemo(() => new Saver((m) => toast(m, "error")), [toast]);

  useEffect(() => {
    loadDb()
      .then((r) => {
        setDb(r.db);
        setDataDir(r.dir);
        if (r.notice) toast(r.notice, "error");
        if (r.firstRun) toast("Bienvenue ! Un paquet d'exemple a été créé pour essayer.");
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [toast]);

  // Test de lancement : une fois l'accueil affiché, résumé envoyé à la couche Tauri (sans effet en temps normal).
  useEffect(() => {
    if (!db || smokeSent.current || !document.querySelector("[data-testid=home]")) return;
    smokeSent.current = true;
    const now = Date.now();
    void signalReady({ ui: "ok", decks: db.decks.length, cards: db.cards.length, due: dueCounts(db, now).total, streak: streak(db, now).current }).catch(() => undefined);
  }, [db, view]);

  const update = useCallback(
    (fn: (db: Db) => Db) => {
      setDb((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        if (next !== prev) saver.push(next);
        return next;
      });
    },
    [saver],
  );

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmState({ ...opts, resolve })), []);

  if (error) {
    return (
      <div className="fatal">
        <h1>Rayan's Révision ne peut pas ouvrir vos données</h1>
        <p>{error}</p>
      </div>
    );
  }
  if (!db) return <div className="loading">Chargement…</div>;

  const api: AppApi = { db, update, go: setView, toast, confirm, dataDir, startImport: (deckId) => setImportFor({ deckId }) };
  const now = Date.now();
  const due = dueCounts(db, now).total;
  const nav: { v: View; label: string; active: boolean }[] = [
    { v: { name: "home" }, label: "Aujourd'hui", active: view.name === "home" || view.name === "deck" },
    { v: { name: "stats" }, label: "Statistiques", active: view.name === "stats" },
    { v: { name: "settings" }, label: "Réglages et données", active: view.name === "settings" },
  ];

  const closeConfirm = (ok: boolean) => {
    confirmState?.resolve(ok);
    setConfirmState(null);
  };

  return (
    <AppContext.Provider value={api}>
      <div className="shell">
        {view.name !== "review" && (
          <nav className="sidebar">
            <div className="brand">
              <img src="/logo.svg" alt="" width={34} height={34} />
              <div>
                <strong>Rayan's Révision</strong>
                <small>{due > 0 ? `${due} carte${due > 1 ? "s" : ""} à réviser` : "Rien à réviser"}</small>
              </div>
            </div>
            {nav.map((n) => (
              <button key={n.label} className={`nav-btn${n.active ? " active" : ""}`} onClick={() => setView(n.v)}>
                {n.label}
              </button>
            ))}
            <div className="sidebar-foot">
              <button className="btn primary block" disabled={due === 0} onClick={() => setView({ name: "review", deckId: null })}>
                Réviser tout
              </button>
            </div>
          </nav>
        )}
        <main className={`content${view.name === "review" ? " review-mode" : ""}`}>
          {view.name === "home" && <Home />}
          {view.name === "deck" && <DeckView key={view.deckId} deckId={view.deckId} />}
          {view.name === "review" && <Review deckId={view.deckId} />}
          {view.name === "stats" && <Stats />}
          {view.name === "settings" && <Settings />}
        </main>
      </div>

      {importFor && <ImportDialog deckId={importFor.deckId} onClose={() => setImportFor(null)} />}

      {confirmState && (
        <Modal title={confirmState.title} onClose={() => closeConfirm(false)}>
          <div className="modal-body">{confirmState.message}</div>
          <div className="modal-actions">
            <button className="btn" onClick={() => closeConfirm(false)}>Annuler</button>
            <button className={`btn ${confirmState.danger ? "danger" : "primary"}`} autoFocus onClick={() => closeConfirm(true)}>
              {confirmState.confirmLabel}
            </button>
          </div>
        </Modal>
      )}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
