// Lecture minimale des fichiers FIT (activités des montres Garmin) : messages et leurs champs, y compris les champs
// « développeur » écrits par une app Connect IQ (Rayan's Muscu : répétitions par circuit). Seuls les messages et
// champs utiles sont interprétés ensuite (voir garmin.ts) ; le CRC n'est pas vérifié.

export type Valeur = number | string | number[] | null;

export interface MessageFit {
  /** Numéro global du message (18 session, 19 tour/circuit, 0 fichier…). */
  num: number;
  champs: Record<number, Valeur>;
  /** Champs développeur, par nom (« repetitions »). */
  dev: Record<string, Valeur>;
}

/** Secondes entre le 1er janvier 1970 et le 31 décembre 1989 (origine des dates FIT). */
export const EPOQUE_FIT = 631_065_600;

interface Def { num: number; le: boolean; champs: [number, number, number][]; dev: [number, number, number][] }

// Taille d'un élément et valeur « invalide » de chaque type de base FIT (type & 0x1F).
const TAILLE = [1, 1, 1, 2, 2, 4, 4, 1, 4, 8, 1, 2, 4, 1, 8, 8, 8];

function lire(v: DataView, o: number, type: number, taille: number, le: boolean): Valeur {
  const t = type & 0x1f;
  if (t === 7) {
    let s = "";
    for (let i = 0; i < taille && v.getUint8(o + i) !== 0; i++) s += String.fromCharCode(v.getUint8(o + i));
    try { return decodeURIComponent(escape(s)); } catch { return s; }
  }
  const pas = TAILLE[t] ?? 1;
  const n = Math.max(1, Math.floor(taille / pas));
  const out: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    const p = o + i * pas;
    let x: number | null;
    switch (t) {
      case 0: case 2: case 13: x = v.getUint8(p); x = x === 0xff && t !== 13 ? null : x; break;
      case 10: x = v.getUint8(p); x = x === 0 ? null : x; break;
      case 1: x = v.getInt8(p); x = x === 0x7f ? null : x; break;
      case 3: x = v.getInt16(p, le); x = x === 0x7fff ? null : x; break;
      case 4: x = v.getUint16(p, le); x = x === 0xffff ? null : x; break;
      case 11: x = v.getUint16(p, le); x = x === 0 ? null : x; break;
      case 5: x = v.getInt32(p, le); x = x === 0x7fffffff ? null : x; break;
      case 6: x = v.getUint32(p, le); x = x === 0xffffffff ? null : x; break;
      case 12: x = v.getUint32(p, le); x = x === 0 ? null : x; break;
      case 8: x = v.getFloat32(p, le); x = Number.isNaN(x) ? null : x; break;
      case 9: x = v.getFloat64(p, le); x = Number.isNaN(x) ? null : x; break;
      default: x = Number(v.getBigUint64(p, le)); break;
    }
    out.push(x);
  }
  if (t === 13) return out as number[];
  return n === 1 ? out[0] : out.every((x) => x === null) ? null : (out.map((x) => x ?? 0));
}

/** Tous les messages de données d'un fichier FIT. Lève une erreur si ce n'est pas un fichier FIT. */
export function lireFit(octets: Uint8Array): MessageFit[] {
  const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  if (octets.length < 12) throw new Error("fichier FIT trop court");
  const tete = v.getUint8(0);
  const signature = String.fromCharCode(octets[8], octets[9], octets[10], octets[11]);
  if (signature !== ".FIT") throw new Error("pas un fichier FIT");
  const fin = Math.min(octets.length, tete + v.getUint32(4, true));
  const defs = new Map<number, Def>();
  const descriptions = new Map<string, { nom: string; type: number }>();
  const out: MessageFit[] = [];
  let o = tete;
  while (o < fin) {
    const h = v.getUint8(o++);
    if ((h & 0x80) === 0 && (h & 0x40)) {
      // Définition
      const local = h & 0x0f;
      const le = v.getUint8(o + 1) === 0;
      const num = v.getUint16(o + 2, le);
      const n = v.getUint8(o + 4);
      o += 5;
      const champs: [number, number, number][] = [];
      for (let i = 0; i < n; i++, o += 3) champs.push([v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2)]);
      const dev: [number, number, number][] = [];
      if (h & 0x20) {
        const nd = v.getUint8(o++);
        for (let i = 0; i < nd; i++, o += 3) dev.push([v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2)]);
      }
      defs.set(local, { num, le, champs, dev });
      continue;
    }
    const local = h & 0x80 ? (h >> 5) & 0x03 : h & 0x0f;
    const d = defs.get(local);
    if (!d) throw new Error(`message sans définition (type local ${local})`);
    const m: MessageFit = { num: d.num, champs: {}, dev: {} };
    for (const [f, taille, type] of d.champs) { m.champs[f] = lire(v, o, type, taille, d.le); o += taille; }
    for (const [f, taille, idx] of d.dev) {
      const desc = descriptions.get(`${idx}:${f}`);
      m.dev[desc?.nom ?? `${idx}:${f}`] = lire(v, o, desc?.type ?? 13, taille, d.le);
      o += taille;
    }
    // Description d'un champ développeur : nom et type, utilisés par les messages suivants.
    if (d.num === 206) {
      const idx = m.champs[0], f = m.champs[1], type = m.champs[2], nom = m.champs[3];
      if (typeof idx === "number" && typeof f === "number" && typeof type === "number" && typeof nom === "string") descriptions.set(`${idx}:${f}`, { nom, type });
    }
    out.push(m);
  }
  return out;
}
