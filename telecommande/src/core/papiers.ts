// Rayan's Papiers (tuile Papiers de Rayan's Mobile) : photos de documents envoyées depuis l'iPhone, rangées sur le
// PC dans <Documents>\Rayan's Papiers, avec le texte lu par l'OCR de Windows pour les retrouver par recherche.
//      <id>.<ext>      la photo (jpg, png ou heic)
//      index.json      [{ id, titre, ext, texte, ajoute, taille, ocr }]
import fs from "node:fs";
import path from "node:path";

export const ID_VALIDE = /^[a-z0-9][a-z0-9-]{0,79}$/;
export const TITRE_MAX = 120;
export const TAILLE_MAX = 25 * 1024 * 1024;
export const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/heif": "heic" };
export const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", heic: "image/heic" };

export interface Papier {
  id: string; titre: string; ext: string; texte: string; ajoute: number; taille: number;
  /** « ok », « vide » (aucun texte lu) ou le message d'erreur de l'OCR. */
  ocr: string;
}
export interface Resultat { id: string; titre: string; ajoute: number; taille: number; extrait: string; ocr: string }

export class ErreurPapier extends Error { code: number; constructor(code: number, m: string) { super(m); this.code = code; } }

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fichierIndex = (dossier: string) => path.join(dossier, "index.json");

export function lireIndex(dossier: string): Papier[] {
  try {
    const j = JSON.parse(fs.readFileSync(fichierIndex(dossier), "utf8"));
    return Array.isArray(j) ? j.filter((p) => p && typeof p.id === "string" && ID_VALIDE.test(p.id) && typeof p.ext === "string") : [];
  } catch { return []; }
}
function ecrireIndex(dossier: string, papiers: Papier[]) {
  fs.mkdirSync(dossier, { recursive: true });
  const tmp = fichierIndex(dossier) + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(papiers, null, 2), "utf8");
  fs.renameSync(tmp, fichierIndex(dossier));
}

export const titrePropre = (t: string) => t.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, TITRE_MAX);

/** Extension d'après le type annoncé par le téléphone ; null si ce n'est pas une image acceptée. */
export const extensionDe = (type: string | undefined) => EXTENSIONS[(type ?? "").split(";")[0].trim().toLowerCase()] ?? null;

export const cheminPapier = (dossier: string, p: Pick<Papier, "id" | "ext">) => path.join(dossier, `${p.id}.${p.ext}`);

/** Enregistre un papier dont la photo est déjà écrite à cheminPapier(…). */
export function ajouterPapier(dossier: string, p: Papier): Papier {
  if (!ID_VALIDE.test(p.id) || !TYPES[p.ext]) throw new ErreurPapier(400, "papier invalide");
  const propre = { ...p, titre: titrePropre(p.titre) || "Document sans titre" };
  ecrireIndex(dossier, [propre, ...lireIndex(dossier).filter((x) => x.id !== p.id)]);
  return propre;
}

export function renommerPapier(dossier: string, id: string, titre: string): Papier {
  const t = titrePropre(titre);
  if (!t) throw new ErreurPapier(400, "titre vide");
  const liste = lireIndex(dossier);
  const p = liste.find((x) => x.id === id);
  if (!p) throw new ErreurPapier(404, "papier introuvable");
  p.titre = t;
  ecrireIndex(dossier, liste);
  return p;
}

export function supprimerPapier(dossier: string, id: string) {
  const liste = lireIndex(dossier);
  const p = liste.find((x) => x.id === id);
  if (!p) throw new ErreurPapier(404, "papier introuvable");
  fs.rmSync(cheminPapier(dossier, p), { force: true });
  ecrireIndex(dossier, liste.filter((x) => x !== p));
}

/** Morceau de texte autour du premier mot trouvé (ou le début du texte). */
export function extrait(texte: string, mots: string[], largeur = 140): string {
  const plat = texte.replace(/\s+/g, " ").trim();
  if (!plat) return "";
  const bas = sansAccents(plat);
  const i = mots.map((m) => bas.indexOf(m)).filter((x) => x >= 0).sort((a, b) => a - b)[0] ?? 0;
  const debut = Math.max(0, i - Math.floor(largeur / 3));
  return (debut > 0 ? "…" : "") + plat.slice(debut, debut + largeur) + (debut + largeur < plat.length ? "…" : "");
}

/** Recherche sans accents dans le titre et le texte lu : tous les mots doivent y être. Les plus récents d'abord. */
export function chercher(papiers: Papier[], q: string): Resultat[] {
  const mots = sansAccents(q).split(/\s+/).filter(Boolean);
  return papiers
    .filter((p) => { const t = sansAccents(`${p.titre}\n${p.texte}`); return mots.every((m) => t.includes(m)); })
    .sort((a, b) => b.ajoute - a.ajoute)
    .map((p) => ({ id: p.id, titre: p.titre, ajoute: p.ajoute, taille: p.taille, ocr: p.ocr, extrait: extrait(p.texte, mots) }));
}
