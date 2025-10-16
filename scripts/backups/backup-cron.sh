#!/bin/sh
set -eu

: "${BACKUP_SCHEDULE:=0 2 * * *}"
: "${POSTGRES_HOST:=db}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:=sales_simulation}"
: "${POSTGRES_USER:=postgres}"
: "${PGPASSWORD:?PGPASSWORD is required for the backup service}"
: "${BACKUP_DIR:=/backups}"

RUNNER=/usr/local/bin/run-backup.sh

cat <<CRON >/etc/crontabs/root
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

${BACKUP_SCHEDULE} ${RUNNER}
CRON

chmod 600 /etc/crontabs/root

echo "[backup-cron] Backups will run on schedule: ${BACKUP_SCHEDULE}" >&2
/usr/sbin/crond -f -l 8
