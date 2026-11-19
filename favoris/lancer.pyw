"""Rayan's Favoris en appli de bureau : ouvre la page de tri dans sa propre fenêtre (Edge en mode appli).

Le serveur local (127.0.0.1 seulement) démarre avec la fenêtre et s'arrête quand on la ferme.
Si l'appli est déjà ouverte, une nouvelle fenêtre s'ouvre simplement sur le même serveur.
Le raccourci du menu Démarrer se crée avec : python installer.py
"""
from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys
import threading
import webbrowser
from http.server import ThreadingHTTPServer
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))

import favoris  # noqa: E402

ADRESSE = f"http://127.0.0.1:{favoris.PORT}"


def deja_ouverte() -> bool:
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", favoris.PORT)) == 0


def edge() -> str | None:
    for base in (os.environ.get("ProgramFiles(x86)"), os.environ.get("ProgramFiles"), os.environ.get("LOCALAPPDATA")):
        if base and (p := Path(base) / "Microsoft" / "Edge" / "Application" / "msedge.exe").exists():
            return str(p)
    return shutil.which("msedge")


def ouvrir_fenetre(attendre: bool) -> None:
    navigateur = edge()
    if not navigateur:  # pas d'Edge : le navigateur par défaut, et le serveur reste ouvert
        webbrowser.open(ADRESSE)
        if attendre:
            threading.Event().wait()
        return
    profil = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "Rayan's Favoris" / "fenetre"
    profil.mkdir(parents=True, exist_ok=True)
    p = subprocess.Popen([navigateur, f"--app={ADRESSE}", f"--user-data-dir={profil}",
                          "--window-size=1100,900", "--no-first-run", "--no-default-browser-check"])
    if attendre:
        p.wait()  # la fenêtre fermée, on arrête le serveur


def main() -> None:
    if deja_ouverte():
        ouvrir_fenetre(attendre=False)
        return
    favoris._env()
    serveur = ThreadingHTTPServer(("127.0.0.1", favoris.PORT), favoris.Page)
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    try:
        ouvrir_fenetre(attendre=True)
    finally:
        serveur.shutdown()


if __name__ == "__main__":
    main()
