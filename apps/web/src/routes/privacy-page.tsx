import { APP_NAME } from '@eklesia/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-bold">Kebijakan Privasi {APP_NAME}</h1>
      <p className="text-lg text-muted-foreground">
        Draf kebijakan privasi. Sesuaikan dengan identitas penyelenggara layanan sebelum dipakai
        untuk gereja sungguhan.
      </p>

      <Card>
        <CardHeader><CardTitle>Data yang disimpan</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 text-base">
          <p>
            {APP_NAME} menyimpan data jemaat (nama, kontak, tanggal penting, keluarga, wilayah,
            komisi), jadwal pelayanan, dan keuangan gereja yang dimasukkan oleh pengurus gereja
            Anda. Data setiap gereja terpisah dan tidak dapat diakses gereja lain.
          </p>
          <p>
            Password disimpan sebagai hash argon2 dan tidak pernah dalam bentuk teks biasa. Sesi
            masuk memakai cookie httpOnly. Nomor telepon, email, dan nominal keuangan tidak dicatat
            dalam log aplikasi.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Penggunaan data</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 text-base">
          <p>
            Data hanya dipakai untuk keperluan administrasi gereja Anda: pendataan jemaat,
            penyusunan jadwal pelayanan, pengingat tugas, dan laporan keuangan internal. Data tidak
            dijual dan tidak dibagikan ke pihak ketiga untuk iklan.
          </p>
          <p>
            Pengurus dapat mengekspor data gereja untuk cadangan. Setiap ekspor oleh admin tercatat
            dalam jejak audit gereja.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Hak jemaat</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 text-base">
          <p>
            Sesuai UU Perlindungan Data Pribadi, jemaat berhak meminta salinan, perbaikan, atau
            penghapusan data pribadinya melalui pengurus gereja. Penghapusan data keuangan mengikuti
            kewajiban pembukuan: transaksi tidak dihapus, hanya dibatalkan (void) dengan alasan.
          </p>
          <p>
            Pertanyaan privasi dapat disampaikan kepada admin gereja Anda atau pengelola platform
            melalui kontak resmi yang tercantum pada halaman masuk.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
