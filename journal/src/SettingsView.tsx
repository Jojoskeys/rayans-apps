import { useEffect, useState } from "react";
import { api, texteErreur, type EtatVue, type Reglages } from "./api";
import { Confirm } from "./Confirm";
import { local, pluriel, taille } from "./format";

const lignes = (l: string[]) => l.join("\n");
const liste = (t: string) => t.split("\n").map((s) => s.trim()).filter(Boolean);

export function SettingsView(p: {
  etat: EtatVue;
  brouillon: Reglages;
  setBrouillon: (r: Reglages) => void;
  appliquer: (e: EtatVue) => void;
  onActiver: () => void;
}) {
  const b = p.brouillon;
  const maj = (m: Partial<Reglages>) => p.setBrouillon({ ...b, ...m });
  const majSecrets = (m: Partial<Reglages["secrets"]>) => maj({ secrets: { ...b.secrets, ...m } });
  const [erreur, setErreur] = useState<string | null>(null);
  const [desactiver, setDesactiver] = useState(false);
  const s = p.etat.statistiques;
  const actif = p.etat.reglages.collecteActive;

  const action = async (f: () => Promise<EtatVue>) => {
    setErreur(null);
    try {
      p.appliquer(await f());
    } catch (e) {
      setErreur(texteErreur(e));
    }
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Réglages</h1>
          <p className="muted">Ce qui est enregistré, où, combien de temps, et ce qui n’est jamais gardé.</p>
        </div>
      </header>
      {erreur && <div className="alert bad">{erreur}</div>}

      <div className="card">
        <div className="row">
          <h2>Collecte du journal d’activité</h2>
          <span className={"tag " + (actif ? "good" : "")} style={{ marginLeft: "auto" }}>
            {actif ? (p.etat.enPause ? "en pause" : "active") : "désactivée"}
          </span>
        </div>
        <p className="small muted">
          {actif
            ? "Collecte active tant que l’application tourne. Fermer la fenêtre la range près de l’horloge ; « Quitter » dans ce menu arrête tout."
            : "Aucune donnée d’activité n’est collectée. L’archive des conversations fonctionne sans la collecte."}
        </p>
        <div className="row wrap">
          {actif ? (
            <>
              {p.etat.enPause ? (
                <button className="btn primary" onClick={() => action(api.reprendre)}>Reprendre</button>
              ) : (
                <>
                  <button className="btn" onClick={() => action(() => api.pause(15))}>Pause 15 min</button>
                  <button className="btn" onClick={() => action(() => api.pause(60))}>Pause 1 h</button>
                  <button className="btn" onClick={() => action(() => api.pause(null))}>Pause jusqu’à reprise</button>
                </>
              )}
              <button className="btn danger" style={{ marginLeft: "auto" }} onClick={() => setDesactiver(true)}>Désactiver la collecte…</button>
            </>
          ) : (
            <button className="btn primary" onClick={p.onActiver}>Activer la collecte…</button>
          )}
        </div>
        <div className="grid3" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          <Case l="Programmes ouverts et fermés (tous, avec ou sans fenêtre)" v={b.applications} on={(v) => maj({ applications: v })} />
          <Case l="Fenêtre active et titre" v={b.fenetres} on={(v) => maj({ fenetres: v })} />
          <Case l="Fichiers des dossiers choisis" v={b.fichiers} on={(v) => maj({ fichiers: v })} />
          <Case l="Session, veille, démarrage et arrêt" v={b.session} on={(v) => maj({ session: v })} />
          <Case l="Sécurité des programmes (signature, démarrage auto, Defender)" v={b.securite} on={(v) => maj({ securite: v })} />
        </div>
        <label className="check">
          <input type="checkbox" checked={b.raccourciPause} onChange={(e) => maj({ raccourciPause: e.target.checked })} />
          Raccourci {p.etat.raccourci} pour mettre en pause ou reprendre, depuis n’importe quelle application
        </label>
        <label className="check">
          <input type="checkbox" checked={p.etat.demarrageAuto} onChange={(e) => action(() => api.demarrageAuto(e.target.checked))} />
          Lancer Rayan’s Journal à l’ouverture de session (en arrière-plan, près de l’horloge)
        </label>
        <div className="row small muted">
          Relevé des applications toutes les
          <input className="inline" type="number" min={1} max={60} value={b.intervalleProcessusS} onChange={(e) => maj({ intervalleProcessusS: Math.max(1, Number(e.target.value) || 2) })} />
          s (précision de l’heure de fermeture).
        </div>
      </div>

      <div className="card">
        <h2>Temps d’écran et absence</h2>
        <div className="row small">
          Considérer le PC inutilisé après
          <input className="inline" type="number" min={1} max={120} value={b.seuilInactiviteMin} onChange={(e) => maj({ seuilInactiviteMin: Math.max(1, Number(e.target.value) || 5) })} />
          min sans clavier ni souris <span className="muted">(une vidéo regardée sans bouger compte comme une pause)</span>
        </div>
        <label className="check">
          <input type="checkbox" checked={b.heuresCalmes} onChange={(e) => maj({ heuresCalmes: e.target.checked })} />
          M’alerter si le PC est utilisé entre
          <input className="inline" type="number" min={0} max={23} value={b.calmeDebutH} onChange={(e) => maj({ calmeDebutH: Math.min(23, Math.max(0, Number(e.target.value) || 0)) })} />
          h et
          <input className="inline" type="number" min={0} max={23} value={b.calmeFinH} onChange={(e) => maj({ calmeFinH: Math.min(23, Math.max(0, Number(e.target.value) || 0)) })} />
          h
        </label>
        <p className="small muted">
          « Je m’absente » (barre de gauche ou icône près de l’horloge) signale toute utilisation jusqu’à ton retour : déverrouillage, fenêtre ouverte,
          clavier ou souris. Une notification au plus toutes les 30 minutes, et un résumé à ton retour.
        </p>
      </div>

      <ProjetsReglages projets={b.projets} onChange={(projets) => maj({ projets })} />

      <div className="card">
        <h2>Dossiers suivis</h2>
        <ul className="folders">
          {b.dossiers.map((d) => (
            <li key={d}>
              <span className="path">{d}</span>
              <button className="icon-btn" title="Retirer" onClick={() => maj({ dossiers: b.dossiers.filter((x) => x !== d) })}>✕</button>
            </li>
          ))}
        </ul>
        <div className="row">
          <button
            className="btn small"
            onClick={async () => {
              const d = await api.choisirDossier("Dossier à suivre");
              if (d && !b.dossiers.includes(d)) maj({ dossiers: [...b.dossiers, d] });
            }}
          >
            Ajouter un dossier…
          </button>
        </div>
        <label className="field">
          <span className="field-label">Ignorés partout (un par ligne, * et ? acceptés)</span>
          <ListeTexte valeur={b.ignores} onChange={(v) => maj({ ignores: v })} />
        </label>
      </div>

      <div className="card">
        <h2>Secrets : jamais enregistrés</h2>
        <p className="small muted">
          Le clavier n’est jamais lu : mots de passe et codes tapés ne peuvent pas entrer dans le journal. Ces règles filtrent aussi ce que Windows affiche
          dans les titres de fenêtres et les noms de fichiers. Les codes de 6 à 8 chiffres et les longs jetons sont remplacés par « •••••• ».
        </p>
        <label className="field">
          <span className="field-label">Titres de fenêtres</span>
          <select value={b.secrets.titres} onChange={(e) => majSecrets({ titres: e.target.value as "complet" | "appli" })}>
            <option value="complet">Garder le titre (filtré)</option>
            <option value="appli">Ne garder que le nom du programme</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Programmes dont le titre n’est jamais gardé</span>
          <ListeTexte valeur={b.secrets.applisExclues} onChange={(v) => majSecrets({ applisExclues: v })} />
        </label>
        <label className="field">
          <span className="field-label">Mots qui font masquer tout le titre</span>
          <ListeTexte valeur={b.secrets.motsSensibles} onChange={(v) => majSecrets({ motsSensibles: v })} />
        </label>
        <label className="field">
          <span className="field-label">Fichiers et dossiers dont le nom est masqué</span>
          <ListeTexte valeur={b.secrets.fichiersSensibles} onChange={(v) => majSecrets({ fichiersSensibles: v })} />
        </label>
      </div>

      <div className="card">
        <h2>Conservation</h2>
        <div className="row small">
          Journal d’activité : garder
          <input className="inline" type="number" min={0} value={b.conservationJournalJours} onChange={(e) => maj({ conservationJournalJours: Math.max(0, Number(e.target.value) || 0) })} />
          jours <span className="muted">(0 = sans limite)</span>
        </div>
        <div className="row small">
          Conversations : garder les messages envoyés depuis moins de
          <input className="inline" type="number" min={0} value={b.conservationMessagesJours} onChange={(e) => maj({ conservationMessagesJours: Math.max(0, Number(e.target.value) || 0) })} />
          jours <span className="muted">(0 = sans limite)</span>
        </div>
        <p className="small muted">Appliquée au démarrage puis toutes les 6 heures. Les données retirées sont effacées de la base (écrasement des pages libérées).</p>
        <div className="row">
          <button className="btn small" onClick={() => action(api.appliquerConservation)}>Appliquer maintenant</button>
        </div>
      </div>

      <div className="card">
        <h2>Archive</h2>
        <p className="small muted">
          Base SQLite dont chaque contenu est chiffré (XChaCha20-Poly1305). La clé est protégée par ton compte Windows (DPAPI) : copier le dossier sur un
          autre PC ou un autre compte ne permet pas de le lire. Pour une copie lisible ailleurs, utilise « Exporter » (JSON + HTML, non chiffré).
        </p>
        {s && (
          <div className="stats">
            <div className="stat"><div className="stat-value">{s.evenements.toLocaleString("fr-FR")}</div><div className="small muted">événements</div></div>
            <div className="stat"><div className="stat-value">{s.messages.toLocaleString("fr-FR")}</div><div className="small muted">messages</div></div>
            <div className="stat"><div className="stat-value">{s.conversations.toLocaleString("fr-FR")}</div><div className="small muted">conversations</div></div>
            <div className="stat"><div className="stat-value">{taille(s.tailleOctets)}</div><div className="small muted">sur le disque</div></div>
          </div>
        )}
        {s?.premierEvenementMs && <p className="small muted">Premier événement : {local(s.premierEvenementMs)}.</p>}
        <div className="row">
          <span className="path muted">{p.etat.dossier}</span>
          <button className="btn small" onClick={() => api.ouvrirDossier(p.etat.dossier)}>Ouvrir</button>
        </div>
      </div>

      {desactiver && (
        <Confirm
          title="Désactiver la collecte ?"
          confirmLabel="Désactiver"
          onCancel={() => setDesactiver(false)}
          onConfirm={() => {
            setDesactiver(false);
            action(() => api.activerCollecte(false));
          }}
        >
          <p>Plus rien ne sera enregistré dans le journal. Les {s ? pluriel(s.evenements, "événement") : "événements"} déjà enregistrés restent dans l’archive (supprimés selon la durée de conservation).</p>
        </Confirm>
      )}
    </section>
  );
}

function ProjetsReglages(p: { projets: Reglages["projets"]; onChange: (v: Reglages["projets"]) => void }) {
  const [info, setInfo] = useState<string | null>(null);
  const maj = (i: number, v: Partial<Reglages["projets"][0]>) => p.onChange(p.projets.map((x, j) => (j === i ? { ...x, ...v } : x)));
  return (
    <div className="card">
      <h2>Projets (temps d’après les fenêtres)</h2>
      <p className="small muted">
        Le temps passé dans une fenêtre dont le titre ou le programme contient un des mots-clés est compté pour le projet (le premier projet qui correspond
        l’emporte). Comparé, dans « Mes journées », au temps enregistré dans Rayan’s Chrono.
      </p>
      {p.projets.map((x, i) => (
        <div key={i} className="row">
          <input style={{ maxWidth: 200 }} value={x.projet} placeholder="Projet" onChange={(e) => maj(i, { projet: e.target.value })} />
          <input value={x.mots.join(", ")} placeholder="mots-clés séparés par des virgules (ex. mémoire, stage)" onChange={(e) => maj(i, { mots: e.target.value.split(",").map((s) => s.trimStart()) })} />
          <button className="icon-btn" title="Retirer" onClick={() => p.onChange(p.projets.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="row">
        <button className="btn small" onClick={() => p.onChange([...p.projets, { projet: "", mots: [] }])}>Ajouter un projet</button>
        <button
          className="btn small ghost"
          onClick={async () => {
            const noms = await api.chronoProjets();
            const neufs = noms.filter((n) => !p.projets.some((x) => x.projet.toLowerCase() === n.toLowerCase()));
            p.onChange([...p.projets, ...neufs.map((n) => ({ projet: n, mots: [n] }))]);
            setInfo(noms.length ? `${neufs.length} projet(s) repris de Rayan’s Chrono (mot-clé : leur nom, à compléter).` : "Aucun projet trouvé dans Rayan’s Chrono.");
          }}
        >
          Reprendre les projets de Rayan’s Chrono
        </button>
      </div>
      {info && <p className="small muted">{info}</p>}
    </div>
  );
}

function Case(p: { l: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={p.v} onChange={(e) => p.on(e.target.checked)} />
      {p.l}
    </label>
  );
}

/** Une valeur par ligne ; le texte reste libre pendant la saisie et n'est découpé qu'à la sortie du champ. */
function ListeTexte(p: { valeur: string[]; onChange: (v: string[]) => void }) {
  const [texte, setTexte] = useState(lignes(p.valeur));
  useEffect(() => {
    if (JSON.stringify(liste(texte)) !== JSON.stringify(p.valeur)) setTexte(lignes(p.valeur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.valeur]);
  return (
    <textarea
      value={texte}
      onChange={(e) => {
        setTexte(e.target.value);
        p.onChange(liste(e.target.value));
      }}
      onBlur={() => setTexte(lignes(liste(texte)))}
    />
  );
}
