/**
 * Import et export CSV / JSON.
 *
 * CSV (séparateur « ; », « , » ou tabulation, détecté automatiquement ; UTF-8, BOM accepté) :
 * - sans en-tête et 2 colonnes : « question;réponse », le format de quiz-revision (questions.txt) ;
 * - avec en-tête : colonnes type, question, reponse, choix (séparés par « | »), explication, paquet.
 *   type = qr (question/réponse), qcm ou trous. Sans type, un texte contenant {{…}} devient un texte à trous
 *   et une ligne avec des choix devient un QCM.
 * JSON : sauvegarde complète ou paquets exportés (format « rayans-revision »), ou simple liste
 * d'objets { question, reponse, type?, choix?, explication? }.
 */
import { clozeFull, clozeGapCount } from "./answer";
import {
  DEFAULT_SETTINGS, cleanDraft, emptyDb, makeCard, makeDeck, newId, newSched, validateDraft,
  type Card, type CardDraft, type CardKind, type Db, type Deck, type ReviewLog, type Sched, type Settings,
} from "./model";

// ---------------------------------------------------------------- CSV : lecture

export function detectSeparator(text: string): string {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  let best = ";";
  let bestCount = 0;
  for (const sep of [";", "\t", ","]) {
    let n = 0;
    let quoted = false;
    for (const ch of firstLine) {
      if (ch === '"') quoted = !quoted;
      else if (!quoted && ch === sep) n++;
    }
    if (n > bestCount) { best = sep; bestCount = n; }
  }
  return best;
}

/** Lecture CSV (guillemets doublés, retours à la ligne entre guillemets). Renvoie les lignes avec leur numéro. */
export function parseCsv(text: string, sep = detectSeparator(text)): { line: number; cells: string[] }[] {
  const src = text.replace(/^﻿/, "");
  const rows: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else {
        if (ch === "\n") line++;
        cell += ch;
      }
    } else if (ch === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (ch === sep) {
      cells.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      cells.push(cell);
      if (cells.some((c) => c.trim() !== "")) rows.push({ line: rowLine, cells });
      cells = [];
      cell = "";
      line++;
      rowLine = line;
    } else cell += ch;
  }
  cells.push(cell);
  if (cells.some((c) => c.trim() !== "")) rows.push({ line: rowLine, cells });
  return rows;
}

const HEADER_ALIASES: Record<string, string[]> = {
  type: ["type", "genre", "kind"],
  question: ["question", "recto", "front", "texte", "enonce"],
  answer: ["reponse", "verso", "back", "answer", "solution"],
  choices: ["choix", "choices", "options", "propositions"],
  explanation: ["explication", "explanation", "note", "notes", "remarque"],
  deck: ["paquet", "deck", "theme", "matiere"],
};

const simple = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function headerMap(cells: string[]): Record<string, number> | null {
  const map: Record<string, number> = {};
  cells.forEach((c, i) => {
    const k = simple(c);
    for (const [field, names] of Object.entries(HEADER_ALIASES)) if (names.includes(k) && !(field in map)) map[field] = i;
  });
  return "question" in map ? map : null;
}

export function parseKind(raw: string | undefined): CardKind | null {
  const k = simple(raw ?? "");
  if (["", "qr", "q/r", "basic", "question", "question/reponse", "question-reponse", "carte"].includes(k)) return "basic";
  if (["qcm", "mcq", "choix", "quiz"].includes(k)) return "mcq";
  if (["trous", "trou", "cloze", "texte a trous", "texte-a-trous", "a trous"].includes(k)) return "cloze";
  return null;
}

export function splitChoices(raw: string | undefined): string[] {
  return (raw ?? "").split("|").map((s) => s.trim()).filter(Boolean);
}

export interface ImportRow extends CardDraft {
  deck?: string;
}

export interface ImportResult {
  rows: ImportRow[];
  errors: { line: number; message: string }[];
}

/** Devine le type d'une carte quand il n'est pas donné. */
function inferKind(kind: CardKind | null, rawType: string | undefined, question: string, choices: string[]): CardKind {
  if (kind && simple(rawType ?? "") !== "") return kind;
  if (choices.length > 0) return "mcq";
  if (clozeGapCount(question) > 0) return "cloze";
  return "basic";
}

function rowToDraft(fields: { type?: string; question?: string; answer?: string; choices?: string; explanation?: string; deck?: string }): ImportRow | string {
  const kind = parseKind(fields.type);
  if (!kind) return `type « ${fields.type} » inconnu (qr, qcm ou trous)`;
  const question = (fields.question ?? "").trim();
  const choices = splitChoices(fields.choices);
  const draft = cleanDraft({
    kind: inferKind(kind, fields.type, question, choices),
    question,
    answer: fields.answer ?? "",
    choices,
    explanation: fields.explanation ?? "",
  });
  const err = validateDraft(draft, clozeGapCount);
  if (err) return err;
  const deck = (fields.deck ?? "").trim();
  return deck ? { ...draft, deck } : draft;
}

export function importCsv(text: string): ImportResult {
  const rows = parseCsv(text);
  const out: ImportResult = { rows: [], errors: [] };
  if (rows.length === 0) return out;
  const header = headerMap(rows[0].cells);
  const body = header ? rows.slice(1) : rows;
  for (const { line, cells } of body) {
    let fields: Parameters<typeof rowToDraft>[0];
    if (header) {
      const get = (f: string) => (f in header ? cells[header[f]] : undefined);
      fields = { type: get("type"), question: get("question"), answer: get("answer"), choices: get("choices"), explanation: get("explanation"), deck: get("deck") };
    } else if (cells.length >= 3 && parseKind(cells[0]) && simple(cells[0]) !== "") {
      fields = { type: cells[0], question: cells[1], answer: cells[2], choices: cells[3], explanation: cells[4], deck: cells[5] };
    } else if (cells.length >= 2) {
      // quiz-revision : « question;réponse » (une éventuelle 3e colonne est l'explication).
      fields = { question: cells[0], answer: cells[1], explanation: cells[2] };
    } else {
      fields = { question: cells[0], answer: "" };
    }
    const r = rowToDraft(fields);
    if (typeof r === "string") out.errors.push({ line, message: r });
    else out.rows.push(r);
  }
  return out;
}

// ---------------------------------------------------------------- CSV : écriture

const KIND_CSV: Record<CardKind, string> = { basic: "qr", mcq: "qcm", cloze: "trous" };

function csvCell(s: string, sep: string): string {
  return /["\r\n]/.test(s) || s.includes(sep) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV avec en-tête, séparateur « ; » (ouvert directement par Excel en français), BOM UTF-8. */
export function exportCsv(db: Db, deckIds?: string[]): string {
  const sep = ";";
  const decks = new Map(db.decks.map((d) => [d.id, d.name]));
  const lines = [["type", "question", "reponse", "choix", "explication", "paquet"].join(sep)];
  for (const c of db.cards) {
    if (deckIds && !deckIds.includes(c.deckId)) continue;
    const cells = [KIND_CSV[c.kind], c.question, c.answer, c.kind === "mcq" ? c.choices.join(" | ") : "", c.explanation, decks.get(c.deckId) ?? ""];
    lines.push(cells.map((x) => csvCell(x, sep)).join(sep));
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------- JSON

export interface ExportFile {
  format: "rayans-revision";
  version: 1;
  kind: "backup" | "decks";
  exportedAt: string;
  decks: Deck[];
  cards: Card[];
  reviews?: ReviewLog[];
  settings?: Settings;
}

export function exportJson(db: Db, deckIds?: string[], now = Date.now()): string {
  const full = !deckIds;
  const file: ExportFile = {
    format: "rayans-revision",
    version: 1,
    kind: full ? "backup" : "decks",
    exportedAt: new Date(now).toISOString(),
    decks: db.decks.filter((d) => full || deckIds!.includes(d.id)),
    cards: db.cards.filter((c) => full || deckIds!.includes(c.deckId)),
  };
  if (full) {
    file.reviews = db.reviews;
    file.settings = db.settings;
  }
  return JSON.stringify(file, null, 2);
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown, d = "") => (typeof x === "string" ? x : typeof x === "number" ? String(x) : d);
const num = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? x : d);

function sanitizeSched(x: unknown, now: number): Sched {
  if (!isObj(x)) return newSched(now);
  const state = ["new", "learning", "review", "relearning"].includes(str(x.state)) ? (x.state as Sched["state"]) : "new";
  if (state === "new") return newSched(num(x.due, now));
  const lastReview = typeof x.lastReview === "number" ? x.lastReview : null;
  return {
    state,
    due: num(x.due, now),
    stability: Math.max(0.1, num(x.stability, 1)),
    difficulty: Math.min(10, Math.max(1, num(x.difficulty, 5))),
    step: Math.max(0, Math.floor(num(x.step, 0))),
    interval: Math.max(0, num(x.interval, 0)),
    reps: Math.max(0, Math.floor(num(x.reps, 0))),
    lapses: Math.max(0, Math.floor(num(x.lapses, 0))),
    lastReview,
  };
}

function sanitizeSettings(x: unknown): Settings {
  const s = isObj(x) ? x : {};
  const steps = (v: unknown, d: number[]) =>
    Array.isArray(v) && v.every((n) => typeof n === "number" && n > 0 && n < 1440) ? (v as number[]) : d;
  return {
    retention: Math.min(0.97, Math.max(0.7, num(s.retention, DEFAULT_SETTINGS.retention))),
    maxReviewsPerDay: Math.max(1, Math.floor(num(s.maxReviewsPerDay, DEFAULT_SETTINGS.maxReviewsPerDay))),
    learningSteps: steps(s.learningSteps, DEFAULT_SETTINGS.learningSteps),
    relearningSteps: steps(s.relearningSteps, DEFAULT_SETTINGS.relearningSteps),
    maxInterval: Math.max(1, Math.floor(num(s.maxInterval, DEFAULT_SETTINGS.maxInterval))),
    dayStartHour: Math.min(23, Math.max(0, Math.floor(num(s.dayStartHour, DEFAULT_SETTINGS.dayStartHour)))),
  };
}

function sanitizeDeck(x: unknown, now: number): Deck | null {
  if (!isObj(x)) return null;
  const name = str(x.name).trim();
  if (!name) return null;
  return {
    id: str(x.id) || newId("d"),
    name,
    description: str(x.description),
    answerMode: x.answerMode === "typed" ? "typed" : "flip",
    newPerDay: Math.max(0, Math.min(9999, Math.floor(num(x.newPerDay, 20)))),
    created: num(x.created, now),
  };
}

function sanitizeCard(x: unknown, now: number): Card | null {
  if (!isObj(x)) return null;
  const kind = (["basic", "mcq", "cloze"] as const).find((k) => k === x.kind) ?? "basic";
  const draft = cleanDraft({ kind, question: str(x.question), answer: str(x.answer), choices: Array.isArray(x.choices) ? x.choices.map((c) => str(c)) : [], explanation: str(x.explanation) });
  if (validateDraft(draft, clozeGapCount)) return null;
  return {
    id: str(x.id) || newId("c"),
    deckId: str(x.deckId),
    ...draft,
    created: num(x.created, now),
    updated: num(x.updated, now),
    suspended: x.suspended === true,
    sched: sanitizeSched(x.sched, now),
  };
}

function sanitizeReview(x: unknown): ReviewLog | null {
  if (!isObj(x) || typeof x.ts !== "number" || typeof x.cardId !== "string") return null;
  const g = num(x.grade, 0);
  if (![1, 2, 3, 4].includes(g)) return null;
  const st = ["new", "learning", "review", "relearning"].includes(str(x.stateBefore)) ? (x.stateBefore as ReviewLog["stateBefore"]) : "review";
  return {
    cardId: x.cardId, deckId: str(x.deckId), ts: x.ts, grade: g as ReviewLog["grade"], stateBefore: st,
    elapsedDays: Math.max(0, num(x.elapsedDays, 0)), interval: Math.max(0, num(x.interval, 0)), durationMs: Math.max(0, num(x.durationMs, 0)),
  };
}

/** Valide un fichier de données complet (celui de l'application ou une sauvegarde). Lève une erreur en français. */
export function parseDb(text: string, now = Date.now()): Db {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    throw new Error("Ce fichier n'est pas un JSON valide.");
  }
  if (!isObj(raw) || raw.format !== "rayans-revision") throw new Error("Ce fichier n'est pas une sauvegarde de Rayan's Révision.");
  const db = emptyDb();
  db.settings = sanitizeSettings(raw.settings);
  db.decks = (Array.isArray(raw.decks) ? raw.decks : []).map((d) => sanitizeDeck(d, now)).filter((d): d is Deck => !!d);
  const deckIds = new Set(db.decks.map((d) => d.id));
  db.cards = (Array.isArray(raw.cards) ? raw.cards : []).map((c) => sanitizeCard(c, now)).filter((c): c is Card => !!c && deckIds.has(c.deckId));
  db.reviews = (Array.isArray(raw.reviews) ? raw.reviews : []).map(sanitizeReview).filter((r): r is ReviewLog => !!r);
  return db;
}

export interface JsonImport {
  /** Paquets exportés depuis Rayan's Révision (cartes avec leur progression). */
  decks: { deck: Deck; cards: Card[] }[];
  /** Cartes d'une simple liste JSON, à ranger dans un paquet. */
  rows: ImportRow[];
  errors: { line: number; message: string }[];
  /** Vrai si c'est une sauvegarde complète (peut remplacer toutes les données). */
  isBackup: boolean;
}

export function importJson(text: string, now = Date.now()): JsonImport {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    throw new Error("Ce fichier n'est pas un JSON valide.");
  }
  const out: JsonImport = { decks: [], rows: [], errors: [], isBackup: false };
  if (isObj(raw) && raw.format === "rayans-revision") {
    const db = parseDb(text, now);
    out.isBackup = raw.kind !== "decks" && Array.isArray(raw.reviews);
    for (const deck of db.decks) out.decks.push({ deck, cards: db.cards.filter((c) => c.deckId === deck.id) });
    return out;
  }
  const list = Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw.cards) ? raw.cards : null;
  if (!list) throw new Error("Format JSON non reconnu : attendu une sauvegarde de Rayan's Révision ou une liste de cartes.");
  list.forEach((item, i) => {
    if (!isObj(item)) { out.errors.push({ line: i + 1, message: "élément ignoré (pas un objet)" }); return; }
    const pick = (field: string) => {
      for (const [k, v] of Object.entries(item)) if (HEADER_ALIASES[field].includes(simple(k))) return Array.isArray(v) ? v.map((x) => str(x)).join(" | ") : str(v);
      return undefined;
    };
    const r = rowToDraft({ type: pick("type"), question: pick("question"), answer: pick("answer"), choices: pick("choices"), explanation: pick("explanation"), deck: pick("deck") });
    if (typeof r === "string") out.errors.push({ line: i + 1, message: r });
    else out.rows.push(r);
  });
  return out;
}

// ---------------------------------------------------------------- Ajout dans la base

function uniqueName(db: Db, name: string): string {
  const names = new Set(db.decks.map((d) => d.name.toLowerCase()));
  if (!names.has(name.toLowerCase())) return name;
  for (let i = 2; ; i++) if (!names.has(`${name} (${i})`.toLowerCase())) return `${name} (${i})`;
}

/**
 * Ajoute des lignes importées. Les lignes avec un paquet nommé vont dans ce paquet (créé s'il n'existe pas),
 * les autres dans `targetDeckId`, ou dans un nouveau paquet nommé `fallbackName`.
 */
export function addRows(db: Db, rows: ImportRow[], target: { deckId?: string; fallbackName: string }, now = Date.now()): { db: Db; added: number; decksCreated: number } {
  const decks = [...db.decks];
  const cards = [...db.cards];
  let decksCreated = 0;
  const byName = new Map(decks.map((d) => [d.name.toLowerCase(), d.id]));
  const deckFor = (name: string | undefined): string => {
    if (!name && target.deckId) return target.deckId;
    const n = name || target.fallbackName;
    const existing = byName.get(n.toLowerCase());
    if (existing) return existing;
    const d = makeDeck(n, now);
    decks.push(d);
    byName.set(n.toLowerCase(), d.id);
    decksCreated++;
    return d.id;
  };
  let t = now;
  for (const r of rows) {
    const { deck, ...draft } = r;
    cards.push(makeCard(deckFor(deck), draft, t++));
  }
  return { db: { ...db, decks, cards }, added: rows.length, decksCreated };
}

/** Ajoute des paquets exportés, avec de nouveaux identifiants ; `keepProgress` garde la planification des cartes. */
export function addDecks(db: Db, imported: { deck: Deck; cards: Card[] }[], keepProgress: boolean, now = Date.now()): { db: Db; added: number } {
  const decks = [...db.decks];
  const cards = [...db.cards];
  let added = 0;
  const probe: Db = { ...db, decks };
  for (const { deck, cards: list } of imported) {
    const d: Deck = { ...deck, id: newId("d"), name: uniqueName(probe, deck.name), created: now };
    decks.push(d);
    for (const c of list) {
      cards.push({ ...c, id: newId("c"), deckId: d.id, sched: keepProgress ? c.sched : newSched(now) });
      added++;
    }
  }
  return { db: { ...db, decks, cards }, added };
}

/** Texte de recherche d'une carte. */
export function searchText(c: Card): string {
  const q = c.kind === "cloze" ? clozeFull(c.question) : c.question;
  return simple([q, c.answer, c.choices.join(" "), c.explanation].join(" "));
}
export { simple as simplifyForSearch };
