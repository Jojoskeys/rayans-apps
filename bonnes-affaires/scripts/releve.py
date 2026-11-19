# Relevé sur demande, fait par Claude : Claude ouvre les pages de recherche Leboncoin et Vinted dans son
# navigateur intégré, sans compte et à rythme humain, et lit chaque page en renvoyant une ligne
# « BA1|<nom>|<recherche>|<annonces> » (voir README, « Relevé sur demande »). Ce script reprend ces lignes
# dans l'historique de la session (fichier .jsonl) et les écrit en fichiers d'import, en remplaçant le
# relevé précédent.
#   python scripts/releve.py <historique.jsonl> imports
import glob, json, os, re, sys
journal, sortie = sys.argv[1], sys.argv[2]
pages = {}
def textes(o):
    if isinstance(o, str): yield o
    elif isinstance(o, dict):
        for v in o.values(): yield from textes(v)
    elif isinstance(o, list):
        for v in o: yield from textes(v)
for ligne in open(journal, encoding="utf8"):
    try: o = json.loads(ligne)
    except Exception: continue
    if o.get("type") != "user": continue
    for t in textes(o.get("message", {})):
        for m in re.finditer(r'"BA1\|([a-z0-9-]+)\|([^|]+)\|(\[.*?\]\])"', t):
            pages[m.group(1)] = (m.group(2), json.loads(json.loads('"' + m.group(3) + '"')))
if not pages:
    sys.exit("Aucune page relevée trouvée dans cet historique : rien n'est remplacé.")
for ancien in glob.glob(os.path.join(sortie, "lbc-*.json")) + glob.glob(os.path.join(sortie, "vinted-*.json")):
    os.remove(ancien)
total = 0
for nom, (recherche, lignes) in pages.items():
    sortie_l = []
    for r in lignes:
        if nom.startswith("lbc-"):
            titre, prix, chemin, cp, lat, lon, liv, img = r
            sortie_l.append({"site": "Leboncoin", "titre": titre, "prix": prix, "port": None,
                "lien": f"https://www.leboncoin.fr/ad/{chemin}", "codePostal": cp, "lat": lat, "lon": lon,
                "livrable": bool(liv), "remiseEnMain": True, "recherche": recherche,
                "photo": f"https://img.leboncoin.fr/api/v1/lbcpb1/images/{img}?rule=ad-image" if img else ""})
        else:
            titre, prix, ident, etat, taille, img = r
            if re.search(r"\bans\b|\bcm\b|unique", taille): continue  # tailles enfant ou sans taille
            sortie_l.append({"site": "Vinted", "titre": titre, "prix": prix, "port": 5,
                "lien": f"https://www.vinted.fr/items/{ident}", "livrable": True, "remiseEnMain": False,
                "recherche": recherche, "etat": f"{etat} · taille {taille} · port estimé 5 €", "photo": img})
    json.dump(sortie_l, open(os.path.join(sortie, f"{nom}.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
    total += len(sortie_l)
    print(nom, len(sortie_l))
print("total", total)
