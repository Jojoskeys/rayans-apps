'use strict';
/** Persistance sur disque en fichiers JSON (écriture atomique : fichier temporaire puis renommage). */
const fs = require('fs');
const path = require('path');

function createStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const safe = (s) => String(s).toLowerCase().replace(/[^a-z0-9_.-]/g, '_');

  function readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
  }
  function writeJson(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
  }
  const playerDir = (u) => path.join(dataDir, 'joueurs', safe(u));

  // Parties stockées par mois (un fichier par mois d'archive) ; index en mémoire invalidé à chaque écriture.
  const cache = new Map();
  function monthFiles(u) {
    const d = playerDir(u);
    if (!fs.existsSync(d)) return [];
    return fs.readdirSync(d).filter((f) => /^parties-\d{4}-\d{2}\.json$/.test(f)).sort();
  }
  function loadGames(u) {
    const key = safe(u);
    if (cache.has(key)) return cache.get(key);
    const index = {};
    for (const f of monthFiles(u)) for (const g of readJson(path.join(playerDir(u), f), [])) if (g && g.id) index[g.id] = g;
    cache.set(key, index);
    return index;
  }

  return {
    dataDir,
    safe,
    listPlayers() {
      const d = path.join(dataDir, 'joueurs');
      if (!fs.existsSync(d)) return [];
      return fs.readdirSync(d).filter((n) => monthFiles(n).length > 0).map((n) => {
        const meta = readJson(path.join(d, n, 'archives.json'), {});
        return { username: meta.username || n, key: n, lastImport: meta.lastImport || null };
      });
    },
    loadGames,
    /** Remplace le contenu d'un mois (monthKey = AAAA-MM) ; les doublons d'identifiant sont fusionnés. */
    saveMonth(u, monthKey, games) {
      const uniq = new Map();
      for (const g of games) if (g && g.id) uniq.set(g.id, g);
      writeJson(path.join(playerDir(u), `parties-${monthKey}.json`), [...uniq.values()]);
      cache.delete(safe(u));
    },
    loadArchives(u) { return readJson(path.join(playerDir(u), 'archives.json'), { username: u, months: {} }); },
    saveArchives(u, a) { writeJson(path.join(playerDir(u), 'archives.json'), a); },
    findGame(id) {
      for (const p of this.listPlayers()) {
        const g = loadGames(p.key)[id];
        if (g) return g;
      }
      return null;
    },
    loadAnalysis(id) { return readJson(path.join(dataDir, 'analyses', `${safe(id)}.json`), null); },
    saveAnalysis(id, a) { writeJson(path.join(dataDir, 'analyses', `${safe(id)}.json`), a); },
    listAnalyses() {
      const d = path.join(dataDir, 'analyses');
      if (!fs.existsSync(d)) return {};
      const out = {};
      for (const f of fs.readdirSync(d)) {
        if (!f.endsWith('.json')) continue;
        const a = readJson(path.join(d, f), null);
        if (a && a.gameId) out[a.gameId] = { complete: !!a.complete, plies: (a.plies || []).length };
      }
      return out;
    },
    loadSettings() { return readJson(path.join(dataDir, 'reglages.json'), {}); },
    saveSettings(s) { writeJson(path.join(dataDir, 'reglages.json'), s); },
  };
}

module.exports = { createStore };
