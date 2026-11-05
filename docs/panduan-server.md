# Panduan Komputer Server untuk Gereja

Eklesia dirancang berjalan di komputer pribadi biasa yang menyala terus.
Ikuti daftar ini agar aplikasi tetap hidup tanpa bantuan developer.

## 1. Cegah komputer tidur

- Windows: Settings → System → Power → **Screen and sleep**: atur *When
  plugged in, turn off my screen after* bebas, dan *put my device to sleep*
  ke **Never**.
- Matikan hibernate: jalankan `powercfg /hibernate off` di Command Prompt
  (Run as administrator).
- Bila memakai laptop, tutup layar tidak boleh membuat tidur: Settings →
  Power → *Lid behavior* → **Do nothing** (saat terhubung listrik).

## 2. Docker menyala otomatis

- Docker Desktop: Settings → General → centang **Start Docker Desktop when
  you sign in**.
- Semua layanan Eklesia memakai `restart: unless-stopped`, jadi kontainer
  kembali jalan sendiri setelah Docker start.
- Masuk Windows otomatis (opsional, untuk server tanpa layar): gunakan
  akun khusus server dengan login otomatis yang aman di lingkungan gereja,
  atau jadwalkan `docker compose up -d` lewat Task Scheduler saat boot.

## 3. Setelah mati listrik

- Di BIOS/UEFI, aktifkan **Restore on AC Power Loss = Power On** agar
  komputer menyala sendiri saat listrik kembali.
- UPS kecil (600–1000 VA) sangat disarankan agar database tidak rusak saat
  listrik padam mendadak.
- Setelah menyala, periksa: `docker compose ps` (semua `healthy`/`Up`) dan
  buka `http://127.0.0.1:3000/api/health` → harus `{"status":"ok",...}`.

## 4. Update Windows

- Settings → Windows Update → Advanced options → **Active hours**: atur jam
  aktif 05.00–22.00 agar restart update tidak terjadi saat ibadah.
- Jadwalkan restart update di hari kerja, bukan Sabtu/Minggu.
- Setelah restart besar, pastikan Docker Desktop kembali jalan (langkah 2).

## 5. Firewall dan jaringan

- Jangan membuka port 5432 (PostgreSQL) atau 3000 ke internet di router.
  Akses publik cukup lewat Cloudflare Tunnel (lihat
  `docs/cloudflare-tunnel.md`).
- Windows Firewall bawaan sudah cukup; Eklesia hanya butuh koneksi keluar
  (HTTPS) untuk tunnel dan SMTP.
- Gunakan IP statis lokal/DHCP reservation untuk komputer server agar
  alamat lokalnya tidak berubah.

## 6. Pemantauan (opsional)

```powershell
docker compose --profile monitor up -d uptime-kuma
```

Buka `http://127.0.0.1:3001`, buat akun lokal, lalu tambah monitor HTTP(s)
ke `http://app:3000/api/health` (dari dalam jaringan Docker) atau ke
alamat publik gereja Anda.

## 7. Pemeriksaan berkala (5 menit, sebulan sekali)

1. `docker compose ps` — semua layanan `Up`/`healthy`.
2. Menu Pengaturan → unduh ekspor data Excel, simpan aman.
3. Pastikan cadangan terbaru ada (lihat `docs/backup-restore.md`) dan
   setahun sekali lakukan uji restore.
4. Periksa ruang disk kosong minimal 5 GB.
