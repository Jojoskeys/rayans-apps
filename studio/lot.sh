#!/usr/bin/env bash
# Fabrique, contrôle et prépare l'envoi d'une série de vidéos, une par une.
#   bash lot.sh <dossier_envoi> <slug> [<slug> …]
# Pour chaque slug : fabrique.py → controle.py (planche + volume) → copie dans <dossier_envoi> (servi par Funnel).
cd "$(dirname "$0")"
ENVOI="$1"; shift
for s in "$@"; do
  echo "=== $s $(date +%H:%M)"
  PYTHONIOENCODING=utf-8 python fabrique.py "projets/$s.json" 2>&1 | grep "Vidéo prête\|introuvable\|rror"
  PYTHONIOENCODING=utf-8 python controle.py "$s"
  cp "sorties/$s.mp4" "$ENVOI/"
done
echo "=== fini $(date +%H:%M)"
