# AGENTS.md — Aturan Kerja untuk AI Agent

Proyek: **Eklesia** (nama kerja, bisa diganti lewat satu konstanta `APP_NAME`).
Sistem manajemen gereja berbasis web, multi-tenant, untuk gereja Kristen di Indonesia.
Dijalankan dengan **Docker** di komputer pribadi yang berfungsi sebagai server.

## Wajib dibaca sebelum mengerjakan apa pun

1. `DESCRIPTION.md` — apa yang dibangun, modul, aturan bisnis, model data, arsitektur.
2. `PROGRESS.md` — status pekerjaan. **Perbarui file ini setiap selesai satu tugas.**
3. File ini — aturan teknis dan batasan.

## Cara kerja

- Kerjakan **satu fase per sesi** sesuai urutan di `PROGRESS.md`. Jangan melompat ke fase berikutnya sebelum fase saat ini lulus checklist.
- Sebelum menulis kode, ringkas rencana singkat (file yang disentuh, tabel yang berubah).
- Setelah selesai: jalankan `pnpm typecheck`, `pnpm lint`, `pnpm test`, lalu `pnpm build`. Perbaiki sampai hijau. Untuk fase yang menyentuh Docker, jalankan juga `docker compose build` dan uji `docker compose up`.
- Catat di `PROGRESS.md`: apa yang selesai, keputusan penting, masalah yang tertunda.
- Jangan menambah fitur di luar `DESCRIPTION.md` tahap 1 tanpa diminta. Fitur tahap 2 dan 3 hanya boleh disiapkan hook-nya, tidak diimplementasikan.
- Jika ada ambiguitas, pilih opsi paling sederhana dan catat asumsinya di `PROGRESS.md`, jangan berhenti untuk bertanya kecuali menyangkut keamanan atau data keuangan.

## Stack (tetap, jangan diganti)

**Monorepo pnpm workspace** dengan tiga paket:

| Paket             | Isi          | Teknologi                                                                                                    |
| ----------------- | ------------ | ------------------------------------------------------------------------------------------------------------ |
| `apps/web`        | Frontend SPA | Vite, React, TypeScript strict, Tailwind CSS, shadcn/ui, React Router, TanStack Query, React Hook Form + Zod |
| `apps/api`        | Backend      | Hono (Node.js via `@hono/node-server`), Drizzle ORM, PostgreSQL, Zod (`@hono/zod-validator`)                 |
| `packages/shared` | Kode bersama | Skema Zod, tipe, matriks izin (`permissions.ts`), `formatRupiah`, format tanggal Indonesia                   |

Library utama lain:

- **Hono RPC** (`hono/client`, tipe `AppType` diekspor dari `apps/api`) agar frontend memanggil API dengan tipe aman. Jangan menulis tipe request/response ganda secara manual.
- Auth: **sesi di database** (tabel `sessions`), cookie `httpOnly`, `secure`, `sameSite=lax`. Token sesi acak 32 byte, yang disimpan di DB adalah hash SHA-256-nya. Hash password dengan argon2 (`@node-rs/argon2`). Jangan memakai JWT di localStorage.
- CSRF: middleware `hono/csrf` pada semua rute yang mengubah data.
- Rate limit login dan reset password (middleware Hono, penyimpanan di memori atau DB).
- Excel: `exceljs` (impor dan ekspor). PDF: `@react-pdf/renderer` dibuat **di server** (rute Hono mengembalikan PDF).
- Email: `nodemailer` (SMTP) dibungkus interface `Mailer`.
- WhatsApp: **tanpa API berbayar di MVP**. Buat interface `Notifier` dengan implementasi `WaLinkNotifier` (membuat tautan `https://wa.me/<nomor>?text=...` yang diklik pengurus) dan `EmailNotifier`. WhatsApp API resmi bisa ditambah nanti tanpa mengubah pemanggil.
- Logging: `pino` dengan **redaksi** field sensitif (telepon, email, nominal, password, token).
- Test: Vitest (unit dan integrasi API memakai Postgres uji). Test E2E (Playwright) hanya untuk alur kritis di Fase 5.
- Package manager: pnpm. Node LTS.

## Arsitektur dan deployment

- **Satu origin.** Di produksi, Hono menyajikan file statis hasil build SPA (`apps/web/dist`) dan API di prefix `/api`. Tidak ada CORS, cookie sesi aman. SPA fallback: rute non-`/api` yang tidak cocok file statis mengembalikan `index.html`.
- **Development.** Vite dev server memakai proxy `/api` → Hono. PostgreSQL berjalan via `docker compose up db`. Perintah `pnpm dev` menjalankan web dan api bersamaan.
- **Docker.**
  - `Dockerfile` multi-stage: stage build (pnpm install, build `shared`, `web`, `api`), stage runtime (node alpine/slim, user non-root, hanya artefak build dan dependensi produksi).
  - `docker-compose.yml` berisi layanan: `db` (postgres 16, volume bernama, **tanpa publish port ke host**, healthcheck), `app` (bergantung pada db sehat, healthcheck `/api/health`), `migrate` (one-shot menjalankan migrasi sebelum `app` start), `backup` (dump harian terjadwal + unggah ke penyimpanan cloud lewat rclone, retensi dikonfigurasi), dan `cloudflared` (Cloudflare Tunnel, aktif lewat profile `tunnel`).
  - `app` hanya terekspos ke localhost atau ke jaringan Docker; akses publik melalui Cloudflare Tunnel.
  - `.dockerignore` lengkap (node_modules, .git, .env, dist). `.gitattributes` memaksa `eol=lf` untuk `*.sh` dan `Dockerfile` karena host kemungkinan Windows.
  - Semua konfigurasi lewat environment variable; sediakan `.env.example`; validasi env dengan Zod saat start dan gagal cepat bila salah.
  - Zona waktu kontainer `Asia/Jakarta`, tetapi data waktu disimpan UTC.
- Struktur folder:
  ```
  eklesia/
    apps/
      web/
        src/
          routes/          # halaman per modul
          features/        # members, schedule, finance, auth, settings
          components/      # UI bersama (shadcn)
          lib/             # api client (hc), query client, utils
      api/
        src/
          routes/          # rute Hono per modul (members, schedule, finance, auth, platform)
          modules/         # service.ts per modul (logika bisnis)
          db/              # schema Drizzle, migrasi, seed, getTenantDb
          lib/             # mailer, notifier, logger, env, pdf, excel
          middleware/      # auth, tenant, permission, rate-limit, csrf
          app.ts           # definisi app + export type AppType
          index.ts         # server entry
    packages/
      shared/              # zod schemas, permissions, utils
    docker/                # skrip backup, konfigurasi tambahan
    Dockerfile
    docker-compose.yml
    .env.example
    AGENTS.md DESCRIPTION.md PROGRESS.md
  ```
- Logika bisnis di `apps/api/src/modules/*/service.ts`. Rute Hono tipis: validasi → cek izin → panggil service → kembalikan hasil. Komponen React tidak boleh berisi aturan bisnis penting.

## Aturan multi-tenant (KRITIS)

- Setiap tabel milik gereja **wajib** punya kolom `church_id` (NOT NULL, indexed, foreign key).
- Middleware `tenant` membaca sesi dan menyediakan `c.var.db = getTenantDb(session)` yang **selalu** menyaring `church_id`. Rute dilarang memakai koneksi DB mentah untuk tabel milik gereja.
- `church_id` **tidak pernah** diambil dari input klien (body, query, header, URL). Selalu dari sesi server.
- Tulis test yang membuktikan pengguna gereja A tidak bisa membaca, mengubah, atau menghapus data gereja B, termasuk lewat ID tebakan, untuk **setiap** rute API yang menyentuh data gereja.
- Aktifkan Postgres Row Level Security sebagai lapisan kedua (set `app.church_id` per transaksi), terutama untuk tabel keuangan dan anggota.

## Aturan keuangan (KRITIS)

- Nominal disimpan sebagai **integer rupiah** (bukan float). Format tampilan lewat `formatRupiah` di `packages/shared`.
- Transaksi keuangan **tidak pernah dihapus keras**. Koreksi dilakukan dengan status `void` + alasan, atau transaksi pembalik. Semua perubahan masuk `audit_logs` (siapa, kapan, sebelum/sesudah).
- Hanya peran `bendahara` dan `admin_gereja` yang boleh membuat atau mengubah transaksi. `majelis` hanya baca.
- Laporan harus bisa direkonsiliasi: saldo awal + pemasukan − pengeluaran = saldo akhir, dan test harus membuktikannya.
- Perhitungan laporan dilakukan **di server**, bukan di klien.

## Aturan keamanan dan privasi

- Data jemaat adalah data pribadi (UU PDP). Jangan log nomor telepon, email, atau nominal perpuluhan.
- Cek otorisasi **di server** untuk setiap rute lewat middleware `permission` yang memakai `permissions.ts` bersama. Menyembunyikan tombol di UI bukan keamanan.
- Header keamanan (`hono/secure-headers`): CSP ketat, `X-Content-Type-Options`, `Referrer-Policy`, HSTS.
- Tidak ada secret di repo atau di image Docker. Secret hanya lewat env/Docker secrets. Jangan `COPY .env` ke image.
- Unggahan Excel: maks 5 MB dan 5.000 baris, validasi tiap baris dengan Zod, laporan error per baris, jangan gagal total karena satu baris rusak. Lampiran bukti transaksi: hanya gambar/PDF, maks 2 MB, cek tipe konten sebenarnya, simpan di volume Docker (bukan di dalam image) dengan nama acak, sajikan lewat rute yang mengecek izin dan tenant.
- Sediakan fitur ekspor seluruh data gereja (backup) untuk admin gereja.
- Kontainer berjalan sebagai user non-root, filesystem sebisa mungkin read-only kecuali volume data.

## Aturan UI/UX

- Bahasa antarmuka: **Bahasa Indonesia** (formal tapi hangat). Kode, nama variabel, dan komentar: bahasa Inggris.
- Pengguna utama sering berusia lanjut: ukuran teks dasar minimal 16px, kontras tinggi, tombol besar, alur pendek, hindari menu bersarang dalam.
- Mobile-first dan responsif (pelayan membuka jadwal dari HP). Gunakan code splitting per rute (`React.lazy`) agar muat awal ringan.
- Setiap halaman punya state loading, kosong, dan error yang jelas. Form punya pesan error dalam bahasa Indonesia.
- Zona waktu default `Asia/Jakarta`, format tanggal Indonesia (mis. "Minggu, 3 November 2026").

## Gaya kode

- TypeScript strict di semua paket, tanpa `any` kecuali dengan komentar alasan.
- Skema Zod ditulis sekali di `packages/shared` dan dipakai oleh form (web) dan validator (api).
- Satu tanggung jawab per file; hindari file di atas ±300 baris.
- Commit kecil dengan pesan jelas (mis. `feat(finance): add monthly report export`).

## Definisi "selesai" untuk setiap fase

- Fitur berfungsi end-to-end di browser (dan di Docker bila fase menyentuh deployment).
- Test relevan lulus, termasuk test otorisasi dan isolasi tenant.
- `typecheck`, `lint`, `build` hijau.
- `PROGRESS.md` sudah diperbarui.

## Yang TIDAK boleh dilakukan

- Mengganti stack tanpa persetujuan.
- Menghapus atau memodifikasi migrasi yang sudah dijalankan (buat migrasi baru).
- Menyimpan password atau token dalam teks biasa, atau menyimpan token sesi di localStorage.
- Mempublikasikan port PostgreSQL ke host atau internet.
- Mengimplementasikan pembayaran online, aplikasi mobile native, atau fitur tahap 2/3 di fase MVP.
- Menggunakan data jemaat asli untuk seed atau test; pakai data fiktif.
