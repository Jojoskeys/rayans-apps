# Rayan's Focus

Application Windows (Tauri + React + TypeScript) pour entraîner son attention et protéger son temps de travail,
sans promettre plus que la recherche.

## Ce qu'elle contient

- **Séance du jour** (5, 10, 15 ou 20 min ; 10 par défaut) : 2 à 5 exercices courts au niveau actuel, dans un
  ordre qui tourne chaque jour, puis un bloc de travail profond proposé (facultatif, en plus).
- **5 exercices** à difficulté en escalier (2 réussites → niveau +1, 1 échec → niveau −1) :
  - *Trouver la cible* (recherche visuelle) : plus de symboles, plus ressemblants, moins de temps ;
  - *Flèche du milieu* (flanker) : écart de temps entre flèches pareilles et flèches contraires ;
  - *Couleur du mot* (Stroop) : cliquer la couleur de l'encre, pas le mot ;
  - *Rester sur la tâche* (type SART) : appuyer pour tous les chiffres sauf le 3, puis ignorer de fausses
    notifications ;
  - *Coût du changement* : pair/impair et plus petit/plus grand que 5, en blocs puis mélangés, avec le temps
    perdu à chaque changement.
- **Travail profond** : paliers 15 → 20 → 25 → 30 → 40 → 50 min (2 séances réussies de suite → palier suivant,
  1 abandon → palier précédent ; réussie = allée au bout avec 2 distractions notées au plus), objectif et
  intention « si… alors… » avant de commencer, bouton « J'ai été distrait », pause de 3 à 5 min proposée
  (option « sortir dehors »), son discret de fin (Web Audio). Dans l'app de bureau, bouton « Ouvrir Rayan's
  Chrono » (cherché dans les applications installées par Rayan's Launcher).
- **Journal des distractions** : liste, répartition par type et par heure.
- **Tests** : test de départ puis de suivi chaque semaine, toujours aux mêmes conditions (1 min de recherche
  au niveau 5 + 1 min de flèches au niveau 4), comparés dans « Progrès ».
- **Fiches** (✅ prouvé / ⚠️ discuté / ❌ mythe), **quiz vrai ou faux** (10 questions) et **Sources**.

## Sources principales

Simons et al. 2016 et Melby-Lervåg, Redick & Hulme 2016 (brain training : peu de transfert) ; Eriksen & Eriksen
1974 ; MacLeod 1991 (Stroop) ; Monsell 2003 (changement de tâche) ; Ophir, Nass & Wagner 2009 ; Ward et al. 2017
et Ruiz Pardo & Minda 2022 (téléphone, non reproduit) ; Altmann & Trafton 2002, Mark, Gudith & Klocke 2008
(interruptions) ; Hagger & Chatzisarantis 2016 (« volonté batterie » non reproduite) ; Mackworth 1948 (vigilance) ;
Ariga & Lleras 2011, Albulescu et al. 2022 (pauses) ; Kaplan 1995, Berman, Jonides & Kaplan 2008 (nature) ;
Gollwitzer & Sheeran 2006 (« si… alors… »). Liens vérifiés dans `src/core/contenu.ts`.

## Développer

```
npm install
npm run dev:ui     # interface seule dans le navigateur (port 1435, données dans localStorage)
npm run dev        # application Tauri
npm test           # vérification des types + tests (niveaux, exercices, travail profond, séance, fusion)
```

- `src/core/` : la logique sans interface (testée) ; `src/exercices.tsx` et `src/views/` : l'interface.
- Données : `%APPDATA%\fr.rayan.focus\focus.json` (ou `FOCUS_DATA_DIR`), copie de secours et copie par jour.
- iPhone : le magasin synchronisé utilise le fichier `focus` ; fusion PC ↔ iPhone par `fusionnerTexte`
  (`src/core/model.ts`) : résultats, tests, séances et distractions additionnés par id, niveaux, palier et
  réglages au plus récent (`maj`).
