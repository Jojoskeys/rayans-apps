// Modèle de Rayan's Bosse : des espaces de travail (un par projet), chacun avec ce qu'il faut ouvrir.
// Fonctions pures, sans accès au disque ; tout est enregistré dans bosse.json.

/** app : un programme (.exe, raccourci .lnk…) ; rayan : une application de Rayan's Launcher (cible = son id). */
export type ItemKind = "app" | "rayan" | "dossier" | "fichier" | "url";

export const KIND_LABELS: Record<ItemKind, string> = {
  app: "Programme", rayan: "App de Rayan", dossier: "Dossier", fichier: "Fichier", url: "Site",
};

export interface Item {
  id: string;
  kind: ItemKind;
  /** Chemin, adresse ou id d'application. */
  target: string;
  /** Nom affiché (facultatif : sinon déduit de la cible). */
  label: string;
  /** Arguments d'un programme. */
  args: string;
}

export interface Workspace {
  id: string;
  name: string;
  color: string;
  items: Item[];
  /** Démarrer Rayan's Chrono sur ce projet. */
  chrono: boolean;
  /** Nom du projet dans Chrono (vide : le nom de l'espace). */
  chronoProject: string;
  /** Id d'un espace PowerToys Workspaces à lancer aussi, ou null. */
  powertoys: string | null;
  lastOpened: number | null;
  createdAt: number;
}

export interface Settings {
  /** Réduire la fenêtre après avoir ouvert un espace. */
  hideAfterLaunch: boolean;
}

export interface AppData {
  version: 1;
  workspaces: Workspace[];
  settings: Settings;
}

export const COLORS = ["#4F7CE8", "#3BA776", "#E8594F", "#E8A93B", "#9B5DE5", "#2EB5C9", "#D9488F", "#7A8B99"];
export const DEFAULT_SETTINGS: Settings = { hideAfterLaunch: true };

export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function emptyData(): AppData {
  return { version: 1, workspaces: [], settings: { ...DEFAULT_SETTINGS } };
}

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");
const KINDS = new Set<ItemKind>(["app", "rayan", "dossier", "fichier", "url"]);

/** Vérifie et complète des données lues sur le disque ; ignore ce qui est invalide. */
export function normalizeData(raw: unknown): AppData {
  const d = emptyData();
  const r = raw as Partial<AppData> | null;
  if (!r || typeof r !== "object") return d;
  if (r.settings && typeof r.settings === "object") {
    d.settings.hideAfterLaunch = typeof r.settings.hideAfterLaunch === "boolean" ? r.settings.hideAfterLaunch : DEFAULT_SETTINGS.hideAfterLaunch;
  }
  const ids = new Set<string>();
  for (const w of Array.isArray(r.workspaces) ? r.workspaces : []) {
    if (!w || typeof w !== "object") continue;
    const name = str(w.name, 80).trim();
    const id = str(w.id, 64);
    if (!name || !id || ids.has(id)) continue;
    ids.add(id);
    const items: Item[] = [];
    for (const it of Array.isArray(w.items) ? w.items : []) {
      if (!it || !KINDS.has(it.kind) || !str(it.target).trim() || !str(it.id, 64)) continue;
      items.push({ id: str(it.id, 64), kind: it.kind, target: str(it.target).trim(), label: str(it.label, 120), args: str(it.args, 500) });
    }
    d.workspaces.push({
      id, name, items,
      color: /^#[0-9a-f]{6}$/i.test(str(w.color)) ? w.color : COLORS[d.workspaces.length % COLORS.length],
      chrono: typeof w.chrono === "boolean" ? w.chrono : true,
      chronoProject: str(w.chronoProject, 80),
      powertoys: typeof w.powertoys === "string" && w.powertoys ? w.powertoys.slice(0, 80) : null,
      lastOpened: Number.isFinite(w.lastOpened) ? (w.lastOpened as number) : null,
      createdAt: Number.isFinite(w.createdAt) ? (w.createdAt as number) : 0,
    });
  }
  return d;
}

/** Espace dont le nom correspond à ce qui est tapé : nom exact (sans accents ni majuscules), sinon un seul qui commence ainsi. */
export function findWorkspace(d: AppData, query: string): Workspace | null {
  const q = fold(query);
  if (!q) return null;
  const exact = d.workspaces.find((w) => fold(w.name) === q);
  if (exact) return exact;
  const starts = d.workspaces.filter((w) => fold(w.name).startsWith(q));
  if (starts.length === 1) return starts[0];
  const contains = d.workspaces.filter((w) => fold(w.name).includes(q));
  return contains.length === 1 ? contains[0] : null;
}

/** Nom de projet utilisé dans Chrono pour cet espace. */
export const chronoName = (w: Workspace) => w.chronoProject.trim() || w.name;

/** Nom affiché d'un élément : son libellé, sinon le dernier morceau du chemin ou l'hôte du site. */
export function itemLabel(it: Item, appNames: Record<string, string> = {}): string {
  if (it.label.trim()) return it.label.trim();
  if (it.kind === "rayan") return appNames[it.target] ?? it.target;
  if (it.kind === "url") {
    try { return new URL(it.target).host.replace(/^www\./, ""); } catch { return it.target; }
  }
  const base = it.target.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? it.target;
  return it.kind === "app" ? base.replace(/\.(exe|lnk|bat|cmd|url)$/i, "") : base;
}

/** « exemple.fr » ou « exemple.fr/page » → https://… ; refuse ce qui n'est pas un site web. */
export function normalizeUrl(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    return u.toString();
  } catch { return null; }
}

/** Découpe des arguments de ligne de commande (guillemets doubles pour les espaces). */
export function splitArgs(s: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push(m[1] ?? m[2]);
  return out;
}

/** Type d'un élément déposé : dossier, programme ou fichier, d'après le chemin et ce qu'il est sur le disque. */
export function kindOfPath(p: string, isDirectory: boolean): ItemKind {
  if (isDirectory) return "dossier";
  return /\.(exe|lnk|bat|cmd|appref-ms)$/i.test(p) ? "app" : "fichier";
}

/** Liste des espaces PowerToys Workspaces (contenu de workspaces.json). */
export function parsePowerToys(raw: unknown): { id: string; name: string }[] {
  const list = (raw as { workspaces?: unknown } | null)?.workspaces;
  if (!Array.isArray(list)) return [];
  return list
    .filter((w): w is { id: string; name: string } => !!w && typeof w.id === "string" && typeof w.name === "string")
    .map((w) => ({ id: w.id, name: w.name }));
}

export function relativeDay(ts: number | null, now: number): string {
  if (!ts) return "jamais ouvert";
  const day = (t: number) => { const d = new Date(t); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
  const n = Math.round((day(now) - day(ts)) / 86_400_000);
  const h = new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (n <= 0) return `ouvert aujourd'hui à ${h}`;
  if (n === 1) return `ouvert hier à ${h}`;
  if (n < 30) return `ouvert il y a ${n} jours`;
  return `ouvert le ${new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;
}
