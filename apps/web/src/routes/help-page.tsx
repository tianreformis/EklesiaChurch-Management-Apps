import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const sections: { title: string; steps: string[] }[] = [
  {
    title: '1. Memasukkan data jemaat pertama kali',
    steps: [
      'Buka menu Jemaat, lalu unduh template Excel dari tombol Impor Excel.',
      'Isi data mengikuti contoh, hapus baris contoh, lalu unggah berkasnya.',
      'Periksa pratinjau: baris duplikat dan baris yang salah ditandai. Pilih Lewati atau Perbarui untuk duplikat, lalu Konfirmasi impor.',
      'Setelah itu buat Keluarga, Wilayah, dan Komisi/Tim pada tab masing-masing, lalu atur anggota komisi lewat tombol Atur anggota.',
    ],
  },
  {
    title: '2. Menyusun jadwal pelayanan sebulan',
    steps: [
      'Di menu Jadwal → tab Peran & Template, buat peran pelayanan (Pemusik, Usher, dan lain-lain). Ikat peran ke komisi agar koordinatornya bisa membantu.',
      'Tekan Tambah ibadah, isi tanggal ibadah Minggu pertama, dan isi "Berulang mingguan" = 4 untuk membuat sebulan sekaligus.',
      'Klik ibadahnya, lalu tugaskan pelayan per peran. Peringatan oranye berarti orang yang sama bertugas ganda pada jam yang sama.',
      'Tekan Siapkan pengingat WhatsApp untuk mendapat tautan wa.me per pelayan, atau Kirim juga via email bila SMTP sudah diatur.',
      'Unduh PDF bulan ini untuk ditempel di papan pengumuman.',
    ],
  },
  {
    title: '3. Mencatat persembahan dan kas',
    steps: [
      'Di menu Keuangan → tab Persembahan Minggu, pilih ibadah, isi nominal per pos, nama penghitung dan pemeriksa, lalu Simpan. Target: selesai kurang dari 2 menit.',
      'Pengeluaran dan pemasukan lain dicatat lewat tombol Catat transaksi. Lampirkan foto/PDF bukti bila ada.',
      'Salah catat? Jangan khawatir: tekan Batalkan pada transaksi dan tulis alasannya (void). Transaksi tidak dihapus dan tetap terlihat di jejak audit.',
      'Akhir bulan: periksa tab Laporan & Periode, unduh PDF laporan, lalu Tutup periode agar bulan itu tidak berubah lagi.',
    ],
  },
  {
    title: '4. Mengundang pengurus lain',
    steps: [
      'Menu Pengguna → Undang pengguna. Pilih peran sesuai tanggung jawab: Bendahara untuk keuangan, Sekretaris untuk jemaat/jadwal, Koordinator komisi untuk timnya, Pelayan untuk melihat jadwal sendiri.',
      'Bila email otomatis belum aktif, salin tautan undangan yang tampil dan kirim lewat WhatsApp.',
      'Agar pelayan melihat "Jadwal Saya", hubungkan akunnya ke data anggota yang sesuai (dibantu admin saat pembuatan data).',
    ],
  },
  {
    title: '5. Keamanan dan cadangan',
    steps: [
      'Gunakan password yang berbeda dari akun lain dan jangan berbagi akun antar pengurus.',
      'Secara berkala unduh ekspor data Excel di menu Pengaturan dan simpan di tempat aman (berkas memuat data pribadi).',
      'Bila ada pengurus berganti, nonaktifkan akunnya di menu Pengguna agar sesi lamanya langsung berakhir.',
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Panduan singkat admin gereja</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Langkah praktis memakai Eklesia sehari-hari. Bacalah dari atas ke bawah saat pertama
          kali menyiapkan gereja Anda.
        </p>
      </div>

      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex list-decimal flex-col gap-2 pl-6 text-base">
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Butuh bantuan lebih lanjut?</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-base">
          <p>
            Periksa <Link className="font-semibold underline" to="/jejak-audit">jejak audit</Link>{' '}
            untuk melihat siapa mengubah apa, dan halaman{' '}
            <Link className="font-semibold underline" to="/kebijakan-privasi">kebijakan privasi</Link>{' '}
            untuk cara data jemaat dilindungi.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
