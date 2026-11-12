# Rayan's Rangement

Range automatiquement les fichiers des dossiers surveillés (Téléchargements et Bureau par défaut) selon des
règles, **sans jamais rien supprimer ni écraser**, avec un aperçu obligatoire et un historique qui permet de
tout annuler. Tauri 2 + React + TypeScript ; toute la logique de fichiers est en Rust (`core/`).

## Ce que fait l'application

- **Règles** dans l'ordre (la première qui correspond l'emporte) : extensions, modèle de nom (`*`, `?`,
  plusieurs modèles séparés par `;`), âge (« plus vieux que N jours »), taille min./max., dossiers concernés.
  Destination relative (sous-dossier du dossier surveillé, ex. `Images`) ou absolue ; jetons `{annee}`, `{mois}`.
  Règles par défaut : Images, Documents, Vidéos, Musique, Archives, Installateurs (Téléchargements seulement).
- **Doublons** : même taille puis même empreinte SHA-256 ; le plus ancien reste en place, les copies vont en
  **quarantaine** (`Documents\Rayan's Rangement\Quarantaine\<date>`), jamais à la poubelle.
- **Aperçu obligatoire** : l'analyse liste chaque déplacement ; rien ne bouge avant validation, et chaque
  ligne peut être décochée.
- **Historique** : chaque déplacement est inscrit au journal *avant* d'être fait puis confirmé
  (`%LOCALAPPDATA%\Rayan's Rangement\journal.jsonl`). Annulation d'un rangement entier ou d'un seul fichier.
- **Mode automatique** (désactivé par défaut) : à l'arrivée de fichiers ou à intervalle régulier, l'application
  *prépare* un aperçu et envoie une notification. Elle ne déplace jamais rien seule.

## Garde-fous

- Pas d'écrasement : le déplacement passe par `MoveFileExW` **sans** `MOVEFILE_REPLACE_EXISTING` ; si la place
  est prise, le fichier devient `nom (2).ext` (à l'aperçu, et de nouveau au moment d'appliquer).
- Fichiers laissés en place : ouverts par un autre programme, modifiés depuis l'aperçu, modifiés depuis moins
  de 2 minutes, téléchargements en cours (`.crdownload`, `.part`…), fichiers cachés ou système, sous-dossiers.
- Un doublon n'est mis en quarantaine que si l'original existe encore avec le même contenu.
- À l'annulation, si la place d'origine est prise, le fichier est remis à côté sous un autre nom.

## Développement

```bash
npm ci
npm test            # tests du moteur, sur des dossiers temporaires uniquement
npm run dev         # application en mode développement
npx tauri build     # exécutable + installateur NSIS
npm run smoke       # test de lancement de target/release/Rayans Rangement.exe
```

Variables utiles : `RANGEMENT_DATA_DIR` (dossier des réglages et du journal), `RANGEMENT_SMOKE_FILE` (test de
lancement : l'app écrit « ok » une fois l'interface affichée puis se ferme).

La CI (`.github/workflows/rangement.yml`) construit sous Windows, lance les tests et le test de lancement, puis
publie en « Artifact » un ZIP pour Rayan's Launcher contenant `rayans-launcher.json`
(version `1.0.<numéro d'exécution + 100>`).
