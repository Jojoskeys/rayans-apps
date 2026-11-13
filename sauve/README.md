# Rayan's Sauve

Sauvegarde des dossiers importants (données des applications, Documents…) vers un disque externe, une clé USB ou
OneDrive, avec robocopy. Affiche la date de la dernière sauvegarde et rappelle de sauvegarder au bout de 7 jours.
Electron + React + TypeScript.

## Ce qu'elle fait

- **Dernière sauvegarde** : « aujourd'hui à 9:30 », « il y a 9 jours »… en vert, ou en orange quand il est temps.
- **Sauvegarder maintenant** : chaque dossier coché est copié dans `<destination>\Sauvegarde Rayan\<nom>`. Seuls les
  fichiers nouveaux ou modifiés sont recopiés. Rien n'est effacé de la sauvegarde, sauf avec l'option **Miroir**.
  Un `LISEZMOI.txt` à côté dit d'où vient chaque dossier, pour restaurer.
- **Dossiers proposés** :
  - Données des apps de Rayan's Launcher (`%LOCALAPPDATA%\fr.rayan.launcher\data` : Chrono, Prière, Outils,
    Bosse…) ;
  - Rayan's Révision (`%APPDATA%\fr.rayan.revision`, avec ses copies journalières) ;
  - Rayan's Hifz (`hifz-donnees.json` seulement : l'audio se retélécharge) ;
  - Rayan's Ouvertures (`%APPDATA%\Rayans Ouvertures\donnees`) ;
  - Documents.

  D'autres dossiers s'ajoutent avec « Ajouter un dossier ». Une application jamais utilisée est simplement ignorée.
- **Destination** : un dossier au choix, ou le dossier OneDrive en un clic. Si le disque n'est pas branché, la
  fenêtre le dit.
- **Rappel** : notification une fois par jour, à partir de 10 h, quand la dernière sauvegarde réussie date de plus de
  7 jours (3, 7, 14 ou 30 au choix). « Démarrer avec Windows » est nécessaire pour le recevoir sans ouvrir
  l'application.
- **Historique** des 30 dernières sauvegardes (fichiers copiés, taille, durée).

## robocopy

`robocopy <source> <destination> /E /XJ /FFT /R:1 /W:2 /MT:8 /BYTES …` (`/MIR` au lieu de `/E` en miroir) :

- `/XJ` ignore les jonctions (« Ma musique » dans Documents…), qui feraient des boucles ;
- `/FFT` tolère les dates à 2 secondes près des disques FAT et exFAT (clés USB, disques externes) ;
- `/XD` ignore les caches des applications (Cache, GPUCache, EBWebView…) et `node_modules` ;
- `/XF` ignore `*.tmp`, `~$*` (fichiers Office ouverts), `desktop.ini`, `Thumbs.db`.

Le résumé de robocopy est lu par position (dossiers, fichiers, octets), quelle que soit la langue de Windows. Codes
de sortie 0 à 7 : réussite ; 8 et plus : des fichiers n'ont pas pu être copiés (le rapport le dit).

## Données

`sauve.json` (+ `.bak` : réglages, historique) dans le dossier fourni par Rayan's Launcher (`HANGAR_APP_DATA`),
sinon `%APPDATA%\Rayans Sauve`.

## Développement

```bash
npm install
npm start               # construit et lance
npm test                # sources, noms de dossiers, arguments et résumé robocopy, rappel
npm run typecheck
npm run test:lancement  # vraie sauvegarde robocopy dans un dossier temporaire, deuxième passage, miroir, rappel
npm run dist:win        # ZIP Windows dans dist/
npm run icons           # redessine les icônes
```

Le workflow `.github/workflows/sauve.yml` vérifie, construit, lance le paquet comme un double-clic et publie le ZIP
dans Rayan's Launcher (id `rayans-sauve`).
