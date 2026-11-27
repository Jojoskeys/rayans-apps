// Fiches, quiz « vrai ou faux », sources et page d'aide. Textes écrits pour l'app, à partir des études citées.
// Les liens ont été vérifiés ; quand un lien n'a pas pu l'être, on cite seulement auteurs, année et revue.
// Calme est une app de bien-être : elle ne soigne rien et ne remplace pas un professionnel.

export type Statut = "prouve" | "discute" | "mythe";
export const STATUT: Record<Statut, string> = { prouve: "✅ prouvé", discute: "⚠️ discuté", mythe: "❌ mythe" };

export interface Source { id: string; texte: string; lien?: string }

export const SOURCES: Source[] = [
  { id: "zaccaro2018", texte: "Zaccaro et al. (2018). How Breath-Control Can Change Your Life: A Systematic Review on Psycho-Physiological Correlates of Slow Breathing. Frontiers in Human Neuroscience.", lien: "https://doi.org/10.3389/fnhum.2018.00353" },
  { id: "balban2023", texte: "Balban et al. (2023). Brief structured respiration practices enhance mood and reduce physiological arousal. Cell Reports Medicine (111 participants, 5 min par jour pendant un mois).", lien: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9873947/" },
  { id: "lieberman2007", texte: "Lieberman et al. (2007). Putting feelings into words: affect labeling disrupts amygdala activity in response to affective stimuli. Psychological Science (30 participants)." },
  { id: "gross", texte: "Gross & John (2003). Individual differences in two emotion regulation processes: implications for affect, relationships, and well-being. Journal of Personality and Social Psychology." },
  { id: "frattaroli2006", texte: "Frattaroli (2006). Experimental disclosure and its moderators: a meta-analysis. Psychological Bulletin (146 études, effet très petit)." },
  { id: "diniz2023", texte: "Diniz et al. (2023). The effects of gratitude interventions: a systematic review and meta-analysis. Einstein (São Paulo).", lien: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10393216/" },
  { id: "emmons2003", texte: "Emmons & McCullough (2003). Counting blessings versus burdens: an experimental investigation of gratitude and subjective well-being in daily life. Journal of Personality and Social Psychology." },
  { id: "ramirez2011", texte: "Ramirez & Beilock (2011). Writing about testing worries boosts exam performance in the classroom. Science." },
  { id: "myers2021", texte: "Myers, Davis & Chan (2021). Étude en classe réelle sur l'écriture avant un examen, sans effet retrouvé. Cognitive Research: Principles and Implications.", lien: "https://doi.org/10.1186/s41235-021-00309-x" },
  { id: "jamieson2010", texte: "Jamieson et al. (2010). Turning the knots in your stomach into bows: reappraising arousal improves performance on the GRE. Journal of Experimental Social Psychology." },
  { id: "goyal2014", texte: "Goyal et al. (2014). Meditation programs for psychological stress and well-being: a systematic review and meta-analysis. JAMA Internal Medicine." },
  { id: "bushman2002", texte: "Bushman (2002). Does venting anger feed or extinguish the flame? Catharsis, rumination, distraction, anger, and aggressive responding. Personality and Social Psychology Bulletin." },
  { id: "jacobson", texte: "Jacobson (1938). Progressive Relaxation. University of Chicago Press (méthode d'origine de la relaxation musculaire)." },
  { id: "3114", texte: "3114, numéro national de prévention du suicide (France) : gratuit, 24 h/24, 7 j/7.", lien: "https://3114.fr/" },
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
  importante?: boolean;
}

export const FICHES: Fiche[] = [
  {
    id: "aide", icone: "🤝", titre: "Quand demander de l'aide", importante: true,
    principes: [
      { statut: "prouve", texte: "L'anxiété et la déprime se soignent bien, avec un professionnel." },
      { statut: "mythe", texte: "« Demander de l'aide, c'est être faible. » C'est au contraire une façon de prendre soin de soi." },
    ],
    paragraphes: [
      "Calme est une app de bien-être : elle aide à souffler et à mettre des mots, mais elle ne soigne rien et ne remplace personne.",
      "Parles-en à un proche, à ton médecin traitant ou à un psychologue si :",
      "• tu es triste ou anxieux depuis plus de deux semaines et ça gêne ta vie (cours, travail, sommeil, relations) ;",
      "• tu as des idées de mort ou de te faire du mal ;",
      "• tu as besoin d'alcool, de médicaments ou d'autres produits pour tenir ;",
      "• tu as des crises de panique qui reviennent.",
      "Idées noires : appelle le 3114 (gratuit, 24 h/24). Danger immédiat : le 15 ou le 112. Envie de parler à quelqu'un : SOS Amitié au 09 72 39 40 50.",
    ],
    dansLApp: "le bouton « Si ça ne va vraiment pas » est toujours en haut de l'écran.",
    sources: ["3114"],
  },
  {
    id: "respiration", icone: "🌬", titre: "Respiration lente",
    principes: [
      { statut: "prouve", texte: "Respirer lentement (autour de 6 fois par minute) calme le corps à court terme : cœur, tension." },
      { statut: "discute", texte: "L'effet sur l'anxiété elle-même est plus variable selon les études." },
      { statut: "discute", texte: "Le soupir cyclique a amélioré l'humeur un peu plus que la pleine conscience, dans un seul essai." },
    ],
    paragraphes: [
      "Une revue de 2018 montre que la respiration lente agit sur le corps : rythme cardiaque, sensation de détente. Sur l'anxiété au quotidien, les résultats sont plus mélangés.",
      "Le soupir cyclique (deux inspirations par le nez, une longue expiration par la bouche) a été testé en 2023 chez 111 personnes, 5 minutes par jour pendant un mois. Résultat encourageant, mais c'est un seul essai.",
      "Le plus simple : essaie, et note ton ressenti avant et après. Tu verras ce qui marche pour toi.",
    ],
    dansLApp: "trois rythmes, 2 à 10 min, ressenti noté avant / après (facultatif) et courbe dans Progrès.",
    sources: ["zaccaro2018", "balban2023"],
  },
  {
    id: "nommer", icone: "🏷", titre: "Nommer son émotion",
    principes: [
      { statut: "prouve", texte: "Mettre un mot précis sur ce qu'on ressent fait souvent baisser un peu son intensité." },
      { statut: "discute", texte: "L'étude la plus connue est petite (30 personnes) et faite en laboratoire." },
    ],
    paragraphes: [
      "Dire « je suis frustré » plutôt que « ça va pas » aide le cerveau à prendre un peu de recul. Les chercheurs appellent ça l'étiquetage des émotions.",
      "Plus le mot est précis (agacement, déception, gêne…), plus c'est utile. D'où la roue de mots avec des nuances.",
    ],
    dansLApp: "étape 1 de « Nommer et réévaluer » : la roue des émotions et l'intensité de 0 à 10.",
    sources: ["lieberman2007"],
  },
  {
    id: "reevaluer", icone: "🔍", titre: "Réévaluer ses pensées",
    principes: [
      { statut: "prouve", texte: "Regarder la situation autrement (réévaluer) aide en général plus que d'étouffer son émotion." },
      { statut: "prouve", texte: "Pensée → preuves pour et contre → pensée plus équilibrée : c'est une base des thérapies cognitives." },
      { statut: "discute", texte: "Écrire ce qu'on ressent (écriture expressive) a un effet moyen très petit." },
    ],
    paragraphes: [
      "Quand on est pris par une émotion, une pensée automatique arrive vite : « je suis nul », « ça va mal finir ». Elle n'est pas forcément fausse, mais rarement complète.",
      "Les questions (preuves pour, preuves contre, ce que tu dirais à un ami, l'importance dans un an, ce que tu contrôles) servent à trouver une pensée plus juste, pas une pensée « positive » forcée.",
      "Cacher ou étouffer une émotion marche moins bien à long terme que la regarder en face.",
    ],
    dansLApp: "étapes 2 à 5 de « Nommer et réévaluer », gardées dans ton journal privé.",
    sources: ["gross", "frattaroli2006"],
  },
  {
    id: "gratitude", icone: "🌱", titre: "Gratitude",
    principes: [
      { statut: "discute", texte: "Noter des choses bien a des effets positifs, mais petits." },
      { statut: "mythe", texte: "« La gratitude soigne la dépression. » Non : c'est un petit plus, pas un traitement." },
    ],
    paragraphes: [
      "Une revue de 2023 trouve des effets modestes sur l'anxiété et l'humeur, avec des preuves de faible certitude. L'étude classique de 2003 va dans le même sens.",
      "Écrire aussi le « pourquoi » aide à revivre un peu le moment, au lieu de faire une liste vite fait.",
      "Aucune promesse de chiffre ici : c'est un moment agréable à t'offrir, pas une cure.",
    ],
    dansLApp: "« 3 choses bien aujourd'hui », avec un rappel le soir si tu l'actives.",
    sources: ["diniz2023", "emmons2003"],
  },
  {
    id: "examen", icone: "📝", titre: "Stress d'examen",
    principes: [
      { statut: "discute", texte: "Écrire ses inquiétudes juste avant un examen a aidé dans une étude de 2011…" },
      { statut: "discute", texte: "… mais ce n'a pas été retrouvé dans une vraie classe en 2021." },
      { statut: "discute", texte: "Voir son cœur qui bat comme de l'énergie qui se prépare : idée prometteuse, peu répliquée par d'autres équipes." },
      { statut: "mythe", texte: "« Écrire avant l'examen supprime le stress. » Au mieux, ça aide un peu certaines personnes." },
    ],
    paragraphes: [
      "La routine de l'app combine des choses simples : respirer, poser ses inquiétudes sur papier, se dire que le corps se prépare, puis respirer une dernière fois.",
      "Sois honnête avec toi : ce n'est pas magique. Essaie-la avant un contrôle peu important et regarde si elle t'aide.",
      "Un peu de stress avant un examen est normal et peut même aider à se concentrer.",
    ],
    dansLApp: "la routine « Avant le moment stressant », en un clic depuis l'accueil.",
    sources: ["ramirez2011", "myers2021", "jamieson2010"],
  },
  {
    id: "pleine-conscience", icone: "🧘", titre: "Pleine conscience",
    principes: [
      { statut: "discute", texte: "Les programmes de méditation réduisent un peu l'anxiété et le stress, comparés à rien." },
      { statut: "mythe", texte: "« La méditation remplace un traitement. » Comparée à un vrai traitement, elle ne fait pas mieux." },
    ],
    paragraphes: [
      "Une grande revue de 2014 trouve un effet modéré face à l'absence d'intervention, et à peu près nul face à d'autres traitements actifs.",
      "C'est une pratique utile pour beaucoup, à condition de ne pas en attendre des miracles. La respiration de l'app en reprend l'idée de base : revenir doucement à son souffle quand l'esprit part ailleurs.",
    ],
    dansLApp: "pendant la respiration, si tu penses à autre chose, reviens simplement au cercle.",
    sources: ["goyal2014"],
  },
  {
    id: "colere", icone: "🔥", titre: "Colère : le mythe du coussin",
    principes: [
      { statut: "mythe", texte: "« Taper dans un coussin évacue la colère. » En fait, ça l'entretient plutôt." },
      { statut: "prouve", texte: "Se calmer (respirer, attendre, changer d'activité) fait mieux baisser la colère que se défouler." },
    ],
    paragraphes: [
      "Dans une étude de 2002, les personnes qui tapaient dans un sac en pensant à celui qui les avait énervées étaient ensuite plus agressives, pas moins.",
      "La colère dit souvent quelque chose d'important (une injustice, une limite). Mieux vaut la nommer et y réfléchir à froid que la « décharger ».",
    ],
    dansLApp: "en cas de colère : une respiration 4-6, puis « Nommer et réévaluer ».",
    sources: ["bushman2002"],
  },
  {
    id: "relaxation", icone: "💆", titre: "Relaxation musculaire",
    principes: [{ statut: "discute", texte: "Contracter puis relâcher ses muscles est agréable pour beaucoup ; à prendre comme une pratique de confort." }],
    paragraphes: [
      "On serre une zone du corps quelques secondes, puis on la relâche et on sent la différence. La méthode existe depuis les années 1930.",
      "Ne force jamais : si une zone est douloureuse ou blessée, saute-la simplement.",
    ],
    dansLApp: "5 minutes guidées dans Exercices (et dans la séance de 20 min).",
    sources: ["jacobson"],
  },
];

export interface Mythe { affirmation: string; vrai: boolean; explication: string; fiche: string }

export const QUIZ: Mythe[] = [
  { affirmation: "Taper dans un coussin aide à évacuer la colère.", vrai: false, explication: "Se défouler entretient plutôt la colère. Se calmer d'abord, puis réfléchir, marche mieux.", fiche: "colere" },
  { affirmation: "Respirer lentement calme le corps à court terme.", vrai: true, explication: "Autour de 6 respirations par minute, le cœur et la tension se posent un peu. L'effet sur l'anxiété au long cours est plus discuté.", fiche: "respiration" },
  { affirmation: "Mettre un mot précis sur son émotion peut aider.", vrai: true, explication: "Nommer ce qu'on ressent fait souvent baisser un peu l'intensité. Les études restent petites.", fiche: "nommer" },
  { affirmation: "Écrire ses inquiétudes avant un examen supprime le stress.", vrai: false, explication: "Une étude a trouvé un petit effet, une autre en classe réelle n'a rien retrouvé. Ça peut aider un peu, pas supprimer le stress.", fiche: "examen" },
  { affirmation: "Voir son stress comme de l'énergie qui se prépare peut aider.", vrai: true, explication: "Plutôt vrai, mais avec une preuve limitée : surtout le même groupe de chercheurs, peu de répliques indépendantes.", fiche: "examen" },
  { affirmation: "Tenir un carnet de gratitude soigne la dépression.", vrai: false, explication: "Les effets de la gratitude sont réels mais petits. La dépression se soigne avec un professionnel.", fiche: "gratitude" },
  { affirmation: "La méditation peut remplacer un traitement.", vrai: false, explication: "Face à un vrai traitement, la méditation ne fait pas mieux. Elle peut accompagner, pas remplacer.", fiche: "pleine-conscience" },
  { affirmation: "Un seul essai de respiration suffit pour savoir si ça marche pour soi.", vrai: false, explication: "Une séance peut déjà détendre, mais pour savoir si une pratique t'aide, essaie-la plusieurs jours et compare ton ressenti.", fiche: "respiration" },
  { affirmation: "Mieux vaut étouffer une émotion que la regarder en face.", vrai: false, explication: "Réévaluer la situation marche en général mieux que cacher ou étouffer ce qu'on ressent.", fiche: "reevaluer" },
  { affirmation: "Demander de l'aide à un professionnel, c'est pour les cas extrêmes seulement.", vrai: false, explication: "Si la tristesse ou l'anxiété dure plus de deux semaines et gêne ta vie, c'est déjà une bonne raison d'en parler.", fiche: "aide" },
];

// ----- Page « Si ça ne va vraiment pas » -------------------------------------------------------------------------

export interface Numero { nom: string; numero: string; tel: string; detail: string }

export const NUMEROS: Numero[] = [
  { nom: "Prévention du suicide", numero: "3114", tel: "3114", detail: "Gratuit, 24 h/24, 7 j/7. Pour toi ou pour un proche." },
  { nom: "Urgence (SAMU)", numero: "15", tel: "15", detail: "Danger immédiat pour ta santé ou ta vie." },
  { nom: "Urgence (numéro européen)", numero: "112", tel: "112", detail: "Depuis n'importe quel téléphone, partout en Europe." },
  { nom: "SOS Amitié", numero: "09 72 39 40 50", tel: "0972394050", detail: "Écoute anonyme, pour parler à quelqu'un quand ça pèse." },
];

export const SIGNES_CONSULTER = [
  "Tristesse ou anxiété depuis plus de deux semaines, qui gêne ta vie (cours, travail, sommeil, relations).",
  "Des idées de mort ou de te faire du mal.",
  "Besoin d'alcool, de médicaments ou d'autres produits pour tenir.",
  "Des crises de panique qui reviennent.",
];
