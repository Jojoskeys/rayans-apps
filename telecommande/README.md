# Rayan's Télécommande

Piloter le PC depuis l'iPhone, où qu'on soit, et échanger des fichiers dans les deux sens.

- **Sur le PC** : cette application (installée par Rayan's Launcher), qui vit dans la zone de notification et
  démarre avec la session Windows.
- **Sur l'iPhone** : la tuile **Télécommande** de Rayan's Mobile (`mobile/src/apps/telecommande.tsx`).

## Comment ça passe

```text
iPhone (Rayan's Mobile, Tailscale activé)
   │  HTTPS, réseau Tailscale seulement (chiffré de bout en bout)
   ▼
tailscale serve  ──►  http://127.0.0.1:47321  (serveur de Rayan's Télécommande, jamais exposé ailleurs)
```

Chaque requête doit porter :

1. l'en-tête `Tailscale-User-Login` ajouté par Tailscale, égal au compte propriétaire du PC ;
2. le **code d'association** (20 caractères, ≈ 99 bits) affiché dans l'application du PC, comparé à temps
   constant. Après 8 codes faux en 10 minutes, tout est refusé pendant 15 minutes.

**Code montre** : un second code, affiché sous le premier, pour Rayan's Montre (`garmin/montre`). Il ne permet
qu'une seule chose : `POST /api/montre` (toute autre adresse est refusée, 403). « Nouveau code montre » le
change sans toucher au code de l'iPhone.

« Nouveau code » révoque immédiatement tous les téléphones. Un téléphone perdu se retire aussi dans la console
Tailscale (il perd alors tout accès au PC, Bureau à distance compris).

## Ce que fait la télécommande

| Depuis l'iPhone | Détail |
| --- | --- |
| État du PC | allumé depuis, processeur, mémoire, disque C:, Wi-Fi |
| Verrouiller, redémarrer (annulable 20 s) | toujours disponibles |
| Mettre en veille, éteindre | **désactivés par défaut** : le PC est en Wi-Fi et ne peut pas être rallumé ou réveillé à distance |
| Lancer une application | raccourcis du menu Démarrer |
| Fermer une fenêtre | proprement (comme la croix) ou de force ; les processus de Windows sont protégés |
| Scénarios | ouvrir des programmes, dossiers, sites et fermer des programmes en un toucher (composés sur le PC) |
| Fichiers | envoyer au PC (`Téléchargements\Depuis le téléphone`), parcourir Bureau, Documents, Téléchargements, Images, Vidéos, Musique et récupérer un fichier, récupérer ce que le PC a déposé, faire télécharger un lien par le PC |
| Presse-papiers | texte, dans les deux sens |
| Wi-Fi | changer pour un réseau déjà enregistré, avec **retour automatique** si Internet et Tailscale ne reviennent pas en 60 s |
| Journal | actions de la télécommande et connexions Bureau à distance (journal de Windows) |
| Studio (tuile **Studio**) | 3 onglets. **Vidéos** : regarder les vidéos déposées par Claude dans `Vidéos\Rayan's Studio\A valider`, répondre « C'est bon » ou ce qu'il faut corriger (avec le moment), les télécharger pour les partager. **Scripts** : lire le texte d'une future vidéo (dossier `Scripts`) et le valider avant fabrication. **Idées** : noter un sujet pour Ayati ou La Psycho Facile (`idees.json`). Réponses enregistrées à côté (`<id>.retours.json`) et notifiées sur le PC. Format : `src/core/studio.ts`, côté Studio : `studio/a_valider.py` |
| Montre (tuile **Montre**, montre Garmin) | `POST /api/montre` (code montre ou code principal) : saisies de la montre `{ saisies: [{ id, type: "eau" \| "seance" \| "humeur", at (secondes), valeur? (1 à 5) }], resume?: { at, pas, distance (m), calories, coeur } }`, rangées dans `montre.json` à côté de `telecommande.json` (écriture relue, copie `.bak`, fichier temporaire ; une saisie déjà reçue, même `id`, n'est pas recomptée ; 90 jours gardés). Envoi vide = test de connexion, rien n'est écrit. `GET /api/montre` : aujourd'hui et les 7 derniers jours (eau, séances, humeurs, pas, distance, calories, cœur). Logique : `src/core/montre.ts`. Lu aussi par le bilan du soir de Rayan's Aujourd'hui |
| Recettes (tuile **Recettes**) | `GET /api/recettes` : recettes de `Documents\Rayan's Favoris` et données de Rayan's Recettes (`recettes.json` : dossier du launcher `data\rayans-recettes`, sinon `%APPDATA%\Rayans Recettes`), avec le plan du jour, ce qu'il faut préparer et les courses du jour / de la semaine par magasin. `POST /api/recettes/{faite, annulerFaite, favori, achete, viderAchetes}` : écriture relue juste avant, copie `.bak`, fichier temporaire puis renommage. Logique réutilisée de `recettes/src/core` (`src/core/recettes.ts`) |

Depuis le PC vers l'iPhone : déposer des fichiers ou un texte (ils attendent dans Fichiers → Depuis le PC),
faire sonner l'iPhone par iCloud Localiser.

## Limites (imposées par Windows, iOS ou le matériel)

- **Allumer** le PC à distance : impossible (Wi-Fi). Il reste allumé, écran éteint.
- Après un **redémarrage**, la télécommande répond quand la session Windows est ouverte (par exemple avec
  Windows App) : elle tourne dans la session de Rayan, sans mot de passe enregistré.
- Pas de notification sur l'iPhone quand le PC fait quelque chose : iOS ne laisse pas une web app écouter en
  arrière-plan. Les notifications s'affichent sur le PC.
- L'écran et la souris du PC passent par **Windows App** (Bureau à distance), pas par cette application.
- L'écran de l'iPhone ne peut pas être affiché ni contrôlé depuis Windows (refusé par iOS).
- **Montre Garmin** : ses requêtes partent de Garmin Connect sur l'iPhone. Elles n'arrivent que si Tailscale est
  activé sur l'iPhone (sinon l'adresse du PC est inconnue) ; `tailscale serve` ajoute alors l'en-tête
  `Tailscale-User-Login` comme pour Safari, puisque c'est le même iPhone. Pas encore vérifié sur la vraie montre :
  « Tester la connexion » sur la montre le dit tout de suite (voir `garmin/README.md`).

## Mise en route

1. Console Tailscale → **DNS** → **Enable HTTPS** (une fois).
2. Rayan's Télécommande sur le PC → **Activer l'accès depuis l'iPhone** (lance `tailscale serve --bg --https=443 http://127.0.0.1:47321`).
3. iPhone : Rayan's Mobile → **Télécommande** → adresse et code affichés sur le PC.

## Développement

```bash
npm ci
npm test           # code, chemins, Wi-Fi, données
npm run typecheck
npm start          # construit et lance l'application
npm run test:lancement
```
