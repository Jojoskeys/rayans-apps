// Bibliothèque d'exercices : muscles travaillés, fonctionnement expliqué simplement, consignes techniques.
// Programme prudent pour les épaules : échauffement d'épaule avant chaque séance du haut du corps, pas de dips.

export interface Exercice {
  id: string;
  nom: string;
  /** Muscles principaux, puis secondaires. */
  muscles: string;
  /** Comment ça marche, en clair. */
  explication: string;
  /** Points techniques à respecter. */
  consignes: string[];
  /** Ce qu'on note : charge (kg), lest (kg ajoutés au poids du corps), poids du corps, ou durée. */
  mesure: "charge" | "lest" | "corps" | "duree";
  /** Charge par haltère (pour les exercices aux haltères). */
  parHaltere?: boolean;
  /** Une jambe ou un bras à la fois : reps par côté. */
  parCote?: boolean;
}

export const EXERCICES: Record<string, Exercice> = {
  "echauffement-epaule": {
    id: "echauffement-epaule", nom: "Échauffement des épaules", mesure: "corps",
    muscles: "Coiffe des rotateurs (petits muscles qui tiennent l'épaule), trapèzes moyens et inférieurs",
    explication: "La coiffe des rotateurs centre la tête de l'humérus dans l'articulation. Chaude et activée, elle protège l'épaule quand tu pousses lourd : c'est ce qui évite la gêne à l'avant de l'épaule.",
    consignes: ["Rotations externes à l'élastique, coude collé au corps : 2 × 15 par bras", "Écartés à l'élastique (pull-aparts), bras tendus : 2 × 15", "Puis 2 à 3 séries de montée en charge sur le premier exercice (barre vide, 50 %, 75 %)", "Douleur au-dessus de 1/10 : on garde la charge, on ne force pas"],
  },
  "developpe-couche": {
    id: "developpe-couche", nom: "Développé couché", mesure: "charge",
    muscles: "Pectoraux, triceps, avant des épaules",
    explication: "Tu pousses la barre loin de la poitrine : les pectoraux rapprochent les bras, les triceps tendent les coudes. C'est le mouvement roi de la force de poussée.",
    consignes: ["Omoplates serrées et basses, pieds ancrés au sol", "Descente contrôlée (2 s) jusqu'au bas des pectoraux, coudes à 45° du corps", "Pousse en remontant légèrement vers les yeux", "Garde 1 rep en réserve sur les séries de travail"],
  },
  "tractions-lestees": {
    id: "tractions-lestees", nom: "Tractions lestées", mesure: "lest",
    muscles: "Grand dorsal, biceps, arrière des épaules, avant-bras",
    explication: "Le grand dorsal tire les coudes vers les hanches et monte ton corps. Avec du lest, tu forces plus fort sur peu de reps : c'est ce qui fait progresser le nombre de tractions au poids du corps.",
    consignes: ["Départ bras tendus, épaules engagées (pas suspendu « mou »)", "Menton au-dessus de la barre, sans élan", "Descente contrôlée jusqu'en bas", "Lest à la ceinture ou haltère entre les pieds"],
  },
  "rowing-barre": {
    id: "rowing-barre", nom: "Rowing barre", mesure: "charge",
    muscles: "Grand dorsal, rhomboïdes, trapèzes, biceps ; lombaires en gainage",
    explication: "Penché en avant, tu tires la barre vers le nombril : le dos rapproche les omoplates et ramène les coudes. Ça épaissit le dos et équilibre le développé couché pour les épaules.",
    consignes: ["Buste à 45° environ, dos plat, genoux légèrement fléchis", "Tire vers le bas du ventre, coudes près du corps", "Serre les omoplates 1 s en haut", "Pas d'élan avec le buste"],
  },
  pompes: {
    id: "pompes", nom: "Pompes", mesure: "corps",
    muscles: "Pectoraux, triceps, avant des épaules, abdominaux en gainage",
    explication: "Comme un développé couché au poids du corps, avec le gainage en plus. Plus de séries propres = plus d'endurance de poussée.",
    consignes: ["Corps en planche du talon à la tête", "Poitrine à un poing du sol, coudes à 45°", "Rythme régulier, pas de demi-reps", "On s'arrête quand la forme se dégrade"],
  },
  planche: {
    id: "planche", nom: "Planche (gainage)", mesure: "duree",
    muscles: "Abdominaux profonds, obliques, fessiers",
    explication: "Tu résistes à la gravité qui veut te creuser le dos : la sangle abdominale apprend à rester rigide, utile pour la course, le squat et les figures.",
    consignes: ["Coudes sous les épaules, fessiers serrés", "Bassin légèrement rentré, dos neutre", "Respire normalement"],
  },
  squat: {
    id: "squat", nom: "Squat", mesure: "charge",
    muscles: "Quadriceps, fessiers, adducteurs ; dos en gainage",
    explication: "Tu t'assois entre tes talons puis tu te relèves : les quadriceps tendent les genoux, les fessiers ouvrent les hanches. C'est la base de la force des jambes et de la foulée.",
    consignes: ["Pieds largeur d'épaules, pointes légèrement ouvertes", "Genoux dans l'axe des pieds", "Descends au moins cuisses parallèles, dos neutre", "Pousse dans le sol, hanches et épaules montent ensemble"],
  },
  "sdt-roumain": {
    id: "sdt-roumain", nom: "Soulevé de terre roumain", mesure: "charge",
    muscles: "Ischio-jambiers, fessiers, lombaires",
    explication: "Jambes presque tendues, tu bascules le buste en reculant les fesses : l'arrière des cuisses s'étire puis ramène les hanches. Ça renforce la chaîne qui propulse en course.",
    consignes: ["Barre collée aux jambes tout le long", "Fesses en arrière, dos plat, genoux souples", "Descends jusqu'à sentir l'étirement (mi-tibia environ)", "Remonte en serrant les fessiers"],
  },
  fentes: {
    id: "fentes", nom: "Fentes haltères", mesure: "charge", parHaltere: true, parCote: true,
    muscles: "Quadriceps, fessiers, adducteurs ; équilibre",
    explication: "Une jambe à la fois : chaque jambe travaille seule, ce qui corrige les déséquilibres et prépare le pistol squat.",
    consignes: ["Grand pas, genou arrière qui frôle le sol", "Buste droit, genou avant au-dessus du pied", "Pousse dans le talon avant pour remonter"],
  },
  mollets: {
    id: "mollets", nom: "Mollets debout", mesure: "charge",
    muscles: "Mollets (gastrocnémiens, soléaire)",
    explication: "Tu montes sur la pointe des pieds : les mollets sont les ressorts de la foulée, et des mollets forts protègent les tendons d'Achille quand tu cours plus.",
    consignes: ["Amplitude complète : talon bas puis tout en haut", "1 s de pause en haut", "Pas de rebond"],
  },
  "pistol-squat": {
    id: "pistol-squat", nom: "Pistol squat assisté", mesure: "corps", parCote: true,
    muscles: "Quadriceps, fessiers, mollets ; équilibre et mobilité de cheville",
    explication: "Squat sur une jambe. Tes talons décollent : c'est la mobilité de cheville qui manque. On le travaille assisté (main sur un poteau) et talon surélevé au début.",
    consignes: ["Talon sur un petit disque (1 à 2 cm) pour commencer", "Tiens un poteau ou une sangle d'une main", "Descends lentement (3 s), genou dans l'axe", "Remonte en poussant dans tout le pied"],
  },
  "incline-halteres": {
    id: "incline-halteres", nom: "Développé incliné haltères", mesure: "charge", parHaltere: true,
    muscles: "Haut des pectoraux, avant des épaules, triceps",
    explication: "Banc incliné à 30° : le haut des pectoraux travaille plus. Les haltères laissent l'épaule trouver sa trajectoire, plus doux pour une épaule sensible qu'une barre.",
    consignes: ["Banc à 30° maximum", "Omoplates serrées, coudes à 45°", "Descente contrôlée, haltères au niveau du haut de la poitrine"],
  },
  "elevations-laterales": {
    id: "elevations-laterales", nom: "Élévations latérales", mesure: "charge", parHaltere: true,
    muscles: "Deltoïde moyen (côté de l'épaule)",
    explication: "Tu écartes les bras sur les côtés : c'est le seul muscle qui élargit les épaules. Charge légère, technique stricte.",
    consignes: ["Coudes légèrement fléchis, montée jusqu'à l'horizontale", "Pouces légèrement vers le bas ou neutres, sans hausser les épaules", "Descente lente"],
  },
  "handstand-mur": {
    id: "handstand-mur", nom: "Équilibre (handstand) contre le mur", mesure: "duree",
    muscles: "Épaules, trapèzes, triceps, gainage",
    explication: "Le poids du corps sur les bras, tête en bas. Ventre face au mur, tu apprends l'alignement sans la peur de tomber, puis tu décolles les pieds du mur.",
    consignes: ["Ventre face au mur, mains à 20 cm du mur", "Bras tendus, oreilles entre les bras, pousse le sol", "Corps gainé, fessiers serrés", "Essaie de décoller un pied, puis les deux, quelques secondes"],
  },
  "hspu-assiste": {
    id: "hspu-assiste", nom: "Pompes en équilibre assistées", mesure: "corps",
    muscles: "Épaules (deltoïdes), triceps, trapèzes",
    explication: "Pompe tête en bas : les épaules poussent tout le poids du corps. Assistée (pieds sur une box, ou amplitude réduite) jusqu'à le faire contre le mur.",
    consignes: ["Pieds sur une box, hanches au-dessus des épaules (pike)", "Tête descend devant les mains, en triangle", "Amplitude réduite si l'épaule tire : jamais au-dessus de 1/10 de gêne"],
  },
  "tractions-strictes": {
    id: "tractions-strictes", nom: "Tractions strictes (volume)", mesure: "corps",
    muscles: "Grand dorsal, biceps, arrière des épaules",
    explication: "Beaucoup de séries propres sans aller à l'échec : c'est la méthode la plus sûre pour augmenter ton maximum de tractions.",
    consignes: ["Prise un peu plus large que les épaules, pronation", "Menton au-dessus de la barre, sans élan", "Arrête la série 2 à 3 reps avant l'échec"],
  },
  "rowing-appuye": {
    id: "rowing-appuye", nom: "Rowing poitrine appuyée (haltères)", mesure: "charge", parHaltere: true,
    muscles: "Haut du dos (rhomboïdes, trapèzes), grand dorsal, arrière des épaules",
    explication: "Poitrine posée sur un banc incliné : impossible de tricher avec le dos, le haut du dos travaille seul.",
    consignes: ["Banc à 30-45°, poitrine collée", "Tire les coudes vers l'arrière, omoplates serrées", "Descente contrôlée"],
  },
  oiseau: {
    id: "oiseau", nom: "Oiseau haltères", mesure: "charge", parHaltere: true,
    muscles: "Arrière des épaules, rhomboïdes",
    explication: "Penché en avant, tu écartes les bras : l'arrière de l'épaule, souvent faible, équilibre l'avant (très sollicité au développé). Bon pour des épaules sensibles.",
    consignes: ["Buste presque à l'horizontale, dos plat", "Coudes légèrement fléchis, écarte jusqu'à l'horizontale", "Léger, lent, contrôlé"],
  },
  "front-lever-tuck": {
    id: "front-lever-tuck", nom: "Front lever groupé (tuck)", mesure: "duree",
    muscles: "Grand dorsal, abdominaux, arrière des épaules",
    explication: "Suspendu à la barre, corps à l'horizontale, genoux contre la poitrine : le grand dorsal tient tout le poids du corps à bras tendus. On allonge les jambes quand le tuck dépasse 15 s.",
    consignes: ["Bras tendus, omoplates tirées vers le bas", "Dos à l'horizontale, genoux à la poitrine", "Monte depuis la suspension, tiens, redescends contrôlé"],
  },
  "muscle-up-transition": {
    id: "muscle-up-transition", nom: "Muscle-up : transitions", mesure: "corps",
    muscles: "Grand dorsal, pectoraux, triceps, poignets",
    explication: "Le muscle-up, c'est une traction explosive puis un passage au-dessus de la barre. On travaille la transition : négatives lentes depuis le haut (au-dessus de la barre) et tractions explosives poitrine à la barre.",
    consignes: ["Prise fausse (poignets au-dessus de la barre) si possible", "Négatives : 3 à 5 s de descente en passant la transition", "Tractions explosives : la barre touche le bas de la poitrine"],
  },
};
