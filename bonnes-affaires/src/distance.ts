// Distance entre chez soi et l'annonce, à partir des codes postaux.
// Les coordonnées viennent de geo.api.gouv.fr (service public, gratuit, sans compte),
// gardées en cache dans resultats/ pour ne pas redemander deux fois.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Annonce, Domicile } from "./types.ts";

type Point = { lat: number; lon: number };

export function kmEntre(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export class Geocodeur {
  private cache: Record<string, Point | null>;
  private fichier: string;
  private chercher: typeof fetch;

  constructor(fichierCache: string, chercher: typeof fetch = fetch) {
    this.fichier = fichierCache;
    this.chercher = chercher;
    this.cache = existsSync(fichierCache) ? JSON.parse(readFileSync(fichierCache, "utf8")) : {};
  }

  async point(codePostal: string): Promise<Point | null> {
    if (!/^\d{5}$/.test(codePostal)) return null; // code masqué (ex. "75***") : on ne devine pas
    if (codePostal in this.cache) return this.cache[codePostal];
    let p: Point | null = null;
    try {
      const rep = await this.chercher(
        `https://geo.api.gouv.fr/communes?codePostal=${codePostal}&fields=centre&format=json`,
      );
      const communes = rep.ok ? ((await rep.json()) as { centre?: { coordinates: number[] } }[]) : [];
      const c = communes.find((x) => x.centre)?.centre?.coordinates;
      if (c) p = { lon: c[0], lat: c[1] };
    } catch {
      return null; // pas de réseau : on réessaiera la prochaine fois
    }
    this.cache[codePostal] = p;
    return p;
  }

  enregistrer(): void {
    mkdirSync(dirname(this.fichier), { recursive: true });
    writeFileSync(this.fichier, JSON.stringify(this.cache));
  }
}

/**
 * Remplit distanceKm et procheDe pour chaque annonce dont on connaît la position ou le code postal,
 * en prenant le point de départ le plus proche (ex. la ville où l'on habite ou celle où l'on étudie).
 */
export async function calculerDistances(annonces: Annonce[], domiciles: Domicile[], geo: Geocodeur) {
  const departs: { nom: string; p: Point }[] = [];
  for (const d of domiciles) {
    const p = await geo.point(d.codePostal);
    if (p) departs.push({ nom: d.nom, p });
  }
  if (!departs.length) return;
  for (const a of annonces) {
    if (a.distanceKm != null) continue; // déjà donnée par la source
    const p =
      a.lat != null && a.lon != null
        ? { lat: a.lat, lon: a.lon }
        : a.codePostal
          ? await geo.point(a.codePostal)
          : null;
    if (!p) {
      a.distanceKm = null;
      continue;
    }
    const proche = departs
      .map((d) => ({ nom: d.nom, km: Math.round(kmEntre(d.p, p)) }))
      .sort((x, y) => x.km - y.km)[0];
    a.distanceKm = proche.km;
    a.procheDe = proche.nom;
  }
  geo.enregistrer();
}
