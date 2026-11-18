"""Prépare des versets à partir d'une récitation libre de droits (une sourate entière dans un seul fichier).

    python recitation_libre.py <fichier.mp3> <ref> <debut> <fin> [<coupe_debut> <coupe_fin>]

Extrait le verset (en retirant éventuellement une répétition entre coupe_debut et coupe_fin), le transcrit
mot à mot avec faster-whisper (local) et cale chaque mot du texte uthmani (quran.com) sur la voix.
Écrit cache/libre/<ref>.mp3 et cache/libre/<ref>.json, que fabrique.py utilise si le projet a
"recitation": "libre".
"""
import json
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
import requests

ICI = Path(__file__).resolve().parent
LIBRE = ICI / "cache" / "libre"


def lettres(s):
    s = re.sub(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]", "", s)  # signes et voyelles
    return re.sub(r"[^ء-ي]", "", s)


def refs_de(ref):
    """'105:1-5' -> ['105:1', ..., '105:5'] ; '28:7' -> ['28:7']"""
    s, a = ref.split(":")
    if "-" in a:
        d, f = map(int, a.split("-"))
        return [f"{s}:{i}" for i in range(d, f + 1)]
    return [ref]


def mots_uthmani(ref):
    mots = []
    for r in refs_de(ref):
        v = requests.get(f"https://api.quran.com/api/v4/verses/by_key/{r}", timeout=30,
                         params={"words": "true", "word_fields": "text_uthmani"}).json()["verse"]
        mots += [w["text_uthmani"] for w in v["words"] if w["char_type_name"] == "word"]
    return mots


def main():
    source, ref, debut, fin = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
    coupe = (float(sys.argv[5]), float(sys.argv[6])) if len(sys.argv) > 6 else None
    LIBRE.mkdir(parents=True, exist_ok=True)
    nom = ref.replace(":", "-")
    sortie = LIBRE / f"{nom}.mp3"
    morceaux = [(debut, coupe[0]), (coupe[1], fin)] if coupe else [(debut, fin)]
    filtre = "".join(f"[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,afade=t=in:d=0.05,afade=t=out:st={b - a - 0.08}:d=0.08[p{k}];"
                     for k, (a, b) in enumerate(morceaux))
    filtre += "".join(f"[p{k}]" for k in range(len(morceaux))) + f"concat=n={len(morceaux)}:v=0:a=1,afade=t=out:st={sum(b - a for a, b in morceaux) - 0.4}:d=0.4[o]"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", source, "-filter_complex", filtre, "-map", "[o]",
                    "-b:a", "192k", str(sortie)], check=True)
    wav = LIBRE / f"{nom}.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(sortie), "-ac", "1", "-ar", "16000", str(wav)], check=True)

    from faster_whisper import WhisperModel
    w = wave.open(str(wav))
    audio = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    segs, _ = WhisperModel("small", device="cpu", compute_type="int8").transcribe(
        audio, language="ar", word_timestamps=True, beam_size=5)
    entendus = [(x.start, x.end, lettres(x.word)) for s in segs for x in s.words if lettres(x.word)]

    # Calage par position dans le texte : chaque mot uthmani prend le temps de la partie de la voix qui
    # correspond à la même fraction de lettres (robuste aux petites erreurs de transcription).
    cibles = mots_uthmani(ref)
    total_c = sum(len(lettres(m)) for m in cibles)
    total_e = sum(len(t) for _, _, t in entendus)
    reperes, acc = [], 0
    for a, b, t in entendus:
        reperes.append((acc / total_e, a))
        acc += len(t)
        reperes.append((acc / total_e, b))
    xs, ys = [r[0] for r in reperes], [r[1] for r in reperes]
    minutage, acc = [], 0
    for i, m in enumerate(cibles):
        f0 = acc / total_c
        acc += len(lettres(m))
        f1 = acc / total_c
        minutage.append([i, round(float(np.interp(f0, xs, ys)), 3), round(float(np.interp(f1, xs, ys)), 3)])
    (LIBRE / f"{nom}.json").write_text(json.dumps({"ref": ref, "source": Path(source).name, "morceaux": morceaux,
                                                   "minutage": minutage}, ensure_ascii=False), encoding="utf-8")
    duree = sum(b - a for a, b in morceaux)
    print(f"{ref} : {duree:.1f} s, {len(cibles)} mots calés sur {len(entendus)} mots entendus")


if __name__ == "__main__":
    main()
