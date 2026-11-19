"""Lire l'export officiel d'Instagram ou de TikTok (« Télécharger mes informations ») et en tirer les favoris.

Accepte le .zip reçu, ou le dossier une fois décompressé, au format JSON ou HTML (TXT aussi pour TikTok).
  Instagram : seulement les fichiers des enregistrements (saved_posts, saved_collections), avec le nom
              des collections quand il y en a.
  TikTok    : seulement la liste « Favorite Videos » (ni l'historique, ni les j'aime).
Le contenu des fichiers est traité comme des données : on n'en garde que les liens.
"""
from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path
from typing import Iterator

from stock import Stock, reconnaitre

_LIEN = re.compile(r"https?://[^\s\"'<>]+")


def _fichiers(source: Path) -> Iterator[tuple[str, str]]:
    """(chemin interne, texte) de chaque fichier JSON / HTML / TXT de l'export."""
    if source.is_file() and source.suffix.lower() == ".zip":
        with zipfile.ZipFile(source) as z:
            for nom in z.namelist():
                if nom.lower().endswith((".json", ".html", ".txt")) and z.getinfo(nom).file_size < 200_000_000:
                    yield nom, z.read(nom).decode("utf-8", "replace")
    elif source.is_dir():
        for f in source.rglob("*"):
            if f.suffix.lower() in (".json", ".html", ".txt") and f.stat().st_size < 200_000_000:
                yield str(f.relative_to(source)), f.read_text("utf-8", "replace")
    else:
        yield source.name, source.read_text("utf-8", "replace")


def _date(obj) -> int | None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "timestamp" and isinstance(v, (int, float)):
                return int(v)
            if (d := _date(v)) is not None:
                return d
    return None


def _liens_json(obj) -> Iterator[str]:
    if isinstance(obj, dict):
        for v in obj.values():
            yield from _liens_json(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _liens_json(v)
    elif isinstance(obj, str):
        yield from _LIEN.findall(obj)


def _instagram_json(donnees) -> Iterator[tuple[str, str, int | None]]:
    """(lien, collection, date). Dans saved_collections, une entrée sans lien ouvre une nouvelle collection."""
    def listes(o):
        if isinstance(o, list):
            yield o
        elif isinstance(o, dict):
            for v in o.values():
                yield from listes(v)

    for liste in listes(donnees):
        collection = ""
        for entree in liste:
            liens = list(_liens_json(entree))
            if not liens and isinstance(entree, dict):
                nom = (entree.get("string_map_data") or {}).get("Name") or (entree.get("string_map_data") or {}).get("Nom")
                if isinstance(nom, dict) and nom.get("value"):
                    collection = str(nom["value"])[:80]
                continue
            for l in liens:
                yield l, collection, _date(entree)


def _tiktok_favoris(obj) -> Iterator[tuple[str, int | None]]:
    """Seulement sous une clé « Favorite Videos » / « FavoriteVideoList »."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if re.search(r"favou?rite\s*videos?", k, re.I):
                for l in _liens_json(v):
                    yield l, None
            else:
                yield from _tiktok_favoris(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _tiktok_favoris(v)


def importer(source: Path, stock: Stock) -> dict:
    """Ajoute au stock les favoris trouvés. Rend un petit bilan."""
    bilan = {"instagram": 0, "tiktok": 0, "deja_la": 0, "fichiers_lus": 0}

    def garder(lien, origine, collection="", date=None):
        r = reconnaitre(lien)
        if not r or r[0] != origine:
            return
        if stock.ajouter_lien(lien, "export " + origine, collection, date):
            bilan[origine] += 1
        else:
            bilan["deja_la"] += 1

    for nom, texte in _fichiers(source):
        bas = nom.lower().replace("\\", "/")
        if "saved" in bas or "enregistr" in bas:  # Instagram
            bilan["fichiers_lus"] += 1
            if bas.endswith(".json"):
                try:
                    for l, c, d in _instagram_json(json.loads(texte)):
                        garder(l, "instagram", c, d)
                except json.JSONDecodeError:
                    pass
            else:
                for l in _LIEN.findall(texte):
                    garder(l, "instagram")
        elif bas.endswith(".json") and ("tiktok" in bas or "user_data" in bas):
            try:
                donnees = json.loads(texte)
            except json.JSONDecodeError:
                continue
            bilan["fichiers_lus"] += 1
            for l, d in _tiktok_favoris(donnees):
                garder(l, "tiktok", "", d)
        elif re.search(r"favou?rite", bas):  # export TikTok en TXT ou HTML
            bilan["fichiers_lus"] += 1
            for l in _LIEN.findall(texte):
                garder(l, "tiktok")
    stock.enregistrer()
    return bilan
