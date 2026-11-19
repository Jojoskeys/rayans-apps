// Outils du Chrono sur l'iPhone (raccourci « Démarrer un minuteur » et rappel de fin confié au PC), testés à part.
import type { AppData } from "../../../chrono/src/core/types.ts";

/** Lien qui lance le raccourci avec la durée en secondes (entrée du raccourci). */
export const lienRaccourci = (nom: string, secondes: number) =>
  `shortcuts://run-shortcut?name=${encodeURIComponent(nom)}&input=text&text=${Math.max(1, Math.round(secondes))}`;

/** Fin de minuteur à confier au PC (null : rien à prévoir). */
export function finPrevue(d: AppData): number | null {
  const t = d.timer;
  return t.mode === "pomodoro" && t.status === "marche" && t.endsAt !== null ? t.endsAt : null;
}

export const messageFin = (d: AppData) => d.timer.phase === "travail"
  ? { titre: "🍅 Pomodoro terminé", texte: "Bravo ! C'est l'heure de la pause." }
  : { titre: "⏰ Pause terminée", texte: "On reprend le travail." };

