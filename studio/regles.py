"""Contrôles automatiques tirés de REGLES.md (lecture seule, ne modifie aucun projet).

    python regles.py                 contrôle tous les projets
    python regles.py <slug> [...]    contrôle seulement ces projets

- Ayati : le hashtag de la sourate correspond aux sourates des versets du projet, aucun hashtag d'une autre sourate.
- Tous : pas de hashtag en double.
"""
import json
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
PROJETS = ICI / "projets"

# sourate → hashtag (à compléter quand une nouvelle sourate arrive dans le Studio)
HASHTAG_SOURATE = {
    "5": "#almaida", "7": "#alaraf", "12": "#youssouf", "18": "#alkahf", "19": "#maryam", "20": "#taha",
    "27": "#annaml", "28": "#alqasas", "36": "#yasin", "37": "#assaffat", "55": "#arrahman", "67": "#almulk",
    "93": "#adduha", "97": "#alqadr", "105": "#alfil", "112": "#alikhlas", "113": "#alfalaq", "114": "#annas",
}
SHORT_CONSEILLE = 90   # secondes
SHORT_MAX = 180        # limite YouTube Shorts


def sourates_du_projet(projet: dict) -> set[str]:
    return {s["ref"].split(":")[0] for s in projet.get("segments", []) if s.get("type") == "verset" and s.get("ref")}


def problemes_hashtags(projet: dict) -> list[str]:
    tags = [h.lower() for h in projet.get("hashtags", [])]
    out = [f"hashtag en double : {h}" for h in sorted({h for h in tags if tags.count(h) > 1})]
    if projet.get("style") != "ayati":
        return out
    sourates = sourates_du_projet(projet)
    for s in sorted(sourates, key=int):
        attendu = HASHTAG_SOURATE.get(s)
        if attendu is None:
            out.append(f"sourate {s} absente de la table HASHTAG_SOURATE (regles.py)")
        elif attendu not in tags:
            out.append(f"hashtag {attendu} manquant (sourate {s})")
    for s, h in HASHTAG_SOURATE.items():
        if h in tags and s not in sourates:
            out.append(f"hashtag {h} alors que la sourate {s} n'est pas dans le projet")
    return out


def avis_duree(secondes: float, vertical: bool = True) -> str | None:
    """Message si la durée sort des règles des Shorts, None sinon."""
    if not vertical:
        return None
    if secondes > SHORT_MAX:
        return f"{secondes:.0f} s : trop long pour un Short (3 min max) → format long 16:9 ou épisodes"
    if secondes > SHORT_CONSEILLE:
        return f"{secondes:.0f} s : plus long que les 90 s conseillées → envisager un découpage en épisodes"
    return None


def main(slugs: list[str]) -> int:
    fichiers = [PROJETS / f"{s}.json" for s in slugs] if slugs else sorted(PROJETS.glob("*.json"))
    n = 0
    for f in fichiers:
        projet = json.loads(f.read_text(encoding="utf-8"))
        for p in problemes_hashtags(projet):
            print(f"{f.stem} : {p}")
            n += 1
    print(f"{n} problème(s) sur {len(fichiers)} projet(s).")
    return n


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1:])
