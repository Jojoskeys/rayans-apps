// Fiches, quiz « vrai ou faux » et sources. Textes écrits pour l'app, à partir des études citées.
// Un lien n'est donné que s'il a été vérifié ; sinon, auteurs, année et revue suffisent pour retrouver l'article.

export type Statut = "prouve" | "discute" | "mythe";
export const STATUT: Record<Statut, string> = { prouve: "✅ prouvé", discute: "⚠️ discuté", mythe: "❌ mythe" };

export interface Source { id: string; texte: string; lien?: string }

export const SOURCES: Source[] = [
  { id: "rayner2016", texte: "Rayner, Schotter, Masson, Potter & Treiman (2016). So Much to Read, So Little Time: How Do We Read, and Can Speed Reading Help? Psychological Science in the Public Interest, 17(1).", lien: "https://www.psychologicalscience.org/publications/speed_reading.html" },
  { id: "schotter2014", texte: "Schotter, Tran & Rayner (2014). Don't believe what you read (only once): comprehension is supported by regressions during reading. Psychological Science (communiqué de l'APS).", lien: "https://www.psychologicalscience.org/news/releases/speed-reading-apps-may-impair-reading-comprehension-by-limiting-ability-to-backtrack.html" },
  { id: "dinocera2018", texte: "Di Nocera et al. (2018). Étude sur la lecture mot à mot (RSVP) à vitesse élevée et la compréhension." },
  { id: "brysbaert2019", texte: "Brysbaert (2019). How many words do we read per minute? A review and meta-analysis of reading rate. Journal of Memory and Language.", lien: "https://doi.org/10.1016/j.jml.2019.104047" },
  { id: "dunlosky2013", texte: "Dunlosky, Rawson, Marsh, Nathan & Willingham (2013). Improving Students' Learning With Effective Learning Techniques. Psychological Science in the Public Interest.", lien: "https://doi.org/10.1177/1529100612453266" },
  { id: "mcdaniel2009", texte: "McDaniel, Howard & Einstein (2009). The read-recite-review study strategy. Psychological Science. Présentation en anglais par The Learning Scientists : « SQ3R or Read, Recite, Review ».", lien: "https://www.learningscientists.org/blog/2021/3/4-1" },
  { id: "chi1994", texte: "Chi, de Leeuw, Chiu & LaVancher (1994). Eliciting self-explanations improves understanding. Cognitive Science." },
  { id: "bisra2018", texte: "Bisra, Liu, Nesbit, Salimi & Winne (2018). Inducing self-explanation: a meta-analysis (64 études). Educational Psychology Review." },
  { id: "mueller2014", texte: "Mueller & Oppenheimer (2014). The pen is mightier than the keyboard. Psychological Science." },
  { id: "urry2021", texte: "Urry et al. (2021). Don't ditch the laptop just yet: a direct replication of Mueller and Oppenheimer's (2014) study. Psychological Science." },
  { id: "morehead2019", texte: "Morehead, Dunlosky & Rawson (2019). How much mightier is the pen than the keyboard for note-taking? Educational Psychology Review.", lien: "https://doi.org/10.1007/s10648-019-09468-2" },
  { id: "delgado2018", texte: "Delgado, Vargas, Ackerman & Salmerón (2018). Don't throw away your printed books: a meta-analysis on the effects of reading media on reading comprehension. Educational Research Review." },
  { id: "recht1988", texte: "Recht & Leslie (1988). Effect of prior knowledge on good and poor readers' memory of text. Journal of Educational Psychology." },
];

export const source = (id: string): Source => SOURCES.find((s) => s.id === id) ?? { id, texte: id };

export interface Principe { statut: Statut; texte: string }

export interface Fiche {
  id: string;
  icone: string;
  titre: string;
  principes: Principe[];
  paragraphes: string[];
  dansLApp: string;
  sources: string[];
}

export const FICHES: Fiche[] = [
  {
    id: "lecture-rapide", icone: "🚀", titre: "La lecture rapide : ce qu'elle promet, ce qu'elle tient",
    principes: [
      { statut: "mythe", texte: "Lire deux ou trois fois plus vite sans rien perdre en compréhension." },
      { statut: "discute", texte: "Supprimer la « voix intérieure » (subvocalisation) pour aller plus vite : aucune promesse sérieuse." },
      { statut: "prouve", texte: "Vitesse et compréhension s'échangent : quand l'une monte beaucoup, l'autre baisse." },
    ],
    paragraphes: [
      "Une grande synthèse de 2016 (Rayner et ses collègues) a passé en revue ce qu'on sait de la lecture et des méthodes de lecture rapide. Conclusion : on peut bien sûr lire plus vite, mais on comprend alors moins. Les « lecteurs rapides » testés retiennent surtout l'idée générale, un peu comme quand on survole.",
      "La vitesse de lecture est surtout limitée par le temps qu'il faut pour reconnaître les mots et les relier entre eux, pas par les yeux. Ce qui fait vraiment progresser, c'est de connaître plus de mots et plus de sujets : c'est pour ça que l'app te fait lire beaucoup de textes variés.",
      "Lire plus vite n'est pas mauvais en soi : sur un texte facile ou quand tu cherches une information, c'est utile. Mais il faut toujours regarder la compréhension à côté.",
    ],
    dansLApp: "la vitesse n'est jamais affichée seule : mots/min, compréhension et score efficace vont ensemble, et l'exercice « mot à mot » te laisse vérifier toi-même la baisse.",
    sources: ["rayner2016", "schotter2014", "dinocera2018"],
  },
  {
    id: "vitesse", icone: "⚖️", titre: "Vitesse et compréhension, toujours ensemble",
    principes: [
      { statut: "prouve", texte: "Un adulte lit en moyenne environ 238 mots/min en silence (textes informatifs, en anglais) et environ 260 pour des récits." },
      { statut: "prouve", texte: "La vitesse change beaucoup selon le texte : un sujet inconnu se lit plus lentement, et c'est normal." },
      { statut: "mythe", texte: "« La moyenne est de 300 mots/min » : ce chiffre, souvent cité, est trop élevé." },
    ],
    paragraphes: [
      "Le repère de 238 mots/min vient d'une méta-analyse de 2019 (Brysbaert) qui a rassemblé près de deux cents études. Il porte sur l'anglais : en français, les mots sont en moyenne un peu plus longs, la comparaison n'est donc qu'approximative. C'est un repère, pas une note ni une norme.",
      "Ce qui compte, c'est ton propre progrès, sur des textes comparables. C'est le rôle des tests : des textes réservés, de longueur et de niveau proches, refaits chaque semaine.",
      "Le « score efficace » multiplie ta vitesse par ta part de bonnes réponses : 250 mots/min avec 80 % de compréhension donnent 200 « mots compris par minute ». Aller plus vite en comprenant moins ne l'améliore pas forcément.",
    ],
    dansLApp: "sous 70 % de compréhension, l'app te prévient que tu vas trop vite pour ce texte. Le niveau ne monte que si tu comprends bien (80 % ou plus) à ton rythme habituel.",
    sources: ["brysbaert2019", "rayner2016"],
  },
  {
    id: "survol", icone: "🔭", titre: "Le survol (écrémage) : un outil, pas une lecture",
    principes: [
      { statut: "discute", texte: "Survoler avant de lire (titres, introduction, conclusion) aide sans doute à s'orienter ; la méthode SQ3R complète a été peu testée." },
      { statut: "prouve", texte: "Survoler fait perdre les détails : c'est un tri, pas une compréhension complète." },
    ],
    paragraphes: [
      "Survoler, c'est lire seulement les éléments qui portent la structure : le titre, l'introduction, les titres des parties et la conclusion. En une minute, on sait de quoi parle le texte et s'il mérite une vraie lecture.",
      "C'est utile pour choisir un chapitre, préparer une lecture ou retrouver une information. Ce n'est pas une façon de lire plus vite un texte qu'on doit comprendre : les détails et les raisonnements sont dans le corps du texte.",
    ],
    dansLApp: "l'exercice « Survol en 60 s » est séparé de la lecture chronométrée et n'est jamais compté comme de la vitesse de lecture.",
    sources: ["mcdaniel2009", "rayner2016"],
  },
  {
    id: "se-tester", icone: "🧠", titre: "Se tester et résumer de mémoire",
    principes: [
      { statut: "prouve", texte: "Essayer de retrouver ce qu'on a lu (se tester) fait mieux retenir que relire." },
      { statut: "prouve", texte: "Réciter ou résumer de mémoire après avoir lu est une forme efficace de test." },
      { statut: "discute", texte: "Relire plusieurs fois donne une impression de maîtrise, mais aide peu à long terme." },
    ],
    paragraphes: [
      "La grande revue de Dunlosky et ses collègues (2013) a classé dix techniques d'étude. Se tester fait partie des deux techniques jugées les plus utiles ; relire et surligner sont en bas du classement.",
      "Une étude de McDaniel et ses collègues (2009) a comparé « lire, réciter, revoir » à la prise de notes et à la relecture : réciter de mémoire donnait de bons résultats, pour moins de temps que les notes.",
      "Écrire un résumé sans le texte est difficile, et c'est justement cet effort qui fait retenir. Les idées oubliées te montrent ce qu'il faut revoir.",
    ],
    dansLApp: "après la lecture, tu écris 3 à 5 phrases sans le texte, puis tu coches les idées clés retrouvées. L'app pré-coche par mots-clés, mais c'est toi qui confirmes.",
    sources: ["dunlosky2013", "mcdaniel2009"],
  },
  {
    id: "auto-explication", icone: "💬", titre: "S'expliquer le texte à soi-même",
    principes: [
      { statut: "prouve", texte: "Se demander « pourquoi ? » et s'expliquer chaque étape améliore la compréhension." },
    ],
    paragraphes: [
      "En 1994, Chi et ses collègues ont demandé à des élèves de s'expliquer à voix haute un texte de biologie, phrase après phrase. Ils l'ont mieux compris que ceux qui l'avaient simplement lu deux fois. Une méta-analyse de 2018 (Bisra et ses collègues, 64 études) confirme un effet moyen, dans beaucoup de matières.",
      "Concrètement : après un paragraphe, demande-toi ce qu'il ajoute, pourquoi c'est vrai, et comment ça se relie à ce que tu sais déjà. Ça ralentit un peu, mais ça fait comprendre.",
    ],
    dansLApp: "les questions « d'inférence » demandent de déduire ce qui n'est pas écrit, et chaque correction est expliquée.",
    sources: ["chi1994", "bisra2018"],
  },
  {
    id: "notes", icone: "✍️", titre: "Prendre des notes : à la main ou au clavier ?",
    principes: [
      { statut: "discute", texte: "« La main est toujours meilleure que le clavier » : l'étude célèbre de 2014 n'a pas été nettement confirmée." },
      { statut: "prouve", texte: "Ce qui compte, c'est de reformuler avec ses mots plutôt que de recopier." },
    ],
    paragraphes: [
      "En 2014, Mueller et Oppenheimer ont trouvé que des étudiants qui prenaient des notes à la main comprenaient mieux un cours que ceux qui tapaient sur ordinateur, sans doute parce que ces derniers recopiaient mot pour mot. Une réplication soignée (Urry et ses collègues, 2021) et une analyse de Morehead et ses collègues (2019) n'ont pas retrouvé d'avantage net de la main.",
      "La leçon la plus solide : peu importe l'outil, évite de recopier. Écris des mots-clés, des questions, des liens entre les idées, avec tes propres mots. Sur ordinateur, attention aussi aux distractions (onglets, messages).",
    ],
    dansLApp: "l'exercice « Lire et prendre des notes » te fait noter avec tes mots, puis répondre aux questions avec tes seules notes : tu vois tout de suite si elles sont utiles.",
    sources: ["mueller2014", "urry2021", "morehead2019"],
  },
  {
    id: "ecran-papier", icone: "📄", titre: "Écran ou papier ?",
    principes: [
      { statut: "discute", texte: "Léger avantage du papier pour comprendre les textes informatifs, surtout quand on est pressé." },
      { statut: "mythe", texte: "« L'écran est toujours pire » : pour les récits, la différence est quasi nulle." },
    ],
    paragraphes: [
      "Une méta-analyse de 2018 (Delgado et ses collègues) a comparé la compréhension sur papier et sur écran. L'écart est petit mais réel en faveur du papier pour les textes informatifs, surtout avec une limite de temps. Pour les récits, il n'y a pas de différence nette.",
      "Une explication possible : sur écran, on a tendance à lire plus vite et plus superficiellement. Le défilement continu rend aussi plus difficile de se repérer dans le texte.",
    ],
    dansLApp: "les textes s'affichent par pages, sans défilement, pour garder des repères. Prends ton temps : il n'y a pas de limite pendant la lecture chronométrée.",
    sources: ["delgado2018"],
  },
  {
    id: "surlignage", icone: "🖍️", titre: "Le surlignage",
    principes: [
      { statut: "mythe", texte: "« Surligner, c'est efficace » : c'est l'une des techniques les moins utiles." },
      { statut: "discute", texte: "Surligner peu, après une première lecture, peut aider à repérer, à condition de se tester ensuite." },
    ],
    paragraphes: [
      "Dans la revue de Dunlosky (2013), le surlignage est classé parmi les techniques de faible utilité. On surligne souvent trop, et le fait de colorier donne l'impression d'avoir travaillé sans obliger à réfléchir.",
      "Si tu aimes surligner, fais-le après avoir lu la partie entière, très peu (une idée par paragraphe), puis transforme ces passages en questions pour te tester.",
    ],
    dansLApp: "pas de surligneur : l'app te fait plutôt résumer et répondre sans le texte, ce qui fait davantage retenir.",
    sources: ["dunlosky2013"],
  },
  {
    id: "avant-de-lire", icone: "🧩", titre: "Avant de lire : ce que tu sais déjà",
    principes: [
      { statut: "prouve", texte: "Ce que l'on sait déjà sur un sujet aide beaucoup à comprendre et à retenir un texte." },
      { statut: "discute", texte: "Se poser une question avant de lire entretient la curiosité ; l'effet propre de ce petit rituel est peu mesuré." },
    ],
    paragraphes: [
      "Dans une étude connue (Recht et Leslie, 1988), des élèves qui connaissaient bien le baseball comprenaient et retenaient mieux un texte sur un match, même quand ils lisaient moins bien que les autres. Les connaissances donnent des « crochets » où accrocher les nouvelles informations.",
      "Prendre dix secondes pour te rappeler ce que tu sais déjà active ces crochets. La question de curiosité te donne une raison de lire : tu cherches une réponse.",
    ],
    dansLApp: "avant chaque lecture, une ligne facultative « ce que je sais déjà » et une question à garder en tête.",
    sources: ["recht1988"],
  },
];

export interface Mythe { affirmation: string; vrai: boolean; explication: string; fiche: string }

export const QUIZ: Mythe[] = [
  { affirmation: "Avec un bon entraînement, on peut lire deux fois plus vite sans rien perdre en compréhension.", vrai: false, explication: "La synthèse de Rayner (2016) montre un compromis : quand la vitesse monte beaucoup, la compréhension baisse.", fiche: "lecture-rapide" },
  { affirmation: "Un adulte lit en moyenne 300 mots par minute.", vrai: false, explication: "La méta-analyse de Brysbaert (2019) trouve environ 238 mots/min pour des textes informatifs en anglais, environ 260 pour des récits.", fiche: "vitesse" },
  { affirmation: "Les applis qui affichent un mot à la fois font lire plus vite sans aucun coût.", vrai: false, explication: "Sans pouvoir revenir en arrière, la compréhension baisse, surtout à vitesse élevée (Schotter et collègues, 2014).", fiche: "lecture-rapide" },
  { affirmation: "Surligner est l'une des meilleures façons d'apprendre un texte.", vrai: false, explication: "Dunlosky (2013) le classe parmi les techniques peu utiles : il donne l'impression de travailler sans faire réfléchir.", fiche: "surlignage" },
  { affirmation: "Se tester sur un texte fait mieux retenir que le relire.", vrai: true, explication: "Retrouver de mémoire renforce le souvenir ; c'est l'une des techniques les mieux prouvées.", fiche: "se-tester" },
  { affirmation: "Prendre des notes à la main est toujours meilleur qu'au clavier.", vrai: false, explication: "L'étude de 2014 n'a pas été nettement confirmée (Urry 2021, Morehead 2019). Reformuler avec ses mots compte plus que l'outil.", fiche: "notes" },
  { affirmation: "Lire sur écran donne toujours une moins bonne compréhension que sur papier.", vrai: false, explication: "L'écart est petit et surtout présent pour les textes informatifs lus vite ; pour les récits, il est quasi nul (Delgado 2018).", fiche: "ecran-papier" },
  { affirmation: "S'expliquer un texte à soi-même aide à mieux le comprendre.", vrai: true, explication: "Chi (1994) et une méta-analyse de 64 études (Bisra 2018) le confirment.", fiche: "auto-explication" },
  { affirmation: "Faire taire sa voix intérieure permet de tripler sa vitesse.", vrai: false, explication: "Aucune preuve sérieuse : la voix intérieure fait partie de la lecture normale et aide à comprendre.", fiche: "lecture-rapide" },
  { affirmation: "Connaître déjà un peu le sujet aide à comprendre un texte.", vrai: true, explication: "Les connaissances préalables comptent beaucoup, parfois plus que le niveau de lecture (Recht et Leslie, 1988).", fiche: "avant-de-lire" },
];
