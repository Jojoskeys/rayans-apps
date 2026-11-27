// Séance du jour (5 minutes : 10 questions), niveau qui s'adapte, réponses, import de l'actualité, statistiques.
import { lireActu, questionsDepuisEdition, empreinte, type EditionActu } from "./actu.ts";
import { apresReponse, cartesDues, estApprise } from "./espacement.ts";
import { dayKey, joursEntre, NIVEAU_MAX, NIVEAU_MIN, type Carte, type Db, type Niveau, type SeanceJour } from "./model.ts";
import { BANQUE, questionBanque, type Question, type Theme } from "./questions.ts";
import { makeRng, newId, shuffle } from "./rng.ts";

// ----- Niveau : 2 bonnes réponses d'affilée → plus dur, 1 erreur → plus facile (règle de Levitt, 1971) -----------
export function niveauSuivant(n: Niveau, juste: boolean, now: number): Niveau {
  if (!juste) return { ...n, level: Math.max(NIVEAU_MIN, n.level - 1), streak: 0, maj: now };
  if (n.streak + 1 >= 2) {
    const level = Math.min(NIVEAU_MAX, n.level + 1);
    return { level, streak: 0, best: Math.max(n.best, level), maj: now };
  }
  return { ...n, streak: n.streak + 1, maj: now };
}

export const NOMS_NIVEAUX = ["", "Facile", "Moyen", "Difficile"];

/** Les réponses proposées, mélangées (autrement à chaque passage). Au niveau 1, une mauvaise réponse de moins. */
export function choixAffiches(q: Question, niveau: number, passage: number): { choix: string[]; bonne: number } {
  if (q.vf) return { choix: q.choix, bonne: q.bonne };
  const rng = makeRng(empreinte(`${q.id}|${passage}`));
  let fausses = q.choix.map((c, i) => ({ c, i })).filter((x) => x.i !== q.bonne);
  if (niveau <= 1 && fausses.length >= 3) fausses = shuffle(rng, fausses).slice(0, fausses.length - 1);
  const tous = shuffle(rng, [{ c: q.choix[q.bonne], i: q.bonne }, ...fausses]);
  return { choix: tous.map((x) => x.c), bonne: tous.findIndex((x) => x.i === q.bonne) };
}

// ----- Questions et cartes -------------------------------------------------------------------------------------
export function questionDe(db: Db, id: string): Question | undefined {
  return db.cartes.find((c) => c.id === id)?.q ?? questionBanque(id);
}

/** Questions d'actu encore « fraîches » pour être proposées comme nouvelles (au-delà, elles ne sont plus d'actualité). */
export const FRAICHEUR_ACTU_JOURS = 10;

/** Transforme les éditions pas encore vues en questions (cartes nouvelles). Renvoie `db` tel quel si rien de neuf. */
export function importerActu(db: Db, editions: EditionActu[], now: number): { db: Db; ajoutees: number; jours: string[] } {
  const aujourdhui = dayKey(now, db.reglages.heureJour);
  const neuves = editions.filter((e) => !db.actuJours.includes(e.jour) && joursEntre(e.jour, aujourdhui) <= FRAICHEUR_ACTU_JOURS && joursEntre(e.jour, aujourdhui) >= -1);
  if (!neuves.length) return { db, ajoutees: 0, jours: [] };
  const ids = new Set(db.cartes.map((c) => c.id));
  const cartes: Carte[] = [];
  const jours: string[] = [];
  for (const e of neuves) {
    const qs = questionsDepuisEdition(e);
    if (!qs.length) continue;
    jours.push(e.jour);
    for (const q of qs) if (!ids.has(q.id)) { ids.add(q.id); cartes.push({ id: q.id, q, jour: e.jour, etape: 0, due: null, vues: 0, justes: 0, ajoutee: now, maj: now }); }
  }
  if (!jours.length) return { db, ajoutees: 0, jours: [] };
  return { db: { ...db, cartes: [...db.cartes, ...cartes], actuJours: [...db.actuJours, ...jours].sort() }, ajoutees: cartes.length, jours };
}

/** Lit un fichier d'actu et l'importe (raccourci pour l'interface et les tests). */
export function importerActuTexte(db: Db, text: string, now: number) {
  return importerActu(db, lireActu(text), now);
}

/** Classe les questions nouvelles par proximité avec le niveau : d'abord le niveau actuel, puis plus facile, puis plus dur. */
function parNiveau<T extends { difficulte: number }>(xs: T[], niveau: number): T[] {
  const rang = (d: number) => (d === niveau ? 0 : d < niveau ? 1 + (niveau - d) : 10 + (d - niveau));
  return [...xs].sort((a, b) => rang(a.difficulte) - rang(b.difficulte));
}

/** Compose une série de questions : révisions dues d'abord (pas toutes si elles sont trop nombreuses, pour garder
 *  un peu de nouveau), puis l'actu récente, puis la banque. `exclure` : ids déjà pris (séance bonus). */
export function composer(db: Db, now: number, n: number, graine: string, exclure: Set<string> = new Set()): string[] {
  const rng = makeRng(empreinte(graine));
  const niveau = db.niveau.level;
  const pris: string[] = [];
  const prendre = (id: string) => { if (!exclure.has(id) && !pris.includes(id) && questionDe(db, id)) pris.push(id); };
  const dues = cartesDues(db.cartes, now).map((c) => c.id).filter((id) => !exclure.has(id));
  const nouveau = Math.min(n, Math.max(2, Math.ceil(n * 0.3)));
  for (const id of dues.slice(0, n - nouveau)) prendre(id);
  // Actu récente pas encore vue, de la plus récente à la plus ancienne.
  const aujourdhui = dayKey(now, db.reglages.heureJour);
  const actu = db.cartes.filter((c) => c.vues === 0 && c.q && c.jour && joursEntre(c.jour, aujourdhui) <= FRAICHEUR_ACTU_JOURS && !exclure.has(c.id))
    .sort((a, b) => (b.jour ?? "").localeCompare(a.jour ?? ""));
  const jourRecent = actu[0]?.jour;
  const actuTriee = [...parNiveau(actu.filter((c) => c.jour === jourRecent).map((c) => c.q!), niveau), ...parNiveau(actu.filter((c) => c.jour !== jourRecent).map((c) => c.q!), niveau)];
  for (const q of actuTriee.slice(0, db.reglages.actuParSeance)) if (pris.length < n) prendre(q.id);
  // Banque : questions jamais vues, au niveau d'abord.
  const vues = new Set(db.cartes.map((c) => c.id));
  const neuves = parNiveau(shuffle(rng, BANQUE.filter((q) => !vues.has(q.id) && !exclure.has(q.id))), niveau);
  for (const q of neuves) { if (pris.length >= n) break; prendre(q.id); }
  // Banque épuisée : d'autres révisions dues, puis des questions déjà vues (les moins bien réussies).
  for (const id of dues) { if (pris.length >= n) break; prendre(id); }
  if (pris.length < n) {
    const deja = db.cartes.filter((c) => c.vues > 0 && !exclure.has(c.id)).sort((a, b) => a.justes / a.vues - b.justes / b.vues || (a.due ?? Infinity) - (b.due ?? Infinity));
    for (const c of deja) { if (pris.length >= n) break; prendre(c.id); }
  }
  return shuffle(rng, pris);
}

/** La séance du jour : celle déjà commencée, sinon une nouvelle (à enregistrer avec `avecSeance`). */
export function seanceDuJour(db: Db, now: number): { jour: string; seance: SeanceJour; nouvelle: boolean } {
  const jour = dayKey(now, db.reglages.heureJour);
  const s = db.seances[jour];
  if (s && s.ids.length) return { jour, seance: s, nouvelle: false };
  return { jour, seance: { ids: composer(db, now, db.reglages.questions, jour), faites: [] }, nouvelle: true };
}

export function avecSeance(db: Db, now: number): Db {
  const { jour, seance, nouvelle } = seanceDuJour(db, now);
  return nouvelle ? { ...db, seances: { ...db.seances, [jour]: seance } } : db;
}

/** Après l'arrivée de nouvelles questions d'actu : recompose la séance du jour si elle n'est pas commencée. */
export function rafraichirSeance(db: Db, now: number): Db {
  const jour = dayKey(now, db.reglages.heureJour);
  const s = db.seances[jour];
  if (s && s.faites.length) return db;
  const seances = { ...db.seances };
  delete seances[jour];
  return avecSeance({ ...db, seances }, now);
}

/** Enregistre une réponse : carte (révision espacée), niveau, historique et avancée de la séance du jour. */
export function repondre(db: Db, id: string, juste: boolean, now: number): Db {
  const h = db.reglages.heureJour;
  const existante = db.cartes.find((c) => c.id === id);
  if (!existante && !questionBanque(id)) return db;
  const base: Carte = existante ?? { id, etape: 0, due: null, vues: 0, justes: 0, ajoutee: now, maj: now };
  const carte = apresReponse(base, juste, now, h);
  const cartes = existante ? db.cartes.map((c) => (c.id === id ? carte : c)) : [...db.cartes, carte];
  const jour = dayKey(now, h);
  const s = db.seances[jour];
  let seances = db.seances;
  if (s && s.ids.includes(id) && !s.faites.includes(id)) {
    const faites = [...s.faites, id];
    const fini = s.ids.every((x) => faites.includes(x));
    seances = { ...db.seances, [jour]: { ...s, faites, ...(fini && s.fin === undefined ? { fin: now } : {}) } };
  }
  return {
    ...db,
    cartes,
    seances,
    niveau: niveauSuivant(db.niveau, juste, now),
    reponses: [...db.reponses, { id: newId(), carte: id, at: now, juste, niveau: db.niveau.level }],
  };
}

// ----- Statistiques -------------------------------------------------------------------------------------------
/** Jours de suite (jusqu'à aujourd'hui, ou hier si la séance du jour n'est pas encore faite) avec une séance finie. */
export function serie(db: Db, now: number): number {
  const h = db.reglages.heureJour;
  const finis = new Set(Object.entries(db.seances).filter(([, s]) => s.fin !== undefined).map(([k]) => k));
  let n = 0;
  let t = now;
  if (!finis.has(dayKey(t, h))) t -= 86400_000;
  while (finis.has(dayKey(t, h))) { n++; t -= 86400_000; }
  return n;
}

export interface Bilan {
  reponses: number;
  justes: number;
  /** Part de bonnes réponses sur les 7 derniers jours (null s'il n'y en a pas). */
  reussite7: number | null;
  enRevision: number;
  apprises: number;
  duesAujourdhui: number;
  banqueVue: number;
  actuVues: number;
  /** Réussite par jour, 14 derniers jours (du plus ancien au plus récent ; null = pas de réponse ce jour-là). */
  parJour: { jour: string; part: number | null; n: number }[];
  parTheme: { theme: Theme; n: number; justes: number }[];
  /** Révisions prévues dans les 7 prochains jours (aujourd'hui compris). */
  aVenir: number[];
}

export function bilan(db: Db, now: number): Bilan {
  const h = db.reglages.heureJour;
  const r7 = db.reponses.filter((r) => r.at > now - 7 * 86400_000);
  const parJour: Bilan["parJour"] = [];
  for (let k = 13; k >= 0; k--) {
    const jour = dayKey(now - k * 86400_000, h);
    const rs = db.reponses.filter((r) => dayKey(r.at, h) === jour);
    parJour.push({ jour, n: rs.length, part: rs.length ? rs.filter((r) => r.juste).length / rs.length : null });
  }
  const themes = new Map<Theme, { n: number; justes: number }>();
  for (const r of db.reponses) {
    const q = questionDe(db, r.carte);
    if (!q) continue;
    const t = themes.get(q.theme) ?? { n: 0, justes: 0 };
    t.n++;
    if (r.juste) t.justes++;
    themes.set(q.theme, t);
  }
  const vues = db.cartes.filter((c) => c.vues > 0);
  const aVenir = Array.from({ length: 7 }, (_, k) => vues.filter((c) => c.due !== null && dayKey(Math.max(c.due, now), h) === dayKey(now + k * 86400_000, h)).length);
  return {
    reponses: db.reponses.length,
    justes: db.reponses.filter((r) => r.juste).length,
    reussite7: r7.length ? r7.filter((r) => r.juste).length / r7.length : null,
    enRevision: vues.filter((c) => c.due !== null).length,
    apprises: vues.filter(estApprise).length,
    duesAujourdhui: cartesDues(db.cartes, now).length,
    banqueVue: vues.filter((c) => !c.q).length,
    actuVues: vues.filter((c) => c.q).length,
    parJour,
    parTheme: [...themes.entries()].map(([theme, v]) => ({ theme, ...v })).sort((a, b) => b.n - a.n),
    aVenir,
  };
}
