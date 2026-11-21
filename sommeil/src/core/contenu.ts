// Fiches, quiz « vrai ou faux » et sources. Textes écrits pour l'app, à partir des études citées.
// Les liens ont été vérifiés ; quand un lien n'a pas pu l'être, on cite seulement auteurs, année et revue.

export type Statut = "prouve" | "discute" | "mythe";
export const STATUT: Record<Statut, string> = { prouve: "✅ prouvé", discute: "⚠️ discuté", mythe: "❌ mythe" };

export interface Source { id: string; texte: string; lien?: string }

export const SOURCES: Source[] = [
  { id: "watson2015", texte: "Watson et al. (2015). Recommended Amount of Sleep for a Healthy Adult : consensus de l'AASM et de la SRS. Sleep / J Clin Sleep Med.", lien: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4434546/" },
  { id: "hirshkowitz2015", texte: "Hirshkowitz et al. (2015). National Sleep Foundation's sleep time duration recommendations. Sleep Health." },
  { id: "phillips2017", texte: "Phillips et al. (2017). Irregular sleep/wake patterns are associated with poorer academic performance… (Sleep Regularity Index). Scientific Reports." },
  { id: "cribb2023", texte: "Cribb et al. (2023). Sleep regularity and mortality: a prospective analysis in the UK Biobank. eLife.", lien: "https://elifesciences.org/articles/88359" },
  { id: "khalsa2003", texte: "Khalsa et al. (2003). A phase response curve to single bright light pulses in human subjects. Journal of Physiology." },
  { id: "chang2015", texte: "Chang et al. (2015). Evening use of light-emitting eReaders negatively affects sleep… PNAS." },
  { id: "singh2023", texte: "Singh et al. (2023). Blue-light filtering spectacles for … sleep. Revue Cochrane (Cochrane Database of Systematic Reviews)." },
  { id: "drake2013", texte: "Drake et al. (2013). Caffeine effects on sleep taken 0, 3, or 6 hours before going to bed. J Clin Sleep Med (12 participants).", lien: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3805807/" },
  { id: "brooks2006", texte: "Brooks & Lack (2006). A brief afternoon nap following nocturnal sleep restriction: which nap duration is most recuperative? Sleep.", lien: "https://pubmed.ncbi.nlm.nih.gov/16796222/" },
  { id: "edinger2021", texte: "Edinger et al. (2021). Behavioral and psychological treatments for chronic insomnia disorder in adults : recommandation de l'AASM. J Clin Sleep Med." },
  { id: "rasch2013", texte: "Rasch & Born (2013). About sleep's role in memory. Physiological Reviews." },
  { id: "ebrahim2013", texte: "Ebrahim et al. (2013). Alcohol and sleep I: effects on normal sleep. Alcoholism: Clinical and Experimental Research." },
  { id: "stutz2019", texte: "Stutz et al. (2019). Effects of evening exercise on sleep in healthy participants: a systematic review and meta-analysis. Sports Medicine." },
  { id: "depner2019", texte: "Depner et al. (2019). Ad libitum weekend recovery sleep fails to prevent metabolic dysregulation during a repeating pattern of insufficient sleep and weekend recovery sleep. Current Biology." },
  { id: "baron2017", texte: "Baron et al. (2017). Orthosomnia: are some patients taking the quantified self too far? J Clin Sleep Med." },
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
  /** Fiche à mettre en avant (quand consulter). */
  importante?: boolean;
}

export const FICHES: Fiche[] = [
  {
    id: "medecin", icone: "🩺", titre: "Quand voir un médecin", importante: true,
    principes: [{ statut: "prouve", texte: "Certains troubles du sommeil se soignent bien, à condition d'en parler." }],
    paragraphes: [
      "Cette app aide à prendre de bonnes habitudes. Ce n'est pas un avis médical et elle ne peut rien diagnostiquer.",
      "Parles-en à un médecin (ton médecin traitant suffit pour commencer) si :",
      "• tu dors mal plusieurs nuits par semaine depuis des mois (difficulté à t'endormir, à te rendormir, réveil trop tôt) ;",
      "• quelqu'un t'entend ronfler fort avec des pauses dans la respiration, ou tu te réveilles en cherchant ton air ;",
      "• tu t'endors sans le vouloir au volant, en cours ou en pleine conversation ;",
      "• la fatigue ne passe pas malgré une vraie routine et assez d'heures au lit ;",
      "• tu as des idées noires : appelle le 3114 (numéro national de prévention du suicide, gratuit, 24 h/24), ou le 15 en cas d'urgence.",
    ],
    dansLApp: "le bilan de la semaine te renvoie ici si tu luttes souvent contre le sommeil dans la journée.",
    sources: ["edinger2021"],
  },
  {
    id: "duree", icone: "⏱️", titre: "Combien d'heures ?",
    principes: [
      { statut: "prouve", texte: "Adulte : au moins 7 h par nuit, régulièrement." },
      { statut: "prouve", texte: "De 18 à 25 ans : 7 à 9 h sont conseillées." },
      { statut: "mythe", texte: "« Il faut exactement 8 h » : le besoin varie d'une personne à l'autre." },
    ],
    paragraphes: [
      "Les sociétés savantes du sommeil conseillent au moins 7 h aux adultes. Pour les 18–25 ans, la fourchette conseillée est de 7 à 9 h.",
      "Le bon chiffre pour toi est celui avec lequel tu te sens bien réveillé dans la journée, sans avoir besoin de rattraper le week-end.",
    ],
    dansLApp: "durée visée de 7 h 30 par défaut, réglable de 7 à 9 h.",
    sources: ["watson2015", "hirshkowitz2015"],
  },
  {
    id: "cycles", icone: "🔄", titre: "Les cycles de sommeil",
    principes: [
      { statut: "prouve", texte: "La nuit est faite de plusieurs cycles (sommeil léger, profond, paradoxal)." },
      { statut: "mythe", texte: "« Se réveiller pile en fin de cycle de 90 min supprime la fatigue »." },
    ],
    paragraphes: [
      "On parle souvent de cycles de 90 minutes. En réalité, leur durée change d'une personne à l'autre et d'un cycle à l'autre dans la même nuit : en laboratoire, on observe à peu près de 60 à 120 minutes.",
      "Un « calculateur de cycles » ne peut donc pas savoir quand ton cycle se termine. Ce qui compte vraiment : dormir assez, et se lever à heure fixe.",
    ],
    dansLApp: "pas de calculateur de cycles : l'heure de coucher est calculée à partir de Fajr et de la durée que tu vises.",
    sources: [],
  },
  {
    id: "regularite", icone: "📏", titre: "La régularité",
    principes: [
      { statut: "prouve", texte: "Des horaires réguliers sont fortement associés à une meilleure santé." },
      { statut: "discute", texte: "On ne sait pas encore prouver que c'est la régularité elle-même qui en est la cause." },
      { statut: "discute", texte: "Rattraper le week-end ne compense pas entièrement une semaine trop courte." },
    ],
    paragraphes: [
      "De grandes études (dont près de 90 000 personnes équipées d'un capteur dans la UK Biobank) trouvent que les personnes aux horaires irréguliers ont plus de problèmes de santé. Ce sont des associations : elles ne prouvent pas que la régularité en est la cause.",
      "Le plus simple à tenir est une heure de lever à peu près fixe, même le week-end. L'heure de coucher suit plus facilement.",
      "Dormir beaucoup plus le week-end aide un peu à récupérer, mais une étude en laboratoire montre que cela ne répare pas tout ce qu'une semaine trop courte dérègle.",
    ],
    dansLApp: "dans Progrès, l'écart de ton heure de lever et le nombre de nuits « à ± 30 min de ton lever habituel ».",
    sources: ["phillips2017", "cribb2023", "depner2019"],
  },
  {
    id: "lumiere", icone: "☀️", titre: "La lumière et les écrans",
    principes: [
      { statut: "prouve", texte: "La lumière du matin avance l'horloge interne (on a sommeil plus tôt le soir)." },
      { statut: "discute", texte: "Les écrans le soir : effet réel mais plutôt modeste ; c'est surtout ce qu'on y fait qui garde éveillé." },
      { statut: "mythe", texte: "Les lunettes anti-lumière bleue : effet sur le sommeil non établi." },
    ],
    paragraphes: [
      "La lumière forte le matin (dehors, même par temps gris) aide l'horloge interne à se caler plus tôt. Le soir, la lumière vive fait l'inverse.",
      "Lire sur une tablette lumineuse avant de dormir retarde un peu l'endormissement dans les études, mais l'effet est petit. Les vidéos, les réseaux et les discussions qui excitent jouent sans doute plus que la lumière elle-même.",
      "Une revue Cochrane n'a pas trouvé de preuve solide que les lunettes filtrant la lumière bleue améliorent le sommeil.",
    ],
    dansLApp: "routine du soir : baisser la lumière, ranger l'écran ; après Fajr, un peu de lumière du jour si tu restes éveillé.",
    sources: ["khalsa2003", "chang2015", "singh2023"],
  },
  {
    id: "cafeine", icone: "☕", titre: "La caféine",
    principes: [
      { statut: "prouve", texte: "Une forte dose de caféine même 6 h avant le coucher réduit le sommeil." },
      { statut: "discute", texte: "La sensibilité varie beaucoup d'une personne à l'autre." },
    ],
    paragraphes: [
      "Dans une petite étude (12 personnes), 400 mg de caféine (environ 3 à 4 cafés) pris 6 h avant le coucher ont réduit le sommeil de plus d'une heure, souvent sans que les personnes s'en rendent compte.",
      "Le thé, le cola, les boissons énergisantes et certains « pré-entraînements » en contiennent aussi.",
    ],
    dansLApp: "« dernier café conseillé avant » = ton heure de coucher − 6 h ; le journal note la caféine après 14 h.",
    sources: ["drake2013"],
  },
  {
    id: "siestes", icone: "😴", titre: "Les siestes",
    principes: [
      { statut: "prouve", texte: "Une sieste courte (10 à 20 min) améliore la vigilance." },
      { statut: "discute", texte: "À partir d'environ 30 min, on se réveille souvent groggy (inertie du sommeil)." },
      { statut: "discute", texte: "La qaylula (sieste de midi) et la sieste après Fajr sont des pratiques, pas des sujets étudiés par la science." },
    ],
    paragraphes: [
      "Après une nuit trop courte, une sieste de 10 min l'après-midi a été la plus efficace dans une étude en laboratoire ; 20 min aidaient aussi. À 30 min, les personnes étaient d'abord plus endormies avant d'aller mieux.",
      "Une longue sieste en fin d'après-midi peut rendre l'endormissement plus difficile le soir.",
      "La qaylula, le petit repos du milieu de journée, est une pratique connue chez les musulmans. On peut la garder courte pour profiter de l'effet « vigilance », sans lui prêter de bienfaits prouvés par des études.",
    ],
    dansLApp: "le journal note la durée de la sieste ; Progrès montre ton énergie selon ta nuit.",
    sources: ["brooks2006"],
  },
  {
    id: "fajr", icone: "🌙", titre: "Se recoucher après Fajr",
    principes: [
      { statut: "discute", texte: "Dormir en deux fois n'est pas prouvé meilleur qu'une nuit d'un seul bloc." },
      { statut: "prouve", texte: "Ce qui compte : la durée totale et la régularité." },
    ],
    paragraphes: [
      "Beaucoup de personnes se lèvent pour Fajr puis se recouchent. C'est un choix tout à fait possible : la 2ᵉ partie de nuit complète alors la durée.",
      "Il faut juste être honnête : se réveiller au milieu de la nuit coupe le sommeil, et se rendormir prend un peu de temps. Le plus simple pour bien dormir reste une nuit continue, en se couchant assez tôt pour se lever à Fajr.",
      "En été, Fajr est très tôt en France : se coucher assez tôt pour une nuit complète avant Fajr peut être irréaliste. C'est là que se recoucher a le plus de sens.",
      "Après Fajr, si tu restes debout, un peu de lumière du jour aide à bien démarrer.",
    ],
    dansLApp: "option « je me recouche après Fajr » dans Réglages : l'écran du soir montre les deux parties de nuit et ton heure de lever finale.",
    sources: [],
  },
  {
    id: "insomnie", icone: "🛏️", titre: "Quand on n'arrive pas à dormir",
    principes: [
      { statut: "prouve", texte: "La TCC-I (thérapie cognitive et comportementale de l'insomnie) est le traitement de référence." },
      { statut: "discute", texte: "Les conseils d'« hygiène du sommeil » seuls ne suffisent pas à soigner une vraie insomnie." },
      { statut: "discute", texte: "Règle des 20 min environ : si tu ne dors pas, lève-toi et reviens quand le sommeil arrive." },
    ],
    paragraphes: [
      "La TCC-I est recommandée en premier par les médecins du sommeil (recommandation forte de l'AASM en 2021). Elle se fait avec un professionnel, parfois en ligne.",
      "Une idée de la TCC-I : le lit doit rester associé au sommeil. Si tu tournes en rond depuis une vingtaine de minutes (à peu près, sans regarder l'heure), lève-toi, fais quelque chose de calme sous une lumière douce, et reviens quand tu as sommeil.",
      "Le temps pour s'endormir est souvent de 10 à 20 min : c'est un repère courant, pas une norme à atteindre.",
    ],
    dansLApp: "réglage « temps pour s'endormir » (15 min par défaut) et la ligne « noter ce qui tourne dans la tête » de la routine.",
    sources: ["edinger2021"],
  },
  {
    id: "memoire", icone: "🧠", titre: "Sommeil et mémoire",
    principes: [{ statut: "prouve", texte: "Dormir après avoir appris aide à consolider ce qu'on a appris." }],
    paragraphes: [
      "Pendant le sommeil, le cerveau rejoue et range une partie de ce qui a été appris dans la journée.",
      "Concrètement : réviser le soir puis dormir vaut mieux que réviser toute la nuit. Une nuit blanche avant un examen fait souvent perdre plus qu'elle ne fait gagner.",
    ],
    dansLApp: "les révisions de Rayan's Révision ou de Rayan's Mémoire le soir, puis une vraie nuit.",
    sources: ["rasch2013"],
  },
  {
    id: "alcool-sport", icone: "🏃", titre: "Alcool et sport le soir",
    principes: [
      { statut: "prouve", texte: "L'alcool fait s'endormir plus vite mais abîme la fin de nuit." },
      { statut: "discute", texte: "Le sport le soir gêne peu s'il se termine au moins 1 à 2 h avant le coucher." },
    ],
    paragraphes: [
      "L'alcool réduit le sommeil paradoxal et rend la seconde moitié de la nuit plus agitée : on dort moins bien qu'on le croit.",
      "Le sport du soir n'empêche pas de dormir chez la plupart des gens, sauf une séance très intense qui finit juste avant le coucher.",
    ],
    dansLApp: "rien à cocher : à toi de voir dans ton journal si une séance tardive change ton énergie au réveil.",
    sources: ["ebrahim2013", "stutz2019"],
  },
  {
    id: "suivi", icone: "📓", titre: "Suivre son sommeil sans stresser",
    principes: [{ statut: "discute", texte: "Trop surveiller son sommeil peut créer de l'anxiété (« orthosomnie »)." }],
    paragraphes: [
      "Des médecins ont décrit des personnes qui dormaient moins bien à force de vouloir un « score parfait » sur leur montre.",
      "Une mauvaise nuit de temps en temps est normale. On regarde des tendances sur plusieurs semaines, pas une nuit isolée.",
    ],
    dansLApp: "aucune note ni score : des moyennes et des phrases neutres. Le journal prend moins de 30 secondes.",
    sources: ["baron2017"],
  },
];

export interface Mythe { affirmation: string; vrai: boolean; explication: string; fiche: string }

export const QUIZ: Mythe[] = [
  { affirmation: "Il faut dormir exactement 8 heures.", vrai: false, explication: "Le conseil est d'au moins 7 h pour un adulte, 7 à 9 h entre 18 et 25 ans. Le besoin exact varie d'une personne à l'autre.", fiche: "duree" },
  { affirmation: "Se réveiller pile à la fin d'un cycle de 90 min supprime la fatigue.", vrai: false, explication: "Les cycles durent environ de 60 à 120 min selon les personnes et les nuits : impossible de tomber « pile » avec un calcul. Dormir assez compte bien plus.", fiche: "cycles" },
  { affirmation: "Des horaires réguliers comptent pour le sommeil et la santé.", vrai: true, explication: "La régularité est fortement associée à une meilleure santé. La cause n'est pas encore prouvée, mais une heure de lever fixe est un bon point de départ.", fiche: "regularite" },
  { affirmation: "Une sieste de 90 min repose mieux qu'une sieste de 20 min.", vrai: false, explication: "Les siestes courtes (10–20 min) améliorent la vigilance sans réveil groggy. Les longues siestes donnent souvent de l'inertie et peuvent gêner la nuit suivante.", fiche: "siestes" },
  { affirmation: "Un café à 16 h peut gêner le sommeil du soir.", vrai: true, explication: "De la caféine prise 6 h avant le coucher a réduit le sommeil de plus d'une heure dans une étude, souvent sans qu'on s'en rende compte.", fiche: "cafeine" },
  { affirmation: "Les lunettes anti-lumière bleue règlent l'insomnie.", vrai: false, explication: "Une revue Cochrane n'a pas trouvé de preuve solide d'un effet sur le sommeil. Pour l'insomnie, le traitement de référence est la TCC-I.", fiche: "lumiere" },
  { affirmation: "Un verre d'alcool aide à mieux dormir.", vrai: false, explication: "L'alcool fait s'endormir plus vite, mais réduit le sommeil paradoxal et fragmente la fin de nuit.", fiche: "alcool-sport" },
  { affirmation: "Si tu ne dors pas après 20 min, mieux vaut rester au lit à attendre.", vrai: false, explication: "En TCC-I, on conseille plutôt de se lever, de faire quelque chose de calme, et de revenir quand le sommeil arrive.", fiche: "insomnie" },
  { affirmation: "Réviser le soir puis dormir aide à retenir.", vrai: true, explication: "Le sommeil qui suit l'apprentissage aide à consolider les souvenirs.", fiche: "memoire" },
  { affirmation: "Faire la grasse matinée le week-end rattrape entièrement une semaine trop courte.", vrai: false, explication: "Ça aide un peu, mais une étude montre que ça ne compense pas tout. Mieux vaut des nuits suffisantes chaque soir.", fiche: "regularite" },
];
