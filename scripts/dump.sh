#!/usr/bin/env bash
# Récupère un dump de diagnostic (données + erreurs + avertissements du calcul),
# le range dans test/dumps/dump_AAAA-MM-JJ_HH-MM-SS.zip, puis le commite et le pousse.
# Usage : ./scripts/dump.sh            (l'application doit tourner : docker compose up)
#         BACKEND_PORT=9001 ./scripts/dump.sh
#         API_URL=http://localhost:8000 ./scripts/dump.sh   (backend lancé sans Docker)
set -euo pipefail
cd "$(dirname "$0")/.."

API="${API_URL:-http://localhost:${BACKEND_PORT:-8001}}"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
DIR="test/dumps"
FILE="$DIR/dump_$STAMP.zip"
mkdir -p "$DIR"

echo "Récupération du dump depuis $API (le calcul peut prendre quelques secondes)…"
if ! curl -fsS "$API/api/debug/dump" -o "$FILE"; then
  rm -f "$FILE"
  echo "Impossible de joindre l'API sur $API. Lancez d'abord l'application : docker compose up" >&2
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git add -- "$FILE"
git commit -m "Dump de diagnostic du $STAMP" -- "$FILE"
git push origin "$BRANCH"
echo "Dump poussé sur la branche $BRANCH : $FILE"
