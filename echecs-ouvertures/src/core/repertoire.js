'use strict';
/**
 * Cœur de Rayan's Ouvertures : fonctions pures, testées dans test/unit/repertoire.test.js.
 *
 * - Ouverture d'une partie : base libre lichess-org/chess-openings (positions « théorie »). On regarde les
 *   MAX_PLY premiers demi-coups (15 coups). La « sortie de théorie » est le premier demi-coup dont la position
 *   ne figure plus dans la base ; elle est attribuée au joueur ou à son adversaire selon qui l'a joué.
 * - Coups du joueur analysés par Stockfish : ceux joués hors théorie dans les 15 premiers coups.
 *   Perte = baisse des chances de gain (points de %), comme dans Analyse Échecs.
 * - Position à travailler (« exercice ») : position AVANT un coup du joueur qui perd au moins LOSS.imprecision,
 *   ou avant sa sortie de théorie si ce coup perd plus que ACCEPT_LOSS. Une même position rencontrée dans
 *   plusieurs parties (même couleur) ne donne qu'un exercice, avec toutes ses occurrences.
 * - Réponse acceptée : un coup qui ne perd pas plus de ACCEPT_LOSS par rapport au meilleur coup de Stockfish
 *   (BOOK_ACCEPT_LOSS pour un coup de la théorie).
 * - Répétition espacée (boîtes de Leitner, comme Analyse Échecs) : réussite → boîte suivante ;
 *   échec → boîte 0, à revoir dans 10 minutes.
 */
const { Chess, moveToUci } = require('./chessutil');
const { moveLoss } = require('./scoring');
const { epd } = require('./openings');

const MAX_PLY = 30;
const LOSS = { imprecision: 5, erreur: 10, gaffe: 20 };
const ACCEPT_LOSS = 3;
const BOOK_ACCEPT_LOSS = 6;
const BOX_DAYS = [0, 1, 3, 7, 21, 60];
const RETRY_MINUTES = 10;
const DAY = 86400000;
const MASTERED_BOX = 3;
const UNKNOWN_FAMILY = 'Ouverture non répertoriée';
const CATEGORIES = {
  gaffe: { label: 'Gaffe', symbol: '??' },
  erreur: { label: 'Erreur', symbol: '?' },
  imprecision: { label: 'Imprécision', symbol: '?!' },
  sortie: { label: 'Sortie de théorie', symbol: '⤳' },
};
const SEVERITY = { gaffe: 0, erreur: 1, imprecision: 2, sortie: 3 };

function colorOf(game, username) {
  const u = String(username || '').toLowerCase();
  if (game.white && String(game.white.username).toLowerCase() === u) return 'w';
  if (game.black && String(game.black.username).toLowerCase() === u) return 'b';
  return null;
}

/** Points du joueur : 1, 0,5 ou 0. */
function pointsFor(result, color) {
  if (result === '1/2-1/2') return 0.5;
  if (result === '1-0') return color === 'w' ? 1 : 0;
  if (result === '0-1') return color === 'b' ? 1 : 0;
  return null;
}

/** Famille d'ouverture : partie du nom avant « : » (« Sicilian Defense: Najdorf Variation » → « Sicilian Defense »). */
function familyOf(name) {
  return name ? String(name).split(':')[0].trim() : UNKNOWN_FAMILY;
}

function categoryOf(loss) {
  if (typeof loss !== 'number') return null;
  if (loss >= LOSS.gaffe) return 'gaffe';
  if (loss >= LOSS.erreur) return 'erreur';
  if (loss >= LOSS.imprecision) return 'imprecision';
  return null;
}

/** Coups de la théorie depuis une position : coups légaux menant à une position de la base. */
function bookMoves(fen, openings) {
  const c = new Chess(fen);
  return c.moves({ verbose: true }).filter((m) => openings.isBook(m.after)).map((m) => ({ uci: moveToUci(m), san: m.san }));
}

/**
 * Ouverture jouée dans une partie, du point de vue de `username`.
 * Renvoie null si le joueur n'est pas dans la partie ou si le PGN est illisible.
 */
/**
 * Premiers coups SAN d'un PGN, sans rejouer toute la partie (beaucoup plus rapide que loadPgn sur des milliers
 * de parties) : en-têtes, commentaires {…}, variantes (…), annotations $n, numéros de coup et résultat sont retirés.
 */
function firstSans(pgn, max = MAX_PLY) {
  const body = String(pgn).replace(/^\s*\[[^\]]*\]\s*$/gm, '').replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');
  let text = body;
  for (let i = 0; i < 5 && /\([^()]*\)/.test(text); i++) text = text.replace(/\([^()]*\)/g, ' ');
  const out = [];
  for (const tok of text.split(/\s+/)) {
    if (!tok || /^\d+\.+$/.test(tok) || /^\$\d+$/.test(tok) || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) continue;
    const t = tok.replace(/^\d+\.+/, '').replace(/[!?]+$/, '');
    if (t) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** Rejoue des coups SAN ; renvoie les demi-coups (ply, san, uci, color, fenBefore, fenAfter) ou null si illégal. */
function replay(sans) {
  const c = new Chess();
  const plies = [];
  for (let i = 0; i < sans.length; i++) {
    let m;
    try { m = c.move(sans[i]); } catch (e) { m = null; }
    if (!m) return null;
    plies.push({ ply: i + 1, san: m.san, uci: moveToUci(m), color: m.color, fenBefore: m.before, fenAfter: m.after });
  }
  return plies;
}

function gameOpening(game, username, openings) {
  const color = colorOf(game, username);
  if (!color) return null;
  let sans = firstSans(game.pgn);
  // On ne rejoue que la phase théorique (quelques coups en général) : c'est elle qui donne l'ouverture.
  const c = new Chess();
  let lastBookPly = 0;
  let opening = null;
  for (let i = 0; i < sans.length; i++) {
    let m;
    try { m = c.move(sans[i]); } catch (e) { m = null; }
    if (!m) { // PGN inattendu : lecture complète, plus lente, par chess.js.
      const full = new Chess();
      try { full.loadPgn(game.pgn); } catch (e) { return null; }
      return gameOpening({ ...game, pgn: full.history().slice(0, MAX_PLY).map((s, k) => (k % 2 ? '' : `${k / 2 + 1}. `) + s).join(' ') }, username, openings);
    }
    sans[i] = m.san;
    if (!openings.isBook(m.after)) break;
    lastBookPly = i + 1;
    const n = openings.nameOf(m.after);
    if (n) opening = n;
  }
  sans = sans.slice(0, MAX_PLY);
  const departure = lastBookPly < sans.length
    ? { ply: lastBookPly + 1, byPlayer: (lastBookPly % 2 === 0 ? 'w' : 'b') === color, san: sans[lastBookPly] }
    : null;
  const opp = color === 'w' ? game.black : game.white;
  const me = color === 'w' ? game.white : game.black;
  return {
    gameId: game.id,
    color,
    sans,
    opening: opening ? { eco: opening.eco, name: opening.name, family: familyOf(opening.name) } : { eco: null, name: null, family: UNKNOWN_FAMILY },
    lastBookPly,
    departure,
    points: pointsFor(game.result, color),
    endTime: game.endTime || null,
    timeClass: game.timeClass || null,
    url: game.url || null,
    rating: me && me.rating,
    opponent: opp ? { username: opp.username, rating: opp.rating } : null,
  };
}

/** Coups du joueur à faire analyser par Stockfish : hors théorie, dans les MAX_PLY premiers demi-coups. */
function movesToAnalyze(info) {
  const plies = replay(info.sans) || [];
  return plies.filter((p) => p.color === info.color && p.ply > info.lastBookPly);
}

/** Identifiant stable et court (FNV-1a 32 bits) d'une position pour une couleur. */
function drillId(color, fen) {
  const s = `${color} ${epd(fen)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${color}-${h.toString(16).padStart(8, '0')}`;
}

/**
 * Exercices tirés des analyses. entries : [{ info (gameOpening), analysis ({ moves:[...] } ou null) }].
 * Chaque coup analysé : { ply, fen, uci, san, best:{uci,score,pv}, second, played:{score}, loss }.
 */
function buildDrills(entries, openings) {
  const map = new Map();
  for (const { info, analysis } of entries) {
    if (!info || !analysis || !Array.isArray(analysis.moves)) continue;
    for (const m of analysis.moves) {
      if (typeof m.loss !== 'number' || !m.best) continue;
      const isDeparture = !!(info.departure && info.departure.byPlayer && info.departure.ply === m.ply);
      const cat = categoryOf(m.loss) || (isDeparture && m.loss > ACCEPT_LOSS ? 'sortie' : null);
      if (!cat) continue;
      const id = drillId(info.color, m.fen);
      let d = map.get(id);
      if (!d) {
        d = {
          id, color: info.color, fen: m.fen, ply: m.ply, opening: info.opening,
          line: info.sans.slice(0, m.ply - 1),
          book: bookMoves(m.fen, openings), best: m.best, second: m.second || null,
          depth: analysis.depth || null, occurrences: [], worstLoss: 0, category: cat, lastSeen: 0,
        };
        map.set(id, d);
      }
      d.occurrences.push({ gameId: info.gameId, ply: m.ply, uci: m.uci, san: m.san, loss: m.loss, endTime: info.endTime, url: info.url, timeClass: info.timeClass, opponent: info.opponent });
      if (m.loss > d.worstLoss) d.worstLoss = m.loss;
      if (SEVERITY[cat] < SEVERITY[d.category]) d.category = cat;
      if ((info.endTime || 0) > d.lastSeen) d.lastSeen = info.endTime || 0;
    }
  }
  return [...map.values()];
}

/**
 * Vérification sans moteur. { accepted, reason } si la réponse est connue, null s'il faut évaluer le coup.
 */
function quickCheck(drill, uci) {
  const inBook = drill.book.some((x) => x.uci === uci);
  if (drill.best && uci === drill.best.uci) return { accepted: true, reason: inBook ? 'coup de la théorie et meilleur coup de Stockfish' : 'meilleur coup de Stockfish' };
  if (drill.second && uci === drill.second.uci) {
    const l = moveLoss(drill.best.score, drill.second.score);
    if (l !== null && l <= ACCEPT_LOSS) return { accepted: true, reason: `2e choix de Stockfish, presque aussi bon (−${l.toFixed(1).replace('.', ',')} pt)` };
  }
  if (drill.occurrences.some((o) => o.uci === uci)) return { accepted: false, reason: 'c’est le coup joué dans vos parties' };
  // Les autres coups, y compris ceux de la théorie (la base contient aussi des lignes douteuses), sont évalués.
  return null;
}

/**
 * Jugement d'un coup évalué par le moteur (score du point de vue du joueur au trait). Un coup de la théorie a
 * droit à une tolérance plus large (BOOK_ACCEPT_LOSS) : à faible profondeur, Stockfish sous-estime parfois des
 * lignes théoriques correctes ; au-delà, c'est une ligne douteuse de la base.
 */
function judgeScore(drill, uci, score) {
  const loss = moveLoss(drill.best.score, score);
  if (loss === null) return { accepted: false, loss: null, reason: 'évaluation impossible' };
  const inBook = drill.book.some((x) => x.uci === uci);
  const accepted = loss <= (inBook ? BOOK_ACCEPT_LOSS : ACCEPT_LOSS);
  const pts = `−${loss.toFixed(1).replace('.', ',')} pt de chances de gain`;
  if (inBook) return { accepted, loss, reason: accepted ? `coup de la théorie (${pts} selon Stockfish)` : `coup présent dans la base, mais douteux (${pts} selon Stockfish)` };
  return { accepted, loss, reason: `${accepted ? 'presque aussi bon que' : 'nettement moins bon que'} le meilleur coup (${pts})` };
}

/** Nouvel état de répétition espacée après une réponse (seul le premier essai d'une séance compte). */
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

/**
 * Exercices filtrés et triés : d'abord ceux à faire (jamais vus ou échéance passée) — révisions avant
 * nouveautés, puis les plus graves, puis les positions les plus fréquentes — ensuite les autres par échéance.
 * filters : { color, family, categories, onlyDue }.
 */
function selectDrills(drills, states, filters = {}, now = Date.now()) {
  const list = drills.filter((d) => (!filters.color || d.color === filters.color)
    && (!filters.family || d.opening.family === filters.family)
    && (!filters.categories || !filters.categories.length || filters.categories.includes(d.category)))
    .map((d) => { const st = states[d.id] || null; return { ...d, state: st, due: !st || !st.due || st.due <= now }; });
  const counts = {
    total: list.length,
    due: list.filter((d) => d.due).length,
    neverSeen: list.filter((d) => !d.state).length,
    mastered: list.filter((d) => d.state && d.state.box >= MASTERED_BOX).length,
  };
  list.sort((a, b) => {
    if (a.due !== b.due) return a.due ? -1 : 1;
    if (a.due) {
      const sa = a.state ? 0 : 1; const sb = b.state ? 0 : 1;
      if (sa !== sb) return sa - sb;
      if (SEVERITY[a.category] !== SEVERITY[b.category]) return SEVERITY[a.category] - SEVERITY[b.category];
      if (a.occurrences.length !== b.occurrences.length) return b.occurrences.length - a.occurrences.length;
      return a.ply - b.ply || (b.lastSeen - a.lastSeen);
    }
    return a.state.due - b.state.due;
  });
  return { drills: filters.onlyDue ? list.filter((d) => d.due) : list, counts };
}

/**
 * Répertoire : une fiche par (couleur, famille d'ouverture) avec résultats, sorties de théorie, erreurs,
 * exercices et taux de réussite aux exercices.
 * infos : gameOpening[] ; analyses : { gameId: analysis } ; drills : buildDrills() ; states : états des exercices.
 */
function buildRepertoire(infos, analyses, drills, states, now = Date.now()) {
  const fams = new Map();
  const get = (color, opening) => {
    const key = `${color}|${opening.family}`;
    if (!fams.has(key)) {
      fams.set(key, {
        color, family: opening.family, eco: opening.eco, games: 0, wins: 0, draws: 0, losses: 0, points: 0,
        departures: 0, departurePlySum: 0, departuresByPlayer: 0, stayedInBook: 0,
        analysedGames: 0, mistakes: { gaffe: 0, erreur: 0, imprecision: 0 }, analysedMoves: 0,
        drills: 0, drillsDue: 0, drillsMastered: 0, drillsSeen: 0, attempts: 0, successes: 0, variations: new Map(),
        lastPlayed: 0,
      });
    }
    return fams.get(key);
  };
  for (const info of infos) {
    if (!info) continue;
    const f = get(info.color, info.opening);
    f.games++;
    if (info.points === 1) f.wins++; else if (info.points === 0.5) f.draws++; else if (info.points === 0) f.losses++;
    f.points += info.points || 0;
    if ((info.endTime || 0) > f.lastPlayed) f.lastPlayed = info.endTime || 0;
    if (info.departure) {
      f.departures++;
      f.departurePlySum += info.departure.ply;
      if (info.departure.byPlayer) f.departuresByPlayer++;
    } else f.stayedInBook++;
    const vname = info.opening.name || UNKNOWN_FAMILY;
    if (!f.variations.has(vname)) f.variations.set(vname, { name: vname, eco: info.opening.eco, games: 0, points: 0 });
    const v = f.variations.get(vname);
    v.games++; v.points += info.points || 0;
    const a = analyses[info.gameId];
    if (a && Array.isArray(a.moves)) {
      f.analysedGames++;
      for (const m of a.moves) {
        f.analysedMoves++;
        const cat = categoryOf(m.loss);
        if (cat) f.mistakes[cat]++;
      }
    }
  }
  for (const d of drills) {
    const f = fams.get(`${d.color}|${d.opening.family}`);
    if (!f) continue;
    f.drills++;
    const st = states[d.id];
    if (!st || !st.due || st.due <= now) f.drillsDue++;
    if (st) {
      f.drillsSeen++;
      f.attempts += st.attempts || 0;
      f.successes += st.successes || 0;
      if (st.box >= MASTERED_BOX) f.drillsMastered++;
    }
  }
  const out = { w: [], b: [] };
  for (const f of fams.values()) {
    out[f.color].push({
      color: f.color, family: f.family, eco: f.eco, games: f.games, wins: f.wins, draws: f.draws, losses: f.losses,
      scorePct: f.games ? Math.round((f.points / f.games) * 1000) / 10 : null,
      avgDepartureMove: f.departures ? Math.round((f.departurePlySum / f.departures / 2) * 10) / 10 : null,
      departuresByPlayerPct: f.departures ? Math.round((f.departuresByPlayer / f.departures) * 100) : null,
      stayedInBook: f.stayedInBook,
      analysedGames: f.analysedGames, analysedMoves: f.analysedMoves, mistakes: f.mistakes,
      drills: f.drills, drillsDue: f.drillsDue, drillsMastered: f.drillsMastered, drillsSeen: f.drillsSeen,
      attempts: f.attempts, successes: f.successes,
      successRate: f.attempts ? Math.round((f.successes / f.attempts) * 100) : null,
      lastPlayed: f.lastPlayed,
      variations: [...f.variations.values()].map((v) => ({ name: v.name, eco: v.eco, games: v.games, scorePct: Math.round((v.points / v.games) * 1000) / 10 }))
        .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name)),
    });
  }
  for (const c of ['w', 'b']) out[c].sort((a, b) => b.games - a.games || a.family.localeCompare(b.family));
  return out;
}

module.exports = {
  MAX_PLY, LOSS, ACCEPT_LOSS, BOOK_ACCEPT_LOSS, BOX_DAYS, RETRY_MINUTES, MASTERED_BOX, UNKNOWN_FAMILY, CATEGORIES, SEVERITY,
  colorOf, pointsFor, familyOf, categoryOf, bookMoves, firstSans, replay, gameOpening, movesToAnalyze, drillId, buildDrills,
  quickCheck, judgeScore, nextState, selectDrills, buildRepertoire,
};
