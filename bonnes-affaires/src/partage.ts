// Dépose le classement dans <Documents>\Rayan's Bonnes Affaires\offres.json, où Rayan's Télécommande le lit
// pour la tuile « Bonnes affaires » de l'iPhone (même principe que Rayan's Favoris).
import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Offre } from "./types.ts";

/** Dossier Documents réel de Windows (il peut être déplacé dans OneDrive). */
function documents(): string {
  if (process.platform === "win32") {
    try {
      const d = execFileSync("powershell.exe", ["-NoProfile", "-Command", "[Environment]::GetFolderPath('MyDocuments')"], {
        encoding: "utf8",
        timeout: 15_000,
      }).trim();
      if (d) return d;
    } catch {
      /* repli ci-dessous */
    }
  }
  return join(homedir(), "Documents");
}

export function dossierPartage(): string {
  return process.env.BONNES_AFFAIRES_DOSSIER || join(documents(), "Rayan's Bonnes Affaires");
}

/** Ce que la tuile affiche : l'essentiel de chaque offre, dans l'ordre du classement. */
export function versPartage(offres: Offre[], demo: boolean, quand = Date.now()) {
  return {
    majLe: quand,
    demo,
    offres: offres.slice(0, 40).map((o) => ({
      titre: o.titre,
      site: o.site,
      recherche: o.recherche,
      lien: o.lien,
      photo: o.photo,
      total: o.total,
      prixHabituel: o.prixHabituel,
      ecartPct: o.ecartPct,
      gainRevente: o.gainRevente,
      distanceKm: o.distanceKm ?? null,
      procheDe: o.procheDe,
      dansZone: o.dansZone,
      livrable: o.livrable,
      port: o.port,
      surete: o.surete,
      raisons: o.raisons,
      choix: o.choix,
      pepite: o.pepite,
      loin: o.loin,
    })),
  };
}

export function deposer(offres: Offre[], demo: boolean, dossier = dossierPartage()): string {
  mkdirSync(dossier, { recursive: true });
  const fichier = join(dossier, "offres.json");
  // Écrit à côté puis renomme : la Télécommande ne lit jamais un fichier à moitié écrit.
  writeFileSync(`${fichier}.tmp`, JSON.stringify(versPartage(offres, demo)));
  renameSync(`${fichier}.tmp`, fichier);
  return fichier;
}
