'use strict';
/**
 * Exercices tirés des erreurs du joueur. Fonctions pures, testées dans test/unit/exercises.test.js.
 * Règles : REGLES-ANALYSE.md, section 10.
 *
 * - Un exercice = la position AVANT un coup du joueur classé gaffe, erreur ou occasion manquée
 *   (imprécision en option). Il faut trouver un coup qui ne perd pas plus que le seuil « excellent ».
 * - Réponse acceptée sans recalcul : le meilleur coup de Stockfish, le 2e choix s'il perd au plus le seuil
 *   « excellent » par rapport au meilleur, ou un coup que la table de finales donne comme préservant le résultat.
 *   Tout autre coup est évalué par Stockfish (même profondeur) et accepté s'il est classé
 *   meilleur, brillant, très bon ou excellent.
 * - Répétition espacée (boîtes de Leitner) : réussite → boîte suivante ; échec → boîte 0, à revoir dans 10 min.
 */
const { moveLoss } = require('./scoring');

const EXERCISE_CATEGORIES = ['gaffe', 'erreur', 'occasion_manquee'];
const OPTIONAL_CATEGORIES = ['imprecision'];
const ACCEPTED_CATEGORIES = ['meilleur', 'brillant', 'tres_bon', 'excellent'];
const BOX_DAYS = [0, 1, 3, 7, 21, 60]; // intervalle avant la prochaine révision, selon la boîte
const RETRY_MINUTES = 10;
const DAY = 86400000;

/** Erreurs d'un camp dans un rapport de partie (pour le résumé mis en cache). */
function extractMistakes(report, color, phases) {
  const out = [];
  report.plies.forEach((p, i) => {
    const c = p.classification;
    if (p.color !== color || !c || !p.best || !p.best.uci) return;
    if (!EXERCISE_CATEGORIES.includes(c.category) && !OPTIONAL_CATEGORIES.includes(c.category)) return;
    const keep = p.tablebase && Array.isArray(p.tablebase.moves)
      ? p.tablebase.moves.filter((m) => m.category === p.tablebase.category).map((m) => m.uci).filter(Boolean) : [];
    out.push({
      ply: p.ply, color: p.color, fen: p.fenBefore, san: p.san, uci: p.uci,
      category: c.category, loss: c.loss, wBest: c.wBest, wPlayed: c.wPlayed, threshold: 2.5 * (c.factor || 1),
      best: { uci: p.best.uci, score: p.best.score, pv: (p.best.pv || []).slice(0, 10) },
      second: p.second && p.second.uci ? { uci: p.second.uci, score: p.second.score } : null,
      played: p.played ? { score: p.played.score, pv: (p.played.pv || []).slice(0, 8) } : null,
      tbKeep: keep,
      phase: phases ? phases[i] : null,
      explanation: (p.explanation && p.explanation.sentences) || [],
    });
  });
  return out;
}

const exerciseId = (gameId, ply) => `${gameId}:${ply}`;

/**
 * Vérification sans moteur. Renvoie { accepted: true, reason } si le coup est accepté d'office,
 * { accepted: false, reason } s'il s'agit du coup joué dans la partie, ou null s'il faut l'évaluer.
 */
function quickCheck(ex, uci, excellentThreshold = ex.threshold || 2.5) {
  if (uci === ex.best.uci) return { accepted: true, reason: 'meilleur coup de Stockfish' };
  if (ex.tbKeep && ex.tbKeep.includes(uci)) return { accepted: true, reason: 'préserve le résultat selon la table de finales' };
  if (ex.second && uci === ex.second.uci) {
    const l = moveLoss(ex.best.score, ex.second.score);
    if (l !== null && l <= excellentThreshold) return { accepted: true, reason: `2e choix de Stockfish, presque aussi bon (−${l.toFixed(1)} pt)` };
  }
  if (uci === ex.uci) return { accepted: false, reason: 'coup joué dans la partie' };
  return null;
}

/** Réponse à partir du classement d'un coup évalué par le moteur. */
function acceptedByClassification(category) {
  return ACCEPTED_CATEGORIES.includes(category);
}

/** Nouvel état après une réponse (première tentative de la séance). */
function nextState(state, success, now = Date.now()) {
  const s = { box: 0, attempts: 0, successes: 0, ...(state || {}) };
  s.attempts += 1;
  s.last = now;
  if (success) {
    s.successes += 1;
    s.box = Math.min(BOX_DAYS.length - 1, s.box + 1);
    s.due = now + BOX_DAYS[s.box] * DAY;
  } else {
    s.box = 0;
    s.due = now + RETRY_MINUTES * 60000;
  }
  s.lastResult = success ? 'ok' : 'echec';
  return s;
}

const SEVERITY = { gaffe: 0, occasion_manquee: 1, erreur: 2, imprecision: 3 };

/**
 * Liste filtrée et triée : d'abord les exercices dus (jamais faits ou échéance passée), les plus graves en premier,
 * puis les autres par échéance. filters : { timeClass, phase, categories:[...], from, to, onlyDue }.
 */
function selectExercises(items, states, filters = {}, now = Date.now()) {
  const cats = filters.categories && filters.categories.length ? filters.categories : EXERCISE_CATEGORIES;
  const list = items.filter((e) => cats.includes(e.category)
    && (!filters.timeClass || e.timeClass === filters.timeClass)
    && (!filters.phase || e.phase === filters.phase)
    && (!filters.from || (e.endTime && e.endTime >= filters.from))
    && (!filters.to || (e.endTime && e.endTime <= filters.to)))
    .map((e) => { const st = states[e.id] || null; return { ...e, state: st, due: !st || !st.due || st.due <= now }; });
  const counts = { total: list.length, due: list.filter((e) => e.due).length, neverSeen: list.filter((e) => !e.state).length, mastered: list.filter((e) => e.state && e.state.box >= 3).length };
  const sorted = list.sort((a, b) => {
    if (a.due !== b.due) return a.due ? -1 : 1;
    if (a.due) {
      const sa = a.state ? 0 : 1; const sb = b.state ? 0 : 1; // à revoir avant les nouveaux
      if (sa !== sb) return sa - sb;
      if (SEVERITY[a.category] !== SEVERITY[b.category]) return SEVERITY[a.category] - SEVERITY[b.category];
      return (b.endTime || 0) - (a.endTime || 0) || a.ply - b.ply;
    }
    return a.state.due - b.state.due;
  });
  return { exercises: filters.onlyDue ? sorted.filter((e) => e.due) : sorted, counts };
}

module.exports = {
  EXERCISE_CATEGORIES, OPTIONAL_CATEGORIES, ACCEPTED_CATEGORIES, BOX_DAYS, RETRY_MINUTES,
  extractMistakes, exerciseId, quickCheck, acceptedByClassification, nextState, selectExercises,
};
