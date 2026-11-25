#!/usr/bin/env bash
# Nightly N-Health backup: database dump + uploaded files. Keeps 14 days.
set -euo pipefail
DEST=/var/backups/nhealth
mkdir -p "$DEST" && chmod 700 "$DEST"
STAMP=$(date +%Y%m%d-%H%M)
sudo -u postgres pg_dump -Fc nhealth > "$DEST/db-$STAMP.dump"
tar -czf "$DEST/uploads-$STAMP.tar.gz" -C /opt/nhealth/apps/backend uploads 2>/dev/null || true
find "$DEST" -type f -mtime +14 -delete
