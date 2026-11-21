"""Tests simples du Studio (sans réseau, sans voix, sans rendu).   python -m unittest discover -s tests"""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

TMP = tempfile.mkdtemp(prefix="studio-tests-")
os.environ["STUDIO_RACINE"] = TMP          # jamais le vrai dossier de Rayan
os.environ["STUDIO_A_VALIDER"] = os.path.join(TMP, "A valider")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import bilan  # noqa: E402
import controle  # noqa: E402
import decouper  # noqa: E402
import longue  # noqa: E402
import nuit  # noqa: E402
import post_metricool  # noqa: E402
import regles  # noqa: E402
from fabrique import marquer_forts  # noqa: E402


def mots_phrase(debut, texte, pas=0.5):
    out, t = [], debut
    for w in texte.split():
        out.append([t, t + pas * 0.8, w])
        t += pas
    return out


class Regles(unittest.TestCase):
    def test_hashtag_sourate(self):
        p = {"style": "ayati", "hashtags": ["#coran", "#alaraf"], "segments": [{"type": "verset", "ref": "5:27"}]}
        pbs = regles.problemes_hashtags(p)
        self.assertTrue(any("#almaida manquant" in x for x in pbs))
        self.assertTrue(any("#alaraf" in x and "sourate 7" in x for x in pbs))

    def test_hashtag_ok_et_doublon(self):
        p = {"style": "ayati", "hashtags": ["#alqasas", "#rappel"], "segments": [{"type": "verset", "ref": "28:7"}]}
        self.assertEqual(regles.problemes_hashtags(p), [])
        self.assertEqual(regles.problemes_hashtags({"style": "psycho", "hashtags": ["#a", "#a"]}), ["hashtag en double : #a"])

    def test_duree(self):
        self.assertIsNone(regles.avis_duree(80))
        self.assertIn("90 s", regles.avis_duree(120))
        self.assertIn("3 min", regles.avis_duree(200))
        self.assertIsNone(regles.avis_duree(600, vertical=False))


class Son(unittest.TestCase):
    def test_zones(self):
        tl = {"fps": 30, "segments": [{"type": "narration", "debut": 0, "fin": 60, "mots": [{"debut": 30, "fin": 60, "texte": "a"}]},
                                      {"type": "verset", "debut": 90, "fin": 150}]}
        voix = controle.zones_voix(tl)
        self.assertEqual(voix, [(1.0, 2.0), (3.0, 5.0)])
        self.assertEqual(controle.zones_fond(voix, 6.0, marge=0), [(0.0, 1.0), (2.0, 3.0), (5.0, 6.0)])

    def test_avis(self):
        ok = {"lufs": -14.2, "crete": -1.4, "satures": 0, "marge_voix": 15}
        self.assertEqual(controle.avis_son(ok), [])
        mauvais = {"lufs": -10, "crete": 0.2, "satures": 12, "marge_voix": 4}
        self.assertEqual(len(controle.avis_son(mauvais)), 4)

    def test_niveau(self):
        import numpy as np
        sr = 1000
        x = np.zeros((4000, 2), np.float32)
        x[:2000] = 0.5
        x[2000:] = 0.05
        fort = controle.niveau_db(x, [(0, 2)], sr)
        faible = controle.niveau_db(x, [(2, 4)], sr)
        self.assertAlmostEqual(fort - faible, 20, delta=0.5)


class FormatLong(unittest.TestCase):
    TL = {"slug": "x", "fps": 30, "duree": 3000, "segments": [
        {"type": "narration", "scene": "a", "debut": 0, "fin": 450, "mots": [{"texte": "Bonjour", "debut": 0, "fin": 10}]},
        {"type": "verset", "scene": "b", "debut": 450, "fin": 900, "verset": {"ref": "28:7"}},
        {"type": "narration", "scene": "c", "debut": 900, "fin": 3000, "image": "x/1.jpg", "mots": []}]}

    def test_passages(self):
        ps = longue.passages(self.TL)
        self.assertEqual([p["debut"] for p in ps], [0, 15, 30])
        self.assertIn("[verset 28:7]", longue.texte_passages(self.TL))
        self.assertIn("00:30 – 01:40", longue.texte_passages(self.TL))

    def test_intro_ne_coupe_pas_un_passage(self):
        self.assertEqual(longue.fin_intro(self.TL, 30), 899)
        self.assertEqual(longue.fin_intro(self.TL, 5), 449)   # au moins un passage entier

    def test_miniatures(self):
        self.assertEqual(longue.textes_miniatures({"titre": "T", "miniatures": ["A"]}), ["A", "T", "T"])


class Decouper(unittest.TestCase):
    def mots(self):
        out, t = [], 0.0
        for k in range(30):   # 30 phrases de 4 s
            out += mots_phrase(t, ("Pourquoi tu fais ça ?" if k % 5 == 0 else f"Phrase numéro {k} assez simple ici."), 0.8)
            t += 4.0
        return out

    def test_extraits(self):
        ex = decouper.proposer(self.mots())
        self.assertGreaterEqual(len(ex), 2)
        for e in ex:
            self.assertGreaterEqual(e["fin"] - e["debut"], 30)
            self.assertLessEqual(e["fin"] - e["debut"], 61)
        for a, b in zip(ex, ex[1:]):
            self.assertLessEqual(a["fin"], b["debut"])

    def test_jamais_un_verset_coupe(self):
        zones = [(10.5, 22.5), (70.2, 75.0)]
        for e in decouper.proposer(self.mots(), zones):
            self.assertFalse(decouper.coupe_un_verset(e["debut"], e["fin"], zones))

    def test_mots_relatifs_sans_verset(self):
        ex = {"debut": 10.0, "mots": [[10.0, 10.5, "a"], [11.0, 11.5, "b"], [13.0, 13.5, "c"]]}
        r = decouper.mots_relatifs(ex, [(10.9, 12.0)])
        self.assertEqual([m["texte"] for m in r], ["a", "c"])
        self.assertEqual(r[1]["debut"], 90)


    def test_stories(self):
        st = decouper.proposer_stories(self.mots())
        self.assertGreaterEqual(len(st), 1)
        self.assertLessEqual(len(st), decouper.NB_STORIES)
        self.assertEqual(st[0]["debut"], 0.0)                      # la première story part de l'accroche
        for e in st:
            self.assertGreaterEqual(e["fin"] - e["debut"], decouper.STORY_MIN)
            self.assertLessEqual(e["fin"] - e["debut"], decouper.STORY_MAX)
            self.assertLessEqual(e["fin"], 120 * decouper.STORY_PART_MAX)   # la fin du Short n'est pas dévoilée
        for a, b in zip(st, st[1:]):
            self.assertLessEqual(a["fin"], b["debut"])
            self.assertLess(b["debut"] - a["fin"], 1.0)               # elles se suivent

    def test_stories_jamais_un_verset_coupe(self):
        zones = [(10.5, 22.5)]
        for e in decouper.proposer_stories(self.mots(), zones):
            self.assertFalse(decouper.coupe_un_verset(e["debut"], e["fin"], zones))

    def test_stories_vide(self):
        self.assertEqual(decouper.proposer_stories([]), [])


class Stories(unittest.TestCase):
    def setUp(self):
        self.dossier = Path(TMP) / "projets"
        self.dossier.mkdir(exist_ok=True)
        for slug, style in (("ayati-test", "ayati"), ("psycho-test", "psycho")):
            (self.dossier / f"{slug}.json").write_text(json.dumps({"style": style}), encoding="utf-8")
        self.ancien = post_metricool.ICI
        post_metricool.ICI = Path(TMP)

    def tearDown(self):
        post_metricool.ICI = self.ancien

    def test_heure(self):
        self.assertEqual(post_metricool.heure_story("2026-11-20T18:30", 1), "2026-11-20T19:30")
        self.assertEqual(post_metricool.heure_story("2026-11-20T23:30", 3), "2026-11-21T00:40")

    def test_ayati(self):
        d = post_metricool.info_story("ayati-test", "2026-11-20T18:30", "https://x/s.mp4", 2)
        self.assertEqual([p["network"] for p in d["providers"]], ["instagram", "facebook"])
        self.assertEqual(d["instagramData"]["type"], "STORY")
        self.assertEqual(d["facebookData"]["type"], "STORY")
        self.assertEqual(d["text"], "")
        self.assertTrue(d["draft"])
        self.assertFalse(d["autoPublish"])
        self.assertEqual(d["publicationDate"]["dateTime"], "2026-11-20T19:35:00")

    def test_psycho_direct(self):
        d = post_metricool.info_story("psycho-test", "2026-11-20T18:30", "https://x/s.mp4", 1, direct=True)
        self.assertEqual([p["network"] for p in d["providers"]], ["instagram"])
        self.assertNotIn("facebookData", d)
        self.assertTrue(d["autoPublish"])
        self.assertFalse(d["draft"])


class Bilan(unittest.TestCase):
    STATS = {"releves": [
        {"date": "2026-11-18T20:00", "slug": "a", "reseau": "tiktok", "vues": 100, "jaime": 5, "partages": 1},
        {"date": "2026-11-19T20:00", "slug": "a", "reseau": "tiktok", "vues": 300, "jaime": 9, "partages": 2},
        {"date": "2026-11-19T20:00", "slug": "a", "reseau": "youtube", "vues": 50, "jaime": 1, "partages": 0},
        {"date": "2026-11-19T20:00", "slug": "b", "reseau": "tiktok", "vues": 20, "jaime": 0, "partages": 0},
        {"date": "2026-11-19T20:00", "slug": "c", "reseau": "tiktok", "vues": 80, "jaime": 2, "partages": 0},
        {"date": "2026-11-19T20:00", "slug": "d", "reseau": "tiktok", "vues": 10, "jaime": 0, "partages": 0}],
        "abonnes": [{"date": "2026-11-18T20:00", "compte": "ayati", "reseau": "tiktok", "total": 40},
                    {"date": "2026-11-19T20:00", "compte": "ayati", "reseau": "tiktok", "total": 46}],
        "commentaires": [{"date": "2026-11-19T10:00", "slug": "a", "texte": "Super"},
                         {"date": "2026-11-19T11:00", "slug": "a", "texte": "Tu peux faire Youssouf ?"},
                         {"date": "2026-11-10T11:00", "slug": "a", "texte": "Vieux ?"}]}

    def test_top_flop(self):
        b = bilan.bilan(self.STATS, {})
        self.assertEqual(b["top"][0][0], "a")
        self.assertEqual(b["top"][0][1]["vues"], 350)        # dernier relevé de chaque réseau, additionnés
        self.assertEqual(b["flop"][0][0], "d")
        self.assertIn("Bilan", bilan.page_bilan(b))

    def test_recommandation(self):
        self.assertEqual(bilan.recommandation(300, 100, 3), "on continue")
        self.assertEqual(bilan.recommandation(30, 100, 3), "on arrête")
        self.assertEqual(bilan.recommandation(90, 100, 3), "on teste")

    def test_jour(self):
        j = bilan.jour(self.STATS)
        self.assertEqual(j["meilleure"][0], "a")
        self.assertEqual(j["meilleure"][1], 250)           # 200 sur TikTok + 50 sur YouTube (nouveau)
        self.assertEqual(j["comptes"]["Ayati"]["abonnes"], 6)
        self.assertEqual(j["commentaires"][0]["texte"], "Tu peux faire Youssouf ?")
        self.assertEqual(len(j["commentaires"]), 2)

    def test_vide(self):
        self.assertIn("Aucun relevé", bilan.page_jour(bilan.jour({"releves": [], "abonnes": [], "commentaires": []})))


class Nuit(unittest.TestCase):
    def test_candidats(self):
        d = Path(tempfile.mkdtemp(dir=TMP))
        scripts, av = d / "Scripts", d / "A valider"
        scripts.mkdir()
        av.mkdir()
        for slug, envoye, verdict in (("p1", 2, "ok"), ("p2", 1, "ok"), ("p3", 3, "corriger"), ("p4", 4, "ok")):
            (scripts / f"{slug}.json").write_text(json.dumps({"version": 1, "envoye": envoye}), encoding="utf-8")
            (scripts / f"{slug}.retours.json").write_text(json.dumps([{"version": 1, "verdict": verdict, "at": 0}]), encoding="utf-8")
        (av / "p4.mp4").write_bytes(b"")
        self.assertEqual(nuit.candidats(scripts, av, {}, set()), ["p2", "p1"])
        self.assertEqual(nuit.candidats(scripts, av, {"ordre": ["p1"]}, set()), ["p1", "p2"])
        self.assertEqual(nuit.candidats(scripts, av, {}, {"p2"}), ["p1"])

    def test_refus(self):
        env = {"ELEVENLABS_API_KEY": "x"}
        self.assertIn("ElevenLabs", nuit.refus({"style": "psycho"}, {}))
        self.assertIsNone(nuit.refus({"style": "psycho", "hashtags": []}, env))
        p = {"style": "ayati", "recitation": "libre", "hashtags": ["#alqasas"], "segments": [{"type": "verset", "ref": "28:7"}]}
        self.assertIn("récitation libre", nuit.refus(p, env, cache=Path(TMP)))
        self.assertIn("non libre", nuit.refus({"style": "ayati"}, env))


class Battement(unittest.TestCase):
    def test_mots_forts(self):
        mots = [{"texte": "Pharaon"}, {"texte": "égorger"}, {"texte": "les"}]
        marquer_forts(mots, ["égorger", "Pharaon,"])
        self.assertEqual([m.get("fort", False) for m in mots], [True, True, False])


if __name__ == "__main__":
    unittest.main()


class CompilerLong(unittest.TestCase):
    def test_long_sans_cta_au_milieu(self):
        import compiler_long
        r = json.loads((Path(__file__).resolve().parent.parent / "projets/longs/psycho-long-12-pieges.recette.json").read_text(encoding="utf-8"))
        p = compiler_long.compiler(r)
        self.assertEqual(p["format"], "long")
        ctas = [i for i, s in enumerate(p["segments"]) if s.get("scene") == "cta"]
        self.assertEqual(ctas, [len(p["segments"]) - 1])          # un seul appel à s'abonner, à la fin
        self.assertEqual(len(p["chapitres"]), len(r["episodes"]) + 2)
        self.assertTrue(p["sources"])

    def test_recitateur_impose(self):
        import compiler_long
        r = json.loads((Path(__file__).resolve().parent.parent / "projets/longs/ayati-long-moussa-complet.recette.json").read_text(encoding="utf-8"))
        p = compiler_long.compiler(r)
        self.assertNotIn("recitateur", p)
        self.assertEqual(p["recitation"], "libre")
        self.assertTrue(all(s["ref"].startswith("28:") for s in p["segments"] if s["type"] == "verset"))
