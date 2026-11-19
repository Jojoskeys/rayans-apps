"""Fabrique le champ `info` pour passer un post Metricool en brouillon (draft) sans rien changer d'autre.

    python brouillon_metricool.py <slug> <AAAA-MM-JJTHH:MM> <url_media_static>

Sert à neutraliser un doublon : un brouillon n'est jamais publié.
"""
import json
import sys

from post_metricool import info

if __name__ == "__main__":
    d = info(sys.argv[1], sys.argv[2], sys.argv[3])
    d["draft"] = True
    print(json.dumps(d, ensure_ascii=False))
