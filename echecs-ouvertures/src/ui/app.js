/* Interface de Rayan's Ouvertures (regroupée par esbuild dans dist-ui/app.js). */
import { Chessground } from 'chessground';
import { Chess } from 'chess.js';
import R from '../core/repertoire.js';
import chessutil from '../core/chessutil.js';
import scoring from '../core/scoring.js';

const { playUciLine, formatLine, frSan, STANDARD_FEN } = chessutil;
const { formatScore } = scoring;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d).replace('.', ','));
const TIME_CLASSES = { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapide', daily: 'Par jour', classical: 'Classique' };

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

let toastTimer = null;
function toast(msg, bad) {
  const t = $('toast');
  t.textContent = msg; t.className = `toast${bad ? ' bad' : ''}`; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
}
function openLink(url) { if (window.bureau) window.bureau.ouvrirLien(url); else window.open(url, '_blank', 'noopener'); }

const S = { player: null, view: 'rep', rep: null, drills: null, states: {}, list: [], idx: 0, cur: null, attempt: null, solution: false, firstDone: false, firstResult: null, busy: false };

function savePlayer(p) { if ((p || '').toLowerCase() !== S.player) S.rep = null; S.player = p ? p.toLowerCase() : null; try { localStorage.setItem('joueur', p || ''); } catch (e) { /* */ } }

// ---------- Échiquier ----------
const cg = Chessground($('board'), {
  coordinates: true, animation: { enabled: true, duration: 150 },
  movable: { free: false, showDests: true, events: { after: onMove } }, premovable: { enabled: false },
  highlight: { lastMove: true, check: true }, drawable: { enabled: true }, fen: STANDARD_FEN,
});
if (window.ResizeObserver) new ResizeObserver(() => cg.redrawAll()).observe($('board'));

function destsFor(fen) {
  const c = new Chess(fen); const d = new Map();
  for (const m of c.moves({ verbose: true })) { if (!d.has(m.from)) d.set(m.from, []); d.get(m.from).push(m.to); }
  return d;
}
const sanOf = (fen, uci) => { const s = playUciLine(fen, [uci]).sans; return s.length ? frSan(s[0]) : uci; };
const lineText = (fen, pv, n = 8) => (pv && pv.length ? formatLine(fen, playUciLine(fen, pv, n).sans) : '—');
const openingLine = (sans) => (sans.length ? formatLine(STANDARD_FEN, sans) : '(position de départ)');

// ---------- Vues ----------
function setView(v) {
  S.view = v;
  $('view-rep').hidden = v !== 'rep'; $('view-ex').hidden = v !== 'ex';
  $('tab-rep').classList.toggle('active', v === 'rep'); $('tab-ex').classList.toggle('active', v === 'ex');
  $('tab-rep').setAttribute('aria-selected', v === 'rep'); $('tab-ex').setAttribute('aria-selected', v === 'ex');
  if (v === 'rep') loadRep().catch((e) => toast(e.message, true));
  else { cg.redrawAll(); loadDrills().catch((e) => toast(e.message, true)); }
}
$('tab-rep').onclick = () => setView('rep');
$('tab-ex').onclick = () => setView('ex');

// ---------- Répertoire ----------
function rateClass(r) { return r == null ? '' : r >= 75 ? 'rate-good' : r >= 50 ? 'rate-mid' : 'rate-bad'; }

async function loadRep() {
  if (!S.player) { $('rep-summary').innerHTML = '<div class="muted">Entrez votre pseudo Chess.com et importez vos parties pour voir votre répertoire.</div>'; $('rep-w').innerHTML = ''; $('rep-b').innerHTML = ''; return; }
  if (!S.rep) $('rep-summary').innerHTML ='<div class="muted">Calcul du répertoire… (quelques secondes la première fois)</div>';
  const r = await api(`/api/repertoire?joueur=${encodeURIComponent(S.player)}`);
  S.rep = r.repertoire;
  const nb = (c) => r.repertoire[c].reduce((a, f) => a + f.drills, 0);
  $('rep-summary').innerHTML = `<div class="row"><b>${esc(S.player)}</b><span class="muted">· ${r.games} partie(s) importée(s) · ${r.analysed} analysée(s) par Stockfish · ${nb('w') + nb('b')} position(s) à travailler</span></div>
    ${r.analysed ? '' : '<div class="muted small">Lancez « Analyser mes ouvertures » pour trouver où vous quittez la théorie et vos erreurs des 15 premiers coups.</div>'}`;
  for (const c of ['w', 'b']) {
    const list = r.repertoire[c];
    $(`rep-${c}`).innerHTML = list.length ? list.map((f, i) => famCard(f, c, i)).join('') : '<div class="muted">Aucune partie.</div>';
  }
  document.querySelectorAll('.fam-head').forEach((h) => { h.onclick = () => { const m = h.parentElement.querySelector('.fam-more'); m.hidden = !m.hidden; h.parentElement.classList.toggle('open', !m.hidden); }; });
  document.querySelectorAll('[data-train]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); trainOn(b.dataset.color, b.dataset.train); }; });
}

function famCard(f, c, i) {
  const pct = (n) => (f.games ? (n / f.games) * 100 : 0);
  const mk = f.mistakes.gaffe + f.mistakes.erreur + f.mistakes.imprecision;
  return `<div class="fam">
    <div class="fam-head"><span class="fam-name">${esc(f.family)}</span><span class="muted small">${f.eco ? esc(f.eco) + ' · ' : ''}${f.games} partie(s)</span></div>
    <div class="wdl" title="${f.wins} gain(s), ${f.draws} nulle(s), ${f.losses} défaite(s)"><div class="w" style="width:${pct(f.wins)}%"></div><div class="d" style="width:${pct(f.draws)}%"></div><div class="l" style="width:${pct(f.losses)}%"></div></div>
    <div class="fam-stats">
      <div class="stat"><div class="v">${num(f.scorePct, 0)} %</div><div class="l">score (${f.wins}/${f.draws}/${f.losses})</div></div>
      <div class="stat"><div class="v">${f.avgDepartureMove == null ? '—' : 'coup ' + num(f.avgDepartureMove)}</div><div class="l">sortie de théorie${f.departuresByPlayerPct == null ? '' : ` · par vous ${f.departuresByPlayerPct} %`}</div></div>
      <div class="stat"><div class="v">${f.analysedGames ? mk : '—'}</div><div class="l">erreurs (${f.analysedGames} analysée(s))</div></div>
      <div class="stat"><div class="v ${rateClass(f.successRate)}">${f.successRate == null ? '—' : f.successRate + ' %'}</div><div class="l">réussite aux exercices</div></div>
    </div>
    <div class="fam-more" hidden>
      <div class="row small" style="justify-content:space-between">
        <span>${f.drills} position(s) à travailler · ${f.drillsDue} à faire · ${f.drillsMastered} maîtrisée(s)${f.attempts ? ` · ${f.successes}/${f.attempts} essais réussis` : ''}</span>
        ${f.drills ? `<button data-train="${esc(f.family)}" data-color="${c}">S’entraîner</button>` : ''}
      </div>
      ${f.analysedGames ? `<div class="small muted" style="margin:4px 0">Gaffes ${f.mistakes.gaffe} · erreurs ${f.mistakes.erreur} · imprécisions ${f.mistakes.imprecision} sur ${f.analysedMoves} coup(s) hors théorie analysés.</div>` : ''}
      ${f.variations.length > 12 ? `<div class="small muted">Les 12 variantes les plus jouées sur ${f.variations.length} :</div>` : ''}
      <table class="tbl"><tbody>${f.variations.slice(0, 12).map((v) => `<tr><td>${esc(v.name)}</td><td class="r muted">${esc(v.eco || '')}</td><td class="r">${v.games} p.</td><td class="r">${num(v.scorePct, 0)} %</td></tr>`).join('')}</tbody></table>
    </div>
  </div>`;
}

function trainOn(color, family) {
  $('ex-color').value = color;
  S.pendingFamily = family;
  $('ex-due').checked = false;
  setView('ex');
}

// ---------- Entraînement ----------
function filters() {
  return { color: $('ex-color').value || null, family: $('ex-family').value || null, onlyDue: $('ex-due').checked };
}

async function loadDrills() {
  if (!S.player) { $('ex-panel').innerHTML = '<div class="muted">Importez d’abord vos parties.</div>'; $('ex-counts').innerHTML = ''; return; }
  $('ex-panel').innerHTML = '<div class="muted">Préparation des exercices…</div>';
  const r = await api(`/api/exercices?joueur=${encodeURIComponent(S.player)}`);
  S.drills = r.drills; S.states = r.states;
  refreshFamilies();
  if (S.pendingFamily) { $('ex-family').value = S.pendingFamily; S.pendingFamily = null; }
  select();
}

function refreshFamilies() {
  const color = $('ex-color').value;
  const cur = S.pendingFamily || $('ex-family').value;
  const fams = new Map();
  for (const d of S.drills || []) if (!color || d.color === color) fams.set(d.opening.family, (fams.get(d.opening.family) || 0) + 1);
  $('ex-family').innerHTML = '<option value="">Toutes les ouvertures</option>' + [...fams.entries()].sort((a, b) => b[1] - a[1])
    .map(([f, n]) => `<option value="${esc(f)}">${esc(f)} (${n})</option>`).join('');
  if (fams.has(cur)) $('ex-family').value = cur;
}

function select() {
  const r = R.selectDrills(S.drills || [], S.states, filters());
  S.list = r.drills; S.idx = 0;
  renderCounts(r.counts);
  show(S.list[0] || null, r.counts);
}

function renderCounts(c) {
  c = c || R.selectDrills(S.drills || [], S.states, filters()).counts;
  const futur = Object.values(S.states).map((s) => s.due).filter((d) => d && d > Date.now()).sort((a, b) => a - b)[0];
  $('ex-counts').innerHTML = `<div class="tiles">
    <div class="tile"><div class="tv">${c.due}</div><div class="tl">à faire</div></div>
    <div class="tile"><div class="tv">${c.neverSeen}</div><div class="tl">jamais vues</div></div>
    <div class="tile"><div class="tv">${c.mastered}</div><div class="tl">maîtrisées</div></div>
    <div class="tile"><div class="tv">${c.total}</div><div class="tl">au total</div></div></div>
    ${!c.due && futur ? `<div class="muted small">Prochaine révision : ${new Date(futur).toLocaleString('fr-FR')}.</div>` : ''}`;
}

function show(d, counts) {
  S.cur = d; S.attempt = null; S.solution = false; S.firstDone = false; S.firstResult = null;
  if (!d) {
    cg.set({ fen: STANDARD_FEN, orientation: 'white', lastMove: undefined, movable: { color: undefined, dests: new Map() } });
    cg.setAutoShapes([]);
    $('ex-top').textContent = ''; $('ex-bottom').textContent = '';
    const none = !counts || !counts.total;
    $('ex-panel').innerHTML = none
      ? '<div class="muted">Aucune position à travailler avec ces filtres. Analysez vos ouvertures (panneau de gauche) : les positions où vous quittez la théorie en perdant du terrain, et vos erreurs des 15 premiers coups, apparaîtront ici.</div>'
      : '<div class="status ok">Rien à revoir pour l’instant avec ces filtres.</div><div class="row" style="margin-top:8px"><button id="ex-anyway">S’entraîner quand même</button></div>';
    const b = $('ex-anyway');
    if (b) b.onclick = () => { $('ex-due').checked = false; select(); };
    return;
  }
  resetBoard();
  render();
}

function resetBoard() {
  const d = S.cur;
  const c = new Chess(d.fen);
  const orient = d.color === 'w' ? 'white' : 'black';
  // Dernier coup de l'adversaire surligné pour situer la position.
  const prev = d.line.length ? (() => { const g = new Chess(); let m = null; for (const s of d.line) m = g.move(s); return m ? [m.from, m.to] : undefined; })() : undefined;
  cg.set({ fen: d.fen, orientation: orient, turnColor: c.turn() === 'w' ? 'white' : 'black', check: c.inCheck(), lastMove: prev, movable: { color: orient, dests: destsFor(d.fen) } });
  cg.setAutoShapes(S.solution ? solutionShapes(d) : []);
  const o = d.occurrences[0].opponent || {};
  $('ex-top').innerHTML = `${d.color === 'w' ? '⚫' : '⚪'} <span class="muted">Adversaire${d.occurrences.length > 1 ? 's' : ''} :</span> ${esc(o.username || '?')}${d.occurrences.length > 1 ? ` <span class="muted">et ${d.occurrences.length - 1} autre(s)</span>` : ''}`;
  $('ex-bottom').innerHTML = `${d.color === 'w' ? '⚪' : '⚫'} ${esc(S.player)}`;
}

// Flèches : vert = meilleur coup de Stockfish, bleu = 2e choix s'il est presque aussi bon.
function solutionShapes(d) {
  const shapes = [{ orig: d.best.uci.slice(0, 2), dest: d.best.uci.slice(2, 4), brush: 'green' }];
  if (d.second && d.second.uci !== d.best.uci) {
    const l = scoring.moveLoss(d.best.score, d.second.score);
    if (l !== null && l <= R.ACCEPT_LOSS) shapes.push({ orig: d.second.uci.slice(0, 2), dest: d.second.uci.slice(2, 4), brush: 'blue' });
  }
  return shapes;
}
// Coups de la théorie à afficher : ceux préférés par Stockfish d'abord, puis les autres (6 au plus).
function bookText(d) {
  const top = [d.best && d.best.uci, d.second && d.second.uci];
  const list = [...d.book].sort((a, b) => (top.includes(a.uci) ? top.indexOf(a.uci) : 9) - (top.includes(b.uci) ? top.indexOf(b.uci) : 9));
  return list.slice(0, 6).map((b) => esc(frSan(b.san))).join(', ') + (list.length > 6 ? ` <span class="muted">et ${list.length - 6} autre(s)</span>` : '');
}

let pendingPromo = null;
function onMove(orig, dest) {
  if (!S.cur || S.busy) return;
  const piece = new Chess(S.cur.fen).get(orig);
  if (piece && piece.type === 'p' && (dest[1] === '8' || dest[1] === '1')) {
    pendingPromo = orig + dest;
    const glyphs = piece.color === 'w' ? { q: '♕', r: '♖', b: '♗', n: '♘' } : { q: '♛', r: '♜', b: '♝', n: '♞' };
    $('ex-promo').innerHTML = Object.keys(glyphs).map((k) => `<button data-p="${k}">${glyphs[k]}</button>`).join('');
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
  const d = S.cur;
  S.busy = true;
  cg.set({ movable: { color: undefined } });
  S.attempt = { uci, san: sanOf(d.fen, uci), pending: true };
  render();
  try {
    const r = await api('/api/exercices/reponse', { joueur: S.player, id: d.id, uci, compter: !S.firstDone });
    if (!S.firstDone) { S.firstDone = true; S.firstResult = r.correct; if (r.state) S.states[d.id] = r.state; }
    S.attempt = { uci, san: frSan(r.san), correct: r.correct, reason: r.reason };
    if (r.correct) { S.solution = true; cg.setAutoShapes(solutionShapes(d)); }
  } catch (e) {
    S.attempt = null; toast(e.message, true); resetBoard();
  } finally { S.busy = false; }
  render();
  renderCounts();
}

function nextIn(st) {
  if (!st || !st.due) return '—';
  const days = Math.round((st.due - Date.now()) / 86400000);
  return days <= 0 ? 'moins d’un jour' : `${days} jour(s)`;
}

function render() {
  const d = S.cur;
  if (!d) return;
  const cat = R.CATEGORIES[d.category];
  const side = d.color === 'w' ? 'Blancs' : 'Noirs';
  const st = S.states[d.id];
  const occ = d.occurrences;
  let html = `<div><span class="badge cat-${d.category}">${esc(cat.symbol)}</span> <b>${esc(cat.label)}</b> · ${esc(d.opening.name || d.opening.family)}</div>
    <div class="line">${esc(openingLine(d.line))}</div>
    <div class="muted small">Position ${S.idx + 1} sur ${S.list.length} · rencontrée dans ${occ.length} partie(s)${st ? ` · tentée ${st.attempts} fois, réussie ${st.successes} fois` : ' · nouvelle'}</div>
    <p class="ex-ask">Vous avez les <b>${side}</b>. ${d.book.length ? 'Jouez le bon coup de la théorie (ou un coup aussi bon selon Stockfish).' : 'Trouvez le bon coup.'}</p>`;
  const a = S.attempt;
  if (a && a.pending) html += `<div class="muted">${esc(a.san)} : vérification…</div>`;
  else if (a && a.correct) html += `<div class="status ok">✔ ${esc(a.san)} : bien joué ! <span class="muted">(${esc(a.reason)})</span></div>`;
  else if (a) html += `<div class="status bad">✘ ${esc(a.san)} ne convient pas <span class="muted">(${esc(a.reason)})</span>.</div>`;
  if (S.solution) {
    const played = [...new Map(occ.map((o) => [o.uci, o])).values()];
    html += `<div class="ex-sol">
      ${d.book.length ? `<div><b>Coups de la théorie :</b> ${bookText(d)}</div>` : '<div class="muted small">Position hors théorie : la base d’ouvertures ne la contient pas.</div>'}
      <div><b>Stockfish :</b> ${esc(sanOf(d.fen, d.best.uci))} <span class="muted">${formatScore(d.best.score)}</span></div>
      <div class="line">${esc(lineText(d.fen, d.best.pv))}</div>
      <div><b>Dans vos parties :</b> ${played.map((o) => `${esc(frSan(o.san))} <span class="muted">(−${num(o.loss)} pt)</span>`).join(', ')}</div>
      <div class="small">${occ.slice(0, 5).map((o) => `<button class="linkish" data-url="${esc(o.url || '')}">${o.endTime ? new Date(o.endTime * 1000).toLocaleDateString('fr-FR') : 'partie'} contre ${esc(o.opponent ? o.opponent.username : '?')}${o.timeClass ? ` (${esc(TIME_CLASSES[o.timeClass] || o.timeClass)})` : ''}</button>`).join(' · ')}</div>
      <div class="muted small">Scores du point de vue des ${side} ; Stockfish, profondeur ${d.depth || '?'}. Flèches : vert = meilleur coup, bleu = 2e choix presque aussi bon.</div>
    </div>`;
  }
  const done = a && !a.pending;
  const btns = [];
  if (done && !a.correct) btns.push('<button class="ghost" id="ex-retry">Réessayer</button>');
  if (!S.solution && !(a && a.pending)) btns.push(`<button class="ghost" id="ex-show">${done ? 'Voir la solution' : 'Je ne sais pas'}</button>`);
  if (done || S.solution) btns.push('<button id="ex-next">Position suivante</button>');
  html += `<div class="row" style="margin-top:10px">${btns.join('')}</div>`;
  if (S.firstDone) html += `<div class="muted small" style="margin-top:6px">Premier essai ${S.firstResult ? `réussi : prochaine révision dans ${nextIn(S.states[d.id])}` : 'manqué : cette position reviendra dans 10 minutes'}. Seul le premier essai compte.</div>`;
  $('ex-panel').innerHTML = html;
  const on = (id, f) => { const b = $(id); if (b) b.onclick = f; };
  on('ex-retry', () => { S.attempt = null; resetBoard(); render(); });
  on('ex-show', async () => {
    if (!S.firstDone) { // abandon = échec pour la répétition espacée
      try {
        const r = await api('/api/exercices/reponse', { joueur: S.player, id: d.id, uci: occ[0].uci, compter: true });
        S.firstDone = true; S.firstResult = false; if (r.state) S.states[d.id] = r.state; renderCounts();
      } catch (e) { /* */ }
    }
    S.solution = true; resetBoard(); cg.set({ movable: { color: undefined } }); render();
  });
  on('ex-next', () => { S.idx += 1; if (S.idx >= S.list.length) select(); else show(S.list[S.idx]); });
  $('ex-panel').querySelectorAll('[data-url]').forEach((b) => { b.onclick = () => { if (b.dataset.url) openLink(b.dataset.url); }; });
}

$('ex-color').addEventListener('change', () => { refreshFamilies(); select(); });
$('ex-family').addEventListener('change', select);
$('ex-due').addEventListener('change', select);

// ---------- Import ----------
let importPoll = null;
$('import-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const p = $('pseudo').value.trim();
  if (!p) return;
  try {
    await api('/api/import', { pseudo: p });
    savePlayer(p);
    pollImport();
  } catch (err) { $('import-status').className = 'status bad'; $('import-status').textContent = err.message; }
});
$('btn-import-cancel').onclick = () => api('/api/import/annuler', {}).catch(() => {});

function pollImport() {
  clearTimeout(importPoll);
  api('/api/import').then((s) => {
    const running = s.status === 'running';
    $('btn-import').disabled = running;
    $('import-actions').hidden = !running;
    $('import-progress').hidden = !running;
    if (running && s.monthsToFetch) $('import-progress').firstElementChild.style.width = `${(s.monthsDone / s.monthsToFetch) * 100}%`;
    const cls = s.status === 'error' ? 'bad' : s.status === 'partial' ? 'warn' : s.status === 'done' ? 'ok' : '';
    $('import-status').className = `status ${cls}`;
    $('import-status').textContent = s.message || '';
    if (running) importPoll = setTimeout(pollImport, 700);
    else if (s.status !== 'idle') { S.drills = null; refresh(); }
  }).catch(() => { importPoll = setTimeout(pollImport, 2000); });
}

// ---------- Analyse ----------
let anPoll = null;
$('btn-analyse').onclick = async () => {
  if (!S.player) { toast('Importez d’abord vos parties.', true); return; }
  try {
    await api('/api/analyse', { joueur: S.player, nombre: parseInt($('an-nombre').value, 10), cadence: $('an-cadence').value || null, depth: parseInt($('an-depth').value, 10) });
    pollAnalyse();
  } catch (e) { toast(e.message, true); }
};
$('btn-analyse-cancel').onclick = () => api('/api/analyse/annuler', {}).catch(() => {});

let lastDone = -1;
function pollAnalyse() {
  clearTimeout(anPoll);
  api('/api/analyse').then((s) => {
    const running = s.status === 'running';
    $('btn-analyse').disabled = running;
    $('btn-analyse-cancel').hidden = !running;
    $('an-progress').hidden = !running;
    if (running && s.total) $('an-progress').firstElementChild.style.width = `${(s.done / s.total) * 100}%`;
    $('an-status').className = `status ${s.status === 'error' ? 'bad' : s.status === 'cancelled' ? 'warn' : s.status === 'done' ? 'ok' : ''}`;
    $('an-status').textContent = s.message || '';
    // Le répertoire se met à jour au fil de l'analyse (toutes les 5 parties) et à la fin.
    if (s.status !== 'idle' && (s.done !== lastDone) && (!running || s.done % 5 === 0)) { lastDone = s.done; if (S.view === 'rep') loadRep().catch(() => {}); }
    if (running) anPoll = setTimeout(pollAnalyse, 1000);
    else if (s.status !== 'idle' && S.view === 'ex') loadDrills().catch(() => {});
  }).catch(() => { anPoll = setTimeout(pollAnalyse, 2000); });
}

function refresh() {
  if (S.view === 'rep') loadRep().catch((e) => toast(e.message, true));
  else loadDrills().catch((e) => toast(e.message, true));
}

// ---------- Démarrage ----------
(async () => {
  try {
    const e = await api('/api/etat');
    $('engine-badge').textContent = e.engine.available ? `Moteur : ${e.engine.name || 'Stockfish'}` : `Moteur indisponible : ${e.engine.error || ''}`;
    $('an-depth').innerHTML = e.depths.map((d) => `<option value="${d}"${d === e.settings.depth ? ' selected' : ''}>${d}</option>`).join('');
    $('data-dir').textContent = `Données : ${e.dataDir} · version ${e.appVersion}`;
    let saved = '';
    try { saved = localStorage.getItem('joueur') || ''; } catch (err) { /* */ }
    const p = saved || (e.players[0] && e.players[0].username) || '';
    if (p) { $('pseudo').value = p; savePlayer(p); }
  } catch (err) { $('engine-badge').textContent = `Erreur : ${err.message}`; }
  pollImport();
  pollAnalyse();
  refresh();
})();
