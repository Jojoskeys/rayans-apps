/* Vue « Bilan » : Elo de performance et bilan des parties analysées (graphiques SVG sans bibliothèque). */
import perfMod from '../core/performance.js';
import bilanMod from '../core/bilan.js';
import phasesMod from '../core/phases.js';

const { performanceBy, gameRecord, periodKey } = perfMod;
const { aggregateBilan, matchFilters } = bilanMod;
const { PHASE_LABELS } = phasesMod;

export const TIME_CLASSES = { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapide', daily: 'Quotidienne', inconnue: 'Inconnue' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(d).replace('.', ','));
const pct = (v, d = 1) => (v === null || v === undefined ? '—' : `${num(v, d)} %`);
const elo = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : String(Math.round(v)));
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function periodLabel(key) {
  let m = /^(\d{4})-(\d{2})$/.exec(key);
  if (m) return `${MONTHS[+m[2] - 1]} ${m[1]}`;
  m = /^(\d{4})-T(\d)$/.exec(key);
  if (m) return `T${m[2]} ${m[1]}`;
  return key;
}

/** Options de période : glissantes puis années présentes dans l'historique. */
export function periodOptions(games) {
  const years = new Set();
  for (const g of games) if (g.endTime) years.add(new Date(g.endTime * 1000).getUTCFullYear());
  const opts = [['tout', 'Toute la période'], ['30', '30 derniers jours'], ['90', '3 derniers mois'], ['180', '6 derniers mois'], ['365', '12 derniers mois']];
  for (const y of [...years].sort((a, b) => b - a)) opts.push([`a${y}`, `Année ${y}`]);
  return opts;
}
export function periodRange(v, nowSec = Date.now() / 1000) {
  if (!v || v === 'tout') return {};
  if (v[0] === 'a') { const y = +v.slice(1); return { from: Date.UTC(y, 0, 1) / 1000, to: Date.UTC(y + 1, 0, 1) / 1000 - 1 }; }
  return { from: nowSec - +v * 86400 };
}

// ---------- Graphique ----------
/**
 * Graphique à une échelle verticale. series : [{ name, kind: 'line'|'bar'|'dash', cls, values: [{ y, lo, hi, tip } | null] }].
 * Une bulle d'aide (title SVG) est attachée à chaque point, avec une zone de survol plus large que la marque.
 */
function chart({ labels, series, yFmt = (v, dec) => num(v, dec), yMin, yMax, height = 200, ariaLabel }) {
  const W = 640; const H = height; const L = 44; const R = 12; const T = 12; const B = 26;
  const all = [];
  for (const s of series) for (const v of s.values) if (v) { all.push(v.y); if (v.lo != null) all.push(v.lo); if (v.hi != null) all.push(v.hi); }
  if (!all.length || !labels.length) return '<div class="muted small">Pas assez de données pour un graphique.</div>';
  let lo = yMin != null ? yMin : Math.min(...all); let hi = yMax != null ? yMax : Math.max(...all);
  if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.08;
  if (yMin == null) lo -= pad;
  if (yMax == null) hi += pad;
  const step = niceStep((hi - lo) / 4);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  if (yMax != null) hi = Math.min(hi, yMax);
  const dec = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  const n = labels.length;
  const bw = (W - L - R) / n;
  const x = (i) => L + bw * (i + 0.5);
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const parts = [];
  for (let v = lo; v <= hi + step / 2; v += step) {
    parts.push(`<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${esc(yFmt(v, dec))}</text>`);
  }
  const every = Math.max(1, Math.ceil(n / 10));
  labels.forEach((lb, i) => { if (i % every === 0) parts.push(`<text class="ax" x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(lb)}</text>`); });
  for (const s of series) {
    if (s.kind === 'bar') {
      const w = Math.max(2, Math.min(28, bw * 0.6));
      s.values.forEach((v, i) => {
        if (!v) return;
        const y0 = y(Math.max(lo, 0)); const y1 = y(v.y);
        const top = Math.min(y0, y1); const h = Math.max(1, Math.abs(y0 - y1));
        parts.push(`<g><title>${esc(v.tip)}</title><rect class="hit" x="${x(i) - bw / 2}" y="${T}" width="${bw}" height="${H - T - B}"/><path class="bar ${s.cls}" d="${roundedTop(x(i) - w / 2, top, w, h, Math.min(4, w / 2, h))}"/></g>`);
      });
    } else {
      const pts = s.values.map((v, i) => (v ? [x(i), y(v.y)] : null));
      let d = ''; let pen = false;
      pts.forEach((p) => { if (!p) { pen = false; return; } d += `${pen ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`; pen = true; });
      parts.push(`<path class="ln ${s.cls} ${s.kind === 'dash' ? 'dash' : ''}" d="${d}"/>`);
      s.values.forEach((v, i) => {
        if (!v) return;
        if (v.lo != null && v.hi != null) parts.push(`<line class="ci ${s.cls}" x1="${x(i)}" x2="${x(i)}" y1="${y(Math.max(lo, v.lo))}" y2="${y(Math.min(hi, v.hi))}"/>`);
        parts.push(`<g><title>${esc(v.tip)}</title><circle class="hit" cx="${x(i)}" cy="${y(v.y)}" r="12"/><circle class="pt ${s.cls}" cx="${x(i)}" cy="${y(v.y)}" r="${s.kind === 'dash' ? 3 : 4}"/></g>`);
      });
    }
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ariaLabel || '')}">${parts.join('')}</svg>`;
}
function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
function roundedTop(x, y, w, h, r) {
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
function legend(items) {
  return `<div class="legend">${items.map(([cls, txt]) => `<span><i class="sw ${cls}"></i>${esc(txt)}</span>`).join('')}</div>`;
}

// ---------- Elo de performance ----------
function perfCell(p) {
  if (!p.n) return { v: '—', ci: '' };
  if (p.bound === 'haut') return { v: `> ${elo(p.low)}`, ci: `borne basse ${elo(p.low)} (100 % des points)` };
  if (p.bound === 'bas') return { v: `< ${elo(p.high)}`, ci: `borne haute ${elo(p.high)} (0 % des points)` };
  return { v: elo(p.perf), ci: `${elo(p.low)} – ${elo(p.high)}` };
}

export function renderPerf(box, games, me, f, grain) {
  const recs = games.map((g) => gameRecord(g, me)).filter((r) => r && Number.isFinite(r.opp) && matchFilters(r, f));
  const { timeClass, ...noTc } = f;
  const recsAllTc = games.map((g) => gameRecord(g, me)).filter((r) => r && Number.isFinite(r.opp) && matchFilters(r, noTc));
  const byTc = performanceBy(recsAllTc, (r) => r.timeClass || 'inconnue').sort((a, b) => b.n - a.n);
  const rows = byTc.map((p) => {
    const c = perfCell(p);
    const sel = timeClass && timeClass === p.key ? ' class="sel"' : '';
    return `<tr${sel}><td>${esc(TIME_CLASSES[p.key] || p.key)}</td><td class="r">${p.n}</td><td class="r">${p.wins} / ${p.draws} / ${p.losses}</td><td class="r">${pct(100 * p.score, 1)}</td><td class="r">${elo(p.meanOpp)}</td><td class="r"><b>${c.v}</b></td><td class="r muted">${esc(c.ci)}</td><td class="r">${elo(p.lastRating)}</td>${p.n < 10 && p.n ? '<td class="warn small">peu de parties</td>' : '<td></td>'}</tr>`;
  }).join('');
  // Graphique : la cadence filtrée, sinon la plus jouée (les classements Chess.com diffèrent selon la cadence).
  const tc = timeClass || (byTc[0] && byTc[0].key);
  const tcRecs = recsAllTc.filter((r) => (r.timeClass || 'inconnue') === tc);
  const periods = performanceBy(tcRecs, (r) => periodKey(r.endTime, grain));
  const labels = periods.map((p) => periodLabel(p.key));
  const perfVals = periods.map((p) => {
    const c = perfCell(p);
    if (p.perf != null) return { y: p.perf, lo: p.low, hi: p.high, tip: `${periodLabel(p.key)} : performance ${c.v} (IC 95 % ${c.ci}), ${p.n} partie(s), score ${pct(100 * p.score, 0)}` };
    return null;
  });
  const ratingVals = periods.map((p) => (p.lastRating != null ? { y: p.lastRating, tip: `${periodLabel(p.key)} : Elo Chess.com en fin de période ${p.lastRating}` } : null));
  const unbounded = periods.filter((p) => p.bound).length;
  box.innerHTML = `<h3>Elo de performance <span class="muted small">(résultats contre le classement des adversaires)</span></h3>
    ${recsAllTc.length ? `<div class="tablewrap"><table class="tbl">
      <thead><tr><th>Cadence</th><th class="r">Parties</th><th class="r">G / N / P</th><th class="r">Score</th><th class="r">Adv. moyen</th><th class="r">Performance</th><th class="r">IC 95 %</th><th class="r">Elo Chess.com (dernier)</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <h4>${esc(TIME_CLASSES[tc] || tc)} : performance ${grain === 'annee' ? 'par année' : grain === 'trimestre' ? 'par trimestre' : 'par mois'}</h4>
    ${legend([['s-perf', 'Elo de performance (barre : IC 95 %)'], ['s-rating', 'Elo Chess.com en fin de période']])}
    ${chart({ labels, series: [{ name: 'Elo Chess.com', kind: 'dash', cls: 's-rating', values: ratingVals }, { name: 'Performance', kind: 'line', cls: 's-perf', values: perfVals }], ariaLabel: 'Elo de performance par période' })}
    ${unbounded ? `<div class="muted small">${unbounded} période(s) à 100 % ou 0 % des points : pas d’estimation finie, non tracée(s).</div>` : ''}`
    : '<div class="muted">Aucune partie ne correspond aux filtres.</div>'}
    <p class="muted small">Maximum de vraisemblance du modèle Elo (400 points = 10 contre 1), nulle = ½ point, adversaires pris à leur classement Chess.com au moment de la partie.
    Intervalle de confiance à 95 % par rapport de vraisemblance. Calculé séparément par cadence, car Chess.com tient un classement par cadence. Sur toutes les parties importées, analysées ou non. Règles : REGLES-ANALYSE.md, section 9.</p>`;
}

// ---------- Bilan des parties analysées ----------
function statRow(label, g) {
  return `<tr><td>${esc(label)}</td><td class="r">${g.games}</td><td class="r">${pct(g.accuracy)}${g.accuracyCI != null ? ` <span class="muted">± ${num(g.accuracyCI)}</span>` : ''}</td><td class="r">${num(g.gaffesPerGame, 2)}</td><td class="r">${num(g.erreursPerGame, 2)}</td><td class="r">${num(g.imprecisionsPerGame, 2)}</td><td class="r">${g.games ? pct((100 * (g.wins + g.draws / 2)) / g.games, 0) : '—'}</td></tr>`;
}

export function renderBilan(box, summaries, me, f, grain, matchingTotal) {
  if (summaries === null) { box.innerHTML = '<h3>Bilan des parties analysées</h3><div class="muted">Calcul du bilan…</div>'; return; }
  const b = aggregateBilan(summaries, me, f, grain);
  const o = b.overall;
  const head = '<h3>Bilan des parties analysées</h3>';
  if (!o.games) {
    box.innerHTML = `${head}<div class="muted">Aucune partie analysée ne correspond aux filtres (${matchingTotal} partie(s) importée(s) correspondantes). Utilisez « Analyse en arrière-plan » pour en analyser plusieurs.</div>`;
    return;
  }
  const depths = Object.entries(b.depths);
  const depthNote = depths.length > 1
    ? `<div class="warnbox">Profondeurs mélangées (${depths.map(([d, n]) => `${n} partie(s) à ${d}`).join(', ')}) : une analyse moins profonde trouve moins d’erreurs ; comparez des parties analysées à la même profondeur.</div>`
    : `<div class="muted small">Toutes analysées à la profondeur ${esc(depths[0][0])}.</div>`;
  const labels = b.byPeriod.map((p) => periodLabel(p.key));
  const accVals = b.byPeriod.map((p) => ({ y: p.accuracy, lo: p.accuracyCI != null ? p.accuracy - p.accuracyCI : null, hi: p.accuracyCI != null ? p.accuracy + p.accuracyCI : null, tip: `${periodLabel(p.key)} : précision moyenne ${pct(p.accuracy)}${p.accuracyCI != null ? ` ± ${num(p.accuracyCI)}` : ''}, ${p.games} partie(s)` }));
  const gafVals = b.byPeriod.map((p) => ({ y: p.gaffesPerGame, tip: `${periodLabel(p.key)} : ${num(p.gaffesPerGame, 2)} gaffe(s) par partie (${p.gaffes} sur ${p.games} partie(s))` }));
  const phaseRows = b.byPhase.map((p) => `<tr><td>${esc(PHASE_LABELS[p.phase])}</td><td class="r">${p.games}</td><td class="r">${p.moves}</td><td class="r">${pct(p.accuracy)}</td><td class="r">${num(p.gaffesPer100, 1)}</td><td class="r">${num(p.erreursPer100, 1)}</td><td class="r">${num(p.imprecisionsPer100, 1)}</td></tr>`).join('');
  const worst = b.worst.filter((w) => w.gaffes || w.erreurs).map((w) => `<li><button class="linkish" data-open="${esc(w.id)}">${new Date(w.endTime * 1000).toLocaleDateString('fr-FR')} · ${w.color === 'w' ? '⚪' : '⚫'} vs ${esc(w.opponent.username)} · ${esc(TIME_CLASSES[w.timeClass] || w.timeClass || '')} · ${w.score === 1 ? 'gain' : w.score === 0 ? 'perte' : 'nulle'}</button> <span class="muted">${w.gaffes} gaffe(s), ${w.erreurs} erreur(s), précision ${pct(w.accuracy, 0)}</span></li>`).join('');
  box.innerHTML = `${head}
    <div class="tiles">
      <div class="tile"><div class="tv">${o.games}</div><div class="tl">parties analysées<br><span class="muted">sur ${matchingTotal} correspondantes</span></div></div>
      <div class="tile"><div class="tv">${pct(o.accuracy)}</div><div class="tl">précision moyenne${o.accuracyCI != null ? `<br><span class="muted">± ${num(o.accuracyCI)} (IC 95 %)</span>` : ''}</div></div>
      <div class="tile"><div class="tv">${num(o.gaffesPerGame, 2)}</div><div class="tl">gaffes par partie</div></div>
      <div class="tile"><div class="tv">${num(o.erreursPerGame, 2)}</div><div class="tl">erreurs par partie</div></div>
      <div class="tile"><div class="tv">${num(o.imprecisionsPerGame, 2)}</div><div class="tl">imprécisions par partie</div></div>
    </div>
    ${depthNote}
    <h4>Précision moyenne par période <span class="muted small">(barre : IC 95 %)</span></h4>
    ${chart({ labels, series: [{ name: 'Précision', kind: 'line', cls: 's-perf', values: accVals }], yMax: 100, yFmt: (v) => `${num(v, 0)} %`, ariaLabel: 'Précision moyenne par période' })}
    <h4>Gaffes par partie, par période</h4>
    ${chart({ labels, series: [{ name: 'Gaffes', kind: 'bar', cls: 's-gaffe', values: gafVals }], yMin: 0, height: 160, ariaLabel: 'Gaffes par partie et par période' })}
    <h4>Par cadence et par couleur</h4>
    <div class="tablewrap"><table class="tbl"><thead><tr><th></th><th class="r">Parties</th><th class="r">Précision</th><th class="r">Gaffes / p.</th><th class="r">Erreurs / p.</th><th class="r">Imprécisions / p.</th><th class="r">Score</th></tr></thead>
    <tbody>${b.byTimeClass.map((g) => statRow(TIME_CLASSES[g.key] || g.key, g)).join('')}
    <tr class="sep"><td colspan="7"></td></tr>${b.byColor.map((g) => statRow(g.key === 'w' ? 'Avec les Blancs' : 'Avec les Noirs', g)).join('')}</tbody></table></div>
    <h4>Par phase de jeu</h4>
    <div class="tablewrap"><table class="tbl"><thead><tr><th></th><th class="r">Parties</th><th class="r">Coups</th><th class="r">Précision</th><th class="r">Gaffes / 100 coups</th><th class="r">Erreurs / 100</th><th class="r">Imprécisions / 100</th></tr></thead><tbody>${phaseRows}</tbody></table></div>
    ${worst ? `<h4>Parties avec le plus de gaffes</h4><ul class="worst">${worst}</ul>` : ''}
    <h4>Tableau par période</h4>
    <details><summary class="small">Afficher les valeurs</summary><div class="tablewrap"><table class="tbl"><thead><tr><th>Période</th><th class="r">Parties</th><th class="r">Précision</th><th class="r">Gaffes / p.</th><th class="r">Erreurs / p.</th><th class="r">Imprécisions / p.</th><th class="r">Score</th></tr></thead>
    <tbody>${b.byPeriod.map((g) => statRow(periodLabel(g.key), g)).join('')}</tbody></table></div></details>
    <p class="muted small">Précision d’une partie : celle du résumé de la partie. Moyennes par partie ; précision par phase calculée sur tous les coups de la phase avec la même formule.
    Phases : finale à 6 pièces ou moins hors rois et pions ; milieu de jeu dès 10 pièces ou moins, une première rangée dégarnie ou le coup 16. Règles : REGLES-ANALYSE.md, section 8.</p>`;
}
