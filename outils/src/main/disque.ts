// Parcours d'un dossier pour mesurer la taille de chaque sous-dossier (outil « disque »).
// Les liens symboliques et jonctions ne sont pas suivis (sinon certains dossiers seraient comptés deux fois).
import fs from "node:fs/promises";
import path from "node:path";
import { elaguer, IGNORES, totaliser, type Dossier } from "../core/disque.ts";

export interface Progression { dossiers: number; octets: number }

let annule = false;
export const annulerParcours = () => { annule = true; };

/** Mesure `racine` ; `progres` est appelé régulièrement pendant le parcours. */
export async function mesurer(racine: string, progres: (p: Progression) => void): Promise<Dossier> {
  annule = false;
  const p: Progression = { dossiers: 0, octets: 0 };
  let dernier = 0;
  // Limite le nombre de dossiers lus en même temps (le disque et l'antivirus n'aiment pas les rafales).
  let actifs = 0;
  const attente: (() => void)[] = [];
  const prendre = () => new Promise<void>((ok) => { if (actifs < 32) { actifs++; ok(); } else attente.push(() => { actifs++; ok(); }); });
  const rendre = () => { actifs--; attente.shift()?.(); };

  async function visiter(chemin: string, nom: string): Promise<Dossier> {
    const d: Dossier = { nom, chemin, taille: 0, fichiers: 0, enfants: [], ici: 0 };
    if (annule) return d;
    let entrees: import("node:fs").Dirent[] = [];
    await prendre();
    try { entrees = await fs.readdir(chemin, { withFileTypes: true }); } catch { /* accès refusé : compté vide */ } finally { rendre(); }
    const sous: Promise<Dossier>[] = [];
    const tailles: Promise<void>[] = [];
    for (const e of entrees) {
      if (e.isSymbolicLink()) continue;
      const c = path.join(chemin, e.name);
      if (e.isDirectory()) { if (!IGNORES.test(e.name)) sous.push(visiter(c, e.name)); }
      else if (e.isFile()) tailles.push((async () => {
        await prendre();
        try { const s = await fs.lstat(c); d.ici += s.size; d.fichiers++; p.octets += s.size; } catch { /* fichier disparu ou verrouillé */ } finally { rendre(); }
      })());
    }
    await Promise.all(tailles);
    d.enfants = await Promise.all(sous);
    p.dossiers++;
    if (Date.now() - dernier > 250) { dernier = Date.now(); progres({ ...p }); }
    return d;
  }

  const arbre = await visiter(racine, path.basename(racine) || racine);
  progres({ ...p });
  return elaguer(totaliser(arbre));
}
