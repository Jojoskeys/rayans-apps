"""Rayan's Arène : apprendre le trading en ARGENT FICTIF, honnêtement.

Des mini-stratégies achètent et revendent ; les moins bonnes « meurent », les survivantes font des
enfants mutés. Puis on les teste sur des années qu'elles n'ont jamais vues (walk-forward), et on
compare avec « acheter et garder » et avec des stratégies tirées au hasard.

Aucun courtier, aucune clé, aucun ordre réel, aucun effet de levier : positions longues ou cash.

    python arene.py lancer demo
    python arene.py telecharger SPY BTC-USD
    python arene.py lancer SPY --generations 20 --population 200 --graine 1
"""
import argparse
import csv
import datetime as dt
import math
import random
import sys
from pathlib import Path

import numpy as np

ICI = Path(__file__).resolve().parent
DONNEES = ICI / "donnees"
SORTIES = ICI / "sorties"

FRAIS = 0.001        # 0,1 % par ordre
GLISSEMENT = 0.0005  # 0,05 % par ordre
COUT_ORDRE = FRAIS + GLISSEMENT
JOURS_AN = 252
CHAUFFE = 260        # jours d'historique passé utilisés pour calculer les indicateurs
ANNEES_ENTRAINEMENT = 3
PENALITE_ORDRE = 0.02  # pénalité de note par ordre et par an


# ---------------------------------------------------------------- données

def serie_demo(graine=42, debut="2015-01-02", jours=2600):
    """Série synthétique reproductible : marche aléatoire avec des phases haussières et baissières."""
    rng = np.random.default_rng(graine)
    d = dt.date.fromisoformat(debut)
    dates = []
    while len(dates) < jours:
        if d.weekday() < 5:
            dates.append(d.isoformat())
        d += dt.timedelta(days=1)
    rend = np.empty(jours)
    regime = 0
    for i in range(jours):
        if rng.random() < 1 / 180:
            regime = 1 - regime
        mu, vol = (0.10, 0.15) if regime == 0 else (-0.12, 0.28)
        rend[i] = rng.normal(mu / JOURS_AN, vol / math.sqrt(JOURS_AN))
    prix = 100 * np.exp(np.cumsum(rend))
    return dates, prix


def lire_csv(chemin):
    dates, prix = [], []
    with open(chemin, newline="", encoding="utf-8") as f:
        for ligne in csv.DictReader(f):
            try:
                p = float(ligne["cloture"])
            except (KeyError, ValueError):
                continue
            if p > 0:
                dates.append(ligne["date"])
                prix.append(p)
    return dates, np.array(prix)


def ecrire_csv(chemin, dates, prix):
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with open(chemin, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["date", "cloture"])
        for d, p in zip(dates, prix):
            w.writerow([d, f"{p:.6f}"])


def telecharger(actif):
    """10 ans de clôtures journalières ajustées via yfinance (optionnel), mis en cache CSV."""
    try:
        import yfinance as yf
    except ImportError:
        sys.exit("yfinance n'est pas installé. Installe-le avec :  pip install yfinance\n"
                 "(ou essaie sans réseau :  python arene.py lancer demo)")
    tableau = yf.download(actif, period="10y", interval="1d", auto_adjust=True, progress=False)
    if tableau is None or tableau.empty:
        sys.exit(f"Aucune donnée reçue pour {actif} (symbole inconnu ou pas de réseau).")
    cloture = tableau["Close"]
    if hasattr(cloture, "columns"):  # yfinance récent : une colonne par symbole
        cloture = cloture.iloc[:, 0]
    cloture = cloture.dropna()
    dates = [i.strftime("%Y-%m-%d") for i in cloture.index]
    chemin = DONNEES / f"{actif}.csv"
    ecrire_csv(chemin, dates, [float(x) for x in cloture.values])
    print(f"{actif} : {len(dates)} jours ({dates[0]} → {dates[-1]}) dans {chemin.relative_to(ICI)}")


def charger(actif):
    if actif.lower() == "demo":
        return serie_demo()
    chemin = DONNEES / f"{actif}.csv"
    if not chemin.exists():
        sys.exit(f"Pas de données pour {actif}. Lance d'abord :  python arene.py telecharger {actif}")
    return lire_csv(chemin)


# ---------------------------------------------------------------- stratégies

TYPES = ("croisement", "rebond", "momentum", "tendance")


def moyenne_mobile(prix, n):
    """Moyenne des n derniers prix, jour t compris (jamais le futur). NaN avant d'avoir n prix."""
    out = np.full(len(prix), np.nan)
    if n <= len(prix):
        c = np.cumsum(np.insert(prix, 0, 0.0))
        out[n - 1:] = (c[n:] - c[:-n]) / n
    return out


def genome_hasard(rng, type_=None):
    t = type_ or rng.choice(TYPES)
    g = {"type": t, "filtre": rng.choice([0, 0, 100, 150, 200])}
    if t == "croisement":
        g["court"] = rng.randint(5, 50)
        g["long"] = rng.randint(g["court"] + 10, 250)
    elif t == "rebond":
        g["baisse"] = round(rng.uniform(0.02, 0.20), 3)
        g["hausse"] = round(rng.uniform(0.02, 0.30), 3)
        g["fenetre"] = rng.randint(5, 60)
        g["stop"] = round(rng.uniform(0.03, 0.25), 3)
    elif t == "momentum":
        g["jours"] = rng.randint(10, 250)
        g["seuil"] = round(rng.uniform(-0.02, 0.10), 3)
    else:
        g["jours"] = rng.randint(20, 250)
    return g


def _borne(v, a, b):
    return max(a, min(b, v))


def muter(g, rng):
    """Enfant : copie avec un ou deux paramètres légèrement modifiés."""
    e = dict(g)
    cles = [k for k in e if k != "type"]
    for k in rng.sample(cles, k=min(len(cles), rng.choice([1, 2]))):
        v = e[k]
        if k == "filtre":
            e[k] = rng.choice([0, 100, 150, 200])
        elif isinstance(v, int):
            e[k] = int(_borne(round(v * rng.uniform(0.75, 1.3)) + rng.choice([-2, 0, 2]), 2, 250))
        else:
            e[k] = round(_borne(v * rng.uniform(0.7, 1.4), 0.005, 0.5), 3)
    if e["type"] == "croisement" and e["long"] <= e["court"] + 5:
        e["long"] = min(250, e["court"] + 10)
        e["court"] = min(e["court"], e["long"] - 10)
    return e


def positions(g, prix):
    """Position (0 = cash, 1 = investi) décidée à la clôture de chaque jour, avec les prix ≤ ce jour."""
    n = len(prix)
    if g["type"] == "croisement":
        ok = moyenne_mobile(prix, g["court"]) > moyenne_mobile(prix, g["long"])
    elif g["type"] == "momentum":
        j = g["jours"]
        ok = np.zeros(n, bool)
        if j < n:
            ok[j:] = prix[j:] / prix[:-j] - 1 > g["seuil"]
    elif g["type"] == "tendance":
        ok = prix > moyenne_mobile(prix, g["jours"])
    else:  # rebond : acheter après une baisse de X % depuis le plus haut récent, revendre à +Y % ou au stop
        ok = np.zeros(n, bool)
        f, investi, entree = g["fenetre"], False, 0.0
        for t in range(n):
            if investi:
                if prix[t] >= entree * (1 + g["hausse"]) or prix[t] <= entree * (1 - g["stop"]):
                    investi = False
            elif t >= f and prix[t] <= prix[t - f:t + 1].max() * (1 - g["baisse"]):
                investi, entree = True, prix[t]
            ok[t] = investi
    pos = np.where(ok, 1.0, 0.0)  # les NaN (pas assez d'historique) donnent 0
    if g["filtre"]:
        pos *= prix > moyenne_mobile(prix, g["filtre"])
    return pos


def decrire(g):
    """Règle en français simple."""
    def _p(x):
        return f"{x:.1%}".replace(".", ",").replace("%", " %")

    t = g["type"]
    if t == "croisement":
        s = f"Investi quand la moyenne des {g['court']} derniers jours est au-dessus de celle des {g['long']} jours"
    elif t == "rebond":
        s = (f"Achète après une baisse de {_p(g['baisse'])} sous le plus haut des {g['fenetre']} derniers jours, "
             f"revend à +{_p(g['hausse'])} (ou coupe à −{_p(g['stop'])})")
    elif t == "momentum":
        if g["seuil"] >= 0:
            s = f"Investi si le prix a monté de plus de {_p(g['seuil'])} sur les {g['jours']} derniers jours"
        else:
            s = f"Investi si le prix n'a pas baissé de plus de {_p(-g['seuil'])} sur les {g['jours']} derniers jours"
    else:
        s = f"Investi quand le prix est au-dessus de sa moyenne des {g['jours']} derniers jours"
    if g["filtre"]:
        s += f", et seulement si le prix est au-dessus de sa moyenne {g['filtre']} jours"
    return s


# ---------------------------------------------------------------- simulation

def rendements_jour(pos, prix):
    """Rendement quotidien de la stratégie, frais et glissement compris.

    La position décidée à la clôture du jour t s'applique au mouvement t → t+1 : on ne profite
    jamais d'un prix qu'on ne pouvait pas encore connaître. Chaque changement de position paie un ordre.
    On part du cash : entrer dès le premier jour coûte aussi un ordre.
    """
    r = prix[1:] / prix[:-1] - 1
    avant = np.concatenate(([0.0], pos[:-1]))
    ordres = np.abs(pos - avant)                # ordre passé à la clôture t
    net = (1 - ordres[:-1] * COUT_ORDRE) * (1 + pos[:-1] * r) - 1   # l'ordre est payé sur tout le capital
    return net, int(ordres[:-1].sum())


def evaluer(g, prix, debut, fin):
    """Stratégie g jouée sur les jours [debut, fin) en partant du cash.

    Les indicateurs utilisent au plus CHAUFFE jours AVANT debut (le passé, jamais le futur) ;
    rien après fin - 1 n'est lu.
    """
    a = max(0, debut - CHAUFFE)
    morceau = prix[a:fin]
    pos = positions(g, morceau)
    pos[: debut - a] = 0.0          # pas de position avant le début de la période jouée
    net, nb = rendements_jour(pos[debut - a:], morceau[debut - a:])
    return net, nb


def note(net, nb_ordres):
    """Rendement ajusté du risque (type Sharpe annualisé) moins une pénalité si trop d'ordres."""
    if len(net) < 2 or net.std() == 0:
        return -1.0 if nb_ordres else 0.0
    ans = len(net) / JOURS_AN
    sharpe = net.mean() / net.std() * math.sqrt(JOURS_AN)
    return sharpe - PENALITE_ORDRE * nb_ordres / ans


def total(net):
    return float(np.prod(1 + net) - 1)


def acheter_garder(prix, debut, fin):
    """Un seul achat au premier jour (frais + glissement payés), gardé jusqu'au bout."""
    pos = np.ones(fin - debut)
    return rendements_jour(pos, prix[debut:fin])[0]


def evoluer(prix, debut, fin, rng, generations=20, population=200, film=None):
    """Sélection naturelle sur [debut, fin). Renvoie la population finale triée (meilleure d'abord).
    film : liste remplie, une entrée par génération, de [id, id du parent (ou -1), type, rendement, survit]
    pour l'animation de la tuile Arène (ne change rien aux résultats)."""
    pop = [genome_hasard(rng) for _ in range(population)]
    ids, parents, prochain = list(range(population)), [-1] * population, population
    memo = {}

    def juger(g):
        cle = tuple(sorted(g.items()))
        if cle not in memo:
            net, nb = evaluer(g, prix, debut, fin)
            memo[cle] = (note(net, nb), total(net), nb)
        return memo[cle]

    for _ in range(generations):
        notes = [juger(g) + (g, ids[k], parents[k]) for k, g in enumerate(pop)]
        notes.sort(key=lambda x: -x[0])
        survivantes = notes[: population // 2]           # la moitié la moins bonne meurt
        if film is not None:
            vivants = {x[4] for x in survivantes}
            film.append([[x[4], x[5], TYPES.index(x[3]["type"]), round(x[1], 4), x[4] in vivants] for x in notes])
            # notes triées : le premier de chaque génération est celui que la sélection préfère (couronné)
        meres, enfants = [], []
        for _ in range(population - len(survivantes)):    # même ordre de tirage qu'avant : mère puis mutation
            m = rng.choice(survivantes)
            meres.append(m)
            enfants.append(muter(m[3], rng))
        pop = [s[3] for s in survivantes] + enfants
        ids = [s[4] for s in survivantes] + list(range(prochain, prochain + len(enfants)))
        parents = [s[5] for s in survivantes] + [m[4] for m in meres]
        prochain += len(enfants)
    final = []
    for g, ident, parent in zip(pop, ids, parents):
        n, r, nb = juger(g)
        final.append({"genome": g, "note": n, "rendement": r, "ordres": nb, "id": ident, "parent": parent})
    final.sort(key=lambda x: -x["note"])
    return final


def fenetres(dates, ans_entrainement=ANNEES_ENTRAINEMENT):
    """Découpe walk-forward : [entraînement sur N années civiles complètes] puis [test l'année suivante].

    Renvoie des tuples (annee_test, debut_entr, fin_entr, debut_test, fin_test) d'indices,
    avec fin exclue et fin_entr == debut_test (aucun jour partagé).
    """
    premiers = {}
    for i, d in enumerate(dates):
        premiers.setdefault(int(d[:4]), i)
    annees = sorted(premiers)
    # on ignore une première année incomplète (commence après mi-janvier)
    if dates[0][5:] > "01-15":
        annees = annees[1:]
    sorties = []
    for k in range(len(annees) - ans_entrainement):
        a_test = annees[k + ans_entrainement]
        d_e = premiers[annees[k]]
        d_t = premiers[a_test]
        f_t = premiers.get(a_test + 1, len(dates))
        if f_t - d_t < 60:   # année de test trop courte pour dire quoi que ce soit
            continue
        sorties.append((a_test, d_e, d_t, d_t, f_t))
    return sorties


def annees_entre(date_a, date_b):
    """Durée en années de calendrier entre deux dates « AAAA-MM-JJ » (juste pour la bourse comme pour la crypto,
    qui s'échange aussi le week-end : on ne compte pas en jours de cotation)."""
    from datetime import date
    return (date.fromisoformat(date_b[:10]) - date.fromisoformat(date_a[:10])).days / 365.25


def walk_forward(dates, prix, generations=20, population=200, graine=1, nb_hasard=200, bavard=True):
    rng = random.Random(graine)
    rng_hasard = random.Random(graine + 10_000)
    hasard = [genome_hasard(rng_hasard) for _ in range(nb_hasard)]
    resultat = {"fenetres": [], "net_arene": [], "net_ag": [], "net_hasard": [[] for _ in hasard], "dates": []}
    for a_test, d_e, f_e, d_t, f_t in fenetres(dates):
        classement = evoluer(prix, d_e, f_e, rng, generations, population)
        champion = classement[0]
        # on joue jusqu'à la 1re clôture de l'année suivante pour ne perdre aucun mouvement entre deux tests
        f_jeu = min(f_t + 1, len(prix))
        net_test, nb_test = evaluer(champion["genome"], prix, d_t, f_jeu)
        net_ag = acheter_garder(prix, d_t, f_jeu)
        ans_e = annees_entre(dates[d_e], dates[f_e - 1])
        resultat["fenetres"].append({
            "annee": a_test,
            "entrainement": f"{dates[d_e][:4]}–{dates[f_e - 1][:4]}",
            "champion": champion,
            "entr_annuel": (1 + champion["rendement"]) ** (1 / ans_e) - 1,
            "test": total(net_test), "ordres_test": nb_test,
            "ag": total(net_ag),
            "survivantes": classement[:60],
        })
        resultat["net_arene"].append(net_test)
        resultat["net_ag"].append(net_ag)
        resultat["dates"].extend(dates[d_t + 1:f_jeu])
        for i, g in enumerate(hasard):
            resultat["net_hasard"][i].append(evaluer(g, prix, d_t, f_jeu)[0])
        if bavard:
            f = resultat["fenetres"][-1]
            print(f"  {a_test} : entraîné sur {f['entrainement']} ({pct(f['entr_annuel'])}/an) → "
                  f"test {pct(f['test'])}  |  acheter et garder {pct(f['ag'])}")
    if not resultat["fenetres"]:
        raise ValueError("Pas assez d'historique : il faut au moins 4 années civiles de prix.")
    net_a = np.concatenate(resultat["net_arene"])
    # acheter et garder sur l'ensemble des années de test : un seul achat, gardé tout le long
    fs = fenetres(dates)
    net_g = acheter_garder(prix, fs[0][3], fs[-1][4])
    totaux_h = sorted(total(np.concatenate(n)) for n in resultat["net_hasard"])
    courbes_h = np.cumprod(1 + np.array([np.concatenate(n) for n in resultat["net_hasard"]]), axis=1)
    resultat.update({
        "courbe_arene": np.cumprod(1 + net_a), "courbe_ag": np.cumprod(1 + net_g),
        "courbe_hasard": np.median(courbes_h, axis=0),
        "total_arene": total(net_a), "total_ag": total(net_g),
        "total_hasard": float(np.median(totaux_h)),
        "part_hasard_bat_ag": sum(t > total(net_g) for t in totaux_h) / len(totaux_h),
        "ecart_moyen": float(np.mean([f["entr_annuel"] - f["test"] for f in resultat["fenetres"]])),
        "ans_test": annees_entre(dates[fs[0][3]], resultat["dates"][-1]),
    })
    return resultat


# ---------------------------------------------------------------- console

def pct(x):
    """+12,3 % à la française."""
    return f"{x:+.1%}".replace(".", ",").replace("%", " %")


def resume_console(actif, res, chemin):
    print()
    print(f"=== Rayan's Arène · {actif} · argent fictif ===")
    print(f"Résultat sur des années jamais vues ({res['ans_test']:.1f} ans) : {pct(res['total_arene'])}")
    print(f"  acheter et garder : {pct(res['total_ag'])}")
    print(f"  médiane de {len(res['net_hasard'])} stratégies au hasard : {pct(res['total_hasard'])}")
    print(f"Écart moyen entraînement → test : {pct(res['ecart_moyen'])} par an "
          "(plus c'est grand, plus l'Arène s'est « par cœur » sur le passé)")
    print("Frais 0,1 % + glissement 0,05 % comptés à chaque ordre. Aucun argent réel.")
    print(f"Rapport : {chemin}")


# ---------------------------------------------------------------- ligne de commande

def main(argv=None):
    p = argparse.ArgumentParser(description="Rayan's Arène : trading en argent fictif, testé honnêtement.")
    sp = p.add_subparsers(dest="cmd", required=True)
    t = sp.add_parser("telecharger", help="télécharger 10 ans de prix (yfinance)")
    t.add_argument("actifs", nargs="+")
    l = sp.add_parser("lancer", help="faire évoluer et tester les stratégies")
    l.add_argument("actif", help="symbole déjà téléchargé, ou « demo »")
    l.add_argument("--generations", type=int, default=20)
    l.add_argument("--population", type=int, default=200)
    l.add_argument("--graine", type=int, default=1)
    m = sp.add_parser("mensuel", help="plan mensuel : X € chaque mois sur un ETF, frais compris")
    m.add_argument("actif", help="symbole déjà téléchargé (ex. CW8.PA), ou « demo »")
    m.add_argument("--montant", type=float, default=100.0, help="versement mensuel en euros (100 par défaut)")
    m.add_argument("--fractions", action="store_true", help="morceaux de part (sinon parts entières, comme un PEA)")
    a = p.parse_args(argv)
    if a.cmd == "telecharger":
        for actif in a.actifs:
            telecharger(actif)
        return
    if a.cmd == "mensuel":
        from mensuel import ecrire_rapport_mensuel, plan_mensuel, resume_console_mensuel
        dates, prix = charger(a.actif)
        r = plan_mensuel(dates, list(prix), a.montant, a.fractions)
        resume_console_mensuel(a.actif, r, ecrire_rapport_mensuel(a.actif, r))
        return
    from rapport import ecrire_rapport
    dates, prix = charger(a.actif)
    print(f"{a.actif} : {len(dates)} jours ({dates[0]} → {dates[-1]}), "
          f"{a.generations} générations × {a.population} stratégies")
    res = walk_forward(dates, prix, a.generations, a.population, a.graine)
    chemin = ecrire_rapport(a.actif, res, {"generations": a.generations, "population": a.population,
                                           "graine": a.graine})
    resume_console(a.actif, res, chemin)


if __name__ == "__main__":
    main()
