# Rayan's Apps — consignes courtes

- Réponds en français, simplement, sans jargon.
- Une app par dossier ; la liste et le rôle de chaque app sont dans `README.md` (ne relis pas tout le dépôt pour t'orienter).
- Branche de travail : `studio`, publiée en avance rapide sur `main`. Une tâche finie et testée : commite et pousse (`studio` puis `main`) sans demander, en ne prenant que ses propres fichiers. Ne publie rien sur les réseaux sociaux sans le feu vert de Rayan.
- Dépôt public : rien de personnel dans le code, les commits ou les messages (noms, adresses, jetons, chemins privés).
- N'ouvre jamais `node_modules/`, `dist/`, `out/`, `target/` ni les fichiers générés ou verrouillés (`package-lock.json`, `Cargo.lock`) sauf demande précise.
- Lis seulement la partie d'un fichier dont tu as besoin ; préfère la recherche (Grep) à la lecture complète.
- Tests : `npm test` dans le dossier de l'app concernée, jamais pour tout le dépôt d'un coup.
- Les tâches lourdes (recherche large, gros journaux) vont dans un sous-agent qui ne renvoie qu'un résumé.
- Modèles : la session tourne sur Sonnet par défaut. Délègue au bon sous-agent : `eclaireur` (Haiku) pour chercher, lire, résumer ; `codeur` (Sonnet) pour une modif de code claire ; `expert` (Opus) pour la sécurité (Favoris), les versets du Coran, l'architecture d'une nouvelle app, un bug qui résiste ; `maitre` (Fable, le plus cher) seulement si `expert` a échoué deux fois ou si Rayan le demande. Si toute la tâche est grosse (nouvelle app, gros chantier), dis-le en une ligne à Rayan pour qu'il passe la session sur Opus.
- Réutilise l'existant (l'app, la bibliothèque standard, les fonctions natives) avant d'écrire du nouveau code ; pas de nouvelle dépendance sans raison.
- Nouvelle app ou grosse fonction : pose d'abord les questions une à la fois, avec une proposition par défaut, puis résume le plan avant de coder. Pas pour les petites corrections.

# Compact instructions

Garde : le but de la tâche, les fichiers modifiés, les décisions prises, les tests et leur résultat, ce qui reste à faire. Jette : le contenu brut des fichiers lus et les longues sorties de commandes.
