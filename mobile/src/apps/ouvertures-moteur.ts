// Stockfish dans l'iPhone : la version web « lite, un seul fil » (WebAssembly, ~2 Mo), lancée dans un Worker.
// Même interface que le moteur natif du PC (echecs-ouvertures/src/server/engine.js) : search({ fen, depth, multipv,
// searchmoves, priority, signal }) → { lines: [{ multipv, depth, score, pv }], bestmove, depth }.
// (engine.js lui-même lance un programme : il ne peut pas tourner dans une page.)

// Lecture d'une ligne « info » UCI, comme parseInfo d'engine.js.
function parseInfo(line: string) {
  const t = line.split(" ");
  const info: { depth?: number; multipv?: number; score?: { mate: number } | { cp: number }; bound?: string; pv?: string[] } = {};
  for (let i = 1; i < t.length; i++) {
    const k = t[i];
    if (k === "depth") info.depth = +t[++i];
    else if (k === "multipv") info.multipv = +t[++i];
    else if (k === "score") {
      const type = t[++i];
      const v = +t[++i];
      info.score = type === "mate" ? { mate: v } : { cp: v };
      if (t[i + 1] === "lowerbound" || t[i + 1] === "upperbound") info.bound = t[++i];
    } else if (k === "pv") { info.pv = t.slice(i + 1); break; }
  }
  return info;
}
const E = { parseInfo };

type Line = { multipv: number; depth: number; score: unknown; pv: string[] };
type Opts = { fen: string; depth: number; multipv?: number; searchmoves?: string[]; priority?: boolean; signal?: AbortSignal };
type Job = { o: Opts; resolve: (r: unknown) => void; reject: (e: Error) => void; cancelled?: boolean; searching?: boolean };

export const STOCKFISH_FILE = "stockfish-19-lite-single.js";
const cancelled = () => Object.assign(new Error("Recherche annulée"), { cancelled: true });

export class WebEngine {
  name = "Stockfish 19 léger";
  threads = 1;
  hash = 32;
  private w: Worker | null = null;
  private starting: Promise<void> | null = null;
  private listeners: ((l: string) => void)[] = [];
  private queue: Job[] = [];
  private current: Job | null = null;
  private multipv = 0;

  private send(cmd: string) { this.w?.postMessage(cmd); }
  private until(pred: (l: string) => boolean, ms = 30000) {
    return new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => { this.listeners = this.listeners.filter((x) => x !== f); reject(new Error("Le moteur ne répond pas")); }, ms);
      const f = (l: string) => { if (pred(l)) { clearTimeout(t); this.listeners = this.listeners.filter((x) => x !== f); resolve(); } };
      this.listeners.push(f);
    });
  }

  start(): Promise<void> {
    if (this.w && !this.starting) return Promise.resolve();
    this.starting ??= (async () => {
      const w = new Worker(new URL(STOCKFISH_FILE, location.href));
      w.onmessage = (e) => { for (const f of this.listeners.slice()) f(String(e.data)); };
      w.onerror = (e) => { e.preventDefault(); this.fail(new Error(`Moteur indisponible (${e.message || "erreur de chargement"})`)); };
      this.w = w;
      const ok = this.until((l) => l === "uciok");
      this.send("uci");
      await ok;
      this.send(`setoption name Hash value ${this.hash}`);
      await this.ready();
    })().then(() => { this.starting = null; }, (e) => { this.starting = null; this.w?.terminate(); this.w = null; throw e; });
    return this.starting;
  }

  private fail(err: Error) {
    this.w?.terminate();
    this.w = null;
    this.multipv = 0;
    if (this.current) { this.current.reject(err); this.current = null; }
  }

  private ready() { const p = this.until((l) => l === "readyok"); this.send("isready"); return p; }

  search(o: Opts): Promise<{ lines: Line[]; bestmove: string | null; depth: number }> {
    return new Promise((resolve, reject) => {
      const job: Job = { o, resolve: resolve as (r: unknown) => void, reject };
      if (o.signal?.aborted) { reject(cancelled()); return; }
      o.signal?.addEventListener("abort", () => {
        const i = this.queue.indexOf(job);
        if (i >= 0) { this.queue.splice(i, 1); reject(cancelled()); } else if (this.current === job) { job.cancelled = true; if (job.searching) this.send("stop"); }
      }, { once: true });
      if (o.priority) this.queue.unshift(job); else this.queue.push(job);
      void this.next();
    });
  }

  private async next() {
    if (this.current || !this.queue.length) return;
    const job = (this.current = this.queue.shift()!);
    try {
      await this.start();
      const res = await this.run(job);
      if (this.current === job) this.current = null;
      if (job.cancelled) job.reject(cancelled()); else job.resolve(res);
    } catch (e) {
      if (this.current === job) this.current = null;
      job.reject(e as Error);
    }
    void this.next();
  }

  private async run(job: Job) {
    const o = job.o;
    const multipv = o.multipv || 1;
    if (this.multipv !== multipv) { this.send(`setoption name MultiPV value ${multipv}`); this.multipv = multipv; await this.ready(); }
    return new Promise((resolve) => {
      const lines = new Map<number, Line>();
      const f = (l: string) => {
        if (l.startsWith("info ") && l.includes(" pv ") && l.includes(" score ")) {
          const info = E.parseInfo(l);
          if (info.bound) return;
          lines.set(info.multipv || 1, { multipv: info.multipv || 1, depth: info.depth ?? 0, score: info.score, pv: info.pv ?? [] });
        } else if (l.startsWith("info depth 0 score")) {
          lines.set(1, { multipv: 1, depth: 0, score: E.parseInfo(l).score, pv: [] });
        } else if (l.startsWith("bestmove")) {
          this.listeners = this.listeners.filter((x) => x !== f);
          const bm = l.split(" ")[1];
          const arr = [...lines.values()].sort((a, b) => a.multipv - b.multipv);
          resolve({ lines: arr, bestmove: bm === "(none)" ? null : bm, depth: arr.length ? Math.min(...arr.map((x) => x.depth)) : 0 });
        }
      };
      this.listeners.push(f);
      this.send(`position fen ${o.fen}`);
      this.send(`go depth ${o.depth}${o.searchmoves?.length ? ` searchmoves ${o.searchmoves.join(" ")}` : ""}`);
      job.searching = true;
      if (job.cancelled) this.send("stop");
    });
  }

  stop() {
    for (const j of this.queue.splice(0)) j.reject(cancelled());
    this.send("stop");
  }
}
