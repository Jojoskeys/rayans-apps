// « Renommer d'après le contenu » : à partir du texte lu dans un scan, une photo ou un PDF (OCR de Windows),
// propose un nom clair, par exemple « Attestation CAF novembre 2026.pdf ». Fonctions pures.

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const plier = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Types de documents, du plus précis au plus général (le premier trouvé l'emporte). */
const TYPES: [RegExp, string][] = [
  [/avis d.?imposition|avis d.?impot/, "Avis d'imposition"],
  [/attestation de (droits|paiement|loyer|securite sociale|scolarite|reussite|domicile|stage|hebergement|assurance)/, "Attestation"],
  [/certificat de scolarite/, "Certificat de scolarité"],
  [/releve de notes/, "Relevé de notes"],
  [/releve d.?identite bancaire|\brib\b/, "RIB"],
  [/releve de compte|releve bancaire/, "Relevé de compte"],
  [/bulletin de (paie|salaire)|fiche de paie/, "Bulletin de paie"],
  [/quittance de loyer|quittance/, "Quittance de loyer"],
  [/avis d.?echeance|echeancier/, "Échéancier"],
  [/convention de stage/, "Convention de stage"],
  [/contrat de (travail|location|bail)|\bbail\b/, "Contrat"],
  [/ordonnance/, "Ordonnance"],
  [/feuille de soins|decompte de remboursement|remboursement de soins/, "Remboursement de soins"],
  [/facture/, "Facture"],
  [/devis/, "Devis"],
  [/recu\b|ticket de caisse/, "Reçu"],
  [/attestation/, "Attestation"],
  [/certificat/, "Certificat"],
  [/convocation/, "Convocation"],
  [/carte vitale/, "Carte Vitale"],
  [/carte d.?identite|carte nationale d.?identite/, "Carte d'identité"],
  [/passeport/, "Passeport"],
  [/titre de sejour/, "Titre de séjour"],
  [/permis de conduire/, "Permis de conduire"],
  [/certificat d.?immatriculation|carte grise/, "Carte grise"],
  [/diplome/, "Diplôme"],
];

/** Organismes courants (nom affiché, motif cherché sans accents). */
const ORGANISMES: [RegExp, string][] = [
  [/\bcaf\b|allocations familiales/, "CAF"],
  [/\bcpam\b|assurance maladie|ameli/, "CPAM"],
  [/\bcrous\b/, "CROUS"],
  [/france travail|pole emploi/, "France Travail"],
  [/impots\.gouv|finances publiques|dgfip/, "Impôts"],
  [/\burssaf\b/, "URSSAF"],
  [/\bmutuelle\b|\bmgen\b|\bheyme\b|\bsmerra\b/, "Mutuelle"],
  [/\bedf\b/, "EDF"], [/\bengie\b/, "Engie"], [/totalenergies/, "TotalEnergies"],
  [/\bsncf\b/, "SNCF"], [/\bstar\b.*rennes|keolis/, "STAR"],
  [/\bfree\b(?! de)/, "Free"], [/\borange\b/, "Orange"], [/\bsfr\b/, "SFR"], [/bouygues/, "Bouygues"],
  [/universite|\bufr\b/, "Université"],
  [/prefecture/, "Préfecture"],
  [/credit agricole/, "Crédit Agricole"], [/societe generale/, "Société Générale"], [/\bbnp\b/, "BNP"], [/la banque postale/, "Banque Postale"],
  [/caisse d.?epargne/, "Caisse d'Épargne"], [/credit mutuel/, "Crédit Mutuel"], [/boursorama|boursobank/, "BoursoBank"], [/\blcl\b/, "LCL"],
  [/amazon/, "Amazon"], [/\bfnac\b/, "Fnac"], [/\bdecathlon\b/, "Decathlon"],
];

/** Première date du document : « 12/11/2026 », « 12-11-26 » ou « novembre 2026 ». Renvoie « novembre 2026 ». */
export function dateDuTexte(texte: string): string | null {
  const t = plier(texte);
  const re = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b|\b(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(\d{4})\b/g;
  for (const m of t.matchAll(re)) {
    if (m[4]) return `${MOIS[["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"].indexOf(m[4])]} ${m[5]}`;
    const mois = Number(m[2]), an = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    if (mois >= 1 && mois <= 12 && Number(m[1]) >= 1 && Number(m[1]) <= 31 && an >= 1990 && an <= 2100) return `${MOIS[mois - 1]} ${an}`;
  }
  return null;
}

/** Caractères interdits dans un nom de fichier Windows, espaces en trop, longueur raisonnable. */
export function nomPropre(nom: string): string {
  return nom.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "").slice(0, 120);
}

/** Première ligne qui ressemble à un titre (assez de lettres, pas une adresse ni un numéro). */
function ligneTitre(texte: string): string | null {
  for (const brute of texte.split(/\r?\n/).slice(0, 15)) {
    const l = brute.trim();
    const lettres = (l.match(/\p{L}/gu) ?? []).length;
    if (lettres >= 6 && lettres / l.length > 0.6 && l.length <= 60 && !/\d{5}|@|www\.|https?:/i.test(l)) return l;
  }
  return null;
}

export interface Proposition { nom: string; type: string | null; organisme: string | null; date: string | null }

/**
 * Nom proposé (sans dossier) pour un fichier dont on a lu le texte. `dateFichier` sert quand le document n'a pas
 * de date lisible. Renvoie null si rien d'utile n'a été trouvé (on garde alors le nom actuel).
 */
export function proposerNom(texte: string, extension: string, dateFichier: number): Proposition | null {
  const t = plier(texte);
  const type = TYPES.find(([re]) => re.test(t))?.[1] ?? null;
  const organisme = ORGANISMES.find(([re]) => re.test(t))?.[1] ?? null;
  const date = dateDuTexte(texte) ?? (type || organisme ? `${MOIS[new Date(dateFichier).getMonth()]} ${new Date(dateFichier).getFullYear()}` : null);
  let base: string | null = null;
  if (type || organisme) base = [type ?? "Document", organisme, date].filter(Boolean).join(" ");
  else { const titre = ligneTitre(texte); if (titre) base = [titre, dateDuTexte(texte)].filter(Boolean).join(" "); }
  if (!base) return null;
  const nom = nomPropre(base);
  return nom ? { nom: `${nom}${extension.toLowerCase()}`, type, organisme, date } : null;
}

/** Nom libre dans le dossier : « Facture EDF.pdf » → « Facture EDF (2).pdf » si le premier existe déjà. */
export function nomLibre(nom: string, existe: (n: string) => boolean): string {
  if (!existe(nom)) return nom;
  const i = nom.lastIndexOf(".");
  const base = i > 0 ? nom.slice(0, i) : nom, ext = i > 0 ? nom.slice(i) : "";
  for (let k = 2; k < 1000; k++) { const n = `${base} (${k})${ext}`; if (!existe(n)) return n; }
  return `${base} (${Date.now()})${ext}`;
}

export const EXTENSIONS_LISIBLES = [".pdf", ".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".heic", ".gif"];
