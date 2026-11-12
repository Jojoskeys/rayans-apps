'use strict';
/**
 * Résumés des parties analysées (pour le bilan), mis en cache sur disque (cache/bilan.json).
 * Un résumé est recalculé si l'analyse a changé, si l'assouplissement a changé ou si la version des règles
 * de résumé a changé. Le calcul cède la main régulièrement pour ne pas bloquer l'application.
 */
const { buildReport } = require('../core/report');
const { summarizeGame, SUMMARY_VERSION } = require('../core/bilan');

function createSummaries({ store, openings, getSettings }) {
  let cache = null;
  let dirty = false;
  let progress = null; // { done, total } pendant un calcul
  const load = () => {
    if (!cache) {
      const c = store.loadCache('bilan', null);
      cache = c && c.v === SUMMARY_VERSION && c.entries ? c : { v: SUMMARY_VERSION, entries: {} };
    }
    return cache;
  };
  const tick = () => new Promise((r) => setImmediate(r));

  async function forPlayer(username) {
    const c = load();
    const games = store.loadGames(username);
    const analyses = store.listAnalyses();
    const leniency = getSettings().leniency;
    const ids = Object.keys(games).filter((id) => analyses[id] && analyses[id].complete);
    const out = [];
    progress = { done: 0, total: ids.length };
    let sinceYield = 0;
    for (const id of ids) {
      const key = `${analyses[id].updatedAt}|${analyses[id].depth}|${leniency}`;
      const hit = c.entries[id];
      if (hit && hit.key === key) { out.push(hit.summary); progress.done++; continue; }
      const game = games[id];
      const analysis = store.loadAnalysis(id);
      if (!analysis) { progress.done++; continue; }
      try {
        const report = buildReport(game, analysis, openings, getSettings());
        const summary = summarizeGame(game, report);
        c.entries[id] = { key, summary };
        dirty = true;
        out.push(summary);
      } catch (e) { /* partie illisible : ignorée dans le bilan */ }
      progress.done++;
      if (++sinceYield >= 5) { sinceYield = 0; await tick(); }
    }
    progress = null;
    if (dirty) { store.saveCache('bilan', c); dirty = false; }
    return out;
  }

  return { forPlayer, progress: () => progress };
}

module.exports = { createSummaries };
