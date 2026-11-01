import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Memuat file `.env` di lingkungan development.
 *
 * Di Docker, variabel sudah disuntikkan oleh Compose sehingga fungsi ini tidak
 * melakukan apa pun. Node.js >= 20.12 menyediakan `process.loadEnvFile`, jadi
 * tidak perlu dependensi dotenv.
 */
export function loadEnvFile(): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const candidates = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return;
    }
  }
}
