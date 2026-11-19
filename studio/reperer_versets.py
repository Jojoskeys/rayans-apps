"""Retrouve le début et la fin d'un ou plusieurs versets dans une récitation complète d'une sourate.

    python reperer_versets.py <fichier.mp3> <ref> [<ref> …]      ex. : cache/libre/qasas-cc0.mp3 28:16 28:20-21

La première fois, la sourate entière est transcrite en local (faster-whisper, mot à mot) et gardée dans
cache/libre/<fichier>.mots.json. Ensuite chaque verset est cherché dans la transcription (comparaison des
lettres arabes, sans voyelles), et ses bornes sont recalées dans le silence le plus proche.
Affiche la commande recitation_libre.py à lancer.
"""
import difflib
import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

from recitation_libre import lettres, mots_uthmani

ICI = Path(__file__).resolve().parent


def transcrire(source: Path):
    cache = source.with_suffix(".mots.json")
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    wav = source.with_suffix(".16k.wav")
    if not wav.exists():
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(source), "-ac", "1", "-ar", "16000", str(wav)], check=True)
    from faster_whisper import WhisperModel
    w = wave.open(str(wav))
    audio = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    segs, _ = WhisperModel("small", device="cpu", compute_type="int8").transcribe(
        audio, language="ar", word_timestamps=True, beam_size=5, vad_filter=False)
    mots = [[round(x.start, 3), round(x.end, 3), lettres(x.word)] for s in segs for x in s.words if lettres(x.word)]
    cache.write_text(json.dumps(mots, ensure_ascii=False), encoding="utf-8")
    return mots


def silences(source: Path):
    """Débuts et fins des silences (ffmpeg silencedetect)."""
    r = subprocess.run(["ffmpeg", "-i", str(source), "-af", "silencedetect=n=-38dB:d=0.35", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    debuts, fins = [], []
    for l in r.stderr.splitlines():
        if "silence_start:" in l:
            debuts.append(float(l.split("silence_start:")[1].split()[0]))
        elif "silence_end:" in l:
            fins.append(float(l.split("silence_end:")[1].split()[0]))
    return list(zip(debuts, fins))


def chercher(mots, cible: str, apres: float = 0.0):
    """Meilleure suite de mots entendus dont les lettres ressemblent à `cible`."""
    n = len(mots)
    meilleur = (0.0, 0, 0)
    for i in range(n):
        if mots[i][0] < apres:
            continue
        acc = ""
        for j in range(i, n):
            acc += mots[j][2]
            if len(acc) > len(cible) * 1.35:
                break
            if len(acc) >= len(cible) * 0.7:
                r = difflib.SequenceMatcher(None, acc, cible, autojunk=False).ratio()
                if r > meilleur[0]:
                    meilleur = (r, i, j)
    return meilleur


def main():
    source = Path(sys.argv[1])
    mots = transcrire(source)
    sil = silences(source)
    for ref in sys.argv[2:]:
        cible = "".join(lettres(m) for m in mots_uthmani(ref))
        score, i, j = chercher(mots, cible)
        a, b = mots[i][0], mots[j][1]
        # bornes dans le silence voisin : début = fin du silence juste avant, fin = début du silence juste après
        avant = [s for s in sil if s[1] <= a + 0.25]
        apres = [s for s in sil if s[0] >= b - 0.25]
        d = max(avant[-1][1] - 0.12, 0) if avant and a - avant[-1][1] < 2.5 else max(a - 0.3, 0)
        f = apres[0][0] + 0.25 if apres and apres[0][0] - b < 2.5 else b + 0.4
        print(f"{ref} : {d:.2f} -> {f:.2f} s ({f - d:.1f} s), ressemblance {score:.2f}")
        print(f"   python recitation_libre.py {source.as_posix()} {ref} {d:.2f} {f:.2f}")


if __name__ == "__main__":
    main()
