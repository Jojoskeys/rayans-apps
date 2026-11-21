// Saisie des réponses : pavé numérique à l'écran (gros boutons sur téléphone) et clavier physique
// (chiffres, Retour arrière, Entrée pour valider). Pas de champ texte : le clavier du téléphone ne s'ouvre pas.
import { useEffect, useRef } from "react";

const MAX = 8;

export type Touche = string | "⌫" | "OK";

/** Écoute le clavier physique tant que `actif` est vrai. */
export function useClavierPhysique(actif: boolean, surTouche: (t: Touche) => void) {
  const ref = useRef(surTouche);
  ref.current = surTouche;
  useEffect(() => {
    if (!actif) return;
    const h = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null;
      if (cible && (cible.tagName === "INPUT" || cible.tagName === "SELECT" || cible.tagName === "TEXTAREA")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) ref.current(e.key);
      else if (e.key === "Backspace" || e.key === "Delete") ref.current("⌫");
      else if (e.key === "Enter" || e.key === "NumpadEnter") ref.current("OK");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [actif]);
}

/** Applique une touche à la saisie (renvoie la nouvelle saisie, ou null pour « valider »). */
export function appliquerTouche(valeur: string, t: Touche): string | null {
  if (t === "OK") return null;
  if (t === "⌫") return valeur.slice(0, -1);
  if (valeur.length >= MAX) return valeur;
  if (valeur === "0") return t;
  return valeur + t;
}

export function Saisie({ valeur, etat }: { valeur: string; etat?: "ok" | "ko" | null }) {
  return (
    <div className={`saisie ${etat ?? ""}`} aria-live="polite">
      {valeur || <span className="curseur">?</span>}
    </div>
  );
}

export function Pave({ onTouche, desactive }: { onTouche: (t: Touche) => void; desactive?: boolean }) {
  const touches: Touche[] = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "⌫", "0", "OK"];
  return (
    <div className="pave" role="group" aria-label="Pavé numérique">
      {touches.map((t) => (
        <button
          key={t}
          type="button"
          className={`touche ${t === "OK" ? "valider" : t === "⌫" ? "effacer" : ""}`}
          disabled={desactive}
          onClick={() => onTouche(t)}
          aria-label={t === "⌫" ? "Effacer" : t === "OK" ? "Valider" : t}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
