# Rayan's Outils

Sept petits outils derrière une barre de commande. **Ctrl + Alt + Espace** (modifiable) ouvre la barre de
commande. Vous tapez la commande, Entrée lance l'outil, Échap ferme la barre. Un clic sur l'icône de la zone de
notification ouvre aussi la barre de commande. Electron + React + TypeScript.

| Commande | Outil | Ce qui se passe |
| --- | --- | --- |
| `pdf` | Fusionner en PDF | Photos (JPEG, PNG, BMP) et PDF, dans l'ordre choisi, en un seul PDF. Les photos sont allégées et centrées sur une page A4 (paysage si la photo l'est). Qualité légère, normale ou originale. |
| `img 1mo`, `img 500ko` | Alléger une image | Copie JPEG sous la taille demandée, à côté de l'original (jamais modifié) : d'abord la qualité, puis les dimensions. |
| `tel`, `tel <lien>` | Échanger avec le téléphone | Fichiers : un QR code ouvre une page sur le téléphone pour les télécharger ou **envoyer ses photos**, qui arrivent dans `Téléchargements\Depuis le téléphone`. Lien ou texte : QR code direct. |
| `wifi` | Mot de passe Wi-Fi | Réseau connecté, clé enregistrée par Windows (masquée, à afficher ou copier), QR code de connexion pour un invité. |
| `son`, `son casque`, `casque` | Sortie audio | `son` passe à la sortie suivante, `son <nom>` choisit par le nom (« casque », « enceintes » ou un morceau du nom). |
| `texte` | Copier le texte de l'écran | Vous tracez un rectangle sur l'écran, Windows reconnaît le texte (OCR intégré, langues du profil) et le copie. |
| `eteins 45`, `eteins 1h30`, `veille 20`, `redemarre 10`, `eteins annuler` | Éteindre plus tard | L'extinction et le redémarrage sont confiés à Windows (`shutdown /t`) : ils ont lieu même si l'application est fermée. La veille est déclenchée par l'application. |

## Comment ça marche

- **Son, Wi-Fi, OCR** : scripts PowerShell fournis avec l'application (`resources/`, copiés dans
  `resources\scripts` du paquet), sans module à installer.
  - `son.ps1` utilise les interfaces COM de Windows MMDevice et PolicyConfig.
  - `wifi.ps1` exporte le profil avec `netsh wlan export … key=clear`, ce qui ne dépend pas de la langue de Windows. Le
    fichier est supprimé aussitôt.
  - `ocr.ps1` utilise `Windows.Media.Ocr`.
- **Partage avec le téléphone** : serveur HTTP sur le réseau local, ouvert seulement pendant le partage (15 minutes
  au plus, ou jusqu'à « Arrêter »). Son adresse contient un jeton aléatoire, sans lequel tout est refusé. La première
  fois, Windows peut demander d'autoriser l'accès au réseau privé. Le téléphone doit être sur le même Wi-Fi.
- **PDF** : `pdf-lib`. **QR codes** : `qrcode`.

## Données

`outils.json` (raccourci, réglages, minuterie en cours) dans le dossier fourni par Rayan's Launcher
(`HANGAR_APP_DATA`), sinon `%APPDATA%\Rayans Outils`. « Démarrer avec Windows » est désactivé par défaut. Activez-le
pour que le raccourci marche dès l'ouverture de session.

## Développement

```bash
npm install
npm start               # construit et lance
npm test                # commandes, compression, réseau
npm run typecheck
npm run test:lancement  # barre de commande, PDF, image, partage HTTP, QR ; hors CI aussi son, Wi-Fi et OCR (lecture seule)
npm run dist:win        # ZIP Windows dans dist/
npm run icons
```

Le test de lancement ne déclenche jamais de minuterie d'arrêt et ne change pas la sortie audio. La sélection à la
souris de la zone à lire n'est pas automatisée. L'OCR, lui, est vérifié sur une image fabriquée.

Le workflow `.github/workflows/outils.yml` vérifie, construit, lance le paquet comme un double-clic et publie le ZIP
dans Rayan's Launcher (id `rayans-outils`).
