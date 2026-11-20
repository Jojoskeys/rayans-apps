"""Fabrication de nuit : fabrique les prochains projets prévus et les dépose dans la tuile Studio.

    python nuit.py              fabrique jusqu'à 3 vidéos (--max N pour changer)
    python nuit.py --essai      dit seulement ce qui serait fabriqué

Prochains projets prévus = scripts validés par Rayan dans la tuile Studio (verdict « OK » sur la dernière version),
pas encore fabriqués ni déposés. Si <Vidéos>\\Rayan's Studio\\plan.json existe ({"ordre": ["slug", …]}), cet ordre
passe en premier.

Contrôles gardés : vraie voix ElevenLabs (pas de voix de brouillon la nuit), Ayati en récitation libre de droits déjà
préparée pour chaque verset (une nouvelle récitation demande toujours le test privé YouTube, fait par Rayan),
hashtags conformes (regles.py), durée d'un Short. Rien n'est publié ni programmé.
Journal lisible le matin : sorties/nuit/<date>.txt (réussi / échoué et pourquoi).
La tâche planifiée Windows (2 h du matin) s'enregistre avec planifier_nuit.ps1, seulement si Rayan le décide.
"""
import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ICI = Path(__file__).resolve().parent
PROJETS = ICI / "projets"
SORTIES = ICI / "sorties"
CACHE = ICI / "cache"
JOURNAUX = SORTIES / "nuit"


def lire(p: Path, defaut):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return defaut


def candidats(scripts: Path, a_valider: Path, plan: dict, deja_fabriques: set[str]) -> list[str]:
    """Scripts validés (OK sur la dernière version), pas encore fabriqués ni déposés ; l'ordre du plan d'abord."""
    from a_valider import reponse
    valides = []
    for meta_p in sorted(scripts.glob("*.json")) if scripts.exists() else []:
        if meta_p.name.endswith((".retours.json", ".tmp")):
            continue
        slug = meta_p.stem
        if reponse(scripts, slug) == "ok" and slug not in deja_fabriques and not (a_valider / f"{slug}.mp4").exists():
            valides.append((lire(meta_p, {}).get("envoye", 0), slug))
    valides = [s for _, s in sorted(valides)]
    ordre = [s for s in plan.get("ordre", []) if s in valides]
    return ordre + [s for s in valides if s not in ordre]


def refus(projet: dict, env: dict, cache: Path = CACHE) -> str | None:
    """Raison de ne pas fabriquer cette nuit, ou None si tout est prêt."""
    from regles import problemes_hashtags
    if not projet:
        return "projet introuvable"
    if not env.get("ELEVENLABS_API_KEY") and not projet.get("enregistrement"):
        return "pas de clé ElevenLabs : la voix serait une voix de brouillon"
    if projet.get("style") == "ayati":
        if projet.get("recitation") != "libre":
            return "récitation non libre de droits"
        for s in projet.get("segments", []):
            if s.get("type") == "verset":
                nom = s["ref"].replace(":", "-")
                if not (cache / "libre" / f"{nom}.json").exists():
                    return f"récitation libre du verset {s['ref']} pas encore préparée (recitation_libre.py + test privé YouTube)"
    pbs = problemes_hashtags(projet)
    if pbs:
        return "hashtags : " + " ; ".join(pbs)
    if projet.get("format") == "long":
        return "format long : planche et intro à valider de jour (longue.py)"
    return None


class Journal:
    def __init__(self, chemin: Path):
        self.chemin = chemin
        chemin.parent.mkdir(parents=True, exist_ok=True)

    def ecrire(self, texte: str) -> None:
        ligne = f"{datetime.now():%H:%M} {texte}"
        print(ligne)
        with self.chemin.open("a", encoding="utf-8") as f:
            f.write(ligne + "\n")


def fabriquer_une(slug: str, journal: Journal) -> bool:
    env_py = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    debut = time.time()
    r = subprocess.run([sys.executable, "fabrique.py", f"projets/{slug}.json"], cwd=ICI, env=env_py,
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode or not (SORTIES / f"{slug}.mp4").exists():
        fin = (r.stderr or r.stdout).strip().splitlines()[-1:] or ["erreur inconnue"]
        journal.ecrire(f"ÉCHEC   {slug} : fabrique.py → {fin[0][:200]}")
        return False
    try:
        from controle import planche
        planche(slug)
        from a_valider import envoyer
        envoyer(slug, f"Fabriquée cette nuit ({datetime.now():%d/%m %H:%M}).")
    except Exception as e:
        journal.ecrire(f"ÉCHEC   {slug} : vidéo faite mais dépôt impossible → {e}")
        return False
    journal.ecrire(f"RÉUSSI  {slug} ({(time.time() - debut) / 60:.0f} min), déposée dans la tuile Studio")
    return True


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("--max", type=int, default=3)
    a.add_argument("--essai", action="store_true")
    args = a.parse_args()
    from a_valider import DOSSIER, RACINE, SCRIPTS
    from fabrique import lire_env
    env = lire_env()
    deja = {p.stem for p in SORTIES.glob("*.mp4")} if SORTIES.exists() else set()
    liste = candidats(SCRIPTS, DOSSIER, lire(RACINE / "plan.json", {}), deja)
    journal = Journal(JOURNAUX / f"{datetime.now():%Y-%m-%d}.txt")
    journal.ecrire(f"--- fabrication de nuit{' (essai)' if args.essai else ''} : {len(liste)} projet(s) prévu(s)")
    faites = 0
    for slug in liste:
        if faites >= args.max:
            break
        raison = refus(lire(PROJETS / f"{slug}.json", {}), env)
        if raison:
            journal.ecrire(f"SAUTÉ   {slug} : {raison}")
            continue
        if args.essai:
            journal.ecrire(f"PRÉVU   {slug}")
            faites += 1
            continue
        faites += fabriquer_une(slug, journal)
    journal.ecrire(f"--- fin : {faites} vidéo(s){' prévue(s)' if args.essai else ' déposée(s)'}")


if __name__ == "__main__":
    main()
