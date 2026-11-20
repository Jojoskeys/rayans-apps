"""Contrôle d'une vidéo avant de la déposer : planche d'images + son.

    python controle.py <slug> [<slug> …]

- Planche : 18 images prises à intervalles réguliers → sorties/planches/<slug>.jpg
- Son, mesuré par ffmpeg (ebur128) :
  - volume intégré (cible TikTok/YouTube : -14 LUFS ± 1) et crête vraie (≤ -1 dBTP, tolérance -0,5) ;
  - saturation : échantillons collés au maximum (aucun accepté) ;
  - voix au-dessus du fond : niveau pendant la voix moins niveau du fond seul (ambiance, bruitages, musique),
    d'après la chronologie animation/public/<slug>/timeline.json (au moins 10 dB).
Le résumé du son est ajouté automatiquement à la note de dépôt (a_valider.py envoyer).
L'écoute fine (clics, timbre) se fait à part avec earshot (critique).
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
SORTIES = ICI / "sorties"
PUBLIC = ICI / "animation" / "public"

CIBLE_LUFS = -14.0
TOLERANCE_LUFS = 1.0
CRETE_MAX = -0.5        # dBTP
MARGE_VOIX_MIN = 10.0   # dB
SATURE = 0.999


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


def ebur128(src: Path) -> dict:
    """Volume intégré (LUFS), plage (LU) et crête vraie (dBTP) mesurés par ffmpeg."""
    r = subprocess.run(["ffmpeg", "-nostats", "-i", str(src), "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    resume = r.stderr[r.stderr.rfind("Summary:"):]
    lra = re.search(r"LRA:\s+(-?[\d.]+) LU", resume)
    return {"lufs": float(re.search(r"I:\s+(-?[\d.]+) LUFS", resume).group(1)),
            "crete": float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", resume).group(1)),
            "lra": float(lra.group(1)) if lra else None}


def volume(slug: str):
    m = ebur128(SORTIES / f"{slug}.mp4")
    return m["lufs"], m["crete"]


def pcm(src: Path, sr: int = 44100):
    """Le son en échantillons flottants (stéréo entrelacée)."""
    import numpy as np
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(src), "-vn", "-ac", "2", "-ar", str(sr),
                        "-f", "f32le", "-"], capture_output=True)
    return np.frombuffer(r.stdout, np.float32).reshape(-1, 2)


def zones_voix(timeline: dict) -> list[tuple[float, float]]:
    """Moments (s) où la voix ou la récitation parle, d'après la chronologie."""
    fps = timeline.get("fps", 30)
    out = []
    for s in timeline.get("segments", []):
        if s.get("type") == "verset":
            out.append((s["debut"] / fps, s["fin"] / fps))
        for m in s.get("mots") or []:
            out.append((m["debut"] / fps, m["fin"] / fps))
    return sorted(out)


def zones_fond(voix: list[tuple[float, float]], total: float, marge: float = 0.15) -> list[tuple[float, float]]:
    """Le reste : là où on n'entend que le fond (ambiance, bruitages, musique)."""
    out, t = [], 0.0
    for a, b in voix:
        if a - marge > t + 0.05:
            out.append((t, a - marge))
        t = max(t, b + marge)
    if total - t > 0.05:
        out.append((t, total))
    return out


def niveau_db(x, zones: list[tuple[float, float]], sr: int) -> float | None:
    import numpy as np
    morceaux = [x[int(a * sr):int(b * sr)] for a, b in zones if b > a]
    morceaux = [m for m in morceaux if len(m)]
    if not morceaux or sum(len(m) for m in morceaux) < sr * 0.5:
        return None
    # niveau médian par fenêtres de 50 ms : un bruitage isolé ne fausse pas la mesure du fond
    y = np.concatenate(morceaux).mean(axis=1) if np.ndim(morceaux[0]) == 2 else np.concatenate(morceaux)
    w = max(1, sr // 20)
    n = len(y) // w
    if n == 0:
        return None
    rms = np.sqrt(np.mean(np.square(y[:n * w].reshape(n, w), dtype=np.float64), axis=1))
    return float(np.median(20 * np.log10(np.maximum(rms, 1e-9))))


def mesurer_son(src: Path, timeline: dict | None = None, sr: int = 44100) -> dict:
    m = ebur128(src)
    x = pcm(src, sr)
    m["satures"] = int((abs(x) >= SATURE).any(axis=1).sum()) if len(x) else 0
    m["marge_voix"] = None
    if timeline and len(x):
        voix = zones_voix(timeline)
        a, b = niveau_db(x, voix, sr), niveau_db(x, zones_fond(voix, len(x) / sr), sr)
        if a is not None and b is not None:
            m["marge_voix"] = round(a - b, 1)
    return m


def avis_son(m: dict) -> list[str]:
    """Liste des problèmes (vide = son OK)."""
    out = []
    if abs(m["lufs"] - CIBLE_LUFS) > TOLERANCE_LUFS:
        out.append(f"volume {m['lufs']:.1f} LUFS (cible {CIBLE_LUFS:.0f})")
    if m["crete"] > CRETE_MAX:
        out.append(f"crête {m['crete']:.1f} dBTP (max -1)")
    if m.get("satures"):
        out.append(f"saturation : {m['satures']} échantillons au maximum")
    if m.get("marge_voix") is not None and m["marge_voix"] < MARGE_VOIX_MIN:
        out.append(f"voix seulement {m['marge_voix']:.1f} dB au-dessus du fond (min {MARGE_VOIX_MIN:.0f})")
    return out


def lire_timeline(slug: str) -> dict | None:
    p = PUBLIC / slug / "timeline.json"
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def resume_son(slug: str) -> str:
    """Une ligne pour la note de dépôt."""
    m = mesurer_son(SORTIES / f"{slug}.mp4", lire_timeline(slug))
    marge = f", voix +{m['marge_voix']:.0f} dB sur le fond" if m.get("marge_voix") is not None else ""
    pbs = avis_son(m)
    etat = "OK" if not pbs else "À REVOIR (" + " ; ".join(pbs) + ")"
    return f"Son : {m['lufs']:.1f} LUFS, crête {m['crete']:.1f} dBTP, saturation {m['satures']}{marge} → {etat}"


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    for slug in sys.argv[1:]:
        p = planche(slug)
        print(f"{slug} : {duree(SORTIES / f'{slug}.mp4'):.1f} s — planche {p}\n  {resume_son(slug)}")


if __name__ == "__main__":
    main()
