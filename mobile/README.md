# Rayan's Mobile

Les apps de Rayan sur iPhone : une web app installable (Safari → Partager → **Sur l'écran d'accueil**), publiée sur
GitHub Pages : **https://jojoskeys.github.io/rayans-apps/**

| App | Sur l'iPhone | Reste sur le PC |
| --- | --- | --- |
| Aujourd'hui | Ma journée, objectifs, bilan, adhkar, citation, **sport (séance guidée, saisie, course)**, cours ADE, mails partagés, échéances, compteurs | téléchargement d'ADE, lecture automatique des mails, rappels Windows |
| Révision | tout (séances, paquets, cartes, stats, import/export) | — |
| Hifz | tout, audio lu en ligne (everyayah.com) | audio hors ligne |
| Prière | horaires calculés sur le téléphone, réglages | notifications |
| Chrono | minuteur, projets, historique, export CSV | mini-fenêtre, notifications |
| Ouvertures | répertoire et entraînement sur les positions déjà analysées | import Chess.com, analyse Stockfish |
| Télécommande | piloter le PC, fichiers, presse-papiers (via Tailscale) | Rayan's Télécommande |
| Montre | **Aujourd'hui** (verres d'eau, séance, humeur, pas, distance, calories) et **7 derniers jours** (barres des pas et de l'eau, séances, humeurs) envoyés par Rayan's Montre sur la Garmin — lu sur le PC via la Télécommande | les saisies (sur la montre) |
| Recettes | **Aujourd'hui** (ce que je mange, ce que je prépare), **Courses** du jour ou de la semaine rangées par magasin, à cocher en magasin (bouton pour les copier dans la tuile Courses), **Recettes** (recherche, fiche, remarques halal et sèche, vidéo, favori, « je l'ai faite ») — lu sur le PC via la Télécommande | le plan de la semaine et l'ajout de recettes (Rayan's Recettes) |

Chaque app réutilise le code de l'app Windows (interface et règles de calcul) ; seule la couche « processus
principal » est remplacée par une version qui travaille dans le navigateur (`src/apps/*.tsx`).

## Synchronisation

Un fichier JSON par app dans un **dépôt GitHub privé** (`Jojoskeys/rayans-donnees`), avec un **jeton à accès limité**
(fine-grained, ce seul dépôt, *Contents : Read and write*) saisi par Rayan sur chaque appareil :

- **iPhone** : `src/shared/sync.ts`. Données d'abord sur l'appareil (fonctionne hors ligne), synchro à l'ouverture et
  quelques secondes après chaque changement, ou au retour en ligne.
- **PC** : pont dans Rayan's Aujourd'hui (`aujourdhui/src/main/sync.ts`), au démarrage, à l'ouverture de la fenêtre
  et toutes les 15 minutes. Une app Windows ouverte n'est pas touchée (synchronisée après sa fermeture).
- **Chiffrement de bout en bout** (`src/shared/e2e.ts`, testé) : AES-256-GCM, clé tirée d'une phrase secrète (PBKDF2-SHA256, 600 000 itérations). Tout est chiffré sur l'appareil avant l'envoi ; `cle.json` ne contient que le sel et une valeur de contrôle chiffrée (jamais la phrase). Sans la phrase, les données du dépôt ne peuvent pas être relues.
- **Fusion à trois versions** (`src/shared/merge.ts`, testée) : base commune, version locale, version distante.
  Ajouts des deux côtés gardés, la carte / portion révisée le plus tard l'emporte, journaux réunis, suppression
  propagée. Le PC télécharge ADE (le serveur de la fac refuse les autres sites) et publie l'emploi du temps ; il
  publie aussi les exercices d'Ouvertures calculés avec Stockfish.

## Développement

```bash
npm ci
npm test         # règles de fusion
npm run build    # dist/
npm run serve    # http://127.0.0.1:4173/rayans-apps/ (avec un faux GitHub pour tester la synchro)
```
