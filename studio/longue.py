"""Format long 16:9 (YouTube, 5 à 10 min) : passages horodatés, planche de style, miniatures.

Dans le projet : "format": "long". Un passage = un segment du script ; il peut avoir une "image"
(chemin dans animation/public/, par ex. "<slug>/images/1.jpg"), sinon le décor vertical habituel est posé au centre.

    python fabrique.py projets/<slug>.json      voix + passages horodatés (sorties/<slug>.passages.txt) ;
                                                tant que Rayan n'a pas validé, seule la planche + l'intro est rendue
    python longue.py planche <slug>             planche de style + intro → déposées dans la tuile Studio (<slug>-intro)
    python longue.py miniatures <slug>          3 miniatures → sorties/miniatures/<slug>-1.png, -2, -3

Rien n'est généré en masse avant l'accord de Rayan : le rendu complet n'est fait que si la tuile Studio a reçu « OK »
sur <slug>-intro, ou si le projet porte "planche_validee": true.
"""
import json
import subprocess
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
SORTIES = ICI / "sorties"
ANIM = ICI / "animation"
INTRO_MAX = 30.0   # secondes rendues pour la validation par morceaux (intro d'abord)
NB_IMAGES_PLANCHE = 8


def hms(s: float) -> str:
    s = int(round(s))
    return f"{s // 60:02d}:{s % 60:02d}"


def passages(timeline: dict) -> list[dict]:
    """Chaque segment avec son horodatage exact sur la voix (secondes) et le début de son texte."""
    fps = timeline.get("fps", 30)
    out = []
    for n, s in enumerate(timeline.get("segments", []), 1):
        if s.get("type") == "verset":
            texte = f"[verset {s.get('verset', {}).get('ref') or s.get('ref')}]"
        else:
            texte = " ".join(m["texte"] for m in s.get("mots") or [])
        out.append({"n": n, "debut": round(s["debut"] / fps, 2), "fin": round(s["fin"] / fps, 2),
                    "scene": s.get("scene"), "image": s.get("image"), "texte": texte})
    return out


def texte_passages(timeline: dict) -> str:
    lignes = []
    for p in passages(timeline):
        court = p["texte"] if len(p["texte"]) <= 90 else p["texte"][:87] + "…"
        lignes.append(f"{p['n']:>3}. {hms(p['debut'])} – {hms(p['fin'])}  [{p['image'] or p['scene']}]  {court}")
    return "\n".join(lignes)


def ecrire_passages(timeline: dict) -> Path:
    out = SORTIES / f"{timeline['slug']}.passages.txt"
    out.parent.mkdir(exist_ok=True)
    out.write_text(texte_passages(timeline) + "\n", encoding="utf-8")
    return out


def fin_intro(timeline: dict, maxi: float = INTRO_MAX) -> int:
    """Dernière image de l'intro : on s'arrête à la fin d'un passage, jamais au milieu (au moins un passage)."""
    fps = timeline.get("fps", 30)
    fin = None
    for s in timeline.get("segments", []):
        if fin is not None and s["fin"] / fps > maxi:
            break
        fin = s["fin"]
    return min(fin or timeline["duree"], timeline["duree"]) - 1


def intro_validee(slug: str, projet: dict) -> bool:
    if projet.get("planche_validee"):
        return True
    try:
        from a_valider import DOSSIER, reponse
        return reponse(DOSSIER, f"{slug}-intro") == "ok"
    except Exception:
        return False


def remotion(*args) -> None:
    r = subprocess.run(["npx", "remotion", *args, "--log=error"], cwd=ANIM, shell=sys.platform == "win32")
    if r.returncode:
        sys.exit("Le rendu Remotion a échoué.")


def lire_timeline(slug: str) -> tuple[dict, Path]:
    p = ANIM / "public" / slug / "timeline.json"
    if not p.exists():
        sys.exit(f"Chronologie introuvable : lance d'abord python fabrique.py projets/{slug}.json --sans-rendu")
    return json.loads(p.read_text(encoding="utf-8")), p


def rendre_intro(slug: str) -> Path:
    t, chemin = lire_timeline(slug)
    sortie = SORTIES / f"{slug}-intro-seule.mp4"
    remotion("render", "src/index.ts", "VideoLong", str(sortie), f"--props={chemin}", f"--frames=0-{fin_intro(t)}",
             "--codec=h264", "--crf=20")
    return sortie


def planche(slug: str, deposer: bool = True) -> Path:
    """Planche de style (images de plusieurs passages) suivie de l'intro, en une vidéo à valider."""
    t, chemin = lire_timeline(slug)
    dossier = SORTIES / "planches" / slug
    dossier.mkdir(parents=True, exist_ok=True)
    ps = passages(t)
    pas = max(1, len(ps) // NB_IMAGES_PLANCHE)
    images = []
    for p in ps[::pas][:NB_IMAGES_PLANCHE]:
        img = dossier / f"{p['n']:03d}.png"
        frame = int((p["debut"] + p["fin"]) / 2 * t.get("fps", 30))
        remotion("still", "src/index.ts", "VideoLong", str(img), f"--props={chemin}", f"--frame={frame}", "--scale=0.25")
        images.append(img)
    jpg = SORTIES / "planches" / f"{slug}-style.jpg"
    entrees = sum((["-i", str(i)] for i in images), [])
    cols = min(4, len(images))
    lignes = -(-len(images) // cols)
    # chaque image en 480x270, posée sur une grille (complétée par du noir)
    filtre = "".join(f"[{k}:v]scale=480:270,pad=488:278:4:4:white[i{k}];" for k in range(len(images)))
    noirs = cols * lignes - len(images)
    filtre += "".join(f"color=black:s=488x278:d=1[n{k}];" for k in range(noirs))
    filtre += "".join(f"[i{k}]" for k in range(len(images))) + "".join(f"[n{k}]" for k in range(noirs))
    filtre += f"xstack=inputs={cols * lignes}:layout=" + "|".join(
        f"{(k % cols) * 488}_{(k // cols) * 278}" for k in range(cols * lignes)) if cols * lignes > 1 else "[i0]null"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *entrees, "-filter_complex", filtre, "-frames:v", "1", str(jpg)], check=True)

    intro = rendre_intro(slug)
    sortie = SORTIES / f"{slug}-intro.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-t", "6", "-i", str(jpg),
                    "-f", "lavfi", "-t", "6", "-i", "anullsrc=r=44100:cl=stereo", "-i", str(intro), "-filter_complex",
                    "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v0];"
                    "[2:v]fps=30,setsar=1,format=yuv420p[v2];[2:a]aresample=44100,aformat=channel_layouts=stereo[a2];"
                    "[v0][1:a][v2][a2]concat=n=2:v=1:a=1[v][a]", "-map", "[v]", "-map", "[a]",
                    "-c:v", "libx264", "-crf", "20", "-c:a", "aac", "-movflags", "+faststart", str(sortie)], check=True)
    print(f"Planche : {jpg}\nPlanche + intro : {sortie}")
    if deposer:
        from a_valider import envoyer
        envoyer(f"{slug}-intro", "Format long : planche de style (6 s) puis l'intro. OK = je fabrique le reste.")
    return sortie


def textes_miniatures(projet: dict) -> list[str]:
    l = [x for x in projet.get("miniatures", []) if x][:3]
    base = projet.get("titre") or projet.get("titre_youtube") or projet.get("slug", "")
    while len(l) < 3:
        l.append(base)
    return l


def miniatures(slug: str) -> list[Path]:
    projet = json.loads((ICI / "projets" / f"{slug}.json").read_text(encoding="utf-8"))
    dossier = SORTIES / "miniatures"
    dossier.mkdir(parents=True, exist_ok=True)
    out = []
    for k, texte in enumerate(textes_miniatures(projet)):
        props = {"texte": texte, "style": projet.get("style", "ayati"), "variante": k,
                 "image": projet.get("miniature_image"), "marque": projet.get("marque")}
        f_props = dossier / f"{slug}-{k + 1}.props.json"
        f_props.write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")
        png = dossier / f"{slug}-{k + 1}.png"
        remotion("still", "src/index.ts", "Miniature", str(png), f"--props={f_props}")
        f_props.unlink(missing_ok=True)
        out.append(png)
        print(f"Miniature {k + 1} : {png}")
    return out


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) < 3 or sys.argv[1] not in ("planche", "miniatures", "passages"):
        sys.exit(__doc__)
    cmd, slug = sys.argv[1], sys.argv[2]
    if cmd == "planche":
        planche(slug, deposer="--sans-depot" not in sys.argv)
    elif cmd == "miniatures":
        miniatures(slug)
    else:
        print(texte_passages(lire_timeline(slug)[0]))
