// Objectifs du jour : chaque jour, quelques petits objectifs faciles, choisis dans des domaines différents
// (foi, études, écran, santé) et adaptés à ce que Rayan fait vraiment.
//   - Mesurés automatiquement quand une app le sait : cartes révisées (Révision), temps de travail (Chrono),
//     temps de jeu et heure de la dernière activité (résumé de Rayan's Journal).
//   - Sinon à cocher (prières, eau, marche…).
// Cible : un peu au-dessus de la moyenne (médiane) des 7 derniers jours ; plus facile après un objectif raté.
// Les objectifs d'une journée sont choisis une fois et gardés : ils ne changent pas en cours de journée.
// Fonctions pures : l'heure, les mesures et les données sont passées en paramètre.

import { dayStart } from "./counts.ts";

export type Domaine = "foi" | "etudes" | "ecran" | "sante";
export const DOMAINES: Domaine[] = ["foi", "etudes", "ecran", "sante"];
export const NOMS_DOMAINES: Record<Domaine, string> = { foi: "Prière et Coran", etudes: "Études", ecran: "Écran", sante: "Santé" };

/** Mesure automatique : « au moins » (cartes, minutes de travail) ou « au plus » (jeux, heure de coucher). */
export interface Mesure {
  source: "revision" | "chrono" | "jeux" | "coucher";
  sens: "min" | "max";
  /** Cartes, minutes, ou minutes depuis minuit pour le coucher (après minuit : 24 h + …, ex. 0 h 30 = 1470). */
  cible: number;
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
  /** Résultat définitif, une fois la journée passée. */
  resultat?: "atteint" | "manque";
}

export interface ObjectifsData {
  /** « AAAA-MM-JJ » (journée de 4 h à 4 h) → objectifs. Gardé 60 jours. */
  jours: Record<string, ObjectifJour[]>;
  /** Notifications déjà envoyées (« jour|matin », « jour|soir »). */
  envoyes: string[];
  reglages: { domaines: Domaine[]; nombre: number };
}

export const OBJECTIFS_VIDES: ObjectifsData = { jours: {}, envoyes: [], reglages: { domaines: [...DOMAINES], nombre: 3 } };

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

// ----- Modèles à cocher -----------------------------------------------------------------------------

interface Modele { id: string; domaine: Domaine; normal: string; facile: string; detail: string; si?: (m: Mesures) => boolean }

const MODELES: Modele[] = [
  { id: "prieres", domaine: "foi", normal: "Faire les 5 prières", facile: "Faire au moins 3 prières à l'heure", detail: "À cocher le soir." },
  { id: "fajr", domaine: "foi", normal: "Prier Fajr à l'heure", facile: "Prier Fajr, même un peu en retard", detail: "Rayan's Prière te rappelle l'heure." },
  { id: "coran", domaine: "foi", normal: "Lire une page de Coran", facile: "Lire 5 versets de Coran", detail: "Le moment que tu veux." },
  { id: "adhkar", domaine: "foi", normal: "Dire les adhkar du matin et du soir", facile: "Dire les adhkar du matin", detail: "Quelques minutes." },
  { id: "hifz", domaine: "foi", normal: "Réciter 1 portion dans Rayan's Hifz", facile: "Réciter 1 portion dans Rayan's Hifz", detail: "Des portions t'attendent.", si: (m) => (m.hifzRestantes ?? 0) > 0 },
  { id: "relire-cours", domaine: "etudes", normal: "Relire le cours du jour (10 min)", facile: "Relire tes notes du jour (5 min)", detail: "Juste relire, sans pression." },
  { id: "preparer", domaine: "etudes", normal: "Préparer tes affaires de cours pour demain", facile: "Regarder ton emploi du temps de demain", detail: "Le soir." },
  { id: "ouvertures", domaine: "etudes", normal: "Rejouer 3 positions dans Rayan's Ouvertures", facile: "Rejouer 1 position dans Rayan's Ouvertures", detail: "Des positions t'attendent.", si: (m) => (m.ouverturesRestantes ?? 0) > 0 },
  { id: "pause-ecran", domaine: "ecran", normal: "30 minutes sans écran", facile: "15 minutes sans écran", detail: "Marche, lecture, discussion…" },
  { id: "repas", domaine: "ecran", normal: "Pas de téléphone pendant les repas", facile: "Un repas sans téléphone", detail: "" },
  { id: "tel-soir", domaine: "ecran", normal: "Poser le téléphone 30 min avant de dormir", facile: "Poser le téléphone 10 min avant de dormir", detail: "" },
  { id: "eau", domaine: "sante", normal: "Boire 1,5 L d'eau", facile: "Boire 4 verres d'eau", detail: "Une bouteille près de toi aide." },
  { id: "marche", domaine: "sante", normal: "Marcher 15 minutes", facile: "Marcher 10 minutes", detail: "Dehors si possible." },
  { id: "bureau", domaine: "sante", normal: "Ranger ton bureau 5 minutes", facile: "Ranger 3 choses sur ton bureau", detail: "" },
  { id: "lit", domaine: "sante", normal: "Faire ton lit", facile: "Faire ton lit", detail: "Le matin." },
  { id: "fruit", domaine: "sante", normal: "Manger un fruit", facile: "Manger un fruit", detail: "" },
  { id: "etirements", domaine: "sante", normal: "5 minutes d'étirements", facile: "2 minutes d'étirements", detail: "" },
];

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

/** Tous les objectifs possibles pour `jour`, avec leurs cibles adaptées. */
export function candidats(d: ObjectifsData, m: Mesures, jour: string): Objectif[] {
  const out: Objectif[] = [];
  const rate = (id: string) => dernierResultat(d, id, jour) === false;

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
  for (const x of MODELES) {
    if (x.si && !x.si(m)) continue;
    if (x.id === "adhkar" && m.sansAdhkar) continue;
    const facile = rate(x.id);
    out.push({ id: x.id, domaine: x.domaine, titre: facile ? x.facile : x.normal, detail: x.detail, mesure: null, facile });
  }
  return out;
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

/** Choisit les objectifs de `jour` : domaines différents tant que possible, en tournant d'un jour à l'autre. */
export function choisir(d: ObjectifsData, m: Mesures, jour: string, exclus: string[] = []): Objectif[] {
  const r = hasard(jour + exclus.join(","));
  const domaines = d.reglages.domaines.length ? d.reglages.domaines : DOMAINES;
  const tous = candidats(d, m, jour).filter((c) => domaines.includes(c.domaine) && !exclus.includes(c.id));
  const nombre = Math.max(1, Math.min(5, d.reglages.nombre));
  // Ordre des domaines : décalé chaque jour pour que celui laissé de côté change.
  const [a, mo, j] = jour.split("-").map(Number);
  const n = Math.floor(new Date(a, mo - 1, j).getTime() / 86_400_000);
  const ordre = domaines.map((_, i) => domaines[(i + n) % domaines.length]);
  const choisis: Objectif[] = [];
  // Poids : pas le même qu'hier, plutôt ce qui réussit (facile), un peu plus les objectifs mesurés, et du hasard.
  const poids = new Map(tous.map((c) => [c.id, (proposeHier(d, c.id, jour) ? 0.15 : 1) * (0.5 + tauxReussite(d, c.id, jour)) * (c.mesure ? 1.3 : 1) * (0.5 + r())]));
  for (let tour = 0; choisis.length < nombre && tour < 5; tour++) {
    for (const dom of ordre) {
      if (choisis.length >= nombre) break;
      const libres = tous.filter((c) => c.domaine === dom && !choisis.some((x) => x.id === c.id));
      if (!libres.length || (tour === 0 && choisis.some((x) => x.domaine === dom))) continue;
      libres.sort((x, y) => poids.get(y.id)! - poids.get(x.id)!);
      choisis.push(libres[0]);
    }
  }
  return choisis;
}

// ----- Avancement -----------------------------------------------------------------------------------

export interface Avancement {
  /** Valeur actuelle (cartes, minutes, ou minutes depuis minuit) ; null pour un objectif à cocher. */
  valeur: number | null;
  etat: "atteint" | "en-cours" | "manque";
  texte: string;
}

function valeur(m: Mesures, s: Mesure["source"], jour: string): number | undefined {
  if (s === "revision") return m.revisionCartes?.[jour] ?? 0;
  if (s === "chrono") return m.chronoMin?.[jour] ?? 0;
  if (s === "jeux") return m.jeuxMin?.[jour];
  return m.coucherMin?.[jour];
}

/** Où en est un objectif. `finie` : la journée est passée, le résultat est définitif. */
export function avancement(o: ObjectifJour, m: Mesures, jour: string, finie: boolean): Avancement {
  if (!o.mesure) return { valeur: null, etat: o.fait ? "atteint" : finie ? "manque" : "en-cours", texte: o.fait ? "Fait" : "À cocher" };
  const v = valeur(m, o.mesure.source, jour);
  const c = o.mesure.cible;
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
    jours[j] = j < jour ? l.map((o) => (o.resultat ? o : { ...o, resultat: avancement(o, m, j, true).etat === "atteint" ? "atteint" : "manque" })) : l;
  }
  let next: ObjectifsData = { ...d, jours, envoyes: d.envoyes.filter((e) => e.slice(0, 10) >= decaler(jour, -2)) };
  if (!next.jours[jour]) next = { ...next, jours: { ...next.jours, [jour]: choisir(next, m, jour).map((o) => ({ ...o, fait: false })) } };
  return next;
}

export function cocher(d: ObjectifsData, id: string, now: number): ObjectifsData {
  const jour = journee(now);
  const l = d.jours[jour];
  if (!l) return d;
  return { ...d, jours: { ...d.jours, [jour]: l.map((o) => (o.id === id && !o.mesure ? { ...o, fait: !o.fait } : o)) } };
}

/** Remplace un objectif du jour par un autre du même domaine (ou d'un autre s'il n'y en a plus). */
export function changer(d: ObjectifsData, m: Mesures, id: string, now: number): ObjectifsData {
  const jour = journee(now);
  const l = d.jours[jour];
  const ancien = l?.find((o) => o.id === id);
  if (!l || !ancien) return d;
  const tous = candidats(d, m, jour).filter((c) => !l.some((o) => o.id === c.id) && d.reglages.domaines.includes(c.domaine));
  const meme = tous.filter((c) => c.domaine === ancien.domaine);
  const r = hasard(`${jour}|${id}|${l.length}`);
  const pool = meme.length ? meme : tous;
  if (!pool.length) return d;
  const nouveau = pool[Math.floor(r() * pool.length)];
  return { ...d, jours: { ...d.jours, [jour]: l.map((o) => (o.id === id ? { ...nouveau, fait: false } : o)) } };
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

export function reglerObjectifs(d: ObjectifsData, r: Partial<ObjectifsData["reglages"]>): ObjectifsData {
  const domaines = Array.isArray(r.domaines) ? DOMAINES.filter((x) => r.domaines!.includes(x)) : d.reglages.domaines;
  const nombre = Number.isInteger(r.nombre) ? Math.max(1, Math.min(5, r.nombre!)) : d.reglages.nombre;
  if (!domaines.length) throw new Error("Choisis au moins un domaine.");
  return { ...d, reglages: { domaines, nombre } };
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
  const reg = r.reglages ?? OBJECTIFS_VIDES.reglages;
  let base: ObjectifsData = { jours, envoyes: Array.isArray(r.envoyes) ? r.envoyes.filter((x) => typeof x === "string") : [], reglages: { ...OBJECTIFS_VIDES.reglages } };
  try { base = reglerObjectifs(base, reg); } catch { /* réglages par défaut */ }
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
    if (restants.length) messages.push({ titre: `Encore ${restants.length} objectif${restants.length > 1 ? "s" : ""} aujourd'hui`, corps: restants.map((o) => `• ${o.titre}`).join("\n") });
  }
  return { data: messages.length || envoyes.size !== d.envoyes.length ? { ...d, envoyes: [...envoyes] } : d, messages };
}
