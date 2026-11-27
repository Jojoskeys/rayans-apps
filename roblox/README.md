# Rayan's Arène (Roblox)

Un petit jeu Roblox pour comprendre le trading en **argent fictif**, d'après [Rayan's Arène](../arene/) :
des robots appliquent chacun une règle simple sur de **vrais prix hebdomadaires** (SPY par défaut), frais
compris (0,1 % + 0,05 % de glissement par ordre). La moitié la moins bonne explose, les survivants font des
enfants mutés, puis la championne passe **l'examen** sur l'année suivante, jamais vue, contre le robot doré
« Acheter et garder ». Souvent, c'est le robot doré qui gagne : c'est la leçon.

Aucun achat Robux, aucune donnée gardée sur les joueurs, pas de chat ajouté, textes en français.

## Ouvrir le jeu (Windows)

1. Double-clique sur **`RayansArene.rbxlx`** (déjà prêt dans ce dossier, avec 10 ans de prix réels de SPY) :
   Roblox Studio l'ouvre.
2. Clique sur **Play** (ou F5). Choisis la règle de ton robot avec un des 4 gros boutons.

Pour des prix à jour ou un autre actif, refaire le fichier : dans `roblox\`, `python construire.py`
(prix pris dans `arene\donnees\SPY.csv` ou téléchargés : `pip install numpy yfinance` ; `--demo` sans réseau ;
`--actif QQQ` pour un autre actif). Le module `Prix.luau` est généré (ignoré par git).

## Le jeu

- **Piste à couloirs** et **grand écran** qui trace le prix de la période jouée (ligne grise = prix de départ).
- **30 robots** : corps rond coloré selon la famille (bleu croisement, orange rebond, violet momentum, vert
  tendance, comme la tuile animée de Rayan's Mobile), deux yeux, antenne, nom et gain au-dessus. Plus loin sur
  la piste = plus de gain ; derrière la ligne verte = perte.
- **Ton robot** porte ton nom : tu choisis sa famille, ses réglages sont tirés au hasard (la règle exacte
  s'affiche). S'il explose, tu en choisis un autre pour la génération suivante.
- **Une génération** = 3 ans de semaines qui défilent en 12 secondes ; classement au gain net de frais ;
  couronne sur le meilleur.
- Après 5 générations : **l'examen** sur l'année suivante, puis un message honnête et une nouvelle partie.
- Classement des joueurs : colonne **Gain %**.

Réglages (nombre de robots, générations, durées, graine) : `src/ReplicatedStorage/Arene/Config.luau`.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `construire.py` | prix → module `Prix` + fichier place `RayansArene.rbxlx` (Python standard ; numpy seulement via l'Arène) |
| `src/ReplicatedStorage/Arene/Regles.luau` | logique pure : règles, frais, mutation, sélection, textes (port de `arene/arene.py` en semaines) |
| `src/ReplicatedStorage/Arene/Config.luau` | réglages |
| `src/ServerScriptService/Jeu.server.luau` | le serveur décide de tout : générations, explosions, examen, leaderstats |
| `src/ServerScriptService/Decor.luau` | décor créé au démarrage : piste, écran, robots, couronne, explosions sans dégâts |
| `src/StarterPlayer/StarterPlayerScripts/Interface.client.luau` | bandeau d'état, 4 boutons, messages |
| `default.project.json` | même arbre pour [Rojo](https://rojo.space) : `rojo serve` ou `rojo build -o RayansArene.rbxlx` (après `construire.py`) |
| `src/ReplicatedStorage/Arene/Recompenses.luau` | logique pure des récompenses quotidiennes (7 jours, série, un jour manqué = retour au jour 1) |
| `src/ServerScriptService/Cadeaux.server.luau` | serveur des récompenses : DataStore, vérifie tout lui-même, le client ne fait que demander |
| `src/StarterPlayer/StarterPlayerScripts/EcranCadeaux.client.luau` | petit écran des 7 cases, jours 2 et 7 en or animé |
| `CONCEPTION.md` | fiche de conception à remplir avant chaque jeu (rêve du joueur, boucle en 3 verbes, promesse, 10 premières secondes, miniatures, règle 16+), remplie pour l'Arène |
| `modeles/PROMPT-3D.md` | gabarits de prompt 3D et de document de passation, règle « s'inspirer sans copier » |
| `tests/` | tests Python (`python -m unittest discover -s tests`) et Luau |

## Récompenses quotidiennes

Quand le joueur a choisi son premier robot (fin du mini-tutoriel), un petit écran propose la récompense du
jour, sur une série de 7 jours. **Pas d'argent du jeu** : des aspects, une boîte mystère et deux robots rares.
Le **jour 2** (pour faire revenir le lendemain) et le **jour 7** sont les grosses récompenses, mises en valeur
sur l'écran (bord or qui pulse). Un jour manqué : la série repart du jour 1.

Tout est décidé côté serveur (`Cadeaux.server.luau`) : le dernier jour récupéré, la série et les objets
obtenus sont gardés dans un DataStore (`RecompensesQuotidiennes`, rien d'autre sur le joueur) et la
vérification se fait sur la valeur enregistrée, donc le client ne peut pas tricher ni récupérer deux fois.
Dans Studio, il faut activer **Game Settings → Security → Enable Studio Access to API Services** pour que les
données soient vraiment gardées (sinon la lecture échoue et aucune récompense n'est proposée). Les objets
obtenus sont pour l'instant seulement gardés et affichés : les appliquer sur les robots reste à faire.

## Tests

```
python -m unittest discover -s tests
```

Vérifie le XML (racine `roblox version="4"`, referents uniques, chaque script présent avec sa source,
module `Prix`). Si le CLI [`luau`](https://github.com/luau-lang/luau) est dans le PATH (ou dans la variable
`LUAU`), lance aussi les tests Luau de la logique (`luau tests/regles.test.luau`), compare le port Luau à
`arene.py` (mêmes rendements, frais compris) et joue une partie entière avec un faux Roblox minimal
(`tests/simulation.luau`). `tests/recompenses.test.luau` vérifie la série des récompenses. Ce qui ne se vérifie qu'en jouant dans Studio : l'affichage (écran, étiquettes,
boutons), les mouvements et les explosions.

## Robots 3D (optionnel)

Des modèles 3D des robots (4 familles, robot doré, couronne, piste) faits avec Blender sont dans
[`../blender/arene/`](../blender/arene/README.md). Ils ne sont pas dans le `.rbxlx` (un MeshPart demande un
asset téléversé sur Roblox) : importe-les à la main (Accueil → **Importer en 3D**, voir ce README), puis
remplace plus tard les Parts créées par `Decor.robot`.

## Relier Claude à Roblox Studio

La solution officielle actuelle : le **serveur MCP intégré à Roblox Studio** (plus rien à installer à part
Studio à jour). L'ancien dépôt open source [Roblox/studio-rust-mcp-server](https://github.com/Roblox/studio-rust-mcp-server)
n'est plus développé (archivé le 3 avril 2026) : Roblox renvoie vers le serveur intégré.

1. Mets Roblox Studio à jour et ouvre une place (par exemple `RayansArene.rbxlx`).
2. Ouvre **Assistant** → **…** → **Manage MCP Servers** → active **Enable Studio as MCP server**.
3. Relier le client, le plus simple : dans **Assistant Settings** → **MCP Servers** → **Quick connect**, active
   **Claude Desktop** et/ou **Claude Code**, puis redémarre Claude.
4. À la main si besoin :
   - **Claude Desktop** : Paramètres → Développeur → Modifier la config (`claude_desktop_config.json`), ajoute :
     ```json
     {
       "mcpServers": {
         "Roblox_Studio": {
           "command": "cmd.exe",
           "args": ["/c", "%LOCALAPPDATA%\\Roblox\\mcp.bat"]
         }
       }
     }
     ```
     puis redémarre Claude Desktop.
   - **Claude Code** (dans `cmd`, pas PowerShell, pour que `%LOCALAPPDATA%` soit remplacé) :
     ```
     claude mcp add --transport stdio Roblox_Studio -- cmd.exe /c %LOCALAPPDATA%\Roblox\mcp.bat
     ```
     puis `claude mcp list` pour vérifier (Studio doit être ouvert).
5. Pour ce dépôt, l'entrée `Roblox_Studio` est déjà dans le [`.mcp.json`](../.mcp.json) du dépôt (même commande
   que ci-dessus) : Claude Code te demandera d'approuver ce serveur la première fois. Rien n'est actif tant que
   tu n'as pas coché **Enable Studio as MCP server** dans Studio et que Studio n'est pas ouvert.
6. **Avant de laisser Claude modifier une place : sauvegarde-la** (Fichier → Enregistrer sous, ou copie
   `RayansArene.rbxlx`). Le dépôt garde le code source dans `src/`, mais une modification faite dans Studio
   par Claude n'y revient pas toute seule.
7. Claude peut alors lire et modifier les scripts, explorer l'arbre, lancer du Luau, démarrer/arrêter Play,
   lire la console et faire des captures de la vue. Roblox prévient : un client MCP peut lire et modifier
   les places ouvertes ; ne relie que des clients de confiance.

### Ce que tu as déjà pour un jeu

- **Blender (serveur MCP Blender)** : modèles 3D (robots, décor), voir `modeles/PROMPT-3D.md` et `../blender/arene/`.
- **Générateur de sons de Studio / ElevenLabs** : sons et musique (Claude n'entend pas : c'est toi qui écoutes
  et valides). N'utilise les crédits ElevenLabs qu'à ta demande.
- **Roblox Studio + MCP officiel** : Claude code, construit et teste dans le jeu.
- Aucun autre programme à installer : l'application « Vibe Starter » de la vidéo et le zip Discord ne sont pas
  nécessaires et ne sont pas vérifiables.

### Méthode officielle « coding harness »

Roblox décrit aussi (create.roblox.com/docs/ai/coding-harness) un montage officiel : un éditeur avec agent de code
(VS Code ou Cursor), **Script Sync** (bêta de Studio, les fichiers `.luau` du disque apparaissent dans Studio) et le
serveur MCP. Le projet d'ici fait déjà le même travail avec `construire.py` et, si besoin, Rojo ; Script Sync
éviterait de regénérer le `.rbxlx` à chaque changement de code. Rien à installer pour l'essayer.

Sources (novembre 2026) :
[documentation Roblox « Connect to the Roblox Studio MCP server »](https://create.roblox.com/docs/studio/mcp),
[DevForum : Studio MCP Server Updates and External LLM Support for Assistant](https://devforum.roblox.com/t/studio-mcp-server-updates-and-external-llm-support-for-assistant/4415631),
[dépôt archivé studio-rust-mcp-server](https://github.com/Roblox/studio-rust-mcp-server),
format XML : [Roblox XML Model Format, Version 4 (rbx-dom)](https://dom.rojo.space/xml.html).

Ce n'est pas un conseil d'investissement : argent fictif, une règle qui a marché sur le passé peut perdre
sur l'avenir.
