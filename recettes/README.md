# Rayan's Recettes

Les recettes trouvées par Rayan's Favoris, dans une app Windows simple (Electron + React + TypeScript, thème Sakura).

- **Lecture** de `recettes.md` (titres `## Nom`, ingrédients, étapes) et des fiches `fiches\*.json` de catégorie
  « recette » de Rayan's Favoris. Rien n'est écrit dans ce dossier. Il est relu au retour sur la fenêtre.
- **Remarques halal et sèche** tirées du champ `pour_rayan` de la fiche, et les ingrédients à vérifier (gélatine,
  lardons, vin…).
- **Filtres** : riche en protéines, rapide, collation, repas (déduits du titre, des ingrédients et des étapes),
  **recherche**, **favoris**, **« je l'ai faite »** avec la date.
- **Liste de courses** : cocher des recettes ; les ingrédients sont regroupés par produit et par rayon, à cocher
  pendant les courses et à copier en un clic.
- **Ajouter une recette** à la main, et **lien vers la vidéo** d'origine.

## Où sont les données

- Recettes lues : `Documents\Rayan's Favoris\` (ou le dossier de la variable `FAVORIS_DOSSIER`).
- Ce que l'app garde (favoris, dates, recettes ajoutées, liste de courses) : `recettes.json` dans le dossier
  `HANGAR_APP_DATA` fourni par Rayan's Launcher, sinon `%APPDATA%\Rayans Recettes\`. Jamais dans le dépôt.

## Développement

```bash
npm ci
npm start              # construit puis lance l'application
npm test               # tests : lecture de recettes.md et des fiches, liste de courses, données
npm run typecheck
npm run dist:win       # paquet Windows : dist/Rayans-Recettes-<version>-Windows-x64.zip
npm run test:lancement # lance l'app sur des recettes d'exemple, clique et vérifie la liste de courses
```

`RECETTES_CAPTURES=<dossier>` ajoute au test de lancement une capture de chaque écran. L'icône est dessinée par
`npm run icons`. `src/core/` contient la logique (sans Electron, testée dans `test/`), `src/main/` le processus
principal, `src/renderer/` l'interface.

La CI (`.github/workflows/recettes.yml`) publie dans Rayan's Launcher sous l'identifiant `rayans-recettes`.
