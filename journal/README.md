# Rayan's Journal

Journal d'activité horodaté du PC et archive chiffrée, consultable, de tes propres conversations (WhatsApp, Telegram,
Discord, Instagram, Messenger) à partir de leurs **exports officiels**. Tauri 2 + React + TypeScript ; l'archive,
le chiffrement et les imports sont en Rust (`core/`), les capteurs Windows dans `src-tauri/src/collecte/`.

**Rien n'est collecté à l'installation.** La collecte du journal démarre seulement quand tu l'actives dans
l'application, après un écran qui détaille ce qui sera enregistré. Le démarrage avec Windows est désactivé
par défaut.

## Ce qui est couvert

### Journal d'activité (Windows 11)

| Activité | Méthode | Heure réelle | Limites |
| --- | --- | --- | --- |
| Ouverture d'un programme | Relevé toutes les 2 s de **tous** les programmes de ta session, avec ou sans fenêtre (arrière-plan, zone de notification), regroupés par exécutable | **Exacte** : heure de création du premier processus | Un programme ouvert puis fermé entre deux relevés n'est pas vu. Les services Windows (session 0) et les autres comptes ne sont pas suivis. Au lancement de l'app, les programmes lancés pendant l'arrêt du suivi sont rattrapés avec leur heure exacte |
| Fermeture | Même relevé : disparition du dernier processus du programme | **±2 s** (réglable), avec la durée d'ouverture | — |
| Composants Windows | Programmes du dossier Windows sans fenêtre (RuntimeBroker, conhost…) | Comme ci-dessus | Enregistrés, mais masqués par défaut dans le journal (case à cocher) |
| Fenêtre au premier plan | Notification de Windows (`SetWinEventHook`) | Exacte, à la milliseconde | Titre filtré (voir « Secrets ») |
| Changement de titre (onglet, document) | Relevé du titre de la fenêtre active toutes les 2 s | ±2 s | — |
| Fichiers : création, modification, renommage, déplacement, suppression | `ReadDirectoryChangesW` sur les dossiers choisis | À la détection (< 1 s) | Corbeille et suppression définitive ne sont pas distinguées. Un débordement de notifications est signalé comme **suivi partiel** |
| Fichiers changés pendant que l'app était fermée | Comparaison avec l'état chiffré enregistré | Création ou modification : heure du fichier. Suppression : **inconnue**, intervalle indiqué | Au-delà de 300 000 fichiers, rattrapage partiel |
| Verrouillage / déverrouillage | Notification de session | Exacte | Seulement quand l'app tourne |
| Démarrage, arrêt, arrêt inattendu, veille, réveil | Journal « Système » de Windows (`wevtutil`) | **Exacte**, même si l'app ne tournait pas | Repris seulement après l'activation de la collecte, hors pauses |

Chaque événement porte **l'heure de l'événement** (avec sa précision, son fuseau IANA et le décalage UTC à cet
instant) **et l'heure de sa détection**. Quand l'app est relancée, une ligne « suivi partiel » indique la période
sans suivi.

**Pause** : `Ctrl+Alt+J` (réglable), menu de l'icône près de l'horloge (pause, pause d'une heure) ou barre de
gauche. Pendant une pause rien n'est inscrit, y compris au rattrapage du journal Windows. La pause et la reprise
sont elles-mêmes notées.

### Mes journées, fichiers, absence, Chrono

- **Mes journées** : temps d'écran du jour ou de la semaine (temps où une fenêtre est au premier plan **et** où le
  PC est utilisé ; verrouillage, veille, pause et inactivité exclus), par heure, par jour, par programme ou par
  fenêtre, périodes d'utilisation, première et dernière activité. L'inactivité est notée après 5 min sans
  clavier ni souris (réglable) : seule l'heure de la dernière action est lue (`GetLastInputInfo`), jamais les
  touches. Après un arrêt brutal, au plus 5 min sont comptées avant le trou.
- **Que faisais-je à…** : la fenêtre au premier plan à une heure donnée, et ce qui s'est passé un quart d'heure
  avant et après.
- **Retrouver un fichier** : chaque fichier avec son parcours (téléchargé, renommé, déplacé, supprimé), retrouvé
  par n'importe lequel des noms qu'il a portés.
- **Activité pendant ton absence** : heures calmes réglables, et mode « Je m'absente » (barre de gauche ou icône
  près de l'horloge). Toute utilisation (déverrouillage, fenêtre, clavier ou souris) est notée et notifiée, au plus
  une fois par demi-heure, avec un résumé au retour.
- **Projets et Rayan's Chrono** : temps par projet d'après des mots-clés dans les titres de fenêtres, comparé au
  temps chronométré dans Chrono. `chrono.json` est **lu sans jamais être modifié** ; « Démarrer dans Chrono »
  lance Chrono avec `--projet=<nom>`. Les projets de Chrono peuvent être repris dans les réglages.

### Sécurité des programmes

Chaque programme vu par le suivi est vérifié **sur le PC, sans rien envoyer en ligne** (page « Sécurité ») :

| Indice | Source | Effet |
| --- | --- | --- |
| Signature de l'éditeur | `Get-AuthenticodeSignature` (fichier signé ou catalogue de Windows) | Valide : éditeur affiché. Absente : à vérifier. **Altérée** (fichier modifié après signature) : suspect. Applis du Store : paquet signé |
| Imitation de Windows | Nom d'un programme système (`svchost.exe`…) hors du dossier Windows, ou à une lettre près (`scvhost.exe`) | Suspect |
| Emplacement | Dossier temporaire, Téléchargements, Bureau, Public | À vérifier s'il n'est pas signé |
| Origine Internet | Marque `Zone.Identifier` posée par Windows et les navigateurs (site d'origine) | À vérifier s'il n'est pas signé |
| Démarrage automatique | Registre Run/RunOnce, dossier Démarrage, tâches planifiées (hors Microsoft), relus toutes les 5 min | Ajout ou retrait noté dans le journal ; à vérifier s'il n'est pas signé |
| Microsoft Defender | Journal de Defender (détections des 90 derniers jours) ; bouton « Analyser avec Microsoft Defender » (`MpCmdRun`) | Fichier détecté : suspect ; nouvelles détections notées et notifiées |

Une critique, ou deux avertissements, donnent **suspect** (notification) ; un avertissement, **à vérifier** ; une
signature valide sans avertissement, **fiable**. Le résultat est gardé et refait si le fichier change, ou au bout
de 7 jours. Le premier inventaire résume tout en une seule ligne du journal. Ce n'est pas un antivirus : il ne
remplace pas Defender. Essai réel sur ce PC : 66 programmes fiables, 3 à vérifier (outils non signés de Git et
de Rust), aucun faux suspect (`cargo test -p rayans-journal essai_sur_ce_pc -- --ignored --nocapture`).

### Secrets

- Le clavier, l'écran et le contenu des fenêtres ne sont **jamais** lus.
- Titre de fenêtre jamais gardé pour les gestionnaires de mots de passe, l'invite d'identifiants Windows, la
  navigation privée et les titres contenant un mot sensible (« mot de passe », « code de vérification », « OTP »…).
  Les codes de 6 à 8 chiffres et les longs jetons sont remplacés par `••••••` / `[jeton masqué]`.
- Noms de fichiers sensibles masqués : `.kdbx`, `.pem`, `.key`, `id_rsa*`, `.env`, `*secret*`… (un dossier
  sensible masque tout ce qu'il contient). Option « nom du programme seulement » pour tous les titres.
- Toutes ces listes sont modifiables dans Réglages.

### Archive des conversations

| Application | Export officiel à importer | Données gardées | Horodatage d'envoi | Modifiés / supprimés |
| --- | --- | --- | --- | --- |
| WhatsApp | Discussion → Exporter (`.zip` iPhone ou `.txt` Android) | Auteur, texte, pièces jointes si incluses | Seconde (iPhone) ou minute (Android), heure locale du téléphone, **fuseau déduit** | Dernière version seulement (« <Ce message a été modifié> » retiré du texte et noté). « Supprimé pour tous » laisse une mention → **suppression signalée** ; « pour moi » : absence |
| Telegram | Telegram Desktop → Exporter les données, JSON | Tout, avec identifiants stables | Seconde, UTC + décalage exact de l'export | Dernière version **avec heure de modification** ; suppression = absence |
| Discord | Demander toutes mes données → `package.zip` | **Tes messages seulement** ; pièces jointes = liens (non téléchargés) | Seconde ou milliseconde, UTC | Suppression = absence |
| Instagram / Messenger | Télécharger vos informations, **JSON** | Auteur, texte, médias, réactions, liens | Milliseconde, UTC | Messages retirés absents (ou mention) ; discussions Messenger chiffrées de bout en bout non incluses |

- **Mot pour mot** : texte stocké sans retouche (emojis composés, espaces, sauts de ligne, ponctuation). Le
  fichier texte de l'export est aussi gardé tel quel, chiffré, avec son empreinte. Le JSON de Meta, mal encodé
  (« Ã© »), est réparé seulement quand la réparation est certaine.
- **Envoi ≠ archivage** : chaque message garde son heure d'envoi d'origine et l'heure à laquelle il a été
  archivé ; chaque version garde son heure d'archivage (et de modification si l'export la donne).
- **Rien n'est perdu à un nouvel import** : un texte différent ajoute une version ; une mention de suppression
  ou une absence (dans la période couverte par le nouvel export) change l'état du message, et le texte archivé
  avant reste lisible. Un message déjà supprimé lors du premier archivage est marqué « texte d'origine non
  disponible » : rien n'est inventé.
- **Limite** : aucune de ces applications n'offre d'export en continu ; pour garder un message avant sa
  suppression, il faut qu'il ait été dans un export importé avant. Réexporte régulièrement.

## Stockage

- `%LOCALAPPDATA%\Rayan's Journal\` : `archive.sqlite`, `sources\`, `pieces\`, `etat-fichiers.rjf`,
  `reglages.json`, `cle.dpapi`.
- Chaque contenu (textes, auteurs, titres, chemins, noms de conversations, fichiers) est chiffré en
  XChaCha20-Poly1305 ; la recherche par mot passe par des empreintes HMAC de préfixes de mots (sans accents ni
  majuscules). En clair : seulement les instants, le type d'événement et le nom du service.
- La clé est protégée par DPAPI : seul ton compte Windows, sur ce PC, peut ouvrir l'archive. Pour une copie
  lisible ailleurs : **Exporter** (JSON Lines + HTML, non chiffré).
- Conservation réglable : journal 90 jours par défaut, conversations sans limite ; appliquée au démarrage puis
  toutes les 6 h, avec écrasement des données effacées (`secure_delete`).

## Développement

```bash
npm install
npm run dev          # application complète (Tauri)
npm run dev:ui       # interface seule dans un navigateur, avec des données fictives (src/mock.ts)
cargo test --workspace
```

Les tests de `core/tests/donnees_fictives.rs` importent les exports fictifs de `exemples/` (WhatsApp en deux
exports successifs, Telegram, Instagram, Discord) et vérifient : texte mot pour mot, horodatages d'envoi et
d'archivage, recherche (mot, date, service, conversation), versions d'un message modifié, conservation d'un
message archivé avant sa suppression, absence de texte en clair sur le disque, masquage des secrets,
conservation et export. Ces mêmes dossiers peuvent être importés dans l'application pour essayer.
