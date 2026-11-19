# Rayan's Bonnes Affaires

Repère les annonces d'occasion vendues bien en dessous de leur prix habituel (vêtements de marque,
électronique) et les classe : prix total, prix habituel estimé, écart, gain possible à la revente, lien,
distance ou livraison.

L'app **lit seulement** des annonces. Elle n'achète rien, ne contacte aucun vendeur et ne se connecte à
aucun compte.

## Lancer

```
npm run demo     # classement d'exemple, sans réseau ni réglages
npm start        # vraie recherche (eBay si clés + fichiers du dossier imports/)
npm test
```

Le classement s'affiche dans le terminal et dans `resultats/classement.html` (à ouvrir dans le navigateur).

## Réglages

Copier `reglages.exemple.json` en `reglages.json` (ignoré par git, rien de personnel ne part dans le dépôt) :

- `domiciles` : un ou plusieurs points de départ (nom + code postal) pour la distance (coordonnées via
  geo.api.gouv.fr, service public gratuit).
- `distanceMaxKm` : rayon de la zone de retrait autour de chaque point de départ.
- `ecartMin` : 0,25 = au moins 25 % moins cher que le prix habituel.
- `fraisRevente` : part perdue à la revente (commission + envoi), pour le gain estimé.
- `recherches` : ce qu'on cherche. `prixHabituel` est conseillé pour l'électronique (prix neuf courant
  ou prix Back Market) ; sinon l'app prend la médiane des annonces trouvées (au moins 5).
  `prixMax` et `exclure` affinent la recherche.

L'app écarte d'office les annonces « pour pièces », « HS », coques, boîtes vides, copies (« style »,
« façon », « réplique »), annonces « recherche » ou « échange ». Un prix plus de 75 % sous l'habituel, envoyé de loin, est
gardé mais marqué « méfiance » : c'est souvent une arnaque.

## Les sites : ce qui est permis

| Site | Accès officiel | Robot permis ? | Solution retenue |
| --- | --- | --- | --- |
| **eBay** | API « Browse » officielle (compte développeur gratuit) | Oui, par l'API | **Branché** : recherche automatique, annonces en France, port et code postal |
| **Vinted** | Pas d'API publique (l'API « Pro » est réservée aux vendeurs pros) | Non : les conditions interdisent robots et aspiration, compte bloqué à la clé | Alertes de recherches sauvegardées dans l'app Vinted + import de fichier |
| **Leboncoin** | Pas d'API publique pour les annonces, site protégé contre les robots | Non | Alertes de recherches sauvegardées + import de fichier |
| **Facebook Marketplace** | Aucune API Marketplace ; Meta interdit la collecte automatique sans permission | Non (Meta poursuit en justice) | Notifications Marketplace + import de fichier |
| **Back Market** | API réservée aux vendeurs | Non | Sert de **prix habituel** de l'électronique reconditionnée, à recopier dans `prixHabituel` ; alertes prix du site |
| **Rakuten** | Flux produits via le programme d'affiliation (Awin), API vendeurs | Par l'affiliation seulement | Plus tard, si on s'inscrit à l'affiliation |

Les « API Vinted / Leboncoin / Facebook » vendues en ligne (Apify, RapidAPI...) sont des robots
d'aspiration : elles enfreignent les conditions des sites. Elles ne sont pas utilisées.

### Pourquoi c'est sans risque pour les comptes

- eBay passe par l'API officielle, avec des clés de développeur et non le compte acheteur.
- Vinted, Leboncoin et Facebook ne reçoivent **aucune requête de l'app**. On y garde ses recherches
  sauvegardées et leurs alertes (c'est leur fonction prévue) ; quand une annonce paraît intéressante, on la
  met dans un fichier du dossier `imports/` et l'app la compare et la classe avec le reste.

## Activer eBay

1. Créer un compte sur [developer.ebay.com](https://developer.ebay.com) (gratuit, à faire soi-même).
2. Créer une application, prendre les clés **Production** (App ID = `clientId`, Cert ID = `clientSecret`).
3. Les coller dans `reglages.json`, puis `npm start`.

eBay fixe un nombre d'appels par jour, visible dans le compte développeur ; une recherche = un appel.

## Importer des annonces d'autres sites

Déposer des fichiers `.csv` (séparateur `;`) ou `.json` dans `imports/` :

```
site;titre;prix;port;lien;codePostal;livrable
Vinted;Doudoune The North Face Nuptse M;60;5,20;https://www.vinted.fr/items/...;;oui
Leboncoin;Ecran LG 27 4K;120;;https://www.leboncoin.fr/ad/...;69003;non
```

Colonnes facultatives : `ville`, `etat`, `recherche`, `prixHabituel`, `remiseEnMain`, `lat`, `lon`.
Une annonce sans colonne `recherche` est rattachée à la première recherche dont elle contient tous les mots.

## Mes choix, sûreté et zone de retrait

En haut de la page, **Mes choix** met en avant les 5 offres qui ont le meilleur compromis entre le prix,
la sûreté et la distance. Chaque offre reçoit un avis, toujours expliqué (« + » rassure, « − » inquiète) :

- **sûr** : rien d'inquiétant ;
- **à vérifier** : prix très bas, vendeur peu connu, frais de port ou lieu inconnus ;
- **méfiance** : prix plus de 75 % sous l'habituel envoyé de loin, vendeur mal noté, ou Facebook à distance
  (aucune protection si on paie avant de recevoir). Ces offres ne sont jamais dans « Mes choix ».

La **zone de retrait** est un cercle de `distanceMaxKm` km (40 par défaut) autour de chaque point de départ
de `domiciles` ; la distance est comptée depuis le plus proche. Dans la zone, on va chercher l'objet : pas
de frais de port, on le voit et on l'essaie avant de payer, donc l'offre monte au classement. Hors zone,
seules les annonces livrables restent, si possible avec la protection acheteur du site.

Chaque offre affiche aussi la photo de l'annonce (eBay la donne ; pour un import, colonne `photo` avec une
adresse `https://`). Colonnes d'import en plus : `vendeurNote` (% d'avis positifs), `vendeurAvis`.

## Sur l'iPhone : tuile « Bonnes affaires »

À chaque lancement, l'app dépose aussi le classement dans `Documents\Rayan's Bonnes Affaires\offres.json`.
Rayan's Télécommande le lit (adresse `GET /api/bonnes-affaires`, en lecture seule) et la tuile
« Bonnes affaires » de Rayan's Mobile l'affiche : « Mes choix » avec photo, prix, remise, avis et raisons,
puis les autres offres. Un appui sur l'annonce l'ouvre sur le site.

- Il faut que la Télécommande soit associée (tuile Télécommande) et à jour (Rayan's Launcher).
- La tuile montre le dernier classement calculé sur le PC : relancer `npm start` pour le mettre à jour.
- Après `npm run demo`, la tuile affiche un bandeau « données d'exemple ».
