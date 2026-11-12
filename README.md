# Rayan's Apps

Applications créées avec l'IA (Claude Code). Une application par dossier, un workflow GitHub Actions par
application dans `.github/workflows/`.

| Application | Dossier | Workflow | Ce qu'elle fait |
| --- | --- | --- | --- |
| Rayan's Échecs (Analyse Échecs) | [`echecs-analyse/`](echecs-analyse/) | `echecs-analyse.yml` | Analyse des parties Chess.com avec Stockfish intégré (macOS, Windows, Linux) |
| Rayan's Launcher | [`launcher/`](launcher/) | `launcher.yml` | Launcher Windows (Tauri) pour installer, mettre à jour et lancer les applications |

Les paquets construits se téléchargent dans l'onglet **Actions**, section **Artifacts** de chaque exécution.

## Ajouter une nouvelle application

1. Créer un dossier `<nom-de-l-app>/` à la racine.
2. Ajouter `.github/workflows/<nom-de-l-app>.yml` avec un filtre `on.push.paths: ['<nom-de-l-app>/**']`, pour
   que seule cette application soit reconstruite quand elle change.

Ces applications viennent de la branche `claude/determined-tesla-akfm85` de
`Jojoskeys/motion-design-claude-code` (historique conservé). Les numéros de version construits par la CI
partent de +100 pour rester supérieurs à ceux construits là-bas.
