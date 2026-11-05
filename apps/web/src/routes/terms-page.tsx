import { APP_NAME } from '@eklesia/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TermsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-bold">Syarat Penggunaan {APP_NAME}</h1>
      <p className="text-lg text-muted-foreground">
        Draf syarat penggunaan. Minta peninjauan hukum sebelum dipakai secara komersial.
      </p>

      <Card>
        <CardHeader><CardTitle>Layanan</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 text-base">
          <p>
            {APP_NAME} adalah perangkat lunak manajemen gereja yang dipakai berdasarkan langganan
            per gereja. Fitur mencakup data jemaat, jadwal pelayanan, dan keuangan kas gereja.
          </p>
          <p>
            Pengelola platform dapat memperbarui fitur dengan pemberitahuan wajar. Akses dapat
            dibatasi bila langganan berakhir atau syarat ini dilanggar.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tanggung jawab gereja</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 text-base">
          <p>
            Gereja bertanggung jawab atas kebenaran data yang dimasukkan, menjaga kerahasiaan akun
            pengurus, dan hanya memberi akses kepada orang yang berwenang. Data jemaat adalah data
            pribadi; jangan dibagikan tanpa dasar yang sah.
          </p>
          <p>
            Gereja disarankan mengunduh ekspor data secara berkala sebagai cadangan tambahan selain
            cadangan otomatis penyelenggara.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Batasan</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 text-base">
          <p>
            Layanan disediakan apa adanya sesuai ketersediaan. Laporan keuangan yang dihasilkan
            adalah alat bantu pembukuan internal dan tidak menggantikan kewajiban perpajakan atau
            audit formal gereja.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
