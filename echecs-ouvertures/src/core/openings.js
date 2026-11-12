'use strict';
/**
 * Reconnaissance d'ouverture à partir de la base libre lichess-org/chess-openings.
 * - Un coup est « théorie » si la position qui en résulte figure dans une ligne de la base
 *   et si tous les coups précédents de la partie l'étaient aussi (on quitte la théorie une fois pour toutes).
 * - Le nom affiché est celui de la dernière position nommée atteinte pendant cette phase.
 */
const epd = (fen) => fen.split(' ').slice(0, 4).join(' ');

function createOpenings(data) {
  const book = new Set(data.book);
  const named = data.named;
  return {
    isBook: (fen) => book.has(epd(fen)),
    nameOf: (fen) => {
      const n = named[epd(fen)];
      return n ? { eco: n[0], name: n[1] } : null;
    },
    /** @param {Array<{fenAfter:string}>} plies */
    analyze(plies) {
      const bookPlies = new Set();
      let opening = null;
      for (let i = 0; i < plies.length; i++) {
        const key = epd(plies[i].fenAfter);
        if (!book.has(key)) break;
        bookPlies.add(i + 1);
        const n = named[key];
        if (n) opening = { eco: n[0], name: n[1], ply: i + 1 };
      }
      return { opening, bookPlies };
    },
  };
}

module.exports = { createOpenings, epd };
