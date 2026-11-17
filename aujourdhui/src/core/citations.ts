// Citations du jour : une le matin pour bien commencer, une à midi pour garder le cap.
// Hadiths du Prophète ﷺ avec leur référence, philosophes avec l'œuvre citée, et phrases sans auteur.
// Traductions et formulations en français faites pour l'application (sens fidèle, pas une traduction officielle).
// N'ajouter que des citations dont la source est sûre : beaucoup de citations célèbres sont mal attribuées.

import { todayISO } from "./counts.ts";

export type Genre = "hadith" | "sagesse" | "phrase";

export interface Citation {
  texte: string;
  /** Qui l'a dit (vide pour une phrase sans auteur). */
  auteur: string;
  /** Référence (recueil et numéro, œuvre et chapitre). */
  source: string;
  genre: Genre;
  /** Plutôt pour le matin, pour midi, ou les deux. */
  moment: "matin" | "midi" | "tous";
}

const P = "Le Prophète ﷺ";

export const CITATIONS: Citation[] = [
  // ----- Hadiths -----
  { genre: "hadith", moment: "matin", auteur: P, texte: "Ô Allah, bénis ma communauté dans ses matinées.", source: "Abû Dâwûd 2606, at-Tirmidhî 1212" },
  { genre: "hadith", moment: "matin", auteur: P, texte: "Les actes ne valent que par les intentions, et chacun n'aura que ce qu'il a eu l'intention de faire.", source: "al-Bukhârî 1, Muslim 1907" },
  { genre: "hadith", moment: "tous", auteur: P, texte: "Les actes les plus aimés d'Allah sont ceux qui sont réguliers, même s'ils sont peu nombreux.", source: "al-Bukhârî 6464, Muslim 783" },
  { genre: "hadith", moment: "matin", auteur: P, texte: "Attache-toi à ce qui t'est profitable, demande l'aide d'Allah, et ne baisse pas les bras.", source: "Muslim 2664" },
  { genre: "hadith", moment: "tous", auteur: P, texte: "Facilitez et ne rendez pas les choses difficiles ; annoncez la bonne nouvelle et ne faites pas fuir.", source: "al-Bukhârî 69, Muslim 1734" },
  { genre: "hadith", moment: "matin", auteur: P, texte: "Celui qui emprunte un chemin pour chercher une science, Allah lui facilite par lui un chemin vers le Paradis.", source: "Muslim 2699" },
  { genre: "hadith", moment: "midi", auteur: P, texte: "Ton sourire envers ton frère est une aumône.", source: "at-Tirmidhî 1956" },
  { genre: "hadith", moment: "midi", auteur: P, texte: "Aucun de vous n'a vraiment la foi tant qu'il n'aime pas pour son frère ce qu'il aime pour lui-même.", source: "al-Bukhârî 13, Muslim 45" },
  { genre: "hadith", moment: "matin", auteur: P, texte: "Profite de cinq choses avant cinq autres : ta jeunesse avant ta vieillesse, ta santé avant ta maladie, ta richesse avant ta pauvreté, ton temps libre avant tes occupations, et ta vie avant ta mort.", source: "al-Hâkim, al-Mustadrak (authentifié par al-Albânî)" },
  { genre: "hadith", moment: "midi", auteur: P, texte: "Le fort n'est pas celui qui terrasse les autres, mais celui qui se maîtrise quand il est en colère.", source: "al-Bukhârî 6114, Muslim 2609" },
  { genre: "hadith", moment: "midi", auteur: P, texte: "Que celui qui croit en Allah et au Jour dernier dise du bien ou se taise.", source: "al-Bukhârî 6018, Muslim 47" },
  { genre: "hadith", moment: "tous", auteur: P, texte: "Deux bienfaits dont beaucoup de gens sont lésés : la santé et le temps libre.", source: "al-Bukhârî 6412" },
  { genre: "hadith", moment: "midi", auteur: P, texte: "Allah est doux et Il aime la douceur en toute chose.", source: "al-Bukhârî 6927" },
  { genre: "hadith", moment: "matin", auteur: P, texte: "Le meilleur d'entre vous est celui qui apprend le Coran et l'enseigne.", source: "al-Bukhârî 5027" },
  { genre: "hadith", moment: "midi", auteur: P, texte: "Ne méprise aucune bonne action, même accueillir ton frère avec un visage souriant.", source: "Muslim 2626" },
  { genre: "hadith", moment: "midi", auteur: P, texte: "Parmi les signes d'un bon islam, il y a le fait de délaisser ce qui ne nous regarde pas.", source: "at-Tirmidhî 2317" },
  { genre: "hadith", moment: "matin", auteur: P, texte: "Attache ta chamelle, puis place ta confiance en Allah.", source: "at-Tirmidhî 2517" },
  { genre: "hadith", moment: "tous", auteur: P, texte: "Si l'Heure arrive et que l'un de vous tient une jeune pousse de palmier, qu'il la plante s'il le peut.", source: "Ahmad ; al-Bukhârî, al-Adab al-Mufrad 479" },
  { genre: "hadith", moment: "midi", auteur: P, texte: "Aucune fatigue, aucune maladie, aucun souci, aucune tristesse n'atteint le musulman, pas même une épine qui le pique, sans qu'Allah n'efface par là une part de ses péchés.", source: "al-Bukhârî 5641, Muslim 2573" },
  { genre: "hadith", moment: "tous", auteur: P, texte: "Sois dans ce monde comme un étranger ou un voyageur de passage.", source: "al-Bukhârî 6416" },

  // ----- Savants et philosophes -----
  { genre: "sagesse", moment: "matin", auteur: "al-Hasan al-Basrî", texte: "Ô fils d'Adam, tu n'es qu'un ensemble de jours : chaque fois qu'un jour s'en va, une partie de toi s'en va.", source: "rapporté par Abû Nu'aym, Hilyat al-Awliyâ'" },
  { genre: "sagesse", moment: "midi", auteur: "Ibn al-Qayyim", texte: "Perdre son temps est pire que la mort : la mort te coupe de ce monde, la perte de temps te coupe d'Allah et de l'au-delà.", source: "al-Fawâ'id" },
  { genre: "sagesse", moment: "matin", auteur: "Sénèque", texte: "Hâte-toi de bien vivre, et pense que chaque jour est à lui seul une vie.", source: "Lettres à Lucilius, 101" },
  { genre: "sagesse", moment: "matin", auteur: "Sénèque", texte: "Pendant qu'on la remet à plus tard, la vie passe.", source: "Lettres à Lucilius, 1" },
  { genre: "sagesse", moment: "tous", auteur: "Sénèque", texte: "Ce n'est pas parce que les choses sont difficiles que nous n'osons pas, c'est parce que nous n'osons pas qu'elles sont difficiles.", source: "Lettres à Lucilius, 104" },
  { genre: "sagesse", moment: "matin", auteur: "Marc Aurèle", texte: "Le matin, quand tu as du mal à te lever, dis-toi : je m'éveille pour faire œuvre d'homme.", source: "Pensées, V, 1" },
  { genre: "sagesse", moment: "midi", auteur: "Marc Aurèle", texte: "Ne perds plus de temps à discuter de ce qu'est un homme de bien : sois-en un.", source: "Pensées, X, 16" },
  { genre: "sagesse", moment: "midi", auteur: "Marc Aurèle", texte: "La meilleure façon de se venger, c'est de ne pas ressembler à celui qui t'a fait du tort.", source: "Pensées, VI, 6" },
  { genre: "sagesse", moment: "midi", auteur: "Épictète", texte: "Ce qui trouble les hommes, ce ne sont pas les choses, mais les jugements qu'ils portent sur les choses.", source: "Manuel, 5" },
  { genre: "sagesse", moment: "tous", auteur: "Épictète", texte: "Il y a ce qui dépend de nous et ce qui ne dépend pas de nous : occupe-toi du premier.", source: "Manuel, 1" },
  { genre: "sagesse", moment: "matin", auteur: "Lao Tseu", texte: "Un voyage de mille lieues commence par un premier pas.", source: "Tao Te King, 64" },
  { genre: "sagesse", moment: "midi", auteur: "Confucius", texte: "L'homme de bien exige tout de lui-même ; l'homme de peu exige tout des autres.", source: "Entretiens, XV, 21" },
  { genre: "sagesse", moment: "tous", auteur: "Aristote", texte: "Une hirondelle ne fait pas le printemps, ni un seul jour : il en va de même du bonheur.", source: "Éthique à Nicomaque, I, 7" },
  { genre: "sagesse", moment: "matin", auteur: "Descartes", texte: "Ce n'est pas assez d'avoir l'esprit bon, le principal est de l'appliquer bien.", source: "Discours de la méthode, I" },
  { genre: "sagesse", moment: "midi", auteur: "Voltaire", texte: "Il faut cultiver notre jardin.", source: "Candide, XXX" },

  // ----- Phrases pour bien démarrer et tenir le cap -----
  { genre: "phrase", moment: "matin", auteur: "", source: "", texte: "Un petit pas aujourd'hui vaut mieux qu'un grand plan pour demain." },
  { genre: "phrase", moment: "matin", auteur: "", source: "", texte: "Tu n'as pas besoin d'une journée parfaite, juste d'une journée où tu avances un peu." },
  { genre: "phrase", moment: "matin", auteur: "", source: "", texte: "Commence par la chose la plus simple : l'élan viendra en marchant." },
  { genre: "phrase", moment: "matin", auteur: "", source: "", texte: "Aujourd'hui est une page blanche. Écris-y quelque chose dont tu seras fier ce soir." },
  { genre: "phrase", moment: "matin", auteur: "", source: "", texte: "La discipline, c'est choisir ce que tu veux le plus plutôt que ce que tu veux maintenant." },
  { genre: "phrase", moment: "matin", auteur: "", source: "", texte: "Ce que tu répètes chaque jour finit par devenir qui tu es." },
  { genre: "phrase", moment: "midi", auteur: "", source: "", texte: "La moitié de la journée est passée : l'autre moitié t'appartient encore." },
  { genre: "phrase", moment: "midi", auteur: "", source: "", texte: "Si la matinée n'a pas été comme prévu, l'après-midi peut tout changer." },
  { genre: "phrase", moment: "midi", auteur: "", source: "", texte: "Respire, bois un verre d'eau, et reprends là où tu t'es arrêté." },
  { genre: "phrase", moment: "midi", auteur: "", source: "", texte: "Avancer lentement, c'est toujours avancer." },
  { genre: "phrase", moment: "midi", auteur: "", source: "", texte: "Ne compare pas ton chapitre 1 au chapitre 20 de quelqu'un d'autre." },
  { genre: "phrase", moment: "midi", auteur: "", source: "", texte: "Fais aujourd'hui ce que ton toi de demain te remerciera d'avoir fait." },
  { genre: "phrase", moment: "tous", auteur: "", source: "", texte: "La constance bat le talent quand le talent n'est pas constant." },
  { genre: "phrase", moment: "tous", auteur: "", source: "", texte: "Sois patient : les graines ne poussent pas le jour où on les plante." },
];

/** Petit générateur pseudo-aléatoire déterministe. */
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

/** Ordre des citations pour un cycle (mélange stable) : rien ne revient avant que tout soit passé. */
function ordre(pool: Citation[], cycle: number): Citation[] {
  const r = hasard(`cycle-${cycle}`);
  const l = [...pool];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

const numeroJour = (jour: string) => {
  const [a, m, j] = jour.split("-").map(Number);
  return Math.round(Date.UTC(a, m - 1, j) / 86_400_000);
};

/** Citations du matin et de midi pour ce jour : toujours les mêmes ce jour-là, et un hadith au moins un jour sur deux le matin. */
export function citationsDuJour(jour: string, genres: Genre[] = ["hadith", "sagesse", "phrase"]): { matin: Citation; midi: Citation } {
  const pool = CITATIONS.filter((c) => genres.includes(c.genre));
  const liste = pool.length ? pool : CITATIONS;
  const n = numeroJour(jour);
  const pour = (moment: "matin" | "midi") => liste.filter((c) => c.moment === moment || c.moment === "tous");
  const choisir = (moment: "matin" | "midi", decalage: number) => {
    const l = pour(moment);
    const cycle = Math.floor(n / l.length);
    return ordre(l, cycle * 2 + decalage)[n % l.length];
  };
  const matin = choisir("matin", 0);
  let midi = choisir("midi", 1);
  if (midi.texte === matin.texte) midi = pour("midi")[(pour("midi").indexOf(midi) + 1) % pour("midi").length];
  return { matin, midi };
}

export function formater(c: Citation): string {
  return c.auteur ? `« ${c.texte} »\n— ${c.auteur}${c.source ? ` (${c.source})` : ""}` : c.texte;
}

export const citationsDAujourdhui = (now: number, genres?: Genre[]) => citationsDuJour(todayISO(now), genres);
