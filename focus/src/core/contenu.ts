// Fiches, quiz « vrai ou faux » et sources. Textes écrits pour l'app, à partir des études citées.
// ✅ prouvé (ok) · ⚠️ discuté ou prouvé en partie (discute) · ❌ mythe (mythe).

export interface Source { id: string; texte: string; lien?: string }

/** Chaque DOI a été vérifié (il pointe bien vers l'article cité). */
export const SOURCES: Source[] = [
  { id: "simons2016", texte: "Simons, Boot, Charness et al. (2016). Do “brain-training” programs work? Psychological Science in the Public Interest.", lien: "https://doi.org/10.1177/1529100616661983" },
  { id: "melby2016", texte: "Melby-Lervåg, Redick & Hulme (2016). Working memory training does not improve performance on measures of intelligence or other measures of “far transfer”. Perspectives on Psychological Science.", lien: "https://doi.org/10.1177/1745691616635612" },
  { id: "eriksen1974", texte: "Eriksen & Eriksen (1974). Effects of noise letters upon the identification of a target letter in a nonsearch task. Perception & Psychophysics.", lien: "https://doi.org/10.3758/BF03203267" },
  { id: "stroop1935", texte: "Stroop (1935). Studies of interference in serial verbal reactions. Journal of Experimental Psychology.", lien: "https://doi.org/10.1037/h0054651" },
  { id: "macleod1991", texte: "MacLeod (1991). Half a century of research on the Stroop effect: an integrative review. Psychological Bulletin.", lien: "https://doi.org/10.1037/0033-2909.109.2.163" },
  { id: "robertson1997", texte: "Robertson, Manly et al. (1997). « Oops! » : performance correlates of everyday attentional failures (le test SART). Neuropsychologia.", lien: "https://doi.org/10.1016/S0028-3932(97)00015-8" },
  { id: "monsell2003", texte: "Monsell (2003). Task switching. Trends in Cognitive Sciences.", lien: "https://doi.org/10.1016/S1364-6613(03)00028-7" },
  { id: "ophir2009", texte: "Ophir, Nass & Wagner (2009). Cognitive control in media multitaskers. PNAS.", lien: "https://doi.org/10.1073/pnas.0903620106" },
  { id: "ward2017", texte: "Ward, Duke, Gneezy & Bos (2017). Brain drain: the mere presence of one's own smartphone reduces available cognitive capacity. Journal of the Association for Consumer Research.", lien: "https://doi.org/10.1086/691462" },
  { id: "ruiz2022", texte: "Ruiz Pardo & Minda (2022). Reexamining the “brain drain” effect: a replication of Ward et al. (2017). Acta Psychologica.", lien: "https://pubmed.ncbi.nlm.nih.gov/36007374/" },
  { id: "altmann2002", texte: "Altmann & Trafton (2002). Memory for goals: an activation-based model. Cognitive Science.", lien: "https://doi.org/10.1207/s15516709cog2601_2" },
  { id: "mark2008", texte: "Mark, Gudith & Klocke (2008). The cost of interrupted work: more speed and stress. Conférence CHI.", lien: "https://doi.org/10.1145/1357054.1357072" },
  { id: "hagger2016", texte: "Hagger, Chatzisarantis et al. (2016). A multilab preregistered replication of the ego-depletion effect. Perspectives on Psychological Science.", lien: "https://doi.org/10.1177/1745691616652873" },
  { id: "mackworth1948", texte: "Mackworth (1948). The breakdown of vigilance during prolonged visual search. Quarterly Journal of Experimental Psychology.", lien: "https://doi.org/10.1080/17470214808416738" },
  { id: "ariga2011", texte: "Ariga & Lleras (2011). Brief and rare mental “breaks” keep you focused. Cognition.", lien: "https://doi.org/10.1016/j.cognition.2010.12.007" },
  { id: "helton2012", texte: "Helton & Russell (2012). Brief mental breaks and content-free cues may not keep you focused. Experimental Brain Research.", lien: "https://doi.org/10.1007/s00221-012-3065-0" },
  { id: "albulescu2022", texte: "Albulescu, Macsinga et al. (2022). « Give me a break! » A systematic review and meta-analysis on the efficacy of micro-breaks. PLOS ONE.", lien: "https://doi.org/10.1371/journal.pone.0272460" },
  { id: "kaplan1995", texte: "Kaplan (1995). The restorative benefits of nature: toward an integrative framework. Journal of Environmental Psychology.", lien: "https://doi.org/10.1016/0272-4944(95)90001-2" },
  { id: "berman2008", texte: "Berman, Jonides & Kaplan (2008). The cognitive benefits of interacting with nature. Psychological Science.", lien: "https://doi.org/10.1111/j.1467-9280.2008.02225.x" },
  { id: "gollwitzer2006", texte: "Gollwitzer & Sheeran (2006). Implementation intentions and goal achievement: a meta-analysis of effects and processes. Advances in Experimental Social Psychology.", lien: "https://doi.org/10.1016/S0065-2601(06)38002-1" },
  { id: "levitt1971", texte: "Levitt (1971). Transformed up-down methods in psychoacoustics (la règle « 2 réussites → plus dur, 1 échec → plus facile »). Journal of the Acoustical Society of America.", lien: "https://doi.org/10.1121/1.1912375" },
];

export const source = (id: string): Source => SOURCES.find((s) => s.id === id)!;

export type Statut = "ok" | "discute" | "mythe";
export const STATUTS: Record<Statut, { icone: string; nom: string }> = {
  ok: { icone: "✅", nom: "prouvé" },
  discute: { icone: "⚠️", nom: "discuté" },
  mythe: { icone: "❌", nom: "mythe" },
};

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
    id: "exercices", icone: "🧩", titre: "Ce que ces exercices entraînent (et ce qu'ils n'entraînent pas)",
    points: [
      { statut: "ok", texte: "Les flèches, les couleurs et la recherche de cible sont des tâches de laboratoire classiques : elles mesurent bien l'attention sélective, c'est-à-dire ta capacité à garder ce qui compte et à ignorer le reste." },
      { statut: "ok", texte: "Avec de l'entraînement, tu deviens nettement meilleur à ces exercices-là. Tes courbes vont monter, c'est normal et c'est réel." },
      { statut: "mythe", texte: "« Les jeux cérébraux rendent plus intelligent. » Les grandes revues d'études trouvent peu ou pas de transfert vers l'intelligence, les notes ou la vie de tous les jours." },
      { statut: "discute", texte: "Un petit effet sur des tâches proches (« transfert proche ») existe parfois. Le reste est discuté : ne compte pas dessus." },
    ],
    dansLApp: "on te promet des progrès sur les exercices, pas sur ton « intelligence ». Ce qui sert vraiment dans la vie, c'est la partie Travail profond : protéger ton attention pendant que tu fais tes vraies tâches.",
    sources: ["simons2016", "melby2016", "eriksen1974", "macleod1991"],
  },
  {
    id: "multitache", icone: "🔀", titre: "Le multitâche",
    points: [
      { statut: "ok", texte: "Passer d'une tâche à l'autre coûte du temps et fait faire plus d'erreurs, même quand on sait à l'avance quelle tâche arrive. Le cerveau doit « recharger » les règles à chaque fois." },
      { statut: "mythe", texte: "« Je suis efficace en multitâche. » En réalité, on alterne vite entre les tâches, et chaque passage coûte un peu." },
      { statut: "discute", texte: "Une étude célèbre a trouvé que les gros multitâches des écrans filtrent moins bien les distractions. L'effet est fragile : les études suivantes ne le retrouvent pas toujours." },
    ],
    dansLApp: "l'exercice « Coût du changement » te montre ton propre temps perdu à chaque changement de règle, en millisecondes. Multiplie par le nombre de fois où tu passes d'un onglet à l'autre dans une heure…",
    sources: ["monsell2003", "ophir2009"],
  },
  {
    id: "telephone", icone: "📱", titre: "Le téléphone à côté de toi",
    points: [
      { statut: "discute", texte: "Une étude de 2017 a dit que la simple présence du téléphone, même éteint, « vide » une partie de ta capacité mentale. Des réplications soigneuses, enregistrées à l'avance, ne retrouvent pas cet effet." },
      { statut: "ok", texte: "Ce qui est sûr : chaque notification ou chaque coup d'œil est une interruption, et les interruptions coûtent du temps de reprise." },
    ],
    dansLApp: "conseil simple, sans chiffre choc : pendant un bloc de travail profond, range ton téléphone hors de vue, en silencieux. Si tu as envie de le prendre, note l'envie avec « J'ai été distrait » et reviens.",
    sources: ["ward2017", "ruiz2022", "mark2008"],
  },
  {
    id: "fatigue", icone: "🔋", titre: "La fatigue de l'attention (et la « volonté batterie »)",
    points: [
      { statut: "ok", texte: "Sur une tâche longue et monotone, la vigilance baisse avec le temps : on rate plus de choses au bout de 30 minutes qu'au début. C'est observé depuis les années 1940." },
      { statut: "mythe", texte: "« Ta volonté est une batterie qui se vide. » Une grande réplication dans 23 laboratoires a trouvé un effet presque nul (d ≈ 0,04)." },
      { statut: "ok", texte: "Ce qui aide vraiment : moins de tentations autour de toi (téléphone rangé, onglets fermés) plutôt que compter sur ta « force de volonté »." },
    ],
    dansLApp: "« Rester sur la tâche » te fait sentir cette baisse de vigilance ; et l'app ne te dira jamais que ta volonté est « épuisée ». Si une séance rate, ce n'est pas un manque de volonté : on raccourcit le palier, c'est tout.",
    sources: ["mackworth1948", "robertson1997", "hagger2016"],
  },
  {
    id: "interruptions", icone: "🔔", titre: "Les interruptions",
    points: [
      { statut: "ok", texte: "Après une coupure, il faut du temps pour se remettre dans sa tâche, et on fait plus d'erreurs juste après. Plus la coupure est longue, plus la reprise est lente." },
      { statut: "ok", texte: "Les personnes interrompues compensent souvent en allant plus vite… mais avec plus de stress et de frustration." },
      { statut: "discute", texte: "Le chiffre « 23 minutes pour se reconcentrer » circule partout ; il vient d'observations de bureau, pas d'une mesure de laboratoire. Garde l'idée (ça coûte), pas le chiffre." },
    ],
    dansLApp: "au niveau supérieur de « Rester sur la tâche », de fausses notifications apparaissent : le but est de les ignorer. Et pendant le travail profond, le bouton « J'ai été distrait » te sert à noter, pas à te punir.",
    sources: ["altmann2002", "mark2008"],
  },
  {
    id: "pauses", icone: "🌿", titre: "Les pauses (et la nature)",
    points: [
      { statut: "discute", texte: "Des pauses courtes aident un peu : moins de fatigue, un peu plus d'énergie. L'effet sur la performance est modeste et varie selon la tâche." },
      { statut: "discute", texte: "Une étude a montré que de brèves coupures pendant une tâche longue évitent la baisse de vigilance ; une autre ne retrouve pas cet effet." },
      { statut: "discute", texte: "La méthode Pomodoro (25 min + 5 min) est pratique, mais elle n'a pas de preuve scientifique propre." },
      { statut: "discute", texte: "Marcher dans la nature semble reposer l'attention mieux qu'une rue en ville, d'après quelques études. C'est prometteur mais pas encore solide." },
    ],
    dansLApp: "à la fin de chaque bloc, une pause de 3 à 5 minutes est proposée, avec l'option « sortir dehors » : ça ne coûte rien et ça aide peut-être.",
    sources: ["ariga2011", "helton2012", "albulescu2022", "kaplan1995", "berman2008"],
  },
  {
    id: "travail-profond", icone: "⏱", titre: "Allonger ses séances petit à petit",
    points: [
      { statut: "discute", texte: "Aucune étude ne prouve directement qu'allonger ses blocs de travail de 15 à 50 minutes « muscle » l'attention. C'est un choix pratique : commencer petit pour réussir, puis augmenter." },
      { statut: "ok", texte: "On sait que la vigilance baisse avec le temps sur une même tâche : des blocs trop longs dès le départ font souvent échouer." },
      { statut: "mythe", texte: "« Le cerveau fonctionne par cycles de 90 minutes, il faut travailler 90 min puis s'arrêter. » Ce rythme n'est pas prouvé pour le travail de la journée." },
    ],
    dansLApp: "paliers 15 → 20 → 25 → 30 → 40 → 50 min. Deux séances réussies de suite au palier actuel (allées au bout, 2 distractions notées au plus) → palier suivant ; une séance abandonnée → palier précédent. Tu peux toujours choisir toi-même.",
    sources: ["mackworth1948", "levitt1971"],
  },
  {
    id: "si-alors", icone: "🧭", titre: "Les intentions « si… alors… »",
    points: [
      { statut: "ok", texte: "Préparer à l'avance « si telle situation arrive, alors je fais ça » aide nettement à tenir ses objectifs. Une méta-analyse de 94 études trouve un effet moyen à fort (d ≈ 0,65)." },
      { statut: "ok", texte: "Ça marche parce que la décision est déjà prise : au moment de la tentation, tu n'as plus à réfléchir, tu suis le plan." },
    ],
    dansLApp: "avant chaque bloc de travail profond, tu écris ton objectif et une intention « si… alors… ». Proposée par défaut : « si j'ai envie de regarder mon téléphone, alors je note l'envie et je reviens ».",
    sources: ["gollwitzer2006"],
  },
];

export interface Mythe { affirmation: string; vrai: boolean; explication: string; source: string }

export const QUIZ: Mythe[] = [
  { affirmation: "Les jeux cérébraux rendent plus intelligent.", vrai: false, explication: "On progresse surtout sur les jeux entraînés. Le transfert vers l'intelligence ou la vie réelle est faible ou absent d'après les grandes revues.", source: "simons2016" },
  { affirmation: "Un téléphone éteint posé à côté de toi réduit ta capacité mentale.", vrai: false, explication: "C'est ce qu'a dit une étude de 2017, mais des réplications soigneuses ne retrouvent pas l'effet. Le ranger hors de vue reste une bonne habitude contre les interruptions.", source: "ruiz2022" },
  { affirmation: "Changer de tâche fait perdre du temps.", vrai: true, explication: "Chaque changement coûte du temps et des erreurs : c'est un des résultats les plus solides sur l'attention. Tu peux le mesurer toi-même dans « Coût du changement ».", source: "monsell2003" },
  { affirmation: "Faire plusieurs choses à la fois est plus efficace.", vrai: false, explication: "On ne fait pas vraiment deux choses à la fois : on alterne, et chaque alternance coûte. Finir une chose, puis passer à la suivante, est plus rapide.", source: "monsell2003" },
  { affirmation: "La volonté est une batterie qui se vide quand on s'en sert.", vrai: false, explication: "Une réplication dans 23 laboratoires a trouvé un effet presque nul. Mieux vaut réduire les tentations que compter sur une « réserve » de volonté.", source: "hagger2016" },
  { affirmation: "Des pauses courtes aident à rester concentré.", vrai: true, explication: "Vrai, mais modestement : moins de fatigue, un peu plus d'énergie. Ce n'est pas magique, et l'effet varie selon les tâches.", source: "albulescu2022" },
  { affirmation: "Le cerveau travaille par cycles de 90 minutes : il faut s'aligner dessus.", vrai: false, explication: "Ce « rythme de 90 minutes » pour le travail de la journée n'est pas prouvé. Choisis une durée que tu réussis, puis allonge petit à petit.", source: "mackworth1948" },
  { affirmation: "Préparer une phrase « si… alors… » aide à tenir son objectif.", vrai: true, explication: "Oui : une méta-analyse de 94 études trouve un effet moyen à fort. Le plan est prêt avant la tentation.", source: "gollwitzer2006" },
  { affirmation: "Après une interruption, on reprend sa tâche exactement là où on en était.", vrai: false, explication: "Il faut un temps de reprise, et on fait plus d'erreurs juste après. D'où l'intérêt de couper les notifications pendant un bloc.", source: "altmann2002" },
  { affirmation: "La méthode Pomodoro (25 + 5 min) est prouvée scientifiquement.", vrai: false, explication: "C'est une méthode pratique, mais elle n'a pas d'étude propre qui montre qu'elle est meilleure qu'une autre durée.", source: "albulescu2022" },
];
