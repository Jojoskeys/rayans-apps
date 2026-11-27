// Fiches, quiz « vrai ou faux » et sources. Textes écrits pour l'app, à partir des études citées.
// Un lien est donné seulement quand il a été vérifié ; sinon, auteurs, année et revue.

export type Statut = "prouve" | "discute" | "mythe";
export const STATUT: Record<Statut, string> = { prouve: "✅ prouvé", discute: "⚠️ discuté", mythe: "❌ mythe" };

export interface Source { id: string; texte: string; lien?: string }

export const SOURCES: Source[] = [
  { id: "cepeda2006", texte: "Cepeda, Pashler, Vul, Wixted & Rohrer (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. Psychological Bulletin.", lien: "https://doi.org/10.1037/0033-2909.132.3.354" },
  { id: "roediger2006", texte: "Roediger & Karpicke (2006). Test-enhanced learning: Taking memory tests improves long-term retention. Psychological Science.", lien: "https://doi.org/10.1111/j.1467-9280.2006.01693.x" },
  { id: "nakata", texte: "Nakata (2015 et 2017). Études sur l'effet de test et l'espacement pour le vocabulaire d'une langue étrangère. Studies in Second Language Acquisition." },
  { id: "atkinson1975", texte: "Atkinson & Raugh (1975). An application of the mnemonic keyword method to the acquisition of a Russian vocabulary. Journal of Experimental Psychology: Human Learning and Memory.", lien: "https://doi.org/10.1037/0278-7393.1.2.126" },
  { id: "wang1999", texte: "Wang, Spence, Jongman & Sereno (1999). Training American listeners to perceive Mandarin tones. Journal of the Acoustical Society of America.", lien: "https://doi.org/10.1121/1.428217" },
  { id: "sadakata2014", texte: "Sadakata & McQueen (2014). Les aptitudes de départ prédisent l'effet d'un entraînement aux tons du mandarin avec beaucoup de voix différentes. Frontiers in Psychology." },
  { id: "perfetti", texte: "Travaux de l'équipe de Charles Perfetti (Université de Pittsburgh) sur la lecture des caractères chinois et le rôle des radicaux." },
  { id: "elakiki2020", texte: "El Akiki & Content (2020). Étude sur le rôle de la racine dans la lecture de l'arabe chez l'enfant." },
  { id: "swain1985", texte: "Swain (1985). L'hypothèse de la « production » (output) : parler et écrire font remarquer ses manques. Chapitre dans Input in Second Language Acquisition (Gass & Madden, dir.)." },
  { id: "johnson1989", texte: "Johnson & Newport (1989). Critical period effects in second language learning. Cognitive Psychology.", lien: "https://doi.org/10.1016/0010-0285(89)90003-0" },
  { id: "vanhove2013", texte: "Vanhove (2013). The critical period hypothesis in second language acquisition: a statistical critique and a reanalysis. PLoS ONE.", lien: "https://doi.org/10.1371/journal.pone.0069172" },
  { id: "pashler2008", texte: "Pashler, McDaniel, Rohrer & Bjork (2008). Learning styles: Concepts and evidence. Psychological Science in the Public Interest.", lien: "https://doi.org/10.1111/j.1539-6053.2009.01038.x" },
  { id: "schreiner2015", texte: "Schreiner, Göldi & Rasch (2015). Rappeler des mots de vocabulaire pendant le sommeil (mots appris avant, pendant la journée). Psychophysiology." },
  { id: "levitt1971", texte: "Levitt (1971). Transformed up-down methods in psychoacoustics. Journal of the Acoustical Society of America (règle « 2 réussites → plus dur, 1 échec → plus facile »)." },
];

export const source = (id: string): Source => SOURCES.find((s) => s.id === id) ?? { id, texte: id };

export interface Principe { statut: Statut; texte: string }
export interface Fiche { id: string; icone: string; titre: string; principes: Principe[]; paragraphes: string[]; dansLApp: string; sources: string[] }

export const FICHES: Fiche[] = [
  {
    id: "espacement", icone: "📅", titre: "Les révisions espacées",
    principes: [{ statut: "prouve", texte: "Réviser en plusieurs fois, avec des écarts qui s'allongent, fait mieux retenir que tout réviser d'un coup." }],
    paragraphes: [
      "C'est un des résultats les plus solides sur la mémoire : des centaines d'expériences le montrent. L'écart idéal dépend du temps pendant lequel tu veux te souvenir.",
      "Un mot revu juste avant d'être oublié tient de plus en plus longtemps. Un mot raté revient vite.",
    ],
    dansLApp: "chaque mot revient à J+1, J+3, J+7, J+14, J+30, J+60 puis J+120 ; une erreur le ramène à demain. Pas plus de 8 nouveaux mots par jour (réglable).",
    sources: ["cepeda2006"],
  },
  {
    id: "test", icone: "🎯", titre: "Se tester plutôt que relire",
    principes: [
      { statut: "prouve", texte: "Chercher la réponse dans sa tête (rappel actif) fait mieux retenir que relire la liste." },
      { statut: "prouve", texte: "Ça marche aussi pour le vocabulaire d'une langue étrangère, dans les deux sens (mot → sens et sens → mot)." },
    ],
    paragraphes: [
      "Relire donne une impression de facilité trompeuse. Essayer de se souvenir, même en se trompant, renforce la trace en mémoire.",
      "Le petit effort compte : si la réponse est trop facile, l'effet est plus faible.",
    ],
    dansLApp: "les cartes te demandent toujours de retrouver le sens (ou le mot) avant de voir la réponse ; dis-la dans ta tête avant de choisir.",
    sources: ["roediger2006", "nakata"],
  },
  {
    id: "mot-cle", icone: "🔑", titre: "La méthode du mot-clé",
    principes: [
      { statut: "prouve", texte: "À court terme, relier le son d'un mot étranger à un mot français qui sonne pareil, avec une image, aide beaucoup." },
      { statut: "discute", texte: "À long terme, l'avantage fond si on ne révise pas : il faut ensuite des révisions espacées." },
    ],
    paragraphes: [
      "Exemple : 茶 chá (thé) sonne comme « chat » → imagine un chat qui boit une tasse de thé. Ou قَلَم qalam (stylo) → « calme ».",
      "Dans l'étude de départ, on retenait nettement plus de mots russes avec cette méthode. Mais le mot-clé est une béquille pour démarrer : le but est de reconnaître le mot directement.",
    ],
    dansLApp: "le mot-clé est proposé à la découverte d'un mot, puis retiré des révisions. Tu peux inventer le tien : il marche souvent mieux.",
    sources: ["atkinson1975"],
  },
  {
    id: "tons", icone: "🎵", titre: "Les tons du mandarin",
    principes: [
      { statut: "prouve", texte: "S'entraîner à reconnaître les tons améliore nettement leur perception, et le progrès tient des mois." },
      { statut: "discute", texte: "Tout le monde ne progresse pas autant : ceux qui entendent déjà bien progressent le plus. Plusieurs voix et syllabes variées aident." },
    ],
    paragraphes: [
      "En mandarin, le ton change le sens : mā (妈, maman), má (麻, chanvre), mǎ (马, cheval), mà (骂, gronder). 1er ton haut et plat, 2e qui monte, 3e qui descend puis remonte, 4e qui tombe.",
      "Dans une étude, des débutants sont passés d'environ 69 % à 90 % de tons bien reconnus après quelques séances courtes.",
    ],
    dansLApp: "l'exercice « Tons à l'oreille » utilise la voix chinoise de ton appareil, change de syllabe, de voix (si tu en as plusieurs) et de vitesse. Les couleurs de tons (masquables) : 1 rouge, 2 orange, 3 vert, 4 bleu, neutre gris.",
    sources: ["wang1999", "sadakata2014"],
  },
  {
    id: "radicaux", icone: "🈶", titre: "Caractères et radicaux",
    principes: [{ statut: "discute", texte: "Repérer le radical (口 bouche, 氵 eau, 亻 personne…) aide un peu à deviner le sens et à retenir les caractères." }],
    paragraphes: [
      "Beaucoup de caractères ont une partie qui donne une idée du sens (le radical) et une autre qui donne une idée du son. Ce n'est pas toujours fiable : le sens a parfois changé avec le temps.",
      "Inutile d'apprendre la liste des radicaux avant les mots : on les remarque au fur et à mesure.",
    ],
    dansLApp: "le radical est montré sur la carte quand il aide, et la page « Radicaux » regroupe les mots par radical.",
    sources: ["perfetti"],
  },
  {
    id: "arabe", icone: "🌙", titre: "Lire l'arabe : voyelles et racines",
    principes: [
      { statut: "prouve", texte: "Au début, les voyelles courtes (harakat) écrites rendent la lecture bien plus sûre : c'est ainsi qu'on apprend aux enfants." },
      { statut: "discute", texte: "Voir la racine de trois lettres (ك ت ب : écrire → كِتَاب livre, مَكْتَب bureau, كَاتِب écrivain) aide à relier les mots en familles." },
    ],
    paragraphes: [
      "L'arabe s'écrit de droite à gauche, avec 28 lettres qui changent un peu de forme selon leur place. Dans les journaux et les livres pour adultes, les voyelles courtes ne sont pas écrites : il faut connaître le mot.",
      "Les études sur les racines portent surtout sur des enfants arabophones : pour un adulte débutant, c'est une aide pour retenir, pas une règle magique.",
    ],
    dansLApp: "les voyelles sont visibles au début ; quand un mot est bien su, elles sont retirées (réglable) et tu peux les réafficher. La racine est montrée sur la carte.",
    sources: ["elakiki2020"],
  },
  {
    id: "produire", icone: "🗣", titre: "Produire la langue",
    principes: [{ statut: "discute", texte: "Écrire ou dire soi-même (remettre une phrase dans l'ordre, écrire une dictée) fait remarquer ce qu'on ne sait pas encore." }],
    paragraphes: [
      "Comprendre un mot ne suffit pas pour savoir l'utiliser. En produisant, tu vois tout de suite où tu bloques, et la correction arrive au bon moment.",
      "L'effet exact est encore discuté, mais produire tôt ne fait pas de mal et rend les mots plus « actifs ».",
    ],
    dansLApp: "chaque séance contient une production : une phrase à remettre dans l'ordre ou une dictée, un jour sur deux.",
    sources: ["swain1985"],
  },
  {
    id: "age", icone: "⏳", titre: "L'âge et l'accent",
    principes: [
      { statut: "prouve", texte: "En moyenne, ceux qui apprennent une langue enfant arrivent à un niveau final plus haut." },
      { statut: "mythe", texte: "« Après un certain âge, c'est trop tard » : il n'y a pas de coupure nette, on progresse à tout âge." },
    ],
    paragraphes: [
      "Les grandes études montrent une baisse progressive avec l'âge, pas un mur. Un adulte apprend même souvent plus vite au début, grâce à ses méthodes.",
      "Un accent parfait est rare chez les adultes, mais se faire comprendre clairement est tout à fait possible.",
    ],
    dansLApp: "l'écoute des tons et la dictée entraînent l'oreille ; vise d'être compris, pas d'être parfait.",
    sources: ["johnson1989", "vanhove2013"],
  },
  {
    id: "styles", icone: "🧠", titre: "Les « styles d'apprentissage »",
    principes: [{ statut: "mythe", texte: "Apprendre « selon son style » (visuel, auditif…) ne fait pas mieux retenir." }],
    paragraphes: [
      "Une revue de la recherche n'a trouvé aucune preuve qu'adapter les cours au « style » de chacun améliore les résultats.",
      "Ce qui marche pour tout le monde : se tester, espacer, et utiliser le son ET l'écrit ensemble quand c'est utile (pour une langue, entendre le mot aide forcément).",
    ],
    dansLApp: "chaque mot est montré, lu à voix haute (si ta voix est disponible) et testé : pour tout le monde pareil.",
    sources: ["pashler2008"],
  },
  {
    id: "sommeil", icone: "😴", titre: "Apprendre en dormant ?",
    principes: [
      { statut: "mythe", texte: "On n'apprend pas de nouveaux mots en les écoutant pendant le sommeil." },
      { statut: "discute", texte: "Le sommeil aide à consolider ce qu'on a appris dans la journée ; dans une étude, réentendre pendant la nuit des mots appris le soir les a un peu renforcés." },
    ],
    paragraphes: [
      "Les enregistrements « apprenez le chinois en dormant » ne tiennent pas leurs promesses : il faut être éveillé pour apprendre du neuf.",
      "Par contre, une séance le soir puis une vraie nuit, c'est un bon combo.",
    ],
    dansLApp: "fais ta séance quand tu veux ; le soir avant de dormir est un bon moment (voir aussi Rayan's Sommeil).",
    sources: ["schreiner2015"],
  },
];

export interface Mythe { affirmation: string; vrai: boolean; explication: string; fiche: string }

export const QUIZ: Mythe[] = [
  { affirmation: "La méthode du mot-clé est aussi efficace à long terme qu'à court terme, même sans réviser.", vrai: false, explication: "Elle aide beaucoup au début, mais l'avantage fond si on ne révise pas. À combiner avec les révisions espacées.", fiche: "mot-cle" },
  { affirmation: "Mieux vaut réviser un mot en plusieurs fois espacées qu'une seule longue fois.", vrai: true, explication: "C'est l'effet d'espacement, un des résultats les plus solides sur la mémoire.", fiche: "espacement" },
  { affirmation: "Relire sa liste de mots, c'est aussi efficace que se tester.", vrai: false, explication: "Se tester (chercher la réponse dans sa tête) fait mieux retenir que relire, même quand on se trompe.", fiche: "test" },
  { affirmation: "On apprend mieux si les cours suivent son style (visuel, auditif…).", vrai: false, explication: "Aucune preuve solide : c'est un mythe très répandu.", fiche: "styles" },
  { affirmation: "Un adulte ne pourra jamais avoir une bonne prononciation.", vrai: false, explication: "Un accent parfait est plus rare, mais il n'y a pas de coupure nette avec l'âge : on progresse et on se fait comprendre à tout âge.", fiche: "age" },
  { affirmation: "Écouter du vocabulaire nouveau pendant son sommeil permet de l'apprendre.", vrai: false, explication: "On n'apprend pas de mots nouveaux en dormant. Le sommeil aide seulement à consolider ce qui a été appris éveillé.", fiche: "sommeil" },
  { affirmation: "Entendre plusieurs voix différentes aide à apprendre les tons.", vrai: true, explication: "Les entraînements efficaces utilisent plusieurs voix et syllabes variées ; l'effet varie d'une personne à l'autre.", fiche: "tons" },
  { affirmation: "Produire soi-même (écrire, remettre en ordre) fait voir ses erreurs.", vrai: true, explication: "C'est l'idée de la production : on remarque ce qui manque. L'effet exact est encore discuté.", fiche: "produire" },
  { affirmation: "Il faut connaître tous les radicaux avant d'apprendre des mots chinois.", vrai: false, explication: "Les radicaux aident un peu à retenir, mais on les découvre au fil des mots : ce n'est pas un prérequis.", fiche: "radicaux" },
  { affirmation: "Au début, lire l'arabe avec les voyelles courtes écrites aide.", vrai: true, explication: "Les harakat lèvent le doute sur la prononciation ; on les retire peu à peu quand le mot est su.", fiche: "arabe" },
];
