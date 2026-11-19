"""Contrôle d'une vidéo avant de la déposer : planche d'images + volume.

    python controle.py <slug> [<slug> …]

- Planche : 18 images prises à intervalles réguliers → sorties/planches/<slug>.jpg
- Volume intégré (LUFS) et crête vraie (dBTP) mesurés par ffmpeg (cible : -14 LUFS, crête ≤ -1 dBTP).
L'écoute (earshot critique) se fait à part.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
SORTIES = ICI / "sorties"


def duree(f: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(f)], capture_output=True, text=True)
    return float(json.loads(r.stdout)["format"]["duration"])


def planche(slug: str) -> Path:
    src = SORTIES / f"{slug}.mp4"
    out = SORTIES / "planches" / f"{slug}.jpg"
    out.parent.mkdir(exist_ok=True)
    n = 18
    pas = duree(src) / n
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-vf",
                    f"fps=1/{pas:.3f},scale=270:-1,tile=6x3:padding=6:color=white", "-frames:v", "1", "-q:v", "3", str(out)], check=True)
    return out


def volume(slug: str):
    src = SORTIES / f"{slug}.mp4"
    r = subprocess.run(["ffmpeg", "-i", str(src), "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    resume = r.stderr[r.stderr.rfind("Summary:"):]
    lufs = float(re.search(r"I:\s+(-?[\d.]+) LUFS", resume).group(1))
    crete = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", resume).group(1))
    return lufs, crete


def main():
    for slug in sys.argv[1:]:
        p = planche(slug)
        lufs, crete = volume(slug)
        ok = abs(lufs + 14) <= 1 and crete <= -0.5
        print(f"{slug} : {duree(SORTIES / f'{slug}.mp4'):.1f} s, {lufs:.1f} LUFS, crête {crete:.1f} dBTP {'OK' if ok else 'À REVOIR'} — planche {p}")


if __name__ == "__main__":
    main()
