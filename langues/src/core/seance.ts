// Séance du jour et tirage des questions de chaque exercice (hasard reproductible via rng.ts).
import { FAMILLES_POINTS, forme, LETTRES, sansHarakat, type Forme, type Lettre } from "./arabe.ts";
import { SYLLABES_TONS } from "./contenu-zh.ts";
import { cartesDues, nouveauxAujourdhui } from "./espacement.ts";
import { mots, phrases, type Langue, type Mot, type Phrase } from "./langues.ts";
import { dayKey, joursEntre, lundiDe, type Db } from "./model.ts";
import { paramsDictee, paramsLettres, paramsOrdre, paramsTons } from "./niveaux.ts";
import { syllabes, tonDe, type Ton } from "./pinyin.ts";
import { makeRng, pick, sample, shuffle, type Rng } from "./rng.ts";

export type EtapeId = "revisions" | "nouveaux" | "production" | "oreille";
export interface Etape { id: EtapeId; titre: string; n: number; /** Pour la production : ordre ou dictée. */ sorte?: "ordre" | "dictee" }

/** Taille de chaque étape selon la durée choisie (10 min par défaut). */
export function taillesSeance(minutes: number) {
  const f = minutes / 10;
  return { revisions: Math.round(20 * f), nouveaux: Math.max(2, Math.round(8 * f)), production: Math.max(3, Math.round(5 * f)), oreille: Math.max(5, Math.round(10 * f)) };
}

/** Graine du jour : même séance si on la rouvre le même jour. */
export function graineDuJour(langue: Langue, jour: string): number {
  let h = langue === "zh" ? 7 : 13;
  for (const c of jour) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function planSeance(db: Db, langue: Langue, now: number): Etape[] {
  const t = taillesSeance(db.reglages.minutes);
  const jour = dayKey(now, db.reglages.heureJour);
  const dues = cartesDues(db.cartes, langue, now).length;
  const restants = Math.max(0, db.reglages.nouveauxParJour - nouveauxAujourdhui(db.cartes, langue, now, db.reglages.heureJour));
  const prod: "ordre" | "dictee" = joursEntre("2026-01-01", jour) % 2 === 0 ? "ordre" : "dictee";
  const etapes: Etape[] = [];
  etapes.push({ id: "revisions", titre: "Révisions du jour", n: Math.min(dues, t.revisions) });
  etapes.push({ id: "nouveaux", titre: "Nouveaux mots", n: Math.min(restants, t.nouveaux, motsNouveaux(db, langue).length) });
  etapes.push({ id: "production", titre: prod === "ordre" ? "Phrase dans l'ordre" : "Dictée", n: t.production, sorte: prod });
  etapes.push({ id: "oreille", titre: langue === "zh" ? "Tons à l'oreille" : "Lettres arabes", n: t.oreille });
  return etapes;
}

/** Mots jamais vus, dans l'ordre d'apprentissage de la liste. */
export function motsNouveaux(db: Db, langue: Langue): Mot[] {
  const vus = new Set(db.cartes.filter((c) => c.langue === langue).map((c) => c.mot));
  return mots(langue).filter((m) => !vus.has(m.id));
}

export function motsVus(db: Db, langue: Langue): Mot[] {
  const vus = new Set(db.cartes.filter((c) => c.langue === langue).map((c) => c.mot));
  return mots(langue).filter((m) => vus.has(m.id));
}

/** `n` mauvaises réponses plausibles : d'abord du même thème, jamais le même sens. */
export function leurres(rng: Rng, m: Mot, n: number): Mot[] {
  const autres = mots(m.langue).filter((x) => x.id !== m.id && x.fr !== m.fr && x.ecrit !== m.ecrit);
  const meme = shuffle(rng, autres.filter((x) => x.theme === m.theme));
  const reste = shuffle(rng, autres.filter((x) => x.theme !== m.theme));
  return [...meme, ...reste].slice(0, n);
}

export function choixPour(rng: Rng, m: Mot, nbChoix: number): Mot[] {
  return shuffle(rng, [m, ...leurres(rng, m, nbChoix - 1)]);
}

/** Phrases pour « remettre dans l'ordre » : assez courtes pour le niveau, au moins 2 mots différents. */
export function phrasesPourOrdre(rng: Rng, langue: Langue, niveau: number, n: number): Phrase[] {
  const { maxMots } = paramsOrdre(niveau);
  const ok = phrases(langue).filter((p) => p.mots.length >= 2 && p.mots.length <= maxMots && new Set(p.mots).size > 1);
  return sample(rng, ok, n);
}

/** Mélange les mots d'une phrase sans jamais rendre l'ordre juste tel quel. */
export function melanger(rng: Rng, items: string[]): string[] {
  if (new Set(items).size < 2) return items.slice();
  for (let i = 0; i < 20; i++) {
    const s = shuffle(rng, items);
    if (s.join("\u0001") !== items.join("\u0001")) return s;
  }
  return items.slice().reverse();
}

export interface ItemDictee { texte: string; lecture: string; fr: string; /** Écrit attendu (arabe : avec voyelles). */ ecrit: string }

export function itemsDictee(rng: Rng, langue: Langue, niveau: number, n: number, preferes: Mot[] = []): ItemDictee[] {
  const p = paramsDictee(niveau);
  if (p.phrases) {
    const ok = phrases(langue).filter((x) => x.mots.length <= Math.max(2, p.maxMots));
    return sample(rng, ok, n).map((x) => ({ texte: x.mots.join(langue === "zh" ? "" : " "), lecture: x.lecture, fr: x.fr, ecrit: x.mots.join(" ") }));
  }
  // Chinois : 1, 2 puis 3 syllabes au plus ; arabe : un seul mot de 3, 4 puis 5 lettres au plus.
  const court = (m: Mot) => (langue === "zh" ? syllabes(m.lecture).length <= p.maxSyllabes : !m.ecrit.includes(" ") && sansHarakat(m.ecrit).length <= 2 + p.maxSyllabes);
  const pref = preferes.filter(court);
  const pool = pref.length >= n ? sample(rng, pref, n) : [...pref, ...sample(rng, mots(langue).filter((m) => court(m) && !pref.includes(m)), n - pref.length)];
  return shuffle(rng, pool).map((m) => ({ texte: m.ecrit, lecture: m.lecture, fr: m.fr, ecrit: m.ecrit }));
}

export interface ItemTon { hz: string; py: string; ton: Ton; choix: Ton[] }

export function itemsTons(rng: Rng, niveau: number, n: number): ItemTon[] {
  const p = paramsTons(niveau);
  return sample(rng, SYLLABES_TONS, n).map((s) => {
    const ton = tonDe(s.py);
    let choix: Ton[] = [1, 2, 3, 4];
    if (p.choix === 2) choix = shuffle(rng, [ton, pick(rng, ([1, 2, 3, 4] as Ton[]).filter((t) => t !== ton))]).sort();
    return { hz: s.hz, py: s.py, ton, choix };
  });
}

export interface ItemLettre { lettre: Lettre; forme: Forme; affiche: string; choix: Lettre[] }

export function itemsLettres(rng: Rng, niveau: number, n: number): ItemLettre[] {
  const p = paramsLettres(niveau);
  const formes: Forme[] = p.formes ? ["isolee", "debut", "milieu", "fin"] : ["isolee"];
  return sample(rng, LETTRES, n).map((l) => {
    const f = pick(rng, formes);
    let pool = LETTRES.filter((x) => x.l !== l.l);
    if (p.proches) {
      const fam = FAMILLES_POINTS.find((g) => g.includes(l.l)) ?? [];
      const proches = shuffle(rng, pool.filter((x) => fam.includes(x.l)));
      pool = [...proches, ...shuffle(rng, pool.filter((x) => !fam.includes(x.l)))];
    } else pool = shuffle(rng, pool);
    return { lettre: l, forme: f, affiche: forme(l, f), choix: shuffle(rng, [l, ...pool.slice(0, p.choix - 1)]) };
  });
}

// ----- Tests de départ et de suivi : 20 mots + 5 phrases, graine fixe par semaine -----------------------------

export function graineSemaine(langue: Langue, lundi: string): number {
  return graineDuJour(langue, `semaine-${lundi}`);
}

/** 20 mots tirés parmi les mots déjà vus (complétés par les premiers mots de la liste au départ) et 5 phrases. */
export function tirageTest(db: Db, langue: Langue, now: number): { lundi: string; mots: Mot[]; phrases: Phrase[]; sorte: "depart" | "suivi" } {
  const lundi = lundiDe(dayKey(now, db.reglages.heureJour));
  const rng = makeRng(graineSemaine(langue, lundi));
  const vus = motsVus(db, langue);
  const sorte = db.tests.some((t) => t.langue === langue) ? "suivi" : "depart";
  let pool = vus;
  if (pool.length < 20) pool = [...vus, ...mots(langue).filter((m) => !vus.includes(m)).slice(0, 60)];
  const ph = phrases(langue).filter((p) => p.mots.length >= 3 && p.mots.length <= 5);
  return { lundi, mots: sample(rng, pool, 20), phrases: sample(rng, ph, 5), sorte };
}

export function testFaitCetteSemaine(db: Db, langue: Langue, now: number): boolean {
  const lundi = lundiDe(dayKey(now, db.reglages.heureJour));
  return db.tests.some((t) => t.langue === langue && t.semaine === lundi);
}
