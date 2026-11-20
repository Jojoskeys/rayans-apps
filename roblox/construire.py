"""Rayan's Arène (Roblox) : assemble le fichier place RayansArene.rbxlx à ouvrir dans Roblox Studio.

    python construire.py                 # SPY : prix réels (cache de l'Arène, téléchargés si besoin)
    python construire.py --actif QQQ
    python construire.py --demo          # sans réseau : série de démonstration de l'Arène

1. Prend les clôtures journalières avec les fonctions de ../arene/arene.py (charger / telecharger,
   repli sur serie_demo sans réseau), garde la dernière clôture de chaque semaine.
2. Écrit src/ReplicatedStorage/Arene/Prix.luau (module Prix, aussi utilisé par Rojo).
3. Range chaque fichier de src/ comme Rojo (Nom.server.luau = Script, Nom.client.luau = LocalScript,
   Nom.luau = ModuleScript, dossier = Folder ou service) dans un fichier XML Roblox (format version 4).

Python standard seulement (numpy n'est utilisé que si l'Arène est disponible).
"""
import argparse
import csv
import datetime as dt
import math
import random
import sys
from pathlib import Path
from xml.sax.saxutils import escape

ICI = Path(__file__).resolve().parent
SRC = ICI / "src"
ARENE = ICI.parent / "arene"
PLACE = ICI / "RayansArene.rbxlx"
MODULE_PRIX = SRC / "ReplicatedStorage" / "Arene" / "Prix.luau"

SERVICES = {"Workspace", "ReplicatedStorage", "ServerScriptService", "StarterPlayer",
            "StarterPlayerScripts", "StarterGui", "ServerStorage", "Lighting"}


# ---------------------------------------------------------------- prix

def _demo_standard(graine=42, semaines=540):
    """Repli si l'Arène (numpy) n'est pas disponible : marche aléatoire hebdomadaire."""
    rng = random.Random(graine)
    d = dt.date(2016, 1, 8)
    dates, prix, p = [], [], 100.0
    for _ in range(semaines):
        p *= math.exp(rng.gauss(0.08 / 52, 0.16 / math.sqrt(52)))
        dates.append(d.isoformat())
        prix.append(p)
        d += dt.timedelta(days=7)
    return dates, prix


def _lire_csv(chemin):
    dates, prix = [], []
    with open(chemin, newline="", encoding="utf-8") as f:
        for ligne in csv.DictReader(f):
            try:
                p = float(ligne["cloture"])
            except (KeyError, ValueError):
                continue
            if p > 0:
                dates.append(ligne["date"])
                prix.append(p)
    return dates, prix


def prix_journaliers(actif, demo=False):
    """(dates, clôtures, source, demo?) avec les fonctions de l'Arène quand c'est possible."""
    sys.path.insert(0, str(ARENE))
    try:
        import arene
    except ImportError:  # numpy absent : on lit le cache CSV nous-mêmes
        arene = None
    if not demo:
        chemin = ARENE / "donnees" / f"{actif}.csv"
        if arene is not None:
            if not chemin.exists():
                try:
                    arene.telecharger(actif)
                except SystemExit as e:  # pas de yfinance ou pas de réseau
                    print(f"Téléchargement impossible ({e}). Repli sur la série de démonstration.")
            if chemin.exists():
                dates, prix = arene.charger(actif)
                return list(dates), [float(x) for x in prix], f"{actif} (Yahoo Finance, clôtures ajustées)", False
        elif chemin.exists():
            dates, prix = _lire_csv(chemin)
            return dates, prix, f"{actif} (Yahoo Finance, clôtures ajustées)", False
        else:
            print("numpy absent et pas de cache CSV : série de démonstration.")
    if arene is not None:
        dates, prix = arene.serie_demo()
        return list(dates), [float(x) for x in prix], "série de démonstration (fictive)", True
    dates, prix = _demo_standard()
    return dates, prix, "série de démonstration (fictive)", True


def hebdomadaires(dates, prix):
    """Dernière clôture de chaque semaine (lundi → vendredi, semaine ISO)."""
    out_d, out_p, cle_avant = [], [], None
    for d, p in zip(dates, prix):
        cle = dt.date.fromisoformat(d).isocalendar()[:2]
        if cle == cle_avant:
            out_d[-1], out_p[-1] = d, p
        else:
            out_d.append(d)
            out_p.append(p)
        cle_avant = cle
    return out_d, out_p


def module_prix(actif, source, demo, dates, prix):
    def chaine(s):
        return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'

    lignes = ["-- Généré par construire.py : ne pas modifier à la main.",
              "-- Clôtures HEBDOMADAIRES (dernier jour de bourse de chaque semaine).",
              "return {",
              f"\tactif = {chaine(actif if not demo else 'Démo')},",
              f"\tsource = {chaine(source)},",
              f"\tdemo = {'true' if demo else 'false'},",
              "\tdates = {"]
    for i in range(0, len(dates), 8):
        lignes.append("\t\t" + " ".join(chaine(d) + "," for d in dates[i:i + 8]))
    lignes += ["\t},", "\tclotures = {"]
    for i in range(0, len(prix), 10):
        lignes.append("\t\t" + " ".join(f"{p:.4f}," for p in prix[i:i + 10]))
    lignes += ["\t},", "}", ""]
    return "\n".join(lignes)


# ---------------------------------------------------------------- XML Roblox

class Place:
    def __init__(self):
        self.lignes = ['<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" '
                       'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
                       'xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">',
                       '\t<Meta name="ExplicitAutoJoints">true</Meta>']
        self.compteur = 0

    def referent(self):
        self.compteur += 1
        return f"RBX{self.compteur:032X}"

    def ouvrir(self, classe, proprietes, niveau):
        t = "\t" * niveau
        self.lignes.append(f'{t}<Item class="{classe}" referent="{self.referent()}">')
        self.lignes.append(f"{t}\t<Properties>")
        for p in proprietes:
            self.lignes.append(f"{t}\t\t{p}")
        self.lignes.append(f"{t}\t</Properties>")

    def fermer(self, niveau):
        self.lignes.append("\t" * niveau + "</Item>")

    def texte(self):
        return "\n".join(self.lignes + ["</roblox>", ""])


def p_string(nom, v):
    return f'<string name="{nom}">{escape(v)}</string>'


def p_source(code):
    # CDATA : le seul texte interdit est « ]]> », coupé en deux blocs CDATA si jamais il apparaît
    return f'<ProtectedString name="Source"><![CDATA[{code.replace("]]>", "]]]]><![CDATA[>")}]]></ProtectedString>'


def p_bool(nom, v):
    return f'<bool name="{nom}">{"true" if v else "false"}</bool>'


def p_vector3(nom, x, y, z):
    return f'<Vector3 name="{nom}"><X>{x}</X><Y>{y}</Y><Z>{z}</Z></Vector3>'


def p_cframe(x, y, z):
    rot = "".join(f"<R{i}{j}>{1 if i == j else 0}</R{i}{j}>" for i in range(3) for j in range(3))
    return f'<CoordinateFrame name="CFrame"><X>{x}</X><Y>{y}</Y><Z>{z}</Z>{rot}</CoordinateFrame>'


def p_couleur(r, g, b):
    return f'<Color3uint8 name="Color3uint8">{0xFF000000 | r << 16 | g << 8 | b}</Color3uint8>'


def piece(place, classe, nom, taille, position, couleur, niveau, extra=()):
    place.ouvrir(classe, [p_string("Name", nom), p_bool("Anchored", True), p_vector3("size", *taille),
                          p_cframe(*position), p_couleur(*couleur), '<token name="TopSurface">0</token>',
                          '<token name="BottomSurface">0</token>', *extra], niveau)
    place.fermer(niveau)


def classe_du_fichier(f):
    n = f.name
    if n.endswith(".server.luau"):
        return "Script", n[: -len(".server.luau")]
    if n.endswith(".client.luau"):
        return "LocalScript", n[: -len(".client.luau")]
    return "ModuleScript", n[: -len(".luau")]


def ajouter_dossier(place, dossier, niveau, code_prix):
    if dossier == MODULE_PRIX.parent:  # le module Prix vient des données, pas du disque
        place.ouvrir("ModuleScript", [p_string("Name", "Prix"), p_source(code_prix)], niveau)
        place.fermer(niveau)
    for f in sorted(dossier.iterdir()):
        if f.is_dir():
            place.ouvrir(f.name if f.name in SERVICES else "Folder", [p_string("Name", f.name)], niveau)
            ajouter_dossier(place, f, niveau + 1, code_prix)
            place.fermer(niveau)
        elif f.suffix == ".luau" and f != MODULE_PRIX:
            classe, nom = classe_du_fichier(f)
            place.ouvrir(classe, [p_string("Name", nom), p_source(f.read_text(encoding="utf-8"))], niveau)
            place.fermer(niveau)


def construire_place(code_prix):
    """Texte XML du fichier place ; code_prix = source du module Prix."""
    place = Place()
    # Workspace : le sol et le point d'apparition (le reste du décor est créé par le serveur)
    place.ouvrir("Workspace", [p_string("Name", "Workspace")], 1)
    piece(place, "Part", "Baseplate", (600, 2, 600), (0, -1, 130), (99, 95, 98), 2, [p_bool("Locked", True)])
    piece(place, "SpawnLocation", "SpawnLocation", (12, 1, 12), (-100, 0.5, 130), (242, 201, 76), 2,
          ['<int name="Duration">0</int>'])
    place.fermer(1)
    for service in sorted(d for d in SRC.iterdir() if d.is_dir()):
        place.ouvrir(service.name, [p_string("Name", service.name)], 1)
        ajouter_dossier(place, service, 2, code_prix)
        place.fermer(1)
    return place.texte()


def main(argv=None):
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--actif", default="SPY", help="symbole Yahoo Finance (défaut : SPY)")
    a.add_argument("--demo", action="store_true", help="série de démonstration, sans réseau")
    a.add_argument("--sortie", type=Path, default=PLACE)
    args = a.parse_args(argv)

    dates, prix, source, demo = prix_journaliers(args.actif, args.demo)
    d, p = hebdomadaires(dates, prix)
    code_prix = module_prix(args.actif, source, demo, d, p)
    MODULE_PRIX.write_text(code_prix, encoding="utf-8")  # pour Rojo
    args.sortie.write_text(construire_place(code_prix), encoding="utf-8")
    print(f"{len(p)} semaines de {source} ({d[0]} → {d[-1]})")
    print(f"Place écrite : {args.sortie}  (double-clic pour l'ouvrir dans Roblox Studio, puis Play)")
    return args.sortie


if __name__ == "__main__":
    main()
