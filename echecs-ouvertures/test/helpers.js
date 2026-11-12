'use strict';
// Outils partagés par les tests : parties fictives et moteur simulé (sans binaire).
const path = require('path');
const { Chess } = require('chess.js');
const { createOpenings } = require('../src/core/openings');

const OPENINGS_FILE = path.join(__dirname, '..', 'data', 'openings.json');
const openings = createOpenings(require(OPENINGS_FILE));

let seq = 0;
/** Partie au format de l'application (après validation), à partir d'une liste de coups SAN. */
function game(sans, { white = 'Moi', black = 'Lui', result = '1-0', endTime = 1700000000 + seq, timeClass = 'blitz' } = {}) {
  seq += 1;
  const pgn = `[Event "Live Chess"]\n[White "${white}"]\n[Black "${black}"]\n[Result "${result}"]\n\n${sans.map((s, i) => (i % 2 ? '' : `${i / 2 + 1}. `) + s).join(' ')} ${result}`;
  return {
    id: `g${seq}`, url: `https://www.chess.com/game/live/${seq}`, pgn, result, endTime, timeClass,
    white: { username: white, rating: 1500, result: result === '1-0' ? 'win' : result === '0-1' ? 'resigned' : 'agreed' },
    black: { username: black, rating: 1500, result: result === '0-1' ? 'win' : result === '1-0' ? 'resigned' : 'agreed' },
  };
}

/** Partie brute telle que renvoyée par l'API Chess.com. */
function rawGame(sans, opts = {}) {
  const g = game(sans, opts);
  return { url: g.url, uuid: `uuid-${g.id}`, pgn: g.pgn, rules: 'chess', end_time: g.endTime, time_class: g.timeClass, time_control: '180', rated: true, white: g.white, black: g.black };
}

/**
 * Moteur simulé : les deux premiers coups légaux valent +0,30 et +0,20 ; tout coup demandé par
 * « searchmoves » vaut -2,00 (sauf s'il fait partie des deux premiers). Compte les recherches.
 */
function fakeEngine() {
  const e = {
    name: 'Faux moteur', threads: 1, hash: 16, searches: 0,
    async start() {},
    stop() {},
    async search({ fen, multipv = 1, searchmoves }) {
      e.searches++;
      const moves = new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion || ''));
      const top = [{ uci: moves[0], cp: 30 }, { uci: moves[1], cp: 20 }].filter((x) => x.uci);
      if (searchmoves && searchmoves.length) {
        const t = top.find((x) => x.uci === searchmoves[0]);
        return { lines: [{ multipv: 1, depth: 10, score: { cp: t ? t.cp : -200 }, pv: [searchmoves[0]] }], bestmove: searchmoves[0] };
      }
      const lines = top.slice(0, multipv).map((x, i) => ({ multipv: i + 1, depth: 10, score: { cp: x.cp }, pv: [x.uci] }));
      return { lines, bestmove: lines[0] ? lines[0].pv[0] : null };
    },
  };
  return e;
}

module.exports = { OPENINGS_FILE, openings, game, rawGame, fakeEngine };
