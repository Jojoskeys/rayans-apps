/* Interface d'analyse (regroupée par esbuild dans dist-ui/app.js). */
import { Chessground } from 'chessground';
import { Chess } from 'chess.js';
import scoring from '../core/scoring.js';
import promptMod from '../core/prompt.js';
import classifyMod from '../core/classify.js';
import chessutil from '../core/chessutil.js';
import { createExercises } from './exercices-view.js';
import { renderPerf, renderBilan, periodOptions, periodRange, TIME_CLASSES } from './bilan-view.js';

const { formatScore, scoreWin } = scoring;
const { buildClaudePrompt } = promptMod;
const { CATEGORIES, CATEGORY_KEYS } = classifyMod;
const { playUciLine, formatLine, frSan } = chessutil;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Jeton et API ----------
(() => {
  const m = location.hash.match(/jeton=([a-f0-9]+)/);
  if (m) { sessionStorage.setItem('jeton', m[1]); history.replaceState(null, '', location.pathname); }
})();
const TOKEN = sessionStorage.getItem('jeton') || '';
async function api(path, body) {
  const opts = { headers: { 'X-Jeton': TOKEN } };
  if (body !== undefined) { opts.method = 'POST'; opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const r = await fetch(path, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Erreur ${r.status}`);
  return j;
}

// ---------- État ----------
const S = {
  etat: null, player: null, games: [], gameId: null, game: null, report: null,
  ply: 0, orientation: 'white', catNav: null,
  explore: null, // { basePly, moves:[{fenBefore,uci,san,fenAfter,result,pending,error}], index }
  analysisPoll: null, importPoll: null, lastAnalysisDone: -1,
  view: 'partie', bilanSummaries: null, bilanFor: null, bilanLoading: false, lastProcessed: null,
};

// ---------- Échiquier ----------
const cg = Chessground($('board'), {
  coordinates: true,
  animation: { enabled: true, duration: 150 },
  movable: { free: false, showDests: true, events: { after: onUserMove } },
  premovable: { enabled: false },
  draggable: { showGhost: true },
  highlight: { lastMove: true, check: true },
  drawable: { enabled: true },
});

function currentFen() {
  if (S.explore && S.explore.index > 0) return S.explore.moves[S.explore.index - 1].fenAfter;
  const base = S.explore ? S.explore.basePly : S.ply;
  if (!S.report) return chessutil.STANDARD_FEN;
  if (base === 0) return S.report.plies.length ? S.report.plies[0].fenBefore : chessutil.STANDARD_FEN;
  return S.report.plies[base - 1].fenAfter;
}

function destsFor(fen) {
  const c = new Chess(fen);
  const dests = new Map();
  for (const m of c.moves({ verbose: true })) {
    if (!dests.has(m.from)) dests.set(m.from, []);
    dests.get(m.from).push(m.to);
  }
  return dests;
}

function lastMoveSquares() {
  if (S.explore && S.explore.index > 0) { const u = S.explore.moves[S.explore.index - 1].uci; return [u.slice(0, 2), u.slice(2, 4)]; }
  const base = S.explore ? S.explore.basePly : S.ply;
  if (S.report && base > 0) { const u = S.report.plies[base - 1].uci; return [u.slice(0, 2), u.slice(2, 4)]; }
  return undefined;
}

function drawBoard() {
  const fen = currentFen();
  const c = new Chess(fen);
  const arrows = [];
  const entry = currentEntry();
  if (entry && entry.best && entry.best.uci && entry.classification && !['meilleur', 'theorie', 'brillant', 'tres_bon'].includes(entry.classification.category)) {
    arrows.push({ orig: entry.best.uci.slice(0, 2), dest: entry.best.uci.slice(2, 4), brush: 'green' });
  }
  cg.set({
    fen,
    orientation: S.orientation,
    turnColor: c.turn() === 'w' ? 'white' : 'black',
    check: c.inCheck(),
    lastMove: lastMoveSquares(),
    movable: { color: S.report && !c.isGameOver() ? (c.turn() === 'w' ? 'white' : 'black') : undefined, dests: S.report ? destsFor(fen) : new Map() },
  });
  cg.setAutoShapes(arrows);
}

let pendingPromo = null;
function onUserMove(orig, dest) {
  const fen = currentFen();
  const c = new Chess(fen);
  const piece = c.get(orig);
  if (piece && piece.type === 'p' && (dest[1] === '8' || dest[1] === '1')) {
    pendingPromo = { orig, dest, fen };
    const box = $('promo');
    const glyphs = piece.color === 'w' ? { q: '♕', r: '♖', b: '♗', n: '♘' } : { q: '♛', r: '♜', b: '♝', n: '♞' };
    const names = { q: 'Dame', r: 'Tour', b: 'Fou', n: 'Cavalier' };
    box.innerHTML = Object.keys(glyphs).map((k) => `<button data-p="${k}" title="${names[k]}" aria-label="Promotion en ${names[k]}">${glyphs[k]}</button>`).join('');
    box.hidden = false;
    return;
  }
  playExploreMove(fen, orig + dest);
}
$('promo').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !pendingPromo) return;
  $('promo').hidden = true;
  const p = pendingPromo; pendingPromo = null;
  playExploreMove(p.fen, p.orig + p.dest + b.dataset.p);
});

function playExploreMove(fen, uci) {
  // Si le coup joué est celui de la partie (hors exploration), on avance simplement.
  if (!S.explore && S.report && S.ply < S.report.plies.length && S.report.plies[S.ply].uci === uci) { goto(S.ply + 1); return; }
  const c = new Chess(fen);
  let mv;
  try { mv = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); } catch (e) { mv = null; }
  if (!mv) { drawBoard(); return; }
  if (!S.explore) S.explore = { basePly: S.ply, moves: [], index: 0 };
  S.explore.moves = S.explore.moves.slice(0, S.explore.index);
  const item = { fenBefore: fen, uci, san: mv.san, fenAfter: c.fen(), pending: true };
  S.explore.moves.push(item);
  S.explore.index = S.explore.moves.length;
  renderAll();
  const elo = S.report ? S.report.players[mv.color].chesscomElo : null;
  api('/api/explorer', { fen, uci, elo }).then((r) => { item.result = r; item.pending = false; renderAll(); })
    .catch((e) => { item.pending = false; item.error = e.message; renderAll(); });
}

function backToGame() {
  if (!S.explore) return;
  const base = S.explore.basePly;
  S.explore = null;
  goto(base);
}
$('btn-back-game').addEventListener('click', backToGame);

// ---------- Navigation ----------
function goto(ply) {
  if (!S.report) return;
  S.ply = Math.max(0, Math.min(S.report.plies.length, ply));
  renderAll();
  const el = document.querySelector('.mv.current');
  if (el) el.scrollIntoView({ block: 'nearest' });
}
function step(d) {
  if (S.explore) {
    const ni = S.explore.index + d;
    if (ni < 0) return;
    if (ni > S.explore.moves.length) return;
    S.explore.index = ni;
    renderAll();
    return;
  }
  goto(S.ply + d);
}
$('nav-first').onclick = () => (S.explore ? (S.explore.index = 0, renderAll()) : goto(0));
$('nav-prev').onclick = () => step(-1);
$('nav-next').onclick = () => step(1);
$('nav-last').onclick = () => (S.explore ? (S.explore.index = S.explore.moves.length, renderAll()) : goto(S.report ? S.report.plies.length : 0));
$('nav-flip').onclick = flip;
function flip() { S.orientation = S.orientation === 'white' ? 'black' : 'white'; renderAll(); }
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { step(1); e.preventDefault(); }
  else if (e.key === 'ArrowUp' || e.key === 'Home') { $('nav-first').click(); e.preventDefault(); }
  else if (e.key === 'ArrowDown' || e.key === 'End') { $('nav-last').click(); e.preventDefault(); }
  else if (e.key === 'f' || e.key === 'F') flip();
  else if (e.key === 'Escape') backToGame();
});

// ---------- Rendu ----------
function currentEntry() {
  if (S.explore && S.explore.index > 0) {
    const it = S.explore.moves[S.explore.index - 1];
    return it.result ? { ...it.result, ply: null, explored: true, color: it.fenBefore.split(' ')[1] } : { ...it, explored: true, pending: it.pending };
  }
  if (S.explore) return null;
  if (!S.report || S.ply === 0) return null;
  return S.report.plies[S.ply - 1];
}

function evalWhiteNow() {
  const e = currentEntry();
  if (e && e.explored) {
    if (!e.played || !e.played.score) return null;
    return e.color === 'w' ? e.played.score : scoring.negateScore(e.played.score);
  }
  if (e) return e.evalAfterWhite || null;
  if (S.explore && S.explore.basePly > 0) return S.report.plies[S.explore.basePly - 1].evalAfterWhite;
  return S.report ? S.report.startEvalWhite : null;
}

function renderEval() {
  const sc = evalWhiteNow();
  const fen = currentFen();
  const c = new Chess(fen);
  let pct = 50; let txt = '';
  if (c.isCheckmate()) { pct = c.turn() === 'w' ? 0 : 100; txt = 'Mat'; }
  else if (c.isStalemate() || c.isInsufficientMaterial()) { pct = 50; txt = '½'; }
  else if (sc) { pct = scoreWin(sc); txt = formatScore(sc).replace('+', ''); }
  $('evalfill').style.height = `${pct}%`;
  $('evalbar').classList.toggle('flipped', S.orientation === 'black');
  $('evaltext').textContent = txt;
  $('evalbar').title = sc ? `Évaluation (Blancs) : ${formatScore(sc)}` : 'Évaluation';
}

function playerLine(color) {
  if (!S.game) return '';
  const p = color === 'w' ? S.game.white : S.game.black;
  return `${color === 'w' ? '⚪' : '⚫'} ${esc(p.username)} <span class="muted">(${p.rating || '?'})</span>`;
}

function renderPlayers() {
  const topColor = S.orientation === 'white' ? 'b' : 'w';
  $('top-player').innerHTML = playerLine(topColor);
  $('bottom-player').innerHTML = playerLine(topColor === 'w' ? 'b' : 'w');
}

function symHtml(cls) {
  if (!cls) return '';
  const sym = cls.symbol || '';
  return sym ? `<span class="sym cat-${cls.category}" title="${esc(cls.label)}">${esc(sym)}</span>` : '';
}

function renderMoves() {
  const card = $('moves-card');
  if (!S.report) { card.hidden = true; return; }
  card.hidden = false;
  const op = S.report.opening;
  $('opening').innerHTML = op ? `Ouverture : ${esc(op.name)} <span class="muted">(${esc(op.eco)}, base lichess-org/chess-openings)</span>` : '<span class="muted">Ouverture non reconnue par la base lichess-org/chess-openings</span>';
  const cells = [];
  const plies = S.report.plies;
  const firstBlack = plies.length && plies[0].color === 'b';
  for (let i = 0; i < plies.length; i++) {
    const p = plies[i];
    const no = parseInt(p.fenBefore.split(' ')[5], 10);
    if (p.color === 'w' || (i === 0 && firstBlack)) {
      cells.push(`<div class="no">${no}.</div>`);
      if (p.color === 'b') cells.push('<div></div>');
    }
    const cur = !S.explore && S.ply === p.ply ? ' current' : '';
    const title = p.classification ? `${p.classification.label}${p.classification.loss > 0 ? ` (−${p.classification.loss.toFixed(1)} pts)` : ''}` : (p.analyzed ? '' : 'Non analysé');
    cells.push(`<div class="mv${cur}" role="listitem" data-ply="${p.ply}" title="${esc(title)}">${esc(frSan(p.san))} ${symHtml(p.classification)}</div>`);
  }
  $('moves').innerHTML = cells.join('');
}
$('moves').addEventListener('click', (e) => {
  const el = e.target.closest('.mv');
  if (!el) return;
  S.explore = null;
  goto(parseInt(el.dataset.ply, 10));
});

function fmtAcc(a) { return a === null || a === undefined ? '—' : `${a.toFixed(1).replace('.', ',')} %`; }

function renderSummary() {
  const box = $('summary');
  const r = S.report;
  if (!r || !r.analysis || r.analysis.analyzedPlies === 0) { box.hidden = true; return; }
  box.hidden = false;
  const col = (c) => {
    const p = r.players[c];
    const est = p.estimatedElo;
    const estTxt = est.tooShort
      ? `<div class="warnbox">Échantillon trop court (${p.evaluatedMoves} coup(s)) : pas d’Elo estimé.</div>`
      : `<div>Elo estimé (partie) : <b>≈ ${est.elo}</b> <span class="muted">± ${est.margin}</span></div>`;
    const cats = CATEGORY_KEYS.map((k) => {
      const n = p.counts[k].length;
      return `<button data-color="${c}" data-cat="${k}" ${n ? '' : 'disabled'} aria-label="${esc(CATEGORIES[k].label)} · ${n}"><span><span class="badge cat-${k}">${esc(CATEGORIES[k].symbol || ' ')}</span> ${esc(CATEGORIES[k].label)}</span><span>${n}</span></button>`;
    }).join('');
    return `<div class="pl"><h3>${c === 'w' ? '⚪' : '⚫'} ${esc(p.username)}</h3>
      <div class="acc" data-acc="${c}">${fmtAcc(p.accuracy)}</div>
      <div class="muted small">Précision · ${p.evaluatedMoves} coup(s) pris en compte${p.evaluatedMoves && p.evaluatedMoves < 10 ? ' (peu de coups : valeur indicative)' : ''}</div>
      ${estTxt}
      <div class="muted small">Elo Chess.com au moment de la partie : ${p.chesscomElo || '?'}</div>
      <div class="cats">${cats}</div></div>`;
  };
  let nav = '';
  if (S.catNav) {
    const list = r.players[S.catNav.color].counts[S.catNav.cat];
    nav = `<div class="catnav"><span>${esc(CATEGORIES[S.catNav.cat].label)} (${S.catNav.color === 'w' ? 'Blancs' : 'Noirs'}) : ${S.catNav.idx + 1} / ${list.length}</span>
      <button class="ghost" id="cat-prev" ${S.catNav.idx <= 0 ? 'disabled' : ''}>Précédente</button>
      <button class="ghost" id="cat-next" ${S.catNav.idx >= list.length - 1 ? 'disabled' : ''}>Suivante</button></div>`;
  }
  box.innerHTML = `<div class="summary-grid">${col('w')}${col('b')}</div>${nav}
    <p class="muted small">Précision, catégories et Elo estimé sont des approximations calculées par cette application (règles dans REGLES-ANALYSE.md), indépendantes de Chess.com.</p>`;
}
$('summary').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !S.report) return;
  if (b.dataset.cat) {
    S.catNav = { color: b.dataset.color, cat: b.dataset.cat, idx: 0 };
    S.explore = null;
    goto(S.report.players[S.catNav.color].counts[S.catNav.cat][0]);
  } else if (b.id === 'cat-next' || b.id === 'cat-prev') {
    const list = S.report.players[S.catNav.color].counts[S.catNav.cat];
    S.catNav.idx = Math.max(0, Math.min(list.length - 1, S.catNav.idx + (b.id === 'cat-next' ? 1 : -1)));
    S.explore = null;
    goto(list[S.catNav.idx]);
  }
});

function lineText(fen, line) {
  if (!line || !line.pv || !line.pv.length) return '—';
  return formatLine(fen, playUciLine(fen, line.pv, 12).sans);
}

function renderDetail() {
  const box = $('detail');
  const e = currentEntry();
  if (!e) {
    box.hidden = !S.report;
    if (S.report) box.innerHTML = '<div class="muted">Position de départ. Avancez avec → ou cliquez sur un coup.</div>';
    return;
  }
  box.hidden = false;
  if (e.explored && e.pending) {
    box.innerHTML = `<h3>Variante explorée : ${esc(frSan(e.san))}</h3><div class="muted">Stockfish calcule ce coup (profondeur ${S.etat && S.etat.settings ? S.etat.settings.depth : 22})…</div>`;
    return;
  }
  if (e.explored && e.error) { box.innerHTML = `<h3>${esc(frSan(e.san))}</h3><div class="status bad">${esc(e.error)}</div>`; return; }
  if (!e.explored && !e.analyzed) {
    box.innerHTML = `<h3>${esc(moveLabel(e))}</h3><div class="muted">Ce coup n’est pas encore analysé.</div>`;
    return;
  }
  const cls = e.classification;
  const fen = e.fenBefore;
  const side = fen.split(' ')[1] === 'w' ? 'Blancs' : 'Noirs';
  const engineName = (e.explored ? e.engine && e.engine.name : S.report.analysis && S.report.analysis.engine && S.report.analysis.engine.name) || 'Stockfish';
  const depth = e.best ? e.best.depth : '?';
  const bestSan = e.best && e.best.pv && e.best.pv.length ? frSan(playUciLine(fen, [e.best.pv[0]]).sans[0]) : '—';
  const sentences = (e.explanation && e.explanation.sentences) || [];
  const showLines = cls && !['meilleur', 'theorie'].includes(cls.category);
  const src = [];
  src.push(`Classement et scores : ${esc(engineName)} local, profondeur ${depth}, MultiPV 2${e.played && e.played.source ? ` (coup joué : ${esc(e.played.source)})` : ''}.`);
  if (e.cloud && e.cloud.lines && e.cloud.lines.length) src.push(`Lichess cloud-eval : ${formatScore(e.cloud.lines[0].score)} (profondeur ${e.cloud.depth}, point de vue des ${side}) — affiché à titre indicatif.`);
  if (e.tablebase) {
    const names = { win: 'gain', loss: 'perte', draw: 'nulle', 'cursed-win': 'gain (annulé par la règle des 50 coups)', 'blessed-loss': 'perte (sauvée par la règle des 50 coups)' };
    const tbBest = e.tablebase.moves && e.tablebase.moves[0];
    const keep = (e.tablebase.moves || []).filter((m) => m.category === e.tablebase.category)
      .map((m) => frSan(m.san));
    src.push(`Table de finales Lichess : ${names[e.tablebase.category] || e.tablebase.category} pour les ${side} avant le coup${tbBest ? `, meilleur coup ${esc(frSan(tbBest.san))}` : ''}${keep.length ? ` ; coups qui préservent ce résultat : ${esc(keep.join(', '))}` : ''} (résultat exact).`);
  }
  const copy = `<button id="btn-claude" title="Copie une question prête à coller sur claude.ai (aucun envoi automatique)">Demander à Claude</button>`;
  box.innerHTML = `<div class="detail">
    <h3>${esc(moveLabel(e))} ${cls ? `<span class="badge cat-${cls.category}">${esc(cls.symbol || '·')}</span> ${esc(cls.label)}` : ''}</h3>
    <dl class="kv">
      <dt>Perte</dt><dd>${cls ? `${cls.loss.toFixed(1).replace('.', ',')} point(s) de chances de gain` : '—'}${cls && cls.factor && cls.factor > 1 ? ` <span class="muted">(seuils assouplis ×${cls.factor.toFixed(2).replace('.', ',')})</span>` : ''}</dd>
      <dt>Meilleur coup</dt><dd><b>${esc(bestSan)}</b> ${formatScore(e.best && e.best.score)}</dd>
      <dt>Coup joué</dt><dd><b>${esc(frSan(e.san))}</b> ${formatScore(e.played && e.played.score)} <span class="muted">(point de vue des ${side})</span></dd>
    </dl>
    ${cls && cls.reasons ? `<div class="muted small">${cls.reasons.map(esc).join(' · ')}</div>` : ''}
    ${sentences.length ? `<div class="expl">${sentences.map((s) => `<p>${esc(s)}</p>`).join('')}</div>` : ''}
    ${showLines ? `<div class="small muted">Variante 1 (meilleur coup, ${formatScore(e.best && e.best.score)})</div><div class="line">${esc(lineText(fen, e.best))}</div>
    ${e.second ? `<div class="small muted">Variante 2 (${formatScore(e.second.score)})</div><div class="line">${esc(lineText(fen, e.second))}</div>` : ''}
    <div class="small muted">Après le coup joué (${formatScore(e.played && e.played.score)})</div><div class="line">${esc(lineText(fen, e.played))}</div>` : ''}
    <div class="sources">${src.join('<br>')}</div>
    <div class="row" style="margin-top:8px">${copy}</div>
  </div>`;
  $('btn-claude').onclick = () => askClaude(e, engineName);
}

function moveLabel(e) {
  return promptMod.moveLabel(e.fenBefore, e.san);
}

async function askClaude(e, engineName) {
  const fen = e.fenBefore;
  const bestSan = e.best && e.best.pv && e.best.pv.length ? playUciLine(fen, [e.best.pv[0]]).sans[0] : null;
  const mk = (l) => (l && l.pv && l.pv.length ? { text: lineText(fen, l), score: l.score } : null);
  const g = S.game;
  const text = buildClaudePrompt({
    game: g ? { white: g.white.username, black: g.black.username, whiteElo: g.white.rating, blackElo: g.black.rating, date: g.date, url: g.url } : null,
    explored: !!e.explored,
    fenBefore: fen,
    san: e.san,
    uci: e.uci,
    categoryLabel: e.classification && e.classification.label,
    loss: e.classification && e.classification.loss,
    best: e.best ? { san: bestSan, uci: e.best.uci, score: e.best.score } : null,
    played: e.played,
    lines: { best: mk(e.best), second: mk(e.second), played: mk(e.played) },
    engineName,
    depth: e.best && e.best.depth,
  });
  try {
    if (window.bureau && window.bureau.copierTexte) await window.bureau.copierTexte(text);
    else await navigator.clipboard.writeText(text);
    toast('Question copiée dans le presse-papiers. Collez-la sur claude.ai (rien n’a été envoyé).');
  } catch (err) {
    toast(`Copie impossible : ${err.message}`, true);
  }
}

let toastTimer = null;
function toast(msg, bad) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('bad', !!bad);
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
}

function renderExploreBanner() {
  const b = $('explore-banner');
  if (!S.explore) { b.hidden = true; return; }
  b.hidden = false;
  const base = S.explore.basePly;
  const from = base === 0 ? 'depuis la position de départ' : `après ${moveLabel(S.report.plies[base - 1])}`;
  const fen0 = S.explore.moves.length ? S.explore.moves[0].fenBefore : currentFen();
  const line = formatLine(fen0, S.explore.moves.map((m) => m.san));
  $('explore-text').textContent = `Variante explorée ${from} : ${line || '(aucun coup)'}`;
}

function settingsDepth() { return S.etat && S.etat.settings ? S.etat.settings.depth : 22; }

function renderAnalysisCard(st) {
  const card = $('analysis-card');
  if (!S.report) { card.hidden = true; return; }
  card.hidden = false;
  const a = S.report.analysis;
  const running = st && st.status === 'running' && st.gameId === S.gameId;
  const qItems = (st && st.queue && st.queue.items) || [];
  const qPos = qItems.findIndex((i) => i.gameId === S.gameId);
  const queued = !running && qPos >= 0;
  const total = S.report.plies.length;
  const done = running ? st.done : (a ? a.analyzedPlies : 0);
  const status = $('analysis-status');
  const depth = settingsDepth();
  const otherDepth = a && a.settings && a.settings.depth !== depth;
  $('btn-analyse-cancel').hidden = !(running || queued);
  $('btn-analyse-cancel').textContent = running ? 'Annuler' : 'Retirer de la file';
  $('btn-analyse').hidden = running || (a && a.complete && !otherDepth);
  $('btn-analyse').textContent = queued ? 'Analyser maintenant'
    : a && a.complete && otherDepth ? `Réanalyser à la profondeur ${depth}`
      : a && a.analyzedPlies > 0 && !otherDepth ? 'Reprendre l’analyse' : 'Analyser';
  const prog = $('analysis-progress');
  prog.hidden = !(running || (a && !a.complete && a.analyzedPlies > 0));
  prog.firstElementChild.style.width = `${total ? (100 * done) / total : 0}%`;
  const eng = (a && a.engine && a.engine.name) || (S.etat && S.etat.engine && S.etat.engine.name) || 'Stockfish';
  const err = st && st.errors && st.errors[S.gameId];
  if (running) { status.className = st.warning ? 'status warn' : 'status'; status.textContent = `Analyse en cours : ${done}/${total} demi-coups (${eng}, profondeur ${st.depth})…${st.warning ? ` ${st.warning}` : ''}`; }
  else if (queued) { status.className = 'status'; status.textContent = `En file d’attente (position ${qPos + 1} sur ${qItems.length}, profondeur ${qItems[qPos].depth})${st.queue.paused ? ' — file en pause' : ''}.${a && a.analyzedPlies ? ` Déjà fait : ${a.analyzedPlies}/${total} demi-coups.` : ''}`; }
  else if (a && a.complete) { status.className = 'status ok'; status.textContent = `Analyse complète enregistrée : ${a.engine.name}, profondeur ${a.settings.depth}, MultiPV ${a.settings.multipv}, ${a.engine.threads} fil(s).${a.engine.fallback ? ` ${a.engine.fallback}` : ''}`; }
  else if (a && a.analyzedPlies > 0) { status.className = 'status warn'; status.textContent = `Analyse partielle : ${a.analyzedPlies}/${total} demi-coups (profondeur ${a.settings.depth}). Vous pouvez la reprendre.${err ? ` Erreur : ${err}` : ''}`; }
  else if (total === 0) { status.className = 'status'; status.textContent = 'Partie sans coup : rien à analyser.'; $('btn-analyse').hidden = true; }
  else { status.className = err ? 'status bad' : 'status'; status.textContent = err ? `Échec de l’analyse : ${err}` : 'Partie non analysée.'; }
}

function renderHead() {
  const g = S.game;
  if (!g) return;
  const d = g.endTime ? new Date(g.endTime * 1000).toLocaleString('fr-FR') : g.date;
  $('game-head').innerHTML = `<div class="row between"><b>${esc(g.white.username)} – ${esc(g.black.username)} · ${esc(g.result)}</b>
    ${g.url ? `<button class="ghost" id="open-link" title="${esc(g.url)}">Voir sur Chess.com</button>` : ''}</div>
    <div class="muted small">${esc(d)} · ${esc(g.timeClass || '')} ${esc(g.timeControl || '')} · ${g.rated ? 'classée' : 'amicale'} · ${esc(g.termination || '')}</div>`;
  const ol = $('open-link');
  if (ol) ol.onclick = () => (window.bureau ? window.bureau.ouvrirLien(g.url) : window.open(g.url));
}

let lastStatus = null;
function renderAll() {
  drawBoard();
  renderEval();
  renderPlayers();
  renderMoves();
  renderSummary();
  renderDetail();
  renderExploreBanner();
  renderAnalysisCard(lastStatus);
}

// ---------- Parties ----------
async function loadPlayers(select) {
  const players = await api('/api/joueurs');
  const sel = $('player-select');
  sel.innerHTML = players.length ? players.map((p) => `<option value="${esc(p.key)}">${esc(p.username)}</option>`).join('') : '<option value="">(aucun joueur importé)</option>';
  if (select) sel.value = select.toLowerCase();
  if (!sel.value && players.length) sel.value = players[0].key;
  S.player = sel.value || null;
  await loadGames();
}
$('player-select').addEventListener('change', async () => { S.player = $('player-select').value; S.bilanSummaries = null; exercises.invalidate(); await loadGames(); renderBilanView(); });
$('game-filter').addEventListener('input', renderGames);

async function loadGames() {
  S.games = S.player ? await api(`/api/parties?joueur=${encodeURIComponent(S.player)}`) : [];
  renderGames();
}

function renderGames() {
  const f = $('game-filter').value.trim().toLowerCase();
  const me = (S.player || '').toLowerCase();
  const list = S.games.filter((g) => !f || `${g.white.username} ${g.black.username} ${g.timeClass} ${g.date}`.toLowerCase().includes(f));
  $('game-count').textContent = `${list.length} partie(s)${f ? ` sur ${S.games.length}` : ''}`;
  $('games').innerHTML = list.slice(0, 600).map((g) => {
    const white = g.white.username.toLowerCase() === me;
    const opp = white ? g.black : g.white;
    let res = 'draw'; let txt = '½';
    if (g.result === '1-0') { res = white ? 'win' : 'loss'; txt = white ? 'Gain' : 'Perte'; }
    if (g.result === '0-1') { res = white ? 'loss' : 'win'; txt = white ? 'Perte' : 'Gain'; }
    if (g.result === '1/2-1/2') txt = 'Nulle';
    const d = g.endTime ? new Date(g.endTime * 1000).toLocaleDateString('fr-FR') : g.date;
    const queued = queuedIds().has(g.id);
    const an = (g.analysis ? (g.analysis.complete ? ` · ✓ analysée${g.analysis.depth && g.analysis.depth !== settingsDepth() ? ` (prof. ${g.analysis.depth})` : ''}` : ' · analyse partielle') : '') + (queued ? ' · ⏳ en file' : '');
    return `<li data-id="${esc(g.id)}" class="${g.id === S.gameId ? 'active' : ''}"><span class="opp">${white ? '⚪' : '⚫'} vs ${esc(opp.username)} (${opp.rating || '?'})</span><span class="res ${res}">${txt}</span>
      <span class="meta">${esc(d)} · ${esc(g.timeClass || '')} · ${Math.ceil(g.plyCount / 2)} coups${an}</span></li>`;
  }).join('');
}
$('games').addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  if (S.view !== 'partie') setView('partie');
  openGame(li.dataset.id);
});

async function openGame(id, keepPly) {
  const r = await api(`/api/partie/${encodeURIComponent(id)}`);
  const changed = S.gameId !== id;
  S.gameId = id; S.game = r.game; S.report = r.report;
  if (changed) {
    S.explore = null; S.catNav = null; S.ply = 0;
    const me = (S.player || '').toLowerCase();
    S.orientation = r.game.black.username.toLowerCase() === me ? 'black' : 'white';
  } else if (!keepPly) S.ply = 0;
  renderHead();
  renderGames();
  renderAll();
}

$('btn-analyse').addEventListener('click', async () => {
  if (!S.gameId) return;
  try { lastStatus = await api(`/api/analyse/${encodeURIComponent(S.gameId)}/lancer`, { depth: settingsDepth() }); renderQueue(lastStatus); renderAnalysisCard(lastStatus); pollAnalysis(); } catch (e) { toast(e.message, true); }
});
$('btn-analyse-cancel').addEventListener('click', async () => {
  lastStatus = await api('/api/analyse/annuler', { gameId: S.gameId });
  if (S.gameId) await openGame(S.gameId, true);
  renderQueue(lastStatus);
  loadGames();
});

function queuedIds() {
  const items = (lastStatus && lastStatus.queue && lastStatus.queue.items) || [];
  return new Set(items.map((i) => i.gameId));
}

/**
 * Suivi permanent de la file : toutes les 0,8 s pendant un calcul, toutes les 5 s sinon.
 * La partie affichée est rechargée à chaque demi-coup calculé ; l'historique et le bilan à chaque partie terminée.
 */
function pollAnalysis() {
  clearTimeout(S.analysisPoll);
  const tick = async () => {
    let st = null;
    try {
      st = await api('/api/analyse');
      const prevQueued = queuedIds();
      lastStatus = st;
      if (st.gameId === S.gameId && st.status === 'running' && st.done !== S.lastAnalysisDone) {
        S.lastAnalysisDone = st.done;
        await openGame(S.gameId, true);
      } else renderAnalysisCard(st);
      const processed = `${st.queue.processed}|${st.status}|${st.gameId}`;
      if (S.lastProcessed !== null && processed !== S.lastProcessed) {
        if (S.gameId && st.status !== 'running') await openGame(S.gameId, true);
        S.bilanSummaries = null; S.bilanFor = null; exercises.invalidate();
        await loadGames();
        if (S.view === 'bilan') renderBilanView();
      } else if ([...prevQueued].join() !== [...queuedIds()].join()) renderGames();
      S.lastProcessed = processed;
      renderQueue(st);
    } catch (e) { /* serveur momentanément indisponible : nouvel essai */ }
    S.analysisPoll = setTimeout(tick, st && st.status === 'running' ? 800 : 5000);
  };
  tick();
}

function fmtDuration(ms) {
  if (ms == null) return null;
  const min = Math.round(ms / 60000);
  if (min < 1) return 'moins d’une minute';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60); const m = min % 60;
  return `${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}`;
}

function gameName(id) {
  const g = S.games.find((x) => x.id === id);
  if (!g) return 'une partie';
  const me = (S.player || '').toLowerCase();
  const opp = g.white.username.toLowerCase() === me ? g.black : g.white;
  return `vs ${opp.username}`;
}

function renderQueue(st) {
  if (!st || !st.queue) return;
  const q = st.queue;
  const s = $('queue-status');
  const running = st.status === 'running';
  const eta = fmtDuration(q.etaMs);
  $('queue-actions').hidden = !(q.length || running);
  $('q-pause').hidden = !(running && !q.paused);
  $('q-resume').hidden = !(q.paused && q.length);
  const prog = $('queue-progress');
  const totalGames = q.processed + q.length;
  prog.hidden = !(running || q.length);
  prog.firstElementChild.style.width = `${totalGames ? (100 * (q.processed + (running && st.total ? st.done / st.total : 0))) / totalGames : 0}%`;
  if (running) {
    s.className = st.warning ? 'status warn' : 'status';
    s.textContent = `En cours : ${gameName(st.gameId)} (${st.done}/${st.total || '?'} demi-coups, profondeur ${st.depth}). ${q.length - 1} autre(s) en attente · ${q.processed} terminée(s)${q.failed ? `, ${q.failed} en échec` : ''}${eta ? ` · reste ≈ ${eta}` : ' · durée estimée après quelques coups'}.`;
  } else if (q.paused && q.length) {
    s.className = 'status warn';
    s.textContent = `${q.message ? `${q.message} ` : 'File en pause. '}${q.length} partie(s) en attente${eta ? ` (≈ ${eta})` : ''}.`;
  } else if (q.processed) {
    s.className = q.failed ? 'status warn' : 'status ok';
    s.textContent = `File terminée : ${q.processed} partie(s) traitée(s)${q.failed ? `, dont ${q.failed} en échec` : ''}.`;
  } else { s.className = 'status muted'; s.textContent = 'File vide. Les parties sont analysées une par une ; vous pouvez continuer à utiliser l’application.'; }
  renderLotEstimate();
}

function renderLotEstimate() {
  const d = +$('lot-depth').value;
  const ms = lastStatus && lastStatus.queue && lastStatus.queue.msPerPly ? lastStatus.queue.msPerPly[d] : null;
  const n = +$('lot-n').value;
  $('lot-estim').textContent = ms
    ? `Mesuré sur cet ordinateur : ≈ ${(ms / 1000).toFixed(1).replace('.', ',')} s par demi-coup à la profondeur ${d}, soit ≈ ${fmtDuration(ms * 80 * n)} pour ${n} parties de 40 coups.`
    : 'Plus la profondeur est faible, plus c’est rapide (moins précis). Gardez la même profondeur pour comparer vos parties.';
}

$('lot-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!S.player) { toast('Importez d’abord vos parties.', true); return; }
  try {
    const r = await api('/api/analyse/lot', { joueur: S.player, nombre: +$('lot-n').value, cadence: $('lot-cadence').value || null, couleur: $('lot-couleur').value || null, depth: +$('lot-depth').value });
    lastStatus = r.status;
    toast(r.ajoutees ? `${r.ajoutees} partie(s) ajoutée(s) à la file (profondeur ${r.depth}).` : `Aucune partie à ajouter${r.dejaAnalysees ? ` (${r.dejaAnalysees} déjà analysée(s) à cette profondeur)` : ''}.`, !r.ajoutees);
    renderQueue(lastStatus); renderGames(); pollAnalysis();
  } catch (err) { toast(err.message, true); }
});
$('lot-n').addEventListener('change', renderLotEstimate);
$('q-pause').addEventListener('click', async () => { lastStatus = await api('/api/analyse/pause', {}); renderQueue(lastStatus); renderAnalysisCard(lastStatus); });
$('q-resume').addEventListener('click', async () => { lastStatus = await api('/api/analyse/reprendre', {}); renderQueue(lastStatus); pollAnalysis(); });
$('q-clear').addEventListener('click', async () => {
  const b = $('q-clear');
  if (!b.dataset.confirm) { b.dataset.confirm = '1'; b.textContent = 'Confirmer : vider'; setTimeout(() => { delete b.dataset.confirm; b.textContent = 'Vider la file'; }, 4000); return; }
  delete b.dataset.confirm; b.textContent = 'Vider la file';
  lastStatus = await api('/api/analyse/vider', {});
  renderQueue(lastStatus); renderGames(); renderAnalysisCard(lastStatus);
});

// ---------- Vue Bilan ----------
function setView(v) {
  S.view = v;
    $('bilan').hidden = v !== 'bilan';
  $('exos').hidden = v !== 'exos';
  document.querySelector('.board-zone').hidden = v !== 'partie';
  document.querySelector('.analysis').hidden = v !== 'partie';
  document.querySelector('.layout').classList.toggle('mode-bilan', v === 'bilan');
  document.querySelector('.layout').classList.toggle('mode-exos', v === 'exos');
  for (const t of ['partie', 'bilan', 'exos']) { $(`tab-${t}`).classList.toggle('active', v === t); $(`tab-${t}`).setAttribute('aria-selected', String(v === t)); }
  if (v === 'bilan') renderBilanView();
  else if (v === 'exos') exercises.open();
  else { cg.redrawAll(); renderAll(); }
}
const exercises = createExercises({
  api, toast,
  getPlayer: () => S.player,
  openInGame: async (id, ply) => { setView('partie'); await openGame(id); goto(ply); },
});
$('tab-exos').addEventListener('click', () => setView('exos'));
$('tab-partie').addEventListener('click', () => setView('partie'));
$('tab-bilan').addEventListener('click', () => setView('bilan'));

function bilanFilters() {
  return { timeClass: $('f-cadence').value || null, color: $('f-couleur').value || null, ...periodRange($('f-periode').value) };
}
function fillPeriodOptions() {
  const sel = $('f-periode');
  const cur = sel.value || 'tout';
  const opts = periodOptions(S.games);
  sel.innerHTML = opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
  sel.value = opts.some(([v]) => v === cur) ? cur : 'tout';
}

async function renderBilanView() {
  if (S.view !== 'bilan') return;
  const me = S.player;
  const p = S.etat && S.etat.players.find((x) => x.key === me);
  $('bilan-player').textContent = me ? `Joueur : ${p ? p.username : me}` : 'Aucun joueur importé';
  fillPeriodOptions();
  const f = bilanFilters();
  const grain = $('f-grain').value;
  renderPerf($('perf-card'), S.games, me || '', { ...f, ratedOnly: $('f-classees').checked }, grain);
  const matching = S.games.filter((g) => {
    const white = g.white.username.toLowerCase() === (me || '').toLowerCase();
    return (!f.timeClass || g.timeClass === f.timeClass) && (!f.color || f.color === (white ? 'w' : 'b'))
      && (!f.from || (g.endTime && g.endTime >= f.from)) && (!f.to || (g.endTime && g.endTime <= f.to));
  }).length;
  if (!me) { $('bilan-card').innerHTML = ''; return; }
  if (S.bilanFor !== me || !S.bilanSummaries) {
    renderBilan($('bilan-card'), null);
    if (S.bilanLoading) return;
    S.bilanLoading = true;
    try {
      const r = await api(`/api/bilan?joueur=${encodeURIComponent(me)}`);
      S.bilanSummaries = r.summaries; S.bilanFor = me;
    } catch (e) { $('bilan-card').innerHTML = `<div class="status bad">${esc(e.message)}</div>`; return; } finally { S.bilanLoading = false; }
    return renderBilanView();
  }
  renderBilan($('bilan-card'), S.bilanSummaries, me, f, grain, matching);
}
for (const id of ['f-cadence', 'f-couleur', 'f-periode', 'f-grain', 'f-classees']) $(id).addEventListener('change', renderBilanView);
$('bilan-card').addEventListener('click', (e) => {
  const b = e.target.closest('[data-open]');
  if (!b) return;
  setView('partie');
  openGame(b.dataset.open);
});

// ---------- Import ----------
$('import-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pseudo = $('pseudo').value.trim();
  try { await api('/api/import', { pseudo }); pollImport(); } catch (err) { setImportStatus(err.message, 'bad'); }
});
$('btn-import-cancel').addEventListener('click', () => api('/api/import/annuler', {}));
function setImportStatus(msg, cls) { const s = $('import-status'); s.textContent = msg; s.className = `status ${cls || ''}`; }
function pollImport() {
  clearTimeout(S.importPoll);
  const tick = async () => {
    const st = await api('/api/import');
    const running = st.status === 'running';
    $('btn-import').disabled = running;
    $('import-actions').hidden = !running;
    const prog = $('import-progress');
    prog.hidden = !(st.monthsToFetch > 0 && st.status !== 'idle');
    prog.firstElementChild.style.width = `${st.monthsToFetch ? (100 * st.monthsDone) / st.monthsToFetch : 0}%`;
    const rej = st.rejectedTotal ? ` · ${st.rejectedTotal} partie(s) écartée(s) (${Object.entries(st.rejected || {}).map(([k, v]) => `${v} ${({ variant: 'variante', setup: 'position non standard', ongoing: 'en cours', undetermined: 'résultat indéterminé', incoherent: 'incohérente', pgn: 'PGN invalide' })[k] || k}`).join(', ')})` : '';
    if (running) setImportStatus(`${st.message || 'Import…'} ${st.monthsToFetch ? `(${st.monthsDone}/${st.monthsToFetch} mois${st.monthsSkipped ? `, ${st.monthsSkipped} déjà à jour` : ''})` : ''} · ${st.added} nouvelle(s)${rej}`);
    else if (st.status === 'done') setImportStatus(`${st.message} ${st.totalGames} partie(s) au total${rej}.`, 'ok');
    else if (st.status === 'partial') setImportStatus(`⚠ ${st.message}${rej}`, 'warn');
    else if (st.status === 'error') setImportStatus(st.message, 'bad');
    if (running) { S.importPoll = setTimeout(tick, 700); if (st.monthsDone && st.monthsDone % 3 === 0) loadPlayers(st.username); }
    else if (st.username) { $('btn-import').textContent = 'Mettre à jour'; await loadPlayers(st.username); }
  };
  tick();
}

// ---------- Réglages ----------
$('btn-settings').addEventListener('click', () => {
  const s = $('settings'); s.hidden = !s.hidden; $('btn-settings').setAttribute('aria-expanded', String(!s.hidden));
});
function renderSettings() {
  const s = S.etat.settings;
  $('set-leniency').value = Math.round(s.leniency * 100);
  $('set-leniency-val').textContent = `${Math.round(s.leniency * 100)} % (à 800 Elo et moins, progressif jusqu’à 1400)`;
  $('set-cloud').checked = s.useCloud; $('set-tb').checked = s.useTablebase;
  const depths = S.etat.depths || [12, 14, 16, 18, 20, 22, 24];
  for (const id of ['set-depth', 'lot-depth']) {
    $(id).innerHTML = depths.map((d) => `<option value="${d}">${d}${d === 22 ? ' (référence)' : ''}</option>`).join('');
    $(id).value = String(s.depth);
  }
  $('set-multipv').textContent = s.multipv;
  updateBadge();
  renderLotEstimate();
  $('set-datadir').textContent = S.etat.dataDir;
}
async function saveSettings(patch) {
  S.etat.settings = await api('/api/reglages', patch);
  renderSettings();
  if (patch.leniency !== undefined) { S.bilanSummaries = null; exercises.invalidate(); renderBilanView(); }
  if (patch.depth !== undefined) renderGames();
  if (S.gameId) openGame(S.gameId, true);
}
$('set-leniency').addEventListener('change', (e) => saveSettings({ leniency: e.target.value / 100 }));
$('set-cloud').addEventListener('change', (e) => saveSettings({ useCloud: e.target.checked }));
$('set-tb').addEventListener('change', (e) => saveSettings({ useTablebase: e.target.checked }));
for (const id of ['set-depth', 'lot-depth']) $(id).addEventListener('change', (e) => saveSettings({ depth: +e.target.value }));

function updateBadge() {
  const eng = S.etat.engine;
  const rel = S.etat.stockfishRelease;
  $('engine-badge').textContent = eng.available
    ? `Moteur : ${eng.name} natif${rel ? ` (version stable officielle ${rel.tag})` : ''} · ${eng.threads} fil(s) · profondeur ${S.etat.settings.depth} · MultiPV ${S.etat.settings.multipv}`
    : `Moteur indisponible : ${eng.error}`;
}

// ---------- Démarrage ----------
async function init() {
  try {
    S.etat = await api('/api/etat');
  } catch (e) { $('engine-badge').textContent = `Erreur : ${e.message}`; return; }
  renderSettings();
  const players = S.etat.players;
  if (players.length) { $('btn-import').textContent = 'Mettre à jour'; $('pseudo').value = players[0].username; }
  await loadPlayers();
  const st = await api('/api/import');
  if (st.status === 'running') pollImport();
  const as = await api('/api/analyse');
  lastStatus = as;
  if (as.status === 'running') await openGame(as.gameId);
  renderQueue(as);
  renderAll();
  pollAnalysis();
}
init();
