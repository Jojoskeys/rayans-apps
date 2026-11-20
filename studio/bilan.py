"""Bilan des vidéos Ayati et La Psycho Facile, en LECTURE SEULE sur les relevés de statistiques.

    python bilan.py            top 3 / flop 3 et recommandation par type de vidéo
    python bilan.py jour       résumé des dernières 24 h (vues, j'aime, partages, abonnés, meilleure vidéo,
                               5 commentaires intéressants)

Ne publie rien, n'appelle aucun service (ni Metricool ni réseau social), ne répond à aucun commentaire.
La page est affichée et enregistrée dans <Vidéos>\\Rayan's Studio\\Bilans\\ (hors du dépôt).

Relevés lus dans <Vidéos>\\Rayan's Studio\\stats.json (ou STUDIO_STATS), remplis à la main ou par Claude depuis
Metricool (relevé seulement) :
{
  "releves":     [{"date": "2026-11-19T20:00", "slug": "ayati-…", "reseau": "tiktok",
                   "vues": 0, "jaime": 0, "partages": 0, "commentaires": 0}],   chiffres cumulés au moment du relevé
  "abonnes":     [{"date": "…", "compte": "ayati" | "psycho", "reseau": "tiktok", "total": 0}],
  "commentaires":[{"date": "…", "slug": "…", "texte": "…"}]
}
"""
import json
import os
import statistics
import sys
from datetime import datetime, timedelta
from pathlib import Path

ICI = Path(__file__).resolve().parent
PROJETS = ICI / "projets"


def racine() -> Path:
    from a_valider import RACINE
    return RACINE


def fichier_stats() -> Path:
    return Path(os.environ["STUDIO_STATS"]) if os.environ.get("STUDIO_STATS") else racine() / "stats.json"


def lire_stats(p: Path) -> dict:
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {"releves": [], "abonnes": [], "commentaires": []}
    return {"releves": d.get("releves", []), "abonnes": d.get("abonnes", []), "commentaires": d.get("commentaires", [])}


def date(s: str) -> datetime:
    return datetime.fromisoformat(s)


def lire_projet(slug: str) -> dict:
    try:
        return json.loads((PROJETS / f"{slug}.json").read_text(encoding="utf-8"))
    except Exception:
        return {}


def compte(slug: str, projet: dict) -> str:
    style = projet.get("style") or ("ayati" if slug.startswith("ayati") else "psycho")
    return "Ayati" if style == "ayati" else "Psycho"


def type_video(slug: str, projet: dict) -> str:
    if projet.get("serie"):
        return f"{compte(slug, projet)} · {projet['serie']}"
    titre = (projet.get("titre_youtube") or projet.get("titre") or "").lower()
    if titre.startswith("pourquoi"):
        return f"{compte(slug, projet)} · « Pourquoi tu… »"
    if projet.get("style") == "ayati":
        sourates = sorted(set(projet.get("sourates", {}).values()))
        return f"Ayati · {', '.join(sourates) or 'récit'}"
    return f"{compte(slug, projet)} · autre"


def duree_projet(slug: str) -> float | None:
    p = ICI / "animation" / "public" / slug / "timeline.json"
    try:
        t = json.loads(p.read_text(encoding="utf-8"))
        return t["duree"] / t.get("fps", 30)
    except Exception:
        return None


def accroche(projet: dict) -> str:
    if projet.get("accroche"):
        return projet["accroche"]
    for s in projet.get("segments", []):
        if s.get("texte"):
            return s["texte"].split(". ")[0][:90]
    return "?"


# ------------------------------------------------------------------ calculs (fonctions pures, testées)
def derniers(releves: list[dict], avant: datetime | None = None) -> dict:
    """Dernier relevé de chaque (vidéo, réseau), éventuellement avant une date."""
    out = {}
    for r in sorted(releves, key=lambda r: r["date"]):
        if avant is not None and date(r["date"]) > avant:
            continue
        out[(r["slug"], r["reseau"])] = r
    return out


def totaux_par_video(releves: list[dict]) -> dict:
    out = {}
    for (slug, _), r in derniers(releves).items():
        t = out.setdefault(slug, {"vues": 0, "jaime": 0, "partages": 0, "commentaires": 0})
        for k in t:
            t[k] += int(r.get(k) or 0)
    return out


def recommandation(moyenne: float, mediane: float, n: int) -> str:
    if mediane <= 0:
        return "on teste"
    if n >= 2 and moyenne >= 1.2 * mediane:
        return "on continue"
    if n >= 3 and moyenne <= 0.5 * mediane:
        return "on arrête"
    return "on teste"


def bilan(stats: dict, projets: dict | None = None) -> dict:
    projets = projets if projets is not None else {}
    tot = totaux_par_video(stats["releves"])
    classe = sorted(tot.items(), key=lambda kv: -kv[1]["vues"])
    mediane = statistics.median([v["vues"] for v in tot.values()]) if tot else 0
    par_type = {}
    for slug, v in tot.items():
        par_type.setdefault(type_video(slug, projets.get(slug, {})), []).append(v["vues"])
    types = {t: {"n": len(l), "moyenne": round(sum(l) / len(l)), "avis": recommandation(sum(l) / len(l), mediane, len(l))}
             for t, l in sorted(par_type.items())}
    return {"top": classe[:3], "flop": list(reversed(classe[-3:])) if len(classe) > 3 else [], "types": types,
            "mediane": mediane}


def jour(stats: dict) -> dict:
    if not stats["releves"]:
        return {"vide": True}
    maintenant = max(date(r["date"]) for r in stats["releves"])
    hier = maintenant - timedelta(hours=24)
    avant, apres = derniers(stats["releves"], hier), derniers(stats["releves"])
    par_compte, par_video = {}, {}
    for cle, r in apres.items():
        a = avant.get(cle, {})
        d = {k: int(r.get(k) or 0) - int(a.get(k) or 0) for k in ("vues", "jaime", "partages")}
        c = par_compte.setdefault(compte(r["slug"], lire_projet(r["slug"])), {"vues": 0, "jaime": 0, "partages": 0, "abonnes": 0})
        for k in d:
            c[k] += d[k]
        par_video[r["slug"]] = par_video.get(r["slug"], 0) + d["vues"]
    ab_avant, ab_apres = {}, {}
    for a in sorted(stats["abonnes"], key=lambda a: a["date"]):
        cle = (a["compte"], a["reseau"])
        ab_apres[cle] = a["total"]
        if date(a["date"]) <= hier:
            ab_avant[cle] = a["total"]
    for (cpt, res), total in ab_apres.items():
        nom = "Ayati" if cpt == "ayati" else "Psycho"
        par_compte.setdefault(nom, {"vues": 0, "jaime": 0, "partages": 0, "abonnes": 0})["abonnes"] += total - ab_avant.get((cpt, res), total)
    recents = [c for c in stats["commentaires"] if hier < date(c["date"]) <= maintenant]
    recents.sort(key=lambda c: ("?" not in c["texte"], -len(c["texte"])))   # questions d'abord, puis les plus longs
    meilleure = max(par_video.items(), key=lambda kv: kv[1]) if par_video else None
    return {"date": maintenant, "comptes": par_compte, "meilleure": meilleure, "commentaires": recents[:5]}


# ------------------------------------------------------------------ pages
def page_bilan(b: dict) -> str:
    def ligne(slug, v):
        p = lire_projet(slug)
        d = duree_projet(slug)
        taux = (v["jaime"] + v["partages"]) / v["vues"] * 100 if v["vues"] else 0
        return (f"- **{p.get('titre') or slug}** : {v['vues']} vues, {v['jaime']} j'aime, {v['partages']} partages "
                f"({taux:.1f} % d'engagement) — sujet : {type_video(slug, p)} ; durée : {f'{d:.0f} s' if d else '?'} ; "
                f"accroche : « {accroche(p)} »")
    l = ["# Bilan des vidéos", ""]
    if not b["top"]:
        return "\n".join(l + ["Aucun relevé de statistiques pour l'instant."])
    l += ["## Les 3 qui marchent le mieux", *[ligne(s, v) for s, v in b["top"]], ""]
    if b["flop"]:
        l += ["## Les 3 qui marchent le moins", *[ligne(s, v) for s, v in b["flop"]], ""]
    l += [f"## Par type de vidéo (médiane : {b['mediane']:.0f} vues)"]
    l += [f"- {t} : {x['n']} vidéo(s), {x['moyenne']} vues en moyenne → **{x['avis']}**" for t, x in b["types"].items()]
    return "\n".join(l)


def page_jour(j: dict) -> str:
    if j.get("vide"):
        return "# Résumé du jour\n\nAucun relevé de statistiques pour l'instant."
    l = [f"# Résumé des 24 h (jusqu'au {j['date']:%d/%m %H:%M})", ""]
    for nom, c in sorted(j["comptes"].items()):
        l.append(f"- **{nom}** : +{c['vues']} vues, +{c['jaime']} j'aime, +{c['partages']} partages, +{c['abonnes']} abonnés")
    if j["meilleure"]:
        slug, vues = j["meilleure"]
        l += ["", f"Meilleure vidéo : **{lire_projet(slug).get('titre') or slug}** (+{vues} vues)"]
    if j["commentaires"]:
        l += ["", "## Commentaires à garder (idées de vidéos)"]
        l += [f"- « {c['texte']} » ({c.get('slug', '?')})" for c in j["commentaires"]]
    return "\n".join(l)


def enregistrer(nom: str, texte: str) -> Path:
    d = racine() / "Bilans"
    d.mkdir(parents=True, exist_ok=True)
    p = d / nom
    p.write_text(texte + "\n", encoding="utf-8")
    return p


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    stats = lire_stats(fichier_stats())
    aujourd = datetime.now().strftime("%Y-%m-%d")
    if len(sys.argv) > 1 and sys.argv[1] == "jour":
        texte, nom = page_jour(jour(stats)), f"jour-{aujourd}.md"
    else:
        projets = {r["slug"]: lire_projet(r["slug"]) for r in stats["releves"]}
        texte, nom = page_bilan(bilan(stats, projets)), f"bilan-{aujourd}.md"
    print(texte)
    print(f"\n→ {enregistrer(nom, texte)}")


if __name__ == "__main__":
    main()
