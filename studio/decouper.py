"""Découper une vidéo longue de Rayan en 4 à 6 extraits verticaux (30-60 s) sous-titrés mot par mot.

    python decouper.py <video.mp4> [--slug <slug>] [--sans-rendu] [--sans-depot] [--mienne]

1. Transcription mot à mot (faster-whisper, sur la carte graphique si possible : même chargeur que favoris/recuperer.py).
2. Propositions : des extraits qui commencent et finissent sur une phrase entière, avec une phrase forte au début.
   Ayati : un extrait ne coupe JAMAIS un verset (les versets viennent de la chronologie du Studio,
   animation/public/<slug>/timeline.json : sans elle, on s'arrête).
3. Rendu vertical (composition Remotion « Extrait ») → sorties/<slug>-extrait-<n>.mp4, puis dépôt dans la tuile
   Studio (a_valider.py) pour validation. Rien n'est publié.

Stories (--story) : à partir du Short déjà fabriqué (sorties/<slug>.mp4), 1 à 3 stories de 10 à 20 s qui se
suivent depuis le début (l'accroche), sans jamais couper un verset ni dévoiler la fin ; la dernière se termine sur
la carte « La vidéo complète est sur le profil ». → sorties/<slug>-story-<n>.mp4, déposées dans la tuile Studio.

    python decouper.py sorties/<slug>.mp4 --story

Seulement les vidéos de Rayan : la vidéo doit correspondre à un projet du Studio (projets/<slug>.json), sinon
il faut confirmer avec --mienne.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
SORTIES = ICI / "sorties"
ANIM = ICI / "animation"
FPS = 30
DUREE_MIN, DUREE_MAX, DUREE_IDEALE = 30.0, 60.0, 45.0
NB_MIN, NB_MAX = 4, 6
STORY_MIN, STORY_MAX, STORY_IDEALE = 10.0, 20.0, 15.0
NB_STORIES = 3
STORY_PART_MAX = 0.7     # les stories ne montrent jamais plus que les 70 premiers % du Short : la fin reste à voir
FIN_STORY = int(2.5 * FPS)   # carte « La vidéo complète est sur le profil » à la fin de la dernière story
FIN_PHRASE = re.compile(r"[.!?…»]$")
DEBUTS_FORTS = ("pourquoi", "comment", "et si", "tu ", "imagine", "personne", "jamais", "le jour", "savais-tu")


# ------------------------------------------------------------------ transcription (réutilise favoris/)
def transcrire(video: Path) -> list[list]:
    """[[début s, fin s, mot], …] pour toute la vidéo."""
    sys.path.insert(0, str(ICI.parent / "favoris"))
    from recuperer import _modele   # faster-whisper, CUDA si présent, sinon processeur
    import numpy as np
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(video), "-vn", "-ac", "1", "-ar", "16000",
                        "-f", "s16le", "-"], capture_output=True)
    if r.returncode != 0 or len(r.stdout) < 16000:
        sys.exit("Pas de son dans cette vidéo.")
    son = np.frombuffer(r.stdout, np.int16).astype(np.float32) / 32768.0
    segs, _ = _modele().transcribe(son, language="fr", word_timestamps=True, vad_filter=True, beam_size=5)
    return [[round(w.start, 3), round(w.end, 3), w.word.strip()] for s in segs for w in s.words if w.word.strip()]


# ------------------------------------------------------------------ propositions (fonctions pures, testées)
def phrases(mots: list[list]) -> list[dict]:
    out, cour = [], []
    for m in mots:
        cour.append(m)
        if FIN_PHRASE.search(m[2]):
            out.append(cour)
            cour = []
    if cour:
        out.append(cour)
    return [{"debut": p[0][0], "fin": p[-1][1], "mots": p, "texte": " ".join(w for _, _, w in p)} for p in out]


def versets(timeline: dict | None) -> list[tuple[float, float]]:
    if not timeline:
        return []
    fps = timeline.get("fps", FPS)
    return [(s["debut"] / fps, s["fin"] / fps) for s in timeline.get("segments", []) if s.get("type") == "verset"]


def coupe_un_verset(a: float, b: float, zones: list[tuple[float, float]]) -> bool:
    """Vrai si [a, b] commence ou finit au milieu d'un verset (un verset entier dedans est permis)."""
    return any(va < a < vb or va < b < vb for va, vb in zones)


def score(ps: list[dict], dans_verset: bool) -> float:
    premiere = ps[0]["texte"].lower()
    s = 0.0
    if len(ps[0]["mots"]) <= 12:
        s += 1          # phrase d'ouverture courte
    if premiere.rstrip().endswith(("?", "!")):
        s += 1          # question ou exclamation
    if premiere.startswith(DEBUTS_FORTS):
        s += 1
    if ps[0]["texte"][:1].isupper():
        s += 0.3        # vrai début de phrase
    duree = ps[-1]["fin"] - ps[0]["debut"]
    s -= abs(duree - DUREE_IDEALE) / 60
    if dans_verset:
        s += 0.5        # Ayati : l'extrait contient un verset entier
    return round(s, 3)


def proposer(mots: list[list], zones_versets: list[tuple[float, float]] | None = None, nb_max: int = NB_MAX) -> list[dict]:
    zones = zones_versets or []
    ps = phrases(mots)
    candidats = []
    for i in range(len(ps)):
        for j in range(i, len(ps)):
            a, b = ps[i]["debut"], ps[j]["fin"]
            d = b - a
            if d > DUREE_MAX:
                break
            if d < DUREE_MIN:
                continue
            # marges de 0,2 s autour de l'extrait, sans déborder sur la phrase voisine
            a2 = max(a - 0.2, ps[i - 1]["fin"] if i else 0.0)
            b2 = min(b + 0.4, ps[j + 1]["debut"] if j + 1 < len(ps) else b + 0.4)
            if coupe_un_verset(a2, b2, zones):
                continue
            dedans = any(a2 <= va and vb <= b2 for va, vb in zones)
            candidats.append({"debut": round(a2, 2), "fin": round(b2, 2), "score": score(ps[i:j + 1], dedans),
                              "accroche": ps[i]["texte"], "mots": [m for p in ps[i:j + 1] for m in p["mots"]]})
    choisis = []
    for c in sorted(candidats, key=lambda c: -c["score"]):
        if all(c["fin"] <= x["debut"] or c["debut"] >= x["fin"] for x in choisis):
            choisis.append(c)
        if len(choisis) >= nb_max:
            break
    return sorted(choisis, key=lambda c: c["debut"])


def proposer_stories(mots: list[list], zones_versets: list[tuple[float, float]] | None = None,
                     nb_max: int = NB_STORIES) -> list[dict]:
    """Stories qui se suivent depuis le début du Short, chacune sur des phrases entières, de 10 à 20 s (au plus près
    de 15 s), sans couper un verset, et jamais au-delà des 70 premiers % (la fin reste à voir dans le Short)."""
    zones = zones_versets or []
    ps = phrases(mots)
    if not ps:
        return []
    limite = ps[-1]["fin"] * STORY_PART_MAX
    out, i = [], 0
    while i < len(ps) and len(out) < nb_max:
        meilleur = None
        for j in range(i, len(ps)):
            a = 0.0 if i == 0 else max(ps[i]["debut"] - 0.2, ps[i - 1]["fin"])
            b = min(ps[j]["fin"] + 0.4, ps[j + 1]["debut"] if j + 1 < len(ps) else ps[j]["fin"] + 0.4)
            d = b - a
            if d > STORY_MAX or b > limite:
                break
            if d < STORY_MIN or coupe_un_verset(a, b, zones):
                continue
            if meilleur is None or abs(d - STORY_IDEALE) < abs(meilleur[2] - STORY_IDEALE):
                meilleur = (a, b, d, j)
        if meilleur is None:
            break
        a, b, _, j = meilleur
        out.append({"debut": round(a, 2), "fin": round(b, 2), "accroche": ps[i]["texte"],
                    "mots": [m for p in ps[i:j + 1] for m in p["mots"]]})
        i = j + 1
    return out


def mots_relatifs(extrait: dict, zones_versets: list[tuple[float, float]]) -> list[dict]:
    """Mots du sous-titre en images, relatifs au début de l'extrait ; rien pendant un verset (la carte du verset
    est déjà dans l'image, et la transcription française de l'arabe serait fausse)."""
    a = extrait["debut"]
    out = []
    for t0, t1, w in extrait["mots"]:
        if any(va <= t0 < vb for va, vb in zones_versets):
            continue
        out.append({"debut": int(round((t0 - a) * FPS)), "fin": int(round((t1 - a) * FPS)), "texte": w})
    return out


# ------------------------------------------------------------------ rendu et dépôt
def rendre(video: Path, slug: str, n: int, ex: dict, zones, style: str, marque: str | None, sous_titres: bool = True,
           genre: str = "extrait", fin_story: int = 0) -> Path:
    nom = f"{slug}-{genre}-{n}"
    pub = ANIM / "public" / "extraits"
    pub.mkdir(parents=True, exist_ok=True)
    clip = pub / f"{nom}.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{ex['debut']:.3f}", "-to", f"{ex['fin']:.3f}",
                    "-i", str(video), "-c:v", "libx264", "-crf", "18", "-c:a", "aac", "-b:a", "192k", str(clip)], check=True)
    duree = int(round((ex["fin"] - ex["debut"]) * FPS)) + fin_story
    props = pub / f"{nom}.json"
    props.write_text(json.dumps({"source": f"extraits/{nom}.mp4", "mots": mots_relatifs(ex, zones), "duree": duree,
                                 "style": style, "marque": marque, "sousTitres": sous_titres, "finStory": fin_story},
                                ensure_ascii=False),
                     encoding="utf-8")
    sortie = SORTIES / f"{nom}.mp4"
    r = subprocess.run(["npx", "remotion", "render", "src/index.ts", "Extrait", str(sortie), f"--props={props}",
                        "--codec=h264", "--crf=18", "--log=error"], cwd=ANIM, shell=sys.platform == "win32")
    if r.returncode:
        sys.exit("Le rendu Remotion a échoué.")
    return sortie


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("video")
    a.add_argument("--slug")
    a.add_argument("--sans-rendu", action="store_true")
    a.add_argument("--sans-depot", action="store_true")
    a.add_argument("--mienne", action="store_true", help="confirme que la vidéo est bien de Rayan")
    a.add_argument("--sous-titres", action="store_true", help="force les sous-titres même sur une vidéo verticale du Studio")
    a.add_argument("--story", action="store_true", help="1 à 3 stories de 15 s tirées du Short (sorties/<slug>.mp4)")
    args = a.parse_args()
    video = Path(args.video).resolve()
    if not video.exists():
        sys.exit(f"introuvable : {video}")
    slug = args.slug or video.stem
    if args.story and timeline_absente(slug):
        sys.exit("Stories : seulement à partir d'un Short fabriqué par le Studio (chronologie introuvable pour ce slug).")
    p_projet = ICI / "projets" / f"{slug}.json"
    projet = json.loads(p_projet.read_text(encoding="utf-8")) if p_projet.exists() else {}
    if not projet and not args.mienne:
        sys.exit("Aucun projet du Studio pour cette vidéo : seulement les vidéos de Rayan (ajoute --mienne si c'en est une).")
    style = projet.get("style") or ("ayati" if slug.startswith("ayati") else "psycho")
    p_tl = ANIM / "public" / slug / "timeline.json"
    timeline = json.loads(p_tl.read_text(encoding="utf-8")) if p_tl.exists() else None
    if style == "ayati" and timeline is None:
        sys.exit(f"Ayati : chronologie introuvable ({p_tl}) ; sans elle on ne sait pas où sont les versets → arrêt.")
    zones = versets(timeline)

    print("Transcription…")
    mots = transcrire(video)
    if args.story:
        return faire_stories(video, slug, mots, zones, style, projet, args)
    extraits = proposer(mots, zones)
    if len(extraits) < NB_MIN:
        print(f"  ! seulement {len(extraits)} extrait(s) possible(s) (il en faudrait {NB_MIN}).")
    SORTIES.mkdir(exist_ok=True)
    (SORTIES / f"{slug}.extraits.json").write_text(json.dumps(
        [{k: v for k, v in e.items() if k != "mots"} for e in extraits], ensure_ascii=False, indent=1), encoding="utf-8")
    for n, e in enumerate(extraits, 1):
        print(f"{n}. {e['debut']:.1f}-{e['fin']:.1f} s ({e['fin'] - e['debut']:.0f} s) — « {e['accroche'][:80]} »")
    if args.sans_rendu:
        return
    for n, e in enumerate(extraits, 1):
        # une vidéo fabriquée par le Studio a déjà ses sous-titres incrustés : on n'en remet pas par-dessus
        deja = timeline is not None and not args.sous_titres
        sortie = rendre(video, slug, n, e, zones, style, projet.get("marque"), sous_titres=not deja)
        print(f"  extrait {n} : {sortie}")
        if not args.sans_depot:
            from a_valider import envoyer
            envoyer(sortie.stem, f"Extrait {n} de {slug} ({e['debut']:.0f}-{e['fin']:.0f} s). Accroche : {e['accroche'][:80]}")



def timeline_absente(slug: str) -> bool:
    return not (ANIM / "public" / slug / "timeline.json").exists()


def faire_stories(video: Path, slug: str, mots, zones, style: str, projet: dict, args) -> None:
    stories = proposer_stories(mots, zones)
    if not stories:
        sys.exit("Aucune story possible (il faut des phrases entières de 10 à 20 s dans le début du Short).")
    SORTIES.mkdir(exist_ok=True)
    (SORTIES / f"{slug}.stories.json").write_text(json.dumps(
        [{k: v for k, v in e.items() if k != "mots"} for e in stories], ensure_ascii=False, indent=1), encoding="utf-8")
    for n, e in enumerate(stories, 1):
        print(f"story {n}. {e['debut']:.1f}-{e['fin']:.1f} s ({e['fin'] - e['debut']:.0f} s) — « {e['accroche'][:80]} »")
    if args.sans_rendu:
        return
    for n, e in enumerate(stories, 1):
        fin = FIN_STORY if n == len(stories) else 0
        # le Short du Studio a déjà ses sous-titres incrustés
        sortie = rendre(video, slug, n, e, zones, style, projet.get("marque"), sous_titres=args.sous_titres,
                        genre="story", fin_story=fin)
        print(f"  story {n} : {sortie}")
        if not args.sans_depot:
            from a_valider import envoyer
            envoyer(sortie.stem, f"Story {n}/{len(stories)} de {slug} (Instagram{' + Facebook' if style == 'ayati' else ''}"
                                 f" auto, TikTok à la main). Accroche : {e['accroche'][:80]}")


if __name__ == "__main__":
    main()
