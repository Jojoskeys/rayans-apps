"""Rayan's Studio : fabrique une vidéo verticale (1080x1920) à partir d'un script validé.

    python fabrique.py projets/ayati-mere-de-moussa.json

1. Versets vérifiés (texte, traduction Hamidullah et minutage mot à mot de la récitation : quran.com).
2. Voix : ElevenLabs si la clé est dans .env, sinon voix Microsoft de brouillon.
3. Bruitages (impact, flash, souffle, battement…) placés sur les mots marqués dans le script.
4. Chronologie + audio écrits dans animation/public/<slug>/, puis rendu de l'animation par Remotion.
Rien n'est publié : la vidéo atterrit dans sorties/ pour validation.
Avec "format": "long" dans le projet : vidéo 16:9 (voir longue.py). Relire REGLES.md avant chaque vidéo.
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

from regles import SHORT_MAX, avis_duree

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
    """Un verset ('28:7') ou une suite de versets ('105:1-5', texte et traduction mis bout à bout)."""
    s, a = ref.split(":")
    if "-" in a:
        d, f_ = map(int, a.split("-"))
        parts = [verset(f"{s}:{i}") for i in range(d, f_ + 1)]
        parties, k = [], 0
        for num, p in zip(range(d, f_ + 1), parts):   # pour afficher un verset à la fois
            parties.append({"num": num, "de": k, "a": k + len(p["mots"]), "fr": p["fr"]})
            k += len(p["mots"])
        return {"ref": ref, "mots": [m for p in parts for m in p["mots"]],
                "fr": " ".join(f"({i}) {p['fr']}" for i, p in zip(range(d, f_ + 1), parts)),
                "minutage": [], "audio": None, "parties": parties}
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


def voix_elevenlabs(texte, voix_id, env, sortie, avant="", apres="", jeu=None):
    """Une phrase du récit. `avant`/`apres` = le texte voisin : ElevenLabs garde ainsi la même voix,
    le même rythme et la même intonation d'un segment à l'autre (« request stitching »)."""
    modele = env.get("ELEVENLABS_MODEL") or "eleven_multilingual_v2"
    reglages = {"stability": float(env.get("ELEVENLABS_STABILITY") or 0.55), "similarity_boost": 0.85,
                "use_speaker_boost": True, "speed": float(env.get("ELEVENLABS_VITESSE") or 1.05)}
    if not modele_expressif(modele):
        reglages["style"] = float(env.get("ELEVENLABS_STYLE") or 0.2)
    reglages.update(jeu or {})          # jeu propre au compte (projet "voix_reglages") : énergie, débit
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
    jeu = projet.get("voix_reglages") or {}
    k = cle(moteur, a_dire, voix_id, modele, avant, apres, json.dumps(jeu, sort_keys=True), env.get("ELEVENLABS_STABILITY"),
            env.get("ELEVENLABS_STYLE"), env.get("ELEVENLABS_VITESSE")) if moteur == "elevenlabs" \
        else cle(moteur, texte, VOIX_BROUILLON)
    audio, meta = CACHE / f"voix-{k}.mp3", CACHE / f"voix-{k}.json"
    if not (audio.exists() and meta.exists()):
        mots = voix_elevenlabs(a_dire, voix_id, env, audio, avant, apres, jeu) if moteur == "elevenlabs" else \
            voix_brouillon(texte, VOIX_BROUILLON, audio)
        meta.write_text(json.dumps(mots, ensure_ascii=False), encoding="utf-8")
    mots = json.loads(meta.read_text(encoding="utf-8"))
    if moteur == "elevenlabs":
        # Collage des mots arabes : DÉSACTIVÉ par défaut (Rayan, 18/11 : l'intonation casse, on entend le raccord).
        # La bonne prononciation doit venir de la voix elle-même, d'une seule traite.
        arabe = {**ARABE, **(projet.get("arabe") or {})} if projet.get("coller_mots_arabes") else {}
        audio, mots = nettoyer_voix(audio, mots, float(projet.get("blanc_max", 0.45)), arabe, voix_id, env)
    return audio, aligner(texte, mots), moteur


# ------------------------------------------------------------------ Voix : prononciation arabe et blancs
# Mots arabes : la voix française les dit « à la française » (Qâroûn → « Karoun »). On génère le mot seul,
# en arabe, avec la même voix (elle dit alors bien le ق, le ح, le ه…) et on le pose à la place du mot
# français. Le texte affiché ne change pas. Un projet peut compléter la liste avec "arabe": {...}.
ARABE = {
    "Allah": "اللَّه",
    "Qâroûn": "قَارُون",
    "Hâmân": "هَامَان",
    "Moussa": "مُوسَى",
    "Abraha": "أَبْرَهَة",
    "Kaaba": "كَعْبَة",
    "Abdel-Mouttalib": "عَبْدُ الْمُطَّلِب",
    "Muhammad": "مُحَمَّد",
    "Sîra": "سِيرَة",
}
SR = 44100
APOS = "'’"


def _lire_pcm(fichier):
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(fichier), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def _ecrire_wav(fichier, x):
    import numpy as np
    import wave
    y = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(fichier), "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(SR)
        w.writeframes(y.tobytes())


def _enveloppe(x, pas=0.01):
    import numpy as np
    n = int(SR * pas)
    m = len(x) // n
    return np.sqrt(np.mean(x[: m * n].reshape(m, n) ** 2, axis=1) + 1e-12), pas


def _fondu(x, debut, fin):
    import numpy as np
    x = x.copy()
    a, b = int(SR * debut), int(SR * fin)
    if a:
        x[:a] *= np.linspace(0, 1, min(a, len(x)))
    if b:
        x[-b:] *= np.linspace(1, 0, min(b, len(x)))
    return x


def mot_arabe(ar, voix_id, env):
    """Le mot dit seul, en arabe, par la même voix ; silences retirés. Mis en cache."""
    f = CACHE / f"arabe-{cle(ar, voix_id)}.mp3"
    if not f.exists():
        corps = {"text": ar, "model_id": "eleven_multilingual_v2", "seed": 142,
                 "voice_settings": {"stability": 0.5, "similarity_boost": 0.85, "style": 0.3, "use_speaker_boost": True}}
        r = requests.post(f"{API}/text-to-speech/{voix_id}", headers={"xi-api-key": env["ELEVENLABS_API_KEY"]},
                          json=corps, timeout=120)
        if r.status_code != 200:
            sys.exit(f"ElevenLabs a refusé le mot arabe {ar} ({r.status_code}) : {r.text[:200]}")
        f.write_bytes(r.content)
    x = _lire_pcm(f)
    env_, pas = _enveloppe(x)
    actif = (env_ > env_.max() * 0.06).nonzero()[0]
    a, b = int(actif[0] * pas * SR), int((actif[-1] + 1) * pas * SR)
    return _fondu(x[a:b], 0.012, 0.03)


def _decouper(mot, arabe):
    """('d'Allah.', dico) -> (préfixe, forme arabe) si le mot est dans la liste, sinon None."""
    coeur = mot.strip("«»“”\"()[],.;:!?…")
    prefixe = ""
    for p in ("d", "l", "qu", "D", "L", "Qu"):
        for ap in APOS:
            if coeur.startswith(p + ap) and coeur[len(p) + 1:] in arabe:
                prefixe, coeur = coeur[: len(p) + 1], coeur[len(p) + 1:]
    return (prefixe, arabe[coeur]) if coeur in arabe else None


def nettoyer_voix(audio, mots, blanc_max, arabe, voix_id, env):
    """1. Remplace les mots arabes par leur vraie prononciation.
    2. Raccourcit les vrais blancs en coupant DANS LE SILENCE : la fin de phrase s'éteint naturellement et
       l'inspiration qu'ElevenLabs ajoute avant la phrase suivante est retirée (plus de souffle tranché net).
    Rend un wav et le minutage recalé."""
    import numpy as np
    sig = cle(json.dumps(sorted(arabe.items()), ensure_ascii=False), blanc_max, "net3")
    sortie = audio.with_name(audio.stem + f"-net-{sig[:8]}.wav")
    meta = sortie.with_suffix(".json")
    if sortie.exists() and meta.exists():
        return sortie, json.loads(meta.read_text(encoding="utf-8"))

    x = _lire_pcm(audio)
    mots = [list(m) for m in mots]

    # --- 1. mots arabes (du dernier au premier, pour ne pas décaler ceux qu'on n'a pas encore traités)
    for i in range(len(mots) - 1, -1, -1):
        t0, t1, w = mots[i]
        d = _decouper(w, arabe)
        if not d:
            continue
        prefixe, ar = d
        lettres = len(re.sub(r"[^\w]", "", w)) or 1
        a = t0 + (t1 - t0) * len(re.sub(r"[^\w]", "", prefixe)) / lettres
        ia, ib = int(a * SR), int(t1 * SR)
        clip = mot_arabe(ar, voix_id, env)
        rms_fr = float(np.sqrt(np.mean(x[ia:ib] ** 2) + 1e-12))
        rms_ar = float(np.sqrt(np.mean(clip ** 2) + 1e-12))
        clip = clip * min(2.5, rms_fr / rms_ar)
        xf = int(0.015 * SR)                         # fondu enchaîné de 15 ms aux deux raccords
        if ia < xf or len(clip) < 3 * xf or len(x) - ib < xf:
            continue
        L = len(clip)
        x = np.concatenate([
            x[: ia - xf],
            x[ia - xf: ia] * np.linspace(1, 0, xf) + clip[:xf],      # le français s'efface, l'arabe arrive
            clip[xf: L - xf],
            clip[L - xf:] + x[ib: ib + xf] * np.linspace(0, 1, xf),  # l'arabe s'efface, la suite revient
            x[ib + xf:],
        ]).astype(np.float32)
        debut = (ia - xf) / SR
        delta = (L - 2 * xf - (ib - ia)) / SR
        mots[i] = [t0 if prefixe else debut, debut + L / SR, w]
        for j in range(i + 1, len(mots)):
            mots[j] = [mots[j][0] + delta, mots[j][1] + delta, mots[j][2]]

    # --- 2. blancs : on coupe au silence
    env_, pas = _enveloppe(x)
    crete = float(np.percentile(env_, 95)) or 1e-6
    calme = crete * 0.035                            # ~ -29 dB sous la voix : silence ou fin de souffle

    def fin_de_son(t, limite):
        """Premier instant calme après t (la fin du mot s'éteint), avant `limite`."""
        k = int(t / pas)
        while k < len(env_) and k * pas < limite:
            if env_[k] < calme:
                return k * pas
            k += 1
        return min(t + 0.12, limite)

    def debut_de_son(t, limite):
        """Dernier instant calme avant t (on laisse l'inspiration de côté), après `limite`."""
        k = int(t / pas)
        while k > 0 and k * pas > limite:
            if env_[k - 1] < calme:
                return k * pas
            k -= 1
        return max(t - 0.05, limite)

    morceaux = []                                    # ("src", a, b) ou ("blanc", durée)
    curseur = debut_de_son(mots[0][0], max(0.0, mots[0][0] - 0.3))
    for i in range(1, len(mots)):
        e, s = mots[i - 1][1], mots[i][0]
        if s - e > blanc_max + 0.2:
            q = fin_de_son(e, min(s, e + 0.35))
            p = debut_de_son(s, max(q, s - 0.3))
            morceaux += [("src", curseur, q), ("blanc", blanc_max)]
            curseur = p
    fin = fin_de_son(mots[-1][1], mots[-1][1] + 0.35)
    morceaux += [("src", curseur, fin), ("blanc", 0.06)]

    sorties, carte, acc = [], [], 0.0
    for m in morceaux:
        if m[0] == "blanc":
            sorties.append(np.zeros(int(m[1] * SR), dtype=np.float32))
            acc += m[1]
        else:
            _, a, b = m
            sorties.append(_fondu(x[int(a * SR): int(b * SR)], 0.02, 0.04))
            carte.append((a, b, acc))
            acc += b - a

    def nouveau(t):
        for a, b, base in carte:
            if t <= b:
                return base + max(0.0, t - a)
        a, b, base = carte[-1]
        return base + (b - a)

    mots2 = [[round(nouveau(t0), 3), round(nouveau(t1), 3), w] for t0, t1, w in mots]
    _ecrire_wav(sortie, np.concatenate(sorties))
    meta.write_text(json.dumps(mots2, ensure_ascii=False), encoding="utf-8")
    return sortie, mots2


# ------------------------------------------------------------------ Voix lue par Rayan (Ayati)
# Rayan lit tout le texte d'une vidéo en une prise ("enregistrement": "enregistrements/<slug>.m4a").
# ElevenLabs « voice changer » garde SA prononciation (Qâroûn avec le ق, Allah…) et SON intonation, avec le
# timbre de Paul K. La transcription donne le temps de chaque mot ; on retrouve chaque phrase du script dedans.
def preparer_enregistrement(projet, env):
    import difflib
    src = ICI / projet["enregistrement"]
    if not src.exists():   # peu importe le format : m4a de l'iPhone, mp3, wav…
        autres = sorted(src.parent.glob(src.stem + ".*"))
        if not autres:
            sys.exit(f"Enregistrement introuvable : {src} (dépose le fichier dans {src.parent})")
        src = autres[0]
    voix_id = projet.get("voix_elevenlabs") or env.get("ELEVENLABS_VOICE_ID")
    transformer = projet.get("transformer_voix", True)
    k = cle(src.name, src.stat().st_size, src.stat().st_mtime_ns, voix_id if transformer else "brut", "enr1")
    audio = CACHE / f"enr-{k}.mp3"
    mots_f = CACHE / f"enr-{k}.json"
    if not audio.exists():
        propre = CACHE / f"enr-{k}-source.mp3"
        ffmpeg("-i", src, "-ac", "1", "-ar", "44100", "-b:a", "192k", propre)
        if transformer:
            with open(propre, "rb") as fh:
                r = requests.post(f"{API}/speech-to-speech/{voix_id}", headers={"xi-api-key": env["ELEVENLABS_API_KEY"]},
                                  data={"model_id": "eleven_multilingual_sts_v2", "remove_background_noise": "true",
                                        "voice_settings": json.dumps({"stability": 0.5, "similarity_boost": 0.9})},
                                  files={"audio": (propre.name, fh, "audio/mpeg")}, timeout=600)
            if r.status_code != 200:
                sys.exit(f"Transformation de voix refusée ({r.status_code}) : {r.text[:300]}")
            audio.write_bytes(r.content)
        else:
            shutil.copy(propre, audio)
        print(f"  enregistrement {'transformé en Paul K' if transformer else 'gardé tel quel'} : {duree(audio):.1f} s")
    if not mots_f.exists():
        mots_f.write_text(json.dumps(transcrire_local(audio), ensure_ascii=False), encoding="utf-8")
    entendus = json.loads(mots_f.read_text(encoding="utf-8"))

    # Tous les mots du script, dans l'ordre, rattachés à leur segment.
    script = [(n, tok) for n, s in enumerate(projet["segments"]) if s["type"] == "narration" for tok in jetons(s["texte"])]
    a = [_norm(t) for _, t in script]
    b = [_norm(w) for _, _, w in entendus]
    temps = [None] * len(script)
    for bloc in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        for k_ in range(bloc.size):
            t0, t1, _ = entendus[bloc.b + k_]
            temps[bloc.a + k_] = [t0, t1]
    # Mots non retrouvés (noms arabes transcrits autrement…) : placés entre leurs voisins retrouvés.
    connus = [i for i, t in enumerate(temps) if t]
    if len(connus) < len(script) * 0.6:
        sys.exit(f"L'enregistrement ne correspond pas au script ({len(connus)}/{len(script)} mots retrouvés).")
    for i in range(len(temps)):
        if temps[i]:
            continue
        g = max((j for j in connus if j < i), default=None)
        d = min((j for j in connus if j > i), default=None)
        t_g = temps[g][1] if g is not None else (temps[d][0] - 0.4 if d is not None else 0)
        t_d = temps[d][0] if d is not None else t_g + 0.4
        n_trou = (d if d is not None else len(temps)) - (g if g is not None else -1) - 1
        pos = i - (g if g is not None else -1) - 1
        pas_ = (t_d - t_g) / max(1, n_trou)
        temps[i] = [t_g + pos * pas_, t_g + (pos + 1) * pas_]
    par_seg = {}
    for (n, tok), t in zip(script, temps):
        par_seg.setdefault(n, []).append([t[0], t[1], tok])
    print(f"  enregistrement : {len(connus)}/{len(script)} mots du script retrouvés")
    return audio, par_seg


def transcrire_local(audio):
    """Minutage mot à mot avec faster-whisper (local, gratuit)."""
    from faster_whisper import WhisperModel
    x = _lire_pcm(audio)
    import numpy as np
    x16 = x[:: SR // 16000] if SR % 16000 == 0 else np.interp(np.arange(0, len(x), SR / 16000), np.arange(len(x)), x).astype(np.float32)
    segs, _ = WhisperModel("small", device="cpu", compute_type="int8").transcribe(
        x16, language="fr", word_timestamps=True, beam_size=5, condition_on_previous_text=False)
    return [[round(w.start, 3), round(w.end, 3), w.word.strip()] for s in segs for w in s.words if w.word.strip()]


def narration_enregistree(n_seg, seg, projet, env):
    if "_enr" not in projet:
        projet["_enr"] = preparer_enregistrement(projet, env)
    audio, par_seg = projet["_enr"]
    mots = par_seg[n_seg]
    a, b = max(0.0, mots[0][0] - 0.3), mots[-1][1] + 0.45
    morceau = CACHE / f"{audio.stem}-seg{n_seg}-{cle(a, b)[:6]}.wav"
    if not morceau.exists():
        ffmpeg("-ss", f"{a:.3f}", "-to", f"{b:.3f}", "-i", audio, "-ac", "1", "-ar", str(SR), morceau)
    relatifs = [[round(t0 - a, 3), round(t1 - a, 3), w] for t0, t1, w in mots]
    voix_id = projet.get("voix_elevenlabs") or env.get("ELEVENLABS_VOICE_ID")
    propre, relatifs = nettoyer_voix(morceau, relatifs, float(projet.get("blanc_max", 0.45)), {}, voix_id, env)
    return propre, aligner(seg["texte"], relatifs), "rayan"


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


# Banque Earshot (sons/*.wav, rendus par `earshot sfx render`) : fichier, avance (pic du son, pour qu'il
# tombe sur le mot), gain par rapport à la voix, position stéréo (-1 gauche … +1 droite).
BANQUE = ICI / "sons"
SONS = {
    "impact": ("impact.wav", 0.0, 0.42, 0.0),        # cut_hit/rumble : coup grave, avec du sub
    "secousse": ("secousse.wav", 0.0, 0.32, 0.0),    # cut_hit/punch
    "battement": ("battement.wav", 0.0, 0.45, 0.0),  # cut_hit/kick x2 : battement de cœur
    "pop": ("pop.wav", 0.008, 0.38, 0.35),           # fit/pop/mouth_plop (CC0 recréé en code)
    "whoosh": ("whoosh.wav", 0.436, 0.26, -0.25),    # whoosh_big/swell : souffle, pic au mot
    "zoom": ("zoom.wav", 0.13, 0.22, 0.25),          # fit/whoosh.short/bamboo_swish
    "flash": ("flash.wav", 0.0, 0.16, 0.15),         # notify/m0 : cloche frappée
}


def son(type_, n):
    """(fichier, avance, gain, pan) ; les pops alternent gauche/droite."""
    if (BANQUE / SONS.get(type_, SONS["pop"])[0]).exists():
        f, avance, gain, pan = SONS.get(type_, SONS["pop"])
        return BANQUE / f, avance, gain, (pan if n % 2 else -pan)
    return sfx(type_ if type_ in SFX else "pop"), 0.0, VOLUME_SFX, 0.0


def sfx(nom):
    f = CACHE / "sfx" / f"{nom}.wav"
    if not f.exists():
        f.parent.mkdir(exist_ok=True)
        ffmpeg("-f", "lavfi", "-i", SFX[nom], "-af", f"{FILTRE_SFX.get(nom, '')}aformat=channel_layouts=stereo", f)
    return f


# ------------------------------------------------------------------ Assemblage
def marquer_forts(mots, cibles):
    """Effet « battement » : marque comme forts les mots du sous-titre qui correspondent aux mots-clés."""
    cles = {_norm(c) for c in cibles if _norm(c)}
    for m in mots:
        if _norm(m["texte"]) in cles:
            m["fort"] = True
    return mots


def fabriquer(chemin_projet, rendre=True):
    projet = json.loads(Path(chemin_projet).read_text(encoding="utf-8"))
    env = lire_env()
    CACHE.mkdir(exist_ok=True)
    SORTIES.mkdir(exist_ok=True)
    pub = ANIM / "public" / projet["slug"]
    pub.mkdir(parents=True, exist_ok=True)
    style = projet.get("style", "ayati")
    long_ = projet.get("format") == "long"   # format long 16:9 (longue.py) ; sinon Short vertical

    t, pistes, segs, cues, moteurs = 0.15, [], [], [], set()  # la voix démarre presque tout de suite
    n_son = 0
    fr = lambda s: int(round(s * FPS))
    recits = [s.get("texte", "") if s["type"] == "narration" else "" for s in projet["segments"]]
    for n_seg, seg in enumerate(projet["segments"]):
        out = {"type": seg["type"], "scene": seg["scene"], "ref": seg.get("ref")}
        if seg.get("visuel"):  # données d'un décor générique (animation/src/generique.tsx)
            out["visuel"] = seg["visuel"]
        if seg.get("image"):   # format long : image du passage (longue.py)
            out["image"] = seg["image"]
        if seg["type"] == "verset":
            v = verset(seg["ref"])
            audio, minutage, recitateur = (CACHE / v["audio"]) if v["audio"] else None, v["minutage"], "as-Sudais"
            if projet.get("recitation") == "libre":   # récitation libre de droits (recitation_libre.py)
                nom = seg["ref"].replace(":", "-")
                libre = json.loads((CACHE / "libre" / f"{nom}.json").read_text(encoding="utf-8"))
                audio, minutage = CACHE / "libre" / f"{nom}.mp3", libre["minutage"]
                recitateur = projet.get("recitateur_nom", "récitation libre (CC0)")
            d = duree(audio)
            out["verset"] = {"arabe": v["mots"], "fr": v["fr"], "ref": seg["ref"], "recitateur": recitateur,
                             "sourate": projet.get("sourates", {}).get(seg["ref"].split(":")[0], "Sourate"),
                             "minutage": [[i, fr(t + a), fr(t + b)] for i, a, b in minutage],
                             "parties": v.get("parties")}
            fin = t + d + PAUSE_VERSET
            cues.append({"frame": fr(t), "type": "flash_doux"})
            print(f"  verset {seg['ref']} : {d:.1f} s ({recitateur})")
        else:
            avant = " ".join(x for x in recits[max(0, n_seg - 2):n_seg] if x)
            apres = next((x for x in recits[n_seg + 1:] if x), "")
            if projet.get("enregistrement"):
                audio, mots, moteur = narration_enregistree(n_seg, seg, projet, env)
            else:
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
                        f_son, avance, gain, pan = son(type_, n_son)
                        n_son += 1
                        pistes.append((f_son, max(0.0, m["debut"] / FPS - avance), gain, pan))
                        break
                else:
                    print(f"    ! accent introuvable : {mot}")
            if projet.get("battement"):   # effet « battement » : mots forts = accents + mot du gros titre
                marquer_forts(out["mots"], list(accents) + ([seg["titre"]["mot"]] if seg.get("titre") else []))
            if seg.get("titre"):
                cible = seg["titre"]["mot"]
                m = next((m for m in out["mots"] if m["texte"].replace(" ", " ").startswith(cible)), out["mots"][0])
                out["titre"] = {"frame": m["debut"], "texte": seg["titre"]["texte"]}
            print(f"  narration ({seg['scene']}) : {d:.1f} s")
        pistes.append((audio, t, VOLUME_RECITATION if seg["type"] == "verset" else 1.0, 0.0))
        out["debut"], out["fin"] = fr(t), fr(fin)
        segs.append(out)
        t = fin
    t += 0.6
    total = fr(t)

    # un souffle discret à chaque changement de décor qui n'a pas déjà son propre son (Earshot : 5 cuts muets)
    if (BANQUE / "zoom.wav").exists():
        for a, b in zip(segs, segs[1:]):
            if b["scene"] != a["scene"] and not any(abs(c["frame"] - b["debut"]) < 12 for c in cues):
                pistes.append((BANQUE / "zoom.wav", max(0.0, b["debut"] / FPS - 0.13), 0.14, 0.3))

    # ---- audio : voix + récitations + bruitages + ambiance
    entrees, filtres = [], []
    for k, (a, debut, vol, pan) in enumerate(pistes):
        entrees += ["-i", a]
        ms = int(debut * 1000)
        g, d_ = min(1.0, 1.0 - pan), min(1.0, 1.0 + pan)
        filtres.append(f"[{k}:a]aresample=44100,aformat=channel_layouts=stereo,volume={vol},"
                       f"pan=stereo|c0={g:.2f}*c0|c1={d_:.2f}*c1,adelay={ms}|{ms}[a{k}]")
    mix = "".join(f"[a{k}]" for k in range(len(pistes)))
    n = len(pistes)
    # ambiance en vraie stéréo : deux sources différentes à gauche et à droite (Earshot : « quasi mono »)
    if style == "ayati":   # vent, très bas
        amb_g = "anoisesrc=color=brown:amplitude=0.5:seed=7"
        amb_d = "anoisesrc=color=brown:amplitude=0.5:seed=11"
        chaine = "lowpass=f=420,highpass=f=60,volume=0.07"
    else:                  # nappe grave, légèrement désaccordée entre gauche et droite
        amb_g = "aevalsrc='0.05*sin(2*PI*55*t)+0.035*sin(2*PI*82.4*t)*(0.6+0.4*sin(2*PI*0.2*t))+0.02*sin(2*PI*110*t)':s=44100"
        amb_d = "aevalsrc='0.05*sin(2*PI*55.4*t)+0.035*sin(2*PI*82.9*t)*(0.6+0.4*sin(2*PI*0.23*t+1))+0.02*sin(2*PI*110.5*t)':s=44100"
        chaine = "volume=0.9"
    entrees += ["-f", "lavfi", "-t", f"{t:.2f}", "-i", amb_g, "-f", "lavfi", "-t", f"{t:.2f}", "-i", amb_d]
    filtres.append(f"[{n}:a]{chaine},aformat=channel_layouts=mono[ag];[{n + 1}:a]{chaine},aformat=channel_layouts=mono[ad];"
                   f"[ag][ad]join=inputs=2:channel_layout=stereo,afade=t=in:d=1.0,afade=t=out:st={t - 2:.2f}:d=2[amb]")
    filtres.append(f"{mix}[amb]amix=inputs={n + 1}:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.5:LRA=11[aout]")
    ffmpeg(*entrees, "-filter_complex", ";".join(filtres), "-map", "[aout]", "-t", f"{t:.2f}", "-ar", "44100",
           pub / "audio.wav")

    timeline = {"slug": projet["slug"], "style": style, "fps": FPS, "duree": total,
                "marque": projet.get("marque"), "segments": segs, "cues": sorted(cues, key=lambda c: c["frame"]),
                "audio": f"{projet['slug']}/audio.wav", "brouillon": "brouillon" in moteurs,
                "accroche": projet.get("accroche"), "format": "long" if long_ else "short",
                "battement": bool(projet.get("battement"))}
    chemin_tl = pub / "timeline.json"
    chemin_tl.write_text(json.dumps(timeline, ensure_ascii=False, indent=1), encoding="utf-8")
    polices = ANIM / "public" / "polices"
    if not polices.exists():
        shutil.copytree(ICI / "polices", polices)
    voix = "voix de BROUILLON (Microsoft)" if timeline["brouillon"] else ("lecture de Rayan (voix Paul K)" if "rayan" in moteurs else "ElevenLabs")
    print(f"Chronologie prête : {t:.1f} s, {voix}")
    avis = avis_duree(t, vertical=not long_)
    if avis:
        print(f"  ! {avis}")
    if long_:
        import longue
        print(f"  passages horodatés : {longue.ecrire_passages(timeline)}")
        if rendre and not longue.intro_validee(projet["slug"], projet):
            print("  Format long : planche de style et intro à valider d'abord (rien n'est rendu en entier).")
            longue.planche(projet["slug"])
            return
    elif rendre and t > SHORT_MAX:
        sys.exit("Rendu arrêté : un Short ne dépasse pas 3 min. Découpe en épisodes ou passe en \"format\": \"long\".")

    if rendre:
        sortie = SORTIES / f"{projet['slug']}.mp4"
        r = subprocess.run(["npx", "remotion", "render", "src/index.ts", "VideoLong" if long_ else "Video", str(sortie),
                            f"--props={chemin_tl}", "--codec=h264", "--crf=18", "--log=error"],
                           cwd=ANIM, shell=sys.platform == "win32")
        if r.returncode:
            sys.exit("Le rendu Remotion a échoué.")
        print(f"\nVidéo prête : {sortie}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    fabriquer(sys.argv[1], rendre="--sans-rendu" not in sys.argv)
