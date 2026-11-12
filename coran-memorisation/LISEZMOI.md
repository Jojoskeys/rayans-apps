# Rayan's Hifz

Application Windows (Electron + React + TypeScript) pour suivre la mémorisation du Coran. Tout est enregistré
sur le PC (`%APPDATA%\Rayans Hifz\hifz-donnees.json`, avec une copie de secours `.bak`).

## Ce qu'elle fait

- **Sourates** : les 114 sourates avec leur progression ; dans une sourate, chaque verset a un statut
  (non commencé, en cours, mémorisé, à revoir). Clic sur le numéro pour sélectionner, Maj + clic pour une plage.
- **Révision espacée** : chaque sourate est découpée aux quarts de hizb en « portions ». Dès qu'une portion
  contient un verset mémorisé, elle entre dans le planning (variante de SM-2 : Oublié / Difficile / Bien / Facile,
  intervalle plafonné à 120 jours). Les portions avec un verset « à revoir » passent en premier.
- **Mode révision** : les versets sont masqués et se dévoilent mot par mot (Espace) ou verset par verset
  (Entrée), avec indice du premier mot, traduction en indice (T) et écoute du verset (L).
- **Texte arabe** (Tanzil, écriture uthmani) avec la police Amiri Quran, de droite à gauche ; **traduction
  française** de Muhammad Hamidullah, affichable ou non.
- **Audio** verset par verset de Mahmoud Khalil Al-Husary (murattal), lu depuis everyayah.com puis gardé sur le PC
  pour l'écoute hors ligne ; bouton pour télécharger une sourate entière ; répétition de chaque verset.
- **Progression** : carte des 30 juz / 60 hizb, série de jours actifs, calendrier d'activité.
- Export / import de la progression en JSON.

## Développement

```bash
npm ci
npm test              # tests unitaires (node --test, TypeScript sans compilation)
npm run typecheck
npm start             # construit l'interface et lance Electron
node scripts/test-lancement.js   # test de lancement (ajouter le chemin de l'.exe pour tester un paquet)
npm run dist:win      # paquet ZIP Windows dans dist/
```

Pour développer sans toucher à ses vraies données : `HIFZ_DATA_DIR=.donnees-dev npm start`.
`CAPTURES_DIR=captures node scripts/test-lancement.js` enregistre aussi des captures d'écran de chaque vue avec
une progression fictive.

Licences des contenus (texte, traduction, police, audio) : voir [`LICENCES`](LICENCES).
