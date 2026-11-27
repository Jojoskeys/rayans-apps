// Rayan's Langues : chargement des données, menu, choix de la langue, pages.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FICHES, QUIZ } from "./core/contenu";
import { LANGUES, mots, NOM_NATIF, type Langue } from "./core/langues";
import type { Db } from "./core/model";
import { loadDb, Saver, signalReady } from "./storage";
import { AppContext, type AppApi, type Page } from "./ui";
import PageExercices from "./views/Exercices";
import { PageFiches, PageSources } from "./views/Fiches";
import PageMots from "./views/Mots";
import PageProgres from "./views/Progres";
import PageReglages from "./views/Reglages";
import PageSeance from "./views/Seance";

const MENU: { id: Page; titre: string; icone: string }[] = [
  { id: "seance", titre: "Séance", icone: "🌿" },
  { id: "exercices", titre: "Exercices", icone: "🎯" },
  { id: "mots", titre: "Mots", icone: "🗂" },
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
        void signalReady({ ui: "ok", premierDemarrage: r.firstRun, fiches: FICHES.length, quiz: QUIZ.length, motsZh: mots("zh").length, motsAr: mots("ar").length });
      })
      .catch((e) => setErreur(String(e instanceof Error ? e.message : e)));
  }, []);

  const aller = useCallback((p: Page, arg?: string) => {
    setPage((x) => ({ p, arg, n: x.n + 1 }));
    window.scrollTo({ top: 0 });
  }, []);

  if (erreur) return <div className="erreur-globale"><h1>Rayan's Langues</h1><p>{erreur}</p></div>;
  if (!db) return <div className="chargement">Chargement…</div>;
  const langue: Langue = db.reglages.langue ?? "zh";
  const changer = (l: Langue) => {
    if (l === langue) return;
    maj((d) => ({ ...d, reglages: { ...d.reglages, langue: l, maj: Date.now() } }));
    aller(page.p);
  };
  const api: AppApi = { db, langue, maj, aller, arg: page.arg };
  return (
    <AppContext.Provider value={api}>
      <div className="app">
        <nav className="menu">
          <div className="marque"><img src="logo.svg" alt="" /> <span>Langues</span></div>
          {MENU.map((m) => (
            <button key={m.id} className={page.p === m.id ? "actif" : ""} onClick={() => aller(m.id)}>
              <span className="mi">{m.icone}</span> <span className="mt">{m.titre}</span>
            </button>
          ))}
        </nav>
        <main className="contenu">
          {db.reglages.langue && db.reglages.accueilVu && (
            <div className="barre-haut" role="radiogroup" aria-label="Langue">
              {LANGUES.map((l) => (
                <button key={l} role="radio" aria-checked={l === langue} className={`langue-btn ${l === langue ? "actif" : ""}`} onClick={() => changer(l)}>
                  <span className={l}>{NOM_NATIF[l]}</span>
                </button>
              ))}
            </div>
          )}
          {notice && <div className="notice" onClick={() => setNotice(null)}>{notice} <small>(cliquer pour fermer)</small></div>}
          <div key={`${page.p}-${page.n}-${langue}`}>
            {page.p === "seance" && <PageSeance />}
            {page.p === "exercices" && <PageExercices />}
            {page.p === "mots" && <PageMots />}
            {page.p === "fiches" && <PageFiches />}
            {page.p === "progres" && <PageProgres />}
            {page.p === "sources" && <PageSources />}
            {page.p === "reglages" && <PageReglages />}
          </div>
        </main>
      </div>
    </AppContext.Provider>
  );
}
