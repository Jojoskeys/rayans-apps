# Rayan's Apps

Applications créées avec l'IA (Claude Code). Une application par dossier, un workflow GitHub Actions par
application dans `.github/workflows/`.

| Application | Dossier | Workflow | Ce qu'elle fait |
| --- | --- | --- | --- |
| Rayan's Échecs (Analyse Échecs) | [`echecs-analyse/`](echecs-analyse/) | `echecs-analyse.yml` | Analyse des parties Chess.com avec Stockfish intégré (macOS, Windows, Linux) |
| Rayan's Launcher | [`launcher/`](launcher/) | `launcher.yml` | Launcher Windows (Tauri) pour installer, mettre à jour et lancer les applications |
| Rayan's Ouvertures | [`echecs-ouvertures/`](echecs-ouvertures/) | `echecs-ouvertures.yml` | Entraînement aux ouvertures à partir de vos parties Chess.com, avec Stockfish et répétition espacée ; sur l'iPhone (Rayan's Mobile), pseudo, import et analyse se font aussi dans le téléphone (Stockfish en version web) |
| Rayan's Révision | [`revision/`](revision/) | `revision.yml` | Cartes de révision et quiz avec programme FSRS, statistiques, import/export CSV et JSON |
| Rayan's Hifz | [`coran-memorisation/`](coran-memorisation/) | `coran-memorisation.yml` | Suivi de mémorisation du Coran : progression par verset, révisions espacées, audio |
| Rayan's Chrono | [`chrono/`](chrono/) | `chrono.yml` | Minuteur Pomodoro et suivi du temps par projet, résumés, export CSV ; écran de pause plein écran, barre du temps de travail du jour, distractions bloquées pendant le travail |
| Rayan's Rangement | [`rangement/`](rangement/) | `rangement.yml` | Rangement des Téléchargements et du Bureau par règles, avec aperçu, quarantaine des doublons et annulation |
| Rayan's Prière | [`priere/`](priere/) | `priere.yml` | Horaires de prière calculés hors ligne, calendrier du mois, notifications avant chaque prière |
| Rayan's Outils | [`outils/`](outils/) | `outils.yml` | Barre de commande (Ctrl+Alt+Espace) : PDF, image allégée, échange avec le téléphone, Wi-Fi, sortie audio, texte de l'écran, minuterie d'arrêt, place sur le disque, coller en texte brut, renommer d'après le contenu ; échéances et abonnements, à lire plus tard, entretien, fichiers récents, textes à coller |
| Rayan's Bosse | [`bosse/`](bosse/) | `bosse.yml` | Un espace de travail par projet (programmes, dossiers, fichiers, sites) ouvert en un clic, avec Rayan's Chrono et PowerToys Workspaces |
| Rayan's Aujourd'hui | [`aujourdhui/`](aujourdhui/) | `aujourdhui.yml` | Ce qu'il reste à réviser aujourd'hui dans Révision, Hifz et Ouvertures, rappel le soir |
| Rayan's Sauve | [`sauve/`](sauve/) | `sauve.yml` | Sauvegarde robocopy des données des apps et des Documents vers un disque externe ou OneDrive, rappel au bout de 7 jours |
| Rayan's Garmin | [`garmin/`](garmin/) | — (compilé sur le PC, copié par USB) | Forerunner 165 : cadran avec la prochaine prière, champ de course « objectif 5 km », compteur de tractions et de pompes, **Rayan's Montre** (eau, séance, humeur notées au poignet et envoyées au PC par la Télécommande, tuile « Montre » dans Rayan's Mobile) |
| Rayan's Télécommande | [`telecommande/`](telecommande/) | `telecommande.yml` | Piloter le PC depuis l'iPhone à travers Tailscale (état, verrouillage, redémarrage, applis, fichiers dans les deux sens, presse-papiers, Wi-Fi, scénarios) ; tuiles « Télécommande » et « Papiers » (photos de documents, texte lu par l'OCR de Windows) dans Rayan's Mobile |
| Rayan's Journal | [`journal/`](journal/) | `journal.yml` | Journal d'activité horodaté (applis, fenêtres, fichiers, session) et archive chiffrée des conversations WhatsApp, Telegram, Discord, Instagram, Messenger |
| Rayan's Studio | [`studio/`](studio/) | — (outil local, Python + Remotion) | Vidéos verticales pour TikTok, YouTube Shorts et Reels, et stories Instagram et Facebook (compte-a, Compte B) : versets vérifiés et récitation synchronisée, voix ElevenLabs, animations, sous-titres mot par mot |
| Rayan's Recettes | [`recettes/`](recettes/) | `recettes.yml` | Les recettes trouvées par Rayan's Favoris : remarques halal et sèche, filtres (protéines, rapide, collation, repas), recherche, favoris, « je l'ai faite », plan de repas de la semaine, listes de courses (recettes cochées, jour, semaine) avec magasins conseillés, ajout à la main |
| Rayan's Favoris | [`favoris/`](favoris/) | — (outil local, Python + Claude Code `/favoris`) | Vidéos enregistrées sur Instagram et TikTok (export officiel, lien, vidéo, tuile « Favoris » de l'iPhone) : transcription, tri par catégorie, double vérification de sécurité, avis et prompt ; rien n'est appliqué sans validation |
| Rayan's Bonnes Affaires | [`bonnes-affaires/`](bonnes-affaires/) | — (outil local, Node) | Classe les annonces d'occasion vendues bien sous leur prix habituel (vêtements de marque, électronique) : eBay par son API officielle, Vinted, Leboncoin, Facebook et autres par import de fichier ; prix, écart, revente, avis sûr / à vérifier / méfiance, mise en avant des meilleurs choix et zone de retrait autour de chez soi ; tuile « Bonnes affaires » dans Rayan's Mobile via la Télécommande, notification de chaque pépite, recherche toutes les 30 min ; bot Discord (Dealabs pour Amazon, Cdiscount, Fnac…, eBay et robot prudent Vinted) qui poste chaque nouvelle affaire toutes les 5 min, @everyone pour les dingueries |
| Rayan's Arène | [`arene/`](arene/) | — (outil local, Python) | Apprendre le trading en argent fictif : des mini-stratégies évoluent (les moins bonnes meurent), puis sont testées honnêtement sur des années jamais vues, frais compris, contre « acheter et garder » et le hasard ; plan mensuel (X € par mois sur un ETF monde, frais, pires baisses, Livret A) |
| Rayan's Arène 3D | [`blender/arene/`](blender/arene/) | — (script Blender) | Les robots de l'Arène en 3D (4 familles + le doré « acheter et garder »), la couronne et la piste, exportés en FBX et glTF pour Roblox Studio et la future version 3D |
| Rayan's Arène (Roblox) | [`roblox/`](roblox/) | — (Roblox Studio, place générée) | Petit jeu Roblox en argent fictif : 30 robots appliquent leur règle sur de vrais prix hebdomadaires (SPY), frais compris, la moitié la moins bonne explose, les survivants font des enfants mutés ; le joueur choisit la famille de son robot ; examen final sur l'année jamais vue contre le robot doré « Acheter et garder » ; `python construire.py` puis double-clic sur `RayansArene.rbxlx` |
| Rayan's Veilleur | [`veilleur/`](veilleur/) | `veilleur.yml` (tests ; le veilleur tourne dans le dépôt privé des données) | Clé Claude (facultative, payante) de la newsletter : `veilleur\actu.ps1`. Toutes les 20 min, même PC éteint : emploi du temps ADE, rappels, résumé du matin et du soir, heures de prière, vidéos en ligne, notifications web-push vers l'iPhone ; chaque matin vers 6 h 40, « Ton monde ce matin » : une revue en rubriques (L'essentiel, Informatique & IA, Cybersécurité, Géopolitique, En bref) tirée d'une vingtaine de flux (Next, Le Monde, Numerama, Ars Technica, The Verge, CERT-FR, BleepingComputer, BBC, Al Jazeera…), gratuite (titres, début du chapô, images, liens), ou rédigée par Claude avec une clé, dans la tuile « Ton monde » de Rayan's Mobile |

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
