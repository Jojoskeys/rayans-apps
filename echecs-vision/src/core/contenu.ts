// Fiches (ce que dit la recherche, sans exagérer), quiz « vrai ou faux » et sources.
// ✅ prouvé : résultat solide et répliqué. ⚠️ discuté : résultat réel mais limité, nuancé ou contesté.

export type Statut = "ok" | "discute" | "mythe";

export interface Source { id: string; ref: string; lien?: string }

export const SOURCES: Source[] = [
  { id: "degroot", ref: "de Groot, A. D. (1946 ; trad. anglaise 1965). Thought and Choice in Chess. La Haye : Mouton." },
  { id: "chase", ref: "Chase, W. G. et Simon, H. A. (1973). Perception in chess. Cognitive Psychology, 4, 55-81.", lien: "https://doi.org/10.1016/0010-0285(73)90004-2" },
  { id: "gobet96", ref: "Gobet, F. et Simon, H. A. (1996). Templates in chess memory: a mechanism for recalling several boards. Cognitive Psychology, 31, 1-40.", lien: "https://doi.org/10.1006/cogp.1996.0011" },
  { id: "gobet96b", ref: "Gobet, F. et Simon, H. A. (1996). Recall of rapidly presented random chess positions is a function of skill. Psychonomic Bulletin & Review, 3, 159-163.", lien: "https://doi.org/10.3758/BF03212414" },
  { id: "reingold", ref: "Reingold, E. M., Charness, N., Pomplun, M. et Stampe, D. M. (2001). Visual span in expert chess players: evidence from eye movements. Psychological Science, 12, 48-55.", lien: "https://doi.org/10.1111/1467-9280.00309" },
  { id: "chabris", ref: "Chabris, C. F. et Hearst, E. S. (2003). Visualization, pattern recognition, and forward search: effects of playing speed and sight of the position on grandmaster chess errors. Cognitive Science, 27, 637-648.", lien: "https://doi.org/10.1207/s15516709cog2704_3" },
  { id: "charness", ref: "Charness, N., Tuffiash, M., Krampe, R., Reingold, E. et Vasyukova, E. (2005). The role of deliberate practice in chess expertise. Applied Cognitive Psychology, 19, 151-165.", lien: "https://doi.org/10.1002/acp.1106" },
  { id: "hambrick", ref: "Hambrick, D. Z. et al. (2014). Deliberate practice: is that all it takes to become an expert? Intelligence, 45, 34-45.", lien: "https://doi.org/10.1016/j.intell.2013.04.001" },
  { id: "sala", ref: "Sala, G. et Gobet, F. (2016). Do the benefits of chess instruction transfer to academic and cognitive skills? A meta-analysis. Educational Research Review, 18, 46-57.", lien: "https://doi.org/10.1016/j.edurev.2016.02.002" },
  { id: "cepeda", ref: "Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T. et Rohrer, D. (2006). Distributed practice in verbal recall tasks. Psychological Bulletin, 132, 354-380.", lien: "https://doi.org/10.1037/0033-2909.132.3.354" },
  { id: "roediger", ref: "Roediger, H. L. et Karpicke, J. D. (2006). Test-enhanced learning. Psychological Science, 17, 249-255.", lien: "https://doi.org/10.1111/j.1467-9280.2006.01693.x" },
  { id: "levitt", ref: "Levitt, H. (1971). Transformed up-down methods in psychoacoustics. Journal of the Acoustical Society of America, 49, 467-477.", lien: "https://doi.org/10.1121/1.1912375" },
];

export interface Fiche { id: string; titre: string; statut: Statut; resume: string; texte: string[]; sources: string[] }

export const FICHES: Fiche[] = [
  {
    id: "degroot", titre: "Les forts joueurs retiennent une position en quelques secondes", statut: "ok",
    resume: "Montrée environ 5 secondes, une vraie position est replacée presque sans faute par un maître, bien moins par un joueur moyen.",
    texte: [
      "Adriaan de Groot (années 1940) montrait une position de partie quelques secondes à des joueurs de tous niveaux. Les maîtres la reconstruisaient presque parfaitement ; les joueurs plus faibles, nettement moins.",
      "Ce n'est pas une « mémoire photographique » : c'est la connaissance du jeu qui permet de voir la position en quelques groupes familiers.",
      "Dans l'app : l'exercice « Mémoire de position » reprend exactement cette épreuve, avec de vraies positions.",
    ],
    sources: ["degroot"],
  },
  {
    id: "chunks", titre: "Les « chunks » : on retient des groupes, pas des pièces", statut: "ok",
    resume: "Sur des positions au hasard, l'avantage des forts joueurs disparaît presque : ils retiennent des motifs connus, pas des pièces isolées.",
    texte: [
      "Chase et Simon (1973) ont refait l'expérience de de Groot avec, en plus, des positions où les pièces étaient placées au hasard. Sur les vraies positions, le maître écrasait le débutant ; sur les positions au hasard, tout le monde se retrouvait presque au même niveau.",
      "Explication : le joueur fort reconnaît des « chunks », des groupes de pièces qui vont ensemble (un roque, une chaîne de pions, une batterie dame-fou). Un seul chunk vaut plusieurs pièces à retenir.",
      "C'est pourquoi cette app n'utilise que de vraies positions pour la mémoire : ce sont elles qui construisent des chunks utiles en partie.",
    ],
    sources: ["chase"],
  },
  {
    id: "templates", titre: "Même au hasard, un petit avantage reste", statut: "discute",
    resume: "Des études plus récentes trouvent un léger avantage des experts même sur des positions au hasard, et proposent des « templates » plus grands que les chunks.",
    texte: [
      "Gobet et Simon (1996) ont nuancé le résultat de 1973 : avec des présentations très rapides et beaucoup de joueurs, les experts gardent un petit avantage même au hasard (quelques motifs familiers y apparaissent par chance).",
      "Ils proposent la théorie des « templates » : de grandes structures (par exemple un schéma d'ouverture complet) avec des cases « à remplir ». Cela expliquerait que les maîtres retiennent plusieurs échiquiers à la fois.",
      "Le débat porte sur le détail du mécanisme, pas sur l'idée principale : la mémoire des échecs vient surtout de la connaissance du jeu.",
    ],
    sources: ["gobet96", "gobet96b"],
  },
  {
    id: "coup-oeil", titre: "Les experts voient plus de cases d'un seul regard", statut: "ok",
    resume: "Mesuré au suivi des yeux : les experts saisissent une plus grande zone de l'échiquier par regard, mais seulement sur des positions réalistes.",
    texte: [
      "Reingold et ses collègues (2001) ont suivi les yeux de joueurs pendant qu'ils cherchaient, par exemple, si un roi était en échec. Les experts regardaient moins de points différents et voyaient plus de cases à chaque regard.",
      "Cet avantage n'apparaît que sur des positions structurées, pas sur des positions au hasard : là encore, c'est la connaissance du jeu qui fait la différence.",
    ],
    sources: ["reingold"],
  },
  {
    id: "aveugle", titre: "Jouer à l'aveugle : ce que l'on sait (et ses limites)", statut: "discute",
    resume: "Les grands maîtres jouent presque aussi bien sans voir l'échiquier, mais cela ne dit pas que l'entraînement à l'aveugle rend meilleur.",
    texte: [
      "Chabris et Hearst (2003) ont compté les erreurs de grands maîtres dans des parties rapides, à l'aveugle ou non : jouer sans voir l'échiquier ajoutait peu d'erreurs. L'interprétation exacte des chiffres est discutée.",
      "Ces résultats concernent des joueurs déjà très forts. Il n'y a pas de bonne étude montrant que s'entraîner à l'aveugle fait progresser un joueur moyen plus vite que d'autres façons de travailler.",
      "Il est raisonnable de penser que « voir de tête » aide à calculer des variantes (on imagine des positions qui ne sont pas sur l'échiquier), mais c'est une idée plausible, pas un résultat prouvé.",
      "Dans l'app : la « Vision sans échiquier » entraîne une partie précise de cela (qui attaque quoi), avec des réponses vérifiées par chess.js.",
    ],
    sources: ["chabris"],
  },
  {
    id: "pratique", titre: "Ce qui fait vraiment progresser : l'étude sérieuse", statut: "discute",
    resume: "Le temps d'étude sérieuse en solitaire (analyser des parties, résoudre des positions) prédit bien le niveau, mais n'explique pas tout.",
    texte: [
      "Charness et ses collègues (2005) ont interrogé des centaines de joueurs : le nombre d'heures d'étude sérieuse seule (analyse, problèmes, parties de maîtres) était le meilleur indicateur du classement.",
      "Mais d'autres chercheurs (Hambrick et al., 2014) montrent que cette pratique n'explique qu'une partie des différences de niveau : l'âge de départ, les capacités de chacun et d'autres facteurs comptent aussi.",
      "Conclusion honnête : travailler sérieusement aide beaucoup, mais personne ne peut promettre un niveau précis pour un nombre d'heures donné.",
    ],
    sources: ["charness", "hambrick"],
  },
  {
    id: "transfert", titre: "Les échecs ne rendent pas « plus intelligent » en général", statut: "ok",
    resume: "Dans les études bien contrôlées, l'effet des échecs sur les maths ou l'école est faible, voire nul : on progresse surtout… aux échecs.",
    texte: [
      "La méta-analyse de Sala et Gobet (2016) trouve un effet global modéré des cours d'échecs sur les résultats scolaires, mais les études les mieux faites (avec un vrai groupe de comparaison) montrent un effet bien plus petit.",
      "De même, ces exercices te rendront meilleur à… retenir et voir des positions d'échecs. C'est déjà bien, mais il ne faut pas en attendre plus.",
    ],
    sources: ["sala"],
  },
  {
    id: "espacement", titre: "Revoir à intervalles croissants, en se testant", statut: "ok",
    resume: "Revoir une tactique au bon moment (J+1, J+3, J+7…) et chercher la réponse soi-même la fait tenir bien plus longtemps.",
    texte: [
      "L'effet d'espacement est l'un des résultats les plus solides de la psychologie : à temps égal, étaler les révisions bat le « bachotage » (Cepeda et al., 2006, des centaines d'expériences).",
      "L'effet de test : chercher activement la réponse fait mieux retenir que relire la solution (Roediger et Karpicke, 2006).",
      "Ces études portent surtout sur des mots ou des faits ; leur application aux motifs tactiques est très plausible, mais moins étudiée directement.",
    ],
    sources: ["cepeda", "roediger"],
  },
  {
    id: "escalier", titre: "Pourquoi la difficulté monte et descend", statut: "ok",
    resume: "2 réussites de suite → plus dur, 1 échec → plus facile : on se stabilise autour de 71 % de réussite.",
    texte: [
      "C'est une règle « en escalier » venue des mesures de l'audition (Levitt, 1971). Elle garde chaque exercice difficile sans être décourageant.",
      "Rater fait donc partie du jeu : environ une manche sur trois est un échec, et c'est voulu.",
    ],
    sources: ["levitt"],
  },
];

export interface QuestionQuiz { id: string; affirmation: string; vrai: boolean; explication: string; fiche: string }

export const QUIZ: QuestionQuiz[] = [
  { id: "q1", affirmation: "Un maître retient mieux qu'un débutant une position de vraie partie vue 5 secondes.", vrai: true, explication: "C'est le résultat de de Groot, retrouvé de nombreuses fois.", fiche: "degroot" },
  { id: "q2", affirmation: "Les maîtres ont une mémoire photographique : ils retiennent aussi bien des pièces placées au hasard.", vrai: false, explication: "Au hasard, leur avantage disparaît presque (Chase et Simon, 1973) : ils retiennent des motifs connus.", fiche: "chunks" },
  { id: "q3", affirmation: "Un « chunk », c'est un groupe de pièces qu'on retient d'un bloc parce qu'on l'a déjà vu souvent.", vrai: true, explication: "Par exemple un petit roque avec ses trois pions.", fiche: "chunks" },
  { id: "q4", affirmation: "Même sur des positions au hasard, les experts gardent parfois un petit avantage.", vrai: true, explication: "Gobet et Simon (1996) l'ont mesuré avec des présentations rapides ; l'effet est petit.", fiche: "templates" },
  { id: "q5", affirmation: "Les experts regardent chaque case une par une, plus vite que les autres.", vrai: false, explication: "Ils voient plus de cases à chaque regard, et regardent moins de points (Reingold et al., 2001).", fiche: "coup-oeil" },
  { id: "q6", affirmation: "Il est prouvé que s'entraîner à l'aveugle fait progresser plus vite qu'une autre méthode.", vrai: false, explication: "Aucune bonne étude ne le montre ; on sait seulement que les grands maîtres jouent presque aussi bien à l'aveugle.", fiche: "aveugle" },
  { id: "q7", affirmation: "Jouer aux échecs améliore beaucoup les notes en maths, d'après les meilleures études.", vrai: false, explication: "Dans les études bien contrôlées, l'effet est faible voire nul (Sala et Gobet, 2016).", fiche: "transfert" },
  { id: "q8", affirmation: "Revoir une tactique trois jours de suite vaut mieux que la revoir à J+1, J+3 et J+7.", vrai: false, explication: "Espacer les révisions fait mieux retenir à temps égal (effet d'espacement).", fiche: "espacement" },
  { id: "q9", affirmation: "Chercher la solution soi-même fait mieux retenir que lire la solution.", vrai: true, explication: "C'est l'effet de test (Roediger et Karpicke, 2006).", fiche: "espacement" },
  { id: "q10", affirmation: "Les heures d'étude sérieuse expliquent à elles seules tout le niveau d'un joueur.", vrai: false, explication: "Elles comptent beaucoup, mais n'expliquent qu'une partie des différences (Hambrick et al., 2014).", fiche: "pratique" },
  { id: "q11", affirmation: "Rater environ une manche sur trois est normal dans cette app.", vrai: true, explication: "La règle en escalier vise environ 71 % de réussite.", fiche: "escalier" },
  { id: "q12", affirmation: "Une pièce clouée devant son roi contrôle quand même les cases qu'elle attaque.", vrai: true, explication: "Le roi adverse ne peut pas aller sur ces cases : une pièce clouée donne toujours « échec ».", fiche: "aveugle" },
];
