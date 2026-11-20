"""Publie l'Arène dans Rayan's Mobile (page « arene/ » de GitHub Pages), lancé chaque semaine par mobile.yml.

    python arene/publier.py arene/publie

Écrit dans le dossier donné :
- prix.json : clôtures journalières de l'ETF monde du PEA (CW8.PA) pour le plan mensuel calculé sur le téléphone ;
- rapports/<actif>.html et resume.json : l'Arène des robots sur la bourse américaine et le bitcoin ;
- film.json : une vraie évolution (la dernière arène de la bourse américaine) génération par génération, puis
  l'examen de la championne sur l'année jamais vue, pour l'animation de la tuile.
Seulement des prix publics du marché : rien de personnel. Sans réseau, n'écrit rien et ne fait pas échouer la
construction de Rayan's Mobile.
"""
import datetime as dt
import json
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))
import arene  # noqa: E402

PLAN = {"actif": "CW8.PA", "nom": "Amundi MSCI World (éligible PEA)", "devise": "€"}
ROBOTS = [("SPY", "Bourse américaine (S&P 500)"), ("BTC-USD", "Bitcoin")]


def prix_json(dates, prix):
    return {**PLAN, "dates": list(dates), "prix": [round(float(x), 2) for x in prix]}


def film(dates, prix, nom, generations=20, population=200, graine=1):
    """Une vraie arène filmée : qui vit, qui meurt, qui est l'enfant de qui, puis l'examen sur l'année d'après."""
    import random
    a_test, d_e, f_e, d_t, f_t = arene.fenetres(dates)[-1]
    gens = []
    classement = arene.evoluer(prix, d_e, f_e, random.Random(graine), generations, population, film=gens)
    champion = classement[0]
    f_jeu = min(f_t + 1, len(prix))
    net_c, nb = arene.evaluer(champion["genome"], prix, d_t, f_jeu)
    net_ag = arene.acheter_garder(prix, d_t, f_jeu)
    import numpy as np
    return {
        "nom": nom, "entrainement": f"{dates[d_e][:4]}–{dates[f_e - 1][:4]}", "test": str(a_test),
        "types": ["Croisement de moyennes", "Rebond après baisse", "Élan (momentum)", "Suit la tendance"],
        "generations": gens,
        "champion": {"regle": arene.decrire(champion["genome"]), "entrainement": round(champion["rendement"], 4),
                     "ordres": nb, "id": champion["id"], "parent": champion["parent"],
                     "type": arene.TYPES.index(champion["genome"]["type"])},
        "examen": {"dates": list(dates[d_t + 1:f_jeu]),
                   "champion": [round(float(x) - 1, 4) for x in np.cumprod(1 + net_c)],
                   "ag": [round(float(x) - 1, 4) for x in np.cumprod(1 + net_ag)]},
    }


def publier(dossier: Path, generations=20, population=200) -> bool:
    from rapport import ecrire_rapport
    dossier.mkdir(parents=True, exist_ok=True)
    try:
        arene.telecharger(PLAN["actif"])
    except SystemExit as e:
        print(f"Arène : pas de prix pour {PLAN['actif']} ({e}) ; rien n'est publié.")
        return False
    dates, prix = arene.charger(PLAN["actif"])
    (dossier / "prix.json").write_text(json.dumps(prix_json(dates, prix), separators=(",", ":")), encoding="utf-8")
    resume = {"genere": dt.date.today().isoformat(), "robots": []}
    (dossier / "rapports").mkdir(exist_ok=True)
    for actif, nom in ROBOTS:
        try:
            arene.telecharger(actif)
        except SystemExit as e:
            print(f"Arène : {actif} ignoré ({e}).")
            continue
        d, p = arene.charger(actif)
        res = arene.walk_forward(d, p, generations, population, graine=1, bavard=False)
        ecrire_rapport(actif, res, {"generations": generations, "population": population, "graine": 1},
                       chemin=dossier / "rapports" / f"{actif}.html")
        if actif == "SPY":
            (dossier / "film.json").write_text(json.dumps(film(d, p, nom), ensure_ascii=False, separators=(",", ":")),
                                               encoding="utf-8")
        resume["robots"].append({"actif": actif, "nom": nom, "ans": round(res["ans_test"], 1),
                                 "arene": res["total_arene"], "ag": res["total_ag"], "hasard": res["total_hasard"]})
    (dossier / "resume.json").write_text(json.dumps(resume, ensure_ascii=False), encoding="utf-8")
    print(f"Arène publiée dans {dossier}")
    return True


if __name__ == "__main__":
    publier(Path(sys.argv[1] if len(sys.argv) > 1 else ICI / "publie").resolve())
