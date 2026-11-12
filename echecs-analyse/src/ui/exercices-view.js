/* Vue « Exercices » : positions tirées des erreurs du joueur, répétition espacée. */
import { Chessground } from 'chessground';
import { Chess } from 'chess.js';
import exMod from '../core/exercises.js';
import chessutil from '../core/chessutil.js';
import scoring from '../core/scoring.js';
import classifyMod from '../core/classify.js';
import phasesMod from '../core/phases.js';
import { TIME_CLASSES } from './bilan-view.js';

const { selectExercises } = exMod;
const { playUciLine, formatLine, frSan } = chessutil;
const { formatScore } = scoring;
const { CATEGORIES } = classifyMod;
const { PHASE_LABELS } = phasesMod;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TYPES = { gef: ['gaffe', 'erreur', 'occasion_manquee'], g: ['gaffe'], tout: ['gaffe', 'erreur', 'occasion_manquee', 'imprecision'] };

export function createExercises({ api, toast, getPlayer, openInGame }) {
  const E = { items: null, states: {}, list: [], counts: null, idx: 0, cur: null, attempt: null, solution: false, busy: false, loadedFor: null };
  let cg = null;
  let pendingPromo = null;

  function ensureBoard() {
    if (cg) return;
    cg = Chessground($('ex-board'), {
      coordinates: true, animation: { enabled: true, duration: 150 },
      movable: { free: false, showDests: true, events: { after: onMove } }, premovable: { enabled: false },
      highlight: { lastMove: true, check: true }, drawable: { enabled: true },
    });
    // L'échiquier suit la taille de son cadre (barre de défilement, redimensionnement de la fenêtre).
    if (window.ResizeObserver) new ResizeObserver(() => cg.redrawAll()).observe($('ex-board'));
  }

  function destsFor(fen) {
    const c = new Chess(fen); const d = new Map();
    for (const m of c.moves({ verbose: true })) { if (!d.has(m.from)) d.set(m.from, []); d.get(m.from).push(m.to); }
    return d;
  }

  function lineText(fen, pv, n = 10) { return pv && pv.length ? formatLine(fen, playUciLine(fen, pv, n).sans) : '—'; }
  function sanOf(fen, uci) { const s = playUciLine(fen, [uci]).sans; return s.length ? frSan(s[0]) : uci; }

  function filters() {
    return { timeClass: $('ex-cadence').value || null, phase: $('ex-phase').value || null, categories: TYPES[$('ex-types').value], onlyDue: $('ex-due').checked };
  }

  async function load(force) {
    const me = getPlayer();
    if (!me) { $('ex-panel').innerHTML = '<div class="muted">Importez d’abord vos parties.</div>'; $('ex-counts').innerHTML = ''; return; }
    if (force || E.loadedFor !== me || !E.items) {
      $('ex-panel').innerHTML = '<div class="muted">Préparation des exercices…</div>';
      const r = await api(`/api/exercices?joueur=${encodeURIComponent(me)}`);
      E.items = r.items; E.states = r.states; E.loadedFor = me;
    }
    select();
  }

  function select() {
    const r = selectExercises(E.items, E.states, filters());
    E.list = r.exercises; E.counts = r.counts; E.idx = 0;
    renderCounts();
    show(E.list[0] || null);
  }

  function renderCounts() {
    const c = selectExercises(E.items, E.states, filters()).counts;
    const futur = Object.values(E.states).map((s) => s.due).filter((d) => d && d > Date.now()).sort((a, b) => a - b)[0];
    $('ex-counts').innerHTML = `<div class="tiles">
      <div class="tile"><div class="tv">${c.due}</div><div class="tl">à faire maintenant</div></div>
      <div class="tile"><div class="tv">${c.neverSeen}</div><div class="tl">jamais vus</div></div>
      <div class="tile"><div class="tv">${c.mastered}</div><div class="tl">maîtrisés<br><span class="muted">réussis 3 fois de suite</span></div></div>
      <div class="tile"><div class="tv">${c.total}</div><div class="tl">exercices au total</div></div></div>
      ${!c.due && futur ? `<div class="muted small">Prochaine révision : ${new Date(futur).toLocaleString('fr-FR')}.</div>` : ''}`;
  }

  function show(ex) {
    E.cur = ex; E.attempt = null; E.solution = false; E.firstDone = false;
    ensureBoard();
    if (!ex) {
      cg.set({ fen: '8/8/8/8/8/8/8/8 w - - 0 1', movable: { color: undefined, dests: new Map() } });
      cg.setAutoShapes([]);
      $('ex-top').textContent = ''; $('ex-bottom').textContent = '';
      const none = !E.counts || !E.counts.total;
      $('ex-panel').innerHTML = none
        ? '<div class="muted">Aucun exercice : il faut des parties analysées complètement où vous avez commis une gaffe, une erreur ou manqué une occasion. Lancez une analyse en arrière-plan, puis revenez ici.</div>'
        : `<div class="status ok">Rien à revoir pour l’instant avec ces filtres.</div><div class="row" style="margin-top:8px"><button id="ex-anyway">S’entraîner quand même</button></div>`;
      const b = $('ex-anyway');
      if (b) b.onclick = () => { $('ex-due').checked = false; select(); };
      return;
    }
    resetBoard();
    render();
  }

  function resetBoard() {
    const ex = E.cur;
    const c = new Chess(ex.fen);
    const orient = ex.color === 'w' ? 'white' : 'black';
    cg.set({
      fen: ex.fen, orientation: orient, turnColor: c.turn() === 'w' ? 'white' : 'black', check: c.inCheck(), lastMove: undefined,
      movable: { color: orient, dests: destsFor(ex.fen) },
    });
    cg.setAutoShapes([]);
    const opp = ex.opponent || {};
    $('ex-top').innerHTML = `${ex.color === 'w' ? '⚫' : '⚪'} ${esc(opp.username || '?')} <span class="muted">(${opp.rating || '?'})</span>`;
    $('ex-bottom').innerHTML = `${ex.color === 'w' ? '⚪' : '⚫'} ${esc(getPlayer())} <span class="muted">(${ex.elo || '?'})</span>`;
    if (E.solution) cg.setAutoShapes([{ orig: ex.best.uci.slice(0, 2), dest: ex.best.uci.slice(2, 4), brush: 'green' }]);
  }

  function onMove(orig, dest) {
    if (!E.cur || E.busy) return;
    const c = new Chess(E.cur.fen);
    const piece = c.get(orig);
    if (piece && piece.type === 'p' && (dest[1] === '8' || dest[1] === '1')) {
      pendingPromo = orig + dest;
      const glyphs = piece.color === 'w' ? { q: '♕', r: '♖', b: '♗', n: '♘' } : { q: '♛', r: '♜', b: '♝', n: '♞' };
      const names = { q: 'Dame', r: 'Tour', b: 'Fou', n: 'Cavalier' };
      $('ex-promo').innerHTML = Object.keys(glyphs).map((k) => `<button data-p="${k}" aria-label="Promotion en ${names[k]}">${glyphs[k]}</button>`).join('');
      $('ex-promo').hidden = false;
      return;
    }
    answer(orig + dest);
  }
  $('ex-promo').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !pendingPromo) return;
    $('ex-promo').hidden = true;
    const u = pendingPromo + b.dataset.p; pendingPromo = null;
    answer(u);
  });

  async function answer(uci) {
    const ex = E.cur;
    E.busy = true;
    cg.set({ movable: { color: undefined } });
    E.attempt = { uci, san: sanOf(ex.fen, uci), pending: true };
    render();
    try {
      const r = await api('/api/exercices/reponse', { joueur: getPlayer(), id: ex.id, uci, compter: !E.firstDone });
      if (!E.firstDone) { E.firstDone = true; if (r.state) E.states[ex.id] = r.state; E.firstResult = r.correct; }
      E.attempt = { uci, san: frSan(r.san), correct: r.correct, reason: r.reason, evaluation: r.evaluation };
      if (r.correct) E.solution = true;
    } catch (e) {
      E.attempt = null; toast(e.message, true); resetBoard();
    } finally { E.busy = false; }
    render();
    renderCounts();
  }

  function render() {
    const ex = E.cur;
    if (!ex) return;
    const cat = CATEGORIES[ex.category];
    const side = ex.color === 'w' ? 'Blancs' : 'Noirs';
    const moveNo = `${Math.ceil(ex.ply / 2)}${ex.color === 'w' ? '.' : '…'}`;
    const d = ex.endTime ? new Date(ex.endTime * 1000).toLocaleDateString('fr-FR') : '';
    const st = E.states[ex.id];
    const head = `<div class="ex-head"><span class="badge cat-${ex.category}">${esc(cat.symbol || '·')}</span> <b>${esc(cat.label)}</b> au coup ${moveNo}
      <span class="muted">· ${esc(d)} · ${esc(TIME_CLASSES[ex.timeClass] || ex.timeClass || '')} · ${esc(PHASE_LABELS[ex.phase] || '')}</span></div>
      <div class="muted small">Exercice ${E.idx + 1} sur ${E.list.length}${st ? ` · déjà tenté ${st.attempts} fois, réussi ${st.successes} fois` : ' · nouveau'}</div>`;
    let body = `<p class="ex-ask">Vous avez les <b>${side}</b>. Trouvez un bon coup.</p>`;
    const a = E.attempt;
    if (a && a.pending) body += `<div class="muted">${esc(a.san)} : vérification par Stockfish…</div>`;
    else if (a && a.correct) body += `<div class="status ok ex-res">✔ ${esc(a.san)} : bien joué ! <span class="muted">(${esc(a.reason)})</span></div>`;
    else if (a) {
      const ev = a.evaluation;
      body += `<div class="status bad ex-res">✘ ${esc(a.san)} ne suffit pas <span class="muted">(${esc(a.reason)})</span>.</div>
        ${ev && ev.explanation && ev.explanation.sentences && ev.explanation.sentences.length ? `<div class="expl">${ev.explanation.sentences.map((s) => `<p>${esc(s)}</p>`).join('')}</div>` : ''}
        ${ev && ev.pv ? `<div class="small muted">Après ${esc(a.san)} (${formatScore(ev.score)})</div><div class="line">${esc(lineText(ex.fen, ev.pv))}</div>` : ''}`;
    }
    if (E.solution) {
      body += `<div class="ex-sol"><div><b>Solution :</b> ${esc(sanOf(ex.fen, ex.best.uci))} <span class="muted">${formatScore(ex.best.score)}</span></div>
        <div class="line">${esc(lineText(ex.fen, ex.best.pv))}</div>
        <div><b>Dans la partie :</b> ${esc(frSan(ex.san))} <span class="muted">${formatScore(ex.played && ex.played.score)}, perte ${ex.loss.toFixed(1).replace('.', ',')} point(s)</span></div>
        ${ex.explanation.length ? `<div class="expl">${ex.explanation.map((s) => `<p>${esc(s)}</p>`).join('')}</div>` : ''}
        <div class="muted small">Scores du point de vue des ${side} ; Stockfish, profondeur ${ex.depth}.</div></div>`;
    }
    const done = a && !a.pending;
    const buttons = [];
    if (done && !a.correct) buttons.push('<button class="ghost" id="ex-retry">Réessayer</button>');
    if (!E.solution && !(a && a.pending)) buttons.push(`<button class="ghost" id="ex-show">${done ? 'Voir la solution' : 'Je ne sais pas'}</button>`);
    if (done || E.solution) buttons.push('<button id="ex-next">Exercice suivant</button>');
    buttons.push('<button class="ghost" id="ex-game">Voir dans la partie</button>');
    $('ex-panel').innerHTML = `${head}${body}<div class="row" style="margin-top:10px">${buttons.join('')}</div>
      ${E.firstDone ? `<div class="muted small" style="margin-top:6px">Premier essai ${E.firstResult ? 'réussi' : 'manqué'} : ${E.firstResult ? `prochaine révision dans ${nextIn(E.states[ex.id])}` : 'cet exercice reviendra dans 10 minutes'}. Seul le premier essai compte.</div>` : ''}`;
    const on = (id, f) => { const b = $(id); if (b) b.onclick = f; };
    on('ex-retry', () => { E.attempt = null; resetBoard(); render(); });
    on('ex-show', async () => {
      if (!E.firstDone) { // abandon = échec pour la répétition espacée
        try { const r = await api('/api/exercices/reponse', { joueur: getPlayer(), id: ex.id, uci: ex.uci, compter: true }); E.firstDone = true; E.firstResult = false; if (r.state) E.states[ex.id] = r.state; renderCounts(); } catch (e) { /* */ }
      }
      E.solution = true; resetBoard(); cg.set({ movable: { color: undefined } }); render();
    });
    on('ex-next', next);
    on('ex-game', () => openInGame(ex.gameId, ex.ply - 1));
  }

  function nextIn(st) {
    if (!st || !st.due) return '—';
    const days = Math.round((st.due - Date.now()) / 86400000);
    return days <= 0 ? 'moins d’un jour' : `${days} jour(s)`;
  }

  function next() {
    E.idx += 1;
    if (E.idx >= E.list.length) { select(); return; }
    show(E.list[E.idx]);
  }

  for (const id of ['ex-cadence', 'ex-phase', 'ex-types', 'ex-due']) $(id).addEventListener('change', select);

  return {
    open() { ensureBoard(); cg.redrawAll(); return load(false).catch((e) => toast(e.message, true)); },
    invalidate() { E.items = null; },
    state: () => E,
  };
}
