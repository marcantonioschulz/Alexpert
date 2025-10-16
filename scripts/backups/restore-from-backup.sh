#!/bin/sh
set -eu

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <path-to-backup.sql.gz> [psql-options...]" >&2
  exit 1
fi

BACKUP_FILE="$1"
shift

echo "Restoring backup from $BACKUP_FILE" >&2

gzip -dc "$BACKUP_FILE" | psql "$@"
