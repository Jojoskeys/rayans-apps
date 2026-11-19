// Import d'annonces depuis un fichier .json ou .csv (Vinted, Leboncoin, Facebook, Back Market...).
// C'est la voie sans robot : les annonces viennent de ce que l'on a vu soi-même ou reçu en alerte.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Annonce } from "./types.ts";
import { lirePrix } from "./texte.ts";

/** Accepte quelques variantes de noms de colonnes. */
const ALIAS: Record<string, string> = {
  title: "titre", nom: "titre", price: "prix", shipping: "port", livraison: "port",
  url: "lien", link: "lien", cp: "codePostal", zip: "codePostal", postalcode: "codePostal",
  codepostal: "codePostal", city: "ville", image: "photo", imageurl: "photo", img: "photo", prixhabituel: "prixHabituel", source: "site",
};

function cle(nom: string): string {
  const n = nom.trim().replace(/^﻿/, "");
  return ALIAS[n.toLowerCase()] ?? n;
}

function vrai(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v !== "string" || !v.trim()) return undefined;
  return /^(oui|o|yes|y|vrai|true|1)$/i.test(v.trim());
}

/** Transforme une ligne quelconque en Annonce, ou null si elle est inutilisable. */
export function versAnnonce(brut: Record<string, unknown>, siteParDefaut: string): Annonce | null {
  const l: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(brut)) l[cle(k)] = v;
  const prix = lirePrix(l.prix);
  const titre = String(l.titre ?? "").trim();
  const lien = String(l.lien ?? "").trim();
  if (prix == null || !titre || !lien) return null;
  const port = lirePrix(l.port);
  const livrable = vrai(l.livrable) ?? port != null;
  const codePostal = l.codePostal != null ? String(l.codePostal).trim().padStart(5, "0") : undefined;
  return {
    site: String(l.site ?? siteParDefaut).trim() || siteParDefaut,
    titre,
    prix,
    port,
    lien,
    recherche: l.recherche ? String(l.recherche) : undefined,
    etat: l.etat ? String(l.etat) : undefined,
    photo: /^https:\/\//i.test(String(l.photo ?? "").trim()) ? String(l.photo).trim() : undefined,
    codePostal: codePostal && codePostal !== "00000" ? codePostal : undefined,
    ville: l.ville ? String(l.ville) : undefined,
    lat: lirePrix(l.lat) ?? undefined,
    lon: lirePrix(l.lon) ?? undefined,
    distanceKm: lirePrix(l.distanceKm) ?? undefined,
    procheDe: l.procheDe ? String(l.procheDe) : undefined,
    vendeur:
      lirePrix(l.vendeurNote) != null || lirePrix(l.vendeurAvis) != null
        ? { notePct: lirePrix(l.vendeurNote) ?? undefined, avis: lirePrix(l.vendeurAvis) ?? undefined }
        : undefined,
    livrable,
    remiseEnMain: vrai(l.remiseEnMain) ?? !livrable,
    prixHabituel: lirePrix(l.prixHabituel) ?? undefined,
  };
}

/** CSV simple, séparateur ; ou , (deviné sur l'en-tête), guillemets acceptés. */
export function lireCsv(texte: string): Record<string, string>[] {
  const lignes = texte.split(/\r?\n/).filter((l) => l.trim());
  if (!lignes.length) return [];
  const sep = (lignes[0].match(/;/g) ?? []).length >= (lignes[0].match(/,/g) ?? []).length ? ";" : ",";
  const couper = (ligne: string) => {
    const champs: string[] = [];
    let cur = "";
    let entreGuillemets = false;
    for (let i = 0; i < ligne.length; i++) {
      const c = ligne[i];
      if (c === '"' && entreGuillemets && ligne[i + 1] === '"') {
        cur += '"'; // "" dans un champ entre guillemets = un guillemet
        i++;
      } else if (c === '"') {
        entreGuillemets = !entreGuillemets;
      } else if (c === sep && !entreGuillemets) {
        champs.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    champs.push(cur);
    return champs;
  };
  const entete = couper(lignes[0]);
  return lignes.slice(1).map((l) => Object.fromEntries(couper(l).map((v, i) => [entete[i] ?? `col${i}`, v])));
}

export function lireFichier(chemin: string): Annonce[] {
  const texte = readFileSync(chemin, "utf8");
  const site = chemin.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "");
  const lignes: Record<string, unknown>[] = chemin.toLowerCase().endsWith(".json")
    ? [JSON.parse(texte)].flat()
    : lireCsv(texte);
  return lignes.map((l) => versAnnonce(l, site)).filter((a): a is Annonce => a !== null);
}

export function lireDossier(dossier: string): Annonce[] {
  let fichiers: string[] = [];
  try {
    fichiers = readdirSync(dossier).filter((f) => /\.(json|csv)$/i.test(f));
  } catch {
    return [];
  }
  return fichiers.flatMap((f) => lireFichier(join(dossier, f)));
}
