# Rayan's Culture

Quiz de culture générale et d'actualité, 5 minutes par jour, en révision espacée (Tauri + React + TypeScript).

- **Séance du jour** : 10 questions (6 ou 14 au choix) : révisions dues d'abord, au plus 3 questions d'actualité, puis la banque de culture générale. Questions bonus une fois la séance finie.
- **Révision espacée** : J+1, J+3, J+7, J+14, J+30, J+60, J+120 ; bonne réponse → étape suivante, erreur → J+1 (`src/core/espacement.ts`, même principe que Rayan's Mémoire).
- **Niveau** : 2 bonnes réponses d'affilée → plus dur, 1 erreur → plus facile (facile, moyen, difficile). Au niveau facile, une mauvaise réponse de moins.
- **Actualité** (`src/core/actu.ts`) : lit l'édition « Ton monde » (format `EditionActu` de `mobile/src/shared/actu.ts`, fichier `{ editions: [...] }` ou une seule édition) et en tire, sans IA, jusqu'à 8 questions : rubrique (QCM ou vrai/faux, rubriques de thème seulement), média d'un article, sujet d'un début de résumé (une phrase, 160 caractères au plus), un seul média ou plusieurs. Ids reproductibles (`actu:<jour>:<sorte>:<empreinte du titre>`) : le PC et l'iPhone produisent les mêmes questions.
- **Banque fixe** (`src/core/questions.ts`) : faits stables et vérifiables, pas de sujet religieux.
- **Fiches, quiz, sources** (`src/core/contenu.ts`) : effet de test, espacement, oubli d'Ebbinghaus, retour immédiat, vérité illusoire, biais de l'actualité, difficulté adaptative.

## Données

- PC : `%APPDATA%\fr.rayan.culture\culture.json` (ou `CULTURE_DATA_DIR`), copie de secours et copies du jour.
- Format : `{ format: "rayans-culture", version: 1, niveau, cartes, reponses, seances, actuJours, reglages }`.
- Fusion PC ↔ iPhone : `fusionner` / `fusionnerTexte` dans `src/core/model.ts` (cartes : la plus récente par `maj` ; réponses : union par id ; séances : questions faites des deux côtés ; niveau et réglages : le plus récent).
- Actualité, en lecture seule : `actu.json` dans le dossier de données (ou `CULTURE_ACTU_FILE`, ou un fichier choisi dans l'onglet Actu). Sur l'iPhone : le fichier synchronisé « actu ».

## Commandes

```
npm install
npm test                 # tsc + vitest
npm run dev:ui           # interface seule, http://localhost:1442
npm run dev              # application Tauri
npx tauri build --no-bundle
node scripts/smoke.mjs "src-tauri/target/release/Rayans Culture.exe" 60
```
