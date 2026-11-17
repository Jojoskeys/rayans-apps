// Objectifs du jour : chaque jour, une dizaine d'objectifs choisis dans des domaines différents
// (foi, études, écran, santé) et adaptés à ce que Rayan fait vraiment.
//   - Mesurés automatiquement quand une app le sait : cartes révisées (Révision), temps de travail (Chrono),
//     temps de jeu et heure de la dernière activité (résumé de Rayan's Journal), séance de sport faite.
//   - Compteurs (pas, pompes, tractions…) : nombre saisi avec + / −, avec un palier bonus plus dur.
//     Les pompes et tractions des séances de sport comptent automatiquement.
//   - Sinon à cocher (prières, marche…).
// Objectifs « tous les jours » : toujours présents. Les autres tournent d'un jour à l'autre.
// Tout est modifiable : objectifs perso (ou modèles personnalisés), cibles, objectifs masqués, nombre par jour.
// Cible des objectifs mesurés : un peu au-dessus de la médiane des 7 derniers jours ; plus douce après un échec.
// Les objectifs d'une journée sont choisis une fois et gardés : ils ne changent pas en cours de journée
// (sauf si les réglages changent : la liste est alors complétée ou réduite, cases cochées et compteurs gardés).
// Fonctions pures : l'heure, les mesures et les données sont passées en paramètre.

import { dayStart } from "./counts.ts";

export type Domaine = "foi" | "etudes" | "ecran" | "sante";
export const DOMAINES: Domaine[] = ["foi", "etudes", "ecran", "sante"];
export const NOMS_DOMAINES: Record<Domaine, string> = { foi: "Prière et Coran", etudes: "Études", ecran: "Écran", sante: "Santé" };

/** Mesure : automatique (« au moins » ou « au plus »), ou compteur saisi à la main (`saisie`). */
export interface Mesure {
  source: "revision" | "chrono" | "jeux" | "coucher" | "seance" | "saisie";
  sens: "min" | "max";
  /** Cartes, minutes, minutes depuis minuit pour le coucher (après minuit : 24 h + …, ex. 0 h 30 = 1470), ou nombre. */
  cible: number;
  /** Palier bonus, plus dur mais atteignable (compteurs). */
  bonus?: number;
  /** Unité d'un compteur (« pas », « pompes »). */
  unite?: string;
  /** Pas des boutons + / − d'un compteur. */
  pas?: number;
  /** Exercices de sport dont les reps du jour s'ajoutent au compteur. */
  exercices?: string[];
}

export interface Objectif {
  /** Identifiant du modèle (ex. « marche ») : sert à l'historique et à l'adaptation. */
  id: string;
  domaine: Domaine;
  titre: string;
  detail: string;
  mesure: Mesure | null;
  facile: boolean;
}

export interface ObjectifJour extends Objectif {
  /** Objectif à cocher : fait ou non. */
  fait: boolean;
  /** Compteur : nombre saisi à la main (sans les reps des séances). */
  valeur?: number;
  /** Présent tous les jours (réglage « tous les jours »). */
  fixe?: boolean;
  /** Résultat définitif, une fois la journée passée. */
  resultat?: "atteint" | "manque";
  bonusAtteint?: boolean;
}

/** Objectif créé ou personnalisé par l'utilisateur (même id qu'un modèle : le remplace). */
export interface ObjectifPerso {
  id: string;
  domaine: Domaine;
  titre: string;
  detail: string;
  /** Compteur (pas, pompes…) ; absent : objectif à cocher. */
  compteur?: { unite: string; cible: number; bonus?: number; pas: number; exercices?: string[] };
}

export interface Reglages {
  domaines: Domaine[];
  /** Nombre total d'objectifs par jour (objectifs « tous les jours » compris). */
  nombre: number;
  perso: ObjectifPerso[];
  /** Objectifs présents tous les jours. */
  toujours: string[];
  /** Objectifs jamais proposés. */
  masques: string[];
}

export interface ObjectifsData {
  /** « AAAA-MM-JJ » (journée de 4 h à 4 h) → objectifs. Gardé 60 jours. */
  jours: Record<string, ObjectifJour[]>;
  /** Notifications déjà envoyées (« jour|matin », « jour|soir »). */
  envoyes: string[];
  reglages: Reglages;
}

export const NOMBRE_MAX = 20;

export const PERSO_DEPART: ObjectifPerso[] = [
  { id: "pas", domaine: "sante", titre: "Marcher 10 000 pas", detail: "Le compte de pas est dans l'app Santé de l'iPhone : reporte-le ici.", compteur: { unite: "pas", cible: 10_000, bonus: 20_000, pas: 1000 } },
  { id: "pompes", domaine: "sante", titre: "Faire 50 pompes", detail: "En plusieurs séries dans la journée. Les pompes de ta séance comptent.", compteur: { unite: "pompes", cible: 50, bonus: 100, pas: 10, exercices: ["pompes", "pompes-volume"] } },
  { id: "tractions", domaine: "sante", titre: "Faire 30 tractions", detail: "Séries courtes, loin de l'échec (épaules). Les tractions de ta séance comptent.", compteur: { unite: "tractions", cible: 30, bonus: 100, pas: 5, exercices: ["tractions-strictes", "tractions-lestees"] } },
  { id: "eau", domaine: "sante", titre: "Boire 8 verres d'eau", detail: "Une bouteille près de toi aide.", compteur: { unite: "verres", cible: 8, bonus: 12, pas: 1 } },
];

export const REGLAGES_DEPART: Reglages = { domaines: [...DOMAINES], nombre: 10, perso: PERSO_DEPART, toujours: ["pas", "pompes", "tractions", "seance"], masques: [] };

export const OBJECTIFS_VIDES: ObjectifsData = { jours: {}, envoyes: [], reglages: REGLAGES_DEPART };

/** Ce que les apps savent, par journée (« AAAA-MM-JJ », de 4 h à 4 h). Champ absent : l'app n'a pas de données. */
export interface Mesures {
  revisionCartes?: Record<string, number>;
  /** Cartes encore à réviser aujourd'hui (pour ne pas viser plus que possible). */
  revisionRestantes?: number;
  chronoMin?: Record<string, number>;
  /** Résumé de Rayan's Journal (journées suivies seulement). */
  jeuxMin?: Record<string, number>;
  /** Dernière activité de la journée, en minutes depuis minuit (après minuit : + 1440). */
  coucherMin?: Record<string, number>;
  hifzRestantes?: number;
  ouverturesRestantes?: number;
  /** Les adhkar sont déjà rappelés et cochés dans le bilan du jour. */
  sansAdhkar?: boolean;
  /** Sport : séance faite par journée, et journées de repos. */
  seanceFaite?: Record<string, boolean>;
  repos?: (jour: string) => boolean;
  /** Sport : reps faites par journée et par exercice. */
  sportReps?: Record<string, Record<string, number>>;
}

const GARDER_JOURS = 60;

/** Journée (de 4 h à 4 h) contenant `now`. */
export function journee(now: number): string {
  const d = new Date(dayStart(now, 4));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function decaler(jour: string, n: number): string {
  const [a, m, j] = jour.split("-").map(Number);
  const d = new Date(a, m - 1, j + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Médiane des 7 journées précédant `jour` (seulement celles où une valeur existe ; option : ignorer les zéros). */
export function mediane(par: Record<string, number> | undefined, jour: string, sansZeros = false): number | null {
  if (!par) return null;
  const v: number[] = [];
  for (let i = 1; i <= 7; i++) {
    const x = par[decaler(jour, -i)];
    if (typeof x === "number" && (!sansZeros || x > 0)) v.push(x);
  }
  if (!v.length) return null;
  v.sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

const arrondi5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
const heureTexte = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
};
export const nombreTexte = (n: number) => Math.round(n).toLocaleString("fr-FR").replace(/\s/g, " ");

// ----- Modèles à cocher -----------------------------------------------------------------------------

interface Modele { id: string; domaine: Domaine; normal: string; facile: string; detail: string; si?: (m: Mesures) => boolean }

const MODELES: Modele[] = [
  { id: "prieres", domaine: "foi", normal: "Faire les 5 prières", facile: "Faire au moins 3 prières à l'heure", detail: "À cocher le soir." },
  { id: "fajr", domaine: "foi", normal: "Prier Fajr à l'heure", facile: "Prier Fajr, même un peu en retard", detail: "Rayan's Prière te rappelle l'heure." },
  { id: "coran", domaine: "foi", normal: "Lire une page de Coran", facile: "Lire 5 versets de Coran", detail: "Le moment que tu veux." },
  { id: "adhkar", domaine: "foi", normal: "Dire les adhkar du matin et du soir", facile: "Dire les adhkar du matin", detail: "Quelques minutes." },
  { id: "dhikr", domaine: "foi", normal: "Dire 100 fois « Subhân Allâh wa bihamdih »", facile: "Dire 33 fois « Subhân Allâh wa bihamdih »", detail: "En marchant, dans les transports…" },
  { id: "hifz", domaine: "foi", normal: "Réciter 1 portion dans Rayan's Hifz", facile: "Réciter 1 portion dans Rayan's Hifz", detail: "Des portions t'attendent.", si: (m) => (m.hifzRestantes ?? 0) > 0 },
  { id: "relire-cours", domaine: "etudes", normal: "Relire le cours du jour (10 min)", facile: "Relire tes notes du jour (5 min)", detail: "Juste relire, sans pression." },
  { id: "preparer", domaine: "etudes", normal: "Préparer tes affaires de cours pour demain", facile: "Regarder ton emploi du temps de demain", detail: "Le soir." },
  { id: "lecture", domaine: "etudes", normal: "Lire 10 pages d'un livre", facile: "Lire 5 pages d'un livre", detail: "Papier ou liseuse, pas le téléphone." },
  { id: "ouvertures", domaine: "etudes", normal: "Rejouer 3 positions dans Rayan's Ouvertures", facile: "Rejouer 1 position dans Rayan's Ouvertures", detail: "Des positions t'attendent.", si: (m) => (m.ouverturesRestantes ?? 0) > 0 },
  { id: "pause-ecran", domaine: "ecran", normal: "30 minutes sans écran", facile: "15 minutes sans écran", detail: "Marche, lecture, discussion…" },
  { id: "repas", domaine: "ecran", normal: "Pas de téléphone pendant les repas", facile: "Un repas sans téléphone", detail: "" },
  { id: "tel-soir", domaine: "ecran", normal: "Poser le téléphone 30 min avant de dormir", facile: "Poser le téléphone 10 min avant de dormir", detail: "" },
  { id: "eau", domaine: "sante", normal: "Boire 1,5 L d'eau", facile: "Boire 4 verres d'eau", detail: "Une bouteille près de toi aide." },
  { id: "marche", domaine: "sante", normal: "Marcher 15 minutes", facile: "Marcher 10 minutes", detail: "Dehors si possible." },
  { id: "proteines", domaine: "sante", normal: "Des protéines à chaque repas", facile: "Des protéines à 2 repas", detail: "Viande, poisson, œufs, laitages, légumineuses : aide à garder le muscle pendant la sèche." },
  { id: "bureau", domaine: "sante", normal: "Ranger ton bureau 5 minutes", facile: "Ranger 3 choses sur ton bureau", detail: "" },
  { id: "lit", domaine: "sante", normal: "Faire ton lit", facile: "Faire ton lit", detail: "Le matin." },
  { id: "fruit", domaine: "sante", normal: "Manger un fruit", facile: "Manger un fruit", detail: "" },
  { id: "etirements", domaine: "sante", normal: "5 minutes d'étirements", facile: "2 minutes d'étirements", detail: "" },
];

/** Objectifs mesurés automatiquement (proposés seulement quand la mesure existe). */
const AUTOMATIQUES: { id: string; domaine: Domaine; titre: string }[] = [
  { id: "revision", domaine: "etudes", titre: "Réviser des cartes dans Rayan's Révision" },
  { id: "chrono", domaine: "etudes", titre: "Travail chronométré dans Rayan's Chrono" },
  { id: "jeux", domaine: "ecran", titre: "Moins de jeux que d'habitude" },
  { id: "coucher", domaine: "ecran", titre: "Éteindre l'ordinateur plus tôt" },
  { id: "seance", domaine: "sante", titre: "Faire la séance de sport du jour" },
];

/** Tous les objectifs connus, pour les réglages (perso compris). */
export function catalogue(d: ObjectifsData): { id: string; domaine: Domaine; titre: string; type: "auto" | "case" | "compteur"; perso: boolean; modele: boolean }[] {
  const perso = new Map(d.reglages.perso.map((p) => [p.id, p]));
  const out = [
    ...AUTOMATIQUES.map((a) => ({ id: a.id, domaine: a.domaine, titre: a.titre, type: "auto" as const, perso: false, modele: true })),
    ...MODELES.map((x) => ({ id: x.id, domaine: x.domaine, titre: x.normal, type: "case" as const, perso: false, modele: true })),
  ].map((x) => { const p = perso.get(x.id); return p ? { ...x, domaine: p.domaine, titre: p.titre, type: p.compteur ? "compteur" as const : "case" as const, perso: true } : x; });
  for (const p of d.reglages.perso) if (!out.some((x) => x.id === p.id)) out.push({ id: p.id, domaine: p.domaine, titre: p.titre, type: p.compteur ? "compteur" : "case", perso: true, modele: false });
  return out;
}

const depuisPerso = (p: ObjectifPerso): Objectif => ({
  id: p.id, domaine: p.domaine, titre: p.titre, detail: p.detail, facile: false,
  mesure: p.compteur ? {
    source: "saisie", sens: "min", cible: p.compteur.cible, unite: p.compteur.unite, pas: p.compteur.pas,
    ...(p.compteur.bonus !== undefined ? { bonus: p.compteur.bonus } : {}), ...(p.compteur.exercices ? { exercices: p.compteur.exercices } : {}),
  } : null,
});

// ----- Historique -----------------------------------------------------------------------------------

/** Dernier résultat connu d'un modèle avant `jour` : true atteint, false manqué, null jamais proposé. */
function dernierResultat(d: ObjectifsData, id: string, jour: string): boolean | null {
  const jours = Object.keys(d.jours).filter((j) => j < jour).sort().reverse();
  for (const j of jours) {
    const o = d.jours[j].find((x) => x.id === id);
    if (o) return o.resultat ? o.resultat === "atteint" : o.fait;
  }
  return null;
}

function tauxReussite(d: ObjectifsData, id: string, jour: string): number {
  let n = 0, ok = 0;
  for (const [j, l] of Object.entries(d.jours)) {
    if (j >= jour) continue;
    for (const o of l) if (o.id === id) { n++; if (o.resultat === "atteint" || (!o.resultat && o.fait)) ok++; }
  }
  return n ? ok / n : 0.6;
}

const proposeHier = (d: ObjectifsData, id: string, jour: string) => (d.jours[decaler(jour, -1)] ?? []).some((o) => o.id === id);

// ----- Candidats ------------------------------------------------------------------------------------

/** Tous les objectifs possibles pour `jour`, avec leurs cibles adaptées (objectifs masqués exclus). */
export function candidats(d: ObjectifsData, m: Mesures, jour: string): Objectif[] {
  const out: Objectif[] = [];
  const rate = (id: string) => dernierResultat(d, id, jour) === false;
  const perso = new Map(d.reglages.perso.map((p) => [p.id, p]));

  // Révision : un peu plus que d'habitude, sans dépasser ce qui reste à faire aujourd'hui.
  if (m.revisionCartes || (m.revisionRestantes ?? 0) > 0) {
    const med = mediane(m.revisionCartes, jour, true);
    let cible = med === null ? 10 : rate("revision") ? Math.round(med * 0.8) : Math.round(med * 1.1);
    cible = Math.max(5, cible);
    const fait = m.revisionCartes?.[jour] ?? 0;
    if (m.revisionRestantes !== undefined) cible = Math.min(cible, fait + m.revisionRestantes);
    if (cible >= 3) {
      out.push({
        id: "revision", domaine: "etudes", titre: `Réviser ${cible} cartes dans Rayan's Révision`, facile: rate("revision"),
        detail: med === null ? "Pour commencer doucement." : `Tu en révises ${Math.round(med)} d'habitude.`, mesure: { source: "revision", sens: "min", cible },
      });
    }
  }
  // Travail concentré dans Chrono.
  if (m.chronoMin) {
    const med = mediane(m.chronoMin, jour, true);
    const cible = Math.min(120, Math.max(15, arrondi5(med === null ? 15 : rate("chrono") ? med * 0.8 : med * 1.1)));
    out.push({
      id: "chrono", domaine: "etudes", titre: `${cible} min de travail chronométré dans Rayan's Chrono`, facile: rate("chrono"),
      detail: med === null ? "Un Pomodoro, et c'est fait." : `D'habitude : ${Math.round(med)} min.`, mesure: { source: "chrono", sens: "min", cible },
    });
  }
  // Jeux : un peu moins que d'habitude (seulement si c'est déjà beaucoup).
  if (m.jeuxMin) {
    const med = mediane(m.jeuxMin, jour);
    if (med !== null && med >= 30) {
      const cible = Math.max(15, arrondi5(rate("jeux") ? med : med * 0.9));
      out.push({
        id: "jeux", domaine: "ecran", titre: `Pas plus de ${cible} min de jeux`, facile: rate("jeux"),
        detail: `D'habitude : ${Math.round(med)} min. Mesuré par Rayan's Journal.`, mesure: { source: "jeux", sens: "max", cible },
      });
    }
  }
  // Coucher : lâcher l'écran un peu plus tôt (seulement si c'est tard).
  if (m.coucherMin) {
    const med = mediane(m.coucherMin, jour);
    if (med !== null && med >= 23 * 60 + 30) {
      const cible = Math.round((rate("coucher") ? med : med - 15) / 15) * 15;
      out.push({
        id: "coucher", domaine: "ecran", titre: `Éteindre l'ordinateur avant ${heureTexte(cible)}`, facile: rate("coucher"),
        detail: `D'habitude vers ${heureTexte(med)}. Mesuré par Rayan's Journal.`, mesure: { source: "coucher", sens: "max", cible },
      });
    }
  }
  // Séance de sport du jour (pas les jours de repos).
  if (m.seanceFaite && !m.repos?.(jour)) {
    out.push({ id: "seance", domaine: "sante", titre: "Faire la séance de sport du jour", detail: "Coché tout seul quand la séance est enregistrée.", facile: false, mesure: { source: "seance", sens: "min", cible: 1 } });
  }
  // Un objectif perso remplace l'objectif automatique de même id.
  for (let i = 0; i < out.length; i++) { const p = perso.get(out[i].id); if (p) out[i] = depuisPerso(p); }
  for (const x of MODELES) {
    if (perso.has(x.id)) continue;
    if (x.si && !x.si(m)) continue;
    if (x.id === "adhkar" && m.sansAdhkar) continue;
    const facile = rate(x.id);
    out.push({ id: x.id, domaine: x.domaine, titre: facile ? x.facile : x.normal, detail: x.detail, mesure: null, facile });
  }
  for (const p of d.reglages.perso) if (!out.some((o) => o.id === p.id)) out.push(depuisPerso(p));
  return out.filter((o) => !d.reglages.masques.includes(o.id));
}

// ----- Choix du jour --------------------------------------------------------------------------------

/** Petit générateur pseudo-aléatoire déterministe (même jour → mêmes objectifs). */
function hasard(graine: string) {
  let h = 2166136261;
  for (const c of graine) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/**
 * Choisit des objectifs tournants pour `jour` (hors objectifs « tous les jours ») : domaines différents tant que
 * possible, en tournant d'un jour à l'autre. `deja` : objectifs déjà retenus (comptent pour le nombre et les domaines).
 */
export function choisir(d: ObjectifsData, m: Mesures, jour: string, exclus: string[] = [], deja: Objectif[] = []): Objectif[] {
  const r = hasard(jour + exclus.join(","));
  const domaines = d.reglages.domaines.length ? d.reglages.domaines : DOMAINES;
  const tous = candidats(d, m, jour).filter((c) => domaines.includes(c.domaine) && !exclus.includes(c.id) && !d.reglages.toujours.includes(c.id) && !deja.some((x) => x.id === c.id));
  const nombre = Math.max(1, Math.min(NOMBRE_MAX, d.reglages.nombre));
  // Ordre des domaines : décalé chaque jour pour que celui laissé de côté change.
  const [a, mo, j] = jour.split("-").map(Number);
  const n = Math.floor(new Date(a, mo - 1, j).getTime() / 86_400_000);
  const ordre = domaines.map((_, i) => domaines[(i + n) % domaines.length]);
  const choisis: Objectif[] = [...deja];
  // Poids : pas le même qu'hier, plutôt ce qui réussit (facile), un peu plus les objectifs mesurés, et du hasard.
  const poids = new Map(tous.map((c) => [c.id, (proposeHier(d, c.id, jour) ? 0.15 : 1) * (0.5 + tauxReussite(d, c.id, jour)) * (c.mesure ? 1.3 : 1) * (0.5 + r())]));
  for (let tour = 0; choisis.length < nombre && tour <= nombre; tour++) {
    for (const dom of ordre) {
      if (choisis.length >= nombre) break;
      const libres = tous.filter((c) => c.domaine === dom && !choisis.some((x) => x.id === c.id));
      // Premier tour : un objectif par domaine pas encore représenté ; ensuite, au plus `tour + 1` par domaine.
      const dans = choisis.filter((x) => x.domaine === dom).length;
      if (!libres.length || dans > tour) continue;
      libres.sort((x, y) => poids.get(y.id)! - poids.get(x.id)!);
      choisis.push(libres[0]);
    }
  }
  return choisis.slice(deja.length);
}

/**
 * Liste du jour selon les réglages : objectifs « tous les jours », puis les objectifs tournants déjà choisis
 * (gardés), complétés ou réduits jusqu'au nombre voulu. Cases cochées et compteurs gardés.
 */
export function composer(d: ObjectifsData, m: Mesures, jour: string, actuels: ObjectifJour[] = []): ObjectifJour[] {
  const reg = d.reglages;
  const tous = candidats(d, m, jour);
  const parId = new Map(tous.map((c) => [c.id, c]));
  const perso = new Map(reg.perso.map((p) => [p.id, p]));
  const nouveau = (o: Objectif): ObjectifJour => ({ ...o, fait: false, ...(o.mesure?.source === "saisie" ? { valeur: 0 } : {}) });
  // Objectifs perso : titre et cibles mis à jour (modifiés dans les réglages), progression gardée.
  const compteur = (o: Objectif) => o.mesure?.source === "saisie";
  const rafraichir = (o: ObjectifJour): ObjectifJour => {
    const p = perso.get(o.id);
    if (!p) {
      // Personnalisation retirée : on revient au modèle d'origine si le type a changé.
      const c = parId.get(o.id);
      return c && compteur(c) !== compteur(o) ? nouveau(c) : o;
    }
    const n = depuisPerso(p);
    const { valeur: _v, ...sans } = o;
    return { ...sans, ...n, fait: o.fait, ...(compteur(n) ? { valeur: o.valeur ?? 0 } : {}) };
  };
  const garde = actuels.filter((o) => !reg.masques.includes(o.id) && !estPersoSupprime(o, reg)).map(rafraichir);
  const fixes: ObjectifJour[] = [];
  for (const id of reg.toujours) {
    const deja = garde.find((o) => o.id === id);
    if (deja) fixes.push({ ...deja, fixe: true });
    else if (parId.has(id)) fixes.push({ ...nouveau(parId.get(id)!), fixe: true });
  }
  const nombre = Math.max(1, Math.min(NOMBRE_MAX, reg.nombre));
  let tournants = garde.filter((o) => !reg.toujours.includes(o.id) && reg.domaines.includes(o.domaine)).map((o) => ({ ...o, fixe: false }));
  // Trop d'objectifs : on retire d'abord ceux pas encore commencés, en partant de la fin.
  while (fixes.length + tournants.length > nombre && tournants.length) {
    const libre = [...tournants].reverse().find((o) => !o.fait && !o.valeur);
    tournants = tournants.filter((o) => o !== (libre ?? tournants[tournants.length - 1]));
  }
  const liste = [...fixes, ...tournants];
  if (liste.length < nombre) liste.push(...choisir(d, m, jour, [], liste).map(nouveau).map((o) => ({ ...o, fixe: false })));
  return liste;
}

/** Objectif perso qui n'existe plus dans les réglages. */
function estPersoSupprime(o: ObjectifJour, reg: Reglages): boolean {
  if (reg.perso.some((p) => p.id === o.id)) return false;
  return !MODELES.some((x) => x.id === o.id) && !AUTOMATIQUES.some((x) => x.id === o.id);
}

// ----- Avancement -----------------------------------------------------------------------------------

export interface Avancement {
  /** Valeur actuelle (cartes, minutes, minutes depuis minuit, nombre) ; null pour un objectif à cocher. */
  valeur: number | null;
  etat: "atteint" | "en-cours" | "manque";
  texte: string;
  /** Compteur : palier bonus atteint. */
  bonus?: boolean;
  /** Compteur : part venant des séances de sport. */
  auto?: number;
}

/** Reps faites pendant les séances du jour pour les exercices liés à un compteur. */
export const repsSeance = (mes: Mesure, m: Mesures, jour: string) => (mes.exercices ?? []).reduce((n, e) => n + (m.sportReps?.[jour]?.[e] ?? 0), 0);

function valeur(m: Mesures, s: Mesure["source"], jour: string): number | undefined {
  if (s === "revision") return m.revisionCartes?.[jour] ?? 0;
  if (s === "chrono") return m.chronoMin?.[jour] ?? 0;
  if (s === "jeux") return m.jeuxMin?.[jour];
  if (s === "seance") return m.seanceFaite?.[jour] ? 1 : 0;
  return m.coucherMin?.[jour];
}

/** Où en est un objectif. `finie` : la journée est passée, le résultat est définitif. */
export function avancement(o: ObjectifJour, m: Mesures, jour: string, finie: boolean): Avancement {
  if (!o.mesure) return { valeur: null, etat: o.fait ? "atteint" : finie ? "manque" : "en-cours", texte: o.fait ? "Fait" : "À cocher" };
  const c = o.mesure.cible;
  if (o.mesure.source === "saisie") {
    const auto = repsSeance(o.mesure, m, jour);
    const x = (o.valeur ?? 0) + auto;
    const b = o.mesure.bonus;
    const bonus = b !== undefined && x >= b;
    const u = o.mesure.unite ? ` ${o.mesure.unite}` : "";
    const texte = `${nombreTexte(x)} / ${nombreTexte(c)}${u}${b !== undefined ? (bonus ? " · bonus atteint ★" : ` · bonus ${nombreTexte(b)}`) : ""}${auto ? ` · dont ${nombreTexte(auto)} en séance` : ""}`;
    return { valeur: x, etat: x >= c ? "atteint" : finie ? "manque" : "en-cours", texte, bonus, auto };
  }
  const v = valeur(m, o.mesure.source, jour);
  if (o.mesure.source === "seance") return { valeur: v ?? 0, etat: v ? "atteint" : finie ? "manque" : "en-cours", texte: v ? "Séance enregistrée" : "Séance à faire" };
  if (o.mesure.sens === "min") {
    const x = v ?? 0;
    const unite = o.mesure.source === "revision" ? "cartes" : "min";
    return { valeur: x, etat: x >= c ? "atteint" : finie ? "manque" : "en-cours", texte: `${Math.round(x)} / ${c} ${unite}` };
  }
  if (o.mesure.source === "coucher") {
    if (v === undefined) return { valeur: null, etat: finie ? "atteint" : "en-cours", texte: `Ce soir avant ${heureTexte(c)}` };
    if (v > c) return { valeur: v, etat: "manque", texte: `Dernière activité à ${heureTexte(v)}` };
    return { valeur: v, etat: finie ? "atteint" : "en-cours", texte: finie ? `Éteint à ${heureTexte(v)}` : `Ce soir avant ${heureTexte(c)}` };
  }
  const x = v ?? 0;
  if (x > c) return { valeur: x, etat: "manque", texte: `${Math.round(x)} min de jeux (limite ${c})` };
  return { valeur: x, etat: finie ? "atteint" : "en-cours", texte: `${Math.round(x)} / ${c} min au plus` };
}

// ----- Mise à jour des données ----------------------------------------------------------------------

/** Assure les objectifs du jour, fige le résultat des journées passées et purge les vieilles. */
export function preparer(d: ObjectifsData, m: Mesures, now: number): ObjectifsData {
  const jour = journee(now);
  const jours: Record<string, ObjectifJour[]> = {};
  const limite = decaler(jour, -GARDER_JOURS);
  for (const [j, l] of Object.entries(d.jours)) {
    if (j < limite) continue;
    jours[j] = j < jour ? l.map((o) => {
      if (o.resultat) return o;
      const a = avancement(o, m, j, true);
      return { ...o, resultat: a.etat === "atteint" ? "atteint" as const : "manque" as const, ...(a.bonus ? { bonusAtteint: true } : {}) };
    }) : l;
  }
  const next: ObjectifsData = { ...d, jours, envoyes: d.envoyes.filter((e) => e.slice(0, 10) >= decaler(jour, -2)) };
  const avant = next.jours[jour];
  const liste = composer(next, m, jour, avant);
  if (avant && JSON.stringify(avant) === JSON.stringify(liste)) return next;
  return { ...next, jours: { ...next.jours, [jour]: liste } };
}

export function cocher(d: ObjectifsData, id: string, now: number): ObjectifsData {
  const jour = journee(now);
  const l = d.jours[jour];
  if (!l) return d;
  return { ...d, jours: { ...d.jours, [jour]: l.map((o) => (o.id === id && !o.mesure ? { ...o, fait: !o.fait } : o)) } };
}

/** Compteur : nouveau total du jour (séances comprises). La part saisie à la main est ajustée. */
export function saisir(d: ObjectifsData, m: Mesures, id: string, total: number, now: number): ObjectifsData {
  const jour = journee(now);
  const l = d.jours[jour];
  if (!l || !Number.isFinite(total)) return d;
  return {
    ...d,
    jours: { ...d.jours, [jour]: l.map((o) => (o.id === id && o.mesure?.source === "saisie" ? { ...o, valeur: Math.max(0, Math.round(total) - repsSeance(o.mesure, m, jour)) } : o)) },
  };
}

/** Remplace un objectif du jour par un autre du même domaine (ou d'un autre s'il n'y en a plus). */
export function changer(d: ObjectifsData, m: Mesures, id: string, now: number): ObjectifsData {
  const jour = journee(now);
  const l = d.jours[jour];
  const ancien = l?.find((o) => o.id === id);
  if (!l || !ancien || ancien.fixe) return d;
  const tous = candidats(d, m, jour).filter((c) => !l.some((o) => o.id === c.id) && d.reglages.domaines.includes(c.domaine) && !d.reglages.toujours.includes(c.id));
  const meme = tous.filter((c) => c.domaine === ancien.domaine);
  const r = hasard(`${jour}|${id}|${l.length}`);
  const pool = meme.length ? meme : tous;
  if (!pool.length) return d;
  const nouveau = pool[Math.floor(r() * pool.length)];
  return { ...d, jours: { ...d.jours, [jour]: l.map((o) => (o.id === id ? { ...nouveau, fait: false, fixe: false, ...(nouveau.mesure?.source === "saisie" ? { valeur: 0 } : {}) } : o)) } };
}

/** Jours d'affilée (avant aujourd'hui, plus aujourd'hui si tout est déjà atteint) où tous les objectifs ont été atteints. */
export function serie(d: ObjectifsData, m: Mesures, now: number): number {
  const jour = journee(now);
  const tousAtteints = (j: string) => {
    const l = d.jours[j];
    return !!l?.length && l.every((o) => (o.resultat ?? avancement(o, m, j, j < jour).etat) === "atteint");
  };
  let n = tousAtteints(jour) ? 1 : 0;
  for (let i = 1; i <= GARDER_JOURS; i++) {
    if (!tousAtteints(decaler(jour, -i))) break;
    n++;
  }
  return n;
}

const ID_OK = /^[a-z0-9][a-z0-9-]{0,40}$/;

function nettoyerPerso(raw: unknown): ObjectifPerso | null {
  const p = raw as Partial<ObjectifPerso>;
  if (!p || typeof p.id !== "string" || !ID_OK.test(p.id) || typeof p.titre !== "string" || !p.titre.trim() || !DOMAINES.includes(p.domaine as Domaine)) return null;
  const out: ObjectifPerso = { id: p.id, domaine: p.domaine as Domaine, titre: p.titre.trim().slice(0, 120), detail: typeof p.detail === "string" ? p.detail.slice(0, 300) : "" };
  const c = p.compteur;
  if (c && typeof c === "object") {
    const cible = Number(c.cible), pas = Number(c.pas), bonus = c.bonus === undefined || c.bonus === null ? undefined : Number(c.bonus);
    if (!(cible > 0) || !(pas > 0)) return null;
    out.compteur = { unite: typeof c.unite === "string" ? c.unite.trim().slice(0, 30) : "", cible: Math.round(cible), pas: Math.round(pas) || 1 };
    if (bonus !== undefined && bonus > cible) out.compteur.bonus = Math.round(bonus);
    if (Array.isArray(c.exercices)) out.compteur.exercices = c.exercices.filter((e): e is string => typeof e === "string").slice(0, 10);
  }
  return out;
}

export function reglerObjectifs(d: ObjectifsData, r: Partial<Reglages>): ObjectifsData {
  const domaines = Array.isArray(r.domaines) ? DOMAINES.filter((x) => r.domaines!.includes(x)) : d.reglages.domaines;
  const nombre = Number.isInteger(r.nombre) ? Math.max(1, Math.min(NOMBRE_MAX, r.nombre!)) : d.reglages.nombre;
  if (!domaines.length) throw new Error("Choisis au moins un domaine.");
  let perso = d.reglages.perso;
  if (Array.isArray(r.perso)) {
    perso = [];
    for (const x of r.perso) {
      const p = nettoyerPerso(x);
      if (!p) throw new Error("Objectif incomplet : titre, et pour un compteur une cible et un pas plus grands que 0.");
      if (!perso.some((y) => y.id === p.id)) perso.push(p);
    }
  }
  const ids = (v: unknown, avant: string[]) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && ID_OK.test(x)))] : avant);
  return { ...d, reglages: { domaines, nombre, perso, toujours: ids(r.toujours, d.reglages.toujours), masques: ids(r.masques, d.reglages.masques) } };
}

export function nettoyerObjectifs(raw: unknown): ObjectifsData {
  const r = (raw ?? {}) as Partial<ObjectifsData>;
  const jours: Record<string, ObjectifJour[]> = {};
  if (r.jours && typeof r.jours === "object") {
    for (const [j, l] of Object.entries(r.jours)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(j) || !Array.isArray(l)) continue;
      jours[j] = l.filter((o) => o && typeof o.id === "string" && typeof o.titre === "string" && DOMAINES.includes(o.domaine)).map((o) => ({ ...o, fait: !!o.fait }));
    }
  }
  // Anciennes données (3 objectifs, sans objectifs perso) : passage aux réglages de départ, domaines gardés.
  const reg = (r.reglages ?? {}) as Partial<Reglages>;
  const ancien = !Array.isArray(reg.perso);
  const voulu: Partial<Reglages> = ancien ? { ...REGLAGES_DEPART, domaines: reg.domaines ?? REGLAGES_DEPART.domaines } : reg;
  let base: ObjectifsData = { jours, envoyes: Array.isArray(r.envoyes) ? r.envoyes.filter((x) => typeof x === "string") : [], reglages: { ...REGLAGES_DEPART } };
  try { base = reglerObjectifs(base, voulu); } catch { /* réglages par défaut */ }
  return base;
}

/** Notification du matin (à partir de 8 h) et du soir (heure du rappel), une fois par jour chacune. */
/** `sansMatin` : la liste du matin part déjà avec le rappel d'après Fajr (bilan du matin). */
export function notificationsDues(d: ObjectifsData, m: Mesures, now: number, soirH: number, soirM: number, sansMatin = false): { data: ObjectifsData; messages: { titre: string; corps: string }[] } {
  const jour = journee(now);
  const l = d.jours[jour] ?? [];
  const messages: { titre: string; corps: string }[] = [];
  const envoyes = new Set(d.envoyes);
  const h = new Date(now);
  const minutes = h.getHours() * 60 + h.getMinutes();
  if (l.length && minutes >= 8 * 60 && minutes < 12 * 60 && !envoyes.has(`${jour}|matin`)) {
    envoyes.add(`${jour}|matin`);
    if (!sansMatin) messages.push({ titre: "Tes objectifs du jour", corps: l.map((o) => `• ${o.titre}`).join("\n") });
  }
  const soir = soirH * 60 + soirM;
  if (l.length && minutes >= soir && minutes < soir + 180 && !envoyes.has(`${jour}|soir`)) {
    envoyes.add(`${jour}|soir`);
    const restants = l.filter((o) => avancement(o, m, jour, false).etat === "en-cours" && !(o.mesure?.sens === "max"));
    if (restants.length) messages.push({ titre: `Encore ${restants.length} objectif${restants.length > 1 ? "s" : ""} aujourd'hui`, corps: restants.map((o) => `• ${o.titre}${o.mesure?.source === "saisie" ? ` (${avancement(o, m, jour, false).texte.split(" · ")[0]})` : ""}`).join("\n") });
  }
  return { data: messages.length || envoyes.size !== d.envoyes.length ? { ...d, envoyes: [...envoyes] } : d, messages };
}
