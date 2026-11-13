// Dessine les icônes de Rayan's Prière (sans dépendance) : build/icon.png (256 px), assets/icon.png (64 px)
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

const bg = hex("#12302B"), gold = hex("#E2BC66"), white = [246, 243, 234];
const roundedSquare = (R) => (x, y) => {
  const qx = Math.max(Math.abs(x - 0.5) - (0.5 - R) + 0.02, 0), qy = Math.max(Math.abs(y - 0.5) - (0.5 - R) + 0.02, 0);
  return Math.hypot(qx, qy) <= R;
};
// Croissant : disque moins un disque décalé.
const crescent = (cx, cy, r, dx, dy, r2) => (x, y) => Math.hypot(x - cx, y - cy) <= r && Math.hypot(x - cx - dx, y - cy - dy) > r2;
function star(cx, cy, R, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R; pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
  return (x, y) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}

function appIcon(size) {
  const sq = roundedSquare(0.2), moon = crescent(0.45, 0.52, 0.3, 0.12, -0.06, 0.25), st = star(0.69, 0.36, 0.1, 0.042);
  return render(size, [(x, y) => (sq(x, y) ? bg : null), (x, y) => (moon(x, y) ? gold : null), (x, y) => (st(x, y) ? white : null)]);
}
function trayIcon(size) {
  const moon = crescent(0.44, 0.52, 0.42, 0.17, -0.08, 0.35), st = star(0.76, 0.3, 0.17, 0.075);
  return render(size, [(x, y) => (moon(x, y) ? gold : null), (x, y) => (st(x, y) ? gold : null)]);
}

mkdirSync("build", { recursive: true });
mkdirSync("assets", { recursive: true });
writeFileSync("build/icon.png", png(256, appIcon(256)));
writeFileSync("assets/icon.png", png(64, appIcon(64)));
writeFileSync("assets/tray.png", png(16, trayIcon(16)));
writeFileSync("assets/tray@2x.png", png(32, trayIcon(32)));
console.log("Icônes écrites dans build/ et assets/");
