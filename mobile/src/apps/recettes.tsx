// Rayan's Recettes sur l'iPhone : le plan du jour (ce que je mange, ce que je prépare), les courses du jour ou de
// la semaine rangées par magasin (à cocher en magasin), et les recettes. Tout est lu sur le PC par Rayan's
// Télécommande (Tailscale + code d'association) : recettes de Rayan's Favoris et données de l'app Recettes.
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { mountChrome } from "../shared/chrome.ts";
import { appel, INJOIGNABLE, lireConfig } from "../shared/pc.ts";
import { store } from "../shared/sync.ts";
import { ajouterArticle, COURSES_VIDES, nettoyerCourses } from "../shared/petites.ts";
import "./telecommande.css";
import "./petites.css";
import "./recettes.css";

interface Recette {
  id: string; titre: string; portions?: string; ingredients: string[]; etapes: string[]; lien?: string; resume?: string;
  kcal?: number; proteines?: number; perso: boolean;
  etiquettes: { proteines: boolean; rapide: boolean; collation: boolean; repas: boolean };
  remarques: { halal: string[]; seche: string[]; aVerifier: string[] };
  favori: boolean; faites: number[];
}
interface Article { cle: string; nom: string; detail: string; conseil: string; note: string; achete: boolean }
interface Groupe { magasin: string; titre: string; articles: Article[] }
interface Jour {
  nom: string; date: string;
  mange: { repas: string; nomRepas: string; id: string | null; titre: string | null }[];
  prepare: { id: string; titre: string; nomRepas: string; quand: "aujourdhui" | "ce-soir" | "des-que-possible" }[];
  total: { kcal: number; proteines: number; renseignees: number; recettes: number } | null;
  courses: Groupe[];
}
interface Vue {
  trouve: boolean;
  recettes: Recette[];
  plan: { debut: string; semaineEnCours: boolean; aujourdhui: number | null; jours: Jour[]; semaine: Groupe[] } | null;
}

const ETIQUETTES = { proteines: "Protéines", rapide: "Rapide", collation: "Collation", repas: "Repas" } as const;
const QUAND = { "aujourdhui": "pour aujourd'hui", "ce-soir": "ce soir, pour demain", "des-que-possible": "à préparer en avance, dès que possible" };
const sansAccents = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe");
const nouvelId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const dateCourte = (t: number) => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

type Onglet = "jour" | "courses" | "recettes";

function App() {
  const cfg = lireConfig();
  const [v, setV] = useState<Vue | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("jour");
  const [jour, setJour] = useState<number | null>(null);
  const [fiche, setFiche] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!cfg) return;
    try { setV(await appel<Vue>(cfg, "/api/recettes")); setErreur(null); }
    catch (e) { setErreur(String((e as Error).message ?? e)); }
  }, [cfg?.adresse, cfg?.code]);
  useEffect(() => { void charger(); }, [charger]);
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(null), message.ok ? 4000 : 9000); return () => clearTimeout(t); }, [message]);

  if (!cfg) return (
    <div className="tc">
      <h1>Recettes</h1>
      <section className="carte">
        <p>Les recettes sont lues sur le PC. Associe d'abord ton PC dans la tuile <b>Télécommande</b>, puis reviens ici.</p>
        <a className="bouton" href="../telecommande/">Ouvrir la Télécommande</a>
      </section>
    </div>
  );

  /** Envoie un changement au PC ; l'écran est mis à jour tout de suite, et remis en place si le PC refuse. */
  const envoyer = async (quoi: string, corps: Record<string, unknown>, local: (v: Vue) => Vue) => {
    const avant = v;
    if (v) setV(local(v));
    try { await appel(cfg, `/api/recettes/${quoi}`, { corps }); }
    catch (e) { setV(avant); setMessage({ ok: false, texte: String((e as Error).message ?? e) }); }
  };
  const changerRecette = (id: string, f: (r: Recette) => Recette) => (x: Vue): Vue => ({ ...x, recettes: x.recettes.map((r) => (r.id === id ? f(r) : r)) });
  const cocher = (cle: string, oui: boolean) => envoyer("achete", { cle, oui }, (x) => {
    const g = (l: Groupe[]) => l.map((m) => ({ ...m, articles: m.articles.map((a) => (a.cle === cle ? { ...a, achete: oui } : a)) }));
    return x.plan ? { ...x, plan: { ...x.plan, semaine: g(x.plan.semaine), jours: x.plan.jours.map((j) => ({ ...j, courses: g(j.courses) })) } } : x;
  });

  const ouvrir = (id: string) => { setFiche(id); setOnglet("recettes"); window.scrollTo(0, 0); };
  const r = fiche ? v?.recettes.find((x) => x.id === fiche) : undefined;
  const j = v?.plan ? (jour ?? v.plan.aujourdhui ?? 0) : 0;

  return (
    <div className="tc rc">
      <div className="titre-carte"><h1>Recettes</h1><button className="lien accent" onClick={() => void charger()}>Actualiser</button></div>
      {message && <p className={`toast ${message.ok ? "ok" : "ko"}`} onClick={() => setMessage(null)}>{message.texte}</p>}
      <div className="onglets trois">
        <button className={onglet === "jour" ? "actif" : ""} onClick={() => setOnglet("jour")}>Aujourd'hui</button>
        <button className={onglet === "courses" ? "actif" : ""} onClick={() => setOnglet("courses")}>Courses</button>
        <button className={onglet === "recettes" ? "actif" : ""} onClick={() => { setOnglet("recettes"); setFiche(null); }}>Recettes</button>
      </div>
      {erreur && <section className="carte"><p className="ko">{erreur === INJOIGNABLE ? erreur : `Impossible de lire les recettes : ${erreur}`}</p></section>}
      {!erreur && !v && <section className="carte"><p className="petit">Chargement…</p></section>}
      {v && onglet === "jour" && <Aujourdhui v={v} j={j} setJour={setJour} ouvrir={ouvrir} />}
      {v && onglet === "courses" && <Courses v={v} j={j} setJour={setJour} cocher={cocher}
        vider={() => envoyer("viderAchetes", {}, (x) => x.plan ? { ...x, plan: { ...x.plan, semaine: x.plan.semaine.map((m) => ({ ...m, articles: m.articles.map((a) => ({ ...a, achete: false })) })), jours: x.plan.jours.map((d) => ({ ...d, courses: d.courses.map((m) => ({ ...m, articles: m.articles.map((a) => ({ ...a, achete: false })) })) })) } } : x)}
        message={setMessage} />}
      {v && onglet === "recettes" && !r && <Liste v={v} ouvrir={ouvrir} />}
      {v && onglet === "recettes" && r && (
        <Fiche r={r} retour={() => setFiche(null)}
          favori={() => envoyer("favori", { id: r.id, oui: !r.favori }, changerRecette(r.id, (x) => ({ ...x, favori: !x.favori })))}
          faite={() => { const at = Date.now(); void envoyer("faite", { id: r.id }, changerRecette(r.id, (x) => ({ ...x, faites: [...x.faites, at] }))).then(() => setMessage({ ok: true, texte: "Noté ✓" })); }} />
      )}
    </div>
  );
}

function Jours({ v, j, setJour, semaine }: { v: Vue; j: number | "semaine"; setJour: (n: number | "semaine") => void; semaine?: boolean }) {
  return (
    <div className="filtres jours">
      {v.plan!.jours.map((d, n) => (
        <button key={n} className={`${j === n ? "actif" : ""} ${v.plan!.aujourdhui === n ? "aujourdhui" : ""}`} onClick={() => setJour(n)}>{d.nom.slice(0, 3)}</button>
      ))}
      {semaine && <button className={j === "semaine" ? "actif" : ""} onClick={() => setJour("semaine")}>Semaine</button>}
    </div>
  );
}

const SansPlan = () => (
  <section className="carte"><p>Pas encore de plan. Crée-le dans <b>Rayan's Recettes</b> sur le PC (onglet « Mon plan »), puis actualise.</p></section>
);

function Aujourdhui({ v, j, setJour, ouvrir }: { v: Vue; j: number; setJour: (n: number) => void; ouvrir: (id: string) => void }) {
  if (!v.plan) return <SansPlan />;
  const d = v.plan.jours[j];
  return (
    <>
      <Jours v={v} j={j} setJour={(n) => typeof n === "number" && setJour(n)} />
      {!v.plan.semaineEnCours && <p className="petit">Ce plan est celui d'une autre semaine : régénère-le sur le PC.</p>}
      <section className="carte">
        <h2>Ce que je mange — {d.nom} {d.date}</h2>
        <ul className="liste">
          {d.mange.map((m) => (
            <li key={m.repas} className={m.id ? "cliquable" : ""} onClick={() => m.id && ouvrir(m.id)}>
              <span className="texte"><small>{m.nomRepas}</small>{m.titre ? <b>{m.titre}</b> : <span className="petit">Libre</span>}</span>
              {m.id && <span className="fleche">›</span>}
            </li>
          ))}
        </ul>
        {d.total && <p className="petit">Total approximatif : ≈ {d.total.kcal} kcal · ≈ {d.total.proteines} g de protéines{d.total.renseignees < d.total.recettes ? ` (${d.total.renseignees} recette(s) sur ${d.total.recettes} donnent ces chiffres)` : ""}</p>}
      </section>
      <section className="carte">
        <h2>Ce que je prépare</h2>
        {d.prepare.length === 0 && <p className="petit">Rien à préparer.</p>}
        <ul className="liste">
          {d.prepare.map((p) => (
            <li key={`${p.id}-${p.quand}`} className="cliquable" onClick={() => ouvrir(p.id)}>
              <span className="texte"><b>{p.titre}</b><small className={p.quand !== "aujourdhui" ? "rc-avance" : ""}>{p.nomRepas} — {QUAND[p.quand]}</small></span>
              <span className="fleche">›</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Courses({ v, j, setJour, cocher, vider, message }: {
  v: Vue; j: number; setJour: (n: number) => void; cocher: (cle: string, oui: boolean) => void; vider: () => void;
  message: (m: { ok: boolean; texte: string }) => void;
}) {
  const [choix, setChoix] = useState<number | "semaine">(j);
  if (!v.plan) return <SansPlan />;
  const groupes = choix === "semaine" ? v.plan.semaine : v.plan.jours[choix].courses;
  const tous = groupes.flatMap((g) => g.articles);
  const reste = tous.filter((a) => !a.achete);
  const versMaListe = async () => {
    const t = await store.load("courses");
    let d = COURSES_VIDES;
    try { d = nettoyerCourses(t ? JSON.parse(t) : null); } catch { /* liste vide */ }
    for (const a of reste) d = ajouterArticle(d, a.nom, Date.now(), nouvelId());
    store.save("courses", JSON.stringify(d));
    message({ ok: true, texte: `${reste.length} article(s) ajouté(s) à la tuile Courses ✓` });
  };
  return (
    <>
      <Jours v={v} j={choix} setJour={(n) => { setChoix(n); if (typeof n === "number") setJour(n); }} semaine />
      {tous.length === 0 ? <section className="carte"><p className="centre">Rien à acheter (cases libres).</p></section> : (
        <>
          <p className="petit">{reste.length} à prendre sur {tous.length}{reste.length < tous.length && <> · <button className="lien" onClick={vider}>tout décocher</button></>}</p>
          {groupes.map((g) => (
            <section key={g.magasin} className="carte">
              <p className="rayon">{g.titre}</p>
              <ul className="liste">
                {g.articles.map((a) => (
                  <li key={a.cle}>
                    <button className={`coche rc-coche ${a.achete ? "fait" : ""}`} onClick={() => cocher(a.cle, !a.achete)}>
                      <span className="case">{a.achete ? "✓" : ""}</span>
                      <span className="texte"><span className="nom">{a.nom}</span>{a.detail && <small>{a.detail}</small>}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {reste.length > 0 && <button className="bouton secondaire" onClick={() => void versMaListe()}>Ajouter à ma liste Courses</button>}
          <p className="petit">Magasins conseillés : des habitudes générales en France, pas des prix (ils varient). Le magasin d'un produit se change dans Rayan's Recettes sur le PC.</p>
        </>
      )}
    </>
  );
}

function Liste({ v, ouvrir }: { v: Vue; ouvrir: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [favoris, setFavoris] = useState(false);
  const mots = sansAccents(q).split(/\s+/).filter(Boolean);
  const liste = v.recettes.filter((r) => (!favoris || r.favori) && mots.every((m) => sansAccents([r.titre, ...r.ingredients].join(" ")).includes(m)));
  return (
    <>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une recette, un ingrédient…" />
      <div className="filtres"><button className={favoris ? "actif" : ""} onClick={() => setFavoris(!favoris)}>★ Favoris</button></div>
      {!v.trouve && <p className="petit">Dossier de Rayan's Favoris introuvable sur le PC.</p>}
      <section className="carte">
        {liste.length === 0 && <p className="centre">Aucune recette.</p>}
        <ul className="liste">
          {liste.map((r) => (
            <li key={r.id} className="cliquable" onClick={() => ouvrir(r.id)}>
              <span className="texte"><b>{r.favori && "★ "}{r.titre}</b>
                <small>{(Object.keys(ETIQUETTES) as (keyof typeof ETIQUETTES)[]).filter((k) => r.etiquettes[k]).map((k) => ETIQUETTES[k]).join(" · ")}{r.faites.length ? ` · faite ×${r.faites.length}` : ""}</small></span>
              <span className="fleche">›</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Fiche({ r, retour, favori, faite }: { r: Recette; retour: () => void; favori: () => void; faite: () => void }) {
  const rq = r.remarques;
  return (
    <>
      <button className="lien accent rc-retour" onClick={retour}>‹ Toutes les recettes</button>
      <section className="carte">
        <h2>{r.titre}</h2>
        <p className="petit">{[r.portions, r.kcal !== undefined && `≈ ${r.kcal} kcal`, r.proteines !== undefined && `≈ ${r.proteines} g de protéines`].filter(Boolean).join(" · ")}</p>
        <div className="ligne">
          <button className="bouton secondaire" onClick={favori}>{r.favori ? "★ En favori" : "☆ Favori"}</button>
          <button className="bouton" onClick={faite}>✓ Je l'ai faite</button>
        </div>
        {r.faites.length > 0 && <p className="petit">Faite {r.faites.length} fois, la dernière le {dateCourte(r.faites[r.faites.length - 1])}.</p>}
        {r.lien && <a className="bouton secondaire" href={r.lien} target="_blank" rel="noopener noreferrer">▶ Voir la vidéo</a>}
      </section>
      <section className="carte rc-halal">
        <h3>Halal</h3>
        {rq.halal.map((p) => <p key={p}>{p}</p>)}
        {rq.aVerifier.map((i) => <p key={i} className="rc-alerte">À vérifier : {i}</p>)}
        {!rq.halal.length && !rq.aVerifier.length && <p className="petit">Rien de signalé. Vérifie quand même la viande et les produits transformés.</p>}
      </section>
      <section className="carte rc-seche">
        <h3>Sèche et sport</h3>
        {rq.seche.length ? rq.seche.map((p) => <p key={p}>{p}</p>) : <p className="petit">Pas de remarque dans la fiche.</p>}
      </section>
      <section className="carte">
        <h2>Ingrédients</h2>
        <ul className="rc-points">{r.ingredients.map((i, n) => <li key={n}>{i}</li>)}</ul>
      </section>
      <section className="carte">
        <h2>Étapes</h2>
        {r.etapes.length ? <ol className="rc-points">{r.etapes.map((e, n) => <li key={n}>{e}</li>)}</ol> : <p className="petit">Pas d'étapes notées.</p>}
        {r.resume && <p className="extrait">{r.resume}</p>}
      </section>
    </>
  );
}

mountChrome(["courses"]);
createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
