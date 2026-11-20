"""Tests du plan mensuel.   python -m unittest discover -s tests"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import mensuel  # noqa: E402


def jours(n, debut="2020-01-01"):
    import datetime as dt
    d0 = dt.date.fromisoformat(debut)
    return [(d0 + dt.timedelta(days=i)).isoformat() for i in range(n)]


class Achat(unittest.TestCase):
    def test_parts_entieres_et_frais(self):
        # 100 € pour une part à 60 € : 1 part, frais 1 € minimum
        self.assertEqual(mensuel.achat(100, 60), (1.0, 61.0))
        # pas assez pour une part + frais : on attend
        self.assertEqual(mensuel.achat(100, 99.5), (0.0, 0.0))

    def test_fractions_tout_le_liquide(self):
        n, cout = mensuel.achat(100, 50, fractions=True)
        self.assertAlmostEqual(cout, 100)
        self.assertAlmostEqual(n, 99 / 50)          # 1 € de frais minimum


class Plan(unittest.TestCase):
    def test_prix_fixe(self):
        dates = jours(365)
        r = mensuel.plan_mensuel(dates, [10.0] * len(dates), montant=100)
        self.assertEqual(r["nb_mois"], 12)
        self.assertEqual(r["total_verse"], 1200)
        self.assertEqual(r["frais"], 12)            # 12 achats à 1 € minimum
        self.assertEqual(r["parts"], 118)           # (1 200 − 12) € → 118 parts, 8 € attendent encore
        self.assertAlmostEqual(r["valeur_finale"], 1200 - r["frais"])   # prix fixe : on ne perd que les frais
        self.assertEqual(r["chute"], 0.0)

    def test_liquide_qui_attend(self):
        dates = jours(95)                           # janvier → début avril : 4 versements
        r = mensuel.plan_mensuel(dates, [250.0] * len(dates), montant=100)
        self.assertEqual(r["nb_achats"], 1)         # 300 € en mars → 1 part (250 + 1,25 € de frais)
        self.assertEqual(r["parts"], 1)

    def test_chute_et_remontee(self):
        dates = jours(400)
        prix = [100.0] * 100 + [70.0] * 100 + [100.0] * 200
        r = mensuel.plan_mensuel(dates, prix, montant=1000)
        self.assertAlmostEqual(r["chute"], -0.30)
        self.assertEqual(r["chute_retour"], dates[200])
        self.assertLess(r["pire_valeur"], r["pire_verse"])

    def test_livret_a(self):
        self.assertEqual(mensuel.taux_livret("2023-06-01"), 0.03)
        dates = jours(70, "2023-03-01")
        r = mensuel.plan_mensuel(dates, [10.0] * len(dates), montant=100)
        self.assertAlmostEqual(r["livret_final"], 300 + 100 * 0.0025 * 2 + 100 * 0.0025, places=2)


if __name__ == "__main__":
    unittest.main()
