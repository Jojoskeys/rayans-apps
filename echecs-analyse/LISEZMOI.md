# Analyse Échecs : guide d'utilisation

Application de bureau gratuite, en français, qui importe vos parties **terminées** de Chess.com et les analyse
sur votre ordinateur avec le moteur **Stockfish 19** (version stable officielle, intégrée à l'application).
Pas de terminal, pas de Node.js ni de Stockfish à installer, aucune clé d'API.

## 1. Quel fichier télécharger ?

| Votre ordinateur | Fichier |
|---|---|
| Mac avec puce Apple (M1, M2, M3, M4…) | `Analyse-Echecs-1.0.0-macOS-arm64.dmg` (ou `.zip`) |
| Mac avec processeur Intel | `Analyse-Echecs-1.0.0-macOS-x64.dmg` (ou `.zip`) |
| PC Windows 64 bits | `Analyse-Echecs-1.0.0-Windows-x64-portable.exe` (un seul fichier, rien à installer) |

Pour savoir quel Mac vous avez : menu  › « À propos de ce Mac » › ligne « Puce » (Apple) ou « Processeur » (Intel).

## 2. Ouvrir l'application

**Mac**
1. Ouvrez le `.dmg` et faites glisser « Analyse Echecs » dans le dossier Applications (avec le `.zip` :
   double-cliquez dessus, puis déplacez l'application obtenue dans Applications).
2. Double-cliquez sur « Analyse Echecs ».
3. **La première fois seulement**, macOS bloque l'application car elle n'est pas signée par un certificat Apple payant :
   - macOS 15 ou plus récent : ouvrez Réglages Système › Confidentialité et sécurité, descendez jusqu'au message
     sur « Analyse Echecs » et cliquez sur « Ouvrir quand même », puis confirmez ;
   - macOS 14 ou plus ancien : clic droit (ou Ctrl-clic) sur l'application › Ouvrir › Ouvrir.
   Ensuite, un simple double-clic suffit.

**Windows**
1. Double-cliquez sur `Analyse-Echecs-1.0.0-Windows-x64-portable.exe` (le premier démarrage prend quelques secondes).
2. **La première fois seulement**, si Windows affiche « Windows a protégé votre ordinateur », cliquez sur
   « Informations complémentaires » puis « Exécuter quand même » (l'application n'a pas de certificat payant).
   Si un pare-feu demande l'accès : l'application n'utilise qu'une adresse locale (127.0.0.1) et Internet
   pour Chess.com et Lichess.

## 3. Importer vos parties

1. Dans « Pseudo Chess.com », tapez votre pseudo et cliquez sur **Importer**.
2. La barre de progression indique les mois récupérés. Le premier import remonte aussi loin que les archives
   publiques de Chess.com le permettent (environ 1 à 3 minutes pour plusieurs milliers de parties).
3. Seules les parties standard terminées avec un résultat établi sont gardées ; le nombre de parties écartées
   (variantes, parties incohérentes…) est indiqué.
4. Plus tard, cliquez sur **Mettre à jour** : seuls les mois nécessaires sont récupérés, sans doublon.
   Si l'import est interrompu (coupure, limitation de Chess.com), un message « Import partiel » s'affiche :
   relancez simplement, les mois déjà récupérés sont conservés.

## 4. Analyser une partie

La profondeur d'analyse (22 par défaut) se règle dans **Réglages** ou dans la carte « Analyse en arrière-plan ».


1. Cliquez sur une partie dans l'historique, puis sur **Analyser** (environ 1 minute pour 25 coups ;
   annulable, et reprise possible là où elle s'était arrêtée).
2. Vous obtenez : la précision et un Elo estimé pour chaque joueur, le nombre de coups par catégorie,
   la liste des coups avec leurs symboles (`!!` brillant, `!` très bon, `?!` imprécision, `?` erreur, `??` gaffe),
   le nom de l'ouverture.
3. Cliquez sur « Gaffe · 2 » (par exemple) pour aller à la première gaffe, puis « Suivante ».
4. Pour chaque coup raté : le meilleur coup (flèche verte), les variantes de Stockfish et une explication.
5. **Demander à Claude** copie une question complète (position, coups, scores, variantes) : ouvrez claude.ai
   et collez-la. Rien n'est envoyé automatiquement.
6. Jouez vous-même un coup sur l'échiquier pour explorer une variante : Stockfish le note. **Revenir à la partie**
   ramène à la partie originale.
7. Clavier : ← → coup précédent/suivant, ↑ ↓ début/fin, F retourner l'échiquier, Échap quitter la variante.

## 5. Analyser plusieurs parties en arrière-plan

1. Dans la carte **Analyse en arrière-plan**, choisissez le nombre de parties (les plus récentes non encore
   analysées), éventuellement une cadence et une couleur, puis la **profondeur** : 22 est la référence ; 16 ou 18
   vont plusieurs fois plus vite mais trouvent un peu moins d'erreurs. Après quelques coups, l'application affiche
   la vitesse mesurée sur votre ordinateur et le temps restant.
2. Cliquez sur **Ajouter à la file**. Les parties sont analysées une par une ; vous pouvez continuer à utiliser
   l'application. Dans l'historique, « ⏳ en file » marque les parties en attente.
3. **Pause** arrête le calcul (rien n'est perdu), **Reprendre** le relance, **Vider la file** retire tout
   (deux clics pour confirmer). Si vous fermez l'application, la file est gardée et revient en pause.
4. **Analyser** sur une partie la fait passer en premier.

## 6. Bilan

Cliquez sur l'onglet **Bilan** (en haut). Filtres : cadence, couleur, période, regroupement par mois, trimestre ou année.

- **Elo de performance** : calculé sur vos résultats (gains, nulles, pertes) contre le classement de vos
  adversaires, pour toutes vos parties importées. Avec son intervalle de confiance à 95 % : plus il y a de parties,
  plus l'intervalle est étroit. Comparé à votre Elo Chess.com en fin de période.
- **Bilan des parties analysées** : précision moyenne, gaffes, erreurs et imprécisions par partie ; leur évolution
  dans le temps ; par cadence, par couleur et par phase (ouverture, milieu de jeu, finale) ; les parties avec le plus
  de gaffes (cliquez pour les ouvrir). Analysez vos parties à la même profondeur pour que les comparaisons aient un sens.

## 7. Exercices tirés de vos erreurs

Onglet **Exercices** : l'application vous replace juste avant une de vos gaffes ou erreurs (dans vos parties déjà
analysées) ; trouvez un bon coup en le jouant sur l'échiquier.

- Le meilleur coup de Stockfish est accepté, ainsi qu'un coup presque aussi bon (Stockfish vérifie en quelques secondes).
- Après la réponse : la solution, la variante, ce que vous aviez joué et pourquoi c'était une erreur.
  **Voir dans la partie** ouvre la partie à ce moment.
- Seul le premier essai compte. Un exercice réussi revient après 1 jour, puis 3, 7, 21, 60 jours ; un exercice
  manqué revient 10 minutes plus tard. Filtres : type d'erreur, cadence, phase de jeu.

Les analyses sont enregistrées sur votre ordinateur : une partie analysée se rouvre instantanément, même sans
Internet. Les règles de calcul (catégories, précision, Elo estimé) sont détaillées dans `REGLES-ANALYSE.md` ;
ce sont des approximations, indépendantes des chiffres de Chess.com.
