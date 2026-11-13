// Fusion de photos et de PDF en un seul PDF (pdf-lib). Les photos sont réencodées en JPEG plus léger et placées
// sur une page A4 (portrait ou paysage selon l'image), avec une petite marge.
import { nativeImage } from "electron";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { fitScale } from "../core/compress.ts";

import type { PdfQuality } from "../renderer/api-types.ts";

const QUALITY: Record<Exclude<PdfQuality, "originale">, { side: number; jpeg: number }> = {
  legere: { side: 1600, jpeg: 68 },
  normale: { side: 2200, jpeg: 80 },
};

export const IMAGE_EXT = ["jpg", "jpeg", "png", "bmp"];
export const PDF_EXT = ["pdf"];

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 18;

export interface PdfResult { pages: number; bytes: number }

export async function mergeToPdf(files: string[], out: string, quality: PdfQuality): Promise<PdfResult> {
  if (!files.length) throw new Error("Aucun fichier.");
  const doc = await PDFDocument.create();
  for (const f of files) {
    const ext = path.extname(f).slice(1).toLowerCase();
    if (PDF_EXT.includes(ext)) {
      let src: PDFDocument;
      try { src = await PDFDocument.load(fs.readFileSync(f), { ignoreEncryption: false }); }
      catch (e) { throw new Error(`${path.basename(f)} : PDF illisible ou protégé par un mot de passe.`); }
      const pages = await doc.copyPages(src, src.getPageIndices());
      for (const p of pages) doc.addPage(p);
      continue;
    }
    if (!IMAGE_EXT.includes(ext)) throw new Error(`${path.basename(f)} : format non pris en charge (JPEG, PNG, BMP ou PDF).`);
    const img = nativeImage.createFromPath(f);
    if (img.isEmpty()) throw new Error(`${path.basename(f)} : image illisible.`);
    let { width, height } = img.getSize();
    let embedded;
    if (quality === "originale" && (ext === "jpg" || ext === "jpeg")) embedded = await doc.embedJpg(fs.readFileSync(f));
    else if (quality === "originale") embedded = await doc.embedPng(img.toPNG());
    else {
      const q = QUALITY[quality];
      const s = fitScale(width, height, q.side);
      const resized = s < 1 ? img.resize({ width: Math.round(width * s), height: Math.round(height * s), quality: "best" }) : img;
      ({ width, height } = resized.getSize());
      embedded = await doc.embedJpg(resized.toJPEG(q.jpeg));
    }
    const [pw, ph] = width > height ? [A4[1], A4[0]] : A4;
    const k = Math.min((pw - 2 * MARGIN) / width, (ph - 2 * MARGIN) / height);
    const w = width * k, h = height * k;
    doc.addPage([pw, ph]).drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }
  const bytes = await doc.save();
  const tmp = `${out}.tmp`;
  fs.writeFileSync(tmp, bytes);
  fs.renameSync(tmp, out);
  return { pages: doc.getPageCount(), bytes: bytes.length };
}

/** Nom proposé : « <premier fichier> (fusion).pdf » dans le même dossier, sans écraser l'existant. */
export function suggestPdfName(files: string[]) {
  const first = files[0];
  const dir = path.dirname(first);
  const base = path.basename(first, path.extname(first));
  return uniquePath(path.join(dir, `${base} (fusion).pdf`));
}

export function uniquePath(p: string) {
  if (!fs.existsSync(p)) return p;
  const ext = path.extname(p), stem = p.slice(0, -ext.length || undefined);
  for (let i = 2; ; i++) { const c = `${stem} ${i}${ext}`; if (!fs.existsSync(c)) return c; }
}
