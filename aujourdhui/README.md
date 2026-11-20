# Rayan's Aujourd'hui

Le tableau du jour : les cours de la fac (emploi du temps ADE de l'Université de Rennes), ce qu'il reste à réviser dans Rayan's Révision, Rayan's Hifz et Rayan's Ouvertures, un bouton
pour ouvrir chaque application, et une notification le soir s'il reste quelque chose. Electron + React + TypeScript.

## Ce qu'elle fait

- **Trois nombres**, relus chaque minute et quand la fenêtre revient au premier plan :
  - **Révision** : cartes en apprentissage, révisions dues avant la fin de la journée de révision (4 h du matin),
    nouvelles cartes dans la limite quotidienne de chaque paquet, comme la séance de Révision les compte.
  - **Hifz** : portions dont la révision est due, ou qui contiennent un verset marqué « à revoir ».
  - **Ouvertures** : positions déjà travaillées dont l'échéance est passée. Les positions jamais vues ne sont pas
    comptées (il faudrait refaire l'analyse des parties).
- **Ouvrir** : lance l'application comme Rayan's Launcher le fait.
- **Rappel du soir** : à 19 h par défaut (réglable), une notification « Révision : 5 · Hifz : 2 » s'il reste
  quelque chose, une fois par jour. Si l'ordinateur est allumé plus tard (jusqu'à 3 h après), le rappel part à ce
  moment-là.
- **Zone de notification** : l'infobulle donne le détail ; le menu ouvre chaque application.
- **Démarrer avec Windows** (réglages) : nécessaire pour que le rappel arrive sans ouvrir l'application.

## Ma journée (routine)

- Ce qu'on veut faire chaque jour, ou certains jours (L M M J V S D) : une case à cocher dans la vue du jour.
- Avec une heure : **rappel Windows** à cette heure tant que ce n'est pas coché, une fois par jour (encore envoyé
  jusqu'à 2 h après si l'ordinateur était éteint). Sans heure : juste la case.
- Série : nombre de jours d'affilée où tout ce qui était prévu a été fait.
- « Gérer » : ajouter, renommer, changer l'heure ou les jours, supprimer. Données : `routine.json`.

## Sport

- **Semaine** : lundi haut du corps force (couché, tractions lestées, rowing pronation, dips, pompes, curl marteau),
  mardi fractionné 4 × 4 min, mercredi calisthénie (handstand, pompes en poirier, tractions, front lever, muscle-up,
  pompes), jeudi jambes et mobilité (squat, roumain, fentes, mollets, pistol, squat profond tenu, gainage), vendredi
  repos, samedi allure seuil (3 × 8 min au début ; test 5 km toutes les 4 semaines), dimanche endurance facile. Pas de
  course dure la veille ou le lendemain des jambes. Une séance « épaules et dos » existe en option (réglage de la semaine).
- **Reprise progressive** (`des` / `jusqua` dans `SEANCES`) : dips à partir de la semaine 2 (coude à 90°), handstand
  à l'élastique semaine 3, pompes en poirier contre le mur semaine 5 (avant : pieds sur une box), pistol assisté
  semaine 5 (avant : squat sur une jambe vers un banc). Échauffement d'épaule gardé avant le haut du corps.
- **Séance guidée** : pour chaque exercice, muscles travaillés, fonctionnement expliqué simplement, consignes,
  objectif (séries × reps × charge) ; saisie série par série, minuteur de repos et séries restantes ; la saisie en
  cours est gardée si on quitte.
- **Progression** (`src/core/sport.ts`) : charges de départ génériques dans le code, les vraies dans les données
  (réglages de chaque exercice, ou fichier privé `profil-sport.json` importé au premier lancement) ; toutes les séries réussies →
  +2,5 kg (barre), +2 kg (haltères), +1 rep (poids du corps) ou +5 s (gainage, équilibres) ; deux séances ratées de
  suite → −5 %. Les charges sont **recalculées à partir du journal** : PC et iPhone n'ont qu'à réunir leurs journaux.
- **Course (objectif 5 km)** : 5 km estimé par la formule de Riegel à partir de la meilleure perf des 120 derniers
  jours (sans perf : 32 min) ; allures facile, seuil et fractionné en
  découlent ; cycles de 4 semaines (3 de progression, 1 allégée avec test).
- **Créneau** : premier moment libre assez long d'après l'emploi du temps (20 min de marge autour des cours ; dès
  7 h en semaine, 9 h 30 le week-end, jusqu'à 21 h 30). Dans la notification du matin, et rappel 30 min avant.
- Données : `sport.json`, synchronisé avec l'iPhone (séances saisies à la salle sur le téléphone).
- **Montre Garmin branchée en USB** (`src/main/garmin.ts`, toutes les 2 minutes, Windows) : les nouvelles activités
  de `GARMIN\Activity` sont copiées dans `montre/` (sur le PC) et lues (`src/core/fit.ts`). Séances de Rayan's Muscu
  (voir `garmin/`) → tractions strictes ou pompes, une série par circuit ; courses d'au moins 1 km → course du jour
  (sinon sortie longue), ressenti « correct ». Placées dans la séance prévue ce jour-là si elle contient
  l'exercice, sinon dans celle qui le contient. **Une saisie existante n'est jamais remplacée.** Rien avant le début
  du plan. Notification avec ce qui a été ajouté ; fichiers déjà traités dans `montre.json`. Rien ne passe par
  Internet. Règles : `src/core/garmin.ts`, testées (`test/garmin.test.ts`).

## Mails de la fac : lecture automatique

- Option (réglages Fac) : la boîte Partage est lue toutes les 15 minutes **en lecture seule** par un petit client
  IMAP (`src/main/imap-client.ts` : EXAMINE, BODY.PEEK ; rien n'est marqué lu, déplacé ni supprimé). Serveur par
  défaut `partage.univ-rennes.fr:993` (modifiable ; vérifié par « Tester et activer »).
- Seuls les mails des expéditeurs de la liste (profs, secrétariat) sont téléchargés. Un changement de salle, d'horaire
  ou une annulation sur un cours reconnu est **appliqué directement** (notification, annulable comme une correction
  validée) ; le reste reste à valider.
- Le mot de passe Sésame est saisi dans la fenêtre, chiffré par Windows (`safeStorage`), jamais affiché ni
  synchronisé. État dans `courrier.json` (identifiants déjà vus, dernière vérification).

## Bilan du jour et adhkar

- **Le matin, après Fajr (Sobh)** (10 min après, réglable ; heures de Rayan's Prière) : une notification avec les
  **adhkar as-sabâh** (avant le lever du soleil), « comment tu te sens aujourd'hui ? », ce qui a été prévu hier
  soir et les objectifs du jour. Dans la fenêtre : humeur (5 visages), quelques mots, case « adhkar as-sabâh ».
- **Entre Asr et Maghrib** : rappel des **adhkar al-masâ'** 40 min avant Maghrib (jamais avant Asr + 5 min), et un
  dernier rappel 10 min avant Maghrib s'ils ne sont pas cochés.
- **Le soir** (17 h 30 par défaut) : **bilan** — comment s'est passée la journée, comment je me sens, trois questions
  facultatives (ce qui a marché, ce qui a coincé, LA priorité de demain) et la liste de demain. Le lendemain, la
  priorité s'affiche en haut (« Priorité du jour ») et en tête du rappel du matin ; la liste devient une carte
  « Prévu hier soir » à cocher.
- Chaque notification part une fois par jour, et seulement dans les 3 h qui suivent son heure. Les heures de prière
  sont calculées avec le code de Rayan's Prière (`priere/src/core`, même lieu et même méthode, `priere.json` seulement
  lu) ; sans ville choisie dans Prière, le rappel du matin part à 7 h et il n'y a pas de rappel des adhkar du soir.
- Les textes des adhkar ne sont pas affichés : seulement les rappels et les cases.
- Données : `bilan.json` (365 jours, sur le PC, non synchronisé avec l'iPhone). Calculs : `src/core/bilan.ts`.

## Citations du jour

- Une citation **le matin** (8 h) pour bien commencer et une **à midi** (12 h 30) pour garder le cap : notification
  Windows et encadré en haut de la fenêtre. Heures réglables, désactivable.
- Hadiths du Prophète ﷺ **avec leur référence** (al-Bukhârî, Muslim, at-Tirmidhî, Abû Dâwûd…), savants (al-Hasan
  al-Basrî, Ibn al-Qayyim) et philosophes **avec l'œuvre citée** (Sénèque, Marc Aurèle, Épictète, Lao Tseu, Confucius,
  Aristote, Descartes, Voltaire), et des phrases sans auteur. Traductions françaises faites pour l'app (sens fidèle).
- Les citations célèbres mais mal attribuées sont volontairement écartées. Avant d'en ajouter une
  (`src/core/citations.ts`), vérifier sa source.
- Même citation toute la journée ; aucune ne revient avant que les autres soient passées.

## Objectifs du jour

- Chaque jour, **3 petits objectifs faciles** (réglable de 1 à 5), dans des domaines différents : prière et Coran,
  études, écran, santé (domaines au choix dans les réglages). Le domaine laissé de côté change d'un jour à l'autre,
  et un objectif proposé la veille revient rarement le lendemain.
- **Adaptés aux habitudes** : la cible est un peu au-dessus de la médiane des 7 jours précédents (×1,1), plus douce
  après un objectif raté (×0,8, ou « version douce » pour un objectif à cocher). Les objectifs déjà souvent réussis
  sont un peu préférés : le but est de réussir chaque jour.
- **Mesurés automatiquement** quand une app le sait (fichiers seulement lus) :
  - cartes révisées dans Rayan's Révision (`reviews`), sans viser plus que ce qui reste à réviser ;
  - minutes chronométrées dans Rayan's Chrono (`entries`) ;
  - temps de jeu et heure de la dernière activité, d'après le résumé quotidien de Rayan's Journal
    (`%LOCALAPPDATA%\Rayan's Journal\resume-quotidien.json` : seulement des durées et des heures). Proposés
    seulement si c'est déjà beaucoup (au moins 30 min de jeux, ou coucher après 23 h 30).
  - Le reste (prières, Coran, eau, marche, rangement…) est à cocher.
- Journées de 4 h à 4 h. Les objectifs sont choisis une fois par journée et ne changent pas en cours de route ;
  « Autre » en propose un autre du même domaine. Série : jours d'affilée où tout a été atteint.
- Notifications : la liste le matin (dès 8 h, une fois) et, à l'heure du rappel du soir, ce qu'il reste à faire.
- Données : `objectifs.json` (60 jours). Calculs : `src/core/objectifs.ts`, `src/core/mesures.ts`.

## Synchronisation avec l'iPhone (Rayan's Mobile)

Réglages → **Synchronisation avec l'iPhone** : dépôt GitHub privé (`Jojoskeys/rayans-donnees`) et jeton à accès
limité, et **phrase secrète** : tout est **chiffré de bout en bout** (AES-256-GCM, clé tirée de la phrase par PBKDF2) avant l'envoi, GitHub ne voit que du contenu illisible. Jeton et clé sont protégés par le compte Windows. Aujourd'hui sert de pont pour toutes les apps : Révision, Hifz, Chrono,
Prière, Ouvertures (réponses aux exercices, et exercices publiés), Ma journée et les cours. Synchro au démarrage, à
l'ouverture de la fenêtre et toutes les 15 minutes ; une app ouverte est synchronisée après sa fermeture ; une copie
`.avant-synchro` est gardée avant chaque écriture. Règles de fusion : `mobile/src/shared/merge.ts`. Voir
`mobile/README.md`.

## Fac : Université de Rennes

- **Emploi du temps ADE** : dans ADE (depuis l'ENT), cocher ses groupes, Partager → **Agenda**, date de fin = fin du
  semestre, copier l'URL iCalendar et la coller dans Réglages → Fac. Aucun mot de passe.
  - Téléchargé à l'ouverture de la fenêtre (au plus une fois toutes les 15 minutes) et avec le bouton ↻ ; rien
    ne tourne quand la fenêtre est fermée.
  - Un cours est reconnu par son identifiant ADE (`UID`) : une mise à jour remplace l'ancienne version, sans doublon.
    La ligne « Exporté le » d'ADE est ignorée.
  - Les changements depuis le téléchargement précédent (salle, horaire, cours ajouté ou retiré) sont signalés.
  - **Mes groupes** : le lien d'ADE couvre toute la branche cochée (ex. tout le parcours, tous les groupes
    d'anglais). On coche ses groupes tels qu'ADE les écrit dans la description des cours (« L3 INFO-G4 »,
    « Anglais Gr F »…) et le tronc commun ; seuls leurs cours sont gardés. Les pauses méridiennes sont masquées.
- **Mails** : la messagerie Partage n'offre aux étudiants qu'IMAP avec le mot de passe Sésame (pas d'accès en lecture
  seule ni d'OAuth), donc l'application ne se connecte pas à la boîte. On **partage un mail à la main** : texte collé
  depuis le webmail ou fichier `.eml` déposé. L'analyse (salle, annulation, report, examen, devoir) se fait sur le PC
  avec des règles simples (`src/core/mail.ts`).
  - Chaque information devient une **proposition à valider** : rien ne change avant « Appliquer ».
  - Une correction validée s'affiche avec la valeur d'ADE (« Salle corrigée d'après un mail · ADE : B12 »). Elle
    disparaît quand ADE donne la même valeur ; si ADE passe à une troisième valeur, le conflit est signalé.
  - Examens et devoirs validés vont dans « Échéances ».
  - Un expéditeur absent de la liste (Réglages → Fac) est signalé.
- **Données gardées** (`fac.json`, sur le PC) : l'URL ADE (jamais affichée en entier), les cours à venir, les
  changements, et pour chaque mail l'expéditeur, l'objet, la date et un extrait d'une phrase ou deux, 30 jours.
  Le webmail ne permet pas de lien direct vers un message : « Ouvrir le webmail » copie l'objet pour la recherche.
- **iPhone** : ajouter la même URL ADE dans Calendrier (abonnement) ; les corrections et échéances restent sur le PC.

## Données lues

Les fichiers des autres applications sont seulement lus, jamais modifiés :

| Application | Fichier |
| --- | --- |
| Révision | `%APPDATA%\fr.rayan.revision\revision.json` (ou `REVISION_DATA_DIR`) |
| Hifz | `%APPDATA%\Rayans Hifz\hifz-donnees.json` (ou `HIFZ_DATA_DIR`) |
| Ouvertures | `%APPDATA%\Rayans Ouvertures\donnees\joueurs\*\exercices.json` (ou `RAYANS_OUVERTURES_DATA`) |

Les règles de calcul reprennent celles de chaque application (voir `src/core/counts.ts`). Si l'une change sa
façon de compter, il faut mettre ce fichier à jour.

Réglages : `aujourdhui.json` (et `fac.json` pour la fac) dans le dossier fourni par Rayan's Launcher (`HANGAR_APP_DATA`), sinon
`%APPDATA%\Rayans Aujourdhui`.

## Développement

```bash
npm install
npm start               # construit et lance
npm test                # comptes de Révision, Hifz, Ouvertures ; rappel du soir ; ADE et mails
npm run typecheck
npm run test:lancement  # fausses données, nombres affichés, rappel envoyé une fois, changement de salle par mail, routine, réglages
npm run dist:win        # ZIP Windows dans dist/
npm run icons           # redessine les icônes
```

Le workflow `.github/workflows/aujourdhui.yml` vérifie, construit, lance le paquet comme un double-clic et publie le
ZIP dans Rayan's Launcher (id `rayans-aujourdhui`).
