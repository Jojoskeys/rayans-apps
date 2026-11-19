// « Renommer d'après le contenu » : lit le texte de chaque fichier (OCR de Windows, première page pour un PDF),
// propose un nom, puis renomme seulement ce que Rayan a validé. Le dernier lot peut être annulé.
import fs from "node:fs";
import path from "node:path";
import { EXTENSIONS_LISIBLES, nomLibre, nomPropre, proposerNom } from "../core/nommer.ts";
import { lireTexte } from "./windows.ts";

export interface Proposition { chemin: string; actuel: string; propose: string | null; extrait: string; erreur: string | null }
export interface Renommage { avant: string; apres: string }

let dernierLot: Renommage[] = [];

export async function proposer(fichiers: string[]): Promise<Proposition[]> {
  const out: Proposition[] = [];
  for (const chemin of fichiers) {
    const actuel = path.basename(chemin);
    const ext = path.extname(chemin);
    if (!EXTENSIONS_LISIBLES.includes(ext.toLowerCase())) { out.push({ chemin, actuel, propose: null, extrait: "", erreur: "type de fichier non pris en charge (PDF ou image seulement)" }); continue; }
    try {
      const { texte } = await lireTexte(chemin);
      const p = proposerNom(texte, ext, fs.statSync(chemin).mtimeMs);
      out.push({ chemin, actuel, propose: p?.nom ?? null, extrait: texte.replace(/\s+/g, " ").trim().slice(0, 160), erreur: p ? null : texte.trim() ? "rien de reconnaissable : choisis un nom" : "aucun texte lu (photo floue ?)" });
    } catch (e) {
      out.push({ chemin, actuel, propose: null, extrait: "", erreur: String((e as Error).message ?? e) });
    }
  }
  return out;
}

/** Renomme dans le même dossier ; un nom déjà pris reçoit « (2) ». */
export function renommer(choix: { chemin: string; nom: string }[]): Renommage[] {
  const faits: Renommage[] = [];
  for (const c of choix) {
    const ext = path.extname(c.chemin);
    let nom = nomPropre(c.nom);
    if (!nom) continue;
    if (path.extname(nom).toLowerCase() !== ext.toLowerCase()) nom += ext;
    const dir = path.dirname(c.chemin);
    if (nom === path.basename(c.chemin) || !fs.existsSync(c.chemin)) continue;
    const libre = nomLibre(nom, (n) => fs.existsSync(path.join(dir, n)));
    const apres = path.join(dir, libre);
    fs.renameSync(c.chemin, apres);
    faits.push({ avant: c.chemin, apres });
  }
  dernierLot = faits;
  return faits;
}

/** Remet les noms d'avant pour le dernier lot (si les fichiers n'ont pas bougé entre-temps). */
export function annulerDernier(): number {
  let n = 0;
  for (const r of [...dernierLot].reverse()) {
    if (fs.existsSync(r.apres) && !fs.existsSync(r.avant)) { fs.renameSync(r.apres, r.avant); n++; }
  }
  dernierLot = [];
  return n;
}

export const peutAnnuler = () => dernierLot.length > 0;
