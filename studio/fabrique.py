"""Rayan's Studio : fabrique une vidéo verticale (1080x1920) à partir d'un script validé.

    python fabrique.py projets/ayati-mere-de-moussa.json

1. Versets vérifiés (texte, traduction Hamidullah et minutage mot à mot de la récitation : quran.com).
2. Voix : ElevenLabs si la clé est dans .env, sinon voix Microsoft de brouillon.
3. Bruitages (impact, flash, souffle, battement…) placés sur les mots marqués dans le script.
4. Chronologie + audio écrits dans animation/public/<slug>/, puis rendu de l'animation par Remotion.
Rien n'est publié : la vidéo atterrit dans sorties/ pour validation.
"""
import asyncio
import base64
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import requests

ICI = Path(__file__).resolve().parent
CACHE = ICI / "cache"
SORTIES = ICI / "sorties"
ANIM = ICI / "animation"
FPS = 30
TRADUCTION_HAMIDULLAH = 31
RECITATION_QURANCOM = 3          # Abdur-Rahman as-Sudais : minutage mot à mot disponible
VOIX_BROUILLON = "fr-FR-RemyMultilingualNeural"
PAUSE = 0.25                     # silence entre deux segments (s)
PAUSE_VERSET = 0.45
VOLUME_SFX = 0.22                # bruitages, par rapport à la voix
VOLUME_RECITATION = 0.6         # récitation, par rapport à la voix


def lire_env():
    env = {}
    f = ICI / ".env"
    if f.exists():
        for ligne in f.read_text(encoding="utf-8").splitlines():
            if "=" in ligne and not ligne.strip().startswith("#"):
                k, v = ligne.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def cle(*morceaux):
    return hashlib.sha1("|".join(map(str, morceaux)).encode()).hexdigest()[:16]


def duree(fichier):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                          str(fichier)], capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def ffmpeg(*args, cwd=None):
    r = subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *map(str, args)], cwd=cwd)
    if r.returncode:
        sys.exit(f"ffmpeg a échoué : {' '.join(map(str, args))[:400]}")


# ------------------------------------------------------------------ Coran (sources vérifiées)
def verset(ref):
    f = CACHE / f"verset2-{ref.replace(':', '-')}.json"
    if not f.exists():
        base = "https://api.quran.com/api/v4"
        v = requests.get(f"{base}/verses/by_key/{ref}", timeout=30, params={
            "translations": TRADUCTION_HAMIDULLAH, "fields": "text_uthmani", "words": "true",
            "word_fields": "text_uthmani"}).json()["verse"]
        fr = v["translations"][0]["text"]
        fr = re.sub(r"<sup.*?</sup>", "", fr)
        fr = re.sub(r"<[^>]+>", "", fr)
        fr = re.sub(r"\s+\d+$", "", fr).replace("  ", " ").strip()
        fr = re.sub(r'"([^"]*)"', "“\\1”", fr)
        mots = [w["text_uthmani"] for w in v["words"] if w["char_type_name"] == "word"]
        a = requests.get(f"{base}/recitations/{RECITATION_QURANCOM}/by_ayah/{ref}",
                         params={"fields": "segments"}, timeout=30).json()["audio_files"][0]
        audio = CACHE / f"recit-{RECITATION_QURANCOM}-{ref.replace(':', '-')}.mp3"
        url = a["url"] if a["url"].startswith("http") else f"https://verses.quran.com/{a['url']}"
        audio.write_bytes(requests.get(url, timeout=60).content)
        segs = [[int(s[0]), int(s[2]) / 1000, int(s[3]) / 1000] for s in a["segments"] if len(s) >= 4]
        f.write_text(json.dumps({"ref": ref, "arabe": v["text_uthmani"], "fr": fr, "mots": mots,
                                 "minutage": segs, "audio": audio.name}, ensure_ascii=False), encoding="utf-8")
    return json.loads(f.read_text(encoding="utf-8"))


# ------------------------------------------------------------------ Voix
BALISE = re.compile(r"\[[^\]]*\]")
API = "https://api.elevenlabs.io/v1"


def sans_balises(mots):
    """Retire les directions de jeu ([whispers], [dramatic tone]…) de la liste des mots minutés."""
    out, dedans = [], False
    for t0, t1, w in mots:
        if w.startswith("["):
            dedans = True
        if not dedans:
            out.append([t0, t1, w])
        if w.endswith("]") or "]" in w:
            dedans = False
    return out


def _mots_depuis_caracteres(al):
    mots, courant, debut, fin = [], "", None, 0
    for c, t0, t1 in zip(al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]):
        if c.isspace():
            if courant:
                mots.append([debut, fin, courant])
            courant, debut = "", None
        else:
            debut = t0 if debut is None else debut
            courant += c
            fin = t1
    if courant:
        mots.append([debut, fin, courant])
    return mots


def transcrire(audio, env):
    """Minutage mot à mot par la transcription ElevenLabs (si le modèle ne donne pas les temps)."""
    with open(audio, "rb") as fh:
        r = requests.post(f"{API}/speech-to-text", headers={"xi-api-key": env["ELEVENLABS_API_KEY"]},
                          data={"model_id": "scribe_v1", "language_code": "fr", "timestamps_granularity": "word"},
                          files={"file": (audio.name, fh, "audio/mpeg")}, timeout=300)
    if r.status_code != 200:
        sys.exit(f"Transcription ElevenLabs refusée ({r.status_code}) : {r.text[:300]}")
    return [[w["start"], w["end"], w["text"]] for w in r.json()["words"] if w.get("type", "word") == "word"]


def modele_expressif(modele):
    return "v3" in modele or "v4" in modele


def voix_elevenlabs(texte, voix_id, env, sortie, avant="", apres=""):
    """Une phrase du récit. `avant`/`apres` = le texte voisin : ElevenLabs garde ainsi la même voix,
    le même rythme et la même intonation d'un segment à l'autre (« request stitching »)."""
    modele = env.get("ELEVENLABS_MODEL") or "eleven_multilingual_v2"
    reglages = {"stability": float(env.get("ELEVENLABS_STABILITY") or 0.55), "similarity_boost": 0.85,
                "use_speaker_boost": True, "speed": float(env.get("ELEVENLABS_VITESSE") or 1.05)}
    if not modele_expressif(modele):
        reglages["style"] = float(env.get("ELEVENLABS_STYLE") or 0.2)
    entete = {"xi-api-key": env["ELEVENLABS_API_KEY"]}
    corps = {"text": texte, "model_id": modele, "voice_settings": reglages, "seed": 142,
             "language_code": "fr"}
    if not modele_expressif(modele):
        corps["previous_text"] = avant
        corps["next_text"] = apres
    r = requests.post(f"{API}/text-to-speech/{voix_id}/with-timestamps", headers=entete, json=corps, timeout=300)
    if r.status_code == 200 and (r.json().get("alignment") or r.json().get("normalized_alignment")):
        j = r.json()
        sortie.write_bytes(base64.b64decode(j["audio_base64"]))
        return sans_balises(_mots_depuis_caracteres(j.get("alignment") or j["normalized_alignment"]))
    if r.status_code != 200:
        sys.exit(f"ElevenLabs a refusé ({r.status_code}) : {r.text[:300]}")
    sys.exit("ElevenLabs n'a pas renvoyé le minutage des mots.")


def voix_brouillon(texte, voix, sortie):
    import edge_tts

    texte = re.sub(r"\s+", " ", BALISE.sub("", texte)).strip()

    async def run():
        mots, audio = [], bytearray()
        com = edge_tts.Communicate(texte, voix, rate="-2%", boundary="WordBoundary")
        async for m in com.stream():
            if m["type"] == "audio":
                audio.extend(m["data"])
            elif m["type"] == "WordBoundary":
                t0 = m["offset"] / 1e7
                mots.append([t0, t0 + m["duration"] / 1e7, m["text"]])
        sortie.write_bytes(bytes(audio))
        return mots

    return asyncio.run(run())


def narration(seg, projet, env, avant="", apres=""):
    """`texte` = ce qui s'affiche et ce que dit la voix. `voix` (texte avec directions entre crochets)
    ne sert qu'aux modèles expressifs (v3/v4)."""
    texte = seg["texte"]
    modele = env.get("ELEVENLABS_MODEL") or "eleven_multilingual_v2"
    a_dire = (seg.get("voix") or texte) if modele_expressif(modele) else texte
    voix_id = projet.get("voix_elevenlabs") or env.get("ELEVENLABS_VOICE_ID")
    moteur = "elevenlabs" if env.get("ELEVENLABS_API_KEY") and voix_id else "brouillon"
    k = cle(moteur, a_dire, voix_id, modele, avant, apres, env.get("ELEVENLABS_STABILITY"),
            env.get("ELEVENLABS_STYLE"), env.get("ELEVENLABS_VITESSE")) if moteur == "elevenlabs" \
        else cle(moteur, texte, VOIX_BROUILLON)
    audio, meta = CACHE / f"voix-{k}.mp3", CACHE / f"voix-{k}.json"
    if not (audio.exists() and meta.exists()):
        mots = voix_elevenlabs(a_dire, voix_id, env, audio, avant, apres) if moteur == "elevenlabs" else \
            voix_brouillon(texte, VOIX_BROUILLON, audio)
        meta.write_text(json.dumps(mots, ensure_ascii=False), encoding="utf-8")
    mots = json.loads(meta.read_text(encoding="utf-8"))
    if moteur == "elevenlabs":
        audio, mots = resserrer(audio, mots, float(projet.get("blanc_max", 0.45)))
    return audio, aligner(texte, mots), moteur


def resserrer(audio, mots, blanc_max):
    """Raccourcit les blancs trop longs entre deux mots (et en début/fin), en recalant le minutage."""
    sortie = audio.with_name(audio.stem + f"-serre2-{int(blanc_max * 100)}.wav")
    garder, decal, nouveaux = [], 0.0, []
    debut = max(0.0, mots[0][0] - 0.08)
    curseur = debut
    for i, (t0, t1, w) in enumerate(mots):
        if i:
            trou = t0 - mots[i - 1][1]
            if trou > blanc_max + 0.2:   # on ne touche qu'aux vrais trous
                coupe_a = mots[i - 1][1] + blanc_max / 2
                coupe_b = t0 - blanc_max / 2
                garder.append((curseur, coupe_a))
                curseur = coupe_b
        nouveaux.append(t0)
    fin = mots[-1][1] + 0.15
    garder.append((curseur, fin))
    # recalage : temps dans le nouvel audio
    def nouveau_temps(t):
        acc = 0.0
        for a, b in garder:
            if t <= b:
                return acc + max(0.0, t - a)
            acc += b - a
        return acc
    mots2 = [[round(nouveau_temps(t0), 3), round(nouveau_temps(t1), 3), w] for t0, t1, w in mots]
    if not sortie.exists():
        fondu = 0.025  # fondus très courts aux points de coupe : plus de « clic » ni de mot tranché
        parts = "".join(f"[0:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,afade=t=in:d={fondu},"
                        f"afade=t=out:st={max(0, b - a - fondu):.3f}:d={fondu}[p{k}];" for k, (a, b) in enumerate(garder))
        parts += "".join(f"[p{k}]" for k in range(len(garder))) + f"concat=n={len(garder)}:v=0:a=1[out]"
        ffmpeg("-i", audio, "-filter_complex", parts, "-map", "[out]", "-ar", "44100", sortie)
    return sortie, mots2


def _norm(s):
    return re.sub(r"[^\w]", "", s.lower())


def jetons(texte):
    """Mots du texte, la ponctuation isolée (« » : ?) collée au mot voisin."""
    brut, out, ouvrant = texte.split(), [], ""
    for b in brut:
        if _norm(b):
            out.append(ouvrant + b)
            ouvrant = ""
        elif b in ("«", "(", "“"):
            ouvrant += b + " "
        elif out:
            out[-1] += " " + b
    return out


def aligner(texte, mots):
    """Remet le texte original (avec sa ponctuation) sur les temps des mots du TTS."""
    tj = jetons(texte)
    sortie, j, pris = [], 0, 0
    for t0, t1, w in mots:
        n = len(_norm(w))
        if not n or j >= len(tj):
            continue
        cible = _norm(tj[j])
        if pris == 0:
            sortie.append([t0, t1, tj[j]])
        else:
            sortie[-1][1] = t1
        if cible.startswith(cible[:pris] + _norm(w)) and pris + n < len(cible):
            pris += n
        else:
            j, pris = j + 1, 0
    for reste in tj[j:]:
        if sortie:
            sortie[-1][2] += " " + reste
    return sortie


# ------------------------------------------------------------------ Bruitages (fabriqués, sans droits)
SFX = {
    "impact": "aevalsrc='0.9*sin(2*PI*(75*t-14*t*t))*exp(-3.2*t)+0.35*(random(0)*2-1)*exp(-28*t)':d=1.4:s=44100",
    "flash": "aevalsrc='0.22*sin(2*PI*(900+2600*t)*t)*exp(-4*t)+0.2*(random(0)*2-1)*exp(-9*t)':d=0.9:s=44100",
    "whoosh": "aevalsrc='0.5*(random(0)*2-1)*sin(PI*t/0.9)^3':d=0.9:s=44100",
    "pop": "aevalsrc='0.7*sin(2*PI*(380+1100*t)*t)*exp(-16*t)':d=0.3:s=44100",
    "battement": "aevalsrc='0.9*sin(2*PI*48*t)*(exp(-22*t)+0.8*gte(t,0.3)*exp(-22*(t-0.3)))':d=0.9:s=44100",
    "secousse": "aevalsrc='0.6*(random(0)*2-1)*exp(-6*t)':d=0.6:s=44100",
    "zoom": "aevalsrc='0.4*(random(0)*2-1)*(t/0.5)^2*lt(t,0.5)':d=0.55:s=44100",
}
FILTRE_SFX = {"whoosh": "bandpass=f=900:w=1400,", "secousse": "lowpass=f=180,", "zoom": "highpass=f=400,",
              "flash": "highpass=f=500,", "impact": "lowpass=f=2500,"}


def sfx(nom):
    f = CACHE / "sfx" / f"{nom}.wav"
    if not f.exists():
        f.parent.mkdir(exist_ok=True)
        ffmpeg("-f", "lavfi", "-i", SFX[nom], "-af", f"{FILTRE_SFX.get(nom, '')}aformat=channel_layouts=stereo", f)
    return f


# ------------------------------------------------------------------ Assemblage
def fabriquer(chemin_projet, rendre=True):
    projet = json.loads(Path(chemin_projet).read_text(encoding="utf-8"))
    env = lire_env()
    CACHE.mkdir(exist_ok=True)
    SORTIES.mkdir(exist_ok=True)
    pub = ANIM / "public" / projet["slug"]
    pub.mkdir(parents=True, exist_ok=True)
    style = projet.get("style", "ayati")

    t, pistes, segs, cues, moteurs = 0.4, [], [], [], set()   # 0,4 s d'image avant la première phrase
    fr = lambda s: int(round(s * FPS))
    recits = [s.get("texte", "") if s["type"] == "narration" else "" for s in projet["segments"]]
    for n_seg, seg in enumerate(projet["segments"]):
        out = {"type": seg["type"], "scene": seg["scene"], "ref": seg.get("ref")}
        if seg["type"] == "verset":
            v = verset(seg["ref"])
            audio, minutage, recitateur = CACHE / v["audio"], v["minutage"], "as-Sudais"
            if projet.get("recitation") == "libre":   # récitation libre de droits (recitation_libre.py)
                nom = seg["ref"].replace(":", "-")
                libre = json.loads((CACHE / "libre" / f"{nom}.json").read_text(encoding="utf-8"))
                audio, minutage = CACHE / "libre" / f"{nom}.mp3", libre["minutage"]
                recitateur = projet.get("recitateur_nom", "récitation libre (CC0)")
            d = duree(audio)
            out["verset"] = {"arabe": v["mots"], "fr": v["fr"], "ref": seg["ref"], "recitateur": recitateur,
                             "sourate": projet.get("sourates", {}).get(seg["ref"].split(":")[0], "Sourate"),
                             "minutage": [[i, fr(t + a), fr(t + b)] for i, a, b in minutage]}
            fin = t + d + PAUSE_VERSET
            cues.append({"frame": fr(t), "type": "flash_doux"})
            print(f"  verset {seg['ref']} : {d:.1f} s ({recitateur})")
        else:
            avant = " ".join(x for x in recits[max(0, n_seg - 2):n_seg] if x)
            apres = next((x for x in recits[n_seg + 1:] if x), "")
            audio, mots, moteur = narration(seg, projet, env, avant, apres)
            moteurs.add(moteur)
            d = duree(audio)
            fin = t + d + PAUSE
            out["mots"] = [{"debut": fr(t + a), "fin": fr(t + b), "texte": w} for a, b, w in mots]
            accents = seg.get("accents", {})
            for mot, effet in accents.items():
                for m in out["mots"]:
                    if _norm(m["texte"]) == _norm(mot) or m["texte"].replace(" ", " ").startswith(mot):
                        type_, _, icone = effet.partition(":")
                        cues.append({"frame": m["debut"], "type": type_, "icone": icone or None})
                        pistes.append((sfx(type_ if type_ in SFX else "pop"), m["debut"] / FPS, VOLUME_SFX))
                        break
                else:
                    print(f"    ! accent introuvable : {mot}")
            if seg.get("titre"):
                cible = seg["titre"]["mot"]
                m = next((m for m in out["mots"] if m["texte"].replace(" ", " ").startswith(cible)), out["mots"][0])
                out["titre"] = {"frame": m["debut"], "texte": seg["titre"]["texte"]}
            print(f"  narration ({seg['scene']}) : {d:.1f} s")
        pistes.append((audio, t, VOLUME_RECITATION if seg["type"] == "verset" else 1.0))
        out["debut"], out["fin"] = fr(t), fr(fin)
        segs.append(out)
        t = fin
    t += 0.6
    total = fr(t)

    # ---- audio : voix + récitations + bruitages + ambiance
    entrees, filtres = [], []
    for k, (a, debut, vol) in enumerate(pistes):
        entrees += ["-i", a]
        ms = int(debut * 1000)
        filtres.append(f"[{k}:a]aresample=44100,aformat=channel_layouts=stereo,volume={vol},adelay={ms}|{ms}[a{k}]")
    mix = "".join(f"[a{k}]" for k in range(len(pistes)))
    n = len(pistes)
    if style == "ayati":   # vent et eau, très bas
        amb = "anoisesrc=color=brown:amplitude=0.5:seed=7"
        chaine = "lowpass=f=420,highpass=f=70,volume=0.06"
    else:                  # nappe grave discrète
        amb = "aevalsrc='0.05*sin(2*PI*55*t)+0.035*sin(2*PI*82.4*t)*(0.6+0.4*sin(2*PI*0.2*t))+0.02*sin(2*PI*110*t)':s=44100"
        chaine = "volume=0.9"
    entrees += ["-f", "lavfi", "-t", f"{t:.2f}", "-i", amb]
    filtres.append(f"[{n}:a]{chaine},afade=t=in:d=1.5,afade=t=out:st={t - 2:.2f}:d=2,aformat=channel_layouts=stereo[amb]")
    filtres.append(f"{mix}[amb]amix=inputs={n + 1}:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.5:LRA=11[aout]")
    ffmpeg(*entrees, "-filter_complex", ";".join(filtres), "-map", "[aout]", "-t", f"{t:.2f}", "-ar", "44100",
           pub / "audio.wav")

    timeline = {"slug": projet["slug"], "style": style, "fps": FPS, "duree": total,
                "marque": projet.get("marque"), "segments": segs, "cues": sorted(cues, key=lambda c: c["frame"]),
                "audio": f"{projet['slug']}/audio.wav", "brouillon": moteurs != {"elevenlabs"}}
    chemin_tl = pub / "timeline.json"
    chemin_tl.write_text(json.dumps(timeline, ensure_ascii=False, indent=1), encoding="utf-8")
    polices = ANIM / "public" / "polices"
    if not polices.exists():
        shutil.copytree(ICI / "polices", polices)
    voix = "ElevenLabs" if not timeline["brouillon"] else "voix de BROUILLON (Microsoft)"
    print(f"Chronologie prête : {t:.1f} s, {voix}")

    if rendre:
        sortie = SORTIES / f"{projet['slug']}.mp4"
        r = subprocess.run(["npx", "remotion", "render", "src/index.ts", "Video", str(sortie),
                            f"--props={chemin_tl}", "--codec=h264", "--crf=18", "--log=error"],
                           cwd=ANIM, shell=sys.platform == "win32")
        if r.returncode:
            sys.exit("Le rendu Remotion a échoué.")
        print(f"\nVidéo prête : {sortie}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    fabriquer(sys.argv[1], rendre="--sans-rendu" not in sys.argv)
