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


RACINE = Path(os.environ["STUDIO_RACINE"]) if os.environ.get("STUDIO_RACINE") else dossier_videos() / "Rayan's Studio"
DOSSIER = Path(os.environ["STUDIO_A_VALIDER"]) if os.environ.get("STUDIO_A_VALIDER") else RACINE / "A valider"
SCRIPTS = RACINE / "Scripts"
IDEES = RACINE / "idees.json"
STATUTS = ("nouvelle", "script", "faite", "abandonnée")


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


def ecrire(p: Path, v) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(v, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, p)


def texte_script(projet: dict) -> str:
    """Le script tel que Rayan le lit : titre, narration, versets, légende et hashtags."""
    lignes = [f"Titre : {projet.get('titre_youtube') or projet.get('titre', '')}", ""]
    for seg in projet.get("segments", []):
        if seg.get("type") == "verset":
            lignes.append(f"[Récitation du verset {seg.get('ref')}, texte arabe et traduction à l'écran]")
        else:
            gros = seg.get("titre", {}).get("texte") if isinstance(seg.get("titre"), dict) else None
            lignes.append((f"[Titre à l'écran : {gros}]\n" if gros else "") + seg.get("texte", ""))
        lignes.append("")
    legende = projet.get("legende", "")
    if legende or projet.get("hashtags"):
        lignes += ["— Légende —", legende, " ".join(projet.get("hashtags", []))]
    return "\n".join(lignes).strip()


def script(slug: str, note: str) -> None:
    p = ICI / "projets" / f"{slug}.json"
    if not p.exists():
        sys.exit(f"introuvable : {p}")
    projet = lire(p, {})
    meta_p = SCRIPTS / f"{slug}.json"
    version = int(lire(meta_p, {}).get("version", 0)) + 1 if meta_p.exists() else 1
    ecrire(meta_p, {"titre": projet.get("titre_youtube") or projet.get("titre") or slug,
                    "compte": "ayati" if projet.get("style") == "ayati" else "psycho",
                    "texte": texte_script(projet), "sources": projet.get("sources", []), "note": note,
                    "version": version, "envoye": int(time.time() * 1000)})
    print(f"{slug} : script version {version} déposé dans {SCRIPTS}")


def idees() -> None:
    l = sorted(lire(IDEES, []), key=lambda i: i.get("at", 0))
    if not l:
        print("Aucune idée.")
    for i in l:
        quand = time.strftime("%d/%m %H:%M", time.localtime(i["at"] / 1000))
        print(f"- [{i.get('statut', 'nouvelle')}] {i.get('compte') or 'les deux'} · {quand} · {i['id']}\n    {i['texte']}")


def idee_statut(id_: str, statut: str) -> None:
    if statut not in STATUTS:
        sys.exit(f"statut inconnu : {statut} ({', '.join(STATUTS)})")
    l = lire(IDEES, [])
    for i in l:
        if i["id"] == id_ or i["id"].startswith(id_):
            i["statut"] = statut
            ecrire(IDEES, l)
            print(f"idée « {i['texte'][:60]} » → {statut}")
            return
    sys.exit("idée introuvable")


def retours_de(dossier: Path, avec_mp4: bool, nom: str) -> None:
    if not dossier.exists():
        return
    print(f"{nom} :")
    for meta_p in sorted(dossier.glob("*.json")):
        if meta_p.name.endswith(".retours.json") or meta_p.name.endswith(".tmp"):
            continue
        slug = meta_p.stem
        if avec_mp4 and not (dossier / f"{slug}.mp4").exists():
            continue
        meta = lire(meta_p, {})
        v = meta.get("version", 1)
        rs = [r for r in lire(dossier / f"{slug}.retours.json", []) if r.get("version") == v]
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


def retours() -> None:
    retours_de(DOSSIER, True, "Vidéos")
    retours_de(SCRIPTS, False, "Scripts")
    nouvelles = [i for i in lire(IDEES, []) if i.get("statut", "nouvelle") == "nouvelle"]
    if nouvelles:
        print(f"Idées nouvelles : {len(nouvelles)} (python a_valider.py idees)")


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
    sc = s.add_parser("script"); sc.add_argument("slug"); sc.add_argument("--note", default="")
    s.add_parser("idees")
    st = s.add_parser("idee"); st.add_argument("id"); st.add_argument("statut")
    args = a.parse_args()
    if args.cmd == "envoyer":
        envoyer(args.slug, args.note)
    elif args.cmd == "retours":
        retours()
    elif args.cmd == "script":
        script(args.slug, args.note)
    elif args.cmd == "idees":
        idees()
    elif args.cmd == "idee":
        idee_statut(args.id, args.statut)
    else:
        retirer(args.slug)
