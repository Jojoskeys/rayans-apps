// Rayan's Calme : chargement des données, menu, bouton d'aide toujours visible, pages.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FICHES, QUIZ } from "./core/contenu";
import type { Db } from "./core/model";
import Aide from "./exercices/Aide";
import { loadDb, Saver, signalReady } from "./storage";
import { AppContext, type AppApi, type Page } from "./ui";
import PageExercices from "./views/Exercices";
import { PageFiches, PageSources } from "./views/Fiches";
import PageJournal from "./views/Journal";
import PageProgres from "./views/Progres";
import PageReglages from "./views/Reglages";
import PageSeance from "./views/Seance";

const MENU: { id: Page; titre: string; icone: string }[] = [
  { id: "seance", titre: "Séance", icone: "🌿" },
  { id: "exercices", titre: "Exercices", icone: "🌬" },
  { id: "journal", titre: "Journal", icone: "📓" },
  { id: "fiches", titre: "Fiches", icone: "📚" },
  { id: "progres", titre: "Progrès", icone: "📈" },
  { id: "sources", titre: "Sources", icone: "🔗" },
  { id: "reglages", titre: "Réglages", icone: "⚙" },
];

export default function App() {
  const [db, setDb] = useState<Db | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState<{ p: Page; arg?: string; n: number }>({ p: "seance", n: 0 });
  const saver = useMemo(() => new Saver((m) => setNotice(m)), []);
  const dbRef = useRef<Db | null>(null);

  const maj = useCallback((f: (d: Db) => Db) => {
    const cur = dbRef.current;
    if (!cur) return;
    const n = f(cur);
    if (n === cur) return;
    dbRef.current = n;
    setDb(n);
    saver.push(n);
  }, [saver]);

  useEffect(() => {
    loadDb()
      .then((r) => {
        dbRef.current = r.db;
        setDb(r.db);
        if (r.notice) setNotice(r.notice);
        void signalReady({ ui: "ok", premierDemarrage: r.firstRun, fiches: FICHES.length, quiz: QUIZ.length });
      })
      .catch((e) => setErreur(String(e instanceof Error ? e.message : e)));
  }, []);

  const aller = useCallback((p: Page, arg?: string) => {
    setPage((x) => ({ p, arg, n: x.n + 1 }));
    window.scrollTo({ top: 0 });
  }, []);

  if (erreur) return <div className="erreur-globale"><h1>Rayan's Calme</h1><p>{erreur}</p></div>;
  if (!db) return <div className="chargement">Chargement…</div>;
  const api: AppApi = { db, maj, aller, arg: page.arg };
  return (
    <AppContext.Provider value={api}>
      <div className="app">
        <nav className="menu">
          <div className="marque"><img src="logo.svg" alt="" /> <span>Calme</span></div>
          {MENU.map((m) => (
            <button key={m.id} className={page.p === m.id ? "actif" : ""} onClick={() => aller(m.id)}>
              <span className="mi">{m.icone}</span> <span className="mt">{m.titre}</span>
            </button>
          ))}
        </nav>
        <main className="contenu">
          <div className="barre-haut">
            <button className={`sos ${page.p === "aide" ? "actif" : ""}`} onClick={() => aller("aide")}>🤝 Si ça ne va vraiment pas</button>
          </div>
          {notice && <div className="notice" onClick={() => setNotice(null)}>{notice} <small>(cliquer pour fermer)</small></div>}
          <div key={`${page.p}-${page.n}`}>
            {page.p === "seance" && <PageSeance />}
            {page.p === "exercices" && <PageExercices />}
            {page.p === "journal" && <PageJournal />}
            {page.p === "fiches" && <PageFiches />}
            {page.p === "progres" && <PageProgres />}
            {page.p === "sources" && <PageSources />}
            {page.p === "reglages" && <PageReglages />}
            {page.p === "aide" && <Aide />}
          </div>
        </main>
      </div>
    </AppContext.Provider>
  );
}
