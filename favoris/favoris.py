"""Rayan's Favoris : trier les vidéos enregistrées sur Instagram et TikTok, et en tirer ce qui est utile.

  python favoris.py importer <export.zip ou dossier>   les favoris de l'export officiel
  python favoris.py ajouter <lien ou fichier vidéo> [--note "…"]
  python favoris.py recuperer [--limite N]            télécharger + transcrire ce qui attend
  python favoris.py etat                               où en est chaque vidéo (pour Claude)
  python favoris.py fiche <fiche.json>                 enregistrer l'analyse d'une vidéo (Claude)
  python favoris.py marquer <id> <etat> [--note "…"]   ex. appliquee, une fois l'astuce mise en place
  python favoris.py page                               la page de tri sur http://127.0.0.1:8765

L'analyse (catégorie, double vérification de sécurité, réflexion, prompt) est faite par Claude avec la
commande /favoris dans Claude Code. Rien n'est appliqué sans un « Valider » de Rayan sur la page.
"""
from __future__ import annotations

import argparse
import json
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))

from stock import Stock, reconnaitre  # noqa: E402

CATEGORIES = {
    "pour-claude": "Pour Claude",
    "utile": "Astuces utiles",
    "recette": "Recettes",
    "sport": "Sport",
    "religion": "Religion",
    "psychologie": "Psychologie",
    "a-regarder": "À regarder",
    "drole": "Drôle (ignoré)",
}
VERDICTS = ("sur", "prudence", "danger")
PORT = 8765


def _env():
    f = ICI / ".env"
    if f.exists():
        import os
        for ligne in f.read_text("utf-8").splitlines():
            if "=" in ligne and not ligne.lstrip().startswith("#"):
                k, v = ligne.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"'))


# ----- Fiches --------------------------------------------------------------------------------------

def verifier_fiche(f: dict, stock: Stock) -> list[str]:
    """Les manques d'une fiche écrite par Claude (liste vide = bonne)."""
    pb = []
    if f.get("id") not in stock.videos:
        pb.append(f"id inconnu : {f.get('id')}")
    if f.get("categorie") not in CATEGORIES:
        pb.append(f"categorie parmi {list(CATEGORIES)}")
    if not str(f.get("resume", "")).strip():
        pb.append("resume vide")
    if not str(f.get("pour_rayan", "")).strip():
        pb.append("pour_rayan vide : dire à quoi la vidéo peut servir à Rayan (ou « rien », et pourquoi)")
    insp = f.get("inspiration")
    if insp is not None:
        if insp.get("compte") not in ("ayati", "psycho", ""):
            pb.append("inspiration.compte parmi ayati, psycho, \"\"")
        if not isinstance(insp.get("a_marche"), bool):
            pb.append("inspiration.a_marche : true ou false (d'après les chiffres)")
        for k in ("pourquoi", "idee"):
            if not str(insp.get(k, "")).strip():
                pb.append(f"inspiration.{k} vide")
    if f.get("categorie") != "drole":
        s = f.get("securite") or {}
        if s.get("verdict") not in VERDICTS:
            pb.append(f"securite.verdict parmi {VERDICTS}")
        for k in ("verification_1", "verification_2"):
            if not str(s.get(k, "")).strip():
                pb.append(f"securite.{k} vide : les deux vérifications sont obligatoires")
        r = f.get("reflexion") or {}
        if not str(r.get("avis", "")).strip():
            pb.append("reflexion.avis vide")
        if f.get("faisable") not in ("oui", "en-partie", "non"):
            pb.append("faisable parmi oui, en-partie, non")
        if f.get("categorie") in ("pour-claude", "utile") and f.get("faisable") != "non" and not str(f.get("prompt", "")).strip():
            pb.append("prompt vide alors que c'est faisable")
        if f.get("categorie") == "recette" and not (f.get("recette") or {}).get("ingredients"):
            pb.append("recette.ingredients manquant")
    return pb


def ajouter_recette(stock: Stock, f: dict) -> None:
    r, v = f["recette"], stock.videos[f["id"]]
    fichier = stock.dossier / "recettes.md"
    deja = fichier.read_text("utf-8") if fichier.exists() else "# Recettes de Rayan's Favoris\n"
    if f"<!-- {f['id']} -->" in deja:
        return
    bloc = [f"\n## {r.get('titre') or v.get('titre') or 'Recette'}", f"<!-- {f['id']} -->",
            f"Source : {v.get('lien') or v.get('fichier')}" + (f" · {r['portions']}" if r.get("portions") else ""), "",
            "**Ingrédients**", *[f"- {i}" for i in r["ingredients"]], "", "**Étapes**",
            *[f"{n}. {e}" for n, e in enumerate(r.get("etapes") or [], 1)]]
    fichier.write_text(deja.rstrip() + "\n" + "\n".join(bloc) + "\n", "utf-8")


def dossier_studio() -> Path:
    """Le dossier de Rayan's Studio (le même que studio/a_valider.py), dans Vidéos."""
    import os
    if os.environ.get("STUDIO_RACINE"):
        return Path(os.environ["STUDIO_RACINE"])
    videos = Path.home() / "Videos"
    if os.name == "nt":
        import ctypes
        tampon = ctypes.create_unicode_buffer(260)
        if ctypes.windll.shell32.SHGetFolderPathW(None, 14, None, 0, tampon) == 0:  # 14 = Mes vidéos
            videos = Path(tampon.value)
    return videos / "Rayan's Studio"


def inspirer_studio(stock: Stock, f: dict) -> bool:
    """Une vidéo qui a bien marché donne une idée à la boîte à idées du Studio, et sa recette à inspirations.md."""
    insp, v = f.get("inspiration") or {}, stock.videos[f["id"]]
    if not insp.get("a_marche"):
        return False
    racine = dossier_studio()
    racine.mkdir(parents=True, exist_ok=True)
    source = v.get("lien") or v["id"]
    idees_f = racine / "idees.json"
    idees = json.loads(idees_f.read_text("utf-8")) if idees_f.exists() else []
    marque = f"(inspiré de {source})"
    if not any(marque in i.get("texte", "") for i in idees):
        import uuid
        texte = f"{insp['idee'].strip()} {marque}"[:1000]
        idees.insert(0, {"id": str(uuid.uuid4()), "texte": texte, "compte": insp["compte"],
                         "at": int(time.time() * 1000), "statut": "nouvelle"})
        tmp = idees_f.with_suffix(".tmp")
        tmp.write_text(json.dumps(idees, ensure_ascii=False, indent=2), "utf-8")
        tmp.replace(idees_f)
    notes = racine / "inspirations.md"
    deja = notes.read_text("utf-8") if notes.exists() else (
        "# Inspirations (Rayan's Favoris)\n\nCe qui fait marcher les vidéos que Rayan a gardées. "
        "À relire avant d'écrire un script ; s'inspirer de la forme, ne jamais copier le texte.\n")
    if f"<!-- {f['id']} -->" not in deja:
        chiffres = " · ".join(f"{k.replace('_count', '')} {n}" for k, n in (v.get("stats") or {}).items())
        bloc = (f"\n## {insp['compte'] or 'les deux'} — {v.get('titre') or f['resume'][:60]}\n<!-- {f['id']} -->\n"
                f"Source : {source}" + (f" · {chiffres}" if chiffres else "") +
                f"\n\n**Pourquoi ça marche** : {insp['pourquoi'].strip()}\n\n**Idée pour nous** : {insp['idee'].strip()}\n")
        notes.write_text(deja.rstrip() + "\n" + bloc, "utf-8")
    return True


def enregistrer_fiche(stock: Stock, chemin: Path) -> str:
    f = json.loads(chemin.read_text("utf-8"))
    if pb := verifier_fiche(f, stock):
        raise SystemExit("Fiche refusée :\n  - " + "\n  - ".join(pb))
    f["analyse_le"] = int(time.time())
    (stock.dossier / "fiches" / f"{f['id']}.json").write_text(json.dumps(f, ensure_ascii=False, indent=1), "utf-8")
    etat = "ignoree" if f["categorie"] == "drole" else "analysee"
    stock.changer(f["id"], etat=etat, categorie=f["categorie"])
    if f["categorie"] == "recette":
        ajouter_recette(stock, f)
    if inspirer_studio(stock, f):
        stock.changer(f["id"], inspire_studio=True)
    stock.enregistrer()
    return etat


# ----- Page de tri ---------------------------------------------------------------------------------

class Page(BaseHTTPRequestHandler):
    stock_lock = threading.Lock()
    travail = {"en_cours": False, "message": ""}

    def log_message(self, *a):
        pass

    def _local(self) -> bool:
        # La page n'écoute que sur 127.0.0.1 ; on refuse aussi les sites qui tenteraient d'y écrire.
        hote = (self.headers.get("Host") or "").split(":")[0]
        origine = self.headers.get("Origin")
        return hote in ("127.0.0.1", "localhost") and (origine is None or origine in (f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}"))

    def _json(self, code: int, corps) -> None:
        b = json.dumps(corps, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if not self._local():
            return self._json(403, {"erreur": "accès refusé"})
        stock = Stock()
        if self.path == "/":
            b = (ICI / "page.html").read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)
        elif self.path == "/api/liste":
            videos = []
            for v in sorted(stock.videos.values(), key=lambda x: -(x.get("modifie_le") or x["ajoute_le"])):
                videos.append({**v, "fiche": stock.fiche(v["id"])})
            self._json(200, {"videos": videos, "categories": CATEGORIES, "travail": self.travail})
        elif self.path.startswith("/images/"):
            nom = Path(self.path[len("/images/"):]).name
            f = stock.dossier / "images" / nom
            if not f.exists() or f.suffix != ".jpg":
                return self._json(404, {"erreur": "image introuvable"})
            b = f.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)
        else:
            self._json(404, {"erreur": "inconnu"})

    def do_POST(self):
        if not self._local():
            return self._json(403, {"erreur": "accès refusé"})
        n = int(self.headers.get("Content-Length") or 0)
        if self.path == "/api/deposer":  # une vidéo glissée sur la page
            if n > 500_000_000:
                return self._json(413, {"erreur": "vidéo trop lourde (500 Mo au plus)"})
            from urllib.parse import unquote
            nom = Path(unquote(self.headers.get("X-Nom") or "video.mp4")).name
            if Path(nom).suffix.lower() not in (".mp4", ".mov", ".m4v", ".webm", ".mkv"):
                return self._json(400, {"erreur": "seulement des vidéos (mp4, mov, webm, mkv)"})
            dest = Stock().dossier / "a-deposer" / nom
            with open(dest.with_suffix(dest.suffix + ".partiel"), "wb") as sortie:
                reste = n
                while reste > 0:
                    morceau = self.rfile.read(min(reste, 1 << 20))
                    if not morceau:
                        break
                    sortie.write(morceau)
                    reste -= len(morceau)
            dest.with_suffix(dest.suffix + ".partiel").replace(dest)
            return self._json(200, {"ok": True, "message": f"{nom} déposée, elle sera transcrite au prochain passage."})
        corps = json.loads(self.rfile.read(n) or b"{}")
        with self.stock_lock:
            stock = Stock()
            if self.path == "/api/ajouter":
                lien = str(corps.get("lien", ""))
                if not reconnaitre(lien):
                    return self._json(400, {"erreur": "ce n'est pas un lien TikTok ou Instagram"})
                v = stock.ajouter_lien(lien, "lien collé")
                if v and corps.get("note"):
                    v["note"] = str(corps["note"])[:500]
                stock.enregistrer()
                return self._json(200, {"ok": True, "message": "Ajoutée." if v else "Déjà dans la liste."})
            if self.path == "/api/decider":  # Valider / Refuser / remettre en attente
                cle, choix = str(corps.get("id")), str(corps.get("choix"))
                if cle not in stock.videos or choix not in ("validee", "refusee", "analysee"):
                    return self._json(400, {"erreur": "demande invalide"})
                fiche = stock.fiche(cle) or {}
                if choix == "validee" and (fiche.get("securite") or {}).get("verdict") == "danger":
                    return self._json(400, {"erreur": "vidéo jugée dangereuse : elle ne peut pas être validée"})
                stock.changer(cle, etat=choix, note_rayan=str(corps.get("note", ""))[:500])
                stock.enregistrer()
                return self._json(200, {"ok": True})
            if self.path == "/api/recuperer":
                if not self.travail["en_cours"]:
                    threading.Thread(target=self._recuperer, daemon=True).start()
                return self._json(200, {"ok": True})
        self._json(404, {"erreur": "inconnu"})

    @classmethod
    def _recuperer(cls):
        from recuperer import lire_depots, recuperer
        cls.travail.update(en_cours=True, message="Lecture des dépôts…")
        try:
            with cls.stock_lock:
                stock = Stock()
                lire_depots(stock)
            b = recuperer(stock, afficher=lambda m: cls.travail.update(message=m))
            cls.travail["message"] = f"Terminé : {b['ok']} prête(s) pour l'analyse, {b['erreur']} impossible(s)."
        except Exception as e:
            cls.travail["message"] = f"Erreur : {e}"
        finally:
            cls.travail["en_cours"] = False


# ----- Commandes -----------------------------------------------------------------------------------

def main(argv=None) -> None:
    _env()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(prog="favoris", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    s = p.add_subparsers(dest="cmd", required=True)
    s.add_parser("importer").add_argument("source", type=Path)
    a = s.add_parser("ajouter")
    a.add_argument("quoi")
    a.add_argument("--note", default="")
    s.add_parser("recuperer").add_argument("--limite", type=int)
    s.add_parser("etat")
    s.add_parser("fiche").add_argument("chemin", type=Path)
    m = s.add_parser("marquer")
    m.add_argument("id")
    m.add_argument("etat")
    m.add_argument("--note", default="")
    s.add_parser("page")
    args = p.parse_args(argv)
    stock = Stock()

    if args.cmd == "importer":
        from importer import importer
        b = importer(args.source, stock)
        print(f"{b['instagram']} favori(s) Instagram et {b['tiktok']} favori(s) TikTok ajoutés "
              f"({b['deja_la']} déjà là, {b['fichiers_lus']} fichier(s) lus).")
    elif args.cmd == "ajouter":
        chemin = Path(args.quoi)
        if chemin.is_file():
            v = stock.ajouter_fichier(chemin.resolve())
        else:
            v = stock.ajouter_lien(args.quoi, "commande")
            if v is None and not reconnaitre(args.quoi):
                raise SystemExit("Ni un fichier, ni un lien TikTok ou Instagram.")
        if v and args.note:
            v["note"] = args.note
        stock.enregistrer()
        print("Ajoutée :", v["id"] if v else "déjà dans la liste")
    elif args.cmd == "recuperer":
        from recuperer import lire_depots, recuperer
        print(f"{lire_depots(stock)} nouveauté(s) dans a-deposer.")
        b = recuperer(stock, args.limite)
        print(f"{b['ok']} prête(s) pour l'analyse, {b['erreur']} impossible(s).")
    elif args.cmd == "etat":
        compte: dict[str, int] = {}
        for v in stock.videos.values():
            compte[v["etat"]] = compte.get(v["etat"], 0) + 1
        print("Dossier :", stock.dossier)
        print("États :", ", ".join(f"{k} {n}" for k, n in sorted(compte.items())) or "aucune vidéo")
        for etat, titre in (("a_analyser", "À analyser"), ("validee", "Validées par Rayan, à appliquer")):
            liste = stock.par_etat(etat)
            if liste:
                print(f"\n{titre} :")
                for v in liste:
                    extra = f" — note de Rayan : {v['note_rayan']}" if v.get("note_rayan") else ""
                    extra += f" — note à l'envoi : {v['note']}" if v.get("note") else ""
                    print(f"  {v['id']}  textes/{v['id']}.txt{extra}")
    elif args.cmd == "fiche":
        print("Fiche enregistrée, état :", enregistrer_fiche(stock, args.chemin))
    elif args.cmd == "marquer":
        if args.id not in stock.videos:
            raise SystemExit(f"id inconnu : {args.id}")
        stock.changer(args.id, etat=args.etat, note_claude=args.note)
        stock.enregistrer()
        print(f"{args.id} -> {args.etat}")
    elif args.cmd == "page":
        print(f"Rayan's Favoris : http://127.0.0.1:{PORT}  (Ctrl+C pour arrêter)")
        ThreadingHTTPServer(("127.0.0.1", PORT), Page).serve_forever()


if __name__ == "__main__":
    main()
