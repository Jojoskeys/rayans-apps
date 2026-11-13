# Rayan's Aujourd'hui

Le tableau du jour : ce qu'il reste à réviser dans Rayan's Révision, Rayan's Hifz et Rayan's Ouvertures, un bouton
pour ouvrir chaque application, et une notification le soir s'il reste quelque chose. Electron + React + TypeScript.

## Ce qu'elle fait

- **Trois nombres**, relus chaque minute et quand la fenêtre revient au premier plan :
  - **Révision** : cartes en apprentissage, révisions dues avant la fin de la journée de révision (4 h du matin),
    nouvelles cartes dans la limite quotidienne de chaque paquet, comme la séance de Révision les compte.
  - **Hifz** : portions dont la révision est due, ou qui contiennent un verset marqué « à revoir ».
  - **Ouvertures** : positions déjà travaillées dont l'échéance est passée. Les positions jamais vues ne sont pas
    comptées (il faudrait refaire l'analyse des parties).
- **Ouvrir** : lance l'application comme Rayan's Launcher le fait.
- **Rappel du soir** : à 19 h par défaut (réglable), une notification « Révision : 5 · Hifz : 2 » s'il reste
  quelque chose, une fois par jour. Si l'ordinateur est allumé plus tard (jusqu'à 3 h après), le rappel part à ce
  moment-là.
- **Zone de notification** : l'infobulle donne le détail ; le menu ouvre chaque application.
- **Démarrer avec Windows** (réglages) : nécessaire pour que le rappel arrive sans ouvrir l'application.

## Données lues

Les fichiers des autres applications sont seulement lus, jamais modifiés :

| Application | Fichier |
| --- | --- |
| Révision | `%APPDATA%\fr.rayan.revision\revision.json` (ou `REVISION_DATA_DIR`) |
| Hifz | `%APPDATA%\Rayans Hifz\hifz-donnees.json` (ou `HIFZ_DATA_DIR`) |
| Ouvertures | `%APPDATA%\Rayans Ouvertures\donnees\joueurs\*\exercices.json` (ou `RAYANS_OUVERTURES_DATA`) |

Les règles de calcul reprennent celles de chaque application (voir `src/core/counts.ts`). Si l'une change sa
façon de compter, il faut mettre ce fichier à jour.

Réglages : `aujourdhui.json` dans le dossier fourni par Rayan's Launcher (`HANGAR_APP_DATA`), sinon
`%APPDATA%\Rayans Aujourdhui`.

## Développement

```bash
npm install
npm start               # construit et lance
npm test                # comptes de Révision, Hifz, Ouvertures ; rappel du soir
npm run typecheck
npm run test:lancement  # fausses données, nombres affichés, rappel envoyé une fois, réglages
npm run dist:win        # ZIP Windows dans dist/
npm run icons           # redessine les icônes
```

Le workflow `.github/workflows/aujourdhui.yml` vérifie, construit, lance le paquet comme un double-clic et publie le
ZIP dans Rayan's Launcher (id `rayans-aujourdhui`).
