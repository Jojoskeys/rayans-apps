"""Rapport HTML autonome de l'Arène (aucun CDN : le graphique est un SVG écrit ici)."""
import datetime as dt
import html
import json

from arene import SORTIES, decrire, pct


STYLE = """:root { --fond:#fcfcfb; --carte:#ffffff; --texte:#0b0b0b; --texte2:#52514e; --trait:#e4e3df;
  --s1:#2a78d6; --s2:#eb6834; --neutre:#8a8984; --alerte:#fff4e0; --alerte-bord:#eda100; }
@media (prefers-color-scheme: dark) { :root { --fond:#1a1a19; --carte:#242423; --texte:#f0efec;
  --texte2:#c3c2b7; --trait:#383835; --s1:#3987e5; --s2:#d95926; --neutre:#8f8e88;
  --alerte:#2e2614; --alerte-bord:#c98500; } }
* { box-sizing:border-box; }
body { margin:0; background:var(--fond); color:var(--texte); font:16px/1.5 system-ui,-apple-system,sans-serif; }
main { max-width:960px; margin:0 auto; padding:16px; }
h1 { font-size:1.3rem; margin:.2em 0; } h2 { font-size:1.05rem; margin:1.4em 0 .5em; }
.sous { color:var(--texte2); margin:0 0 1em; }
.gros { font-size:clamp(1.3rem, 4.5vw, 2rem); font-weight:700; margin:.4em 0; line-height:1.25; }
.gros span { color:var(--texte2); font-weight:500; }
.carte { background:var(--carte); border:1px solid var(--trait); border-radius:12px; padding:14px; margin:12px 0; }
.chiffres { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; }
.chiffres div { background:var(--carte); border:1px solid var(--trait); border-radius:10px; padding:10px; }
.chiffres b { display:block; font-size:1.25rem; } .chiffres small { color:var(--texte2); }
svg { width:100%; height:auto; display:block; }
.grille { stroke:var(--trait); stroke-width:1; } .zero { stroke:var(--neutre); stroke-width:1; }
.axe, .etiq { fill:var(--texte2); font-size:12px; }
polyline { fill:none; stroke-width:2; stroke-linejoin:round; }
.l-arene { stroke:var(--s1); } .l-ag { stroke:var(--s2); }
.l-hasard { stroke:var(--neutre); stroke-dasharray:5 4; }
.curseur { stroke:var(--texte2); stroke-width:1; }
.legende { display:flex; flex-wrap:wrap; gap:14px; font-size:.9rem; color:var(--texte2); margin:6px 0; }
.legende i { display:inline-block; width:18px; height:0; border-top:2px solid; vertical-align:middle; margin-right:6px; }
#bulle { min-height:1.5em; font-size:.9rem; color:var(--texte2); }
.tab { overflow-x:auto; }
table { border-collapse:collapse; width:100%; font-size:.92rem; }
th, td { text-align:left; padding:6px 8px; border-bottom:1px solid var(--trait); vertical-align:top; }
th { color:var(--texte2); font-weight:600; } td.regle { min-width:240px; } td { white-space:nowrap; } td.regle { white-space:normal; }
.graphe-boite { overflow-x:auto; } .graphe-boite svg { min-width:620px; }
.lecon { background:var(--alerte); border:1px solid var(--alerte-bord); border-radius:12px; padding:14px 16px; }
.lecon h2 { margin-top:0; } .lecon li { margin:.35em 0; }
footer { color:var(--texte2); font-size:.85rem; margin:24px 0; }
"""


def _points(courbe, larg, haut, ymin, ymax, marge):
    n = len(courbe)
    pts = []
    pas = max(1, n // 600)  # assez de points pour l'œil, page légère
    for i in list(range(0, n, pas)) + [n - 1]:
        x = marge + (larg - 2 * marge) * i / max(1, n - 1)
        y = haut - marge - (haut - 2 * marge) * (courbe[i] - ymin) / (ymax - ymin)
        pts.append(f"{x:.1f},{y:.1f}")
    return " ".join(pts)


def svg_courbes(res):
    L, H, M = 800, 360, 60
    courbes = [("arene", res["courbe_arene"]), ("ag", res["courbe_ag"]), ("hasard", res["courbe_hasard"])]
    tout = [v for _, c in courbes for v in c] + [1.0]
    ymin, ymax = min(tout) * 0.97, max(tout) * 1.03
    lignes = []
    # grille discrète : 4 graduations
    for k in range(5):
        v = ymin + (ymax - ymin) * k / 4
        y = H - M - (H - 2 * M) * k / 4
        lignes.append(f'<line class="grille" x1="{M}" x2="{L - M}" y1="{y:.1f}" y2="{y:.1f}"/>'
                      f'<text class="axe" x="{M - 6}" y="{y + 4:.1f}" text-anchor="end">{pct(v - 1)}</text>')
    y1 = H - M - (H - 2 * M) * (1 - ymin) / (ymax - ymin)
    lignes.append(f'<line class="zero" x1="{M}" x2="{L - M}" y1="{y1:.1f}" y2="{y1:.1f}"/>')
    # années en abscisse
    dates = res["dates"]
    vu = set()
    for i, d in enumerate(dates):
        if d[:4] not in vu:
            vu.add(d[:4])
            x = M + (L - 2 * M) * i / max(1, len(dates) - 1)
            lignes.append(f'<text class="axe" x="{x:.1f}" y="{H - M + 18}" text-anchor="middle">{d[:4]}</text>')
    for nom, c in courbes:
        lignes.append(f'<polyline class="l-{nom}" points="{_points(c, L, H, ymin, ymax, M)}"/>')
    # étiquettes directes en bout de ligne
    for nom, c, txt in [("arene", res["courbe_arene"], "Arène"), ("ag", res["courbe_ag"], "Acheter et garder")]:
        y = H - M - (H - 2 * M) * (c[-1] - ymin) / (ymax - ymin)
        lignes.append(f'<text class="etiq" x="{L - M + 4}" y="{y + 4:.1f}">{txt}</text>')
    lignes.append(f'<line id="curseur" class="curseur" x1="0" x2="0" y1="{M}" y2="{H - M}" visibility="hidden"/>')
    return (f'<svg id="graphe" viewBox="0 0 {L + 60} {H}" role="img" '
            f'aria-label="Courbe Arène contre acheter et garder sur les années de test">{"".join(lignes)}</svg>')


def ecrire_rapport(actif, res, reglages, chemin=None):
    SORTIES.mkdir(parents=True, exist_ok=True)
    jour = dt.date.today().isoformat()
    chemin = chemin or SORTIES / f"{actif}-{jour}.html"
    e = html.escape
    lignes_fen = "".join(
        f"<tr><td>{f['annee']}</td><td>{f['entrainement']}</td><td>{pct(f['entr_annuel'])}/an</td>"
        f"<td><b>{pct(f['test'])}</b></td><td>{pct(f['ag'])}</td><td>{f['ordres_test']}</td></tr>"
        for f in res["fenetres"])
    vues, survivantes = set(), []
    for s in res["fenetres"][-1]["survivantes"]:
        cle = (round(s["note"], 4), round(s["rendement"], 4), s["ordres"])  # mêmes résultats = même famille
        if cle not in vues:
            vues.add(cle)
            survivantes.append(s)
    lignes_surv = "".join(
        f"<tr><td>{i + 1}</td><td class='regle'>{e(decrire(s['genome']))}</td><td>{format(s['note'], '.2f').replace('.', ',')}</td>"
        f"<td>{pct(s['rendement'])}</td><td>{s['ordres']}</td></tr>"
        for i, s in enumerate(survivantes[:8]))
    der = res["fenetres"][-1]
    bat = res["total_arene"] > res["total_ag"]
    verdict = ("L'Arène a fait mieux qu'acheter et garder ici — vérifie avec une autre graine et un autre actif "
               "avant d'y croire." if bat else
               "Acheter et garder a fait mieux que l'Arène : c'est le cas le plus fréquent, et c'est la leçon.")
    donnees = {"d": res["dates"][:: max(1, len(res["dates"]) // 600)] + [res["dates"][-1]]}
    pas = max(1, len(res["dates"]) // 600)
    for nom in ("arene", "ag", "hasard"):
        c = list(res["courbe_" + nom])
        donnees[nom] = [round(v - 1, 4) for v in c[::pas] + [c[-1]]]
    page = f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Arène {e(actif)}</title>
<style>
{STYLE}</style></head><body><main>
<h1>Rayan's Arène · {e(actif)}</h1>
<p class="sous">Argent fictif uniquement. {reglages['generations']} générations × {reglages['population']}
stratégies, graine {reglages['graine']}. Entraînement sur 3 ans, test sur l'année suivante sans rien toucher,
puis on décale d'un an. Frais 0,1 % + glissement 0,05 % à chaque ordre.</p>

<p class="gros">Résultat sur des années jamais vues : {pct(res['total_arene'])}
<span>(acheter et garder : {pct(res['total_ag'])})</span></p>
<p>{verdict}</p>

<div class="chiffres">
 <div><small>Arène, années de test</small><b>{pct(res['total_arene'])}</b></div>
 <div><small>Acheter et garder</small><b>{pct(res['total_ag'])}</b></div>
 <div><small>Médiane de {len(res['net_hasard'])} stratégies au hasard</small><b>{pct(res['total_hasard'])}</b></div>
 <div><small>Écart moyen entraînement → test</small><b>{pct(res['ecart_moyen'])}/an</b></div>
</div>

<div class="carte">
<h2 style="margin-top:0">Arène contre acheter et garder (années de test seulement)</h2>
<div class="legende"><span><i style="border-color:var(--s1)"></i>Arène</span>
<span><i style="border-color:var(--s2)"></i>Acheter et garder</span>
<span><i style="border-color:var(--neutre);border-top-style:dashed"></i>Médiane des stratégies au hasard</span></div>
<div class="graphe-boite">{svg_courbes(res)}</div>
<div id="bulle">Passe le doigt ou la souris sur la courbe.</div>
</div>

<h2>Chaque année de test</h2>
<p class="sous">« Entraînement » = ce que la championne faisait sur le passé qu'elle a appris.
« Test » = ce qu'elle a fait ensuite, sur une année jamais vue. Un grand écart = surapprentissage.</p>
<div class="tab"><table><tr><th>Année testée</th><th>Apprise sur</th><th>Entraînement</th><th>Test</th>
<th>Acheter et garder</th><th>Ordres</th></tr>{lignes_fen}</table></div>

<h2>Meilleures survivantes (dernière arène, apprise sur {der['entrainement']})</h2>
<div class="tab"><table><tr><th>#</th><th>Règle</th><th>Note</th><th>Rendement entraînement</th><th>Ordres</th></tr>
{lignes_surv}</table></div>

<div class="lecon" style="margin-top:20px">
<h2>Ce que ça t'apprend</h2>
<ul>
<li><b>Surapprentissage.</b> Sur le passé, les survivantes ont toujours l'air géniales : elles ont été choisies
pour ça. Seules les années jamais vues comptent, et l'écart entre les deux est souvent énorme.</li>
<li><b>Les frais mangent tout.</b> 0,15 % par ordre paraît rien ; une stratégie qui passe 40 ordres par an
perd environ 6 % par an rien qu'en frais.</li>
<li><b>Le hasard fait parfois aussi bien.</b> Si l'Arène ne bat pas nettement la médiane des stratégies tirées
au hasard, elle n'a rien trouvé de réel.</li>
<li><b>Méfie-toi des « bots IA » payants.</b> Une courbe magnifique sur le passé ne prouve rien. Demande
toujours : testée sur des années jamais vues ? frais compris ? comparée à acheter et garder ? Si quelqu'un
vendait une machine à gagner, il ne la vendrait pas.</li>
<li><b>Rappel AMF.</b> L'Autorité des marchés financiers rappelle que la grande majorité des particuliers
perdent de l'argent sur le forex et les CFD (souvent avec effet de levier). Ici, il n'y a jamais d'argent réel,
aucun courtier, aucun levier.</li>
</ul></div>
<footer>Rayan's Arène — outil d'apprentissage, pas un conseil d'investissement. Généré le {jour}.</footer>
</main>
<script>
const D = {json.dumps(donnees)};
const svg = document.getElementById('graphe'), cur = document.getElementById('curseur'),
      bulle = document.getElementById('bulle');
const f = v => (v >= 0 ? '+' : '') + (v * 100).toFixed(1).replace('.', ',') + ' %';
function montrer(ev) {{
  const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
  const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
  const sx = x * vb.width / r.width, M = 60, L = 800;
  const k = Math.round((sx - M) / (L - 2 * M) * (D.d.length - 1));
  if (k < 0 || k >= D.d.length) return;
  const px = M + (L - 2 * M) * k / (D.d.length - 1);
  cur.setAttribute('x1', px); cur.setAttribute('x2', px); cur.setAttribute('visibility', 'visible');
  bulle.textContent = D.d[k] + ' · Arène ' + f(D.arene[k]) + ' · Acheter et garder ' + f(D.ag[k]) +
    ' · Hasard (médiane) ' + f(D.hasard[k]);
}}
svg.addEventListener('mousemove', montrer); svg.addEventListener('touchmove', montrer, {{passive: true}});
</script>
</body></html>"""
    chemin.write_text(page, encoding="utf-8")
    return chemin
