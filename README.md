# Rayan's Apps

Applications créées avec l'IA (Claude Code). Une application par dossier, un workflow GitHub Actions par
application dans `.github/workflows/`.

| Application | Dossier | Workflow | Ce qu'elle fait |
| --- | --- | --- | --- |
| Rayan's Échecs (Analyse Échecs) | [`echecs-analyse/`](echecs-analyse/) | `echecs-analyse.yml` | Analyse des parties Chess.com avec Stockfish intégré (macOS, Windows, Linux) |
| Rayan's Launcher | [`launcher/`](launcher/) | `launcher.yml` | Launcher Windows (Tauri) pour installer, mettre à jour et lancer les applications |
| Rayan's Ouvertures | [`echecs-ouvertures/`](echecs-ouvertures/) | `echecs-ouvertures.yml` | Entraînement aux ouvertures à partir de vos parties Chess.com, avec Stockfish et répétition espacée |
| Rayan's Révision | [`revision/`](revision/) | `revision.yml` | Cartes de révision et quiz avec programme FSRS, statistiques, import/export CSV et JSON |
| Rayan's Hifz | [`coran-memorisation/`](coran-memorisation/) | `coran-memorisation.yml` | Suivi de mémorisation du Coran : progression par verset, révisions espacées, audio |
| Rayan's Chrono | [`chrono/`](chrono/) | `chrono.yml` | Minuteur Pomodoro et suivi du temps par projet, résumés, export CSV |
| Rayan's Rangement | [`rangement/`](rangement/) | `rangement.yml` | Rangement des Téléchargements et du Bureau par règles, avec aperçu, quarantaine des doublons et annulation |
| Rayan's Prière | [`priere/`](priere/) | `priere.yml` | Horaires de prière calculés hors ligne, calendrier du mois, notifications avant chaque prière |
| Rayan's Outils | [`outils/`](outils/) | `outils.yml` | Barre de commande (Ctrl+Alt+Espace) : PDF, image allégée, échange avec le téléphone, Wi-Fi, sortie audio, texte de l'écran, minuterie d'arrêt |

Chaque push sur `main` qui touche une application la publie dans le catalogue de Rayan's Launcher (voir « Publication automatique depuis GitHub » dans [`launcher/README.md`](launcher/README.md)). Les paquets restent aussi téléchargeables dans l'onglet **Actions**, section **Artifacts**.

## Ajouter une nouvelle application

1. Créer un dossier `<nom-de-l-app>/` à la racine.
2. Ajouter `.github/workflows/<nom-de-l-app>.yml` avec un filtre `on.push.paths: ['<nom-de-l-app>/**']`, pour
   que seule cette application soit reconstruite quand elle change.
3. Brancher le job « publier » (section « Brancher une nouvelle application » de `launcher/README.md`).

Ces applications viennent de la branche `claude/determined-tesla-akfm85` de
`Jojoskeys/motion-design-claude-code` (historique conservé). Les numéros de version construits par la CI
partent de +100 pour rester supérieurs à ceux construits là-bas.
