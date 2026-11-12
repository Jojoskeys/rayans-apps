# Rayan's Ouvertures

Application de bureau (Electron) pour travailler **ses propres ouvertures** à partir de ses parties Chess.com.

1. **Import** : entrez votre pseudo Chess.com ; les parties terminées sont récupérées par l'API publique
   (sans compte ni clé), mois par mois, comme dans Analyse Échecs.
2. **Ouvertures jouées** : chaque partie est rattachée à une ouverture de la base libre
   [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0), par couleur.
   On repère le coup où la partie **quitte la théorie**, et qui l'a quittée (vous ou l'adversaire).
3. **Analyse Stockfish** (en arrière-plan, sur les N parties les plus récentes) : vos coups joués hors théorie
   dans les **15 premiers coups** sont évalués (MultiPV 2, puis `searchmoves` pour le coup joué).
   Perte = baisse des chances de gain (formule Lichess) : imprécision ≥ 5 pts, erreur ≥ 10, gaffe ≥ 20.
4. **Positions à travailler** : la position avant chaque erreur, ou avant une sortie de théorie qui perd plus
   de 3 pts. Une position rencontrée dans plusieurs parties ne donne qu'un exercice (les plus fréquentes passent
   en premier).
5. **Entraînement** : jouez le bon coup sur l'échiquier. Accepté : le meilleur coup de Stockfish, le 2e s'il est
   presque aussi bon, tout coup qui perd au plus 3 pts, ou un coup de la théorie qui perd au plus 6 pts.
   Répétition espacée (boîtes de Leitner : 1, 3, 7, 21, 60 jours ; échec → retour dans 10 minutes).
6. **Répertoire** : une fiche par ouverture et par couleur : score, coup moyen de sortie de théorie,
   erreurs, exercices à faire / maîtrisés et **taux de réussite** aux exercices, variantes jouées.

## Développement

```bash
npm ci
npm run fetch:stockfish   # Stockfish 19 officiel, empreinte SHA-256 vérifiée
npm test                  # tests unitaires (le test Stockfish réel est ignoré sans binaire)
npm start                 # construit l'interface et lance l'application
```

Données : dossier `donnees` du profil Electron (variable `RAYANS_OUVERTURES_DATA` pour le changer).
Paquet Windows : `.github/workflows/echecs-ouvertures.yml` (ZIP avec `rayans-launcher.json` pour Rayan's Launcher).

Code repris d'Analyse Échecs (`echecs-analyse/`) : moteur UCI, import Chess.com, validation des parties,
serveur local sécurisé, script de téléchargement de Stockfish. Licence GPL-3.0-or-later.
