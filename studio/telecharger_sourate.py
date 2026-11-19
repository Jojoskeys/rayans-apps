"""Télécharge la récitation libre de droits (CC0, Atcovi, Wikimedia Commons) d'une ou plusieurs sourates.

    python telecharger_sourate.py 18 12 37

→ cache/libre/cc0-sourate-<n>.mp3 (vérifie la licence CC0 et l'auteur avant d'enregistrer).
Ensuite : python reperer_versets.py cache/libre/cc0-sourate-<n>.mp3 <ref>…
"""
import re
import sys
from pathlib import Path

import requests

API = "https://commons.wikimedia.org/w/api.php"
ENTETE = {"User-Agent": "RayansStudio/1.0 (usage personnel, non commercial) python-requests"}
LIBRE = Path(__file__).resolve().parent / "cache" / "libre"


def trouver(n: int):
    r = requests.get(API, headers=ENTETE, timeout=30, params={
        "action": "query", "list": "search", "srnamespace": 6, "srlimit": 20, "format": "json",
        "srsearch": f'"Chapter {n}" Murattal "Recitation of the Holy Qur\'an"'}).json()
    titres = [x["title"] for x in r["query"]["search"] if re.match(rf"File:Chapter {n}[,.] ", x["title"])]
    titres.sort(key=lambda t: (not t.endswith(".mp3"), " v2 " not in t))  # mp3 d'abord, puis la v2 si elle existe
    return titres


def main():
    LIBRE.mkdir(parents=True, exist_ok=True)
    for n in map(int, sys.argv[1:]):
        sortie = LIBRE / f"cc0-sourate-{n}.mp3"
        if sortie.exists():
            print(f"{n} : déjà là ({sortie.name})")
            continue
        for titre in trouver(n):
            p = requests.get(API, headers=ENTETE, timeout=30, params={
                "action": "query", "titles": titre, "prop": "imageinfo", "format": "json",
                "iiprop": "url|user|size|extmetadata"}).json()
            info = next(iter(p["query"]["pages"].values()))["imageinfo"][0]
            licence = info["extmetadata"].get("LicenseShortName", {}).get("value", "")
            if info["user"] != "Atcovi" or licence != "CC0":
                print(f"{n} : {titre} ignoré ({info['user']}, {licence})")
                continue
            brut = LIBRE / f"cc0-sourate-{n}{Path(info['url']).suffix}"
            import time
            for essai in range(12):  # Wikimedia renvoie 429 si l'on va trop vite : on attend ce qu'il demande, puis on réessaie
                with requests.get(info["url"], headers=ENTETE, stream=True, timeout=120) as r:
                    if r.status_code == 429:
                        attente = max(int(r.headers.get("retry-after", "120")), 120) + 60 * essai
                        print(f"{n} : Wikimedia demande d'attendre ({attente} s)", flush=True)
                        time.sleep(attente)
                        continue
                    r.raise_for_status()
                    with open(brut, "wb") as fic:
                        for bloc in r.iter_content(1 << 20):
                            fic.write(bloc)
                    break
            else:
                raise SystemExit(f"{n} : Wikimedia refuse encore (trop de demandes), réessayer plus tard")
            time.sleep(5)
            if brut.suffix != ".mp3":
                import subprocess
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(brut), "-b:a", "192k", str(sortie)], check=True)
                brut.unlink()
            print(f"{n} : {titre} ({info['size'] // 1_000_000} Mo, {licence}, {info['user']}) → {sortie.name}")
            break
        else:
            print(f"{n} : aucune récitation CC0 d'Atcovi trouvée")


if __name__ == "__main__":
    main()
