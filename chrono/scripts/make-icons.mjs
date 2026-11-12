// Dessine les icônes de Rayan's Chrono (sans dépendance) : build/icon.png (application, 256 px)
// et assets/tray-<état>.png + @2x (zone de notification, 16 et 32 px).
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

const dist = (x, y) => Math.hypot(x - 0.5, y - 0.5);
const angle = (x, y) => (Math.atan2(x - 0.5, -(y - 0.5)) + 2 * Math.PI) % (2 * Math.PI); // 0 en haut, sens horaire
function segment(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

function appIcon(size) {
  const bg = hex("#14171F"), track = hex("#2A2F3B"), red = hex("#E8594F"), white = [245, 246, 248];
  const R = 0.18;
  return render(size, [
    (x, y) => { // carré arrondi
      const qx = Math.max(Math.abs(x - 0.5) - (0.5 - R) + 0.02, 0), qy = Math.max(Math.abs(y - 0.5) - (0.5 - R) + 0.02, 0);
      return Math.hypot(qx, qy) <= R ? bg : null;
    },
    (x, y) => (dist(x, y) <= 0.36 && dist(x, y) >= 0.28 ? track : null),
    (x, y) => (dist(x, y) <= 0.36 && dist(x, y) >= 0.28 && angle(x, y) <= Math.PI * 1.5 ? red : null),
    (x, y) => (segment(x, y, 0.5, 0.5, 0.5, 0.31) <= 0.03 || segment(x, y, 0.5, 0.5, 0.62, 0.56) <= 0.03 ? white : null),
    (x, y) => (dist(x, y) <= 0.045 ? red : null),
  ]);
}

function trayIcon(size, color) {
  const c = hex(color), white = [255, 255, 255];
  return render(size, [
    (x, y) => (dist(x, y) <= 0.48 ? c : null),
    (x, y) => (segment(x, y, 0.5, 0.5, 0.5, 0.2) <= 0.075 || segment(x, y, 0.5, 0.5, 0.71, 0.62) <= 0.075 ? white : null),
  ]);
}

mkdirSync("build", { recursive: true });
mkdirSync("assets", { recursive: true });
writeFileSync("build/icon.png", png(256, appIcon(256)));
writeFileSync("assets/icon.png", png(64, appIcon(64)));
for (const [name, color] of [["arret", "#7A8291"], ["travail", "#E8594F"], ["pause", "#3BA776"]]) {
  writeFileSync(`assets/tray-${name}.png`, png(16, trayIcon(16, color)));
  writeFileSync(`assets/tray-${name}@2x.png`, png(32, trayIcon(32, color)));
}
console.log("Icônes écrites dans build/ et assets/");
