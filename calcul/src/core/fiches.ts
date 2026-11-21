// Les fiches « ce que dit la recherche », le quiz vrai/faux et les sources. Textes écrits pour l'app.
// ✅ = prouvé (plusieurs études solides), ⚠️ = discuté ou prouvé en partie, ❌ = mythe.

export interface Source { texte: string; lien?: string }
export type Statut = "prouve" | "discute" | "mythe";
export const SYMBOLE: Record<Statut, string> = { prouve: "✅", discute: "⚠️", mythe: "❌" };

export const SOURCES = {
  rowland: { texte: "Rowland (2014), méta-analyse sur l'effet du test (Psychological Bulletin), g ≈ 0,50", lien: "https://pubmed.ncbi.nlm.nih.gov/25150680/" },
  brendefur: { texte: "Brendefur et al. (2015), stratégies puis pratique des faits arithmétiques", lien: "https://scholarworks.boisestate.edu/cifs_facpubs/150" },
  rohrer: { texte: "Rohrer et al. (2020), essai en classe sur les exercices mélangés en maths (fiche du What Works Clearinghouse)", lien: "https://ies.ed.gov/ncee/wwc/Study/88770" },
  bjorkObs: { texte: "Bjork & Bjork, les « difficultés désirables » (APS Observer)", lien: "https://www.psychologicalscience.org/observer/desirable-difficulties" },
  bjork1994: { texte: "Bjork (1994), Memory and metamemory considerations in the training of human beings" },
  ashcraft: { texte: "Ashcraft & Krause (2007), anxiété mathématique et mémoire de travail (Psychonomic Bulletin & Review)", lien: "https://dx.doi.org/10.3758/BF03194059" },
  torbeyns: { texte: "Torbeyns, Obersteiner & Verschaffel (2012), stratégies de calcul et sens du nombre" },
  siegler: { texte: "Siegler et collègues, estimation et ligne numérique (surtout chez l'enfant)" },
  barner: { texte: "Barner et al. (2016), essai randomisé sur le boulier (soroban)", lien: "https://dash.harvard.edu/bitstream/handle/1/41364831/Barneretal.inpress.pdf?sequence=1" },
  kornell: { texte: "Kornell, Hays & Bjork (2009), les essais ratés suivis de la réponse aident à apprendre (JEP: LMC)" },
  pesenti: { texte: "Pesenti et al. (2001), étude d'un calculateur prodige (Nature Neuroscience)" },
  sisk: { texte: "Sisk et al. (2018), deux méta-analyses sur la « mentalité de croissance » : effets faibles (Psychological Science)" },
} satisfies Record<string, Source>;

export interface Fiche {
  id: string;
  icone: string;
  titre: string;
  points: { statut: Statut; texte: string }[];
  paragraphes: string[];
  dansLApp: string;
  sources: Source[];
}

export const FICHES: Fiche[] = [
  {
    id: "tester", icone: "🧪", titre: "Se tester plutôt que relire",
    points: [
      { statut: "prouve", texte: "Chercher la réponse soi-même fait mieux retenir que relire la solution (effet moyen, g ≈ 0,50)." },
      { statut: "discute", texte: "Le gain est faible quand on réussit moins d'une fois sur deux : il faut que ce soit réussissable." },
      { statut: "discute", texte: "Corriger tout de suite ou un peu plus tard : les deux se défendent ; ici on corrige tout de suite." },
      { statut: "discute", texte: "Espacer les révisions marche très bien en général, mais peu d'études portent sur les faits de calcul eux-mêmes." },
    ],
    paragraphes: [
      "Quand tu tapes ta réponse avant de voir la solution, ton cerveau va chercher l'information. C'est cet effort de rappel qui renforce la mémoire, bien plus que de relire une méthode.",
      "Mais un test trop dur ne sert presque à rien : si tu rates presque tout, tu n'apprends que des réponses que tu n'as pas trouvées. La bonne zone, c'est environ 70 à 85 % de réussite.",
      "Une erreur n'est pas une perte de temps : un essai raté suivi de la bonne réponse aide aussi à retenir. C'est pour ça que l'app montre la décomposition juste après une erreur.",
    ],
    dansLApp: "tu réponds toujours avant de voir la solution ; la difficulté s'ajuste (2 réussites → plus dur, 1 erreur → plus facile) pour rester autour de 70 % ; une erreur affiche la décomposition et le calcul revient plus tard.",
    sources: [SOURCES.rowland, SOURCES.bjorkObs, SOURCES.kornell, SOURCES.brendefur],
  },
  {
    id: "melanger", icone: "🔀", titre: "Mélanger les types de calculs",
    points: [
      { statut: "prouve", texte: "Mélanger les types d'exercices (au lieu de faire 20 fois le même) aide à retenir sur la durée." },
      { statut: "discute", texte: "En maths, la grande preuve vient surtout d'un essai en classe (54 classes) : solide, mais un seul grand essai." },
      { statut: "prouve", texte: "Une difficulté « désirable » : plus dur sur le moment, mieux retenu ensuite — à condition de rester réussissable." },
    ],
    paragraphes: [
      "Faire 20 multiplications de suite donne l'impression de progresser vite : on applique la même méthode sans réfléchir. Mais le jour où les calculs arrivent dans le désordre, il faut d'abord savoir quelle méthode choisir.",
      "Dans l'essai de Rohrer et collègues (2020), des élèves qui avaient fait des exercices mélangés ont eu 61 % à un test un mois plus tard, contre 38 % pour ceux qui avaient travaillé par blocs.",
      "Le mélange paraît plus difficile pendant l'entraînement. C'est normal, et c'est le but.",
    ],
    dansLApp: "l'entraînement ne pose jamais deux fois de suite le même type quand c'est possible ; les astuces apprises se mélangent aux autres calculs.",
    sources: [SOURCES.rohrer, SOURCES.bjork1994, SOURCES.bjorkObs],
  },
  {
    id: "astuces", icone: "💡", titre: "Les astuces : pourquoi elles marchent",
    points: [
      { statut: "prouve", texte: "Décomposer un calcul et choisir une stratégie font partie du « sens du nombre », qu'on peut travailler." },
      { statut: "discute", texte: "Les astuces classiques (× 11, carrés en 5…) sont mathématiquement exactes, mais aucune étude ne mesure leur effet propre." },
      { statut: "discute", texte: "Apprendre une stratégie puis la répéter donnerait une fluence plus régulière que la répétition seule." },
    ],
    paragraphes: [
      "Une astuce n'est pas de la magie : c'est une propriété des nombres écrite de façon pratique. 9 × 47, c'est 10 × 47 − 47 parce que 9 = 10 − 1. Quand tu sais pourquoi, tu t'en souviens mieux et tu peux l'adapter.",
      "Les astuces de l'app sont donc présentées comme des raccourcis : chacune a son explication en une phrase. L'important n'est pas d'en connaître cent, mais de savoir couper un calcul en morceaux faciles.",
      "Le boulier japonais (soroban) est impressionnant, mais un essai randomisé n'a pas montré qu'il améliore les maths ou la mémoire en général.",
    ],
    dansLApp: "chaque astuce a une explication pas à pas, un exemple animé, le « pourquoi », puis 10 exercices ; ensuite elle revient mélangée dans l'entraînement.",
    sources: [SOURCES.torbeyns, SOURCES.brendefur, SOURCES.barner],
  },
  {
    id: "estimation", icone: "🎯", titre: "Estimer avant de calculer",
    points: [
      { statut: "discute", texte: "Savoir estimer (ordre de grandeur, ligne des nombres) est lié au niveau en maths, surtout montré chez l'enfant." },
      { statut: "prouve", texte: "Arrondir puis corriger est exact : c'est la même propriété que la décomposition." },
    ],
    paragraphes: [
      "Avant un calcul exact, une estimation rapide te dit où tu dois tomber : 47 × 6, c'est un peu moins que 50 × 6 = 300. Si tu trouves 2 820, tu sais tout de suite qu'il y a un zéro de trop.",
      "Dans la vie, c'est souvent l'estimation qui sert : vérifier une addition au restaurant, une remise, un ticket de caisse.",
      "Les liens entre estimation et réussite en maths ont surtout été étudiés chez les enfants (travaux de Siegler) ; chez l'adulte, on sait moins de choses.",
    ],
    dansLApp: "le mode « Estimer d'abord » te demande une estimation rapide (acceptée à 10 % près) avant le calcul exact, et l'astuce « Arrondir puis corriger » le transforme en calcul exact.",
    sources: [SOURCES.siegler],
  },
  {
    id: "stress", icone: "🫁", titre: "Le stress et le chrono",
    points: [
      { statut: "discute", texte: "L'anxiété face aux maths occupe la mémoire de travail : il en reste moins pour calculer." },
      { statut: "mythe", texte: "« Le chrono fait toujours progresser plus vite. » Pour certains, il ajoute surtout de la pression." },
    ],
    paragraphes: [
      "Garder des retenues en tête utilise la mémoire de travail. Le stress (« je suis nul en maths », « vite, vite ») en prend une partie, et les calculs deviennent plus durs qu'ils ne le sont.",
      "C'est pourquoi le chrono est caché par défaut pendant l'entraînement. Le temps est mesuré quand même (pour voir tes progrès), mais tu ne le vois pas.",
      "Les défis chronométrés sont là pour le jeu, quand tu en as envie. S'ils te stressent, passe ton tour : l'entraînement sans chrono suffit pour progresser.",
    ],
    dansLApp: "chrono caché pendant l'entraînement (réglable), défis facultatifs, et des messages qui parlent d'entraînement, pas d'examen.",
    sources: [SOURCES.ashcraft],
  },
  {
    id: "bosse", icone: "🧠", titre: "La « bosse des maths »",
    points: [
      { statut: "mythe", texte: "« On a la bosse des maths ou on ne l'a pas. » Le calcul mental se construit surtout par la pratique." },
      { statut: "discute", texte: "La « mentalité de croissance » est souvent présentée comme une preuve : ses effets mesurés sont faibles." },
      { statut: "discute", texte: "Les calculateurs prodiges s'appuient beaucoup sur des faits et des stratégies stockés par des années de pratique." },
    ],
    paragraphes: [
      "Les gens ne partent pas tous du même point, c'est vrai. Mais la rapidité en calcul mental dépend énormément de ce qu'on a pratiqué : faits connus par cœur, stratégies, habitude de décomposer.",
      "Se dire « je peux progresser » ne suffit pas à progresser : les études sur la mentalité de croissance trouvent des effets faibles. Ce qui compte, c'est la pratique régulière et bien faite.",
      "L'étude d'un calculateur prodige a montré qu'il utilisait sa mémoire à long terme pour stocker des résultats intermédiaires : un savoir-faire construit, pas un don mystérieux.",
    ],
    dansLApp: "des séances courtes et régulières, des tests de suivi pour voir tes vrais progrès, et aucune note « de don ».",
    sources: [SOURCES.pesenti, SOURCES.sisk],
  },
];

export interface Mythe { affirmation: string; vrai: boolean; explication: string; source?: Source }

export const MYTHES: Mythe[] = [
  {
    affirmation: "La bosse des maths est innée : on l'a ou on ne l'a pas.", vrai: false,
    explication: "Faux. Le calcul mental se construit surtout par la pratique (faits connus, stratégies). Tout le monde ne part pas du même point, mais tout le monde peut avancer.",
  },
  {
    affirmation: "Relire une méthode, c'est aussi efficace que de s'entraîner à la retrouver.", vrai: false,
    explication: "Faux. Se tester fait mieux retenir que relire (effet moyen solide). Le gain est faible seulement quand c'est beaucoup trop dur.",
    source: SOURCES.rowland,
  },
  {
    affirmation: "Pour retenir longtemps, mieux vaut faire tous les calculs du même type d'affilée.", vrai: false,
    explication: "Faux. Les blocs donnent l'impression de progresser vite, mais le mélange aide davantage à long terme (61 % contre 38 % un mois plus tard dans un grand essai en classe).",
    source: SOURCES.rohrer,
  },
  {
    affirmation: "S'entraîner avec un chrono fait toujours progresser plus vite.", vrai: false,
    explication: "Faux. Le chrono ajoute de la pression ; chez les personnes anxieuses face aux maths, le stress prend de la place dans la mémoire de travail. C'est pour ça qu'il est facultatif ici.",
    source: SOURCES.ashcraft,
  },
  {
    affirmation: "Le boulier (soroban) améliore la mémoire et les maths de tout le monde.", vrai: false,
    explication: "Faux. Un essai randomisé n'a pas trouvé d'amélioration générale des maths chez les élèves ; les gains se limitaient à certains enfants (ceux qui avaient déjà une bonne mémoire visuo-spatiale).",
    source: SOURCES.barner,
  },
  {
    affirmation: "Une correction immédiate est toujours meilleure qu'une correction plus tard.", vrai: false,
    explication: "Faux, mais c'est nuancé : selon les études, une correction un peu différée peut aussi bien aider. Corriger tout de suite reste simple et évite de répéter une erreur : c'est le choix de l'app.",
    source: SOURCES.bjorkObs,
  },
  {
    affirmation: "Il faut connaître tous ses faits par cœur avant d'apprendre la moindre stratégie.", vrai: false,
    explication: "Faux, nuancé. Les faits par cœur aident beaucoup, mais apprendre une stratégie puis la pratiquer donne aussi de bons résultats. Les deux vont ensemble.",
    source: SOURCES.brendefur,
  },
  {
    affirmation: "Un exercice beaucoup trop dur n'apprend presque rien.", vrai: true,
    explication: "Vrai. Une difficulté utile, c'est difficile mais réussissable. Si tu échoues presque tout le temps, tu n'as presque rien à renforcer : l'app baisse le niveau après une erreur.",
    source: SOURCES.bjork1994,
  },
  {
    affirmation: "Faire des erreurs pendant l'entraînement, c'est du temps perdu.", vrai: false,
    explication: "Faux. Un essai raté suivi de la bonne réponse aide aussi à retenir. L'important est de voir la correction tout de suite et de recroiser le calcul plus tard.",
    source: SOURCES.kornell,
  },
  {
    affirmation: "Les calculateurs prodiges ont un cerveau à part, impossible à imiter.", vrai: false,
    explication: "Faux, en bonne partie. Un calculateur étudié en imagerie s'appuyait sur sa mémoire à long terme et sur des années de pratique. Tout le monde ne deviendra pas champion, mais c'est un savoir-faire.",
    source: SOURCES.pesenti,
  },
  {
    affirmation: "Avec les calculatrices, le calcul mental ne sert plus à rien.", vrai: false,
    explication: "Faux. Estimer de tête permet de repérer une erreur de frappe, de vérifier une addition ou une remise, et de comprendre les nombres qu'on manipule. On n'a pas toujours une calculatrice… ni le réflexe de douter de son résultat.",
  },
];

/** Toutes les sources, pour l'onglet Sources. */
export const TOUTES_SOURCES: { theme: string; sources: Source[] }[] = [
  { theme: "Se tester, corriger", sources: [SOURCES.rowland, SOURCES.bjorkObs, SOURCES.bjork1994, SOURCES.kornell] },
  { theme: "Mélanger, espacer", sources: [SOURCES.rohrer, SOURCES.brendefur] },
  { theme: "Stratégies et estimation", sources: [SOURCES.torbeyns, SOURCES.siegler, SOURCES.barner] },
  { theme: "Stress et « don »", sources: [SOURCES.ashcraft, SOURCES.pesenti, SOURCES.sisk] },
];
