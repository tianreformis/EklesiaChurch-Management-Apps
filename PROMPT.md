# PROMPT untuk OpenCode

## Prompt awal (jalankan sekali)

```
Kamu adalah senior full-stack engineer. Kita akan membangun aplikasi web
manajemen gereja Kristen untuk pasar Indonesia, multi-tenant, dijual per gereja.
Nama kerja: Eklesia.

Stack sudah ditetapkan dan tidak boleh diganti: Vite + React (SPA), Hono,
PostgreSQL + Drizzle, dalam monorepo pnpm, dijalankan dengan Docker Compose
di komputer pribadi yang berfungsi sebagai server.

Di folder proyek sudah ada tiga file panduan:
- AGENTS.md      → aturan teknis, stack, keamanan, dan batasan (WAJIB dipatuhi)
- DESCRIPTION.md → produk, peran, modul MVP, aturan bisnis, model data
- PROGRESS.md    → checklist fase dan log pekerjaan

Langkah:
1. Baca ketiga file tersebut sampai selesai.
2. Kerjakan HANYA Fase 0 (Fondasi) di PROGRESS.md.
3. Sebelum koding, tulis rencana singkat: struktur monorepo, dependensi,
   Dockerfile/Compose, dan skema migrasi awal.
4. Setelah selesai, jalankan pnpm typecheck, lint, test, build, lalu
   docker compose up -d --build dan cek /api/health, sampai semuanya hijau.
5. Perbarui PROGRESS.md: centang tugas yang selesai, tulis keputusan/asumsi,
   dan tambahkan entri log.
6. Berhenti dan laporkan ringkasan: apa yang selesai, apa yang perlu
   keputusan saya, dan rekomendasi fase berikutnya.

Jangan mengerjakan fase berikutnya sebelum saya minta.
```

## Prompt lanjutan (per fase, salin sesuai kebutuhan)

```
Lanjutkan ke Fase <N> di PROGRESS.md. Baca ulang AGENTS.md dan DESCRIPTION.md,
lalu periksa log terakhir di PROGRESS.md. Kerjakan semua tugas Fase <N> saja,
sertakan test yang diminta (terutama isolasi tenant dan izin per peran).
Jalankan typecheck, lint, test, build. Perbarui PROGRESS.md, lalu laporkan
ringkasan dan hal yang perlu keputusan saya.
```

## Prompt perbaikan / review (opsional)

```
Lakukan review keamanan terhadap kode saat ini sesuai bagian "Aturan multi-tenant",
"Aturan keuangan", dan "Aturan keamanan dan privasi" di AGENTS.md.
Cari: query tanpa filter church_id, church_id yang diambil dari input klien,
endpoint tanpa cek otorisasi di server, log yang memuat data pribadi,
dan operasi hapus keras pada transaksi. Daftarkan temuan berdasarkan tingkat
keparahan, perbaiki yang kritis, tambahkan test regresi, dan catat di PROGRESS.md.
```

## Cara pakai

1. Buat folder proyek, salin `AGENTS.md`, `DESCRIPTION.md`, `PROGRESS.md` ke root.
2. Buka OpenCode di folder tersebut, tempel **Prompt awal**.
3. Tinjau hasil tiap fase sebelum lanjut. Lakukan commit per fase.
4. Ganti nama aplikasi kapan saja lewat konstanta `APP_NAME` dan teks di `DESCRIPTION.md`.
