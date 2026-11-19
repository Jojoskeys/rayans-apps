import json
import os
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from stock import Stock, reconnaitre  # noqa: E402
from importer import importer  # noqa: E402
import favoris  # noqa: E402


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["FAVORIS_DOSSIER"] = self.tmp.name + "/donnees"
        self.stock = Stock()

    def tearDown(self):
        self.tmp.cleanup()


class Liens(unittest.TestCase):
    def test_reconnaitre(self):
        self.assertEqual(reconnaitre("https://www.tiktok.com/@chef.x/video/7301?is_from=1")[:2], ("tiktok", "7301"))
        self.assertEqual(reconnaitre("https://www.tiktokv.com/share/video/7302/")[:2], ("tiktok", "7302"))
        self.assertEqual(reconnaitre("https://vm.tiktok.com/ZMabc12/")[0], "tiktok")
        self.assertEqual(reconnaitre("https://www.instagram.com/reel/CxYz_1/?igsh=a"),
                         ("instagram", "CxYz_1", "https://www.instagram.com/reel/CxYz_1/"))
        self.assertEqual(reconnaitre("https://www.instagram.com/compte/p/Abc/")[:2], ("instagram", "Abc"))
        self.assertIsNone(reconnaitre("https://www.instagram.com/compte/"))
        self.assertIsNone(reconnaitre("https://exemple.com/video/1"))


class Import(Base):
    def test_tiktok_seulement_les_favoris(self):
        export = {"Activity": {
            "Favorite Videos": {"FavoriteVideoList": [{"Date": "2026-01-01", "Link": "https://www.tiktokv.com/share/video/111/"}]},
            "Like List": {"ItemFavoriteList": [{"Link": "https://www.tiktokv.com/share/video/222/"}]},
            "Video Browsing History": {"VideoList": [{"Link": "https://www.tiktokv.com/share/video/333/"}]},
        }}
        d = Path(self.tmp.name) / "tiktok"
        d.mkdir()
        (d / "user_data_tiktok.json").write_text(json.dumps(export), "utf-8")
        b = importer(d, self.stock)
        self.assertEqual(b["tiktok"], 1)
        self.assertEqual(list(self.stock.videos), ["tiktok-111"])

    def test_instagram_zip_avec_collections_et_doublons(self):
        posts = {"saved_saved_media": [
            {"title": "chef", "string_map_data": {"Saved on": {"href": "https://www.instagram.com/reel/AAA/", "timestamp": 1700000000}}},
        ]}
        collections = {"saved_saved_collections": [
            {"title": "Collection", "string_map_data": {"Name": {"value": "Recettes"}}},
            {"string_map_data": {"Name": {"href": "https://www.instagram.com/reel/AAA/", "value": "chef"}, "Added Time": {"timestamp": 1}}},
            {"string_map_data": {"Name": {"href": "https://www.instagram.com/p/BBB/", "value": "x"}}},
            {"title": "Collection", "string_map_data": {"Name": {"value": "Pour Claude"}}},
            {"string_map_data": {"Name": {"href": "https://www.instagram.com/reel/CCC/", "value": "y"}}},
        ]}
        z = Path(self.tmp.name) / "insta.zip"
        with zipfile.ZipFile(z, "w") as f:
            f.writestr("your_instagram_activity/saved/saved_posts.json", json.dumps(posts))
            f.writestr("your_instagram_activity/saved/saved_collections.json", json.dumps(collections))
            f.writestr("your_instagram_activity/likes/liked_posts.json", json.dumps({"x": "https://www.instagram.com/p/ZZZ/"}))
        b = importer(z, self.stock)
        self.assertEqual(set(self.stock.videos), {"instagram-AAA", "instagram-BBB", "instagram-CCC"})
        self.assertEqual(self.stock.videos["instagram-AAA"]["collection"], "Recettes")
        self.assertEqual(self.stock.videos["instagram-CCC"]["collection"], "Pour Claude")
        self.assertEqual(self.stock.videos["instagram-AAA"]["enregistre_le"], 1700000000)
        self.assertEqual(b["instagram"], 3)
        self.assertGreaterEqual(b["deja_la"], 1)
        # Relancer l'import n'ajoute rien.
        self.assertEqual(importer(z, Stock())["instagram"], 0)


class Fiches(Base):
    def fiche(self, **f):
        p = Path(self.tmp.name) / "fiche.json"
        p.write_text(json.dumps(f), "utf-8")
        return p

    def complete(self, **autre):
        base = {"id": "tiktok-1", "categorie": "utile", "resume": "r", "pour_rayan": "u", "faisable": "oui", "prompt": "p", "pourquoi": "x",
                "securite": {"verdict": "sur", "verification_1": "a", "verification_2": "b", "alertes": []},
                "reflexion": {"pour": [], "contre": [], "avis": "bien"}}
        base.update(autre)
        return base

    def setUp(self):
        super().setUp()
        self.stock.ajouter_lien("https://www.tiktok.com/@_/video/1", "test")
        self.stock.enregistrer()

    def test_deux_verifications_obligatoires(self):
        f = self.complete()
        f["securite"]["verification_2"] = ""
        with self.assertRaises(SystemExit) as e:
            favoris.enregistrer_fiche(self.stock, self.fiche(**f))
        self.assertIn("verification_2", str(e.exception))

    def test_fiche_complete_puis_drole_ignoree(self):
        self.assertEqual(favoris.enregistrer_fiche(self.stock, self.fiche(**self.complete())), "analysee")
        self.assertEqual(Stock().videos["tiktok-1"]["etat"], "analysee")
        self.assertEqual(favoris.enregistrer_fiche(self.stock, self.fiche(id="tiktok-1", categorie="drole", resume="chat", pour_rayan="rien")), "ignoree")

    def test_lot_garde_les_bonnes_et_rend_les_refus(self):
        p = Path(self.tmp.name) / "lot.json"
        p.write_text(json.dumps([self.complete(), {"id": "inconnu", "categorie": "utile"}]), "utf-8")
        refus = favoris.enregistrer_lot(self.stock, p)
        self.assertEqual(len(refus), 1)
        self.assertTrue(refus[0].startswith("inconnu"))
        self.assertEqual(Stock().videos["tiktok-1"]["etat"], "analysee")

    def test_pour_rayan_obligatoire(self):
        f = self.complete()
        del f["pour_rayan"]
        with self.assertRaises(SystemExit) as e:
            favoris.enregistrer_fiche(self.stock, self.fiche(**f))
        self.assertIn("pour_rayan", str(e.exception))

    def test_inspiration_vers_le_studio(self):
        os.environ["STUDIO_RACINE"] = self.tmp.name + "/studio"
        try:
            insp = {"compte": "compte-b", "a_marche": True, "pourquoi": "accroche forte", "idee": "Le biais de confirmation en 30 s"}
            f = self.complete(categorie="psychologie", inspiration=insp)
            favoris.enregistrer_fiche(self.stock, self.fiche(**f))
            favoris.enregistrer_fiche(self.stock, self.fiche(**f))  # pas de doublon
            idees = json.loads((Path(self.tmp.name) / "studio" / "idees.json").read_text("utf-8"))
            self.assertEqual(len(idees), 1)
            self.assertEqual(idees[0]["compte"], "compte-b")
            self.assertEqual(idees[0]["statut"], "nouvelle")
            self.assertIn("biais de confirmation", idees[0]["texte"])
            notes = (Path(self.tmp.name) / "studio" / "inspirations.md").read_text("utf-8")
            self.assertEqual(notes.count("accroche forte"), 1)
            # Une vidéo qui n'a pas marché ne donne pas d'idée.
            self.stock.ajouter_lien("https://www.tiktok.com/@_/video/2", "test")
            f2 = self.complete(id="tiktok-2", categorie="religion", inspiration={**insp, "a_marche": False, "idee": "autre"})
            favoris.enregistrer_fiche(self.stock, self.fiche(**f2))
            self.assertEqual(len(json.loads((Path(self.tmp.name) / "studio" / "idees.json").read_text("utf-8"))), 1)
        finally:
            del os.environ["STUDIO_RACINE"]

    def test_recette_rangee(self):
        f = self.complete(categorie="recette", recette={"titre": "Crêpes", "ingredients": ["farine"], "etapes": ["mélanger"]})
        favoris.enregistrer_fiche(self.stock, self.fiche(**f))
        favoris.enregistrer_fiche(self.stock, self.fiche(**f))  # pas de doublon
        texte = (self.stock.dossier / "recettes.md").read_text("utf-8")
        self.assertEqual(texte.count("## Crêpes"), 1)
        self.assertIn("- farine", texte)


class DeuxProgrammes(Base):
    def test_ni_l_un_ni_l_autre_n_ecrase(self):
        self.stock.ajouter_lien("https://www.tiktok.com/@_/video/1", "test")
        self.stock.ajouter_lien("https://www.tiktok.com/@_/video/2", "test")
        self.stock.enregistrer()
        telechargement, analyse = Stock(), Stock()  # chargés au même moment
        telechargement.changer("tiktok-2", etat="a_analyser")
        analyse.changer("tiktok-1", etat="analysee")
        analyse.enregistrer()
        telechargement.enregistrer()  # écrit après, avec une liste chargée avant l'analyse
        relu = Stock().videos
        self.assertEqual(relu["tiktok-1"]["etat"], "analysee")
        self.assertEqual(relu["tiktok-2"]["etat"], "a_analyser")
        self.assertEqual(telechargement.videos["tiktok-1"]["etat"], "analysee")  # mis à jour en mémoire aussi


class Freins(Base):
    def test_meme_video_reessayee_puis_arret(self):
        import recuperer
        from unittest import mock
        self.stock.ajouter_lien("https://www.tiktok.com/@_/video/1", "test")
        self.stock.ajouter_lien("https://www.tiktok.com/@_/video/2", "test")
        appels = []

        def faux(stock, v):
            appels.append(v["id"])
            if len(appels) == 1:
                raise Exception("ERROR: HTTP Error 403: Forbidden")  # refus isolé : passe au 2e essai
            if v["id"] == "tiktok-2":
                raise Exception("ERROR: [TikTok] 2: Unexpected response from webpage request")
            stock.changer(v["id"], etat="a_analyser")

        with mock.patch.object(recuperer, "recuperer_une", faux), mock.patch("time.sleep"):
            b = recuperer.recuperer(self.stock, afficher=lambda m: None)
        self.assertEqual(appels[:2], ["tiktok-1", "tiktok-1"])
        self.assertEqual(appels[2:], ["tiktok-2"] * 4)  # toujours bloqué : 4 essais puis arrêt
        self.assertEqual(b["ok"], 1)
        self.assertEqual(b["freine"], 1)
        self.assertEqual(self.stock.videos["tiktok-2"]["etat"], "a_recuperer")  # pas marquée en erreur


class Depots(Base):
    def test_lien_iphone_et_video(self):
        from recuperer import lire_depots
        depot = self.stock.dossier / "a-deposer"
        (depot / "x.json").write_text(json.dumps({"lien": "https://www.instagram.com/reel/QQQ/", "note": "pour toi"}), "utf-8")
        (depot / "v.mp4").write_bytes(b"0")
        (depot / "v.mp4.note.txt").write_text("regarde", "utf-8")
        (depot / "en-cours.mp4.partiel").write_bytes(b"0")
        self.assertEqual(lire_depots(self.stock), 2)
        self.assertEqual(self.stock.videos["instagram-QQQ"]["note"], "pour toi")
        fichiers = [v for v in self.stock.videos.values() if v["plateforme"] == "fichier"]
        self.assertEqual(fichiers[0]["note"], "regarde")
        self.assertTrue((depot / "en-cours.mp4.partiel").exists())


if __name__ == "__main__":
    unittest.main()
