// Rayan's Culture : chargement des données et de l'actualité, menu, pages.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lireActu } from "./core/actu";
import type { Db } from "./core/model";
import { BANQUE } from "./core/questions";
import { avecSeance, importerActu, rafraichirSeance, seanceDuJour } from "./core/seance";
import { loadActu, loadDb, Saver, saveDb, signalReady } from "./storage";
import { AppContext, type AppApi, type EtatActu, type Page } from "./ui";
import { PageActu, Fiches, Progres, Reglages, Sources } from "./views/Pages";
import PageSeance, { Presentation } from "./views/Seance";

const MENU: { id: Page; titre: string; icone: string }[] = [
  { id: "seance", titre: "Séance", icone: "▶" },
  { id: "actu", titre: "Actu", icone: "📰" },
  { id: "fiches", titre: "Fiches", icone: "📚" },
  { id: "progres", titre: "Progrès", icone: "📈" },
  { id: "sources", titre: "Sources", icone: "🔗" },
  { id: "reglages", titre: "Réglages", icone: "⚙" },
];

const ACTU_VIDE: EtatActu = { ou: "", jours: [], ajoutees: 0, erreur: null, lu: false };

/** Ajoute à `db` les questions des éditions du texte lu. */
function avecTexteActu(db: Db, text: string | null, ou: string): { db: Db; etat: EtatActu } {
  if (text === null) return { db, etat: { ou, jours: [], ajoutees: 0, erreur: null, lu: true } };
  try {
    const eds = lireActu(text);
    const r = importerActu(db, eds, Date.now());
    // De nouvelles questions d'actu : elles entrent dans la séance du jour si elle n'est pas commencée.
    return { db: r.ajoutees ? rafraichirSeance(r.db, Date.now()) : r.db, etat: { ou, jours: eds.map((e) => e.jour), ajoutees: r.ajoutees, erreur: null, lu: true } };
  } catch (e) {
    return { db, etat: { ou, jours: [], ajoutees: 0, erreur: (e as Error).message, lu: true } };
  }
}

export default function App() {
  const [db, setDb] = useState<Db | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actu, setActu] = useState<EtatActu>(ACTU_VIDE);
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
    (async () => {
      const r = await loadDb();
      if (r.notice) setNotice(r.notice);
      // L'actualité d'abord (ses questions entrent dans la séance du jour), puis la séance.
      let d = r.db;
      try {
        const lu = await loadActu(d.reglages.cheminActu);
        const x = avecTexteActu(d, lu.text, lu.ou);
        d = x.db;
        setActu(x.etat);
      } catch (e) {
        setActu({ ...ACTU_VIDE, lu: true, erreur: String(e instanceof Error ? e.message : e) });
      }
      d = avecSeance(d, Date.now());
      dbRef.current = d;
      setDb(d);
      if (d !== r.db) await saveDb(d); // enregistré avant le signal du test de lancement
      const s = seanceDuJour(d, Date.now());
      void signalReady({ ui: "ok", premierDemarrage: r.firstRun, banque: BANQUE.length, seance: s.seance.ids.length });
    })().catch((e) => setErreur(String(e instanceof Error ? e.message : e)));
  }, [saver]);

  const relireActu = useCallback(async (chemin?: string) => {
    const cur = dbRef.current;
    if (!cur) return;
    try {
      const lu = await loadActu(chemin ?? cur.reglages.cheminActu);
      const x = avecTexteActu(cur, lu.text, lu.ou);
      setActu(x.etat);
      maj(() => x.db);
    } catch (e) {
      setActu((a) => ({ ...a, lu: true, erreur: String(e instanceof Error ? e.message : e) }));
    }
  }, [maj]);

  const importerTexteActu = useCallback((text: string) => {
    const cur = dbRef.current;
    if (!cur) return;
    const x = avecTexteActu(cur, text, "fichier choisi");
    setActu(x.etat);
    maj(() => x.db);
  }, [maj]);

  const aller = useCallback((p: Page, arg?: string) => {
    setPage((x) => ({ p, arg, n: x.n + 1 }));
    window.scrollTo({ top: 0 });
  }, []);

  if (erreur) return <div className="erreur-globale"><h1>Rayan's Culture</h1><p>{erreur}</p></div>;
  if (!db) return <div className="chargement">Chargement…</div>;
  const api: AppApi = { db, maj, aller, arg: page.arg, actu, relireActu, importerTexteActu };
  const finIntro = () => {
    maj((d) => ({ ...d, reglages: { ...d.reglages, introVue: true, maj: Date.now() } }));
    aller("seance");
  };
  return (
    <AppContext.Provider value={api}>
      <div className="app">
        <nav className="menu">
          <div className="marque"><img src="logo.svg" alt="" /> <span>Culture</span></div>
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
              {page.p === "actu" && <PageActu />}
              {page.p === "fiches" && <Fiches />}
              {page.p === "progres" && <Progres />}
              {page.p === "sources" && <Sources />}
              {page.p === "reglages" && <Reglages />}
            </div>
          )}
        </main>
      </div>
    </AppContext.Provider>
  );
}
