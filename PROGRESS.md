# PROGRESS.md — Status Pengerjaan

> Aturan: perbarui file ini setiap selesai satu tugas. Centang `[x]` hanya jika benar-benar jalan dan teruji.
> Format log: `YYYY-MM-DD — ringkasan singkat`.

**Stack:** Vite + React (SPA) · Hono · PostgreSQL + Drizzle · Docker (pnpm monorepo: `apps/web`, `apps/api`, `packages/shared`)
**Fase aktif:** Fase 0 selesai — menunggu instruksi untuk Fase 1
**Terakhir diperbarui:** 2026-11-01

---

## Fase 0 — Fondasi dan Docker

- [x] Monorepo pnpm: `apps/web` (Vite + React + TS + Tailwind + shadcn/ui), `apps/api` (Hono + TS), `packages/shared`
- [x] ESLint, Prettier, Vitest, skrip root `typecheck`, `lint`, `test`, `build`, `dev`
- [x] Hono: `app.ts` mengekspor `AppType`, rute `/api/health`, penanganan error terpusat, logger pino dengan redaksi
- [x] Web: React Router, TanStack Query, klien API bertipe (`hono/client`), layout dasar responsif, tema (teks ≥16px, kontras tinggi)
- [x] Vite proxy `/api` → Hono untuk development
- [x] Produksi: Hono menyajikan build SPA + fallback `index.html`
- [x] PostgreSQL + Drizzle: konfigurasi, migrasi pertama, skrip `db:migrate`, `db:seed`
- [x] `.env.example`, validasi env dengan Zod (gagal cepat bila salah)
- [x] `Dockerfile` multi-stage (user non-root) + `.dockerignore` + `.gitattributes` (eol=lf)
- [x] `docker-compose.yml`: `db` (tanpa publish port, healthcheck, volume), `migrate` (one-shot), `app` (healthcheck)
- [x] Helper di `packages/shared`: `formatRupiah`, format tanggal Indonesia
- [x] Konstanta `APP_NAME`
- [x] README singkat: cara dev (`docker compose up db` + `pnpm dev`) dan cara produksi (`docker compose up -d --build`)

**Lulus jika:** `docker compose up -d --build` menjalankan aplikasi dan `/api/health` hijau; `pnpm dev` berjalan; `pnpm build` hijau; migrasi berjalan dari nol.

**Bukti pemenuhan (2026-11-01):**

- `docker compose down -v` lalu `docker compose up -d` → `migrate` exit 0, `app` healthy, `/api/health` → `{"status":"ok","database":"ok"}`.
- `pnpm dev` → API `:3000` + Vite `:5173`, `/api/health` lewat proxy Vite → 200.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (31 test), `pnpm build` hijau.
- Kontainer berjalan sebagai `uid=1000(node)`; filesystem `read_only: true` (uji `touch /app/...` ditolak).
- Rute SPA dalam (`/jemaat`) dilayani `index.html` dari Hono; `/api/*` yang tidak ada tetap 404 JSON.
- UI diperiksa di browser: desktop + mobile 390px, tanpa error konsol.

## Fase 1 — Auth, tenant, dan hak akses

- [ ] Skema: `churches`, `users`, `sessions`, `audit_logs`
- [ ] Auth: login/logout, sesi DB (token acak, hash tersimpan), cookie httpOnly/secure/lax, argon2
- [ ] Middleware: `auth`, `tenant` (`getTenantDb`), `permission` (dari `permissions.ts`), `csrf`, rate limit
- [ ] Postgres RLS sebagai lapisan kedua untuk tabel milik gereja
- [ ] `permissions.ts` di `packages/shared` (matriks peran → izin), dipakai server dan UI
- [ ] Halaman masuk, lupa/atur ulang password, undangan pengguna via email
- [ ] Halaman `/platform` untuk `super_admin`: buat gereja + admin pertama
- [ ] Halaman `/pengaturan`: profil gereja, kelola pengguna dan peran
- [ ] Header keamanan (CSP, dll.)
- [ ] Test: isolasi tenant untuk tiap rute (A tidak bisa akses B, termasuk lewat ID), test izin per peran, test sesi dan CSRF

**Lulus jika:** semua test isolasi, izin, dan sesi hijau.

## Fase 2 — Data jemaat

- [ ] Skema: `members`, `families`, `regions`, `groups`, `group_members`
- [ ] API + UI CRUD anggota, daftar dengan pencarian dan filter, paginasi
- [ ] CRUD keluarga, wilayah, komisi/tim; atur anggota di komisi
- [ ] Impor Excel: template, unggah, pratinjau, validasi per baris, deteksi duplikat, laporan error
- [ ] Ekspor Excel
- [ ] Halaman detail anggota
- [ ] Test: validasi impor (baris rusak, duplikat, batas ukuran), izin per peran, isolasi tenant

**Lulus jika:** impor 500 baris contoh berhasil dengan laporan error yang benar.

## Fase 3 — Jadwal pelayanan

- [ ] Skema: `service_roles`, `services`, `service_assignments`, `swap_requests`, `reminder_templates`
- [ ] Pengaturan peran pelayanan per gereja
- [ ] CRUD ibadah, ibadah berulang (pola mingguan), ibadah khusus
- [ ] Penugasan pelayan per peran, peringatan bentrok
- [ ] "Jadwal saya": konfirmasi/tolak, ajukan tukar, persetujuan koordinator
- [ ] Notifier: `WaLinkNotifier` (tautan wa.me + template) dan `EmailNotifier`
- [ ] Tampilan kalender bulanan dan daftar, cetak jadwal bulanan PDF (dibuat di server)
- [ ] Test: bentrok penugasan, alur tukar jadwal, izin koordinator hanya untuk timnya

**Lulus jika:** satu bulan jadwal bisa disusun, dikirim pengingat, dan dikonfirmasi pelayan.

## Fase 4 — Keuangan

- [ ] Skema: `cash_accounts`, `finance_categories`, `transactions`, `period_locks`
- [ ] Pengaturan akun kas dan kategori (dengan kategori default)
- [ ] Form transaksi, daftar dengan filter, lampiran bukti (volume Docker, rute ber-otorisasi)
- [ ] Form cepat persembahan Minggu (dihitung oleh / diverifikasi oleh)
- [ ] Void transaksi dengan alasan (tanpa hapus keras)
- [ ] Penutupan periode bulanan
- [ ] Laporan bulanan dan tahunan per akun dan kategori (dihitung di server)
- [ ] Ekspor laporan PDF (kop gereja) dan Excel
- [ ] Halaman audit log (admin dan majelis)
- [ ] Test: rekonsiliasi saldo, void tidak dihitung, periode terkunci menolak ubah, hanya bendahara/admin yang bisa tulis, majelis hanya baca, jemaat/pelayan ditolak

**Lulus jika:** laporan bulanan PDF akurat terhadap data seed dan semua test keuangan hijau.

## Fase 5 — Dashboard, hardening, dan deploy produksi di komputer pribadi

- [ ] Dashboard per peran
- [ ] Fitur backup: ekspor seluruh data gereja (zip/Excel) untuk admin gereja
- [ ] Layanan `backup` di Compose: `pg_dump` harian, unggah ke cloud via rclone, retensi, skrip dan dokumentasi **restore** yang sudah diuji
- [ ] Layanan `cloudflared` (profile `tunnel`) + panduan setup Cloudflare Tunnel dan domain
- [ ] Restart policy `unless-stopped`, log rotation Docker, batas memori/CPU kontainer
- [ ] Panduan komputer server: matikan sleep/hibernate, auto-start Docker saat boot, auto-restart setelah mati listrik, jam aktif update Windows (bila Windows), firewall
- [ ] Uptime Kuma (opsional) untuk pemantauan
- [ ] Audit UI untuk pengguna lanjut usia dan mobile; audit ukuran bundle (code splitting per rute)
- [ ] Test E2E (Playwright) alur kritis: login → impor jemaat → buat jadwal → catat persembahan → cetak laporan
- [ ] Halaman kebijakan privasi dan syarat penggunaan (draf)
- [ ] Review keamanan (checklist `AGENTS.md`), pastikan tidak ada data pribadi di log, port DB tidak terekspos
- [ ] Seed data demo lengkap
- [ ] Panduan singkat untuk admin gereja (halaman bantuan/PDF)

**Lulus jika:** gereja pilot bisa memakai seluruh alur MVP lewat domain publik, backup dan restore terbukti berjalan, tanpa bantuan developer.

---

## Keputusan dan asumsi

- Satu origin di produksi (Hono menyajikan SPA + `/api`) untuk menghindari CORS dan menyederhanakan cookie sesi.
- **TypeScript 6.0.3, bukan 7.x.** TypeScript 7 (compiler native) belum didukung `typescript-eslint` 8; tooling lint gagal total. Naikkan versi saat dukungan tersedia.
- **pnpm 12**: pengaturan build dependensi memakai `allowBuilds` di `pnpm-workspace.yaml` (field `pnpm.onlyBuiltDependencies` sudah tidak dibaca). Lockfile di-commit.
- **Port PostgreSQL dev.** Di mesin pengembangan, port 5432 sering sudah dipakai PostgreSQL lain, dan aturan proyek melarang mempublikasikan DB. Solusi: `docker-compose.dev.yml` mengikat `${POSTGRES_PORT:-5432}` ke `127.0.0.1` (default contoh `.env.example`: **55432**); `docker-compose.yml` produksi tidak memetakan port DB sama sekali.
- **Migrasi pertama** membuat tabel akar multi-tenant `churches` dan `super_admins` (dua-duanya bukan tabel milik gereja). `users`, `sessions`, `audit_logs` dikerjakan di Fase 1 agar tidak tumpang tindih. Seed Fase 0 hanya membuat 2 gereja fiktif; anggota menyusul di Fase 2.
- `db:migrate`/`db:seed` memakai skrip Node sendiri (`drizzle-orm/postgres-js/migrator`), bukan `drizzle-kit push`, agar migrasi deterministik dan bisa dijalankan sebagai layanan one-shot di Compose.
- **Health check** memakai dependensi yang disuntikkan (`checkDatabase`) sehingga app bisa diuji tanpa PostgreSQL; detail error koneksi tidak pernah dikirim ke klien/log (bisa memuat kredensial).
- **Redaksi log** (pino) mencakup `cookie`, `authorization`, password/hash, token, phone, email, amount/nominal, DATABASE_URL. Query string tidak dicatat; log hanya method/path/status/durasi.
- **SPA statis** hanya dipasang bila `WEB_DIST_PATH` menunjuk folder berisi `index.html`; di dev Vite yang melayani. Rute `/api/*` tidak pernah jatuh ke `index.html`.
- **Kontainer app** berjalan `read_only: true` + `tmpfs /tmp`, user `node` (uid 1000), tanpa kode sumber, tanpa `.env`.
- **Tailwind CSS v4** lewat `@tailwindcss/vite` (tanpa `tailwind.config`), komponen UI ditulis dengan pola shadcn/ui (`components.json` disertakan untuk CLI ke depan). React 19, Vite 8, React Router 7.
- Layanan `backup` dan `cloudflared` sengaja **belum** ada di Compose karena termasuk checklist Fase 5; Fondasi hanya menyiapkan `db`, `migrate`, `app`.
- `.prettierignore` mengecualikan `AGENTS.md`, `DESCRIPTION.md`, `PROMPT.md`, `PROGRESS.md` agar dokumen panduan tidak diformat ulang otomatis.
- `pnpm dev` lebih dulu membangun `packages/shared` sekali, lalu menjalankan watch shared + API + web paralel.

## Masalah tertunda

- **TypeScript 7** belum bisa dipakai karena `typescript-eslint` belum mendukung; pantau rilis.
- **RLS PostgreSQL** dan **header keamanan (CSP/HSTS)** belum aktif — dijadwalkan Fase 1.
- **Backup/restore & Cloudflare Tunnel** belum ada — Fase 5.
- Bundle utama SPA ±322 KB (gzip ±102 KB) karena React + Router + TanStack Query. Code splitting per rute sudah aktif; audit ukuran bundle dijadwalkan Fase 5.
- Komponen UI baru: `button`, `card`. Komponen form (input, label, select) menyusul saat dibutuhkan modul.
- CI (GitHub Actions) belum dibuat; saat ini verifikasi dilakukan lokal.

## Log pekerjaan

_(Terbaru di atas.)_

- 2026-11-01 — **Fase 0 selesai.** Monorepo pnpm (web/api/shared), TypeScript strict, ESLint flat + Prettier, Vitest (15 test shared, 16 test API). API Hono dengan `/api/health` ber-injeksi, error handler terpusat, logger pino ber-redaksi, penyajian SPA + fallback dengan penjagaan `/api`. Web React Router + TanStack Query + Hono RPC bertipe, layout responsif (16px, kontras tinggi), status sistem di dasbor. Drizzle + PostgreSQL 16: migrasi `churches`/`super_admins`, `db:migrate`, `db:seed` (2 gereja fiktif). Docker multi-stage non-root, read-only, `db`/`migrate`/`app` dengan healthcheck; uji dari volume kosong berhasil. README + `.env.example` + `.gitattributes` (eol=lf) + `.prettierignore`.
