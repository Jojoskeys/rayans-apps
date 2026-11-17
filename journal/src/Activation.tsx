import type { Reglages } from "./api";

/** Demande d'accord avant toute collecte : ce qui sera enregistré, comment, et ce qui ne l'est jamais. */
export function Activation(p: { reglages: Reglages; onActiver: () => void; onAnnuler: () => void }) {
  const r = p.reglages;
  return (
    <div className="modal-back" onClick={p.onAnnuler}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>Activer le journal d’activité ?</h2>
        <div className="modal-body">
          <p className="muted">
            Tant que l’application tourne (fenêtre ou icône près de l’horloge), elle enregistre dans l’archive chiffrée de ce PC :
          </p>
          <table className="table-perm">
            <tbody>
              <tr>
                <td>Programmes {r.applications ? "" : "(décochée)"}</td>
                <td className="muted">Ouverture (heure exacte du lancement) et fermeture (à ±{r.intervalleProcessusS} s) de tous les programmes de ta session, avec ou sans fenêtre, regroupés par programme. Les services de Windows et les autres comptes ne sont pas suivis.</td>
              </tr>
              <tr>
                <td>Fenêtre active {r.fenetres ? "" : "(décochée)"}</td>
                <td className="muted">Changement de fenêtre au premier plan et de titre, à la milliseconde. Titre masqué pour les gestionnaires de mots de passe, la navigation privée et les mots sensibles.</td>
              </tr>
              <tr>
                <td>Fichiers {r.fichiers ? "" : "(décochée)"}</td>
                <td className="muted">Créations, modifications, renommages, déplacements et suppressions dans : {r.dossiers.join(" · ") || "aucun dossier"}. Jamais le contenu des fichiers.</td>
              </tr>
              <tr>
                <td>Sécurité {r.securite ? "" : "(décochée)"}</td>
                <td className="muted">Vérification de chaque programme vu (signature, emplacement, origine Internet, démarrage automatique), des ajouts au démarrage de Windows et des détections de Microsoft Defender. Tout reste sur ce PC.</td>
              </tr>
              <tr>
                <td>Session {r.session ? "" : "(décochée)"}</td>
                <td className="muted">Verrouillage, déverrouillage, inactivité (seulement l’heure de la dernière action au clavier ou à la souris, jamais les touches), et depuis le journal Windows : démarrage, arrêt, veille, réveil.</td>
              </tr>
            </tbody>
          </table>
          <p className="small muted">
            <strong>Autorisations :</strong> aucune autorisation d’administrateur, aucun réglage de Windows modifié. L’application lit les fenêtres ouvertes, la liste
            des programmes de ta session, les dossiers choisis et le journal « Système ». Jamais le clavier, l’écran ni le contenu des fenêtres.
          </p>
          <p className="small muted">
            Pause à tout moment ({r.raccourciPause ? "Ctrl+Alt+J, " : ""}icône près de l’horloge ou barre de gauche). Le démarrage avec Windows reste désactivé tant que
            tu ne l’actives pas dans les réglages.
          </p>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={p.onAnnuler} autoFocus>
            Pas maintenant
          </button>
          <button className="btn primary" onClick={p.onActiver}>
            J’accepte, activer la collecte
          </button>
        </div>
      </div>
    </div>
  );
}
