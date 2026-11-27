// Fiches, quiz « vrai ou faux » et sources. Textes courts écrits pour l'app, à partir des études citées.
// ✅ prouvé (ok) · ⚠️ discuté ou prouvé en partie (discute) · ❌ mythe (mythe).

export interface Source { id: string; texte: string; lien?: string }

/** Liens vérifiés (ils mènent bien à l'article cité). */
export const SOURCES: Source[] = [
  { id: "roediger2006", texte: "Roediger & Karpicke (2006). Test-enhanced learning: taking memory tests improves long-term retention. Psychological Science.", lien: "https://doi.org/10.1111/j.1467-9280.2006.01693.x" },
  { id: "rowland2014", texte: "Rowland (2014). The effect of testing versus restudy on retention: a meta-analytic review. Psychological Bulletin.", lien: "https://doi.org/10.1037/a0037559" },
  { id: "dunlosky2013", texte: "Dunlosky, Rawson, Marsh, Nathan & Willingham (2013). Improving students' learning with effective learning techniques. Psychological Science in the Public Interest.", lien: "https://doi.org/10.1177/1529100612453266" },
  { id: "cepeda2006", texte: "Cepeda, Pashler, Vul, Wixted & Rohrer (2006). Distributed practice in verbal recall tasks: a review and quantitative synthesis. Psychological Bulletin.", lien: "https://doi.org/10.1037/0033-2909.132.3.354" },
  { id: "cepeda2008", texte: "Cepeda, Vul, Rohrer, Wixted & Pashler (2008). Spacing effects in learning: a temporal ridgeline of optimal retention. Psychological Science.", lien: "https://doi.org/10.1111/j.1467-9280.2008.02209.x" },
  { id: "murre2015", texte: "Murre & Dros (2015). Replication and analysis of Ebbinghaus' forgetting curve. PLOS ONE.", lien: "https://doi.org/10.1371/journal.pone.0120644" },
  { id: "butler2008", texte: "Butler, Karpicke & Roediger (2008). Correcting a metacognitive error: feedback increases retention of low-confidence correct responses. JEP: Learning, Memory, and Cognition.", lien: "https://doi.org/10.1037/0278-7393.34.4.918" },
  { id: "hasher1977", texte: "Hasher, Goldstein & Toppino (1977). Frequency and the conference of referential validity (l'effet de vérité illusoire). Journal of Verbal Learning and Verbal Behavior.", lien: "https://doi.org/10.1016/S0022-5371(77)80012-1" },
  { id: "fazio2015", texte: "Fazio, Brashier, Payne & Marsh (2015). Knowledge does not protect against illusory truth. Journal of Experimental Psychology: General.", lien: "https://doi.org/10.1037/xge0000098" },
  { id: "soroka2019", texte: "Soroka, Fournier & Nir (2019). Cross-national evidence of a negativity bias in psychophysiological reactions to news. PNAS.", lien: "https://doi.org/10.1073/pnas.1908369116" },
  { id: "levitt1971", texte: "Levitt (1971). Transformed up-down methods in psychoacoustics (la règle « 2 réussites → plus dur, 1 échec → plus facile »). Journal of the Acoustical Society of America.", lien: "https://doi.org/10.1121/1.1912375" },
];

export const source = (id: string): Source => SOURCES.find((s) => s.id === id)!;

export type Statut = "ok" | "discute" | "mythe";

export interface Fiche {
  id: string;
  icone: string;
  titre: string;
  points: { statut: Statut; texte: string }[];
  dansLApp: string;
  sources: string[];
}

export const FICHES: Fiche[] = [
  {
    id: "test", icone: "🎯", titre: "Se tester fait retenir (l'effet de test)",
    points: [
      { statut: "ok", texte: "Chercher une réponse dans sa mémoire la fait mieux tenir que relire la même chose. C'est l'un des résultats les plus solides sur l'apprentissage." },
      { statut: "ok", texte: "L'effet tient même quand on se trompe, à condition de voir la bonne réponse juste après." },
      { statut: "discute", texte: "La taille de l'effet varie selon le type de matière et le délai avant le test final : il est net, pas magique." },
    ],
    dansLApp: "chaque question te fait d'abord chercher, puis te montre la réponse et une explication courte.",
    sources: ["roediger2006", "rowland2014", "dunlosky2013"],
  },
  {
    id: "espacement", icone: "📅", titre: "Espacer les révisions",
    points: [
      { statut: "ok", texte: "Revoir une chose plusieurs fois, en laissant passer du temps entre deux fois, fait retenir bien plus longtemps que tout revoir d'un coup." },
      { statut: "ok", texte: "Le meilleur écart dépend du temps pendant lequel on veut retenir : plus on veut retenir longtemps, plus les écarts doivent grandir." },
      { statut: "discute", texte: "Les écarts de l'app (1, 3, 7, 14, 30, 60, 120 jours) sont un choix pratique, inspiré de ces études, pas une formule prouvée." },
    ],
    dansLApp: "une bonne réponse repousse la question à l'étape suivante ; une erreur la ramène à demain.",
    sources: ["cepeda2006", "cepeda2008"],
  },
  {
    id: "oubli", icone: "📉", titre: "La courbe de l'oubli d'Ebbinghaus",
    points: [
      { statut: "ok", texte: "On oublie très vite au début, puis de plus en plus lentement. Ebbinghaus l'a mesuré sur lui-même en 1885 ; l'expérience refaite en 2015 donne la même forme de courbe." },
      { statut: "discute", texte: "Les chiffres exacts (« 70 % oublié en un jour ») dépendent beaucoup de ce qu'on apprend : Ebbinghaus utilisait des syllabes sans aucun sens." },
    ],
    dansLApp: "c'est pour ça que la première révision arrive dès le lendemain, puis s'éloigne.",
    sources: ["murre2015"],
  },
  {
    id: "retour", icone: "💡", titre: "Voir la bonne réponse tout de suite",
    points: [
      { statut: "ok", texte: "Le retour immédiat corrige les erreurs, et aide aussi à garder les bonnes réponses trouvées « au hasard » ou avec peu de confiance." },
    ],
    dansLApp: "après chaque réponse, juste ou fausse, tu vois la bonne réponse et pourquoi.",
    sources: ["butler2008"],
  },
  {
    id: "vrai-faux", icone: "⚖️", titre: "Le piège des « vrai ou faux » : la vérité illusoire",
    points: [
      { statut: "ok", texte: "Une phrase lue plusieurs fois paraît plus vraie, même quand elle est fausse. C'est l'effet de vérité illusoire." },
      { statut: "ok", texte: "Savoir la vérité ne protège pas complètement : l'effet existe même chez des gens qui connaissent la bonne réponse." },
    ],
    dansLApp: "chaque affirmation fausse est tout de suite suivie de la correction, écrite clairement (« Faux : … »), pour que ce soit la correction que tu retiennes.",
    sources: ["hasher1977", "fazio2015"],
  },
  {
    id: "biais-actu", icone: "📰", titre: "Les biais de l'actualité",
    points: [
      { statut: "ok", texte: "Nous réagissons plus fort aux mauvaises nouvelles qu'aux bonnes, dans de nombreux pays. Les médias le savent, et l'actualité penche donc vers le négatif." },
      { statut: "discute", texte: "L'actualité montre ce qui change vite (un accident, une crise) plus que ce qui change lentement (la santé, la pauvreté sur des décennies) : elle donne une image partielle du monde." },
      { statut: "discute", texte: "Une info reprise par un seul média n'est pas forcément fausse, mais elle mérite plus de recul qu'une info confirmée par plusieurs sources indépendantes." },
    ],
    dansLApp: "les questions d'actu signalent quand un seul média en parlait, et la banque de culture générale garde des faits stables, pour équilibrer.",
    sources: ["soroka2019"],
  },
  {
    id: "niveau", icone: "🎚️", titre: "Une difficulté qui s'adapte",
    points: [
      { statut: "ok", texte: "La règle « 2 réussites de suite → plus dur, 1 échec → plus facile » vient de la psychoacoustique : elle garde l'exercice autour de 70 % de réussite." },
      { statut: "discute", texte: "Qu'il existe une difficulté « idéale » pour apprendre est plausible, mais le bon chiffre est discuté. Ici, c'est un choix pratique pour que ce ne soit ni trop facile ni décourageant." },
    ],
    dansLApp: "le niveau choisit les nouvelles questions (facile, moyen, difficile) ; au niveau facile, il y a une mauvaise réponse de moins.",
    sources: ["levitt1971"],
  },
];

export interface Mythe { affirmation: string; vrai: boolean; explication: string; source: string }

export const QUIZ: Mythe[] = [
  { affirmation: "Relire ses notes plusieurs fois est la meilleure façon de retenir.", vrai: false, explication: "Faux : se tester (chercher la réponse sans regarder) fait mieux retenir que relire.", source: "roediger2006" },
  { affirmation: "Se tromper sur une question, puis voir la bonne réponse, aide quand même à apprendre.", vrai: true, explication: "Vrai : avec le retour juste après, l'erreur devient une occasion d'apprendre.", source: "butler2008" },
  { affirmation: "Mieux vaut tout réviser la veille que réviser un peu chaque jour.", vrai: false, explication: "Faux : à temps égal, étaler les révisions fait retenir bien plus longtemps.", source: "cepeda2006" },
  { affirmation: "On oublie le plus vite juste après avoir appris.", vrai: true, explication: "Vrai : la courbe de l'oubli descend vite au début, puis de plus en plus lentement.", source: "murre2015" },
  { affirmation: "Si tu connais déjà la vérité, entendre souvent une phrase fausse ne t'influence pas.", vrai: false, explication: "Faux : la répétition rend une phrase plus crédible, même pour ceux qui savent qu'elle est fausse.", source: "fazio2015" },
  { affirmation: "Les mauvaises nouvelles attirent davantage notre attention que les bonnes.", vrai: true, explication: "Vrai : c'est le biais de négativité, mesuré dans de nombreux pays.", source: "soroka2019" },
  { affirmation: "Ebbinghaus a mesuré l'oubli en apprenant des syllabes sans aucun sens.", vrai: true, explication: "Vrai : il voulait éviter que le sens aide la mémoire. Avec des choses qui ont du sens, on oublie souvent moins vite.", source: "murre2015" },
  { affirmation: "Les écarts de révision doivent grandir au fil du temps.", vrai: true, explication: "Vrai : pour retenir longtemps, on espace de plus en plus (ici 1, 3, 7, 14, 30… jours).", source: "cepeda2008" },
];
