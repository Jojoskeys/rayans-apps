# Rayan's Lecture

Application Windows (Tauri + React + TypeScript), prévue aussi pour Rayan's Mobile, pour **lire plus efficacement
sans perdre la compréhension** : la vitesse est toujours mesurée avec la compréhension, jamais seule.
24 textes d'entraînement (3 niveaux) et 5 textes réservés aux tests, tous écrits pour l'app.

## Ce qu'elle contient

- **Séance du jour** (5, 10, 15 ou 20 min, 10 par défaut) : « avant de lire » (question à garder en tête, ce que je
  sais déjà), lecture chronométrée par pages (sans défilement), questions sans le texte (littérales et à déduire),
  résumé de mémoire, et selon le jour le plan du texte ou un survol en 60 s.
- **Résultat** : mots par minute, compréhension, « mots compris par minute », alerte sous 70 % de compréhension,
  repère de 238 mots/min (Brysbaert 2019) présenté comme un ordre de grandeur.
- **Résumé de mémoire** : idées clés pré-cochées d'après des mots-clés (à confirmer soi-même).
- **Repérer le plan**, **Survol en 60 s**, **Lire et prendre des notes** (questions avec ses seules notes),
  **Essai mot à mot** (RSVP, 300 à 1000 mots/min) présenté comme une expérience, pas un entraînement.
- **Difficulté adaptative** par exercice (niveau des textes : 2 réussites → +1, 1 échec → −1 ; une lecture est
  réussie avec 80 % de compréhension sans descendre sous sa vitesse habituelle).
- Pas de relecture d'un texte avant 30 jours ; **tests** de départ puis de suivi hebdomadaires sur des textes réservés.
- **Progrès** (vitesse et compréhension sur la même courbe, niveaux, tests), **Fiches** ✅/⚠️/❌, **quiz** vrai/faux,
  **Sources**, **Réglages** (sauvegarde).

## Développer

```
npm install
npm run dev:ui     # interface seule dans le navigateur (données dans localStorage), port 1438
npm run dev        # application Tauri
npm test           # vérification des types + tests (textes, lecture, niveaux, séance, fusion)
```

- `src/core/` : la logique sans interface (testée), imports internes avec l'extension `.ts`.
- Données : `%APPDATA%\fr.rayan.lecture\lecture.json` (ou `LECTURE_DATA_DIR`), copie de secours et copie par jour ;
  sur l'iPhone, `window.rayansStore` (fichier `lecture`) ; sinon localStorage `rayans-lecture-db`.
- Fusion PC ↔ iPhone : `fusionnerTexte` (`src/core/model.ts`) — résultats, résumés et séances : union ; notes,
  niveaux et réglages : le plus récent gagne (champ `maj`).

## Sources principales

Rayner et al. 2016 (lecture rapide) ; Schotter, Tran & Rayner 2014 (retours en arrière) ; Brysbaert 2019 (vitesse
moyenne) ; Dunlosky et al. 2013 et McDaniel et al. 2009 (se tester, résumer) ; Chi et al. 1994 et Bisra et al. 2018
(s'expliquer) ; Mueller & Oppenheimer 2014, Urry et al. 2021, Morehead et al. 2019 (notes) ; Delgado et al. 2018
(papier ou écran) ; Recht & Leslie 1988 (connaissances préalables). Liste complète dans l'onglet Sources.
