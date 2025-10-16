# Database Backup and Restore

This project includes a cron-driven backup container that regularly exports the PostgreSQL database and stores compressed dumps on a shared volume. Additional helper scripts support syncing those dumps to external object storage and restoring them when needed.

## Backup Service

The `db-backup` service defined in `docker-compose.yml` runs `pg_dump` on the schedule specified by `BACKUP_SCHEDULE` (defaults to `0 2 * * *` for a daily 02:00 UTC backup). The container writes `.sql.gz` files to the shared `postgres_backups` volume.

### Configuration

The service honours the following environment variables (set in your shell or an `.env` file):

- `POSTGRES_HOST` (default `db`)
- `POSTGRES_PORT` (default `5432`)
- `POSTGRES_DB` (default `sales_simulation`)
- `POSTGRES_USER` (default `postgres`)
- `PGPASSWORD` (**required**)
- `BACKUP_SCHEDULE` (cron expression, default `0 2 * * *`)
- `BACKUP_RETENTION_DAYS` (optional number of days to retain backups)

Backups are stored in `/backups` inside the container and exposed locally through the named Docker volume `postgres_backups`.

## Syncing Backups to External Storage

Use the `scripts/backups/sync-to-s3.sh` helper to copy backups to any S3-compatible bucket:

```bash
export AWS_ACCESS_KEY_ID=... # or configure with `aws configure`
export AWS_SECRET_ACCESS_KEY=...
export S3_BUCKET=s3://my-bucket/postgres-backups
./scripts/backups/sync-to-s3.sh
```

Optional variables:

- `BACKUP_DIR` (defaults to `./backups`) – set to the mounted backup directory when running outside Docker, e.g. `BACKUP_DIR=~/postgres_backups`.
- `AWS_PROFILE` – use a named AWS CLI profile instead of environment variables.

The script relies on the AWS CLI being installed locally. For S3-compatible storage (e.g., MinIO, DigitalOcean Spaces), configure the appropriate endpoint using the AWS CLI `--endpoint-url` flag or profile configuration.

## Restoring a Backup

1. Ensure the target database is running and accessible.
2. Copy the desired `.sql.gz` file from the backup volume or external storage to your workstation.
3. Run the restore script, providing a connection string or psql flags:

   ```bash
   ./scripts/backups/restore-from-backup.sh path/to/sales_simulation-20240101T020000Z.sql.gz "postgresql://postgres:postgres@localhost:5432/sales_simulation"
   ```

   Alternatively, pass standard `psql` arguments:

   ```bash
   ./scripts/backups/restore-from-backup.sh path/to/backup.sql.gz -h localhost -U postgres -d sales_simulation
   ```

The script decompresses the archive and streams it directly into `psql`, overwriting the existing data. Consider taking a snapshot of the target database before performing the restore.

## Accessing Local Backup Files

To access the raw backup files created by Docker, mount the `postgres_backups` volume:

```bash
docker run --rm -v web-app-agents-sdk_postgres_backups:/backups -v $(pwd)/backups:/export busybox cp /backups/* /export/
```

Replace `web-app-agents-sdk_postgres_backups` with the actual volume name if different. Once exported, the files can be archived, synced, or inspected with standard tools.
