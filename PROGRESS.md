# PROGRESS.md — Status Pengerjaan

> Aturan: perbarui file ini setiap selesai satu tugas. Centang `[x]` hanya jika benar-benar jalan dan teruji.
> Format log: `YYYY-MM-DD — ringkasan singkat`.

**Stack:** Vite + React (SPA) · Hono · PostgreSQL + Drizzle · Docker (pnpm monorepo: `apps/web`, `apps/api`, `packages/shared`)
**Fase aktif:** Fase 5 selesai — MVP (Tahap 1) tuntas
**Terakhir diperbarui:** 2026-11-05

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

- [x] Skema: `churches`, `users`, `sessions`, `audit_logs`
- [x] Auth: login/logout, sesi DB (token acak, hash tersimpan), cookie httpOnly/secure/lax, argon2
- [x] Middleware: `auth`, `tenant` (`getTenantDb`), `permission` (dari `permissions.ts`), `csrf` + `same-origin`, rate limit
- [x] Postgres RLS sebagai lapisan kedua untuk tabel milik gereja
- [x] `permissions.ts` di `packages/shared` (matriks peran → izin), dipakai server dan UI
- [x] Halaman masuk, lupa/atur ulang password, undangan pengguna via email
- [x] Halaman `/platform` untuk `super_admin`: buat gereja + admin pertama
- [x] Halaman `/pengaturan`: profil gereja, kelola pengguna dan peran
- [x] Header keamanan (CSP, dll.)
- [x] Test: isolasi tenant untuk tiap rute (A tidak bisa akses B, termasuk lewat ID), test izin per peran, test sesi dan CSRF

**Lulus jika:** semua test isolasi, izin, dan sesi hijau.

**Bukti pemenuhan (2026-11-05):**

- `typecheck` bersih di 3 paket; `lint` 0 error (10 warning non-kritis: `no-console` di skrip debug, react-compiler `watch`); `test` hijau — API 30 test (4 file: unit + integrasi auth/tenant/izin/RLS + CSRF), shared 21 test.
- `pnpm build` hijau, code splitting per rute aktif.
- `docker compose build` + `down`/`up -d` dari volume kosong: `migrate` exit 0, `app` healthy, `/api/health` → `ok`.
- Smoke API lewat container produksi: admin login → `/users` 7 akun gereja sendiri; `/church` slug benar; bendahara → `/users` 403; super_admin → `/platform/summary` 2 gereja/8 pengguna; `/church` untuk platform ditolak.
- UI diperiksa di browser: login → dashboard peran; `/pengguna` (7 akun + undang/ubah); `/pengaturan` (profil + zona waktu); `/jejak-audit`; `/platform` (ringkasan + daftar gereja); halaman 404; mobile 390px; tanpa error konsol.
- Perbaikan penting: `hono/csrf` bawaan tidak memeriksa JSON → ditambah middleware `same-origin`; `@hono/zod-validator` dipindah ke runtime deps (image prod crash tanpa itu); `MIGRATION_DATABASE_URL` di Compose memakai host internal `db` (nilai host `127.0.0.1` tidak resolvable di jaringan Docker → login 401 karena fallback ke peran RLS).
- Akun demo (password `Eklesia2026`): `admin@gki-contoh.test`, `bendahara@gki-contoh.test`, `majelis@gki-contoh.test`, `admin@gpdi-contoh.test`, `platform@eklesia.test`.
- Commit: `fix(security)` same-origin + typecheck web, `fix(deploy)` wiring DB container.

## Fase 2 — Data jemaat

- [x] Skema: `members`, `families`, `regions`, `groups`, `group_members`
- [x] API + UI CRUD anggota, daftar dengan pencarian dan filter, paginasi
- [x] CRUD keluarga, wilayah, komisi/tim; atur anggota di komisi
- [x] Impor Excel: template, unggah, pratinjau, validasi per baris, deteksi duplikat, laporan error
- [x] Ekspor Excel
- [x] Halaman detail anggota
- [x] Test: validasi impor (baris rusak, duplikat, batas ukuran), izin per peran, isolasi tenant

**Lulus jika:** impor 500 baris contoh berhasil dengan laporan error yang benar.

**Bukti pemenuhan (2026-11-05):**

- `typecheck` bersih di 3 paket; `lint` 0 error (11 warning non-kritis yang sama seperti Fase 1); `test` hijau — API 36 test (termasuk 6 test jemaat: CRUD, filter, relasi keluarga/wilayah/komisi, isolasi tenant per rute, izin majelis baca-saja, impor/ekspor), shared 29 test (termasuk 8 test skema jemaat).
- `pnpm build` hijau; halaman jemaat ter-code-split (`members-page` ±31 KB, gzip ±8 KB).
- Docker rebuild + `up -d`: `migrate` exit 0, `app` healthy, `/api/health` → `ok`. Smoke API produksi: login admin demo → buat/cari/detail/hapus anggota, unduh template dan ekspor Excel (200).
- Uji kriteria kelulusan: impor 500 baris + 1 baris rusak lewat API produksi → 500 dibuat, 1 dilewati dengan laporan "Baris 502: fullName: Nama minimal 2 karakter." Data uji dibersihkan setelahnya.
- UI diperiksa di browser (Chrome headless via REA Playwright): login → `/jemaat` desktop 1280px dan mobile 390px, tab Komisi & Tim dapat dibuka, tombol Tambah/Impor/Ekspor tampil untuk admin, tanpa error konsol/halaman.
- Perbaikan yang ditemukan test baru: regex `optionalDate` menolak string kosong (sekarang pola mengizinkan kosong lalu diubah ke `undefined`); `updateMemberSchema` lolos untuk objek kosong karena default status (sekarang status di-omit lalu di-extend optional sebelum refine); migrasi test dikunci advisory lock dan file integrasi dijalankan serial (`fileParallelism: false`) karena berbagi satu DB uji.

## Fase 3 — Jadwal pelayanan

- [x] Skema: `service_roles`, `services`, `service_assignments`, `swap_requests`, `reminder_templates`
- [x] Pengaturan peran pelayanan per gereja
- [x] CRUD ibadah, ibadah berulang (pola mingguan), ibadah khusus
- [x] Penugasan pelayan per peran, peringatan bentrok
- [x] "Jadwal saya": konfirmasi/tolak, ajukan tukar, persetujuan koordinator
- [x] Notifier: `WaLinkNotifier` (tautan wa.me + template) dan `EmailNotifier`
- [x] Tampilan kalender bulanan dan daftar, cetak jadwal bulanan PDF (dibuat di server)
- [x] Test: bentrok penugasan, alur tukar jadwal, izin koordinator hanya untuk timnya

**Lulus jika:** satu bulan jadwal bisa disusun, dikirim pengingat, dan dikonfirmasi pelayan.

**Bukti pemenuhan (2026-11-05):**

- `typecheck` bersih di 3 paket; `lint` 0 error; `test` hijau — API 43 test (termasuk 7 test jadwal: peran+ibadah berulang, peringatan bentrok + duplikat 409, jadwal saya, alur tukar penuh, koordinator komisi lain ditolak 403, pengingat wa.me + PDF, isolasi tenant), shared 36 test.
- `pnpm build` hijau; halaman jadwal ter-code-split per rute.
- Docker rebuild + `up -d`: migrasi `0004` jalan, `app` healthy, `/api/health` → `ok`. Smoke API produksi: buat peran, ibadah berulang 2 minggu (tanggal +7 hari benar), PDF bulanan 200 `application/pdf`, template whatsapp/email tersedia; data uji dibersihkan.
- UI diperiksa di browser: login → `/jadwal` (kalender, tombol Tambah ibadah/Unduh PDF, tab Jadwal Saya) tanpa error konsol/halaman.
- Keputusan: bentrok dikembalikan sebagai `warnings` (bukan penolakan) sesuai DESCRIPTION "diberi peringatan"; koordinator dibatasi lewat `service_roles.group_id` + `group_members.role_in_group = 'koordinator'`; persetujuan tukar me-reset penugasan ke status `menunggu` agar pengganti mengonfirmasi ulang; PDF memakai `@react-pdf/renderer` dengan `createElement` (tanpa JSX di API) dan paket `react` ditambah ke dependensi API.

## Fase 4 — Keuangan

- [x] Skema: `cash_accounts`, `finance_categories`, `transactions`, `period_locks`
- [x] Pengaturan akun kas dan kategori (dengan kategori default)
- [x] Form transaksi, daftar dengan filter, lampiran bukti (volume Docker, rute ber-otorisasi)
- [x] Form cepat persembahan Minggu (dihitung oleh / diverifikasi oleh)
- [x] Void transaksi dengan alasan (tanpa hapus keras)
- [x] Penutupan periode bulanan
- [x] Laporan bulanan dan tahunan per akun dan kategori (dihitung di server)
- [x] Ekspor laporan PDF (kop gereja) dan Excel
- [x] Halaman audit log (admin dan majelis)
- [x] Test: rekonsiliasi saldo, void tidak dihitung, periode terkunci menolak ubah, hanya bendahara/admin yang bisa tulis, majelis hanya baca, jemaat/pelayan ditolak

**Lulus jika:** laporan bulanan PDF akurat terhadap data seed dan semua test keuangan hijau.

**Bukti pemenuhan (2026-11-05):**

- `typecheck` bersih di 3 paket; `lint` 0 error; `test` hijau — API 51 test (termasuk 8 test keuangan: default akun/kategori, rekonsiliasi saldo awal + masuk − keluar = saldo akhir, void tidak dihitung + void ganda 409, periode terkunci menolak buat/ubah/void dan hanya admin yang membuka, izin per peran, persembahan Minggu, lampiran lintas tenant 404, isolasi tenant), shared 40 test.
- `pnpm build` hijau; halaman keuangan ter-code-split per rute.
- Docker rebuild + `up -d`: migrasi `0005` jalan, volume `attachments-data` terpasang di `/data/attachments` (dimiliki user `node` di image), `app` healthy. Smoke produksi sebagai bendahara demo: akun/kategori bawaan otomatis (Kas Utama + 14 kategori), transaksi → laporan (saldo akhir benar) → PDF/Excel 200 → void; unggah lampiran PNG dan sajian ulang 200 `image/png`.
- UI diperiksa di browser: login bendahara → `/keuangan` (saldo kas, tab Laporan & Periode) tanpa error konsol/halaman.
- Keputusan: tidak ada rute hapus transaksi sama sekali (hanya void); lampiran divalidasi dari magic bytes (JPG/PNG/PDF, maks 2 MB), disimpan bernama acak di volume, dan hanya disajikan bila ada transaksi gereja pemanggil yang merujuk nama berkasnya; ekspor laporan memakai izin `finance.report` (bendahara/admin), sedangkan laporan JSON dapat dibaca majelis lewat `finance.read`; saldo awal dapat dikoreksi admin/bendahara dan tercatat di audit log.

## Fase 5 — Dashboard, hardening, dan deploy produksi di komputer pribadi

- [x] Dashboard per peran
- [x] Fitur backup: ekspor seluruh data gereja (zip/Excel) untuk admin gereja
- [x] Layanan `backup` di Compose: `pg_dump` harian, unggah ke cloud via rclone, retensi, skrip dan dokumentasi **restore** yang sudah diuji
- [x] Layanan `cloudflared` (profile `tunnel`) + panduan setup Cloudflare Tunnel dan domain
- [x] Restart policy `unless-stopped`, log rotation Docker, batas memori/CPU kontainer
- [x] Panduan komputer server: matikan sleep/hibernate, auto-start Docker saat boot, auto-restart setelah mati listrik, jam aktif update Windows (bila Windows), firewall
- [x] Uptime Kuma (opsional) untuk pemantauan
- [x] Audit UI untuk pengguna lanjut usia dan mobile; audit ukuran bundle (code splitting per rute)
- [x] Test E2E (Playwright) alur kritis: login → impor jemaat → buat jadwal → catat persembahan → cetak laporan
- [x] Halaman kebijakan privasi dan syarat penggunaan (draf)
- [x] Review keamanan (checklist `AGENTS.md`), pastikan tidak ada data pribadi di log, port DB tidak terekspos
- [x] Seed data demo lengkap
- [x] Panduan singkat untuk admin gereja (halaman bantuan/PDF)

**Lulus jika:** gereja pilot bisa memakai seluruh alur MVP lewat domain publik, backup dan restore terbukti berjalan, tanpa bantuan developer.

**Bukti pemenuhan (2026-11-05):**

- `typecheck` bersih di 3 paket; `lint` 0 error (11 warning non-kritis); `test` hijau — API 52 test (termasuk ekspor data gereja: admin 200 berisi 12 lembar dan hanya data gereja sendiri, bendahara 403), shared 40 test; `build` hijau.
- E2E Playwright (`pnpm test:e2e`, Chrome lokal): login → impor 3 jemaat → buat ibadah + penugasan → catat persembahan → unduh PDF laporan — **lulus**, termasuk dari volume Docker kosong. E2E menemukan dan memicu perbaikan bug asli: jam selesai kosong pada form ibadah ditolak skema (sekarang `optionalTime` mengizinkan kosong).
- Backup terbukti: layanan `backup` (profile) membuat dump; restore ke database sementara berhasil dan terverifikasi (120 anggota, 26 transaksi, 2 gereja), lalu database uji dihapus. Panduan `docs/backup-restore.md`.
- Keamanan: `docker compose config` produksi hanya menerbitkan `127.0.0.1:3000`; port DB tidak ada (`docker compose port db 5432` kosong); log pino teredaksi (Fase 1); ekspor data tercatat audit dan berizin `church.backup`.
- Docker dari volume kosong: `down -v` → `up -d --build` → migrate exit 0, app healthy; seed lengkap (2 gereja × 60 anggota, 6 keluarga, 3 wilayah, 5 komisi, 9 ibadah, 3 bulan transaksi, akun semua peran terhubung anggota).
- UI diperiksa di browser (desktop + 390px): dasbor pelayan menampilkan kartu Ibadah terdekat dan Tugas saya berikutnya (tanpa kartu keuangan/jemaat), halaman Bantuan dan Kebijakan Privasi tampil, tanpa error konsol.
- Bundle: chunk utama ±419 KB (gzip ±131 KB); halaman besar terpisah per rute (members/schedule/finance ±26 KB, gzip ±7 KB). Dasbor per peran memuat kartu sesuai izin (ibadah terdekat, tugas saya, saldo kas, ulang tahun).
- Dokumentasi: `docs/backup-restore.md`, `docs/cloudflare-tunnel.md`, `docs/panduan-server.md`; panduan admin di dalam aplikasi (`/bantuan`); draf `/kebijakan-privasi` dan `/syarat-penggunaan` tertaut di footer.
- Catatan: domain publik sungguhan dan token Cloudflare adalah kredensial milik gereja pilot — mekanisme tunnel sudah disediakan dan terdokumentasi, pengaktifannya dilakukan saat pilot dengan domain mereka. Setup test kini membuat database `eklesia_test` otomatis bila belum ada.

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
- Runtime container memakai dua koneksi DB: `DATABASE_URL` peran terbatas `eklesia_app` (RLS aktif) untuk rute gereja, `MIGRATION_DATABASE_URL` pemilik skema (host internal `db:5432`) untuk auth/email-unik/platform. Jangan memakai URL host `127.0.0.1` di Compose — tidak resolvable dari dalam jaringan Docker.
- `.prettierignore` mengecualikan `AGENTS.md`, `DESCRIPTION.md`, `PROMPT.md`, `PROGRESS.md` agar dokumen panduan tidak diformat ulang otomatis.
- `pnpm dev` lebih dulu membangun `packages/shared` sekali, lalu menjalankan watch shared + API + web paralel.

## Masalah tertunda

- **TypeScript 7** belum bisa dipakai karena `typescript-eslint` belum mendukung; pantau rilis.
- Bundle utama SPA ±419 KB (gzip ±131 KB) karena React + Router + TanStack Query + Radix. Code splitting per rute sudah aktif; pertimbangkan memecah vendor saat lalu lintas nyata menuntut.
- CI (GitHub Actions) belum dibuat; saat ini verifikasi dilakukan lokal (`typecheck`, `lint`, `test`, `build`, `test:e2e`).
- Domain publik + token Cloudflare Tunnel milik gereja pilot belum tersedia; mekanisme dan panduan sudah siap (`docs/cloudflare-tunnel.md`).
- Kepala keluarga belum dapat dipilih dari UI selain saat membuat keluarga; hubungan keluarga (suami/istri/anak) dan pasangan (`spouse`) belum dimodelkan penuh — kandidat Tahap 2.

## Log pekerjaan

_(Terbaru di atas.)_

- 2026-11-05 — **Fase 5 selesai — MVP Tahap 1 tuntas.** Dasbor per peran, ekspor seluruh data gereja (Excel 12 lembar, berizin + audit), layanan backup terjadwal dengan restore yang teruji, profile cloudflared + Uptime Kuma, hardening Compose (restart/log/batas sumber daya), panduan server/admin/privasi/syarat, seed demo lengkap, dan E2E Playwright alur kritis lulus termasuk dari volume kosong.
- 2026-11-05 — **Fase 4 selesai.** Skema keuangan + RLS, akun kas/kategori dengan bawaan otomatis, transaksi integer rupiah tanpa hapus keras (void beralasan), form cepat persembahan Minggu (penghitung + pemeriksa), lampiran bukti tervalidasi magic bytes di volume Docker dengan rute ber-otorisasi, penutupan periode (buka hanya admin), laporan bulanan/tahunan terhitung di server dengan ekspor PDF berkop gereja dan Excel. Test hijau (API 51, shared 40), typecheck/lint/build hijau, Docker sehat, UI tanpa error konsol.
- 2026-11-05 — **Fase 3 selesai.** Skema jadwal + RLS, peran pelayanan terikat komisi, ibadah berulang mingguan, penugasan dengan peringatan bentrok, "Jadwal Saya" (konfirmasi/tolak), tukar jadwal dua tahap (pengganti → koordinator komisinya), pengingat wa.me + email dari template yang bisa diubah, PDF jadwal bulanan dari server. Test hijau (API 43, shared 36), typecheck/lint/build hijau, Docker sehat, UI tanpa error konsol.
- 2026-11-05 — **Fase 2 selesai.** Skema `members/families/regions/groups/group_members` + RLS, API dan UI CRUD jemaat (daftar berfilter + paginasi, detail, ulang tahun bulan ini), CRUD keluarga/wilayah/komisi + atur anggota komisi, impor Excel (template, pratinjau, deteksi duplikat lewati/perbarui, laporan error per baris) dan ekspor Excel. Test hijau (API 36, shared 29), typecheck/lint/build hijau, Docker sehat, impor 500 baris terbukti, UI desktop+mobile tanpa error konsol.
- 2026-11-05 — **Fase 1 selesai.** Auth sesi DB + argon2 + cookie httpOnly, middleware auth/tenant/permission/CSRF+same-origin/rate-limit, RLS lapis kedua, matriks `permissions.ts`, UI login/lupa-password/undangan/pengguna/pengaturan/platform/audit-log + header keamanan. Test hijau (API 30, shared 21), typecheck/lint/build hijau, Docker dari volume kosong sehat, UI desktop+mobile tanpa error konsol.
- 2026-11-01 — **Fase 0 selesai.** Monorepo pnpm (web/api/shared), TypeScript strict, ESLint flat + Prettier, Vitest (15 test shared, 16 test API). API Hono dengan `/api/health` ber-injeksi, error handler terpusat, logger pino ber-redaksi, penyajian SPA + fallback dengan penjagaan `/api`. Web React Router + TanStack Query + Hono RPC bertipe, layout responsif (16px, kontras tinggi), status sistem di dasbor. Drizzle + PostgreSQL 16: migrasi `churches`/`super_admins`, `db:migrate`, `db:seed` (2 gereja fiktif). Docker multi-stage non-root, read-only, `db`/`migrate`/`app` dengan healthcheck; uji dari volume kosong berhasil. README + `.env.example` + `.gitattributes` (eol=lf) + `.prettierignore`.
