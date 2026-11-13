// Ce qu'il reste à réviser aujourd'hui, calculé à partir des fichiers de données des autres applications
// (lus seulement, jamais modifiés). Fonctions pures : le contenu des fichiers est passé en paramètre.
// Les règles reprennent celles des applications elles-mêmes :
//   Révision    : revision/src/core/session.ts (dueCounts)
//   Hifz        : coran-memorisation/src/core/store.ts (dueQueue)
//   Ouvertures  : echecs-ouvertures/src/core/repertoire.js (exercices dont l'échéance est passée)

export type SourceId = "revision" | "hifz" | "ouvertures";

export interface SourceCount {
  id: SourceId;
  /** Nombre d'éléments à faire aujourd'hui, ou null si les données n'ont pas pu être lues. */
  total: number | null;
  /** Détail affiché sous le nombre. */
  detail: string;
  /** Pas encore de données (application jamais utilisée) : ce n'est pas une erreur. */
  missing: boolean;
  error: string | null;
}

const DAY = 86_400_000;
const LEARN_AHEAD_MS = 20 * 60_000;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

// ----- Rayan's Révision ---------------------------------------------------------------------------

interface RevCard { deckId: string; suspended: boolean; created: number; sched: { state: string; due: number } }
interface RevDb { decks: { id: string; newPerDay: number }[]; cards: RevCard[]; reviews: { ts: number; deckId: string; stateBefore: string }[]; settings: { maxReviewsPerDay: number; dayStartHour: number } }

/** Début de la journée de révision (elle commence à `hour` heures, 4 h par défaut). */
export function dayStart(now: number, hour = 4): number {
  const d = new Date(now);
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0, 0);
  if (s.getTime() > now) s.setDate(s.getDate() - 1);
  return s.getTime();
}

export function revisionCount(raw: unknown, now: number): { total: number; learning: number; review: number; fresh: number } {
  const db = raw as RevDb;
  if (!db || !Array.isArray(db.cards) || !Array.isArray(db.decks)) throw new Error("format inattendu");
  const hour = Number.isFinite(db.settings?.dayStartHour) ? db.settings.dayStartHour : 4;
  const maxReviews = Number.isFinite(db.settings?.maxReviewsPerDay) ? db.settings.maxReviewsPerDay : 200;
  const start = dayStart(now, hour);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const reviews = Array.isArray(db.reviews) ? db.reviews : [];
  const reviewsDone = reviews.filter((r) => r.ts >= start && r.stateBefore === "review").length;
  const newSeen = new Map<string, number>();
  for (const r of reviews) if (r.ts >= start && r.stateBefore === "new") newSeen.set(r.deckId, (newSeen.get(r.deckId) ?? 0) + 1);

  let learning = 0, review = 0;
  const freshByDeck = new Map<string, number>();
  for (const c of db.cards) {
    if (!c || c.suspended || !c.sched) continue;
    const s = c.sched;
    if (s.state === "learning" || s.state === "relearning") { if (s.due <= now + LEARN_AHEAD_MS) learning++; }
    else if (s.state === "review") { if (s.due < end.getTime()) review++; }
    else freshByDeck.set(c.deckId, (freshByDeck.get(c.deckId) ?? 0) + 1);
  }
  review = Math.min(review, Math.max(0, maxReviews - reviewsDone));
  let fresh = 0;
  for (const deck of db.decks) {
    const left = Math.max(0, (deck.newPerDay ?? 0) - (newSeen.get(deck.id) ?? 0));
    fresh += Math.min(left, freshByDeck.get(deck.id) ?? 0);
  }
  return { total: learning + review + fresh, learning, review, fresh };
}

// ----- Rayan's Hifz -------------------------------------------------------------------------------

/** Jour civil local « AAAA-MM-JJ ». */
export function todayISO(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Portions à réviser : échéance passée, ou un verset marqué « à revoir ». Les portions ont pour id
 * « sourate:début-fin » (voir PORTIONS dans coran-memorisation/src/core/quran.ts).
 */
export function hifzCount(raw: unknown, now: number): { total: number; weak: number } {
  const data = raw as { cards?: Record<string, { due?: string }>; verses?: Record<string, string> };
  if (!data || typeof data !== "object" || typeof data.cards !== "object" || !data.cards) throw new Error("format inattendu");
  const today = todayISO(now);
  const verses = data.verses ?? {};
  let total = 0, weak = 0;
  for (const [id, card] of Object.entries(data.cards)) {
    const m = /^(\d+):(\d+)-(\d+)$/.exec(id);
    let isWeak = false;
    if (m) for (let a = Number(m[2]); a <= Number(m[3]) && !isWeak; a++) isWeak = verses[`${m[1]}:${a}`] === "weak";
    const due = typeof card?.due === "string" && card.due <= today;
    if (due || isWeak) total++;
    if (isWeak) weak++;
  }
  return { total, weak };
}

// ----- Rayan's Ouvertures -------------------------------------------------------------------------

/** Positions déjà travaillées dont l'échéance est passée (un fichier exercices.json par joueur). */
export function ouverturesCount(files: unknown[], now: number): { total: number; players: number } {
  let total = 0, players = 0;
  for (const raw of files) {
    if (!raw || typeof raw !== "object") continue;
    players++;
    for (const st of Object.values(raw as Record<string, { due?: number }>)) if (st && typeof st.due === "number" && st.due <= now) total++;
  }
  return { total, players };
}

// ----- Présentation -------------------------------------------------------------------------------

export function revisionDetail(c: ReturnType<typeof revisionCount>): string {
  if (!c.total) return "Rien à réviser";
  const parts = [];
  if (c.review) parts.push(plural(c.review, "révision"));
  if (c.learning) parts.push(`${c.learning} en apprentissage`);
  if (c.fresh) parts.push(plural(c.fresh, "nouvelle carte", "nouvelles cartes"));
  return parts.join(" · ");
}

export function hifzDetail(c: ReturnType<typeof hifzCount>): string {
  if (!c.total) return "Rien à réviser";
  return `${plural(c.total, "portion")} à réciter${c.weak ? ` · dont ${c.weak} avec un verset à revoir` : ""}`;
}

export function ouverturesDetail(c: ReturnType<typeof ouverturesCount>): string {
  if (!c.players) return "Aucune partie importée";
  return c.total ? `${plural(c.total, "position")} à rejouer` : "Aucune position à rejouer";
}

export const totalLeft = (counts: SourceCount[]) => counts.reduce((n, c) => n + (c.total ?? 0), 0);

/** Texte de la notification du soir, ou null s'il ne reste rien. */
export function reminderText(counts: SourceCount[]): string | null {
  const parts = counts.filter((c) => c.total).map((c) => `${NAMES[c.id]} : ${c.total}`);
  return parts.length ? parts.join(" · ") : null;
}

export const NAMES: Record<SourceId, string> = { revision: "Révision", hifz: "Hifz", ouvertures: "Ouvertures" };

/** Moment du rappel du jour (heure:minute locale) ; le rappel n'est envoyé qu'une fois par jour. */
export function reminderDue(now: number, hour: number, minute: number, lastSentDay: string | null): boolean {
  const d = new Date(now);
  const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute).getTime();
  // Fenêtre de 3 h : un ordinateur allumé à 21 h reçoit encore le rappel de 19 h, pas celui de la veille.
  return now >= at && now < at + 3 * 3_600_000 && lastSentDay !== todayISO(now);
}

export { DAY };
