// Règles de Rayan's Sauve, sans accès au disque : quoi copier, avec quels arguments robocopy, comment lire son
// résumé, et quand rappeler de sauvegarder.

export interface Source {
  id: string;
  label: string;
  path: string;
  enabled: boolean;
  /** Fichiers à copier (motifs robocopy) ; vide : tout le dossier. */
  files: string[];
  /** Dossiers ignorés (caches qui se recréent tout seuls). */
  excludeDirs: string[];
  preset: boolean;
}

export interface RunResult {
  at: number;
  durationMs: number;
  destination: string;
  ok: boolean;
  /** Fichiers copiés (nouveaux ou modifiés), fichiers déjà à jour, échecs, octets copiés. */
  copied: number;
  skipped: number;
  failed: number;
  bytes: number;
  /** Sources sautées ou en erreur, avec la raison. */
  problems: string[];
  cancelled?: boolean;
}

export interface Settings {
  destination: string | null;
  sources: Source[];
  /** Miroir : ce qui a été supprimé ici est aussi supprimé de la sauvegarde. */
  mirror: boolean;
  reminderDays: number;
  startWithWindows: boolean;
  closeToTray: boolean;
}

export interface AppData {
  version: 1;
  settings: Settings;
  history: RunResult[];
  lastReminderDay: string | null;
}

/** Caches des applications Electron et Chromium : inutiles dans une sauvegarde. */
export const CACHE_DIRS = ["Cache", "Code Cache", "GPUCache", "DawnGraphiteCache", "DawnWebGPUCache", "GrShaderCache", "ShaderCache", "GPUPersistentCache", "blob_storage", "Crashpad", "EBWebView", "node_modules"];

export const FOLDER = "Sauvegarde Rayan";

const str = (v: unknown, max = 1000) => (typeof v === "string" ? v.slice(0, max) : "");
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.slice(0, 200)) : []);

/** Fusionne les sources enregistrées avec les sources proposées (les proposées gardent leur chemin à jour). */
export function normalizeData(raw: unknown, presets: Source[]): AppData {
  const r = (raw ?? {}) as Partial<AppData>;
  const s = (r.settings ?? {}) as Partial<Settings>;
  const saved = Array.isArray(s.sources) ? s.sources : [];
  const sources: Source[] = presets.map((p) => {
    const old = saved.find((x) => x && x.id === p.id);
    return { ...p, enabled: typeof old?.enabled === "boolean" ? old.enabled : p.enabled };
  });
  for (const x of saved) {
    if (!x || x.preset || !str(x.id) || !str(x.path).trim() || sources.some((y) => y.id === x.id)) continue;
    sources.push({ id: str(x.id, 64), label: str(x.label, 80) || lastPart(str(x.path)), path: str(x.path).trim(), enabled: x.enabled !== false, files: strs(x.files), excludeDirs: strs(x.excludeDirs), preset: false });
  }
  const days = Number(s.reminderDays);
  const history = (Array.isArray(r.history) ? r.history : []).filter((h): h is RunResult => !!h && Number.isFinite(h.at)).slice(-30);
  return {
    version: 1,
    settings: {
      destination: str(s.destination).trim() || null,
      sources,
      mirror: s.mirror === true,
      reminderDays: Number.isInteger(days) && days >= 1 && days <= 90 ? days : 7,
      startWithWindows: s.startWithWindows === true,
      closeToTray: s.closeToTray !== false,
    },
    history,
    lastReminderDay: str(r.lastReminderDay, 10) || null,
  };
}

export const lastPart = (p: string) => p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || p;

/** Nom de dossier sûr pour Windows. */
export function safeName(label: string): string {
  const s = label.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/, "").trim();
  return s.slice(0, 80) || "Dossier";
}

/** Dossier de destination de chaque source : <destination>\Sauvegarde Rayan\<nom>, sans doublon de nom. */
export function targets(sources: Source[], destination: string, join: (...p: string[]) => string): Map<string, string> {
  const used = new Set<string>();
  const out = new Map<string, string>();
  for (const s of sources) {
    const base = safeName(s.label);
    let name = base;
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base} (${i})`;
    used.add(name.toLowerCase());
    out.set(s.id, join(destination, FOLDER, name));
  }
  return out;
}

/** Arguments robocopy pour copier une source vers son dossier de sauvegarde. */
export function robocopyArgs(src: Source, target: string, mirror: boolean): string[] {
  return [
    src.path, target, ...src.files,
    mirror ? "/MIR" : "/E",
    "/XJ", // pas de jonctions (« Ma musique » dans Documents…) : évite les boucles
    "/FFT", // tolère les dates à 2 s près des disques FAT/exFAT (clés USB, disques externes)
    "/R:1", "/W:2", "/MT:8",
    "/NP", "/NDL", "/NFL", "/NJH", "/BYTES",
    ...(src.excludeDirs.length ? ["/XD", ...src.excludeDirs] : []),
    "/XF", "*.tmp", "~$*", "desktop.ini", "Thumbs.db",
  ];
}

/** Codes de sortie de robocopy : 0 à 7 = réussite (avec ou sans copie), 8 et plus = échecs. */
export const robocopyOk = (code: number | null) => code !== null && code >= 0 && code < 8;

export interface Summary { dirs: number[]; files: number[]; bytes: number[] }

/**
 * Lit le résumé final de robocopy. Les libellés dépendent de la langue de Windows (« Fichiers », « Files »…),
 * donc on lit les trois premières lignes de 6 nombres : dossiers, fichiers, octets (avec /BYTES).
 * Colonnes : total, copiés, ignorés, différences, échecs, en trop.
 */
export function parseSummary(out: string): Summary | null {
  const rows: number[][] = [];
  for (const line of out.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const parts = line.slice(i + 1).trim().split(/\s+/);
    if (parts.length === 6 && parts.every((p) => /^\d+$/.test(p))) rows.push(parts.map(Number));
  }
  if (rows.length < 3) return null;
  const [dirs, files, bytes] = rows;
  return { dirs, files, bytes };
}

export function daysSince(ts: number | null, now: number): number | null {
  if (!ts) return null;
  return Math.floor((now - ts) / 86_400_000);
}

export const lastSuccess = (d: AppData) => [...d.history].reverse().find((h) => h.ok && !h.cancelled)?.at ?? null;

export function dayKey(now: number) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Faut-il rappeler de sauvegarder ? Une fois par jour, à partir de 10 h, quand la dernière sauvegarde réussie est trop vieille. */
export function reminderNeeded(d: AppData, now: number): boolean {
  if (!d.settings.destination) return false;
  if (d.lastReminderDay === dayKey(now) || new Date(now).getHours() < 10) return false;
  const days = daysSince(lastSuccess(d), now);
  return days === null || days >= d.settings.reminderDays;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  const units = ["Ko", "Mo", "Go", "To"];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0).replace(".", ",")} ${units[i]}`;
}

export function ago(ts: number | null, now: number): string {
  if (!ts) return "jamais";
  const days = daysSince(ts, now)!;
  const h = new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const sameDay = dayKey(ts) === dayKey(now);
  if (sameDay) return `aujourd'hui à ${h}`;
  if (dayKey(ts + 86_400_000) === dayKey(now)) return `hier à ${h}`;
  return `il y a ${Math.max(days, 2)} jours (${new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })})`;
}
