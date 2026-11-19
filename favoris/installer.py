"""Installe Rayan's Favoris sur le PC : icône, raccourci « Rayans Favoris » dans le menu Démarrer.

  python installer.py            crée (ou met à jour) le raccourci
  python installer.py --retirer  l'enlève
Rien d'autre n'est modifié : pas de registre, pas de démarrage automatique.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
ICONE = ICI / "icone.ico"
ROSE, FOND = (232, 161, 184), (32, 26, 29)  # thème Sakura


def dessiner_icone(chemin: Path = ICONE) -> Path:
    """Une étoile rose sur un carré sombre arrondi (dessinée une fois, gardée dans le dépôt)."""
    import math
    from PIL import Image, ImageDraw
    taille = 256
    img = Image.new("RGBA", (taille, taille), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((8, 8, taille - 8, taille - 8), radius=56, fill=FOND)
    cx, cy, r1, r2 = taille / 2, taille / 2 + 6, 92, 38
    points = [(cx + (r1 if i % 2 == 0 else r2) * math.sin(math.pi * i / 5),
               cy - (r1 if i % 2 == 0 else r2) * math.cos(math.pi * i / 5)) for i in range(10)]
    d.polygon(points, fill=ROSE)
    img.save(chemin, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    return chemin


def raccourci() -> Path:
    return Path(os.environ["APPDATA"]) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Rayans Favoris.lnk"


def installer() -> Path:
    if not ICONE.exists():
        dessiner_icone()
    pythonw = Path(sys.executable).with_name("pythonw.exe")
    lien = raccourci()
    script = (
        "$w = New-Object -ComObject WScript.Shell; "
        f"$s = $w.CreateShortcut('{lien}'); "
        f"$s.TargetPath = '{pythonw}'; "
        f"$s.Arguments = '\"{ICI / 'lancer.pyw'}\"'; "
        f"$s.WorkingDirectory = '{ICI}'; "
        f"$s.IconLocation = '{ICONE}'; "
        "$s.Description = \"Rayan's Favoris : vidéos enregistrées triées et vérifiées\"; "
        "$s.Save()"
    )
    subprocess.run(["powershell", "-NoProfile", "-Command", script], check=True)
    return lien


if __name__ == "__main__":
    if "--retirer" in sys.argv:
        raccourci().unlink(missing_ok=True)
        print("Raccourci retiré.")
    else:
        print("Raccourci créé :", installer())
