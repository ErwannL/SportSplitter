#!/usr/bin/env bash
# Récupère un dump de diagnostic de VOTRE espace (données + erreurs + avertissements du calcul),
# le range dans test/dumps/dump_AAAA-MM-JJ_HH-MM-SS.zip, puis le commite et le pousse.
#
# Le dump est lié à votre session : passez le cookie de session du navigateur.
#   SS_SESSION=<valeur du cookie ss_session> ./scripts/dump.sh
#   (navigateur : outils de développement > Application/Stockage > Cookies > ss_session)
# En développement (SPORTSPLITTER_DEV_LOGIN=1 côté serveur), sans cookie :
#   DEV_SUB=1 ./scripts/dump.sh
# Autres options : BACKEND_PORT=9001 ou API_URL=http://localhost:8000
set -euo pipefail
cd "$(dirname "$0")/.."

API="${API_URL:-http://localhost:${BACKEND_PORT:-8001}}"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
DIR="test/dumps"
FILE="$DIR/dump_$STAMP.zip"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT
mkdir -p "$DIR"

if [ -n "${SS_SESSION:-}" ]; then
  printf 'localhost\tFALSE\t/\tFALSE\t0\tss_session\t%s\n' "$SS_SESSION" > "$JAR"
elif [ -n "${DEV_SUB:-}" ]; then
  curl -fsS -c "$JAR" -H "X-Requested-With: sportsplitter" -H "Content-Type: application/json" \
    -d "{\"sub\": \"$DEV_SUB\", \"role\": \"${DEV_ROLE:-admin}\"}" "$API/api/auth/dev-login" \
    || { echo "dev-login refusé : le serveur a-t-il SPORTSPLITTER_DEV_LOGIN=1 ?" >&2; exit 1; }
else
  echo "Session manquante : SS_SESSION=<cookie ss_session> ./scripts/dump.sh (ou DEV_SUB=1 en développement)." >&2
  exit 1
fi

echo "Récupération du dump depuis $API (le calcul peut prendre quelques secondes)…"
if ! curl -fsS -b "$JAR" "$API/api/debug/dump" -o "$FILE"; then
  rm -f "$FILE"
  echo "Échec : application injoignable sur $API, ou session invalide/expirée (401)." >&2
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git add -- "$FILE"
git commit -m "Dump de diagnostic du $STAMP" -- "$FILE"
git push origin "$BRANCH"
echo "Dump poussé sur la branche $BRANCH : $FILE"
