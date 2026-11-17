// Accès aux fichiers du PC depuis le téléphone : seulement sous des dossiers racines choisis, jamais au-dessus.
import path from "node:path";

export interface Racine { id: string; nom: string; chemin: string }

/**
 * Chemin absolu de `relatif` sous la racine `id`, ou null s'il en sort (« .. », lecteur, chemin absolu, UNC…).
 * `realpath` (facultatif) permet de vérifier aussi les liens et jonctions une fois résolus.
 */
export function resoudre(racines: Racine[], id: string, relatif: string, realpath?: (p: string) => string): string | null {
  const r = racines.find((x) => x.id === id);
  if (!r) return null;
  const rel = (relatif ?? "").replace(/\\/g, "/");
  if (rel.includes("\0") || /^[a-zA-Z]:/.test(rel) || rel.startsWith("//")) return null;
  const base = path.win32.resolve(r.chemin);
  const cible = path.win32.resolve(base, "." + path.win32.sep + rel.replace(/^\/+/, ""));
  if (!dedans(base, cible)) return null;
  if (realpath) {
    try {
      const vraieBase = realpath(base), vraieCible = realpath(cible);
      if (!dedans(vraieBase, vraieCible)) return null;
    } catch { /* cible inexistante : vérifiée par l'appelant */ }
  }
  return cible;
}

function dedans(base: string, cible: string) {
  const b = base.toLowerCase().replace(/[\\/]+$/, ""), c = cible.toLowerCase();
  return c === b || c.startsWith(b + "\\");
}

/** Nom de fichier sûr pour Windows (caractères interdits remplacés, noms réservés évités, 150 caractères au plus). */
export function nomSur(nom: string): string {
  let n = (nom ?? "").split(/[\\/]/).pop()!.replace(/[<>:"|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/, "").trim();
  if (!n || /^\.+$/.test(n)) n = "fichier";
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(n)) n = "_" + n;
  if (n.length > 150) { const ext = path.extname(n).slice(0, 12); n = n.slice(0, 150 - ext.length) + ext; }
  return n;
}

/** Premier nom libre dans le dossier : « photo.jpg », puis « photo (2).jpg », « photo (3).jpg »… */
export function nomLibre(nom: string, existe: (n: string) => boolean): string {
  if (!existe(nom)) return nom;
  const ext = path.extname(nom), base = nom.slice(0, nom.length - ext.length);
  for (let i = 2; i < 10_000; i++) { const n = `${base} (${i})${ext}`; if (!existe(n)) return n; }
  return `${base} (${Date.now()})${ext}`;
}

/** Nom tiré d'une URL de téléchargement (dernier segment décodé), ou « telechargement ». */
export function nomDepuisUrl(url: string, disposition?: string | null): string {
  const m = disposition?.match(/filename\*=UTF-8''([^;]+)/i) ?? disposition?.match(/filename="?([^";]+)"?/i);
  if (m) { try { return nomSur(decodeURIComponent(m[1])); } catch { return nomSur(m[1]); } }
  try {
    const seg = new URL(url).pathname.split("/").filter(Boolean).pop();
    if (seg) return nomSur(decodeURIComponent(seg));
  } catch { /* URL invalide */ }
  return "telechargement";
}
