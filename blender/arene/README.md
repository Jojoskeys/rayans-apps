# Rayan's Arène — modèles 3D (Blender)

Les robots de l'Arène en 3D, fabriqués par un script Blender (aucun clic) : même allure que dans la tuile Arène de
Rayan's Mobile (corps rond, deux grands yeux, antenne, petits pieds), une couleur par famille de règle.

![Aperçu](sorties/apercu.png)

| Fichier (`sorties/`) | Contenu |
| --- | --- |
| `robot-croisement` (bleu), `robot-rebond` (orange), `robot-momentum` (violet), `robot-tendance` (vert) | les 4 familles de règles |
| `robot-acheter-et-garder` (doré) | le robot de référence |
| `couronne` | pour le meilleur robot |
| `arene` | piste de 6 couloirs (40 m), gradins, grand écran |

Chaque modèle existe en `.fbx` et en `.glb`. Environ 3 600 triangles par robot ; 1 unité = 1 mètre, un robot fait
environ 1,7 m avec l'antenne ; le point de référence est sous les pieds, l'avant regarde vers −Y dans Blender.

## Dans Roblox Studio

Accueil → **Importer en 3D** → choisir un `.fbx` (ou `.glb`) de `sorties/` → Importer. Le modèle arrive dans
l'espace de travail (MeshPart) ; on peut le ranger dans ReplicatedStorage et le cloner par script.

## Méthode : donner de la vie à un robot avec Claude et Blender

Règles tirées d'une vidéo, essayées sur `robot-croisement` (rien d'installé, rien d'acheté) :

1. **Lumière** : une lumière forte en haut à gauche, deux faibles ailleurs (à droite et derrière), fond plus
   sombre. Une lumière plate (tout éclairé pareil) donne un personnage mou.
2. **Une étape, une image** : après chaque étape (lumière, yeux, mouvement), regarder une image de contrôle
   avant de continuer ; corriger une seule chose à la fois.
3. **Comparer en gris** avec une référence : passer l'image en noir et blanc pour juger les volumes et les
   ombres sans être distrait par les couleurs.
4. **Anticipation** : avant chaque geste, un petit mouvement inverse (s'accroupir avant de sauter, étirer en l'air,
   écraser à l'atterrissage). Un clignement des yeux rend le robot vivant.

Essai fait (5 s, 24 images/s : clignement, accroupi, saut, atterrissage, clignement) : `sorties/methode-avant-apres.png`
(lumière plate à gauche, lumière en place à droite) et `sorties/methode-controle.png` (images 1, 21, 42, 70, 92).
Le `.blend` d'essai n'est pas gardé dans le dépôt ; les yeux sont séparés du corps pour pouvoir les écraser.

## Refaire les modèles

```bash
blender -b --python blender/arene/modeles.py
```

Modifier les couleurs ou les formes dans `modeles.py`, relancer : tout est réexporté avec un nouvel aperçu.
Avec Claude relié à Blender (MCP for Blender sur le PC), on peut aussi les retoucher directement dans Blender.
