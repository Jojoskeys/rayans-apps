"""Le stock de Rayan's Favoris : la liste des vidéos et l'endroit où tout est rangé.

Tout est rangé hors du dépôt, dans <Documents>\\Rayan's Favoris (ou le dossier de FAVORIS_DOSSIER) :
  favoris.json      la liste des vidéos et leur état
  a-deposer\\        vidéos ou liens déposés à la main (ou envoyés par l'iPhone), lus au prochain passage
  videos\\           les vidéos téléchargées
  textes\\           transcription + légende de chaque vidéo (<id>.txt)
  images\\           quelques images de chaque vidéo (<id>_1.jpg…) pour ce qui est écrit à l'écran
  fiches\\           l'analyse de Claude pour chaque vidéo (<id>.json)
  recettes.md       les recettes, rassemblées au même endroit

États d'une vidéo, dans l'ordre :
  a_recuperer  -> a_analyser  -> analysee -> validee -> appliquee
                                         \\-> refusee
  ignoree (drôle, sans intérêt pratique)    erreur (téléchargement impossible, voir « erreur »)
"""
from __future__ import annotations

import ctypes
import json
import os
import re
import time
from pathlib import Path

ETATS = ("a_recuperer", "a_analyser", "analysee", "validee", "refusee", "appliquee", "ignoree", "erreur")


def dossier_documents() -> Path:
    """Le vrai dossier Documents de Windows (même s'il est déplacé dans OneDrive)."""
    if os.name == "nt":
        tampon = ctypes.create_unicode_buffer(260)
        if ctypes.windll.shell32.SHGetFolderPathW(None, 5, None, 0, tampon) == 0:  # 5 = Mes documents
            return Path(tampon.value)
    return Path.home() / "Documents"


def racine() -> Path:
    r = Path(os.environ.get("FAVORIS_DOSSIER") or dossier_documents() / "Rayan's Favoris")
    for sous in ("a-deposer", "videos", "textes", "images", "fiches"):
        (r / sous).mkdir(parents=True, exist_ok=True)
    return r


# ----- Reconnaître un lien -------------------------------------------------------------------------

_TIKTOK = [
    re.compile(r"tiktok\.com/@[\w.\-]*/(?:video|photo)/(\d+)", re.I),
    re.compile(r"tiktokv?\.com/share/video/(\d+)", re.I),
    re.compile(r"tiktok\.com/(?:embed(?:/v2)?|v)/(\d+)", re.I),
]
_TIKTOK_COURT = re.compile(r"https?://(?:vm|vt)\.tiktok\.com/[\w]+/?", re.I)
_INSTA = re.compile(r"instagram\.com/(?:[\w.]+/)?(p|reels?|tv)/([\w\-]+)", re.I)


def reconnaitre(lien: str) -> tuple[str, str, str] | None:
    """(plateforme, identifiant, lien propre) pour un lien TikTok ou Instagram, sinon None."""
    lien = lien.strip()
    for m in _TIKTOK:
        if t := m.search(lien):
            return "tiktok", t.group(1), f"https://www.tiktok.com/@_/video/{t.group(1)}"
    if t := _TIKTOK_COURT.match(lien):
        # Lien court partagé depuis l'appli : l'identifiant n'est connu qu'après redirection.
        code = t.group(0).rstrip("/").rsplit("/", 1)[-1]
        return "tiktok", "court-" + code, t.group(0)
    if t := _INSTA.search(lien):
        genre = "reel" if t.group(1).lower().startswith("reel") else t.group(1).lower()
        return "instagram", t.group(2), f"https://www.instagram.com/{genre}/{t.group(2)}/"
    return None


# ----- La liste -------------------------------------------------------------------------------------

class Stock:
    def __init__(self, dossier: Path | None = None):
        self.dossier = dossier or racine()
        self.fichier = self.dossier / "favoris.json"
        self.videos: dict[str, dict] = {}
        if self.fichier.exists():
            self.videos = {v["id"]: v for v in json.loads(self.fichier.read_text("utf-8"))}

    def enregistrer(self) -> None:
        tmp = self.fichier.with_suffix(".tmp")
        tmp.write_text(json.dumps(list(self.videos.values()), ensure_ascii=False, indent=1), "utf-8")
        tmp.replace(self.fichier)

    def ajouter_lien(self, lien: str, origine: str, collection: str = "", date: int | None = None) -> dict | None:
        """Ajoute un lien s'il est nouveau. Rend la vidéo ajoutée, ou None (doublon ou lien inconnu)."""
        r = reconnaitre(lien)
        if not r:
            return None
        plateforme, ident, propre = r
        cle = f"{plateforme}-{ident}"
        if cle in self.videos:
            v = self.videos[cle]
            if collection and not v.get("collection"):
                v["collection"] = collection
            return None
        v = {"id": cle, "plateforme": plateforme, "lien": propre, "origine": origine, "collection": collection,
             "enregistre_le": date, "ajoute_le": int(time.time()), "etat": "a_recuperer"}
        self.videos[cle] = v
        return v

    def ajouter_fichier(self, chemin: Path, origine: str = "fichier") -> dict:
        """Une vidéo déjà sur le PC : rien à télécharger."""
        cle = "fichier-" + re.sub(r"[^\w\-]+", "_", chemin.stem)[:60] + "-" + str(int(chemin.stat().st_mtime))
        v = self.videos.get(cle) or {"id": cle, "plateforme": "fichier", "lien": "", "origine": origine,
                                     "collection": "", "enregistre_le": None, "ajoute_le": int(time.time()),
                                     "etat": "a_recuperer", "fichier": str(chemin)}
        self.videos[cle] = v
        return v

    def changer(self, cle: str, **champs) -> dict:
        v = self.videos[cle]
        if "etat" in champs and champs["etat"] not in ETATS:
            raise ValueError(f"état inconnu : {champs['etat']}")
        v.update(champs)
        v["modifie_le"] = int(time.time())
        return v

    def par_etat(self, *etats: str) -> list[dict]:
        return [v for v in self.videos.values() if v["etat"] in etats]

    def fiche(self, cle: str) -> dict | None:
        f = self.dossier / "fiches" / f"{cle}.json"
        return json.loads(f.read_text("utf-8")) if f.exists() else None
