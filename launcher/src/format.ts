import type { TaskView } from "./api";

export function bytes(n: number | null | undefined): string {
  if (n == null) return "";
  if (n < 1024) return `${n} o`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} Ko`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1).replace(".", ",")} Mo`;
  return `${(n / 1024 ** 3).toFixed(2).replace(".", ",")} Go`;
}

export function dateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

export function date(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { dateStyle: "long" });
}

const PHASES: Record<TaskView["phase"], string> = {
  downloading: "Téléchargement",
  verifying: "Vérification de l'empreinte",
  extracting: "Extraction",
  finalizing: "Contrôle de l'installation",
};

export function phaseLabel(t: TaskView): string {
  return PHASES[t.phase] ?? t.phase;
}

/** Progression globale approximative : téléchargement 0-80 %, puis étapes de vérification. */
export function progressPercent(t: TaskView): number | null {
  if (t.phase === "downloading") return t.total ? Math.min(80, (t.received / t.total) * 80) : null;
  if (t.phase === "verifying") return 82;
  if (t.phase === "extracting") return t.total ? 84 + Math.min(1, t.received / t.total) * 12 : 88;
  return 98;
}
