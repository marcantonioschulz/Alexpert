#!/bin/sh
set -eu

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required. Install it from https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html" >&2
  exit 1
fi

: "${BACKUP_DIR:=./backups}"
: "${S3_BUCKET:?S3_BUCKET must be set (e.g. s3://my-bucket/backups)}"
: "${AWS_PROFILE:=}"

SYNC_ARGS="--delete"

if [ -n "$AWS_PROFILE" ]; then
  aws --profile "$AWS_PROFILE" s3 sync "$BACKUP_DIR" "$S3_BUCKET" $SYNC_ARGS
else
  aws s3 sync "$BACKUP_DIR" "$S3_BUCKET" $SYNC_ARGS
fi
