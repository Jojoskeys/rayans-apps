# Rayan's Recettes

Les recettes trouvées par Rayan's Favoris, dans une app Windows simple (Electron + React + TypeScript, thème Sakura).

- **Lecture** de `recettes.md` (titres `## Nom`, ingrédients, étapes) et des fiches `fiches\*.json` de catégorie
  « recette » de Rayan's Favoris. Rien n'est écrit dans ce dossier. Il est relu au retour sur la fenêtre.
- **Remarques halal et sèche** tirées du champ `pour_rayan` de la fiche, et les ingrédients à vérifier (gélatine,
  lardons, vin…).
- **Filtres** : riche en protéines, rapide, collation, repas (déduits du titre, des ingrédients et des étapes),
  **recherche**, **favoris**, **« je l'ai faite »** avec la date.
- **Mon plan** : un menu du lundi au dimanche (petit-déjeuner, déjeuner, collation, dîner) pioché dans les recettes.
  Pas la même recette deux jours de suite si possible, recettes riches en protéines d'abord au déjeuner et au dîner.
  Pour chaque jour : « ce que tu manges » et « ce que tu prépares aujourd'hui » (avec « prépare ce soir pour demain »
  pour les recettes qui reposent au frigo). Chaque case se change (autre recette ou « libre ») ; « Régénérer » garde
  les cases changées. Le total du jour (kcal, protéines) n'apparaît que si les fiches donnent ces chiffres.
- **Liste de courses** : des recettes cochées, d'un jour du plan ou de toute la semaine. Les ingrédients sont
  regroupés par produit, par rayon ou **par magasin**, à cocher pendant les courses et à copier en un clic.
- **Où l'acheter pas cher** : 2 ou 3 magasins conseillés par type de produit (`src/core/magasins.ts`). Ce sont des
  habitudes générales en France, sans prix ; le magasin d'un produit peut être changé et le choix est gardé.
- **Ajouter une recette** à la main, et **lien vers la vidéo** d'origine.

## Où sont les données

- Recettes lues : `Documents\Rayan's Favoris\` (ou le dossier de la variable `FAVORIS_DOSSIER`).
- Ce que l'app garde (favoris, dates, recettes ajoutées, liste de courses, plan, magasins choisis) : `recettes.json` dans le dossier
  `HANGAR_APP_DATA` fourni par Rayan's Launcher, sinon `%APPDATA%\Rayans Recettes\`. Jamais dans le dépôt.

Sur l'iPhone, la tuile **Recettes** de Rayan's Mobile lit et coche les mêmes données à travers Rayan's
Télécommande (articles pris, favoris, « je l'ai faite »). L'app relit `recettes.json` avant chaque changement et au
retour sur sa fenêtre, pour ne rien écraser.

## Développement

```bash
npm ci
npm start              # construit puis lance l'application
npm test               # tests : recettes.md et fiches, plan, listes de courses, magasins, données
npm run typecheck
npm run dist:win       # paquet Windows : dist/Rayans-Recettes-<version>-Windows-x64.zip
npm run test:lancement # lance l'app sur des recettes d'exemple, clique, crée le plan et vérifie les listes de courses
```

`RECETTES_CAPTURES=<dossier>` ajoute au test de lancement une capture de chaque écran. L'icône est dessinée par
`npm run icons`. `src/core/` contient la logique (sans Electron, testée dans `test/`), `src/main/` le processus
principal, `src/renderer/` l'interface.

La CI (`.github/workflows/recettes.yml`) publie dans Rayan's Launcher sous l'identifiant `rayans-recettes`.
