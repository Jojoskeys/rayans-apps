// Rayan's Échecs Vision : chargement des données, menu, pages.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Db } from "./core/model";
import { seanceDuJour } from "./core/seance";
import { TACTIQUES } from "./core/tactiques";
import { loadDb, Saver, signalReady } from "./storage";
import { AppContext, type AppApi, type Page } from "./ui";
import { Exercices, Fiches, Progres, Quiz, Reglages } from "./views/Pages";
import PageSeance, { Presentation } from "./views/Seance";

const MENU: { id: Page; titre: string; icone: string }[] = [
  { id: "seance", titre: "Séance", icone: "▶" },
  { id: "exercices", titre: "Exercices", icone: "♞" },
  { id: "fiches", titre: "Fiches", icone: "📚" },
  { id: "quiz", titre: "Quiz", icone: "❓" },
  { id: "progres", titre: "Progrès", icone: "📈" },
  { id: "reglages", titre: "Réglages", icone: "⚙" },
];

export default function App() {
  const [db, setDb] = useState<Db | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState<{ p: Page; arg?: string; n: number }>({ p: "seance", n: 0 });
  const saver = useMemo(() => new Saver((m) => setNotice(m)), []);
  const dbRef = useRef<Db | null>(null);

  useEffect(() => {
    loadDb()
      .then((r) => {
        dbRef.current = r.db;
        setDb(r.db);
        if (r.notice) setNotice(r.notice);
        const s = seanceDuJour(r.db, Date.now());
        void signalReady({ ui: "ok", premierDemarrage: r.firstRun, etapes: s.etapes.length, exercices: Object.keys(r.db.niveaux).length, tactiques: TACTIQUES.length });
      })
      .catch((e) => setErreur(String(e instanceof Error ? e.message : e)));
  }, []);

  const maj = useCallback((f: (d: Db) => Db) => {
    const cur = dbRef.current;
    if (!cur) return;
    const n = f(cur);
    if (n === cur) return;
    dbRef.current = n;
    setDb(n);
    saver.push(n);
  }, [saver]);

  const aller = useCallback((p: Page, arg?: string) => {
    setPage((x) => ({ p, arg, n: x.n + 1 }));
    window.scrollTo({ top: 0 });
  }, []);

  if (erreur) return <div className="erreur-globale"><h1>Rayan's Échecs Vision</h1><p>{erreur}</p></div>;
  if (!db) return <div className="chargement">Chargement…</div>;
  const api: AppApi = { db, maj, aller, arg: page.arg };
  const finIntro = () => {
    maj((d) => ({ ...d, reglages: { ...d.reglages, introVue: true, maj: Date.now() } }));
    aller("seance");
  };
  return (
    <AppContext.Provider value={api}>
      <div className="app">
        <nav className="menu">
          <div className="marque"><img src="logo.svg" alt="" /> <span>Échecs Vision</span></div>
          {MENU.map((m) => (
            <button key={m.id} className={page.p === m.id ? "actif" : ""} onClick={() => aller(m.id)}>
              <span className="mi">{m.icone}</span> <span className="mt">{m.titre}</span>
            </button>
          ))}
        </nav>
        <main className="contenu">
          {notice && <div className="notice" onClick={() => setNotice(null)}>{notice} <small>(cliquer pour fermer)</small></div>}
          {!db.reglages.introVue ? <Presentation onFin={finIntro} /> : (
            <div key={`${page.p}-${page.n}`}>
              {page.p === "seance" && <PageSeance />}
              {page.p === "exercices" && <Exercices />}
              {page.p === "fiches" && <Fiches />}
              {page.p === "quiz" && <Quiz />}
              {page.p === "progres" && <Progres />}
              {page.p === "reglages" && <Reglages />}
            </div>
          )}
        </main>
      </div>
    </AppContext.Provider>
  );
}
