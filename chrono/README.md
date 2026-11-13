# Rayan's Chrono

Minuteur Pomodoro et suivi du temps par projet, pour Windows (Electron + React + TypeScript).

- **Pomodoro** : cycles travail / pause / longue pause réglables (25/5/15 min, longue pause tous les 4 par défaut),
  démarrage automatique des pauses et/ou du travail, notification Windows et carillon en fin de phase.
- **Chrono libre** : démarrer / arrêter un chronomètre simple.
- **Projets et tâches** : le temps est enregistré sur le projet et la tâche choisis. Changer de tâche en cours de route
  répartit le temps. Tâches à cocher, projets à archiver, saisie manuelle de temps oublié, suppression d'une plage.
- **Résumés** : jour et semaine (du lundi au dimanche), par projet et par tâche, histogramme de la semaine.
- **Export CSV** pour Excel (séparateur `;`, UTF-8) : la période affichée ou tout l'historique.
- **Mini-fenêtre** compacte toujours au-dessus des autres, et **icône dans la zone de notification** (rouge : travail,
  verte : pause, grise : arrêté ; clic droit pour démarrer, passer, ouvrir la mini-fenêtre ou quitter).
  Fermer la fenêtre garde le minuteur actif (réglable).
- **`--projet=<nom>`** (utilisé par Rayan's Bosse) : sélectionne ce projet (créé ou désarchivé au besoin, nom sans
  tenir compte des accents ni des majuscules), saute une pause Pomodoro à l'arrêt et démarre le minuteur. Si Chrono
  tourne déjà, il change simplement de projet ; lancé ainsi, il reste discret dans la zone de notification.

## Données

Tout reste sur l'ordinateur, dans `chrono.json` (et `chrono.json.bak`, la version précédente) :

- lancé par Rayan's Launcher : dans le dossier `HANGAR_APP_DATA` fourni par le launcher (conservé lors des mises à jour) ;
- sinon : `%APPDATA%\Rayans Chrono\`.

Un fichier illisible est mis de côté (`chrono.illisible-<date>.json`) et la sauvegarde précédente est restaurée.

## Développement

```bash
npm ci
npm start              # construit puis lance l'application
npm test               # tests unitaires (node --test, TypeScript natif : Node 22.18+ ou 24)
npm run typecheck
npm run dist:win       # paquet Windows : dist/Rayans-Chrono-<version>-Windows-x64.zip
npm run test:lancement # lance l'application, clique dans son interface et vérifie le résultat
node scripts/test-lancement.mjs "dist/win-unpacked/Rayans Chrono.exe"   # idem sur le paquet construit
```

`CHRONO_CAPTURES=<dossier>` ajoute au test de lancement une semaine d'exemple et une capture de chaque écran.
Les icônes sont dessinées par `npm run icons` (PNG versionnés dans `build/` et `assets/`).

Organisation : `src/core/` contient toute la logique (moteur du minuteur, résumés, CSV), sans dépendance à Electron et
testée dans `test/`. `src/main/` est le processus principal, seul détenteur de l'état ; `src/renderer/` l'interface
(fenêtre principale et mini-fenêtre).

## Pour Rayan's Launcher

La CI (*Rayan's Chrono*, `.github/workflows/chrono.yml`) publie l'artifact `Rayans-Chrono-pour-le-launcher` : un ZIP
avec la fiche `rayans-launcher.json` (identifiant `rayans-chrono-app`). Déposez-le dans le dossier `À ajouter` du
launcher. Version : `majeur.mineur.<numéro d'exécution CI>`, donc chaque construction devient une mise à jour.

L'identifiant n'est pas `rayans-chrono` : celui-ci appartient à la petite application de démonstration qui sert aux
tests du launcher (`launcher/demo-app`).
