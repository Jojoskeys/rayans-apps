'use strict';
/**
 * Pilotage UCI du binaire Stockfish natif. Une seule recherche à la fois, file d'attente avec
 * priorité (les coups explorés passent avant l'analyse de fond), annulation par « stop ».
 */
const { spawn } = require('child_process');
const os = require('os');
const readline = require('readline');

class CancelledError extends Error {
  constructor() { super('Recherche annulée'); this.cancelled = true; }
}

function parseInfo(line) {
  const t = line.split(' ');
  const info = {};
  for (let i = 1; i < t.length; i++) {
    const k = t[i];
    if (k === 'depth') info.depth = +t[++i];
    else if (k === 'seldepth') info.seldepth = +t[++i];
    else if (k === 'multipv') info.multipv = +t[++i];
    else if (k === 'nodes') info.nodes = +t[++i];
    else if (k === 'score') {
      const type = t[++i];
      const v = +t[++i];
      info.score = type === 'mate' ? { mate: v } : { cp: v };
      if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') { info.bound = t[++i]; }
    } else if (k === 'pv') { info.pv = t.slice(i + 1); break; }
  }
  return info;
}

class Engine {
  constructor(binaryPath, opts = {}) {
    this.path = binaryPath;
    this.threads = opts.threads || Math.max(1, Math.min(16, os.cpus().length - 1));
    this.hash = opts.hash || 256;
    this.proc = null;
    this.name = null;
    this.queue = [];
    this.busy = false;
    this.current = null;
    this.listeners = [];
    this.starting = null;
    this.multipvSet = null;
  }

  async start() {
    if (this.proc) return;
    if (this.starting) return this.starting;
    this.starting = new Promise((resolve, reject) => {
      let proc;
      try {
        proc = spawn(this.path, [], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      } catch (e) { this.starting = null; reject(e); return; }
      const fail = (err) => { this.starting = null; this.proc = null; reject(err); };
      proc.once('error', fail);
      this.proc = proc;
      const rl = readline.createInterface({ input: proc.stdout });
      rl.on('line', (l) => { for (const f of this.listeners.slice()) f(l); });
      this.stderr = '';
      proc.stderr.on('data', (d) => { this.stderr = (this.stderr + d.toString()).slice(-2000); });
      proc.stdin.on('error', () => { /* le processus a pu se terminer : signalé par « exit » */ });
      proc.on('exit', (code, signal) => {
        this.proc = null;
        this.multipvSet = null;
        this.lastExit = { code, signal, stderr: this.stderr.trim() };
        // La recherche en cours (s'il y en a une) échoue proprement ; _next passe ensuite à la suivante.
        const err = new Error(`Le moteur s’est arrêté de façon inattendue (code ${code}, signal ${signal || 'aucun'})${this.stderr.trim() ? ` : ${this.stderr.trim().slice(-300)}` : ''}`);
        err.crashed = true;
        if (this.readyFail) this.readyFail(err);
        if (this.runFail) this.runFail(err);
      });
      const onLine = (l) => {
        if (l.startsWith('id name ')) this.name = l.slice(8).trim();
        if (l === 'uciok') {
          this._off(onLine);
          this._send(`setoption name Threads value ${this.threads}`);
          this._send(`setoption name Hash value ${this.hash}`);
          this._isReady().then(() => { clearTimeout(guard); proc.removeListener('error', fail); this.starting = null; resolve(); }, fail);
        }
      };
      this.listeners.push(onLine);
      this._send('uci');
      const guard = setTimeout(() => { if (this.starting) { try { proc.kill(); } catch (e) { /* */ } fail(new Error('Le moteur ne répond pas')); } }, 20000);
      guard.unref();
    });
    return this.starting;
  }

  _off(f) { this.listeners = this.listeners.filter((x) => x !== f); }
  _send(cmd) { if (this.proc) this.proc.stdin.write(cmd + '\n'); }
  _isReady() {
    return new Promise((resolve, reject) => {
      const f = (l) => { if (l === 'readyok') { this._off(f); this.readyFail = null; resolve(); } };
      this.readyFail = (err) => { this._off(f); this.readyFail = null; reject(err); };
      this.listeners.push(f);
      this._send('isready');
    });
  }

  /**
   * Lance une recherche. options : { fen, depth, multipv, searchmoves:[uci], priority, signal, newGame }
   * Résultat : { lines: [{multipv, depth, score, pv}], bestmove, depth }
   */
  search(options) {
    return new Promise((resolve, reject) => {
      const job = { options, resolve, reject };
      if (options.signal) {
        if (options.signal.aborted) { reject(new CancelledError()); return; }
        options.signal.addEventListener('abort', () => {
          const i = this.queue.indexOf(job);
          if (i >= 0) { this.queue.splice(i, 1); reject(new CancelledError()); } else if (this.current === job) {
            job.cancelled = true;
            if (job.searching) this._send('stop');
          }
        }, { once: true });
      }
      if (options.priority) this.queue.unshift(job); else this.queue.push(job);
      this._next();
    });
  }

  async _next() {
    if (this.busy || this.queue.length === 0) return;
    this.busy = true;
    const job = this.queue.shift();
    this.current = job;
    try {
      await this.start();
      const res = await this._run(job);
      this.current = null;
      this.busy = false;
      if (job.cancelled) job.reject(new CancelledError()); else job.resolve(res);
    } catch (e) {
      this.current = null;
      this.busy = false;
      job.reject(e);
    }
    this._next();
  }

  async _run(job) {
    const o = job.options;
    const multipv = o.multipv || 1;
    if (o.newGame) { this._send('ucinewgame'); await this._isReady(); }
    if (this.multipvSet !== multipv) { this._send(`setoption name MultiPV value ${multipv}`); this.multipvSet = multipv; await this._isReady(); }
    return new Promise((resolve, reject) => {
      const lines = new Map();
      this.runFail = (err) => { this._off(f); this.runFail = null; reject(err); };
      const f = (l) => {
        if (l.startsWith('info ') && l.includes(' pv ') && l.includes(' score ')) {
          const info = parseInfo(l);
          if (info.bound) return;
          lines.set(info.multipv || 1, { multipv: info.multipv || 1, depth: info.depth, score: info.score, pv: info.pv });
        } else if (l.startsWith('info depth 0 score')) {
          const info = parseInfo(l);
          lines.set(1, { multipv: 1, depth: 0, score: info.score, pv: [] });
        } else if (l.startsWith('bestmove')) {
          this._off(f);
          this.runFail = null;
          const bm = l.split(' ')[1];
          const arr = [...lines.values()].sort((a, b) => a.multipv - b.multipv);
          resolve({ lines: arr, bestmove: bm === '(none)' ? null : bm, depth: arr.length ? Math.min(...arr.map((x) => x.depth)) : 0 });
        }
      };
      this.listeners.push(f);
      this._send(`position fen ${o.fen}`);
      let go = `go depth ${o.depth}`;
      if (o.searchmoves && o.searchmoves.length) go += ` searchmoves ${o.searchmoves.join(' ')}`;
      if (!this.proc) { this._off(f); this.runFail = null; reject(new Error('Moteur indisponible')); return; }
      this._send(go);
      job.searching = true;
      // Annulation demandée pendant la préparation : on arrête tout de suite la recherche lancée.
      if (job.cancelled) this._send('stop');
    });
  }

  /** Change les réglages (repli après plantage) : le moteur est relancé à la prochaine recherche. */
  reconfigure({ threads, hash }) {
    if (threads) this.threads = threads;
    if (hash) this.hash = hash;
    if (this.proc) { try { this._send('quit'); } catch (e) { /* */ } const p = this.proc; setTimeout(() => { try { p.kill(); } catch (e) { /* */ } }, 500); }
  }

  stop() {
    for (const j of this.queue.splice(0)) j.reject(new CancelledError());
    if (this.proc) {
      try { this._send('stop'); this._send('quit'); } catch (e) { /* */ }
      const p = this.proc;
      setTimeout(() => { try { p.kill(); } catch (e) { /* */ } }, 1000);
    }
  }
}

module.exports = { Engine, CancelledError, parseInfo };
