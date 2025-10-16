#!/bin/sh
set -eu

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILENAME="${POSTGRES_DB:-database}-${TIMESTAMP}.sql.gz"
TARGET_DIR="${BACKUP_DIR:-/backups}"
TMP_FILE="${TARGET_DIR}/${FILENAME}"

mkdir -p "$TARGET_DIR"

pg_dump \
  --host "${POSTGRES_HOST:-db}" \
  --port "${POSTGRES_PORT:-5432}" \
  --username "${POSTGRES_USER:-postgres}" \
  --format=plain \
  --dbname "${POSTGRES_DB:-postgres}" \
  | gzip > "$TMP_FILE"

# prune old backups if retention specified
if [ -n "${BACKUP_RETENTION_DAYS:-}" ]; then
  find "$TARGET_DIR" -type f -name "${POSTGRES_DB:-database}-*.sql.gz" -mtime "+${BACKUP_RETENTION_DAYS}" -print -delete
fi

echo "[run-backup] Created backup ${TMP_FILE}" >&2
