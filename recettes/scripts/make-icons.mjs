// Dessine l'icône de Rayan's Recettes (sans dépendance) : build/icon.png (256 px) et assets/icon.png (64 px).
// Un bol rose (thème Sakura) avec une fleur de cerisier. Usage : npm run icons (les PNG produits sont versionnés).
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function render(size, layers) {
  const out = Buffer.alloc(size * size * 4);
  const S = 4;
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const x = (px + (sx + 0.5) / S) / size, y = (py + (sy + 0.5) / S) / size;
      let col = null;
      for (const l of layers) { const c = l(x, y); if (c) col = c; }
      if (col) { r += col[0]; g += col[1]; b += col[2]; a += 1; }
    }
    const i = (py * size + px) * 4;
    if (a) { out[i] = r / a; out[i + 1] = g / a; out[i + 2] = b / a; }
    out[i + 3] = Math.round((a / (S * S)) * 255);
  }
  return out;
}

function appIcon(size) {
  const bg = hex("#1C1720"), bol = hex("#F472B6"), bord = hex("#F9A8D4"), fleur = hex("#FBCFE8"), coeur = hex("#C084FC"), vapeur = hex("#7E7182");
  const R = 0.18;
  return render(size, [
    (x, y) => { // carré arrondi
      const qx = Math.max(Math.abs(x - 0.5) - (0.5 - R) + 0.02, 0), qy = Math.max(Math.abs(y - 0.5) - (0.5 - R) + 0.02, 0);
      return Math.hypot(qx, qy) <= R ? bg : null;
    },
    // vapeur : deux petites vagues au-dessus du bol
    (x, y) => [0.4, 0.6].some((cx) => Math.abs(x - (cx + 0.03 * Math.sin((y - 0.2) * 30))) < 0.022 && y > 0.2 && y < 0.4) ? vapeur : null,
    // bol : demi-disque sous la ligne y = 0.52, avec un pied
    (x, y) => (y >= 0.52 && Math.hypot(x - 0.5, (y - 0.52) * 1.25) <= 0.31 ? bol : null),
    (x, y) => (y >= 0.5 && y <= 0.55 && Math.abs(x - 0.5) <= 0.33 ? bord : null),
    (x, y) => (y >= 0.78 && y <= 0.82 && Math.abs(x - 0.5) <= 0.1 ? bord : null),
    // fleur de cerisier sur le bol : cinq pétales
    (x, y) => {
      const cx = 0.5, cy = 0.66;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * 2 * Math.PI - Math.PI / 2;
        if (Math.hypot(x - (cx + 0.055 * Math.cos(a)), y - (cy + 0.055 * Math.sin(a))) <= 0.04) return fleur;
      }
      return null;
    },
    (x, y) => (Math.hypot(x - 0.5, y - 0.66) <= 0.022 ? coeur : null),
  ]);
}

mkdirSync("build", { recursive: true });
mkdirSync("assets", { recursive: true });
writeFileSync("build/icon.png", png(256, appIcon(256)));
writeFileSync("assets/icon.png", png(64, appIcon(64)));
console.log("Icônes écrites dans build/ et assets/");
