# DESCRIPTION.md — Eklesia (nama kerja)

## 1. Ringkasan produk

Aplikasi web manajemen gereja untuk gereja Kristen di Indonesia. Satu aplikasi melayani banyak gereja (multi-tenant), dijual per gereja dengan sistem langganan. Fokus MVP: **data jemaat, jadwal pelayanan, dan keuangan (kas + persembahan)**.

Tagline sementara: _"Kelola jemaat, pelayanan, dan kas gereja dalam satu tempat."_

## 2. Pengguna dan peran

| Peran              | Kode                 | Hak utama                                                                                           |
| ------------------ | -------------------- | --------------------------------------------------------------------------------------------------- |
| Pemilik platform   | `super_admin`        | Membuat/menonaktifkan gereja (tenant), melihat status langganan. Tidak melihat data jemaat/keuangan |
| Admin gereja       | `admin_gereja`       | Mengelola semua modul gereja, pengguna, dan pengaturan                                              |
| Bendahara          | `bendahara`          | Input dan ubah transaksi, buat laporan keuangan                                                     |
| Majelis            | `majelis`            | Lihat laporan keuangan dan data jemaat (baca saja)                                                  |
| Sekretaris         | `sekretaris`         | Kelola data jemaat dan jadwal ibadah                                                                |
| Koordinator komisi | `koordinator_komisi` | Kelola anggota dan jadwal pelayanan untuk komisi/tim miliknya                                       |
| Pelayan            | `pelayan`            | Lihat jadwal sendiri, konfirmasi, ajukan tukar jadwal                                               |
| Jemaat             | `jemaat`             | Lihat profil sendiri dan jadwal ibadah umum. Tidak bisa lihat keuangan                              |

Satu pengguna hanya terikat ke satu gereja pada MVP. Satu orang jemaat (`members`) bisa punya akun (`users`) atau tidak.

## 3. Modul MVP (Tahap 1)

### 3.1 Data jemaat

- Data anggota: nama lengkap, nama panggilan, jenis kelamin, tanggal lahir, nomor HP/WhatsApp, email, alamat, status (aktif, pindah, meninggal, tidak aktif), foto opsional.
- Status sakramen/gerejawi: baptis (tanggal), sidi/peneguhan (tanggal), nikah (tanggal, pasangan). Label disesuaikan agar umum untuk banyak denominasi.
- Pengelompokan:
  - **Keluarga**: kepala keluarga + anggota, hubungan (suami, istri, anak, dll.).
  - **Wilayah/kelompok sel**: satu anggota ke satu wilayah.
  - **Komisi/tim**: Sekolah Minggu, remaja, pemuda, kaum bapak, kaum ibu, lansia, serta tim pelayanan (multimedia, musik, usher, dll.). Satu anggota bisa ikut banyak komisi.
- Pencarian cepat (nama, HP), filter (wilayah, komisi, status, rentang usia, ulang tahun bulan ini).
- **Impor Excel**: unduh template, unggah, pratinjau, validasi per baris, laporan error, konfirmasi impor. Deteksi duplikat (nama + tanggal lahir atau nomor HP) dengan pilihan lewati/perbarui.
- Ekspor data ke Excel.

### 3.2 Jadwal pelayanan

- **Jadwal ibadah**: ibadah Minggu rutin (pola berulang), ibadah khusus, hari raya (Natal, Paskah, dll.). Atribut: nama, tanggal, jam, lokasi, tema/tema khotbah opsional, pengkhotbah.
- **Peran pelayanan** (dapat dikonfigurasi per gereja): pemimpin liturgi, pemusik, singer/worship leader, multimedia, penerima tamu/usher, kolektan, pembaca Alkitab, dan lainnya.
- **Penugasan**: pilih ibadah → tetapkan orang untuk tiap peran. Cegah bentrok (orang yang sama di dua peran pada jam yang sama diberi peringatan).
- **Pelayan**: melihat "jadwal saya", status penugasan `menunggu` → `dikonfirmasi` atau `ditolak`. **Ajukan tukar**: pilih pengganti, pengganti menerima/menolak, lalu koordinator menyetujui.
- **Pengingat**: H-3 dan H-1 sebelum ibadah. MVP: pengurus menekan tombol "Kirim pengingat" yang membuka tautan `wa.me` dengan teks siap kirim per orang, ditambah email otomatis bila SMTP diatur. Teks pengingat dapat diubah (template).
- Tampilan kalender bulanan dan daftar, cetak jadwal bulanan (PDF) untuk ditempel.

### 3.3 Keuangan: kas dan persembahan

- **Akun kas**: kas utama, kas diakonia, kas pembangunan, dll. (dapat ditambah). Saldo awal tiap akun.
- **Pos/kategori**:
  - Pemasukan: perpuluhan, persembahan Minggu, ucapan syukur, diakonia, pembangunan, misi, lain-lain.
  - Pengeluaran: operasional, gaji/honor, listrik/air, diakonia, pembangunan, misi, lain-lain.
  - Kategori dapat ditambah/diubah oleh admin.
- **Transaksi**: tanggal, jenis (masuk/keluar), akun kas, kategori, nominal (integer rupiah), keterangan, lampiran bukti (gambar/PDF, maks 2 MB) opsional, terkait ibadah opsional, pencatat otomatis.
- **Persembahan Minggu**: form cepat per ibadah (jumlah per kategori) dengan kolom "dihitung oleh" dan "diverifikasi oleh" (dua orang).
- **Perpuluhan per jemaat** TIDAK di MVP (tahap 2). Transaksi perpuluhan di MVP dicatat total tanpa menautkan ke jemaat.
- **Void, bukan hapus**: transaksi salah di-`void` dengan alasan. Tidak ada hapus keras.
- **Laporan**:
  - Bulanan dan tahunan: saldo awal, total pemasukan per kategori, total pengeluaran per kategori, saldo akhir, per akun kas.
  - Ekspor **PDF** (siap cetak untuk laporan jemaat, kop gereja dari pengaturan) dan **Excel**.
  - Filter periode dan akun kas.
- **Audit log**: setiap buat/ubah/void tercatat (pengguna, waktu, nilai sebelum/sesudah). Dapat dilihat admin dan majelis.
- **Penutupan periode** (opsional di MVP): bendahara dapat mengunci bulan tertentu; transaksi pada bulan terkunci tidak bisa diubah kecuali dibuka admin.

### 3.4 Hak akses dan multi-tenant

- Registrasi gereja dibuat oleh `super_admin` (atau form pendaftaran yang disetujui). Setiap gereja punya slug unik, nama, alamat, logo, zona waktu.
- Admin gereja mengundang pengguna lewat email (tautan atur password) dan menetapkan peran.
- Matriks izin dituliskan di satu tempat (`modules/auth/permissions.ts`) dan dipakai UI serta server.
- Isolasi data antar gereja total (lihat `AGENTS.md`).

## 4. Di luar MVP (jangan dibangun sekarang)

- Tahap 2: absensi ibadah/QR, kalender umum jemaat, pengumuman dan warta, perpuluhan per jemaat, pengingat ulang tahun, kunjungan pastoral, inventaris aset.
- Tahap 3: PWA/aplikasi jemaat, persembahan online (QRIS/VA), perpustakaan lagu dan liturgi, kegiatan khusus, laporan multi-cabang.
- Siapkan hook saja: struktur modul yang bisa ditambah, interface `Notifier` yang bisa diganti.

## 5. Model data awal (acuan, boleh disempurnakan)

Semua tabel kecuali `churches` dan `super_admins` punya `church_id`.

- `churches`: id, name, slug, address, phone, logo_url, timezone, plan, status, created_at
- `users`: id, church_id, member_id (nullable), name, email (unik per gereja), password_hash, role, is_active, last_login_at
- `members`: id, church_id, family_id, region_id, full_name, nickname, gender, birth_date, phone, email, address, status, baptism_date, sidi_date, marriage_date, spouse_member_id, photo_url, notes
- `families`: id, church_id, name, head_member_id
- `regions`: id, church_id, name
- `groups` (komisi/tim): id, church_id, name, type (`komisi` | `tim_pelayanan`)
- `group_members`: id, church_id, group_id, member_id, role_in_group
- `service_roles`: id, church_id, name, group_id (nullable), sort_order
- `services` (ibadah): id, church_id, title, date, start_time, location, theme, preacher, recurrence_id (nullable), status
- `service_assignments`: id, church_id, service_id, service_role_id, member_id, status (`menunggu` | `dikonfirmasi` | `ditolak`), notes
- `swap_requests`: id, church_id, assignment_id, requested_by, proposed_member_id, status, resolved_by
- `reminder_templates`: id, church_id, channel, body
- `cash_accounts`: id, church_id, name, opening_balance (int), is_active
- `finance_categories`: id, church_id, name, type (`in` | `out`), is_active
- `transactions`: id, church_id, account_id, category_id, type, amount (int), date, description, service_id (nullable), attachment_url, status (`aktif` | `void`), void_reason, created_by, created_at
- `period_locks`: id, church_id, year, month, locked_by, locked_at
- `audit_logs`: id, church_id, user_id, entity, entity_id, action, before (jsonb), after (jsonb), created_at

Indeks minimum: `(church_id)` di semua tabel, `(church_id, date)` di `transactions` dan `services`, `(church_id, full_name)` di `members`.

## 6. Aturan bisnis penting

1. Nominal selalu integer rupiah, tidak boleh negatif. Jenis (masuk/keluar) menentukan arah.
2. Transaksi `void` tidak dihitung di laporan tetapi tetap tampil di audit log.
3. Saldo akun = saldo awal + total masuk aktif − total keluar aktif (sampai tanggal tertentu).
4. Bendahara tidak bisa mengubah transaksi pada bulan yang terkunci.
5. Pelayan hanya melihat penugasan miliknya dan jadwal ibadah umum; koordinator hanya mengelola tim/komisinya.
6. Jemaat biasa tidak bisa melihat data anggota lain (hanya miliknya).
7. Impor Excel tidak boleh menimpa data tanpa pratinjau dan konfirmasi.
8. Setiap aksi sensitif (login gagal berulang, ubah peran, void transaksi, ekspor data) dicatat.

## 7. Halaman utama (peta navigasi)

- `/masuk`, `/lupa-password`, `/undangan/[token]`
- `/dashboard` (ringkasan sesuai peran: jadwal terdekat, saldo kas, ulang tahun bulan ini bila ada)
- `/jemaat` (daftar, detail, tambah, impor, keluarga, wilayah, komisi)
- `/jadwal` (kalender, daftar ibadah, penugasan, jadwal saya, tukar jadwal)
- `/keuangan` (transaksi, persembahan Minggu, akun kas, kategori, laporan, audit log)
- `/pengaturan` (profil gereja, pengguna dan peran, peran pelayanan, template pengingat, backup/ekspor data)
- `/platform` (khusus super_admin: daftar gereja)

## 8. Kriteria keberhasilan MVP

- Satu gereja pilot dapat: mengimpor data jemaat dari Excel, menyusun jadwal pelayanan sebulan dan mengirim pengingat, mencatat persembahan Minggu dan transaksi, serta mencetak laporan bulanan PDF.
- Tidak ada kebocoran data antar gereja (terbukti oleh test).
- Bendahara non-teknis bisa menyelesaikan input persembahan Minggu kurang dari 2 menit.

## 9. Data seed untuk pengembangan

Buat seed fiktif: 2 gereja ("GKI Contoh Sejahtera", "GPdI Contoh Damai"), masing-masing ±60 anggota, 6 keluarga, 3 wilayah, 5 komisi, 2 bulan jadwal ibadah, dan 3 bulan transaksi. Akun demo untuk setiap peran. Gunakan nama dan nomor HP fiktif.

## 10. Arsitektur dan deployment (ringkas)

Detail teknis lengkap ada di `AGENTS.md`. Ringkasnya:

- **Frontend:** Vite + React (SPA), Tailwind, shadcn/ui, React Router, TanStack Query.
- **Backend:** Hono (Node.js) dengan Drizzle ORM dan PostgreSQL. Frontend memanggil API lewat Hono RPC (tipe dibagi, tanpa tipe ganda).
- **Kode bersama:** `packages/shared` (skema Zod, matriks izin, helper rupiah dan tanggal).
- **Satu origin:** di produksi Hono menyajikan SPA dan `/api`, sehingga tidak perlu CORS dan cookie sesi tetap sederhana.
- **Docker Compose:** `db` (PostgreSQL, tanpa port publik), `migrate`, `app`, `backup` (dump harian ke cloud), `cloudflared` (opsional, untuk akses publik tanpa membuka port router).
- **Host:** komputer pribadi sebagai server untuk gereja pilot. Setelah ada pelanggan berbayar, konfigurasi Compose yang sama dapat dipindahkan ke VPS tanpa perubahan kode.
- **Aturan emas:** `church_id` selalu dari sesi server, nominal selalu integer rupiah, transaksi tidak pernah dihapus keras, backup harus pernah diuji restore.
