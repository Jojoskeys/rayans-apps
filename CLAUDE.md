# Rayan's Apps — consignes courtes

- Réponds en français, simplement, sans jargon.
- Une app par dossier ; la liste et le rôle de chaque app sont dans `README.md` (ne relis pas tout le dépôt pour t'orienter).
- Branche de travail : `studio`, publiée en avance rapide sur `main`. Une tâche finie et testée : commite et pousse (`studio` puis `main`) sans demander, en ne prenant que ses propres fichiers. Ne publie rien sur les réseaux sociaux sans le feu vert de Rayan.
- Dépôt public : rien de personnel dans le code, les commits ou les messages (noms, adresses, jetons, chemins privés).
- N'ouvre jamais `node_modules/`, `dist/`, `out/`, `target/` ni les fichiers générés ou verrouillés (`package-lock.json`, `Cargo.lock`) sauf demande précise.
- Lis seulement la partie d'un fichier dont tu as besoin ; préfère la recherche (Grep) à la lecture complète.
- Tests : `npm test` dans le dossier de l'app concernée, jamais pour tout le dépôt d'un coup.
- Les tâches lourdes (recherche large, gros journaux) vont dans un sous-agent qui ne renvoie qu'un résumé.
- Sous-agents : modèle léger pour le mécanique (chercher, lire de gros journaux, résumer) ; modèle le plus fort pour juger, la sécurité (Favoris), le code et les versets (Ayati).
- Réutilise l'existant (l'app, la bibliothèque standard, les fonctions natives) avant d'écrire du nouveau code ; pas de nouvelle dépendance sans raison.
- Nouvelle app ou grosse fonction : pose d'abord les questions une à la fois, avec une proposition par défaut, puis résume le plan avant de coder. Pas pour les petites corrections.

# Compact instructions

Garde : le but de la tâche, les fichiers modifiés, les décisions prises, les tests et leur résultat, ce qui reste à faire. Jette : le contenu brut des fichiers lus et les longues sorties de commandes.
