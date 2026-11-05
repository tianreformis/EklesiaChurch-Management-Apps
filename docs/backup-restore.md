# Cadangan dan Pemulihan (Backup & Restore)

Eklesia menyimpan tiga hal penting: database PostgreSQL (volume `db-data`),
lampiran bukti transaksi (volume `attachments-data`), dan cadangan berkala
(volume `backups-data`). Aturan emas: **cadangan yang belum pernah diuji
restore dianggap tidak ada.**

## Mengaktifkan cadangan harian

Layanan `backup` ada di profile Compose `backup`:

```powershell
docker compose --profile backup up -d backup
```

Setiap `BACKUP_INTERVAL_SECONDS` (bawaan 86400 = 24 jam) layanan membuat
`eklesia-YYYYMMDD-HHMMSS.sql.gz` di volume `backups-data`. Berkas lokal yang
lebih tua dari `BACKUP_RETENTION_DAYS` (bawaan 7 hari) dihapus otomatis.

## Mengunggah ke penyimpanan cloud (rclone)

1. Buat konfigurasi rclone di komputer server (mis. Google Drive):
   `rclone config` lalu buat remote bernama misalnya `gdrive`.
2. Isi di `.env`: `BACKUP_RCLONE_REMOTE=gdrive:cadangan-eklesia`
3. Pasang konfigurasi rclone ke layanan backup sebagai volume hanya-baca
   (tambahkan di override lokal `docker-compose.override.yml`):

```yaml
services:
  backup:
    volumes:
      - ${USERPROFILE}/.config/rclone:/config/rclone:ro
    environment:
      XDG_CONFIG_HOME: /config
```

4. `docker compose --profile backup up -d backup`. Kegagalan unggah hanya
   dicatat sebagai peringatan; berkas lokal tetap disimpan.

## Uji restore (wajib pernah dilakukan)

Contoh memulihkan cadangan terbaru ke database sementara untuk diperiksa:

```powershell
# Salin cadangan keluar dari volume
docker compose --profile backup run --rm -e RUN_ONCE=1 backup
docker run --rm -v eklesia_backups-data:/backups alpine ls -lt /backups

# Buat database uji lalu pulihkan
docker compose exec db psql -U eklesia -c "CREATE DATABASE eklesia_restore_uji;"
docker compose exec -T db sh -c "gunzip -c /dev/stdin | psql -U eklesia -d eklesia_restore_uji" < cadangan.sql.gz

# Periksa isi, lalu hapus database uji
docker compose exec db psql -U eklesia -d eklesia_restore_uji -c "SELECT count(*) FROM members;"
docker compose exec db psql -U eklesia -c "DROP DATABASE eklesia_restore_uji;"
```

## Restore sungguhan (database utama rusak)

```powershell
docker compose stop app
docker compose exec db psql -U eklesia -c "DROP DATABASE eklesia; CREATE DATABASE eklesia OWNER eklesia;"
docker compose exec -T db sh -c "gunzip -c /dev/stdin | psql -U eklesia -d eklesia" < cadangan-terbaru.sql.gz
docker compose up -d
```

Setelah itu masuk sebagai admin dan periksa jumlah jemaat serta saldo kas.

## Cadangan manual tambahan

Admin gereja dapat mengunduh **ekspor seluruh data (Excel)** dari menu
Pengaturan → Cadangan data gereja. Simpan berkas itu di tempat aman karena
memuat data pribadi. Ekspor ini pelengkap, bukan pengganti, cadangan database.
