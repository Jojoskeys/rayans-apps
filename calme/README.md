# Rayan's Calme

Application Windows (Tauri + React + TypeScript), prévue aussi pour Rayan's Mobile, pour souffler et mieux gérer le
stress au quotidien, avec ce que la recherche montre vraiment. **App de bien-être, pas de soin.**

## Ce qu'elle contient

- **Séance du jour** (5, 10, 15 ou 20 min, 10 par défaut) : respiration lente → « Nommer et réévaluer » ou
  « 3 choses bien » (en alternance) → relaxation musculaire (à 20 min) → mot de fin.
- **Respiration lente guidée** : cercle qui grandit et rétrécit (SVG, immobile avec une barre si « réduire les
  animations » est activé), rythmes 6/min (5 s / 5 s), 4-6 et soupir cyclique, 2 / 3 / 5 / 10 min, son doux (Web
  Audio) et vibration en option, ressenti 1-10 avant / après facultatif. Seule difficulté adaptative de l'app : après
  2 séances terminées de suite, durée proposée plus longue ; après un arrêt, plus courte (`src/core/niveaux.ts`).
- **Nommer et réévaluer** : roue de mots avec nuances et intensité 0-10, situation, pensée automatique, 5 questions
  (preuves pour / contre, ami, dans un an, ce que je contrôle), pensée plus équilibrée, intensité après.
- **3 choses bien aujourd'hui** (+ pourquoi), rappel du soir facultatif sur l'accueil.
- **Avant l'examen / le moment stressant** (en un clic depuis l'accueil) : respiration 2 min → écrire ce qui inquiète
  → « mon cœur accélère, mon corps se prépare » → une respiration finale, avec les limites des preuves.
- **Relaxation musculaire** guidée (5 min), présentée comme pratique de confort.
- **Si ça ne va vraiment pas** : bouton toujours visible ; 3114, 15, 112, SOS Amitié (liens `tel:`), signes pour
  consulter. Affiché aussi d'office si l'intensité est ≥ 9 ou si « j'ai des idées noires » est coché.
- **Journal** privé, **Progrès** (ressenti avant / après, série de jours, émotions les plus nommées, questionnaire de la
  semaine fait maison, non clinique), **Fiches** ✅/⚠️/❌, **quiz** vrai/faux (10 questions), **Sources**.

## Développer

```
npm install
npm run dev:ui     # interface seule dans le navigateur (données dans localStorage), port 1439
npm run dev        # application Tauri
npm test           # vérification des types + tests (respiration, niveau, séance, questionnaire, progrès, fusion)
```

- `src/core/` : la logique sans interface (testée), imports internes avec l'extension `.ts`.
- Données : `%APPDATA%\fr.rayan.calme\calme.json` (ou `CALME_DATA_DIR`), copie de secours et copie par jour ; sur
  l'iPhone, `window.rayansStore` (fichier `calme`) ; sinon localStorage `rayans-calme-db`.
- Fusion PC ↔ iPhone : `fusionnerTexte` (`src/core/model.ts`) — respirations, séances, questionnaires : union par
  identifiant ; journal (émotions, gratitudes, écrits), niveau et réglages : le plus récent gagne (champ `maj`).

## Sources principales

Zaccaro et al. 2018 (respiration lente) ; Balban et al. 2023 (soupir cyclique) ; Lieberman et al. 2007 (nommer) ;
Gross & John 2003 (réévaluation) ; Frattaroli 2006 (écriture expressive) ; Diniz et al. 2023 et Emmons & McCullough
2003 (gratitude) ; Ramirez & Beilock 2011 et Myers, Davis & Chan 2021 (écrire avant l'examen) ; Jamieson et al. 2010
(stress comme énergie) ; Goyal et al. 2014 (méditation) ; Bushman 2002 (colère). Liste complète dans l'onglet Sources.
