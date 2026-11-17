// Réglages de la lecture automatique des mails de la fac (boîte Partage, IMAP en lecture seule).
import { useState } from "react";
import type { CourrierView } from "./api-types.ts";

const api = window.aujourdhui;
const errText = (e: unknown) => String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
const quand = (ms: number) => (ms ? new Date(ms).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "jamais");

export function CourrierReglages({ c, expediteurs, notify }: { c: CourrierView; expediteurs: string[]; notify: (t: string) => void }) {
  const [host, setHost] = useState(c.host);
  const [port, setPort] = useState(String(c.port));
  const [user, setUser] = useState(c.user);
  const [mdp, setMdp] = useState("");
  const [occupe, setOccupe] = useState(false);
  const courrier = api.courrier!;
  const enregistrer = async () => {
    setOccupe(true);
    try {
      const r = await courrier.configure({ host, port: Number(port), user, motDePasse: mdp || undefined });
      setMdp("");
      notify(`Connexion réussie (${r.messagesDansLaBoite} mails dans la boîte). Lecture automatique activée.`);
    } catch (e) { notify(errText(e)); } finally { setOccupe(false); }
  };
  return (
    <div className="carte" data-testid="courrier">
      <h2>Mails de la fac : lecture automatique</h2>
      <p className="aide">
        Toutes les 15 minutes, l'application lit ta boîte Partage <b>en lecture seule</b> (les mails restent non lus, rien n'est déplacé ni supprimé).
        Seuls les mails des expéditeurs de la liste ci-dessus ({expediteurs.length ? expediteurs.join(", ") : "liste vide : ajoute tes profs et le secrétariat"}) sont
        ouverts. Un changement de salle, d'horaire ou une annulation sur un cours reconnu est appliqué directement à ton emploi du temps, avec une
        notification ; le reste est proposé à valider.
      </p>
      <div className="ligne">
        <label className="champ-ligne">Serveur <input value={host} onChange={(e) => setHost(e.target.value)} /></label>
        <label className="champ-ligne">Port <input style={{ width: 70 }} value={port} onChange={(e) => setPort(e.target.value)} /></label>
      </div>
      <label className="champ-ligne">Identifiant Sésame <input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" /></label>
      <label className="champ-ligne">Mot de passe
        <input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} autoComplete="current-password" placeholder={c.motDePasseEnregistre ? "enregistré (laisser vide pour le garder)" : ""} />
      </label>
      <p className="aide">
        Le mot de passe est chiffré par Windows (lié à ton compte), jamais affiché, jamais envoyé ailleurs qu'au serveur de la fac, et pas synchronisé avec
        l'iPhone. Il donne accès à toute ta boîte : l'application ne s'en sert que pour lire.
      </p>
      <div className="ligne">
        <button className="bouton" disabled={occupe || !user || (!mdp && !c.motDePasseEnregistre)} onClick={enregistrer}>{occupe ? "Connexion…" : "Tester et activer"}</button>
        {c.motDePasseEnregistre && (
          <>
            <label className="case"><input type="checkbox" checked={c.actif} onChange={(e) => courrier.setActive(e.target.checked).catch((x) => notify(errText(x)))} /><span>Activée</span></label>
            <button className="lien" onClick={() => courrier.now().then(() => notify("Boîte vérifiée.")).catch((x) => notify(errText(x)))}>Vérifier maintenant</button>
            <button className="lien danger" onClick={() => courrier.forget().then(() => notify("Identifiants effacés."))}>Effacer les identifiants</button>
          </>
        )}
      </div>
      <p className="aide">
        Dernière vérification : {quand(c.lastCheck)}{c.enCours ? " (en cours…)" : ""}
        {c.lastError && <span className="erreur"> · {c.lastError}</span>}
      </p>
      {c.derniers.length > 0 && (
        <ul className="historique-bilan">
          {c.derniers.slice(0, 5).map((d, i) => (
            <li key={i}><b>{quand(d.at)}</b> · {d.sujet || "(sans objet)"} — {d.appliquees.length ? `appliqué : ${d.appliquees.join(" ; ")}` : d.aValider ? `${d.aValider} à valider` : "rien à changer"}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
