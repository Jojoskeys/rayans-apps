"""Plan mensuel : « si j'avais versé X € chaque mois sur cet ETF, qu'est-ce que j'aurais ? » (argent fictif).

    python arene.py telecharger CW8.PA
    python arene.py mensuel CW8.PA --montant 100

Chaque mois, au premier jour de cotation : le versement arrive, on achète autant de parts ENTIÈRES que possible
(comme sur un PEA ; --fractions pour un courtier qui vend des morceaux de part), frais compris ; ce qui reste attend
le mois suivant. On ne vend jamais. Affiche : versé, valeur finale, pire chute, temps pour remonter, pire moment
en euros, et le même argent laissé sur un Livret A.
"""
import datetime as dt
import html
import json
import math

from arene import SORTIES, pct
from rapport import STYLE, _points

FRAIS_PCT = 0.005    # 0,5 % de l'achat…
FRAIS_MIN = 1.0      # … avec 1 € minimum : ordre de grandeur des petits ordres sur un PEA en ligne (à vérifier)

# Taux du Livret A (date de début → taux annuel). Approximation : intérêts calculés au mois, ajoutés chaque mois.
LIVRET_A = [("2015-08-01", 0.0075), ("2020-02-01", 0.005), ("2022-02-01", 0.01), ("2022-08-01", 0.02),
            ("2023-02-01", 0.03), ("2025-02-01", 0.024), ("2025-08-01", 0.017), ("2026-02-01", 0.015)]


def taux_livret(jour):
    t = LIVRET_A[0][1]
    for debut, taux in LIVRET_A:
        if jour >= debut:
            t = taux
    return t


def euros(x):
    """1 234 € à la française."""
    return f"{x:,.0f}".replace(",", " ") + " €"


def date_fr(d):
    """« 2020-03-23 » → « 23/03/2020 »."""
    return f"{d[8:10]}/{d[5:7]}/{d[:4]}" if d else ""


def frais(montant, pct_=FRAIS_PCT, minimum=FRAIS_MIN):
    return max(minimum, montant * pct_) if montant > 0 else 0.0


def achat(liquide, prix, fractions=False, pct_=FRAIS_PCT, minimum=FRAIS_MIN):
    """(parts achetées, coût total frais compris). Rien si on ne peut pas payer une part + les frais."""
    if fractions:
        # tout le liquide part : achat + frais = liquide
        brut = liquide / (1 + pct_) if liquide * pct_ / (1 + pct_) >= minimum else liquide - minimum
        if brut <= 0:
            return 0.0, 0.0
        return brut / prix, liquide
    n = math.floor(liquide / prix)
    while n > 0 and n * prix + frais(n * prix, pct_, minimum) > liquide + 1e-9:
        n -= 1
    if n <= 0:
        return 0.0, 0.0
    return float(n), n * prix + frais(n * prix, pct_, minimum)


def premiers_jours_du_mois(dates):
    """Indices du premier jour de cotation de chaque mois."""
    out, vu = [], set()
    for i, d in enumerate(dates):
        if d[:7] not in vu:
            vu.add(d[:7])
            out.append(i)
    return out


def plan_mensuel(dates, prix, montant=100.0, fractions=False, pct_=FRAIS_PCT, minimum=FRAIS_MIN):
    """Simulation jour par jour. Le prix d'un jour ne sert qu'à partir de ce jour (aucune fuite du futur)."""
    versements = set(premiers_jours_du_mois(dates))
    parts = liquide = verse = frais_payes = livret = 0.0
    nb_achats = 0
    premier = None
    valeur, cumul_verse, valeur_livret = [], [], []
    mois_livret = None
    for i, d in enumerate(dates):
        if i in versements:
            if mois_livret is not None:              # intérêts du mois écoulé
                livret *= 1 + taux_livret(mois_livret) / 12
            mois_livret = d
            verse += montant
            liquide += montant
            livret += montant
            n, cout = achat(liquide, prix[i], fractions, pct_, minimum)
            if n:
                parts += n
                liquide -= cout
                frais_payes += cout - n * prix[i]
                nb_achats += 1
                premier = i if premier is None else premier
        valeur.append(parts * prix[i] + liquide)
        cumul_verse.append(verse)
        valeur_livret.append(livret)

    # Pire chute de l'ETF lui-même (sur la période où on en a) et temps pour retrouver le plus haut d'avant.
    debut = premier if premier is not None else 0
    haut, i_haut, chute, i_a, i_b = prix[debut], debut, 0.0, debut, debut
    for i in range(debut, len(prix)):
        if prix[i] > haut:
            haut, i_haut = prix[i], i
        c = prix[i] / haut - 1
        if c < chute:
            chute, i_a, i_b = c, i_haut, i
    i_retour = next((i for i in range(i_b, len(prix)) if prix[i] >= prix[i_a]), None)
    # Pire moment pour toi, en euros : la plus grosse perte par rapport à ce que tu avais versé.
    pertes = [v - c for v, c in zip(valeur, cumul_verse)]
    i_pire = min(range(len(pertes)), key=lambda i: pertes[i])
    return {
        "dates": dates, "valeur": valeur, "verse": cumul_verse, "livret": valeur_livret,
        "total_verse": verse, "valeur_finale": valeur[-1], "livret_final": valeur_livret[-1],
        "parts": parts, "liquide": liquide, "frais": frais_payes, "nb_achats": nb_achats,
        "nb_mois": len(versements), "montant": montant, "fractions": fractions,
        "chute": chute, "chute_debut": dates[i_a], "chute_bas": dates[i_b],
        "chute_retour": dates[i_retour] if i_retour is not None else None,
        "mois_pour_remonter": None if i_retour is None else round(
            (dt.date.fromisoformat(dates[i_retour]) - dt.date.fromisoformat(dates[i_b])).days / 30.44),
        "pire_date": dates[i_pire], "pire_verse": cumul_verse[i_pire], "pire_valeur": valeur[i_pire],
    }


# ---------------------------------------------------------------- rapport

def _svg(r):
    L, H, M = 800, 360, 60
    courbes = [("ag", r["valeur"]), ("hasard", r["verse"]), ("arene", r["livret"])]
    tout = [v for _, c in courbes for v in c] + [0.0]
    ymin, ymax = 0.0, max(tout) * 1.05
    out = []
    for k in range(5):
        v = ymin + (ymax - ymin) * k / 4
        y = H - M - (H - 2 * M) * k / 4
        out.append(f'<line class="grille" x1="{M}" x2="{L - M}" y1="{y:.1f}" y2="{y:.1f}"/>'
                   f'<text class="axe" x="{M - 6}" y="{y + 4:.1f}" text-anchor="end">{euros(v)}</text>')
    debuts = {}
    for i, d in enumerate(r["dates"]):
        debuts.setdefault(d[:4], M + (L - 2 * M) * i / max(1, len(r["dates"]) - 1))
    annees = list(debuts.items())
    for k, (an, x) in enumerate(annees):
        if k + 1 < len(annees) and annees[k + 1][1] - x < 40:   # année à peine entamée : l'étiquette suivante suffit
            continue
        out.append(f'<text class="axe" x="{x:.1f}" y="{H - M + 18}" text-anchor="middle">{an}</text>')
    for nom, c in courbes:
        out.append(f'<polyline class="l-{nom}" points="{_points(c, L, H, ymin, ymax, M)}"/>')
    for c, txt in [(r["valeur"], "Ton ETF"), (r["verse"], "Versé"), (r["livret"], "Livret A")]:
        y = H - M - (H - 2 * M) * (c[-1] - ymin) / (ymax - ymin)
        out.append(f'<text class="etiq" x="{L - M + 4}" y="{y + 4:.1f}">{txt}</text>')
    out.append(f'<line id="curseur" class="curseur" x1="0" x2="0" y1="{M}" y2="{H - M}" visibility="hidden"/>')
    return (f'<svg id="graphe" viewBox="0 0 {L + 70} {H}" role="img" '
            f'aria-label="Valeur du plan mensuel, argent versé et Livret A">{"".join(out)}</svg>')


def ecrire_rapport_mensuel(actif, r):
    SORTIES.mkdir(parents=True, exist_ok=True)
    jour = dt.date.today().isoformat()
    chemin = SORTIES / f"{actif}-mensuel-{int(r['montant'])}{'-fractions' if r['fractions'] else ''}-{jour}.html"
    e = html.escape
    gain = r["valeur_finale"] - r["total_verse"]
    ans = r["nb_mois"] / 12
    pas = max(1, len(r["dates"]) // 600)
    idx = list(range(0, len(r["dates"]), pas)) + [len(r["dates"]) - 1]
    donnees = {"d": [r["dates"][i] for i in idx], "v": [round(r["valeur"][i]) for i in idx],
               "c": [round(r["verse"][i]) for i in idx], "l": [round(r["livret"][i]) for i in idx]}
    remonte = (f"il a fallu <b>{r['mois_pour_remonter']} mois</b> pour retrouver le niveau d'avant "
               f"(le {date_fr(r['chute_retour'])})" if r["chute_retour"] else "le niveau d'avant n'est <b>pas encore</b> retrouvé")
    pire = r["pire_valeur"] - r["pire_verse"]
    pire_txt = (f"Le {date_fr(r['pire_date'])}, tu avais versé <b>{euros(r['pire_verse'])}</b> et ça valait "
                f"<b>{euros(r['pire_valeur'])}</b> ({euros(pire)}). C'est là que beaucoup de gens vendent… et ratent la remontée."
                if pire < 0 else "Ton plan n'est jamais passé sous ce que tu avais versé : rare, ne compte pas dessus.")
    parts_txt = ("par morceaux de part (--fractions)" if r["fractions"] else
                 "en parts entières, comme sur un PEA : quand une part coûte plus que ton versement, l'argent attend")
    page = f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plan mensuel {e(actif)}</title>
<style>
{STYLE}
.l-ag {{ stroke:var(--s2); stroke-width:2.5; }} .l-arene {{ stroke:var(--s1); }}
</style></head><body><main>
<h1>Rayan's Arène · plan mensuel · {e(actif)}</h1>
<p class="sous">Argent fictif. {euros(r['montant'])} versés au début de chaque mois pendant {r['nb_mois']} mois
({ans:.1f} ans), achetés {parts_txt}. Frais : 0,5 % par achat, 1 € minimum (ordre de grandeur, à vérifier chez ton
courtier). On ne vend jamais.</p>

<p class="gros">Tu aurais versé {euros(r['total_verse'])}, ça vaudrait {euros(r['valeur_finale'])}
<span>({'+' if gain >= 0 else ''}{euros(gain)})</span></p>

<div class="chiffres">
 <div><small>Versé</small><b>{euros(r['total_verse'])}</b></div>
 <div><small>Valeur aujourd'hui</small><b>{euros(r['valeur_finale'])}</b></div>
 <div><small>Même argent sur un Livret A</small><b>{euros(r['livret_final'])}</b></div>
 <div><small>Pire chute de l'ETF</small><b>{pct(r['chute'])}</b></div>
 <div><small>Frais payés ({r['nb_achats']} achats)</small><b>{euros(r['frais'])}</b></div>
</div>

<div class="carte">
<h2 style="margin-top:0">Ce que vaut ton plan, mois après mois</h2>
<div class="legende"><span><i style="border-color:var(--s2)"></i>Ton ETF</span>
<span><i style="border-color:var(--neutre);border-top-style:dashed"></i>Argent versé</span>
<span><i style="border-color:var(--s1)"></i>Livret A</span></div>
<div class="graphe-boite">{_svg(r)}</div>
<div id="bulle">Passe le doigt ou la souris sur la courbe.</div>
</div>

<div class="lecon" style="margin-top:20px">
<h2>Les montagnes russes à prévoir</h2>
<ul>
<li><b>Pire chute :</b> l'ETF a perdu {pct(-r['chute']).lstrip('+')} entre le {date_fr(r['chute_debut'])} et le {date_fr(r['chute_bas'])} ;
{remonte}.</li>
<li><b>Pire moment pour toi :</b> {pire_txt}</li>
<li><b>Le secret, c'est de continuer.</b> Pendant une baisse, ton versement du mois achète les parts moins cher :
c'est ce qui fait remonter le plan plus vite.</li>
<li><b>Le passé ne garantit rien.</b> Ces 10 ans ont été bons pour les actions mondiales ; une autre période
peut être plus dure. Ne mets en bourse que de l'argent dont tu n'auras pas besoin avant au moins 5 à 8 ans,
après avoir gardé une épargne de côté.</li>
</ul></div>
<footer>Rayan's Arène — outil d'apprentissage, pas un conseil d'investissement. Taux du Livret A historiques,
intérêts calculés au mois (approximation). Généré le {jour}.</footer>
</main>
<script>
const D = {json.dumps(donnees)};
const svg = document.getElementById('graphe'), cur = document.getElementById('curseur'),
      bulle = document.getElementById('bulle');
const eu = v => v.toLocaleString('fr-FR') + ' €';
function montrer(ev) {{
  const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
  const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
  const sx = x * vb.width / r.width, M = 60, L = 800;
  const k = Math.round((sx - M) / (L - 2 * M) * (D.d.length - 1));
  if (k < 0 || k >= D.d.length) return;
  const px = M + (L - 2 * M) * k / (D.d.length - 1);
  cur.setAttribute('x1', px); cur.setAttribute('x2', px); cur.setAttribute('visibility', 'visible');
  const j = D.d[k].split('-').reverse().join('/');
  bulle.textContent = j + ' · versé ' + eu(D.c[k]) + ' · ton ETF ' + eu(D.v[k]) + ' · Livret A ' + eu(D.l[k]);
}}
svg.addEventListener('mousemove', montrer); svg.addEventListener('touchmove', montrer, {{passive: true}});
</script>
</body></html>"""
    chemin.write_text(page, encoding="utf-8")
    return chemin


def resume_console_mensuel(actif, r, chemin):
    gain = r["valeur_finale"] - r["total_verse"]
    print(f"=== Rayan's Arène · plan mensuel · {actif} · argent fictif ===")
    print(f"{euros(r['montant'])} par mois pendant {r['nb_mois']} mois → versé {euros(r['total_verse'])}, "
          f"valeur {euros(r['valeur_finale'])} ({'+' if gain >= 0 else ''}{euros(gain)})")
    print(f"  Livret A : {euros(r['livret_final'])}  |  frais payés : {euros(r['frais'])} ({r['nb_achats']} achats)")
    print(f"  pire chute de l'ETF : {pct(r['chute'])} ({date_fr(r['chute_debut'])} → {date_fr(r['chute_bas'])}), "
          + (f"remontée en {r['mois_pour_remonter']} mois" if r["chute_retour"] else "pas encore remontée"))
    print(f"Rapport : {chemin}")
