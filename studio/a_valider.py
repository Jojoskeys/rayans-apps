"""Vidéos à faire valider par Rayan depuis l'iPhone (tuile Studio de Rayan's Mobile, via Rayan's Télécommande).

    python a_valider.py envoyer <slug> [--note "ce qui a changé"]   dépose sorties/<slug>.mp4 (version légère)
    python a_valider.py retours                                     réponses de Rayan (dernière version de chaque vidéo)
    python a_valider.py retirer <slug>                              retire la vidéo du téléphone (garde l'historique)

Dossier partagé avec la Télécommande : <Vidéos>\\Rayan's Studio\\A valider (voir telecommande/src/core/studio.ts).
"""
import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ICI = Path(__file__).resolve().parent
TAILLE_CIBLE = 14 * 1024 * 1024  # assez léger pour se charger vite en 4G, assez net pour juger
AUDIO_KBPS = 160


def dossier_videos() -> Path:
    try:
        p = subprocess.run(["powershell", "-NoProfile", "-Command", "[Environment]::GetFolderPath('MyVideos')"],
                           capture_output=True, text=True, timeout=20).stdout.strip()
        if p:
            return Path(p)
    except Exception:
        pass
    return Path.home() / "Videos"


DOSSIER = Path(os.environ["STUDIO_A_VALIDER"]) if os.environ.get("STUDIO_A_VALIDER") else dossier_videos() / "Rayan's Studio" / "A valider"


def duree(f: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def version_legere(src: Path, dest: Path) -> None:
    if src.stat().st_size <= TAILLE_CIBLE:
        dest.write_bytes(src.read_bytes())
        return
    kbps = max(600, int(TAILLE_CIBLE * 8 / 1000 / duree(src) * 0.94) - AUDIO_KBPS)
    tmp = dest.with_suffix(".tmp.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-c:v", "libx264", "-preset", "medium",
                    "-b:v", f"{kbps}k", "-maxrate", f"{int(kbps * 1.5)}k", "-bufsize", f"{kbps * 3}k",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", f"{AUDIO_KBPS}k", "-movflags", "+faststart",
                    str(tmp)], check=True)
    os.replace(tmp, dest)


def lire(p: Path, defaut):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return defaut


def envoyer(slug: str, note: str) -> None:
    src = ICI / "sorties" / f"{slug}.mp4"
    if not src.exists():
        sys.exit(f"introuvable : {src}")
    projet = lire(ICI / "projets" / f"{slug}.json", {})
    DOSSIER.mkdir(parents=True, exist_ok=True)
    meta_p = DOSSIER / f"{slug}.json"
    ancienne = lire(meta_p, {})
    version = int(ancienne.get("version", 0)) + 1 if meta_p.exists() else 1
    texte = projet.get("legende", "")
    if projet.get("hashtags"):
        texte = (texte + "\n\n" + " ".join(projet["hashtags"])).strip()
    version_legere(src, DOSSIER / f"{slug}.mp4")
    meta = {"titre": projet.get("titre_youtube") or projet.get("titre") or slug, "texte": texte, "note": note,
            "version": version, "envoye": int(time.time() * 1000)}
    tmp = meta_p.with_suffix(".tmp")
    tmp.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, meta_p)
    mo = (DOSSIER / f"{slug}.mp4").stat().st_size / 1024 / 1024
    print(f"{slug} : version {version} déposée ({mo:.1f} Mo) dans {DOSSIER}")


def retours() -> None:
    if not DOSSIER.exists():
        print("Aucune vidéo déposée.")
        return
    for meta_p in sorted(DOSSIER.glob("*.json")):
        if meta_p.name.endswith(".retours.json") or meta_p.name.endswith(".tmp"):
            continue
        slug = meta_p.stem
        if not (DOSSIER / f"{slug}.mp4").exists():
            continue
        meta = lire(meta_p, {})
        v = meta.get("version", 1)
        rs = [r for r in lire(DOSSIER / f"{slug}.retours.json", []) if r.get("version") == v]
        if not rs:
            print(f"- {slug} (v{v}) : en attente")
            continue
        r = rs[-1]
        quand = time.strftime("%d/%m %H:%M", time.localtime(r["at"] / 1000))
        etat = "VALIDÉE" if r["verdict"] == "ok" else "À CORRIGER"
        print(f"- {slug} (v{v}) : {etat} le {quand}")
        if r.get("commentaire"):
            for ligne in r["commentaire"].splitlines():
                print(f"    {ligne}")


def retirer(slug: str) -> None:
    for f in (DOSSIER / f"{slug}.mp4", DOSSIER / f"{slug}.json"):
        f.unlink(missing_ok=True)
    print(f"{slug} retirée (historique gardé dans {slug}.retours.json)")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    s = a.add_subparsers(dest="cmd", required=True)
    e = s.add_parser("envoyer"); e.add_argument("slug"); e.add_argument("--note", default="")
    s.add_parser("retours")
    r = s.add_parser("retirer"); r.add_argument("slug")
    args = a.parse_args()
    if args.cmd == "envoyer":
        envoyer(args.slug, args.note)
    elif args.cmd == "retours":
        retours()
    else:
        retirer(args.slug)
