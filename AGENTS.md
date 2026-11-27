# Consignes pour les agents de code (Codex et autres)

Les règles de ce dépôt sont dans [`CLAUDE.md`](CLAUDE.md) : lis-le en entier avant de travailler, elles
valent pour tous les agents, pas seulement Claude Code. L'essentiel :

- Réponds en français, simplement, sans jargon.
- Une app par dossier ; la liste et le rôle de chaque app sont dans `README.md`.
- Branche de travail `studio`, publiée en avance rapide sur `main`. Ne commite que les fichiers de ta tâche.
- Dépôt public : rien de personnel dans le code, les commits ou les messages (noms, adresses, jetons, chemins privés).
- N'ouvre pas `node_modules/`, `dist/`, `out/`, `target/` ni les fichiers verrouillés (`package-lock.json`, `Cargo.lock`).
- Tests : `npm test` dans le dossier de l'app concernée, jamais pour tout le dépôt d'un coup.
- Réutilise l'existant avant d'écrire du nouveau code ; pas de nouvelle dépendance sans raison.
- Ne publie rien sur les réseaux sociaux.
