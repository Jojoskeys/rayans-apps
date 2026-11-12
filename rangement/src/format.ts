export function formatSize(n: number): string {
  if (n < 1024) return `${n} o`;
  const units = ["Ko", "Mo", "Go", "To"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: v < 10 ? 1 : 0 })} ${units[i]}`;
}

export function baseName(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

export function dirName(p: string): string {
  const i = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/"));
  return i > 0 ? p.slice(0, i) : p;
}

/** Chemin raccourci pour l'affichage : « …\Téléchargements\Images ». */
export function shortDir(p: string, keep = 2): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  if (parts.length <= keep + 1) return p;
  return "…\\" + parts.slice(-keep).join("\\");
}

export function plural(n: number, one: string, many?: string): string {
  return `${n.toLocaleString("fr-FR")} ${n > 1 ? (many ?? one + "s") : one}`;
}

export const MB = 1024 * 1024;
