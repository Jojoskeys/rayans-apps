// « img 1mo » : une copie JPEG de l'image sous la taille demandée, à côté de l'original (jamais écrasé).
import { nativeImage } from "electron";
import fs from "node:fs";
import path from "node:path";
import { findSetting, fitScale } from "../core/compress.ts";
import { uniquePath } from "./pdf.ts";

export interface ImageResult { out: string; bytes: number; before: number; width: number; height: number; ok: boolean }

export async function compressImage(file: string, targetKo: number): Promise<ImageResult> {
  const img = nativeImage.createFromPath(file);
  if (img.isEmpty()) throw new Error(`${path.basename(file)} : image illisible (JPEG, PNG ou BMP).`);
  const { width, height } = img.getSize();
  const target = targetKo * 1024;
  const cache = new Map<string, Buffer>();
  const encode = (scale: number, q: number) => {
    const key = `${scale}|${q}`;
    let b = cache.get(key);
    if (!b) {
      const r = scale < 1 ? img.resize({ width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), quality: "best" }) : img;
      b = r.toJPEG(q);
      cache.set(key, b);
    }
    return b.length;
  };
  // Au-delà de 4000 px de côté, aucun formulaire n'en a besoin : on part de là.
  const c = await findSetting(target, encode, fitScale(width, height, 4000));
  const buf = cache.get(`${c.scale}|${c.quality}`)!;
  const base = path.basename(file, path.extname(file));
  const label = targetKo >= 1024 ? `${+(targetKo / 1024).toFixed(1)}mo` : `${targetKo}ko`;
  const out = uniquePath(path.join(path.dirname(file), `${base} (${label}).jpg`));
  fs.writeFileSync(out, buf);
  return { out, bytes: buf.length, before: fs.statSync(file).size, width: Math.round(width * c.scale), height: Math.round(height * c.scale), ok: c.ok };
}
