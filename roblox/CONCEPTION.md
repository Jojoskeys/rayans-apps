# Fiche de conception (à remplir avant chaque jeu Roblox)

Règle : si on n'arrive pas à écrire les deux premières lignes ci-dessous, l'idée n'est pas prête.
Deux chiffres à suivre dès le début : le **retour le lendemain** (jour 1) et le **temps passé par partie**.
Interfaces, contenu et récompenses amplifient une bonne idée, ils ne sauvent pas une mauvaise.

## 0. Les deux lignes obligatoires

- **Rêve du joueur, en une phrase** : devenir l'éleveur du robot de trading le plus malin... et découvrir pourquoi
  c'est si dur de battre le marché.
- **Boucle de jeu, en 3 verbes** : **choisir** une règle, **regarder** la course, **recommencer** avec un
  robot mieux réglé (ou en choisir un autre quand le sien explose).

## 1. Mécanique reprise d'un jeu qui marche, et ce que j'ajoute

- Repris : la sélection naturelle des jeux de fusion et d'évolution (les moins bons disparaissent, les
  meilleurs « font des enfants »), et la course de familiers qu'on regarde.
- Ajouté : de **vrais prix de bourse** et des **frais réels**, un examen sur une année jamais vue contre un
  robot « Acheter et garder », et une leçon honnête à la fin. Argent fictif, aucun achat.

## 2. La promesse en une phrase (titre et miniature)

- Titre : « Rayan's Arène : fais évoluer ton robot trader ».
- Promesse : « Ton robot saura-t-il battre le marché ? » ; miniature : un robot rond qui explose à côté du
  robot doré couronné. Une seule idée forte, lisible en petit.

## 3. Ce que le joueur fait dans les 10 premières secondes

- Aujourd'hui : le panneau de choix s'ouvre 2 s après l'arrivée, mais la partie ne démarre qu'après
  15 s d'attente (`ATTENTE_DEPART`) : le joueur choisit, puis regarde un compte à rebours.
- Cible : un choix en moins de 10 s, **et** voir son robot courir dans les 10 s qui suivent le clic.

## 4. Plan de test des miniatures

- Faire 3 versions : (a) robot qui explose, (b) robot doré couronné, (c) l'écran avec la courbe de prix.
- Si une pub est lancée : plafond de budget fixé à l'avance par Rayan (par exemple une petite somme de test,
  jamais au-delà), une campagne par miniature, on garde celle qui a le meilleur taux de clic (clics divisés par
  affichages). Les pubs coûtent de l'argent réel : rien n'est lancé sans l'accord de Rayan.
- Pas de pub avant que le jeu retienne les joueurs (retour du lendemain correct).

## 5. Joueurs très engagés et moins de 16 ans

- Un **nouveau jeu** n'est montré qu'aux **16 ans et plus** tant qu'il n'a pas assez de joueurs très engagés :
  la documentation officielle (« Kids and Select ») donne **250 joueurs très engagés sur 60 jours**. Un seuil
  de 100 a été annoncé mais n'est pas confirmé dans la doc : à revérifier avant le lancement.
- Plan : amener d'abord des amis et un petit public (16+), viser des sessions longues et un retour le lendemain,
  puis suivre le compteur dans Creator Hub.
- Cohérent avec le sujet (trading, même fictif) : public plutôt grand ado et adulte, aucun achat.

## Rayan's Arène : ce qui manque (avis franc)

1. **Trop d'attente avant d'agir** : 15 s de compte à rebours au début, puis 5 générations de 12 s (plus 5 s
   de pause) avant l'examen : plus de 2 minutes à regarder avant le résultat, avec peu à faire. Un bouton
   « Passer » ou une partie plus courte à la première partie aiderait.
2. **Rêve flou pour un joueur qui ne connaît pas la bourse** : on comprend la leçon à la fin seulement. La
   promesse doit apparaître dès l'écran de choix (« Fais battre le marché à ton robot »).
3. **Boucle courte d'un côté, longue de l'autre** : choisir est rapide, mais l'effet du choix se voit après
   plusieurs générations. Montrer plus tôt le robot du joueur (suivre sa caméra, son rang en direct).
4. **Peu de raisons de revenir demain** : pas de progression gardée. D'où les récompenses quotidiennes
   (voir le README) ; autre piste : un classement des meilleurs examens de la semaine.
5. **Pas de test de miniature ni de plan 16+** : tout reste à faire (points 4 et 5).

Changements proposés, **à coder seulement après l'accord de Rayan** : (a) raccourcir la première partie,
(b) afficher la promesse sur l'écran de choix, (c) suivre le robot du joueur, (d) classement hebdomadaire.

## Pour aller plus loin : fiche de game design tirée de vidéos (à compléter)

Idée : étudier des vidéos de créateurs Roblox reconnus (boucle de jeu, rétention, interface, erreurs de
débutant, monétisation honnête) et en tirer une fiche.

**En attente de Rayan : la liste de 15 vidéos YouTube à analyser (à fournir ou à faire valider).** Rien n'est
téléchargé ni installé en attendant ; les vidéos et transcriptions resteront privées, hors du dépôt, avec les
outils déjà présents dans Favoris.

D'après les règles générales déjà connues, ce qu'il faudra vérifier dans ces vidéos :

- **Boucle de jeu** : 2 à 3 verbes répétés, récompense à chaque tour.
- **Ce qui fait revenir** : retour du lendemain, séries quotidiennes (grosses récompenses jours 2 et 7).
- **Interface** : peu de boutons, une seule action claire à la fois, rien qui masque le jeu.
- **Erreurs de débutant** : tutoriel trop long, trop d'attente, pas de but visible, copier un jeu entier.
- **Monétisation honnête** : jamais pousser à acheter, surtout les jeunes ; Rayan's Arène n'a aucun achat.
