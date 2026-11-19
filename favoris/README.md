# Rayan's Favoris

Tes vidéos enregistrées sur Instagram et TikTok, triées par Claude : transcription, catégorie, **double
vérification de sécurité**, avis, et le prompt prêt pour mettre l'astuce en place. Rien n'est appliqué tant
que tu n'as pas cliqué sur **Valider**.

Outil local (Python), comme Rayan's Studio. Les données restent sur le PC, dans `Documents\Rayan's Favoris`.

## L'ouvrir

Menu Démarrer → **Rayans Favoris** (icône étoile rose). L'appli s'ouvre dans sa propre fenêtre, sur l'onglet
**Pratique** (ce qui est faisable et sans danger), et s'arrête quand on la ferme.
Pour créer ou recréer le raccourci : `python installer.py` (`--retirer` pour l'enlever).

## Le circuit

1. **Les vidéos arrivent** par l'export officiel, un lien collé, une vidéo déposée, ou la tuile **Favoris**
   de Rayan's Mobile sur l'iPhone.
2. **Téléchargement et transcription** : `python favoris.py recuperer` (ou le bouton sur la page). La parole
   est transcrite par Whisper sur le PC ; la légende et 4 images de la vidéo sont gardées pour ce qui est
   écrit à l'écran.
3. **Analyse par Claude** : dans Claude Code, tape `/favoris`. Pour chaque vidéo : catégorie (Pour Claude,
   Astuce, Recette, Sport, Religion, À regarder, Drôle), deux vérifications de sécurité, pour/contre, avis,
   faisable ou non, prompt et liste de ce qui sera fait. Chaque vidéo est vraiment analysée : la fiche dit
   toujours ce qu'elle peut t'apporter. Seules les blagues sans rien d'utile sont ignorées ; les recettes vont
   dans `recettes.md`.
   **Inspiration Studio** : pour les vidéos de religion ou de psychologie, Claude note ce qui les fait marcher
   (accroche, structure, rythme…) d'après leurs chiffres (vues, j'aime, partages). Si elles ont bien marché,
   une idée de vidéo pour compte-a ou Compte B part dans la boîte à idées du Studio, et l'explication dans
   `Vidéos\Rayan's Studio\inspirations.md`.
4. **Tu décides** sur la page de tri : `python favoris.py page`, puis http://127.0.0.1:8765. Valider,
   Refuser, avec une note si tu veux. Une vidéo jugée dangereuse ne peut pas être validée.
5. **Claude applique** au prochain `/favoris`, seulement ce qui est validé, après une dernière vérification
   de sécurité juste avant d'agir.

## Récupérer tous tes favoris (export officiel)

Ton mot de passe ne passe jamais par Claude, et ton compte ne risque pas d'être bloqué.

**Instagram** : Paramètres → Espace Comptes → Vos informations et autorisations → Télécharger vos
informations → Télécharger ou transférer des informations → ton compte → Certaines de vos informations →
coche **Enregistrés** → Télécharger sur l'appareil → format **JSON**, période « Depuis le début ».

**TikTok** : Profil → ☰ → Paramètres et confidentialité → Compte → Télécharger tes données → coche
**Activité** (ou tout) → format **JSON** → Demander. Le fichier est prêt après quelques heures, dans
l'onglet « Télécharger des données ».

Puis, avec le .zip reçu :
```
python favoris.py importer "C:\chemin\vers\export-instagram.zip"
python favoris.py importer "C:\chemin\vers\export-tiktok.zip"
```
Pour Instagram, le nom de tes collections est gardé. Pour TikTok, seuls tes **Favoris** sont pris (ni les
j'aime, ni l'historique). Relancer un import n'ajoute que les nouveaux.

## Envoyer une vidéo plus tard

- **Sur le PC** : colle le lien sur la page, ou glisse la vidéo dessus, ou
  `python favoris.py ajouter "<lien>" --note "pour toi"`, ou pose la vidéo dans `Documents\Rayan's Favoris\a-deposer`.
- **Sur l'iPhone** : tuile **Favoris** de Rayan's Mobile (il faut que Rayan's Télécommande tourne sur le PC).
  Partager → Copier le lien dans TikTok ou Instagram, puis colle-le. On peut aussi envoyer une vidéo de la pellicule.

## Instagram demande une connexion

Instagram refuse parfois de donner une vidéo sans être connecté. Dans ce cas la vidéo passe dans l'onglet
**Erreurs**. Deux solutions :
- télécharger la vidéo toi-même et la glisser sur la page ;
- ou exporter tes cookies Instagram dans un fichier `cookies.txt` (extension « Get cookies.txt LOCALLY »,
  à faire toi-même), et écrire dans `favoris/.env` : `FAVORIS_COOKIES=C:\chemin\cookies.txt`. Ce fichier
  donne accès à ton compte : garde-le hors du dépôt et supprime-le après.

## Réglages (`favoris/.env`, facultatif)

```
FAVORIS_MODELE=small      # medium : transcription plus juste, plus lente
FAVORIS_COOKIES=          # voir ci-dessus
FAVORIS_DOSSIER=          # autre dossier que Documents\Rayan's Favoris
```

## Il faut

Python 3.12, `pip install yt-dlp faster-whisper`, et ffmpeg (déjà là pour Rayan's Studio).

## Tests

```
python -m unittest discover -s tests
```
