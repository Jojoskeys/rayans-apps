// Les questions : leur forme, et la banque fixe de culture générale (faits stables et vérifiables, pas de sujet
// religieux). Elle fait marcher l'app même sans fichier d'actualité. La première réponse de `choix` n'est pas
// forcément la bonne : c'est `bonne` qui le dit ; l'ordre affiché est mélangé à chaque fois.

export type Theme = "geo" | "histoire" | "sciences" | "arts" | "societe" | "numerique" | "actu";
export const THEMES: { id: Theme; nom: string; icone: string }[] = [
  { id: "actu", nom: "Actualité", icone: "📰" },
  { id: "geo", nom: "Géographie", icone: "🗺️" },
  { id: "histoire", nom: "Histoire", icone: "🏛️" },
  { id: "sciences", nom: "Sciences", icone: "🔬" },
  { id: "arts", nom: "Arts et lettres", icone: "🎨" },
  { id: "societe", nom: "Société et institutions", icone: "⚖️" },
  { id: "numerique", nom: "Numérique", icone: "💻" },
];
export const nomTheme = (t: Theme) => THEMES.find((x) => x.id === t)?.nom ?? t;

export type Difficulte = 1 | 2 | 3;

export interface Question {
  id: string;
  theme: Theme;
  difficulte: Difficulte;
  enonce: string;
  choix: string[];
  /** Indice de la bonne réponse dans `choix`. */
  bonne: number;
  /** Vrai ou faux : `choix` vaut ["Vrai", "Faux"] et n'est pas mélangé. */
  vf?: boolean;
  explication: string;
  lien?: string;
}

const THEME_IDS = new Set<string>(THEMES.map((t) => t.id));

/** Vérifie une question lue dans un fichier (copie d'une question d'actu). */
export function estQuestion(x: unknown): x is Question {
  if (!x || typeof x !== "object") return false;
  const q = x as Record<string, unknown>;
  return typeof q.id === "string" && typeof q.enonce === "string" && THEME_IDS.has(String(q.theme))
    && (q.difficulte === 1 || q.difficulte === 2 || q.difficulte === 3)
    && Array.isArray(q.choix) && q.choix.length >= 2 && q.choix.every((c) => typeof c === "string")
    && typeof q.bonne === "number" && Number.isInteger(q.bonne) && q.bonne >= 0 && q.bonne < q.choix.length
    && typeof q.explication === "string" && (q.lien === undefined || (typeof q.lien === "string" && /^https?:\/\//i.test(q.lien)));
}

const qcm = (id: string, theme: Theme, difficulte: Difficulte, enonce: string, bonne: string, autres: string[], explication: string): Question =>
  ({ id: `f-${id}`, theme, difficulte, enonce, choix: [bonne, ...autres], bonne: 0, explication });
const vf = (id: string, theme: Theme, difficulte: Difficulte, enonce: string, vrai: boolean, explication: string): Question =>
  ({ id: `f-${id}`, theme, difficulte, enonce, choix: ["Vrai", "Faux"], bonne: vrai ? 0 : 1, vf: true, explication });

export const BANQUE: Question[] = [
  // Géographie
  qcm("capitale-australie", "geo", 2, "Quelle est la capitale de l'Australie ?", "Canberra", ["Sydney", "Melbourne", "Perth"], "Canberra a été construite pour être la capitale, à mi-chemin entre Sydney et Melbourne, qui se disputaient ce rôle."),
  qcm("capitale-canada", "geo", 2, "Quelle est la capitale du Canada ?", "Ottawa", ["Toronto", "Montréal", "Vancouver"], "Ottawa, en Ontario. Toronto est la plus grande ville du pays."),
  qcm("capitale-turquie", "geo", 2, "Quelle est la capitale de la Turquie ?", "Ankara", ["Istanbul", "Izmir", "Antalya"], "Ankara est la capitale depuis 1923 ; Istanbul reste la plus grande ville."),
  qcm("fleuve-france", "geo", 1, "Quel est le plus long fleuve de France ?", "La Loire", ["La Seine", "Le Rhône", "La Garonne"], "La Loire fait environ 1 000 km, entièrement en France."),
  qcm("fleuve-afrique", "geo", 2, "Quel est le plus long fleuve d'Afrique ?", "Le Nil", ["Le Congo", "Le Niger", "Le Zambèze"], "Le Nil, environ 6 650 km, traverse notamment l'Ouganda, le Soudan et l'Égypte."),
  qcm("ocean", "geo", 1, "Quel est le plus grand océan du monde ?", "Le Pacifique", ["L'Atlantique", "L'océan Indien", "L'océan Arctique"], "Le Pacifique couvre environ un tiers de la surface de la Terre."),
  qcm("everest", "geo", 1, "Quel est le plus haut sommet du monde ?", "L'Everest", ["Le K2", "Le mont Blanc", "L'Aconcagua"], "L'Everest, environ 8 849 m, à la frontière entre le Népal et la Chine."),
  qcm("mont-blanc", "geo", 3, "Quelle est, à peu près, l'altitude du mont Blanc ?", "4 800 m", ["3 800 m", "5 800 m", "6 800 m"], "Environ 4 805 m ; la mesure varie un peu selon l'épaisseur de neige au sommet."),
  qcm("sahara", "geo", 2, "Quel est le plus grand désert chaud du monde ?", "Le Sahara", ["Le désert de Gobi", "Le Kalahari", "L'Atacama"], "Le Sahara. Si l'on compte les déserts froids, l'Antarctique est encore plus grand."),
  qcm("machu-picchu", "geo", 2, "Dans quel pays se trouve le Machu Picchu ?", "Le Pérou", ["La Bolivie", "Le Mexique", "Le Chili"], "Le Machu Picchu est une cité inca des Andes péruviennes, du XVe siècle."),
  qcm("bresil-langue", "geo", 1, "Quelle est la langue officielle du Brésil ?", "Le portugais", ["L'espagnol", "Le brésilien", "L'anglais"], "Le Brésil a été une colonie portugaise ; c'est le pays qui compte le plus de lusophones."),
  qcm("japon-monnaie", "geo", 1, "Quelle est la monnaie du Japon ?", "Le yen", ["Le yuan", "Le won", "Le baht"], "Le yen. Le yuan est la monnaie de la Chine, le won celle de la Corée du Sud."),
  qcm("sicile", "geo", 3, "Quelle est la plus grande île de la Méditerranée ?", "La Sicile", ["La Sardaigne", "Chypre", "La Corse"], "La Sicile (environ 25 700 km²), devant la Sardaigne."),
  qcm("regions-france", "geo", 3, "Combien de régions compte la France métropolitaine depuis 2016 ?", "13", ["18", "22", "27"], "13 en métropole depuis la réforme de 2016 (18 en comptant l'outre-mer)."),

  // Histoire
  qcm("mur-berlin", "histoire", 1, "En quelle année est tombé le mur de Berlin ?", "1989", ["1979", "1991", "1985"], "Le 9 novembre 1989 ; l'Allemagne a été réunifiée l'année suivante."),
  qcm("armistice-1918", "histoire", 1, "Quel jour a été signé l'armistice de la Première Guerre mondiale ?", "Le 11 novembre 1918", ["Le 8 mai 1918", "Le 14 juillet 1919", "Le 11 novembre 1914"], "Le 11 novembre 1918, à Rethondes, près de Compiègne."),
  qcm("fin-ww2-europe", "histoire", 1, "Quel jour la Seconde Guerre mondiale s'est-elle terminée en Europe ?", "Le 8 mai 1945", ["Le 6 juin 1944", "Le 11 novembre 1945", "Le 2 septembre 1939"], "Le 8 mai 1945, avec la capitulation de l'Allemagne. Le 6 juin 1944 est le Débarquement en Normandie."),
  qcm("lune-1969", "histoire", 1, "En quelle année un humain a-t-il marché sur la Lune pour la première fois ?", "1969", ["1959", "1972", "1965"], "Neil Armstrong, le 21 juillet 1969 (heure de Paris), lors de la mission Apollo 11."),
  qcm("ddhc", "histoire", 2, "En quelle année a été adoptée la Déclaration des droits de l'homme et du citoyen ?", "1789", ["1793", "1848", "1815"], "En août 1789, au début de la Révolution française."),
  qcm("cinquieme-republique", "histoire", 2, "Depuis quelle année la France vit-elle sous la Ve République ?", "1958", ["1946", "1968", "1981"], "La Constitution de la Ve République a été adoptée en 1958."),
  qcm("gutenberg", "histoire", 2, "Qui a mis au point l'imprimerie à caractères mobiles en Europe, vers 1450 ?", "Gutenberg", ["Galilée", "Léonard de Vinci", "Copernic"], "Johannes Gutenberg, à Mayence, au milieu du XVe siècle."),
  qcm("maastricht", "histoire", 3, "Quel traité, signé en 1992, a prévu la création de l'euro ?", "Le traité de Maastricht", ["Le traité de Rome", "Le traité de Lisbonne", "Le traité de Versailles"], "Maastricht (1992). Le traité de Rome (1957) avait fondé la Communauté économique européenne."),
  qcm("vote-femmes", "histoire", 3, "En quelle année les Françaises ont-elles obtenu le droit de vote ?", "1944", ["1918", "1936", "1958"], "Par une ordonnance d'avril 1944 ; elles ont voté pour la première fois en 1945."),
  vf("napoleon-petit", "histoire", 3, "Napoléon était particulièrement petit pour son époque.", false, "Faux : il mesurait environ 1,69 m, une taille moyenne pour un Français de son temps. La légende vient surtout de la caricature anglaise et d'une confusion entre unités de mesure."),

  // Sciences
  qcm("mercure", "sciences", 1, "Quelle est la planète la plus proche du Soleil ?", "Mercure", ["Vénus", "Mars", "La Terre"], "Mercure. Vénus est la deuxième, la Terre la troisième."),
  qcm("jupiter", "sciences", 1, "Quelle est la plus grande planète du système solaire ?", "Jupiter", ["Saturne", "Neptune", "La Terre"], "Jupiter, une géante gazeuse plus de 300 fois plus massive que la Terre."),
  qcm("eau", "sciences", 1, "Quelle est la formule chimique de l'eau ?", "H₂O", ["CO₂", "O₂", "H₂O₂"], "Deux atomes d'hydrogène et un d'oxygène. H₂O₂ est l'eau oxygénée."),
  qcm("or", "sciences", 2, "Quel est le symbole chimique de l'or ?", "Au", ["Or", "Ag", "Go"], "Au, du latin aurum. Ag est l'argent (argentum)."),
  qcm("air-azote", "sciences", 2, "Quel gaz est le plus abondant dans l'air que l'on respire ?", "L'azote", ["L'oxygène", "Le dioxyde de carbone", "L'argon"], "L'azote, environ 78 % ; l'oxygène environ 21 %."),
  qcm("lumiere", "sciences", 2, "À quelle vitesse, environ, la lumière se déplace-t-elle dans le vide ?", "300 000 km par seconde", ["300 000 km par heure", "30 000 km par seconde", "3 millions de km par seconde"], "Environ 300 000 km/s (exactement 299 792 458 m/s)."),
  qcm("os", "sciences", 2, "Combien d'os compte, en général, le squelette d'un adulte ?", "206", ["150", "270", "312"], "206 en général. Un bébé en a davantage : certains se soudent en grandissant."),
  qcm("insuline", "sciences", 2, "Quel organe produit l'insuline ?", "Le pancréas", ["Le foie", "Les reins", "La rate"], "Le pancréas. L'insuline fait baisser le taux de sucre dans le sang."),
  qcm("ohm", "sciences", 2, "Quelle est l'unité de la résistance électrique ?", "L'ohm", ["Le volt", "L'ampère", "Le watt"], "L'ohm (Ω). Le volt mesure la tension, l'ampère l'intensité, le watt la puissance."),
  qcm("hydrogene", "sciences", 3, "Quel est l'élément chimique le plus abondant dans l'Univers ?", "L'hydrogène", ["L'hélium", "L'oxygène", "Le carbone"], "L'hydrogène, environ trois quarts de la matière ordinaire ; l'hélium vient ensuite."),
  qcm("mendeleiev", "sciences", 3, "Qui a proposé, en 1869, le tableau périodique des éléments ?", "Dmitri Mendeleïev", ["Antoine Lavoisier", "John Dalton", "Ernest Rutherford"], "Mendeleïev y laissa même des cases vides pour des éléments pas encore découverts, qui furent trouvés ensuite."),
  qcm("fleming", "sciences", 2, "Qui a découvert la pénicilline, en 1928 ?", "Alexander Fleming", ["Louis Pasteur", "Marie Curie", "Robert Koch"], "Alexander Fleming, en remarquant qu'une moisissure empêchait des bactéries de pousser."),
  qcm("relativite", "sciences", 1, "Qui a formulé la théorie de la relativité ?", "Albert Einstein", ["Isaac Newton", "Niels Bohr", "Stephen Hawking"], "Albert Einstein : relativité restreinte en 1905, générale en 1915."),
  vf("adn", "sciences", 1, "La molécule d'ADN a la forme d'une double hélice.", true, "Vrai : structure décrite en 1953 par Watson et Crick, grâce notamment aux images de Rosalind Franklin."),
  vf("muraille", "sciences", 2, "La Grande Muraille de Chine est visible à l'œil nu depuis la Lune.", false, "Faux : elle est bien trop étroite. Même depuis l'orbite basse (environ 400 km), on la distingue très difficilement."),
  vf("eclair", "sciences", 2, "La foudre ne tombe jamais deux fois au même endroit.", false, "Faux : les points hauts sont frappés souvent ; l'Empire State Building est frappé en moyenne une vingtaine de fois par an."),
  vf("ebullition", "sciences", 2, "En haute montagne, l'eau bout à plus de 100 °C.", false, "Faux : la pression de l'air est plus basse, donc l'eau bout en dessous de 100 °C (environ 85 °C au sommet du mont Blanc)."),

  // Arts et lettres
  qcm("miserables", "arts", 1, "Qui a écrit « Les Misérables » ?", "Victor Hugo", ["Émile Zola", "Honoré de Balzac", "Alexandre Dumas"], "Victor Hugo, publié en 1862."),
  qcm("joconde", "arts", 1, "Qui a peint « La Joconde » ?", "Léonard de Vinci", ["Michel-Ange", "Raphaël", "Rembrandt"], "Léonard de Vinci, au début du XVIe siècle ; elle est au Louvre."),
  qcm("petit-prince", "arts", 1, "Qui a écrit « Le Petit Prince » ?", "Antoine de Saint-Exupéry", ["Jules Verne", "Albert Camus", "Jean de La Fontaine"], "Antoine de Saint-Exupéry, publié en 1943."),
  qcm("etranger", "arts", 2, "Qui a écrit « L'Étranger » (1942) ?", "Albert Camus", ["Jean-Paul Sartre", "Marcel Proust", "Boris Vian"], "Albert Camus, prix Nobel de littérature en 1957."),
  qcm("tour-eiffel", "arts", 2, "Pour quel événement la tour Eiffel a-t-elle été construite ?", "L'Exposition universelle de 1889", ["Les Jeux olympiques de 1900", "La fin de la Première Guerre mondiale", "Le centenaire de Napoléon"], "Pour l'Exposition universelle de 1889, centenaire de la Révolution."),
  qcm("beethoven", "arts", 3, "Quel compositeur a écrit sa Neuvième Symphonie alors qu'il était presque sourd ?", "Beethoven", ["Mozart", "Bach", "Chopin"], "Ludwig van Beethoven, créée en 1824 ; son finale, l'« Ode à la joie », est l'hymne de l'Europe."),

  // Société et institutions
  qcm("ue-27", "societe", 1, "Combien de pays sont membres de l'Union européenne depuis le départ du Royaume-Uni (2020) ?", "27", ["25", "28", "30"], "27 depuis le Brexit, le 31 janvier 2020."),
  qcm("quinquennat", "societe", 1, "Pour combien d'années le président de la République française est-il élu ?", "5 ans", ["4 ans", "6 ans", "7 ans"], "5 ans depuis 2002 (le quinquennat) ; c'était 7 ans auparavant."),
  qcm("parlement-europeen", "societe", 2, "Dans quelle ville se trouve le siège officiel du Parlement européen ?", "Strasbourg", ["Bruxelles", "Luxembourg", "Genève"], "Strasbourg, où ont lieu les séances plénières ; une partie du travail se fait à Bruxelles."),
  qcm("onu-siege", "societe", 2, "Dans quelle ville se trouve le siège de l'ONU ?", "New York", ["Genève", "Paris", "Washington"], "New York. Genève accueille d'autres organes importants des Nations unies."),
  qcm("conseil-securite", "societe", 2, "Combien de membres permanents compte le Conseil de sécurité de l'ONU ?", "5", ["3", "7", "10"], "Cinq : Chine, États-Unis, France, Royaume-Uni et Russie, chacun avec un droit de veto."),
  qcm("pib", "societe", 2, "Que mesure le PIB d'un pays ?", "La valeur de ce qu'il produit en un an", ["La richesse de ses habitants les plus riches", "Sa dette publique", "Son nombre d'emplois"], "Le produit intérieur brut : la valeur des biens et services produits sur une période, en général un an."),
  qcm("inde-population", "societe", 3, "Quel pays est le plus peuplé du monde depuis 2023, selon l'ONU ?", "L'Inde", ["La Chine", "Les États-Unis", "L'Indonésie"], "L'Inde a dépassé la Chine en 2023, d'après les estimations des Nations unies."),

  // Numérique
  qcm("octet", "numerique", 2, "Combien de bits y a-t-il dans un octet ?", "8", ["4", "10", "16"], "Un octet = 8 bits, soit 256 valeurs possibles."),
  qcm("https", "numerique", 2, "Que signifie le « S » de HTTPS ?", "Sécurisé (la connexion est chiffrée)", ["Serveur", "Simple", "Standard"], "Secure : les échanges avec le site sont chiffrés. Cela ne prouve pas que le site soit honnête."),
  qcm("hameconnage", "numerique", 1, "Qu'est-ce que l'hameçonnage (phishing) ?", "Un faux message qui cherche à voler tes identifiants", ["Un virus qui ralentit l'ordinateur", "Une panne de réseau", "Un logiciel de sauvegarde"], "Un message imitant une banque, un service ou un proche pour te faire donner un mot de passe ou un code."),
  qcm("double-facteur", "numerique", 1, "À quoi sert la double authentification ?", "Demander une seconde preuve en plus du mot de passe", ["Avoir deux mots de passe identiques", "Se connecter deux fois plus vite", "Partager son compte avec un proche"], "Un code ou une clé en plus du mot de passe : un mot de passe volé ne suffit plus."),
  qcm("cpu", "numerique", 1, "Comment appelle-t-on la puce qui exécute les instructions d'un ordinateur ?", "Le processeur", ["La mémoire vive", "Le disque dur", "La carte réseau"], "Le processeur (CPU) ; la mémoire vive garde les données en cours d'utilisation."),
  vf("mode-prive", "numerique", 2, "La navigation privée rend anonyme sur Internet.", false, "Faux : elle évite seulement de garder l'historique sur ton appareil. Les sites, ton fournisseur d'accès ou ton employeur peuvent toujours voir ta connexion."),
];

const PAR_ID = new Map(BANQUE.map((q) => [q.id, q]));
export const questionBanque = (id: string): Question | undefined => PAR_ID.get(id);
