---
name: carte-roblox
description: Fabriquer une carte Roblox simple dans Blender (terrain, ciel, quelques objets libres de droits) avec le serveur MCP de Blender, puis l'exporter en glb/fbx pour Roblox Studio. À utiliser quand Rayan tape /carte-roblox ou demande une carte, un décor ou un niveau pour son jeu Roblox.
---

# Carte Roblox

Skill écrit par nous (rien d'installé depuis internet). Sortie dans `blender/cartes/<nom>/`. Ne modifie pas `roblox/` sans accord de Rayan.

## Avant de commencer

1. Demander le thème en une question, avec une proposition par défaut (ex. « prairie avec sapins »).
2. Appeler `get_addon_status` : si Blender n'est pas joignable, le dire et s'arrêter. Si Poly Haven est « off », ne pas le réactiver : se contenter de formes simples faites par nous, et le dire à Rayan.
3. Travailler dans une **nouvelle scène** Blender (`bpy.data.scenes.new`) pour ne rien abîmer du travail ouvert ; la supprimer à la fin. Nommer les objets de façon unique (une caméra « Cam » existe peut-être déjà : utiliser `scene.camera`).

## Construire

- **Terrain** : un grand plan (environ 300 m), un matériau simple, éventuellement un relief léger.
- **Ciel** : nœud Sky Texture (soleil sans disque), vue en « Standard » (pas Filmic), force du fond vers 0,25 et soleil vers 2 : sinon l'image est blanche.
- **Objets** : modèles `polyhaven` (CC0) via `search_assets` puis `import_asset` quand c'est disponible ; sinon formes simples (cônes, sphères aplaties). Pas de personnages modélisés à la main. Les modèles de l'Arène (`blender/arene/sorties/*.glb`) sont à nous et réutilisables.
- **Budget Roblox** : viser moins de 50 000 triangles au total, une texture 1k à 2k maximum par matériau, 1 unité = 1 mètre.
- **Lumière** : une forte en haut à gauche, le reste faible (voir `blender/arene/README.md`, partie « Méthode »).

## Vérifier

Après chaque étape, une image avec `look` (camera, 800 px) avant de continuer ; corriger une seule chose à la fois. Montrer l'image à Rayan avant d'aller plus loin.

## Exporter et ranger

- `export_scene.gltf` avec `use_selection=True` et **seulement les objets de la scène de la carte** (sans sélection, tout le fichier ouvert est exporté : 270 Mo au lieu de 0,2 Mo).
- Garder dans le dépôt uniquement : `carte-<nom>.glb` (léger), `apercu.png` (800 px), `CREDITS.md`. Pas de `.blend`, pas de textures lourdes (le `.gitignore` les écarte).
- `CREDITS.md` : liste des objets Poly Haven utilisés (nom, lien, licence CC0) ou « tout est fait maison ».
- Dans Roblox Studio : Accueil, Importer en 3D, choisir le `.glb`.

## Règles

Dépôt public : rien de personnel, aucun nom de chaîne ou de compte. Ne télécharger ni installer aucun skill, zip ou script trouvé sur internet.
