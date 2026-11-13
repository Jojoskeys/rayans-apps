// Dessine les icônes de Rayan's Outils (sans dépendance) : build/icon.png (256 px), assets/icon.png (64 px)
// et assets/tray.png + @2x (zone de notification). Usage : npm run icons (les PNG produits sont versionnés).
// Usage : npm run icons (les PNG produits sont versionnés).
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

/** Rend une forme décrite par des couches (fonctions (x,y)->couleur|null en coordonnées 0..1), suréchantillonnée 4×4. */
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

const bg = hex("#161B26"), blue = hex("#4F7CE8"), light = hex("#9DB6F5"), white = [240, 244, 252];
const roundedRect = (x0, y0, x1, y1, R) => (x, y) => {
  const cx = Math.min(Math.max(x, x0 + R), x1 - R), cy = Math.min(Math.max(y, y0 + R), y1 - R);
  return Math.hypot(x - cx, y - cy) <= R;
};
// Quatre tuiles : la barre de commande et ses outils.
function tiles(pad, gap, r, colors) {
  const s = (1 - 2 * pad - gap) / 2;
  const rects = [[pad, pad], [pad + s + gap, pad], [pad, pad + s + gap], [pad + s + gap, pad + s + gap]].map(([x, y]) => roundedRect(x, y, x + s, y + s, r));
  return rects.map((f, i) => (x, y) => (f(x, y) ? colors[i] : null));
}
function appIcon(size) {
  const sq = roundedRect(0.02, 0.02, 0.98, 0.98, 0.2);
  return render(size, [(x, y) => (sq(x, y) ? bg : null), ...tiles(0.2, 0.08, 0.07, [blue, light, light, white])]);
}
const trayIcon = (size) => render(size, tiles(0.06, 0.12, 0.1, [blue, light, light, white]));

mkdirSync("build", { recursive: true });
mkdirSync("assets", { recursive: true });
writeFileSync("build/icon.png", png(256, appIcon(256)));
writeFileSync("assets/icon.png", png(64, appIcon(64)));
writeFileSync("assets/tray.png", png(16, trayIcon(16)));
writeFileSync("assets/tray@2x.png", png(32, trayIcon(32)));
console.log("Icônes écrites dans build/ et assets/");
