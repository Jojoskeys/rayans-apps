# Rayan's Mémoire

Application Windows (Tauri + React + TypeScript), aussi dans Rayan's Mobile (tuile « Mémoire »), pour entraîner sa
mémoire avec les méthodes qui ont des preuves.

## Ce qu'elle contient

- **Séance du jour** (5, 15 ou 30 min) : échauffement (un jeu), révisions espacées des listes, technique du jour,
  pause calme d'une minute, rappel sans aide, bilan.
- **Programme de 6 semaines** (inspiré de Dresler et al. 2017, *Neuron*) : palais, histoires, mots abstraits,
  noms et visages, système Major 00-99, vocabulaire par mot-clé, mini-championnat. Test de 20 mots au jour 1, à la
  fin, puis 1 mois et 4 mois après.
- **Palais de mémoire** : construction guidée avec ses vrais lieux, promenade de vérification, listes personnelles
  (cours, ordre des sourates, plans d'exposé…) révisées à J+1, J+3, J+7, J+14, J+30, J+60, J+120 ; export CSV vers
  Rayan's Révision.
- **10 jeux** à difficulté en escalier (2 réussites → plus dur, 1 échec → plus facile) : suite de chiffres, à
  l'envers, cases lumineuses (Corsi), n-back, séquence de couleurs, paires, objet disparu, liste de mots, noms et
  visages (visages dessinés, aucune photo), grand nombre.
- **Comprendre** : fiches courtes avec sources, quiz « vrai ou faux » sur les mythes (10 % du cerveau, styles
  d'apprentissage, mémoire photographique, brain training).

## Développer

```
npm install
npm run dev:ui     # interface seule dans le navigateur (données dans localStorage)
npm run dev        # application Tauri
npm test           # vérification des types + tests (niveaux, espacement, programme, jeux, fusion)
```

- `src/core/` : la logique sans interface (testée) ; `src/jeux.tsx`, `src/rangement.tsx`, `src/techniques.tsx`,
  `src/views/` : l'interface.
- Données : `%APPDATA%\fr.rayan.memoire\memoire.json` (ou `MEMOIRE_DATA_DIR`), copie de secours et copie par jour.
- iPhone : `mobile/src/apps/memoire.tsx` réutilise cette interface avec le magasin synchronisé (fichier `memoire`),
  fusion PC ↔ iPhone par `fusionnerTexte` (`src/core/model.ts`), branchée dans `mobile/src/shared/merge.ts`.
