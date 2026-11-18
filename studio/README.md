# Rayan's Studio

Fabrique des vidéos verticales (TikTok, Reels, Shorts) à partir d'un script **validé par Rayan**.
Rien n'est publié automatiquement.

```
python fabrique.py projets/ayati-mere-de-moussa.json
```

La vidéo sort dans `sorties/`. Avec `--sans-rendu`, seuls l'audio et la chronologie sont préparés.

## Comment ça marche

1. `fabrique.py` (Python) prépare tout ce qui est « son » et « temps » :
   - versets vérifiés depuis l'API quran.com : texte arabe, traduction Hamidullah (id 31), récitation
     d'as-Sudais avec le minutage **mot à mot** (l'arabe s'allume en même temps que la récitation) ;
   - voix : ElevenLabs si la clé est dans `.env`, sinon voix Microsoft de brouillon (edge-tts), avec le temps
     de chaque mot pour les sous-titres ;
   - bruitages fabriqués par ffmpeg (impact, flash, souffle, battement de cœur, secousse, pop), placés sur
     les mots marqués dans `accents` ;
   - écrit `animation/public/<slug>/audio.wav` et `timeline.json`.
2. `animation/` (Remotion, React) dessine et anime chaque image à partir de la chronologie : décors SVG
   animés, schémas, sous-titres mot par mot, gros titres, icônes qui surgissent, caméra (impact, zoom,
   secousse), flashs, grain, barre de progression, appel à l'action.

Remotion est gratuit pour un usage personnel ou une entreprise de 3 personnes maximum.

## Écrire un script (`projets/<slug>.json`)

Chaque segment est une `narration` (texte lu par la voix) ou un `verset` (`ref` comme `28:7`).

- `scene` : le décor (Ayati : `palais_nuit`, `village_nuit`, `lampe`, `calligraphie`, `coffre_nuit`,
  `matin_vide`, `berge`, `palais_aube`, `palais_interieur`, `retour` ; psycho : `asch_*` ; les deux : `cta`).
- `ref` : référence affichée en haut (Ayati).
- `accents` : `{"mot": "effet"}`, avec comme effets `impact`, `flash`, `whoosh`, `battement`, `secousse`,
  `zoom`, `pop`, ou `pop:Icone` (une icône de lucide.dev qui surgit, par exemple `pop:Heart`).
- `titre` : `{"mot": "...", "texte": "..."}`, un gros titre qui claque sur ce mot.

## Règles Ayati

- Texte arabe, traduction et récitation viennent de quran.com, jamais réécrits.
- On embellit le récit, pas les faits : chaque fait porte sa référence.
- Aucun prophète ni personnage dessiné : des lieux, des objets et de la lumière.
- Pas de musique : voix, récitation, ambiance et bruitages.

## Voix ElevenLabs

Dans `.env` (jamais commité) : `ELEVENLABS_API_KEY`, et la voix dans le projet (`voix_elevenlabs`, Paul K par
défaut) ou dans `ELEVENLABS_VOICE_ID`.

- Modèle `eleven_multilingual_v2` : le plus stable avec les voix professionnelles. Le modèle v3 (directions
  entre crochets, champ `voix` des segments) rendait la voix instable d'une phrase à l'autre.
- Chaque phrase est générée avec la phrase d'avant et d'après (`previous_text` / `next_text`) et une graine
  fixe : même voix et même intonation sur toute la vidéo.
- Les vrais trous entre deux mots (> 0,65 s) sont ramenés à `blanc_max` (0,45 s), avec de courts fondus, et
  les sous-titres sont recalés.
- Réglages facultatifs dans `.env` : `ELEVENLABS_STABILITY`, `ELEVENLABS_STYLE`, `ELEVENLABS_VITESSE` (1.1).

## Comptes

| | YouTube | TikTok | Instagram |
|---|---|---|---|
| Ayati (Coran) | @ayati142 | @ayati142 | @ayati.142 |
| La Psycho Facile | @LaPsychoFacile | @lapsychofacile | @lapsychofacile |

Photos de profil : `marque/` (rendues par `npx remotion still src/index.ts AvatarAyati|AvatarPsycho`).

## Dépendances

Python 3.12 (`pip install numpy requests edge-tts`), ffmpeg, Node 24 (`cd animation && npm install`).
Polices libres (OFL) dans `polices/` : Amiri Quran, Amiri et Montserrat. Icônes : lucide-react (ISC).
