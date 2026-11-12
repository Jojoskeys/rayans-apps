# Règles d'analyse d'Analyse Échecs

Ce document décrit exactement ce que calcule l'application. Toutes ces règles sont testées dans `test/unit/`.
Les catégories, la précision et l'Elo estimé sont des **approximations propres à l'application**,
inspirées de Chess.com et de Lichess, mais **indépendantes** de leurs résultats.

## 1. Recherche moteur

- Moteur : binaire natif officiel **Stockfish 19** (tag `sf_19`), piloté en UCI. Fils : nombre de cœurs − 1
  (au moins 1, au plus 16). Table de hachage : 256 Mo.
- Profondeur : **22 par défaut**, réglable (12, 14, 16, 18, 20, 22 ou 24) ; ci-dessous, « 22 » désigne la profondeur
  choisie. Chaque analyse enregistre sa profondeur et la garde ; changer le réglage ne modifie pas les analyses
  existantes. Une analyse moins profonde est plus rapide mais détecte moins d'erreurs.
- Pour chaque demi-coup, depuis la position **avant** le coup :
  1. recherche libre `go depth 22` avec `MultiPV 2` → meilleur coup (ligne 1) et deuxième coup (ligne 2) ;
  2. si le coup joué est le premier coup de la ligne 1 ou de la ligne 2, son score est réutilisé ;
  3. sinon, recherche complémentaire `go depth 22 searchmoves <coup joué>` avec `MultiPV 1`.
- Les deux variantes principales et la variante du coup joué sont conservées.
- Les scores UCI sont donnés du point de vue du **joueur au trait**, c'est-à-dire du joueur qui joue le coup
  évalué : aucun changement de signe n'est nécessaire, pour les Blancs comme pour les Noirs. La barre
  d'évaluation convertit ensuite au point de vue des Blancs.
- Positions terminales : une position sans coup légal n'est pas envoyée au moteur. Mat → score « maté » (`mate 0`),
  pat → 0. Le coup qui donne mat obtient le score `mate 1`.
- Chaque demi-coup calculé est enregistré sur disque immédiatement, avec la version du moteur, la profondeur,
  le MultiPV, le nombre de fils et la mémoire. Une analyse interrompue reprend au premier demi-coup manquant
  si le moteur et les réglages sont identiques ; sinon elle est recommencée.

## 2. Services externes (facultatifs)

- **Lichess cloud-eval** : interrogé pour les positions connues (ouverture). Après deux absences consécutives
  dans une partie, il n'est plus interrogé (la partie a quitté les positions connues). Son évaluation est
  **affichée à titre indicatif** avec sa profondeur ; elle n'entre pas dans le classement.
- **Table de finales Lichess** (`tablebase.lichess.ovh`) : interrogée à 7 pièces ou moins, sans droit de roque.
  Elle donne le résultat exact (gain, nulle, perte) et les coups qui le préservent ; elle sert aux catégories
  « meilleur », « très bon » et « occasion manquée » (ci-dessous).
- Classement chiffré : toujours à partir des scores de Stockfish local, comparés entre eux (même position,
  même profondeur).
- Absence de réponse, quota (HTTP 429) ou panne : l'analyse locale continue sans ces données ; après un quota,
  le service est mis en pause 5 minutes.

## 3. Chances de gain et perte

- `W(cp) = 50 + 50 × (2 / (1 + exp(−0,00368208 × cp)) − 1)` (formule Lichess), en points de pourcentage.
- **Mats** : « mat en n » pour le joueur = 10 000 − 10·n centipions ; « maté en n » = −(10 000 − 10·n) ;
  « déjà maté » = −10 000. W vaut alors 100 (ou 0) à 0,01 près. Conséquences : rater un mat en gardant
  +5 coûte environ 13,7 points ; un mat plus long à la place d'un mat court coûte moins de 0,01 point.
- **Perte** = `max(0, W(meilleur coup) − W(coup joué))`, les deux scores étant du point de vue du joueur
  qui a joué. Si le coup joué est le meilleur coup, la perte vaut 0.

## 4. Catégories

### Catégories ordinaires (bornes incluses)

| Perte (points)        | Catégorie   | Symbole |
|-----------------------|-------------|---------|
| ≤ 2,5                 | Excellent   |         |
| ≤ 6                   | Bon         |         |
| ≤ 12                  | Imprécision | `?!`    |
| ≤ 22                  | Erreur      | `?`     |
| > 22                  | Gaffe       | `??`    |

**Assouplissement sous 1400 Elo** (réglable de 0 à 50 %, 15 % par défaut) : les quatre seuils sont multipliés
par `1 + a × min(1, (1400 − Elo) / 600)`, où `Elo` est le classement Chess.com du joueur **au moment de la
partie** (donnée de l'API, sinon en-tête PGN). Facteur 1 à 1400 Elo et au-delà, ou si l'Elo est inconnu ;
facteur maximal `1 + a` à 800 Elo et en dessous. Exemple : à 800 Elo, « excellent » va jusqu'à 2,875 points.

### Catégories spéciales

| Catégorie | Symbole | Critère |
|-----------|---------|---------|
| Théorie | `≡` | La position obtenue figure dans une ligne de `lichess-org/chess-openings` **et** tous les coups précédents de la partie étaient aussi théoriques, **et** la perte ne dépasse pas le seuil « bon ». |
| Brillant | `!!` | Perte ≤ seuil « excellent », W(joué) ≥ 45, W(meilleur) < 97 (partie pas déjà gagnée), **et** sacrifice confirmé : en rejouant légalement la variante du coup joué (6 premiers demi-coups), le joueur se retrouve, après une prise adverse, avec au moins 2 points de matériel de moins qu'avant le coup (pion 1, cavalier/fou 3, tour 5, dame 9). |
| Très bon | `!` | Le coup est le meilleur (Stockfish ou table de finales), au moins 2 coups légaux, et c'est le **seul** à préserver le résultat ou un avantage significatif : soit la table de finales indique qu'il est le seul coup à conserver le gain ou la nulle, soit le 2e choix de Stockfish perd au moins 15 points avec W(meilleur) ≥ 40. |
| Meilleur | `★` | Le coup est le premier coup de Stockfish, ou le premier coup de la table de finales. Réservé à ces cas : un autre coup de même score est « excellent ». |
| Occasion manquée | `×` | Catégorie ordinaire imprécision, erreur ou gaffe, position non perdue après le coup (W(joué) ≥ 25), **et** : un mat était disponible et le coup joué n'en a plus, ou W(meilleur) ≥ 90 (avantage décisif) et W(joué) < 75, ou la table de finales donnait un gain et le coup joué ne gagne plus. Si la position devient perdante (W < 25), le coup reste une erreur ou une gaffe ordinaire. |

**Ordre de priorité** quand plusieurs catégories s'appliquent : Théorie > Brillant > Très bon > Meilleur >
Occasion manquée > catégorie ordinaire. En cas de preuve insuffisante (variante trop courte, prise absente,
table de finales muette), la catégorie ordinaire est conservée. Les coups joués dans une variante explorée ne
sont jamais classés « théorie ».

## 5. Précision

- Pour chaque coup évalué : `précision = 103,1668 × exp(−0,04354 × perte) − 3,1669`, bornée entre 0 et 100.
- Pour chaque joueur : `0,3 × moyenne arithmétique + 0,7 × moyenne harmonique` des précisions de ses coups.
- **Score nul** : une précision de coup de 0 (perte ≥ ~80 points) annulerait toute la moyenne harmonique. Dans
  la moyenne harmonique seulement, chaque valeur est donc prise égale à `max(précision, 1)`.
- **Aucun coup évaluable** : la précision n'est pas calculée et s'affiche « — ».
- Coups pris en compte : tous les coups du joueur évalués par le moteur (y compris théorie et coups forcés).
  Leur nombre est affiché ; sous 10 coups, la précision est signalée comme indicative.

## 6. Elo estimé pour la partie

Heuristique propre à l'application, distincte de l'Elo Chess.com :

1. Table précision → Elo brute, interpolée linéairement :
   0 → 300, 40 → 450, 50 → 700, 60 → 1000, 70 → 1350, 80 → 1700, 85 → 1950, 90 → 2250, 95 → 2600,
   98 → 2850, 100 → 3000.
2. Prise en compte du nombre `n` de coups analysés : l'estimation est rapprochée de 1500 avec un poids
   `n / (n + 12)` (peu de coups ⇒ estimation prudente).
3. Marge indicative : ± 900 / √n, arrondie à 50.
4. Moins de 10 coups évalués : aucun chiffre n'est affiché (« échantillon trop court »).

## 7. Explications des coups ratés

Les variantes sont rejouées légalement (chess.js) pour reconnaître : mat forcé (annoncé « forcé » seulement si la
variante rejouée se termine réellement par un mat), pièce laissée en prise (la réponse adverse de la variante la
prend), fourchette (une pièce attaque au moins deux cibles et la variante gagne du matériel), prise gagnante,
perte de matériel dans la variante. Sans motif fiable, l'application explique l'écart d'évaluation et montre la
variante du meilleur coup.

## 8. Bilan sur plusieurs parties

### Analyse en arrière-plan

- Les parties sont analysées **une par une**, dans l'ordre d'une file d'attente enregistrée sur disque
  (`file-attente.json`), avec les règles de la section 1 et la profondeur choisie au moment de l'ajout.
- Un **lot** ajoute les N parties les plus récentes du joueur (filtres : cadence, couleur) qui ne sont pas déjà
  analysées complètement à cette profondeur ou plus, ni déjà dans la file.
- **Analyser** sur une partie la place en tête : la partie en cours est interrompue et reprise plus tard au premier
  demi-coup manquant (rien n'est perdu, sauf le demi-coup en cours de calcul).
- Au redémarrage de l'application, une file non vide est **en pause** (reprise par l'utilisateur).
- Deux échecs consécutifs mettent la file en pause, avec le message d'erreur.
- Le temps restant est estimé à partir de la durée moyenne par demi-coup mesurée sur cet ordinateur, à cette
  profondeur, pendant la session (aucune estimation avant 5 demi-coups mesurés).

### Données prises en compte

Seules les parties **analysées complètement** comptent, du point de vue du joueur choisi. Filtres : cadence
(classement Chess.com `time_class`), couleur, période (date de fin de partie, UTC). Regroupement par mois,
trimestre ou année (UTC). Si les parties ont été analysées à des profondeurs différentes, l'application le signale.

### Indicateurs

- **Précision moyenne** : moyenne arithmétique des précisions de partie (section 5) ; intervalle indicatif à 95 % :
  ± 1,96 × écart type / √n (à partir de 2 parties).
- **Gaffes, erreurs, imprécisions par partie** : nombre de coups de cette catégorie (section 4) divisé par le nombre
  de parties. Les occasions manquées sont comptées à part.
- **Score** : (gains + ½ nulles) / parties.

### Phases de jeu

Règle simplifiée inspirée du « Divider » de Lichess (sans son critère de mélange des pièces), évaluée sur la
position **avant** chaque demi-coup ; une phase atteinte ne revient jamais en arrière :

- **Finale** : au plus 6 pièces hors rois et pions sur l'échiquier (les deux camps ensemble) ;
- **Milieu de jeu** : dès que l'un de ces critères est rempli : au plus 10 pièces hors rois et pions, un camp a moins
  de 4 de ses pièces (pions compris) sur sa première rangée, ou le coup 16 est commencé ;
- **Ouverture** : avant.

Par phase : la précision est calculée sur **tous les coups de la phase**, toutes parties confondues, avec la
formule de la section 5 (30 % arithmétique + 70 % harmonique, plancher 1). Gaffes, erreurs et imprécisions sont
rapportées à 100 coups de la phase.

## 9. Elo de performance (résultats)

Distinct de l'« Elo estimé » de la section 6 (fondé sur la précision) : ici seuls comptent les **résultats**.

- Données : toutes les parties importées (analysées ou non) correspondant aux filtres, avec le classement
  Chess.com de l'adversaire **au moment de la partie**. Par défaut, parties classées seulement.
- Modèle Elo logistique : score attendu `E(R) = 1 / (1 + 10^((Rᵢ − R) / 400))`, Rᵢ = classement de l'adversaire.
  Gain = 1, nulle = ½, perte = 0.
- **Estimation** : maximum de vraisemblance, `log L(R) = Σ sᵢ ln E(R) + (1 − sᵢ) ln(1 − E(R))`. Le maximum vérifie
  `Σ E(R) = Σ sᵢ` : c'est le classement pour lequel le score attendu égale le score obtenu.
- **Intervalle de confiance à 95 %** par rapport de vraisemblance : les R tels que
  `log L(R) ≥ log L(R̂) − 1,920729` (moitié du quantile 0,95 de la loi du χ² à 1 degré de liberté). Il est
  asymétrique quand le score est proche de 0 % ou de 100 %.
- **Score de 100 % (ou 0 %)** : le maximum est à l'infini ; seule une borne est donnée (« > X » ou « < X »), par la
  même règle avec un supremum égal à 0. Ces périodes ne sont pas tracées sur le graphique.
- Calculé **par cadence** (et par période dans une cadence), jamais en mélangeant les cadences : Chess.com tient
  un classement distinct pour chacune. À côté : le dernier classement Chess.com du joueur dans le groupe.
- Limites : les classements adverses sont pris comme exacts (leur incertitude Glicko est ignorée) et les parties
  supposées indépendantes ; sous 10 parties, le résultat est signalé comme peu fiable.
