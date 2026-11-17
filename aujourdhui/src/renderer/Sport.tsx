// Sport : séance du jour (créneau selon l'emploi du temps), séance guidée série par série avec repos, saisie des
// courses, semaine, charges actuelles, allures et performances. Les charges suivantes se recalculent à l'enregistrement.
import { useEffect, useRef, useState } from "react";
import { allure, duree, NOMS_SEANCES, type Bloc, type BlocReglage, type Prescription, type SeanceFaite, type SerieFaite, type TypeSeance } from "../core/sport.ts";
import type { SportView } from "../core/sportvue.ts";

const api = window.aujourdhui;
const errText = (e: unknown) => String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
const hm = (ms: number) => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.round(s % 60))).padStart(2, "0")}`;

type BlocVue = SportView["aujourdhui"]["blocs"][number];

function cible(b: Bloc, p: Prescription, unite: "kg" | "lest" | "corps" | "duree") {
  const reps = b.mode === "plage" ? `${b.plage![0]}-${b.plage![1]} reps` : b.mode === "maintien" ? `${p.reps} s` : `${p.reps} reps`;
  const charge = unite === "kg" ? ` à ${p.charge} kg` : unite === "lest" ? ` avec +${p.charge} kg` : "";
  return `${b.series} × ${reps}${charge}`;
}

/** Carte compacte pour la page d'accueil. */
export function SportResume({ s, onOpen }: { s: SportView; onOpen: () => void }) {
  const a = s.aujourdhui;
  return (
    <section className="carte sport-resume" data-testid="sport-resume">
      <div className="titre-ligne">
        <h2>🏋️ {a.titre}</h2>
        <button className="bouton" onClick={onOpen}>{a.faite ? "Voir" : a.type === "repos" ? "Sport" : "Ouvrir"}</button>
      </div>
      <p className="aide">
        {a.faite ? "Séance faite aujourd'hui ✓" : a.creneau ? `Créneau libre d'après ton emploi du temps : ${hm(a.creneau.debut)} – ${hm(a.creneau.fin)}` : a.type === "repos" ? "Repos" : "Pas de créneau libre assez long aujourd'hui"}
      </p>
    </section>
  );
}

export function SportPage({ s, notify, onClose }: { s: SportView; notify: (t: string) => void; onClose: () => void }) {
  const [guide, setGuide] = useState(false);
  const a = s.aujourdhui;
  if (guide && a.blocs.length) return <SeanceGuidee s={s} notify={notify} onFin={() => setGuide(false)} />;
  return (
    <section className="sport" data-testid="sport">
      <div className="titre-ligne"><h1>Sport</h1><button className="lien" onClick={onClose}>← Retour</button></div>

      <div className="carte">
        <h2>Aujourd'hui : {a.titre}</h2>
        <p className="aide">
          {a.faite ? "Faite ✓" : a.creneau ? `Créneau : ${hm(a.creneau.debut)} – ${hm(a.creneau.fin)} (premier moment libre assez long, 20 min de marge autour des cours)` : a.type === "repos" ? "" : "Pas de créneau libre assez long aujourd'hui d'après l'emploi du temps."}
        </p>
        {a.blocs.length > 0 && (
          <>
            <ol className="sport-liste">
              {a.blocs.map((b) => (
                <li key={b.ex}><b>{b.nom}</b> : {cible(b, b.prescription, mesure(a.fiches[b.ex]?.mesure, a.fiches[b.ex]?.parHaltere))} · repos {mmss(b.repos)}{b.note ? <span className="aide"> · {b.note}</span> : null}</li>
              ))}
            </ol>
            <button className="bouton" data-testid="commencer" onClick={() => setGuide(true)}>{a.faite ? "Refaire / corriger la séance" : "Commencer la séance"}</button>
          </>
        )}
        {a.course && <Course s={s} notify={notify} />}
      </div>

      <Semaine s={s} notify={notify} />

      <div className="carte">
        <h2>Course : objectif 5 km</h2>
        <p>Estimation 5 km : <b>{duree(s.estimation.secondes)}</b> ({allure(s.estimation.secondes / 5)} /km), d'après {s.estimation.source}.</p>
        <p className="aide">Allures : facile {allure(s.allures.facile[0])}–{allure(s.allures.facile[1])} · seuil {allure(s.allures.seuil)} · fractionné {allure(s.allures.intervalle)} /km. Un test 5 km toutes les 4 semaines recale ces allures.</p>
        <Perfs s={s} notify={notify} />
      </div>

      <Charges s={s} notify={notify} />

      {s.historique.length > 0 && (
        <div className="carte">
          <h2>Dernières séances</h2>
          <ul className="historique-bilan">
            {s.historique.slice(0, 10).map((h) => (
              <li key={h.id}><b>{h.jour}</b> · {h.course ? `${h.course.distanceKm} km en ${duree(h.course.dureeS)} (${allure(h.course.dureeS / h.course.distanceKm)} /km)` : h.exercices.filter((e) => e.series.length).map((e) => `${e.bloc} ${e.series.map((x) => (x.charge ? `${x.charge}×${x.reps}` : x.reps)).join(", ")}`).join(" · ")}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

const mesure = (m?: string, parHaltere?: boolean): "kg" | "lest" | "corps" | "duree" => (m === "lest" ? "lest" : m === "duree" ? "duree" : m === "corps" ? "corps" : parHaltere ? "kg" : "kg");

// ----- Séance guidée --------------------------------------------------------------------------------------------

function SeanceGuidee({ s, notify, onFin }: { s: SportView; notify: (t: string) => void; onFin: () => void }) {
  const a = s.aujourdhui;
  const cle = `sport-en-cours-${a.jour}-${a.type}`;
  const [faites, setFaites] = useState<Record<string, SerieFaite[]>>(() => { try { return JSON.parse(localStorage.getItem(cle) ?? "{}"); } catch { return {}; } });
  const [i, setI] = useState(() => Math.max(0, a.blocs.findIndex((b) => (faites[b.ex]?.length ?? 0) < b.series)));
  const [repos, setRepos] = useState(0);
  const [fiche, setFiche] = useState(false);
  const fin = useRef(0);
  useEffect(() => { try { localStorage.setItem(cle, JSON.stringify(faites)); } catch { /* */ } }, [faites, cle]);
  useEffect(() => {
    if (repos <= 0) return;
    const t = setInterval(() => { const r = Math.round((fin.current - Date.now()) / 1000); setRepos(Math.max(0, r)); if (r <= 0) navigator.vibrate?.(300); }, 500);
    return () => clearInterval(t);
  }, [repos > 0]);

  const b: BlocVue | undefined = a.blocs[i];
  const ex = b ? a.fiches[b.ex] : undefined;
  const m = mesure(ex?.mesure, ex?.parHaltere);
  const series = b ? faites[b.ex] ?? [] : [];
  const reste = b ? b.series - series.length : 0;
  const [charge, setCharge] = useState("");
  const [reps, setReps] = useState("");
  useEffect(() => {
    if (!b) return;
    const last = series[series.length - 1];
    setCharge(String(last?.charge ?? b.prescription.charge));
    setReps(String(b.mode === "plage" ? b.plage![1] : b.prescription.reps));
  }, [i, series.length]);

  const terminer = async () => {
    const seance: SeanceFaite = { id: `${a.jour}-${a.type}`, jour: a.jour, type: a.type, exercices: a.blocs.map((x) => ({ bloc: x.ex, series: faites[x.ex] ?? [] })), at: Date.now() };
    try {
      const v = await api.sport.save(seance);
      try { localStorage.removeItem(cle); } catch { /* */ }
      const changements = v.charges.filter((c) => { const avant = a.blocs.find((x) => x.ex === c.bloc)?.prescription; return avant && (avant.charge !== c.prescription.charge || avant.reps !== c.prescription.reps); });
      notify(changements.length ? `Séance enregistrée. Prochaine fois : ${changements.map((c) => `${c.nom} ${c.unite === "reps" || c.unite === "s" ? `${c.prescription.reps} ${c.unite}` : `${c.prescription.charge} kg`}`).join(", ")}` : "Séance enregistrée. Mêmes charges la prochaine fois.");
      onFin();
    } catch (e) { notify(errText(e)); }
  };

  if (!b || !ex) {
    return (
      <section className="carte"><h2>Séance terminée</h2><p>Toutes les séries sont notées.</p>
        <div className="ligne"><button className="bouton" data-testid="terminer" onClick={terminer}>Enregistrer la séance</button><button className="lien" onClick={() => setI(0)}>Revoir</button></div>
      </section>
    );
  }

  const valider = () => {
    const r = Number(reps), c = Number(charge.replace(",", "."));
    if (!(r >= 0)) return;
    const next = { ...faites, [b.ex]: [...series, { charge: m === "kg" || m === "lest" ? c : 0, reps: r }] };
    setFaites(next);
    if (series.length + 1 < b.series) { fin.current = Date.now() + b.repos * 1000; setRepos(b.repos); }
    else { setRepos(0); setI(i + 1); }
  };

  return (
    <section className="carte seance" data-testid="seance-guidee">
      <div className="titre-ligne">
        <h2>{b.nom}</h2>
        <span className="aide">exercice {i + 1}/{a.blocs.length}</span>
      </div>
      <p className="aide">{ex.muscles}</p>
      <button className="lien" onClick={() => setFiche(!fiche)}>{fiche ? "Masquer" : "Comment ça marche et consignes"}</button>
      {fiche && (
        <div className="fiche">
          <p>{ex.explication}</p>
          <ul>{ex.consignes.map((x, k) => <li key={k}>{x}</li>)}</ul>
        </div>
      )}
      <p className="cible">Objectif : <b>{cible(b, b.prescription, m)}</b>{ex.parCote ? " (par côté)" : ""}{b.note ? ` · ${b.note}` : ""}</p>
      {repos > 0 ? (
        <div className="repos" data-testid="repos">
          <span className="repos-temps">{mmss(repos)}</span>
          <span>Repos · encore {reste} série{reste > 1 ? "s" : ""}</span>
          <button className="lien" onClick={() => setRepos(0)}>Passer le repos</button>
        </div>
      ) : (
        <div className="saisie">
          <p>Série {series.length + 1} sur {b.series}</p>
          <div className="ligne">
            {(m === "kg" || m === "lest") && <label className="champ-ligne">{m === "lest" ? "Lest (kg)" : ex.parHaltere ? "kg / haltère" : "Charge (kg)"}<input inputMode="decimal" style={{ width: 80 }} value={charge} onChange={(e) => setCharge(e.target.value)} /></label>}
            <label className="champ-ligne">{m === "duree" ? "Secondes" : "Reps"}<input inputMode="numeric" style={{ width: 70 }} value={reps} onChange={(e) => setReps(e.target.value)} data-testid="reps" /></label>
            <button className="bouton" data-testid="serie-faite" onClick={valider}>Série faite</button>
          </div>
        </div>
      )}
      {series.length > 0 && <p className="aide">Fait : {series.map((x) => (x.charge ? `${x.charge} × ${x.reps}` : x.reps)).join(" · ")}</p>}
      <div className="ligne">
        <button className="lien" onClick={() => { setRepos(0); setI(i + 1); }}>Exercice suivant</button>
        {i > 0 && <button className="lien" onClick={() => { setRepos(0); setI(i - 1); }}>Précédent</button>}
        <button className="lien" onClick={terminer}>Terminer et enregistrer</button>
        <button className="lien danger" onClick={onFin}>Quitter (la saisie est gardée)</button>
      </div>
    </section>
  );
}

// ----- Course -------------------------------------------------------------------------------------------------

function lireDuree(t: string): number {
  const p = t.trim().split(/[:h' ]+/).filter(Boolean).map(Number);
  if (p.some((x) => !Number.isFinite(x))) return NaN;
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 60;
}

function Course({ s, notify }: { s: SportView; notify: (t: string) => void }) {
  const a = s.aujourdhui;
  const c = a.course!;
  const [km, setKm] = useState(a.faite?.course ? String(a.faite.course.distanceKm) : c.distanceKm ? String(c.distanceKm) : "");
  const [t, setT] = useState(a.faite?.course ? mmss(a.faite.course.dureeS) : "");
  const [ressenti, setRessenti] = useState<"facile" | "correct" | "dur">(a.faite?.course?.ressenti ?? "correct");
  const enregistrerCourse = () => {
    const distanceKm = Number(km.replace(",", ".")), dureeS = lireDuree(t);
    if (!(distanceKm > 0) || !(dureeS > 0)) { notify("Indique la distance (km) et le temps (mm:ss ou h:mm:ss)."); return; }
    api.sport.save({ id: `${a.jour}-${a.type}`, jour: a.jour, type: a.type, exercices: [], course: { distanceKm, dureeS, ressenti }, at: Date.now() })
      .then(() => notify(`Course enregistrée : ${allure(dureeS / distanceKm)} /km${c.test ? ". Allures recalées sur ce test." : "."}`)).catch((e) => notify(errText(e)));
  };
  return (
    <>
      <ol className="sport-liste">{c.etapes.map((e, k) => <li key={k}>{e}</li>)}</ol>
      <div className="ligne">
        <label className="champ-ligne">Distance (km)<input inputMode="decimal" style={{ width: 70 }} value={km} onChange={(e) => setKm(e.target.value)} /></label>
        <label className="champ-ligne">Temps<input style={{ width: 90 }} placeholder="32:10" value={t} onChange={(e) => setT(e.target.value)} /></label>
        <select value={ressenti} onChange={(e) => setRessenti(e.target.value as typeof ressenti)}>
          <option value="facile">Facile</option><option value="correct">Correct</option><option value="dur">Dur</option>
        </select>
        <button className="bouton" onClick={enregistrerCourse}>{a.faite ? "Corriger" : "Enregistrer"}</button>
      </div>
    </>
  );
}

function Perfs({ s, notify }: { s: SportView; notify: (t: string) => void }) {
  const [titre, setTitre] = useState("");
  const [km, setKm] = useState("");
  const [t, setT] = useState("");
  const [jour, setJour] = useState("");
  const ajouter = () => {
    const distanceKm = Number(km.replace(",", ".")), dureeS = lireDuree(t);
    api.sport.addPerf({ id: `p${Date.now().toString(36)}`, jour: jour || null, distanceKm, dureeS, titre: titre || `${distanceKm} km` })
      .then(() => { setTitre(""); setKm(""); setT(""); setJour(""); notify("Performance ajoutée."); }).catch((e) => notify(errText(e)));
  };
  return (
    <>
      <ul className="historique-bilan">
        {s.perfs.map((p) => <li key={p.id}><b>{p.titre}</b>{p.jour ? ` (${p.jour})` : ""} : {p.distanceKm} km en {duree(p.dureeS)} · {allure(p.dureeS / p.distanceKm)} /km</li>)}
      </ul>
      <details>
        <summary className="lien">Ajouter une course ou un test</summary>
        <div className="ligne">
          <input placeholder="Nom (ex. 5 km du campus)" value={titre} onChange={(e) => setTitre(e.target.value)} />
          <input type="date" value={jour} onChange={(e) => setJour(e.target.value)} />
          <input inputMode="decimal" style={{ width: 70 }} placeholder="km" value={km} onChange={(e) => setKm(e.target.value)} />
          <input style={{ width: 90 }} placeholder="h:mm:ss" value={t} onChange={(e) => setT(e.target.value)} />
          <button className="bouton secondaire" onClick={ajouter}>Ajouter</button>
        </div>
      </details>
    </>
  );
}

// ----- Semaine modifiable -----------------------------------------------------------------------------------

const TYPES = Object.keys(NOMS_SEANCES) as TypeSeance[];

function Semaine({ s, notify }: { s: SportView; notify: (t: string) => void }) {
  const [edit, setEdit] = useState(false);
  const types = s.semaine.map((j) => j.type);
  const changer = (i: number, t: TypeSeance) => api.sport.setWeek(types.map((x, k) => (k === i ? t : x))).catch((e) => notify(errText(e)));
  return (
    <div className="carte" data-testid="semaine">
      <div className="titre-ligne">
        <h2>Semaine</h2>
        <button className="lien" onClick={() => setEdit(!edit)}>{edit ? "Fini" : "Modifier"}</button>
      </div>
      <ul className="routine-liste">
        {s.semaine.map((j, i) => (
          <li key={j.jour} className={j.faite ? "fait" : ""}>
            <span className="routine-heure">{JOURS[i]}</span>{" "}
            {edit ? (
              <select value={j.type} onChange={(e) => changer(i, e.target.value as TypeSeance)} aria-label={`Séance du ${JOURS[i]}`}>
                {TYPES.map((t) => <option key={t} value={t}>{NOMS_SEANCES[t]}</option>)}
              </select>
            ) : <span className="routine-titre">{j.titre}</span>}
            <span className="aide"> {j.faite ? "✓" : j.creneau ? `· ${hm(j.creneau.debut)}` : ""}</span>
          </li>
        ))}
      </ul>
      {edit && s.semainePerso && <button className="lien" onClick={() => api.sport.setWeek(null).then(() => notify("Programme de départ rétabli.")).catch((e) => notify(errText(e)))}>Revenir au programme de départ</button>}
    </div>
  );
}

// ----- Charges : + / − et réglages de chaque exercice ---------------------------------------------------------

type Charge = SportView["charges"][number];
const nb = (x: number) => String(x).replace(".", ",");
const valeurCharge = (c: Charge) => (c.enCharge ? c.prescription.charge : c.prescription.reps);
const uniteCourte = (c: Charge) => (c.enCharge ? (c.unite === "kg de lest" ? "kg de lest" : c.unite === "kg par haltère" ? "kg / haltère" : "kg") : c.unite);

function Charges({ s, notify }: { s: SportView; notify: (t: string) => void }) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const bouger = (c: Charge, sens: 1 | -1) => {
    const v = Math.max(0, Math.round((valeurCharge(c) + sens * c.pas) * 100) / 100);
    const a = { id: `a${Date.now().toString(36)}`, bloc: c.bloc, at: Date.now(), ...(c.enCharge ? { charge: v } : { reps: Math.max(1, v) }) };
    api.sport.adjust(a).then(() => notify(`${c.nom} : ${nb(c.enCharge ? v : Math.max(1, v))} ${uniteCourte(c)} à la prochaine séance.`)).catch((e) => notify(errText(e)));
  };
  return (
    <div className="carte" data-testid="charges">
      <h2>Charges actuelles</h2>
      <table className="table-charges">
        <tbody>
          {s.charges.map((c) => (
            <ChargeLigne key={c.bloc} c={c} ouvert={ouvert === c.bloc} onOuvrir={() => setOuvert(ouvert === c.bloc ? null : c.bloc)} onBouger={(x) => bouger(c, x)} notify={notify} />
          ))}
        </tbody>
      </table>
      <p className="aide">
        + / − : change la charge de la prochaine séance (du pas réglé pour l'exercice). Réussi (toutes les séries) → + l'incrément, jusqu'au maximum s'il y en a un.
        Deux séances ratées de suite → −5 %. « Modifier » : départ, maximum, incrément, séries, reps, repos.
      </p>
    </div>
  );
}

function ChargeLigne({ c, ouvert, onOuvrir, onBouger, notify }: { c: Charge; ouvert: boolean; onOuvrir: () => void; onBouger: (sens: 1 | -1) => void; notify: (t: string) => void }) {
  const v = valeurCharge(c);
  const atteint = c.max !== null && v >= c.max;
  return (
    <>
      <tr data-testid={`charge-${c.bloc}`}>
        <td>{c.nom}</td>
        <td className="charge-valeur">
          <button className="bouton secondaire petit" aria-label={`Baisser ${c.nom}`} onClick={() => onBouger(-1)} disabled={c.enCharge ? v <= 0 : v <= 1}>−</button>
          <b>{nb(v)}</b> {uniteCourte(c)}
          <button className="bouton petit" aria-label={`Monter ${c.nom}`} onClick={() => onBouger(1)}>+</button>
        </td>
        <td className="aide">
          départ {nb(c.depart)}{c.max !== null ? ` → max ${nb(c.max)}` : ""} · ±{nb(c.pas)}{atteint ? " · max atteint" : ""}{c.prescription.echecs ? " · 1 séance ratée" : ""}
        </td>
        <td><button className="lien" onClick={onOuvrir}>{ouvert ? "Fermer" : "Modifier"}</button></td>
      </tr>
      {ouvert && <tr><td colSpan={4}><EditeurBloc c={c} notify={notify} onFin={onOuvrir} /></td></tr>}
    </>
  );
}

function EditeurBloc({ c, notify, onFin }: { c: Charge; notify: (t: string) => void; onFin: () => void }) {
  const b = c.config;
  const [f, setF] = useState(() => ({
    depart: nb(c.depart), max: c.max !== null ? nb(c.max) : "", increment: nb(b.increment ?? (c.enCharge ? 2.5 : 1)), series: String(b.series),
    reps: String(b.reps ?? ""), min: String(b.plage?.[0] ?? ""), maxi: String(b.plage?.[1] ?? ""), repos: String(b.repos),
  }));
  const num = (t: string) => (t.trim() === "" ? undefined : Number(t.replace(",", ".")));
  const enregistrer = () => {
    const r: BlocReglage = {
      depart: num(f.depart), max: num(f.max), series: num(f.series), repos: num(f.repos),
      ...(c.enCharge ? { increment: num(f.increment) } : {}),
      ...(b.mode === "fixe" ? { reps: num(f.reps) } : {}),
      ...(b.mode === "plage" ? { plage: [num(f.min) ?? 0, num(f.maxi) ?? 0] as [number, number] } : {}),
    };
    api.sport.configure(c.bloc, r).then(() => { notify(`${c.nom} : réglages enregistrés.`); onFin(); }).catch((e) => notify(errText(e)));
  };
  const champ = (k: keyof typeof f, label: string, w = 70) => (
    <label className="champ-ligne">{label}<input inputMode="decimal" style={{ width: w }} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  );
  const u = c.enCharge ? "kg" : b.mode === "maintien" ? "s" : "reps";
  return (
    <div className="editeur" data-testid={`editeur-${c.bloc}`}>
      <div className="ligne" style={{ flexWrap: "wrap" }}>
        {champ("depart", `Départ (${u})`)}
        {champ("max", `Maximum (${u})`)}
        {c.enCharge && champ("increment", "Incrément (kg)")}
        {champ("series", "Séries", 55)}
        {b.mode === "fixe" && champ("reps", "Reps", 55)}
        {b.mode === "plage" && <>{champ("min", "Reps min", 55)}{champ("maxi", "Reps max", 55)}</>}
        {champ("repos", "Repos (s)")}
      </div>
      <p className="aide">
        Le départ et l'incrément recalculent toute la progression depuis le début. {c.enCharge ? "Au maximum, la charge ne monte plus." : "Au maximum, les reps ou secondes ne montent plus."} Laisse « Maximum » vide pour ne pas en avoir.
      </p>
      <div className="ligne">
        <button className="bouton" onClick={enregistrer}>Enregistrer</button>
        {c.reglage && <button className="lien" onClick={() => api.sport.configure(c.bloc, null).then(() => { notify(`${c.nom} : réglages de départ rétablis.`); onFin(); }).catch((e) => notify(errText(e)))}>Réglages de départ</button>}
        <button className="lien" onClick={onFin}>Annuler</button>
      </div>
    </div>
  );
}
