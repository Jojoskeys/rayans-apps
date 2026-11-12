# Analyse Échecs (développement)

Guide utilisateur : [LISEZMOI.md](LISEZMOI.md). Règles de calcul : [REGLES-ANALYSE.md](REGLES-ANALYSE.md).

## Architecture

- **Electron 44** (embarque Node.js et Chromium). Le processus principal (`src/main/main.js`) démarre un petit
  serveur HTTP Node (`src/server/server.js`) lié à `127.0.0.1` sur un port aléatoire, protégé par un jeton secret,
  la vérification des en-têtes `Host`/`Origin` et l'absence de CORS, puis ouvre la fenêtre sur ce serveur.
  Fermer la fenêtre arrête le serveur et le moteur.
- **Stockfish 19** natif (`vendor/stockfish/`, téléchargé et vérifié par SHA-256 par `scripts/fetch-stockfish.js`),
  piloté en UCI par `src/server/engine.js` ; analyse en arrière-plan dans `src/server/analyzer.js`.
- Import Chess.com : `src/server/importer.js` ; validation des parties : `src/core/games.js`.
- Calculs purs et testés : `src/core/` (scoring, classify, motifs, openings, prompt, report).
- Interface : `src/ui/` (chessground + chess.js), regroupée par esbuild dans `dist-ui/`.
- Données utilisateur : dossier `donnees` dans le dossier de l'application du système (`userData` d'Electron).

## Commandes

```bash
npm ci
```

```bash
npm run fetch:stockfish
```

```bash
npm test
```

```bash
npm start
```

```bash
xvfb-run -a npm run test:e2e
```

```bash
npm run dist:mac
```

`npm run dist:win` et `npm run dist:linux` construisent les autres paquets. Les paquets officiels sont construits et
testés sur chaque système par `.github/workflows/echecs-analyse.yml` (à la racine du dépôt).
