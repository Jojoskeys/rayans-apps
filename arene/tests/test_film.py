"""Le film de l'Arène raconte la vraie évolution.   python -m unittest discover -s tests"""
import random
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import arene  # noqa: E402
import publier  # noqa: E402


class Film(unittest.TestCase):
    def test_film_ne_change_pas_les_resultats(self):
        dates, prix = arene.serie_demo(graine=4, jours=900)
        a = arene.evoluer(prix, 0, 700, random.Random(3), generations=4, population=20)
        gens = []
        b = arene.evoluer(prix, 0, 700, random.Random(3), generations=4, population=20, film=gens)
        self.assertEqual([x["genome"] for x in a], [x["genome"] for x in b])
        self.assertEqual(len(gens), 4)

    def test_moitie_meurt_et_enfants_de_survivantes(self):
        dates, prix = arene.serie_demo(graine=4, jours=900)
        gens = []
        arene.evoluer(prix, 0, 700, random.Random(3), generations=5, population=20, film=gens)
        for g, suivante in zip(gens, gens[1:]):
            self.assertEqual(sum(1 for x in g if x[4]), 10)
            vivants = {x[0] for x in g if x[4]}
            for ident, parent, *_ in suivante:
                self.assertTrue(ident in vivants or parent in vivants)   # survivante ou enfant d'une survivante
            self.assertEqual(len({x[0] for x in suivante}), 20)

    def test_film_complet(self):
        dates, prix = arene.serie_demo(graine=4)
        f = publier.film(dates, prix, "démo", generations=3, population=12)
        self.assertEqual(len(f["generations"]), 3)
        self.assertEqual(len(f["examen"]["champion"]), len(f["examen"]["dates"]))
        self.assertEqual(len(f["examen"]["ag"]), len(f["examen"]["dates"]))
        # la championne vient de la dernière génération filmée : elle y est, ou elle est l'enfant d'un survivant
        derniere = {a[0]: a for a in f["generations"][-1]}
        c = f["champion"]
        self.assertTrue(c["id"] in derniere or (c["parent"] in derniere and derniere[c["parent"]][4]))


if __name__ == "__main__":
    unittest.main()
