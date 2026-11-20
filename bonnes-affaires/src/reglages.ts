// Chargement de reglages.json (ignoré par git), commun à la recherche (main.ts) et au bot Discord (bot.ts).
import { existsSync, readFileSync } from "node:fs";
import type { Reglages } from "./types.ts";

export const DEFAUTS: Omit<Reglages, "recherches"> = { domiciles: [], distanceMaxKm: 40, distancePepiteKm: 100, ecartPepite: 0.4, gainPepite: 30, ecartMin: 0.25, fraisRevente: 0.12, nombre: 20 };

export function chargerReglages(fichier: string): Reglages {
  if (!existsSync(fichier)) {
    console.error("Pas de reglages.json : copiez reglages.exemple.json en reglages.json et remplissez-le.");
    process.exit(1);
  }
  const r: Reglages = { ...DEFAUTS, ...JSON.parse(readFileSync(fichier, "utf8")) };
  r.domiciles = r.domiciles.filter((d) => d.codePostal);
  if (!r.domiciles.length && r.codePostal) r.domiciles = [{ nom: "chez moi", codePostal: r.codePostal }];
  return r;
}
