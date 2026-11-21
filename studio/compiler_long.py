"""Assembler une vidéo longue YouTube (16:9) à partir de Shorts déjà écrits (une série qui se suit).

    python compiler_long.py <recette.json>

La recette (dans projets/longs/) donne : le slug du long, son titre, la liste des Shorts dans l'ordre, une intro et
une fin écrites pour le long. Pour chaque Short : ses segments sont repris tels quels (mêmes textes, mêmes versets,
mêmes décors), sauf l'appel à s'abonner de la fin (scène « cta »), qui n'a pas sa place au milieu d'une vidéo longue.
La première phrase de chaque épisode devient la relance du chapitre. Un seul appel à s'abonner, à la fin.

Sortie : projets/<slug>.json avec "format": "long" (à fabriquer avec fabrique.py, validation par la planche et
l'intro d'abord : voir README, « Format long »), et la liste des chapitres pour la description YouTube
(les minutes exactes viennent de sorties/<slug>.passages.txt après la fabrication).

Aucun texte de verset n'est écrit ici : les versets restent des références (« ref »), vérifiées par fabrique.py.
"""
import json
import sys
from collections import Counter
from pathlib import Path

ICI = Path(__file__).resolve().parent
PROJETS = ICI / "projets"
CHAMPS_COMMUNS = ("style", "marque", "voix_elevenlabs", "voix_reglages", "recitateur", "recitation", "recitateur_nom")


def lire(slug: str) -> dict:
    return json.loads((PROJETS / f"{slug}.json").read_text(encoding="utf-8"))


def sans_cta(segments: list[dict]) -> list[dict]:
    """Retire l'appel à s'abonner de fin d'épisode (scène cta)."""
    return [s for s in segments if s.get("scene") != "cta"]


def le_plus_courant(valeurs: list):
    valeurs = [json.dumps(v, sort_keys=True, ensure_ascii=False) for v in valeurs if v is not None]
    return json.loads(Counter(valeurs).most_common(1)[0][0]) if valeurs else None


def compiler(recette: dict) -> dict:
    episodes = [(e if isinstance(e, dict) else {"slug": e}) for e in recette["episodes"]]
    shorts = [lire(e["slug"]) for e in episodes]
    styles = {p["style"] for p in shorts}
    if len(styles) != 1:
        raise ValueError(f"épisodes de styles différents : {styles}")
    segments, chapitres, sourates = [], [], {}
    for s in recette["intro"]:
        segments.append(dict(s))
    chapitres.append({"titre": recette.get("titre_intro", "Introduction"), "segment": 0})
    for e, p in zip(episodes, shorts):
        segs = sans_cta(p["segments"])
        if not segs:
            continue
        chapitres.append({"titre": e.get("chapitre") or p.get("titre") or p["slug"], "segment": len(segments),
                          "depuis": p["slug"]})
        segments.extend(dict(s) for s in segs)
        sourates.update(p.get("sourates") or {})
    chapitres.append({"titre": recette.get("titre_fin", "Ce qu'il faut retenir"), "segment": len(segments)})
    segments.extend(dict(s) for s in recette["fin"])
    projet = {
        "slug": recette["slug"],
        "titre": recette["titre"],
        "titre_youtube": recette["titre_youtube"][:100],
        "format": "long",
        "version": 1,
        "statut": "brouillon à valider",
        "compile_depuis": [p["slug"] for p in shorts],
    }
    for k in CHAMPS_COMMUNS:
        v = le_plus_courant([p.get(k) for p in shorts])
        if v is not None:
            projet[k] = v
    for k, v in (recette.get("reglages") or {}).items():   # réglages imposés à tout le long (ex. un seul récitateur)
        if v is None:
            projet.pop(k, None)
        else:
            projet[k] = v
    if sourates:
        projet["sourates"] = dict(sorted(sourates.items(), key=lambda kv: int(kv[0]) if kv[0].isdigit() else 999))
    projet.update({k: recette[k] for k in ("legende", "hashtags", "accroche", "miniatures", "sources") if k in recette})
    if "sources" not in projet:                 # sources des épisodes (études citées), sans doublon, dans l'ordre
        vues = []
        for p in shorts:
            for src in p.get("sources") or []:
                if src not in vues:
                    vues.append(src)
        if vues:
            projet["sources"] = vues
    projet["chapitres"] = chapitres
    projet["segments"] = segments
    return projet


def mots(projet: dict) -> int:
    return sum(len((s.get("texte") or "").split()) for s in projet["segments"] if s.get("type") == "narration")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    recette = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    projet = compiler(recette)
    sortie = PROJETS / f"{projet['slug']}.json"
    sortie.write_text(json.dumps(projet, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    n = mots(projet)
    versets = sum(1 for s in projet["segments"] if s.get("type") == "verset")
    print(f"{sortie.name} : {len(projet['segments'])} passages, {len(projet['chapitres'])} chapitres, {versets} versets récités, "
          f"{n} mots de narration (≈ {n / 150:.0f} min de voix, plus les récitations)")
    for c in projet["chapitres"]:
        print(f"  ▸ {c['titre']}")


if __name__ == "__main__":
    main()
