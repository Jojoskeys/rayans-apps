# Rayan's Calcul mental

Application Windows (Tauri + React + TypeScript) pour progresser en calcul mental avec les méthodes qui ont des
preuves, sans promettre plus que la recherche : ces exercices entraînent surtout le calcul mental lui-même.

## Ce qu'elle contient

- **Séance du jour** (5, 10, 15 ou 20 min ; 10 par défaut) : 1 astuce (nouvelle, ou celle à revoir), un
  entraînement adaptatif mélangé, puis un défi de 60 s facultatif. Série de jours.
- **10 astuces** : × 11, carrés des nombres en 5, × 9 (et 99), × 5 / × 25 / × 50, compléments à 100 et 1000,
  décomposition, pourcentages (10 %, 5 %, 15 %, 20 %, x % de y = y % de x), arrondir puis corriger,
  multiplication près de 100, division par 5. Chacune : explication pas à pas, exemple animé, pourquoi ça marche
  en une phrase, puis 10 exercices (du plus facile au plus dur).
- **Entraînement adaptatif** : additions et soustractions (1 → 3 chiffres), tables, × 1 chiffre, × 2 chiffres,
  pourcentages, astuces apprises. Un niveau par type (2 réussites → +1, 1 erreur → −1). Types **mélangés**
  (jamais deux fois le même de suite). Correction immédiate avec la décomposition après une erreur. Les calculs
  ratés reviennent 3 questions plus tard, puis à J+1, J+3 et J+7.
- **Estimer d'abord** : une estimation rapide (acceptée à 10 % près) avant le calcul exact.
- **Défis chronométrés** (facultatifs, difficulté fixe) : 60 s, 2 min, « 20 questions » ; meilleur score par défi.
  Le chrono est caché par défaut pendant l'entraînement (réglable).
- **Tests** : test de départ puis de suivi chaque semaine, 20 calculs (5 types × 4 niveaux), même difficulté à
  chaque fois, nombres tirés avec une graine ; on compare la justesse et le temps moyen.
- **Fiches** (✅ prouvé / ⚠️ discuté / ❌ mythe) : se tester, mélanger, astuces, estimation, stress et chrono,
  « bosse des maths » ; **quiz vrai ou faux** (11 questions) ; **Sources** ; **Progrès** (courbes SVG, niveaux,
  records, tests comparés).
- Pavé numérique à l'écran (gros boutons sur téléphone) et clavier physique (Entrée valide).

## Développer

```
npm install
npm run dev:ui     # interface seule dans le navigateur (port 1437, données dans localStorage)
npm run dev        # application Tauri
npm test           # vérification des types + tests (générateur, astuces, niveaux, révisions, séance, fusion)
npm run build:ui   # construction de l'interface
```

- `src/core/` : la logique sans interface (testée) — `question.ts`, `calculs.ts` (décompositions),
  `generateur.ts`, `astuces.ts`, `niveaux.ts`, `entrainement.ts`, `espacement.ts`, `defis.ts` (défis et tests),
  `seance.ts`, `stats.ts`, `fiches.ts`, `model.ts`, `rng.ts`.
- `src/serie.tsx` (une série de calculs), `src/clavier.tsx`, `src/activites.tsx`, `src/views/` : l'interface.
- Données : `%APPDATA%\fr.rayan.calcul\calcul.json` (ou `CALCUL_DATA_DIR`), copie de secours et copie par jour.
- iPhone : `src/storage.ts` utilise `window.rayansStore` (fichier `calcul`) quand il existe ; la fusion PC ↔ iPhone
  se fait avec `fusionnerTexte(local, distant)` de `src/core/model.ts` (résultats et séances additionnés,
  niveaux, calculs à revoir et réglages : le plus récent gagne).

## Sources principales

- Rowland (2014), méta-analyse sur l'effet du test : https://pubmed.ncbi.nlm.nih.gov/25150680/
- Rohrer et al. (2020), exercices mélangés en maths : https://ies.ed.gov/ncee/wwc/Study/88770
- Brendefur et al. (2015), stratégies puis pratique : https://scholarworks.boisestate.edu/cifs_facpubs/150
- Bjork, difficultés désirables : https://www.psychologicalscience.org/observer/desirable-difficulties
- Ashcraft & Krause (2007), anxiété mathématique : https://dx.doi.org/10.3758/BF03194059
- Barner et al. (2016), boulier mental : https://dash.harvard.edu/bitstream/handle/1/41364831/Barneretal.inpress.pdf?sequence=1
- Torbeyns, Obersteiner & Verschaffel (2012) ; Siegler (estimation) ; Kornell, Hays & Bjork (2009) ;
  Pesenti et al. (2001) ; Sisk et al. (2018).
