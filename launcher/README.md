# Rayan's Launcher : le launcher Windows de Rayan

Rayan's Launcher distribue, installe, met à jour et lance les applications que vous publiez. Il lit un **catalogue JSON
distant**, télécharge des **ZIP**, vérifie leur **empreinte SHA-256**, les installe chacune dans son dossier et
garde le **dernier catalogue valide** pour fonctionner hors ligne.

Pile technique : **Tauri 2**, avec **React 19 + TypeScript** pour l'interface et **Rust** pour toutes les opérations
système (réseau, disque, processus).

- [Architecture](#architecture)
- [Démarrer en local (mode développement)](#démarrer-en-local-mode-développement)
- [Générer l'installateur Windows](#générer-linstallateur-windows)
- [Mode distribution : HTTPS et catalogue signé](#mode-distribution--https-et-catalogue-signé)
- [Publication automatique depuis GitHub](#publication-automatique-depuis-github)
- [Format du catalogue](#format-du-catalogue)
- [Ajouter une application](#ajouter-une-application)
- [Publier une mise à jour](#publier-une-mise-à-jour)
- [Ce que Rayan's Launcher garantit](#ce-que-rayans-launcher-garantit)
- [Tests et parcours vérifiés](#tests-et-parcours-vérifiés)
- [Hors périmètre et limites connues](#hors-périmètre-et-limites-connues)

## Architecture

```text
launcher/
  core/                 crate Rust hangar-core : tout le métier, sans interface
    src/catalog.rs        format du catalogue, validation, signature Ed25519, règles d'URL
    src/net.rs            HTTP (redirections non HTTPS refusées en distribution), file:// en développement
    src/archive.rs        extraction ZIP sûre (zip-slip, liens symboliques, taille bornée)
    src/lib.rs            Core : actualisation, installation, mise à jour, activation, lancement, désinstallation
    src/bin/hangar-tools.rs  outils de publication (clés, signature, empreintes, ZIP, catalogue) et CLI
    tests/flows.rs        parcours complets sur le vrai coeur et le vrai binaire de démo
  src-tauri/            couche Tauri mince : commandes et événements vers l'interface
    catalog-public-key.txt   clé publique intégrée au launcher (à remplacer par la vôtre)
  src/                  interface React + TypeScript (mock.ts : faux backend pour concevoir dans un navigateur)
  demo-app/             « Rayan's Chrono », application de démonstration compilée en 1.0.0 et 2.0.0
  scripts/              demo.mjs (catalogue local de démo), serve.mjs (serveur local), e2e-ui.mjs (parcours UI)
  examples/             catalogue d'exemple complet et visuels de la démo
```

Ce dossier est un projet autonome, au même titre que `echecs-analyse/` : il ne dépend pas des outils vidéo du dépôt.
Le workflow `.github/workflows/launcher.yml` le teste sous Linux et Windows et produit les installateurs.

## Démarrer en local (mode développement)

Prérequis sous Windows 10 ou 11 :

- [Rust](https://rustup.rs) (toolchain MSVC) avec les *Build Tools* Visual Studio (charge « Développement desktop en C++ ») ;
- Node.js 22 ;
- WebView2, déjà présent sur Windows 10 et 11 à jour.

Sous Linux, il faut en plus les paquets `libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev libssl-dev`.

Toutes les commandes se lancent depuis le dossier `launcher/`.

```bash
cd launcher
```

```bash
npm ci
```

Compilez l'Rayan's Chrono en 1.0.0 et en 2.0.0, puis créez un catalogue local vide dans `dev-catalog/` :

```bash
npm run demo -- init
```

Dans un premier terminal, servez ce catalogue sur `http://127.0.0.1:8787/catalog.json` :

```bash
npm run serve
```

Dans un second terminal, démarrez le launcher en mode développement :

```bash
npm run dev
```

Le launcher s'ouvre sur « Catalogue vide ». Pour essayer les parcours, enchaînez ensuite ces étapes, en cliquant
sur **Actualiser** dans le launcher après chacune :

| Étape | Commande | Résultat attendu |
|---|---|---|
| 1. Ajouter une application | `npm run demo -- add` | Rayan's Chrono 1.0.0 apparaît avec **Installer** |
| 2. Installer et lancer la v1 | *(dans le launcher)* | progression, puis **Lancer** ; une fenêtre « Rayan's Chrono v1.0.0 » s'ouvre |
| 3. Publier la v2 | `npm run demo -- v2` | **Mettre à jour** et **Lancer la 1.0.0** ; après la mise à jour, « v2.0.0 » s'ouvre |
| 4. ZIP corrompu | `npm run demo -- corrupt` | **Mettre à jour** vers 2.1.0 échoue avec un message d'empreinte ; **Lancer la 2.0.0** fonctionne |
| 5. Hors ligne | arrêtez `npm run serve`, fermez et rouvrez le launcher | bandeau « Hors ligne », l'application installée se lance |

`npm run demo -- reset` efface le catalogue de démonstration.

En mode développement, les données du launcher se trouvent dans `%LOCALAPPDATA%\fr.rayan.launcher\`. La variable
d'environnement `HANGAR_HOME` permet d'utiliser un autre dossier, par exemple pour des tests isolés.

Pour travailler sur l'interface seule dans un navigateur, avec un faux backend :

```bash
npm run dev:ui
```

Ouvrez ensuite `http://127.0.0.1:1420/?scenario=normal`. Les autres scénarios sont `vide`, `indisponible`,
`horsligne`, `erreur` et `progression`.

## Générer l'installateur Windows

À lancer sous Windows, depuis `launcher/`. Pour l'installateur de **distribution**, HTTPS et une signature valide
sont obligatoires :

```bash
npm run build:windows
```

Fichiers produits :

- `target\release\bundle\nsis\Rayan’s Launcher_0.1.0_x64-setup.exe` : installateur NSIS, par utilisateur, sans droits administrateur ;
- `target\release\bundle\msi\Rayan’s Launcher_0.1.0_x64_fr-FR.msi` : paquet MSI.

Pour un installateur **de test** qui accepte aussi le catalogue local (http://, file://, non signé), utilisez la
commande ci-dessous. Ne le distribuez pas.

```bash
npm run build:windows:dev
```

Sans machine Windows, poussez la branche : le workflow GitHub Actions *Rayan's Launcher* construit les deux
installateurs et les publie dans les *Artifacts* de l'exécution (`rayans-launcher-installateurs-windows`), avec le catalogue
de démonstration compilé pour Windows (`rayans-launcher-catalogue-demo-windows`).

Les installateurs ne sont pas signés Authenticode : SmartScreen affichera un avertissement au premier lancement.

## Mode distribution : HTTPS et catalogue signé

| | Mode développement | Mode distribution |
|---|---|---|
| Quand | `npm run dev`, binaire debug, ou `--features dev-mode` | `npm run build:windows` |
| Adresses acceptées | `https://`, `http://`, `file://` | `https://` uniquement (redirections comprises) |
| Signature du catalogue | vérifiée si un `.sig` existe, sinon catalogue accepté avec un avertissement | **obligatoire**, vérifiée avec la clé intégrée |
| Empreinte SHA-256 des ZIP | toujours vérifiée | toujours vérifiée |

Mise en place, une seule fois. La commande suivante crée `.keys/catalog-private.key`, à garder secrète (le dossier
est ignoré par git), et écrit la clé publique dans `src-tauri/catalog-public-key.txt` :

```bash
npm run keygen
```

Commitez `catalog-public-key.txt`, puis reconstruisez l'installateur : la clé y est intégrée à la compilation.
Sauvegardez la clé privée hors du dépôt. Si vous la perdez, vous devrez distribuer un nouveau launcher avec une
nouvelle clé publique.

À chaque modification, signez le catalogue. La commande écrit `catalog.json.sig`, la signature Ed25519 des octets
exacts du fichier :

```bash
npm run tools -- sign --key .keys/catalog-private.key chemin/vers/catalog.json
```

Publiez `catalog.json` **et** `catalog.json.sig` côte à côte. Le launcher cherche la signature à l'adresse du
catalogue suivie de `.sig`. Signez **après** la dernière modification : changer un seul octet invalide la signature.

Pour vérifier avant de publier :

```bash
npm run tools -- verify --public src-tauri/catalog-public-key.txt chemin/vers/catalog.json
```

En développement, `npm run demo` signe automatiquement le catalogue local si `.keys/catalog-private.key` existe.
Vous pouvez ainsi tester la signature de bout en bout avant de passer en HTTPS.

L'adresse du catalogue se règle dans **Paramètres**. L'installateur de distribution pointe d'emblée vers le
catalogue publié par la CI du dépôt (voir [Publication automatique](#publication-automatique-depuis-github)) :
`https://github.com/Jojoskeys/rayans-apps/releases/download/catalogue/catalog.json`. Si les paramètres contiennent
encore l'adresse `file://` d'un installateur de test, elle est remplacée par celle-ci. Pour pointer vers un autre
catalogue, définissez la variable `HANGAR_DEFAULT_CATALOG_URL` avant la compilation, par exemple dans Git Bash :

```bash
HANGAR_DEFAULT_CATALOG_URL=https://telechargements.exemple.fr/hangar/catalog.json npm run build:windows
```

## Publication automatique depuis GitHub

Chaque push sur `main` qui touche une application publie sa nouvelle version : les launchers installés affichent
**Mettre à jour** au démarrage suivant ou après **Actualiser**, sans aucun ZIP à télécharger à la main. Les
constructions des autres branches ne publient rien (leurs *Artifacts* restent utilisables avec « À ajouter »).

```text
workflow de l'app (ex. echecs-analyse.yml)
  job de construction Windows -> artifact : un ZIP avec rayans-launcher.json à sa racine
  job « publier » (main seulement) -> .github/workflows/rayans-launcher-publier.yml
      release      release GitHub <id>-v<version> : ZIP, icône, image, rayans-launcher-entree.json (SHA-256, taille)
      catalogue    .github/workflows/rayans-launcher-catalogue.yml
                   reconstruit catalog.json depuis toutes les releases (la plus récente valide par app),
                   le valide (hangar-tools validate --strict), le signe avec le secret, le vérifie avec
                   src-tauri/catalog-public-key.txt, puis le publie dans la release « catalogue »
```

- Adresse du catalogue : `https://github.com/Jojoskeys/rayans-apps/releases/download/catalogue/catalog.json`, et
  sa signature à la même adresse suivie de `.sig`. Les ZIP et les visuels sont des fichiers de releases GitHub
  (HTTPS, reprise des téléchargements acceptée).
- Une seule mise à jour du catalogue tourne à la fois pour tout le dépôt (groupe de concurrence
  `rayans-launcher-catalogue`). Si plusieurs apps publient ensemble, GitHub peut annuler un job « Catalogue » en
  attente : c'est normal, le suivant reconstruit le catalogue avec toutes les releases.
- Une release dont l'entrée est refusée par `hangar-tools validate --strict` est ignorée avec un avertissement :
  la version précédente de l'app reste au catalogue.
- Les 3 dernières releases de chaque app sont gardées (téléchargements en cours, retour en arrière) ; les plus
  anciennes sont supprimées avec leur tag.
- Relancer une exécution ne remplace pas une release déjà publiée (même numéro de version).
- Pour reconstruire le catalogue à la main : onglet *Actions* → *Rayan's Launcher - catalogue* → *Run workflow*
  sur `main`.

### Mise en place, une seule fois

1. **Créer la paire de clés** sur votre PC, depuis `launcher/`. Avec Rust fonctionnel (toolchain MSVC) :

   ```bash
   npm run keygen
   ```

   Sans Rust (même format, seulement Node.js) :

   ```bash
   npm run keygen:node
   ```

   La clé privée est écrite dans `launcher/.keys/catalog-private.key` (dossier ignoré par git) et la clé publique
   dans `launcher/src-tauri/catalog-public-key.txt`. Sauvegardez la clé privée hors du dépôt (gestionnaire de mots
   de passe) : la perdre oblige à redistribuer un launcher avec une nouvelle clé publique.

2. **Ajouter la clé privée en secret GitHub** nommé `RAYANS_LAUNCHER_CATALOG_KEY`. Dans GitHub : *Settings* →
   *Secrets and variables* → *Actions* → *New repository secret*, nom `RAYANS_LAUNCHER_CATALOG_KEY`, valeur : le
   contenu du fichier `.keys/catalog-private.key` (une ligne). Ou avec GitHub CLI, depuis `launcher/` :

   ```bash
   gh secret set RAYANS_LAUNCHER_CATALOG_KEY --repo Jojoskeys/rayans-apps < .keys/catalog-private.key
   ```

3. **Commiter la clé publique** `launcher/src-tauri/catalog-public-key.txt` et pousser sur `main`. Ce push
   reconstruit le launcher avec cette clé et publie sa première version dans le catalogue.

4. **Installer une fois le launcher de distribution.** Sur la page *Releases* du dépôt, ouvrez la release
   `rayans-launcher-v0.1.<n>`, téléchargez `rayans-launcher-0.1.<n>.zip`, extrayez-le et lancez
   `Rayans-Launcher-setup.exe`. Vos applications installées et leurs données sont conservées. Ensuite, le launcher
   se met à jour tout seul : un bandeau « Nouvelle version de Rayan's Launcher » propose de télécharger et
   d'ouvrir le nouvel installateur.

Rien d'autre à activer : pas de GitHub Pages, le jeton `GITHUB_TOKEN` de chaque exécution suffit pour créer les
releases. Tant que le secret ou la clé publique manque, le job « Catalogue » échoue avec un message qui dit quoi
faire ; les releases des apps sont quand même créées et entreront au catalogue à la première exécution réussie.

### Brancher une nouvelle application

1. **Le ZIP.** Dans la construction Windows de l'app, mettez à la racine du ZIP une fiche `rayans-launcher.json` :

   ```json
   { "id": "mon-app", "name": "Mon App", "description": "Ce que fait Mon App.", "version": "1.0.123",
     "releaseNotes": "Ce qui change.", "executable": "Mon App.exe" }
   ```

   Tous les champs sont obligatoires. `id` est définitif (2 à 64 caractères `a-z 0-9 - _`). `version` doit
   augmenter à chaque construction, par exemple `majeur.mineur.<numéro d'exécution + 100>` comme les autres apps.
   `executable` est le chemin du `.exe` dans le ZIP. L'id `rayans-launcher` est réservé au launcher.

2. **L'artifact.** Envoyez ce ZIP, seul, dans un artifact de l'exécution :

   ```yaml
         - uses: actions/upload-artifact@v5
           with:
             name: Mon-App-pour-le-launcher
             path: mon-app/launcher/*.zip
             compression-level: 0
   ```

3. **Le job de publication**, à la fin du workflow de l'app (`needs` : le job qui a envoyé l'artifact) :

   ```yaml
     publier:
       name: Publication dans Rayan's Launcher
       needs: windows
       if: github.ref == 'refs/heads/main'
       permissions:
         contents: write
       uses: ./.github/workflows/rayans-launcher-publier.yml
       with:
         artifact: Mon-App-pour-le-launcher
         icon: mon-app/assets/icone.png
         # image: mon-app/assets/banniere.png   (facultatif, l'icône par défaut)
       secrets: inherit
   ```

   Gardez `permissions: contents: read` en tête du workflow : seul ce job a besoin d'écrire. L'icône et l'image
   sont des fichiers du dépôt (PNG, JPEG, GIF, WebP ou SVG, 6 Mo maximum).

Au prochain push sur `main` qui touche l'app, elle apparaît dans le catalogue de tous les launchers.

Pour tester la fiche sans publier, depuis la racine du dépôt (Node.js seulement) :

```bash
node .github/publication/catalogue.mjs entree --manifest rayans-launcher.json --zip MonApp.zip --repo Jojoskeys/rayans-apps --icon mon-app/assets/icone.png --dest essai-release
```

Les tests du script de publication :

```bash
node --test .github/publication/catalogue.test.mjs
```

## Format du catalogue

Exemple complet (aussi dans [`examples/catalog.example.json`](examples/catalog.example.json)) :

```json
{
  "schemaVersion": 1,
  "title": "Le catalogue de Rayan",
  "apps": [
    {
      "id": "rayans-chrono",
      "name": "Rayan's Chrono",
      "description": "Une petite horloge qui compte ses lancements. Elle sert à tester Rayan's Launcher de bout en bout.",
      "icon": "img/rayans-chrono-icon.svg",
      "image": "img/rayans-chrono-image.svg",
      "version": "2.0.0",
      "releaseNotes": "Les secondes sont affichées.\nLe compteur de lancements est conservé pendant la mise à jour.",
      "releaseDate": "2026-11-12",
      "downloadUrl": "https://telechargements.exemple.fr/hangar/zips/rayans-chrono-2.0.0.zip",
      "sha256": "a926cf1cabbb09ae3d1c4f44cb358ba34887aa25dc49c7c77beb8bda18674f72",
      "size": 152340,
      "executable": "RayansChrono.exe"
    },
    {
      "id": "rayans-notes",
      "name": "Rayan's Notes",
      "description": "Prise de notes rapide, hors ligne, avec export Markdown.",
      "icon": "https://telechargements.exemple.fr/hangar/img/rayans-notes-icon.png",
      "image": "https://telechargements.exemple.fr/hangar/img/rayans-notes-image.jpg",
      "version": "0.4.2",
      "releaseNotes": "Export Markdown.\nCorrection de la sauvegarde automatique.",
      "downloadUrl": "zips/rayans-notes-0.4.2.zip",
      "sha256": "5f0c6c3c0b8e4d8f9a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6071",
      "executable": "bin/RayansNotes.exe"
    }
  ]
}
```

Les empreintes et les tailles de cet exemple sont illustratives. Calculez les vôtres avec `hangar-tools`.

| Champ | Obligatoire | Règle |
|---|---|---|
| `schemaVersion` | oui | `1` |
| `title` | non | titre affiché en tête du catalogue |
| `apps[].id` | oui | identifiant **stable** : 2 à 64 caractères `a-z 0-9 - _`. Ne le changez jamais : il relie l'installation locale à l'entrée du catalogue. |
| `name`, `description` | oui | texte |
| `icon`, `image` | oui | URL d'une image PNG, JPEG, GIF, WebP ou SVG (6 Mo maximum). Elle est mise en cache pour l'affichage hors ligne. |
| `version` | oui | [SemVer](https://semver.org/lang/fr/) `MAJEUR.MINEUR.CORRECTIF`. Une mise à jour est proposée quand cette version est **supérieure** à la version installée. |
| `releaseNotes` | oui | texte ; les retours à la ligne `\n` sont conservés |
| `releaseDate` | non | date affichée sur la fiche |
| `downloadUrl` | oui | URL du ZIP |
| `sha256` | oui | empreinte SHA-256 du ZIP (64 caractères hexadécimaux) |
| `size` | non | taille en octets, utilisée pour la progression si le serveur ne l'envoie pas |
| `executable` | oui | chemin **relatif** de l'exécutable dans le ZIP (`/` ou `\`), sans `..` ; sous Windows, un `.exe` |

Les URL peuvent être absolues ou **relatives à l'adresse du catalogue** (`zips/app.zip`), ce qui permet de tout
publier dans un même dossier. Le catalogue est validé en entier avant usage : la moindre erreur (champ manquant,
version mal formée, `id` en double, chemin dangereux, `http://` en distribution) fait refuser **tout** le nouveau
catalogue avec un message précis, et le dernier catalogue valide reste utilisé. Les champs inconnus sont ignorés.

Pour contrôler un catalogue avant de le publier, utilisez la commande suivante. `--strict` applique les règles de
distribution :

```bash
npm run tools -- validate chemin/vers/catalog.json --strict --base-url https://telechargements.exemple.fr/hangar/catalog.json
```

## Ajouter une application

### Le plus simple : depuis le launcher (installateur de test)

Au premier démarrage, l'installateur de test crée un catalogue vide dans
`Documents\Rayan's Launcher\catalog.json` et l'utilise. Une adresse déjà réglée dans les paramètres est conservée.

Avec un catalogue local (adresse `file://`), deux façons d'ajouter une application :

- **Bouton « Ajouter un ZIP »** (page Catalogue) : choisissez le ZIP. Le launcher trouve le `.exe`, propose le nom, la
  version et l'identifiant, puis copie le ZIP dans `zips\`, calcule son SHA-256 et écrit l'entrée. Pour une mise à jour,
  choisissez le nouveau ZIP et indiquez une version plus grande.
- **Dossier `À ajouter`** (à côté de `catalog.json`) : déposez-y un ZIP. Il est ajouté au démarrage et à chaque clic sur
  « Actualiser », puis retiré du dossier. Un bandeau dit ce qui a été ajouté ou refusé, et pourquoi. Seuls les ZIP qui se
  décrivent entièrement sont acceptés : fiche `rayans-launcher.json` à la racine du ZIP, ou application reconnue.
  Un ZIP d'*Artifact* GitHub (un ZIP qui contient le ZIP) est accepté tel quel.

Fiche `rayans-launcher.json` facultative, à la racine du ZIP :

```json
{ "id": "mon-app", "name": "Mon app", "description": "…", "version": "1.2.0",
  "releaseNotes": "…", "executable": "Mon App.exe" }
```

Le nom et la description déjà présents au catalogue sont toujours conservés. Un catalogue signé (`catalog.json.sig`)
n'est jamais modifié par le launcher : utilisez `hangar-tools publish` puis re-signez.

**Analyse Échecs.** Sur `main`, chaque construction est publiée automatiquement dans le catalogue (voir
[Publication automatique](#publication-automatique-depuis-github)). Sur les autres branches, la CI (*Analyse
Echecs - paquets*) produit l'artifact `Rayans-Echecs-pour-le-launcher` : téléchargez-le et déposez-le dans
`À ajouter`, il apparaît sous le nom « Rayan's Échecs ». Sa version est `majeur.mineur.<numéro d'exécution CI + 100>`,
donc chaque nouvelle construction devient une mise à jour.

### À la main

Votre application reçoit trois variables d'environnement au lancement :

| Variable | Contenu |
|---|---|
| `HANGAR_APP_DATA` | dossier de **données utilisateur**, conservé lors des mises à jour (et lors de la désinstallation, sauf demande contraire) |
| `HANGAR_APP_VERSION` | version lancée |
| `HANGAR_APP_ID` | identifiant |

Le dossier courant est le dossier de la version. Il est remplacé à chaque mise à jour : l'application ne doit donc
pas y écrire ses données, et doit utiliser `HANGAR_APP_DATA`.

**1. Créez le ZIP.** Mettez dans un dossier tout ce que l'application doit trouver à côté d'elle, puis :

```bash
npm run tools -- pack chemin/vers/MonApp-1.0.0 publication/zips/mon-app-1.0.0.zip
```

La commande affiche l'empreinte SHA-256. Tout ZIP standard convient aussi, et `npm run tools -- hash fichier.zip`
calcule son empreinte.

**2. Ajoutez l'entrée au catalogue.** Écrivez-la à la main, au format ci-dessus, ou laissez `publish` calculer
`sha256` et `size` :

```bash
npm run tools -- publish --catalog publication/catalog.json --id mon-app --version 1.0.0 --zip publication/zips/mon-app-1.0.0.zip --name "Mon App" --description "Ce que fait Mon App." --icon img/mon-app-icon.png --image img/mon-app-image.jpg --executable MonApp.exe --notes "Première version."
```

Sans `--download-url`, l'adresse vaut `zips/<nom du ZIP>`, relative au catalogue.

**3. Signez** (en distribution) :

```bash
npm run tools -- sign --key .keys/catalog-private.key publication/catalog.json
```

**4. Publiez** sur votre serveur HTTPS le ZIP, les images, `catalog.json` et `catalog.json.sig`. Les launchers
affichent la nouvelle application au démarrage suivant ou dès que l'utilisateur clique sur **Actualiser**, sans
reconstruire le launcher.

## Téléchargements, dossiers et raccourcis

- **Annuler** : pendant le téléchargement, « Annuler le téléchargement ». Ce qui est reçu est gardé.
- **Reprendre** : le bouton « Reprendre » repart là où le téléchargement s'était arrêté, même après une coupure
  réseau ou un redémarrage du launcher (en-tête HTTP `Range`). L'empreinte SHA-256 porte toujours sur le fichier
  entier. « Abandonner » supprime le début gardé.
- **Ouvrir le dossier** : sur la fiche d'une application installée, « Ouvrir le dossier de l'application » (version
  active) et « Ouvrir le dossier des données ».
- **Raccourci sur le Bureau** (Windows) : « Créer un raccourci sur le Bureau ». Le raccourci ouvre Rayan's Launcher avec
  `--launch <id>` : la version active est lancée et vérifiée, et le raccourci reste bon après une mise à jour. Si le
  launcher est déjà ouvert, il lance l'application sans ouvrir de deuxième fenêtre. Le raccourci est supprimé à la
  désinstallation.

## Mettre à jour le launcher lui-même

La CI numérote chaque construction `0.1.<numéro d'exécution + 100>`.

- **Automatiquement (catalogue publié)** : sur `main`, la CI publie l'installateur de distribution dans l'entrée
  `rayans-launcher` du catalogue. Cette entrée n'apparaît pas parmi les applications : quand sa version dépasse
  celle du launcher, un bandeau « Nouvelle version de Rayan's Launcher » apparaît. Le bouton télécharge
  l'installateur, vérifie son SHA-256 comme pour une application, ferme le launcher et ouvre l'installateur.
- **À la main (catalogue local)** : l'artifact `Rayans-Launcher-mise-a-jour` (l'installateur de test seul), déposé
  tel quel dans `À ajouter`, fait apparaître le même bandeau. L'artifact complet
  `rayans-launcher-installateurs-windows` marche aussi : le launcher y prend l'installateur du même mode
  (`developpement/` ou `distribution/`).

Dans les deux cas, les applications installées et leurs données ne bougent pas.

## Signature Authenticode

Un certificat de signature de code est **payant** (autorité de certification, ou service Azure Trusted Signing).
Une fois le certificat obtenu au format `.pfx`, ajoutez deux secrets au dépôt GitHub (Settings → Secrets and
variables → Actions) :

- `WINDOWS_CERTIFICATE` : le fichier `.pfx` encodé en base64 (PowerShell :
  `[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.pfx"))`) ;
- `WINDOWS_CERTIFICATE_PASSWORD` : son mot de passe.

La CI signe alors `hangar.exe` et les installateurs (SHA-256, horodatage DigiCert). Sans ces secrets, elle continue
sans signer et le signale dans le résumé de l'exécution.

## Publier une mise à jour

Publiez le nouveau ZIP **sous un nouveau nom**, sans écraser l'ancien, pour que les téléchargements en cours restent
cohérents. Remplacez ensuite les métadonnées de version de l'entrée existante :

```bash
npm run tools -- publish --catalog publication/catalog.json --id mon-app --version 1.1.0 --zip publication/zips/mon-app-1.1.0.zip --notes "Nouveautés de la 1.1.0."
```

À la main, cela revient à modifier `version`, `releaseNotes`, `downloadUrl`, `sha256` (et `size`, `releaseDate`) de
l'entrée qui porte le même `id`. Signez à nouveau, puis publiez le catalogue et sa signature. Les launchers affichent
alors **Mettre à jour** à côté de **Lancer la 1.0.0**.

Pour retirer une application du catalogue, supprimez son entrée. Les installations existantes restent lançables et
désinstallables, avec la mention « retirée du catalogue ».

## Ce que Rayan's Launcher garantit

- **Catalogue** : validé en entier avant usage ; en distribution, HTTPS et signature Ed25519 vérifiée avec la clé
  intégrée **avant** de faire confiance aux URL et aux empreintes qu'il contient. La copie locale est revérifiée à
  chaque démarrage.
- **Téléchargement** : dans `downloads/`, l'empreinte est calculée au fil de l'eau puis comparée au catalogue.
  Le fichier est supprimé dans tous les cas.
- **Extraction** : dans un dossier `apps/<id>/staging-…` séparé. Si une seule entrée est un chemin absolu, contient
  `..`, désigne un lecteur ou un flux NTFS (`:`), est un lien symbolique ou un doublon, l'archive **entière** est
  refusée avant toute écriture. Le nombre d'entrées et la taille décompressée sont bornés.
- **Activation** : seulement après avoir vérifié que l'exécutable attendu est présent, est un fichier et reste dans
  le dossier. La version préparée est renommée en `apps/<id>/versions/<version>-…`, puis `installed.json` est mis à
  jour de façon atomique. En cas d'échec à n'importe quelle étape, la version précédente n'est pas touchée et reste
  lançable.
- **Application ouverte** : la mise à jour est préparée et vérifiée, puis activée automatiquement à la fermeture de
  l'application. L'ancienne version n'est supprimée qu'à ce moment-là.
- **Concurrence** : une seule installation à la fois par application, garantie par un verrou de fichier (inter-processus,
  libéré même après un plantage) et un contrôle en mémoire. Une seule instance du launcher.
- **Lancement** : l'exécutable enregistré est lancé directement (`CreateProcess`, jamais via `cmd` ou un shell), après
  revérification de son empreinte SHA-256. Un fichier modifié depuis l'installation est refusé. Sous Windows, seuls
  les `.exe` sont acceptés : les `.bat` et `.cmd` passeraient par `cmd.exe`.
- **Données** : `data/<id>/` est séparé des fichiers de version. La désinstallation le conserve, sauf si
  « Supprimer aussi les données utilisateur » est coché.
- **Hors ligne** : le dernier catalogue valide et les visuels sont en cache. Les applications installées se lancent
  sans réseau, même si elles ont été retirées du catalogue.

Arborescence locale (`%LOCALAPPDATA%\fr.rayan.launcher\`) :

```text
settings.json  installed.json  catalog-cache.json
images/  downloads/  locks/
apps/<id>/versions/<version>-<n>/   fichiers de la version active (et d'une version en attente)
data/<id>/                          données utilisateur
```

## Tests et parcours vérifiés

Commandes :

```bash
npm test
```

```bash
npx tauri build --debug --no-bundle
```

```bash
xvfb-run -a npm run e2e:ui
```

`npm test` compile la démo puis lance les tests du cœur (unitaires et parcours complets). `e2e:ui` pilote la
**vraie application** avec WebDriver (`tauri-driver`) : il clique sur les boutons, puis contrôle le journal écrit par
l'Rayan's Chrono et l'état du disque. Les captures sont enregistrées dans `e2e-output/`. Sous Linux, ce test demande
`cargo install tauri-driver --locked` et le paquet `webkit2gtk-driver`.

| Parcours | `cargo test` (cœur + vrai binaire de démo) | `e2e:ui` (vraie application, clics) |
|---|---|---|
| 1. Nouvelle entrée visible sans reconstruire | ✔ Linux | ✔ Linux |
| 2. Installer et lancer la v1 | ✔ Linux | ✔ Linux |
| 3. Publier la v2, détecter, mettre à jour, lancer | ✔ Linux | ✔ Linux |
| 4. ZIP corrompu, la version installée reste lançable | ✔ Linux | ✔ Linux |
| 5. Redémarrage hors ligne et lancement | ✔ Linux | ✔ Linux |
| Mise à jour reportée tant que l'app est ouverte | ✔ Linux | — |
| Installations concurrentes refusées (même processus et autre processus) | ✔ Linux | — |
| Archive avec `../`, exécutable absent, exécutable modifié | ✔ Linux | — |
| Signature : refus d'un catalogue modifié ou signé par une autre clé, HTTPS exigé | ✔ Linux | — |
| Désinstallation qui conserve les données | ✔ Linux | ✔ Linux |

Ces tests ont été exécutés sous Linux (WebKitGTK), dans l'environnement où le launcher a été développé. Sous Windows,
le workflow GitHub Actions exécute les mêmes tests du cœur avec `RayansChrono.exe`, tente le parcours UI avec WebView2
et construit les installateurs. Consultez son résultat pour l'état sous Windows.

## Hors périmètre et limites connues

- Hors périmètre de cette version : comptes utilisateurs, installations silencieuses.
- La mise à jour du launcher passe par le catalogue signé (installateur vérifié par SHA-256) ou par « À ajouter ».
  L'installateur lui-même n'est pas signé Authenticode tant qu'aucun certificat n'est fourni.
- Publication automatique : le catalogue et sa signature sont remplacés l'un après l'autre dans la release
  « catalogue ». Un launcher qui actualise exactement pendant ces quelques secondes voit une erreur de signature
  et garde le catalogue précédent ; l'actualisation suivante réussit.
- Une application est considérée « ouverte » seulement si ce launcher l'a lancée pendant la session en cours. Si vous
  fermez le launcher pendant qu'une application tourne, une mise à jour en attente est activée au redémarrage
  suivant  ; l'ancien dossier est supprimé au démarrage suivant.
- La reprise d'un téléchargement demande un serveur qui accepte l'en-tête `Range` ; sinon il recommence au début.
- Une clé publique par launcher : changer de clé demande de distribuer un nouveau launcher.
- Signature Authenticode : prête dans la CI mais inactive tant qu'aucun certificat n'est fourni (voir
  « Signature Authenticode »). Sans elle, Windows SmartScreen affiche un avertissement.
