// Les explications de l'app : comment marche la mémoire, ce qui marche pour retenir, les techniques, l'hygiène
// de vie, avec les sources. ✅ = solidement prouvé, ⚠️ = discuté ou prouvé en partie.

export interface Source {
  texte: string;
  lien?: string;
}

export interface Fiche {
  id: string;
  titre: string;
  icone: string;
  /** Paragraphes courts. */
  paragraphes: string[];
  /** Ce qu'on en fait dans l'app. */
  dansLApp: string;
  sources: Source[];
}

export const FICHES: Fiche[] = [
  {
    id: "etapes", titre: "Comment marche ta mémoire", icone: "🧠",
    paragraphes: [
      "Retenir, c'est 3 étapes. 1) L'encodage : tu fais entrer l'information (et seulement si tu y fais attention). 2) La consolidation : pendant des heures et des nuits, le cerveau la fixe. 3) La récupération : tu vas la rechercher. Chaque fois que tu la retrouves, le souvenir devient plus solide.",
      "La mémoire de travail, c'est le bloc-notes de l'esprit : elle garde 3 à 5 éléments à la fois quand on ne peut pas les regrouper (le fameux « 7 » vient surtout des regroupements). La mémoire à long terme, elle, n'a pas de limite connue : le problème n'est pas la place, c'est de retrouver.",
      "On distingue les souvenirs vécus (épisodique : « où, quand »), les connaissances (sémantique : « Paris est la capitale ») et les savoir-faire (procédurale : faire du vélo).",
    ],
    dansLApp: "Les jeux d'échauffement font travailler la mémoire de travail ; le palais et les révisions espacées construisent la mémoire à long terme.",
    sources: [
      { texte: "Cowan (2001), la capacité de la mémoire de travail : environ 4 éléments", lien: "https://doi.org/10.1017/S0140525X01003922" },
      { texte: "Baddeley (2000), le modèle de la mémoire de travail", lien: "https://doi.org/10.1016/S1364-6613(00)01538-2" },
      { texte: "Squire (2004), les systèmes de mémoire du cerveau", lien: "https://doi.org/10.1016/j.nlm.2004.06.005" },
    ],
  },
  {
    id: "test", titre: "Se tester bat relire", icone: "✍️",
    paragraphes: [
      "✅ C'est la technique la mieux prouvée. Chercher la réponse dans sa tête, même sans la trouver, renforce le souvenir bien plus que relire. Une semaine après, des étudiants qui s'étaient testés retenaient environ 61 % du texte, contre 40 % pour ceux qui avaient relu.",
      "Un rappel un peu difficile marche mieux qu'un rappel facile : c'est normal que ce soit inconfortable. Le surlignage et la relecture donnent l'impression de savoir, sans faire retenir.",
    ],
    dansLApp: "Partout, tu dois taper la réponse avant de la voir. Jamais de « relis la liste ».",
    sources: [
      { texte: "Roediger & Karpicke (2006), l'effet de test", lien: "https://doi.org/10.1111/j.1467-9280.2006.01693.x" },
      { texte: "Dunlosky et al. (2013), comparaison de 10 techniques d'étude", lien: "https://doi.org/10.1177/1529100612453266" },
      { texte: "Karpicke & Blunt (2011), se tester bat les cartes mentales", lien: "https://doi.org/10.1126/science.1199327" },
    ],
  },
  {
    id: "espacement", titre: "Espacer les révisions", icone: "📅",
    paragraphes: [
      "✅ On oublie très vite au début, puis de plus en plus lentement (la courbe de l'oubli d'Ebbinghaus, refaite à l'identique en 2015). Chaque rappel au bon moment repousse l'oubli.",
      "Repère : pour un examen dans 1 mois, révise à peu près chaque semaine ; le meilleur écart est environ 10 à 20 % du temps pendant lequel tu veux retenir. Réviser 4 fois sur 4 jours bat réviser 4 fois la veille.",
    ],
    dansLApp: "Tes listes reviennent à J+1, J+3, J+7, J+14, J+30, J+60, J+120. Une liste mal retrouvée revient au début.",
    sources: [
      { texte: "Cepeda et al. (2006), méta-analyse de l'espacement", lien: "https://doi.org/10.1037/0033-2909.132.3.354" },
      { texte: "Cepeda et al. (2008), le meilleur écart selon la durée voulue", lien: "https://doi.org/10.1111/j.1467-9280.2008.02209.x" },
      { texte: "Murre & Dros (2015), la courbe d'Ebbinghaus refaite", lien: "https://doi.org/10.1371/journal.pone.0120644" },
    ],
  },
  {
    id: "palais", titre: "Le palais de mémoire", icone: "🏛️",
    paragraphes: [
      "✅ Tu choisis un lieu que tu connais par cœur (ton appartement, ton trajet), avec un parcours toujours dans le même ordre. Sur chaque étape (un « lieu »), tu poses une image de ce que tu veux retenir. Pour retrouver, tu refais la visite dans ta tête.",
      "✅ En 2017, des débutants qui l'ont pratiqué 30 minutes par jour pendant 6 semaines sont passés d'environ 26 à 62 mots retenus sur 72, et le gain était toujours là 4 mois plus tard. Le groupe qui faisait des jeux type n-back n'a rien gagné sur les mots. Les champions de mémoire n'ont pas un cerveau à part : 9 sur 10 utilisent cette méthode.",
      "Bien la faire : des lieux bien différents les uns des autres, 1 élément par lieu, des images en action, exagérées, drôles, avec des sons, des odeurs, du toucher. ⚠️ Le bizarre aide surtout quand il tranche : l'action et l'interaction avec le lieu comptent plus que le bizarre tout seul.",
      "⚠️ Limites : c'est excellent pour des listes dans l'ordre (mots, chiffres, plan d'exposé, étapes d'une méthode), moins pour comprendre une notion abstraite. Attends environ un jour avant de réutiliser un palais pour une nouvelle liste, sinon les anciennes images gênent.",
    ],
    dansLApp: "Crée tes palais dans « Palais », range des listes et révise-les. La séance du jour s'en sert presque chaque jour.",
    sources: [
      { texte: "Dresler et al. (2017), Neuron : 6 semaines d'entraînement, effet durable à 4 mois", lien: "https://doi.org/10.1016/j.neuron.2017.02.003" },
      { texte: "Maguire et al. (2003), les champions de mémoire", lien: "https://doi.org/10.1038/nn988" },
      { texte: "Twomey & Kroneisen (2021), méta-analyse de la méthode des lieux", lien: "https://doi.org/10.1177/1747021820990624" },
      { texte: "McDaniel & Einstein (1986), quand le bizarre aide", lien: "https://doi.org/10.1037/0278-7393.12.1.54" },
    ],
  },
  {
    id: "images", titre: "Fabriquer de bonnes images", icone: "🎨",
    paragraphes: [
      "✅ Ce que tu inventes toi-même se retient mieux que ce que tu lis (effet de génération). Ne prends pas l'image de quelqu'un d'autre : fabrique la tienne.",
      "Recette : ACTION (l'objet fait quelque chose) + EXAGÉRATION (énorme, minuscule, des milliers) + SENS (bruit, odeur, chaleur, douleur) + LIEN avec le lieu (l'objet abîme, mouille, écrase le lieu).",
      "Mot abstrait ? Trouve un objet qui le représente (liberté → un oiseau qui sort d'une cage) ou un mot qui sonne pareil (« économie » → « des cocos et des amis »).",
      "✅ Mot + image ensemble se retiennent mieux que le mot seul (double codage). Ça marche pour tout le monde : rien à voir avec les « styles d'apprentissage ».",
    ],
    dansLApp: "Quand tu ranges une liste, une case te demande ton image. Elle te sera montrée après chaque rappel.",
    sources: [
      { texte: "Bertsch et al. (2007), méta-analyse de l'effet de génération", lien: "https://doi.org/10.3758/BF03193441" },
      { texte: "Paivio (1971), Imagery and Verbal Processes (double codage)" },
    ],
  },
  {
    id: "major", titre: "Le système Major (chiffres)", icone: "🔢",
    paragraphes: [
      "Un chiffre ne s'imagine pas ; un mot, si. Chaque chiffre devient un son de consonne : 0 = s/z, 1 = t/d, 2 = n, 3 = m, 4 = r, 5 = l, 6 = ch/j, 7 = k/g, 8 = f/v, 9 = p/b. Les voyelles ne comptent pas, et on ne compte que ce qu'on entend.",
      "Exemple : 34 = m + r = « mur » ; 91 = p + t = « patte ». Un numéro de téléphone devient une petite histoire, ou 5 images posées dans ton palais.",
      "Pour aller vite, on apprend un mot fixe pour chaque nombre de 00 à 99 (c'est ce que tu fais en semaines 4 et 5). ⚠️ Très utilisé par les champions, peu étudié en laboratoire ; mais il repose sur deux choses prouvées : le regroupement et les images.",
      "Plus tard (pour les avancés) : le système PAO, une personne, une action et un objet pour chaque nombre, qui permet de mettre 6 chiffres dans une seule scène.",
    ],
    dansLApp: "Atelier → Système Major : la table, tes mots (modifiables) et l'entraînement. Jeu « Grand nombre » pour la pratique.",
    sources: [
      { texte: "Ericsson, Chase & Faloon (1980) : de 7 à 79 chiffres par regroupement", lien: "https://doi.org/10.1126/science.7375930" },
    ],
  },
  {
    id: "noms", titre: "Retenir les noms", icone: "🙂",
    paragraphes: [
      "✅/⚠️ Méthode en 3 temps : 1) repère un trait du visage (lunettes, oreilles, sourcils) ; 2) transforme le prénom en image (« Inès » → « un nez ») ; 3) relie les deux (un énorme nez posé sur ses lunettes). Elle marche en laboratoire, mais demande de l'entraînement pour être rapide en vraie conversation.",
      "Ce qui aide aussi tout de suite : répéter le prénom dès qu'on l'entend (« Enchanté, Inès »), l'utiliser une fois pendant la conversation, et se le redire à la fin (rappel espacé en miniature).",
    ],
    dansLApp: "Jeu « Noms et visages » et technique du jour en semaine 3 et 6.",
    sources: [{ texte: "Morris, Jones & Hampson (1978), une aide imagée pour retenir les noms", lien: "https://doi.org/10.1111/j.2044-8295.1978.tb01652.x" }],
  },
  {
    id: "vocabulaire", titre: "Vocabulaire : le mot-clé", icone: "🌍",
    paragraphes: [
      "✅ Pour un mot étranger, trouve un mot français qui sonne pareil, et fais une image qui relie ce mot au sens. « Knife » (couteau) sonne comme « nef » : un couteau géant planté dans la nef d'une église.",
      "Dans une étude célèbre sur du vocabulaire russe, on retenait environ 72 % des mots avec cette méthode, contre 46 % sans. ⚠️ L'avantage fond en quelques semaines si on ne révise pas : il faut la combiner avec la répétition espacée (Rayan's Révision).",
    ],
    dansLApp: "Technique « Vocabulaire : mot-clé » en semaine 5 ; les mots appris sont gardés comme liste à réviser.",
    sources: [
      { texte: "Atkinson & Raugh (1975), la méthode du mot-clé", lien: "https://doi.org/10.1037/h0076424" },
      { texte: "Wang & Thomas (1995), l'effet du mot-clé dans le temps", lien: "https://doi.org/10.1037/0022-0663.87.3.468" },
    ],
  },
  {
    id: "autres", titre: "Histoires, crochets, regroupement", icone: "🔗",
    paragraphes: [
      "✅ Histoire en chaîne : chaque mot fait quelque chose au suivant (« la pomme tombe sur le vélo, qui écrase la guitare… »). Ça améliore très fortement le rappel de listes.",
      "✅ Mots-crochets : 1 = un hun, 2 = du feu, 3 = une croix… On accroche le 1er élément au hun, le 2e au feu. Pratique pour une liste courte quand on n'a pas de palais sous la main.",
      "✅ Regroupement (chunking) : 0612345678 est dur ; 06 12 34 56 78, beaucoup moins. Les joueurs d'échecs retiennent des positions entières par blocs.",
      "⚠️ Acronymes et phrases-clés (« Mon Vieux Tu Me… ») : pratiques pour retenir un ordre, mais ils n'aident pas à comprendre.",
    ],
    dansLApp: "Techniques du jour « Histoire en chaîne » et « Mots-crochets » ; le jeu « Grand nombre » affiche les chiffres par blocs.",
    sources: [
      { texte: "Bower & Clark (1969), les histoires pour retenir des listes", lien: "https://doi.org/10.3758/BF03332778" },
      { texte: "Chase & Simon (1973), la perception aux échecs" },
    ],
  },
  {
    id: "jeux", titre: "Les jeux de mémoire : ce qu'ils font vraiment", icone: "🎮",
    paragraphes: [
      "Honnêtement : les jeux comme le n-back ou les suites de chiffres te rendent surtout meilleur… à ces jeux et à des tâches très proches. Les grandes méta-analyses ne trouvent pas de gain sur l'intelligence, la lecture ou les maths (⚠️ une méta-analyse trouve un petit effet du n-back, c'est le point discuté).",
      "Ce qui sert vraiment dans la vie, ce sont les stratégies : se tester, espacer, le palais, le Major. C'est pour ça que la séance du jour donne 2 minutes aux jeux (échauffement et mesure) et le reste aux techniques.",
      "La difficulté de chaque jeu suit la règle de l'escalier : 2 réussites de suite → plus dur, 1 échec → plus facile. Tu te stabilises autour de 70 % de réussite : le bon niveau pour progresser.",
    ],
    dansLApp: "« Ce jeu entraîne ce jeu ; la technique, elle, sert partout. »",
    sources: [
      { texte: "Melby-Lervåg, Redick & Hulme (2016), méta-analyse de l'entraînement de la mémoire de travail", lien: "https://doi.org/10.1177/1745691616635612" },
      { texte: "Sala et al. (2019), méta-analyse des méta-analyses", lien: "https://doi.org/10.1525/collabra.203" },
      { texte: "Au et al. (2015), le petit effet discuté du n-back", lien: "https://doi.org/10.3758/s13423-014-0699-x" },
      { texte: "Levitt (1971), la règle de l'escalier (2 réussites, 1 échec)", lien: "https://doi.org/10.1121/1.1912375" },
    ],
  },
  {
    id: "vie", titre: "Sommeil, sport, stress, pauses", icone: "🌙",
    paragraphes: [
      "✅ Sommeil : c'est la nuit que le cerveau fixe ce que tu as appris. Une nuit blanche réduit d'environ 40 % la capacité à apprendre le lendemain. Réviser le soir et se retester le matin, c'est profiter du sommeil.",
      "✅/⚠️ Sport : chez des adultes âgés, un an de marche rapide a fait grossir l'hippocampe (la zone clé de la mémoire) d'environ 2 %. Chez les jeunes, l'effet est plus petit, mais bouger reste bon pour l'attention et le sommeil.",
      "✅ Stress : un gros stress juste avant de rappeler bloque la mémoire ; s'être beaucoup testé avant protège contre ce blocage (utile pour les examens).",
      "✅ Pause : quelques minutes au calme, les yeux fermés, sans écran, juste après avoir appris aident à retenir. Et on retient mal ce à quoi on n'a pas fait attention : téléphone en « Ne pas déranger » pendant la séance.",
    ],
    dansLApp: "La séance du jour contient une minute de pause calme, et le bilan te rappelle de dormir et de bouger.",
    sources: [
      { texte: "Rasch & Born (2013), le sommeil et la mémoire", lien: "https://doi.org/10.1152/physrev.00032.2012" },
      { texte: "Yoo et al. (2007), la nuit blanche et l'apprentissage", lien: "https://doi.org/10.1038/nn1851" },
      { texte: "Erickson et al. (2011), sport et hippocampe", lien: "https://doi.org/10.1073/pnas.1015950108" },
      { texte: "Smith et al. (2016), se tester protège du stress", lien: "https://doi.org/10.1126/science.aaf5578" },
      { texte: "Dewar et al. (2012), le repos juste après avoir appris", lien: "https://doi.org/10.1177/0956797612441220" },
    ],
  },
];

export interface Mythe {
  affirmation: string;
  vrai: boolean;
  explication: string;
  source?: Source;
}

export const MYTHES: Mythe[] = [
  { affirmation: "On n'utilise que 10 % de son cerveau.", vrai: false, explication: "Faux. L'imagerie montre que toutes les zones servent, et une lésion n'importe où a des effets.", source: { texte: "Dekker et al. (2012), les neuromythes", lien: "https://doi.org/10.3389/fpsyg.2012.00429" } },
  { affirmation: "Chacun apprend mieux selon son style : visuel, auditif ou kinesthésique.", vrai: false, explication: "Faux. Aucune preuve qu'enseigner selon son « style » aide. En revanche, tout le monde retient mieux avec mot + image.", source: { texte: "Pashler et al. (2008), les styles d'apprentissage", lien: "https://doi.org/10.1111/j.1539-6053.2009.01038.x" } },
  { affirmation: "Certains adultes ont une mémoire photographique parfaite.", vrai: false, explication: "Faux. Aucun adulte ne l'a démontré en laboratoire. Les champions utilisent des techniques apprises.", source: { texte: "Maguire et al. (2003)", lien: "https://doi.org/10.1038/nn988" } },
  { affirmation: "Les jeux de « brain training » rendent plus intelligent.", vrai: false, explication: "Faux. On progresse au jeu, pas en intelligence générale. Lumosity a même été condamné pour publicité trompeuse aux États-Unis en 2016.", source: { texte: "Simons et al. (2016)", lien: "https://doi.org/10.1177/1529100616661983" } },
  { affirmation: "Se tester fait mieux retenir que relire.", vrai: true, explication: "Vrai, c'est la technique la mieux prouvée (effet de test).", source: { texte: "Roediger & Karpicke (2006)", lien: "https://doi.org/10.1111/j.1467-9280.2006.01693.x" } },
  { affirmation: "Réviser 4 fois la veille vaut autant que 4 fois sur 4 jours.", vrai: false, explication: "Faux. À temps égal, espacer fait retenir beaucoup plus longtemps.", source: { texte: "Cepeda et al. (2006)", lien: "https://doi.org/10.1037/0033-2909.132.3.354" } },
  { affirmation: "Le palais de mémoire peut être appris par n'importe qui en quelques semaines.", vrai: true, explication: "Vrai : en 6 semaines, des débutants ont plus que doublé leur score, et le gain tenait encore 4 mois plus tard.", source: { texte: "Dresler et al. (2017)", lien: "https://doi.org/10.1016/j.neuron.2017.02.003" } },
  { affirmation: "La mémoire de travail garde environ 7 éléments, quoi qu'il arrive.", vrai: false, explication: "Plutôt 3 à 5 sans regrouper. Le « 7 » vient surtout des regroupements (06 12 34…).", source: { texte: "Cowan (2001)", lien: "https://doi.org/10.1017/S0140525X01003922" } },
  { affirmation: "Dormir après avoir appris aide à retenir.", vrai: true, explication: "Vrai : le sommeil fixe les souvenirs de la journée.", source: { texte: "Rasch & Born (2013)", lien: "https://doi.org/10.1152/physrev.00032.2012" } },
  { affirmation: "Surligner son cours est une bonne façon de l'apprendre.", vrai: false, explication: "Faux : jugé « peu utile ». Ça donne l'impression de savoir sans faire retenir.", source: { texte: "Dunlosky et al. (2013)", lien: "https://doi.org/10.1177/1529100612453266" } },
  { affirmation: "Les champions de mémoire ont un cerveau différent dès la naissance.", vrai: false, explication: "Faux : même intelligence, même structure ; ils utilisent une technique (surtout le palais).", source: { texte: "Maguire et al. (2003)", lien: "https://doi.org/10.1038/nn988" } },
  { affirmation: "Un gros stress juste avant un examen peut bloquer la mémoire.", vrai: true, explication: "Vrai, mais s'être beaucoup testé avant protège contre ce blocage.", source: { texte: "Smith et al. (2016)", lien: "https://doi.org/10.1126/science.aaf5578" } },
  { affirmation: "Ce qu'on invente soi-même se retient mieux que ce qu'on lit.", vrai: true, explication: "Vrai : c'est l'effet de génération. D'où l'intérêt d'inventer tes propres images.", source: { texte: "Bertsch et al. (2007)", lien: "https://doi.org/10.3758/BF03193441" } },
  { affirmation: "Une image bizarre se retient toujours mieux qu'une image normale.", vrai: false, explication: "Pas toujours : le bizarre aide surtout quand il tranche avec le reste. L'action compte plus.", source: { texte: "McDaniel & Einstein (1986)", lien: "https://doi.org/10.1037/0278-7393.12.1.54" } },
];

/** Conseils du bilan, en rotation. */
export const CONSEILS = [
  "Ce soir, dors 7 à 9 heures : c'est cette nuit que ta séance se fixe.",
  "Demain matin, essaie de te redire la liste d'aujourd'hui avant même d'ouvrir l'app.",
  "20 minutes de marche ou de course aujourd'hui, c'est bon pour l'attention et le sommeil.",
  "Pendant la séance, téléphone en « Ne pas déranger » : on retient mal ce à quoi on ne fait pas attention.",
  "Pour un examen, teste-toi plutôt que relire : ça protège aussi contre le blocage dû au stress.",
  "Range le plan de ton prochain exposé dans un palais : une partie par lieu.",
  "Quand tu rencontres quelqu'un, redis son prénom tout de suite, puis une fois à la fin.",
];
