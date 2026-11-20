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
| Rayan's Chrono | [`chrono/`](chrono/) | `chrono.yml` | Minuteur Pomodoro et suivi du temps par projet, résumés, export CSV ; écran de pause plein écran, barre du temps de travail du jour, distractions bloquées pendant le travail |
| Rayan's Rangement | [`rangement/`](rangement/) | `rangement.yml` | Rangement des Téléchargements et du Bureau par règles, avec aperçu, quarantaine des doublons et annulation |
| Rayan's Prière | [`priere/`](priere/) | `priere.yml` | Horaires de prière calculés hors ligne, calendrier du mois, notifications avant chaque prière |
| Rayan's Outils | [`outils/`](outils/) | `outils.yml` | Barre de commande (Ctrl+Alt+Espace) : PDF, image allégée, échange avec le téléphone, Wi-Fi, sortie audio, texte de l'écran, minuterie d'arrêt, place sur le disque, coller en texte brut, renommer d'après le contenu ; échéances et abonnements, à lire plus tard, entretien, fichiers récents, textes à coller |
| Rayan's Bosse | [`bosse/`](bosse/) | `bosse.yml` | Un espace de travail par projet (programmes, dossiers, fichiers, sites) ouvert en un clic, avec Rayan's Chrono et PowerToys Workspaces |
| Rayan's Aujourd'hui | [`aujourdhui/`](aujourdhui/) | `aujourdhui.yml` | Ce qu'il reste à réviser aujourd'hui dans Révision, Hifz et Ouvertures, rappel le soir |
| Rayan's Sauve | [`sauve/`](sauve/) | `sauve.yml` | Sauvegarde robocopy des données des apps et des Documents vers un disque externe ou OneDrive, rappel au bout de 7 jours |
| Rayan's Garmin | [`garmin/`](garmin/) | — (compilé sur le PC, copié par USB) | Forerunner 165 : cadran avec la prochaine prière, champ de course « objectif 5 km », compteur de tractions et de pompes |
| Rayan's Télécommande | [`telecommande/`](telecommande/) | `telecommande.yml` | Piloter le PC depuis l'iPhone à travers Tailscale (état, verrouillage, redémarrage, applis, fichiers dans les deux sens, presse-papiers, Wi-Fi, scénarios) ; tuiles « Télécommande » et « Papiers » (photos de documents, texte lu par l'OCR de Windows) dans Rayan's Mobile |
| Rayan's Journal | [`journal/`](journal/) | `journal.yml` | Journal d'activité horodaté (applis, fenêtres, fichiers, session) et archive chiffrée des conversations WhatsApp, Telegram, Discord, Instagram, Messenger |
| Rayan's Studio | [`studio/`](studio/) | — (outil local, Python + Remotion) | Vidéos verticales pour TikTok, YouTube Shorts et Reels (Ayati, La Psycho Facile) : versets vérifiés et récitation synchronisée, voix ElevenLabs, animations, sous-titres mot par mot |
| Rayan's Recettes | [`recettes/`](recettes/) | `recettes.yml` | Les recettes trouvées par Rayan's Favoris : remarques halal et sèche, filtres (protéines, rapide, collation, repas), recherche, favoris, « je l'ai faite », liste de courses copiable, ajout à la main |
| Rayan's Favoris | [`favoris/`](favoris/) | — (outil local, Python + Claude Code `/favoris`) | Vidéos enregistrées sur Instagram et TikTok (export officiel, lien, vidéo, tuile « Favoris » de l'iPhone) : transcription, tri par catégorie, double vérification de sécurité, avis et prompt ; rien n'est appliqué sans validation |
| Rayan's Bonnes Affaires | [`bonnes-affaires/`](bonnes-affaires/) | — (outil local, Node) | Classe les annonces d'occasion vendues bien sous leur prix habituel (vêtements de marque, électronique) : eBay par son API officielle, Vinted, Leboncoin, Facebook et autres par import de fichier ; prix, écart, revente, avis sûr / à vérifier / méfiance, mise en avant des meilleurs choix et zone de retrait autour de chez soi ; tuile « Bonnes affaires » dans Rayan's Mobile via la Télécommande, notification de chaque pépite, recherche toutes les 30 min |

Chaque push sur `main` qui touche une application la publie dans le catalogue de Rayan's Launcher (voir « Publication automatique depuis GitHub » dans [`launcher/README.md`](launcher/README.md)). Les paquets restent aussi téléchargeables dans l'onglet **Actions**, section **Artifacts**.

## Ajouter une nouvelle application

0. Faire valider une maquette Claude Design avant de coder.
1. Créer un dossier `<nom-de-l-app>/` à la racine.
2. Ajouter `.github/workflows/<nom-de-l-app>.yml` avec un filtre `on.push.paths: ['<nom-de-l-app>/**']`, pour
   que seule cette application soit reconstruite quand elle change.
3. Brancher le job « publier » (section « Brancher une nouvelle application » de `launcher/README.md`).

Ces applications viennent de la branche `claude/determined-tesla-akfm85` de
`Jojoskeys/motion-design-claude-code` (historique conservé). Les numéros de version construits par la CI
partent de +100 pour rester supérieurs à ceux construits là-bas.
