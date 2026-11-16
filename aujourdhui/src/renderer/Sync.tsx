// Réglages : synchronisation avec l'iPhone (Rayan's Mobile) par un dépôt GitHub privé.
import { useState } from "react";
import type { SyncView } from "./api-types.ts";

const api = window.aujourdhui;
const errText = (e: unknown) => String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

export function SyncSettings({ v, notify }: { v: SyncView; notify: (t: string) => void }) {
  const [repo, setRepo] = useState(v.repo || "Jojoskeys/rayans-donnees");
  const [token, setToken] = useState("");
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  if (!api.sync) return null;
  const save = async () => {
    setBusy(true);
    try { await api.sync!.configure(repo, token, phrase); setToken(""); setPhrase(""); notify("Synchronisation configurée : première synchro en cours."); } catch (e) { notify(errText(e)); } finally { setBusy(false); }
  };
  return (
    <div className="carte" data-testid="reglages-synchro">
      <h2>Synchronisation avec l'iPhone</h2>
      <p className="aide">
        Révision, Hifz, Chrono, Prière, Ouvertures, Ma journée et les cours passent par un <b>dépôt GitHub privé</b>
        (un fichier par app), <b>chiffrés de bout en bout</b> sur ce PC avec ta phrase secrète (GitHub ne voit que du contenu
        illisible), et sont fusionnés avec ceux de l'iPhone : rien n'est écrasé. Une app ouverte est synchronisée
        après sa fermeture. Synchro au démarrage, à l'ouverture de cette fenêtre et toutes les 15 minutes.
      </p>
      <p className="aide">Jeton : sur github.com, Settings → Developer settings → Fine-grained tokens, accès au seul dépôt rayans-donnees,
        permission <b>Contents : Read and write</b>. Il est chiffré avec ton compte Windows et n'est envoyé qu'à GitHub.</p>
      <div className="ligne">
        <input className="large" value={repo} onChange={(e) => setRepo(e.target.value)} spellCheck={false} />
      </div>
      <div className="ligne">
        <input className="large" type="password" autoComplete="off" spellCheck={false} placeholder={v.configured ? "jeton déjà enregistré (laisser vide pour le garder)" : "github_pat_…"} value={token} onChange={(e) => setToken(e.target.value)} />
      </div>
      <div className="ligne">
        <input className="large" type="password" autoComplete="off" spellCheck={false} placeholder={v.configured ? "phrase secrète déjà enregistrée (laisser vide pour la garder)" : "phrase secrète : plusieurs mots, 12 caractères au moins"} value={phrase} onChange={(e) => setPhrase(e.target.value)} />
        <button className="bouton" disabled={busy || (!v.configured && (!token || !phrase))} onClick={save}>{busy ? "Vérification…" : "Enregistrer"}</button>
      </div>
      <p className="aide avertissement">La même phrase sur le PC et l'iPhone. Note-la quelque part de sûr : <b>sans elle, les données synchronisées ne peuvent pas être relues</b>. Les données déjà sur chaque appareil restent intactes.</p>
      {v.configured && (
        <>
          <p className="aide" data-testid="synchro-etat">
            {v.state === "en-cours" ? v.message : v.lastSync ? `Dernière synchro : ${new Date(v.lastSync).toLocaleString("fr-FR")}` : "Pas encore synchronisé"}
            {v.state === "erreur" ? ` · ${v.message}` : ""}
          </p>
          {v.details.length > 0 && <ul className="aide synchro-details">{v.details.map((d) => <li key={d.name}><b>{d.name}</b> : {d.result}</li>)}</ul>}
          <div className="ligne">
            <button className="bouton secondaire" disabled={v.state === "en-cours"} onClick={() => api.sync!.now().catch((e) => notify(errText(e)))}>Synchroniser maintenant</button>
            <button className="lien danger" onClick={() => { if (confirm("Oublier le jeton sur ce PC ? Les données restent en place.")) void api.sync!.forget(); }}>Oublier le jeton et la clé</button>
          </div>
        </>
      )}
    </div>
  );
}
