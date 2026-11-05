# Akses Publik lewat Cloudflare Tunnel

Cloudflare Tunnel membuat aplikasi di komputer gereja dapat dibuka dari
domain publik **tanpa membuka port router** dan tanpa IP publik. Kontainer
`cloudflared` membuat koneksi keluar ke Cloudflare; tidak ada port masuk
yang dibuka di rumah/kantor gereja.

## Langkah setup

1. Buat akun Cloudflare dan tambahkan domain gereja (atau subdomain dari
   domain yang sudah dikelola) ke Cloudflare.
2. Buka Cloudflare Zero Trust → Networks → Tunnels → **Create a tunnel**,
   pilih konektor **Cloudflared**, beri nama misalnya `eklesia-gereja`.
3. Salin **token** tunnel yang ditampilkan, lalu isi di `.env` komputer
   server:

   ```
   TUNNEL_TOKEN=eyJ...
   ```

   Jangan commit token ke git.
4. Pada halaman tunnel yang sama, tambahkan **Public Hostname**:
   - Subdomain: misalnya `aplikasi`
   - Domain: domain gereja Anda
   - Service: `HTTP` → `app:3000`

   `app` adalah nama layanan di jaringan Docker yang sama.
5. Sesuaikan `APP_BASE_URL` di `.env` menjadi alamat publik, misalnya
   `https://aplikasi.gereja-contoh.id`, agar tautan undangan/reset password
   dan cookie Secure benar.
6. Jalankan:

   ```powershell
   docker compose --profile tunnel up -d
   ```

7. Buka alamat publik dari HP di luar jaringan rumah. Anda harus melihat
   halaman masuk Eklesia dengan HTTPS dari Cloudflare.

## Keamanan

- Port PostgreSQL tidak pernah dipublikasikan; hanya `cloudflared` yang
  membuat koneksi keluar.
- Aplikasi sendiri hanya mendengarkan di `127.0.0.1` pada host.
- Aktifkan Cloudflare Access (Zero Trust) bila ingin lapisan login tambahan
  sebelum halaman Eklesia, misalnya membatasi ke email pengurus.
- Bila token bocor, buat token baru di dashboard Cloudflare dan perbarui
  `.env`, lalu `docker compose --profile tunnel up -d cloudflared`.
