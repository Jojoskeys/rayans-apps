# Rayan's Langues

Application Windows (Tauri + React + TypeScript), prévue aussi pour Rayan's Mobile, pour débuter en **chinois
mandarin** (HSK 1-2 environ : ~300 mots, ~80 phrases, caractères simplifiés, pinyin avec tons en couleur) et en
**arabe** standard (28 lettres et leurs formes, harakat, transcription simple, mots et phrases de la vie courante).
Textes écrits pour l'app ; aucun texte religieux reproduit (seulement des formules de politesse courantes).

## Ce qu'elle contient

- **Séance du jour** (5, 10, 15 ou 20 min, 10 par défaut), par langue : révisions dues → nouveaux mots (découverte
  puis test immédiat) → phrase dans l'ordre ou dictée (en alternance) → tons à l'oreille (chinois) ou lettres (arabe).
- **Révisions espacées** (J+1, J+3, J+7, J+14, J+30, J+60, J+120 ; une erreur fait revenir à J+1), rappel dans les
  deux sens (mot → sens, puis sens → mot à partir du niveau 2).
- **Aides à la mémoire** : radical du caractère, racine trilitère et famille de mots, mot-clé en français.
- **Arabe** : voyelles courtes visibles au début, retirées quand un mot est bien su (réglable), clavier arabe à l'écran,
  réponses acceptées en arabe ou en transcription.
- **Écoute** avec les voix du système (`speechSynthesis`) ; plusieurs voix et hauteurs pour les tons à partir du
  niveau 3. Sans voix installée, la dictée devient une lecture et l'exercice des tons est passé.
- **Difficulté adaptative** par exercice et par langue (2 manches réussies à 80 % → +1, 1 échec → −1).
- **Mots** (découverts, prochaine révision, recherche), **Progrès** (courbes, série de jours, tests de départ et de
  suivi hebdomadaires comparés), **Fiches** ✅/⚠️/❌, **quiz** vrai/faux, **Sources**, **Réglages** (sauvegarde).

## Développer

```
npm install
npm run dev:ui     # interface seule dans le navigateur (données dans localStorage), port 1440
npm run dev        # application Tauri
npm test           # vérification des types + tests (contenu, pinyin, arabe, espacement, séance, fusion)
```

- `src/core/` : la logique sans interface (testée), imports internes avec l'extension `.ts`.
- Données : `%APPDATA%\fr.rayan.langues\langues.json` (ou `LANGUES_DATA_DIR`), copie de secours et copie par jour ;
  sur l'iPhone, `window.rayansStore` (fichier `langues`) ; sinon localStorage `rayans-langues-db`.
- Fusion PC ↔ iPhone : `fusionnerTexte` (`src/core/model.ts`) — résultats et tests : union par identifiant ; cartes,
  niveaux et réglages : le plus récent gagne (champ `maj`) ; étapes de séance : réunies.

## Sources principales

Cepeda et al. 2006 (espacement) ; Roediger & Karpicke 2006 et Nakata 2015/2017 (effet de test) ; Atkinson & Raugh
1975 (mot-clé) ; Wang, Spence, Jongman & Sereno 1999 et Sadakata & McQueen 2014 (tons) ; Swain 1985 (production) ;
Johnson & Newport 1989 et Vanhove 2013 (âge) ; Pashler et al. 2008 (styles d'apprentissage) ; Schreiner, Göldi & Rasch
2015 (sommeil). Liste complète dans l'onglet Sources.
