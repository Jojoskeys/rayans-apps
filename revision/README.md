# Rayan's Révision

Application de bureau Windows pour réviser avec des cartes : **question/réponse**, **QCM** et **textes à trous**,
planifiées par répétition espacée (**FSRS**). Séance du jour, statistiques (série, cartes dues, rétention,
prévisions), import/export **CSV** et **JSON**. Toutes les données restent sur le PC.

Reprend le projet [quiz-revision](https://github.com/Jojoskeys/quiz-revision) : son format `question;réponse`
(questions.txt) s'importe tel quel, ses trois questions forment le paquet d'exemple, et la correction ignore les
majuscules (et aussi les accents, les espaces en trop et une faute de frappe sur les mots de 5 lettres ou plus).

## Pourquoi Tauri 2 + React + TypeScript

Même pile que `launcher/` : un seul `.exe` d'environ 10 Mo (contre plus de 100 Mo pour Electron), qui
utilise WebView2, déjà présent sur Windows 10/11. Toute la logique est en TypeScript pur (`src/core/`),
testée sans fenêtre ; la partie Rust (`src-tauri/src/lib.rs`) se limite à lire et écrire des fichiers.

## Fonctionnement

| Élément | Où | Détail |
| --- | --- | --- |
| Planificateur | `src/core/fsrs.ts` | FSRS-4.5, paramètres par défaut publiés, rétention visée réglable (90 % par défaut). Étapes d'apprentissage 1 min et 10 min, réapprentissage 10 min après un oubli. Journée de révision qui commence à 4 h. |
| Séance du jour | `src/core/session.ts` | Apprentissage en retard → révisions dues → nouvelles cartes (limite par paquet, 20/jour par défaut) → apprentissage dû dans les 20 min. Maximum de révisions par jour, annulation de la dernière réponse. |
| Correction | `src/core/answer.ts` | Réponse tapée ou carte retournée, au choix **par paquet** ; QCM toujours corrigés. Variantes séparées par « \| ». Trous : `{{réponse}}`, `{{réponse::indice}}` ou `{{c1::réponse}}` (Anki). |
| Statistiques | `src/core/stats.ts` | Série (en cours et record), rétention réelle 7 et 30 jours, réponses par jour, prévisions 7 jours, répartition des cartes, probabilité moyenne de s'en souvenir. |
| Import/export | `src/core/io.ts` | CSV (séparateur détecté, BOM, guillemets) et JSON (sauvegarde complète, paquets, ou liste d'objets). |
| Données | `%APPDATA%\fr.rayan.revision\` | `revision.json` (écriture atomique), `revision.bak.json`, `sauvegardes\revision-AAAA-MM-JJ.json` (14 jours). |

Format CSV complet (une carte par ligne) :

```
type;question;reponse;choix;explication;paquet
qr;Quel mot-clé Java crée un objet ?;new;;;Java
qcm;2 + 2 ?;4;3 | 4 | 5;;Maths
trous;La {{Loire}} est le plus long fleuve de {{France::pays}}.;;;;Géographie
```

## Développement

```bash
npm ci
npm test            # vérification des types + tests unitaires (vitest)
npm run dev         # application Tauri avec rechargement à chaud
npm run dev:ui      # interface seule dans le navigateur (données dans localStorage)
npx tauri build --no-bundle   # src-tauri/target/release/Rayans Revision.exe
node scripts/smoke.mjs "src-tauri/target/release/Rayans Revision.exe"   # test de lancement
```

`REVISION_DATA_DIR` remplace le dossier de données (tests) ; `REVISION_SMOKE_FILE` active le test de lancement
(l'interface écrit un résumé dans ce fichier une fois l'accueil affiché, puis l'application se ferme).

Compilation locale avec la chaîne Rust GNU (sans Visual Studio) : il faut `dlltool` et `as` de GNU binutils
(par ex. le paquet MSYS2 `mingw-w64-x86_64-binutils`) en tête du PATH, plus le dossier `self-contained` de la
chaîne. La CI utilise la chaîne MSVC de GitHub.

## CI

`.github/workflows/revision.yml` (Windows) : `npm test`, `cargo test`, construction de l'exe avec la version
`majeur.mineur.<numéro d'exécution + 100>`, test de lancement, puis l'artifact **Rayans-Revision-pour-le-launcher**
(ZIP avec `Rayans Revision.exe`, `rayans-launcher.json` et `LISEZMOI.txt`) à déposer dans Rayan's Launcher.
