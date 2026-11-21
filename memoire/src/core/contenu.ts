// Contenu des exercices : mots, prénoms, objets, mots du système Major, vocabulaire.

/** Noms concrets, faciles à imaginer (semaines 1 et 2). */
export const MOTS_CONCRETS = [
  "pomme", "vélo", "guitare", "éléphant", "parapluie", "bougie", "marteau", "baleine", "chapeau", "fusée",
  "citron", "piano", "tortue", "ballon", "échelle", "girafe", "lampe", "valise", "ciseaux", "dragon",
  "fromage", "volcan", "trompette", "pingouin", "horloge", "cactus", "couronne", "requin", "tambour", "nuage",
  "brosse", "camion", "fourchette", "hibou", "miroir", "ananas", "ancre", "bateau", "carotte", "clé",
  "crocodile", "diamant", "éponge", "fantôme", "fraise", "gorille", "hamac", "igloo", "kangourou", "lion",
  "loupe", "masque", "moustache", "oreiller", "panda", "perroquet", "pizza", "poisson", "pyramide", "radio",
  "robot", "sablier", "savon", "serpent", "sirène", "tasse", "téléphone", "tente", "tigre", "tomate",
  "train", "trésor", "tronçonneuse", "vache", "violon", "zèbre", "aimant", "araignée", "avion", "bague",
  "banane", "bouteille", "boomerang", "chaussette", "chocolat", "cloche", "coussin", "dauphin", "escargot", "étoile",
  "flèche", "gant", "glace", "grenouille", "hélicoptère", "jongleur", "koala", "lunettes", "médaille", "moto",
  "ours", "pastèque", "plume", "pneu", "râteau", "renard", "sac", "seau", "singe", "parachute",
  "statue", "tapis", "tracteur", "trampoline", "ventilateur", "abeille", "toboggan", "cerceau", "boussole", "cerise",
] as const;

/** Mots abstraits : il faut d'abord les transformer en image (semaine 3). */
export const MOTS_ABSTRAITS = [
  "liberté", "justice", "patience", "courage", "honte", "espoir", "sagesse", "colère", "vitesse", "silence",
  "économie", "démocratie", "énergie", "mémoire", "confiance", "jalousie", "victoire", "danger", "chance", "temps",
  "paix", "guerre", "richesse", "pauvreté", "amitié", "fatigue", "vérité", "mensonge", "beauté", "peur",
  "joie", "tristesse", "santé", "progrès", "loi", "religion", "science", "histoire", "avenir", "passé",
  "logique", "équilibre", "pouvoir", "respect", "gratitude", "curiosité", "humilité", "talent", "erreur", "sécurité",
  "nature", "culture", "travail", "repos", "ordre", "chaos", "promesse", "devoir", "solitude", "rêve",
] as const;

/** Exemples pour transformer un mot abstrait en image. */
export const EXEMPLES_ABSTRAITS: [string, string][] = [
  ["liberté", "un oiseau qui s'échappe d'une cage dorée"],
  ["justice", "une balance géante qui t'écrase le pied"],
  ["économie", "une tirelire-cochon qui court partout"],
  ["patience", "une tortue qui attend devant un micro-ondes"],
  ["démocratie", "une urne qui avale des bulletins en rotant"],
];

export const PRENOMS_H = [
  "Adam", "Yanis", "Lucas", "Karim", "Mehdi", "Hugo", "Nathan", "Bilal", "Rayan", "Ilyes",
  "Théo", "Sofiane", "Louis", "Malik", "Enzo", "Ismaël", "Hamza", "Noah", "Omar", "Jules",
  "Samy", "Tom", "Anis", "Ethan", "Gabriel",
] as const;

export const PRENOMS_F = [
  "Inès", "Sarah", "Lina", "Emma", "Chloé", "Amira", "Léa", "Camille", "Jade", "Manon",
  "Yasmine", "Clara", "Nour", "Zoé", "Salomé", "Julie", "Alice", "Maëlys", "Anaïs", "Aya",
  "Lou", "Myriam", "Romane", "Kenza", "Elsa",
] as const;

/** Objets pour les paires et l'objet disparu. */
export const OBJETS = [
  "🍎", "🚲", "🎸", "🐘", "☂️", "🕯️", "🔨", "🐋", "🎩", "🚀", "🍋", "🎹", "🐢", "⚽", "🦒", "💡",
  "🧳", "✂️", "🐉", "🧀", "🌋", "🎺", "🐧", "⏰", "🌵", "👑", "🦈", "🥁", "☁️", "🦉", "🪞", "🍍",
  "⚓", "⛵", "🥕", "🔑", "🐊", "💎", "👻", "🍓", "🦍", "🦘", "🦁", "🔍", "🐼", "🦜", "🍕", "🐟",
  "🤖", "⏳", "🐍", "☕", "📱", "⛺", "🐯", "🍅", "🚂", "🎻", "🦓", "🕷️", "✈️", "💍", "🍌", "🧦",
] as const;

/**
 * Système Major : chaque chiffre est un son de consonne. Les voyelles, les lettres muettes et les sons
 * « y », « w », « h » ne comptent pas. On ne compte que ce qu'on ENTEND.
 */
export const MAJOR_SONS: { chiffre: number; sons: string; astuce: string }[] = [
  { chiffre: 0, sons: "s, z", astuce: "z comme zéro" },
  { chiffre: 1, sons: "t, d", astuce: "le t a une seule barre" },
  { chiffre: 2, sons: "n", astuce: "le n a deux jambes" },
  { chiffre: 3, sons: "m", astuce: "le m a trois jambes" },
  { chiffre: 4, sons: "r", astuce: "quatre finit par r" },
  { chiffre: 5, sons: "l", astuce: "la main ouverte : 5 doigts, le pouce et l'index font un L" },
  { chiffre: 6, sons: "ch, j", astuce: "six et « ch » : le 6 ressemble à un j retourné" },
  { chiffre: 7, sons: "k, g (dur)", astuce: "le 7 ressemble à un K coupé" },
  { chiffre: 8, sons: "f, v", astuce: "le 8 ressemble à un f manuscrit" },
  { chiffre: 9, sons: "p, b", astuce: "le 9 retourné est un p, à l'envers un b" },
];

/** Une proposition de mot pour chaque nombre de 00 à 99 (modifiable dans l'app). */
export const MAJOR_MOTS: string[] = [
  "sauce", "site", "Seine", "sumo", "cire", "sel", "sauge", "sac", "sofa", "soupe",
  "tasse", "tête", "tonneau", "dame", "tour", "toile", "douche", "dague", "diva", "tapis",
  "noce", "note", "nonne", "nem", "nord", "Nil", "neige", "nuque", "navet", "nappe",
  "mousse", "moto", "mine", "momie", "mur", "mule", "mouche", "mug", "mafia", "mob",
  "rose", "rôti", "reine", "rame", "rire", "ruelle", "roche", "roc", "rêve", "robe",
  "lasso", "latte", "laine", "lime", "lyre", "lilas", "louche", "lac", "lave", "loupe",
  "chaise", "château", "chaîne", "chameau", "jarre", "châle", "juge", "chèque", "chef", "jupe",
  "gaz", "gâteau", "canne", "gomme", "car", "colle", "cage", "coq", "cave", "cube",
  "vase", "photo", "vanne", "femme", "phare", "fil", "vache", "phoque", "fève", "vape",
  "bus", "patte", "benne", "pomme", "poire", "pelle", "biche", "bec", "pouf", "bébé",
];

export const majorCle = (n: number): string => String(n).padStart(2, "0");

/** Mots anglais pour la méthode du mot-clé (on invente soi-même le mot-clé). */
export const VOCABULAIRE: { mot: string; sens: string; exemple?: string }[] = [
  { mot: "cat", sens: "chat", exemple: "un chat assis sur une « quatre »-chevaux" },
  { mot: "bread", sens: "pain", exemple: "une baguette qui fait du « bride »… de cheval" },
  { mot: "knife", sens: "couteau", exemple: "un couteau planté dans une « nef » d'église" },
  { mot: "pillow", sens: "oreiller" },
  { mot: "wheel", sens: "roue" },
  { mot: "ladder", sens: "échelle" },
  { mot: "thief", sens: "voleur" },
  { mot: "bridge", sens: "pont" },
  { mot: "sheep", sens: "mouton" },
  { mot: "lawyer", sens: "avocat (métier)" },
  { mot: "spoon", sens: "cuillère" },
  { mot: "tooth", sens: "dent" },
  { mot: "shelf", sens: "étagère" },
  { mot: "sword", sens: "épée" },
  { mot: "cloud", sens: "nuage" },
  { mot: "ghost", sens: "fantôme" },
  { mot: "honey", sens: "miel" },
  { mot: "jail", sens: "prison" },
  { mot: "kidney", sens: "rein" },
  { mot: "mole", sens: "taupe" },
  { mot: "nail", sens: "clou, ongle" },
  { mot: "owl", sens: "hibou" },
  { mot: "pear", sens: "poire" },
  { mot: "rope", sens: "corde" },
  { mot: "snail", sens: "escargot" },
  { mot: "tear", sens: "larme" },
  { mot: "wealth", sens: "richesse" },
  { mot: "witch", sens: "sorcière" },
  { mot: "brain", sens: "cerveau" },
  { mot: "forest", sens: "forêt" },
];

/** Mots-crochets : chaque nombre de 1 à 10 rime avec un objet. */
export const CROCHETS: [number, string][] = [
  [1, "un hun (guerrier à cheval)"],
  [2, "du feu"],
  [3, "une croix"],
  [4, "une carte (à jouer)"],
  [5, "une dinde (cinq… dinde)"],
  [6, "une saucisse"],
  [7, "une assiette"],
  [8, "une huître"],
  [9, "un œuf (neuf)"],
  [10, "un dix… ou une disquette"],
];

/** Idées de lieux pour construire un palais chez soi, dans l'ordre d'une visite. */
export const IDEES_LIEUX = [
  "Porte d'entrée", "Paillasson", "Porte-manteau", "Miroir de l'entrée", "Canapé", "Télévision", "Table basse",
  "Fenêtre du salon", "Table à manger", "Frigo", "Évier", "Plaques de cuisson", "Four", "Poubelle",
  "Lavabo", "Douche", "Toilettes", "Lit", "Bureau", "Armoire", "Étagère", "Radiateur", "Balcon",
];

/** Normalise un mot pour comparer une réponse : minuscules, sans accents, sans espaces ni ponctuation en trop. */
export function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Deux mots « pareils » : identiques une fois normalisés, ou une seule faute de frappe pour les mots longs. */
export function memeMot(a: string, b: string): boolean {
  const x = normaliser(a);
  const y = normaliser(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // Pluriel simple
  if (x + "s" === y || y + "s" === x || x + "x" === y || y + "x" === x) return true;
  if (Math.min(x.length, y.length) < 5) return false;
  return distance(x, y) <= 1;
}

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Réponse juste ? Accepte chacun des sens séparés par une virgule, sans ce qui est entre parenthèses. */
export function bonneReponse(attendu: string, reponse: string): boolean {
  const sens = attendu.replace(/\([^)]*\)/g, "").split(/[,/]/).map((x) => x.trim()).filter(Boolean);
  return sens.some((x) => memeMot(x, reponse)) || memeMot(attendu, reponse);
}

/** Compte les mots retrouvés (n'importe quel ordre, chaque mot compté une fois). */
export function compterRetrouves(attendus: readonly string[], reponses: readonly string[]): { trouves: string[]; manques: string[]; intrus: string[] } {
  const restants = attendus.slice();
  const trouves: string[] = [];
  const intrus: string[] = [];
  for (const r of reponses) {
    if (!normaliser(r)) continue;
    const i = restants.findIndex((a) => memeMot(a, r));
    if (i >= 0) trouves.push(restants.splice(i, 1)[0]);
    else intrus.push(r);
  }
  return { trouves, manques: restants, intrus };
}

/** Découpe la saisie libre (espaces, virgules, retours à la ligne) en mots. */
export function decouperSaisie(texte: string): string[] {
  return texte.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
}
