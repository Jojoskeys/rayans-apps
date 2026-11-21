# Rayan's Sommeil

Application Windows (Tauri + React + TypeScript), prévue aussi pour Rayan's Mobile, pour mieux dormir en partant de
l'heure de Fajr, avec ce que la recherche montre vraiment.

## Ce qu'elle contient

- **Ce soir / Ce matin** : heure de coucher conseillée = Fajr du lendemain − durée visée (7 h 30 par défaut, de 7 à
  9 h par pas de 15 min) − temps pour s'endormir (15 min par défaut). Début de la routine (coucher − 45 min) et
  dernier café conseillé (coucher − 6 h). Option « je me recouche après Fajr » : 1ʳᵉ partie jusqu'à Fajr, 2ᵉ partie
  pour compléter la durée, heure de lever finale (sans prétendre que c'est mieux qu'une nuit d'un bloc).
- **Objectif de la semaine** : part de l'heure de coucher habituelle (après 3 nuits notées) et avance de 15 min quand
  la semaine précédente est tenue 5 nuits sur 7, jusqu'à l'heure conseillée.
- **Routine du soir** : liste à cocher, modifiable (lumière, écran, affaires, wudu, dhikr/lecture, chambre, pensées).
- **Journal du matin** (moins de 30 s) : coucher, endormissement, réveils, lever, énergie 1–5, sieste, caféine après
  14 h, écran la dernière heure.
- **Progrès** : sommeil moyen, régularité du lever (écart-type et nuits à ± 30 min du lever habituel), nuage
  « énergie selon la durée » en SVG, série de jours notés, bilans comparés. Jamais de note (orthosomnie).
- **Bilan de la semaine** : 6 questions écrites pour l'app (pas un questionnaire clinique, pas un outil médical).
- **Fiches** ✅/⚠️/❌ (dont « Quand voir un médecin », bien visible) et **quiz vrai/faux** (10 questions), **Sources**.

## Développer

```
npm install
npm run dev:ui     # interface seule dans le navigateur (données dans localStorage), port 1436
npm run dev        # application Tauri
npm test           # vérification des types + tests (heures, Fajr, objectif, tendances, bilan, fusion)
```

- `src/core/` : la logique sans interface (testée). Fajr est calculé par `priere/src/core/praytimes.ts` (importé
  directement, ainsi que `cities.ts` et `settings.ts` de Rayan's Prière, sans les modifier).
- Lieu et méthode : sur PC, commande `read_priere` (lecture seule de `%APPDATA%\Rayans Priere\priere.json`) ; sur
  l'iPhone, `window.rayansStore.load("priere")` ; sinon réglages propres à Sommeil (villes de France ou saisie).
- Données : `%APPDATA%\fr.rayan.sommeil\sommeil.json` (ou `SOMMEIL_DATA_DIR`), copie de secours et copie par jour.
- Fusion PC ↔ iPhone : `fusionnerTexte` (`src/core/model.ts`) — nuits et réglages : la plus récente gagne
  (champ `maj`) ; bilans : union par identifiant.

## Sources principales

Watson et al. 2015 (AASM/SRS) ; Hirshkowitz et al. 2015 (NSF) ; Phillips et al. 2017 et Cribb et al. 2023 (régularité) ;
Drake et al. 2013 (caféine) ; Brooks & Lack 2006 (siestes) ; Edinger et al. 2021 (TCC-I) ; Rasch & Born 2013 (mémoire) ;
Ebrahim et al. 2013 (alcool) ; Stutz et al. 2019 (sport) ; Depner et al. 2019 (week-end) ; Baron et al. 2017 (orthosomnie).
Liste complète dans l'onglet Sources.
