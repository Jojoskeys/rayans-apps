// Panneaux « Place sur le disque », « Coller en texte brut » et « Renommer d'après le contenu ».
import { useEffect, useState } from "react";
import { formatSize } from "../core/commands.ts";
import { part } from "../core/disque.ts";
import type { Dossier, Goto, PropositionNom, State } from "./api-types.ts";
import { api, DropZone, errText } from "./shared.tsx";

type Props = { s: State; goto: Goto | null; notify: (t: string) => void };

const accel = (k: string) => k.replace("Control", "Ctrl").replace("Super", "Win").split("+").join(" + ");

// ----- Place sur le disque ------------------------------------------------------------------------

export function OutilDisque({ notify }: Props) {
  const [arbre, setArbre] = useState<Dossier | null>(null);
  const [chemin, setChemin] = useState<Dossier[]>([]);
  const [progres, setProgres] = useState<{ dossiers: number; octets: number } | null>(null);
  useEffect(() => api.onMeasureProgress(setProgres), []);
  const mesurer = async (racine: string | null) => {
    setArbre(null); setChemin([]); setProgres({ dossiers: 0, octets: 0 });
    try { const a = await api.measureFolder(racine); if (a) { setArbre(a); setChemin([a]); } }
    catch (e) { notify(errText(e)); }
    finally { setProgres(null); }
  };
  const courant = chemin.at(-1) ?? null;
  return (
    <section className="outil">
      <header className="entete">
        <div><h1>Place sur le disque</h1><p className="aide">Les dossiers qui prennent le plus de place. Clique sur un dossier pour voir ce qu'il contient.</p></div>
      </header>
      <div className="barre">
        <button className="bouton" disabled={!!progres} onClick={() => void mesurer(null)}>Mesurer mon dossier personnel</button>
        <button className="bouton secondaire" disabled={!!progres} onClick={async () => { const d = await api.pickFolder(); if (d) void mesurer(d); }}>Choisir un dossier ou un disque…</button>
        {progres && <button className="bouton secondaire" onClick={() => api.cancelMeasure()}>Arrêter</button>}
      </div>
      {progres && <p className="aide" data-testid="disque-progres">Mesure… {progres.dossiers.toLocaleString("fr-FR")} dossiers, {formatSize(progres.octets)}</p>}
      {courant && (
        <div className="carte pile">
          <div className="fil">
            {chemin.map((d, i) => (
              <span key={d.chemin}>{i > 0 && " › "}<button className="lien" onClick={() => setChemin(chemin.slice(0, i + 1))}>{d.nom}</button></span>
            ))}
          </div>
          <p className="aide">{formatSize(courant.taille)} · {courant.fichiers.toLocaleString("fr-FR")} fichiers{courant.ici > 0 ? ` · ${formatSize(courant.ici)} de fichiers posés directement ici` : ""}</p>
          <ul className="liste-disque" data-testid="disque">
            {courant.enfants.map((e) => (
              <li key={e.chemin}>
                <button className="lien-titre" disabled={!e.enfants.length} onClick={() => setChemin([...chemin, e])} title={e.chemin}>{e.nom}</button>
                <span className="jauge"><span style={{ width: `${Math.max(1, part(e.taille, courant.taille))}%` }} /></span>
                <span className="taille">{formatSize(e.taille)}</span>
                <span className="pourcent">{part(e.taille, courant.taille)} %</span>
                <button className="lien" onClick={() => api.openPath(e.chemin)}>Ouvrir</button>
              </li>
            ))}
            {!courant.enfants.length && <li className="aide">Pas de sous-dossier.</li>}
          </ul>
        </div>
      )}
    </section>
  );
}

// ----- Coller en texte brut -----------------------------------------------------------------------

const RACCOURCIS_BRUT = ["Control+Alt+V", "Control+Shift+V", "Control+Alt+B", ""];

export function OutilBrut({ s, notify }: Props) {
  const r = s.settings.brutShortcut;
  return (
    <section className="outil">
      <header><h1>Coller en texte brut</h1><p className="aide">Colle le texte copié sans sa police, ses couleurs ni ses liens. Pratique pour copier depuis le web vers un devoir, un mail ou une note.</p></header>
      <div className="carte pile">
        <label className="champ-ligne">Raccourci
          <select value={r} onChange={async (e) => {
            const st = await api.updateSettings({ brutShortcut: e.target.value });
            notify(!st.settings.brutShortcut ? "Raccourci désactivé." : st.brutOk ? `Raccourci : ${accel(st.settings.brutShortcut)}` : `${accel(st.settings.brutShortcut)} est déjà pris par une autre application.`);
          }}>
            {RACCOURCIS_BRUT.map((k) => <option key={k} value={k}>{k ? accel(k) : "Désactivé"}</option>)}
          </select>
        </label>
        {r && !s.brutOk && <p className="erreur">Ce raccourci est pris par une autre application : choisis-en un autre.</p>}
        {r && s.brutOk && <p className="aide">Copie comme d'habitude, puis appuie sur <b>{accel(r)}</b> à la place de Ctrl + V.</p>}
        <button className="bouton secondaire" onClick={async () => notify((await api.plainClipboard()) ? "Presse-papiers en texte brut : colle avec Ctrl + V." : "Le presse-papiers ne contient pas de texte.")}>Nettoyer le presse-papiers maintenant</button>
      </div>
    </section>
  );
}

// ----- Renommer d'après le contenu ---------------------------------------------------------------

export function OutilNomme({ notify }: Props) {
  const [props, setProps] = useState<PropositionNom[] | null>(null);
  const [noms, setNoms] = useState<Record<string, string>>({});
  const [coches, setCoches] = useState<Record<string, boolean>>({});
  const [lecture, setLecture] = useState(false);
  const [annulable, setAnnulable] = useState(false);
  const lire = async (fichiers: string[]) => {
    if (!fichiers.length) return;
    setLecture(true); setProps(null);
    try {
      const p = await api.proposeNames(fichiers);
      setProps(p);
      setNoms(Object.fromEntries(p.map((x) => [x.chemin, x.propose ?? ""])));
      setCoches(Object.fromEntries(p.map((x) => [x.chemin, !!x.propose])));
    } catch (e) { notify(errText(e)); } finally { setLecture(false); }
  };
  const choix = (props ?? []).filter((p) => coches[p.chemin] && noms[p.chemin]?.trim()).map((p) => ({ chemin: p.chemin, nom: noms[p.chemin] }));
  return (
    <section className="outil">
      <header><h1>Renommer d'après le contenu</h1><p className="aide">Windows lit le texte de chaque scan, photo ou PDF (première page) et propose un nom clair. Rien n'est renommé avant que tu valides, et tu peux annuler.</p></header>
      <DropZone label={lecture ? "Lecture du texte…" : "Dépose des scans, photos ou PDF"} accept={["jpg", "jpeg", "png", "bmp", "tif", "tiff", "heic", "gif", "pdf"]} onFiles={(f) => void lire(f)} onPick={async () => void lire(await api.pickFiles("pdf", true))} />
      {annulable && <div className="barre"><button className="bouton secondaire" onClick={async () => { const n = await api.undoRename(); setAnnulable(false); notify(`${n} fichier(s) remis à leur ancien nom.`); }}>Annuler le dernier renommage</button></div>}
      {props && (
        <div className="carte pile" data-testid="nomme">
          <ul className="liste-nomme">
            {props.map((p) => (
              <li key={p.chemin}>
                <input type="checkbox" checked={!!coches[p.chemin]} disabled={!noms[p.chemin]?.trim()} onChange={(e) => setCoches({ ...coches, [p.chemin]: e.target.checked })} aria-label={`Renommer ${p.actuel}`} />
                <div className="principal">
                  <small>{p.actuel}</small>
                  <input value={noms[p.chemin] ?? ""} placeholder="Nouveau nom" onChange={(e) => { setNoms({ ...noms, [p.chemin]: e.target.value }); setCoches({ ...coches, [p.chemin]: !!e.target.value.trim() }); }} />
                  {p.erreur ? <small className="erreur">{p.erreur}</small> : p.extrait && <small title={p.extrait}>« {p.extrait.slice(0, 90)}{p.extrait.length > 90 ? "…" : ""} »</small>}
                </div>
              </li>
            ))}
          </ul>
          <button className="bouton" disabled={!choix.length} onClick={async () => {
            try {
              const faits = await api.renameFiles(choix);
              setAnnulable(faits.length > 0); setProps(null);
              notify(`${faits.length} fichier(s) renommé(s).`);
            } catch (e) { notify(errText(e)); }
          }}>Renommer {choix.length} fichier{choix.length > 1 ? "s" : ""}</button>
        </div>
      )}
    </section>
  );
}
