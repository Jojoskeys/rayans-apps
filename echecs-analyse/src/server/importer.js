'use strict';
/**
 * Import des parties terminées depuis l'API publique Chess.com (sans clé).
 * - Premier import : tous les mois listés par /games/archives.
 * - Mises à jour : seuls les mois non « clos » sont récupérés de nouveau. Un mois est clos s'il a été
 *   récupéré au moins 2 jours après sa fin (UTC) : plus aucune partie ne peut y apparaître.
 * - Chaque mois est enregistré dès sa récupération : une interruption ne perd rien et l'import reprend
 *   là où il s'est arrêté. Les requêtes sont séquentielles (recommandation de Chess.com).
 */
const { validateGame } = require('../core/games');
const { USER_AGENT } = require('./external');

const USERNAME_RE = /^[A-Za-z0-9_-]{2,50}$/;
const MONTH_RE = /\/games\/(\d{4})\/(\d{2})$/;
const CLOSE_MARGIN_MS = 2 * 24 * 3600 * 1000;

function monthOf(url) {
  const m = url.match(MONTH_RE);
  return m ? { year: +m[1], month: +m[2] } : null;
}

function isMonthClosed(url, fetchedAt) {
  const m = monthOf(url);
  if (!m || !fetchedAt) return false;
  const nextMonthStart = Date.UTC(m.year, m.month, 1); // month est 1-12 : Date.UTC(y, 12, 1) = 1er janvier suivant
  return fetchedAt >= nextMonthStart + CLOSE_MARGIN_MS;
}

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(new Error('annulé')); }, { once: true });
});

function createImporter({ store, fetchImpl, retryDelays = [2000, 4000, 8000, 16000], now = () => Date.now() }) {
  let job = { status: 'idle' };
  let controller = null;

  async function fetchJson(url, signal) {
    let lastErr = null;
    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      if (signal.aborted) throw new Error('annulé');
      try {
        const r = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal });
        if (r.status === 404 || r.status === 410) { const e = new Error('introuvable'); e.status = r.status; e.fatal = true; throw e; }
        if (r.status === 429 || r.status >= 500) {
          lastErr = new Error(r.status === 429 ? 'Limitation de l’API Chess.com (429)' : `Erreur serveur Chess.com (${r.status})`);
          lastErr.status = r.status;
          const ra = parseInt(r.headers && r.headers.get ? r.headers.get('retry-after') : '', 10);
          if (attempt < retryDelays.length) await sleep(Number.isFinite(ra) ? Math.min(ra * 1000, 60000) : retryDelays[attempt], signal);
          continue;
        }
        if (!r.ok) { const e = new Error(`Réponse inattendue de Chess.com (${r.status})`); e.status = r.status; e.fatal = true; throw e; }
        return await r.json();
      } catch (e) {
        if (e.fatal || signal.aborted) throw e;
        lastErr = lastErr && lastErr.status ? lastErr : new Error(`Connexion impossible à Chess.com (${e.message})`);
        if (attempt < retryDelays.length) await sleep(retryDelays[attempt], signal);
      }
    }
    throw lastErr || new Error('Échec de la requête');
  }

  async function run(username, signal) {
    const key = username.toLowerCase();
    const archives = store.loadArchives(key);
    archives.username = archives.username || username;
    const known = new Set(Object.keys(store.loadGames(key)));
    job.message = 'Lecture de la liste des archives…';
    let list;
    try {
      list = await fetchJson(`https://api.chess.com/pub/player/${encodeURIComponent(key)}/games/archives`, signal);
    } catch (e) {
      if (e.status === 404) throw new Error(`Pseudo « ${username} » introuvable sur Chess.com`);
      throw e;
    }
    const urls = Array.isArray(list.archives) ? list.archives.filter((u) => MONTH_RE.test(u)) : [];
    const todo = urls.filter((u) => !(archives.months[u] && isMonthClosed(u, archives.months[u].fetchedAt))).reverse(); // plus récents d'abord
    Object.assign(job, { monthsTotal: urls.length, monthsToFetch: todo.length, monthsDone: 0, monthsSkipped: urls.length - todo.length });
    for (const u of todo) {
      if (signal.aborted) throw new Error('annulé');
      const m = monthOf(u);
      job.currentMonth = `${String(m.month).padStart(2, '0')}/${m.year}`;
      job.message = `Récupération du mois ${job.currentMonth}…`;
      const data = await fetchJson(u, signal);
      const accepted = [];
      let rejected = 0;
      for (const raw of (data.games || [])) {
        const v = validateGame(raw);
        if (v.ok) accepted.push(v.game);
        else { rejected++; job.rejected[v.code] = (job.rejected[v.code] || 0) + 1; }
      }
      for (const g of accepted) if (!known.has(g.id)) { known.add(g.id); job.added++; }
      job.accepted += accepted.length;
      job.rejectedTotal += rejected;
      archives.months[u] = { fetchedAt: now(), games: accepted.length, rejected };
      store.saveMonth(key, `${m.year}-${String(m.month).padStart(2, '0')}`, accepted);
      store.saveArchives(key, archives);
      job.monthsDone++;
    }
    archives.lastImport = { at: now(), complete: true, months: urls.length };
    store.saveArchives(key, archives);
    job.totalGames = known.size;
  }

  return {
    status: () => ({ ...job, rejected: { ...(job.rejected || {}) } }),
    start(username) {
      if (!USERNAME_RE.test(username || '')) throw new Error('Pseudo invalide : lettres, chiffres, « _ » ou « - » uniquement');
      if (job.status === 'running') throw new Error('Un import est déjà en cours');
      controller = new AbortController();
      job = { status: 'running', username, startedAt: now(), added: 0, accepted: 0, rejectedTotal: 0, rejected: {}, monthsDone: 0, monthsTotal: 0, monthsToFetch: 0 };
      const signal = controller.signal;
      run(username, signal).then(() => {
        job.status = 'done';
        job.message = job.monthsToFetch === 0 ? 'Déjà à jour : aucun mois à récupérer.' : `Import terminé : ${job.added} nouvelle(s) partie(s).`;
      }, (e) => {
        const key = username.toLowerCase();
        const total = Object.keys(store.loadGames(key)).length;
        job.totalGames = total;
        if (signal.aborted) {
          job.status = 'partial';
          job.message = `Import interrompu : ${job.monthsDone}/${job.monthsToFetch} mois récupérés. Les mois déjà récupérés sont conservés ; relancez pour reprendre.`;
        } else if (job.monthsDone > 0 || job.monthsToFetch > 0) {
          job.status = 'partial';
          job.error = e.message;
          job.message = `Import partiel (${job.monthsDone}/${job.monthsToFetch} mois) : ${e.message}. Relancez pour reprendre.`;
        } else {
          job.status = 'error';
          job.error = e.message;
          job.message = e.message;
        }
        const a = store.loadArchives(key);
        if (a.months && Object.keys(a.months).length) {
          a.username = a.username || username;
          a.lastImport = { at: now(), complete: false, error: job.error || 'interrompu' };
          store.saveArchives(key, a);
        }
      });
      return this.status();
    },
    cancel() { if (controller) controller.abort(); },
  };
}

module.exports = { createImporter, isMonthClosed, monthOf, USERNAME_RE };
