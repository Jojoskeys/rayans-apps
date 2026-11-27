# Modèles 3D pour Roblox : gabarits de prompt

Pour un générateur d'objets 3D (par exemple l'outil « objet 3D » de Claude Design, export GLB). Un modèle
ne se demande pas en une phrase : on donne une image de référence, un prompt précis, puis des corrections
ciblées, une à la fois.

**Règle de droits : on s'inspire, on ne copie jamais.** Pas de personnage, de créature ou d'objet trop proche
d'une marque ou d'une licence (Pokémon, Nintendo, Disney, Roblox lui-même...). Si on reconnaît le personnage
au premier coup d'oeil, c'est trop proche : changer la silhouette, les couleurs et les détails.

## 1. Gabarit de prompt

```
Objet 3D pour un jeu Roblox, style low-poly lisse, lisible de loin.

Forme : [silhouette générale, proportions, ex. corps rond, deux petits yeux, une antenne]
Matière : [plastique mat, métal brossé, néon...]
Couleurs principales : [2 ou 3 couleurs maximum, avec leurs codes si possible]
Détails : [3 détails au plus, ex. un hublot, des vis, un sourire]
Pose : [debout, neutre, bras le long du corps ; symétrique]
Taille : [hauteur approximative en studs ; rapport avec un joueur (environ 5 studs)]
Style : low-poly pour Roblox, peu de triangles, pas de détails minuscules, pas de texture floue.

À ne pas copier : [personnage ou marque dont on s'inspire, et ce qu'on change]
Image de référence : [jointe ; faite avec un générateur d'images ou trouvée en ligne, droits vérifiés]
```

Corrections ensuite, une seule par message : « rends les yeux plus grands », « remplace le jaune par
un orange plus foncé », « enlève l'antenne ».

## 2. Gabarit de document de passation

À remplir à la fin de chaque séance, puis à coller au début d'une nouvelle conversation pour reprendre sans
tout réexpliquer.

```
Projet : [nom du jeu / de l'objet]
Où on en est : [ce qui est fini, ce qui reste]
Modèle / version utilisés : [outil, nom du modèle, date]
Prompt actuel : [le dernier prompt complet qui a donné le meilleur résultat]
Ce qui plaît : [...]
Ce qui ne plaît pas : [...]
Fichiers : [noms des GLB / FBX, dossier]
Triangles : [nombre actuel, limite visée]
Prochaine étape : [une seule action]
```

## 3. Quand un GLB est fourni (méthode pour Claude)

1. Ouvrir le GLB dans Blender (serveur MCP Blender), compter les triangles.
2. Si c'est lourd : alléger (Decimate) jusqu'à rester sous la limite Roblox des maillages (à revérifier dans
   la documentation officielle de Roblox avant l'import), et vérifier que la forme reste lisible.
3. Contrôler l'échelle et le point d'origine (au sol, centré), appliquer les transformations.
4. Exporter en FBX ou GLB pour Roblox Studio (Accueil, **Importer en 3D**). Voir aussi
   [`../../blender/arene/README.md`](../../blender/arene/README.md).
5. Toujours garder l'original, travailler sur une copie.
