# Rayan's Aujourd'hui

Le tableau du jour : les cours de la fac (emploi du temps ADE de l'Université de Rennes), ce qu'il reste à réviser dans Rayan's Révision, Rayan's Hifz et Rayan's Ouvertures, un bouton
pour ouvrir chaque application, et une notification le soir s'il reste quelque chose. Electron + React + TypeScript.

## Ce qu'elle fait

- **Trois nombres**, relus chaque minute et quand la fenêtre revient au premier plan :
  - **Révision** : cartes en apprentissage, révisions dues avant la fin de la journée de révision (4 h du matin),
    nouvelles cartes dans la limite quotidienne de chaque paquet, comme la séance de Révision les compte.
  - **Hifz** : portions dont la révision est due, ou qui contiennent un verset marqué « à revoir ».
  - **Ouvertures** : positions déjà travaillées dont l'échéance est passée. Les positions jamais vues ne sont pas
    comptées (il faudrait refaire l'analyse des parties).
- **Ouvrir** : lance l'application comme Rayan's Launcher le fait.
- **Rappel du soir** : à 19 h par défaut (réglable), une notification « Révision : 5 · Hifz : 2 » s'il reste
  quelque chose, une fois par jour. Si l'ordinateur est allumé plus tard (jusqu'à 3 h après), le rappel part à ce
  moment-là.
- **Zone de notification** : l'infobulle donne le détail ; le menu ouvre chaque application.
- **Démarrer avec Windows** (réglages) : nécessaire pour que le rappel arrive sans ouvrir l'application.

## Ma journée (routine)

- Ce qu'on veut faire chaque jour, ou certains jours (L M M J V S D) : une case à cocher dans la vue du jour.
- Avec une heure : **rappel Windows** à cette heure tant que ce n'est pas coché, une fois par jour (encore envoyé
  jusqu'à 2 h après si l'ordinateur était éteint). Sans heure : juste la case.
- Série : nombre de jours d'affilée où tout ce qui était prévu a été fait.
- « Gérer » : ajouter, renommer, changer l'heure ou les jours, supprimer. Données : `routine.json`.

## Fac : Université de Rennes

- **Emploi du temps ADE** : dans ADE (depuis l'ENT), cocher ses groupes, Partager → **Agenda**, date de fin = fin du
  semestre, copier l'URL iCalendar et la coller dans Réglages → Fac. Aucun mot de passe.
  - Téléchargé à l'ouverture de la fenêtre (au plus une fois toutes les 15 minutes) et avec le bouton ↻ ; rien
    ne tourne quand la fenêtre est fermée.
  - Un cours est reconnu par son identifiant ADE (`UID`) : une mise à jour remplace l'ancienne version, sans doublon.
    La ligne « Exporté le » d'ADE est ignorée.
  - Les changements depuis le téléchargement précédent (salle, horaire, cours ajouté ou retiré) sont signalés.
  - **Mes groupes** : le lien d'ADE couvre toute la branche cochée (ex. tout le parcours, tous les groupes
    d'anglais). On coche ses groupes tels qu'ADE les écrit dans la description des cours (« L3 INFO-G4 »,
    « Anglais Gr F »…) et le tronc commun ; seuls leurs cours sont gardés. Les pauses méridiennes sont masquées.
- **Mails** : la messagerie Partage n'offre aux étudiants qu'IMAP avec le mot de passe Sésame (pas d'accès en lecture
  seule ni d'OAuth), donc l'application ne se connecte pas à la boîte. On **partage un mail à la main** : texte collé
  depuis le webmail ou fichier `.eml` déposé. L'analyse (salle, annulation, report, examen, devoir) se fait sur le PC
  avec des règles simples (`src/core/mail.ts`).
  - Chaque information devient une **proposition à valider** : rien ne change avant « Appliquer ».
  - Une correction validée s'affiche avec la valeur d'ADE (« Salle corrigée d'après un mail · ADE : B12 »). Elle
    disparaît quand ADE donne la même valeur ; si ADE passe à une troisième valeur, le conflit est signalé.
  - Examens et devoirs validés vont dans « Échéances ».
  - Un expéditeur absent de la liste (Réglages → Fac) est signalé.
- **Données gardées** (`fac.json`, sur le PC) : l'URL ADE (jamais affichée en entier), les cours à venir, les
  changements, et pour chaque mail l'expéditeur, l'objet, la date et un extrait d'une phrase ou deux, 30 jours.
  Le webmail ne permet pas de lien direct vers un message : « Ouvrir le webmail » copie l'objet pour la recherche.
- **iPhone** : ajouter la même URL ADE dans Calendrier (abonnement) ; les corrections et échéances restent sur le PC.

## Données lues

Les fichiers des autres applications sont seulement lus, jamais modifiés :

| Application | Fichier |
| --- | --- |
| Révision | `%APPDATA%\fr.rayan.revision\revision.json` (ou `REVISION_DATA_DIR`) |
| Hifz | `%APPDATA%\Rayans Hifz\hifz-donnees.json` (ou `HIFZ_DATA_DIR`) |
| Ouvertures | `%APPDATA%\Rayans Ouvertures\donnees\joueurs\*\exercices.json` (ou `RAYANS_OUVERTURES_DATA`) |

Les règles de calcul reprennent celles de chaque application (voir `src/core/counts.ts`). Si l'une change sa
façon de compter, il faut mettre ce fichier à jour.

Réglages : `aujourdhui.json` (et `fac.json` pour la fac) dans le dossier fourni par Rayan's Launcher (`HANGAR_APP_DATA`), sinon
`%APPDATA%\Rayans Aujourdhui`.

## Développement

```bash
npm install
npm start               # construit et lance
npm test                # comptes de Révision, Hifz, Ouvertures ; rappel du soir ; ADE et mails
npm run typecheck
npm run test:lancement  # fausses données, nombres affichés, rappel envoyé une fois, changement de salle par mail, routine, réglages
npm run dist:win        # ZIP Windows dans dist/
npm run icons           # redessine les icônes
```

Le workflow `.github/workflows/aujourdhui.yml` vérifie, construit, lance le paquet comme un double-clic et publie le
ZIP dans Rayan's Launcher (id `rayans-aujourdhui`).
