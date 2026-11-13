# Rayan's Bosse

Un espace de travail par projet : les applications, dossiers, fichiers et sites du projet, ouverts en un clic, et
Rayan's Chrono qui démarre sur ce projet. Electron + React + TypeScript, comme Rayan's Prière.

## Ce qu'elle fait

- **Espaces** : un par projet, avec un nom et une couleur. Chaque espace contient, dans l'ordre :
  - des **programmes** (`.exe` avec arguments facultatifs, raccourcis `.lnk`, `.bat`) ;
  - des **applications de Rayan** installées par Rayan's Launcher (lancées comme le launcher le fait, avec leurs
    données) ;
  - des **dossiers** et des **fichiers** (ouverts avec l'application par défaut) ;
  - des **sites** (`github.com/moi` devient `https://github.com/moi`).

  On les ajoute par les boutons ou en les déposant dans la fenêtre. Le bouton ▷ d'une ligne ouvre seulement cet
  élément.
- **Ouvrir l'espace** : tout s'ouvre, puis un compte rendu dit ce qui n'a pas pu l'être (dossier déplacé,
  programme désinstallé…). La fenêtre se réduit ensuite (réglable).
- **Rayan's Chrono** (coché par défaut) : Chrono démarre sur le projet du même nom (ou un autre nom choisi), créé
  dans Chrono s'il n'existe pas. Si Chrono tourne déjà, il change simplement de projet.
- **PowerToys Workspaces** (facultatif) : si PowerToys est installé, un espace PowerToys peut être lancé en même
  temps, pour placer les fenêtres.

## Depuis la barre de Rayan's Outils

`bosse <projet>` (Ctrl + Alt + Espace) ouvre l'espace sans afficher la fenêtre de Bosse. Le nom peut être tapé
sans accents ni majuscules, ou seulement son début s'il n'y a pas d'ambiguïté (`bosse mem` pour « Mémoire de
master »). Un nom inconnu ouvre la fenêtre avec la liste des espaces.

En ligne de commande : `"Rayans Bosse.exe" --projet=<nom>`.

## Chrono

Rayan's Chrono accepte maintenant `--projet=<nom>` (au lancement, ou quand il tourne déjà) : il sélectionne ce
projet (le crée, ou le désarchive), saute une pause Pomodoro à l'arrêt, et démarre le minuteur.

## Données

`bosse.json` (+ `.bak`) dans le dossier fourni par Rayan's Launcher (`HANGAR_APP_DATA`), sinon
`%APPDATA%\Rayans Bosse`. Les applications de Rayan sont trouvées dans
`%LOCALAPPDATA%\fr.rayan.launcher\installed.json`. Les espaces PowerToys sont lus dans
`%LOCALAPPDATA%\Microsoft\PowerToys\Workspaces\workspaces.json` et lancés avec `PowerToys.WorkspacesLauncher.exe`.

## Développement

```bash
npm install
npm start               # construit et lance
npm test                # espaces, recherche par nom, adresses, launcher
npm run typecheck
npm run test:lancement  # crée un espace en cliquant, y ajoute un site et un dossier, l'ouvre (ouverture simulée)
npm run dist:win        # ZIP Windows dans dist/
npm run icons           # redessine les icônes
```

Le test de lancement n'ouvre rien pour de vrai : il vérifie la liste de ce qui aurait été ouvert.

Le workflow `.github/workflows/bosse.yml` vérifie, construit, lance le paquet comme un double-clic et publie le ZIP
dans Rayan's Launcher (id `rayans-bosse`).
