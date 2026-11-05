#!/bin/sh
# Cadangan database Eklesia: pg_dump berkala ke volume, unggah opsional ke
# penyimpanan cloud lewat rclone, dan retensi lokal. Semua lewat env.
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:-}"

mkdir -p "$BACKUP_DIR"

run_backup() {
  timestamp="$(date +%Y%m%d-%H%M%S)"
  file="$BACKUP_DIR/eklesia-$timestamp.sql.gz"
  echo "[backup] Membuat $file"
  pg_dump -h "${PGHOST:-db}" -p "${PGPORT:-5432}" -U "${PGUSER:?PGUSER wajib diisi}" \
    -d "${PGDATABASE:?PGDATABASE wajib diisi}" | gzip > "$file.tmp"
  mv "$file.tmp" "$file"
  echo "[backup] Selesai: $file"

  if [ -n "$RCLONE_REMOTE" ]; then
    echo "[backup] Mengunggah ke $RCLONE_REMOTE"
    rclone copy "$BACKUP_DIR" "$RCLONE_REMOTE" --include "eklesia-*.sql.gz" || \
      echo "[backup] PERINGATAN: unggah rclone gagal, berkas lokal tetap disimpan."
  fi

  # Retensi: hapus cadangan lokal yang lebih tua dari batas.
  find "$BACKUP_DIR" -name "eklesia-*.sql.gz" -type f -mtime "+$RETENTION_DAYS" -delete || true
}

if [ "${RUN_ONCE:-0}" = "1" ]; then
  run_backup
  exit 0
fi

echo "[backup] Berjalan tiap ${INTERVAL_SECONDS}s, retensi ${RETENTION_DAYS} hari."
while true; do
  run_backup || echo "[backup] PERINGATAN: cadangan gagal, mencoba lagi pada siklus berikut."
  sleep "$INTERVAL_SECONDS"
done
