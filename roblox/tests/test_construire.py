"""Tests de construire.py et de la logique Luau.   python -m unittest discover -s tests   (dans roblox/)

Les tests Luau ont besoin du CLI `luau` (dans le PATH, ou chemin dans la variable LUAU) ;
sans lui ils sont sautés. Les comparaisons avec arene.py demandent numpy.
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ICI = Path(__file__).resolve().parent
RACINE = ICI.parent
sys.path.insert(0, str(RACINE))
import construire as C  # noqa: E402

LUAU = os.environ.get("LUAU") or shutil.which("luau")
try:
    sys.path.insert(0, str(C.ARENE))
    import numpy as np  # noqa: F401
    import arene
except ImportError:
    arene = None


def prix_demo():
    d, p = C._demo_standard()
    return d, p


def scripts_attendus():
    """{nom: (classe, source)} pour chaque fichier .luau de src/ (hors Prix, généré)."""
    out = {}
    for f in C.SRC.rglob("*.luau"):
        if f != C.MODULE_PRIX:
            classe, nom = C.classe_du_fichier(f)
            out[nom] = (classe, f.read_text(encoding="utf-8"))
    return out


def lancer_luau(*args, cwd=RACINE):
    return subprocess.run([LUAU, *args], cwd=cwd, capture_output=True, text=True, timeout=300)


class Donnees(unittest.TestCase):
    def test_hebdomadaires_garde_la_derniere_cloture(self):
        dates = ["2026-11-02", "2026-11-03", "2026-11-06", "2026-11-09", "2026-11-13"]
        d, p = C.hebdomadaires(dates, [1, 2, 3, 4, 5])
        self.assertEqual(d, ["2026-11-06", "2026-11-13"])
        self.assertEqual(p, [3, 5])

    def test_module_prix_bien_forme(self):
        d, p = prix_demo()
        code = C.module_prix("SPY", "test", True, d, p)
        dates = re.findall(r'"(\d{4}-\d\d-\d\d)"', code)
        prix = [float(x) for x in re.findall(r"(-?\d+\.\d{4}),", code)]
        self.assertEqual(len(dates), len(d))
        self.assertEqual(len(prix), len(p))
        self.assertEqual(dates, sorted(dates))
        self.assertTrue(all(x > 0 for x in prix))
        self.assertIn("demo = true", code)
        self.assertTrue(code.rstrip().endswith("}"))

    @unittest.skipUnless(LUAU, "CLI luau absent")
    def test_module_prix_se_charge_en_luau(self):
        d, p = prix_demo()
        with tempfile.TemporaryDirectory() as t:
            Path(t, "Prix.luau").write_text(C.module_prix("SPY", "test", False, d, p), encoding="utf-8")
            Path(t, "lire.luau").write_text(
                'local P = require("./Prix")\nprint(#P.dates, #P.clotures, P.actif, P.demo)\n', encoding="utf-8")
            r = lancer_luau("lire.luau", cwd=t)
        self.assertEqual(r.returncode, 0, r.stderr + r.stdout)
        self.assertEqual(r.stdout.split(), [str(len(d)), str(len(p)), "SPY", "false"])


class Place(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        d, p = prix_demo()
        cls.code_prix = C.module_prix("SPY", "test", True, d, p)
        cls.xml = C.construire_place(cls.code_prix)
        cls.racine = ET.fromstring(cls.xml)

    def test_racine_roblox_version_4(self):
        self.assertEqual(self.racine.tag, "roblox")
        self.assertEqual(self.racine.get("version"), "4")

    def test_referents_uniques_et_proprietes(self):
        items = list(self.racine.iter("Item"))
        refs = [i.get("referent") for i in items]
        self.assertEqual(len(refs), len(set(refs)))
        self.assertNotIn("null", refs)
        for i in items:
            self.assertTrue(i.get("class"))
            self.assertEqual(len(i.findall("Properties")), 1)

    def _par_nom(self):
        out = {}
        for i in self.racine.iter("Item"):
            nom = i.find("Properties/string[@name='Name']").text
            src = i.find("Properties/ProtectedString[@name='Source']")
            out[nom] = (i.get("class"), None if src is None else src.text, i)
        return out

    def test_tous_les_scripts_presents_avec_leur_source(self):
        items = self._par_nom()
        for nom, (classe, source) in scripts_attendus().items():
            self.assertIn(nom, items)
            self.assertEqual(items[nom][0], classe, nom)
            self.assertEqual(items[nom][1], source, nom)
        self.assertEqual(items["Prix"][0], "ModuleScript")
        self.assertEqual(items["Prix"][1], self.code_prix)
        self.assertEqual(items["Jeu"][0], "Script")
        self.assertEqual(items["Interface"][0], "LocalScript")

    def test_emplacements(self):
        enfants = {i.find("Properties/string").text: i for i in self.racine.findall("Item")}
        for service in ("Workspace", "ReplicatedStorage", "ServerScriptService", "StarterPlayer"):
            self.assertEqual(enfants[service].get("class"), service)

        def noms(item):
            return {e.find("Properties/string").text for e in item.findall("Item")}

        self.assertEqual(noms(enfants["Workspace"]), {"Baseplate", "SpawnLocation"})
        self.assertIn("Jeu", noms(enfants["ServerScriptService"]))
        arene_rs = enfants["ReplicatedStorage"].find("Item")
        self.assertEqual(arene_rs.get("class"), "Folder")
        self.assertEqual(noms(arene_rs), {"Regles", "Config", "Prix"})
        sps = enfants["StarterPlayer"].find("Item")
        self.assertEqual(sps.get("class"), "StarterPlayerScripts")
        self.assertEqual(noms(sps), {"Interface"})

    def test_cdata_protege(self):
        self.assertEqual(ET.fromstring("<a>" + C.p_source("x = ']]>'") + "</a>")[0].text, "x = ']]>'")

    def test_rien_de_personnel(self):
        for motif in (r"C:\\Users", r"/home/", r"@gmail", r"\bjojoskeys\b"):
            self.assertIsNone(re.search(motif, self.xml, re.I), motif)


@unittest.skipUnless(LUAU, "CLI luau absent")
class Luau(unittest.TestCase):
    def test_tests_luau(self):
        r = lancer_luau("tests/regles.test.luau")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("tests réussis", r.stdout)

    @unittest.skipUnless(arene, "arene.py (numpy) indisponible")
    def test_meme_resultat_que_arene_py(self):
        """Le port Luau de positions + frais donne exactement les rendements de arene.py."""
        d, p = prix_demo()
        p = p[:200]
        liste = ",".join(f"{x:.6f}" for x in p)
        prix = np.array([float(f"{x:.6f}") for x in p])
        genomes = [
            {"type": "croisement", "court": 3, "long": 12, "filtre": 0},
            {"type": "croisement", "court": 5, "long": 20, "filtre": 30},
            {"type": "rebond", "baisse": 0.05, "hausse": 0.06, "fenetre": 6, "stop": 0.08, "filtre": 0},
            {"type": "momentum", "semaines": 8, "seuil": 0.01, "filtre": 0},
            {"type": "momentum", "semaines": 20, "seuil": -0.02, "filtre": 20},
            {"type": "tendance", "semaines": 10, "filtre": 0},
        ]
        for g in genomes:
            spec = ",".join(f"{k}={v}" for k, v in g.items())
            r = lancer_luau("tests/croise.luau", "-a", spec, liste)
            self.assertEqual(r.returncode, 0, r.stderr + r.stdout)
            ordres, nets = r.stdout.split("\n")[:2]
            g_py = {("jours" if k == "semaines" else k): v for k, v in g.items()}
            net, nb = arene.rendements_jour(arene.positions(g_py, prix), prix)
            self.assertEqual(int(float(ordres)), nb, g)
            luau_net = [float(x) for x in nets.split(",")]
            self.assertEqual(len(luau_net), len(net))
            for a, b in zip(luau_net, net):
                self.assertAlmostEqual(a, b, places=9, msg=str(g))

    def test_simulation_partie_complete(self):
        """Une partie entière (générations, explosions, examen) avec un faux Roblox."""
        d, p = prix_demo()
        sources = {nom: src for nom, (_, src) in scripts_attendus().items()}
        sources["Prix"] = C.module_prix("SPY", "test", True, d, p)
        table = "{\n" + "".join(f"\t[\"{n}\"] = [==========[{s}]==========],\n" for n, s in sources.items()) + "}"
        modele = (ICI / "simulation.luau").read_text(encoding="utf-8")
        self.assertIn("{} --[[SOURCES]]", modele)
        with tempfile.TemporaryDirectory() as t:
            Path(t, "sim.luau").write_text(modele.replace("{} --[[SOURCES]]", table, 1), encoding="utf-8")
            r = lancer_luau("sim.luau", cwd=t)
        self.assertEqual(r.returncode, 0, r.stdout[-3000:] + r.stderr[-3000:])
        self.assertIn("simulation ok", r.stdout)
        self.assertIn("Acheter et garder", r.stdout)


if __name__ == "__main__":
    unittest.main()
