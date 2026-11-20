---
name: prompt
description: Réécrire un prompt brouillon de Rayan pour l'outil visé (Claude Code, Claude, un générateur d'images ou de vidéos…) en suivant les bonnes pratiques officielles d'Anthropic, puis expliquer les changements en 3 lignes. À utiliser quand Rayan tape /prompt suivi d'un brouillon, ou demande d'améliorer, de reformuler ou d'écrire un prompt.
---

# Prompt

Entrée : `/prompt <brouillon>` (et l'outil visé s'il le dit ; sinon, le deviner et le dire, ou poser **une**
question si on ne peut pas).

## Étapes

1. **Comprendre le but** : ce que Rayan veut obtenir, pour quel outil, et ce qui manque (contexte, format de
   sortie, contraintes, exemple).
2. **Réécrire** en s'appuyant sur les bonnes pratiques officielles d'Anthropic (guide « prompt engineering » de
   la documentation Claude ; en cas de doute, le relire plutôt que de citer de mémoire) :
   - être clair et direct : dire la tâche, le pourquoi et le résultat attendu ;
   - donner le contexte utile (public, but, ce qui existe déjà) ;
   - demander un format de sortie précis ; donner un exemple quand le format compte ;
   - découper une grosse tâche en étapes numérotées ;
   - séparer les données des consignes (balises comme `<document>…</document>`) ;
   - dire ce qu'il faut faire plutôt que ce qu'il ne faut pas faire ;
   - pour Claude Code : nommer les fichiers et dossiers, dire comment vérifier (tests, commande) et quoi ne pas
     toucher.
   Adapter au type d'outil : un générateur d'images veut une description visuelle (sujet, style, cadrage,
   lumière), pas des étapes.
3. **Répondre** avec :
   - le prompt réécrit, dans un bloc à copier ;
   - **3 lignes** maximum qui expliquent ce qui a changé et pourquoi.

## Règles

- Garder l'intention de Rayan : ne pas ajouter de tâches qu'il n'a pas demandées.
- Rien de personnel (noms, adresses, jetons) dans un prompt destiné à un service extérieur.
- Ne pas exécuter le prompt : seulement le réécrire.
