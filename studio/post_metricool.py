"""Prépare le champ `info` d'un post Metricool (createScheduledPost) à partir d'un projet.

    python post_metricool.py <slug> <AAAA-MM-JJTHH:MM> <url_video>

Psycho → YouTube Short + TikTok + Instagram Reel. Ayati → les mêmes + Facebook Reel.
Titre, légende et hashtags viennent de projets/<slug>.json. Affiche le JSON (une ligne).
"""
import json
import sys
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


if __name__ == "__main__":
    print(json.dumps(info(sys.argv[1], sys.argv[2], sys.argv[3]), ensure_ascii=False))
