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
| Studio (tuile **Studio**) | regarder les vidéos déposées par Claude dans `Vidéos\Rayan's Studio\A valider` et répondre « C'est bon » ou ce qu'il faut corriger (avec le moment de la vidéo) ; réponse enregistrée à côté (`<id>.retours.json`) et notifiée sur le PC. Format : `src/core/studio.ts`, dépôt et lecture : `studio/a_valider.py` |

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
