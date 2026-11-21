// Rayan's Sommeil : chargement des données, menu, pages.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FICHES, QUIZ } from "./core/contenu";
import { moment, paramsDepuisPriere, type ParamsFajr } from "./core/horaires";
import type { Db } from "./core/model";
import { majObjectif } from "./core/objectif";
import { loadDb, loadPriere, Saver, signalReady } from "./storage";
import { AppContext, conseilDuJour, type AppApi, type Page } from "./ui";
import { PageFiches, PageSources } from "./views/Fiches";
import PageJour from "./views/Jour";
import PageJournal from "./views/Journal";
import PageProgres from "./views/Progres";
import PageReglages from "./views/Reglages";

function menu(heureJour: number): { id: Page; titre: string; icone: string }[] {
  const matin = moment(Date.now(), heureJour) === "matin";
  return [
    { id: "jour", titre: matin ? "Ce matin" : "Ce soir", icone: matin ? "☀" : "🌙" },
    { id: "journal", titre: "Journal", icone: "📓" },
    { id: "fiches", titre: "Fiches", icone: "📚" },
    { id: "progres", titre: "Progrès", icone: "📈" },
    { id: "sources", titre: "Sources", icone: "🔗" },
    { id: "reglages", titre: "Réglages", icone: "⚙" },
  ];
}

export default function App() {
  const [db, setDb] = useState<Db | null>(null);
  const [priere, setPriere] = useState<ParamsFajr | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState<{ p: Page; arg?: string; n: number }>({ p: "jour", n: 0 });
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
    Promise.all([loadDb(), loadPriere()])
      .then(([r, texte]) => {
        dbRef.current = r.db;
        setDb(r.db);
        setPriere(paramsDepuisPriere(texte));
        if (r.notice) setNotice(r.notice);
        void signalReady({ ui: "ok", premierDemarrage: r.firstRun, fiches: FICHES.length, quiz: QUIZ.length });
      })
      .catch((e) => setErreur(String(e instanceof Error ? e.message : e)));
  }, []);

  // Objectif de la semaine : avance d'un palier quand la semaine précédente est tenue (calculé à chaque changement).
  useEffect(() => {
    if (!db) return;
    const c = conseilDuJour(db, priere);
    if (!c.conseil.valide) return;
    maj((d) => {
      const o = majObjectif(d.objectif, d.nuits, c.soir, c.cible, Date.now());
      return o === d.objectif ? d : { ...d, objectif: o };
    });
  }, [db?.nuits, db?.reglages, priere, maj]);

  const aller = useCallback((p: Page, arg?: string) => {
    setPage((x) => ({ p, arg, n: x.n + 1 }));
    window.scrollTo({ top: 0 });
  }, []);

  if (erreur) return <div className="erreur-globale"><h1>Rayan's Sommeil</h1><p>{erreur}</p></div>;
  if (!db) return <div className="chargement">Chargement…</div>;
  const api: AppApi = { db, maj, aller, arg: page.arg, priere };
  return (
    <AppContext.Provider value={api}>
      <div className="app">
        <nav className="menu">
          <div className="marque"><img src="logo.svg" alt="" /> <span>Sommeil</span></div>
          {menu(db.reglages.heureJour).map((m) => (
            <button key={m.id} className={page.p === m.id ? "actif" : ""} onClick={() => aller(m.id)}>
              <span className="mi">{m.icone}</span> <span className="mt">{m.titre}</span>
            </button>
          ))}
        </nav>
        <main className="contenu">
          {notice && <div className="notice" onClick={() => setNotice(null)}>{notice} <small>(cliquer pour fermer)</small></div>}
          <div key={`${page.p}-${page.n}`}>
            {page.p === "jour" && <PageJour />}
            {page.p === "journal" && <PageJournal />}
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
