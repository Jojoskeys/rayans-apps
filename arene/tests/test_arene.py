"""Tests de l'Arène (sans réseau).   python -m unittest discover -s tests"""
import random
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import arene  # noqa: E402


def serie_simple(n=300, pas=0.01):
    """Prix qui monte de 1 % chaque jour."""
    return 100 * (1 + pas) ** np.arange(n)


class Frais(unittest.TestCase):
    def test_un_aller_retour_paie_deux_ordres(self):
        prix = np.full(10, 100.0)                   # prix plat : seuls les frais comptent
        pos = np.array([0, 1, 1, 1, 0, 0, 0, 0, 0, 0], float)
        net, nb = arene.rendements_jour(pos, prix)
        self.assertEqual(nb, 2)
        self.assertAlmostEqual(arene.total(net), (1 - arene.COUT_ORDRE) ** 2 - 1, places=12)
        self.assertAlmostEqual(arene.COUT_ORDRE, 0.0015)

    def test_rester_en_cash_ne_coute_rien(self):
        net, nb = arene.rendements_jour(np.zeros(20), serie_simple(20))
        self.assertEqual(nb, 0)
        self.assertEqual(arene.total(net), 0.0)

    def test_plus_d_ordres_plus_de_frais(self):
        prix = np.full(40, 50.0)
        calme = np.array([0] * 20 + [1] * 20, float)
        agite = np.array([0, 1] * 20, float)
        self.assertGreater(arene.total(arene.rendements_jour(calme, prix)[0]),
                           arene.total(arene.rendements_jour(agite, prix)[0]))


class AcheterGarder(unittest.TestCase):
    def test_serie_simple(self):
        prix = np.array([100.0, 110.0, 99.0, 120.0])
        r = arene.total(arene.acheter_garder(prix, 0, 4))
        self.assertAlmostEqual(r, (1 - arene.COUT_ORDRE) * 120 / 100 - 1, places=12)


class PasDeFuite(unittest.TestCase):
    def test_changer_le_futur_ne_change_pas_le_passe(self):
        dates, prix = arene.serie_demo(graine=3, jours=900)
        rng = random.Random(5)
        coupe = 600
        autre = prix.copy()
        autre[coupe:] *= np.linspace(2, 0.3, len(prix) - coupe)   # futur totalement différent
        for t in arene.TYPES:
            for _ in range(10):
                g = arene.genome_hasard(rng, t)
                a, b = arene.positions(g, prix), arene.positions(g, autre)
                np.testing.assert_array_equal(a[:coupe], b[:coupe], err_msg=str(g))

    def test_la_decision_du_jour_ne_profite_pas_du_jour_meme(self):
        # le prix bondit de +50 % au jour 5 ; une position prise à la clôture du jour 5 ne le touche pas
        prix = np.array([100.0] * 5 + [150.0] * 5)
        pos = np.array([0] * 5 + [1] * 5, float)
        net, _ = arene.rendements_jour(pos, prix)
        self.assertLess(arene.total(net), 0)          # seulement les frais

    def test_evaluer_ne_lit_rien_apres_la_fin(self):
        _, prix = arene.serie_demo(graine=4, jours=800)
        autre = prix.copy()
        autre[500:] = 1.0
        g = arene.genome_hasard(random.Random(1), "croisement")
        np.testing.assert_array_equal(arene.evaluer(g, prix, 300, 500)[0], arene.evaluer(g, autre, 300, 500)[0])


class WalkForward(unittest.TestCase):
    def test_entrainement_et_test_separes(self):
        dates, _ = arene.serie_demo()
        fs = arene.fenetres(dates)
        self.assertGreaterEqual(len(fs), 5)
        for annee, d_e, f_e, d_t, f_t in fs:
            self.assertLessEqual(f_e, d_t)                         # aucun jour de test dans l'entraînement
            self.assertTrue(all(dates[i][:4] < str(annee) for i in range(d_e, f_e)))
            self.assertTrue(all(dates[i][:4] == str(annee) for i in range(d_t, f_t)))
            self.assertEqual(int(dates[d_e][:4]), annee - 3)
        tests = [f[0] for f in fs]
        self.assertEqual(tests, list(range(tests[0], tests[0] + len(tests))))  # décalage d'un an

    def test_evolution_ne_voit_pas_l_annee_de_test(self):
        dates, prix = arene.serie_demo(graine=7, jours=1300)
        _, d_e, f_e, _, _ = arene.fenetres(dates)[0]
        autre = prix.copy()
        autre[f_e:] = autre[f_e:][::-1] * 3          # on bouleverse tout ce qui suit l'entraînement
        a = arene.evoluer(prix, d_e, f_e, random.Random(2), generations=3, population=20)
        b = arene.evoluer(autre, d_e, f_e, random.Random(2), generations=3, population=20)
        self.assertEqual([x["genome"] for x in a], [x["genome"] for x in b])


class Reproductible(unittest.TestCase):
    def test_meme_graine_meme_resultat(self):
        dates, prix = arene.serie_demo(graine=9, jours=1400)
        r1 = arene.walk_forward(dates, prix, generations=3, population=20, graine=5, nb_hasard=10, bavard=False)
        r2 = arene.walk_forward(dates, prix, generations=3, population=20, graine=5, nb_hasard=10, bavard=False)
        self.assertEqual(r1["total_arene"], r2["total_arene"])
        self.assertEqual(r1["total_hasard"], r2["total_hasard"])
        self.assertEqual(len(r1["courbe_arene"]), len(r1["courbe_ag"]))
        self.assertEqual(len(r1["courbe_arene"]), len(r1["dates"]))

    def test_annees_au_calendrier(self):
        # 7 jours sur 7 (comme le bitcoin) : 1 an = 365 lignes, pas 252
        self.assertAlmostEqual(arene.annees_entre("2020-01-01", "2021-01-01"), 1.0, places=2)
        from datetime import date, timedelta
        d0 = date(2016, 1, 1)
        dates = [(d0 + timedelta(days=i)).isoformat() for i in range(365 * 6)]
        prix = arene.serie_demo(graine=3, jours=len(dates))[1]
        r = arene.walk_forward(dates, prix, generations=2, population=10, graine=1, nb_hasard=5, bavard=False)
        self.assertAlmostEqual(r["ans_test"], len(r["fenetres"]), delta=0.1)

    def test_demo_fixe(self):
        np.testing.assert_array_equal(arene.serie_demo()[1], arene.serie_demo()[1])


if __name__ == "__main__":
    unittest.main()
