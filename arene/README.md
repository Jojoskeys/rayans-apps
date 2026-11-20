# Rayan's Arène

Apprendre le trading en **argent fictif uniquement** : aucun courtier, aucune clé, aucun ordre réel,
aucun effet de levier (positions longues ou cash).

L'idée vue dans des vidéos (« des mini-agents achètent et revendent, ceux qui ne gagnent pas assez
meurent »), mais testée honnêtement :

1. 200 stratégies simples tirées au hasard (croisement de moyennes mobiles, achat après baisse / vente après
   hausse, momentum, filtre de tendance).
2. Notées sur 3 ans d'entraînement (rendement ajusté du risque, pénalité si trop d'ordres). La moitié la moins
   bonne meurt, les survivantes font des enfants mutés. 20 générations.
3. La championne est jouée sur l'année suivante **sans rien toucher**, puis on décale d'un an (walk-forward).
   Seul le cumul des années de test compte.
4. Comparaison obligatoire avec « acheter et garder » et la médiane de 200 stratégies au hasard.
   Frais 0,1 % + glissement 0,05 % à chaque ordre.

## Sur le téléphone et le PC

Tuile **Arène** de Rayan's Mobile (https://jojoskeys.github.io/rayans-apps/arene/, à ouvrir aussi dans le
navigateur du PC) : **arène animée** (une vraie évolution de 200 petits robots filmée génération par génération :
ils grossissent quand ils gagnent, la moitié meurt, les survivants font des enfants, puis la championne passe
l'examen sur l'année jamais vue contre « acheter et garder » ; `film.json`), plan mensuel au choix du montant (calculé sur le téléphone) et résultats des robots avec leurs
rapports. Chaque lundi, `.github/workflows/mobile.yml` lance `python arene/publier.py arene/publie` (prix publics
et rapports à jour), puis reconstruit Rayan's Mobile.

## Commandes (dans `arene/`)

| Commande | Rôle |
| --- | --- |
| `python arene.py lancer demo` | essai sans réseau sur une série synthétique (graine fixe) |
| `python arene.py telecharger SPY BTC-USD` | 10 ans de prix journaliers → `donnees/<actif>.csv` (demande `pip install yfinance`) |
| `python arene.py lancer SPY --generations 20 --population 200 --graine 1` | évolution + walk-forward → `sorties/<actif>-<date>.html` et résumé console |
| `python arene.py telecharger CW8.PA` puis `python arene.py mensuel CW8.PA --montant 100` | **plan mensuel** : 100 € versés chaque mois sur un ETF monde (CW8 = Amundi MSCI World, éligible PEA), parts entières comme sur un PEA (`--fractions` sinon), frais 0,5 % / 1 € minimum ; versé, valeur, pire chute et temps pour remonter, pire moment en euros, même argent sur un Livret A → `sorties/<actif>-mensuel-<montant>-<date>.html` |
| `python -m unittest discover -s tests` | tests (frais, pas de fuite du futur, walk-forward, reproductibilité) |

Dépendances : Python 3 et numpy ; `yfinance` seulement pour télécharger. `donnees/` et `sorties/` ne sont
pas suivis par git. Le rapport HTML est autonome (aucun CDN), clair/sombre, lisible sur téléphone.

Ce n'est pas un conseil d'investissement. L'AMF rappelle que la plupart des particuliers perdent de l'argent
sur le forex et les CFD.
