# Règles d'analyse d'Analyse Échecs

Ce document décrit exactement ce que calcule l'application. Toutes ces règles sont testées dans `test/unit/`.
Les catégories, la précision et l'Elo estimé sont des **approximations propres à l'application**,
inspirées de Chess.com et de Lichess, mais **indépendantes** de leurs résultats.

## 1. Recherche moteur

- Moteur : binaire natif officiel **Stockfish 19** (tag `sf_19`), piloté en UCI. Fils : nombre de cœurs − 1
  (au moins 1, au plus 16). Table de hachage : 256 Mo.
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
