# Rayan's Prière

Horaires de prière calculés sur l'ordinateur, sans connexion, et notification Windows avant chaque prière.
Electron + React + TypeScript, comme Rayan's Chrono.

## Ce qu'elle fait

- **Aujourd'hui** : prochaine prière et compte à rebours, les cinq prières et le lever du soleil, la prière en cours,
  la date hégirienne (calendrier Umm al-Qura, en français et en arabe), la direction de la Qibla. Le vendredi,
  Dhuhr est affiché « Dhuhr (Joumoua) ». La cloche à droite de chaque prière coupe ou remet sa notification.
- **Calendrier** : le mois entier, mois précédent et suivant, aujourd'hui surligné, vendredis en doré.
- **Notifications** : rappel N minutes avant (10 par défaut, 0 pour aucun), notification à l'heure (prière par
  prière), avertissement facultatif avant la fin de Fajr (lever du soleil). Un rappel manqué de plus de 3 minutes
  (PC en veille) n'est pas envoyé en retard. « Suspendre » depuis l'icône de la zone de notification : 1 h, 3 h ou
  jusqu'au lendemain.
- **Zone de notification** : l'infobulle de l'icône donne la prochaine prière et le temps restant.
- **Démarrage avec Windows** (proposé au premier lancement, réglable) : l'application démarre discrètement dans la
  zone de notification.

## Calcul

`src/core/praytimes.ts` : position du soleil, angles de Fajr et d'Isha, ombre pour Asr, comme PrayTimes.org et
Aladhan. Les tests comparent les résultats à Aladhan (Paris été et hiver, Lyon, New York, La Mecque) à la minute
près.

| Méthode | Fajr | Isha |
| --- | --- | --- |
| UOIF (par défaut) | 12° | 12° |
| France 15° | 15° | 15° |
| Ligue islamique mondiale | 18° | 17° |
| ISNA | 15° | 15° |
| Autorité égyptienne | 19,5° | 17,5° |
| Umm al-Qura | 18,5° | 90 min après Maghrib |
| Université de Karachi | 18° | 18° |
| Personnalisée | au choix | au choix |

- **Asr** : standard (ombre × 1) ou hanafite (ombre × 2).
- **Hautes latitudes** : en été en France, le soleil ne descend pas à 18° sous l'horizon. La correction « selon
  l'angle » (par défaut, comme Aladhan) place alors Fajr et Isha à une fraction de la nuit.
- **Ajuster sur sa mosquée** : décalage de −60 à +60 minutes par horaire.
- **Lieu** : une centaine de villes (France, Belgique, Suisse, Maghreb, Afrique de l'Ouest, Moyen-Orient, Canada…)
  ou des coordonnées saisies à la main (fuseau du système). Le fuseau de chaque ville gère l'heure d'été.

## Données

`priere.json` (+ `.bak`) dans le dossier fourni par Rayan's Launcher (`HANGAR_APP_DATA`), sinon
`%APPDATA%\Rayans Priere`. Au démarrage de Windows, l'application est lancée sans le launcher : le dossier lui est
passé par `--donnees=`. L'inscription au démarrage est refaite à chaque lancement, car le dossier de l'application
change à chaque mise à jour. Après une mise à jour, ouvrez l'application une fois pour mettre l'inscription à jour.

## Développement

```bash
npm install
npm start               # construit et lance
npm test                # horaires, rappels, réglages
npm run typecheck
npm run test:lancement  # lance l'application, choisit Paris, vérifie horaires, rappel, calendrier
npm run dist:win        # ZIP Windows dans dist/
npm run icons           # redessine les icônes
```

Le workflow `.github/workflows/priere.yml` vérifie, construit, lance le paquet comme un double-clic et publie le ZIP
dans Rayan's Launcher (id `rayans-priere`).
