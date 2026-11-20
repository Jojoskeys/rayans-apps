"""Rayan's Arène — modèles 3D fabriqués par Blender (robots, couronne, arène) pour le jeu Roblox et la future 3D.

    blender -b --python blender/arene/modeles.py -- [dossier de sortie]

Sans dossier, tout sort dans blender/arene/sorties/ :
- robot-<famille>.fbx et .glb (croisement bleu, rebond orange, momentum violet, tendance vert, acheter-et-garder doré),
- couronne.fbx/.glb, arene.fbx/.glb (piste à 6 couloirs, gradins, grand écran),
- apercu.png (rendu de la scène).
Formats importables dans Roblox Studio (Accueil → Importer en 3D) et dans un navigateur (glTF). Modèles légers
(quelques milliers de triangles), échelle : 1 unité Blender = 1 mètre ; un robot fait environ 1,4 m de haut.
Même allure que les robots de la tuile Arène : corps rond, deux grands yeux, une antenne.
"""
import math
import sys
from pathlib import Path

import bpy

ICI = Path(__file__).resolve().parent
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SORTIE = Path(args[0]).resolve() if args else ICI / "sorties"
SORTIE.mkdir(parents=True, exist_ok=True)

FAMILLES = {
    "croisement": "#5B8DEF",
    "rebond": "#E3A33B",
    "momentum": "#C77DDB",
    "tendance": "#3BA776",
    "acheter-et-garder": "#F5C542",
}


def rgb(h):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)


def matiere(nom, couleur, rugosite=0.45, metal=0.0, emission=0.0):
    m = bpy.data.materials.get(nom) or bpy.data.materials.new(nom)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = rgb(couleur)
    p.inputs["Roughness"].default_value = rugosite
    p.inputs["Metallic"].default_value = metal
    if emission:
        p.inputs["Emission Color"].default_value = rgb(couleur)
        p.inputs["Emission Strength"].default_value = emission
    m.diffuse_color = rgb(couleur)       # couleur aussi visible sans nœuds (FBX, aperçu rapide)
    return m


def vider():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def sphere(nom, rayon, loc, mat, segments=24, anneaux=16):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=rayon, location=loc, segments=segments, ring_count=anneaux)
    o = bpy.context.active_object
    o.name = nom
    o.data.materials.append(mat)
    for f in o.data.polygons:
        f.use_smooth = True
    return o


def robot(famille, couleur):
    """Un robot posé au sol (z = 0), regardant vers -Y (l'avant), parenté sous un vide « robot-<famille> »."""
    corps_m = matiere(f"corps-{famille}", couleur, 0.35, 0.1 if famille == "acheter-et-garder" else 0.0)
    blanc = matiere("blanc", "#FFFFFF", 0.3)
    noir = matiere("noir", "#111418", 0.2)
    pieds_m = matiere("pieds", "#2B313B", 0.6)
    parties = []
    corps = sphere("corps", 0.55, (0, 0, 0.72), corps_m, 32, 20)
    corps.scale = (1, 0.92, 0.95)
    parties.append(corps)
    for s in (-1, 1):                       # yeux : blanc + pupille, légèrement vers l'avant
        parties.append(sphere(f"oeil-{s}", 0.17, (s * 0.2, -0.43, 0.84), blanc, 20, 12))
        parties.append(sphere(f"pupille-{s}", 0.08, (s * 0.21, -0.57, 0.85), noir, 16, 10))
        parties.append(sphere(f"pied-{s}", 0.16, (s * 0.26, -0.05, 0.12), pieds_m, 16, 10))
        parties[-1].scale = (1, 1.4, 0.6)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.035, depth=0.42, location=(0.1, 0.0, 1.38), vertices=12)
    antenne = bpy.context.active_object
    antenne.name = "antenne"
    antenne.rotation_euler = (0, math.radians(18), 0)
    antenne.data.materials.append(corps_m)
    parties.append(antenne)
    parties.append(sphere("bout-antenne", 0.08, (0.17, 0.0, 1.6), corps_m, 16, 10))
    bpy.ops.object.select_all(action="DESELECT")
    for o in parties:
        o.select_set(True)
    bpy.context.view_layer.objects.active = corps
    bpy.ops.object.join()                   # un seul objet : plus simple à importer dans Roblox
    corps.name = f"robot-{famille}"
    # point de référence sous les pieds (z = 0) : posé au sol quand on le place dans Roblox ou dans la scène
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return corps


def couronne():
    or_m = matiere("or", "#F5C542", 0.25, 0.9)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.32, depth=0.14, location=(0, 0, 0.07), vertices=32)
    base = bpy.context.active_object
    base.data.materials.append(or_m)
    pics = []
    for k in range(5):
        a = 2 * math.pi * k / 5
        bpy.ops.mesh.primitive_cone_add(radius1=0.09, depth=0.28, location=(0.27 * math.cos(a), 0.27 * math.sin(a), 0.26), vertices=12)
        c = bpy.context.active_object
        c.data.materials.append(or_m)
        pics.append(c)
        pics.append(sphere(f"perle-{k}", 0.045, (0.27 * math.cos(a), 0.27 * math.sin(a), 0.42), or_m, 12, 8))
    bpy.ops.object.select_all(action="DESELECT")
    for o in [base, *pics]:
        o.select_set(True)
    bpy.context.view_layer.objects.active = base
    bpy.ops.object.join()
    base.name = "couronne"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return base


def arene():
    """Piste de 6 couloirs (40 m) le long de +X, gradins, grand écran au bout ; sol à z = 0."""
    sol_m = matiere("piste", "#1F242C", 0.8)
    ligne_m = matiere("lignes", "#ECEFF3", 0.5)
    gradin_m = matiere("gradins", "#2B313B", 0.7)
    ecran_m = matiere("ecran", "#4A9FD8", 0.2, 0.0, 1.5)
    cadre_m = matiere("cadre", "#111418", 0.4)
    objets = []
    L, couloir, n = 40.0, 2.4, 6
    W = couloir * n
    bpy.ops.mesh.primitive_plane_add(size=1, location=(L / 2, 0, 0))
    sol = bpy.context.active_object
    sol.scale = (L + 6, W + 2, 1)
    sol.data.materials.append(sol_m)
    objets.append(sol)
    for k in range(n + 1):                  # lignes de couloirs
        y = -W / 2 + k * couloir
        bpy.ops.mesh.primitive_cube_add(size=1, location=(L / 2, y, 0.01))
        l = bpy.context.active_object
        l.scale = (L, 0.08, 0.02)
        l.data.materials.append(ligne_m)
        objets.append(l)
    for x, nom in ((0.0, "depart"), (L, "arrivee")):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 0, 0.01))
        l = bpy.context.active_object
        l.scale = (0.25, W, 0.02)
        l.data.materials.append(ligne_m)
        objets.append(l)
    for s in (-1, 1):                       # trois marches de gradins de chaque côté
        for m in range(3):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(L / 2, s * (W / 2 + 1.5 + m * 1.6), 0.4 + m * 0.8))
            g = bpy.context.active_object
            g.scale = (L + 4, 1.6, 0.8 + m * 1.6)
            g.location.z = (0.8 + m * 1.6) / 2
            g.data.materials.append(gradin_m)
            objets.append(g)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(L + 5, 0, 5))   # grand écran (cadre + face lumineuse)
    cadre = bpy.context.active_object
    cadre.scale = (0.6, W + 1, 7)
    cadre.data.materials.append(cadre_m)
    objets.append(cadre)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(L + 4.65, 0, 5))
    ecran = bpy.context.active_object
    ecran.scale = (0.1, W, 6)
    ecran.data.materials.append(ecran_m)
    objets.append(ecran)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objets:
        o.select_set(True)
    bpy.context.view_layer.objects.active = sol
    bpy.ops.object.join()
    sol.name = "arene"
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return sol


def exporter(obj, nom):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.fbx(filepath=str(SORTIE / f"{nom}.fbx"), use_selection=True, apply_unit_scale=True,
                             axis_forward="-Z", axis_up="Y", path_mode="COPY", embed_textures=True)
    bpy.ops.export_scene.gltf(filepath=str(SORTIE / f"{nom}.glb"), use_selection=True, export_format="GLB")


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def apercu(objets):
    """Rendu de la scène : la piste, les cinq robots sur la ligne, le doré couronné."""
    scene = bpy.context.scene
    bpy.ops.object.empty_add(location=(2.6, -0.6, 0.7))
    cible = bpy.context.active_object
    bpy.ops.object.camera_add(location=(10.5, -8.0, 3.6))
    scene.camera = bpy.context.active_object
    scene.camera.data.lens = 38
    suivi = scene.camera.constraints.new("TRACK_TO")
    suivi.target = cible
    suivi.track_axis, suivi.up_axis = "TRACK_NEGATIVE_Z", "UP_Y"
    bpy.ops.object.light_add(type="SUN", location=(0, 0, 20), rotation=(math.radians(45), 0, math.radians(60)))
    bpy.context.active_object.data.energy = 4.0
    bpy.ops.object.light_add(type="AREA", location=(8, -4, 6))
    lampe = bpy.context.active_object
    lampe.data.energy, lampe.data.size = 900, 6
    lampe.constraints.new("TRACK_TO").target = cible
    monde = bpy.data.worlds.new("monde")
    monde.use_nodes = True
    monde.node_tree.nodes["Background"].inputs["Color"].default_value = rgb("#151A21")
    monde.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
    scene.world = monde
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    scene.render.filepath = str(SORTIE / "apercu.png")
    scene.view_settings.view_transform = "Standard"
    bpy.ops.render.render(write_still=True)


def main():
    vider()
    faits = []
    for famille, couleur in FAMILLES.items():
        r = robot(famille, couleur)
        exporter(r, f"robot-{famille}")
        faits.append((f"robot-{famille}", triangles(r)))
        bpy.data.objects.remove(r, do_unlink=True)
    c = couronne()
    exporter(c, "couronne")
    faits.append(("couronne", triangles(c)))
    bpy.data.objects.remove(c, do_unlink=True)
    a = arene()
    exporter(a, "arene")
    faits.append(("arene", triangles(a)))
    # scène d'aperçu : un robot par couloir, le doré couronné
    for k, (famille, couleur) in enumerate(FAMILLES.items()):
        r = robot(famille, couleur)
        r.location = (1.5 + (2.5 if famille == "acheter-et-garder" else k * 0.5), -6.0 + 1.2 + k * 2.4, 0)
        r.rotation_euler = (0, 0, math.radians(90))      # regardent vers l'arrivée (+X)
        if famille == "acheter-et-garder":
            cc = couronne()
            cc.location = (r.location.x, r.location.y, 1.72)
    apercu(None)
    for nom, t in faits:
        print(f"  {nom} : {t} triangles")
    print(f"Modèles dans {SORTIE}")


main()
