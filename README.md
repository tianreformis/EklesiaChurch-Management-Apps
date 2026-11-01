# Eklesia

Sistem manajemen gereja berbasis web, multi-tenant, untuk gereja Kristen di Indonesia.
Fokus MVP: **data jemaat, jadwal pelayanan, dan keuangan (kas + persembahan)**.

> Status pengembangan: **Fase 0 (fondasi)**. Lihat `PROGRESS.md`.
> Aturan teknis dan batasan: `AGENTS.md`. Produk dan model data: `DESCRIPTION.md`.

## Stack

- **Frontend** (`apps/web`): Vite + React, TypeScript strict, Tailwind CSS v4, komponen gaya shadcn/ui, React Router, TanStack Query, Hono RPC.
- **Backend** (`apps/api`): Hono (Node.js), Drizzle ORM, PostgreSQL, Zod, pino (dengan redaksi data pribadi).
- **Bersama** (`packages/shared`): konstanta aplikasi, `formatRupiah`, format tanggal Indonesia.
- **Deploy**: Docker Compose (`db`, `migrate`, `app`) dengan satu origin: Hono menyajikan API `/api` dan build SPA.

## Prasyarat

- Node.js 22+ (disarankan 24 LTS)
- pnpm 12 (`corepack enable` atau `npm i -g pnpm`)
- Docker Desktop / Docker Engine + Compose

## Menjalankan untuk development

1. Salin konfigurasi dan isi nilainya:

   ```bash
   cp .env.example .env
   ```

   Ganti `POSTGRES_PASSWORD` dengan password yang kuat dan sesuaikan `DATABASE_URL`.

2. Nyalakan PostgreSQL (port hanya diikat ke `127.0.0.1`):

   ```bash
   pnpm db:up
   ```

   Port host default di `.env.example` adalah **55432** (`POSTGRES_PORT`) karena 5432
   sering sudah dipakai PostgreSQL lain di komputer pengembang.

3. Jalankan migrasi dan (opsional) seed data demo:

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

4. Pasang dependensi lalu jalankan web + api:

   ```bash
   pnpm install
   pnpm dev
   ```

   - Web: <http://localhost:5173> (proxy `/api` → Hono di port 3000)
   - API health: <http://localhost:3000/api/health>

5. Menghentikan database:

   ```bash
   pnpm db:down
   ```

### Perintah berguna

| Perintah           | Fungsi                                             |
| ------------------ | -------------------------------------------------- |
| `pnpm dev`         | Menjalankan shared (watch), API, dan web sekaligus |
| `pnpm typecheck`   | Typecheck seluruh paket                            |
| `pnpm lint`        | ESLint                                             |
| `pnpm test`        | Vitest (unit test shared + API)                    |
| `pnpm build`       | Build shared → api → web                           |
| `pnpm format`      | Prettier                                           |
| `pnpm db:generate` | Membuat migrasi baru dari skema Drizzle            |
| `pnpm db:migrate`  | Menjalankan migrasi                                |
| `pnpm db:seed`     | Seed gereja demo fiktif                            |

## Menjalankan untuk produksi (komputer gereja)

```bash
cp .env.example .env   # lalu ubah password & APP_PORT
docker compose up -d --build
```

- Aplikasi hanya mendengarkan di `127.0.0.1:${APP_PORT}` (default 3000).
  Untuk akses dari jaringan lain, gunakan Cloudflare Tunnel (fase deployment).
- Migrasi berjalan otomatis lewat layanan `migrate` sebelum `app` start.
- Cek kesehatan: `docker compose ps` dan <http://127.0.0.1:3000/api/health>.
- PostgreSQL **tidak** mempublikasikan port ke host.

## Struktur proyek

```
apps/
  web/        # SPA React (rute, fitur, komponen UI)
  api/        # Hono (routes, modules, db, lib, middleware)
packages/
  shared/     # kode & tipe bersama
docker-compose.yml        # produksi: db, migrate, app
docker-compose.dev.yml    # override dev: port DB di 127.0.0.1
Dockerfile                # multi-stage, runtime non-root
```

## Mengganti nama aplikasi

Ubah `APP_NAME` di `packages/shared/src/constants.ts` (sumber tunggal untuk UI), nilai
`APP_NAME` di `.env`, judul di `apps/web/index.html`, dan teks di `DESCRIPTION.md`.

## Catatan keamanan

- `church_id` selalu diambil dari sesi server, tidak pernah dari input klien.
- Nominal uang disimpan sebagai integer rupiah; transaksi tidak pernah dihapus keras.
- Log tidak boleh memuat nomor HP, email, nominal, password, atau token (redaksi otomatis di pino).
- Jangan commit `.env`. Secret hanya lewat environment variable.
