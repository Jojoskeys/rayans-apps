"""Prépare le champ `info` d'un post Metricool (createScheduledPost) à partir d'un projet.

    python post_metricool.py <slug> <AAAA-MM-JJTHH:MM> <url_video>

Psycho → YouTube Short + TikTok + Instagram Reel. Ayati → les mêmes + Facebook Reel.
Titre, légende et hashtags viennent de projets/<slug>.json. Affiche le JSON (une ligne).

    python post_metricool.py <slug> <AAAA-MM-JJTHH:MM du Short> <url_story> --story <n> [--direct]

Story n : Instagram (+ Facebook pour Ayati), 1 h après le Short puis 5 min d'écart entre les stories, sans texte
(une story n'a pas de légende). En brouillon par défaut (à valider dans Metricool) ; --direct la publie à l'heure.
TikTok ne permet pas de programmer une story : le fichier sorties/<slug>-story-<n>.mp4 se poste à la main.
"""
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

ICI = Path(__file__).resolve().parent


def info(slug: str, quand: str, url: str) -> dict:
    p = json.loads((ICI / "projets" / f"{slug}.json").read_text(encoding="utf-8"))
    ayati = p["style"] == "ayati"
    titre = p["titre_youtube"][:100]
    texte = p["legende"].strip() + "\n\n" + " ".join(p["hashtags"])
    tags = [h.lstrip("#") for h in p["hashtags"]][:8]
    d = {
        "autoPublish": True, "draft": False, "descendants": [], "firstCommentText": "", "hasNotReadNotes": False,
        "media": [url], "mediaAltText": [], "shortener": False, "smartLinkData": {"ids": []},
        "publicationDate": {"dateTime": quand + ":00", "timezone": "Europe/Paris"},
        "text": texte,
        "providers": [{"network": "youtube"}, {"network": "tiktok"}, {"network": "instagram"}],
        "youtubeData": {"title": titre, "type": "short", "privacy": "public", "tags": tags,
                        "category": "EDUCATION", "madeForKids": False, "isAiGeneratedContent": False},
        "tiktokData": {"privacyOption": "PUBLIC_TO_EVERYONE", "title": titre, "photoCoverIndex": 0},
        "instagramData": {"type": "REEL", "showReelOnFeed": True, "isAiGenerated": False},
    }
    if ayati:
        d["providers"].append({"network": "facebook"})
        d["facebookData"] = {"type": "REEL", "title": titre}
    return d


STORY_APRES = timedelta(hours=1)
STORY_ECART = timedelta(minutes=5)


def heure_story(quand_short: str, n: int) -> str:
    t = datetime.strptime(quand_short, "%Y-%m-%dT%H:%M") + STORY_APRES + (n - 1) * STORY_ECART
    return t.strftime("%Y-%m-%dT%H:%M")


def info_story(slug: str, quand_short: str, url: str, n: int, direct: bool = False) -> dict:
    p = json.loads((ICI / "projets" / f"{slug}.json").read_text(encoding="utf-8"))
    ayati = p["style"] == "ayati"
    d = {
        "autoPublish": direct, "draft": not direct, "descendants": [], "firstCommentText": "", "hasNotReadNotes": False,
        "media": [url], "mediaAltText": [], "shortener": False, "smartLinkData": {"ids": []},
        "publicationDate": {"dateTime": heure_story(quand_short, n) + ":00", "timezone": "Europe/Paris"},
        "text": "",
        "providers": [{"network": "instagram"}],
        "instagramData": {"type": "STORY", "isAiGenerated": False},
    }
    if ayati:
        d["providers"].append({"network": "facebook"})
        d["facebookData"] = {"type": "STORY"}
    return d


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--story" in args:
        k = args.index("--story")
        n = int(args[k + 1])
        print(json.dumps(info_story(args[0], args[1], args[2], n, direct="--direct" in args), ensure_ascii=False))
    else:
        print(json.dumps(info(args[0], args[1], args[2]), ensure_ascii=False))
